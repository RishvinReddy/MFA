export interface User {
    id: string;
    username: string;
    password_hash: string;
    full_name: string;
    role: 'USER' | 'ADMIN' | 'AUDITOR';
    status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
    created_at: Date;
    created_by?: string;
}

export interface LoginAttempt {
    id: number;
    user_id?: string;
    email?: string;
    ip_address: string;
    user_agent?: string;
    success: boolean;
    timestamp: Date;
}

export interface TrustedDevice {
    id: string;
    user_id: string;
    device_hash: string;
    device_name?: string;
    last_used_at: Date;
    created_at: Date;
    is_revoked: boolean;
}

export interface RefreshToken {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    created_at: Date;
    revoked: boolean;
    replaced_by_token_id?: string;
}

export interface Authenticator {
    credential_id: string;
    credential_public_key: Buffer;
    counter: number;
    credential_device_type: string;
    credential_backed_up: boolean;
    transports?: string;
    user_id: string;
    created_at: Date;
}


export interface BehavioralMetrics {
    typingVariance: number;
    mousePathEfficiency: number;
    interactionTime: number;
    keystrokes?: { key: string; dwell: number; flight: number }[];
    mouseEvents?: { x: number; y: number; time: number }[];
}

// Request extension to include user
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
