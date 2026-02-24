import { Storage } from '../utils/storage.js';

export const Analytics = {
    async getUserId() {
        let data = await Storage.get(['userId']);
        let userId = data.userId;
        if (!userId) {
            userId = 'usr_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            await Storage.set({ userId });
        }
        return userId;
    },

    async registerUser(profile) {
        const userId = await this.getUserId();
        const manifest = chrome.runtime.getManifest();

        // Save to local storage instead of backend
        const userData = {
            userId,
            extensionVersion: manifest.version,
            profile,
            lastActive: Date.now()
        };

        await Storage.set({ userData });
        console.log('User Registered Locally:', userData);
    },

    async ping(activeSessionId) {
        // Update local last active time
        await Storage.set({ lastActivePing: Date.now() });

        // In a real serverless setup without a backend, tracking "live users" globally
        // is impossible. We can only track local usage stats.
    },

    async logForm(formTitle, aiProvider, questionsCount, success) {
        const userId = await this.getUserId();

        // Retrieve existing logs
        const data = await Storage.get(['formLogs']);
        const logs = data.formLogs || [];

        const newLog = {
            id: Date.now(),
            userId,
            formTitle: formTitle || 'Unknown',
            aiProvider,
            questionsCount: questionsCount || 0,
            success,
            timestamp: Date.now()
        };

        logs.push(newLog);

        // Keep only the last 100 logs to save storage space
        if (logs.length > 100) {
            logs.shift();
        }

        await Storage.set({ formLogs: logs });
        console.log('Form Logged Locally:', newLog);
    },

    startPingLoop() {
        this.ping();
        setInterval(() => {
            this.ping();
        }, 60 * 1000); // Ping every 60s locally
    }
};
