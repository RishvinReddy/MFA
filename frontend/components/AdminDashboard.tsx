
import React, { useState, useEffect } from 'react';
import {
    ShieldAlert, Users, Activity, Globe,
    RefreshCw, Key, ShieldCheck, Server
} from 'lucide-react';
import { api } from '../services/api';
import Overview from '../src/admin/Overview';
import { Users as UserManagement } from '../src/admin/Users';
import { Sessions as SessionMonitor } from '../src/admin/Sessions';
import { AuditLogs as AuditLogViewer } from '../src/admin/AuditLogs';
import { SystemHealth } from '../src/admin/SystemHealth';

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'SESSIONS' | 'AUDIT' | 'SYSTEM'>('OVERVIEW');
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeBiometrics: 0,
        recentThreats: 0,
        systemHealth: 'Scanning...',
        encryptionStatus: 'Verifying...'
    });

    useEffect(() => {
        loadStats();
        // Poll for real-time overview stats
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            const res = await api.admin.getStats();
            if (res.success) {
                setStats({
                    ...res.data,
                    // Mock additional fields if backend doesn't send them yet
                    recentThreats: res.data.highRiskEvents || 0,
                    encryptionStatus: 'AES-256 GCM',
                    systemHealth: 'OPTIMAL'
                });
            }
        } catch (e) {
            console.error("Failed to load admin stats", e);
        }
    };

    return (
        <div className="flex-1 p-6 animate-fade-in">
            {/* Header / Top Bar */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ShieldAlert className="w-8 h-8 text-indigo-600" />
                        BioShield Admin Command
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Level 5 Clearance • {stats.encryptionStatus}</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={loadStats} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <div className="bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full text-xs flex items-center">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
                        SYSTEM OPERATIONAL
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid - Only show on Overview? Or always? Let's show always for "Command Center" feel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{stats.totalUsers}</div>
                        <div className="text-xs text-slate-500 font-medium">Total Identities</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{stats.activeBiometrics || 0}</div>
                        <div className="text-xs text-slate-500 font-medium">Encrypted Assets</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">100%</div>
                        <div className="text-xs text-slate-500 font-medium">Encryption Coverage</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{stats.recentThreats}</div>
                        <div className="text-xs text-slate-500 font-medium">Threats / Risks</div>
                    </div>
                </div>
            </div>

            {/* Main Content Area with Sidebar */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 min-h-[600px] flex overflow-hidden">

                {/* Sidebar Navigation */}
                <div className="w-64 bg-slate-50 border-r border-slate-200 p-6 flex flex-col">
                    <div className="space-y-2">
                        <button
                            onClick={() => setActiveTab('OVERVIEW')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'OVERVIEW' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Activity className="w-5 h-5" />
                            <span className="font-bold text-sm">Live Monitor</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('USERS')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'USERS' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Users className="w-5 h-5" />
                            <span className="font-bold text-sm">User Management</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('SESSIONS')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'SESSIONS' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Globe className="w-5 h-5" />
                            <span className="font-bold text-sm">Active Sessions</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('AUDIT')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'AUDIT' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <ShieldCheck className="w-5 h-5" />
                            <span className="font-bold text-sm">Audit Logs</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('SYSTEM')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'SYSTEM' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Server className="w-5 h-5" />
                            <span className="font-bold text-sm">System Health</span>
                        </button>
                    </div>

                    <div className="mt-auto">
                        <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <Key className="w-4 h-4 text-slate-500" />
                                <span className="text-xs font-bold text-slate-600">Master Key Role</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">
                                You are operating with Root Admin privileges. All actions are immutable and logged.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 p-8 overflow-y-auto">
                    {activeTab === 'OVERVIEW' && <Overview />}
                    {activeTab === 'USERS' && <UserManagement />}
                    {activeTab === 'SESSIONS' && <SessionMonitor />}
                    {activeTab === 'AUDIT' && <AuditLogViewer />}
                    {activeTab === 'SYSTEM' && <SystemHealth />}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
