
import React, { useState } from 'react';
import { 
  Database, Download, Eye, Trash2, Shield, History, 
  FileKey, Fingerprint, ScanFace, Mic, Activity, 
  CheckCircle2, XCircle, AlertCircle, Battery
} from 'lucide-react';
import { PrivacySetting, BiometricAsset, DataAccessLog } from '../types';

// --- MOCK DATA ---
const INITIAL_SETTINGS: PrivacySetting[] = [];

const INITIAL_ASSETS: BiometricAsset[] = [];

const INITIAL_LOGS: DataAccessLog[] = [];

const PrivacyVault: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'consents' | 'assets' | 'audit'>('consents');
    const [settings, setSettings] = useState(INITIAL_SETTINGS);
    const [assets, setAssets] = useState(INITIAL_ASSETS);
    const [logs, setLogs] = useState(INITIAL_LOGS);
    const [privacyBudget, setPrivacyBudget] = useState(85); // Daily Budget 100

    const toggleSetting = (id: string) => {
        setSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
        const setting = settings.find(s => s.id === id);
        addLog('User (You)', 'UPDATE', `Consent: ${setting?.label}`, `Changed to ${!setting?.enabled}`);
    };

    const revokeAsset = (id: string) => {
        setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'REVOKED', dataHash: 'null' } : a));
        const asset = assets.find(a => a.id === id);
        addLog('User (You)', 'DELETE', `${asset?.type} Template`, 'Right to Erasure Request');
    };

    const addLog = (actor: string, action: any, resource: string, purpose: string) => {
        const newLog: DataAccessLog = {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString(),
            actor,
            action,
            resource,
            purpose
        };
        setLogs(prev => [newLog, ...prev]);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center">
                        <Shield className="w-5 h-5 mr-2 text-cyan-600" /> Data Sovereignty Center
                    </h3>
                    <p className="text-sm text-slate-500">GDPR & ISO/IEC 27701 Compliance Dashboard</p>
                </div>
                <div className="flex space-x-2">
                    <button className="px-3 py-2 bg-white border border-slate-200 hover:border-cyan-500 text-slate-600 hover:text-cyan-600 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm">
                        <Download className="w-3 h-3 mr-2" /> Download My Data
                    </button>
                    <button className="px-3 py-2 bg-white border border-slate-200 hover:border-red-500 text-slate-600 hover:text-red-600 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm">
                        <Trash2 className="w-3 h-3 mr-2" /> Purge Account
                    </button>
                </div>
            </div>

            {/* Privacy Budget Section */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                 <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center">
                        <div className={`p-2 rounded-full mr-3 ${privacyBudget > 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            <Battery className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Daily Privacy Budget</h4>
                            <p className="text-xs text-slate-400">Remaining allowance for high-fidelity biometric exposures.</p>
                        </div>
                     </div>
                     <div className="text-right">
                         <div className="text-2xl font-mono font-bold">{privacyBudget}/100</div>
                         <div className="text-[10px] text-slate-400 uppercase font-bold">Points Remaining</div>
                     </div>
                 </div>
                 <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                     <div 
                        className={`h-full transition-all ${privacyBudget > 50 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{width: `${privacyBudget}%`}}
                     ></div>
                 </div>
                 <p className="text-[10px] text-slate-400 flex items-center">
                    <Activity className="w-3 h-3 mr-1" /> Recent Cost: -5 pts (Face Scan Verification)
                 </p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('consents')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${activeTab === 'consents' ? 'border-cyan-600 text-cyan-800 bg-cyan-50/20' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Consent Manager
                </button>
                <button 
                    onClick={() => setActiveTab('assets')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${activeTab === 'assets' ? 'border-cyan-600 text-cyan-800 bg-cyan-50/20' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    My Biometrics
                </button>
                <button 
                    onClick={() => setActiveTab('audit')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${activeTab === 'audit' ? 'border-cyan-600 text-cyan-800 bg-cyan-50/20' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Audit Trail
                </button>
            </div>

            {/* Tab Content */}
            <div className="p-6 bg-slate-50/30 min-h-[400px]">
                
                {/* --- CONSENT MANAGER TAB --- */}
                {activeTab === 'consents' && (
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-blue-50 p-3 rounded border border-blue-100 mb-4">
                            <Eye className="w-4 h-4 text-blue-600" />
                            <span>Changes to consent settings are applied immediately and logged in the immutable audit trail.</span>
                        </div>
                        {settings.map(setting => (
                            <div key={setting.id} className="flex items-start justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-cyan-200 transition-colors shadow-sm">
                                <div className="flex-1">
                                    <div className="flex items-center mb-1 gap-2">
                                        <span className="font-semibold text-slate-800 text-sm">{setting.label}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            setting.category === 'ESSENTIAL' ? 'bg-slate-100 text-slate-600' :
                                            setting.category === 'ANALYTICS' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                            {setting.category}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">{setting.description}</p>
                                </div>
                                <div className="ml-4 flex items-center">
                                     <button 
                                        onClick={() => toggleSetting(setting.id)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${setting.enabled ? 'bg-cyan-600' : 'bg-slate-300'}`}
                                     >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${setting.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                     </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- BIOMETRIC ASSETS TAB --- */}
                {activeTab === 'assets' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assets.map(asset => (
                            <div key={asset.id} className={`p-4 rounded-lg border shadow-sm transition-all ${
                                asset.status === 'ENROLLED' ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-75'
                            }`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${
                                            asset.type === 'FACE' ? 'bg-cyan-100 text-cyan-600' :
                                            asset.type === 'PALM' ? 'bg-emerald-100 text-emerald-600' :
                                            asset.type === 'VOICE' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
                                        }`}>
                                            {asset.type === 'FACE' && <ScanFace className="w-5 h-5" />}
                                            {asset.type === 'PALM' && <Fingerprint className="w-5 h-5" />}
                                            {asset.type === 'VOICE' && <Mic className="w-5 h-5" />}
                                            {asset.type === 'BEHAVIORAL' && <Activity className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{asset.type} Template</h4>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                {asset.status === 'ENROLLED' ? (
                                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 text-slate-400" />
                                                )}
                                                <span className={`text-xs font-medium ${asset.status === 'ENROLLED' ? 'text-green-600' : 'text-slate-500'}`}>
                                                    {asset.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {asset.status === 'ENROLLED' && (
                                        <button 
                                            onClick={() => revokeAsset(asset.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                            title="Revoke & Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-100">
                                        <span className="text-slate-500">Enrolled</span>
                                        <span className="font-mono text-slate-700">{asset.enrolledDate}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-100">
                                        <span className="text-slate-500">Last Used</span>
                                        <span className="font-mono text-slate-700">{asset.lastUsed}</span>
                                    </div>
                                    <div className="pt-1">
                                        <div className="flex items-center text-slate-400 mb-1">
                                            <FileKey className="w-3 h-3 mr-1" /> Stored Hash (SHA-256)
                                        </div>
                                        <code className="block w-full bg-slate-100 p-1.5 rounded text-[10px] text-slate-600 font-mono truncate">
                                            {asset.dataHash}
                                        </code>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- AUDIT TRAIL TAB --- */}
                {activeTab === 'audit' && (
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                <History className="w-3 h-3 mr-2" /> Immutable Access Log
                            </h4>
                            <span className="text-[10px] px-2 py-1 bg-slate-200 rounded text-slate-600 font-mono">
                                LOG_ID: 8492-XJ
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                            {logs.map((log) => (
                                <div key={log.id} className="p-3 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 w-2 h-2 rounded-full ${
                                            log.action === 'DELETE' ? 'bg-red-500' :
                                            log.action === 'UPDATE' ? 'bg-orange-500' : 'bg-cyan-500'
                                        }`}></div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-800">{log.resource}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                    log.action === 'READ' ? 'bg-cyan-50 text-cyan-700' :
                                                    log.action === 'UPDATE' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'
                                                }`}>{log.action}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                by <span className="font-medium text-slate-700">{log.actor}</span> • {log.purpose}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-slate-400 text-right">
                                        {log.timestamp}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-2 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400 flex items-center justify-center gap-2">
                            <AlertCircle className="w-3 h-3" /> Logs are cryptographically signed and retained for 365 days.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrivacyVault;
