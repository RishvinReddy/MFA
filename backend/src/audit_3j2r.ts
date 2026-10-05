import { FusionEngineService, FusionResult } from './services/fusion.service';
import { RiskEngineService } from './services/risk.service';
import { ConfigService } from './services/config.service';
import { TrustEngineService, TrustState } from './services/trust.service';
import { NormalizedEvidence } from './types/evidence';
import { EvidenceCalibrator } from './services/calibration.service';

async function runRegression() {
    // 1. Monkeypatch Config
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
    
    // --- TEMPORARY REMEDIATION MOCK IN FUSION ENGINE ---
    // We'll monkeypatch evaluate to test the proposed fixes without editing the file yet.
    const originalEvaluate = FusionEngineService.evaluate.bind(FusionEngineService);
    FusionEngineService.evaluate = async (evidences: NormalizedEvidence[]): Promise<FusionResult> => {
        // Apply Pre-filters (Gap 2 Fix)
        const validEvidences = evidences.filter(e => {
            const timestampMs = new Date(e.timestamp).getTime();
            if (timestampMs > now) {
                // Reject future timestamps
                return false;
            }
            return true;
        });

        const res = await originalEvaluate(validEvidences);

        // Apply Eligibility Fix (Gap 1 Fix)
        // We know face min quality is 40, voice is 60.
        // Face min weight contribution = 0.6 * 0.40 * 1.0 = 0.24
        // If humanDenominator (the accumulated weight) is too low, we mark as INSUFFICIENT_EVIDENCE.
        // We need humanDenominator. It's not exposed in FusionResult. We can infer it or recalculate.
        // Actually, let's recalculate it to be precise.
        let humanDenominator = 0;
        for (const e of validEvidences) {
            if (e.category === 'HUMAN' && e.status !== 'FAIL' && !e.isContradictory && !e.isSpoofed) {
                const ts = new Date(e.timestamp).getTime();
                const exp = new Date(e.expiresAt).getTime();
                if (ts <= now && now <= exp) {
                    let freshness = 1.0 - ((now - ts) / (exp - ts));
                    if (freshness < 0) freshness = 0;
                    if (freshness > 1) freshness = 1;
                    const w = e.modality === 'FACE' ? 0.6 : 0.4;
                    const minQ = e.modality === 'FACE' ? 40 : 60;
                    if (e.quality >= minQ) {
                        humanDenominator += w * (e.quality / 100.0) * freshness;
                    }
                }
            }
        }

        // If human evidence mass is too low (e.g. < 0.20), it's insufficient to grant a MATCH
        if (humanDenominator > 0 && humanDenominator < 0.20) {
            res.decision = 'INSUFFICIENT_EVIDENCE';
            res.identityConfidence = 0.0;
            res.assuranceLevel = 'LOW';
        }

        return res;
    };


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
    console.log("  3J.2R.1 REMEDIATION DESIGN & REGRESSION VALIDATION");
    console.log("===================================================================");

    const runTest = async (desc: string, evs: NormalizedEvidence[], expectMatch: boolean) => {
        // Freeze Date.now inside evaluation
        const origNow = Date.now;
        Date.now = () => now;
        const result = await FusionEngineService.evaluate(evs);
        Date.now = origNow;
        
        const matched = expectMatch ? (result.decision === 'MATCH') : (result.decision !== 'MATCH');
        const status = matched ? 'PASS' : 'FAIL';
        console.log(`[${status}] ${desc.padEnd(40)} -> Decision: ${result.decision.padEnd(25)} (Conf: ${result.identityConfidence.toFixed(4)})`);
    };

    console.log("\n--- SINGLE MODALITY REGRESSIONS ---");
    await runTest("Fresh face (0s)", [makeEv('FACE', 0)], true);
    await runTest("50% TTL face (150s)", [makeEv('FACE', 150)], true); // Freshness 0.5, denom = 0.6 * 1.0 * 0.5 = 0.30 > 0.20
    await runTest("299s face (near stale)", [makeEv('FACE', 299)], false); // Freshness 0.003, denom = 0.6 * 0.003 = 0.0018 < 0.20 -> INSUFFICIENT
    await runTest("301s face (expired)", [makeEv('FACE', 301)], false);
    
    await runTest("Fresh voice (0s)", [makeEv('VOICE', 0)], true); // denom = 0.4 * 1.0 * 1.0 = 0.40
    await runTest("50% TTL voice (150s)", [makeEv('VOICE', 150)], true); // denom = 0.4 * 0.5 = 0.20 >= 0.20 (Wait, exactly 0.20)
    await runTest("299s voice (near stale)", [makeEv('VOICE', 299)], false);

    console.log("\n--- TEMPORAL EXPLOIT FIXES ---");
    await runTest("Future timestamp +1s", [makeEv('FACE', -1)], false);
    await runTest("Future timestamp +10h", [makeEv('FACE', -36000)], false);

    console.log("\n--- MULTI-MODALITY / OUT-OF-ORDER REGRESSIONS ---");
    // Normal fresh face and voice
    await runTest("Normal fresh Face + Voice", [makeEv('FACE', 0, 100, 0.9), makeEv('VOICE', 0, 100, 0.9)], true);
    
    // One stale (face) + one fresh (voice)
    // Face is 299s old (weight ~0), Voice is fresh (weight 0.4). Total denom = 0.4018 > 0.20, so MATCH.
    // Face confidence 0.2 (bad), Voice 0.9 (good).
    // The stale face shouldn't drag down the voice too much because its weight is effectively 0.
    await runTest("Stale Face(0.2) + Fresh Voice(0.9)", [makeEv('FACE', 299, 100, 0.2), makeEv('VOICE', 0, 100, 0.9)], true);

    // Old frame arriving after newer frame
    // This is essentially just both being processed. The older frame has less weight.
    await runTest("Fresh Face(0.9) + Old Face(0.2, 100s)", [makeEv('FACE', 0, 100, 0.9), makeEv('FACE', 100, 100, 0.2)], true);

    console.log("\n--- TRUST STATE REGRESSIONS ---");
    // Locked + future evidence
    const riskL = RiskEngineService.evaluate([{ type: 'SESSION_ANOMALY', severity: 85, timestamp: new Date(now), description: 'Lock' }]);
    const evF = [makeEv('FACE', -50)]; // Future evidence (should be rejected)
    const fusF = await FusionEngineService.evaluate(evF);
    const trF = await TrustEngineService.evaluate({ fusion: fusF, risk: riskL, previousState: 'LOCKED', userId: 'test', sessionId: 'test' });
    console.log(`[${trF.state === 'LOCKED' ? 'PASS' : 'FAIL'}] Locked + future evidence -> ${trF.state}`);

    // Normal fresh evidence after degradation
    const riskN = RiskEngineService.evaluate([]); // Risk 0
    const evN = [makeEv('FACE', 0, 100, 1.0)];
    const fusN = await FusionEngineService.evaluate(evN);
    const trN = await TrustEngineService.evaluate({ fusion: fusN, risk: riskN, previousState: 'CHALLENGE', userId: 'test', sessionId: 'test' });
    console.log(`[${trN.state === 'TRUSTED' ? 'PASS' : 'FAIL'}] Normal fresh evidence after CHALLENGE -> ${trN.state}`);
}

runRegression().catch(console.error);
