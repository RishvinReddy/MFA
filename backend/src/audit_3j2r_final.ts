import { FusionEngineService, FusionResult } from './services/fusion.service';
import { RiskEngineService } from './services/risk.service';
import { ConfigService } from './services/config.service';
import { TrustEngineService, TrustState } from './services/trust.service';
import { NormalizedEvidence } from './types/evidence';

async function runRegression() {
    // Monkeypatch Config
    ConfigService.getFusionConfig = async () => ({
        weights: { face: 0.6, voice: 0.4, keyboardBehavior: 0, mouseBehavior: 0 },
        minimumQuality: { face: 40, voice: 60 },
        evidenceTTL: { face: 300, voice: 300, behavior: 300 },
        confidenceThresholds: { low: 0.4, medium: 0.75, high: 0.85 },
        configurationVersion: 1,
        updatedAt: new Date()
    } as any);

    (TrustEngineService as any).logTrustEvent = async () => {};

    const now = Date.now();

    const makeEv = (modality: 'FACE'|'VOICE', ageSec: number, quality = 100, confidence = 1.0): NormalizedEvidence => {
        const timestamp = new Date(now - ageSec * 1000).toISOString();
        const expiresAt = new Date(now - ageSec * 1000 + 300 * 1000).toISOString();
        return {
            modality,
            category: 'HUMAN',
            status: 'PASS',
            confidence,
            quality,
            liveness: 0.95,
            isSpoofed: false,
            isContradictory: false,
            timestamp,
            expiresAt,
            metadata: { antiSpoof: true, livenessScore: 0.95 },
            source: 'TEST',
            modelVersion: '1.0'
        };
    };

    console.log("===================================================================");
    console.log("  3J.2R.3 FINAL REGRESSION AGAINST UPDATED PRODUCTION LOGIC");
    console.log("===================================================================");

    const runTest = async (desc: string, evs: NormalizedEvidence[], expectedDecision: string) => {
        const origNow = Date.now;
        Date.now = () => now;
        const result = await FusionEngineService.evaluate(evs);
        Date.now = origNow;
        
        const matched = result.decision === expectedDecision;
        const status = matched ? 'PASS' : 'FAIL';
        console.log(`[${status}] ${desc.padEnd(40)} -> Got: ${result.decision.padEnd(25)} (Expected: ${expectedDecision})`);
        if (!matched) {
            console.log(`         Identity Confidence: ${result.identityConfidence}`);
        }
    };

    console.log("\n--- SINGLE MODALITY REGRESSIONS ---");
    await runTest("Fresh face (0s)", [makeEv('FACE', 0)], 'MATCH');
    await runTest("50% TTL face (150s)", [makeEv('FACE', 150)], 'MATCH'); 
    await runTest("299s face (near stale)", [makeEv('FACE', 299)], 'INSUFFICIENT_EVIDENCE'); 
    await runTest("301s face (expired)", [makeEv('FACE', 301)], 'INSUFFICIENT_EVIDENCE');
    
    await runTest("Fresh voice (0s)", [makeEv('VOICE', 0)], 'MATCH'); 
    await runTest("50% TTL voice (150s)", [makeEv('VOICE', 150)], 'MATCH'); 
    await runTest("299s voice (near stale)", [makeEv('VOICE', 299)], 'INSUFFICIENT_EVIDENCE');

    console.log("\n--- TEMPORAL EXPLOIT FIXES ---");
    await runTest("Future timestamp +1s", [makeEv('FACE', -1)], 'INSUFFICIENT_EVIDENCE');
    await runTest("Future timestamp +10h", [makeEv('FACE', -36000)], 'INSUFFICIENT_EVIDENCE');

    console.log("\n--- MULTI-MODALITY / OUT-OF-ORDER REGRESSIONS ---");
    await runTest("Normal fresh Face + Voice", [makeEv('FACE', 0, 100, 0.9), makeEv('VOICE', 0, 100, 0.9)], 'MATCH');
    await runTest("Stale Face(0.2) + Fresh Voice(0.9)", [makeEv('FACE', 299, 100, 0.2), makeEv('VOICE', 0, 100, 0.9)], 'MATCH');
    await runTest("Fresh Face(0.9) + Old Face(0.2, 100s)", [makeEv('FACE', 0, 100, 0.9), makeEv('FACE', 100, 100, 0.2)], 'LOW_CONFIDENCE');

    console.log("\n--- TRUST STATE REGRESSIONS ---");
    const riskL = RiskEngineService.evaluate([{ type: 'SESSION_ANOMALY', severity: 85, timestamp: new Date(now), description: 'Lock' }]);
    const evF = [makeEv('FACE', -50)]; 
    const fusF = await FusionEngineService.evaluate(evF);
    const trF = await TrustEngineService.evaluate({ fusion: fusF, risk: riskL, previousState: 'LOCKED', userId: 'test', sessionId: 'test' });
    console.log(`[${trF.state === 'LOCKED' ? 'PASS' : 'FAIL'}] Locked + future evidence -> ${trF.state}`);

    const riskN = RiskEngineService.evaluate([]);
    const evN = [makeEv('FACE', 0, 100, 1.0)];
    const fusN = await FusionEngineService.evaluate(evN);
    const trN = await TrustEngineService.evaluate({ fusion: fusN, risk: riskN, previousState: 'CHALLENGE', userId: 'test', sessionId: 'test' });
    console.log(`[${trN.state === 'TRUSTED' ? 'PASS' : 'FAIL'}] Normal fresh evidence after CHALLENGE -> ${trN.state}`);
}

runRegression().catch(console.error);
