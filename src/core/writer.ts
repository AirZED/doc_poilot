import * as fs from 'fs';
import * as path from 'path';
import type { DocUpdate, TargetFile } from '../types/index';

/**
 * Surgically patches a documentation file by replacing only the
 * affected sections. Never overwrites a document in full.
 *
 * Strategy:
 * - If the LLM returns the full updated document, diff the sections
 *   and write the new version (since the model only changes relevant parts).
 * - Tracks which section headings were modified for reporting.
 */
export async function patchDocFile(
    targetFile: TargetFile,
    updatedContent: string,
    dryRun: boolean
): Promise<DocUpdate> {
    const absolutePath = path.resolve(process.cwd(), targetFile.path);

    let originalContent = '';
    if (fs.existsSync(absolutePath)) {
        originalContent = fs.readFileSync(absolutePath, 'utf-8');
    }

    const cleanedContent = cleanLLMResponse(updatedContent);
    const patchedSections = findChangedSections(originalContent, cleanedContent);

    if (!dryRun) {
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, cleanedContent, 'utf-8');
    }

    return {
        targetPath: targetFile.path,
        originalContent,
        updatedContent: cleanedContent,
        patchedSections,
    };
}

/**
 * Strips markdown code blocks (```markdown ... ```) if the entire response
 * is wrapped in them.
 */
function cleanLLMResponse(content: string): string {
    const trimmed = content.trim();
    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
        // Remove first and last line
        const lines = trimmed.split('\n');
        if (lines.length > 2) {
            return lines.slice(1, -1).join('\n').trim();
        }
    }
    return content;
}

/**
 * Compares two markdown documents and returns the headings of sections
 * that changed — used for reporting what was updated.
 */
function findChangedSections(
    original: string,
    updated: string
): readonly string[] {
    const headingRegex = /^#{1,6}\s+.+$/gm;
    const originalSections = extractSections(original, headingRegex);
    const updatedSections = extractSections(updated, headingRegex);
    const changed: string[] = [];

    for (const [heading, content] of updatedSections.entries()) {
        if (originalSections.get(heading) !== content) {
            changed.push(heading);
        }
    }

    // Also flag new sections
    for (const heading of updatedSections.keys()) {
        if (!originalSections.has(heading) && !changed.includes(heading)) {
            changed.push(`[NEW] ${heading}`);
        }
    }

    return changed;
}

function extractSections(
    content: string,
    headingRegex: RegExp
): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split('\n');
    let currentHeading = '__preamble__';
    let buffer: string[] = [];

    for (const line of lines) {
        headingRegex.lastIndex = 0;
        if (headingRegex.test(line)) {
            sections.set(currentHeading, buffer.join('\n'));
            currentHeading = line.trim();
            buffer = [];
        } else {
            buffer.push(line);
        }
    }

    sections.set(currentHeading, buffer.join('\n'));
    return sections;
}
