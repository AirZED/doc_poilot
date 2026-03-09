import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import type {
    CIPlatform,
    DetectedFramework,
    DocpilotConfig,
    DocTargetType,
    DocType,
    LLMProvider,
    TargetFile,
    DocFormat,
} from '../types/index';

// ─── Framework Detection ──────────────────────

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

const FRAMEWORK_SIGNATURES: Array<[string, DetectedFramework]> = [
    ['next', 'next'],
    ['nuxt', 'nuxt'],
    ['@remix-run/react', 'remix'],
    ['react', 'react'],
    ['@nestjs/core', 'nestjs'],
    ['express', 'express'],
    ['fastify', 'fastify'],
    ['vue', 'vue'],
    ['svelte', 'svelte'],
    ['vite', 'vite'],
];

function detectFramework(projectRoot: string): DetectedFramework {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return 'unknown';

    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as PackageJson;
    const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
    };

    for (const [pkg_name, framework] of FRAMEWORK_SIGNATURES) {
        if (pkg_name in allDeps) return framework;
    }
    return 'unknown';
}

// ─── Simple CLI prompt helper ─────────────────

function ask(prompt: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function askChoice<T extends string>(
    prompt: string,
    choices: readonly T[]
): Promise<T> {
    console.log(prompt);
    choices.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));

    let result: T | undefined;
    while (!result) {
        const raw = await ask('Enter number(s) separated by commas: ');
        const indices = raw
            .split(',')
            .map((s) => parseInt(s.trim(), 10) - 1)
            .filter((i) => i >= 0 && i < choices.length);

        // Return first valid choice (single selection)
        const choice = choices[indices[0] ?? -1];
        if (choice) result = choice;
    }
    return result;
}

async function askMultiChoice<T extends string>(
    prompt: string,
    choices: readonly T[]
): Promise<T[]> {
    console.log(prompt);
    choices.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));

    let results: T[] = [];
    while (results.length === 0) {
        const raw = await ask('Enter number(s) separated by commas: ');
        const indices = raw
            .split(',')
            .map((s) => parseInt(s.trim(), 10) - 1)
            .filter((i) => i >= 0 && i < choices.length);

        results = indices
            .map((i) => choices[i])
            .filter((c): c is T => Boolean(c));
    }
    return results;
}

// ─── Config persistence ───────────────────────

const CONFIG_DIR = '.docpilot';
const CONFIG_FILE = '.docpilot/config.json';

function writeConfig(config: DocpilotConfig): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function writeGitignore(): void {
    const gitignorePath = '.gitignore';
    const entry = '\n# DocPilot\n.docpilot/.env\n';

    if (fs.existsSync(gitignorePath)) {
        const current = fs.readFileSync(gitignorePath, 'utf-8');
        if (!current.includes('.docpilot/.env')) {
            fs.appendFileSync(gitignorePath, entry);
        }
    } else {
        fs.writeFileSync(gitignorePath, entry.trimStart());
    }
}

function writeEnvFile(keyEnvVar: string, apiKey: string): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(
        path.join(CONFIG_DIR, '.env'),
        `${keyEnvVar}=${apiKey}\n`,
        'utf-8'
    );
}

function copyCITemplate(platform: CIPlatform): void {
    if (platform === 'none') return;

    const templateFile =
        platform === 'github'
            ? 'docpilot-action.yml'
            : 'docpilot-gitlab.yml';

    const templateSrc = path.join(
        __dirname,
        '..',
        'templates',
        templateFile
    );

    if (platform === 'github') {
        fs.mkdirSync('.github/workflows', { recursive: true });
        fs.copyFileSync(templateSrc, '.github/workflows/docpilot.yml');
        console.log('  ✓ GitHub Actions workflow written to .github/workflows/docpilot.yml');
    } else {
        fs.copyFileSync(templateSrc, '.gitlab-ci-docpilot.yml');
        console.log('  ✓ GitLab CI template written to .gitlab-ci-docpilot.yml');
    }
}

