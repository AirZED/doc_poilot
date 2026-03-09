#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  AnthropicAdapter: () => AnthropicAdapter,
  OpenAIAdapter: () => OpenAIAdapter,
  buildChunksFromDiff: () => buildChunksFromDiff,
  buildPrompt: () => buildPrompt,
  getChangedFiles: () => getChangedFiles,
  patchDocFile: () => patchDocFile,
  retrieveTopK: () => retrieveTopK
});
module.exports = __toCommonJS(src_exports);

// src/core/diff.ts
var import_simple_git = __toESM(require("simple-git"));
var LANGUAGE_MAP = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  vue: "vue",
  svelte: "svelte",
  py: "python",
  md: "markdown",
  json: "json",
  yml: "yaml",
  yaml: "yaml"
};
function detectLanguage(filePath) {
  const ext = filePath.split(".").pop() ?? "";
  return LANGUAGE_MAP[ext] ?? "unknown";
}
function parseHunks(diffText) {
  const hunks = [];
  const fileBlocks = diffText.split(/^diff --git /m).filter(Boolean);
  for (const block of fileBlocks) {
    const lines = block.split("\n");
    const firstLine = lines[0] ?? "";
    const match = firstLine.match(/b\/(.+)$/);
    if (!match?.[1]) continue;
    const filePath = match[1];
    const additions = [];
    const deletions = [];
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions.push(line.slice(1));
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions.push(line.slice(1));
      }
    }
    hunks.push({ filePath, rawHunk: block, additions, deletions });
  }
  return hunks;
}
async function getChangedFiles(repoPath, since = "HEAD~1") {
  const git = (0, import_simple_git.default)(repoPath);
  const diffText = await git.diff([since, "HEAD"]);
  const parsed = parseHunks(diffText);
  const IGNORED = [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".docpilot/"
  ];
  return parsed.filter(
    (h) => !IGNORED.some((ignored) => h.filePath.includes(ignored))
  ).map((h) => ({
    filePath: h.filePath,
    language: detectLanguage(h.filePath),
    additions: h.additions,
    deletions: h.deletions,
    rawHunk: h.rawHunk
  }));
}

// src/core/chunker.ts
var crypto = __toESM(require("crypto"));
var CHUNK_SIZE = 60;
var CHUNK_OVERLAP = 10;
function chunkFile(filePath, content, language) {
  const lines = content.split("\n");
  const chunks = [];
  for (let i = 0; i < lines.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const startLine = i;
    const endLine = Math.min(i + CHUNK_SIZE, lines.length) - 1;
    const chunkLines = lines.slice(startLine, endLine + 1);
    chunks.push({
      id: crypto.createHash("sha1").update(`${filePath}:${startLine}`).digest("hex"),
      filePath,
      content: chunkLines.join("\n"),
      startLine,
      endLine,
      language
    });
  }
  return chunks;
}
function buildChunksFromDiff(hunks) {
  const allChunks = [];
  for (const hunk of hunks) {
    const combinedLines = [...hunk.additions];
    if (combinedLines.length === 0) continue;
    const fileChunks = chunkFile(
      hunk.filePath,
      combinedLines.join("\n"),
      hunk.language
    );
    allChunks.push(...fileChunks);
  }
  return allChunks;
}
function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
}
function magnitude(v) {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}
function cosineSimilarity(a, b) {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}
function retrieveTopK(queryEmbedding, chunks, k = 5) {
  const scored = chunks.filter(
    (c) => Array.isArray(c.embedding)
  ).map((c) => ({
    chunk: c,
    similarityScore: cosineSimilarity(queryEmbedding, c.embedding)
  }));
  return scored.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, k);
}

// src/core/prompt.ts
var SYSTEM_BASE = `You are DocPilot, an expert technical writer AI.
Your job is to surgically update documentation to reflect recent code changes.

Rules:
- Only update the sections that are directly affected by the code changes.
- Preserve the existing tone, style, and formatting of the document.
- Do NOT regenerate sections that have not changed.
- Return ONLY the updated document content \u2014 no explanations, no commentary.
- Maintain all existing headings, links, and structure unless the code change requires it.
- Be concise and precise.`;
var DOC_TYPE_INSTRUCTIONS = {
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
- Narrative Differences: Highlight what makes this experience unique.`
};
var FRAMEWORK_HINTS = {
  react: "This is a React application. Note component lifecycles and hooks.",
  next: "This is a Next.js application. Note pages, server components, and API routes.",
  express: "This is an Express.js API. Note routes, middleware, and controllers.",
  nestjs: "This is a NestJS application. Note controllers, services, modules, and decorators.",
  vue: "This is a Vue.js application. Note components, composables, and the Options/Composition API.",
  nuxt: "This is a Nuxt.js application. Note pages, composables, and server routes.",
  svelte: "This is a Svelte application. Note components and stores.",
  remix: "This is a Remix application. Note loaders, actions, and route modules.",
  fastify: "This is a Fastify API. Note routes, plugins, and schema validation.",
  vite: "This is a Vite-based project.",
  unknown: ""
};
var TARGET_INSTRUCTIONS = {
  readme: "You are updating the README.md. Preserve the top-level structure (badges, title, description, usage, API) and only update affected sections.",
  architecture: "You are updating architecture.md. Keep diagrams as ASCII/text art or Mermaid. Only update components described in the diff.",
  docstrings: "You are adding or updating inline docstrings/JSDoc. Return the full updated file with corrected docstrings only.",
  changelog: "You are updating CHANGELOG.md. Add a new entry under the [Unreleased] section describing the change.",
  custom: "You are updating a custom documentation file."
};
function buildPrompt(ctx) {
  const frameworkHint = FRAMEWORK_HINTS[ctx.framework];
  const docTypeInstructions = DOC_TYPE_INSTRUCTIONS[ctx.docType];
  const targetInstructions = TARGET_INSTRUCTIONS[ctx.targetType];
  const systemPrompt = [
    SYSTEM_BASE,
    "",
    `## Documentation Mode: ${ctx.docType}`,
    docTypeInstructions,
    "",
    `## Target: ${ctx.targetType}`,
    targetInstructions,
    frameworkHint ? `
## Framework Context
${frameworkHint}` : ""
  ].filter(Boolean).join("\n");
  const relevantCode = ctx.retrievedChunks.map(
    (r, i) => `### Chunk ${i + 1} (${r.chunk.filePath} L${r.chunk.startLine}\u2013${r.chunk.endLine}, similarity: ${r.similarityScore.toFixed(2)})
\`\`\`${r.chunk.language}
${r.chunk.content}
\`\`\``
  ).join("\n\n");
  const diffSummary = ctx.diffHunks.map(
    (h) => `- \`${h.filePath}\`: +${h.additions.length} lines, -${h.deletions.length} lines`
  ).join("\n");
  const userPrompt = `## Changed Files Summary
${diffSummary}

## Relevant Code Context (RAG-retrieved chunks)
${relevantCode}

## Existing Documentation
\`\`\`markdown
${ctx.existingDocContent}
\`\`\`

Update the documentation above to reflect the code changes. Return ONLY the updated document.`;
  return { systemPrompt, userPrompt };
}

