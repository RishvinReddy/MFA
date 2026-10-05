
// services/api.ts

export const API_BASE = '/api';

export interface VerifyResponse {
    success: boolean;
    data?: {
        verified: boolean;
        score: number;
        matchId: string | null;
    };
    error?: {
        message: string;
    };
}

export interface EnrollResponse {
    success: boolean;
    data?: {
        assetId: string;
        status: string;
    };
    error?: {
        message: string;
    };
}

// Helper to convert Blob/File to FormData
function createFormData(file: Blob, userId: string, modality: string): FormData {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('modality', modality);
    return formData;
}


export const api = {
    setToken: (token: string) => {
        localStorage.setItem('auth_token', token);
    },

    getToken: () => {
        return localStorage.getItem('auth_token');
    },

    register: async (data: any): Promise<any> => {
        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // data includes username, password, fullName, behavioralMetrics, deviceFingerprint
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (e) {
            return { success: false, error: { message: 'Network error' } };
        }
    },

    login: async (data: any): Promise<any> => {
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // data includes username, password, role, behavioralMetrics, deviceFingerprint
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (e) {
            return { success: false, error: { message: 'Network error' } };
        }
    },

    enroll: async (file: Blob, userId: string, modality: string): Promise<EnrollResponse> => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE}/enroll`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: createFormData(file, userId, modality)
            });
            return await res.json();
        } catch (e) {
            console.error('API Error:', e);
            return { success: false, error: { message: 'Network error' } };
        }
    },

    verify: async (file: Blob, userId: string, modality: string): Promise<VerifyResponse> => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE}/verify`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: createFormData(file, userId, modality)
            });
            return await res.json();
        } catch (e) {
            console.error('API Error:', e);
            return { success: false, error: { message: 'Network error' } };
        }
    },

    // --- ADMIN ---
    admin: {
        createUser: async (userData: any) => {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE}/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(userData)
            });
            return await res.json();
        },
        getStats: async () => {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE}/admin/stats`, {
                method: 'POST', // Using POST as per init requirements, though GET is more semantic
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            return await res.json();
        }
    },

    // --- ADVANCED AUTH ---
    webauthn: {
        registerChallenge: async () => {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE}/auth/webauthn/register/challenge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            return await res.json();
        },
        registerVerify: async (data: any) => {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE}/auth/webauthn/register/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            });
            return await res.json();
        },
        loginChallenge: async (username: string) => {
            const res = await fetch(`${API_BASE}/auth/webauthn/login/challenge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            return await res.json();
        },
        loginVerify: async (data: any, userId: string) => {
            const res = await fetch(`${API_BASE}/auth/webauthn/login/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: data, userId })
            });
            return await res.json();
        }
    },
    qr: {
        init: async () => {
            const res = await fetch(`${API_BASE}/auth/qr/init`, { method: 'POST' });
            return await res.json();
        },
        poll: async (sessionId: string) => {
            const res = await fetch(`${API_BASE}/auth/qr/poll/${sessionId}`);
            return await res.json();
        },
        approve: async (sessionId: string) => {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE}/auth/qr/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ sessionId })
            });
            return await res.json();
        }
    }
};
