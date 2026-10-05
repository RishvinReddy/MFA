import React, { useEffect, useState } from 'react';
import { Sparkles, BrainCircuit, Activity, Clock, FileText, AlertTriangle, CheckCircle2, Info, Eye } from 'lucide-react';

interface AiTelemetryLog {
    id: string;
    timestamp: string;
    trigger: string;
    latencyMs: number;
    analysis: {
        action: string;
        riskScore: number;
        confidence: number;
        explanation: string;
        riskFactors: string[];
        requiresHumanReview: boolean;
        correlationId?: string;
        riskCategory?: string;
        anomalyDetected?: boolean;
    };
}

export const AiAdvisoryView: React.FC = () => {
    const [logs, setLogs] = useState<AiTelemetryLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTelemetry = async () => {
            try {
                const token = sessionStorage.getItem('accessToken');
                const sessionId = sessionStorage.getItem('sessionId');
                if (!token) throw new Error('No access token');
                
                const res = await fetch('http://localhost:8080/api/auth/ai-telemetry', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        ...(sessionId ? { 'x-session-id': sessionId } : {})
                    }
                });
                
                if (!res.ok) throw new Error('Failed to fetch AI telemetry');
                
                const data = await res.json();
                if (data.success) {
                    setLogs(data.data);
                } else {
                    throw new Error(data.message || 'Error fetching telemetry');
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        
        fetchTelemetry();
        const interval = setInterval(fetchTelemetry, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading && logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <BrainCircuit className="w-12 h-12 mb-4 animate-pulse text-indigo-300" />
                <p className="font-mono text-sm uppercase tracking-widest">Initializing AI Telemetry Link...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Distinction Warning */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-6 shadow-lg border border-indigo-500/30 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                    <BrainCircuit className="w-64 h-64" />
                </div>
                
                <div className="relative z-10 flex items-start space-x-4">
                    <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-400/30">
                        <Sparkles className="w-8 h-8 text-indigo-300" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
                            ZERO-TRUST AI SECURITY BRAIN
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] uppercase tracking-wider font-bold border border-indigo-500/30">Read-Only Advisory</span>
                        </h2>
                        <p className="text-indigo-200/80 text-sm mt-1 max-w-2xl leading-relaxed">
                            This panel displays out-of-band asynchronous AI assessments. 
                            <strong className="text-white block mt-2 p-3 bg-black/30 rounded-lg border border-white/10 font-mono text-xs">
                                ARCHITECTURE NOTE: The AI Security Brain is an observer. It does NOT make deterministic security decisions, block authentication paths, or override policy. Real-time enforcement is strictly handled by the deterministic Fusion & Policy engines.
                            </strong>
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3 text-red-700">
                    <AlertTriangle className="w-5 h-5" />
                    <p className="text-sm font-bold font-mono">Telemetry Sync Error: {error}</p>
                </div>
            )}

            {/* Assessment Timeline */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-900 font-mono text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 text-slate-500" />
                        AI Assessment Timeline
                    </h3>
                    <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        LIVE SYNC
                    </div>
                </div>

                <div className="p-6">
                    {logs.length === 0 && !error ? (
                        <div className="text-center py-10 text-slate-500 font-mono text-sm">
                            <Eye className="w-8 h-8 mx-auto mb-3 opacity-20" />
                            No AI telemetry events recorded for this session.
                        </div>
                    ) : (
                        <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[19px] before:w-px before:bg-slate-200">
                            {logs.map((log) => (
                                <div key={log.id} className="relative flex items-start space-x-4 group">
                                    <div className="relative z-10 bg-white border-2 border-indigo-100 w-10 h-10 rounded-full flex items-center justify-center shadow-sm">
                                        <Sparkles className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    
                                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm group-hover:shadow-md transition-shadow group-hover:border-indigo-100">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider font-mono ${
                                                        log.analysis?.action === 'BLOCK' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                        log.analysis?.action === 'CHALLENGE' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                        AI_ADVISORY: {log.analysis?.action || 'UNKNOWN'}
                                                    </span>
                                                    {log.analysis?.requiresHumanReview && (
                                                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold tracking-wider font-mono flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" /> REVIEW REQ
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-900 mt-2">Trigger: {log.trigger}</h4>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 font-mono flex items-center justify-end gap-1 mb-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    Latency: {log.latencyMs}ms
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 mb-4 font-mono text-sm text-slate-700 leading-relaxed">
                                            {log.analysis?.explanation || "No explanation provided."}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                                            <div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 font-mono">Risk Factors Identified</div>
                                                {log.analysis?.riskFactors?.length > 0 ? (
                                                    <ul className="space-y-1.5">
                                                        {log.analysis.riskFactors.map((factor, i) => (
                                                            <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                                                                <span className="text-amber-500 mt-0.5">•</span>
                                                                {factor}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="text-xs text-slate-500 italic">None identified</div>
                                                )}
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 font-mono flex justify-between">
                                                        <span>Calculated Risk Category</span>
                                                        <span className="text-slate-700">{log.analysis?.riskCategory || 'UNKNOWN'}</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 font-mono flex justify-between">
                                                        <span>Anomaly Detected</span>
                                                        <span className="text-slate-700">{log.analysis?.anomalyDetected ? 'YES' : 'NO'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
