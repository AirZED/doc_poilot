# DocPilot 🚀

**Continuous Documentation Maintainer** — keeps your docs in sync with your codebase automatically on every PR merge.

[![npm](https://img.shields.io/npm/v/docpilot)](https://www.npmjs.com/package/docpilot)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

Developers hate writing documentation. Codebases evolve faster than wikis do. Outdated documentation is often **worse than no documentation**.

DocPilot solves this by running in the background on every merged PR, analyzing what changed, and automatically updating the right sections of your docs — using RAG to only touch what's relevant.

---

## How It Works

```
PR Merged → git diff → RAG Chunk → Embed → Retrieve relevant sections → LLM → Patch docs → Commit
```

1. **Diff** — Read what changed (`git diff HEAD~1 HEAD`)
2. **Chunk** — Split changed files into semantic chunks (overlapping windows)
3. **Embed** — Vectorize chunks with OpenAI `text-embedding-3-small`
4. **Retrieve** — Cosine-similarity search: only the top-k relevant chunks go to the LLM
5. **Generate** — LLM surgically updates only the affected doc sections
6. **Patch** — Write the new content back, never regenerating the whole file

### Cost Optimization

> **Total Cost = Σᵢ (Tᵢ_input · Cᵢₙ + Tᵢ_output · Cₒᵤₜ)**

By only sending relevant RAG chunks (not the entire codebase) to the LLM, DocPilot reduces input token cost by **80–95%** on large repos compared to full-regen approaches.

---

## Installation

```bash
npm install -g docpilot
# or add as a dev dependency
npm install --save-dev docpilot
```

**Requirements:** Node.js 18+, a git repository, OpenAI or Anthropic API key.

---

## Quick Start

### 1. Initialize in your project

```bash
cd your-project
docpilot init
```

The wizard will:
- Auto-detect your framework (React, Express, Next.js, Vue, NestJS, etc.)
- Ask which doc types to maintain
- Select documentation format (Standard vs **GitBook**)
- Set up your LLM provider (**OpenAI**, **Anthropic**, or **Gemini**)
- Optionally install a GitHub Actions or GitLab CI workflow

### 2. Generate docs from recent changes

```bash
docpilot generate
```

Or use `--dry-run` to preview without writing:

```bash
docpilot generate --dry-run
```

### 3. Check documentation health

```bash
docpilot status
```

Outputs a table with health scores (0–100), coverage %, staleness warnings, and last-updated commit per file.

---

## Documentation Types

Select one or more when running `docpilot init`:

| Type | What gets documented |
|------|---------------------|
| `PRODUCT` | User-facing features, changelog, onboarding guide |
| `TECHNICAL` | Architecture decisions, API contracts, system design |
| `CODEBASE` | Inline JSDoc/TSDoc docstrings, function-level docs |
| `INTEGRATION` | Third-party APIs, env variables, webhook setup |
| `LARP` | Narrative / story-mode docs for games or creative projects |

---

## Supported Frameworks

DocPilot works at the **git diff + file** level — no runtime needed. Works with any JS-based project:

React · Next.js · Express · NestJS · Vue · Nuxt · Svelte · Remix · Fastify · Vite · plain Node.js

Also processes: `.ts` · `.tsx` · `.js` · `.jsx` · `.vue` · `.svelte` · `.py` · `.md`

---

## CI/CD Integration

### GitHub Actions

`docpilot init` can copy a ready-made workflow to `.github/workflows/docpilot.yml`.

Add your API key to **Settings → Secrets → Actions**:
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

### GitLab CI

A GitLab CI job template is also available during `docpilot init`.

Add your API key to **Settings → CI/CD → Variables**.

---

## Configuration

DocPilot stores config in `.docpilot/config.json` (committed) and `.docpilot/.env` (gitignored).

```json
{
  "version": "0.1.0",
  "docTypes": ["TECHNICAL", "CODEBASE"],
  "targets": [
    { "path": "README.md", "type": "readme" },
    { "path": "docs/architecture.md", "type": "architecture" }
  ],
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKeyEnvVar": "OPENAI_API_KEY"
  },
  "ci": "github",
  "detectedFramework": "express"
}
```

---

## API (Programmatic Use)

DocPilot exports its core modules for embedding in your own tooling:

```typescript
import {
  getChangedFiles,
  buildChunksFromDiff,
  retrieveTopK,
  buildPrompt,
  OpenAIAdapter,
  type DocpilotConfig,
  type LLMAdapter,
} from 'docpilot';
```

---

## LLM Providers

| Provider | Completion | Embeddings |
|---|---|---|
| OpenAI | ✅ GPT-4o, GPT-4o-mini | ✅ text-embedding-3-small |
| Anthropic | ✅ Claude 3.5 Sonnet, Haiku | ⚠️ TF-IDF fallback |
| Gemini | ✅ Gemini 1.5 Pro, Flash | ✅ text-embedding-004 |

### CLI API Key Overrides

You can pass API keys directly to the `generate` command:
```bash
docpilot generate --openai-api-key <key>
docpilot generate --anthropic-api-key <key>
docpilot generate --gemini-api-key <key>
```

---

## License

MIT
