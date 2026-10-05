const { spawn } = require('child_process');
const path = require('path');

module.exports = async () => {
    console.log('\n[Jest Global Setup] Starting Biometric Test Service on port 5001...');
    
    const servicePath = path.resolve(__dirname, '../biometric-service');
    // Using uvicorn directly to override port to 5001
    const pythonExecutable = path.join(servicePath, 'venv', 'Scripts', 'python.exe');
    
    const fs = require('fs');
    const out = fs.openSync(path.join(__dirname, 'test-biometric.log'), 'a');
    const err = fs.openSync(path.join(__dirname, 'test-biometric.log'), 'a');

    // Spawn the test service
    const child = spawn(pythonExecutable, ['-m', 'uvicorn', 'main:app', '--port', '5001'], {
        cwd: servicePath,
        detached: true,
        stdio: ['ignore', out, err]
    });

    child.unref();

    // Store PID so teardown can kill it
    global.__BIOMETRIC_SERVICE_PID__ = child.pid;

    // Wait for the service to start (ML models take time to load)
    await new Promise(resolve => setTimeout(resolve, 12000));
    console.log('[Jest Global Setup] Biometric Test Service started on port 5001.');
};
