import { Storage } from '../utils/storage.js';

const API_BASE = 'http://localhost:5000/api';

export const Analytics = {
    async getUserId() {
        let data = await Storage.get(['userId']);
        let userId = data.userId;
        if (!userId) {
            userId = crypto.randomUUID();
            await Storage.set({ userId });
        }
        return userId;
    },

    async registerUser(profile) {
        const userId = await this.getUserId();
        const manifest = chrome.runtime.getManifest();

        // Save local copy
        const userData = {
            userId,
            extensionVersion: manifest.version,
            profile,
            lastActive: Date.now()
        };
        await Storage.set({ userData });

        // Register on backend
        try {
            await fetch(`${API_BASE}/register-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    extensionVersion: manifest.version
                })
            });
            console.log('User registered on backend');
        } catch (e) {
            console.error('Failed to register user on backend:', e);
        }
    },
    async initSession() {
        const userId = await this.getUserId();
        try {
            const res = await fetch(`${API_BASE}/start-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await res.json();
            if (data.success && data.sessionId) {
                // Store active session ID in memory (or local storage for robustness across service worker restarts)
                await Storage.set({ activeSessionId: data.sessionId });
                return data.sessionId;
            }
        } catch (e) {
            console.error('Failed to init session:', e);
        }
        return null;
    },

    async ping() {
        // Retrieve active session ID
        let { activeSessionId } = await Storage.get(['activeSessionId']);

        // If we don't have one, try to start one
        if (!activeSessionId) {
            activeSessionId = await this.initSession();
        }

        // Only ping if we successfully have a sessionId
        if (!activeSessionId) return;

        try {
            await fetch(`${API_BASE}/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: activeSessionId })
            });
        } catch (e) {
            // If ping fails completely (e.g., backend restarted and lost session row while in dev mode),
            // you might want to clear activeSessionId here. For now, keep trying.
            console.error('Failed to ping backend:', e);
        }
    },

    async logForm(formTitle, aiProvider, questionsCount, success) {
        const userId = await this.getUserId();

        // Local logging backup
        const data = await Storage.get(['formLogs']);
        const logs = data.formLogs || [];
        const newLog = { id: Date.now(), userId, formTitle, aiProvider, questionsCount, success, timestamp: Date.now() };
        logs.push(newLog);
        if (logs.length > 100) logs.shift();
        await Storage.set({ formLogs: logs });

        // Backend logging
        if (success) {
            try {
                await fetch(`${API_BASE}/log-form`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        formTitle,
                        questionsCount
                    })
                });
                console.log('Form logged to backend');
            } catch (e) {
                console.error('Failed to log form to backend:', e);
            }
        }
    },

    async startPingLoop() {
        // Drop any stale session on restart and create a new one
        await Storage.remove(['activeSessionId']);
        await this.initSession();

        // Initial ping
        this.ping();

        // Setup alarm for every 1 minute
        if (chrome.alarms) {
            chrome.alarms.create('analytics_ping', { periodInMinutes: 1 });
            chrome.alarms.onAlarm.addListener((alarm) => {
                if (alarm.name === 'analytics_ping') {
                    this.ping();
                }
            });
        } else {
            console.warn('chrome.alarms API not available, using setInterval fallback');
            setInterval(() => this.ping(), 60000);
        }
    }
};
