import * as fs from 'fs';
import * as path from 'path';
import type { TargetFile } from '../types/index';

/**
 * Updates or creates a SUMMARY.md file for GitBook.
 * Ensures all documentation files are linked in the navigation.
 */
export function updateSummaryFile(targets: readonly TargetFile[]): void {
    const summaryPath = path.join(process.cwd(), 'SUMMARY.md');
    let content = '# Table of contents\n\n';

    if (fs.existsSync(summaryPath)) {
        content = fs.readFileSync(summaryPath, 'utf-8');
    }

    const lines = content.split('\n');
    const existingLinks = new Set<string>();

    // Basic regex to find markdown links: [Title](path/to/file.md)
    const linkRegex = /\[.*\]\((.*\.md)\)/;

    for (const line of lines) {
        const match = line.match(linkRegex);
        if (match && match[1]) {
            existingLinks.add(match[1]);
        }
    }

    let updated = false;
    const newLines: string[] = [];

    // Ensure README.md is always at the top if it exists and isn't linked
    if (!existingLinks.has('README.md') && fs.existsSync(path.join(process.cwd(), 'README.md'))) {
        newLines.push('* [Introduction](README.md)');
        existingLinks.add('README.md');
        updated = true;
    }

    for (const target of targets) {
        if (target.path.endsWith('.md') && !existingLinks.has(target.path)) {
            const title = target.type.charAt(0).toUpperCase() + target.type.slice(1);
            newLines.push(`* [${title}](${target.path})`);
            existingLinks.add(target.path);
            updated = true;
        }
    }

    if (updated) {
        // Append new links to the end of the file if it's not empty, 
        // or just write them if it's a new file.
        const separator = lines.length > 1 && lines[lines.length - 1]?.trim() !== '' ? '\n' : '';
        const newContent = content.trimEnd() + separator + '\n' + newLines.join('\n') + '\n';
        fs.writeFileSync(summaryPath, newContent, 'utf-8');
        console.log(`  ✓ Updated SUMMARY.md with ${newLines.length} new link(s)`);
    }
}
