import re
import codecs

try:
    with codecs.open('voice-validation.log', 'r', 'utf-8') as f:
        content = f.read()
except UnicodeError:
    with codecs.open('voice-validation.log', 'r', 'utf-16le') as f:
        content = f.read()

pattern = re.compile(r'\[Biometric Verification\] Voice similarity: ([\d.]+) \(Threshold: ([\d.]+)\) \| Phrase: "([^"]+)" \| Audio: ([\d.]+)s \(Speech: ([\d.]+)s, Ratio: ([\d.]+)\).*?EVIDENCES FOR FUSION: \[\s*(\{.*?\})\s*\]', re.DOTALL)
matches = pattern.findall(content)

with open('results.md', 'w') as out:
    out.write("| Test | Phrase | Condition | Total Duration | Speech Duration | Speech Ratio | Similarity | Speaker Match | Phrase Match | Final Result |\n")
    out.write("|---|---|---|---:|---:|---:|---:|---|---|---|\n")

    for i, m in enumerate(matches):
        sim = m[0]
        thresh = m[1]
        phrase = m[2]
        tot_dur = m[3]
        speech_dur = m[4]
        ratio = m[5]
        evidence_str = m[6]
        
        phrase_match = "false"
        if "phraseMatched: true" in evidence_str:
            phrase_match = "true"
            
        final_res = "FAIL"
        if "status: 'PASS'" in evidence_str:
            final_res = "PASS"
            
        speaker_match = "true" if float(sim) >= 0.40 else "false"
        
        reason = "Normal"
        reason_match = re.search(r"rawText: ['\"]([^'\"]+)['\"]", evidence_str)
        if reason_match:
            reason = f"Got: {reason_match.group(1).strip()}"
            
        out.write(f"| {i+1} | {phrase} | {reason} | {tot_dur}s | {speech_dur}s | {ratio} | {sim} | {speaker_match} | {phrase_match} | {final_res} |\n")
