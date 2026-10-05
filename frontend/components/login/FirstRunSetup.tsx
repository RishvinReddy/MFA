import React from 'react';
import { Shield, Lock, Cpu, HardDrive } from 'lucide-react';

interface FirstRunSetupProps {
    onBeginSetup: () => void;
}

const FirstRunSetup: React.FC<FirstRunSetupProps> = ({ onBeginSetup }) => {
    return (
        <div className="space-y-8 animate-fade-in text-center">

            {/* Icon */}
            <div className="flex justify-center">
                <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-blue-500/30">
                        <Shield className="w-10 h-10 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                        <span className="text-white text-[10px] font-black">+</span>
                    </div>
                </div>
            </div>

            {/* Headline */}
            <div className="space-y-3">
                <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                    <span>First-Time Setup</span>
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    Welcome to BioShield.ID
                </h2>
                <h3 className="text-lg font-semibold text-slate-500">
                    Create your first local identity
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                    BioShield uses locally enrolled biometric and behavioral signals to
                    protect access to this device. No cloud account is required.
                </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2">
                {[
                    { icon: HardDrive, label: 'Local-First' },
                    { icon: Lock,      label: 'Private' },
                    { icon: Cpu,       label: 'Offline Capable' },
                ].map(({ icon: Icon, label }) => (
                    <div
                        key={label}
                        className="flex items-center space-x-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200"
                    >
                        <Icon className="w-3.5 h-3.5 text-blue-500" />
                        <span>{label}</span>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="space-y-3">
                <button
                    id="btn-setup-bioshield"
                    type="button"
                    onClick={onBeginSetup}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-4 rounded-2xl text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-3 transition-all duration-200"
                >
                    <Shield className="w-5 h-5" />
                    <span className="text-base">Set Up BioShield</span>
                </button>
                <p className="text-[11px] text-slate-400 font-medium">
                    Your biometric data never leaves this device
                </p>
            </div>

        </div>
    );
};

export default FirstRunSetup;
