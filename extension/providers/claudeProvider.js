import { ContextExtractor } from '../utils/contextExtractor.js';
import { Storage } from '../utils/storage.js';

export const ClaudeProvider = {
    async generate(formContext, userProfile) {
        const authData = await Storage.get(['claudeApiKey']);
        const apiKey = authData.claudeApiKey || 'YOUR_CLAUDE_API_KEY';

        const prompt = ContextExtractor.buildPrompt(formContext, userProfile);

        if (apiKey === 'YOUR_CLAUDE_API_KEY') {
            throw new Error('Claude API Key is missing! Please configure it in the extension popup.');
        }

        // Note: Claude currently doesn't strictly allow explicit direct CORS fetch from browser unless proxy is used,
        // but Manifest V3 background scripts with host permissions bypass CORS natively.
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1000,
                temperature: 0.1,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();
        let textObj = data.content[0].text.trim();
        if (textObj.startsWith('```json')) {
            textObj = textObj.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        return JSON.parse(textObj);
    }
};
