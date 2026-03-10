#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// bin/docpilot.ts
var import_commander = require("commander");

// src/commands/init.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var readline = __toESM(require("readline"));
var FRAMEWORK_SIGNATURES = [
  ["next", "next"],
  ["nuxt", "nuxt"],
  ["@remix-run/react", "remix"],
  ["react", "react"],
  ["@nestjs/core", "nestjs"],
  ["express", "express"],
  ["fastify", "fastify"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["vite", "vite"]
];
function detectFramework(projectRoot) {
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return "unknown";
  const raw = fs.readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(raw);
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };
  for (const [pkg_name, framework] of FRAMEWORK_SIGNATURES) {
    if (pkg_name in allDeps) return framework;
  }
  return "unknown";
}
function ask(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve4) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve4(answer);
    });
  });
}
async function askChoice(prompt, choices) {
  console.log(prompt);
  choices.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  let result;
  while (!result) {
    const raw = await ask("Enter number(s) separated by commas: ");
    const indices = raw.split(",").map((s) => parseInt(s.trim(), 10) - 1).filter((i) => i >= 0 && i < choices.length);
    const choice = choices[indices[0] ?? -1];
    if (choice) result = choice;
  }
  return result;
}
async function askMultiChoice(prompt, choices) {
  console.log(prompt);
  choices.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  let results = [];
  while (results.length === 0) {
    const raw = await ask("Enter number(s) separated by commas: ");
    const indices = raw.split(",").map((s) => parseInt(s.trim(), 10) - 1).filter((i) => i >= 0 && i < choices.length);
    results = indices.map((i) => choices[i]).filter((c) => Boolean(c));
  }
  return results;
}
var CONFIG_DIR = ".docpilot";
var CONFIG_FILE = ".docpilot/config.json";
function writeConfig(config2) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config2, null, 2), "utf-8");
}
function writeGitignore() {
  const gitignorePath = ".gitignore";
  const entry = "\n# DocPilot\n.docpilot/.env\n";
  if (fs.existsSync(gitignorePath)) {
    const current = fs.readFileSync(gitignorePath, "utf-8");
    if (!current.includes(".docpilot/.env")) {
      fs.appendFileSync(gitignorePath, entry);
    }
  } else {
    fs.writeFileSync(gitignorePath, entry.trimStart());
  }
}
function writeEnvFile(keyEnvVar, apiKey) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CONFIG_DIR, ".env"),
    `${keyEnvVar}=${apiKey}
`,
    "utf-8"
  );
}
function copyCITemplate(platform) {
  if (platform === "none") return;
  const templateFile = platform === "github" ? "docpilot-action.yml" : "docpilot-gitlab.yml";
  const templateSrc = path.join(
    __dirname,
    "..",
    "templates",
    templateFile
  );
  if (platform === "github") {
    fs.mkdirSync(".github/workflows", { recursive: true });
    fs.copyFileSync(templateSrc, ".github/workflows/docpilot.yml");
    console.log("  \u2713 GitHub Actions workflow written to .github/workflows/docpilot.yml");
  } else {
    fs.copyFileSync(templateSrc, ".gitlab-ci-docpilot.yml");
    console.log("  \u2713 GitLab CI template written to .gitlab-ci-docpilot.yml");
  }
}
async function runInit() {
  const chalk = (await import("chalk")).default;
  console.log(chalk.bold.cyan("\n\u{1F680} DocPilot \u2014 Documentation Maintainer Setup\n"));
  const framework = detectFramework(process.cwd());
  if (framework !== "unknown") {
    console.log(
      chalk.green(`  \u2713 Detected framework: ${chalk.bold(framework)}
`)
    );
  }
  const docTypes = await askMultiChoice(
    chalk.bold("\n\u{1F4C4} Which documentation types do you want to maintain?"),
    ["PRODUCT", "TECHNICAL", "CODEBASE", "INTEGRATION", "LARP"]
  );
  const format = await askChoice(
    chalk.bold("\n\u{1F4DA} Documentation Format?"),
    ["standard", "gitbook"]
  );
  const targetTypeOptions = [
    "readme",
    "architecture",
    "docstrings",
    "changelog"
  ];
  const selectedTargetTypes = await askMultiChoice(
    chalk.bold("\n\u{1F4C1} Which files should DocPilot update?"),
    targetTypeOptions
  );
  const DEFAULT_PATHS = {
    readme: "README.md",
    architecture: "docs/architecture.md",
    docstrings: "src/",
    changelog: "CHANGELOG.md",
    custom: "docs/custom.md"
  };
  const targets = selectedTargetTypes.map((t) => {
    let targetPath = DEFAULT_PATHS[t];
    if (format === "gitbook") {
      if (t === "architecture") targetPath = "docs/architecture.md";
      if (t === "changelog") targetPath = "docs/changelog.md";
    }
    return {
      path: targetPath,
      type: t
    };
  });
  const provider = await askChoice(
    chalk.bold("\n\u{1F916} LLM Provider?"),
    ["openai", "anthropic", "gemini"]
  );
  const DEFAULT_MODELS = {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-20241022",
    gemini: "gemini-1.5-pro"
  };
  const ENV_VARS = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY"
  };
  const apiKeyEnvVar = ENV_VARS[provider];
  const apiKey = await ask(
    chalk.bold(`
\u{1F511} Enter your ${apiKeyEnvVar} (stored in .docpilot/.env, gitignored): `)
  );
  const ci = await askChoice(
    chalk.bold("\n\u2699\uFE0F  Set up CI/CD integration?"),
    ["github", "gitlab", "none"]
  );
  const config2 = {
    version: "0.1.0",
    docTypes,
    targets,
    format,
    llm: {
      provider,
      model: DEFAULT_MODELS[provider],
      apiKeyEnvVar
    },
    ci,
    detectedFramework: framework
  };
  console.log(chalk.bold("\n\u{1F4DD} Writing configuration...\n"));
  writeConfig(config2);
  console.log(`  \u2713 Config written to ${CONFIG_FILE}`);
  writeEnvFile(apiKeyEnvVar, apiKey);
  console.log(`  \u2713 API key saved to ${CONFIG_DIR}/.env`);
  writeGitignore();
  console.log(`  \u2713 .gitignore updated`);
  copyCITemplate(ci);
  console.log(
    chalk.bold.green(
      "\n\u2705 DocPilot initialized! Run `docpilot generate` to create your first docs.\n"
    )
  );
}

