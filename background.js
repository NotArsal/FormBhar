// Background service worker for Google Forms Auto-Filler
// Handles Gemini API communication

// ⚠️ SECURITY WARNING: Hardcoded API key for convenience
// This key is visible to anyone who inspects the extension code
// Only use this for personal/testing purposes, not for distribution
// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getAIAnswer') {
        const apiKey = request.apiKey;
        if (!apiKey) {
            sendResponse({ success: false, error: 'API key not set. Please configure it in the extension popup.' });
            return true;
        }

        // Make API call to Gemini
        getGeminiAnswer(request.prompt, apiKey)
            .then(answer => {
                sendResponse({ success: true, answer: answer });
            })
            .catch(error => {
                console.error('Gemini API error:', error);
                sendResponse({ success: false, error: error.message });
            });

        // Return true to indicate async response
        return true;
    }
});

// Get list of available models
async function getAvailableModels(apiKey) {
    const LIST_MODELS_URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(LIST_MODELS_URL);

        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.statusText}`);
        }

        const data = await response.json();

        // Filter models that support generateContent
        const compatibleModels = data.models.filter(model =>
            model.supportedGenerationMethods &&
            model.supportedGenerationMethods.includes('generateContent')
        );

        console.log('Available models:', compatibleModels.map(m => m.name));

        // Prefer models in this order: flash > pro > anything else
        const preferredModel = compatibleModels.find(m => m.name.includes('flash')) ||
            compatibleModels.find(m => m.name.includes('pro')) ||
            compatibleModels[0];

        if (preferredModel) {
            // Extract just the model name (e.g., "models/gemini-1.5-flash" -> "gemini-1.5-flash")
            const modelName = preferredModel.name.replace('models/', '');
            console.log('Selected model:', modelName);
            return modelName;
        }

        throw new Error('No compatible models found');

    } catch (error) {
        console.error('Error listing models:', error);
        throw error;
    }
}

// Call Gemini API
async function getGeminiAnswer(prompt, apiKey) {
    try {
        // Get available model if not cached
        if (!cachedModelName) {
            cachedModelName = await getAvailableModels(apiKey);
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${cachedModelName}:generateContent?key=${apiKey}`;

        console.log('Using model:', cachedModelName);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.4,
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();

            // If model not found, clear cache and retry once
            if (errorData.error?.message?.includes('not found')) {
                console.log('Model not found, refreshing model list...');
                cachedModelName = null;
                cachedModelName = await getAvailableModels(apiKey);

                // Retry with new model
                return getGeminiAnswer(prompt, apiKey);
            }

            throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // Extract the answer from the response
        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                return candidate.content.parts[0].text.trim();
            }
        }

        throw new Error('No answer received from API');

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error;
    }
}
