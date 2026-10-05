import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthStage, BehavioralMetrics } from './types';
import FaceScanner from './components/FaceScanner';
import VoiceScanner from './components/VoiceScanner';
import PalmScanner from './components/PalmScanner';
import FingerprintScanner from './components/FingerprintScanner';
import CognitiveScanner from './components/CognitiveScanner';
import AuthExplainer from './components/AuthExplainer';
import { SecurityConsole } from './components/console/SecurityConsole';
import { BehavioralLogin } from './components/BehavioralLogin';
import SystemBoot from './components/SystemBoot';
import LaptopAuthLayout from './components/LaptopAuthLayout';
import { Shield, Settings, LogOut, ChevronRight } from 'lucide-react';
import { authFlowService } from './services/authFlowService';
import { FinalizingVerification } from './components/FinalizingVerification';
import ProfileManagement from './components/profiles/ProfileManagement';
import ProfileDetails from './components/profiles/ProfileDetails';
import AddProfile from './components/profiles/AddProfile';
import { authFlowController } from './services/authFlowController';
import StepUpModal from './components/StepUpModal';
import { stepUpService } from './services/stepUpService';
import { continuousAuthService } from './services/continuousAuthService';
import { MfaUnlockView } from './components/login/MfaUnlockView';
import AuthContainer from './components/auth/AuthContainer';
import FaceModalityPanel from './components/auth/FaceModalityPanel';
import VoiceModalityPanel from './components/auth/VoiceModalityPanel';
import MfaModalityPanel from './components/auth/MfaModalityPanel';
import { GlobalSecurityAssistant } from './components/GlobalSecurityAssistant';


const parseJwt = (token: string) => {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
};

