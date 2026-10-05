export interface RiskFactor {
    description: string;
    contribution: number;
}

export interface RiskResult {
    score: number;      // 0 to 100
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: RiskFactor[];
    calculatedAt: string;
}

export interface RiskEvent {
    type: 'AUTH_FAILURE' | 'BIOMETRIC_FAILURE' | 'SESSION_ANOMALY' | 'SECURITY_EVENT' | 'ACCOUNT_STATE';
    severity: number; // 0 to 100
    timestamp: Date;
    description: string;
}

export class RiskEngineService {
    
    // Half-life for temporal decay in hours. e.g., 2 hours means after 2 hours the risk is halved.
    private static readonly DECAY_HALF_LIFE_HOURS = 2; 

    /**
     * Evaluates a series of risk events and computes an aggregated, time-decayed risk score.
     */
    static evaluate(events: RiskEvent[]): RiskResult {
        const factors: RiskFactor[] = [];
        let totalScore = 0;
        const now = Date.now();

        for (const event of events) {
            const ageHours = (now - event.timestamp.getTime()) / (1000 * 60 * 60);
            
            // Skip future events
            if (ageHours < 0) continue;

            // Exponential decay: e^(-lambda * t), where lambda = ln(2) / half_life
            const lambda = Math.LN2 / this.DECAY_HALF_LIFE_HOURS;
            const timeDecay = Math.exp(-lambda * ageHours);
            
            // Very old events (e.g. decayed to < 5%) are excluded to save space
            if (timeDecay < 0.05) continue;

            const contribution = Math.round(event.severity * timeDecay);
            
            if (contribution > 0) {
                totalScore += contribution;
                factors.push({
                    description: `[${timeDecay < 0.9 ? 'Historical' : 'Recent'}] ${event.description}`,
                    contribution
                });
            }
        }

        // Cap score at 100
        totalScore = Math.min(100, totalScore);

        // Map numeric score to ordinal level
        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (totalScore >= 80) {
            level = 'CRITICAL';
        } else if (totalScore >= 50) {
            level = 'HIGH';
        } else if (totalScore >= 20) {
            level = 'MEDIUM';
        }

        return {
            score: totalScore,
            level,
            factors,
            calculatedAt: new Date().toISOString()
        };
    }
}