// src/core/writer.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
async function patchDocFile(targetFile, updatedContent, dryRun) {
  const absolutePath = path.resolve(process.cwd(), targetFile.path);
  let originalContent = "";
  if (fs.existsSync(absolutePath)) {
    originalContent = fs.readFileSync(absolutePath, "utf-8");
  }
  const patchedSections = findChangedSections(originalContent, updatedContent);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, updatedContent, "utf-8");
  }
  return {
    targetPath: targetFile.path,
    originalContent,
    updatedContent,
    patchedSections
  };
}
function findChangedSections(original, updated) {
  const headingRegex = /^#{1,6}\s+.+$/gm;
  const originalSections = extractSections(original, headingRegex);
  const updatedSections = extractSections(updated, headingRegex);
  const changed = [];
  for (const [heading, content] of updatedSections.entries()) {
    if (originalSections.get(heading) !== content) {
      changed.push(heading);
    }
  }
  for (const heading of updatedSections.keys()) {
    if (!originalSections.has(heading) && !changed.includes(heading)) {
      changed.push(`[NEW] ${heading}`);
    }
  }
  return changed;
}
function extractSections(content, headingRegex) {
  const sections = /* @__PURE__ */ new Map();
  const lines = content.split("\n");
  let currentHeading = "__preamble__";
  let buffer = [];
  for (const line of lines) {
    headingRegex.lastIndex = 0;
    if (headingRegex.test(line)) {
      sections.set(currentHeading, buffer.join("\n"));
      currentHeading = line.trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  sections.set(currentHeading, buffer.join("\n"));
  return sections;
}

// src/llm/openai.ts
var import_openai = __toESM(require("openai"));
var OpenAIAdapter = class {
  client;
  model;
  constructor(apiKey, model = "gpt-4o") {
    this.client = new import_openai.default({ apiKey });
    this.model = model;
  }
  async complete(request) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt }
      ]
    });
    const choice = response.choices[0];
    if (!choice) {
      throw new Error("OpenAI returned no choices");
    }
    const content = choice.message.content;
    if (!content) {
      throw new Error("OpenAI returned empty content");
    }
    return {
      content,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      model: this.model
    };
  }
  async embed(text) {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });
    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error("OpenAI returned no embedding");
    }
    return embedding;
  }
};

// src/llm/anthropic.ts
var import_sdk = __toESM(require("@anthropic-ai/sdk"));
var AnthropicAdapter = class {
  client;
  model;
  constructor(apiKey, model = "claude-3-5-sonnet-20241022") {
    this.client = new import_sdk.default({ apiKey });
    this.model = model;
  }
  async complete(request) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }]
    });
    const block = response.content[0];
    if (!block || block.type !== "text") {
      throw new Error("Anthropic returned no text content");
    }
    return {
      content: block.text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: this.model
    };
  }
  /**
   * Anthropic does not expose a native embeddings endpoint.
   * This implementation uses a lightweight cosine-compatible approximation
   * via TF-IDF-style term frequency normalization when a real embedding
   * service is not provided.
   *
   * For production use, pair this adapter with a separate embedding service
   * (e.g., OpenAI text-embedding-3-small or Cohere embed).
   */
  async embed(text) {
    const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
    const freq = /* @__PURE__ */ new Map();
    for (const t of tokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    const uniqueTokens = [...freq.keys()].sort().slice(0, 512);
    const vector = uniqueTokens.map((t) => (freq.get(t) ?? 0) / tokens.length);
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AnthropicAdapter,
  OpenAIAdapter,
  buildChunksFromDiff,
  buildPrompt,
  getChangedFiles,
  patchDocFile,
  retrieveTopK
});
//# sourceMappingURL=index.js.map