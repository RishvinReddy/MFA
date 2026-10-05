import os from 'os';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import prisma from '../prisma';
import { DefenderService, DefenderReport } from './defender.service';

export interface SecurityComponent {
    status: string;
    source: string;
    verifiedAt: string;
    confidence: 'verified' | 'unverified';
    details?: any;
}

export interface SystemBootTelemetry {
    device: {
        os: string;
        architecture: string;
        hostname: string;
        cpuModel: string;
        uptimeHours: number;
        bootMode: string;
    };
    security: {
        secureBoot: SecurityComponent;
        tpm: SecurityComponent;
        appIntegrity: SecurityComponent;
        defender: DefenderReport; // Replaces 'antivirus' component
        firewall: SecurityComponent;
        diskEncryption: SecurityComponent;
    };

    logs: Array<{ timestamp: string; type: 'INIT' | 'OK' | 'WARN' | 'FAIL' | 'UNKNOWN'; category: string; message: string }>;
}

export class SystemDiagnosticsService {
    public static async runDiagnostics(): Promise<SystemBootTelemetry> {
        const logs: SystemBootTelemetry['logs'] = [];
        const now = new Date().toISOString();
        const timeOnly = now.split('T')[1].slice(0, 8);

        const addLog = (type: 'INIT' | 'OK' | 'WARN' | 'FAIL' | 'UNKNOWN', category: string, message: string) => {
            logs.push({ timestamp: new Date().toISOString().split('T')[1].slice(0, 8), type, category, message });
        };

        const createComponent = (status: string, source: string, confidence: 'verified' | 'unverified', details?: any): SecurityComponent => ({
            status,
            source,
            verifiedAt: now,
            confidence,
            details
        });

        const execSafe = (cmd: string): string | null => {
            try {
                return execSync(cmd, { timeout: 4000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            } catch (e) {
                return null;
            }
        };

        addLog('INIT', 'SYSTEM', 'Inspecting native Windows host environment...');

        // 1. Device / OS Telemetry
        const platform = os.platform();
        const osName = platform === 'win32' ? `Windows (Kernel ${os.release()})` : `${platform} (Kernel ${os.release()})`;
        const arch = os.arch();
        const hostname = os.hostname();
        const cpus = os.cpus();
        const cpuModel = cpus && cpus.length > 0 ? cpus[0].model.trim() : 'Unknown CPU';
        const uptimeHours = Math.round((os.uptime() / 3600) * 10) / 10;
        addLog('OK', 'SYSTEM', `Host: ${hostname} | OS: ${osName} | Arch: ${arch}`);

        // 2. Secure Boot (Registry Query)
        let secureBootStatus = 'Unknown';
        let secureBootConfidence: 'verified' | 'unverified' = 'unverified';
        const regOutput = execSafe(`powershell -Command "Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State' -Name 'UEFISecureBootEnabled' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty UEFISecureBootEnabled"`);

        if (regOutput === '1') {
            secureBootStatus = 'Verified';
            secureBootConfidence = 'verified';
            addLog('OK', 'PLATFORM', 'Secure Boot enabled');
        } else if (regOutput === '0') {
            secureBootStatus = 'Disabled';
            secureBootConfidence = 'verified';
            addLog('WARN', 'PLATFORM', 'Secure Boot disabled');
        } else {
            addLog('UNKNOWN', 'PLATFORM', 'Secure Boot status unknown (Permission denied or not supported)');
        }
        const secureBoot = createComponent(secureBootStatus, 'Windows Registry (SecureBoot State)', secureBootConfidence);

        // 3. TPM 2.0 Inspection
        let tpmStatus = 'Unknown';
        let tpmConfidence: 'verified' | 'unverified' = 'unverified';
        let tpmDetails = {};
        const tpmOutput = execSafe(`powershell -Command "Get-Tpm -ErrorAction SilentlyContinue | Select-Object -Property TpmPresent, TpmReady | ConvertTo-Json -Compress"`);
        if (tpmOutput) {
            try {
                const tpm = JSON.parse(tpmOutput);
                if (tpm.TpmPresent === null) {
                    addLog('UNKNOWN', 'PLATFORM', 'TPM status requires elevated privileges');
                } else {
                    tpmStatus = (tpm.TpmPresent && tpm.TpmReady) ? 'Ready' : (tpm.TpmPresent ? 'Present, Not Ready' : 'Not Present');
                    tpmConfidence = 'verified';
                    tpmDetails = tpm;
                    addLog('OK', 'PLATFORM', `TPM Status: ${tpmStatus}`);
                }
            } catch (e) {
                addLog('WARN', 'PLATFORM', 'TPM query parsing failed');
            }
        } else {
            addLog('UNKNOWN', 'PLATFORM', 'TPM query failed or requires elevation');
        }
        const tpm = createComponent(tpmStatus, 'Windows TPM Subsystem (Get-Tpm)', tpmConfidence, tpmDetails);

        // 4. Defender Advanced Threat Detection
        const defenderReport = await DefenderService.getThreatReport();
        if (defenderReport.status === 'THREAT_REPORTED') {
            addLog('FAIL', 'SECURITY', `Defender reported ${defenderReport.threats.length} threat(s)`);
        } else if (defenderReport.status === 'VERIFIED') {
            addLog('OK', 'SECURITY', 'No Defender detections reported');
        } else {
            addLog('UNKNOWN', 'SECURITY', 'Defender query failed or unavailable');
        }

        // 5. Firewall
        let fwStatus = 'Unknown';
        let fwConfidence: 'verified' | 'unverified' = 'unverified';
        let fwDetails = {};
        const fwOutput = execSafe(`powershell -Command "Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name, Enabled | ConvertTo-Json -Compress"`);
        if (fwOutput && fwOutput !== 'null' && fwOutput !== '') {
            try {
                let profiles = JSON.parse(fwOutput);
                if (!Array.isArray(profiles)) profiles = [profiles];

                fwDetails = profiles.reduce((acc: any, p: any) => ({ ...acc, [p.Name]: p.Enabled === 1 || p.Enabled === true }), {});
                const allEnabled = profiles.every((p: any) => p.Enabled === 1 || p.Enabled === true);
                fwStatus = allEnabled ? 'Enabled' : 'Partially Enabled / Disabled';
                fwConfidence = 'verified';
                addLog(allEnabled ? 'OK' : 'WARN', 'SECURITY', `Firewall Profiles: ${fwStatus}`);
            } catch (e) {
                addLog('WARN', 'SECURITY', 'Firewall query parsing failed');
            }
        } else {
            addLog('UNKNOWN', 'SECURITY', 'Firewall query failed (Requires Elevation)');
        }
        const firewall = createComponent(fwStatus, 'Windows Firewall Profiles (Get-NetFirewallProfile)', fwConfidence, fwDetails);

        // 6. Disk Encryption
        let diskStatus = 'Unknown';
        let diskConfidence: 'verified' | 'unverified' = 'unverified';
        let diskDetails: any = {};
        const bitLockerOutput = execSafe(`powershell -Command "Get-BitLockerVolume -ErrorAction SilentlyContinue | Select-Object MountPoint, VolumeStatus, ProtectionStatus | ConvertTo-Json -Compress"`);

        if (bitLockerOutput && bitLockerOutput !== 'null' && bitLockerOutput !== '') {
            try {
                let volumes = JSON.parse(bitLockerOutput);
                if (!Array.isArray(volumes)) volumes = [volumes]; // Handle single volume

                diskDetails = { volumes };
                const allProtected = volumes.every((v: any) => v.ProtectionStatus === 1 || v.ProtectionStatus === 'On');

                diskStatus = allProtected ? 'Protected' : 'Unprotected';
                diskConfidence = 'verified';
                addLog(allProtected ? 'OK' : 'WARN', 'STORAGE', `Disk Encryption: ${diskStatus}`);
            } catch (e) {
                addLog('WARN', 'STORAGE', 'Disk Encryption query parsing failed');
            }
        } else {
            diskDetails = { reason: 'Access Denied or Command Failed' };
            addLog('UNKNOWN', 'STORAGE', 'Disk Encryption status requires elevation');
        }
        const diskEncryption = createComponent(diskStatus, 'Windows Volume Encryption API', diskConfidence, diskDetails);

        // 7. App Integrity (Hash of package.json)
        let appHash = 'unknown';
        let appConfidence: 'verified' | 'unverified' = 'unverified';
        try {
            const pkgPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkgBuffer = fs.readFileSync(pkgPath);
                appHash = crypto.createHash('sha256').update(pkgBuffer).digest('hex').slice(0, 16);
                appConfidence = 'verified';
                addLog('OK', 'INTEGRITY', `Application Hash Measured (SHA-256)`);
            }
        } catch (e) {
            addLog('FAIL', 'INTEGRITY', 'Could not read package.json for integrity hash');
        }
        const appIntegrity = createComponent(appHash !== 'unknown' ? 'MEASURED' : 'Error', 'Node.js File System Hash', appConfidence, { sha256: appHash, target: 'package.json' });

        return {
            device: {
                os: osName,
                architecture: arch,
                hostname,
                cpuModel,
                uptimeHours,
                bootMode: 'Unknown (unverified)'
            },
            security: {
                secureBoot,
                tpm,
                appIntegrity,
                defender: defenderReport,
                firewall,
                diskEncryption
            },
            logs
        };
    }
}