const MainApp: React.FC = () => {
    const [bootComplete, setBootComplete] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [stage, setStage] = useState<AuthStage>(AuthStage.LOGIN);
    const [username, setUsername] = useState('');
    const [userId, setUserId] = useState('');

    const [stepUpState, setStepUpState] = useState<{isOpen: boolean, reason: string}>({isOpen: false, reason: ''});
    const navigate = useNavigate();

    const handleLock = async () => {
        const token = sessionStorage.getItem('accessToken');
        const sessionId = sessionStorage.getItem('sessionId');

        setIsAuthenticated(false);
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('sessionId');
        sessionStorage.removeItem('userId');
        authFlowService.clear();
        setStage(AuthStage.LOGIN);
        navigate('/');

        if (token) {
            try {
                const headers: any = {
                    'Authorization': `Bearer ${token}`
                };
                if (sessionId) headers['x-session-id'] = sessionId;
                await fetch('http://localhost:8080/api/auth/logout', {
                    method: 'POST',
                    headers
                });
            } catch (err) {
                // Best effort
            }
        }
    };

    React.useEffect(() => {
        stepUpService.registerListener((reason) => {
            setStepUpState({ isOpen: true, reason });
        });
        return () => stepUpService.unregisterListener();
    }, []);

    React.useEffect(() => {
        if (isAuthenticated) {
            continuousAuthService.startMonitoring({
                onStepUpRequired: (reason) => {
                    setStepUpState({ isOpen: true, reason });
                },
                onSessionLocked: () => {
                    handleLock();
                },
                onSessionRestricted: (reason) => {
                    setStage(AuthStage.RESTRICTED);
                    navigate('/restricted');
                }
            });
        } else {
            continuousAuthService.stopMonitoring();
        }
        return () => {
            continuousAuthService.stopMonitoring();
        };
    }, [isAuthenticated]);

    React.useEffect(() => {
        if (stepUpState.isOpen) {
            continuousAuthService.pauseMonitoring();
        } else {
            continuousAuthService.resumeMonitoring();
        }
    }, [stepUpState.isOpen]);

    React.useEffect(() => {
        const restoreSession = async () => {
            if (!bootComplete) return;

            const storedSessionId = sessionStorage.getItem('sessionId');
            const storedUserId = sessionStorage.getItem('userId');
            const token = sessionStorage.getItem('accessToken');

            if (token) {
                try {
                    const res = await fetch(`http://localhost:8080/api/auth/session-status`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'x-session-id': storedSessionId || ''
                        }
                    });
                    const resData = await res.json();
                    if (resData.success && resData.isActive && (resData.status === 'ACTIVE' || resData.status === 'RESTRICTED')) {
                        const decoded = parseJwt(token);
                        if (decoded) {
                            setUsername(decoded.email);
                            setUserId(decoded.id);
                            setIsAuthenticated(true);
                            if (resData.status === 'RESTRICTED') {
                                setStage(AuthStage.RESTRICTED);
                            } else {
                                setStage(AuthStage.DASHBOARD);
                            }
                            return;
                        }
                    }
                } catch (err) {
                    console.error("Token verification failed:", err);
                }
                handleLock();
                return;
            }

            if (storedSessionId) {
                try {
                    const res = await fetch(`http://localhost:8080/api/auth/session-status`, {
                        headers: {
                            'x-session-id': storedSessionId
                        }
                    });
                    const resData = await res.json();
                    if (resData.success && resData.isActive) {
                        const status = resData.status;
                        setUserId(storedUserId || '');
                        if (status === 'CHALLENGE_REQUIRED') {
                            setStage(AuthStage.FACE_SCAN);
                            navigate('/verify/face');
                        } else if (status === 'FACE_VERIFIED') {
                            setStage(AuthStage.VOICE_VERIFY);
                            navigate('/verify/voice');
                        } else if (status === 'VOICE_VERIFIED') {
                            setStage(AuthStage.MFA_VERIFY);
                            navigate('/verify/mfa');
                        } else {
                            handleLock();
                        }
                    } else {
                        handleLock();
                    }
                } catch (err) {
                    console.error("Failed to restore authentication session:", err);
                    handleLock();
                }
            }
        };

        restoreSession();
    }, [bootComplete]);

    const handleLoginCredentials = async (
        sessionId: string,
        userId: string,
        email: string,
        role: string,
        metrics: BehavioralMetrics
    ) => {
        try {
            sessionStorage.setItem('sessionId', sessionId);
            sessionStorage.setItem('userId', userId);
            
            setUserId(userId);
            setUsername(email);

            authFlowService.start();
            setStage(AuthStage.FACE_SCAN);
            navigate('/verify/face');
        } catch (error) {
            console.error("Authentication credentials registration failed:", error);
        }
    };

    const handleLogin = (accessToken: string, refreshToken: string, user: any) => {
        sessionStorage.setItem('accessToken', accessToken);
        sessionStorage.setItem('refreshToken', refreshToken);
        sessionStorage.setItem('userId', user.id);

        setUsername(user.email);
        setUserId(user.id);
        setIsAuthenticated(true);
        setStage(AuthStage.DASHBOARD);

        authFlowController.handleAuthenticationSuccess(navigate, '/dashboard');
    };

    const handleStageComplete = async (currentStage: 'FACE' | 'VOICE') => {
        const storedSessionId = sessionStorage.getItem('sessionId');
        if (!storedSessionId) {
            handleLock();
            return;
        }

        try {
            const res = await fetch(`http://localhost:8080/api/auth/session-status`, {
                headers: {
                    'x-session-id': storedSessionId
                }
            });
            const resData = await res.json();
            if (resData.success && resData.isActive) {
                const status = resData.status;
                if (status === 'FACE_VERIFIED' || currentStage === 'FACE') {
                    setStage(AuthStage.VOICE_VERIFY);
                    navigate('/verify/voice');
                } else if (status === 'VOICE_VERIFIED' || currentStage === 'VOICE') {
                    setStage(AuthStage.MFA_VERIFY);
                    navigate('/verify/mfa');
                } else {
                    handleLock();
                }
            } else {
                handleLock();
            }
        } catch (err) {
            console.error("Failed to check stage completion:", err);
            handleLock();
        }
    };

    const StepIndicator = ({ current, total, label }: { current: number, total: number, label: string }) => (
        <div className="flex flex-col items-center justify-center mb-8 animate-fade-in">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                <span>BioIdentity Verification</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-blue-600">{label}</span>
                <span className="text-slate-400 ml-2">({current} / {total})</span>
            </div>
            <div className="flex items-center space-x-2">
                {[...Array(total)].map((_, i) => (
                    <div key={i} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${i < current ? 'bg-blue-600 shadow-sm' : 'bg-slate-200'}`}></div>
                ))}
            </div>
        </div>
    );

    const VerifyGuard: React.FC<{ requiredStages: AuthStage[]; children: React.ReactNode }> = ({ requiredStages, children }) => {
        if (!bootComplete) {
            return null;
        }

        if (requiredStages.includes(stage)) {
            return <>{children}</>;
        }

        if (stage === AuthStage.FACE_SCAN) return <Navigate to="/verify/face" replace />;
        if (stage === AuthStage.VOICE_VERIFY) return <Navigate to="/verify/voice" replace />;
        if (stage === AuthStage.MFA_VERIFY) return <Navigate to="/verify/mfa" replace />;
        if (stage === AuthStage.RESTRICTED) return <Navigate to="/restricted" replace />;
        if (stage === AuthStage.DASHBOARD) {
            return <Navigate to="/dashboard" replace />;
        }
        return <Navigate to="/" replace />;
    };

    const AppLayout: React.FC<{ children: React.ReactNode; showLogout?: boolean }> = ({ children, showLogout = true }) => {
        return (
            <div className="w-screen h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden relative selection:bg-blue-100 selection:text-blue-900">
                <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                    <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-blue-100/40 rounded-full blur-[120px]"></div>
                    <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-[100px]"></div>
                    <div className="absolute top-[30%] left-[30%] w-[400px] h-[400px] bg-white/60 rounded-full blur-[80px]"></div>
                </div>

                <div className="shrink-0 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm z-20">
                    <div className="h-14 flex items-center justify-between px-6">
                        <div
                            className="flex items-center space-x-3 cursor-pointer group"
                            onClick={() => {
                                if (!isAuthenticated) {
                                    authFlowService.clear();
                                    navigate('/');
                                } else {
                                    setStage(AuthStage.DASHBOARD);
                                    navigate('/dashboard');
                                }
                            }}
                        >
                            <div className="relative">
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-sm">
                                    <Shield className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-base tracking-tight text-slate-900 leading-none">BioShield<span className="text-blue-600">.ID</span></span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            {isAuthenticated && (
                                <button
                                    onClick={() => navigate('/profiles')}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80"
                                    title="Manage Local Profiles"
                                >
                                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="hidden sm:inline">Profiles</span>
                                </button>
                            )}

                            {showLogout && isAuthenticated && (
                                <>
                                    <div className="h-5 w-px bg-slate-200 mx-1"></div>
                                    <button
                                        onClick={handleLock}
                                        className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-red-600 font-bold transition-colors bg-white border border-slate-100 hover:border-red-100 rounded-lg shadow-sm"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        <span>Logout</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <main className="flex-1 relative z-10 overflow-y-auto overflow-x-hidden flex flex-col">
                    <div className="w-full max-w-7xl mx-auto p-6 h-full flex flex-col">
                        {children}
                    </div>
                </main>

                <StepUpModal 
                    isOpen={stepUpState.isOpen}
                    reason={stepUpState.reason}
                    userId={userId || undefined}
                    onClose={() => {
                        setStepUpState({ isOpen: false, reason: '' });
                        stepUpService.complete(false);
                        handleLock();
                    }}
                    onSuccess={async () => {
                        const token = sessionStorage.getItem('accessToken');
                        const storedSessionId = sessionStorage.getItem('sessionId');
                        if (token && storedSessionId) {
                            try {
                                const res = await fetch('http://localhost:8080/api/auth/session-status', {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'x-session-id': storedSessionId
                                    }
                                });
                                const resData = await res.json();
                                if (resData.success && resData.status === 'ACTIVE') {
                                    setStepUpState({ isOpen: false, reason: '' });
                                    stepUpService.complete(true);
                                    return;
                                }
                            } catch (err) {
                                console.error("Step-up verification error:", err);
                            }
                        }
                        setStepUpState({ isOpen: false, reason: '' });
                        stepUpService.complete(false);
                        handleLock();
                    }}
                />
            </div>
        );
    };

    if (!bootComplete) {
        return <SystemBoot onComplete={() => setBootComplete(true)} />;
    }

    return (
        <Routes>
            <Route path="/" element={
                <div className="animate-fade-in w-full h-screen">
                    <BehavioralLogin onLogin={handleLoginCredentials} />
                </div>
            } />

            <Route path="/verify/face" element={
                <VerifyGuard requiredStages={[AuthStage.FACE_SCAN]}>
                    <LaptopAuthLayout>
                        <AuthContainer
                            mode="LOGIN"
                            currentStep="FACE"
                            completedSteps={['IDENTITY']}
                            onCancel={handleLock}
                        >
                                <FaceModalityPanel
                                    mode="LOGIN"
                                    userId={userId}
                                    sessionId={sessionStorage.getItem('sessionId') || undefined}
                                    onSuccess={() => handleStageComplete('FACE')}
                                />
                            </AuthContainer>
                    </LaptopAuthLayout>
                </VerifyGuard>
            } />

            <Route path="/verify/voice" element={
                <VerifyGuard requiredStages={[AuthStage.VOICE_VERIFY]}>
                    <LaptopAuthLayout>
                        <AuthContainer
                            mode="LOGIN"
                            currentStep="VOICE"
                            completedSteps={['IDENTITY', 'FACE']}
                            onCancel={handleLock}
                        >
                                <VoiceModalityPanel
                                    mode="LOGIN"
                                    userId={userId}
                                    sessionId={sessionStorage.getItem('sessionId') || undefined}
                                    onSuccess={() => handleStageComplete('VOICE')}
                                />
                            </AuthContainer>
                    </LaptopAuthLayout>
                </VerifyGuard>
            } />

            <Route path="/verify/mfa" element={
                <VerifyGuard requiredStages={[AuthStage.MFA_VERIFY]}>
                    <LaptopAuthLayout>
                        <AuthContainer
                            mode="LOGIN"
                            currentStep="MFA"
                            completedSteps={['IDENTITY', 'FACE', 'VOICE']}
                            onCancel={handleLock}
                        >
                                <MfaModalityPanel
                                    mode="LOGIN"
                                    userId={userId}
                                    sessionId={sessionStorage.getItem('sessionId') || undefined}
                                    onSuccess={(data) => {
                                        if (data && data.accessToken) {
                                            handleLogin(data.accessToken, data.refreshToken, data.user);
                                        }
                                    }}
                                />
                            </AuthContainer>
                    </LaptopAuthLayout>
                </VerifyGuard>
            } />

            <Route path="/dashboard" element={
                <VerifyGuard requiredStages={[AuthStage.DASHBOARD]}>
                    <SecurityConsole onLock={handleLock} />
                </VerifyGuard>
            } />

            <Route path="/restricted" element={
                <VerifyGuard requiredStages={[AuthStage.RESTRICTED]}>
                    <AppLayout showLogout={true}>
                        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                            <Shield className="w-16 h-16 text-red-500 mb-4" />
                            <h2 className="text-2xl font-bold text-slate-800">Session Restricted</h2>
                            <p className="text-slate-500 mt-2">Your session has been restricted due to a security policy violation.</p>
                        </div>
                    </AppLayout>
                </VerifyGuard>
            } />

            <Route path="/profiles/*" element={
                <VerifyGuard requiredStages={[AuthStage.DASHBOARD]}>
                    <AppLayout showLogout={true}>
                        <Routes>
                            <Route index element={<ProfileManagement />} />
                            <Route path="add" element={<AddProfile />} />
                            <Route path=":profileId" element={<ProfileDetails />} />
                            <Route path="*" element={<Navigate to="/profiles" replace />} />
                        </Routes>
                    </AppLayout>
                </VerifyGuard>
            } />



            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <MainApp />
            <GlobalSecurityAssistant />
        </Router>
    );
};

export default App;
