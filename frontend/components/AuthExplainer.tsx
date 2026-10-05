
import React, { useEffect, useState } from 'react';
import { ShieldCheck, Check, BrainCircuit, Unlock, FileText, UserCheck, Activity, Fingerprint, Share2 } from 'lucide-react';

interface AuthExplainerProps {
  onProceed: () => void;
}

const AuthExplainer: React.FC<AuthExplainerProps> = ({ onProceed }) => {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in relative">
      {/* Decorative Top Border */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-cyan-500 to-emerald-400"></div>
      
      <div className="p-8 md:p-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 rounded-full mb-6 border-4 border-emerald-100 shadow-sm animate-bounce">
                <Unlock className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Access Granted</h2>
            <p className="text-slate-500 font-medium">Identity Verification Complete</p>
          </div>

          <div className={`space-y-8 transition-all duration-1000 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            
            {/* AI Trust Score Card */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-colors"></div>
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center uppercase tracking-wide">
                        <BrainCircuit className="w-4 h-4 mr-2 text-indigo-600" /> XAI Trust Score
                    </h3>
                    <div className="text-[10px] font-mono text-slate-400">ID: #8839-AUTH-X</div>
                </div>

                <div className="grid grid-cols-3 gap-8 relative z-10">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-slate-900 mb-1">99.8%</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Confidence</div>
                    </div>
                    <div className="text-center border-l border-slate-200">
                        <div className="text-3xl font-bold text-emerald-600 mb-1">PASS</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Liveness</div>
                    </div>
                    <div className="text-center border-l border-slate-200">
                        <div className="text-3xl font-bold text-cyan-600 mb-1">LOW</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Risk Level</div>
                    </div>
                </div>
            </div>

            {/* Factor Breakdown List */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Verification Vectors</h3>
                
                <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-cyan-200 hover:shadow-md transition-all">
                    <div className="flex items-center space-x-4">
                        <div className="p-2 bg-cyan-50 rounded-lg">
                            <UserCheck className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-800">Facial Topography</div>
                            <div className="text-xs text-slate-500">3D Depth Map • 128 Nodal Points Matched</div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <Check className="w-3.5 h-3.5" />
                        <span>VERIFIED</span>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-emerald-200 hover:shadow-md transition-all">
                    <div className="flex items-center space-x-4">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <Fingerprint className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-800">Vascular Pattern</div>
                            <div className="text-xs text-slate-500">Hemoglobin Absorption • Subcutaneous Match</div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <Check className="w-3.5 h-3.5" />
                        <span>VERIFIED</span>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-purple-200 hover:shadow-md transition-all">
                    <div className="flex items-center space-x-4">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Activity className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-800">Cognitive Reflex</div>
                            <div className="text-xs text-slate-500">Neurometric Timing • Human Entropy Confirmed</div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <Check className="w-3.5 h-3.5" />
                        <span>VERIFIED</span>
                    </div>
                </div>
            </div>

            <button 
                onClick={onProceed}
                className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center group"
            >
                Enter Secure Dashboard
                <Unlock className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <div className="flex justify-center items-center space-x-2 mt-4 text-[10px] text-slate-400">
                 <ShieldCheck className="w-3 h-3" />
                 <span>Audit Log Reference: {Date.now()}</span>
            </div>
          </div>
      </div>
    </div>
  );
};

export default AuthExplainer;
