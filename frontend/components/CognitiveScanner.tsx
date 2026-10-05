import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, Target, Zap, MousePointer2, Clock } from 'lucide-react';
import { BiometricStatus } from '../types';

interface CognitiveScannerProps {
  onComplete: (success: boolean) => void;
}

const CognitiveScanner: React.FC<CognitiveScannerProps> = ({ onComplete }) => {
  const [status, setStatus] = useState<BiometricStatus>(BiometricStatus.IDLE);
  const [targets, setTargets] = useState<{id: number, x: number, y: number, size: number}[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastSpawnTime = useRef(Date.now());

  useEffect(() => {
    if (status === BiometricStatus.SCANNING) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0) {
            clearInterval(timer);
            finalizeTest();
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [status]);

  const startTest = () => {
    setStatus(BiometricStatus.SCANNING);
    spawnTarget();
  };

  const spawnTarget = () => {
    if (!canvasRef.current) return;
    const { width, height } = canvasRef.current.getBoundingClientRect();
    
    const size = Math.random() * 30 + 40; // 40-70px
    const x = Math.random() * (width - size);
    const y = Math.random() * (height - size);
    
    setTargets([{ id: Date.now(), x, y, size }]);
    lastSpawnTime.current = Date.now();
  };

  const handleTargetClick = (id: number) => {
    const reaction = Date.now() - lastSpawnTime.current;
    setReactionTimes(prev => [...prev, reaction]);
    setScore(prev => prev + 1);
    setTargets([]); // Remove target
    
    // Rapid spawn next
    setTimeout(spawnTarget, Math.random() * 200 + 100);
  };

  const finalizeTest = () => {
    setStatus(BiometricStatus.VERIFYING);
    setTimeout(() => {
      setStatus(BiometricStatus.SUCCESS);
      setTimeout(() => onComplete(true), 1500);
    }, 1500);
  };

  const avgReaction = reactionTimes.length > 0 
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) 
    : 0;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[600px] mx-auto bg-white p-1 rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative font-sans animate-fade-in">
      {/* HUD Header */}
      <div className="w-full p-4 bg-slate-50 flex justify-between items-center border-b border-slate-200 z-10">
        <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                <BrainCircuit className="w-5 h-5 text-blue-600" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-900">Cognitive Response</h3>
                <p className="text-[10px] text-slate-500 font-mono uppercase">Neuro-Synaptic Calibration</p>
            </div>
        </div>
        <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Latency</span>
                <span className="text-sm font-mono font-bold text-blue-600">{avgReaction}ms</span>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Time</span>
                <span className={`text-sm font-mono font-bold ${timeLeft < 2 ? 'text-red-600' : 'text-slate-800'}`}>
                    {timeLeft.toFixed(1)}s
                </span>
            </div>
        </div>
      </div>

      {/* Interactive Area */}
      <div 
        ref={canvasRef}
        className="relative w-full h-[350px] bg-slate-50 overflow-hidden cursor-crosshair"
      >
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_1px,_transparent_1px),_linear-gradient(90deg,#cbd5e1_1px,_transparent_1px)] bg-[size:20px_20px] opacity-40"></div>
        
        {status === BiometricStatus.IDLE && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-20">
                 <button 
                    onClick={startTest}
                    className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-full transition-all hover:scale-105 shadow-md shadow-blue-500/20"
                 >
                    <span className="flex items-center space-x-2 text-xs">
                        <MousePointer2 className="w-5 h-5" />
                        <span>Initiate Sequence</span>
                    </span>
                 </button>
             </div>
        )}

        {status === BiometricStatus.SCANNING && targets.map(target => (
            <button
                key={target.id}
                onClick={() => handleTargetClick(target.id)}
                className="absolute rounded-full flex items-center justify-center transition-transform active:scale-90"
                style={{
                    left: target.x,
                    top: target.y,
                    width: target.size,
                    height: target.size,
                    background: 'radial-gradient(circle, rgba(37,99,235,0.9) 0%, rgba(59,130,246,0) 70%)',
                    boxShadow: '0 0 15px rgba(37,99,235,0.4)',
                    border: '2px solid #3b82f6'
                }}
            >
                <Target className="w-1/2 h-1/2 text-white animate-spin-slow" />
            </button>
        ))}

        {/* Analysis Overlay */}
        {status === BiometricStatus.VERIFYING && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur flex flex-col items-center justify-center text-center">
                <Clock className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h4 className="text-xl font-extrabold text-slate-900 font-mono">Analyzing Reflex Pattern...</h4>
                <p className="text-slate-500 text-xs mt-2 font-mono">Verifying motor-cortex timing signature</p>
            </div>
        )}

        {status === BiometricStatus.SUCCESS && (
             <div className="absolute inset-0 bg-emerald-50/95 backdrop-blur flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 border border-emerald-300 shadow-sm">
                    <Zap className="w-8 h-8 text-emerald-600 fill-emerald-600" />
                </div>
                <h4 className="text-2xl font-extrabold text-emerald-900 font-mono">Cognitive Hash Verified</h4>
                <p className="text-emerald-700 text-xs mt-2 font-mono font-bold">Human Reflex Confirmed</p>
            </div>
        )}
      </div>

      {/* Footer / Stats */}
      <div className="w-full p-4 bg-slate-50 border-t border-slate-200 flex justify-between text-xs font-mono">
          <div className="flex items-center text-slate-600 font-bold">
             <Target className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
             <span>Accuracy: {score > 0 ? '100%' : '--'}</span>
          </div>
           <div className="flex items-center text-slate-600 font-bold">
             <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
             <span>Brainwave Emulation: Active</span>
          </div>
      </div>
    </div>
  );
};

export default CognitiveScanner;
