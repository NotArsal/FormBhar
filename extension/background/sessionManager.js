import { Storage } from '../utils/storage.js';

const SESSION_KEY = 'ai_session';
const SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export const SessionManager = {
    async createSession() {
        const sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        const sessionData = {
            id: sessionId,
            expiresAt: Date.now() + SESSION_EXPIRY_MS,
            answersReceived: false
        };

        await Storage.set({ [SESSION_KEY]: sessionData });
        return sessionId;
    },

    async getSession() {
        const data = await Storage.get([SESSION_KEY]);
        return data[SESSION_KEY] || null;
    },

    async markAnswersReceived(sessionId) {
        const session = await this.getSession();
        if (session && session.id === sessionId) {
            session.answersReceived = true;
            await Storage.set({ [SESSION_KEY]: session });
            return true;
        }
        return false;
    },

    async validateAndConsume(sessionId) {
        const session = await this.getSession();
        if (!session || session.id !== sessionId) {
            return { valid: false, reason: 'Invalid session ID' };
        }

        if (Date.now() > session.expiresAt) {
            await this.clearSession();
            return { valid: false, reason: 'Session expired' };
        }

        if (!session.answersReceived) {
            return { valid: false, reason: 'Answers not received from AI yet' };
        }

        // Invalidate session after successfully consuming it
        await this.clearSession();
        return { valid: true };
    },

    async clearSession() {
        await Storage.remove(SESSION_KEY);
    }
};
