const { spawnSync } = require('child_process');
const fs = require('fs');

const tests = [
    'tests/e2e-gate.test.ts', // Phase 1
    'tests/milestone2.test.ts', // Milestone 2
    'tests/adaptive-auth.test.ts',
    'tests/continuous-auth.test.ts',
    // MFA... e2e-gate handles that, or phase5
    'tests/phase5.test.ts',
    'tests/phase6.test.ts',
    'tests/phase7c.test.ts',
    'tests/phase7d.test.ts',
    'tests/phase7f.test.ts',
    'tests/phase8a.test.ts',
    'tests/phase8c.test.ts',
    'tests/phase8d.test.ts',
    'tests/phase8e.test.ts',
    'tests/phase8f.test.ts'
];

let totalPassed = 0;
let totalFailed = 0;

for (const test of tests) {
    if (!fs.existsSync(test)) continue;
    
    console.log(`Running ${test}...`);
    // For manual tests that have process.exit, we'll run them directly with ts-node
    // For Jest tests (usually Phase 8), we'll run them with jest
    const isJest = test.includes('phase7d') || test.includes('phase7f') || test.includes('phase8c') || test.includes('phase8d') || test.includes('phase8e') || test.includes('phase8f');
    
    const cmd = isJest ? 'npx.cmd' : 'npx.cmd';
    const args = isJest ? ['jest', test, '--json'] : ['ts-node', test];

    const result = spawnSync(cmd, args, { encoding: 'utf-8' });
    
    if (isJest) {
        try {
            const output = JSON.parse(result.stdout);
            const passed = output.numPassedTests;
            const failed = output.numFailedTests;
            totalPassed += passed;
            totalFailed += failed;
            console.log(`  -> Passed: ${passed}, Failed: ${failed}`);
        } catch (e) {
            console.log(`  -> Failed to parse jest output: ${result.stderr}`);
            totalFailed++;
        }
    } else {
        // extract 'Passed: X | Failed: Y' or similar
        const stdout = result.stdout || '';
        const match = stdout.match(/Passed:\s*(\d+).*Failed:\s*(\d+)/i) || stdout.match(/(\d+)\s*Passed,\s*(\d+)\s*Failed/i);
        if (match) {
            totalPassed += parseInt(match[1], 10);
            totalFailed += parseInt(match[2], 10);
            console.log(`  -> Passed: ${match[1]}, Failed: ${match[2]}`);
        } else {
            console.log(`  -> Output didn't match expected pattern. Exit code: ${result.status}`);
            console.log(result.stdout || result.stderr);
        }
    }
}

console.log(`\n=========================================`);
console.log(`FINAL RESULTS:`);
console.log(`TOTAL EXECUTED: ${totalPassed + totalFailed}`);
console.log(`TOTAL PASSED: ${totalPassed}`);
console.log(`TOTAL FAILED: ${totalFailed}`);
console.log(`=========================================\n`);
