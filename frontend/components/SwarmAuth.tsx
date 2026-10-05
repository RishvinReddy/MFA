
import React, { useState, useEffect, useRef } from 'react';
import { Share2, Smartphone, Watch, Activity, Link2Off, Bluetooth, Loader2, Home, Wifi, Heart, Thermometer } from 'lucide-react';
import { SwarmDevice, WearableTelemetry } from '../types';

interface SwarmAuthProps {
    onSecurityEvent?: (type: 'LOCK' | 'UNLOCK' | 'WARNING', message: string) => void;
}

const SwarmAuth: React.FC<SwarmAuthProps> = ({ onSecurityEvent }) => {
    const [devices, setDevices] = useState<SwarmDevice[]>([
        { id: 'd1', name: 'MacBook Pro', type: 'LAPTOP', status: 'TRUSTED', battery: 100, signalStrength: 100 }
    ]);
    const [activeWearable, setActiveWearable] = useState<SwarmDevice | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [telemetry, setTelemetry] = useState<WearableTelemetry>({ heartRate: 0, skinTemp: 36.5, isWearing: false, accelerometer: { x: 0, y: 0, z: 0 }, rssi: -100 });
    const [hrHistory, setHrHistory] = useState<number[]>(new Array(30).fill(0));
    const simInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const toggleScan = () => {
        setIsScanning(true);
        setTimeout(() => {
            setIsScanning(false);
            const newWatch: SwarmDevice = { id: 'w1', name: 'BioShield Ultra', type: 'WATCH', status: 'VERIFYING', battery: 88, signalStrength: -45 };
            setDevices(prev => [...prev, newWatch]);
            connectWearable(newWatch);
        }, 2000);
    };

    const connectWearable = (device: SwarmDevice) => {
        setActiveWearable(device);
        if (simInterval.current) clearInterval(simInterval.current);
        let t = 0;
        simInterval.current = setInterval(() => {
            t += 0.1;
            setTelemetry(prev => {
                const isActive = prev.isWearing;
                const newHr = isActive ? 70 + Math.sin(t) * 5 + Math.random() * 4 : 0;
                setHrHistory(h => [...h.slice(1), newHr]);
                return { ...prev, heartRate: newHr, rssi: -40 + Math.random() * 5 };
            });
        }, 1000);
    };

    const toggleWearState = () => {
        setTelemetry(prev => ({ ...prev, isWearing: !prev.isWearing }));
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full relative overflow-hidden">
            <div className="flex justify-between items-start mb-6 z-10">
                <div>
                    <h3 className="text-slate-900 font-bold text-lg flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-blue-600" /> Swarm Link
                    </h3>
                    <p className="text-xs text-slate-500">Continuous Wearable Liveness</p>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${activeWearable && telemetry.isWearing ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {activeWearable && telemetry.isWearing ? 'LINK SECURE' : 'DISCONNECTED'}
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 mb-4 overflow-hidden relative flex flex-col items-center justify-center">
                 {/* Light Mode Radar */}
                 {!activeWearable && (
                     <div className="relative w-64 h-64">
                         <div className="absolute inset-0 border border-slate-200 rounded-full"></div>
                         <div className="absolute inset-8 border border-slate-200 rounded-full"></div>
                         <div className="absolute inset-16 border border-slate-200 rounded-full"></div>
                         {isScanning && (
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent to-blue-500/10 rounded-full animate-spin"></div>
                         )}
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                             {isScanning ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <Bluetooth className="w-8 h-8 text-slate-300" />}
                         </div>
                     </div>
                 )}

                 {activeWearable && (
                     <div className="w-full h-full p-6 flex flex-col">
                         <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center space-x-3">
                                 <Watch className="w-6 h-6 text-slate-700" />
                                 <span className="font-bold text-slate-900">{activeWearable.name}</span>
                             </div>
                             <Wifi className="w-4 h-4 text-emerald-500" />
                         </div>
                         
                         {/* HR Graph Light */}
                         <div className="flex-1 flex items-end space-x-1 mb-4 relative opacity-80">
                            {hrHistory.map((val, i) => (
                                <div key={i} className={`w-full rounded-t-sm transition-all ${telemetry.isWearing ? 'bg-emerald-400' : 'bg-red-200'}`} style={{ height: `${val}%` }}></div>
                            ))}
                         </div>

                         <div className="grid grid-cols-3 gap-2">
                             <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-center">
                                 <Heart className={`w-4 h-4 mx-auto mb-1 ${telemetry.isWearing ? 'text-red-500 animate-pulse' : 'text-slate-300'}`} />
                                 <div className="font-bold text-slate-800">{telemetry.heartRate.toFixed(0)}</div>
                             </div>
                             <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-center">
                                 <Thermometer className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                                 <div className="font-bold text-slate-800">{telemetry.skinTemp.toFixed(1)}°</div>
                             </div>
                             <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-center">
                                 <Activity className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                                 <div className="font-bold text-slate-800">OK</div>
                             </div>
                         </div>
                     </div>
                 )}
            </div>

            <div className="flex space-x-2">
                {!activeWearable ? (
                    <button onClick={toggleScan} disabled={isScanning} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm transition-colors">
                        {isScanning ? 'Scanning...' : 'Pair Wearable'}
                    </button>
                ) : (
                    <button onClick={toggleWearState} className={`w-full py-3 rounded-xl font-bold text-sm border transition-colors ${telemetry.isWearing ? 'bg-white border-slate-200 text-slate-600' : 'bg-emerald-600 text-white'}`}>
                        {telemetry.isWearing ? 'Simulate Removal' : 'Put On Device'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default SwarmAuth;
