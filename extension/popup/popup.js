import { Storage } from '../utils/storage.js';

// Storage keys
const STORAGE_KEYS = {
  aiProvider: 'aiProvider',
  profile: 'profile',
  formHistory: 'formHistory',
  geminiApiKey: 'geminiApiKey',
  openaiApiKey: 'openaiApiKey',
  claudeApiKey: 'claudeApiKey',
  groqApiKey: 'groqApiKey',
  autonomousMode: 'autonomousMode',
  theme: 'theme'
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
    groqApiKey: document.getElementById('groqApiKey'),
    profileName: document.getElementById('profileName'),
    profileTeamName: document.getElementById('profileTeamName'),
    profileRollNo: document.getElementById('profileRollNo'),
    profilePRN: document.getElementById('profilePRN'),
    profileEmail: document.getElementById('profileEmail'),
    profilePhone: document.getElementById('profilePhone'),
    profileDept: document.getElementById('profileDept'),
    profileBranch: document.getElementById('profileBranch'),
    profileClass: document.getElementById('profileClass'),
    profileSemester: document.getElementById('profileSemester'),
    profileDivision: document.getElementById('profileDivision'),
    saveBtn: document.getElementById('saveBtn'),
    statusMessage: document.getElementById('statusMessage'),
    saveMyInfoBtn: document.getElementById('saveMyInfoBtn'),
    autoFillBtn: document.getElementById('autoFillBtn'),
    fillProfileBtn: document.getElementById('fillProfileBtn'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    statusBadge: document.getElementById('statusBadge'),
    autonomousToggle: document.getElementById('autonomousToggle'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    learnedCount: document.getElementById('learnedCount'),
    clearLearnedBtn: document.getElementById('clearLearnedBtn')
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

  // Clear Learned Memory button
  if (elements.clearLearnedBtn) {
    elements.clearLearnedBtn.addEventListener('click', clearLearnedMemories);
  }

  // Autonomous Mode validation
  elements.autonomousToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      const provider = elements.providerSelect.value;
      const currentKey = elements.apiKeyInput.value.trim();
      if (!currentKey) {
        alert(`⚠️ Please configure an API Key for your selected AI Provider (${provider.toUpperCase()}) before enabling Autonomous Mode.`);
        e.target.checked = false;
      }
    }
  });

  // Save settings
  elements.saveBtn.addEventListener('click', saveSettings);

  // Save My Info - open current tab to extract info
  elements.saveMyInfoBtn.addEventListener('click', captureUserInfo);

  // Quick actions
  elements.autoFillBtn.addEventListener('click', triggerAutoFill);
  elements.fillProfileBtn.addEventListener('click', triggerProfileFill);

  // History
  elements.clearHistoryBtn.addEventListener('click', clearHistory);

  // Theme Toggle
  elements.themeToggleBtn.addEventListener('click', toggleTheme);

  // Load data
  await loadSettings();
  await loadHistory();
  await loadLearnedMemories();
  fetchGlobalStats();
  checkForUpdates();

  async function loadLearnedMemories() {
    try {
      const data = await Storage.get(['learned_mappings']);
      const count = Object.keys(data.learned_mappings || {}).length;
      if (elements.learnedCount) elements.learnedCount.textContent = count;
    } catch {
      if (elements.learnedCount) elements.learnedCount.textContent = '0';
    }
  }

  async function clearLearnedMemories() {
    if (confirm('Clear all learned field memories and custom question corrections?')) {
      await Storage.set({ learned_mappings: {} });
      await loadLearnedMemories();
      showStatus('Learned memory cleared!', false);
    }
  }

  // Update API key display on load
  updateApiKeyDisplay();

  async function fetchGlobalStats() {
    try {
      const correlationId = crypto.randomUUID();
      const res = await fetch('https://formbhar-backend-7ir1.onrender.com/api/stats', {
        headers: {
          'X-Correlation-ID': correlationId
        }
      });
      if (res.ok) {
        const stats = await res.json();
        document.getElementById('statTotalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('statLiveUsers').textContent = Math.max(1, stats.liveUsers || 0);
      } else {
        console.log(`[Popup] Backend returned error: ${res.status} (correlationId: ${correlationId})`);
        document.getElementById('statTotalUsers').textContent = 'err';
        document.getElementById('statLiveUsers').textContent = 'err';
      }
    } catch (e) {
      console.log('[Popup] Could not fetch global stats:', e.message || e);
      document.getElementById('statTotalUsers').textContent = '-';
      document.getElementById('statLiveUsers').textContent = '-';
    }
  }

  async function checkForUpdates() {
    try {
      const currentVersion = chrome.runtime.getManifest().version;
      const versionEl = document.getElementById('versionText');
      if (versionEl) versionEl.textContent = `v${currentVersion}`;

      const res = await fetch('https://raw.githubusercontent.com/NotArsal/FormBhar/main/extension/manifest.json');
      if (!res.ok) return;
      const latestManifest = await res.json();
      
      if (compareVersions(latestManifest.version, currentVersion) > 0) {
        const banner = document.getElementById('updateBanner');
        const latestVerEl = document.getElementById('latestVersion');
        if (banner && latestVerEl) {
          latestVerEl.textContent = `v${latestManifest.version}`;
          banner.style.display = 'flex';
        }
      }
    } catch (e) {
      console.log('Update check skipped or failed:', e.message || e);
    }
  }

  function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  function updateApiKeyDisplay() {
    const provider = elements.providerSelect.value;
    const configs = {
      gemini: { label: 'Gemini API Key', placeholder: 'AIzaSy...', keyEl: elements.geminiApiKey },
      openai: { label: 'OpenAI API Key', placeholder: 'sk-...', keyEl: elements.openaiApiKey },
      claude: { label: 'Claude API Key', placeholder: 'sk-ant-...', keyEl: elements.claudeApiKey },
      groq: { label: 'Groq API Key', placeholder: 'gsk_...', keyEl: elements.groqApiKey }
    };
    const config = configs[provider] || configs.gemini;
    elements.apiKeyLabel.textContent = config.label;
    elements.apiKeyInput.placeholder = config.placeholder;
    elements.apiKeyInput.value = config.keyEl.value || '';
  }

  function syncApiKeyToHidden() {
    const provider = elements.providerSelect.value;
    if (provider === 'gemini') elements.geminiApiKey.value = elements.apiKeyInput.value;
    if (provider === 'openai') elements.openaiApiKey.value = elements.apiKeyInput.value;
    if (provider === 'claude') elements.claudeApiKey.value = elements.apiKeyInput.value;
    if (provider === 'groq') elements.groqApiKey.value = elements.apiKeyInput.value;
  }

  async function loadSettings() {
    const data = await Storage.get(Object.values(STORAGE_KEYS));

    if (data.aiProvider) elements.providerSelect.value = data.aiProvider;
    if (data.geminiApiKey) elements.geminiApiKey.value = data.geminiApiKey;
    if (data.openaiApiKey) elements.openaiApiKey.value = data.openaiApiKey;
    if (data.claudeApiKey) elements.claudeApiKey.value = data.claudeApiKey;
    if (data.groqApiKey) elements.groqApiKey.value = data.groqApiKey;
    elements.autonomousToggle.checked = data.autonomousMode || false;

    const profileFields = {
      name: elements.profileName,
      teamName: elements.profileTeamName,
      rollNo: elements.profileRollNo,
      prn: elements.profilePRN,
      email: elements.profileEmail,
      phone: elements.profilePhone,
      department: elements.profileDept,
      branch: elements.profileBranch,
      classYear: elements.profileClass,
      semester: elements.profileSemester,
      division: elements.profileDivision
    };

    if (data.profile) {
      Object.entries(profileFields).forEach(([key, inputEl]) => {
        if (inputEl) inputEl.value = data.profile[key] || '';
      });
    }

    // Load theme
    const savedTheme = data.theme || 'light';
    const isDark = savedTheme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    const icon = elements.themeToggleBtn.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
  }

  async function saveSettings() {
    // Enforce API key if Autonomous Mode is checked
    if (elements.autonomousToggle.checked) {
      const currentKey = elements.apiKeyInput.value.trim();
      if (!currentKey) {
        showStatus('Error: API Key required for Autonomous Mode!', true);
        return;
      }
    }

    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    const profileFields = {
      name: elements.profileName,
      teamName: elements.profileTeamName,
      rollNo: elements.profileRollNo,
      prn: elements.profilePRN,
      email: elements.profileEmail,
      phone: elements.profilePhone,
      department: elements.profileDept,
      branch: elements.profileBranch,
      classYear: elements.profileClass,
      semester: elements.profileSemester,
      division: elements.profileDivision
    };

    const profile = {};
    Object.entries(profileFields).forEach(([key, inputEl]) => {
      profile[key] = inputEl ? inputEl.value.trim() : '';
    });

    const settings = {
      aiProvider: elements.providerSelect.value,
      geminiApiKey: elements.geminiApiKey.value.trim(),
      openaiApiKey: elements.openaiApiKey.value.trim(),
      claudeApiKey: elements.claudeApiKey.value.trim(),
      groqApiKey: elements.groqApiKey.value.trim(),
      autonomousMode: elements.autonomousToggle.checked,
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

    if (!tab || !tab.url || !tab.url.includes('docs.google.com/forms')) {
      showStatus('Please open a form first', true);
      return;
    }

    // Send message to content script to extract user info from form fields
    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_USER_INFO' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[popup] captureUserInfo error:', chrome.runtime.lastError.message);
        showStatus('Could not extract info. Check tab connection.', true);
        return;
      }
      if (response && response.userInfo) {
        // Auto-fill profile fields
        const info = response.userInfo;
        if (info.name) elements.profileName.value = info.name;
        if (info.email) elements.profileEmail.value = info.email;
        if (info.phone) elements.profilePhone.value = info.phone;
        if (info.prn) elements.profilePRN.value = info.prn;
        if (info.rollNo) elements.profileRollNo.value = info.rollNo;
        if (info.department) elements.profileDept.value = info.department;
        if (info.branch) elements.profileBranch.value = info.branch;
        if (info.classYear) elements.profileClass.value = info.classYear;
        if (info.semester) elements.profileSemester.value = info.semester;
        if (info.division) elements.profileDivision.value = info.division;

        showStatus('Info captured! Click Save to store.', false);
      } else {
        showStatus('Could not extract info. Fill manually.', true);
      }
    });
  }

  async function triggerAutoFill() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTO_FILL' }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[popup] triggerAutoFill error:', chrome.runtime.lastError.message);
        }
      });
      window.close();
    }
  }

  async function triggerProfileFill() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_PROFILE_FILL' }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[popup] triggerProfileFill error:', chrome.runtime.lastError.message);
        }
      });
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

    elements.historyList.innerHTML = history.map((item, index) => {
      const safeUrl = (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://')))
        ? escapeHtml(item.url)
        : '#';
      return `
      <div class="history-item" data-index="${index}" style="cursor: pointer; flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div class="history-item-info">
            <div class="history-item-title">${escapeHtml(item.formTitle || 'Untitled')}</div>
            <div class="history-item-meta">${item.questionsCount} questions • ${formatDate(item.timestamp)}</div>
          </div>
          <button class="history-item-delete" data-index="${index}" style="margin-left: 10px;">×</button>
        </div>
        <div class="history-item-answers" id="answers-${index}" style="display: none; padding-top: 8px; margin-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #444;">
          ${safeUrl !== '#' ? `<a href="${safeUrl}" target="_blank" style="color: #1a73e8; text-decoration: none; display: block; margin-bottom: 8px;">🔗 Open Form</a>` : ''}
          ${(item.answers || []).length > 0 ? (item.answers || []).map(a => `
            <div style="margin-bottom: 4px;">
              <strong>${escapeHtml(a.questionText)}</strong><br>
              <span style="color: #666;">${escapeHtml(Array.isArray(a.value) ? a.value.join(', ') : String(a.value))}</span>
            </div>
          `).join('') : '<em>No specific answers saved.</em>'}
        </div>
      </div>
    `;
    }).join('');

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

  async function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    const theme = isDark ? 'dark' : 'light';
    await Storage.set({ theme });

    const icon = elements.themeToggleBtn.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
  }
});