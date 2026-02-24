import { SessionManager } from './sessionManager.js';
import { Analytics } from './analytics.js';
import { Storage } from '../utils/storage.js';
import { ProviderManager } from '../providers/providerManager.js';

// Init analytics telemetry
chrome.runtime.onInstalled.addListener(() => {
    Analytics.startPingLoop();
});

chrome.runtime.onStartup.addListener(() => {
    Analytics.startPingLoop();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GENERATE_ANSWERS') {
        handleGenerateAnswers(request.formContext, sendResponse);
        return true; // Keep channel open for async response
    }

    if (request.action === 'SAVE_PROFILE') {
        Analytics.registerUser(request.profile);
        sendResponse({ success: true });
        return false; // Sync response
    }

    if (request.action === 'VALIDATE_SESSION') {
        handleValidateSession(request.sessionId, sendResponse);
        return true;
    }

    if (request.action === 'GET_ANSWERS') {
        handleGetAnswers(request.sessionId, sendResponse);
        return true;
    }
});

async function handleGenerateAnswers(formContext, sendResponse) {
    try {
        const sessionId = await SessionManager.createSession();

        // Check config
        const config = await Storage.get(['aiProvider', 'profile']);
        const providerName = config.aiProvider || 'openai';

        // 1. Generate answers via provider
        const answers = await ProviderManager.generateAnswers(providerName, formContext, config.profile || {});

        // 2. Mark session secure and store answers in storage mapping to sessionId
        await SessionManager.markAnswersReceived(sessionId);
        await Storage.set({ [`answers_${sessionId}`]: answers });

        // 3. Log analytics
        await Analytics.logForm(formContext.formTitle, providerName, formContext.sections[0]?.questions?.length || 0, true);

        sendResponse({ success: true, sessionId });
    } catch (error) {
        console.error('Error in handleGenerateAnswers:', error);
        await Analytics.logForm(formContext?.formTitle, 'error', 0, false);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleValidateSession(sessionId, sendResponse) {
    const result = await SessionManager.validateAndConsume(sessionId);
    sendResponse(result);
}

async function handleGetAnswers(sessionId, sendResponse) {
    const data = await Storage.get([`answers_${sessionId}`]);
    const answers = data[`answers_${sessionId}`];
    if (answers) {
        await Storage.remove([`answers_${sessionId}`]); // clear after sending
        sendResponse({ success: true, answers });
    } else {
        sendResponse({ success: false, error: 'No answers found for session' });
    }
}
