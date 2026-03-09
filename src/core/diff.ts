import simpleGit from 'simple-git';
import type { DiffHunk, SupportedLanguage } from '../types/index';

const LANGUAGE_MAP: Record<string, SupportedLanguage> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    vue: 'vue',
    svelte: 'svelte',
    py: 'python',
    md: 'markdown',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
};

function detectLanguage(filePath: string): SupportedLanguage {
    const ext = filePath.split('.').pop() ?? '';
    return LANGUAGE_MAP[ext] ?? 'unknown';
}

interface ParsedHunk {
    filePath: string;
    rawHunk: string;
    additions: string[];
    deletions: string[];
}

function parseHunks(diffText: string): ParsedHunk[] {
    const hunks: ParsedHunk[] = [];
    const fileBlocks = diffText.split(/^diff --git /m).filter(Boolean);

    for (const block of fileBlocks) {
        const lines = block.split('\n');
        const firstLine = lines[0] ?? '';
        const match = firstLine.match(/b\/(.+)$/);
        if (!match?.[1]) continue;

        const filePath = match[1];
        const additions: string[] = [];
        const deletions: string[] = [];

        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                additions.push(line.slice(1));
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions.push(line.slice(1));
            }
        }

        hunks.push({ filePath, rawHunk: block, additions, deletions });
    }

    return hunks;
}

/**
 * Returns typed DiffHunks for all files changed between `since` and HEAD.
 * Filters out lockfiles and generated assets.
 */
export async function getChangedFiles(
    repoPath: string,
    since: string = 'HEAD~1'
): Promise<DiffHunk[]> {
    const git = simpleGit(repoPath);

    try {
        // Check if there are any commits at all
        const log = await git.log().catch(() => null);
        if (!log || log.total === 0) {
            // No commits, so no diff possible against HEAD~1.
            // In a fresh repo, we might want to treat all staged/unstaged files as "new"
            // but for now, let's just return empty to avoid the crash.
            return [];
        }

        // If 'since' is HEAD~1 but there's only 1 commit, diff against empty tree
        if (since === 'HEAD~1' && log.total === 1) {
            const emptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
            const diffText = await git.diff([emptyTreeHash, 'HEAD']);
            return parseHunks(diffText).map(h => ({
                filePath: h.filePath,
                language: detectLanguage(h.filePath),
                additions: h.additions,
                deletions: h.deletions,
                rawHunk: h.rawHunk,
            }));
        }

        const diffText = await git.diff([since, 'HEAD']);
        const parsed = parseHunks(diffText);

        const IGNORED = [
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml',
            '.docpilot/',
        ];

        return parsed
            .filter(
                (h) => !IGNORED.some((ignored) => h.filePath.includes(ignored))
            )
            .map<DiffHunk>((h) => ({
                filePath: h.filePath,
                language: detectLanguage(h.filePath),
                additions: h.additions,
                deletions: h.deletions,
                rawHunk: h.rawHunk,
            }));
    } catch (err) {
        // If diff fails (e.g. unknown revision), return empty instead of crashing
        return [];
    }
}
