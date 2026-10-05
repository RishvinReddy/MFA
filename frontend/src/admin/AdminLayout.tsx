import React from 'react';
import { Outlet, Link, useLocation } from "react-router-dom";
import { ShieldAlert, Activity, Users, Globe, LogOut } from 'lucide-react';

export default function AdminLayout() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="flex min-h-screen bg-[#F3F5F9] font-sans text-slate-900">
            <aside className="w-64 bg-white text-slate-700 flex flex-col fixed h-full z-10 border-r border-slate-200 shadow-sm">
                <div className="p-6 border-b border-slate-200">
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 font-mono">
                        <ShieldAlert className="w-6 h-6 text-blue-600" />
                        Control Center
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-mono font-bold">Security Command</p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link
                        to="/admin"
                        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-mono ${isActive('/admin') ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold' : 'hover:bg-slate-100 text-slate-600'}`}
                    >
                        <Activity className="w-5 h-5" />
                        <span className="text-sm">Overview</span>
                    </Link>
                    <Link
                        to="/admin/users"
                        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-mono ${isActive('/admin/users') ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold' : 'hover:bg-slate-100 text-slate-600'}`}
                    >
                        <Users className="w-5 h-5" />
                        <span className="text-sm">Users</span>
                    </Link>
                    <Link
                        to="/admin/sessions"
                        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-mono ${isActive('/admin/sessions') ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold' : 'hover:bg-slate-100 text-slate-600'}`}
                    >
                        <Globe className="w-5 h-5" />
                        <span className="text-sm">Sessions</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-slate-200">
                    <Link to="/" className="flex items-center space-x-3 px-4 py-3 w-full rounded-xl hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors font-mono">
                        <LogOut className="w-5 h-5" />
                        <span className="font-bold text-sm">Exit Console</span>
                    </Link>
                </div>
            </aside>

            <main className="flex-1 ml-64 p-8">
                <header className="mb-8 flex justify-between items-center bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900 font-mono">ADMINISTRATIVE COMMAND</h1>
                        <p className="text-slate-500 text-xs font-mono mt-0.5">Real-time enterprise security telemetry and workstation governance</p>
                    </div>
                    <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
                        <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-mono text-emerald-700 font-bold">SYSTEM ONLINE</span>
                    </div>
                </header>
                <div className="animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
