export const Storage = {
    async get(keys) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.get(keys, (result) => {
                    resolve(result);
                });
            });
        }
        // Fallback if not in extension environment for testing
        console.warn('chrome.storage is not available.');
        return {};
    },

    async set(data) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.set(data, () => {
                    resolve();
                });
            });
        }
    },

    async remove(keys) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.remove(keys, () => {
                    resolve();
                });
            });
        }
    }
};
