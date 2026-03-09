import OpenAI from 'openai';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../types/index';

export class OpenAIAdapter implements LLMAdapter {
    private readonly client: OpenAI;
    private readonly model: string;

    constructor(apiKey: string, model: string = 'gpt-4o') {
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            max_tokens: request.maxTokens ?? 4096,
            messages: [
                { role: 'system', content: request.systemPrompt },
                { role: 'user', content: request.userPrompt },
            ],
        });

        const choice = response.choices[0];
        if (!choice) {
            throw new Error('OpenAI returned no choices');
        }

        const content = choice.message.content;
        if (!content) {
            throw new Error('OpenAI returned empty content');
        }

        return {
            content,
            inputTokens: response.usage?.prompt_tokens ?? 0,
            outputTokens: response.usage?.completion_tokens ?? 0,
            model: this.model,
        };
    }

    async embed(text: string): Promise<readonly number[]> {
        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        });

        const embedding = response.data[0]?.embedding;
        if (!embedding) {
            throw new Error('OpenAI returned no embedding');
        }

        return embedding;
    }
}