// src/commands/generate.ts
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var dotenv = __toESM(require("dotenv"));

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
  try {
    const log = await git.log().catch(() => null);
    if (!log || log.total === 0) {
      return [];
    }
    if (since === "HEAD~1" && log.total === 1) {
      const emptyTreeHash = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
      const diffText2 = await git.diff([emptyTreeHash, "HEAD"]);
      return parseHunks(diffText2).map((h) => ({
        filePath: h.filePath,
        language: detectLanguage(h.filePath),
        additions: h.additions,
        deletions: h.deletions,
        rawHunk: h.rawHunk
      }));
    }
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
  } catch (err) {
    return [];
  }
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
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
async function patchDocFile(targetFile, updatedContent, dryRun) {
  const absolutePath = path2.resolve(process.cwd(), targetFile.path);
  let originalContent = "";
  if (fs2.existsSync(absolutePath)) {
    originalContent = fs2.readFileSync(absolutePath, "utf-8");
  }
  const patchedSections = findChangedSections(originalContent, updatedContent);
  if (!dryRun) {
    fs2.mkdirSync(path2.dirname(absolutePath), { recursive: true });
    fs2.writeFileSync(absolutePath, updatedContent, "utf-8");
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

// src/llm/gemini.ts
var import_generative_ai = require("@google/generative-ai");
var GeminiAdapter = class {
  genAI;
  model;
  constructor(apiKey, model = "gemini-1.5-pro") {
    this.genAI = new import_generative_ai.GoogleGenerativeAI(apiKey);
    this.model = model;
  }
  async complete(request) {
    const model = this.genAI.getGenerativeModel({ model: this.model });
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `${request.systemPrompt}

${request.userPrompt}` }] }
      ],
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096
      }
    });
    const content = result.response.text();
    if (!content) {
      throw new Error("Gemini returned empty content");
    }
    return {
      content,
      inputTokens: 0,
      outputTokens: 0,
      model: this.model
    };
  }
  async embed(text) {
    const model = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    if (!embedding) {
      throw new Error("Gemini returned no embedding");
    }
    return embedding;
  }
};

