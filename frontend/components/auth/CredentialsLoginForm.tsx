import React, { useState } from 'react';
import { Lock, AlertCircle, ArrowRight, UserCheck, KeyRound } from 'lucide-react';
import { LocalProfile } from '../../types';

interface CredentialsLoginFormProps {
    profile: LocalProfile | null;
    onSuccess: (sessionId: string, userId: string, email: string, role: string) => void;
    onEnrollmentResume?: (userId: string, enrollmentToken: string, email: string) => void;
    onSwitchProfile?: () => void;
    onRegisterNew?: () => void;
}

export const CredentialsLoginForm: React.FC<CredentialsLoginFormProps> = ({
    profile,
    onSuccess,
    onEnrollmentResume,
    onSwitchProfile,
    onRegisterNew
}) => {
    const [email, setEmail] = useState<string>(profile?.email || '');
    const [password, setPassword] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const targetEmail = profile?.email || email;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) {
            setError('Please enter your account password.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: targetEmail,
                    password
                })
            });

            const data = await res.json();

            if (res.ok && data.requiresEnrollment && onEnrollmentResume) {
                // Interrupted / incomplete registration detected!
                onEnrollmentResume(data.userId, data.enrollmentToken, targetEmail);
                return;
            }

            if (res.ok && data.success && data.sessionId) {
                onSuccess(data.sessionId, data.userId, targetEmail, data.role || 'USER');
            } else {
                throw new Error(data.message || 'Invalid credentials');
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed. Please check your password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto space-y-4">
            {/* Selected Profile Badge */}
            {profile && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-blue-500/20">
                            {profile.initials}
                        </div>
                        <div className="text-left">
                            <div className="font-extrabold text-xs text-slate-900">{profile.displayName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{profile.email}</div>
                        </div>
                    </div>

                    {onSwitchProfile && (
                        <button
                            type="button"
                            onClick={onSwitchProfile}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            Switch
                        </button>
                    )}
                </div>
            )}

            {/* Email Field if no profile card selected */}
            {!profile && (
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 text-left">
                        Account Email Address
                    </label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl text-sm outline-none transition-all shadow-sm"
                    />
                </div>
            )}

            {/* Password Input */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 text-left">
                    Account Password
                </label>
                <div className="relative">
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl text-sm outline-none transition-all shadow-sm"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center space-x-2 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2"
            >
                <span>{loading ? 'Authenticating...' : 'Sign In with Password'}</span>
                <ArrowRight className="w-4 h-4" />
            </button>

            {/* Register New Account Link */}
            {onRegisterNew && (
                <div className="pt-2 text-center">
                    <button
                        type="button"
                        onClick={onRegisterNew}
                        className="text-xs text-slate-500 hover:text-blue-600 font-bold transition-colors"
                    >
                        Don't have an account? <span className="text-blue-600 underline">Register Now</span>
                    </button>
                </div>
            )}
        </form>
    );
};

export default CredentialsLoginForm;
