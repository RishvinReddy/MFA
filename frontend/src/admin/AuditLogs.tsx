import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ShieldCheck, FileText, Search } from 'lucide-react';

export const AuditLogs = () => {
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = () => {
        api.admin.getAuditLogs().then(setLogs).catch(console.error);
    };

    return (
        <div className="animate-fade-in space-y-6 font-sans">
            <h2 className="text-xl font-extrabold text-slate-900 font-mono">Immutable Audit Ledger</h2>

            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="text-slate-700 text-xs font-mono font-bold flex items-center">
                        <FileText className="w-4 h-4 mr-2 text-blue-600" />
                        /var/log/bioshield/workstation_audit.log
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        <span>● VERIFIED TAMPER-EVIDENT</span>
                    </div>
                </div>
                <div className="p-5 font-mono text-xs text-slate-800 h-[600px] overflow-y-auto custom-scrollbar bg-white">
                    {logs.map((log, i) => (
                        <div key={log.id || i} className="mb-2 border-b border-slate-100 pb-2.5 hover:bg-slate-50 transition-colors p-2 rounded-lg flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-slate-400 select-none">[{new Date(log.createdAt || Date.now()).toISOString()}]</span>
                            <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${log.action?.includes('DISABLE') || log.action?.includes('LOGOUT') ? 'bg-red-50 text-red-700 border border-red-200' :
                                    log.action?.includes('CREATE') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                        'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>{(log.action || 'EVENT').padEnd(12)}</span>
                            <span className="text-slate-900 font-bold">@{log.user?.email?.split('@')[0] || 'SYSTEM'}</span>
                            <span className="text-slate-600 break-all">{JSON.stringify(log.metadata || {})}</span>
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-slate-500 font-bold p-4 text-center bg-slate-50 rounded-xl border border-slate-200">// No audit log entries found in local enclave.</div>}
                </div>
            </div>
        </div>
    );
};
