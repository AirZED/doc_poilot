// Public API surface for DocPilot — consumers can import types and utilities
export type {
    DocType,
    DocpilotConfig,
    DetectedFramework,
    LLMAdapter,
    LLMRequest,
    LLMResponse,
    DiffHunk,
    Chunk,
    RetrievedContext,
    GenerateResult,
    DocHealthReport,
    TokenUsage,
} from './types/index';

export { getChangedFiles } from './core/diff';
export { buildChunksFromDiff, retrieveTopK } from './core/chunker';
export { buildPrompt } from './core/prompt';
export { patchDocFile } from './core/writer';
export { OpenAIAdapter } from './llm/openai';
export { AnthropicAdapter } from './llm/anthropic';
