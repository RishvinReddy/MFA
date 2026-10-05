import React, { useState } from 'react';
import { ShieldCheck, Lock, KeyRound, AlertTriangle, Loader2, X } from 'lucide-react';
import { LocalProfile } from '../../types';
import { localProfileService } from '../../services/localProfileService';
import { authFlowService } from '../../services/authFlowService';
import { useNavigate } from 'react-router-dom';

interface AddUserAuthorizationProps {
    /** The profile that must authenticate to authorize the new-user creation. */
    authorizingProfile: LocalProfile;
    onAuthorized: () => void;
    onCancel: () => void;
}

type AuthMethod = 'CHOOSE' | 'PIN' | 'BIOMETRIC';

const AddUserAuthorization: React.FC<AddUserAuthorizationProps> = ({
    authorizingProfile,
    onAuthorized,
    onCancel,
}) => {
    const navigate = useNavigate();
    const [method, setMethod]       = useState<AuthMethod>('CHOOSE');
    const [pin, setPin]             = useState('');
    const [showPin, setShowPin]     = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError]         = useState<string | null>(null);

    // Derive colour for avatar
    const palette = ['bg-blue-100 text-blue-700', 'bg-indigo-100 text-indigo-700', 'bg-violet-100 text-violet-700'];
    const color   = palette[authorizingProfile.id.charCodeAt(3) % palette.length];

    // ── BioShield biometric authorization ────────────────────────────────────
    const handleBiometricAuth = () => {
        setError(null);

        // Record which profile is authorizing BEFORE starting the flow.
        // The flow service will verify identity via the standard pipeline.
        // On completion, FinalizingVerification will call back via the normal
        // onLogin handler. To differentiate "auth for adding user" from a normal
        // login, we store the intent in sessionStorage.
        sessionStorage.setItem('bioshield_pending_intent', 'ADD_LOCAL_PROFILE');
        sessionStorage.setItem('bioshield_intent_profile', authorizingProfile.id);

        authFlowService.start();
        navigate('/verify/face');
    };

    // ── PIN authorization ─────────────────────────────────────────────────────
    const handlePinAuth = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setVerifying(true);

        setTimeout(() => {
            const valid = localProfileService.validatePin(authorizingProfile.id, pin);
            if (valid) {
                localProfileService.issueAddProfileToken(authorizingProfile.id);
                setVerifying(false);
                onAuthorized();
            } else {
                setVerifying(false);
                setError('Invalid PIN. Authorization denied.');
                setPin('');
            }
        }, 700);
    };

    return (
        <div className="space-y-6 animate-fade-in">

            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center space-x-2 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Authorize Profile Creation</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Add Local User
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                    Adding another local identity requires verification
                    by an authorized profile holder.
                </p>
            </div>

            {/* Authorizing-as card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${color}`}>
                    {authorizingProfile.initials}
                </div>
                <div>
                    <div className="text-xs text-slate-400 font-medium">Authorizing as</div>
                    <div className="font-bold text-sm text-slate-900">{authorizingProfile.displayName}</div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs rounded-r-2xl font-medium">
                    {error}
                </div>
            )}

            {/* ── CHOOSE screen ────────────────────────────────────────────── */}
            {method === 'CHOOSE' && (
                <div className="space-y-3">
                    <button
                        id="btn-adduser-biometric"
                        type="button"
                        onClick={handleBiometricAuth}
                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-4 rounded-2xl text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-3 transition-all"
                    >
                        <ShieldCheck className="w-5 h-5" />
                        <span>Verify with BioShield</span>
                    </button>

                    <div className="flex items-center space-x-3">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[11px] text-slate-400 font-medium">other authorized method</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    <button
                        id="btn-adduser-pin"
                        type="button"
                        onClick={() => setMethod('PIN')}
                        className="w-full flex items-center justify-center space-x-2 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 py-3 rounded-2xl text-xs font-bold text-slate-700 transition-all"
                    >
                        <Lock className="w-4 h-4 text-indigo-600" />
                        <span>Use Local PIN</span>
                    </button>
                </div>
            )}

            {/* ── PIN entry screen ─────────────────────────────────────────── */}
            {method === 'PIN' && (
                <form onSubmit={handlePinAuth} className="space-y-4 animate-fade-in">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Local PIN for {authorizingProfile.firstName}
                        </label>
                        <div className="relative">
                            <input
                                id="input-adduser-pin"
                                type={showPin ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                required
                                autoFocus
                                disabled={verifying}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all disabled:opacity-60"
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setShowPin(!showPin)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPin ? <KeyRound className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        id="btn-adduser-pin-submit"
                        type="submit"
                        disabled={verifying || !pin}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center space-x-2 transition-all"
                    >
                        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <span>Authorize</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setMethod('CHOOSE'); setError(null); setPin(''); }}
                        className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        ← Back
                    </button>
                </form>
            )}

            {/* Cancel */}
            {method === 'CHOOSE' && (
                <button
                    id="btn-adduser-cancel"
                    type="button"
                    onClick={onCancel}
                    className="w-full flex items-center justify-center space-x-2 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                </button>
            )}

            {/* Token TTL notice */}
            <p className="text-center text-[10px] text-slate-400">
                Authorization is valid for 5 minutes once issued.
            </p>

        </div>
    );
};

export default AddUserAuthorization;
