import { Storage } from '../utils/storage.js';

const SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export const SessionManager = {
    async createSession() {
        const sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        const sessionData = {
            id: sessionId,
            expiresAt: Date.now() + SESSION_EXPIRY_MS,
            answersReceived: false
        };

        await Storage.set({ [`session_${sessionId}`]: sessionData });
        return sessionId;
    },

    async getSession(sessionId) {
        if (!sessionId) return null;
        const data = await Storage.get([`session_${sessionId}`]);
        return data[`session_${sessionId}`] || null;
    },

    async markAnswersReceived(sessionId) {
        const session = await this.getSession(sessionId);
        if (session && session.id === sessionId) {
            session.answersReceived = true;
            await Storage.set({ [`session_${sessionId}`]: session });
            return true;
        }
        return false;
    },

    async validateAndConsume(sessionId) {
        const session = await this.getSession(sessionId);
        if (!session || session.id !== sessionId) {
            return { valid: false, reason: 'Invalid session ID' };
        }

        if (Date.now() > session.expiresAt) {
            await this.clearSession(sessionId);
            return { valid: false, reason: 'Session expired' };
        }

        if (!session.answersReceived) {
            return { valid: false, reason: 'Answers not received from AI yet' };
        }

        // Invalidate session after successfully consuming it
        await this.clearSession(sessionId);
        return { valid: true };
    },

    async clearSession(sessionId) {
        if (sessionId) {
            await Storage.remove([`session_${sessionId}`]);
        }
    }
};
