import { execSync } from 'child_process';

export interface PersistenceEvidence {
    source: string; // e.g., "Registry Run Key (HKCU)", "Scheduled Task", "Windows Service"
    location: string;
    pathOrCommand: string;
    discoveredAt: string;
    scope: 'User' | 'System';
    enabled: boolean;
    digitalSignature?: 'Signed' | 'Unsigned' | 'Unknown';
    fileHash?: string;
    defenderStatus?: string;
}

import { DefenderService, DefenderReport } from './defender.service';

export class PersistenceScannerService {
    public static async runDiscovery(): Promise<PersistenceEvidence[]> {
        const findings: PersistenceEvidence[] = [];
        const now = new Date().toISOString();

        const execSafe = (cmd: string): string | null => {
            try {
                return execSync(`powershell -Command "${cmd}"`, { timeout: 8000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            } catch (e) {
                return null;
            }
        };

        // 1. HKCU Run Keys (User Scope)
        const hkcuOutput = execSafe("Get-ItemProperty HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run -ErrorAction SilentlyContinue | Select-Object -Property * -ExcludeProperty PSPath,PSParentPath,PSChildName,PSDrive,PSProvider | ConvertTo-Json -Compress");
        if (hkcuOutput && hkcuOutput !== 'null' && hkcuOutput !== '') {
            try {
                const keys = JSON.parse(hkcuOutput);
                for (const [name, command] of Object.entries(keys)) {
                    findings.push({
                        source: 'Registry Run Key',
                        location: `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\${name}`,
                        pathOrCommand: String(command),
                        discoveredAt: now,
                        scope: 'User',
                        enabled: true
                    });
                }
            } catch (e) { /* ignore */ }
        }

        // 2. HKLM Run Keys (System Scope)
        const hklmOutput = execSafe("Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run -ErrorAction SilentlyContinue | Select-Object -Property * -ExcludeProperty PSPath,PSParentPath,PSChildName,PSDrive,PSProvider | ConvertTo-Json -Compress");
        if (hklmOutput && hklmOutput !== 'null' && hklmOutput !== '') {
            try {
                const keys = JSON.parse(hklmOutput);
                for (const [name, command] of Object.entries(keys)) {
                    findings.push({
                        source: 'Registry Run Key',
                        location: `HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\${name}`,
                        pathOrCommand: String(command),
                        discoveredAt: now,
                        scope: 'System',
                        enabled: true
                    });
                }
            } catch (e) { /* ignore */ }
        }

        // 3. Scheduled Tasks (Filter out Microsoft paths)
        const psScript = "Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object TaskPath -notmatch '\\\\Microsoft\\\\' | ForEach-Object { [PSCustomObject]@{ TaskName = $_.TaskName; TaskPath = $_.TaskPath; State = $_.State; Action = if ($_.Actions.Count -gt 0) { $_.Actions[0].Execute } else { '' } } } | ConvertTo-Json -Compress";
        // Write the script to a temp file to avoid quoting hell
        const tmpPs1 = require('path').join(require('os').tmpdir(), 'bs_tasks.ps1');
        require('fs').writeFileSync(tmpPs1, psScript);
        const tasksOutput = execSafe(`& '${tmpPs1}'`);
        
        if (tasksOutput && tasksOutput !== 'null' && tasksOutput !== '') {
            try {
                const tasks = JSON.parse(tasksOutput.startsWith('[') ? tasksOutput : `[${tasksOutput}]`);
                for (const task of tasks) {
                    findings.push({
                        source: 'Scheduled Task',
                        location: `${task.TaskPath}${task.TaskName}`,
                        pathOrCommand: task.Action || 'Unknown Action',
                        discoveredAt: now,
                        scope: 'System',
                        enabled: task.State !== 1 // 1=Disabled, 3=Ready, 4=Running
                    });
                }
            } catch (e) { /* ignore */ }
        }

        // 4. Windows Services (Auto Start, non-Windows paths)
        const servicesOutput = execSafe("Get-CimInstance win32_service -ErrorAction SilentlyContinue | Where-Object StartMode -eq 'Auto' | Where-Object PathName -notmatch '(?i)\\\\Windows\\\\' | Select-Object Name, PathName, State | ConvertTo-Json -Compress");
        if (servicesOutput && servicesOutput !== 'null' && servicesOutput !== '') {
             try {
                const services = JSON.parse(servicesOutput.startsWith('[') ? servicesOutput : `[${servicesOutput}]`);
                for (const svc of services) {
                    if (!svc.PathName) continue;
                    findings.push({
                        source: 'Windows Service',
                        location: `Service: ${svc.Name}`,
                        pathOrCommand: svc.PathName,
                        discoveredAt: now,
                        scope: 'System',
                        enabled: true
                    });
                }
            } catch (e) { /* ignore */ }
        }

        // 5. Startup Folders (User)
        const startupUserOutput = execSafe("Get-ChildItem \\\"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\\" -ErrorAction SilentlyContinue | Select-Object Name, FullName | ConvertTo-Json -Compress");
        if (startupUserOutput && startupUserOutput !== 'null' && startupUserOutput !== '') {
             try {
                const files = JSON.parse(startupUserOutput.startsWith('[') ? startupUserOutput : `[${startupUserOutput}]`);
                for (const file of files) {
                    findings.push({
                        source: 'Startup Folder',
                        location: file.FullName,
                        pathOrCommand: file.FullName,
                        discoveredAt: now,
                        scope: 'User',
                        enabled: true
                    });
                }
            } catch (e) { /* ignore */ }
        }
        
        // 6. Startup Folders (Common)
        const startupCommonOutput = execSafe("Get-ChildItem \\\"$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\\" -ErrorAction SilentlyContinue | Select-Object Name, FullName | ConvertTo-Json -Compress");
        if (startupCommonOutput && startupCommonOutput !== 'null' && startupCommonOutput !== '') {
             try {
                const files = JSON.parse(startupCommonOutput.startsWith('[') ? startupCommonOutput : `[${startupCommonOutput}]`);
                for (const file of files) {
                    findings.push({
                        source: 'Startup Folder',
                        location: file.FullName,
                        pathOrCommand: file.FullName,
                        discoveredAt: now,
                        scope: 'System',
                        enabled: true
                    });
                }
            } catch (e) { /* ignore */ }
        }

        // --- Phase 18F: File Inspection & Phase 19C: Defender Correlation ---
        const { FileInspectionService } = require('./fileInspection.service');
        const defenderReport = await DefenderService.getThreatReport();

        for (const finding of findings) {
            try {
                const inspection = await FileInspectionService.inspectFile(finding.pathOrCommand);
                if (inspection.exists) {
                    finding.fileHash = inspection.sha256;
                    finding.digitalSignature = inspection.signatureStatus;
                    // Append classification to source or handle separately
                    finding.source = `${finding.source} [${inspection.classification}]`;
                    if (inspection.signer) {
                        finding.location = `${finding.location} (Signer: ${inspection.signer})`;
                    }

                    // Correlate with Defender Threats
                    const isThreat = defenderReport.threats.some(t => {
                        const tPath = t.path.toLowerCase();
                        const fPath = inspection.filePath.toLowerCase();
                        const fName = require('path').basename(fPath);
                        return tPath.includes(fPath) || tPath.includes(fName) || fPath.includes(tPath);
                    });
                    
                    finding.defenderStatus = isThreat ? 'Threat Reported' : (defenderReport.status === 'VERIFIED' ? 'No detection reported' : 'Unknown');
                } else {
                    finding.source = `${finding.source} [MISSING_FILE]`;
                }
            } catch (err) {
                finding.source = `${finding.source} [INSPECTION_FAILED]`;
            }
        }

        return findings;
    }
}