// src/core/gitbook.ts
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
function updateSummaryFile(targets) {
  const summaryPath = path3.join(process.cwd(), "SUMMARY.md");
  let content = "# Table of contents\n\n";
  if (fs3.existsSync(summaryPath)) {
    content = fs3.readFileSync(summaryPath, "utf-8");
  }
  const lines = content.split("\n");
  const existingLinks = /* @__PURE__ */ new Set();
  const linkRegex = /\[.*\]\((.*\.md)\)/;
  for (const line of lines) {
    const match = line.match(linkRegex);
    if (match && match[1]) {
      existingLinks.add(match[1]);
    }
  }
  let updated = false;
  const newLines = [];
  if (!existingLinks.has("README.md") && fs3.existsSync(path3.join(process.cwd(), "README.md"))) {
    newLines.push("* [Introduction](README.md)");
    existingLinks.add("README.md");
    updated = true;
  }
  for (const target of targets) {
    if (target.path.endsWith(".md") && !existingLinks.has(target.path)) {
      const title = target.type.charAt(0).toUpperCase() + target.type.slice(1);
      newLines.push(`* [${title}](${target.path})`);
      existingLinks.add(target.path);
      updated = true;
    }
  }
  if (updated) {
    const separator = lines.length > 1 && lines[lines.length - 1]?.trim() !== "" ? "\n" : "";
    const newContent = content.trimEnd() + separator + "\n" + newLines.join("\n") + "\n";
    fs3.writeFileSync(summaryPath, newContent, "utf-8");
    console.log(`  \u2713 Updated SUMMARY.md with ${newLines.length} new link(s)`);
  }
}

// src/commands/generate.ts
function loadConfig() {
  const configPath = path4.join(process.cwd(), ".docpilot", "config.json");
  if (!fs4.existsSync(configPath)) {
    throw new Error(
      "DocPilot is not initialized. Run `docpilot init` first."
    );
  }
  const raw = fs4.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}
