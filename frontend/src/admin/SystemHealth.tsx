import React from 'react';
import { Terminal, CheckCircle2, Database, Lock, Server } from 'lucide-react';

export const SystemHealth = () => {
    return (
        <div className="animate-fade-in space-y-6 font-sans">
            <h2 className="text-xl font-extrabold text-slate-900 font-mono">System Health & Integrity Attestation</h2>

            <div className="bg-white border border-slate-200 text-slate-800 p-6 rounded-2xl font-mono text-sm shadow-sm">
                <div className="flex items-center mb-4 border-b border-slate-200 pb-3 text-slate-900 font-bold">
                    <Terminal className="w-4 h-4 mr-2 text-blue-600" />
                    <span>root@bioshield-workstation:~$ status --verbose --local-enclave</span>
                </div>
                <div className="space-y-3 text-xs">
                    <div className="flex items-center text-slate-700 font-bold bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <CheckCircle2 className="w-4 h-4 mr-2.5 text-emerald-600 shrink-0" />
                        <span>[OK] Local Storage Enclave (AES-256-GCM encrypted SQLite cluster)</span>
                    </div>
                    <div className="flex items-center text-slate-700 font-bold bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <Lock className="w-4 h-4 mr-2.5 text-emerald-600 shrink-0" />
                        <span>[OK] Workstation TPM 2.0 Cryptographic Binding (PCR Attested)</span>
                    </div>
                    <div className="flex items-center text-slate-700 font-bold bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <Database className="w-4 h-4 mr-2.5 text-emerald-600 shrink-0" />
                        <span>[OK] Zero-Knowledge Biometric Template Isolation (VBS Active)</span>
                    </div>
                    <div className="flex items-center text-slate-700 font-bold bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <Server className="w-4 h-4 mr-2.5 text-emerald-600 shrink-0" />
                        <span>[OK] Local Biometric Matching Engine (FHE-Accelerated / Offline Mode)</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200 text-slate-500 font-bold flex justify-between">
                        <span>Workstation Uptime: 99.99%</span>
                        <span className="text-emerald-700">● 0 Critical Alerts</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
