document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

function saveOptions() {
    const apiKey = document.getElementById('apiKey').value;
    chrome.storage.local.set({ apiKey: apiKey }, () => {
        const status = document.getElementById('statusMsg');
        status.textContent = 'Options saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 2000);
    });
}

function restoreOptions() {
    chrome.storage.local.get(['apiKey'], (items) => {
        if (items.apiKey) {
            document.getElementById('apiKey').value = items.apiKey;
        }
    });
}
