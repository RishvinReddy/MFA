import React, { useState, useEffect } from 'react';
import { Play, Pause, Activity, FileAudio, AlertTriangle, Fingerprint, Search, Cpu } from 'lucide-react';
import { ForensicSample } from '../types';

const MOCK_SAMPLES: ForensicSample[] = [];

const ForensicAnalyzer: React.FC = () => {
    const [selectedSample, setSelectedSample] = useState<ForensicSample | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analyzing, setAnalyzing] = useState(false);
    
    // Visualization State
    const [bars, setBars] = useState<number[]>(new Array(64).fill(10));

    useEffect(() => {
        if (isPlaying || analyzing) {
            const interval = setInterval(() => {
                setBars(prev => prev.map(() => Math.random() * 80 + 10));
            }, 50);
            return () => clearInterval(interval);
        } else {
             setBars(new Array(64).fill(10));
        }
    }, [isPlaying, analyzing]);

    const runAnalysis = () => {
        setAnalyzing(true);
        setAnalysisProgress(0);
        const interval = setInterval(() => {
            setAnalysisProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setAnalyzing(false);
                    return 100;
                }
                return prev + 1.5;
            });
        }, 50);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] font-sans">
            {/* Sample List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-900 flex items-center text-sm font-mono">
                        <FileAudio className="w-4 h-4 mr-2 text-blue-600" /> EVIDENCE LOCKER
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {MOCK_SAMPLES.map(sample => (
                        <div 
                            key={sample.id}
                            onClick={() => { setSelectedSample(sample); setAnalysisProgress(0); }}
                            className={`p-3.5 rounded-xl cursor-pointer border transition-all ${selectedSample?.id === sample.id ? 'bg-blue-50/80 border-blue-500 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${sample.type === 'AUDIO' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{sample.type}</span>
                                <span className="text-[10px] text-slate-500 font-mono font-bold">{sample.timestamp}</span>
                            </div>
                            <div className="font-bold text-slate-900 text-sm mb-1">{sample.id}</div>
                            <div className="text-xs text-red-600 font-medium flex items-center">
                                <AlertTriangle className="w-3 h-3 mr-1.5 shrink-0" /> 
                                <span className="truncate">{sample.flaggedReason}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Analysis Workbench */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                {!selectedSample ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50/50">
                        <Search className="w-16 h-16 mb-4 text-slate-300" />
                        <p className="font-bold text-sm">Select evidence from locker to analyze</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-slate-900 font-extrabold flex items-center text-sm font-mono">
                                    <Cpu className="w-4 h-4 mr-2 text-blue-600" /> FORENSIC NEURAL WORKBENCH
                                </h3>
                                <div className="text-xs text-slate-500 font-mono mt-0.5 font-bold">Target Handle: {selectedSample.id}</div>
                            </div>
                            <div className="flex space-x-2">
                                <button 
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="p-2 bg-white rounded-lg text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200 shadow-sm"
                                >
                                    {isPlaying ? <Pause className="w-4 h-4 text-blue-600" /> : <Play className="w-4 h-4 text-blue-600" />}
                                </button>
                            </div>
                        </div>

                        {/* Visualizer */}
                        <div className="flex-1 p-6 flex flex-col justify-center relative bg-white">
                            {/* Grid Line */}
                            <div className="absolute inset-0 border-b border-slate-200 pointer-events-none" style={{ top: '50%' }}></div>
                            
                            <div className="flex items-end justify-center h-48 space-x-1">
                                {bars.map((h, i) => (
                                    <div 
                                        key={i}
                                        className={`w-2 rounded-t-sm transition-all duration-75 ${analyzing ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'bg-blue-600 shadow-[0_0_5px_rgba(37,99,235,0.2)]'}`}
                                        style={{ height: `${h}%`, opacity: 0.6 + (h/200) }}
                                    ></div>
                                ))}
                            </div>
                        </div>

                        {/* Metrics Panel */}
                        <div className="h-48 bg-slate-50 border-t border-slate-200 p-6 grid grid-cols-1 sm:grid-cols-3 gap-5 font-mono">
                             {/* AI Probability */}
                             <div className="bg-white rounded-xl p-4 border border-slate-200 relative overflow-hidden group shadow-sm flex flex-col justify-between">
                                 <div className="absolute top-0 right-0 p-2 opacity-10">
                                     <Fingerprint className="w-12 h-12 text-blue-600" />
                                 </div>
                                 <div className="text-[10px] text-slate-500 uppercase font-bold">Deepfake Probability</div>
                                 <div className={`text-2xl font-extrabold ${analysisProgress === 100 ? 'text-red-600' : 'text-slate-900'}`}>
                                     {analysisProgress === 100 ? '98.4%' : '--'}
                                 </div>
                                 {analysisProgress === 100 ? (
                                     <div className="text-[10px] text-red-700 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded w-fit">● HIGH CONFIDENCE MATCH</div>
                                 ) : (
                                     <div className="text-[10px] text-slate-400">Ready for scan</div>
                                 )}
                             </div>

                             {/* Spectral Data */}
                             <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Spectral Artifacts</div>
                                  <div className="space-y-2">
                                      <div className="flex justify-between text-[11px]">
                                          <span className="text-slate-500">Jitter</span>
                                          <span className="text-blue-600 font-bold">0.05%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                          <div className="bg-blue-600 h-full w-[40%] rounded-full"></div>
                                      </div>
                                      <div className="flex justify-between text-[11px] mt-1.5">
                                          <span className="text-slate-500">HF Cutoff</span>
                                          <span className="text-amber-600 font-bold">16kHz</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                          <div className="bg-amber-500 h-full w-[85%] rounded-full"></div>
                                      </div>
                                  </div>
                             </div>

                             {/* Actions */}
                             <div className="flex flex-col justify-center space-y-3 font-sans">
                                 <button 
                                    onClick={runAnalysis}
                                    disabled={analyzing || analysisProgress === 100}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:border text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center"
                                 >
                                     {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
                                     {analyzing ? 'Processing...' : 'Run Neural Analysis'}
                                 </button>
                             </div>
                        </div>
                    </>
                )}
            </div>
            
            {/* Hidden Loader Helper */}
            {analyzing && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                     <div className="bg-white text-slate-900 border border-slate-200 px-6 py-3.5 rounded-full shadow-2xl flex items-center space-x-3 font-mono text-xs font-bold animate-fade-in">
                         <Cpu className="w-5 h-5 animate-spin text-blue-600" />
                         <span>Processing Neural Layers... {Math.round(analysisProgress)}%</span>
                     </div>
                </div>
            )}
        </div>
    );
};

const Loader2 = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

export default ForensicAnalyzer;
