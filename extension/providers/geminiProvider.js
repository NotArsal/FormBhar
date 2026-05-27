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


        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
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

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        let textObj = data.candidates[0].content.parts[0].text.trim();
        if (textObj.startsWith('```json')) {
            textObj = textObj.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        return JSON.parse(textObj);
    }
};
