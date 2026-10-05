import React, { useState } from 'react';
import { 
    FileText, Eye, Server, Lock, ShieldCheck, 
    AlertTriangle, CheckCircle2, Upload, Download, 
    Trash2, RefreshCw, Key, HardDrive, Globe,
    LogOut, Cloud, ShieldAlert, Check, Unlock
} from 'lucide-react';
import { vaultApi } from '../../services/vaultApi';

interface DataProtectionViewProps {
    activeSubTab: string;
    user?: any;
}

export const DataProtectionView: React.FC<DataProtectionViewProps> = ({ activeSubTab, user }) => {
    const [cloudConnected, setCloudConnected] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [cloudStatus, setCloudStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED'>('IDLE');

    const [vaultFiles, setVaultFiles] = useState([
        { id: 'V-101', name: 'Master_Cryptographic_Recovery_Keys.bin', size: '4.2 KB', enc: 'AES-256-GCM', date: 'Today, 09:14 AM', status: 'LOCKED / ENCRYPTED' },
        { id: 'V-102', name: 'Workstation_Biometric_Baseline_Golden.enc', size: '1.8 MB', enc: 'TPM-Enclave-Sealed', date: 'Yesterday', status: 'LOCKED / ENCRYPTED' },
        { id: 'V-103', name: 'Q3_Financial_Audit_Report_Confidential.pdf', size: '4.1 MB', enc: 'AES-256-GCM', date: '3 days ago', status: 'LOCKED / ENCRYPTED' },
        { id: 'V-104', name: 'Zero_Trust_Architecture_Spec_v9.docx', size: '890 KB', enc: 'AES-256-GCM', date: '5 days ago', status: 'LOCKED / ENCRYPTED' },
    ]);

    const [decryptingFileId, setDecryptingFileId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleDecrypt = async (id: string) => {
        try {
            setErrorMessage(null);
            setDecryptingFileId(id);
            const res = await vaultApi.decryptDocument(id);
            if (res.success) {
                setVaultFiles(files => files.map(f => 
                    f.id === id ? { ...f, status: 'UNLOCKED / DECRYPTED' } : f
                ));
            }
        } catch (err: any) {
            console.error("Decryption failed", err);
            setErrorMessage(err.message || "Decryption failed");
        } finally {
            setDecryptingFileId(null);
        }
    };

    const handleCloudConnect = (e: React.FormEvent) => {
        e.preventDefault();
        setCloudStatus('CONNECTING');
        setTimeout(() => {
            setCloudStatus('CONNECTED');
            setCloudConnected(true);
            setShowLoginModal(false);
            setLoginEmail('');
            setLoginPass('');
        }, 1200);
    };

    const handleCloudDisconnect = () => {
        setCloudConnected(false);
        setCloudStatus('IDLE');
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Description */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                        {activeSubTab === 'VAULT' && <FileText className="w-5 h-5" />}
                        {activeSubTab === 'PRIVACY' && <Eye className="w-5 h-5" />}
                        {activeSubTab === 'CLOUD' && <Server className="w-5 h-5" />}
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                            {activeSubTab === 'VAULT' && 'SECURE VAULT & DOCUMENT ENCLAVE'}
                            {activeSubTab === 'PRIVACY' && 'PRIVACY & DATA SOVEREIGNTY CONTROLS'}
                            {activeSubTab === 'CLOUD' && 'OPTIONAL CLOUD STORAGE & BACKUP'}
                        </h1>
                        <p className="text-xs text-slate-500 font-mono">
                            {activeSubTab === 'VAULT' && 'Zero-knowledge local file encryption using AES-256-GCM bound to workstation TPM keys.'}
                            {activeSubTab === 'PRIVACY' && 'Audit telemetry boundaries, local memory isolation, and zero-transmission assurances.'}
                            {activeSubTab === 'CLOUD' && 'Manage optional encrypted cloud sync for multi-device template backup.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* TAB 1: VAULT */}
            {activeSubTab === 'VAULT' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 font-mono">ENCRYPTED LOCAL FILE SYSTEM</h2>
                                <p className="text-xs text-slate-500">All documents require authoritative biometric verification before memory decryption.</p>
                            </div>
                            <div className="flex space-x-3">
                                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center space-x-2">
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Encrypt New File</span>
                                </button>
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-bold mb-4 flex items-center space-x-2">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono uppercase text-[10px]">
                                        <th className="p-3">Document Name</th>
                                        <th className="p-3">Size</th>
                                        <th className="p-3">Cipher / Key Binding</th>
                                        <th className="p-3">Timestamp</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {vaultFiles.map(f => (
                                        <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-bold text-slate-900 flex items-center space-x-2">
                                                {f.status.includes('UNLOCKED') ? (
                                                    <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                ) : (
                                                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                )}
                                                <span className="truncate max-w-xs">{f.name}</span>
                                            </td>
                                            <td className="p-3 font-mono text-slate-500">{f.size}</td>
                                            <td className="p-3 font-mono text-blue-600 font-bold">{f.enc}</td>
                                            <td className="p-3 font-mono text-slate-500">{f.date}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${f.status.includes('UNLOCKED') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                    {f.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button 
                                                    onClick={() => handleDecrypt(f.id)}
                                                    disabled={f.status.includes('UNLOCKED') || decryptingFileId === f.id}
                                                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-[11px] transition-colors border border-slate-200 disabled:opacity-50"
                                                >
                                                    {decryptingFileId === f.id ? '...' : (f.status.includes('UNLOCKED') ? 'Unlocked' : 'Decrypt')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PRIVACY */}
            {activeSubTab === 'PRIVACY' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="border-b border-slate-200 pb-4">
                            <h2 className="text-sm font-bold text-slate-900 font-mono">ZERO-TELEMETRY SOVEREIGNTY VERIFICATION</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Architectural audit confirming local data isolation and zero external network transmission.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold font-mono text-slate-900">BIOMETRIC REFERENCE TEMPLATES</span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">● LOCAL ONLY</span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Your facial mesh, vocal harmonics, fingerprint hashes, and cognitive reflex baselines are stored exclusively within local enclave memory. No biometric data leaves this physical machine.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold font-mono text-slate-900">ANALYTICS & USAGE TELEMETRY</span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">● ZERO TRACKING</span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    BioShield does not include third-party tracking scripts, advertising identifiers, or cloud diagnostic pingers. All security audit logs remain strictly on this disk.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: CLOUD STORAGE */}
            {activeSubTab === 'CLOUD' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 font-mono">OPTIONAL CLOUD SYNCHRONIZATION</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Connect to BioShield Cloud for end-to-end encrypted backup of your Secure Vault and policy templates.</p>
                            </div>
                            <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${cloudConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                {cloudConnected ? '● CLOUD CONNECTED' : '○ DISCONNECTED (LOCAL ONLY)'}
                            </span>
                        </div>

                        {!cloudConnected ? (
                            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-6">
                                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                                    <Cloud className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900">BioShield Cloud Account Not Linked</h3>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        Your workstation is currently operating in 100% offline local isolation mode. To enable cross-device synchronization or cloud vault backups, sign in with your optional BioShield account.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowLoginModal(true)}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                                >
                                    Connect BioShield Cloud Account
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-xs shadow-sm">
                                            CL
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-900">{user?.email || 'authenticated'}@bioshield.cloud</div>
                                            <div className="text-xs text-blue-700 font-mono mt-0.5">Tier: Enterprise Zero-Knowledge Plan</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCloudDisconnect}
                                        className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center space-x-1.5"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        <span>Disconnect Cloud Account</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Cloud Login Modal */}
                    {showLoginModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                                    <div className="flex items-center space-x-2">
                                        <Cloud className="w-5 h-5 text-blue-600" />
                                        <span className="font-extrabold text-sm text-slate-900 font-mono">CONNECT CLOUD ACCOUNT</span>
                                    </div>
                                    <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">×</button>
                                </div>

                                <form onSubmit={handleCloudConnect} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 font-mono mb-1">CLOUD EMAIL ADDRESS</label>
                                        <input
                                            type="email"
                                            required
                                            value={loginEmail}
                                            onChange={(e) => setLoginEmail(e.target.value)}
                                            placeholder="alice@bioshield.cloud"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 font-mono mb-1">ACCOUNT PASSWORD</label>
                                        <input
                                            type="password"
                                            required
                                            value={loginPass}
                                            onChange={(e) => setLoginPass(e.target.value)}
                                            placeholder="••••••••••••••••"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                                        />
                                    </div>

                                    <div className="pt-2 flex space-x-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowLoginModal(false)}
                                            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-200"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={cloudStatus === 'CONNECTING'}
                                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center space-x-1.5"
                                        >
                                            {cloudStatus === 'CONNECTING' ? <span>Authenticating...</span> : <span>Sign In & Sync</span>}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
