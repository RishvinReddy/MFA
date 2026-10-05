import React, { useState } from 'react';
import { Shield, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface MfaUnlockViewProps {
    userId: string;
    sessionId: string;
    onSuccess: (accessToken: string, refreshToken: string, user: any) => void;
    onBack: () => void;
}

export const MfaUnlockView: React.FC<MfaUnlockViewProps> = ({ userId, sessionId, onSuccess, onBack }) => {
    const [code, setCode]           = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError]         = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setVerifying(true);

        try {
            const res = await api.verifyLoginTotp(userId, code, sessionId);
            if (res.success && res.accessToken) {
                onSuccess(res.accessToken, res.refreshToken, res.user);
            } else {
                setError(res.message || "Invalid verification code.");
            }
        } catch (err: any) {
            setError(err.message || "Verification failed.");
        } finally {
            setVerifying(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6 animate-fade-in bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 max-w-md w-full shadow-lg shadow-slate-100/50"
        >
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-blue-200">
                    <Shield className="w-3.5 h-3.5" />
                    <span>MFA Verification</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Two-Factor Authentication</h2>
                <p className="text-xs text-slate-500 mt-2">
                    Enter the 6-digit verification code from your authenticator app.
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs rounded-r-2xl font-medium">
                    <span className="font-bold block mb-0.5">Verification Failed</span>
                    {error}
                </div>
            )}

            {/* TOTP Code input */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block text-center">
                    Authenticator Code
                </label>
                <input
                    id="input-mfa-code"
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    autoFocus
                    disabled={verifying}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 text-center text-2xl font-bold tracking-[0.75em] text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all disabled:opacity-60"
                />
            </div>

            {/* Submit */}
            <button
                id="btn-mfa-submit"
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all"
            >
                {verifying
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Shield className="w-4 h-4" />
                }
                <span>Verify & Complete Login</span>
            </button>

            {/* Back link */}
            <button
                type="button"
                id="btn-mfa-back"
                onClick={onBack}
                className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 text-center transition-colors block"
            >
                Cancel Authentication
            </button>
        </form>
    );
};

export default MfaUnlockView;
