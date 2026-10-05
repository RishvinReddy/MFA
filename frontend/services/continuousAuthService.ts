interface ContinuousAuthCallbacks {
    onStepUpRequired: (reason: string) => void;
    onSessionLocked: (reason: string) => void;
    onSessionRestricted: (reason: string) => void;
}

class ContinuousAuthService {
    private timer: any = null;
    private retryTimer: any = null;
    private callbacks: ContinuousAuthCallbacks | null = null;
    private isRunning: boolean = false;
    private lastActiveTimestamp: number = Date.now();
    private mediaStream: MediaStream | null = null;
    private isSending: boolean = false;
    private retryCount: number = 0;
    private activeAbortController: AbortController | null = null;
    private isPaused: boolean = false;

    constructor() {
        // Track local activity timestamp
        if (typeof window !== 'undefined') {
            window.addEventListener('mousemove', this.recordActivity);
            window.addEventListener('keydown', this.recordActivity);
        }
    }

    private recordActivity = () => {
        this.lastActiveTimestamp = Date.now();
    };

    private handleOnline = () => {
        if (this.isRunning) this.sendHeartbeat();
    };

    private handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && this.isRunning) {
            this.sendHeartbeat();
        }
    };

    private async initCameraStream() {
        if (this.mediaStream) return;
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err) {
            console.error('Failed to initialize background camera stream:', err);
        }
    }

    private stopCameraStream() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
    }

    private async captureFrame(): Promise<Blob | null> {
        await this.initCameraStream();
        if (!this.mediaStream) return null;

        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.srcObject = this.mediaStream;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            
            video.onloadedmetadata = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                
                setTimeout(() => {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((blob) => {
                            video.srcObject = null;
                            resolve(blob);
                        }, 'image/jpeg', 0.85);
                    } else {
                        video.srcObject = null;
                        resolve(null);
                    }
                }, 100);
            };
            
            video.onerror = () => {
                video.srcObject = null;
                resolve(null);
            };
        });
    }

    public async startMonitoring(callbacks: ContinuousAuthCallbacks) {
        this.callbacks = callbacks;
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.lastActiveTimestamp = Date.now();

        await this.initCameraStream();

        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleOnline);
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }

        // 30-second heartbeat interval
        this.timer = setInterval(() => {
            this.sendHeartbeat();
        }, 30000);
    }

    public stopMonitoring() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        if (this.activeAbortController) {
            this.activeAbortController.abort();
            this.activeAbortController = null;
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.handleOnline);
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
        this.stopCameraStream();
        this.isRunning = false;
        this.callbacks = null;
        this.isSending = false;
        this.retryCount = 0;
        this.isPaused = false;
    }

    public pauseMonitoring() {
        this.isPaused = true;
    }

    public resumeMonitoring() {
        this.isPaused = false;
        this.lastActiveTimestamp = Date.now();
    }

    public async sendHeartbeat(isRetry = false) {
        if (!isRetry) {
            this.retryCount = 0;
        }

        const token = sessionStorage.getItem('accessToken');
        const sessionId = sessionStorage.getItem('sessionId');

        if (!token || !sessionId) {
            this.stopMonitoring();
            return;
        }

        if (this.isSending || this.isPaused) return;
        this.isSending = true;

        const elapsedActiveSeconds = Math.round((Date.now() - this.lastActiveTimestamp) / 1000);
        
        this.activeAbortController = new AbortController();
        const timeoutId = setTimeout(() => {
            if (this.activeAbortController) {
                this.activeAbortController.abort();
            }
        }, 10000);

        try {
            const frameBlob = await this.captureFrame();

            const formData = new FormData();
            if (frameBlob) {
                formData.append('face', frameBlob, 'frame.jpg');
            }
            formData.append('timestamp', new Date().toISOString());
            formData.append('presence', JSON.stringify({
                faceDetected: !!frameBlob,
                lastActiveSecondsAgo: elapsedActiveSeconds
            }));
            formData.append('behavioral', JSON.stringify({
                mouseVelocityVariance: 0.12,
                keyFlightTimeVariance: 0.07
            }));

            const res = await fetch('http://localhost:8080/api/auth/continuous-verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-session-id': sessionId
                },
                body: formData,
                signal: this.activeAbortController.signal
            });
            
            clearTimeout(timeoutId);
            this.activeAbortController = null;

            if (res.status === 401 || res.status === 403) {
                const clone = res.clone();
                const errorData = await clone.json().catch(() => ({}));
                if (errorData.action === 'STEP_UP_REQUIRED') {
                    if (this.callbacks) this.callbacks.onStepUpRequired(errorData.error?.message || 'Elevated risk detected. Step-up required.');
                    return;
                }
                if (errorData.action === 'RESTRICTED' || errorData.action === 'RESTRICT') {
                    if (this.callbacks) this.callbacks.onSessionRestricted(errorData.error?.message || 'Session restricted due to policy violation.');
                    return;
                }
                if (this.callbacks) this.callbacks.onSessionLocked('Session locked or unauthorized');
                this.stopMonitoring();
                return;
            }

            const data = await res.json();

            if (data.sessionStatus === 'LOCKED') {
                if (this.callbacks) this.callbacks.onSessionLocked(data.reason || 'Session locked due to high risk');
                this.stopMonitoring();
                return;
            }

            if (data.sessionStatus === 'STEP_UP_REQUIRED') {
                if (this.callbacks) this.callbacks.onStepUpRequired(data.reason || 'Elevated risk detected. Step-up required.');
                return;
            }

            if (data.sessionStatus === 'RESTRICTED') {
                if (this.callbacks) this.callbacks.onSessionRestricted(data.reason || 'Session restricted due to policy violation.');
                return;
            }
            
            // Success, reset retry count
            this.retryCount = 0;

        } catch (err: any) {
            clearTimeout(timeoutId);
            this.activeAbortController = null;
            
            // Handle network/timeout errors by retrying cautiously
            if (this.isRunning && this.retryCount < 2 && err.name !== 'SyntaxError') {
                this.retryCount++;
                this.retryTimer = setTimeout(() => {
                    this.sendHeartbeat(true);
                }, 2000 * this.retryCount); // Bounded backoff: 2s, 4s
            } else {
                console.error('Continuous Auth Heartbeat Error:', err);
            }
        } finally {
            this.isSending = false;
        }
    }
}

export const continuousAuthService = new ContinuousAuthService();
