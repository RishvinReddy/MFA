const { spawn } = require('child_process');
const path = require('path');

const servicePath = path.resolve(__dirname, '../../biometric-service');
const pythonExecutable = path.join(servicePath, 'venv', 'Scripts', 'python.exe');

console.log('Starting Biometric Test Service on port 5001...');
const child = spawn(pythonExecutable, ['-m', 'uvicorn', 'main:app', '--port', '5001'], {
    cwd: servicePath,
    stdio: 'inherit'
});

console.log('Waiting 15 seconds for models to load...');
setTimeout(() => {
    console.log('Starting Jest tests...');
    const jest = spawn('npx.cmd', ['jest'], {
        cwd: path.resolve(__dirname, '../'),
        stdio: 'inherit',
        shell: true,
        env: { 
            ...process.env, 
            REDIS_AVAILABLE: 'false',
            MOCK_VOICE: 'true',
            BIOMETRIC_SERVICE_URL: 'http://127.0.0.1:5001'
        }
    });

    jest.on('close', (code) => {
        console.log(`Jest finished with code ${code}. Terminating biometric service...`);
        try {
            const { execSync } = require('child_process');
            execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
        } catch (e) {
            console.error('Failed to kill:', e.message);
        }
        process.exit(code);
    });
}, 15000);
