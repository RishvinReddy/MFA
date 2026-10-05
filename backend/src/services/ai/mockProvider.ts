import { AIProvider, AIAnalysisRequest, AIProviderResponse } from './aiSecurityBrain.types';

export class MockAIProvider implements AIProvider {
    async analyze(request: AIAnalysisRequest): Promise<AIProviderResponse> {
        if (request.evidenceJson === 'invalid json') {
            throw new Error("AI_INVALID_RESPONSE");
        }
        throw new Error("AI_PROVIDER_UNAVAILABLE");
    }
}
