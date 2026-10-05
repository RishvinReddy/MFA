import React, { useState, useRef } from 'react';
import { Eye, EyeOff, ArrowRight, Loader2, Lock, Mail, ShieldAlert } from 'lucide-react';
import { LocalProfile } from '../../types';

interface PasswordUnlockViewProps {
    profile: LocalProfile;
    onSuccess: (sessionId: string, userId: string, email: string, role: string) => void;
    onEnrollmentResume?: (userId: string, enrollmentToken: string, email: string) => void;
    onBack: () => void;
}

const PasswordUnlockView: React.FC<PasswordUnlockViewProps> = ({ profile, onSuccess, onEnrollmentResume, onBack }) => {
    const [email, setEmail]           = useState(profile.email || '');
    const [password, setPassword]     = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [verifying, setVerifying]   = useState(false);
    const [error, setError]           = useState<string | null>(null);
    const [customLogin, setCustomLogin] = useState(!profile.email);

    // Keystroke telemetry
    const lastKeyTimeRef    = useRef<number>(0);
    const lastKeyReleaseRef = useRef<number>(0);

    const handleKeyDown = () => { lastKeyTimeRef.current = Date.now(); };
    const handleKeyUp   = () => { lastKeyReleaseRef.current = Date.now(); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setVerifying(true);

        const targetEmail = customLogin ? email.trim() : (profile.email || '');
        if (!targetEmail) {
            setError('Please enter a valid email address.');
            setVerifying(false);
            return;
        }

        try {
            const res = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: targetEmail,
                    password,
                    deviceFingerprint: 'workstation-desktop'
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || data.error?.message || 'Invalid email or password.');
            }

            setVerifying(false);
            if (data.requiresEnrollment) {
                if (onEnrollmentResume) {
                    onEnrollmentResume(data.userId, data.enrollmentToken, targetEmail);
                } else {
                    setError("Account enrollment incomplete. Please contact an administrator.");
                }
            } else {
                onSuccess(data.sessionId, data.userId, targetEmail, profile.role);
            }
        } catch (err: any) {
            setVerifying(false);
            setError(err.message || 'Authentication failed. Please verify your credentials.');
            setPassword('');
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6 animate-fade-in"
        >
            {/* Header */}
            <div>
                <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mb-2 border border-blue-200">
                    <Lock className="w-3.5 h-3.5" />
                    <span>BioShield Login Gateway</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Security Credentials</h2>
                <p className="text-xs text-slate-500 mt-1">
                    Enter backend password to verify identity for{' '}
                    <strong className="text-slate-900">{profile.displayName}</strong>.
                </p>
            </div>

            {/* Warn if profile is unmapped */}
            {!profile.email && !customLogin && (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 text-xs rounded-r-2xl font-medium flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold block mb-0.5">Account Setup Required</span>
                        This profile is not mapped to any backend database account. Please sign in using your backend credentials below.
                    </div>
                </div>
            )}

            {/* Error display */}
            {error && (
                <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-xs rounded-r-2xl font-medium">
                    <span className="font-bold block mb-0.5">Authentication Failed</span>
                    {error}
                </div>
            )}

            {/* Input fields */}
            <div className="space-y-4">
                {/* Email (only shown if custom login is active or profile has no email) */}
                {customLogin ? (
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                            Account Email
                        </label>
                        <div className="relative">
                            <input
                                id="input-login-email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={verifying}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all disabled:opacity-60"
                            />
                            <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mapped Identity</span>
                            <span className="text-sm font-semibold text-slate-800">{profile.email}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCustomLogin(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                        >
                            Use different email
                        </button>
                    </div>
                )}

                {/* Password */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Account Password
                    </label>
                    <div className="relative">
                        <input
                            id="input-login-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onKeyUp={handleKeyUp}
                            required
                            autoFocus
                            disabled={verifying}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all disabled:opacity-60"
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Submit */}
            <button
                id="btn-login-submit"
                type="submit"
                disabled={verifying || !password || (customLogin && !email)}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all"
            >
                {verifying
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ArrowRight className="w-4 h-4" />
                }
                <span>Authenticate Credentials</span>
            </button>

            {/* Back link */}
            <button
                type="button"
                id="btn-login-back"
                onClick={onBack}
                className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 text-center transition-colors"
            >
                ← Back to Profile Selection
            </button>
        </form>
    );
};

export default PasswordUnlockView;