function loadLLMAdapter(config2, options) {
  dotenv.config({ path: path4.join(process.cwd(), ".docpilot", ".env") });
  let apiKey = "";
  if (config2.llm.provider === "openai" && options.openaiApiKey) {
    apiKey = options.openaiApiKey;
  } else if (config2.llm.provider === "anthropic" && options.anthropicApiKey) {
    apiKey = options.anthropicApiKey;
  } else if (config2.llm.provider === "gemini" && options.geminiApiKey) {
    apiKey = options.geminiApiKey;
  } else {
    apiKey = process.env[config2.llm.apiKeyEnvVar] || "";
  }
  if (!apiKey) {
    throw new Error(
      `Missing API key. Set ${config2.llm.apiKeyEnvVar} in .env or pass it via CLI.`
    );
  }
  if (config2.llm.provider === "openai") {
    return new OpenAIAdapter(apiKey, config2.llm.model);
  } else if (config2.llm.provider === "anthropic") {
    return new AnthropicAdapter(apiKey, config2.llm.model);
  }
  return new GeminiAdapter(apiKey, config2.llm.model);
}
function loadExistingDoc(targetFile) {
  const absPath = path4.resolve(process.cwd(), targetFile.path);
  if (fs4.existsSync(absPath)) {
    return fs4.readFileSync(absPath, "utf-8");
  }
  return "";
}
var COST_PER_1K = {
  "gpt-4o": { input: 5e-3, output: 0.015 },
  "gpt-4o-mini": { input: 15e-5, output: 6e-4 },
  "claude-3-5-sonnet-20241022": { input: 3e-3, output: 0.015 },
  "claude-3-haiku-20240307": { input: 25e-5, output: 125e-5 },
  "gemini-1.5-pro": { input: 125e-5, output: 375e-5 },
  "gemini-1.5-flash": { input: 75e-6, output: 3e-4 }
};
function estimateCost(model, inputTokens, outputTokens) {
  const rates = COST_PER_1K[model] ?? { input: 5e-3, output: 0.015 };
  return inputTokens / 1e3 * rates.input + outputTokens / 1e3 * rates.output;
}
async function runGenerate(options) {
  const chalk = (await import("chalk")).default;
  const ora = (await import("ora")).default;
  const spinner = ora("Loading DocPilot config...").start();
  let config2;
  let adapter;
  try {
    config2 = loadConfig();
    adapter = loadLLMAdapter(config2, options);
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }
  spinner.succeed("Config loaded");
  spinner.start("Analysing git diff...");
  const since = options.since ?? "HEAD~1";
  const diffHunks = await getChangedFiles(process.cwd(), since);
  if (diffHunks.length === 0) {
    spinner.info("No code changes detected. Documentation is up to date.");
    return;
  }
  spinner.succeed(`Found ${diffHunks.length} changed file(s)`);
  spinner.start("Chunking changed code (RAG)...");
  const chunks = buildChunksFromDiff(diffHunks);
  spinner.succeed(`Built ${chunks.length} semantic chunk(s)`);
  spinner.start("Embedding chunks...");
  const embeddedChunks = [...chunks];
  for (const chunk of embeddedChunks) {
    chunk.embedding = await adapter.embed(chunk.content);
  }
  spinner.succeed("Chunks embedded");
  const allUpdates = [];
  const totalTokenUsage = { input: 0, output: 0 };
  for (const docType of config2.docTypes) {
    for (const target of config2.targets) {
      spinner.start(
        `Generating ${chalk.cyan(docType)} docs for ${chalk.yellow(target.path)}...`
      );
      const queryText = `${docType} documentation for ${target.type}`;
      const queryEmbedding = await adapter.embed(queryText);
      const retrieved = retrieveTopK(queryEmbedding, embeddedChunks, 5);
      const existingDoc = loadExistingDoc(target);
      const { systemPrompt, userPrompt } = buildPrompt({
        docType,
        framework: config2.detectedFramework,
        retrievedChunks: retrieved,
        diffHunks,
        existingDocContent: existingDoc,
        targetType: target.type
      });
      const llmResponse = await adapter.complete({ systemPrompt, userPrompt });
      totalTokenUsage.input += llmResponse.inputTokens;
      totalTokenUsage.output += llmResponse.outputTokens;
      const docUpdate = await patchDocFile(
        target,
        llmResponse.content,
        options.dryRun
      );
      allUpdates.push(docUpdate);
      const sections = docUpdate.patchedSections.join(", ") || "no sections detected";
      spinner.succeed(
        `${chalk.cyan(docType)} \u2192 ${chalk.yellow(target.path)} (sections: ${sections})`
      );
    }
  }
  if (config2.format === "gitbook") {
    spinner.start("Updating GitBook SUMMARY.md...");
    updateSummaryFile(config2.targets);
    spinner.succeed("SUMMARY.md updated");
  }
  const estimatedCost = estimateCost(
    config2.llm.model,
    totalTokenUsage.input,
    totalTokenUsage.output
  );
  const tokenUsage = {
    inputTokens: totalTokenUsage.input,
    outputTokens: totalTokenUsage.output,
    estimatedCostUsd: estimatedCost
  };
  const result = {
    docUpdates: allUpdates,
    tokenUsage,
    dryRun: options.dryRun
  };
  console.log(chalk.bold("\n\u{1F4CA} Token Usage Report"));
  console.log(`  Input tokens:  ${chalk.cyan(result.tokenUsage.inputTokens)}`);
  console.log(`  Output tokens: ${chalk.cyan(result.tokenUsage.outputTokens)}`);
  console.log(
    `  Estimated cost: ${chalk.green(`$${result.tokenUsage.estimatedCostUsd.toFixed(5)}`)}`
  );
  if (options.dryRun) {
    console.log(
      chalk.yellow(
        "\n\u26A0\uFE0F  Dry run \u2014 no files were written. Remove --dry-run to apply changes."
      )
    );
  } else {
    const updatedConfig = {
      ...config2,
      lastRun: (/* @__PURE__ */ new Date()).toISOString()
    };
    fs4.writeFileSync(
      path4.join(process.cwd(), ".docpilot", "config.json"),
      JSON.stringify(updatedConfig, null, 2)
    );
    console.log(chalk.bold.green("\n\u2705 Documentation updated successfully!\n"));
  }
}

