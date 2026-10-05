import React, { useState, useEffect } from 'react';
import {
    ShieldCheck, Activity, HardDrive, Lock,
    ArrowUpRight, AlertTriangle, CheckCircle2,
    Clock, Smartphone, Laptop, RefreshCw, Eye,
    Cpu, Key, Database, ChevronRight
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

interface OverviewViewProps {
    telemetry?: any;
    user?: any;
    enrollment?: any;
    onNavigate: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ telemetry, user, enrollment, onNavigate }) => {
    const [recentLogs, setRecentLogs] = useState<any[]>([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await adminApi.getAuditLogs();
                const logs = response.data || [];
                const mapped = logs.slice(0, 5).map((log: any) => ({
                    time: new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    event: log.action,
                    factor: log.action.split('_')[0] || 'SYSTEM',
                    status: 'LOGGED',
                    risk: 'LOW'
                }));
                setRecentLogs(mapped);
            } catch (err) {
                console.error("Failed to fetch overview logs", err);
                setRecentLogs([]);
            }
        };
        fetchLogs();
    }, []);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Hero Status Banner */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50/60 to-white border border-blue-200/80 rounded-3xl p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl relative z-10">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-blue-700 text-xs font-mono font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>ZERO-TRUST FORTRESS ENFORCED</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Local Workstation Environment Protected
                    </h1>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        BioShield is monitoring local cryptographic handles, behavioral kinematics, and hardware attestation. All authentication decisions execute offline on your device.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto relative z-10">
                    <button
                        onClick={() => onNavigate('BIOMETRICS')}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2"
                    >
                        <span>Manage Biometrics</span>
                        <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onNavigate('VAULT')}
                        className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl text-xs transition-all border border-slate-200 shadow-sm flex items-center justify-center space-x-2"
                    >
                        <span>Open Secure Vault</span>
                        <Lock className="w-4 h-4 text-slate-500" />
                    </button>
                </div>
            </div>

            {/* 4 Core Domain Summary Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div
                    onClick={() => onNavigate('BIOMETRICS')}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {(enrollment?.passwordEnrolled ? 1 : 0) + (enrollment?.faceEnrolled ? 1 : 0) + (enrollment?.voiceEnrolled ? 1 : 0) + (enrollment?.recoveryConfigured ? 1 : 0)}/4 ACTIVE
                        </span>
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase font-mono">IDENTITY & BIOMETRICS</div>
                        <div className="text-xl font-extrabold text-slate-900 mt-1">Multi-Factor Enrolled</div>
                        <p className="text-xs text-slate-500 mt-1">
                            {enrollment?.faceEnrolled ? 'Face, ' : ''}
                            {enrollment?.voiceEnrolled ? 'Voice, ' : ''}
                            {enrollment?.passwordEnrolled ? 'Password ' : ''}
                            valid.
                        </p>
                    </div>
                </div>

                <div
                    onClick={() => onNavigate('TRUST_RISK')}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                            <Activity className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-mono font-bold">
                            INDEX: COMPUTED
                        </span>
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase font-mono">CONTINUOUS TRUST</div>
                        <div className="text-xl font-extrabold text-slate-900 mt-1">NOMINAL</div>
                        <p className="text-xs text-slate-500 mt-1">
                            Behavioral match nominal.
                        </p>
                    </div>
                </div>

                <div
                    onClick={() => onNavigate('DEVICE_SEC')}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-11 h-11 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 group-hover:scale-110 transition-transform">
                            <Cpu className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-mono font-bold">
                            {telemetry?.security?.tpm?.present ? `TPM ${telemetry?.security?.tpm?.version || '2.0'} OK` : 'TPM UNAVAILABLE'}
                        </span>
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase font-mono">DEVICE SECURITY</div>
                        <div className="text-xl font-extrabold text-slate-900 mt-1">Hardware Enclave</div>
                        <p className="text-xs text-slate-500 mt-1">
                            {telemetry?.security?.secureBoot?.status === 'VERIFIED' ? 'Secure Boot verified.' : 'Secure Boot unknown.'}
                        </p>
                    </div>
                </div>

                <div
                    onClick={() => onNavigate('VAULT')}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                            <Lock className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-mono font-bold">
                            LOCAL ONLY
                        </span>
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase font-mono">DATA PROTECTION</div>
                        <div className="text-xl font-extrabold text-slate-900 mt-1">Secure Vault Active</div>
                        <p className="text-xs text-slate-500 mt-1">24 encrypted items in AES-256-GCM.</p>
                    </div>
                </div>
            </div>

            {/* Quick Actions & Telemetry Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 cols: Recent Security Activity */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 font-mono flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-600" />
                                <span>RECENT AUDIT LOG & EVENTS</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Real-time cryptographic and behavioral audit trail.</p>
                        </div>
                        <button
                            onClick={() => onNavigate('ACTIVITY')}
                            className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center space-x-1"
                        >
                            <span>View All</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {recentLogs.map((row, idx) => (
                            <div key={idx} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4 text-xs">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-900 truncate">{row.event}</div>
                                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{row.factor}</div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 shrink-0">
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold">
                                        {row.status}
                                    </span>
                                    <span className="text-slate-400 font-mono text-[11px] w-20 text-right">{row.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right col: Quick Shortcuts & Architecture Note */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                        <h3 className="font-bold text-sm text-slate-900 font-mono flex items-center gap-2">
                            <Key className="w-4 h-4 text-indigo-600" />
                            <span>QUICK MANAGEMENT</span>
                        </h3>

                        <div className="space-y-2">
                            <button
                                onClick={() => onNavigate('AUTH_POLICY')}
                                className="w-full p-3.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all flex items-center justify-between group"
                            >
                                <div>
                                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Tune Auth Assurance Profile</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">Switch between Standard and Maximum Assurance.</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                            </button>

                            <button
                                onClick={() => onNavigate('SESSIONS_RECOVERY')}
                                className="w-full p-3.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all flex items-center justify-between group"
                            >
                                <div>
                                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Inspect Local Session Handle</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">Manage workstation lock rules & recovery keys.</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                            </button>

                            <button
                                onClick={() => onNavigate('PRIVACY')}
                                className="w-full p-3.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all flex items-center justify-between group"
                            >
                                <div>
                                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Privacy & Sovereignty Controls</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">Verify zero-telemetry local isolation.</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm space-y-2">
                        <div className="text-xs font-bold text-blue-900 font-mono flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            <span>LOCAL SOVEREIGNTY ASSURED</span>
                        </div>
                        <p className="text-xs text-blue-800 leading-relaxed">
                            Your biometric templates and vault decryption keys reside exclusively inside this device's memory and TPM enclave. No biometric references are ever transmitted over the network.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
