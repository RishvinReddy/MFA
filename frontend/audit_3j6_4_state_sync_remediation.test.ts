import * as assert from 'assert';

// Mock Browser Environment
const mockWindow: any = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
};
const mockDocument: any = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    visibilityState: 'visible',
};
const mockNavigator: any = {
    mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }]
        })
    }
};
(global as any).window = mockWindow;
(global as any).document = mockDocument;
(global as any).navigator = mockNavigator;
(global as any).sessionStorage = {
    getItem: jest.fn().mockReturnValue('mock-token'),
    removeItem: jest.fn(),
};

// Mock FormData and Blob
(global as any).FormData = class FormData {
    append() {}
};
(global as any).Blob = class Blob {};

// Mock fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

jest.useFakeTimers();

import { continuousAuthService } from './services/continuousAuthService';

const callbacks = {
    onStepUpRequired: jest.fn(),
    onSessionLocked: jest.fn(),
    onSessionRestricted: jest.fn()
};

describe('Phase 3J.6.4 State Sync Remediation Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockClear();
        callbacks.onStepUpRequired.mockClear();
        callbacks.onSessionLocked.mockClear();
        callbacks.onSessionRestricted.mockClear();
        continuousAuthService.stopMonitoring();
        (continuousAuthService as any).captureFrame = jest.fn().mockResolvedValue(new Blob());
    });

    test('TEST A: ACTIVE heartbeat -> frontend remains ACTIVE', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({ sessionStatus: 'ACTIVE' })
        });
        
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        
        expect(callbacks.onSessionLocked).not.toHaveBeenCalled();
        expect(callbacks.onStepUpRequired).not.toHaveBeenCalled();
        expect(callbacks.onSessionRestricted).not.toHaveBeenCalled();
    });

    test('TEST B: RESTRICTED heartbeat -> frontend becomes RESTRICTED', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({ sessionStatus: 'RESTRICTED', reason: 'Risk high' })
        });
        
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        
        expect(callbacks.onSessionRestricted).toHaveBeenCalledWith('Risk high');
    });

    test('TEST D: LOCKED heartbeat -> existing lock behavior remains intact', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({ sessionStatus: 'LOCKED', reason: 'Spoof detected' })
        });
        
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        
        expect(callbacks.onSessionLocked).toHaveBeenCalledWith('Spoof detected');
    });

    test('TEST E: STEP_UP_REQUIRED heartbeat -> step-up flow opens', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({ sessionStatus: 'STEP_UP_REQUIRED', reason: 'Identity low confidence' })
        });
        
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        
        expect(callbacks.onStepUpRequired).toHaveBeenCalledWith('Identity low confidence');
    });

    test('TEST F: STEP_UP_REQUIRED -> next normal heartbeat cannot incorrectly destroy active step-up flow', async () => {
        await continuousAuthService.startMonitoring(callbacks);
        
        // Simulating step-up state active -> paused
        continuousAuthService.pauseMonitoring();
        
        // Simulate normal heartbeat firing via interval
        mockFetch.mockClear();
        await continuousAuthService.sendHeartbeat();
        
        // Fetch should NOT have been called because isPaused is true
        expect(mockFetch).not.toHaveBeenCalled();
        
        continuousAuthService.resumeMonitoring();
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({ sessionStatus: 'ACTIVE' })
        });
        await continuousAuthService.sendHeartbeat();
        expect(mockFetch).toHaveBeenCalled();
    });

    test('TEST M: Generic 403 -> does NOT trigger STEP_UP_REQUIRED', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 403,
            clone: () => ({ json: async () => ({ error: { message: 'Forbidden' } }) }),
            json: async () => ({ error: { message: 'Forbidden' } })
        });
        
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        
        expect(callbacks.onSessionLocked).toHaveBeenCalledWith('Session locked or unauthorized');
        expect(callbacks.onStepUpRequired).not.toHaveBeenCalled();
    });

    test('TEST T: Existing Phase 3J.6.2 timeout/retry tests remain PASS', async () => {
        // Network failure
        mockFetch.mockRejectedValueOnce(new Error('Network error'));
        
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        
        // Should trigger retry after backoff
        expect(mockFetch).toHaveBeenCalledTimes(1);
        
        // Advance timer for backoff (2000ms)
        jest.advanceTimersByTime(2000);
        
        // Flush microtasks
        for(let i = 0; i < 5; i++) await Promise.resolve();
        
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
