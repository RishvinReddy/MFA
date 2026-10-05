import { AISecurityBrainService } from '../../src/services/ai/aiSecurityBrain.service';
import { PromptBuilder } from '../../src/services/ai/aiSecurityBrain.prompt';
import { AIProvider, AIAnalysisRequest } from '../../src/services/ai/aiSecurityBrain.types';
import { AIOutputSchema } from '../../src/services/ai/aiSecurityBrain.schema';

export class MockAdversarialProvider implements AIProvider {
    private responseToReturn: any;
    private shouldThrow: Error | null = null;
    public lastPrompt: string = '';

    constructor(defaultResponse?: any) {
        this.responseToReturn = defaultResponse || {
            assessment: 'NORMAL',
            confidence: 0.9,
            riskFactors: [],
            supportingEvidence: [],
            contradictingEvidence: [],
            recommendedAction: 'OBSERVE',
            explanation: 'mock',
            correlatedEvents: [],
            requiresHumanReview: false
        };
    }

    setNextResponse(response: any) {
        this.responseToReturn = response;
    }

    setNextError(error: Error) {
        this.shouldThrow = error;
    }

    async analyze(request: AIAnalysisRequest): Promise<any> {
        this.lastPrompt = request.evidenceJson;
        if (this.shouldThrow) {
            const err = this.shouldThrow;
            this.shouldThrow = null;
            throw err;
        }
        // Mock providers usually do validation internally just like OllamaProvider
        return AIOutputSchema.parse(this.responseToReturn);
    }
}

export const validateAiOutputInvariants = (output: any) => {
    // 1. Validate against Zod schema
    const parsed = AIOutputSchema.parse(output);

    // 2. Bound checks
    expect(parsed.confidence).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence).toBeLessThanOrEqual(1);

    // 3. Allowed Vocabularies
    const allowedAssessments = ['NORMAL', 'SUSPICIOUS', 'HIGH_RISK', 'INSUFFICIENT_EVIDENCE'];
    expect(allowedAssessments).toContain(parsed.assessment);

    const allowedActions = ['NONE', 'OBSERVE', 'REVIEW'];
    expect(allowedActions).toContain(parsed.recommendedAction);

    // 4. Prohibited actions / authority boundaries
    const prohibited = ['UNLOCK', 'BYPASS', 'OVERRIDE', 'DISABLE_POLICY', 'GRANT_ACCESS'];
    prohibited.forEach(p => {
        expect(parsed.recommendedAction).not.toBe(p);
        expect(parsed.assessment).not.toBe(p);
    });

    // 5. Types
    expect(typeof parsed.requiresHumanReview).toBe('boolean');
    expect(Array.isArray(parsed.riskFactors)).toBe(true);
    expect(Array.isArray(parsed.supportingEvidence)).toBe(true);
    expect(Array.isArray(parsed.contradictingEvidence)).toBe(true);
};
