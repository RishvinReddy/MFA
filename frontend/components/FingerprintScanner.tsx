/**
 * FingerprintScanner.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * DEVELOPMENT PLACEHOLDER
 *
 * This component does NOT perform real fingerprint verification.
 * It explicitly reports { status: 'BYPASSED', reason: 'DEVELOPMENT_PLACEHOLDER' }
 * to the authentication flow.
 *
 * What was removed and why:
 *   - startUsbSimulation()   → setTimeout pretending a USB device connected.
 *   - startScanSequence()    → Sent Blob('fingerprint-data-' + Date.now()) as biometric data.
 *   - Auto-enroll fallback   → If verify failed, it auto-enrolled the dummy blob.
 *   - "Capacitive Sensor Array" label → False hardware claim.
 *   - Windows Hello path     → api.native.invokeWindowsHello() relies on unaudited backend.
 *
 * Production gate:
 *   When APP_ENVIRONMENT === 'PRODUCTION', the continue button is disabled
 *   and the user sees a clear message that fingerprint hardware is required.
 *
 * Acceptance criteria:
 *   - This component must NEVER pass { status: 'PASSED' } to the auth flow.
 *   - authFlowService receives { status: 'BYPASSED', reason: 'DEVELOPMENT_PLACEHOLDER' }.
 *   - The dashboard shows ⚠ DEV BYPASS for this factor — never ✓ VERIFIED.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { Fingerprint, AlertTriangle, Lock, ShieldAlert, Info } from 'lucide-react';
import { APP_ENVIRONMENT } from '../types';

interface FingerprintScannerProps {
    userId: string;
    onComplete: (success: boolean, status: 'BYPASSED' | 'UNAVAILABLE') => void;
}

const FingerprintScanner: React.FC<FingerprintScannerProps> = ({ onComplete }) => {
    const isProduction = APP_ENVIRONMENT === 'PRODUCTION';

    const handleContinue = () => {
        // Explicit: this never calls onComplete(true, 'PASSED').
        // The auth flow receives BYPASSED, not PASSED.
        onComplete(true, 'BYPASSED');
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-white border border-slate-200 rounded-[32px] p-8 text-slate-900 shadow-xl font-sans animate-fade-in">

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
                <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center shrink-0">
                        <Fingerprint className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                            BioShield Identity Engine • Multi-Stage Authentication
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-900 font-mono">
                            FINGERPRINT VERIFICATION
                        </h2>
                    </div>
                </div>
                <div className="text-xs font-mono font-bold bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl text-amber-700">
                    STEP 3 OF 4
                </div>
            </div>

            {/* Main content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6 items-center">

                {/* Left: graphic */}
                <div className="lg:col-span-5 flex flex-col items-center space-y-6">
                    <div className="relative w-52 h-52 flex items-center justify-center">
                        {/* Outer ring */}
                        <div className="absolute inset-0 rounded-full border-4 border-amber-200/60" />
                        {/* Inner graphic */}
                        <div className="w-40 h-40 bg-amber-50/80 rounded-3xl border-2 border-amber-200 flex items-center justify-center">
                            <Fingerprint className="w-24 h-24 text-amber-300" />
                        </div>
                        {/* Warning badge */}
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                    </div>

                    {/* Status label — never says VERIFIED */}
                    <div className="text-center space-y-1">
                        <div className="inline-flex items-center space-x-2 bg-amber-50 border border-amber-300 px-4 py-2 rounded-full">
                            <ShieldAlert className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-black text-amber-700 font-mono uppercase tracking-wider">
                                Development Placeholder
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono">
                            Factor status: <strong className="text-amber-600">BYPASSED</strong>
                        </p>
                    </div>
                </div>

                {/* Right: explanation + action */}
                <div className="lg:col-span-7 space-y-6">

                    {/* Explanation box */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
                        <div className="flex items-start space-x-3">
                            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <h3 className="font-bold text-sm text-amber-900">
                                    Hardware Biometric Reader Integration
                                </h3>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    Compatible direct-capture fingerprint integration is not available
                                    in this build. This factor is explicitly bypassed for development
                                    and academic purposes only.
                                </p>
                            </div>
                        </div>

                        {/* Status table */}
                        <div className="bg-white border border-amber-200 rounded-xl p-4 font-mono text-xs space-y-2.5">
                            <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] pb-2 border-b border-amber-100">
                                Factor Report
                            </div>
                            {[
                                { label: 'USB Fingerprint Reader',     value: '— Not detected',     warn: true  },
                                { label: 'System Biometric API',       value: '— Not integrated',   warn: true  },
                                { label: 'Capacitive Sensor',          value: '— Not available',    warn: true  },
                                { label: 'Authentication Performed',   value: '✗ NO',               fail: true  },
                                { label: 'Factor Status',              value: '⚠ BYPASSED',         warn: true  },
                            ].map(({ label, value, warn, fail }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-slate-600 font-medium">{label}</span>
                                    <span className={`font-bold ${fail ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-700'}`}>
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bypass warning — always shown */}
                    <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-red-700 leading-relaxed">
                            Fingerprint authentication was <span className="uppercase">not</span> performed.
                            This factor will be recorded as <span className="font-black">BYPASSED</span> in
                            the session audit log, and the dashboard will display a development bypass indicator.
                        </p>
                    </div>

                    {/* Action */}
                    {isProduction ? (
                        <div className="space-y-3">
                            <div className="p-4 bg-red-50 border border-red-300 rounded-2xl text-center">
                                <div className="flex items-center justify-center space-x-2 text-red-700 font-extrabold text-sm mb-1">
                                    <Lock className="w-4 h-4" />
                                    <span>Production Build — Hardware Required</span>
                                </div>
                                <p className="text-xs text-red-600">
                                    Fingerprint bypass is disabled in production. Connect a compatible
                                    hardware fingerprint reader to continue.
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled
                                className="w-full py-4 rounded-2xl font-extrabold text-sm bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                            >
                                Continue — Disabled in Production
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <button
                                id="btn-fingerprint-bypass-continue"
                                type="button"
                                onClick={handleContinue}
                                className="w-full py-4 rounded-2xl font-extrabold text-sm bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-3"
                            >
                                <ShieldAlert className="w-5 h-5" />
                                <span>Continue — Development Build</span>
                            </button>
                            <p className="text-center text-[11px] font-mono text-slate-400">
                                This action records <strong className="text-amber-600">BYPASSED</strong> in the
                                auth flow — not <strong className="text-slate-500">PASSED</strong>.
                            </p>
                        </div>
                    )}

                </div>
            </div>

        </div>
    );
};

export default FingerprintScanner;
