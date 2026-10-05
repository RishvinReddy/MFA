import React, { useState, useEffect } from 'react';
import { 
    ShieldCheck, Activity, UserCheck, Smartphone, 
    Fingerprint, Cpu, Lock
} from 'lucide-react';
import { adminApi } from '../../../services/adminApi';

interface OverviewViewProps {
    trustScore: number;
    onNavigate?: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ trustScore }) => {
    // Generate some simulated live telemetry based on trust score
    const humanConfidence = (trustScore / 100 * 0.95 + 0.02).toFixed(2);
    const deviceAssurance = 0.96;
    
    let trustState = 'TRUSTED';
    let riskLevel = 'LOW';
    let fusionDecision = 'MATCH';
    
    if (trustScore < 80) {
        trustState = 'MONITOR';
        riskLevel = 'MODERATE';
    }
    if (trustScore < 60) {
        trustState = 'CHALLENGE';
        riskLevel = 'ELEVATED';
        fusionDecision = 'LOW_CONFIDENCE';
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* SECURITY STATUS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-sm text-slate-900 font-mono tracking-widest uppercase">Security Status</h3>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Authentication</span>
                            <span className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                ACTIVE
                            </span>
                        </div>
                        <div className="flex flex-col border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Trust State</span>
                            <span className={`text-lg font-bold ${trustState === 'TRUSTED' ? 'text-blue-600' : 'text-amber-600'}`}>
                                {trustState}
                            </span>
                        </div>
                        <div className="flex flex-col border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Risk Level</span>
                            <span className={`text-lg font-bold ${riskLevel === 'LOW' ? 'text-slate-700' : 'text-amber-600'}`}>
                                {riskLevel}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* IDENTITY EVIDENCE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <Fingerprint className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-sm text-slate-900 font-mono tracking-widest uppercase">Identity Evidence</h3>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                <UserCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-bold uppercase tracking-wide">Face</span>
                                <span className="text-sm font-bold text-emerald-600">VERIFIED</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-bold uppercase tracking-wide">Voice</span>
                                <span className="text-sm font-bold text-emerald-600">VERIFIED</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                                <Cpu className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-bold uppercase tracking-wide">Device</span>
                                <span className="text-sm font-bold text-blue-600">TRUSTED</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <Lock className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-bold uppercase tracking-wide">MFA</span>
                                <span className="text-sm font-bold text-emerald-600">VERIFIED</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTINUOUS AUTHENTICATION */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-sm text-slate-900 font-mono tracking-widest uppercase">Continuous Authentication</h3>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Human Confidence</span>
                            <span className="text-2xl font-bold text-slate-900 font-mono">{humanConfidence}</span>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                                <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${parseFloat(humanConfidence) * 100}%` }}></div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Device Assurance</span>
                            <span className="text-2xl font-bold text-slate-900 font-mono">{deviceAssurance}</span>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                                <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${deviceAssurance * 100}%` }}></div>
                            </div>
                        </div>

                        <div className="flex flex-col border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Fusion Decision</span>
                            <span className="text-xl font-bold text-slate-900 mt-1">{fusionDecision}</span>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
    );
};
