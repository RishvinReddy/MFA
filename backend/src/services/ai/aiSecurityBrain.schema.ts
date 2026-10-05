import { z } from 'zod';

export const AIOutputSchema = z.object({
    assessment: z.enum(['NORMAL', 'SUSPICIOUS', 'HIGH_RISK', 'INSUFFICIENT_EVIDENCE']),
    confidence: z.number().min(0).max(1),
    riskFactors: z.array(z.string().max(200)).max(10),
    supportingEvidence: z.array(z.string().max(200)).max(10),
    contradictingEvidence: z.array(z.string().max(200)).max(10),
    recommendedAction: z.enum(['NONE', 'OBSERVE', 'REVIEW']),
    explanation: z.string().max(1000),
    correlatedEvents: z.array(z.string().max(100)).max(5),
    requiresHumanReview: z.boolean(),
});
