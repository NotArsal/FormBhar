import { Storage } from '../utils/storage.js';

const API_BASE = "https://formbhar-backend-7ir1.onrender.com/api";

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

        if (navigator.onLine === false) return;

        // Register on backend
        try {
            const correlationId = crypto.randomUUID();
            await fetch(`${API_BASE}/register-user`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId
                },
                body: JSON.stringify({
                    userId,
                    extensionVersion: manifest.version
                })
            });
            console.log(`[Analytics] User registered on backend (correlationId: ${correlationId})`);
        } catch (e) {
            console.warn('[Analytics] Failed to register user on backend:', e.message || e);
        }
    },
    async initSession() {
        if (navigator.onLine === false) return null;
        const userId = await this.getUserId();
        try {
            const correlationId = crypto.randomUUID();
            const res = await fetch(`${API_BASE}/start-session`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId
                },
                body: JSON.stringify({ userId })
            });
            if (!res.ok) {
                console.warn(`[Analytics] Failed to start session: HTTP status ${res.status} (correlationId: ${correlationId})`);
                return null;
            }
            const data = await res.json();
            if (data.success && data.sessionId) {
                // Store active session ID in memory (or local storage for robustness across service worker restarts)
                await Storage.set({ activeSessionId: data.sessionId });
                return data.sessionId;
            }
        } catch (e) {
            console.warn('[Analytics] Failed to init session (offline or server sleeping):', e.message || e);
        }
        return null;
    },

    async ping() {
        if (navigator.onLine === false) return;

        // Retrieve active session ID
        let { activeSessionId } = await Storage.get(['activeSessionId']);

        // If we don't have one, try to start one
        if (!activeSessionId) {
            activeSessionId = await this.initSession();
        }

        // Only ping if we successfully have a sessionId
        if (!activeSessionId) return;

        try {
            const correlationId = crypto.randomUUID();
            const res = await fetch(`${API_BASE}/ping`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId
                },
                body: JSON.stringify({ sessionId: activeSessionId })
            });
            if (!res.ok) {
                console.warn(`[Analytics] Ping returned HTTP status ${res.status} (correlationId: ${correlationId})`);
                if (res.status === 404 || res.status === 401) {
                    // Session lost or expired on backend (e.g. backend restarted)
                    await Storage.remove(['activeSessionId']);
                }
            }
        } catch (e) {
            console.warn('[Analytics] Failed to ping backend (offline or server sleeping):', e.message || e);
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

        if (navigator.onLine === false) return;

        // Backend logging
        if (success) {
            try {
                const correlationId = crypto.randomUUID();
                await fetch(`${API_BASE}/log-form`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Correlation-ID': correlationId
                    },
                    body: JSON.stringify({
                        userId,
                        formTitle,
                        questionsCount
                    })
                });
                console.log(`[Analytics] Form logged to backend (correlationId: ${correlationId})`);
            } catch (e) {
                console.warn('[Analytics] Failed to log form to backend:', e.message || e);
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
        } else {
            console.warn('chrome.alarms API not available, using setInterval fallback');
            setInterval(() => this.ping(), 60000);
        }
    }
};

// Register top-level listener to handle alarm wakeups correctly in Manifest V3
if (chrome.alarms) {
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'analytics_ping') {
            Analytics.ping();
        }
    });
}
