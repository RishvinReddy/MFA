import React, { useState, useEffect } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, RefreshCw, Loader2, QrCode } from 'lucide-react';
import { api } from '../../services/api';
import { AuthMode } from './StepProgress';

interface MfaModalityPanelProps {
    mode: AuthMode;
    userId: string;
    sessionId?: string;
    enrollmentToken?: string;
    onSuccess: (data?: any) => void;
    onError?: (message: string) => void;
}

export const MfaModalityPanel: React.FC<MfaModalityPanelProps> = ({
    mode,
    userId,
    sessionId,
    enrollmentToken,
    onSuccess,
    onError
}) => {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [code, setCode] = useState<string>('');
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'VERIFYING' | 'SUCCESS' | 'FAILED'>('IDLE');
    const [message, setMessage] = useState<string>('');

    useEffect(() => {
        if (mode === 'REGISTRATION') {
            fetchQrCode();
        } else {
            setMessage('Enter the 6-digit verification code from your authenticator app.');
        }
    }, [mode]);

    const fetchQrCode = async () => {
        setStatus('LOADING');
        setMessage('Generating authenticator QR code...');
        try {
            const res = await api.setupMfa(enrollmentToken);
            if (res.qr) {
                setQrCode(res.qr);
                setStatus('IDLE');
                setMessage('Scan the QR code with your authenticator app, then enter the code below.');
            } else {
                throw new Error('Failed to generate QR code');
            }
        } catch (err: any) {
            setStatus('FAILED');
            setMessage(err.message || 'Error generating QR code.');
            if (onError) onError(err.message);
        }
    };

    const handleVerify = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (code.length !== 6) {
            setMessage('Please enter a valid 6-digit code.');
            return;
        }

        setStatus('VERIFYING');
        setMessage('Verifying authentication code...');

        try {
            if (mode === 'REGISTRATION') {
                const res = await api.verifyMfa(code, enrollmentToken);
                if (res.success) {
                    setStatus('SUCCESS');
                    setMessage('MFA verification successful! Activating account...');
                    setTimeout(() => onSuccess(res), 1000);
                } else {
                    throw new Error(res.message || 'MFA verification failed');
                }
            } else {
                if (!sessionId) throw new Error('Missing authentication session');
                const res = await api.verifyLoginTotp(userId, code, sessionId);
                if (res.success && res.accessToken) {
                    setStatus('SUCCESS');
                    setMessage('MFA authentication successful!');
                    setTimeout(() => onSuccess(res), 1000);
                } else {
                    throw new Error(res.message || 'MFA verification failed');
                }
            }
        } catch (err: any) {
            setStatus('FAILED');
            setMessage(err.message || 'Invalid verification code. Please retry.');
            if (onError) onError(err.message);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center space-y-4">
            {/* Registration QR View */}
            {mode === 'REGISTRATION' && (
                <div className="flex flex-col items-center p-4 bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-sm">
                    {status === 'LOADING' ? (
                        <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                            <span className="text-xs font-semibold">Generating QR...</span>
                        </div>
                    ) : qrCode ? (
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                            <img src={qrCode} alt="TOTP QR Code" className="w-44 h-44" />
                        </div>
                    ) : (
                        <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-400">
                            <QrCode className="w-10 h-10 mb-2 text-slate-300" />
                            <button onClick={fetchQrCode} className="text-xs text-blue-600 font-bold hover:underline">
                                Load QR Code
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Verification Form */}
            <form onSubmit={handleVerify} className="w-full max-w-sm flex flex-col items-center space-y-3">
                <div className="w-full">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 text-center">
                        6-Digit Security Code
                    </label>
                    <input
                        type="text"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full text-center text-2xl font-mono tracking-[0.5em] font-bold py-3 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl outline-none transition-all shadow-sm"
                        disabled={status === 'VERIFYING' || status === 'SUCCESS'}
                    />
                </div>

                {/* Status Message Banner */}
                <div className={`w-full p-3 rounded-xl text-xs font-semibold text-center flex items-center justify-center space-x-2 ${
                    status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    status === 'FAILED' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-slate-50 text-slate-700 border border-slate-200'
                }`}>
                    {status === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {status === 'FAILED' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                    <span>{message}</span>
                </div>

                {status !== 'SUCCESS' && (
                    <button
                        type="submit"
                        disabled={code.length !== 6 || status === 'VERIFYING'}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2"
                    >
                        {status === 'VERIFYING' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Verifying Code...</span>
                            </>
                        ) : (
                            <>
                                <KeyRound className="w-4 h-4" />
                                <span>Verify Code</span>
                            </>
                        )}
                    </button>
                )}
            </form>
        </div>
    );
};

export default MfaModalityPanel;
