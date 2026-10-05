import { execSync } from 'child_process';
import { logger } from '../utils/logger';

export interface DefenderThreat {
    name: string;
    severityID: number;
    severityName: string;
    path: string;
    status: string;
    detectionTime: string;
}

export interface DefenderReport {
    engine: string;
    status: 'VERIFIED' | 'THREAT_REPORTED' | 'UNKNOWN';
    threats: DefenderThreat[];
    scannedAt: string;
    source: string;
}

export class DefenderService {
    private static severityMap: Record<number, string> = {
        1: 'Low',
        2: 'Moderate',
        4: 'High',
        5: 'Severe'
    };

    /**
     * Queries Windows Defender for current threat detections using PowerShell.
     */
    public static async getThreatReport(): Promise<DefenderReport> {
        const report: DefenderReport = {
            engine: 'Microsoft Defender',
            status: 'UNKNOWN',
            threats: [],
            scannedAt: new Date().toISOString(),
            source: 'Windows Security / Defender'
        };

        try {
            // Check if Defender is active first via WMI
            const avCheck = execSync(
                `powershell -Command "Get-CimInstance -Namespace 'root\\SecurityCenter2' -ClassName AntivirusProduct -ErrorAction SilentlyContinue | Select-Object displayName | ConvertTo-Json"`,
                { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
            ).trim();

            if (!avCheck) {
                return report;
            }

            // Query MpThreatDetection
            // NOTE: Requires PowerShell and Defender module. If running as standard user, some threats might not be visible,
            // but we fetch whatever is accessible to the current user context.
            const cmd = `powershell -Command "Get-MpThreatDetection -ErrorAction SilentlyContinue | Select-Object ThreatName, SeverityID, InitialDetectionTime, Resources | ConvertTo-Json -Compress"`;
            const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

            if (!output || output === 'null') {
                report.status = 'VERIFIED'; // Verified safe, no threats
                return report;
            }

            let detections: any[] = [];
            try {
                const parsed = JSON.parse(output);
                detections = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                logger.warn('[DefenderService] Failed to parse MpThreatDetection output');
                return report;
            }

            const threats: DefenderThreat[] = detections.map(d => {
                // InitialDetectionTime comes as "/Date(1623423423423)/" or sometimes raw format
                let parsedTime = new Date().toISOString();
                if (d.InitialDetectionTime) {
                    const match = String(d.InitialDetectionTime).match(/[0-9]+/);
                    if (match) {
                        parsedTime = new Date(parseInt(match[0], 10)).toISOString();
                    }
                }
                
                return {
                    name: d.ThreatName || 'Unknown Threat',
                    severityID: d.SeverityID || 0,
                    severityName: DefenderService.severityMap[d.SeverityID] || 'Unknown',
                    path: Array.isArray(d.Resources) ? d.Resources.join('; ') : (d.Resources || 'Unknown Path'),
                    status: 'DETECTED',
                    detectionTime: parsedTime
                };
            });

            report.threats = threats;
            report.status = threats.length > 0 ? 'THREAT_REPORTED' : 'VERIFIED';
            
        } catch (error) {
            logger.error('[DefenderService] Failed to query Defender status', { error: (error as Error).message });
            report.status = 'UNKNOWN';
        }

        return report;
    }
}
