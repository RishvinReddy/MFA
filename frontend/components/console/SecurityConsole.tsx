import React, { useState, useEffect } from 'react';
import { 
    Shield, ShieldCheck, Lock, LogOut, Menu, X, 
    ChevronRight, Activity, HardDrive, Lock as LockIcon, 
    Layers, Sliders, Info, Server, Key, Eye, User, 
    HelpCircle, MessageSquare, Send, Sparkles, AlertTriangle, 
    FileText, CheckCircle2, Clock
} from 'lucide-react';
import { OverviewView } from './OverviewView';
import { IdentityAccessView } from './IdentityAccessView';
import { ContinuousSecurityView } from './ContinuousSecurityView';
import { DataProtectionView } from './DataProtectionView';
import { AdvancedSystemView } from './AdvancedSystemView';
import { AiAdvisoryView } from './AiAdvisoryView';
import { api } from '../../services/api';


interface SecurityConsoleProps {
    onLock: () => void;
}

export type ConsoleTab = 
    | 'DASHBOARD' 
    | 'BIOMETRICS' | 'AUTH_POLICY' | 'SESSIONS_RECOVERY' 
    | 'BEHAVIORAL' | 'TRUST_RISK' | 'DEVICE_SEC' | 'ACTIVITY' 
    | 'VAULT' | 'PRIVACY' | 'CLOUD' 
    | 'AI_ADVISORY'
    | 'INTEGRATIONS' | 'DEVELOPER' 
    | 'PREFERENCES' | 'ABOUT';

