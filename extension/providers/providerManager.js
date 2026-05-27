import { GeminiProvider } from './geminiProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { ClaudeProvider } from './claudeProvider.js';
import { Storage } from '../utils/storage.js';

const PROVIDER_ORDER = ['openai', 'gemini', 'claude'];

export const ProviderManager = {
  async generateAnswers(providerName, formContext, userProfile) {
    const preferred = providerName.toLowerCase();
    
    // Retrieve credentials to check which providers are configured
    const authData = await Storage.get(['openaiApiKey', 'geminiApiKey', 'claudeApiKey']);
    
    const isConfigured = (key, placeholder) => {
      return key && key.trim() !== '' && key.trim() !== placeholder;
    };

    const hasKey = {
      openai: isConfigured(authData.openaiApiKey, 'YOUR_OPENAI_API_KEY'),
      gemini: isConfigured(authData.geminiApiKey, 'YOUR_GEMINI_API_KEY'),
      claude: isConfigured(authData.claudeApiKey, 'YOUR_CLAUDE_API_KEY')
    };

    const configuredProviders = PROVIDER_ORDER.filter(p => hasKey[p]);

    let providers = [];
    if (configuredProviders.length > 0) {
      if (configuredProviders.includes(preferred)) {
        // Preferred is configured, try it first, then others
        providers = [preferred, ...configuredProviders.filter(p => p !== preferred)];
      } else {
        // Preferred is NOT configured, try other configured ones first, then preferred last
        providers = [...configuredProviders, preferred];
      }
    } else {
      // None are configured, fall back to trying the preferred one so they get a specific key missing error
      providers = [preferred];
    }


    let lastError = null;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const getJitterDelay = () => Math.floor(Math.random() * 2000) + 1000; // 1s to 3s

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
        
        // Wait a random jittered delay before moving to the fallback provider to mitigate concurrency surges
        const delay = getJitterDelay();
        console.log(`Rate limit / error fallback triggered: waiting ${delay}ms before next provider...`);
        await sleep(delay);
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