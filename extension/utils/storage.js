export const Storage = {
    async get(keys) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Storage get error:', chrome.runtime.lastError.message);
                    }
                    resolve(result || {});
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
                    if (chrome.runtime.lastError) {
                        console.warn('Storage set error:', chrome.runtime.lastError.message);
                    }
                    resolve();
                });
            });
        }
        return Promise.resolve();
    },

    async remove(keys) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Storage remove error:', chrome.runtime.lastError.message);
                    }
                    resolve();
                });
            });
        }
        return Promise.resolve();
    }
};
