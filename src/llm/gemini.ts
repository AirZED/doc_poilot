import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMAdapter, LLMRequest, LLMResponse } from '../types/index';

export class GeminiAdapter implements LLMAdapter {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: string;

    constructor(apiKey: string, model: string = 'gemini-1.5-pro') {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = model;
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const model = this.genAI.getGenerativeModel({ model: this.model });

        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: `${request.systemPrompt}\n\n${request.userPrompt}` }] }
            ],
            generationConfig: {
                maxOutputTokens: request.maxTokens ?? 4096,
            }
        });

        const content = result.response.text();
        if (!content) {
            throw new Error('Gemini returned empty content');
        }

        // Gemini SDK doesn't return tokens directly in a simple way for non-streamed responses
        // easily without additional metadata calls, so we approximate or use 0 for now
        // if exact tracking isn't critical.
        return {
            content,
            inputTokens: 0,
            outputTokens: 0,
            model: this.model,
        };
    }

    async embed(text: string): Promise<readonly number[]> {
        const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const result = await model.embedContent(text);

        const embedding = result.embedding.values;
        if (!embedding) {
            throw new Error('Gemini returned no embedding');
        }

        return embedding;
    }
}
