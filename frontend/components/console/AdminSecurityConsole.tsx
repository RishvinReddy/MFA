import React, { useState, useEffect } from 'react';
import { 
    Activity, ShieldAlert, Users, Lock, Unlock, Shield, 
    RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle
} from 'lucide-react';
import { adminApi, OverviewMetrics, UserDTO, SessionDTO, AuditLogDTO } from '../../services/adminApi';

interface AdminSecurityConsoleProps {
    onLogout: () => void;
}

export const AdminSecurityConsole: React.FC<AdminSecurityConsoleProps> = ({ onLogout }) => {
    const [overview, setOverview] = useState<OverviewMetrics | null>(null);
    const [sessions, setSessions] = useState<SessionDTO[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogDTO[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fetchData = async () => {
        try {
            setIsRefreshing(true);
            setError(null);
            
            const [overviewData, sessionsData, auditData] = await Promise.all([
                adminApi.getOverview(),
                adminApi.getSessions(),
                adminApi.getAuditLogs()
            ]);
            
            setOverview(overviewData);
            setSessions(sessionsData.data);
            setAuditLogs(auditData.data);
            setLastUpdated(new Date());
        } catch (err: any) {
            console.error("Failed to fetch SOC telemetry:", err);
            setError(err.message || "Failed to load telemetry");
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000); // 15-second polling interval
        return () => clearInterval(interval);
    }, []);

    const [secondsAgo, setSecondsAgo] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setSecondsAgo(Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [lastUpdated]);

    const handleAction = async (action: () => Promise<void>, successMessage: string) => {
        try {
            setActionMessage(null);
            await action();
            setActionMessage({ type: 'success', text: successMessage });
            await fetchData();
        } catch (err: any) {
            setActionMessage({ type: 'error', text: err.message || 'Action failed' });
        }
    };

    const getTrustColor = (trustState: string) => {
        switch (trustState) {
            case 'TRUSTED': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
            case 'OBSERVE': return 'text-amber-700 bg-amber-50 border-amber-200';
            case 'CHALLENGE': return 'text-orange-700 bg-orange-50 border-orange-200';
            case 'RESTRICTED': return 'text-red-700 bg-red-50 border-red-200';
            case 'LOCKED': return 'text-slate-100 bg-slate-900 border-slate-700';
            default: return 'text-slate-600 bg-slate-100 border-slate-200';
        }
    };

    const getRiskColor = (riskLevel: string) => {
        switch (riskLevel) {
            case 'LOW': return 'text-emerald-700';
            case 'MEDIUM': return 'text-amber-600';
            case 'HIGH': return 'text-orange-600 font-bold';
            case 'CRITICAL': return 'text-red-700 font-bold';
            default: return 'text-slate-600';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Meta */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                            SECURITY OPERATIONS CENTER
                        </h1>
                        <p className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                            <span>Authoritative Backend Telemetry</span>
                            <span className="text-slate-300">|</span>
                            <span className={secondsAgo > 30 ? 'text-amber-600' : 'text-slate-500'}>
                                Last updated: {secondsAgo} seconds ago
                            </span>
                        </p>
                    </div>
                </div>
                
                <button 
                    onClick={fetchData} 
                    disabled={isRefreshing}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center space-x-2 border border-slate-200 disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Poll Backend Now</span>
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {actionMessage && (
                <div className={`p-4 border rounded-xl text-sm flex items-center gap-3 ${
                    actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    {actionMessage.text}
                </div>
            )}

            {/* Metrics Overview */}
            {overview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-bold font-mono">TOTAL USERS</span>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-900">{overview.totalUsers}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-blue-500 mb-2">
                            <Activity className="w-4 h-4" />
                            <span className="text-xs font-bold font-mono">ACTIVE SESSIONS</span>
                        </div>
                        <div className="text-3xl font-extrabold text-blue-700">{overview.activeSessions}</div>
                    </div>
                    <div className="bg-white border border-red-200 rounded-xl p-5 shadow-sm bg-red-50/30">
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-xs font-bold font-mono">HIGH RISK EVENTS</span>
                        </div>
                        <div className="text-3xl font-extrabold text-red-700">{overview.highRiskEvents}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <Lock className="w-4 h-4" />
                            <span className="text-xs font-bold font-mono">DISABLED ACCS</span>
                        </div>
                        <div className="text-3xl font-extrabold text-slate-900">{overview.disabledAccounts}</div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Sessions */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900 font-mono mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
                        <span>ACTIVE SESSIONS</span>
                        <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">REAL-TIME DB</span>
                    </h2>
                    
                    {sessions.length === 0 ? (
                        <div className="text-center py-8 text-sm text-slate-500">No active sessions found.</div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {sessions.map(session => (
                                <div key={session.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-900 truncate">{session.user?.email}</div>
                                        <div className="text-[10px] text-slate-500 font-mono mt-1">ID: {session.id.split('-')[0]}...</div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${getTrustColor(session.trustState || 'TRUSTED')}`}>
                                                {session.trustState || 'TRUSTED'}
                                            </span>
                                            <span className={`text-[10px] font-mono ${getRiskColor(session.riskLevel || 'LOW')}`}>
                                                Risk: {session.riskLevel || 'LOW'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <button 
                                            onClick={() => handleAction(() => adminApi.revokeSession(session.id), 'Session revoked successfully')}
                                            className="px-3 py-1 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 font-bold text-[10px] rounded transition-colors"
                                        >
                                            Revoke
                                        </button>
                                        <button 
                                            onClick={() => handleAction(() => adminApi.forceLogout(session.userId), 'User force logged out')}
                                            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] rounded transition-colors"
                                        >
                                            Force Logout
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Audit & Security Event Timeline */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[500px]">
                    <h2 className="text-sm font-bold text-slate-900 font-mono mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
                        <span>SECURITY AUDIT TRAIL</span>
                        <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">BACKEND AUTHORITATIVE</span>
                    </h2>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {auditLogs.length === 0 ? (
                            <div className="text-center py-8 text-sm text-slate-500">No audit logs available.</div>
                        ) : (
                            auditLogs.map(log => {
                                const isSecurityEvent = log.action.includes('LOCKED') || log.action.includes('RESTRICT') || log.action.includes('FAILED') || log.action.includes('DURESS');
                                
                                return (
                                    <div key={log.id} className="relative pl-4 border-l-2 border-slate-200 pb-4 last:border-0 last:pb-0">
                                        <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${isSecurityEvent ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                        
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-xs font-bold font-mono ${isSecurityEvent ? 'text-red-700' : 'text-slate-900'}`}>
                                                {log.action}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                {new Date(log.createdAt).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        
                                        <div className="text-[10px] text-slate-500 mb-1">
                                            User: {log.user?.email || log.userId}
                                        </div>
                                        
                                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                                            <div className="bg-slate-50 border border-slate-100 rounded p-2 mt-2 font-mono text-[9px] text-slate-600 overflow-hidden text-ellipsis whitespace-nowrap">
                                                {JSON.stringify(log.metadata)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
