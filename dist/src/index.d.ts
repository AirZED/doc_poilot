/** Documentation generation modes */
type DocType = 'PRODUCT' | 'TECHNICAL' | 'CODEBASE' | 'INTEGRATION' | 'LARP';
/** Documentation format (standard markdown vs GitBook) */
type DocFormat = 'standard' | 'gitbook';
/** LLM provider options */
type LLMProvider = 'openai' | 'anthropic' | 'gemini';
/** Supported CI/CD platforms */
type CIPlatform = 'github' | 'gitlab' | 'none';
/** JS framework detected from package.json */
type DetectedFramework = 'react' | 'next' | 'express' | 'nestjs' | 'vue' | 'nuxt' | 'svelte' | 'remix' | 'fastify' | 'vite' | 'unknown';
/** Persisted in `.docpilot/config.json` */
interface DocpilotConfig {
    readonly version: string;
    readonly docTypes: readonly DocType[];
    readonly targets: readonly TargetFile[];
    readonly format: DocFormat;
    readonly llm: LLMConfig;
    readonly ci: CIPlatform;
    readonly detectedFramework: DetectedFramework;
    readonly lastRun?: string;
}
interface LLMConfig {
    readonly provider: LLMProvider;
    readonly model: string;
    /** Key name in .env; never stored directly */
    readonly apiKeyEnvVar: string;
}
interface TargetFile {
    readonly path: string;
    readonly type: DocTargetType;
}
type DocTargetType = 'readme' | 'architecture' | 'docstrings' | 'changelog' | 'custom';
interface DiffHunk {
    readonly filePath: string;
    readonly language: SupportedLanguage;
    readonly additions: readonly string[];
    readonly deletions: readonly string[];
    readonly rawHunk: string;
}
type SupportedLanguage = 'typescript' | 'javascript' | 'tsx' | 'jsx' | 'vue' | 'svelte' | 'python' | 'markdown' | 'json' | 'yaml' | 'unknown';
interface Chunk {
    readonly id: string;
    readonly filePath: string;
    readonly content: string;
    readonly startLine: number;
    readonly endLine: number;
    readonly language: SupportedLanguage;
    embedding?: readonly number[];
}
interface RetrievedContext {
    readonly chunk: Chunk;
    readonly similarityScore: number;
}
interface LLMRequest {
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly maxTokens?: number;
}
interface LLMResponse {
    readonly content: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly model: string;
}
/** Both OpenAI and Anthropic adapters implement this interface */
interface LLMAdapter {
    complete(request: LLMRequest): Promise<LLMResponse>;
    embed(text: string): Promise<readonly number[]>;
}
interface DocUpdate {
    readonly targetPath: string;
    readonly originalContent: string;
    readonly updatedContent: string;
    readonly patchedSections: readonly string[];
}
interface GenerateResult {
    readonly docUpdates: readonly DocUpdate[];
    readonly tokenUsage: TokenUsage;
    readonly dryRun: boolean;
}
interface TokenUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
}
interface DocHealthReport {
    readonly filePath: string;
    readonly targetType: DocTargetType;
    readonly healthScore: number;
    readonly lastUpdatedCommit: string;
    readonly lastUpdatedDate: string;
    readonly stalenessWarning: boolean;
    readonly coveragePercent: number;
}
interface PromptContext {
    readonly docType: DocType;
    readonly framework: DetectedFramework;
    readonly retrievedChunks: readonly RetrievedContext[];
    readonly diffHunks: readonly DiffHunk[];
    readonly existingDocContent: string;
    readonly targetType: DocTargetType;
}

/**
 * Returns typed DiffHunks for all files changed between `since` and HEAD.
 * Filters out lockfiles and generated assets.
 */
declare function getChangedFiles(repoPath: string, since?: string): Promise<DiffHunk[]>;

/**
 * Converts DiffHunks into Chunk objects ready for embedding.
 * Only the changed lines (+/-) are chunked to keep token costs low.
 */
declare function buildChunksFromDiff(hunks: DiffHunk[]): Chunk[];
/**
 * Given a query embedding and a set of embedded chunks, returns the top-k
 * most relevant chunks sorted by cosine similarity.
 */
declare function retrieveTopK(queryEmbedding: readonly number[], chunks: Chunk[], k?: number): RetrievedContext[];

declare function buildPrompt(ctx: PromptContext): {
    systemPrompt: string;
    userPrompt: string;
};

/**
 * Surgically patches a documentation file by replacing only the
 * affected sections. Never overwrites a document in full.
 *
 * Strategy:
 * - If the LLM returns the full updated document, diff the sections
 *   and write the new version (since the model only changes relevant parts).
 * - Tracks which section headings were modified for reporting.
 */
declare function patchDocFile(targetFile: TargetFile, updatedContent: string, dryRun: boolean): Promise<DocUpdate>;

declare class OpenAIAdapter implements LLMAdapter {
    private readonly client;
    private readonly model;
    constructor(apiKey: string, model?: string);
    complete(request: LLMRequest): Promise<LLMResponse>;
    embed(text: string): Promise<readonly number[]>;
}

declare class AnthropicAdapter implements LLMAdapter {
    private readonly client;
    private readonly model;
    constructor(apiKey: string, model?: string);
    complete(request: LLMRequest): Promise<LLMResponse>;
    /**
     * Anthropic does not expose a native embeddings endpoint.
     * This implementation uses a lightweight cosine-compatible approximation
     * via TF-IDF-style term frequency normalization when a real embedding
     * service is not provided.
     *
     * For production use, pair this adapter with a separate embedding service
     * (e.g., OpenAI text-embedding-3-small or Cohere embed).
     */
    embed(text: string): Promise<readonly number[]>;
}

export { AnthropicAdapter, type Chunk, type DetectedFramework, type DiffHunk, type DocHealthReport, type DocType, type DocpilotConfig, type GenerateResult, type LLMAdapter, type LLMRequest, type LLMResponse, OpenAIAdapter, type RetrievedContext, type TokenUsage, buildChunksFromDiff, buildPrompt, getChangedFiles, patchDocFile, retrieveTopK };
