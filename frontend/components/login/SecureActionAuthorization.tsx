import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, KeyRound, AlertTriangle, Loader2, X, UserPlus, Settings } from 'lucide-react';
import { LocalProfile, PendingSecureAction } from '../../types';
import { localProfileService } from '../../services/localProfileService';
import { authFlowService } from '../../services/authFlowService';
import { authFlowController } from '../../services/authFlowController';
import { useNavigate } from 'react-router-dom';

interface SecureActionAuthorizationProps {
    authorizingProfile: LocalProfile;
    action: PendingSecureAction;
    onAuthorizedPin: (authorizedAction?: PendingSecureAction) => void;
    onCancel: () => void;
}

type AuthMethod = 'CHOOSE' | 'PIN';

const SecureActionAuthorization: React.FC<SecureActionAuthorizationProps> = ({
    authorizingProfile,
    action,
    onAuthorizedPin,
    onCancel,
}) => {
    const navigate = useNavigate();
    const [currentAction, setCurrentAction] = useState<PendingSecureAction>(action);
    const [method, setMethod]       = useState<AuthMethod>('CHOOSE');
    const [pin, setPin]             = useState('');
    const [showPin, setShowPin]     = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError]         = useState<string | null>(null);

    useEffect(() => {
        setCurrentAction(action);
    }, [action]);

    const palette = ['bg-blue-100 text-blue-700', 'bg-indigo-100 text-indigo-700', 'bg-violet-100 text-violet-700'];
    const color   = palette[authorizingProfile.id.charCodeAt(3) % palette.length];

    const isManage = currentAction === 'MANAGE_PROFILES';
    const titleText = isManage ? 'Authorize Profile Management' : 'Authorize New User Creation';
    const descText = isManage
        ? 'Verify your identity before managing local identities on this device.'
        : 'Verify your identity before creating another local identity on this device.';

    // ── BioShield biometric authorization ────────────────────────────────────
    const handleBiometricAuth = () => {
        setError(null);
        const purpose = isManage ? 'MANAGE_PROFILES' : 'ADD_LOCAL_USER';
        sessionStorage.setItem('bioshield_auth_purpose', purpose);
        sessionStorage.setItem('bioshield_authorizing_profile_id', authorizingProfile.id);
        authFlowController.startSecureAction(currentAction, purpose, authorizingProfile.id);
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
                const purpose = isManage ? 'MANAGE_PROFILES' : 'ADD_LOCAL_USER';
                sessionStorage.setItem('bioshield_auth_purpose', purpose);
                if (currentAction === 'ADD_LOCAL_USER') {
                    localProfileService.issueAddProfileToken(authorizingProfile.id);
                }
                setVerifying(false);
                onAuthorizedPin(currentAction);
            } else {
                setVerifying(false);
                setError('Invalid PIN. Authorization denied.');
                setPin('');
            }
        }, 600);
    };

    return (
        <div className="space-y-6 animate-fade-in">

            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center space-x-2 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="uppercase">{titleText}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                    {isManage ? 'Profile Management' : 'Add Local User'}
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                    {descText}
                </p>
            </div>

            {/* Authorizing-as card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${color}`}>
                    {authorizingProfile.initials}
                </div>
                <div className="overflow-hidden">
                    <div className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">Authorizing as</div>
                    <div className="font-extrabold text-sm text-slate-900 truncate">{authorizingProfile.displayName}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        {authorizingProfile.isPrimary ? 'Primary Local Profile' : 'Local Identity'}
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3.5 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs rounded-r-2xl font-bold animate-shake">
                    {error}
                </div>
            )}

            {/* ── CHOOSE screen ────────────────────────────────────────────── */}
            {method === 'CHOOSE' && (
                <div className="space-y-3.5">
                    <button
                        id="btn-secure-auth-biometric"
                        type="button"
                        onClick={handleBiometricAuth}
                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold py-4 rounded-2xl text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-3 transition-all"
                    >
                        <ShieldCheck className="w-5 h-5" />
                        <span>Verify Identity (BioShield)</span>
                    </button>

                    <div className="flex items-center space-x-3 py-1">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold">other authorized method</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    <button
                        id="btn-secure-auth-pin"
                        type="button"
                        onClick={() => setMethod('PIN')}
                        className="w-full flex items-center justify-center space-x-2 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 py-3.5 rounded-2xl text-xs font-bold text-slate-700 transition-all shadow-sm"
                    >
                        <Lock className="w-4 h-4 text-indigo-600" />
                        <span>Use Local PIN</span>
                    </button>

                    {/* Profile Actions Switcher */}
                    <div className="pt-4 border-t border-slate-200/80 space-y-2">
                        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest text-center">
                            Profile Actions
                        </div>
                        {isManage ? (
                            <button
                                id="btn-switch-add-user"
                                type="button"
                                onClick={() => {
                                    setCurrentAction('ADD_LOCAL_USER');
                                    sessionStorage.setItem('bioshield_auth_purpose', 'ADD_LOCAL_USER');
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group text-left shadow-sm"
                            >
                                <div>
                                    <p className="font-bold text-xs text-slate-900 group-hover:text-blue-700 flex items-center space-x-1.5">
                                        <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                                        <span>+ Add New Local User</span>
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Create another independent local BioShield identity on this device.</p>
                                </div>
                                <span className="text-slate-400 font-bold group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5">→</span>
                            </button>
                        ) : (
                            <button
                                id="btn-switch-manage-profiles"
                                type="button"
                                onClick={() => {
                                    setCurrentAction('MANAGE_PROFILES');
                                    sessionStorage.setItem('bioshield_auth_purpose', 'MANAGE_PROFILES');
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group text-left shadow-sm"
                            >
                                <div>
                                    <p className="font-bold text-xs text-slate-900 group-hover:text-blue-700 flex items-center space-x-1.5">
                                        <Settings className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Manage Local Profiles</span>
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">View, modify, re-enroll or remove existing local identities.</p>
                                </div>
                                <span className="text-slate-400 font-bold group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5">→</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── PIN entry screen ─────────────────────────────────────────── */}
            {method === 'PIN' && (
                <form onSubmit={handlePinAuth} className="space-y-4 animate-fade-in">
                    <div className="space-y-1.5">
                        <label htmlFor="input-secure-auth-pin" className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider">
                            Local PIN for {authorizingProfile.firstName}
                        </label>
                        <div className="relative">
                            <input
                                id="input-secure-auth-pin"
                                type={showPin ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                required
                                autoFocus
                                disabled={verifying}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3.5 text-sm font-mono text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all disabled:opacity-60"
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
                        id="btn-secure-auth-pin-submit"
                        type="submit"
                        disabled={verifying || !pin}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold py-4 rounded-2xl text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-500/20"
                    >
                        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        <span>Authorize Action</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setMethod('CHOOSE'); setError(null); setPin(''); }}
                        className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-2"
                    >
                        ← Back
                    </button>
                </form>
            )}

            {/* Cancel */}
            {method === 'CHOOSE' && (
                <button
                    id="btn-secure-auth-cancel"
                    type="button"
                    onClick={onCancel}
                    className="w-full flex items-center justify-center space-x-2 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors py-2"
                >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                </button>
            )}

            {/* Token TTL notice */}
            <p className="text-center text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Authorization token expires after 5 minutes of inactivity.</span>
            </p>

        </div>
    );
};

export default SecureActionAuthorization;
