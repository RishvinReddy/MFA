import React, { useState } from 'react';
import { 
    Server, Key, Sliders, Info, ShieldAlert, 
    AlertTriangle, CheckCircle2, Copy, Check, 
    Terminal, Lock, Globe, Database, Cpu, 
    RefreshCw, Bell, Shield, ExternalLink
} from 'lucide-react';

interface AdvancedSystemViewProps {
    activeSubTab: string;
}

export const AdvancedSystemView: React.FC<AdvancedSystemViewProps> = ({ activeSubTab }) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [showSecurityWarning, setShowSecurityWarning] = useState(false);

    const [integrations, setIntegrations] = useState([
        { id: 'splunk', name: 'Splunk SIEM Forwarder', desc: 'Forward real-time biometric and behavioral audit events to SIEM via HEC protocol.', status: 'NOT CONNECTED', icon: Database, category: 'SIEM / Analytics' },
        { id: 'okta', name: 'Okta / Azure AD Federation', desc: 'Bind workstation TPM attestation tokens to cloud workforce SAML/OIDC SSO identities.', status: 'NOT CONNECTED', icon: Globe, category: 'Identity Federation' },
        { id: 'aws', name: 'AWS IAM Enclave Attestation', desc: 'Provide cryptographic proof of local workstation health to AWS STS for role elevation.', status: 'NOT CONNECTED', icon: Server, category: 'Cloud Infrastructure' },
    ]);

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(id);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                        {activeSubTab === 'INTEGRATIONS' && <Server className="w-5 h-5" />}
                        {activeSubTab === 'DEVELOPER' && <Key className="w-5 h-5" />}
                        {activeSubTab === 'PREFERENCES' && <Sliders className="w-5 h-5" />}
                        {activeSubTab === 'ABOUT' && <Info className="w-5 h-5" />}
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                            {activeSubTab === 'INTEGRATIONS' && 'ENTERPRISE SIEM & IDENTITY INTEGRATIONS'}
                            {activeSubTab === 'DEVELOPER' && 'DEVELOPER CONSOLE & API ACCESS'}
                            {activeSubTab === 'PREFERENCES' && 'SYSTEM & WORKSTATION PREFERENCES'}
                            {activeSubTab === 'ABOUT' && 'ABOUT BIOSHIELD ZERO-TRUST ARCHITECTURE'}
                        </h1>
                        <p className="text-xs text-slate-500 font-mono">
                            {activeSubTab === 'INTEGRATIONS' && 'Connect local workstation audit events to enterprise SIEM and identity federation providers.'}
                            {activeSubTab === 'DEVELOPER' && 'Manage local SDK endpoints, webhooks, and cryptographic verification policies for custom apps.'}
                            {activeSubTab === 'PREFERENCES' && 'Configure security notifications, local display preferences, and workstation timeout rules.'}
                            {activeSubTab === 'ABOUT' && 'Cryptographic specifications, version telemetry, and regulatory compliance notices.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* TAB 1: INTEGRATIONS */}
            {activeSubTab === 'INTEGRATIONS' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="border-b border-slate-200 pb-4">
                            <h2 className="text-sm font-bold text-slate-900 font-mono">ENTERPRISE FEDERATION MODULES</h2>
                            <p className="text-xs text-slate-500 mt-0.5">All integrations execute locally on this workstation and transmit only encrypted audit receipts.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {integrations.map(intg => {
                                const Icon = intg.icon;
                                const isConn = intg.status === 'CONNECTED';
                                return (
                                    <div key={intg.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex items-start space-x-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 shadow-sm">
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <h3 className="font-bold text-sm text-slate-900">{intg.name}</h3>
                                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-mono font-bold">{intg.category}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-xl">{intg.desc}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
                                            <span className={`px-3 py-1 rounded-xl text-[11px] font-mono font-bold ${isConn ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-200/80 text-slate-700 border border-slate-300'}`}>
                                                {intg.status}
                                            </span>
                                            <button 
                                                onClick={() => {
                                                    setIntegrations(prev => prev.map(i => i.id === intg.id ? { ...i, status: i.status === 'CONNECTED' ? 'NOT CONNECTED' : 'CONNECTED' } : i));
                                                }}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isConn ? 'bg-white hover:bg-red-50 text-red-600 border border-slate-200' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                            >
                                                {isConn ? 'Disconnect' : 'Configure & Connect'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: DEVELOPER CONSOLE */}
            {activeSubTab === 'DEVELOPER' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 font-mono">LOCAL IPC & API ENDPOINTS</h2>
                                <p className="text-xs text-slate-500">Integrate BioShield workstation verification into custom desktop applications or local service scripts.</p>
                            </div>
                            <button
                                onClick={() => setShowSecurityWarning(true)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center space-x-1.5"
                            >
                                <Key className="w-3.5 h-3.5" />
                                <span>Generate Live Production Key</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-900 font-mono">LOCAL DEVELOPMENT TEST KEY (SANDBOX)</span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">● ACTIVE</span>
                                </div>
                                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-700 shadow-sm">
                                    <span className="truncate">bs_test_51Mz294Lkp09384jf902834jfkdsl9084</span>
                                    <button 
                                        onClick={() => handleCopy('test', 'bs_test_51Mz294Lkp09384jf902834jfkdsl9084')}
                                        className="text-slate-500 hover:text-slate-900 ml-2 transition-colors flex items-center space-x-1 font-sans text-xs font-bold shrink-0"
                                    >
                                        {copiedKey === 'test' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedKey === 'test' ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-500">Use this test key for local development and sandbox UI testing. Do not use in production builds.</p>
                            </div>
                        </div>

                        {/* Architectural Security Notice */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-xs text-amber-900">
                            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold font-mono uppercase">Architectural Security Enforcement</span>
                                <p className="mt-0.5 leading-relaxed text-amber-800">
                                    Live production API keys (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">pk_live_...</code>) cannot be generated, displayed, or stored within client-side React JavaScript code. Production credentials must be provisioned and managed exclusively via secure server-side administrative enclaves or dedicated CLI tools.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Security Modal */}
                    {showSecurityWarning && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
                                <div className="flex items-center space-x-3 text-red-600 border-b border-slate-200 pb-3">
                                    <AlertTriangle className="w-6 h-6 shrink-0" />
                                    <h3 className="font-extrabold text-base text-slate-900 font-mono">PRODUCTION SECRET ENFORCEMENT</h3>
                                </div>
                                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                                    <p>
                                        You are attempting to generate a live production cryptographic key from a client-side interface.
                                    </p>
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 font-mono text-[11px] space-y-1">
                                        <div>● ERROR: CLIENT_SIDE_KEY_PROVISIONING_BLOCKED</div>
                                        <div>● REASON: Zero-Trust Architectural Policy Violation</div>
                                        <div>● REMEDIATION: Execute <span className="font-bold">`bioshield-cli keys generate --env=prod`</span> from an authenticated root shell.</div>
                                    </div>
                                    <p>
                                        To protect your infrastructure against cross-site scripting (XSS) and client-side extraction, BioShield strictly prohibits generating live API keys in the browser.
                                    </p>
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <button
                                        onClick={() => setShowSecurityWarning(false)}
                                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                                    >
                                        Acknowledge & Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: PREFERENCES */}
            {activeSubTab === 'PREFERENCES' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="border-b border-slate-200 pb-4">
                        <h2 className="text-sm font-bold text-slate-900 font-mono">WORKSTATION SECURITY NOTIFICATIONS & DISPLAY</h2>
                        <p className="text-xs text-slate-500">Configure local desktop alerts and hardware interaction feedback.</p>
                    </div>

                    <div className="space-y-4">
                        {[
                            { title: 'Biometric Verification Failure Alerts', desc: 'Display native Windows desktop notification when an authentication attempt is rejected.' },
                            { title: 'Hardware Attestation Drift Warning', desc: 'Alert immediately if TPM 2.0 PCR registers change during an active session.' },
                            { title: 'High Contrast Biometric Framing', desc: 'Enhance visual border contrast during facial and palm capture for improved accessibility.' },
                        ].map((pref, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                                <div>
                                    <div className="font-bold text-xs text-slate-900">{pref.title}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">{pref.desc}</div>
                                </div>
                                <button className="w-12 h-6 rounded-full bg-blue-600 transition-colors relative shrink-0 p-0.5">
                                    <div className="w-5 h-5 rounded-full bg-white shadow-sm translate-x-6"></div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 4: ABOUT */}
            {activeSubTab === 'ABOUT' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 font-mono">BIOSHIELD ZERO-TRUST IDENTITY ENGINE</h2>
                            <p className="text-xs text-slate-500">Production Build Telemetry & Architecture Specifications</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-mono text-xs font-bold">
                            v9.4.2-PROD
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                            <span className="text-slate-500 font-bold">CRYPTOGRAPHIC CIPHER</span>
                            <div className="text-slate-900 font-extrabold text-sm">AES-256-GCM / SHA-384</div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                            <span className="text-slate-500 font-bold">HARDWARE ROOT OF TRUST</span>
                            <div className="text-slate-900 font-extrabold text-sm">TPM 2.0 / UEFI Secure Boot</div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                            <span className="text-slate-500 font-bold">BIOMETRIC MATCHING ENGINE</span>
                            <div className="text-slate-900 font-extrabold text-sm">Offline Enclave (Local Only)</div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                            <span className="text-slate-500 font-bold">COMPLIANCE ASSURANCE</span>
                            <div className="text-slate-900 font-extrabold text-sm">FIPS 140-3 / Zero-Trust Ready</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