// src/commands/status.ts
var fs5 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
var import_simple_git2 = __toESM(require("simple-git"));
function loadConfig2() {
  const configPath = path5.join(process.cwd(), ".docpilot", "config.json");
  if (!fs5.existsSync(configPath)) {
    throw new Error("DocPilot not initialized. Run `docpilot init` first.");
  }
  return JSON.parse(fs5.readFileSync(configPath, "utf-8"));
}
function scoreHealth(content, lastCommitDate) {
  let score = 0;
  if (content.length > 0) score += 50;
  const daysSince = (Date.now() - lastCommitDate.getTime()) / (1e3 * 60 * 60 * 24);
  if (daysSince <= 7) score += 20;
  else if (daysSince <= 30) score += 10;
  if (content.length > 100) score += 20;
  const hasTodo = /TODO|FIXME|PLACEHOLDER|\[\s*\.\.\.\s*\]/i.test(content);
  if (!hasTodo) score += 10;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const coveragePercent = Math.min(100, Math.round(wordCount / 200 * 100));
  return { score, coveragePercent };
}
async function getLastCommitForFile(repoPath, filePath) {
  try {
    const git = (0, import_simple_git2.default)(repoPath);
    const log = await git.log({ file: filePath, maxCount: 1 });
    const latest = log.latest;
    if (!latest) return { hash: "never", date: /* @__PURE__ */ new Date(0) };
    return { hash: latest.hash.slice(0, 7), date: new Date(latest.date) };
  } catch {
    return { hash: "unknown", date: /* @__PURE__ */ new Date(0) };
  }
}
function getTargetHealthLabel(score) {
  if (score >= 80) return "\u{1F7E2} Healthy";
  if (score >= 50) return "\u{1F7E1} Stale";
  return "\u{1F534} Outdated";
}
async function runStatus() {
  const chalk = (await import("chalk")).default;
  const ora = (await import("ora")).default;
  const spinner = ora("Loading DocPilot config...").start();
  let config2;
  try {
    config2 = loadConfig2();
    spinner.succeed("Config loaded");
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  const reports = [];
  for (const target of config2.targets) {
    const absPath = path5.resolve(process.cwd(), target.path);
    const exists = fs5.existsSync(absPath);
    const content = exists ? fs5.readFileSync(absPath, "utf-8") : "";
    const { hash, date } = await getLastCommitForFile(
      process.cwd(),
      target.path
    );
    const { score, coveragePercent } = scoreHealth(content, date);
    const daysSince = date.getTime() === 0 ? Infinity : (Date.now() - date.getTime()) / (1e3 * 60 * 60 * 24);
    reports.push({
      filePath: target.path,
      targetType: target.type,
      healthScore: score,
      lastUpdatedCommit: hash,
      lastUpdatedDate: date.getTime() === 0 ? "never" : date.toLocaleDateString(),
      stalenessWarning: daysSince > 14,
      coveragePercent
    });
  }
  console.log(chalk.bold("\n\u{1F4CB} DocPilot \u2014 Documentation Health Report\n"));
  const colWidths = { path: 35, type: 14, score: 8, last: 12, coverage: 10, status: 16 };
  const header = [
    "File".padEnd(colWidths.path),
    "Type".padEnd(colWidths.type),
    "Score".padEnd(colWidths.score),
    "Last Updated".padEnd(colWidths.last),
    "Coverage".padEnd(colWidths.coverage),
    "Status"
  ].join("\u2502 ");
  const divider = Object.values(colWidths).map((w) => "\u2500".repeat(w + 2)).join("\u253C");
  console.log(chalk.dim(divider));
  console.log(chalk.bold(header));
  console.log(chalk.dim(divider));
  for (const r of reports) {
    const scoreColor = r.healthScore >= 80 ? chalk.green : r.healthScore >= 50 ? chalk.yellow : chalk.red;
    const row = [
      r.filePath.padEnd(colWidths.path),
      r.targetType.padEnd(colWidths.type),
      scoreColor(`${r.healthScore}/100`).padEnd(colWidths.score + 10),
      r.lastUpdatedDate.padEnd(colWidths.last),
      `${r.coveragePercent}%`.padEnd(colWidths.coverage),
      getTargetHealthLabel(r.healthScore)
    ].join("\u2502 ");
    console.log(row);
  }
  console.log(chalk.dim(divider));
  console.log(
    chalk.dim(
      `
  Last full run: ${config2.lastRun ? new Date(config2.lastRun).toLocaleString() : "never"}
`
    )
  );
}

// bin/docpilot.ts
var program = new import_commander.Command();
program.name("docpilot").description(
  "Continuous Documentation Maintainer \u2014 keeps your docs in sync with your code on every commit."
).version("0.1.0");
program.command("init").description("Initialize DocPilot in your project (interactive wizard)").action(async () => {
  await runInit();
});
program.command("generate").description("Generate or update documentation based on recent git changes").option("--dry-run", "Preview changes without writing to disk", false).option(
  "--since <commit>",
  "Diff against a specific commit (default: HEAD~1)"
).option("--openai-api-key <key>", "Override OpenAI API key").option("--anthropic-api-key <key>", "Override Anthropic API key").option("--gemini-api-key <key>", "Override Gemini API key").action(async (options) => {
  await runGenerate({
    dryRun: options.dryRun,
    ...options.since !== void 0 ? { since: options.since } : {},
    ...options.openaiApiKey !== void 0 ? { openaiApiKey: options.openaiApiKey } : {},
    ...options.anthropicApiKey !== void 0 ? { anthropicApiKey: options.anthropicApiKey } : {},
    ...options.geminiApiKey !== void 0 ? { geminiApiKey: options.geminiApiKey } : {}
  });
});
program.command("status").description("Show documentation health scores for all tracked files").action(async () => {
  await runStatus();
});
program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
//# sourceMappingURL=docpilot.js.map