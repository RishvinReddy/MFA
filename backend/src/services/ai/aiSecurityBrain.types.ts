export interface AISecurityEvidence {
    session: {
        sessionId: string;
        ageSeconds?: number;
    };
    identity: {
        userId: string;
    };
    risk: {
        score: number;
        level: string;
        factors: string[];
    };
    trust: {
        state: string;
        previousState: string;
    };
    biometrics?: {
        modalitiesUsed: string[];
        fusionDecision?: string;
    };
    triggerEvent: string;
    timestamp: string;
}

export type AssessmentLevel = 'NORMAL' | 'SUSPICIOUS' | 'HIGH_RISK' | 'INSUFFICIENT_EVIDENCE';
export type RecommendedAction = 'NONE' | 'OBSERVE' | 'REVIEW';

export interface AIProviderResponse {
    assessment: AssessmentLevel;
    confidence: number;
    riskFactors: string[];
    supportingEvidence: string[];
    contradictingEvidence: string[];
    recommendedAction: RecommendedAction;
    explanation: string;
    correlatedEvents: string[];
    requiresHumanReview: boolean;
}

export interface AIAnalysisRequest {
    systemPrompt: string;
    evidenceJson: string;
    taskPrompt: string;
}

export interface AIProvider {
    analyze(request: AIAnalysisRequest): Promise<AIProviderResponse>;
}
