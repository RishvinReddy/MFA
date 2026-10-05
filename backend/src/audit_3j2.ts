import { FusionEngineService } from './services/fusion.service';
import { RiskEngineService, RiskEvent } from './services/risk.service';
import { ConfigService } from './services/config.service';
import { TrustEngineService, TrustState } from './services/trust.service';
import { NormalizedEvidence } from './types/evidence';
import { EvidenceCalibrator } from './services/calibration.service';

async function runAudit() {
    // 1. Monkeypatch Config to avoid DB calls
    ConfigService.getFusionConfig = async () => ({
        weights: { face: 0.6, voice: 0.4, keyboardBehavior: 0, mouseBehavior: 0 },
        minimumQuality: { face: 40, voice: 60 },
        evidenceTTL: { face: 300, voice: 300, behavior: 300 },
        confidenceThresholds: { low: 0.4, medium: 0.75, high: 0.85 },
        configurationVersion: 1,
        updatedAt: new Date()
    } as any);

    // 2. Monkeypatch Trust logging to avoid DB calls
    (TrustEngineService as any).logTrustEvent = async () => {};

    const now = Date.now();
    console.log("===================================================================");
    console.log("  PHASE 3J.2 TEMPORAL/FRESHNESS AUDIT (Executing Production Code)");
    console.log("===================================================================");

    const baseEvidence = (ageSec: number, ttlSec: number, quality = 100, confidence = 1.0, isSpoofed = false, status: any = 'PASS'): NormalizedEvidence => {
        const timestamp = new Date(now - ageSec * 1000).toISOString();
        const expiresAt = new Date(now - ageSec * 1000 + ttlSec * 1000).toISOString();
        return {
            modality: 'FACE',
            category: 'HUMAN',
            status,
            confidence,
            quality,
            liveness: 0.95,
            isSpoofed,
            isContradictory: false,
            timestamp,
            expiresAt,
            metadata: { antiSpoof: true, livenessScore: 0.95 },
            source: 'TEST',
            modelVersion: '1.0'
        };
    };

    console.log("\n--- 1. FRESHNESS DECAY (FUSION) ---");
    const testFreshness = async (desc: string, ageSec: number, ttlSec: number) => {
        const e = baseEvidence(ageSec, ttlSec);
        // Force the now timestamp inside FusionEngineService to match our 'now' reference
        const origNow = Date.now;
        Date.now = () => now;
        const result = await FusionEngineService.evaluate([e]);
        Date.now = origNow;
        console.log(`[Test] ${desc.padEnd(40)} -> Human Confidence: ${result.humanConfidence.toFixed(4)} | Fusion Decision: ${result.decision}`);
    };

    await testFreshness("Fresh evidence (0s old, 300s TTL)", 0, 300);
    await testFreshness("Aging evidence (150s old, 300s TTL)", 150, 300);
    await testFreshness("Almost stale (299s old, 300s TTL)", 299, 300);
    await testFreshness("Stale evidence (301s old, 300s TTL)", 301, 300);
    await testFreshness("Future timestamp (-50s old)", -50, 300);

    console.log("\n--- 2. RISK TEMPORAL DECAY ---");
    const testRisk = (desc: string, events: RiskEvent[]) => {
        const origNow = Date.now;
        Date.now = () => now;
        const result = RiskEngineService.evaluate(events);
        Date.now = origNow;
        console.log(`[Test] ${desc.padEnd(40)} -> Risk Score: ${result.score} | Level: ${result.level}`);
    };

    testRisk("Recent heartbeat miss (Sev 85, now)", [{ type: 'SESSION_ANOMALY', severity: 85, timestamp: new Date(now), description: 'Miss' }]);
    testRisk("Old heartbeat miss (Sev 85, 2h ago)", [{ type: 'SESSION_ANOMALY', severity: 85, timestamp: new Date(now - 7200 * 1000), description: 'Miss' }]);
    testRisk("Very old heartbeat (Sev 85, 10h ago)", [{ type: 'SESSION_ANOMALY', severity: 85, timestamp: new Date(now - 36000 * 1000), description: 'Miss' }]);
    testRisk("Repeated minor anomalies (5x Sev 35, now)", Array(5).fill(0).map(() => ({ type: 'SESSION_ANOMALY', severity: 35, timestamp: new Date(now), description: 'Miss' })));

    console.log("\n--- 3. END-TO-END TEMPORAL BEHAVIOR ---");
    const runSequence = async (name: string, sequence: { elapsedSec: number, evidenceAgeSec?: number }[]) => {
        console.log(`\nSequence: ${name}`);
        let currentState: TrustState = 'TRUSTED';
        const riskEvents: RiskEvent[] = [];
        let timeOffset = 0;

        for (const step of sequence) {
            timeOffset += step.elapsedSec;
            const stepNow = new Date(now + timeOffset * 1000);
            
            if (step.elapsedSec >= 150) {
                riskEvents.push({ type: 'SESSION_ANOMALY', severity: 85, timestamp: stepNow, description: 'Heartbeat abandoned' });
            } else if (step.elapsedSec >= 75) {
                riskEvents.push({ type: 'SESSION_ANOMALY', severity: 55, timestamp: stepNow, description: 'Stale heartbeat' });
            } else if (step.elapsedSec >= 36) {
                riskEvents.push({ type: 'SESSION_ANOMALY', severity: 35, timestamp: stepNow, description: 'Delayed heartbeat' });
            }

            const evList: NormalizedEvidence[] = [];
            if (step.evidenceAgeSec !== undefined) {
                const timestamp = new Date(stepNow.getTime() - step.evidenceAgeSec * 1000).toISOString();
                const expiresAt = new Date(stepNow.getTime() - step.evidenceAgeSec * 1000 + 300 * 1000).toISOString();
                evList.push({
                    modality: 'FACE',
                    category: 'HUMAN',
                    status: 'PASS',
                    confidence: 1.0,
                    quality: 100,
                    liveness: 0.95,
                    isSpoofed: false,
                    isContradictory: false,
                    timestamp,
                    expiresAt,
                    metadata: { antiSpoof: true, livenessScore: 0.95 },
                    source: 'TEST',
                    modelVersion: '1.0'
                });
            }
            
            const origNow = Date.now;
            Date.now = () => stepNow.getTime();
            const fusionRes = await FusionEngineService.evaluate(evList);
            const riskRes = RiskEngineService.evaluate(riskEvents);
            Date.now = origNow;

            const trustRes = await TrustEngineService.evaluate({
                fusion: fusionRes,
                risk: riskRes,
                previousState: currentState,
                userId: 'test',
                sessionId: 'test'
            });

            console.log(`  +${step.elapsedSec}s -> Risk: ${riskRes.score} | Fusion: ${fusionRes.decision} (Conf: ${fusionRes.humanConfidence.toFixed(2)}) | Trust: ${currentState} -> ${trustRes.state}`);
            currentState = trustRes.state;
        }
    }

    await runSequence("Normal Heartbeat (30s)", [
        { elapsedSec: 30, evidenceAgeSec: 0 },
        { elapsedSec: 30, evidenceAgeSec: 0 },
        { elapsedSec: 30, evidenceAgeSec: 0 },
    ]);

    await runSequence("Delayed Heartbeats (36s) - Minor Anomaly Accumulation", [
        { elapsedSec: 36, evidenceAgeSec: 0 }, // Sev 35 -> Risk 35
        { elapsedSec: 36, evidenceAgeSec: 0 }, // Sev 35 + 35 -> Risk 70 -> RESTRICTED
        { elapsedSec: 36, evidenceAgeSec: 0 }, // -> Risk 100 -> LOCKED
    ]);

    await runSequence("Abandoned Heartbeat (150s) then recovery attempt", [
        { elapsedSec: 150 }, // Sev 85 -> LOCKED
        { elapsedSec: 10, evidenceAgeSec: 0 }, // Fresh evidence arriving late (Risk still high)
    ]);
    
    await runSequence("Out of order / delayed evidence (30s)", [
        { elapsedSec: 30, evidenceAgeSec: 0 }, // Normal
        { elapsedSec: 30, evidenceAgeSec: 250 }, // Very old evidence arrives
    ]);

    console.log("\nDone.");
}

runAudit().catch(console.error);
