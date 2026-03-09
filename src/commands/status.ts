import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import type {
    DocHealthReport,
    DocpilotConfig,
    DocTargetType,
    TargetFile,
} from '../types/index';

// ─── Config loader ────────────────────────────

function loadConfig(): DocpilotConfig {
    const configPath = path.join(process.cwd(), '.docpilot', 'config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error('DocPilot not initialized. Run `docpilot init` first.');
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DocpilotConfig;
}

// ─── Health scoring ───────────────────────────

/**
 * Scoring heuristic:
 * - 50 pts: file exists
 * - 20 pts: updated in the last 7 days
 * - 20 pts: has content (> 100 chars)
 * - 10 pts: no TODOs or placeholder text
 */
function scoreHealth(
    content: string,
    lastCommitDate: Date
): { score: number; coveragePercent: number } {
    let score = 0;
    if (content.length > 0) score += 50;

    const daysSince =
        (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 7) score += 20;
    else if (daysSince <= 30) score += 10;

    if (content.length > 100) score += 20;

    const hasTodo = /TODO|FIXME|PLACEHOLDER|\[\s*\.\.\.\s*\]/i.test(content);
    if (!hasTodo) score += 10;

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const coveragePercent = Math.min(100, Math.round((wordCount / 200) * 100));

    return { score, coveragePercent };
}

async function getLastCommitForFile(
    repoPath: string,
    filePath: string
): Promise<{ hash: string; date: Date }> {
    try {
        const git = simpleGit(repoPath);
        const log = await git.log({ file: filePath, maxCount: 1 });
        const latest = log.latest;
        if (!latest) return { hash: 'never', date: new Date(0) };

        return { hash: latest.hash.slice(0, 7), date: new Date(latest.date) };
    } catch {
        return { hash: 'unknown', date: new Date(0) };
    }
}

function getTargetHealthLabel(score: number): string {
    if (score >= 80) return '🟢 Healthy';
    if (score >= 50) return '🟡 Stale';
    return '🔴 Outdated';
}

// ─── Main export ──────────────────────────────

export async function runStatus(): Promise<void> {
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;

    const spinner = ora('Loading DocPilot config...').start();

    let config: DocpilotConfig;
    try {
        config = loadConfig();
        spinner.succeed('Config loaded');
    } catch (err) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }

    const reports: DocHealthReport[] = [];

    for (const target of config.targets) {
        const absPath = path.resolve(process.cwd(), target.path);
        const exists = fs.existsSync(absPath);
        const content = exists ? fs.readFileSync(absPath, 'utf-8') : '';

        const { hash, date } = await getLastCommitForFile(
            process.cwd(),
            target.path
        );

        const { score, coveragePercent } = scoreHealth(content, date);
        const daysSince =
            date.getTime() === 0
                ? Infinity
                : (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

        reports.push({
            filePath: target.path,
            targetType: target.type as DocTargetType,
            healthScore: score,
            lastUpdatedCommit: hash,
            lastUpdatedDate: date.getTime() === 0 ? 'never' : date.toLocaleDateString(),
            stalenessWarning: daysSince > 14,
            coveragePercent,
        });
    }

    // Print table
    console.log(chalk.bold('\n📋 DocPilot — Documentation Health Report\n'));

    const colWidths = { path: 35, type: 14, score: 8, last: 12, coverage: 10, status: 16 };
    const header = [
        'File'.padEnd(colWidths.path),
        'Type'.padEnd(colWidths.type),
        'Score'.padEnd(colWidths.score),
        'Last Updated'.padEnd(colWidths.last),
        'Coverage'.padEnd(colWidths.coverage),
        'Status',
    ].join('│ ');

    const divider = Object.values(colWidths)
        .map((w) => '─'.repeat(w + 2))
        .join('┼');

    console.log(chalk.dim(divider));
    console.log(chalk.bold(header));
    console.log(chalk.dim(divider));

    for (const r of reports) {
        const scoreColor =
            r.healthScore >= 80
                ? chalk.green
                : r.healthScore >= 50
                    ? chalk.yellow
                    : chalk.red;

        const row = [
            r.filePath.padEnd(colWidths.path),
            r.targetType.padEnd(colWidths.type),
            scoreColor(`${r.healthScore}/100`).padEnd(colWidths.score + 10),
            r.lastUpdatedDate.padEnd(colWidths.last),
            `${r.coveragePercent}%`.padEnd(colWidths.coverage),
            getTargetHealthLabel(r.healthScore),
        ].join('│ ');

        console.log(row);
    }

    console.log(chalk.dim(divider));
    console.log(
        chalk.dim(
            `\n  Last full run: ${config.lastRun ? new Date(config.lastRun).toLocaleString() : 'never'}\n`
        )
    );
}
