import React from 'react';
import { RotateCcw, CheckCircle2, ArrowRight } from 'lucide-react';

interface RecoveryNoticeProps {
    email?: string;
    completedStepName?: string;
    nextStepName?: string;
    onContinue?: () => void;
}

export const RecoveryNotice: React.FC<RecoveryNoticeProps> = ({
    email,
    completedStepName = 'Account Information',
    nextStepName = 'Face Verification',
    onContinue
}) => {
    return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4 mb-6 text-left shadow-sm">
            <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20 shrink-0 mt-0.5">
                    <RotateCcw className="w-5 h-5 animate-spin-slow" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-sm">Resume Account Setup</h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Your previous registration session was saved. Continue from where you left off.
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-blue-200/60 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done: {completedStepName}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-blue-700 font-semibold">
                            <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                            <span>Next: {nextStepName}</span>
                        </div>
                    </div>

                    {onContinue && (
                        <button
                            onClick={onContinue}
                            className="mt-3.5 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1.5"
                        >
                            <span>Continue Account Setup</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecoveryNotice;
