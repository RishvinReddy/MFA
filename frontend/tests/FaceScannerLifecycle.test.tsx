import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { FaceScanner } from '../components/FaceScanner';
import { api } from '../services/api';

// Mock dependencies
jest.mock('../services/api', () => ({
    api: {
        generateChallenge: jest.fn().mockResolvedValue({
            challengeId: 'mock-id',
            nonce: 'mock-nonce',
            sequence: ['TURN_LEFT', 'TURN_RIGHT']
        })
    }
}));

jest.mock('../services/faceVerificationService', () => ({
    faceVerificationService: {
        assertBiometricEngineReady: jest.fn().mockResolvedValue({}),
        analyzeFrame: jest.fn(),
        verifyLiveCapture: jest.fn()
    }
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    jest.clearAllMocks();
    
    // Mock getUserMedia
    Object.defineProperty(global.navigator, 'mediaDevices', {
        value: {
            getUserMedia: jest.fn().mockResolvedValue({
                getTracks: () => [{ stop: jest.fn(), readyState: 'live' }],
                getVideoTracks: () => [{ readyState: 'live' }]
            })
        },
        writable: true
    });
});

afterEach(() => {
    if (root) {
        root.unmount();
        root = null;
    }
    if (container) {
        container.remove();
        container = null;
    }
});

describe('FaceScanner Lifecycle', () => {
    it('should generate exactly ONE challenge request per lifecycle, even under rapid remount (StrictMode)', async () => {
        // Render 1
        await act(async () => {
            root!.render(<FaceScanner onComplete={() => {}} mode="LOGIN" />);
        });
        
        // Unmount (simulating StrictMode or rapid navigation)
        act(() => {
            root!.unmount();
            root = createRoot(container!);
        });

        // Render 2
        await act(async () => {
            root!.render(<FaceScanner onComplete={() => {}} mode="LOGIN" />);
        });
        
        // Wait for async operations to settle
        await new Promise(r => setTimeout(r, 100));

        // It should only have executed generateChallenge ONCE for the final valid lifecycle
        expect(api.generateChallenge).toHaveBeenCalledTimes(1);
    });

    it('should not allow a stale async operation to update state', async () => {
        await act(async () => {
            root!.render(<FaceScanner onComplete={() => {}} mode="LOGIN" />);
        });

        act(() => {
            root!.unmount();
            root = createRoot(container!);
        });

        await new Promise(r => setTimeout(r, 100));
        // api.generateChallenge would have been aborted by the component unmounting due to the lifecycle generation mismatch
        expect(api.generateChallenge).toHaveBeenCalledTimes(0);
    });
});
