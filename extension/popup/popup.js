import { Storage } from '../utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const providerSelect = document.getElementById('providerSelect');

    // Dynamic single input
    const apiKeyLabel = document.getElementById('apiKeyLabel');
    const apiKeyInput = document.getElementById('apiKeyInput');

    // Storage fields
    const geminiApiKey = document.getElementById('geminiApiKey');
    const openaiApiKey = document.getElementById('openaiApiKey');
    const claudeApiKey = document.getElementById('claudeApiKey');

    // Profile inputs (hidden in new UI, but logic intact)
    const nameInput = document.getElementById('name');
    const rollNoInput = document.getElementById('rollNo');
    const prnInput = document.getElementById('prn');
    const emailInput = document.getElementById('email');

    const saveBtn = document.getElementById('saveBtn');
    const statusMessage = document.getElementById('statusMessage');

    // Display logic function
    function updateVisibleApiInput() {
        const provider = providerSelect.value;
        if (provider === 'gemini') {
            apiKeyLabel.textContent = 'Gemini API Key:';
            apiKeyInput.value = geminiApiKey.value;
            apiKeyInput.placeholder = 'AIzaSy...';
        } else if (provider === 'openai') {
            apiKeyLabel.textContent = 'OpenAI API Key:';
            apiKeyInput.value = openaiApiKey.value;
            apiKeyInput.placeholder = 'sk-...';
        } else if (provider === 'claude') {
            apiKeyLabel.textContent = 'Claude API Key:';
            apiKeyInput.value = claudeApiKey.value;
            apiKeyInput.placeholder = 'sk-ant-...';
        }
    }

    // Sync input back to hidden fields on input
    apiKeyInput.addEventListener('input', () => {
        const provider = providerSelect.value;
        if (provider === 'gemini') geminiApiKey.value = apiKeyInput.value;
        if (provider === 'openai') openaiApiKey.value = apiKeyInput.value;
        if (provider === 'claude') claudeApiKey.value = apiKeyInput.value;
    });

    providerSelect.addEventListener('change', updateVisibleApiInput);

    // Load existing data
    const data = await Storage.get(['aiProvider', 'profile', 'geminiApiKey', 'openaiApiKey', 'claudeApiKey']);
    if (data.aiProvider) {
        providerSelect.value = data.aiProvider;
    }

    if (data.geminiApiKey) geminiApiKey.value = data.geminiApiKey;
    if (data.openaiApiKey) openaiApiKey.value = data.openaiApiKey;
    if (data.claudeApiKey) claudeApiKey.value = data.claudeApiKey;

    if (data.profile) {
        nameInput.value = data.profile.name || '';
        rollNoInput.value = data.profile.rollNo || '';
        prnInput.value = data.profile.prn || '';
        emailInput.value = data.profile.email || '';
    }

    // Initialize standard view
    updateVisibleApiInput();

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const settings = {
            aiProvider: providerSelect.value,
            geminiApiKey: geminiApiKey.value.trim(),
            openaiApiKey: openaiApiKey.value.trim(),
            claudeApiKey: claudeApiKey.value.trim(),
            profile: {
                name: nameInput.value.trim(),
                rollNo: rollNoInput.value.trim(),
                prn: prnInput.value.trim(),
                email: emailInput.value.trim()
            }
        };

        await Storage.set(settings);

        // Send profile data to background for analytics registration
        chrome.runtime.sendMessage({
            action: 'SAVE_PROFILE',
            profile: settings.profile
        });

        statusMessage.textContent = 'Settings saved successfully!';
        setTimeout(() => {
            statusMessage.textContent = '';
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Settings';
        }, 2000);
    });
});
