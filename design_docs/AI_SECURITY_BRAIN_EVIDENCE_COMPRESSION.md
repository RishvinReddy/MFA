# AI Security Brain Evidence Compression

## 1. Problem

The current evidence payload provides deep, nested telemetry (session IDs, user IDs, timestamps, granular biometric sub-scores) which produces a high token count and requires extensive serialization. For a local 3B parameter model on a CPU-only environment (Iris Xe), this structural bloat forces the inference latency dangerously close to the 15-second safety boundary (averaging 14–16 seconds), resulting in frequent timeouts.

## 2. Current Evidence

The current payload (`AISecurityEvidence`) includes:
* `session` (`sessionId`, `ageSeconds`)
* `identity` (`userId`)
* `risk` (`score`, `level`, `factors`)
* `trust` (`state`, `previousState`)
* `biometrics` / `face` / `voice` (detailed metrics)
* `recentEvents` (array of full event objects)
* `triggerEvent`
* `timestamp`

## 3. Compression Principles

1. **Data reduction, not decision-making**: The layer only compacts already-computed facts.
2. **Remove identity/session fluff**: The AI does not need raw UUIDs or timestamps to explain a security anomaly.
3. **Preserve semantics**: Keep descriptive keys. Do not compress `riskScore` to `rs`. The LLM needs context.
4. **Flatten JSON structural bloat**: Convert nested objects and arrays of objects into concise summary strings.

## 4. Field Classification

| Existing Field | AI Useful? | Preserve? | Compress? | Remove? | Reason |
| -------------- | ---------: | --------: | --------: | ------: | ------ |
| `session.sessionId` | NO | NO | NO | YES | AI doesn't need to know the UUID to analyze behavior. |
| `session.ageSeconds` | YES | NO | YES | NO | Can be useful if extremely short, but usually irrelevant. |
| `identity.userId` | NO | NO | NO | YES | PII / Irrelevant to anomaly explanation. |
| `risk.score` | YES | YES | NO | NO | Critical deterministic boundary. |
| `risk.level` | NO | NO | NO | YES | Redundant; score provides the same meaning. |
| `risk.factors` | YES | YES | NO | NO | Vital for AI explanation. |
| `trust.state` | YES | YES | NO | NO | Current enforcement posture. |
| `trust.previousState`| YES | NO | YES | NO | Only useful if there was a transition. |
| `face.*` / `voice.*` | YES | NO | YES | NO | Flatten into a single summary string per modality. |
| `recentEvents` | YES | NO | YES | NO | Flatten array into a count summary string. |
| `triggerEvent` | YES | YES | NO | NO | The reason the AI was invoked. |
| `timestamp` | NO | NO | NO | YES | Redundant for real-time inference. |

## 5. Proposed Compact Contract

```typescript
export interface AICompactSecurityEvidence {
  riskScore: number;
  riskFactors?: string[];
  trustState: string;
  trustTransition?: string; // Included ONLY if state changed, e.g., "TRUSTED -> CHALLENGE"
  face?: string; // Flattened, e.g., "similarity: 0.94, liveness: 0.98"
  voice?: string; // Flattened, e.g., "similarity: 0.91, match: true"
  recentEvents?: string; // Flattened, e.g., "1x BIOMETRIC_MISMATCH"
  triggerEvent: string;
}
```

## 6. Event Aggregation

Instead of sending an array of JSON objects:
```json
"recentEvents": [ { "type": "BIOMETRIC_MISMATCH", "severity": "HIGH" } ]
```
We compress it to a single string summarizing the array:
```json
"recentEvents": "1x BIOMETRIC_MISMATCH (HIGH)"
```

## 7. Biometric Summary

Instead of sending nested objects:
```json
"face": { "similarity": 0.94, "liveness": 0.98, "quality": 0.95, "faceDetected": true }
```
We flatten it to the critical failure points/scores:
```json
"face": "sim: 0.94, liveness: 0.98"
```

## 8. Identity Minimization

`userId`, `sessionId`, and `timestamp` are completely dropped. They add dozens of tokens and structural characters but provide zero analytical value to an isolated behavior-analysis prompt.

## 9. Security Preservation

The compact payload preserves the exact deterministic risk score, the exact anomaly factors identified by the RiskEngine, and the exact Trust state transition. The LLM still has all the ingredients necessary to explain the anomaly and correlate the evidence.

## 10. Prompt Injection Boundary

The compression layer is deterministic TypeScript code. It blindly copies the `risk.factors` strings. Therefore, if an attacker injects prompt material into an evidence field, it will safely be placed inside the JSON payload, maintaining the existing system prompt boundary.

## 11. Benchmark Methodology

We will run `backend/scripts/benchmark-ai-evidence-compression.ts`.
It will synthesize the 5 standard BioShield scenarios. For each scenario, it will generate the CURRENT payload and the COMPACT payload, measure their serialized string lengths, and invoke `qwen2.5:3b`. We will measure the precise latency drop and verify that the model still correctly outputs the Zod schema and makes logical sense.

## 12. Expected Phase 3D Implementation

*Wait for benchmark validation before integrating into AdaptiveAuthService.*
