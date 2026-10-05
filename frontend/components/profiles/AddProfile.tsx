import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Check, Fingerprint, AlertTriangle, Lock, CheckCircle2, User, Eye, LogOut } from 'lucide-react';
import { localProfileService } from '../../services/localProfileService';
import { authFlowService } from '../../services/authFlowService';
import { FaceEnrollmentCeremony } from '../FaceEnrollmentCeremony';
import { VoiceEnrollmentCeremony } from '../VoiceEnrollmentCeremony';
import { adminApi } from '../../services/adminApi';
import StepUpModal from '../StepUpModal';

type WizardStep = 'FORM' | 'PASSWORD' | 'FACE' | 'VOICE' | 'REVIEW' | 'SUCCESS';

interface PendingLocalProfile {
    enrollmentId: string;
    firstName: string;
    lastName: string;
    displayName: string;
    role: 'USER' | 'ADMIN';
    faceEnrolled: boolean;
    voiceEnrolled: boolean;
    passwordConfigured: boolean;
    password?: string;
    email?: string;
}

export const AddProfile: React.FC = () => {
    const navigate = useNavigate();

    // Authorizing profile info (now backend handles trust)
    const [authorizingName, setAuthorizingName] = useState<string>('Primary Admin');

    // Wizard step state
    const [step, setStep] = useState<WizardStep>('FORM');

    // Transactional profile state
    const [pendingProfile, setPendingProfile] = useState<PendingLocalProfile | null>(null);

    // Form input state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);

    useEffect(() => {
        // Resolve authorizing user name
        const authId = sessionStorage.getItem('bioshield_authorizing_profile_id');
        if (authId) {
            const prof = localProfileService.getProfile(authId);
            if (prof) {
                setAuthorizingName(prof.displayName);
                return;
            }
        }
        const profiles = localProfileService.listProfiles();
        const primary = profiles.find(p => p.isPrimary) || profiles[0];
        if (primary) {
            setAuthorizingName(primary.displayName);
        }
    }, []);

    const handleCancel = () => {
        navigate('/profiles', { replace: true });
    };

    const handleFormContinue = () => {
        setError(null);
        if (!firstName.trim() || !lastName.trim()) {
            setError('Please enter both First Name and Last Name.');
            return;
        }
        setStep('PASSWORD');
    };

    const handlePasswordSubmit = async () => {
        setError(null);
        if (!password.trim() || password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const resolvedDisplayName = displayName.trim() || `${firstName.trim()} ${lastName.trim()}`;
        const email = `${firstName.toLowerCase().trim()}.${lastName.toLowerCase().trim()}@bioshield.local`;
        
        try {
            const data = await adminApi.createUser(email, role, resolvedDisplayName, password);

            setEnrollmentToken(data.enrollmentToken);
            setPendingProfile({
                enrollmentId: data.data.id,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                displayName: resolvedDisplayName,
                role,
                faceEnrolled: false,
                voiceEnrolled: false,
                passwordConfigured: true,
                email
            });
            setStep('FACE');
        } catch (err: any) {
            setError(err.message || 'Failed to create user');
        }
    };

    const handleCommitProfile = () => {
        setError(null);
        if (!pendingProfile) return;

        const valid =
            pendingProfile.enrollmentId &&
            pendingProfile.faceEnrolled &&
            pendingProfile.voiceEnrolled &&
            pendingProfile.passwordConfigured;

        if (!valid) {
            setError('User enrollment is incomplete. Face and Voice must be enrolled.');
            return;
        }

        try {
            // Create local profile registry card synchronized to DB userId
            localProfileService.createProfile({
                id: pendingProfile.enrollmentId,
                firstName: pendingProfile.firstName,
                lastName: pendingProfile.lastName,
                displayName: pendingProfile.displayName,
                role: pendingProfile.role,
                userId: pendingProfile.enrollmentId,
                email: pendingProfile.email,
                enrollment: {
                    face: true,
                    voice: true,
                    pin: false
                }
            });
            localProfileService.markEnrollmentComplete(pendingProfile.enrollmentId, { face: true, voice: true });
        } catch (err: any) {
            console.error("Failed to create local profile registry card:", err);
        }

        setStep('SUCCESS');
    };

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 animate-fade-in">
            {/* Progress Banner / Checklist (Shown during enrollment stages) */}
            {step !== 'FORM' && pendingProfile && (
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 mb-8">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">New Local User</h3>
                            <p className="text-xl font-extrabold text-white mt-0.5">{pendingProfile.displayName}</p>
                        </div>
                        <span className="bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Stage: {step === 'SUCCESS' ? 'COMPLETE' : step}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-3 text-xs">
                        {/* Profile */}
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
                            <span className="font-medium text-slate-300">Profile</span>
                            <span className="text-emerald-400 font-bold">✓</span>
                        </div>
                        {/* Face */}
                        <div className={`p-3 rounded-xl border flex items-center justify-between ${step === 'FACE' ? 'bg-blue-950/60 border-blue-500/50 text-white' : pendingProfile.faceEnrolled ? 'bg-slate-800/80 border-slate-700/60 text-slate-300' : 'bg-slate-800/40 border-slate-800 text-slate-500'}`}>
                            <span className="font-medium">Face</span>
                            <span>{pendingProfile.faceEnrolled ? <span className="text-emerald-400 font-bold">✓</span> : step === 'FACE' ? <span className="text-blue-400 font-bold">●</span> : '○'}</span>
                        </div>
                        {/* Voice */}
                        <div className={`p-3 rounded-xl border flex items-center justify-between ${step === 'VOICE' ? 'bg-blue-950/60 border-blue-500/50 text-white' : pendingProfile.voiceEnrolled ? 'bg-slate-800/80 border-slate-700/60 text-slate-300' : 'bg-slate-800/40 border-slate-800 text-slate-500'}`}>
                            <span className="font-medium">Voice</span>
                            <span>{pendingProfile.voiceEnrolled ? <span className="text-emerald-400 font-bold">✓</span> : step === 'VOICE' ? <span className="text-blue-400 font-bold">●</span> : '○'}</span>
                                         {/* End of indicators */}                    </div>
                        {/* Review */}
                        <div className={`p-3 rounded-xl border flex items-center justify-between ${step === 'REVIEW' ? 'bg-blue-950/60 border-blue-500/50 text-white' : step === 'SUCCESS' ? 'bg-slate-800/80 border-slate-700/60 text-slate-300' : 'bg-slate-800/40 border-slate-800 text-slate-500'}`}>
                            <span className="font-medium">Review</span>
                            <span>{step === 'SUCCESS' ? <span className="text-emerald-400 font-bold">✓</span> : step === 'REVIEW' ? <span className="text-blue-400 font-bold">●</span> : '○'}</span>
                        </div>
                        {/* Complete */}
                        <div className={`p-3 rounded-xl border flex items-center justify-between ${step === 'SUCCESS' ? 'bg-emerald-950/60 border-emerald-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-500'}`}>
                            <span className="font-medium">Complete</span>
                            <span>{step === 'SUCCESS' ? <span className="text-emerald-400 font-bold">✓</span> : '○'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 1: Form */}
            {step === 'FORM' && (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="bg-gradient-to-b from-slate-900 to-slate-800 p-8 text-center text-white relative">
                        <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-400/30 mb-4">
                            <Shield className="w-3.5 h-3.5" />
                            <span>BIOSHIELD.ID</span>
                        </div>
                        <h2 className="text-3xl font-extrabold tracking-tight">ADD LOCAL USER</h2>
                        <p className="text-sm text-slate-300 max-w-md mx-auto mt-2 font-medium">
                            Create another identity protected by BioShield. All identity information remains on this device.
                        </p>
                    </div>

                    {/* Form Body */}
                    <div className="p-8 md:p-10 space-y-6">
                        <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Profile Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">First Name</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={e => { setFirstName(e.target.value); setError(null); }}
                                        placeholder="e.g. Arun"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-900 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Last Name</label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={e => { setLastName(e.target.value); setError(null); }}
                                        placeholder="e.g. Kumar"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-900 bg-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                                    Display Name <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    placeholder={firstName && lastName ? `${firstName} ${lastName}` : "How this name appears on screen"}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-900 bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Profile Type</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRole('USER')}
                                        className={`p-4 rounded-xl border flex items-center space-x-3 text-left transition-all ${role === 'USER' ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${role === 'USER' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>
                                            {role === 'USER' && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">Standard Local User</p>
                                            <p className="text-xs text-slate-500">Standard access & verification</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('ADMIN')}
                                        className={`p-4 rounded-xl border flex items-center space-x-3 text-left transition-all ${role === 'ADMIN' ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${role === 'ADMIN' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>
                                            {role === 'ADMIN' && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">Administrator</p>
                                            <p className="text-xs text-slate-500">Can manage system profiles</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Authorization Badge */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3 text-emerald-800">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
                                <Check className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">Authorization Verified</p>
                                <p className="text-xs text-emerald-700">Authorized by {authorizingName}</p>
                            </div>
                        </div>

                        {error && <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">{error}</div>}

                        {/* Actions */}
                        <div className="flex items-center space-x-4 pt-2">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="flex-1 py-3.5 px-4 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleFormContinue}
                                className="flex-1 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/25 transition-all"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Face Enrollment */}
            {step === 'FACE' && pendingProfile && (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8">
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-extrabold text-slate-900 uppercase">Face Enrollment</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Enroll the face for: <span className="font-bold text-slate-800">{pendingProfile.displayName}</span>
                        </p>
                        <p className="text-xs text-amber-600 font-semibold mt-2 bg-amber-50 inline-block px-3 py-1 rounded-full border border-amber-200">
                            Note: Enrolling {pendingProfile.displayName}'s biometric reference—not {authorizingName}'s.
                        </p>
                    </div>
                    <FaceEnrollmentCeremony
                        profileId={pendingProfile.enrollmentId}
                        enrollmentToken={enrollmentToken || undefined}
                        mode="ADDITIONAL_PROFILE"
                        onEnrollSuccess={() => {
                            setPendingProfile(prev => prev ? { ...prev, faceEnrolled: true } : null);
                            setStep('VOICE');
                        }}
                        onCancel={handleCancel}
                    />
                </div>
            )}

            {/* Step 3: Voice Enrollment */}
            {step === 'VOICE' && pendingProfile && (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8">
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-extrabold text-slate-900 uppercase">Voice Enrollment</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Enroll the voice for: <span className="font-bold text-slate-800">{pendingProfile.displayName}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Record the requested phrases to create voice reference.</p>
                    </div>
                    <VoiceEnrollmentCeremony
                        profileId={pendingProfile.enrollmentId}
                        enrollmentToken={enrollmentToken || undefined}
                        onEnrollSuccess={() => {
                            setPendingProfile(prev => prev ? { ...prev, voiceEnrolled: true } : null);
                            setStep('REVIEW');
                        }}
                        onCancel={handleCancel}
                    />
                </div>
            )}

            {/* Step 2: Password Setup (Moved after Form) */}
            {step === 'PASSWORD' && pendingProfile === null && (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 md:p-10 max-w-xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100">
                            <Lock className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-900 uppercase">Set Password</h2>
                        <p className="text-sm text-slate-500">
                            Create an initial password for <span className="font-bold text-slate-800">{firstName} {lastName}</span>.
                        </p>
                    </div>

                    <div className="space-y-4 max-w-md mx-auto">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Password <span className="text-slate-400 font-normal">(min 8 chars)</span></label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(null); }}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg bg-white"
                            />
                        </div>
                    </div>

                    {error && <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold max-w-md mx-auto">{error}</div>}

                    <div className="flex items-center space-x-4 pt-2 max-w-md mx-auto">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex-1 py-3.5 px-4 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handlePasswordSubmit}
                            className="flex-1 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center space-x-2"
                        >
                            <span>Create Identity</span>
                        </button>
                    </div>
                </div>
            )}

            {step === 'REVIEW' && pendingProfile && (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 space-y-6 animate-fade-in bg-white">
                    <div className="text-center space-y-2">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100">
                            <Eye className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-900 uppercase tracking-tight">Review Identity</h2>
                        <p className="text-sm text-slate-500 font-medium max-w-md mx-auto">
                            Verify biometric and security factors before finalizing.
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 space-y-3 text-left">
                        <div className="flex items-center justify-between text-sm py-2 border-b border-slate-200/60">
                            <span className="font-semibold text-slate-700">Display Name</span>
                            <span className="font-bold text-slate-900">{pendingProfile.displayName}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-2 border-b border-slate-200/60">
                            <span className="font-semibold text-slate-700">Profile Status</span>
                            <span className="font-bold text-emerald-600 flex items-center space-x-1">
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>Pending Approval</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-2 border-b border-slate-200/60">
                            <span className="font-semibold text-slate-700">Face Recognition</span>
                            <span className="font-bold text-emerald-600 flex items-center space-x-1">
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>Enrolled</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-2 border-b border-slate-200/60">
                            <span className="font-semibold text-slate-700">Voice Recognition</span>
                            <span className="font-bold text-emerald-600 flex items-center space-x-1">
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>Enrolled</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-2 border-b border-slate-200/60">
                            <span className="font-semibold text-slate-700">Password</span>
                            <span className="font-bold text-emerald-600 flex items-center space-x-1">
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>Configured</span>
                            </span>
                        </div>
                    </div>

                    {error && <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold max-w-md mx-auto">{error}</div>}

                    <div className="flex items-center space-x-4 pt-2 max-w-md mx-auto">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex-1 py-3.5 px-4 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCommitProfile}
                            className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2"
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Confirm Enrollment</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 5: Success */}
            {step === 'SUCCESS' && pendingProfile && (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 md:p-10 text-center space-y-8 max-w-xl mx-auto animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner border-2 border-emerald-200">
                        <Check className="w-10 h-10 stroke-[3]" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">USER ENROLLED ✓</h2>
                        <p className="text-base text-slate-600 font-medium">
                            <span className="font-bold text-slate-900">{pendingProfile.displayName}</span> has been securely enrolled on this BioShield device.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                navigate('/profiles');
                            }}
                            className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center space-x-2"
                        >
                            <User className="w-5 h-5" />
                            <span>Manage Users</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddProfile;
