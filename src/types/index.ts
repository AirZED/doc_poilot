// ─────────────────────────────────────────────
// DocPilot — shared types & interfaces
// All types used across the codebase live here.
// NO `any` is permitted anywhere in this project.
// ─────────────────────────────────────────────

/** Documentation generation modes */
export type DocType =
    | 'PRODUCT'
    | 'TECHNICAL'
    | 'CODEBASE'
    | 'INTEGRATION'
    | 'LARP';

/** Documentation format (standard markdown vs GitBook) */
export type DocFormat = 'standard' | 'gitbook';

/** LLM provider options */
export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

/** Supported CI/CD platforms */
export type CIPlatform = 'github' | 'gitlab' | 'none';

/** JS framework detected from package.json */
export type DetectedFramework =
    | 'react'
    | 'next'
    | 'express'
    | 'nestjs'
    | 'vue'
    | 'nuxt'
    | 'svelte'
    | 'remix'
    | 'fastify'
    | 'vite'
    | 'unknown';

/** Persisted in `.docpilot/config.json` */
export interface DocpilotConfig {
    readonly version: string;
    readonly docTypes: readonly DocType[];
    readonly targets: readonly TargetFile[];
    readonly format: DocFormat;
    readonly llm: LLMConfig;
    readonly ci: CIPlatform;
    readonly detectedFramework: DetectedFramework;
    readonly lastRun?: string; // ISO timestamp
}

export interface LLMConfig {
    readonly provider: LLMProvider;
    readonly model: string;
    /** Key name in .env; never stored directly */
    readonly apiKeyEnvVar: string;
}

export interface TargetFile {
    readonly path: string;
    readonly type: DocTargetType;
}

export type DocTargetType =
    | 'readme'
    | 'architecture'
    | 'docstrings'
    | 'changelog'
    | 'custom';

// ─── Git Diff Types ───────────────────────────

export interface DiffHunk {
    readonly filePath: string;
    readonly language: SupportedLanguage;
    readonly additions: readonly string[];
    readonly deletions: readonly string[];
    readonly rawHunk: string;
}

export type SupportedLanguage =
    | 'typescript'
    | 'javascript'
    | 'tsx'
    | 'jsx'
    | 'vue'
    | 'svelte'
    | 'python'
    | 'markdown'
    | 'json'
    | 'yaml'
    | 'unknown';

// ─── RAG / Chunking Types ─────────────────────

export interface Chunk {
    readonly id: string;
    readonly filePath: string;
    readonly content: string;
    readonly startLine: number;
    readonly endLine: number;
    readonly language: SupportedLanguage;
    embedding?: readonly number[]; // set after embedding
}

export interface RetrievedContext {
    readonly chunk: Chunk;
    readonly similarityScore: number;
}

// ─── LLM Adapter Interface ────────────────────

export interface LLMRequest {
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly maxTokens?: number;
}

export interface LLMResponse {
    readonly content: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly model: string;
}

/** Both OpenAI and Anthropic adapters implement this interface */
export interface LLMAdapter {
    complete(request: LLMRequest): Promise<LLMResponse>;
    embed(text: string): Promise<readonly number[]>;
}

// ─── Generate Command Output ──────────────────

export interface DocUpdate {
    readonly targetPath: string;
    readonly originalContent: string;
    readonly updatedContent: string;
    readonly patchedSections: readonly string[];
}

export interface GenerateResult {
    readonly docUpdates: readonly DocUpdate[];
    readonly tokenUsage: TokenUsage;
    readonly dryRun: boolean;
}

export interface TokenUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
}

// ─── Status Command Output ────────────────────

export interface DocHealthReport {
    readonly filePath: string;
    readonly targetType: DocTargetType;
    readonly healthScore: number; // 0–100
    readonly lastUpdatedCommit: string;
    readonly lastUpdatedDate: string;
    readonly stalenessWarning: boolean;
    readonly coveragePercent: number;
}

// ─── Init / Prompt Builder ────────────────────

export interface PromptContext {
    readonly docType: DocType;
    readonly framework: DetectedFramework;
    readonly retrievedChunks: readonly RetrievedContext[];
    readonly diffHunks: readonly DiffHunk[];
    readonly existingDocContent: string;
    readonly targetType: DocTargetType;
}
