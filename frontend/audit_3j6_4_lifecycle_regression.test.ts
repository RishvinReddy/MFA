import * as assert from 'assert';

// Mock Browser Environment
const mockWindow: any = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
};
const mockDocument: any = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    visibilityState: 'visible',
    createElement: jest.fn(),
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
    getItem: jest.fn((key) => {
        if (key === 'accessToken') return 'mock-token';
        if (key === 'sessionId') return 'mock-session';
        return null;
    }),
    removeItem: jest.fn(),
    setItem: jest.fn(),
};

(global as any).FormData = class FormData {
    append() {}
};
(global as any).Blob = class Blob {};
(global as any).Headers = class Headers {
    map = new Map();
    has(key: string) { return this.map.has(key); }
    set(key: string, value: string) { this.map.set(key, value); }
    get(key: string) { return this.map.get(key); }
};

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

jest.useFakeTimers();

import { continuousAuthService } from './services/continuousAuthService';
import { vaultApi } from './services/vaultApi';
import { stepUpService } from './services/stepUpService';

const callbacks = {
    onStepUpRequired: jest.fn(),
    onSessionLocked: jest.fn(),
    onSessionRestricted: jest.fn()
};

describe('Phase 3J.6.4R Client State Lifecycle Regression', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockClear();
        callbacks.onStepUpRequired.mockClear();
        callbacks.onSessionLocked.mockClear();
        callbacks.onSessionRestricted.mockClear();
        continuousAuthService.stopMonitoring();
        (continuousAuthService as any).captureFrame = jest.fn().mockResolvedValue(new Blob());
    });

    test('TEST C: RESTRICTED CANNOT LOCALLY BECOME ACTIVE', async () => {
        // Establish RESTRICTED
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({ sessionStatus: 'RESTRICTED', reason: 'Risk high' })
        });
        
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        expect(callbacks.onSessionRestricted).toHaveBeenCalled();

        // Trigger local event (online)
        // Since we mock window.addEventListener, we find the online handler
        const onlineHandler = mockWindow.addEventListener.mock.calls.find((c: any) => c[0] === 'online')[1];
        
        // Next heartbeat resolves to RESTRICTED again, backend is authoritative
        mockFetch.mockResolvedValueOnce({
            status: 200,
            json: async () => ({ sessionStatus: 'RESTRICTED' })
        });
        
        onlineHandler();
        
        // Wait for microtasks
        for(let i=0; i<5; i++) await Promise.resolve();
        
        // Frontend does not magically become active. Heartbeat still sees RESTRICTED.
        expect(callbacks.onSessionRestricted).toHaveBeenCalledTimes(2);
    });

    test('TEST H: STEP-UP FAILURE / CANCEL', async () => {
        await continuousAuthService.startMonitoring(callbacks);
        continuousAuthService.pauseMonitoring(); // Step up opens
        expect((continuousAuthService as any).isPaused).toBe(true);

        // Cancel step up
        continuousAuthService.resumeMonitoring();
        expect((continuousAuthService as any).isPaused).toBe(false);
        
        // No false ACTIVE state
        expect(callbacks.onSessionRestricted).not.toHaveBeenCalled();
        expect(callbacks.onSessionLocked).not.toHaveBeenCalled();
    });

    test('TEST N: EXPLICIT STEP_UP_REQUIRED RESPONSE (vaultApi)', async () => {
        // vaultApi intercepts 403 STEP_UP_REQUIRED
        mockFetch.mockResolvedValueOnce({
            status: 403,
            clone: () => ({ json: async () => ({ action: 'STEP_UP_REQUIRED' }) }),
            json: async () => ({ action: 'STEP_UP_REQUIRED' })
        });
        
        // stepUpService resolves to true (success)
        jest.spyOn(stepUpService, 'requestStepUp').mockResolvedValueOnce(true);
        
        // Second fetch succeeds
        mockFetch.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: async () => ({ data: 'secret' })
        });

        const res = await vaultApi.decryptDocument('doc1');
        
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(stepUpService.requestStepUp).toHaveBeenCalled();
        expect(res).toEqual({ data: 'secret' });
    });

    test('TEST O: LOGOUT DURING STEP-UP', async () => {
        await continuousAuthService.startMonitoring(callbacks);
        continuousAuthService.pauseMonitoring(); // Step-up opens
        
        // Logout happens
        continuousAuthService.stopMonitoring();
        
        expect((continuousAuthService as any).isRunning).toBe(false);
        expect((continuousAuthService as any).callbacks).toBeNull();
    });

    test('TEST P: LOGOUT DURING IN-FLIGHT HEARTBEAT', async () => {
        let resolveFetch: any;
        mockFetch.mockImplementationOnce(() => {
            return new Promise(resolve => {
                resolveFetch = resolve;
            });
        });
        
        await continuousAuthService.startMonitoring(callbacks);
        const heartbeatPromise = continuousAuthService.sendHeartbeat();
        
        // Wait for captureFrame to resolve and fetch to be called
        for(let i=0; i<5; i++) await Promise.resolve();
        
        expect((continuousAuthService as any).isSending).toBe(true);
        expect(mockFetch).toHaveBeenCalled();
        
        // Logout
        continuousAuthService.stopMonitoring();
        expect((continuousAuthService as any).isRunning).toBe(false);
        
        // Resolve heartbeat with ACTIVE
        resolveFetch({
            status: 200,
            json: async () => ({ sessionStatus: 'ACTIVE' })
        });
        
        await heartbeatPromise;
        
        // Should not resurrect or call any callbacks since it's stopped
        expect((continuousAuthService as any).isRunning).toBe(false);
        // callbacks is set to null in stopMonitoring
        expect(callbacks.onSessionLocked).not.toHaveBeenCalled();
    });

    test('TEST Q: OFFLINE → ONLINE', async () => {
        await continuousAuthService.startMonitoring(callbacks);
        const onlineHandler = mockWindow.addEventListener.mock.calls.find((c: any) => c[0] === 'online')[1];
        
        mockFetch.mockResolvedValue({
            status: 200,
            json: async () => ({ sessionStatus: 'ACTIVE' })
        });
        
        onlineHandler();
        
        for(let i=0; i<5; i++) await Promise.resolve();
        
        // Should trigger one heartbeat, no privilege escalation
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('TEST R: VISIBILITY hidden → visible', async () => {
        await continuousAuthService.startMonitoring(callbacks);
        const visibilityHandler = mockDocument.addEventListener.mock.calls.find((c: any) => c[0] === 'visibilitychange')[1];
        
        mockFetch.mockResolvedValue({
            status: 200,
            json: async () => ({ sessionStatus: 'ACTIVE' })
        });
        
        mockDocument.visibilityState = 'visible';
        visibilityHandler();
        
        for(let i=0; i<5; i++) await Promise.resolve();
        
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('TEST S: START / STOP / START', async () => {
        // Clear mocks before test since beforeEach also calls stopMonitoring
        mockWindow.removeEventListener.mockClear();
        mockWindow.addEventListener.mockClear();

        await continuousAuthService.startMonitoring(callbacks);
        continuousAuthService.stopMonitoring();
        await continuousAuthService.startMonitoring(callbacks);
        
        // Intervals are cleared and recreated
        // Check event listeners count
        const onlineCount = mockWindow.addEventListener.mock.calls.filter((c: any) => c[0] === 'online').length;
        expect(onlineCount).toBe(2); // One from first start, one from second
        
        const onlineRemoveCount = mockWindow.removeEventListener.mock.calls.filter((c: any) => c[0] === 'online').length;
        expect(onlineRemoveCount).toBe(1); // Cleared in stopMonitoring
    });
});
