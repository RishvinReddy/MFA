import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { BarChart3, Users, Lock, Activity, RefreshCw, ShieldAlert } from 'lucide-react';
import { FusionGraph } from './FusionGraph';

export const BiometricDashboard = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Live Stream Data
    const [fusionStream, setFusionStream] = useState<any[]>([]);
    const [isAttackSimulated, setIsAttackSimulated] = useState(false);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await api.getBiometricStats();
            if (res.success) {
                setStats(res.stats);
            }
        } catch (e) {
            console.error("Failed to fetch stats", e);
        } finally {
            setLoading(false);
        }
    };

    const triggerAttack = () => {
        setIsAttackSimulated(true);
        setTimeout(() => setIsAttackSimulated(false), 5000); // 5s attack window
    };

    useEffect(() => {
        fetchStats();

        // Simulate Live Stream
        const interval = setInterval(() => {
            const now = new Date();
            const time = now.toLocaleTimeString();

            let face, voice, behavior;

            if (isAttackSimulated) {
                // Simulate Replay Attack: High Face Match, Low Liveness (represented as low fused score)
                // In a real system, 'liveness' would be a separate factor or multiplier.
                // Here we simulate the result: Face score drops or Fuse logic penalizes it.
                face = 0.95; // Fake image matches well
                voice = 0.2; // Voice fails or missing
                behavior = 0.1; // No behavioral match
                // Result: FUSION DROPS
            } else {
                // Normal User
                face = 0.85 + (Math.random() * 0.1 - 0.05);
                voice = 0.8 + (Math.random() * 0.1 - 0.05);
                behavior = 0.7 + (Math.random() * 0.2 - 0.1);
            }

            // Weighted Fusion (Simplified visual match to backend)
            // wFace=0.5, wVoice=0.3, wBehavior=0.2
            let fusion = (face * 0.5) + (voice * 0.3) + (behavior * 0.2);

            // If attack, apply penalty (simulating liveness check failure)
            if (isAttackSimulated) fusion *= 0.4;

            setFusionStream(prev => {
                const newData = [...prev, { face, voice, behavior, fusion, timestamp: time }];
                if (newData.length > 20) newData.shift(); // Keep last 20 points
                return newData;
            });
        }, 2000);

        return () => clearInterval(interval);
    }, [isAttackSimulated]);

    if (loading) return <div className="p-8 text-center">Loading Analytics...</div>;
    if (!stats) return <div className="p-8 text-center text-red-500">Failed to load data</div>;

    const maxCount = Math.max(...stats.dailyVerifications.map((d: any) => d.count), 1);

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Biometric Performance Analytics</h1>
                <div className="flex space-x-2">
                    <button onClick={triggerAttack} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Simulate Attack</span>
                    </button>
                    <button onClick={fetchStats} className="p-2 hover:bg-white rounded-full shadow-sm">
                        <RefreshCw className="w-5 h-5 text-slate-600" />
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-sm text-slate-500">Total Enrolled</div>
                            <div className="text-2xl font-bold">{stats.totalEnrolled}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-red-100 rounded-xl">
                            <Lock className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <div className="text-sm text-slate-500">Locked Users</div>
                            <div className="text-2xl font-bold">{stats.currentlyLocked}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Fusion Graph */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <FusionGraph scores={fusionStream} />
                <div className="mt-4 flex justify-between items-center text-xs text-slate-400">
                    <span>Live stream based on active authentication sessions (Simulated for Demo)</span>
                    {isAttackSimulated && <span className="text-red-500 font-bold animate-pulse">⚠️ ALARM: POTENTIAL SPOOFING ATTACK DETECTED</span>}
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Daily Volume Bar Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-semibold text-slate-800 mb-6 flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2 text-slate-500" />
                        Daily Verification Volume
                    </h3>
                    <div className="flex items-end space-x-4 h-64">
                        {stats.dailyVerifications.map((d: any, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center group">
                                <div className="w-full bg-slate-100 rounded-t-lg relative h-full flex items-end overflow-hidden">
                                    <div
                                        style={{ height: `${(d.count / maxCount) * 100}%` }}
                                        className="w-full bg-blue-500 group-hover:bg-blue-600 transition-all rounded-t-sm"
                                    ></div>
                                </div>
                                <div className="text-xs text-slate-400 mt-2">{d.time}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Modality Usage */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-semibold text-slate-800 mb-6">Modality Usage</h3>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Face Recognition</span>
                                <span className="font-medium">{stats.modalityUsage.face} Users</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div style={{ width: '90%' }} className="bg-indigo-500 h-2 rounded-full"></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Voice Recognition</span>
                                <span className="font-medium">{stats.modalityUsage.voice} Users</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div style={{ width: '60%' }} className="bg-purple-500 h-2 rounded-full"></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Behavioral Profiling</span>
                                <span className="font-medium">{stats.modalityUsage.behavioral} Users</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div style={{ width: '100%' }} className="bg-teal-500 h-2 rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                        <strong>Research Note:</strong> Multi-modal fusion logic is active.
                        Thresholds adapt dynamically based on available modalities.
                    </div>
                </div>
            </div>
        </div>
    );
};
