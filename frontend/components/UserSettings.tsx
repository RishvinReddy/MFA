import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../services/api';
import { User, Lock, Bell, Shield, Save, CheckCircle2, ChevronRight, Users, Link2, AlertTriangle, Plus, ToggleRight, Smartphone, Monitor, Globe, Key, Code, Moon, Sun, Laptop, Trash2, Eye, Copy, RefreshCw, Zap, EyeOff, Terminal, LogOut, Siren, Workflow, Sliders, Skull, Radio, Flame, Unplug, HardDrive, Share2, AlertOctagon, Router, Server, Activity, ScanFace, Mic, Fingerprint, BrainCircuit, ShieldCheck } from 'lucide-react';
import PrivacyVault from './PrivacyVault';
import { TrustContact } from '../types';

const INITIAL_CONTACTS: TrustContact[] = [
    { id: 'c1', name: 'Sarah Connor', relation: 'Team Lead', status: 'ACTIVE', lastVerified: '2d ago' },
    { id: 'c2', name: 'John Doe', relation: 'Spouse', status: 'PENDING', lastVerified: 'N/A' }
];

const MOCK_SESSIONS: any[] = [];

const MOCK_API_KEYS: any[] = [];

const UserSettings: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'notifications' | 'privacy' | 'sessions' | 'developer' | 'appearance' | 'emergency' | 'integrations'>('profile');
    const [saved, setSaved] = useState(false);
    const [trustContacts, setTrustContacts] = useState(INITIAL_CONTACTS);
    const [sessions, setSessions] = useState(MOCK_SESSIONS);
    const [apiKeys, setApiKeys] = useState(MOCK_API_KEYS);
    const [showKey, setShowKey] = useState<string | null>(null);

    // Biometric Tuning State
    const [bioThreshold, setBioThreshold] = useState(92);
    const [livenessMode, setLivenessMode] = useState<'STANDARD' | 'STRICT' | 'PARANOID'>('STRICT');

    // Emergency State
    const [duressCode, setDuressCode] = useState('');
    const [destructArmed, setDestructArmed] = useState(false);

    // Authentication Protocol State
    const [authLevel, setAuthLevel] = useState<'BASIC' | 'STANDARD' | 'HIGH' | 'CUSTOM'>('STANDARD');
    const [protocols, setProtocols] = useState({
        password: true,
        face: true,
        voice: false,
        palm: false,
        fingerprint: true, // Added fingerprint default
        cognitive: false,
        behavioral: true
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const revokeSession = (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
    };

    const deleteKey = (id: string) => {
        setApiKeys(prev => prev.filter(k => k.id !== id));
    };

    const handleLevelChange = (level: 'BASIC' | 'STANDARD' | 'HIGH') => {
        setAuthLevel(level);
        switch (level) {
            case 'BASIC':
                setProtocols({ password: true, face: false, voice: false, palm: false, fingerprint: false, cognitive: false, behavioral: false });
                break;
            case 'STANDARD':
                setProtocols({ password: true, face: true, voice: false, palm: false, fingerprint: true, cognitive: false, behavioral: true });
                break;
            case 'HIGH':
                setProtocols({ password: true, face: true, voice: true, palm: true, fingerprint: true, cognitive: true, behavioral: true });
                break;
        }
    };

    const toggleProtocol = (key: keyof typeof protocols) => {
        setProtocols(prev => {
            const newState = { ...prev, [key]: !prev[key] };
            setAuthLevel('CUSTOM');
            return newState;
        });
    };

    // Placeholder for handleMfaSetup if needed, but for now just Passkey
    const handlePasskeySetup = async () => {
        try {
            // 1. Get options from backend
            const options = await api.webauthn.getRegistrationOptions();

            // 2. Pass options to browser authenticator
            const registrationJSON = await startRegistration(options);

            // 3. Send response to verification endpoint
            const verificationResp = await api.webauthn.verifyRegistration({
                response: registrationJSON,
                deviceName: 'Windows PC' // You might want to get this dynamically or ask user
            });

            if (verificationResp.verified) {
                alert('Passkey Registered Successfully!');
            } else {
                alert('Passkey verification failed');
            }
        } catch (error: any) {
            console.error(error);
            alert(`Passkey error: ${error.message}`);
        }
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in p-4">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <div className="w-full md:w-64 space-y-2">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 px-4">Settings</h2>

                    {[
                        { id: 'profile', icon: User, label: 'Profile' },
                        { id: 'security', icon: Lock, label: 'Security' },
                        { id: 'emergency', icon: Siren, label: 'Emergency Protocol', danger: true },
                        { id: 'privacy', icon: Shield, label: 'Privacy Vault' },
                        { id: 'sessions', icon: Laptop, label: 'Active Sessions' },
                        { id: 'integrations', icon: Workflow, label: 'Integrations' },
                        { id: 'developer', icon: Code, label: 'Developer API' },
                        { id: 'notifications', icon: Bell, label: 'Notifications' },
                        { id: 'appearance', icon: Moon, label: 'Appearance' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id as any)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${activeSection === item.id
                                ? (item.danger ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-white shadow-sm text-cyan-700 font-medium ring-1 ring-slate-200')
                                : (item.danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-500 hover:bg-slate-100')
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1">
                    {activeSection === 'profile' && (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Profile Information</h3>
                            <form onSubmit={handleSave} className="space-y-6 max-w-lg">
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border-2 border-slate-200">
                                        <User className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <button type="button" className="text-sm text-white bg-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-500 transition-colors shadow-sm">Upload New</button>
                                        <p className="text-xs text-slate-400 mt-2">Recommended: 400x400px</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                                        <input type="text" defaultValue="Alice" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                                        <input type="text" defaultValue="Anderson" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                    <input type="email" defaultValue="alice.anderson@example.com" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Role / Department</label>
                                    <input type="text" defaultValue="Senior Security Analyst" disabled className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed" />
                                </div>
                                <button type="submit" className="flex items-center justify-center px-6 py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-500/20">
                                    {saved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    {saved ? 'Changes Saved' : 'Save Changes'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeSection === 'security' && (
                        <div className="space-y-6 animate-fade-in">

                            {/* Authentication Policy */}
                            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                                    <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" /> Authentication Policy
                                </h3>

                                {/* Level Presets */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                    {[
                                        { id: 'BASIC', label: 'Basic Access', desc: 'Email + Password only.', color: 'slate' },
                                        { id: 'STANDARD', label: 'Standard', desc: 'Face ID + Behavioral checks.', color: 'blue' },
                                        { id: 'HIGH', label: 'Fortress Mode', desc: 'All biometric factors enforced.', color: 'purple' }
                                    ].map((level) => (
                                        <button
                                            key={level.id}
                                            onClick={() => handleLevelChange(level.id as any)}
                                            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${authLevel === level.id
                                                ? `border-${level.color}-500 bg-${level.color}-50`
                                                : 'border-slate-100 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className={`font-bold ${authLevel === level.id ? `text-${level.color}-700` : 'text-slate-700'}`}>
                                                {level.label}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">{level.desc}</div>
                                            {authLevel === level.id && (
                                                <div className={`absolute top-2 right-2 p-1 rounded-full bg-${level.color}-200`}>
                                                    <CheckCircle2 className={`w-3 h-3 text-${level.color}-700`} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Protocol Toggles */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { id: 'password', label: 'Password', icon: Key, desc: 'Traditional knowledge-based auth' },
                                        { id: 'face', label: 'Face Geometry', icon: ScanFace, desc: '3D depth mapping' },
                                        { id: 'fingerprint', label: 'Touch ID / Fingerprint', icon: Fingerprint, desc: 'Capacitive/Optical Sensor' },
                                        { id: 'voice', label: 'Voice Print', icon: Mic, desc: 'Phrase verification' },
                                        { id: 'palm', label: 'Palm Vein', icon: Fingerprint, desc: 'Vascular scanning' },
                                        { id: 'cognitive', label: 'Cognitive Reflex', icon: BrainCircuit, desc: 'Reaction time challenges' },
                                        { id: 'behavioral', label: 'Behavioral', icon: Activity, desc: 'Continuous passive monitoring' },
                                    ].map((proto) => (
                                        <div key={proto.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${protocols[proto.id as keyof typeof protocols] ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-75'}`}>
                                            <div className="flex items-center space-x-3">
                                                <div className={`p-2 rounded-lg ${protocols[proto.id as keyof typeof protocols] ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                                    <proto.icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{proto.label}</div>
                                                    <div className="text-xs text-slate-500">{proto.desc}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleProtocol(proto.id as keyof typeof protocols)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${protocols[proto.id as keyof typeof protocols] ? 'bg-blue-600' : 'bg-slate-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${protocols[proto.id as keyof typeof protocols] ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {authLevel === 'CUSTOM' && (
                                    <div className="mt-4 p-3 bg-amber-50 text-amber-700 text-xs rounded-lg flex items-center border border-amber-100">
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        Custom security policy active. Ensure at least one strong authentication factor is enabled to prevent lockout.
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                                            <Fingerprint className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">Passkeys (WebAuthn)</h3>
                                            <p className="text-sm text-slate-500 max-w-sm mt-1">
                                                Login using TouchID, FaceID, or Windows Hello. Secure and passwordless.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handlePasskeySetup}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500 transition-colors flex items-center shadow-sm"
                                    >
                                        <Fingerprint className="w-4 h-4 mr-2" />
                                        Add Passkey
                                    </button>
                                </div>
                            </div>

                            {/* Trusted Contacts */}
                            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 flex items-center">
                                            <Users className="w-5 h-5 mr-2 text-indigo-600" /> Verifiable Trust Web
                                        </h3>
                                        <p className="text-sm text-slate-500">Social Recovery & Consensus Auth</p>
                                    </div>
                                    <button className="text-xs flex items-center px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100 transition-colors">
                                        <Plus className="w-3 h-3 mr-1" /> Add Trusted Contact
                                    </button>
                                </div>

                                <div className="grid gap-4">
                                    {trustContacts.map(contact => (
                                        <div key={contact.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-indigo-200 transition-colors">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500">
                                                    {contact.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{contact.name}</div>
                                                    <div className="text-xs text-slate-500">{contact.relation}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <div className="text-right">
                                                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${contact.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {contact.status}
                                                    </div>
                                                    {contact.status === 'ACTIVE' && (
                                                        <div className="text-[10px] text-slate-400 mt-0.5">Verified {contact.lastVerified}</div>
                                                    )}
                                                </div>
                                                <button className="p-2 text-slate-400 hover:text-slate-600">
                                                    <Link2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Biometric Calibration */}
                            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 flex items-center">
                                        <Sliders className="w-5 h-5 mr-2 text-blue-600" /> Biometric Calibration
                                    </h3>
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        {['STANDARD', 'STRICT', 'PARANOID'].map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={() => setLivenessMode(mode as any)}
                                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${livenessMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-bold text-slate-700">Face Match Confidence Threshold</label>
                                            <span className="text-sm font-mono text-blue-600 font-bold">{bioThreshold}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="75"
                                            max="99"
                                            value={bioThreshold}
                                            onChange={(e) => setBioThreshold(Number(e.target.value))}
                                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <p className="text-xs text-slate-500 mt-2 flex items-center">
                                            <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" />
                                            Higher thresholds increase security but may cause more False Rejections in poor lighting.
                                        </p>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-800 mb-2">Active Liveness Checks</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {['3D Depth Mapping', 'Gaze Tracking', 'Micro-Expression', 'Texture Analysis'].map(check => (
                                                <div key={check} className="flex items-center space-x-2 text-xs text-slate-600">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                    <span>{check}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'emergency' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-red-50 rounded-xl border border-red-100 p-8 shadow-sm">
                                <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center">
                                    <Siren className="w-5 h-5 mr-2" /> Duress Configuration
                                </h3>
                                <p className="text-sm text-red-700 mb-6 max-w-2xl">
                                    Configure a secondary PIN or password that, when used, will simulate a successful login into a localized "Honeypot" environment while silently alerting security teams.
                                </p>

                                <div className="max-w-md">
                                    <label className="block text-sm font-bold text-red-900 mb-1">Duress PIN / Password</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="password"
                                            value={duressCode}
                                            onChange={(e) => setDuressCode(e.target.value)}
                                            placeholder="Set silent alarm code"
                                            className="flex-1 p-2.5 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                        />
                                        <button className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                                            Set Code
                                        </button>
                                    </div>
                                    <p className="text-xs text-red-500 mt-2 italic">Never write this down. Memorize it.</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm relative overflow-hidden">
                                {destructArmed && (
                                    <div className="absolute inset-0 bg-red-600/10 z-0 animate-pulse pointer-events-none"></div>
                                )}
                                <div className="relative z-10">
                                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                                        <Skull className="w-5 h-5 mr-2 text-slate-600" /> Danger Zone
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
                                            <div>
                                                <div className="font-bold text-slate-900 text-sm">Dead Man's Switch</div>
                                                <div className="text-xs text-slate-500">Auto-release vault keys after 30 days of inactivity.</div>
                                            </div>
                                            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300 transition-colors">
                                                <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition" />
                                            </button>
                                        </div>

                                        <div className="border-t border-slate-100 pt-6 mt-6">
                                            <h4 className="font-bold text-red-600 text-sm mb-2">Account Self-Destruct</h4>
                                            <p className="text-xs text-slate-500 mb-4">
                                                Permanently delete all biometric templates, logs, and associated keys. This action is irreversible and instant.
                                            </p>
                                            <button
                                                onClick={() => setDestructArmed(!destructArmed)}
                                                className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 border-2 ${destructArmed
                                                    ? 'bg-red-600 text-white border-red-600 animate-pulse'
                                                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                                    }`}
                                            >
                                                <Flame className={`w-4 h-4 ${destructArmed ? 'animate-bounce' : ''}`} />
                                                <span>{destructArmed ? 'CONFIRM DESTRUCTION? CLICK TO EXECUTE' : 'ARM DESTRUCT PROTOCOL'}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'integrations' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white text-slate-900 rounded-xl border border-slate-200 p-8 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Router className="w-40 h-40 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-bold mb-4 flex items-center text-slate-900">
                                    <Server className="w-5 h-5 mr-2 text-blue-600" /> Enterprise Connectivity
                                </h3>

                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SIEM Log Forwarding</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center">
                                                <div className="p-1 bg-blue-100 rounded mr-3">
                                                    <Activity className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <input type="text" placeholder="splunk://ingest.company.com:8088" className="bg-transparent border-none outline-none text-sm text-slate-900 w-full placeholder-slate-400 font-mono" />
                                            </div>
                                            <button className="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors shadow-sm">Connect</button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold">O</div>
                                                <span className="font-bold text-sm text-slate-800">Okta SSO</span>
                                            </div>
                                            <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded font-bold">LINKED</span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between opacity-85 shadow-sm">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold">A</div>
                                                <span className="font-bold text-sm text-slate-800">AWS IAM</span>
                                            </div>
                                            <button className="text-[10px] border border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-900 px-2 py-1 rounded transition-colors font-bold">CONNECT</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'sessions' && (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm animate-fade-in">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900">Active Sessions</h3>
                                <button className="text-xs font-bold text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors flex items-center">
                                    <LogOut className="w-3 h-3 mr-2" /> Revoke All Other Sessions
                                </button>
                            </div>
                            <div className="space-y-4">
                                {sessions.map(session => (
                                    <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-slate-300 transition-all">
                                        <div className="flex items-start gap-4 mb-4 sm:mb-0">
                                            <div className={`p-3 rounded-xl ${session.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {session.type === 'LAPTOP' ? <Laptop className="w-6 h-6" /> : session.type === 'MOBILE' ? <Smartphone className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-slate-900">{session.device}</div>
                                                    {session.active && <div className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">Current</div>}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                                                    <span className="flex items-center"><Globe className="w-3 h-3 mr-1" /> {session.location}</span>
                                                    <span className="flex items-center"><Terminal className="w-3 h-3 mr-1" /> {session.ip}</span>
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1">{session.active ? 'Active now' : `Last seen: ${session.lastSeen}`}</div>
                                            </div>
                                        </div>
                                        {!session.active && (
                                            <button
                                                onClick={() => revokeSession(session.id)}
                                                className="text-xs font-bold text-slate-500 hover:text-red-600 px-3 py-2 rounded border border-slate-200 hover:border-red-200 transition-colors"
                                            >
                                                Revoke Access
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeSection === 'developer' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-slate-900 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Code className="w-32 h-32 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-bold mb-2 flex items-center text-slate-900"><Terminal className="w-5 h-5 mr-2 text-blue-600" /> Developer Console</h3>
                                <p className="text-slate-500 text-sm mb-6 max-w-lg">Manage API keys and webhooks for integrating BioShield MFA into your external applications.</p>

                                <div className="space-y-4">
                                    {apiKeys.map(key => (
                                        <div key={key.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-sm text-slate-900">{key.name}</span>
                                                    <span className="text-[10px] bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded text-slate-700 font-mono font-bold">READ/WRITE</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs font-mono text-emerald-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded font-bold">
                                                        {showKey === key.id ? 'pk_live_88392_x8s9_221' : key.prefix}
                                                    </code>
                                                    <button onClick={() => setShowKey(showKey === key.id ? null : key.id)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                                        {showKey === key.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    </button>
                                                    <button className="text-slate-400 hover:text-slate-700 transition-colors">
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className="text-[10px] text-slate-500">Created: {key.created}</div>
                                                    <div className="text-[10px] text-slate-400">Last used: {key.lastUsed}</div>
                                                </div>
                                                <button onClick={() => deleteKey(key.id)} className="p-2 bg-slate-700 rounded hover:bg-red-900/50 hover:text-red-400 transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button className="mt-6 flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                    <Plus className="w-4 h-4" />
                                    <span>Generate New Secret Key</span>
                                </button>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Webhooks</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Security Event Endpoint</label>
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="https://api.your-domain.com/webhooks/bioshield" className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-sm" />
                                            <button className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 hover:bg-slate-200">Test</button>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">We will send a POST request for events: <code>auth.failed</code>, <code>threat.detected</code>.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'appearance' && (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Interface Preferences</h3>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">Theme Mode</div>
                                        <div className="text-xs text-slate-500">Select your preferred interface theme.</div>
                                    </div>
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        <button className="p-2 rounded-md bg-white shadow-sm text-slate-900"><Sun className="w-4 h-4" /></button>
                                        <button className="p-2 rounded-md text-slate-500 hover:text-slate-900"><Moon className="w-4 h-4" /></button>
                                        <button className="p-2 rounded-md text-slate-500 hover:text-slate-900"><Monitor className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">Reduced Motion</div>
                                        <div className="text-xs text-slate-500">Minimize animations for better accessibility.</div>
                                    </div>
                                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2">
                                        <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition" />
                                    </button>
                                </div>

                                <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">High Contrast Data</div>
                                        <div className="text-xs text-slate-500">Increase contrast for charts and biometric graphs.</div>
                                    </div>
                                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-cyan-600 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2">
                                        <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
                                    </button>
                                </div>

                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 flex gap-3">
                                    <Zap className="w-5 h-5 text-blue-600 shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-bold text-blue-800">Performance Mode</h4>
                                        <p className="text-xs text-blue-600 mt-1">
                                            For older devices, enabling Reduced Motion also disables high-fidelity biometric visualizations (e.g., 3D Face Mesh) to save battery.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'notifications' && (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Notification Preferences</h3>
                            <div className="space-y-4">
                                {['New Device Login Alert', 'Biometric Threshold Warning', 'Monthly Security Report', 'API Rate Limit Alerts', 'Marketing Updates'].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg">
                                        <span className="text-sm font-medium text-slate-700">{item}</span>
                                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors ${i === 4 ? 'bg-slate-200' : 'bg-cyan-600'}`}>
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${i === 4 ? 'translate-x-1' : 'translate-x-6'}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeSection === 'privacy' && (
                        <div className="animate-fade-in">
                            <PrivacyVault />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserSettings;
