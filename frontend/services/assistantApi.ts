import api from './api';

export interface AssistantContext {
    page: string;
    stage: string;
}

export interface AssistantMessage {
    sender: 'USER' | 'AI';
    text: string;
    timestamp?: number;
}

export const checkAssistantHealth = async () => {
    try {
        const res = await api.get('/ai/health');
        return res.data;
    } catch (e) {
        return { status: 'UNAVAILABLE' };
    }
};

export const chatWithAssistant = async (message: string, history: AssistantMessage[], pageContext: AssistantContext) => {
    const res = await api.post('/ai/chat', {
        message,
        history,
        pageContext
    });
    return res.data;
};
