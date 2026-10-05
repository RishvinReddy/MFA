import { fetchWithStepUp } from './vaultApi';

const API_BASE = '/api/admin';

export interface OverviewMetrics {
    totalUsers: number;
    activeSessions: number;
    disabledAccounts: number;
    highRiskEvents: number;
    unresolvedSecurityEvents: number;
}

export interface UserDTO {
    id: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    isActive: boolean;
    mfaEnabled: boolean;
    isDisabled?: boolean;
}

export interface SessionDTO {
    id: string;
    userId: string;
    status: string;
    riskLevel: string;
    trustState: string;
    ipAddress: string;
    device: string;
    updatedAt: string;
    user?: { email: string, role?: string };
    riskScore?: number;
    isActive?: boolean;
    createdAt?: string;
}

export interface AuditLogDTO {
    id: string;
    userId: string;
    action: string;
    metadata: any;
    ipAddress: string;
    createdAt: string;
    user?: { email: string };
}

export const adminApi = {
    getOverview: async (): Promise<OverviewMetrics> => {
        const res = await fetchWithStepUp(`${API_BASE}/overview`);
        if (!res.ok) throw new Error('Failed to fetch overview metrics');
        return res.json();
    },

    getUsers: async (): Promise<{ success: boolean; data: UserDTO[] }> => {
        const res = await fetchWithStepUp(`${API_BASE}/users`);
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },

    getSessions: async (): Promise<{ success: boolean; data: SessionDTO[] }> => {
        const res = await fetchWithStepUp(`${API_BASE}/sessions`);
        if (!res.ok) throw new Error('Failed to fetch sessions');
        return res.json();
    },

    getAuditLogs: async (): Promise<{ success: boolean; data: AuditLogDTO[] }> => {
        const res = await fetchWithStepUp(`${API_BASE}/audit`);
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        return res.json();
    },

    // Privileged mutations
    revokeSession: async (sessionId: string): Promise<void> => {
        const res = await fetchWithStepUp(`${API_BASE}/session/${sessionId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to revoke session');
    },

    disableUser: async (userId: string, isActive: boolean = false): Promise<void> => {
        const res = await fetchWithStepUp(`${API_BASE}/user/${userId}/disable`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive })
        });
        if (!res.ok) throw new Error(`Failed to ${isActive ? 'enable' : 'disable'} user`);
    },

    enableUser: async (userId: string): Promise<void> => {
        return adminApi.disableUser(userId, true);
    },

    createUser: async (email: string, role: string, fullName: string, password?: string): Promise<{ success: boolean; data: { id: string; email: string; [key: string]: any }; enrollmentToken: string }> => {
        const res = await fetchWithStepUp(`${API_BASE}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role, fullName, password })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Failed to create user' }));
            throw new Error(err.message || 'Failed to create user');
        }
        return res.json();
    },

    forceLogout: async (userId: string): Promise<void> => {
        const res = await fetchWithStepUp(`${API_BASE}/user/${userId}/force-logout`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to force logout user');
    },

    resetMfa: async (userId: string): Promise<void> => {
        const res = await fetchWithStepUp(`${API_BASE}/user/${userId}/reset-mfa`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to reset MFA');
    }
};