export const SecurityConsole: React.FC<SecurityConsoleProps> = ({ onLock }) => {
    const [activeTab, setActiveTab] = useState<ConsoleTab>('DASHBOARD');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    const [telemetry, setTelemetry] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [enrollment, setEnrollment] = useState<any>(null);

    // AI Assistant State
    const [showAiDrawer, setShowAiDrawer] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [aiMessages, setAiMessages] = useState<Array<{sender: 'USER' | 'AI', text: string}>>([
        { sender: 'AI', text: 'BioShield AI initialized. I have full context of your telemetry. How can I assist?' }
    ]);

    const handleSendAi = (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiInput.trim()) return;
        setAiMessages(prev => [...prev, { sender: 'USER', text: aiInput }]);
        setAiInput('');
        setTimeout(() => {
            setAiMessages(prev => [...prev, { sender: 'AI', text: 'Local LLM analysis is temporarily unavailable.' }]);
        }, 600);
    };

    // trustScore deliberately removed per Phase 18

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [userData, telData, enrollData] = await Promise.all([
                    api.getMe().catch(() => null),
                    api.native.getSystemDiagnostics().catch(() => null),
                    api.getEnrollmentStatus().catch(() => null)
                ]);
                setUser(userData);
                setTelemetry(telData);
                setEnrollment(enrollData);
            } catch (err) {
                console.error("Failed to load dashboard data:", err);
            }
        };
        fetchDashboardData();
    }, []);

    const handleNavigate = (tabStr: string) => {
        setActiveTab(tabStr as ConsoleTab);
        setSidebarOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const navSections = [
        {
            title: 'OVERVIEW',
            items: [
                { id: 'DASHBOARD', label: 'Dashboard', icon: ShieldCheck }
            ]
        },
        {
            title: 'IDENTITY & ACCESS',
            items: [
                { id: 'BIOMETRICS', label: 'Identity & Biometrics', icon: Shield },
                { id: 'AUTH_POLICY', label: 'Authentication Policy', icon: Sliders },
                { id: 'SESSIONS_RECOVERY', label: 'Sessions & Recovery', icon: LockIcon }
            ]
        },
        {
            title: 'CONTINUOUS SECURITY',
            items: [
                { id: 'BEHAVIORAL', label: 'Behavioral Intelligence', icon: Activity },
                { id: 'TRUST_RISK', label: 'Trust & Risk', icon: Layers },
                { id: 'DEVICE_SEC', label: 'Device Security', icon: HardDrive },
                { id: 'ACTIVITY', label: 'Security Activity', icon: Clock }
            ]
        },
        {
            title: 'DATA PROTECTION',
            items: [
                { id: 'VAULT', label: 'Secure Vault', icon: FileText },
                { id: 'PRIVACY', label: 'Privacy & Data Control', icon: Eye },
                { id: 'CLOUD', label: 'Cloud Storage', icon: Server }
            ]
        },
        {
            title: 'AI INTELLIGENCE',
            items: [
                { id: 'AI_ADVISORY', label: 'AI Advisory Engine', icon: Sparkles }
            ]
        },
        {
            title: 'ADVANCED',
            items: [
                { id: 'INTEGRATIONS', label: 'Integrations', icon: Server },
                { id: 'DEVELOPER', label: 'Developer Console', icon: Key }
            ]
        },
        {
            title: 'SYSTEM',
            items: [
                { id: 'PREFERENCES', label: 'Preferences', icon: Sliders },
                { id: 'ABOUT', label: 'About', icon: Info }
            ]
        }
    ];

    const getBreadcrumb = () => {
        for (const sec of navSections) {
            const found = sec.items.find(i => i.id === activeTab);
            if (found) return `${sec.title} / ${found.label}`;
        }
        return 'OVERVIEW / Dashboard';
    };

    return (
        <div className="app-shell flex bg-[#F3F5F9] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* AI Assistant Drawer */}
            {showAiDrawer && (
                <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-fade-in">
                    <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 font-mono">Zero-Trust AI Assistant</h3>
                                <p className="text-[10px] text-emerald-600 font-mono font-bold">● LOCAL TELEMETRY BOUND</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAiDrawer(false)} className="text-slate-400 hover:text-slate-700 text-lg">×</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
                        {aiMessages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}>
                                <span className="text-[9px] text-slate-400 mb-0.5 px-1 font-bold">{msg.sender}</span>
                                <div className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${msg.sender === 'USER' ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleSendAi} className="p-4 border-t border-slate-200 bg-slate-50 flex space-x-2">
                        <input
                            type="text"
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            placeholder="Query trust score, vault, or risk logs..."
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                        />
                        <button type="submit" className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-md shadow-blue-500/20">
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div 
                    onClick={() => setSidebarOpen(false)} 
                    className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden animate-fade-in"
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} shadow-sm`}>
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Top Logo & Protection Badge */}
                    <div className="space-y-3 pb-4 border-b border-slate-200">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-0.5 shadow-md shadow-blue-500/20 flex items-center justify-center">
                                <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                                </div>
                            </div>
                            <div>
                                <span className="text-lg font-extrabold tracking-tight text-slate-900 font-mono">BioShield<span className="text-blue-600">.ID</span></span>
                                <span className="block text-[10px] text-slate-400 font-mono font-bold">SECURITY CONSOLE</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>● SYSTEM PROTECTED</span>
                        </div>
                    </div>

                    {/* Navigation Sections */}
                    <div className="space-y-6">
                        {navSections.map((sec, sIdx) => (
                            <div key={sIdx} className="space-y-1">
                                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-3 py-1 font-mono">
                                    {sec.title}
                                </div>
                                <div className="space-y-0.5">
                                    {sec.items.map(item => {
                                        const Icon = item.icon;
                                        const isActive = activeTab === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleNavigate(item.id)}
                                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all group ${isActive ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'}`}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
                                                    <span>{item.label}</span>
                                                </div>
                                                {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Session Trust Box & Lock Button */}
                <div className="p-5 border-t border-slate-200 bg-slate-50/80 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex justify-between items-center">
                            <span>SESSION STATUS</span>
                            <span className="text-emerald-600 font-bold">● ACTIVE</span>
                        </div>
                        <div className="text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1.5">
                            <span>VERIFIED</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs uppercase">
                                {user?.email ? user.email.substring(0, 2) : 'U'}
                            </div>
                            <div className="truncate min-w-0">
                                <div className="text-xs font-bold text-slate-900 leading-none truncate">{user?.email || 'Authenticated User'}</div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">Local Profile</div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onLock}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl text-xs transition-all shadow-md shadow-amber-500/20 flex items-center justify-center space-x-2 group"
                    >
                        <Lock className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>Lock BioShield</span>
                    </button>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Top Navbar */}
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-xl bg-slate-100 border border-slate-200"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="font-mono text-xs text-slate-500 flex items-center space-x-2">
                            <span className="text-slate-400 font-bold">CONSOLE</span>
                            <span>/</span>
                            <span className="text-slate-900 font-bold">{getBreadcrumb()}</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setShowAiDrawer(!showAiDrawer)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border ${showAiDrawer ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-300 hover:bg-blue-100/60'}`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI Security Assistant</span>
                        </button>
                    </div>
                </header>

                {/* Main View Area */}
                <main className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto overflow-y-auto min-h-0">
                    {activeTab === 'DASHBOARD' && (
                        <OverviewView telemetry={telemetry} user={user} enrollment={enrollment} onNavigate={handleNavigate} />
                    )}

                    {(activeTab === 'BIOMETRICS' || activeTab === 'AUTH_POLICY' || activeTab === 'SESSIONS_RECOVERY') && (
                        <IdentityAccessView activeSubTab={activeTab} onLockSession={onLock} user={user} enrollment={enrollment} />
                    )}

                    {(activeTab === 'BEHAVIORAL' || activeTab === 'TRUST_RISK' || activeTab === 'DEVICE_SEC' || activeTab === 'ACTIVITY') && (
                        <ContinuousSecurityView activeSubTab={activeTab} telemetry={telemetry} />
                    )}

                    {(activeTab === 'VAULT' || activeTab === 'PRIVACY' || activeTab === 'CLOUD') && (
                        <DataProtectionView activeSubTab={activeTab} user={user} />
                    )}

                    {activeTab === 'AI_ADVISORY' && (
                        <AiAdvisoryView />
                    )}
                    {(activeTab === 'INTEGRATIONS' || activeTab === 'DEVELOPER' || activeTab === 'PREFERENCES' || activeTab === 'ABOUT') && (
                        <AdvancedSystemView activeSubTab={activeTab} />
                    )}
                </main>
            </div>
        </div>
    );
};
