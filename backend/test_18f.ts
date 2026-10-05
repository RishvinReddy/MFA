import { FileInspectionService } from './src/services/fileInspection.service';
import { PersistenceScannerService } from './src/services/persistenceScanner.service';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log("=== Phase 18F Validation Matrix ===");
  
  // 1. Valid signed executable
  let res = await FileInspectionService.inspectFile('"C:\\Windows\\explorer.exe"');
  console.log("1. Valid signed executable (explorer.exe):", res.classification);

  // 2. Missing executable
  res = await FileInspectionService.inspectFile('"C:\\FakePath\\doesnotexist.exe"');
  console.log("2. Missing executable:", res.classification);
  
  // 3. Unsigned executable
  const tempBat = path.join(__dirname, 'temp.bat');
  fs.writeFileSync(tempBat, 'echo test');
  res = await FileInspectionService.inspectFile(tempBat);
  console.log("3. Unsigned executable (temp.bat):", res.classification);
  
  // 4. Invalid signature
  const tempExe = path.join(__dirname, 'tampered.exe');
  if (fs.existsSync('C:\\Windows\\explorer.exe')) {
      const buffer = fs.readFileSync('C:\\Windows\\explorer.exe');
      buffer[100] = buffer[100] ^ 0xFF; // flip a byte
      fs.writeFileSync(tempExe, buffer);
      res = await FileInspectionService.inspectFile(tempExe);
      console.log("4. Invalid signature (tampered.exe):", res.classification);
  }
  
  // 5. Executable with command-line arguments
  res = await FileInspectionService.inspectFile('"C:\\Windows\\System32\\cmd.exe" /c echo hello');
  console.log("5. Executable with arguments:", res.classification, "(Extracted:", res.filePath, ")");

  // 6. Environment-variable path
  res = await FileInspectionService.inspectFile('%windir%\\System32\\cmd.exe');
  console.log("6. Environment variable path:", res.classification, "(Extracted:", res.filePath, ")");
  
  // 7. Permission denied
  res = await FileInspectionService.inspectFile('C:\\System Volume Information');
  console.log("7. Permission denied:", res.classification);

  // 8. Empty command
  res = await FileInspectionService.inspectFile('');
  console.log("8. Empty command:", res.classification);
  
  // Cleanup
  if (fs.existsSync(tempBat)) fs.unlinkSync(tempBat);
  if (fs.existsSync(tempExe)) fs.unlinkSync(tempExe);

  console.log("\n=== Full Persistence Inventory ===");
  const findings = await PersistenceScannerService.runDiscovery();
  console.log(`Total Findings: ${findings.length}`);
  
  const counts: Record<string, number> = {
      'SIGNED / VERIFIED': 0,
      'SUSPICIOUS': 0,
      'UNVERIFIED': 0,
      'MISSING_FILE': 0,
      'INSPECTION_FAILED': 0
  };
  
  for (const f of findings) {
      if (f.source.includes('[SIGNED / VERIFIED]')) counts['SIGNED / VERIFIED']++;
      else if (f.source.includes('[SUSPICIOUS]')) counts['SUSPICIOUS']++;
      else if (f.source.includes('[MISSING_FILE]')) counts['MISSING_FILE']++;
      else if (f.source.includes('[INSPECTION_FAILED]')) counts['INSPECTION_FAILED']++;
      else counts['UNVERIFIED']++;
  }
  
  console.log(JSON.stringify(counts, null, 2));
}

runTests().catch(console.error);
