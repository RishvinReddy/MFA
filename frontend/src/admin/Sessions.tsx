import React, { useEffect, useState } from "react";
import { adminApi } from "../../services/adminApi";
import { Globe, Monitor, Smartphone, AlertTriangle, Trash2, RefreshCw, Radio } from 'lucide-react';

interface SessionData {
    id: string;
    userId: string;
    ipAddress: string;
    device: string;
    riskScore: number;
    isActive: boolean;
    createdAt: string;
    user: {
        email: string;
        role: string;
    };
}

export const Sessions = () => {
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
        const interval = setInterval(loadSessions, 10000); // 10s poll
        return () => clearInterval(interval);
    }, []);

    const loadSessions = async () => {
        try {
            const data = await adminApi.getSessions();
            if (Array.isArray(data)) setSessions(data as any as SessionData[]);
            else if (data.data) setSessions(data.data as any as SessionData[]);
        } catch (error) {
            console.error("Failed to load sessions", error);
        } finally {
            setLoading(false);
        }
    };

    const killSession = async (sessionId: string) => {
        if (!window.confirm("Terminate this session connection immediately?")) return;
        await adminApi.revokeSession(sessionId);
        loadSessions();
    };

    const getRiskColor = (score: number) => {
        if (score < 30) return "bg-emerald-500";
        if (score < 70) return "bg-amber-500";
        return "bg-red-500";
    };

    const getRiskLabel = (score: number) => {
        if (score < 30) return "Low";
        if (score < 70) return "Medium";
        return "Critical";
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Globe className="w-6 h-6 text-emerald-600" />
                        Live Neural Monitor
                    </h2>
                    <p className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Real-time active connections
                    </p>
                </div>
                <button onClick={loadSessions} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="grid gap-4">
                {loading && sessions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 animate-pulse">Scanning network...</div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">No active sessions detected.</div>
                ) : (
                    sessions.map(session => (
                        <div key={session.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${session.device.toLowerCase().includes('mobile') ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {session.device.toLowerCase().includes('mobile') ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-900">{session.user.email}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <span>{session.ipAddress}</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span className="truncate max-w-[200px]">{session.device}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                {/* Risk Meter */}
                                <div className="flex flex-col items-end w-32">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        {session.riskScore > 70 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                        <span className="text-xs font-bold text-slate-700">Risk Score: {session.riskScore}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${getRiskColor(session.riskScore)}`} style={{ width: `${session.riskScore}%` }}></div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Started</div>
                                    <div className="text-xs text-slate-900 font-mono">
                                        {new Date(session.createdAt).toLocaleTimeString()}
                                    </div>
                                </div>

                                <button
                                    onClick={() => killSession(session.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                    title="Kill Connection"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
