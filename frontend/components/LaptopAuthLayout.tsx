import React from 'react';
import { Shield, Check } from 'lucide-react';

interface LaptopAuthLayoutProps {
    children: React.ReactNode;
}

export const LaptopAuthLayout: React.FC<LaptopAuthLayoutProps> = ({ children }) => {
    return (
        <div className="auth-page">
            <div className="auth-shell">
                {/* ── LEFT PANEL ─────────────────────────────────────────── */}
                <div className="auth-left bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-8 lg:p-12 text-white overflow-hidden">
                    {/* Ambient flares */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none" />

                    <div className="relative z-10 space-y-6">
                        {/* Badge */}
                        <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-400/20 px-3 py-1.5 rounded-full backdrop-blur-md">
                            <Shield className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                                Local-First Desktop Protection
                            </span>
                        </div>

                        {/* Headline */}
                        <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                            Security that doesn't stop after login.
                        </h1>

                        <p className="text-slate-300 text-sm leading-relaxed">
                            BioShield.ID protects your computer locally using hardware TPM
                            attestation, authoritative local biometric matching, and continuous
                            behavioral verification.
                        </p>

                        {/* Capabilities */}
                        <div className="space-y-3 pt-2">
                            {[
                                { title: 'Local Device Identity',    desc: 'Secure desktop profile — 100% offline capable' },
                                { title: 'Local Biometric Engine',   desc: 'Authoritative offline face, voice & PIN verification' },
                                { title: 'Behavioral Intelligence',  desc: 'Continuous analysis of interaction timing' },
                                { title: 'Dynamic Session Risk',     desc: 'Real-time multi-factor trust evaluation' },
                                { title: 'Optional Cloud Access',    desc: 'Connect cloud storage post-unlock on demand' },
                            ].map((cap, i) => (
                                <div key={i} className="flex items-start space-x-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center mt-0.5 flex-shrink-0">
                                        <Check className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-slate-100">{cap.title}</div>
                                        <div className="text-[11px] text-slate-400">{cap.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT PANEL ─────────────────────────────────────────── */}
                <div className="auth-right p-8 lg:p-14 flex flex-col justify-center bg-[#F3F5F9] relative overflow-y-auto">
                    <div className="max-w-4xl mx-auto w-full space-y-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default LaptopAuthLayout;
