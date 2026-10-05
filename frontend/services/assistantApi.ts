const BASE_URL = "http://localhost:8080";

export interface AssistantContext {
    page: string;
    stage: string;
}

export interface AssistantMessage {
    sender: 'USER' | 'AI';
    text: string;
    timestamp?: number;
}

const getHeaders = (includeAuth = true) => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (includeAuth) {
        const token = sessionStorage.getItem('accessToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const sessionId = sessionStorage.getItem('sessionId');
        if (sessionId) {
            headers['x-session-id'] = sessionId;
        }

        const enrollmentToken = sessionStorage.getItem('enrollmentToken');
        if (enrollmentToken) {
            headers['x-enrollment-token'] = enrollmentToken;
        }
    }

    return headers;
};

export const checkAssistantHealth = async () => {
    try {
        const res = await fetch(`${BASE_URL}/api/ai/health`, {
            method: 'GET',
            headers: getHeaders(false)
        });
        if (!res.ok) {
            return { status: 'UNAVAILABLE' };
        }
        return await res.json();
    } catch (e) {
        return { status: 'UNAVAILABLE' };
    }
};

export const chatWithAssistant = async (message: string, history: AssistantMessage[], pageContext: AssistantContext) => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, history, pageContext })
    });

    const data = await res.json();

    if (!res.ok) {
        const error = new Error(data.message || 'Chat failed');
        (error as any).response = { status: res.status };
        throw error;
    }

    return data;
};
