import React from 'react';
import { ShieldCheck, KeyRound, Lock, User, Monitor } from 'lucide-react';
import { LocalProfile } from '../../types';

interface UnlockViewProps {
    profile: LocalProfile;
    deviceTrustScore: number;
    error: string | null;
    onVerify: (modality: 'FACE' | 'VOICE') => void;
    onPinUnlock: () => void;
    onSwitchProfile?: () => void;   // only shown when called from PROFILE_SELECT flow
}

const UnlockView: React.FC<UnlockViewProps> = ({
    profile,
    deviceTrustScore,
    error,
    onVerify,
    onPinUnlock,
    onSwitchProfile,
}) => {
    return (
        <div className="space-y-6 animate-fade-in text-center">

            {/* Top badge */}
            <div>
                <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-600 px-3.5 py-1 rounded-full text-xs font-bold mb-4 border border-blue-100">
                    <User className="w-3.5 h-3.5" />
                    <span>BioShield.ID</span>
                </div>

                {/* Welcome headline */}
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    Welcome back
                </h2>
                <h3 className="text-2xl font-bold text-blue-600 mt-0.5">
                    {profile.displayName}
                </h3>
                <p className="text-xs text-slate-500 mt-2">
                    Confirm your identity to unlock BioShield.ID.
                </p>

                {/* Switch profile link */}
                {onSwitchProfile && (
                    <button
                        type="button"
                        id="btn-switch-profile"
                        onClick={onSwitchProfile}
                        className="mt-2 text-[11px] text-slate-400 hover:text-blue-600 font-semibold underline underline-offset-2 transition-colors"
                    >
                        Not {profile.firstName}? Switch profile
                    </button>
                )}
            </div>

            {/* Error banner */}
            {error && (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-800 text-xs rounded-r-2xl font-medium shadow-sm text-left">
                    <span className="font-bold block mb-0.5">Authentication Note</span>
                    {error}
                </div>
            )}

            {/* Primary verification card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 text-center space-y-3 shadow-sm">
                <div className="w-14 h-14 bg-blue-100/60 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-blue-200/50">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                    <div className="font-bold text-sm text-slate-900">BioShield Identity Verification</div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Confirm your identity using authoritative local biometric feature
                        matching and continuous device trust.
                    </div>
                </div>

                <button
                    id="btn-verify-identity"
                    type="button"
                    onClick={() => onVerify('FACE')}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-4 rounded-2xl text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-3 transition-all duration-200 mt-4"
                >
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-base">Verify Identity</span>
                </button>
            </div>

            {/* Secondary options */}
            <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Other authentication options
                </span>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        id="btn-voice-unlock"
                        type="button"
                        onClick={() => onVerify('VOICE')}
                        className="flex items-center justify-center space-x-2 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 py-3 rounded-2xl text-xs font-bold text-slate-700 transition-all"
                    >
                        <KeyRound className="w-4 h-4 text-blue-600" />
                        <span>Voice</span>
                    </button>
                    <button
                        id="btn-pin-unlock"
                        type="button"
                        onClick={onPinUnlock}
                        className="flex items-center justify-center space-x-2 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 py-3 rounded-2xl text-xs font-bold text-slate-700 transition-all"
                    >
                        <Lock className="w-4 h-4 text-indigo-600" />
                        <span>Local PIN</span>
                    </button>
                </div>
            </div>

            {/* Device trust footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-1.5">
                    <Monitor className="w-3.5 h-3.5 text-slate-400" />
                    <span>Device Trust: <strong className="text-slate-900 font-bold">ACTIVE</strong></span>
                </div>
                <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-emerald-600">Protected</span>
                </div>
            </div>

        </div>
    );
};

export default UnlockView;
