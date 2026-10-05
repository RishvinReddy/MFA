import { stepUpService } from './stepUpService';

const BASE_URL = "http://localhost:8080/api";

export async function fetchWithStepUp(url: string, options: any = {}, reason: string = "Perform administrative action"): Promise<Response> {
    const token = sessionStorage.getItem("accessToken");
    const sessionId = sessionStorage.getItem("sessionId");
    const headers = new Headers(options.headers || {});
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (sessionId && !headers.has('x-session-id')) {
        headers.set('x-session-id', sessionId);
    }
    
    const finalOptions = {
        ...options,
        headers
    };

    const res = await fetch(url, finalOptions);
    if (res.status === 403) {
        const clone = res.clone();
        const data = await clone.json().catch(() => ({}));
        if (data.action === 'STEP_UP_REQUIRED') {
            const success = await stepUpService.requestStepUp(reason);
            if (success) {
                // Retry request
                return fetch(url, finalOptions);
            } else {
                throw new Error("Step-up authentication failed or cancelled");
            }
        } else if (data.action === 'RESTRICT' || data.action === 'LOCK' || data.action === 'RESTRICTED' || data.action === 'LOCKED') {
            throw new Error(`Action restricted by security policy: ${data.action}`);
        }
    }
    return res;
}

export const vaultApi = {
    async decryptDocument(documentId: string) {
        const token = sessionStorage.getItem("accessToken");
        const res = await fetchWithStepUp(`${BASE_URL}/vault/decrypt`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ documentId })
        }, "Access Secure Vault Documents");

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || data.message || 'Failed to decrypt vault document');
        }

        return data;
    }
};
