import re
import json

log_path = r"c:\Users\EikoMotsu\OneDrive\Documents\Desktop\bioshield-mfa-18-sep\bioshield-mfa-2025 v9 31 july\backend\voice-validation.log"

try:
    with open(log_path, 'r', encoding='utf-16le') as f:
        content = f.read()
except UnicodeError:
    with open(log_path, 'r', encoding='utf-8') as f:
        content = f.read()

# Find all blocks of evidence or log lines
pattern = re.compile(r'\[Biometric Verification\] Voice similarity: ([\d.]+) \(Threshold: ([\d.]+)\) \| Phrase: "([^"]+)" \| Audio: ([\d.]+)s \(Speech: ([\d.]+)s, Ratio: ([\d.]+)\).*?EVIDENCES FOR FUSION: \[\s*(\{.*?\})\s*\]', re.DOTALL)

matches = pattern.findall(content)

print("| Test | Phrase | Condition | Total Duration | Speech Duration | Speech Ratio | Similarity | Speaker Match | Phrase Match | Final Result |")
print("|---|---|---|---:|---:|---:|---:|---|---|---|")

for i, m in enumerate(matches):
    sim = m[0]
    thresh = m[1]
    phrase = m[2]
    tot_dur = m[3]
    speech_dur = m[4]
    ratio = m[5]
    
    # parse the json-like evidence block
    # it's not strict JSON, it's JS object string: source: 'BiometricService',
    evidence_str = m[6]
    
    # Extract phraseMatched
    phrase_match = "false"
    if "phraseMatched: true" in evidence_str:
        phrase_match = "true"
        
    # Extract status (Final Result)
    final_res = "FAIL"
    if "status: 'PASS'" in evidence_str:
        final_res = "PASS"
        
    speaker_match = "true" if float(sim) >= 0.40 else "false"
    
    # Try to extract the reason to guess the condition
    reason = ""
    reason_match = re.search(r"reason: '([^']+)'", evidence_str)
    if reason_match:
        reason = reason_match.group(1)
        
    print(f"| {i+1} | {phrase} | {reason} | {tot_dur}s | {speech_dur}s | {ratio} | {sim} | {speaker_match} | {phrase_match} | {final_res} |")
