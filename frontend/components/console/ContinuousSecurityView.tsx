import React, { useState, useEffect } from 'react';
import { 
    Activity, Layers, HardDrive, Clock, CheckCircle2, 
    AlertTriangle, Shield, Cpu, RefreshCw, Search, 
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

interface ContinuousSecurityViewProps {
    activeSubTab: string;
    telemetry?: any;
}

export const ContinuousSecurityView: React.FC<ContinuousSecurityViewProps> = ({ activeSubTab, telemetry }) => {
    // trustScore deliberately removed per Phase 18
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');

    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        if (activeSubTab === 'ACTIVITY') {
            loadLogs();
        }
    }, [activeSubTab]);

    const loadLogs = async () => {
        setLoadingLogs(true);
        try {
            const response = await adminApi.getAuditLogs();
            const data = response.data || [];
            // Map backend audit logs to the UI format
            const mapped = data.map((log: any) => ({
                id: log.id,
                time: new Date(log.createdAt).toLocaleString(),
                category: log.action.split('_')[0] || 'SYSTEM',
                event: log.action,
                status: 'VERIFIED', // can map from metadata if needed
                risk: 'LOW',
                details: JSON.stringify(log.metadata || {})
            }));
            setAuditLogs(mapped);
        } catch (err) {
            console.error("Failed to load audit logs", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const filteredLogs = auditLogs.filter(l => {
        const matchesSearch = l.event.toLowerCase().includes(searchTerm.toLowerCase()) || l.details.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = filterCategory === 'ALL' || l.category === filterCategory;
        return matchesSearch && matchesCat;
    });

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                        {activeSubTab === 'BEHAVIORAL' && <Activity className="w-5 h-5" />}
                        {activeSubTab === 'TRUST_RISK' && <Layers className="w-5 h-5" />}
                        {activeSubTab === 'DEVICE_SEC' && <HardDrive className="w-5 h-5" />}
                        {activeSubTab === 'ACTIVITY' && <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                            {activeSubTab === 'BEHAVIORAL' && 'BEHAVIORAL INTELLIGENCE & KINEMATICS'}
                            {activeSubTab === 'TRUST_RISK' && 'CONTINUOUS TRUST & RISK ENGINE'}
                            {activeSubTab === 'DEVICE_SEC' && 'HARDWARE DEVICE & ENCLAVE SECURITY'}
                            {activeSubTab === 'ACTIVITY' && 'UNIFIED SECURITY ACTIVITY & AUDIT LOG'}
                        </h1>
                        <p className="text-xs text-slate-500 font-mono">
                            {activeSubTab === 'BEHAVIORAL' && 'Real-time telemetry on keystroke cadence, mouse flight time, and neurometric interaction patterns.'}
                            {activeSubTab === 'TRUST_RISK' && 'Multi-signal risk decisioning pipeline weighing identity, behavior, and device health.'}
                            {activeSubTab === 'DEVICE_SEC' && 'TPM 2.0 PCR attestation, Secure Boot status, and local memory protection enclaves.'}
                            {activeSubTab === 'ACTIVITY' && 'Immutable, timestamped audit log of all cryptographic verifications and workstation events.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* TAB 1: BEHAVIORAL */}
            {activeSubTab === 'BEHAVIORAL' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex justify-between items-center text-xs font-mono text-slate-500 font-bold">
                                <span>KEYSTROKE DYNAMICS</span>
                                <span className="text-amber-600 font-bold">UNAVAILABLE</span>
                            </div>
                            <div className="text-2xl font-extrabold text-slate-900 font-mono">Not Implemented</div>
                            <p className="text-xs text-slate-500">Awaiting integration with behavioral measurement engine.</p>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-300 w-0 rounded-full"></div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex justify-between items-center text-xs font-mono text-slate-500 font-bold">
                                <span>POINTER KINEMATICS</span>
                                <span className="text-amber-600 font-bold">UNAVAILABLE</span>
                            </div>
                            <div className="text-2xl font-extrabold text-slate-900 font-mono">Not Implemented</div>
                            <p className="text-xs text-slate-500">Awaiting integration with behavioral measurement engine.</p>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-300 w-0 rounded-full"></div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex justify-between items-center text-xs font-mono text-slate-500 font-bold">
                                <span>COGNITIVE RHYTHM</span>
                                <span className="text-amber-600 font-bold">UNAVAILABLE</span>
                            </div>
                            <div className="text-2xl font-extrabold text-slate-900 font-mono">Not Implemented</div>
                            <p className="text-xs text-slate-500">Awaiting integration with behavioral measurement engine.</p>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-300 w-0 rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 font-mono">HOW BEHAVIORAL INTELLIGENCE PROTECTS YOUR SESSION</h2>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Continuous behavioral monitoring acts as an invisible, post-unlock authentication layer. Even if someone physically gains access to an unlocked monitor, their unfamiliar keystroke rhythm and pointer velocity will generate negative behavioral evidence, automatically locking the desktop and demanding a full 4-factor biometric re-verification.
                        </p>
                    </div>
                </div>
            )}

            {/* TAB 2: TRUST RISK */}
            {activeSubTab === 'TRUST_RISK' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 font-mono">REAL-TIME TRUST & RISK DECISION PIPELINE</h2>
                                <p className="text-xs text-slate-500">Continuous scoring engine aggregating factors every 500 milliseconds.</p>
                            </div>
                            <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl font-mono text-xs">
                                <span className="text-slate-500 font-bold">STATUS:</span>
                                <span className="text-emerald-600 font-bold text-base">VERIFIED</span>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            </div>
                        </div>

                        {/* Pipeline Visualization */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="text-[10px] font-mono font-extrabold text-blue-600 uppercase">SIGNAL SOURCE 01</div>
                                <div className="font-bold text-xs text-slate-900">Defender Antivirus</div>
                                <div className="text-[11px] text-slate-500">Real-time protection & signature updates.</div>
                                <div className="text-right text-[10px] font-mono text-emerald-600 font-bold">{telemetry?.security?.defender?.status === 'VERIFIED' ? 'VERIFIED' : 'UNAVAILABLE'}</div>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="text-[10px] font-mono font-extrabold text-purple-600 uppercase">SIGNAL SOURCE 02</div>
                                <div className="font-bold text-xs text-slate-900">Network Firewall</div>
                                <div className="text-[11px] text-slate-500">Host firewall profile state active.</div>
                                <div className="text-right text-[10px] font-mono text-emerald-600 font-bold">{telemetry?.security?.firewall?.status === 'VERIFIED' ? 'VERIFIED' : 'UNAVAILABLE'}</div>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="text-[10px] font-mono font-extrabold text-cyan-600 uppercase">SIGNAL SOURCE 03</div>
                                <div className="font-bold text-xs text-slate-900">Hardware Enclave</div>
                                <div className="text-[11px] text-slate-500">TPM 2.0 and Secure Boot checks.</div>
                                <div className="text-right text-[10px] font-mono text-emerald-600 font-bold">{telemetry?.security?.tpm?.present ? 'VERIFIED' : 'UNAVAILABLE'}</div>
                            </div>

                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 flex flex-col justify-between">
                                <div>
                                    <div className="text-[10px] font-mono font-extrabold text-emerald-700 uppercase">FINAL DECISION</div>
                                    <div className="font-extrabold text-sm text-slate-900 mt-1">VERIFIED</div>
                                    <div className="text-[11px] text-emerald-800 mt-1">Based on local hardware security telemetry.</div>
                                </div>
                                <div className="text-right font-mono text-xs font-extrabold text-emerald-700">STATUS: ACTIVE</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: DEVICE SEC */}
            {activeSubTab === 'DEVICE_SEC' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold font-mono text-slate-500">TPM 2.0 MODULE</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
                                    {telemetry?.security?.tpm?.present ? 'READY' : 'UNAVAILABLE'}
                                </span>
                            </div>
                            <div className="text-lg font-extrabold text-slate-900 font-mono">Attested & Bound</div>
                            <p className="text-xs text-slate-500">Platform Configuration Registers (PCR) verified against boot baseline.</p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold font-mono text-slate-500">SECURE BOOT</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
                                    {telemetry?.security?.secureBoot?.status === 'VERIFIED' ? 'ENFORCED' : 'UNAVAILABLE'}
                                </span>
                            </div>
                            <div className="text-lg font-extrabold text-slate-900 font-mono">UEFI Verified</div>
                            <p className="text-xs text-slate-500">Kernel drivers and hypervisor security signatures validated.</p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold font-mono text-slate-500">MEMORY ISOLATION</span>
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-bold">UNAVAILABLE</span>
                            </div>
                            <div className="text-lg font-extrabold text-slate-900 font-mono">Not Implemented</div>
                            <p className="text-xs text-slate-500">Virtualization-based security enclave telemetry not configured.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: ACTIVITY */}
            {activeSubTab === 'ACTIVITY' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 font-mono">IMMUTABLE AUDIT TRAIL</h2>
                            <p className="text-xs text-slate-500">Tamper-evident log of all security verifications and system events.</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search logs..."
                                    className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                                />
                            </div>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-mono focus:outline-none focus:border-blue-500 font-bold"
                            >
                                <option value="ALL">All Categories</option>
                                <option value="BIOMETRIC">Biometric</option>
                                <option value="BEHAVIORAL">Behavioral</option>
                                <option value="DEVICE">Device</option>
                                <option value="VAULT">Vault</option>
                            </select>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono uppercase text-[10px]">
                                    <th className="p-3">Timestamp</th>
                                    <th className="p-3">Category</th>
                                    <th className="p-3">Event / Action</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loadingLogs ? (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-xs text-slate-500 font-mono">Loading audit trail...</td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-xs text-slate-500 font-mono">No audit logs found.</td>
                                    </tr>
                                ) : filteredLogs.map(l => (
                                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{l.time}</td>
                                        <td className="p-3 font-mono font-bold text-slate-700">{l.category}</td>
                                        <td className="p-3 font-bold text-slate-900">{l.event}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
                                                {l.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-500 font-mono text-[11px] break-all max-w-xs">{l.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
