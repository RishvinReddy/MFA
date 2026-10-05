import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, UserPlus, ShieldCheck, AlertTriangle, Activity,
    Calendar, CheckCircle2, ChevronRight, Lock, HardDrive, Shield, RefreshCw
} from 'lucide-react';
import { LocalProfile } from '../../types';
import { localProfileService } from '../../services/localProfileService';

export const ProfileManagement: React.FC = () => {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState<LocalProfile[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        const list = localProfileService.listProfiles();
        setProfiles(list);
        const active = list.find(p => p.id === localStorage.getItem('bioshield_active_profile')) || list[0] || null;
        if (active) setActiveId(active.id);
    }, []);

    const handleReverify = (profile: LocalProfile) => {
        localProfileService.setActiveProfile(profile.id);
        navigate('/verify/face');
    };

    const handleAddUser = () => {
        navigate('/profiles/add');
    };

    const formatDate = (ms: number) => {
        return new Date(ms).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const palette = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-emerald-600'];

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 animate-fade-in font-sans">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Local-First Registry</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                        LOCAL PROFILE MANAGEMENT
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">
                        Manage authoritative identities enrolled on this BioShield hardware device.
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        id="btn-profile-mgmt-add-user"
                        type="button"
                        onClick={handleAddUser}
                        className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold px-5 py-3 rounded-2xl text-xs shadow-lg shadow-blue-500/25 transition-all"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>+ Add Local User</span>
                    </button>
                </div>
            </div>

            {/* Profiles counter badge */}
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                <span>ENROLLED DEVICE IDENTITIES</span>
                <span>{profiles.length} {profiles.length === 1 ? 'USER' : 'USERS'} REGISTERED</span>
            </div>

            {/* Profiles Grid */}
            {profiles.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
                    <Users className="w-12 h-12 text-slate-300 mx-auto" />
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-800">No local profiles found</h3>
                        <p className="text-xs text-slate-500">The device identity store is currently empty.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddUser}
                        className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs"
                    >
                        Register Primary Profile
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {profiles.map((profile, idx) => {
                        const isActive = profile.id === activeId || (idx === 0 && !activeId);
                        const avatarBg = palette[profile.id.charCodeAt(profile.id.length - 1) % palette.length];

                        return (
                            <div
                                key={profile.id}
                                className={`bg-white border rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden ${
                                    isActive ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200'
                                }`}
                            >
                                {/* Top status banner */}
                                <div className="flex items-start justify-between pb-5 border-b border-slate-100">
                                    <div className="flex items-center space-x-3.5">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-white text-base shadow-sm shrink-0 ${avatarBg}`}>
                                            {profile.initials}
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                                                {profile.displayName}
                                            </h3>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                    {profile.isPrimary ? 'PRIMARY' : 'LOCAL PROFILE'}
                                                </span>
                                                {isActive && (
                                                    <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.2 rounded-md text-[10px] font-bold">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span>ACTIVE</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right font-mono text-[11px] text-slate-400">
                                        <div className="flex items-center justify-end space-x-1">
                                            <Calendar className="w-3 h-3" />
                                            <span>Created</span>
                                        </div>
                                        <div className="font-bold text-slate-600 mt-0.5">
                                            {formatDate(profile.createdAt)}
                                        </div>
                                    </div>
                                </div>

                                {/* Enrollment checklist */}
                                <div className="py-5 space-y-3 font-mono text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 flex items-center space-x-2">
                                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                            <span>Face Reference</span>
                                        </span>
                                        <span className={`font-bold ${profile.enrollment.face ? 'text-emerald-700' : 'text-slate-400'}`}>
                                            {profile.enrollment.face ? '✓ Enrolled' : '○ Pending'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 flex items-center space-x-2">
                                            <Activity className="w-4 h-4 text-emerald-600" />
                                            <span>Voice Reference</span>
                                        </span>
                                        <span className={`font-bold ${profile.enrollment.voice ? 'text-emerald-700' : 'text-slate-400'}`}>
                                            {profile.enrollment.voice ? '✓ Enrolled' : '○ Pending'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 flex items-center space-x-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            <span>Fingerprint</span>
                                        </span>
                                        <span className="text-amber-600 font-bold text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                            ⚠ Dev Bypass
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 flex items-center space-x-2">
                                            <Lock className="w-4 h-4 text-indigo-600" />
                                            <span>Local PIN Hash</span>
                                        </span>
                                        <span className="text-emerald-700 font-bold flex items-center space-x-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Registered</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Actions footer */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                                    <button
                                        id={`btn-manage-profile-${profile.id}`}
                                        type="button"
                                        onClick={() => navigate(`/profiles/${profile.id}`)}
                                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-sm"
                                    >
                                        <span>Manage Profile</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        id={`btn-reverify-profile-${profile.id}`}
                                        type="button"
                                        onClick={() => handleReverify(profile)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-3.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 border border-slate-200/80"
                                        title="Re-verify identity via biometric pipeline"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Re-verify</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Prominent Add New Local User button at bottom of profile grid */}
            {profiles.length > 0 && (
                <div className="flex justify-center pt-2">
                    <button
                        id="btn-profile-mgmt-add-new-user-bottom"
                        type="button"
                        onClick={handleAddUser}
                        className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-8 py-4 rounded-2xl text-sm shadow-xl transition-all border border-slate-700/60 hover:border-slate-600 group"
                    >
                        <UserPlus className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span>+ Add New Local User</span>
                    </button>
                </div>
            )}

            {/* Bottom info banner */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between text-xs font-mono text-slate-500">
                <div className="flex items-center space-x-2.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span>Authoritative local identity store · Protected by TPM/VBS attestation</span>
                </div>
                <div className="flex items-center space-x-2">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>AES-GCM Local Encryption</span>
                </div>
            </div>

        </div>
    );
};

export default ProfileManagement;
