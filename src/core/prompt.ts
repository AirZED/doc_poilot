import type {
    DetectedFramework,
    DocType,
    DocTargetType,
    PromptContext,
} from '../types/index';

// ─── System Prompt Templates ──────────────────

const SYSTEM_BASE = `You are DocPilot, an expert technical writer AI.
Your job is to surgically update documentation to reflect recent code changes.

Rules:
- Only update the sections that are directly affected by the code changes.
- Preserve the existing tone, style, and formatting of the document.
- Do NOT regenerate sections that have not changed.
- Return ONLY the updated document content — no explanations, no commentary.
- Maintain all existing headings, links, and structure unless the code change requires it.
- Be concise and precise.`;

// ─── Doc type instruction sets ────────────────

const DOC_TYPE_INSTRUCTIONS: Record<DocType, string> = {
    PRODUCT: `Focus on user-facing features, value proposition, and onboarding.
Style: High-level, stakeholder-friendly, and benefit-oriented.
Structure:
- Overview: "What is [X]?" and "Why use it?"
- Features: Group by functional areas (e.g., XM & Surveys, Self-hosting).
- Deployment: Clear paths for different environments.`,

    TECHNICAL: `Focus on architecture, design principles, and DX (Developer Experience).
Style: Senior-engineer focused, precise, and conceptual.
Structure:
- DX Principles: Highlight core pillars (e.g., Invisible infra, AI-first).
- Architecture: Describe system components and data flow (use Mermaid if applicable).
- Stability & Performance: Quantitative metrics and design tradeoffs.
- Migration Guides: Clear path for breaking changes.`,

    CODEBASE: `Focus on API reference, method signatures, and parameter specifications.
Style: Exhaustive, detailed, and strictly technical.
Structure:
- SDK Reference: Organized by module or category (e.g., AA for iOS).
- Method Details: Signatures, parameter tables, return types, and error codes.
- Examples: Minimal, copy-pasteable snippets for utilization.`,

    INTEGRATION: `Focus on SDK usage, authentication, and external system connectivity.
Style: Actionable, developer-first, and snippet-heavy.
Structure:
- Getting Started: Base URL and required environment variables.
- Authentication: Detailed strategies (API Keys, OAuth).
- Webhooks/Async: Payload schemas and retry logic.
- Quickstarts: Framework-specific init steps (React, Express, etc.).`,

    LARP: `Focus on narrative, world-building, and immersive storytelling.
Style: Creative, narrative-driven, using in-universe terminology.
Structure:
- Lore entries: Contextual background and "The Story So Far".
- Features as Mechanics: Explain functionality as part of the world's rules.
- Narrative Differences: Highlight what makes this experience unique.`,
};

// ─── Framework-aware context ──────────────────

const FRAMEWORK_HINTS: Record<DetectedFramework, string> = {
    react: 'This is a React application. Note component lifecycles and hooks.',
    next: 'This is a Next.js application. Note pages, server components, and API routes.',
    express: 'This is an Express.js API. Note routes, middleware, and controllers.',
    nestjs:
        'This is a NestJS application. Note controllers, services, modules, and decorators.',
    vue: 'This is a Vue.js application. Note components, composables, and the Options/Composition API.',
    nuxt: 'This is a Nuxt.js application. Note pages, composables, and server routes.',
    svelte: 'This is a Svelte application. Note components and stores.',
    remix: 'This is a Remix application. Note loaders, actions, and route modules.',
    fastify: 'This is a Fastify API. Note routes, plugins, and schema validation.',
    vite: 'This is a Vite-based project.',
    unknown: '',
};

// ─── Target type instructions ─────────────────

const TARGET_INSTRUCTIONS: Record<DocTargetType, string> = {
    readme:
        'You are updating the README.md. Preserve the top-level structure (badges, title, description, usage, API) and only update affected sections.',
    architecture:
        'You are updating architecture.md. Keep diagrams as ASCII/text art or Mermaid. Only update components described in the diff.',
    docstrings:
        'You are adding or updating inline docstrings/JSDoc. Return the full updated file with corrected docstrings only.',
    changelog:
        'You are updating CHANGELOG.md. Add a new entry under the [Unreleased] section describing the change.',
    custom: 'You are updating a custom documentation file.',
};

// ─── Main prompt builder ──────────────────────

export function buildPrompt(ctx: PromptContext): {
    systemPrompt: string;
    userPrompt: string;
} {
    const frameworkHint = FRAMEWORK_HINTS[ctx.framework];
    const docTypeInstructions = DOC_TYPE_INSTRUCTIONS[ctx.docType];
    const targetInstructions = TARGET_INSTRUCTIONS[ctx.targetType];

    const systemPrompt = [
        SYSTEM_BASE,
        '',
        `## Documentation Mode: ${ctx.docType}`,
        docTypeInstructions,
        '',
        `## Target: ${ctx.targetType}`,
        targetInstructions,
        frameworkHint ? `\n## Framework Context\n${frameworkHint}` : '',
    ]
        .filter(Boolean)
        .join('\n');

    const relevantCode = ctx.retrievedChunks
        .map(
            (r, i) =>
                `### Chunk ${i + 1} (${r.chunk.filePath} L${r.chunk.startLine}–${r.chunk.endLine}, similarity: ${r.similarityScore.toFixed(2)})\n\`\`\`${r.chunk.language}\n${r.chunk.content}\n\`\`\``
        )
        .join('\n\n');

    const diffSummary = ctx.diffHunks
        .map(
            (h) =>
                `- \`${h.filePath}\`: +${h.additions.length} lines, -${h.deletions.length} lines`
        )
        .join('\n');

    const userPrompt = `## Changed Files Summary\n${diffSummary}

## Relevant Code Context (RAG-retrieved chunks)
${relevantCode}

## Existing Documentation
\`\`\`markdown
${ctx.existingDocContent}
\`\`\`

Update the documentation above to reflect the code changes. Return ONLY the updated document.`;

    return { systemPrompt, userPrompt };
}
