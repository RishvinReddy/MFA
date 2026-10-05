import { AIProvider, AIAnalysisRequest, AIProviderResponse } from './aiSecurityBrain.types';

export class MockAIProvider implements AIProvider {
    async analyze(request: AIAnalysisRequest): Promise<AIProviderResponse> {
        throw new Error("AI_PROVIDER_UNAVAILABLE");
    }
}
