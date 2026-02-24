import { GeminiProvider } from './geminiProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { ClaudeProvider } from './claudeProvider.js';

export const ProviderManager = {
    async generateAnswers(providerName, formContext, userProfile) {
        let provider;
        switch (providerName.toLowerCase()) {
            case 'gemini':
                provider = GeminiProvider;
                break;
            case 'claude':
                provider = ClaudeProvider;
                break;
            case 'openai':
            default:
                provider = OpenAIProvider;
                break;
        }

        try {
            return await provider.generate(formContext, userProfile);
        } catch (e) {
            console.error(`AI Provider (${providerName}) Error:`, e);
            throw e;
        }
    }
};
