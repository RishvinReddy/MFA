import { FusionEngineService } from './services/fusion.service';
import { ConfigService } from './services/config.service';
import { NormalizedEvidence } from './types/evidence';

async function runBoundaryAudit() {
    ConfigService.getFusionConfig = async () => ({
        weights: { face: 0.6, voice: 0.4, keyboardBehavior: 0, mouseBehavior: 0 },
        minimumQuality: { face: 40, voice: 60 },
        evidenceTTL: { face: 300, voice: 300, behavior: 300 },
        confidenceThresholds: { low: 0.4, medium: 0.75, high: 0.85 },
        configurationVersion: 1,
        updatedAt: new Date()
    } as any);

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
    console.log("  3J.2R.4 BOUNDARY & INVARIANT AUDIT");
    console.log("===================================================================");

    const runTest = async (desc: string, evs: NormalizedEvidence[], expectedDecision: string) => {
        const origNow = Date.now;
        Date.now = () => now;
        const result = await FusionEngineService.evaluate(evs);
        Date.now = origNow;
        
        const matched = result.decision === expectedDecision;
        const status = matched ? 'PASS' : 'FAIL';
        console.log(`[${status}] ${desc.padEnd(40)} -> Got: ${result.decision.padEnd(25)} (Expected: ${expectedDecision})`);
        return result;
    };

    // Calculate exact ages for boundary testing
    // Denominator = weight * (quality/100) * freshness
    // Freshness = 1 - (age / 300)
    // We want Denom = 0.20
    
    // FACE: weight = 0.6, quality = 100
    // Denom = 0.6 * freshness
    // 0.20 = 0.6 * freshness -> freshness = 0.333333
    // age / 300 = 1 - 0.333333 = 0.666666 -> age = 200s
    // age 200s -> freshness = 1 - 200/300 = 0.333333 -> Denom = 0.6 * 0.333333 = 0.20 (eligible)
    // age 201s -> freshness = 1 - 201/300 = 0.330000 -> Denom = 0.6 * 0.330000 = 0.198 (ineligible)
    
    // VOICE: weight = 0.4, quality = 100
    // Denom = 0.4 * freshness
    // 0.20 = 0.4 * freshness -> freshness = 0.50
    // age / 300 = 1 - 0.50 = 0.50 -> age = 150s
    // age 150s -> freshness = 1 - 150/300 = 0.50 -> Denom = 0.4 * 0.50 = 0.20 (eligible)
    // age 151s -> freshness = 1 - 151/300 = 0.49666 -> Denom = 0.4 * 0.49666 = 0.19866 (ineligible)

    console.log("\n--- EXACT MASS BOUNDARIES ---");
    await runTest("Face at exactly 0.20 mass (age 200s)", [makeEv('FACE', 200)], 'MATCH');
    await runTest("Face at 0.198 mass (age 201s)", [makeEv('FACE', 201)], 'INSUFFICIENT_EVIDENCE');
    
    await runTest("Voice at exactly 0.20 mass (age 150s)", [makeEv('VOICE', 150)], 'MATCH');
    await runTest("Voice at 0.198 mass (age 151s)", [makeEv('VOICE', 151)], 'INSUFFICIENT_EVIDENCE');

    console.log("\n--- COMBINATION INVARIANTS ---");
    const freshFace = makeEv('FACE', 0);
    const freshVoice = makeEv('VOICE', 0);
    const staleFace = makeEv('FACE', 201); // 0.198 mass
    const staleVoice = makeEv('VOICE', 151); // 0.198 mass
    
    const freshFaceRes = await runTest("Baseline: Fresh Face ONLY", [freshFace], 'MATCH');
    const freshVoiceRes = await runTest("Baseline: Fresh Voice ONLY", [freshVoice], 'MATCH');

    const sfFvRes = await runTest("Stale Face (201s) + Fresh Voice", [staleFace, freshVoice], 'MATCH');
    console.log(`         Baseline Conf: ${freshVoiceRes.identityConfidence.toFixed(4)} | Combined Conf: ${sfFvRes.identityConfidence.toFixed(4)}`);
    
    const ffSvRes = await runTest("Fresh Face + Stale Voice (151s)", [freshFace, staleVoice], 'MATCH');
    console.log(`         Baseline Conf: ${freshFaceRes.identityConfidence.toFixed(4)} | Combined Conf: ${ffSvRes.identityConfidence.toFixed(4)}`);

    const twoStaleRes = await runTest("Two Stale Faces (201s + 201s)", [staleFace, staleFace], 'MATCH'); // Wait, 0.198 + 0.198 = 0.396 > 0.20!
    console.log(`         Combined Denom crosses 0.20? Conf: ${twoStaleRes.identityConfidence.toFixed(4)}`);

    const svSvRes = await runTest("Two Stale Voices (151s + 151s)", [staleVoice, staleVoice], 'MATCH'); // 0.198 + 0.198 = 0.396 > 0.20!
    console.log(`         Combined Denom crosses 0.20? Conf: ${svSvRes.identityConfidence.toFixed(4)}`);

    const sfSvRes = await runTest("Stale Face (201s) + Stale Voice (151s)", [staleFace, staleVoice], 'MATCH'); // 0.198 + 0.198 = 0.396 > 0.20!
    console.log(`         Combined Denom crosses 0.20? Conf: ${sfSvRes.identityConfidence.toFixed(4)}`);

}

runBoundaryAudit().catch(console.error);
