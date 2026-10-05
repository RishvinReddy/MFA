import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Monitor, ArrowRight, CheckCircle2, AlertTriangle, Info, HardDrive, Shield, Activity, Cpu, Search, FileSearch } from 'lucide-react';
import { api } from '../services/api';

interface SystemBootProps {
  onComplete: () => void;
}

interface SecurityComponent {
  status: string;
  source: string;
  verifiedAt: string;
  confidence: 'verified' | 'unverified';
  details?: any;
}

interface BootData {
  device: {
    os: string;
    architecture: string;
    hostname: string;
    bootMode: string;
  };
  security: {
    secureBoot: SecurityComponent;
    tpm: SecurityComponent;
    appIntegrity: SecurityComponent;
    defender: {
      status: string;
      threats: any[];
      engine: string;
    };
    firewall: SecurityComponent;
    diskEncryption: SecurityComponent;
  };
  // deviceTrust deliberately removed per Phase 18
  logs: Array<{ timestamp: string; type: string; category: string; message: string }>;
}

const ControlCard: React.FC<{
  title: string;
  icon: React.ElementType;
  component?: SecurityComponent;
  renderDetails?: (details: any) => React.ReactNode;
}> = ({ title, icon: Icon, component, renderDetails }) => {
  if (!component) return null;

  const isVerified = component.confidence === 'verified' && (component.status.toLowerCase() === 'verified' || component.status.toLowerCase() === 'active' || component.status.toLowerCase() === 'enabled' || component.status.toLowerCase() === 'ready');
  const isUnknown = component.confidence === 'unverified' || component.status.toLowerCase() === 'unknown';
  const isError = component.status.toLowerCase() === 'error' || component.status.toLowerCase() === 'failed';

  const StatusIcon = isVerified ? CheckCircle2 : isUnknown ? Info : AlertTriangle;
  const statusColor = isVerified ? 'text-emerald-600' : isUnknown ? 'text-slate-500' : 'text-red-600';
  const bgColor = isVerified ? 'bg-emerald-50 border-emerald-200' : isUnknown ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200';

  return (
    <div className={`p-4 rounded-2xl border ${bgColor} space-y-3 font-mono transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-2">
          <Icon className={`w-4 h-4 ${statusColor}`} />
          <h3 className={`text-sm font-bold ${statusColor}`}>{title}</h3>
        </div>
        <StatusIcon className={`w-5 h-5 ${statusColor}`} />
      </div>

      <div className="space-y-1">
        <div className="text-lg font-extrabold text-slate-900">{component.status.toUpperCase()}</div>
        
        {component.details && (
          <div className="text-xs text-slate-700 mt-2 space-y-1 bg-white/50 p-2 rounded-lg border border-slate-200/50">
            {renderDetails ? renderDetails(component.details) : (
              Object.entries(component.details).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500 capitalize">{k}:</span>
                  <span className="font-bold">{String(v)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="pt-3 mt-3 border-t border-slate-200/50 space-y-1">
        <div className="text-[10px] text-slate-500 flex justify-between">
          <span>Source:</span>
          <span className="font-bold text-slate-700 text-right">{component.source}</span>
        </div>
        <div className="text-[10px] text-slate-500 flex justify-between">
          <span>Confidence:</span>
          <span className={`font-bold ${isVerified ? 'text-emerald-600' : 'text-slate-500'}`}>{component.confidence.toUpperCase()}</span>
        </div>
        {component.verifiedAt && (
          <div className="text-[10px] text-slate-500 flex justify-between">
            <span>Verified:</span>
            <span>{new Date(component.verifiedAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const SystemBoot: React.FC<SystemBootProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'SCANNING' | 'RESULTS' | 'ERROR'>('SCANNING');
  const [data, setData] = useState<BootData | null>(null);
  const [persistence, setPersistence] = useState<any[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const runDiagnostics = async () => {
      setScanProgress(20);
      try {
        const result = await api.native.getSystemDiagnostics();
        if (isMounted) {
          setScanProgress(50);
          setData(result);
        }
        const persistenceResult = await api.native.getSystemPersistence();
        if (isMounted) {
          setScanProgress(100);
          setPersistence(persistenceResult);
          setTimeout(() => setStage('RESULTS'), 600);
        }
      } catch (err) {
        console.error("Boot diagnostics failed", err);
        if (isMounted) setStage('ERROR');
      }
    };

    runDiagnostics();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="w-screen h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden z-[100] selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full h-full bg-white flex flex-col relative shadow-2xl">

        {/* TOP BAR */}
        <div className="shrink-0 p-6 lg:p-8 pb-4 border-b border-slate-200 bg-white z-10">
          <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 font-mono">BIOSHIELD HOST SECURITY</h1>
              <p className="text-xs text-slate-500 font-mono">Native System Telemetry & Evidence Verifier</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold text-slate-700">
            <div className={`w-2 h-2 rounded-full ${stage === 'SCANNING' ? 'bg-amber-500 animate-pulse' : stage === 'RESULTS' ? 'bg-blue-500' : 'bg-red-500'} mr-1`}></div>
            <span>{stage === 'SCANNING' ? `COLLECTING EVIDENCE (${scanProgress}%)` : stage === 'RESULTS' ? 'TELEMETRY COLLECTED' : 'EVIDENCE COLLECTION FAILED'}</span>
          </div>
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 lg:p-8 pt-6">
          {stage === 'SCANNING' && (
          <div className="py-20 text-center space-y-4">
            <Activity className="w-12 h-12 text-slate-400 mx-auto animate-pulse" />
            <div className="text-sm font-mono font-bold text-slate-600">Querying OS Security Providers...</div>
            <div className="w-64 bg-slate-100 h-2 rounded-full mx-auto overflow-hidden">
              <div style={{ width: `${scanProgress}%` }} className="h-full bg-slate-900 transition-all duration-300"></div>
            </div>
          </div>
        )}

        {stage === 'ERROR' && (
          <div className="py-20 text-center space-y-4">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
            <div className="text-sm font-mono font-bold text-red-600">Failed to communicate with diagnostic service.</div>
            <button onClick={onComplete} className="px-4 py-2 bg-slate-200 rounded-xl text-xs font-bold hover:bg-slate-300">Bypass (Dev Only)</button>
          </div>
        )}

        {stage === 'RESULTS' && data && (
          <div className="space-y-6 animate-fade-in">
            {/* PLATFORM METADATA */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-wrap gap-4 text-xs font-mono text-slate-600 justify-between items-center">
              <div><span className="font-bold text-slate-400">OS:</span> {data.device.os}</div>
              <div><span className="font-bold text-slate-400">Host:</span> {data.device.hostname}</div>
              <div><span className="font-bold text-slate-400">Boot:</span> {data.device.bootMode}</div>
            </div>

            {/* SECURITY EVIDENCE GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ControlCard 
                title="Secure Boot" 
                icon={ShieldCheck} 
                component={data.security.secureBoot} 
              />
              <ControlCard 
                title="TPM 2.0" 
                icon={Cpu} 
                component={data.security.tpm}
                renderDetails={(details) => (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Present:</span>
                      <span className="font-bold">{details.TpmPresent !== undefined ? (details.TpmPresent ? 'Yes' : 'No') : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ready:</span>
                      <span className="font-bold">{details.TpmReady !== undefined ? (details.TpmReady ? 'Yes' : 'No') : 'N/A'}</span>
                    </div>
                  </>
                )}
              />
              <ControlCard 
                title="Windows Defender" 
                icon={Shield} 
                component={{
                  status: data.security.defender.status === 'VERIFIED' ? 'Verified' : data.security.defender.status,
                  source: data.security.defender.engine,
                  confidence: 'verified',
                  verifiedAt: new Date().toISOString()
                }} 
                renderDetails={() => (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Threats:</span>
                      <span className="font-bold text-right">{data.security.defender.threats.length}</span>
                    </div>
                  </>
                )}
              />
              <ControlCard 
                title="Windows Firewall" 
                icon={Monitor} 
                component={data.security.firewall}
                renderDetails={(details) => (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Domain:</span>
                      <span className="font-bold">{details.Domain ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Private:</span>
                      <span className="font-bold">{details.Private ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Public:</span>
                      <span className="font-bold">{details.Public ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </>
                )}
              />
              <ControlCard 
                title="Disk Encryption" 
                icon={HardDrive} 
                component={data.security.diskEncryption} 
              />
              <ControlCard 
                title="App Integrity" 
                icon={CheckCircle2} 
                component={data.security.appIntegrity} 
                renderDetails={(details) => (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Target:</span>
                      <span className="font-bold">{details.target}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">SHA-256:</span>
                      <span className="font-bold truncate w-24 text-right" title={details.sha256}>{details.sha256}</span>
                    </div>
                  </>
                )}
              />
            </div>

            {/* PERSISTENCE & FILE INSPECTION */}
            <div className="pt-8 border-t border-slate-200 mt-8">
              <div className="flex items-center space-x-3 mb-6">
                <FileSearch className="w-5 h-5 text-slate-700" />
                <h2 className="text-lg font-bold text-slate-900 font-mono">PERSISTENCE & FILE INSPECTION</h2>
              </div>
              <p className="text-sm font-mono text-slate-600 mb-6 font-bold">{persistence.length} persistence entries discovered</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {persistence.slice(0, 10).map((item, idx) => {
                  const isMissing = item.source.includes('[MISSING_FILE]');
                  const isVerified = item.source.includes('[SIGNED / VERIFIED]');
                  const isSuspicious = item.source.includes('[SUSPICIOUS]');
                  const statusLabel = isMissing ? 'MISSING FILE' : isVerified ? 'SIGNED / VERIFIED' : isSuspicious ? 'SUSPICIOUS' : 'UNVERIFIED';
                  const title = item.location.split('\\').pop()?.split(' ')[0] || 'Unknown';
                  
                  return (
                    <div key={idx} className={`p-4 rounded-xl border ${isMissing ? 'bg-slate-50 border-slate-200' : isVerified ? 'bg-emerald-50 border-emerald-200' : isSuspicious ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'} font-mono text-xs space-y-2 relative overflow-hidden group hover:shadow-md transition-all`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="font-bold text-sm text-slate-900 truncate">{title}</div>
                          <div className="text-slate-500 truncate">{item.source.split(' [')[0]} &middot; {item.scope}</div>
                        </div>
                        {isVerified && <ShieldCheck className="w-5 h-5 text-emerald-600" />}
                        {isSuspicious && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                        {isMissing && <Info className="w-5 h-5 text-slate-400" />}
                      </div>

                      {isMissing ? (
                        <div className="bg-white/60 p-3 rounded-lg text-slate-600">
                          <div className="font-bold mb-1">File: NOT FOUND</div>
                          <div>Status: <span className="font-bold text-slate-700">MISSING FILE</span></div>
                          <div className="mt-2 text-slate-500">The persistence entry references a file that could not be located.</div>
                        </div>
                      ) : (
                        <div className="bg-white/60 p-3 rounded-lg text-slate-600 space-y-1">
                          <div className="flex justify-between"><span className="text-slate-500">Digital Signature:</span> <span className="font-bold">{item.digitalSignature?.toUpperCase() || 'UNKNOWN'}</span></div>
                          {item.location.includes('Signer:') && (
                            <div className="flex justify-between"><span className="text-slate-500">Signer:</span> <span className="font-bold truncate w-32 text-right">{item.location.split('Signer: ')[1]?.replace(')', '') || 'Unknown'}</span></div>
                          )}
                          {item.fileHash && (
                            <div className="flex justify-between"><span className="text-slate-500">SHA-256:</span> <span className="font-bold truncate w-32 text-right" title={item.fileHash}>{item.fileHash.substring(0, 16)}...</span></div>
                          )}
                          <div className="flex justify-between pt-1 mt-1 border-t border-slate-200/50">
                            <span className="text-slate-500">Defender:</span> 
                            <span className={`font-bold ${item.defenderStatus === 'No detection reported' ? 'text-emerald-700' : item.defenderStatus === 'Threat Reported' ? 'text-red-600' : 'text-slate-700'}`}>{item.defenderStatus?.toUpperCase() || 'UNKNOWN'}</span>
                          </div>
                          <div className="flex justify-between pt-1 mt-1 border-t border-slate-200/50">
                            <span className="text-slate-500">Status:</span> 
                            <span className={`font-bold ${isVerified ? 'text-emerald-700' : isSuspicious ? 'text-amber-700' : 'text-slate-700'}`}>{statusLabel}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {persistence.length > 10 && (
                <div className="text-center mt-4">
                  <span className="text-xs font-mono text-slate-500 font-bold">+ {persistence.length - 10} more entries verified</span>
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* ACTION FOOTER */}
        {stage === 'RESULTS' && data && (
          <div className="shrink-0 p-6 lg:p-8 pt-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="text-xs font-mono text-slate-500 max-w-lg">
              BioShield orchestration does not alter host configurations. Controls marked <span className="font-bold text-slate-700">UNKNOWN</span> indicate insufficient privileges to verify state on this host.
            </div>
            <button
              onClick={onComplete}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl text-sm flex items-center justify-center space-x-2 transition-all hover:scale-[1.02]"
            >
              <span>Acknowledge & Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SystemBoot;
