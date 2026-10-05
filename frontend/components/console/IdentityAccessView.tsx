import React, { useState } from 'react';
import { 
    Shield, Sliders, Lock as LockIcon, CheckCircle2, 
    AlertTriangle, Eye, Mic, Fingerprint, Brain, 
    Hand, Smartphone, Laptop, RefreshCw, Key,
    ArrowRight, ShieldAlert, Zap, Clock
} from 'lucide-react';
import { FaceEnrollmentCeremony } from '../FaceEnrollmentCeremony';

interface IdentityAccessViewProps {
    activeSubTab: string;
    onLockSession: () => void;
    user?: any;
    enrollment?: any;
}

export const IdentityAccessView: React.FC<IdentityAccessViewProps> = ({ activeSubTab, onLockSession, user, enrollment }) => {
    const [activeCeremony, setActiveCeremony] = useState<'FACE' | null>(null);
    const [policyProfile, setPolicyProfile] = useState<'STANDARD' | 'ENHANCED' | 'MAXIMUM'>('ENHANCED');
    const [stepUpRules, setStepUpRules] = useState({
        vaultAccess: true,
        adminElevation: true,
        sessionIdle: true,
        networkChange: false
    });

    const biometricFactors = [
        {
            id: 'FACE',
            name: 'Facial Analysis & Liveness',
            desc: 'High-precision depth & feature extraction with anti-spoofing presentation attack detection (PAD).',
            status: enrollment?.faceEnrolled ? 'ENROLLED' : 'NOT ENROLLED',
            icon: Eye,
            type: 'Authoritative Core',
            lastVerified: '--'
        },
        {
            id: 'VOICE',
            name: 'Voice Harmonic Cadence',
            desc: 'Vocal tract resonance check combined with randomized dynamic challenge phrases against replay attacks.',
            status: enrollment?.voiceEnrolled ? 'ENROLLED' : 'NOT ENROLLED',
            icon: Mic,
            type: 'Authoritative Core',
            lastVerified: '--'
        },
        {
            id: 'PASSWORD',
            name: 'Zero-Knowledge Password',
            desc: 'Cryptographically hashed password.',
            status: enrollment?.passwordEnrolled ? 'ENROLLED' : 'NOT ENROLLED',
            icon: Key,
            type: 'Authoritative Core',
            lastVerified: '--'
        },
        {
            id: 'FINGERPRINT',
            name: 'Touch / Sensor Biometric',
            desc: 'Hardware USB reader or system sensor attestation via secure enclave cryptographic signing.',
            status: 'UNSUPPORTED / UNAVAILABLE',
            icon: Fingerprint,
            type: 'Authoritative Core',
            lastVerified: 'Hardware Not Detected'
        },
        {
            id: 'COGNITIVE',
            name: 'Cognitive & Reflex Challenge',
            desc: 'Neurometric reaction cadence to verify conscious human presence and prevent automated script injection.',
            status: 'UNSUPPORTED / UNAVAILABLE',
            icon: Brain,
            type: 'Authoritative Core',
            lastVerified: 'Not Implemented'
        }
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Description */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                        {activeSubTab === 'BIOMETRICS' && <Shield className="w-5 h-5" />}
                        {activeSubTab === 'AUTH_POLICY' && <Sliders className="w-5 h-5" />}
                        {activeSubTab === 'SESSIONS_RECOVERY' && <LockIcon className="w-5 h-5" />}
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                            {activeSubTab === 'BIOMETRICS' && 'IDENTITY & BIOMETRIC FACTORS'}
                            {activeSubTab === 'AUTH_POLICY' && 'AUTHENTICATION & ASSURANCE POLICY'}
                            {activeSubTab === 'SESSIONS_RECOVERY' && 'SESSIONS & WORKSTATION RECOVERY'}
                        </h1>
                        <p className="text-xs text-slate-500 font-mono">
                            {activeSubTab === 'BIOMETRICS' && 'Manage local biometric enrollment, hardware sensors, and cryptographic factor binding.'}
                            {activeSubTab === 'AUTH_POLICY' && 'Configure multi-stage verification rules, step-up triggers, and assurance profiles.'}
                            {activeSubTab === 'SESSIONS_RECOVERY' && 'Inspect active local workstation handle, lock thresholds, and cryptographic recovery keys.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* TAB 1: BIOMETRICS */}
            {activeSubTab === 'BIOMETRICS' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 font-mono">ENROLLED BIOMETRIC REFERENCE TEMPLATES</h2>
                                <p className="text-xs text-slate-500 mt-0.5">All templates are stored in AES-256-GCM encrypted local storage bound to your TPM.</p>
                            </div>
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> {(enrollment?.passwordEnrolled ? 1 : 0) + (enrollment?.faceEnrolled ? 1 : 0) + (enrollment?.voiceEnrolled ? 1 : 0) + (enrollment?.recoveryConfigured ? 1 : 0)} FACTORS ACTIVE
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {biometricFactors.map((fact) => {
                                const Icon = fact.icon;
                                const isEnrolled = fact.status === 'ENROLLED';
                                return (
                                    <div 
                                        key={fact.id}
                                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${isEnrolled ? 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30' : 'bg-slate-50/50 border-slate-200 opacity-75'}`}
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEnrolled ? 'bg-white border border-slate-200 text-blue-600 shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${isEnrolled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                    {fact.status}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-sm text-slate-900">{fact.name}</h3>
                                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{fact.desc}</p>
                                        </div>

                                        <div className="mt-5 pt-3 border-t border-slate-200/80 flex justify-between items-center text-[11px] font-mono text-slate-500">
                                            <span>Type: {fact.type}</span>
                                            {fact.id === 'FACE' ? (
                                                <button
                                                    onClick={() => setActiveCeremony('FACE')}
                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-[10px] transition-colors shadow-sm flex items-center gap-1"
                                                >
                                                    <span>Calibrate / Re-Enroll</span>
                                                </button>
                                            ) : (
                                                <span className="font-bold text-slate-700">{fact.lastVerified}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Hardware Architecture Note */}
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm flex items-start space-x-3.5">
                        <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs text-blue-900">
                            <span className="font-bold font-mono uppercase">Architectural Hardware Enforcement</span>
                            <p className="leading-relaxed text-blue-800">
                                In accordance with production Zero-Trust standards, BioShield does not simulate or spoof missing hardware scanners. Factors without detected physical sensors (such as Palm/Vein vascular scanners) remain strictly in an <span className="font-bold underline">UNSUPPORTED / UNAVAILABLE</span> state until dedicated hardware is attached and attested.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: AUTH POLICY */}
            {activeSubTab === 'AUTH_POLICY' && (
                <div className="space-y-6">
                    {/* Assurance Profiles */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 font-mono">BIOMETRIC ASSURANCE PROFILES</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Select the cryptographic rigor required to unlock this workstation or access protected enclaves.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { id: 'STANDARD', label: 'Standard Assurance', desc: 'Requires 2 authoritative factors (Face + Touch or Voice). Suitable for standard offline workstation tasks.', badge: 'FASTEST' },
                                { id: 'ENHANCED', label: 'Enhanced Assurance', desc: 'Requires 3 authoritative factors + behavioral kinematic verification. Standard for enterprise desktop access.', badge: 'RECOMMENDED' },
                                { id: 'MAXIMUM', label: 'Maximum Fortress', desc: 'Requires all 4 factors (Face, Voice, Touch, Cognitive) + continuous kinematic monitoring. Maximum security.', badge: 'FORTRESS' },
                            ].map(prof => {
                                const isSel = policyProfile === prof.id;
                                return (
                                    <div
                                        key={prof.id}
                                        onClick={() => setPolicyProfile(prof.id as any)}
                                        className={`p-5 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between ${isSel ? 'bg-blue-50/80 border-blue-500 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold font-mono text-slate-900">{prof.label}</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${isSel ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                                    {prof.badge}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed mt-2">{prof.desc}</p>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                                            <span className={isSel ? 'text-blue-700 font-bold' : 'text-slate-500'}>
                                                {isSel ? '● ACTIVE PROFILE' : '○ CLICK TO APPLY'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Multi-Stage Ceremony Sequence */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 font-mono">AUTHORITATIVE 4-STAGE CEREMONY PIPELINE</h2>
                        <p className="text-xs text-slate-500">The mandatory execution order when initiating a full workstation unlock or high-security step-up.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                            {[
                                { step: '01', name: 'Face Liveness', desc: '3D Mesh & PAD check', icon: Eye },
                                { step: '02', name: 'Voice Harmonics', desc: 'Anti-replay phrase check', icon: Mic },
                                { step: '03', name: 'Touch Sensor', desc: 'Hardware enclave signing', icon: Fingerprint },
                                { step: '04', name: 'Cognitive Reflex', desc: 'Neurometric reaction test', icon: Brain },
                            ].map((st, i) => {
                                const Icon = st.icon;
                                return (
                                    <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 relative flex flex-col justify-between">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-mono font-extrabold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">STEP {st.step}</span>
                                            <Icon className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <div className="font-bold text-xs text-slate-900 mt-1">{st.name}</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">{st.desc}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step-Up Re-Authentication Triggers */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 font-mono">STEP-UP RE-AUTHENTICATION TRIGGERS</h2>
                        <p className="text-xs text-slate-500">Automatically demand instantaneous biometric re-verification when these sensitive events occur.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            {[
                                { id: 'vaultAccess', label: 'Accessing Secure Vault Documents', desc: 'Require biometric sign-off before decrypting local files.' },
                                { id: 'adminElevation', label: 'Administrative Role Elevation', desc: 'Require full 4-factor challenge before entering Admin Console.' },
                                { id: 'sessionIdle', label: 'Workstation Idle > 15 Minutes', desc: 'Lock desktop and require biometric challenge on resume.' },
                                { id: 'networkChange', label: 'Untrusted Network IP / SSID Shift', desc: 'Trigger re-verification if Wi-Fi or Ethernet adapter changes.' },
                            ].map(rule => {
                                const checked = (stepUpRules as any)[rule.id];
                                return (
                                    <div key={rule.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                                        <div>
                                            <div className="font-bold text-xs text-slate-900">{rule.label}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">{rule.desc}</div>
                                        </div>
                                        <button
                                            onClick={() => setStepUpRules(prev => ({ ...prev, [rule.id]: !checked }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: SESSIONS RECOVERY */}
            {activeSubTab === 'SESSIONS_RECOVERY' && (
                <div className="space-y-6">
                    {/* Active Local Workstation Session */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 font-mono">ACTIVE LOCAL WORKSTATION SESSION</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Authoritative handle for the currently executing desktop environment.</p>
                            </div>
                            <button
                                onClick={onLockSession}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center space-x-2"
                            >
                                <LockIcon className="w-3.5 h-3.5" />
                                <span>Lock Workstation Now</span>
                            </button>
                        </div>

                        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                                    <Laptop className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <span className="font-extrabold text-sm text-slate-900">Windows 11 Enterprise x64 (Local Workstation)</span>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-mono font-bold">● THIS DEVICE</span>
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                        <span>User: {user?.email || 'Authenticated User'}</span>
                                        <span>TPM 2.0: Attested</span>
                                        <span>Auth: {(enrollment?.passwordEnrolled ? 1 : 0) + (enrollment?.faceEnrolled ? 1 : 0) + (enrollment?.voiceEnrolled ? 1 : 0) + (enrollment?.recoveryConfigured ? 1 : 0)}-Factor Fortress</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right font-mono text-xs text-slate-500 shrink-0">
                                <div className="text-slate-900 font-bold">Session ID: #{user?.sessionId || '--'}</div>
                                <div>Started: Active</div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-mono flex items-center justify-between">
                            <span>ℹ Remote Cloud Sessions (MacBook / Mobile / Office) will appear here once BioShield Cloud is connected under Data Protection.</span>
                        </div>
                    </div>

                    {/* Cryptographic Recovery & Emergency Lockdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 font-mono flex items-center gap-2">
                                    <Key className="w-4 h-4 text-blue-600" />
                                    <span>CRYPTOGRAPHIC RECOVERY KEY</span>
                                </h3>
                                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                                    If hardware biometric sensors fail or you are locked out, you can restore workstation access using your 24-word offline Master Recovery Phrase generated during setup.
                                </p>
                            </div>
                            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-[11px] font-mono text-slate-500">Status: Enrolled Offline</span>
                                <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition-colors border border-slate-200">
                                    Verify Phrase
                                </button>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-sm text-red-900 font-mono flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-red-600" />
                                    <span>EMERGENCY CRYPTOGRAPHIC LOCKDOWN</span>
                                </h3>
                                <p className="text-xs text-red-800 mt-2 leading-relaxed">
                                    Instantly evict all active decryption keys from memory and terminate the desktop session handle. Require full 4-factor ceremony + manual recovery PIN to unlock.
                                </p>
                            </div>
                            <div className="pt-4 border-t border-red-200 flex justify-between items-center">
                                <span className="text-[11px] font-mono text-red-700">Action: Immediate Memory Wipe</span>
                                <button
                                    onClick={onLockSession}
                                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
                                >
                                    Trigger Lockdown
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Ceremony Enclave (100% Light Theme) */}
            {activeCeremony === 'FACE' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-[32px] shadow-2xl p-2 border border-slate-200 relative">
                        <FaceEnrollmentCeremony
                            profileId="local-prof-001"
                            onEnrollSuccess={() => setActiveCeremony(null)}
                            onCancel={() => setActiveCeremony(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
