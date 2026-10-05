const { execSync } = require('child_process');

module.exports = async () => {
    if (global.__BIOMETRIC_SERVICE_PID__) {
        console.log(`\n[Jest Global Teardown] Terminating Biometric Test Service (PID: ${global.__BIOMETRIC_SERVICE_PID__})...`);
        try {
            // Force kill the process tree in Windows
            execSync(`taskkill /pid ${global.__BIOMETRIC_SERVICE_PID__} /T /F`, { stdio: 'ignore' });
            console.log('[Jest Global Teardown] Biometric Test Service terminated successfully.');
        } catch (error) {
            console.error('[Jest Global Teardown] Failed to terminate Biometric Test Service:', error.message);
        }
    }
};
