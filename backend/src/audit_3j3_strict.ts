import { RiskEngineService, RiskEvent } from './services/risk.service';
import * as assert from 'assert';

function runRiskAudit() {
    console.log("===================================================================");
    console.log("  PHASE 3J.3 RISK ENGINE VALIDATION (STRICT ASSERTIONS)");
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

    const runTest = (desc: string, events: RiskEvent[], expectedScore: number, expectedLevel: string) => {
        const origNow = Date.now;
        Date.now = () => now;
        const res = RiskEngineService.evaluate(events);
        Date.now = origNow;
        
        if (res.score !== expectedScore || res.level !== expectedLevel) {
            throw new Error(`Test Failed: ${desc} -> Got Score: ${res.score} Level: ${res.level} | Expected: ${expectedScore} ${expectedLevel}`);
        }
        
        console.log(`[PASS] ${desc.padEnd(50)} -> Score: ${res.score} | Level: ${res.level}`);
        return res;
    };

    console.log("\n--- 1. SEVERITY ACCUMULATION & MULTIPLE ANOMALIES ---");
    runTest("Single minor anomaly (Sev 20)", [makeEv(20, 0)], 20, 'MEDIUM');
    runTest("Multiple simultaneous (20 + 20 + 20)", [makeEv(20, 0), makeEv(20, 0), makeEv(20, 0)], 60, 'HIGH');
    runTest("Repeated identical anomalies (5x Sev 35)", Array(5).fill(makeEv(35, 0)), 100, 'CRITICAL');
    runTest("Old + New (Sev 80 @ 2h, Sev 20 @ 0s)", [makeEv(80, 7200), makeEv(20, 0)], 60, 'HIGH'); // 80 decays to 40, plus 20 = 60

    console.log("\n--- 2. EXPONENTIAL DECAY (2-hour Half-Life) ---");
    runTest("Baseline Sev 100 at 0h", [makeEv(100, 0)], 100, 'CRITICAL');
    runTest("Sev 100 at 2h (Half-life)", [makeEv(100, 7200)], 50, 'HIGH');
    runTest("Sev 100 at 4h (Double Half-life)", [makeEv(100, 14400)], 25, 'MEDIUM');
    runTest("Sev 100 at 6h", [makeEv(100, 21600)], 13, 'LOW');
    runTest("Sev 100 at 10h (Near zero)", [makeEv(100, 36000)], 0, 'LOW'); // Math.round(100 * 2^-5) = Math.round(3.125) = 3? Wait, earlier it was 0!
    // Ah, wait. My previous run showed 10h was 0. Let's see why: 
    // In risk.service.ts: if (timeDecay < 0.05) continue;
    // 10h / 2h = 5 half lives. 2^-5 = 0.03125.
    // 0.03125 < 0.05, so it is SKIPPED! That's why it's EXACTLY 0.
    
    console.log("\n--- 3. RISK LEVEL BOUNDARIES ---");
    runTest("Score 19", [makeEv(19, 0)], 19, 'LOW'); 
    runTest("Score 20", [makeEv(20, 0)], 20, 'MEDIUM'); 
    runTest("Score 49", [makeEv(49, 0)], 49, 'MEDIUM'); 
    runTest("Score 50", [makeEv(50, 0)], 50, 'HIGH'); 
    runTest("Score 79", [makeEv(79, 0)], 79, 'HIGH'); 
    runTest("Score 80", [makeEv(80, 0)], 80, 'CRITICAL'); 

    console.log("\n--- 4. MALFORMED / NEGATIVE / INVALID EVIDENCE ---");
    runTest("Negative severity (-50)", [makeEv(-50, 0)], 0, 'LOW'); 
    runTest("Negative severity with positive (50 + -20)", [makeEv(50, 0), makeEv(-20, 0)], 50, 'HIGH');
    runTest("Future timestamp (-1h)", [makeEv(50, -3600)], 0, 'LOW');

    console.log("\n--- 5. RISK RECOVERY ---");
    runTest("Critical Risk at 0h", [makeEv(85, 0)], 85, 'CRITICAL');
    runTest("Critical Risk at 1h", [makeEv(85, 3600)], 60, 'HIGH'); // 85 * 2^-0.5 = 60.1
    runTest("Critical Risk at 2h (Drops to Medium?)", [makeEv(85, 7200)], 43, 'MEDIUM'); // 85 * 0.5 = 42.5 -> 43
    runTest("Critical Risk at 4h", [makeEv(85, 14400)], 21, 'MEDIUM'); // 85 * 0.25 = 21.25 -> 21

    console.log("\n--- 6. RISK MONOTONICITY UNDER REPEATED FAILURES ---");
    const ev1 = [makeEv(30, 0)];
    const res1 = RiskEngineService.evaluate(ev1).score;
    const ev2 = [...ev1, makeEv(10, 0)];
    const res2 = RiskEngineService.evaluate(ev2).score;
    const ev3 = [...ev2, makeEv(20, 0)];
    const res3 = RiskEngineService.evaluate(ev3).score;
    
    assert.ok(res2 >= res1, `Expected ${res2} >= ${res1}`);
    assert.ok(res3 >= res2, `Expected ${res3} >= ${res2}`);
    
    console.log(`[PASS] Monotonicity check (30 -> +10 -> +20): ${res1} -> ${res2} -> ${res3}`);
    console.log("\nAll strict assertions passed.");
}

runRiskAudit();
