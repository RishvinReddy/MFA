import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import FaceModalityPanel from './auth/FaceModalityPanel';

interface StepUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    reason?: string;
    userId?: string;
}

export const StepUpModal: React.FC<StepUpModalProps> = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    reason = 'Additional security verification required', 
    userId 
}) => {
    if (!isOpen) return null;

    const handleFaceSuccess = async () => {
        // Backend evaluates step-up evidence and restores ACTIVE session
        onSuccess();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
            <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Modal Header */}
                <div className="bg-slate-950 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-white">
                        <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-400 border border-amber-500/30">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base tracking-tight text-slate-100">Additional Verification Required</h3>
                            <p className="text-slate-400 text-xs mt-0.5">{reason}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 p-2 rounded-full transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200/90 text-xs p-3.5 rounded-2xl">
                        <p className="font-semibold mb-0.5 text-amber-300">Session Security Check</p>
                        <p className="text-amber-300/80">Your active session requires a quick face verification check to confirm identity before continuing.</p>
                    </div>

                    <div className="w-full flex justify-center">
                        <div className="w-full">
                            <FaceModalityPanel
                                mode="LOGIN"
                                userId={userId || ''}
                                sessionId={sessionStorage.getItem('sessionId') || undefined}
                                onSuccess={handleFaceSuccess}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StepUpModal;
