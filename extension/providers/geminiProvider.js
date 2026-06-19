import { ContextExtractor } from '../utils/contextExtractor.js';
import { Storage } from '../utils/storage.js';

export const GeminiProvider = {
    async generate(formContext, userProfile) {
        const authData = await Storage.get(['geminiApiKey']);
        const apiKey = authData.geminiApiKey?.trim();

        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey === '') {
            throw new Error('Gemini API Key is missing! Please configure a valid API Key in the extension popup.');
        }

        const prompt = ContextExtractor.buildPrompt(formContext, userProfile);


        const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3.5-flash'];
        let lastError = null;

        for (const model of models) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.1
                        }
                    })
                });

                if (response.status === 404) {
                    console.warn(`Gemini model ${model} not found (404), trying next...`);
                    lastError = new Error(`Gemini API error: 404`);
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`Gemini API error: ${response.status}`);
                }

                const data = await response.json();
                let textObj = data.candidates[0].content.parts[0].text.trim();
                if (textObj.startsWith('```')) {
                    textObj = textObj.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
                }
                return JSON.parse(textObj);
            } catch (e) {
                console.warn(`Failed with model ${model}:`, e.message);
                lastError = e;
                // Only fall back on 404 / Model not found errors. For invalid API keys or other issues, fail immediately.
                if (e.message.includes('404')) {
                    continue;
                }
                throw e;
            }
        }
        throw lastError || new Error('All Gemini models failed');
    }
};
