import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    User, ShieldCheck, AlertTriangle, Activity, Calendar, CheckCircle2,
    Lock, KeyRound, ArrowLeft, Trash2, Edit3, Save, RefreshCw, X, Fingerprint,
    Mic, ScanFace, BrainCircuit, ShieldAlert
} from 'lucide-react';
import { LocalProfile } from '../../types';
import { localProfileService } from '../../services/localProfileService';
import { authFlowService } from '../../services/authFlowService';
import { authFlowController } from '../../services/authFlowController';

export const ProfileDetails: React.FC = () => {
    const { profileId } = useParams<{ profileId: string }>();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<LocalProfile | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    
    // Change PIN state
    const [showChangePin, setShowChangePin] = useState(false);
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);
    const [pinSuccess, setPinSuccess] = useState<string | null>(null);

    // Delete confirmation state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePin, setDeletePin] = useState('');
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        if (!profileId) {
            navigate('/profiles');
            return;
        }
        const found = localProfileService.getProfile(profileId);
        if (!found) {
            navigate('/profiles');
            return;
        }
        setProfile(found);
        setFirstName(found.firstName);
        setLastName(found.lastName);
    }, [profileId, navigate]);

    if (!profile) return null;

    const handleSaveName = (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName.trim()) return;
        localProfileService.renameProfile(profile.id, firstName, lastName);
        const updated = localProfileService.getProfile(profile.id);
        if (updated) setProfile(updated);
        setIsEditingName(false);
    };

    const handleChangePin = (e: React.FormEvent) => {
        e.preventDefault();
        setPinError(null);
        setPinSuccess(null);

        if (!localProfileService.validatePin(profile.id, oldPin)) {
            setPinError('Current PIN is incorrect.');
            return;
        }
        if (newPin.length < 4) {
            setPinError('New PIN must be at least 4 digits.');
            return;
        }
        if (newPin !== confirmPin) {
            setPinError('New PINs do not match.');
            return;
        }

        localProfileService.updatePin(profile.id, newPin);
        setPinSuccess('PIN updated successfully!');
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => setShowChangePin(false), 1500);
    };

    const handleDeleteProfile = (e: React.FormEvent) => {
        e.preventDefault();
        setDeleteError(null);

        if (!localProfileService.validatePin(profile.id, deletePin)) {
            setDeleteError('Incorrect PIN. Deletion unauthorized.');
            return;
        }

        const res = localProfileService.deleteProfile(profile.id);
        if (!res.success) {
            setDeleteError(res.error || 'Failed to delete profile.');
            return;
        }

        navigate('/profiles');
    };

    const handleStepUpVerification = (purpose: 'REENROLL_FACE' | 'REENROLL_VOICE') => {
        localProfileService.setActiveProfile(profile.id);
        authFlowController.startSecureAction(purpose, 'MODIFY_BIOMETRICS', profile.id);
        authFlowService.start();
        navigate(purpose === 'REENROLL_VOICE' ? '/verify/voice' : '/verify/face');
    };

    const formatDate = (ms: number) => {
        return new Date(ms).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const palette = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-emerald-600'];
    const avatarBg = palette[profile.id.charCodeAt(profile.id.length - 1) % palette.length];

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in font-sans">
            
            {/* Top Navigation */}
            <button
                type="button"
                onClick={() => navigate('/profiles')}
                className="inline-flex items-center space-x-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl"
            >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Profile List</span>
            </button>

            {/* Profile Header Card */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center space-x-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-white text-2xl shadow-md shrink-0 ${avatarBg}`}>
                        {profile.initials}
                    </div>
                    {isEditingName ? (
                        <form onSubmit={handleSaveName} className="flex items-center space-x-2">
                            <input
                                type="text"
                                placeholder="First Name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Last Name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                            />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl">
                                <Save className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => setIsEditingName(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-xl">
                                <X className="w-4 h-4" />
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-1">
                            <div className="flex items-center space-x-2.5">
                                <h1 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                                    {profile.displayName}
                                </h1>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingName(true)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                                    title="Rename profile"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="bg-slate-100 text-slate-700 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    {profile.isPrimary ? 'PRIMARY LOCAL IDENTITY' : 'LOCAL PROFILE'}
                                </span>
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>ENROLLED</span>
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-left md:text-right font-mono text-xs text-slate-500 space-y-1 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 w-full md:w-auto">
                    <div>ID: <span className="text-slate-800 font-bold">{profile.id}</span></div>
                    <div>Registered: <span className="text-slate-800 font-bold">{formatDate(profile.createdAt)}</span></div>
                </div>
            </div>

            {/* Biometric Factors Section */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                        <h2 className="text-lg font-extrabold text-slate-900 font-mono uppercase tracking-tight flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                            <span>Biometric Verification Factors</span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            Enrolled biometric algorithms and real-time comparison capabilities.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                    
                    {/* Face Recognition */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                                    <ScanFace className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-900">Face Recognition</div>
                                    <div className="text-[11px] text-slate-500">3D Face Mesh & Liveness</div>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Active</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200/60">
                            <button
                                type="button"
                                onClick={() => handleStepUpVerification('REENROLL_FACE')}
                                className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-300 transition-colors flex items-center space-x-1.5"
                            >
                                <RefreshCw className="w-3 h-3 text-slate-500" />
                                <span>Re-enroll</span>
                            </button>
                        </div>
                    </div>

                    {/* Voice Recognition */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                                    <Mic className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-900">Voice Verification</div>
                                    <div className="text-[11px] text-slate-500">MFCC-128 / Cosine Similarity</div>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Active</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200/60">
                            <button
                                type="button"
                                onClick={() => handleStepUpVerification('REENROLL_VOICE')}
                                className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-300 transition-colors flex items-center space-x-1.5"
                            >
                                <RefreshCw className="w-3 h-3 text-slate-500" />
                                <span>Re-enroll</span>
                            </button>
                        </div>
                    </div>

                    {/* Fingerprint DEV BYPASS */}
                    <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                                    <Fingerprint className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-900">Fingerprint Sensor</div>
                                    <div className="text-[11px] text-amber-700 font-medium">Dev Placeholder Bypass</div>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Dev Bypass</span>
                            </span>
                        </div>
                        <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                            Hardware integration pending. Fingerprint factor explicitly bypasses verification in developer builds.
                        </div>
                    </div>

                    {/* Cognitive & Behavioral */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2.5 bg-violet-100 text-violet-700 rounded-xl">
                                    <BrainCircuit className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-900">Cognitive & Behavioral</div>
                                    <div className="text-[11px] text-slate-500">Continuous Trust Calibration</div>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                <Activity className="w-3 h-3 animate-pulse" />
                                <span>Learning</span>
                            </span>
                        </div>
                        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                            <span>Trust Score Calibration</span>
                            <span className="font-bold text-slate-800">98.4% Nominal</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Security Credential Settings */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                        <h2 className="text-lg font-extrabold text-slate-900 font-mono uppercase tracking-tight flex items-center gap-2">
                            <Lock className="w-5 h-5 text-indigo-600" />
                            <span>Security Credentials</span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            Local PIN fallback and device binding credentials.
                        </p>
                    </div>
                    {!showChangePin && (
                        <button
                            type="button"
                            onClick={() => setShowChangePin(true)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs border border-indigo-200 transition-colors flex items-center space-x-1.5 font-mono"
                        >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Change Local PIN</span>
                        </button>
                    )}
                </div>

                {showChangePin ? (
                    <form onSubmit={handleChangePin} className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-4 max-w-md">
                        <h3 className="text-sm font-bold font-mono uppercase text-slate-800">Update Local PIN</h3>
                        
                        {pinError && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs rounded font-bold">{pinError}</div>}
                        {pinSuccess && <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs rounded font-bold">{pinSuccess}</div>}

                        <div className="space-y-3 font-mono text-xs">
                            <div>
                                <label className="block text-slate-600 mb-1">Current PIN</label>
                                <input
                                    type="password"
                                    value={oldPin}
                                    onChange={(e) => setOldPin(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-600 mb-1">New PIN (min 4 digits)</label>
                                <input
                                    type="password"
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-600 mb-1">Confirm New PIN</label>
                                <input
                                    type="password"
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 pt-2">
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs">
                                Save New PIN
                            </button>
                            <button type="button" onClick={() => setShowChangePin(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs">
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex items-center justify-between font-mono text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="flex items-center space-x-3">
                            <KeyRound className="w-4 h-4 text-slate-400" />
                            <div>
                                <div className="font-bold text-slate-900">Local PIN Authorization</div>
                                <div className="text-[11px] text-slate-500">Configured as offline fallback & authorization factor</div>
                            </div>
                        </div>
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            ✓ Configured
                        </span>
                    </div>
                )}
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50/40 border border-red-200 rounded-[28px] p-6 md:p-8 shadow-sm space-y-6">
                <div className="space-y-1">
                    <h2 className="text-lg font-extrabold text-red-900 font-mono uppercase tracking-tight flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-600" />
                        <span>Danger Zone</span>
                    </h2>
                    <p className="text-xs text-red-700 font-medium">
                        Irreversible identity removal and biometric credential revocation.
                    </p>
                </div>

                {profile.isPrimary ? (
                    <div className="bg-white/80 border border-red-200 rounded-2xl p-5 text-xs font-mono text-red-800 flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="font-bold">Primary Local Identity Protected</div>
                            <div className="text-[11px] text-red-600">
                                The primary device identity cannot be removed without performing a full device reset.
                            </div>
                        </div>
                        <button type="button" disabled className="bg-slate-200 text-slate-400 font-bold px-4 py-2 rounded-xl cursor-not-allowed shrink-0 ml-4">
                            Remove Profile
                        </button>
                    </div>
                ) : showDeleteConfirm ? (
                    <form onSubmit={handleDeleteProfile} className="bg-white border border-red-300 p-6 rounded-2xl space-y-4 font-mono">
                        <h3 className="text-sm font-bold text-red-900 uppercase">Confirm Identity Removal</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Please enter the PIN for <strong>{profile.displayName}</strong> to authorize permanent removal from this device. All encrypted biometric hashes will be destroyed.
                        </p>

                        {deleteError && <div className="p-3 bg-red-100 text-red-900 text-xs font-bold rounded">{deleteError}</div>}

                        <div>
                            <input
                                type="password"
                                placeholder="Enter PIN to confirm deletion"
                                value={deletePin}
                                onChange={(e) => setDeletePin(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 max-w-sm"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center space-x-3 pt-2">
                            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-md">
                                <Trash2 className="w-4 h-4" />
                                <span>Permanently Remove Profile</span>
                            </button>
                            <button type="button" onClick={() => setShowDeleteConfirm(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs">
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="bg-white/80 border border-red-200 rounded-2xl p-5 flex items-center justify-between text-xs font-mono">
                        <div className="space-y-1">
                            <div className="font-bold text-slate-900">Remove Local Profile</div>
                            <div className="text-[11px] text-slate-500">
                                Permanently delete this user profile and revoke access to BioShield.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition-colors shrink-0 ml-4 shadow-sm"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove Profile</span>
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
};

export default ProfileDetails;
