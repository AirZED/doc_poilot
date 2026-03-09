import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type {
    DocpilotConfig,
    GenerateResult,
    LLMAdapter,
    TargetFile,
    TokenUsage,
} from '../types/index.js';
import { getChangedFiles } from '../core/diff';
import { buildChunksFromDiff, retrieveTopK } from '../core/chunker';
import { buildPrompt } from '../core/prompt';
import { patchDocFile } from '../core/writer';
import { OpenAIAdapter } from '../llm/openai';
import { AnthropicAdapter } from '../llm/anthropic';
import { GeminiAdapter } from '../llm/gemini';
import { updateSummaryFile } from '../core/gitbook';

// ─── Config loader ────────────────────────────

function loadConfig(): DocpilotConfig {
    const configPath = path.join(process.cwd(), '.docpilot', 'config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(
            'DocPilot is not initialized. Run `docpilot init` first.'
        );
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as DocpilotConfig;
}

function loadLLMAdapter(config: DocpilotConfig, options: GenerateOptions): LLMAdapter {
    // Load .env from .docpilot dir
    dotenv.config({ path: path.join(process.cwd(), '.docpilot', '.env') });

    let apiKey = '';

    // Prioritize CLI flags
    if (config.llm.provider === 'openai' && options.openaiApiKey) {
        apiKey = options.openaiApiKey;
    } else if (config.llm.provider === 'anthropic' && options.anthropicApiKey) {
        apiKey = options.anthropicApiKey;
    } else if (config.llm.provider === 'gemini' && options.geminiApiKey) {
        apiKey = options.geminiApiKey;
    } else {
        // Fallback to .env or environment variables
        apiKey = process.env[config.llm.apiKeyEnvVar] || '';
    }

    if (!apiKey) {
        throw new Error(
            `Missing API key. Set ${config.llm.apiKeyEnvVar} in .env or pass it via CLI.`
        );
    }

    if (config.llm.provider === 'openai') {
        return new OpenAIAdapter(apiKey, config.llm.model);
    } else if (config.llm.provider === 'anthropic') {
        return new AnthropicAdapter(apiKey, config.llm.model);
    }
    return new GeminiAdapter(apiKey, config.llm.model);
}

function loadExistingDoc(targetFile: TargetFile): string {
    const absPath = path.resolve(process.cwd(), targetFile.path);
    if (fs.existsSync(absPath)) {
        return fs.readFileSync(absPath, 'utf-8');
    }
    return '';
}

// ─── Token cost calculation ───────────────────

const COST_PER_1K: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'gemini-1.5-pro': { input: 0.00125, output: 0.00375 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
};

function estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
): number {
    const rates = COST_PER_1K[model] ?? { input: 0.005, output: 0.015 };
    return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

// ─── Main export ──────────────────────────────

export interface GenerateOptions {
    readonly dryRun: boolean;
    readonly since?: string | undefined;
    readonly openaiApiKey?: string | undefined;
    readonly anthropicApiKey?: string | undefined;
    readonly geminiApiKey?: string | undefined;
}

export async function runGenerate(options: GenerateOptions): Promise<void> {
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;

    const spinner = ora('Loading DocPilot config...').start();

    let config: DocpilotConfig;
    let adapter: LLMAdapter;

    try {
        config = loadConfig();
        adapter = loadLLMAdapter(config, options);
    } catch (err) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
        return;
    }

    spinner.succeed('Config loaded');

    // 1. Get changed files
    spinner.start('Analysing git diff...');
    const since = options.since ?? 'HEAD~1';
    const diffHunks = await getChangedFiles(process.cwd(), since);

    if (diffHunks.length === 0) {
        spinner.info('No code changes detected. Documentation is up to date.');
        return;
    }
    spinner.succeed(`Found ${diffHunks.length} changed file(s)`);

    // 2. Build chunks
    spinner.start('Chunking changed code (RAG)...');
    const chunks = buildChunksFromDiff(diffHunks);
    spinner.succeed(`Built ${chunks.length} semantic chunk(s)`);

    // 3. Embed chunks
    spinner.start('Embedding chunks...');
    const embeddedChunks = [...chunks];
    for (const chunk of embeddedChunks) {
        chunk.embedding = await adapter.embed(chunk.content);
    }
    spinner.succeed('Chunks embedded');

    // 4. Process each target
    const allUpdates: import('../types/index.js').DocUpdate[] = [];
    const totalTokenUsage: { input: number; output: number } = { input: 0, output: 0 };

    for (const docType of config.docTypes) {
        for (const target of config.targets) {
            spinner.start(
                `Generating ${chalk.cyan(docType)} docs for ${chalk.yellow(target.path)}...`
            );

            // Build query from doc type to fetch relevant chunks
            const queryText = `${docType} documentation for ${target.type}`;
            const queryEmbedding = await adapter.embed(queryText);
            const retrieved = retrieveTopK(queryEmbedding, embeddedChunks, 5);

            const existingDoc = loadExistingDoc(target);

            const { systemPrompt, userPrompt } = buildPrompt({
                docType,
                framework: config.detectedFramework,
                retrievedChunks: retrieved,
                diffHunks,
                existingDocContent: existingDoc,
                targetType: target.type,
            });

            const llmResponse = await adapter.complete({ systemPrompt, userPrompt });
            totalTokenUsage.input += llmResponse.inputTokens;
            totalTokenUsage.output += llmResponse.outputTokens;

            const docUpdate = await patchDocFile(
                target,
                llmResponse.content,
                options.dryRun
            );
            allUpdates.push(docUpdate);

            const sections = docUpdate.patchedSections.join(', ') || 'no sections detected';
            spinner.succeed(
                `${chalk.cyan(docType)} → ${chalk.yellow(target.path)} (sections: ${sections})`
            );
        }
    }

    // GitBook summary update
    if (config.format === 'gitbook') {
        spinner.start('Updating GitBook SUMMARY.md...');
        updateSummaryFile(config.targets);
        spinner.succeed('SUMMARY.md updated');
    }

    // 5. Report
    const estimatedCost = estimateCost(
        config.llm.model,
        totalTokenUsage.input,
        totalTokenUsage.output
    );

    const tokenUsage: TokenUsage = {
        inputTokens: totalTokenUsage.input,
        outputTokens: totalTokenUsage.output,
        estimatedCostUsd: estimatedCost,
    };

    const result: GenerateResult = {
        docUpdates: allUpdates,
        tokenUsage,
        dryRun: options.dryRun,
    };

    console.log(chalk.bold('\n📊 Token Usage Report'));
    console.log(`  Input tokens:  ${chalk.cyan(result.tokenUsage.inputTokens)}`);
    console.log(`  Output tokens: ${chalk.cyan(result.tokenUsage.outputTokens)}`);
    console.log(
        `  Estimated cost: ${chalk.green(`$${result.tokenUsage.estimatedCostUsd.toFixed(5)}`)}`
    );

    if (options.dryRun) {
        console.log(
            chalk.yellow(
                '\n⚠️  Dry run — no files were written. Remove --dry-run to apply changes.'
            )
        );
    } else {
        // Update lastRun in config
        const updatedConfig: DocpilotConfig = {
            ...config,
            lastRun: new Date().toISOString(),
        };
        fs.writeFileSync(
            path.join(process.cwd(), '.docpilot', 'config.json'),
            JSON.stringify(updatedConfig, null, 2)
        );
        console.log(chalk.bold.green('\n✅ Documentation updated successfully!\n'));
    }
}
