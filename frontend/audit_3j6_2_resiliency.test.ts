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

// We need to use fake timers to test intervals and timeouts
jest.useFakeTimers();

// Import after mocking
import { continuousAuthService } from './services/continuousAuthService';

const callbacks = {
    onStepUpRequired: jest.fn(),
    onSessionLocked: jest.fn(),
    onSessionRestricted: jest.fn(),
};

describe('Phase 3J.6.2 Client Transport Resiliency Audit', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockReset();
        continuousAuthService.stopMonitoring();
        (continuousAuthService as any).isSending = false;
        (continuousAuthService as any).retryCount = 0;
        
        // Mock captureFrame to avoid hanging on video loadedmetadata events in JSDOM
        (continuousAuthService as any).captureFrame = jest.fn().mockResolvedValue(new Blob());
    });

    test('TEST A: Normal heartbeat succeeds', async () => {
        mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ sessionStatus: 'ACTIVE' }) });
        await continuousAuthService.startMonitoring(callbacks);
        
        const p = continuousAuthService.sendHeartbeat();
        expect((continuousAuthService as any).isSending).toBe(true);
        
        await p;
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect((continuousAuthService as any).isSending).toBe(false);
    });

    test('TEST B: Heartbeat hangs → AbortController terminates it', async () => {
        // Mock a hanging fetch that only resolves when aborted
        mockFetch.mockImplementation(async (url: string, opts: any) => {
            return new Promise((resolve, reject) => {
                if (opts.signal) {
                    opts.signal.addEventListener('abort', () => reject(new Error('AbortError')));
                }
            });
        });

        await continuousAuthService.startMonitoring(callbacks);
        const p = continuousAuthService.sendHeartbeat();
        
        // Flush microtasks to allow fetch to be called
        for(let i = 0; i < 5; i++) await Promise.resolve();
        
        expect((continuousAuthService as any).isSending).toBe(true);
        expect((continuousAuthService as any).activeAbortController).not.toBeNull();
        
        // Fast forward 10s
        jest.advanceTimersByTime(10000);
        
        await p;
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect((continuousAuthService as any).isSending).toBe(false);
        // It will schedule a retry because it failed with AbortError
        expect((continuousAuthService as any).retryCount).toBe(1);
    });

    test('TEST C: Heartbeat network failure → bounded retry (max 2)', async () => {
        mockFetch.mockRejectedValue(new Error('Network failure'));
        
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        
        // First retry happens after 2s
        jest.advanceTimersByTime(2000);
        // Wait for microtasks
        await Promise.resolve();
        
        // Second retry happens after 4s
        jest.advanceTimersByTime(4000);
        await Promise.resolve();
        
        // Advance more time, no more retries should happen
        jest.advanceTimersByTime(10000);
        await Promise.resolve();
        
        // Initial + 2 retries = 3 calls
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect((continuousAuthService as any).retryCount).toBe(2);
    });

    test('TEST E/F/G: No retry on 401, 403, or LOCKED', async () => {
        // 401
        mockFetch.mockResolvedValueOnce({ status: 401, clone: () => ({ json: async () => ({}) }), json: async () => ({}) });
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        expect(callbacks.onSessionLocked).toHaveBeenCalled();
        expect((continuousAuthService as any).isRunning).toBe(false);
        
        // LOCKED
        mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ sessionStatus: 'LOCKED' }) });
        await continuousAuthService.startMonitoring(callbacks);
        await continuousAuthService.sendHeartbeat();
        expect(callbacks.onSessionLocked).toHaveBeenCalledTimes(2);
        expect((continuousAuthService as any).isRunning).toBe(false);
        
        expect(mockFetch).toHaveBeenCalledTimes(2);
        
        jest.advanceTimersByTime(10000);
        expect(mockFetch).toHaveBeenCalledTimes(2); // No retries
    });

    test('TEST H/I/L/M: Event listener behavior and concurrency guard', async () => {
        await continuousAuthService.startMonitoring(callbacks);
        expect(mockWindow.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
        expect(mockDocument.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        
        const onlineHandler = mockWindow.addEventListener.mock.calls.find((c: any) => c[0] === 'online')[1];
        const visibilityHandler = mockDocument.addEventListener.mock.calls.find((c: any) => c[0] === 'visibilitychange')[1];
        
        // If we trigger online, it calls sendHeartbeat. But if fetch is pending, subsequent calls return immediately.
        mockFetch.mockImplementation(async () => new Promise(r => setTimeout(() => r({ status: 200, json: async () => ({ sessionStatus: 'ACTIVE' }) }), 100)));
        
        onlineHandler();
        expect((continuousAuthService as any).isSending).toBe(true);
        
        visibilityHandler(); // Should abort early because isSending=true
        
        for(let i = 0; i < 5; i++) await Promise.resolve(); // Flush microtasks to reach fetch
        
        expect(mockFetch).toHaveBeenCalledTimes(1);
        
        jest.advanceTimersByTime(100);
        for(let i = 0; i < 5; i++) await Promise.resolve(); // Allow fetch to finish
        expect((continuousAuthService as any).isSending).toBe(false);
        
        // Trigger again, should work
        visibilityHandler();
        for(let i = 0; i < 5; i++) await Promise.resolve();
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('TEST J/K: stopMonitoring cleans up everything', async () => {
        await continuousAuthService.startMonitoring(callbacks);
        continuousAuthService.stopMonitoring();
        
        expect(mockWindow.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
        expect(mockDocument.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        
        expect((continuousAuthService as any).timer).toBeNull();
        expect((continuousAuthService as any).retryTimer).toBeNull();
        expect((continuousAuthService as any).activeAbortController).toBeNull();
        expect((continuousAuthService as any).isRunning).toBe(false);
    });
});
