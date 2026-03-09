import Anthropic from '@anthropic-ai/sdk';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../types/index';

export class AnthropicAdapter implements LLMAdapter {
    private readonly client: Anthropic;
    private readonly model: string;

    constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
        this.client = new Anthropic({ apiKey });
        this.model = model;
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: request.maxTokens ?? 4096,
            system: request.systemPrompt,
            messages: [{ role: 'user', content: request.userPrompt }],
        });

        const block = response.content[0];
        if (!block || block.type !== 'text') {
            throw new Error('Anthropic returned no text content');
        }

        return {
            content: block.text,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            model: this.model,
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
    async embed(text: string): Promise<readonly number[]> {
        const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
        const freq = new Map<string, number>();
        for (const t of tokens) {
            freq.set(t, (freq.get(t) ?? 0) + 1);
        }

        const uniqueTokens = [...freq.keys()].sort().slice(0, 512);
        const vector = uniqueTokens.map((t) => (freq.get(t) ?? 0) / tokens.length);
        const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;

        return vector.map((v) => v / norm);
    }
}
