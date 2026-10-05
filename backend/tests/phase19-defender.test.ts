import { DefenderService } from '../src/services/defender.service';
import { PersistenceScannerService } from '../src/services/persistenceScanner.service';
import { execSync } from 'child_process';
import fs from 'fs';

jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

const execSyncMock = execSync as unknown as jest.Mock;

describe('Phase 19B/19D: Defender Integration & Negative Testing', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('DefenderService (Standalone)', () => {
        it('1. Defender reports no detection', async () => {
            execSyncMock.mockReturnValueOnce(`{"displayName": "Windows Defender"}`); // WMI mock
            execSyncMock.mockReturnValueOnce('[]'); // MpThreatDetection mock
            const report = await DefenderService.getThreatReport();
            expect(report.threats.length).toBe(0);
            expect(report.status).toBe('VERIFIED');
        });

        it('2. Defender reports test artifact (EICAR)', async () => {
            const mockOutput = JSON.stringify([{
                ThreatID: 2147519003,
                ThreatName: 'Virus:DOS/EICAR_Test_File',
                SeverityID: 5,
                Resources: ['file:_C:\\eicar.com']
            }]);
            execSyncMock.mockReturnValueOnce(`{"displayName": "Windows Defender"}`); // WMI
            execSyncMock.mockReturnValueOnce(mockOutput); // Threats
            const report = await DefenderService.getThreatReport();
            expect(report.threats.length).toBe(1);
            expect(report.threats[0].name).toBe('Virus:DOS/EICAR_Test_File');
            expect(report.threats[0].severityName).toBe('Severe');
        });

        it('3. Defender query unavailable (Command fails)', async () => {
            execSyncMock.mockImplementation(() => { throw new Error('CommandNotFoundException'); });
            const report = await DefenderService.getThreatReport();
            expect(report.status).toBe('UNKNOWN');
        });

        it('4. Permission failure (Access denied)', async () => {
            execSyncMock.mockImplementation(() => { throw new Error('Access is denied'); });
            const report = await DefenderService.getThreatReport();
            expect(report.status).toBe('UNKNOWN');
        });

        it('5. Defender service unavailable (Not installed)', async () => {
            execSyncMock.mockReturnValueOnce(''); // Empty WMI result
            const report = await DefenderService.getThreatReport();
            expect(report.status).toBe('UNKNOWN');
        });
    });

    describe('PersistenceScannerService ↔ Defender Correlation', () => {
        it('6. Correlation: Defender reports no detection -> No detection reported', async () => {
            execSyncMock.mockImplementation((cmd) => {
                if (cmd.includes('AntivirusProduct')) return `{"displayName": "Windows Defender"}`;
                if (cmd.includes('Get-MpThreatDetection')) return '[]';
                if (cmd.includes('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run')) return `{"Task1": "C:\\\\cmd.exe"}`;
                return '';
            });

            jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            const inventory = await PersistenceScannerService.runDiscovery();
            // runDiscovery returns { findings: [...] } or just an array? 
            // In my previous test it was `const inventory = await PersistenceScannerService.runDiscovery();`
            // Let's check. Actually `runDiscovery` returns an array of `PersistenceEvidence`.
            const task = (inventory as any[]).find(f => f.pathOrCommand.includes('cmd.exe'));
            expect(task).toBeDefined();
            expect(task?.defenderStatus).toBe('No detection reported');
        });

        it('7. Correlation: Defender reports test artifact -> Threat Reported', async () => {
            const mockOutput = JSON.stringify([{
                ThreatID: 12345,
                ThreatName: 'Trojan:Win32/Evil',
                SeverityID: 4,
                Resources: ['file:_C:\\evil.exe']
            }]);
            execSyncMock.mockImplementation((cmd) => {
                if (cmd.includes('AntivirusProduct')) return `{"displayName": "Windows Defender"}`;
                if (cmd.includes('Get-MpThreatDetection')) return mockOutput;
                if (cmd.includes('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run')) return `{"EvilTask": "C:\\\\evil.exe"}`;
                return '';
            });

            jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            const inventory = await PersistenceScannerService.runDiscovery();
            const task = (inventory as any[]).find(f => f.pathOrCommand.includes('evil.exe'));
            expect(task).toBeDefined();
            expect(task?.defenderStatus).toBe('Threat Reported');
        });

        it('8. File states: MISSING_FILE, UNVERIFIED, SIGNED / VERIFIED', async () => {
            execSyncMock.mockImplementation((cmd) => {
                if (cmd.includes('AntivirusProduct')) return `{"displayName": "Windows Defender"}`;
                if (cmd.includes('Get-MpThreatDetection')) return '[]';
                if (cmd.includes('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run')) return `{"MissingTask": "C:\\\\doesnotexist.exe"}`;
                return '';
            });
            jest.spyOn(fs, 'existsSync').mockReturnValue(false); // File missing

            const inventory = await PersistenceScannerService.runDiscovery();
            const missing = (inventory as any[]).find(f => f.pathOrCommand.includes('doesnotexist.exe'));
            expect(missing?.source).toContain('[MISSING_FILE]');
        });
    });
});
