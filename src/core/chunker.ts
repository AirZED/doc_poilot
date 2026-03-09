import * as crypto from 'crypto';
import type {
    Chunk,
    DiffHunk,
    RetrievedContext,
    SupportedLanguage,
} from '../types/index';

// ─── Chunking ─────────────────────────────────

const CHUNK_SIZE = 60; // lines per chunk
const CHUNK_OVERLAP = 10; // overlap between chunks

function chunkFile(
    filePath: string,
    content: string,
    language: SupportedLanguage
): Chunk[] {
    const lines = content.split('\n');
    const chunks: Chunk[] = [];

    for (let i = 0; i < lines.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        const startLine = i;
        const endLine = Math.min(i + CHUNK_SIZE, lines.length) - 1;
        const chunkLines = lines.slice(startLine, endLine + 1);

        chunks.push({
            id: crypto
                .createHash('sha1')
                .update(`${filePath}:${startLine}`)
                .digest('hex'),
            filePath,
            content: chunkLines.join('\n'),
            startLine,
            endLine,
            language,
        });
    }

    return chunks;
}

/**
 * Converts DiffHunks into Chunk objects ready for embedding.
 * Only the changed lines (+/-) are chunked to keep token costs low.
 */
export function buildChunksFromDiff(hunks: DiffHunk[]): Chunk[] {
    const allChunks: Chunk[] = [];

    for (const hunk of hunks) {
        // We chunk the additions — these represent the new state of the code
        const combinedLines = [...hunk.additions];
        if (combinedLines.length === 0) continue;

        const fileChunks = chunkFile(
            hunk.filePath,
            combinedLines.join('\n'),
            hunk.language
        );
        allChunks.push(...fileChunks);
    }

    return allChunks;
}

// ─── Cosine Similarity ────────────────────────

function dotProduct(a: readonly number[], b: readonly number[]): number {
    return a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
}

function magnitude(v: readonly number[]): number {
    return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    const magA = magnitude(a);
    const magB = magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct(a, b) / (magA * magB);
}

// ─── Retrieval ────────────────────────────────

/**
 * Given a query embedding and a set of embedded chunks, returns the top-k
 * most relevant chunks sorted by cosine similarity.
 */
export function retrieveTopK(
    queryEmbedding: readonly number[],
    chunks: Chunk[],
    k: number = 5
): RetrievedContext[] {
    const scored: RetrievedContext[] = chunks
        .filter((c): c is Chunk & { embedding: readonly number[] } =>
            Array.isArray(c.embedding)
        )
        .map((c) => ({
            chunk: c,
            similarityScore: cosineSimilarity(queryEmbedding, c.embedding),
        }));

    return scored.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, k);
}
