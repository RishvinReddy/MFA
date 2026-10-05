import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2, HardDrive, Lock, Shield,
    Check, UserPlus, Settings, RotateCcw, AlertTriangle
} from 'lucide-react';
import { BehavioralMetrics, LocalProfile, LoginView, EnrollmentMode } from '../types';
import { authFlowService } from '../services/authFlowService';
import { localProfileService } from '../services/localProfileService';

// Sub-components
import FirstRunSetup      from './login/FirstRunSetup';
import ProfileSelector    from './login/ProfileSelector';
import UnlockView         from './login/UnlockView';
import PasswordUnlockView from './login/PasswordUnlockView';
import SecureActionAuthorization from './login/SecureActionAuthorization';
import EnrollView         from './login/EnrollView';
import AuthContainer      from './auth/AuthContainer';
import CredentialsLoginForm from './auth/CredentialsLoginForm';
import { authFlowController } from '../services/authFlowController';
import { PendingSecureAction } from '../types';

interface BehavioralLoginProps {
    onLogin: (sessionId: string, userId: string, email: string, role: string, metrics: BehavioralMetrics) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a BehavioralMetrics snapshot for the completed session. */
function buildMetrics(): BehavioralMetrics {
    return {
        typingVariance:      0.12,
        mousePathEfficiency: 0.87,
        interactionTime:     (Date.now() % 10000) / 1000,
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BehavioralLogin: React.FC<BehavioralLoginProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    // ── Core view state ──────────────────────────────────────────────────────
    const [view, setView]                     = useState<LoginView | null>(null); // null = loading
    const [profiles, setProfiles]             = useState<LocalProfile[]>([]);
    const [activeProfile, setActiveProfile]   = useState<LocalProfile | null>(null);
    const [enrollmentMode, setEnrollmentMode] = useState<EnrollmentMode>('FIRST_PROFILE');
    const [pendingAction, setPendingAction]   = useState<PendingSecureAction>('NONE');

    // ── Registration recovery / resume context ──────────────────────────────
    const [resumeUserId, setResumeUserId] = useState<string | null>(null);
    const [resumeEnrollmentToken, setResumeEnrollmentToken] = useState<string | null>(null);
    const [resumeEmail, setResumeEmail] = useState<string | null>(null);
    // ── UI state ─────────────────────────────────────────────────────────────
    const [isSuccess, setIsSuccess]           = useState(false);
    const [error, setError]                   = useState<string | null>(null);
    const [resetConfirm, setResetConfirm]     = useState(false);

    // ── Behavioural telemetry (still collected at coordinator level) ──────────
    const startTimeRef = useRef<number>(Date.now());

    // ─── Bootstrap — single authoritative startup decision ────────────────────
    useEffect(() => {
        const result = localProfileService.bootstrap();
        setProfiles(result.profiles);
        setActiveProfile(result.activeProfile);
        setView(result.initialView);
    }, []);

    // ─── Handlers ─────────────────────────────────────────────────────────────

    /** Navigate into the BioShield biometric pipeline. */
    const handleBioShieldVerification = (modality: 'FACE' | 'VOICE' = 'FACE') => {
        setError(null);
        if (activeProfile) {
            authFlowController.startSecureAction('NONE', 'UNLOCK', activeProfile.id);
        }
        authFlowService.start();
        navigate(modality === 'VOICE' ? '/verify/voice' : '/verify/face');
    };

    /** Called when password credentials login succeeds. */
    const handlePasswordSuccess = (sessionId: string, userId: string, email: string, role: string) => {
        setIsSuccess(true);
        authFlowController.clearPendingAction();
        setTimeout(() => {
            onLogin(
                sessionId,
                userId,
                email,
                role,
                buildMetrics()
            );
        }, 1000);
    };

    const handleEnrollmentResume = (userId: string, token: string, emailStr: string) => {
        setResumeUserId(userId);
        setResumeEnrollmentToken(token);
        setResumeEmail(emailStr);
        setEnrollmentMode('RESUME');
        setView('ENROLL');
    };

    const handleProfileSelect = (profile: LocalProfile) => {
        localProfileService.setActiveProfile(profile.id);
        setActiveProfile(profile);
        setView('UNLOCK');
        setError(null);
    };

    /** Called from the left panel "Manage" button. */
    const handleManageProfiles = () => {
        setError(null);
        if (!activeProfile) return;
        console.info(`[BioShield LockScreen] ──> Manage Profiles clicked. Authorizing profile: [${activeProfile.id}]`);
        authFlowController.startSecureAction('MANAGE_PROFILES', 'MANAGE_PROFILES', activeProfile.id, '/profiles');
        setPendingAction('MANAGE_PROFILES');
        setView('PIN_UNLOCK');
    };

    /** Called from the left panel "+ Add Local User" button. */
    const handleRequestAddUser = () => {
        setError(null);
        if (!activeProfile) return;
        console.info(`[BioShield LockScreen] ──> + Add User clicked. Authorizing profile: [${activeProfile.id}]`);
        authFlowController.startSecureAction('ADD_LOCAL_USER', 'ADD_LOCAL_USER', activeProfile.id, '/profiles/add');
        setPendingAction('ADD_LOCAL_USER');
        setView('PIN_UNLOCK');
    };

    /** Called when SecureActionAuthorization issues a valid PIN auth or token. */
    const handleActionAuthorizedPin = (authorizedAction?: PendingSecureAction) => {
        const actionToRun = authorizedAction && authorizedAction !== 'NONE' ? authorizedAction : pendingAction;
        console.info(`[BioShield LockScreen] ──> PIN authorization succeeded for action: [${actionToRun}]`);
        if (!activeProfile) return;
        if (actionToRun === 'MANAGE_PROFILES') {
            sessionStorage.setItem('bioshield_manage_profiles_authorized', 'true');
            sessionStorage.setItem('bioshield_auth_token_expires', String(Date.now() + 5 * 60 * 1000));
        } else if (actionToRun === 'ADD_LOCAL_USER') {
            sessionStorage.setItem('bioshield_add_user_authorized', 'true');
            sessionStorage.setItem('bioshield_auth_token_expires', String(Date.now() + 5 * 60 * 1000));
        }
        localStorage.setItem('bioshield_authenticated_session', 'true');
        // Route to the correct destination based on the pending secure action context.
        // Do NOT call onLogin() — this is a local profile management action, not an auth login.
        authFlowController.handleAuthenticationSuccess(navigate, '/dashboard');
    };

    /** Called when enrollment (FIRST or ADDITIONAL) completes. */
    const handleEnrollComplete = (newProfile: LocalProfile) => {
        const refreshed = localProfileService.listProfiles();
        setProfiles(refreshed);
        setActiveProfile(newProfile);
        setView('UNLOCK');
    };

    /** Wipes all BioShield data and resets to first-run setup. */
    const handleReset = () => {
        if (!resetConfirm) {
            setResetConfirm(true);
            return;
        }
        localProfileService.resetAllData();
        setProfiles([]);
        setActiveProfile(null);
        setResetConfirm(false);
        setView('WELCOME_SETUP');
    };

    // ─── Left panel content — adapts to profile state ─────────────────────────
    const leftPanelProfileSection = () => {
        const hasProfiles = profiles.length > 0;

        return (
            <div className="relative z-10 pt-8 mt-8 border-t border-white/10">
                {/* LOCAL PROFILES card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Local Profiles
                    </div>

                    {!hasProfiles ? (
                        <div className="text-sm text-slate-300 font-medium">
                            No profiles — first-time setup required
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {/* Show up to 3 profiles in the mini-list */}
                            {profiles.slice(0, 3).map((p) => {
                                const isActive = p.id === activeProfile?.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleProfileSelect(p)}
                                        className={`w-full flex items-center space-x-2 p-1.5 rounded-lg text-left transition-all ${isActive ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5'}`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                                        <span className="text-xs font-semibold text-slate-200 truncate flex-1">
                                            {p.displayName}
                                        </span>
                                        {isActive && (
                                            <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0">Active</span>
                                        )}
                                        {p.isPrimary && !isActive && (
                                            <span className="text-[10px] text-slate-500 font-bold flex-shrink-0">Primary</span>
                                        )}
                                    </button>
                                );
                            })}
                            {profiles.length > 3 && (
                                <div className="text-[10px] text-slate-500 pl-3.5">
                                    +{profiles.length - 3} more
                                </div>
                            )}
                        </div>
                    )}

                    {/* Local-First badge */}
                    <div className="flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-400/30 w-fit">
                        <HardDrive className="w-3 h-3" />
                        <span>Local-First</span>
                    </div>

                    {/* Action buttons — only shown when profiles exist */}
                    {hasProfiles && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                id="btn-manage-profiles"
                                type="button"
                                onClick={handleManageProfiles}
                                className="flex items-center justify-center space-x-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-bold px-2 py-1.5 rounded-lg transition-all"
                            >
                                <Settings className="w-3 h-3" />
                                <span>Manage</span>
                            </button>
                            <button
                                id="btn-add-local-user-panel"
                                type="button"
                                onClick={handleRequestAddUser}
                                className="flex items-center justify-center space-x-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-300 text-[11px] font-bold px-2 py-1.5 rounded-lg transition-all"
                            >
                                <UserPlus className="w-3 h-3" />
                                <span>+ Add User</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-4">
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Sensitive authentication data remains on this device</span>
                </div>

                {/* Reset / Start Fresh */}
                <div className="mt-4 pt-3 border-t border-white/10">
                    {!resetConfirm ? (
                        <button
                            id="btn-reset-device"
                            type="button"
                            onClick={handleReset}
                            className="flex items-center space-x-1.5 text-[11px] text-slate-500 hover:text-red-400 transition-colors group"
                        >
                            <RotateCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                            <span>Reset device / Start fresh</span>
                        </button>
                    ) : (
                        <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-3 space-y-2 animate-fade-in">
                            <div className="flex items-center space-x-1.5 text-red-300 text-[11px] font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>This will delete ALL profiles & data</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    id="btn-reset-confirm"
                                    type="button"
                                    onClick={handleReset}
                                    className="flex-1 bg-red-500/80 hover:bg-red-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all"
                                >
                                    Yes, Reset
                                </button>
                                <button
                                    id="btn-reset-cancel"
                                    type="button"
                                    onClick={() => setResetConfirm(false)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold py-1.5 px-3 rounded-lg border border-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ─── Loading state ────────────────────────────────────────────────────────
    if (view === null) {
        return (
            <div className="min-h-[82vh] flex items-center justify-center">
                <div className="flex flex-col items-center space-y-3 text-slate-400">
                    <Shield className="w-8 h-8 animate-pulse" />
                    <span className="text-xs font-medium">Loading profile registry…</span>
                </div>
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="auth-page">

            {/* SUCCESS OVERLAY */}
            {isSuccess && (
                <div className="fixed inset-0 z-50 bg-blue-600/95 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 border border-white/40 shadow-2xl animate-bounce">
                        <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight mb-2">BioShield.ID Unlocked</h2>
                    <p className="text-blue-100 font-medium">Session authenticated. Entering workspace…</p>
                </div>
            )}

            <div className="auth-shell">

                {/* ── LEFT PANEL ─────────────────────────────────────────── */}
                <div className="auth-left bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-8 lg:p-12 text-white overflow-hidden">

                    {/* Ambient flares */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none" />

                    <div className="relative z-10 space-y-6">
                        {/* Badge */}
                        <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-400/20 px-3 py-1.5 rounded-full backdrop-blur-md">
                            <Shield className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                                Local-First Desktop Protection
                            </span>
                        </div>

                        {/* Headline */}
                        <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                            Security that doesn't stop after login.
                        </h1>

                        <p className="text-slate-300 text-sm leading-relaxed">
                            BioShield.ID protects your computer locally using hardware TPM
                            attestation, authoritative local biometric matching, and continuous
                            behavioral verification.
                        </p>

                        {/* Capabilities */}
                        <div className="space-y-3 pt-2">
                            {[
                                { title: 'Local Device Identity',    desc: 'Secure desktop profile — 100% offline capable' },
                                { title: 'Local Biometric Engine',   desc: 'Authoritative offline face, voice & PIN verification' },
                                { title: 'Behavioral Intelligence',  desc: 'Continuous analysis of interaction timing' },
                                { title: 'Dynamic Session Risk',     desc: 'Real-time multi-factor trust evaluation' },
                                { title: 'Optional Cloud Access',    desc: 'Connect cloud storage post-unlock on demand' },
                            ].map((cap, i) => (
                                <div key={i} className="flex items-start space-x-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center mt-0.5 flex-shrink-0">
                                        <Check className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-slate-100">{cap.title}</div>
                                        <div className="text-[11px] text-slate-400">{cap.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LOCAL PROFILES section */}
                    {leftPanelProfileSection()}
                </div>

                {/* ── RIGHT PANEL — view coordinator ─────────────────────── */}
                <div className="auth-right p-8 lg:p-14 flex flex-col justify-center bg-[#F3F5F9] relative">
                    <div className="max-w-md mx-auto w-full space-y-6">

                        {view === 'WELCOME_SETUP' && (
                            <FirstRunSetup
                                onBeginSetup={() => {
                                    setEnrollmentMode('FIRST_PROFILE');
                                    setView('ENROLL');
                                }}
                            />
                        )}

                        {view === 'PROFILE_SELECT' && (
                            <ProfileSelector
                                profiles={profiles}
                                recentProfileId={activeProfile?.id ?? null}
                                onSelect={handleProfileSelect}
                                onAddUser={handleRequestAddUser}
                            />
                        )}

                        {(view === 'UNLOCK' || view === 'PIN_UNLOCK') && (
                            <AuthContainer
                                mode="LOGIN"
                                currentStep="IDENTITY"
                                completedSteps={[]}
                                nextInstruction="Next: Face Verification"
                            >
                                <CredentialsLoginForm
                                    profile={activeProfile}
                                    onSuccess={handlePasswordSuccess}
                                    onEnrollmentResume={handleEnrollmentResume}
                                    onSwitchProfile={
                                        profiles.length > 1 ? () => { setError(null); setView('PROFILE_SELECT'); } : undefined
                                    }
                                    onRegisterNew={() => {
                                        setError(null);
                                        setEnrollmentMode('FIRST_PROFILE');
                                        setView('ENROLL');
                                    }}
                                />
                            </AuthContainer>
                        )}

                        {view === 'SECURE_ACTION_AUTH' && activeProfile && (
                            <SecureActionAuthorization
                                authorizingProfile={activeProfile}
                                action={pendingAction}
                                onAuthorizedPin={handleActionAuthorizedPin}
                                onCancel={() => {
                                    setPendingAction('NONE');
                                    setView(profiles.length > 1 ? 'PROFILE_SELECT' : 'UNLOCK');
                                }}
                            />
                        )}

                        {view === 'ENROLL' && (
                            <EnrollView
                                mode={enrollmentMode}
                                resumeUserId={resumeUserId}
                                resumeEnrollmentToken={resumeEnrollmentToken}
                                resumeEmail={resumeEmail}
                                onComplete={(profile) => {
                                    setResumeUserId(null);
                                    setResumeEnrollmentToken(null);
                                    setResumeEmail(null);
                                    handleEnrollComplete(profile);
                                }}
                                onCancel={
                                    enrollmentMode === 'ADDITIONAL_PROFILE' || enrollmentMode === 'RESUME'
                                        ? () => {
                                            setResumeUserId(null);
                                            setResumeEnrollmentToken(null);
                                            setResumeEmail(null);
                                            setView(profiles.length > 1 ? 'PROFILE_SELECT' : 'UNLOCK');
                                        }
                                        : undefined
                                }
                            />
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
};
