
import React, { useState, useEffect } from 'react';
import { Hand, Scan, Fingerprint, CheckCircle2, Waves, ScanLine } from 'lucide-react';
import { BiometricStatus } from '../types';
import { api } from '../services/api';

interface PalmScannerProps {
    userId: string;
    onComplete: (success: boolean) => void;
}

const PalmScanner: React.FC<PalmScannerProps> = ({ userId, onComplete }) => {
    const [status, setStatus] = useState<BiometricStatus>(BiometricStatus.IDLE);
    const [scanProgress, setScanProgress] = useState(0);

    useEffect(() => {
        // Auto-start scan for demo flow fluidity
        const timer = setTimeout(() => {
            startScan();
        }, 800);
        return () => clearTimeout(timer);
    }, []);

    const startScan = () => {
        setStatus(BiometricStatus.SCANNING);
        let progress = 0;
        const interval = setInterval(() => {
            progress += 1.5;
            setScanProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                setStatus(BiometricStatus.VERIFYING);
                setTimeout(async () => {
                    try {
                        const dummyBlob = new Blob(['palm-data-' + Date.now()], { type: 'application/octet-stream' });
                        let res = await api.verify(dummyBlob, userId, 'palm');
                        if (!res.success) {
                            res = await api.enroll(dummyBlob, userId, 'palm');
                        }

                        setStatus(BiometricStatus.SUCCESS);
                        setTimeout(() => onComplete(true), 1200);

                    } catch (e) {
                        setStatus(BiometricStatus.SUCCESS);
                        setTimeout(() => onComplete(true), 1200);
                    }
                }, 1500);
            }
        }, 40);
    };

    return (
        <div className="flex flex-col items-center justify-center w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
            <div className="flex items-center space-x-3 mb-8 w-full">
                <div className={`p-3 rounded-xl bg-emerald-50 border border-emerald-100`}>
                    <Fingerprint className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Vascular Analysis</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Infrared Vein Mapping</p>
                </div>
            </div>

            <div className="relative w-72 h-72 bg-slate-100 rounded-full overflow-hidden border-8 border-white shadow-[inset_0_0_20px_rgba(0,0,0,0.06)] flex items-center justify-center group">

                {/* Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.1)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>

                {/* Static Hand Outline */}
                <div className="relative z-10">
                    <Hand className={`w-48 h-48 transition-all duration-1000 ${status === 'SUCCESS' ? 'text-emerald-400 stroke-[1.5]' : 'text-slate-800 stroke-[1]'}`} />
                </div>

                {/* Dynamic Vein Overlay */}
                {status !== 'IDLE' && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 mix-blend-screen" viewBox="0 0 100 100">
                        <defs>
                            <linearGradient id="veinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
                                <stop offset="50%" stopColor="#34d399" stopOpacity="1" />
                                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* Simulated Vein Paths */}
                        <path d="M50 85 Q 45 60 30 40 T 20 20" fill="none" stroke="url(#veinGrad)" strokeWidth="0.8" className="animate-[dash_3s_linear_infinite]" strokeDasharray="100" strokeDashoffset="100" />
                        <path d="M50 85 Q 55 65 70 45 T 80 25" fill="none" stroke="url(#veinGrad)" strokeWidth="0.8" className="animate-[dash_2.5s_linear_infinite]" strokeDasharray="100" strokeDashoffset="100" />
                        <path d="M50 85 Q 50 55 50 25" fill="none" stroke="url(#veinGrad)" strokeWidth="0.8" className="animate-[dash_3.5s_linear_infinite]" strokeDasharray="100" strokeDashoffset="100" />
                        <path d="M30 40 Q 40 40 50 50" fill="none" stroke="url(#veinGrad)" strokeWidth="0.6" className="animate-[dash_4s_linear_infinite]" strokeDasharray="100" strokeDashoffset="100" />
                        <path d="M70 45 Q 60 45 50 50" fill="none" stroke="url(#veinGrad)" strokeWidth="0.6" className="animate-[dash_3.8s_linear_infinite]" strokeDasharray="100" strokeDashoffset="100" />
                    </svg>
                )}

                {/* Scanning Beam Effect */}
                {status === BiometricStatus.SCANNING && (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent h-1/3 w-full animate-[scan_2s_linear_infinite] z-30"></div>
                        <div className="absolute top-0 w-full h-0.5 bg-emerald-400 shadow-[0_0_15px_#34d399] animate-[scan_2s_linear_infinite] z-30"></div>
                    </>
                )}

                {/* Success Pulse */}
                {status === BiometricStatus.SUCCESS && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm z-40 animate-fade-in">
                        <div className="bg-white rounded-full p-4 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8 w-full space-y-4">
                <div className="flex justify-between items-center text-xs text-slate-500 uppercase font-mono font-bold tracking-wider">
                    <span className="flex items-center"><ScanLine className="w-3 h-3 mr-1.5" /> IR Depth Map</span>
                    <span className={status === 'SUCCESS' ? 'text-emerald-600' : 'text-slate-900'}>
                        {status === 'SCANNING' ? `${Math.round(scanProgress)}%` : status}
                    </span>
                </div>

                {/* Tech Progress Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative border border-slate-200">
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.5)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.5)_50%,rgba(255,255,255,0.5)_75%,transparent_75%,transparent)] bg-[size:10px_10px] z-10 opacity-30"></div>
                    <div
                        className="h-full bg-emerald-500 transition-all duration-100 relative"
                        style={{ width: `${scanProgress}%` }}
                    >
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50 shadow-[0_0_10px_white]"></div>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 font-medium">
                    {status === 'VERIFYING' ? 'Matching Hemoglobin Absorption Patterns...' : 'Analyzing Subcutaneous Vein Structure...'}
                </p>
            </div>
        </div>
    );
};

export default PalmScanner;
