import React, { useState } from 'react';
import { User, Mail, Lock, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

interface AccountSetupFormProps {
    onSuccess: (data: { userId: string; enrollmentToken: string; email: string; fullName: string }) => void;
    onCancel?: () => void;
}

export const AccountSetupForm: React.FC<AccountSetupFormProps> = ({ onSuccess, onCancel }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('USER');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
            const res = await fetch('http://localhost:8080/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    fullName,
                    role
                })
            });

            const data = await res.json();
            if (res.ok && data.success && data.enrollmentToken) {
                onSuccess({
                    userId: data.userId,
                    enrollmentToken: data.enrollmentToken,
                    email,
                    fullName
                });
            } else {
                throw new Error(data.error?.message || data.message || 'Account registration failed');
            }
        } catch (err: any) {
            setError(err.message || 'Registration error. Please check your inputs.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto space-y-3 text-left">
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        First Name
                    </label>
                    <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl text-sm outline-none transition-all shadow-sm"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Last Name
                    </label>
                    <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl text-sm outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Email Address
                </label>
                <div className="relative">
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john.doe@example.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl text-sm outline-none transition-all shadow-sm"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
            </div>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Account Password
                </label>
                <div className="relative">
                    <input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl text-sm outline-none transition-all shadow-sm"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
            </div>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Confirm Password
                </label>
                <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl text-sm outline-none transition-all shadow-sm"
                />
            </div>

            {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 mt-2"
            >
                <span>{loading ? 'Creating Account...' : 'Continue to Face Enrollment'}</span>
                <ArrowRight className="w-4 h-4" />
            </button>
        </form>
    );
};

export default AccountSetupForm;
