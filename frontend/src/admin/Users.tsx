import React, { useEffect, useState } from "react";
import { adminApi } from "../../services/adminApi";
import { User, Shield, ShieldOff, LogOut, RefreshCw, CheckCircle, XCircle, Search } from 'lucide-react';

interface UserData {
    id: string;
    email: string;
    role: string;
    mfaEnabled: boolean;
    isDisabled: boolean;
    isActive: boolean; // Computed or from backend
    createdAt: string;
}

export const Users = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getUsers();
            if (Array.isArray(data)) {
                setUsers(data as any as UserData[]);
            } else if (data.data && Array.isArray(data.data)) {
                setUsers(data.data as any as UserData[]);
            } else {
                console.error("Unexpected user data format", data);
                setUsers([]);
            }
        } catch (error) {
            console.error("Failed to load users", error);
        } finally {
            setLoading(false);
        }
    };

    const disable = async (id: string) => {
        if (!window.confirm("Are you sure you want to disable this user?")) return;
        await adminApi.disableUser(id);
        loadUsers();
    };

    const enable = async (id: string) => {
        await adminApi.enableUser(id);
        loadUsers();
    };

    const forceLogout = async (id: string) => {
        if (!window.confirm("Force logout for this user? They will be signed out immediately.")) return;
        await adminApi.forceLogout(id);
        alert("User sessions terminated");
    };

    const resetMfa = async (id: string) => {
        if (!window.confirm("Reset MFA for this user? They will need to set it up again.")) return;
        await adminApi.resetMfa(id);
        loadUsers();
    };

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-6 h-6 text-indigo-600" />
                    User Management
                </h2>
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm w-64"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                <th className="p-4">Email</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">MFA Status</th>
                                <th className="p-4">Account Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading directory...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No users found.</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 font-medium text-slate-900">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                    {user.email.charAt(0).toUpperCase()}
                                                </div>
                                                {user.email}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {user.mfaEnabled ? (
                                                <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                                                    <Shield className="w-3.5 h-3.5" /> Enabled
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-amber-600 text-xs font-bold">
                                                    <ShieldOff className="w-3.5 h-3.5" /> Disabled
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {user.isDisabled ? (
                                                <span className="flex items-center gap-1.5 text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded-full w-fit">
                                                    <XCircle className="w-3.5 h-3.5" /> Disabled
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full w-fit">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {user.isDisabled ? (
                                                    <button
                                                        onClick={() => enable(user.id)}
                                                        className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                                                        title="Enable Account"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => disable(user.id)}
                                                        className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                                        title="Disable Account"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => forceLogout(user.id)}
                                                    className="p-1.5 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors"
                                                    title="Force Logout"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => resetMfa(user.id)}
                                                    className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                                                    title="Reset MFA"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
