import { Command } from 'commander';
import { runInit } from '../src/commands/init';
import { runGenerate } from '../src/commands/generate';
import { runStatus } from '../src/commands/status';

const program = new Command();

program
    .name('docpilot')
    .description(
        'Continuous Documentation Maintainer — keeps your docs in sync with your code on every commit.'
    )
    .version('0.1.0');

program
    .command('init')
    .description('Initialize DocPilot in your project (interactive wizard)')
    .action(async () => {
        await runInit();
    });

program
    .command('generate')
    .description('Generate or update documentation based on recent git changes')
    .option('--dry-run', 'Preview changes without writing to disk', false)
    .option(
        '--since <commit>',
        'Diff against a specific commit (default: HEAD~1)'
    )
    .option('--openai-api-key <key>', 'Override OpenAI API key')
    .option('--anthropic-api-key <key>', 'Override Anthropic API key')
    .option('--gemini-api-key <key>', 'Override Gemini API key')
    .action(async (options: {
        dryRun: boolean;
        since?: string;
        openaiApiKey?: string;
        anthropicApiKey?: string;
        geminiApiKey?: string;
    }) => {
        await runGenerate({
            dryRun: options.dryRun,
            ...(options.since !== undefined ? { since: options.since } : {}),
            ...(options.openaiApiKey !== undefined ? { openaiApiKey: options.openaiApiKey } : {}),
            ...(options.anthropicApiKey !== undefined ? { anthropicApiKey: options.anthropicApiKey } : {}),
            ...(options.geminiApiKey !== undefined ? { geminiApiKey: options.geminiApiKey } : {}),
        });
    });

program
    .command('status')
    .description('Show documentation health scores for all tracked files')
    .action(async () => {
        await runStatus();
    });

program.parseAsync(process.argv).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
