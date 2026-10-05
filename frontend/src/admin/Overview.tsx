import React, { useEffect, useState } from "react";
import { adminApi } from "../../services/adminApi";
import { Users, Activity, ShieldAlert, UserX, Globe } from 'lucide-react';

export default function Overview() {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        adminApi.getOverview().then(setData).catch(console.error);
    }, []);

    if (!data) return (
        <div className="flex justify-center items-center h-64 text-slate-400 animate-pulse">
            Loading Security Telemetry...
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <StatCard
                title="Total Users"
                value={data.totalUsers}
                icon={<Users className="w-6 h-6 text-blue-500" />}
                color="bg-blue-50"
            />
            <StatCard
                title="Active Sessions"
                value={data.activeSessions}
                icon={<Globe className="w-6 h-6 text-emerald-500" />}
                color="bg-emerald-50"
            />
            <StatCard
                title="Disabled Accounts"
                value={data.disabledAccounts}
                icon={<UserX className="w-6 h-6 text-slate-500" />}
                color="bg-slate-100"
            />
            <StatCard
                title="High Risk Logins"
                value={data.highRiskEvents}
                icon={<Activity className="w-6 h-6 text-red-500" />}
                color="bg-red-50"
            />
            <StatCard
                title="Security Alerts"
                value={data.unresolvedSecurityEvents}
                icon={<ShieldAlert className="w-6 h-6 text-amber-500" />}
                color="bg-amber-50"
            />
        </div>
    );
}

function StatCard({ title, value, icon, color }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
            <div className={`p-3 rounded-xl ${color}`}>
                {icon}
            </div>
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</h3>
                <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            </div>
        </div>
    );
}
