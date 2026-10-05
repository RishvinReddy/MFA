
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

const BASE_URL = "http://localhost:8080";

export const api = {
    async login(data: any) {
        // Map 'username' to 'email' if needed
        const payload = {
            ...data,
            email: data.username || data.email
        };

        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result?.error?.message || result?.message || "Login failed");
        }

        return result;
    },

    async faceLogin(formData: FormData) {
        const res = await fetch(`${BASE_URL}/api/auth/face-login`, {
            method: "POST",
            body: formData
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result?.error?.message || result?.message || "Face Login failed");
        }

        return result;
    },

    async register(data: any) {
        // Map 'username' to 'email' if needed
        const payload = {
            ...data,
            email: data.username || data.email
        };

        const res = await fetch(`${BASE_URL}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result?.error?.message || result?.message || "Registration failed");
        }

        return result;
    },

    async registerBiometric(formData: FormData, enrollmentToken?: string, sessionId?: string) {
        const headers: any = {};
        if (enrollmentToken) {
            headers["x-enrollment-token"] = enrollmentToken;
        } else if (sessionId) {
            headers["x-session-id"] = sessionId;
        } else {
            const token = sessionStorage.getItem('accessToken');
            if (token) headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`${BASE_URL}/api/biometric/register`, {
            method: "POST",
            headers,
            body: formData
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result?.error?.message || result?.message || "Biometric Registration failed");
        }

        return result;
    },

    async verifyBiometric(formData: FormData, sessionId?: string) {
        const headers: any = {};
        if (sessionId) {
            headers["x-session-id"] = sessionId;
        } else {
            const token = sessionStorage.getItem('accessToken');
            if (token) headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`${BASE_URL}/api/biometric/verify`, {
            method: "POST",
            headers,
            body: formData
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result?.error?.message || result?.message || "Biometric Verification failed");
        }

        return result;
        return result;
    },

    async getBiometricStats() {
        const res = await fetch(`${BASE_URL}/api/biometric/stats`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        return await res.json();
    },

    async getMe() {
        const token = sessionStorage.getItem('accessToken');
        const res = await fetch(`${BASE_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to fetch user");
        return result.user;
    },

    setToken(token: string) {
        sessionStorage.setItem('accessToken', token);
    },

    async refresh(token: string) {
        const res = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ refreshToken: token })
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result?.error?.message || result?.message || "Refresh failed");
        }

        return result;
    },
    async verifyMfa(token: string, enrollmentToken?: string) {
        const headers: any = { "Content-Type": "application/json" };
        if (enrollmentToken) {
            headers["x-enrollment-token"] = enrollmentToken;
        } else {
            const accessToken = sessionStorage.getItem("accessToken");
            if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        }
        const res = await fetch(`${BASE_URL}/api/mfa/totp/verify`, {
            method: "POST",
            headers,
            body: JSON.stringify({ token })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "MFA Verification Failed");
        return result;
    },
    async verifyLoginTotp(userId: string, token: string, sessionId: string) {
        const res = await fetch(`${BASE_URL}/api/mfa/totp/verify-login`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-session-id": sessionId
            },
            body: JSON.stringify({ userId, token })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "MFA Login Verification Failed");
        return result;
    },
    async getSessionStatus(sessionId: string) {
        const res = await fetch(`${BASE_URL}/api/auth/session-status`, {
            method: "GET",
            headers: {
                "x-session-id": sessionId
            }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to fetch session status");
        return result;
    },
    async generateChallenge(mode: 'REGISTRATION' | 'LOGIN' = 'LOGIN', type: 'FACE' | 'VOICE' = 'FACE') {
        const token = sessionStorage.getItem("accessToken");
        const sessionId = sessionStorage.getItem("sessionId");
        const headers: any = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (sessionId) headers["x-session-id"] = sessionId;
        
        if (mode === 'REGISTRATION') {
            const enrollmentToken = sessionStorage.getItem("enrollmentToken");
            if (enrollmentToken) headers["x-enrollment-token"] = enrollmentToken;
        }

        console.log(`[API Debug] generateChallenge (${mode}, ${type}) headers:`, JSON.stringify(headers));

        const res = await fetch(`${BASE_URL}/api/auth/generate-challenge?type=${type}`, {
            method: "POST",
            headers
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to generate challenge");
        return result;
    },
    async sendEmailOtp(userId: string) {
        const res = await fetch(`${BASE_URL}/api/mfa/send-email-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to send email OTP");
        return result;
    },
    async verifyEmailRegistration(userId: string, token: string) {
        const res = await fetch(`${BASE_URL}/api/mfa/verify-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, token })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "Email Verification Failed");
        return result;
    },
    async sendPreRegOtp(email: string) {
        const res = await fetch(`${BASE_URL}/api/mfa/send-pre-reg-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to send verification email");
        return result;
    },
    async verifyPreRegOtp(email: string, code: string) {
        const res = await fetch(`${BASE_URL}/api/mfa/verify-pre-reg-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "Verification Failed");
        return result;
    },
    // Mock Biometric Endpoints for Demo
    async verify(blob: Blob, userId: string, type: string) {
        console.log(`[Mock] Verifying ${type} for ${userId}`);
        await new Promise(r => setTimeout(r, 1000));
        return { success: true, data: { verified: true, score: 0.98 }, error: null as string | null };
    },
    async enroll(blob: Blob, userId: string, type: string) {
        console.log(`[Mock] Enrolling ${type} for ${userId}`);
        await new Promise(r => setTimeout(r, 1000));
        return { success: true, data: { verified: true, score: 1.0 }, error: null as string | null };
    },

    async setupMfa(enrollmentToken?: string) {
        const headers: any = { "Content-Type": "application/json" };
        if (enrollmentToken) {
            headers["x-enrollment-token"] = enrollmentToken;
        } else {
            const accessToken = sessionStorage.getItem("accessToken");
            if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        }
        const res = await fetch(`${BASE_URL}/api/mfa/totp/setup`, {
            method: "POST",
            headers
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "MFA Setup Failed");
        return result;
    },

    async getEnrollmentStatus(enrollmentToken?: string) {
        const headers: any = { "Content-Type": "application/json" };
        if (enrollmentToken) {
            headers["x-enrollment-token"] = enrollmentToken;
        } else {
            const accessToken = sessionStorage.getItem("accessToken");
            if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        }
        const res = await fetch(`${BASE_URL}/api/auth/enrollment-status`, {
            method: "GET",
            headers
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to retrieve enrollment status");
        return result;
    },

    admin: {
        async getStats() {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/admin/stats`, {
                method: "POST", // API route defines this as POST in admin.routes.ts line 13
                headers: { "Authorization": `Bearer ${token}` }
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to fetch stats");
            return result; // return full result as dashboard expects res.success
        },
        async createUser(data: any) {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/admin/users`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            return result;
        },
        async getUsers() {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/admin/users`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to fetch users");
            return result.data;
        },
        async getSessions() {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/admin/sessions`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to fetch sessions");
            return result.data;
        },
        async getAuditLogs() {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/admin/audit`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to fetch logs");
            return result.data;
        },
        async disableUser(id: string, isActive: boolean) {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/admin/user/${id}/disable`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ isActive })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to update user status");
            return result;
        },
        async forceLogout(id: string) {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/admin/user/${id}/force-logout`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result?.error?.message || result?.message || "Failed to force logout");
            return result;
        }
    },

    webauthn: {
        async getRegistrationOptions() {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/webauthn/register/challenge`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || "Failed to get registration options");
            }
            return res.json();
        },
        async verifyRegistration(data: any) {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${BASE_URL}/api/webauthn/register/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(data.response ? data.response : data) // Handle potential wrapper
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || "Failed to verify registration");
            }
            return res.json();
        },
        async getAuthOptions(payload: { email?: string, userId?: string }) {
            const res = await fetch(`${BASE_URL}/api/webauthn/login/challenge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || "Failed to get auth options");
            }
            return res.json();
        },
        async verifyAuth(userId: string, response: any) {
            const res = await fetch(`${BASE_URL}/api/webauthn/login/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, body: response })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || "Failed to verify authentication");
            }
            return res.json();
        }
    },

    native: {
        isNativeHost(): boolean {
            return typeof (window as any).bioShieldNative !== 'undefined' || typeof (window as any).chrome?.webview !== 'undefined';
        },

        async invokeWindowsHello(payload: { email?: string, userId?: string, reason?: string } = {}): Promise<any> {
            if (this.isNativeHost()) {
                if ((window as any).bioShieldNative?.invokeWindowsHello) {
                    return await (window as any).bioShieldNative.invokeWindowsHello(payload);
                }
                if ((window as any).chrome?.webview) {
                    return new Promise((resolve, reject) => {
                        const messageId = `wh_auth_${Date.now()}`;
                        const handler = (event: MessageEvent) => {
                            if (event.data?.id === messageId) {
                                window.removeEventListener('message', handler);
                                if (event.data.success) resolve(event.data.result);
                                else reject(new Error(event.data.error || "Native Windows Hello failed"));
                            }
                        };
                        window.addEventListener('message', handler);
                        (window as any).chrome.webview.postMessage({ type: 'INVOKE_WINDOWS_HELLO', id: messageId, payload });
                    });
                }
            }

            // Fallback for Web/Dev server: delegate to platform authenticator via browser WebAuthn API
            try {
                const optionsResp = await api.webauthn.getAuthOptions(payload);
                const authResponse = await startAuthentication(optionsResp.options);
                const verifyResp = await api.webauthn.verifyAuth(optionsResp.userId || payload.userId || 'local-user', authResponse);
                return verifyResp;
            } catch (error: any) {
                console.warn("WebAuthn platform ceremony failed or cancelled:", error);
                throw error;
            }
        },

        async registerWindowsHello(payload: { userId?: string } = {}): Promise<any> {
            if (this.isNativeHost()) {
                if ((window as any).bioShieldNative?.registerWindowsHello) {
                    return await (window as any).bioShieldNative.registerWindowsHello(payload);
                }
            }
            const optionsResp = await api.webauthn.getRegistrationOptions();
            const authResponse = await startRegistration(optionsResp);
            const verifyResp = await api.webauthn.verifyRegistration({ response: authResponse });
            return verifyResp;
        },

        async getSystemDiagnostics(): Promise<any> {
            if (this.isNativeHost() && (window as any).bioShieldNative?.getSystemDiagnostics) {
                return await (window as any).bioShieldNative.getSystemDiagnostics();
            }
            const res = await fetch(`${BASE_URL}/api/system-boot`);
            const data = await res.json();
            return data;
        },

        async getSystemPersistence(): Promise<any> {
            if (this.isNativeHost() && (window as any).bioShieldNative?.getSystemPersistence) {
                return await (window as any).bioShieldNative.getSystemPersistence();
            }
            const res = await fetch(`${BASE_URL}/api/system-persistence`);
            const data = await res.json();
            return data.findings || [];
        },

    }
};
