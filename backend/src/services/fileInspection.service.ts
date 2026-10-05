import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';

export interface FileInspectionEvidence {
    filePath: string;
    exists: boolean;
    sha256?: string;
    signatureStatus?: string;
    signer?: string;
    fileSize?: number;
    inspectionAt: string;
    classification: 'SIGNED / VERIFIED' | 'SUSPICIOUS' | 'UNVERIFIED' | 'KNOWN_MALICIOUS' | 'MISSING_FILE';
}

export class FileInspectionService {
    public static async inspectFile(targetCommand: string): Promise<FileInspectionEvidence> {
        const now = new Date().toISOString();
        const evidence: FileInspectionEvidence = {
            filePath: targetCommand,
            exists: false,
            inspectionAt: now,
            classification: 'UNVERIFIED'
        };

        if (!targetCommand || targetCommand.trim() === '') {
            return evidence;
        }

        // Extract executable path from a potential command line string
        let cleanPath = targetCommand.trim();
        if (cleanPath.startsWith('"')) {
            cleanPath = cleanPath.split('"')[1];
        } else if (cleanPath.startsWith("'")) {
            cleanPath = cleanPath.split("'")[1];
        } else {
            const exeIndex = cleanPath.toLowerCase().indexOf('.exe');
            if (exeIndex !== -1) {
                cleanPath = cleanPath.substring(0, exeIndex + 4);
            } else {
                // Try treating the whole thing as a path first, if not exists, split by space.
                let potentialPath = cleanPath;
                if (!require('fs').existsSync(potentialPath) && potentialPath.includes(' ')) {
                    potentialPath = potentialPath.split(' ')[0];
                }
                cleanPath = potentialPath;
            }
        }

        // Expand environment variables if any
        if (cleanPath.includes('%')) {
            try {
                cleanPath = execSync(`powershell -Command "[Environment]::ExpandEnvironmentVariables('${cleanPath}')"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            } catch (e) { /* ignore */ }
        }

        evidence.filePath = cleanPath;

        if (!fs.existsSync(cleanPath)) {
            evidence.classification = 'MISSING_FILE';
            return evidence;
        }

        evidence.exists = true;
        
        try {
            const stats = fs.statSync(cleanPath);
            evidence.fileSize = stats.size;
            // Only hash if file is reasonably small to avoid blocking the event loop (e.g. < 50MB)
            if (stats.size < 50 * 1024 * 1024) {
                const buffer = fs.readFileSync(cleanPath);
                evidence.sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
            }
        } catch (e) {
            // Permission denied or file locked
        }

        // Check Signature via PowerShell
        try {
            // Escape single quotes for PowerShell
            const escapedPath = cleanPath.replace(/'/g, "''");
            const psScript = `
                $sig = Get-AuthenticodeSignature -FilePath '${escapedPath}' -ErrorAction SilentlyContinue
                if ($sig) {
                    $signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { 'Unknown' }
                    @{ Status = $sig.Status.ToString(); Signer = $signer } | ConvertTo-Json -Compress
                }
            `;
            const sigOutput = execSync(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`, { timeout: 8000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            if (sigOutput) {
                const sig = JSON.parse(sigOutput);
                evidence.signatureStatus = sig.Status;
                evidence.signer = sig.Signer;
            }
        } catch (e) { /* ignore */ }

        // Classification Rules
        if (evidence.signatureStatus === 'Valid') {
            evidence.classification = 'SIGNED / VERIFIED';
        } else if (evidence.signatureStatus === 'HashMismatch') {
            evidence.classification = 'SUSPICIOUS';
        } else {
            evidence.classification = 'UNVERIFIED';
        }

        return evidence;
    }
}
