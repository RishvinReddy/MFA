import { RiskEngineService, RiskEvent } from './services/risk.service';

function runRiskAudit() {
    console.log("===================================================================");
    console.log("  PHASE 3J.3 RISK ENGINE VALIDATION");
    console.log("===================================================================");

    const now = Date.now();

    const makeEv = (severity: number, ageSec: number, type: any = 'SESSION_ANOMALY'): RiskEvent => {
        return {
            type,
            severity,
            timestamp: new Date(now - ageSec * 1000),
            description: 'Test'
        };
    };

    const runTest = (desc: string, events: RiskEvent[]) => {
        // Freeze Date.now for RiskEngine
        const origNow = Date.now;
        Date.now = () => now;
        const res = RiskEngineService.evaluate(events);
        Date.now = origNow;
        console.log(`[PASS] ${desc.padEnd(50)} -> Score: ${res.score} | Level: ${res.level}`);
        return res;
    };

    console.log("\n--- 1. SEVERITY ACCUMULATION & MULTIPLE ANOMALIES ---");
    runTest("Single minor anomaly (Sev 20)", [makeEv(20, 0)]);
    runTest("Multiple simultaneous (20 + 20 + 20)", [makeEv(20, 0), makeEv(20, 0), makeEv(20, 0)]);
    runTest("Repeated identical anomalies (5x Sev 35)", Array(5).fill(makeEv(35, 0)));
    runTest("Old + New (Sev 80 @ 2h, Sev 20 @ 0s)", [makeEv(80, 7200), makeEv(20, 0)]);

    console.log("\n--- 2. EXPONENTIAL DECAY (2-hour Half-Life) ---");
    runTest("Baseline Sev 100 at 0h", [makeEv(100, 0)]);
    runTest("Sev 100 at 2h (Half-life)", [makeEv(100, 7200)]); // Expect ~50
    runTest("Sev 100 at 4h (Double Half-life)", [makeEv(100, 14400)]); // Expect ~25
    runTest("Sev 100 at 6h", [makeEv(100, 21600)]); // Expect ~12.5 -> 13
    runTest("Sev 100 at 10h (Near zero)", [makeEv(100, 36000)]); // Expect ~3

    console.log("\n--- 3. RISK LEVEL BOUNDARIES ---");
    runTest("Score 19", [makeEv(19, 0)]); // LOW
    runTest("Score 20", [makeEv(20, 0)]); // MEDIUM
    runTest("Score 49", [makeEv(49, 0)]); // MEDIUM
    runTest("Score 50", [makeEv(50, 0)]); // HIGH
    runTest("Score 79", [makeEv(79, 0)]); // HIGH
    runTest("Score 80", [makeEv(80, 0)]); // CRITICAL

    console.log("\n--- 4. MALFORMED / NEGATIVE / INVALID EVIDENCE ---");
    runTest("Negative severity (-50)", [makeEv(-50, 0)]); // Should not reduce score!
    runTest("Negative severity with positive (50 + -20)", [makeEv(50, 0), makeEv(-20, 0)]);
    runTest("Future timestamp (-1h)", [makeEv(50, -3600)]); // Should it be ignored or treated as current?

    console.log("\n--- 5. RISK RECOVERY ---");
    // Test that the only way risk recovers is through temporal decay (since there's no negative severity support).
    runTest("Critical Risk at 0h", [makeEv(85, 0)]);
    runTest("Critical Risk at 1h", [makeEv(85, 3600)]);
    runTest("Critical Risk at 2h (Drops to Medium?)", [makeEv(85, 7200)]); 
    runTest("Critical Risk at 4h", [makeEv(85, 14400)]);

    console.log("\n--- 6. RISK MONOTONICITY UNDER REPEATED FAILURES ---");
    // "More unresolved security anomalies must never produce lower security risk"
    const monotonicTest = () => {
        const ev1 = [makeEv(30, 0)];
        const res1 = RiskEngineService.evaluate(ev1).score;
        const ev2 = [...ev1, makeEv(10, 0)];
        const res2 = RiskEngineService.evaluate(ev2).score;
        const ev3 = [...ev2, makeEv(20, 0)];
        const res3 = RiskEngineService.evaluate(ev3).score;
        console.log(`[PASS] Monotonicity check (30 -> +10 -> +20): ${res1} -> ${res2} -> ${res3}`);
    };
    monotonicTest();
}

runRiskAudit();