// ─── Main export ──────────────────────────────

export async function runInit(): Promise<void> {
    const chalk = (await import('chalk')).default;

    console.log(chalk.bold.cyan('\n🚀 DocPilot — Documentation Maintainer Setup\n'));

    const framework = detectFramework(process.cwd());
    if (framework !== 'unknown') {
        console.log(
            chalk.green(`  ✓ Detected framework: ${chalk.bold(framework)}\n`)
        );
    }

    // 1. Doc types
    const docTypes = await askMultiChoice<DocType>(
        chalk.bold('\n📄 Which documentation types do you want to maintain?'),
        ['PRODUCT', 'TECHNICAL', 'CODEBASE', 'INTEGRATION', 'LARP']
    );

    // 1b. Doc Format
    const format = await askChoice<DocFormat>(
        chalk.bold('\n📚 Documentation Format?'),
        ['standard', 'gitbook']
    );

    // 2. Target files
    const targetTypeOptions: DocTargetType[] = [
        'readme',
        'architecture',
        'docstrings',
        'changelog',
    ];
    const selectedTargetTypes = await askMultiChoice<DocTargetType>(
        chalk.bold('\n📁 Which files should DocPilot update?'),
        targetTypeOptions
    );

    const DEFAULT_PATHS: Record<DocTargetType, string> = {
        readme: 'README.md',
        architecture: 'docs/architecture.md',
        docstrings: 'src/',
        changelog: 'CHANGELOG.md',
        custom: 'docs/custom.md',
    };

    const targets: TargetFile[] = selectedTargetTypes.map((t) => {
        let targetPath = DEFAULT_PATHS[t];

        // GitBook specific overrides
        if (format === 'gitbook') {
            if (t === 'architecture') targetPath = 'docs/architecture.md';
            if (t === 'changelog') targetPath = 'docs/changelog.md';
        }

        return {
            path: targetPath,
            type: t,
        };
    });

    // 3. LLM provider
    const provider = await askChoice<LLMProvider>(
        chalk.bold('\n🤖 LLM Provider?'),
        ['openai', 'anthropic', 'gemini']
    );

    const DEFAULT_MODELS: Record<LLMProvider, string> = {
        openai: 'gpt-4o',
        anthropic: 'claude-3-5-sonnet-20241022',
        gemini: 'gemini-1.5-pro',
    };

    const ENV_VARS: Record<LLMProvider, string> = {
        openai: 'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        gemini: 'GEMINI_API_KEY',
    };

    const apiKeyEnvVar = ENV_VARS[provider];

    const apiKey = await ask(
        chalk.bold(`\n🔑 Enter your ${apiKeyEnvVar} (stored in .docpilot/.env, gitignored): `)
    );

    // 4. CI platform
    const ci = await askChoice<CIPlatform>(
        chalk.bold('\n⚙️  Set up CI/CD integration?'),
        ['github', 'gitlab', 'none']
    );

    // Build config
    const config: DocpilotConfig = {
        version: '0.1.0',
        docTypes,
        targets,
        format,
        llm: {
            provider,
            model: DEFAULT_MODELS[provider],
            apiKeyEnvVar,
        },
        ci,
        detectedFramework: framework,
    };

    // Write files
    console.log(chalk.bold('\n📝 Writing configuration...\n'));
    writeConfig(config);
    console.log(`  ✓ Config written to ${CONFIG_FILE}`);

    writeEnvFile(apiKeyEnvVar, apiKey);
    console.log(`  ✓ API key saved to ${CONFIG_DIR}/.env`);

    writeGitignore();
    console.log(`  ✓ .gitignore updated`);

    copyCITemplate(ci);

    console.log(
        chalk.bold.green(
            '\n✅ DocPilot initialized! Run `docpilot generate` to create your first docs.\n'
        )
    );
}
