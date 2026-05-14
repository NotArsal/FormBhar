import { Storage } from '../utils/storage.js';

// Storage keys
const STORAGE_KEYS = {
  aiProvider: 'aiProvider',
  profile: 'profile',
  formHistory: 'formHistory',
  geminiApiKey: 'geminiApiKey',
  openaiApiKey: 'openaiApiKey',
  claudeApiKey: 'claudeApiKey'
};

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const elements = {
    providerSelect: document.getElementById('providerSelect'),
    apiKeyLabel: document.getElementById('apiKeyLabel'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    geminiApiKey: document.getElementById('geminiApiKey'),
    openaiApiKey: document.getElementById('openaiApiKey'),
    claudeApiKey: document.getElementById('claudeApiKey'),
    profileName: document.getElementById('profileName'),
    profileRollNo: document.getElementById('profileRollNo'),
    profileEmail: document.getElementById('profileEmail'),
    profilePhone: document.getElementById('profilePhone'),
    profileDept: document.getElementById('profileDept'),
    profileClass: document.getElementById('profileClass'),
    saveBtn: document.getElementById('saveBtn'),
    statusMessage: document.getElementById('statusMessage'),
    saveMyInfoBtn: document.getElementById('saveMyInfoBtn'),
    autoFillBtn: document.getElementById('autoFillBtn'),
    fillProfileBtn: document.getElementById('fillProfileBtn'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    statusBadge: document.getElementById('statusBadge')
  };

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');
    });
  });

  // API key switching
  elements.providerSelect.addEventListener('change', updateApiKeyDisplay);
  elements.apiKeyInput.addEventListener('input', syncApiKeyToHidden);

  // Save settings
  elements.saveBtn.addEventListener('click', saveSettings);

  // Save My Info - open current tab to extract info
  elements.saveMyInfoBtn.addEventListener('click', captureUserInfo);

  // Quick actions
  elements.autoFillBtn.addEventListener('click', triggerAutoFill);
  elements.fillProfileBtn.addEventListener('click', triggerProfileFill);

  // History
  elements.clearHistoryBtn.addEventListener('click', clearHistory);

  // Load data
  await loadSettings();
  await loadHistory();
  fetchGlobalStats();

  // Update API key display on load
  updateApiKeyDisplay();

  async function fetchGlobalStats() {
    try {
      const res = await fetch('https://formbhar-backend-7ir1.onrender.com/api/stats');
      if (res.ok) {
        const stats = await res.json();
        document.getElementById('statTotalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('statLiveUsers').textContent = stats.liveUsers || 0;
      }
    } catch (e) {
      console.warn('Could not fetch global stats', e);
      document.getElementById('statTotalUsers').textContent = '-';
      document.getElementById('statLiveUsers').textContent = '-';
    }
  }

  function updateApiKeyDisplay() {
    const provider = elements.providerSelect.value;
    const configs = {
      gemini: { label: 'Gemini API Key', placeholder: 'AIzaSy...', keyEl: elements.geminiApiKey },
      openai: { label: 'OpenAI API Key', placeholder: 'sk-...', keyEl: elements.openaiApiKey },
      claude: { label: 'Claude API Key', placeholder: 'sk-ant-...', keyEl: elements.claudeApiKey }
    };
    const config = configs[provider];
    elements.apiKeyLabel.textContent = config.label;
    elements.apiKeyInput.placeholder = config.placeholder;
    elements.apiKeyInput.value = config.keyEl.value || '';
  }

  function syncApiKeyToHidden() {
    const provider = elements.providerSelect.value;
    if (provider === 'gemini') elements.geminiApiKey.value = elements.apiKeyInput.value;
    if (provider === 'openai') elements.openaiApiKey.value = elements.apiKeyInput.value;
    if (provider === 'claude') elements.claudeApiKey.value = elements.apiKeyInput.value;
  }

  async function loadSettings() {
    const data = await Storage.get(Object.values(STORAGE_KEYS));

    if (data.aiProvider) elements.providerSelect.value = data.aiProvider;
    if (data.geminiApiKey) elements.geminiApiKey.value = data.geminiApiKey;
    if (data.openaiApiKey) elements.openaiApiKey.value = data.openaiApiKey;
    if (data.claudeApiKey) elements.claudeApiKey.value = data.claudeApiKey;

    if (data.profile) {
      elements.profileName.value = data.profile.name || '';
      elements.profileRollNo.value = data.profile.rollNo || '';
      elements.profileEmail.value = data.profile.email || '';
      elements.profilePhone.value = data.profile.phone || '';
      elements.profileDept.value = data.profile.department || '';
      elements.profileClass.value = data.profile.classYear || '';
    }
  }

  async function saveSettings() {
    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    const profile = {
      name: elements.profileName.value.trim(),
      rollNo: elements.profileRollNo.value.trim(),
      email: elements.profileEmail.value.trim(),
      phone: elements.profilePhone.value.trim(),
      department: elements.profileDept.value.trim(),
      classYear: elements.profileClass.value.trim()
    };

    const settings = {
      aiProvider: elements.providerSelect.value,
      geminiApiKey: elements.geminiApiKey.value.trim(),
      openaiApiKey: elements.openaiApiKey.value.trim(),
      claudeApiKey: elements.claudeApiKey.value.trim(),
      profile
    };

    await Storage.set(settings);

    // Notify background script
    chrome.runtime.sendMessage({ action: 'SAVE_PROFILE', profile });

    showStatus('Settings saved!', false);
    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = 'Save Settings';
  }

  async function captureUserInfo() {
    showStatus('Opening page to capture info...', false);

    // Get current tab and inject script to extract user info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('docs.google.com/forms')) {
      showStatus('Please open a form first', true);
      return;
    }

    // Send message to content script to extract user info from form fields
    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_USER_INFO' }, async (response) => {
      if (response && response.userInfo) {
        // Auto-fill profile fields
        const info = response.userInfo;
        if (info.name) elements.profileName.value = info.name;
        if (info.email) elements.profileEmail.value = info.email;
        if (info.phone) elements.profilePhone.value = info.phone;

        showStatus('Info captured! Click Save to store.', false);
      } else {
        showStatus('Could not extract info. Fill manually.', true);
      }
    });
  }

  async function triggerAutoFill() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTO_FILL' });
      window.close();
    }
  }

  async function triggerProfileFill() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_PROFILE_FILL' });
      window.close();
    }
  }

  async function loadHistory() {
    const data = await Storage.get([STORAGE_KEYS.formHistory]);
    const history = data.formHistory || [];

    if (history.length === 0) {
      elements.historyList.innerHTML = '<div class="empty-state">No forms saved yet</div>';
      return;
    }

    elements.historyList.innerHTML = history.map((item, index) => `
      <div class="history-item" data-index="${index}" style="cursor: pointer; flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div class="history-item-info">
            <div class="history-item-title">${escapeHtml(item.formTitle || 'Untitled')}</div>
            <div class="history-item-meta">${item.questionsCount} questions • ${formatDate(item.timestamp)}</div>
          </div>
          <button class="history-item-delete" data-index="${index}" style="margin-left: 10px;">×</button>
        </div>
        <div class="history-item-answers" id="answers-${index}" style="display: none; padding-top: 8px; margin-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #444;">
          <a href="${item.url}" target="_blank" style="color: #1a73e8; text-decoration: none; display: block; margin-bottom: 8px;">🔗 Open Form</a>
          ${(item.answers || []).length > 0 ? (item.answers || []).map(a => `
            <div style="margin-bottom: 4px;">
              <strong>${escapeHtml(a.questionText)}</strong><br>
              <span style="color: #666;">${escapeHtml(Array.isArray(a.value) ? a.value.join(', ') : String(a.value))}</span>
            </div>
          `).join('') : '<em>No specific answers saved.</em>'}
        </div>
      </div>
    `).join('');

    // Add click handlers
    elements.historyList.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('history-item-delete') && e.target.tagName !== 'A') {
          openHistoryItem(parseInt(item.dataset.index));
        }
      });
    });

    elements.historyList.querySelectorAll('.history-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryItem(parseInt(btn.dataset.index));
      });
    });
  }

  async function deleteHistoryItem(index) {
    const data = await Storage.get([STORAGE_KEYS.formHistory]);
    let history = data.formHistory || [];
    history.splice(index, 1);
    await Storage.set({ formHistory: history });
    await loadHistory();
  }

  async function clearHistory() {
    if (confirm('Clear all form history?')) {
      await Storage.set({ formHistory: [] });
      await loadHistory();
    }
  }

  async function openHistoryItem(index) {
    const answersDiv = document.getElementById(`answers-${index}`);
    if (answersDiv) {
      answersDiv.style.display = answersDiv.style.display === 'none' ? 'block' : 'none';
    }
  }

  function showStatus(message, isError) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.classList.toggle('error', isError);
    setTimeout(() => {
      elements.statusMessage.textContent = '';
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
});