import { GeminiProvider } from './geminiProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { ClaudeProvider } from './claudeProvider.js';

const PROVIDER_ORDER = ['openai', 'gemini', 'claude'];

export const ProviderManager = {
  async generateAnswers(providerName, formContext, userProfile) {
    // Get the index of the current provider
    const currentIndex = PROVIDER_ORDER.indexOf(providerName.toLowerCase());
    const providers = currentIndex >= 0
      ? [PROVIDER_ORDER[currentIndex], ...PROVIDER_ORDER.slice(0, currentIndex)]
      : PROVIDER_ORDER;

    let lastError = null;

    // Try each provider in order until one succeeds
    for (const providerKey of providers) {
      try {
        const provider = this.getProvider(providerKey);
        const result = await provider.generate(formContext, userProfile);
        console.log(`Successfully generated answers using ${providerKey}`);
        return result;
      } catch (e) {
        console.warn(`Provider ${providerKey} failed:`, e.message);
        lastError = e;
        // Continue to next provider
      }
    }

    // All providers failed
    console.error('All AI providers failed:', lastError);
    throw lastError || new Error('All AI providers failed');
  },

  getProvider(providerName) {
    switch (providerName.toLowerCase()) {
      case 'gemini':
        return GeminiProvider;
      case 'claude':
        return ClaudeProvider;
      case 'openai':
      default:
        return OpenAIProvider;
    }
  }
};