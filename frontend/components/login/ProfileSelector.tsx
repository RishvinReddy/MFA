import React from 'react';
import { ChevronRight, UserPlus, Shield, Lock } from 'lucide-react';
import { LocalProfile } from '../../types';

interface ProfileSelectorProps {
    profiles: LocalProfile[];
    recentProfileId: string | null;
    onSelect: (profile: LocalProfile) => void;
    onAddUser: () => void;
}

/** Generates a deterministic soft color pair from a profile id */
function profileColor(id: string): { bg: string; text: string } {
    const palette = [
        { bg: 'bg-blue-100',   text: 'text-blue-700'   },
        { bg: 'bg-indigo-100', text: 'text-indigo-700' },
        { bg: 'bg-violet-100', text: 'text-violet-700' },
        { bg: 'bg-emerald-100',text: 'text-emerald-700'},
        { bg: 'bg-amber-100',  text: 'text-amber-700'  },
        { bg: 'bg-rose-100',   text: 'text-rose-700'   },
    ];
    const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return palette[hash % palette.length];
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
    profiles,
    recentProfileId,
    onSelect,
    onAddUser,
}) => {
    // Cap visible profiles at 5 — scroll handles the rest
    const visible = profiles;
    const hasMore = profiles.length > 5;

    return (
        <div className="space-y-6 animate-fade-in">

            {/* Header */}
            <div className="text-center space-y-1">
                <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 mb-2">
                    <Shield className="w-3.5 h-3.5" />
                    <span>BioShield.ID</span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Who is using BioShield?
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                    Select your local identity to continue.
                </p>
            </div>

            {/* Profile cards — scrollable region if needed */}
            <div className="space-y-2.5 profile-list pr-1">
                {visible.map((profile) => {
                    const color    = profileColor(profile.id);
                    const isRecent = profile.id === recentProfileId;

                    return (
                        <button
                            key={profile.id}
                            id={`btn-select-profile-${profile.id}`}
                            type="button"
                            onClick={() => onSelect(profile)}
                            className={`
                                w-full flex items-center space-x-4 p-4 rounded-2xl border text-left
                                transition-all duration-200 group
                                hover:shadow-md active:scale-[0.99]
                                ${isRecent
                                    ? 'border-blue-300 bg-blue-50/60 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}
                            `}
                        >
                            {/* Avatar initials */}
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base flex-shrink-0 ${color.bg} ${color.text}`}>
                                {profile.initials}
                            </div>

                            {/* Name + role */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                    <span className="font-bold text-sm text-slate-900 truncate">
                                        {profile.displayName}
                                    </span>
                                    {profile.isPrimary && (
                                        <span className="flex-shrink-0 text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-200">
                                            Primary
                                        </span>
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                    {profile.isPrimary ? 'Primary Local Profile' : 'Local Profile'}
                                    {isRecent && (
                                        <span className="ml-1.5 text-blue-500">· Recently used</span>
                                    )}
                                </div>
                            </div>

                            {/* Arrow */}
                            <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${isRecent ? 'text-blue-400' : 'text-slate-300'}`} />
                        </button>
                    );
                })}

                {hasMore && (
                    <p className="text-center text-xs text-slate-400 py-1">
                        Scroll to see {profiles.length - 5} more…
                    </p>
                )}
            </div>

            {/* Add Local User */}
            <div className="space-y-3">
                <button
                    id="btn-add-local-user"
                    type="button"
                    onClick={onAddUser}
                    className="w-full flex items-center justify-center space-x-2 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-500 hover:text-blue-600 font-bold text-xs py-3 rounded-2xl transition-all duration-200"
                >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Add Local User</span>
                </button>

                <div className="flex items-center justify-center space-x-1.5 text-[11px] text-slate-400">
                    <Lock className="w-3 h-3" />
                    <span>All identity data remains protected on this device.</span>
                </div>
            </div>

        </div>
    );
};

export default ProfileSelector;
