# AI Security Brain Implementation (Phase 2)

## 1. Architecture Implemented

The AI Security Brain has been successfully implemented as a **Parallel Asynchronous Security Observer**. It operates out-of-band alongside the deterministic `adaptiveAuth.service.ts` pipeline. It does not block the authentication flow and its output (`recommendedAction`) is strictly advisory, ensuring the original deterministic engines remain the absolute authority.

## 2. File Structure

A new clean AI module has been created inside the backend:
```text
backend/src/services/ai/
├── aiProvider.ts (Interface defined in types)
├── mockProvider.ts (Mock implementation)
├── ollamaProvider.ts (Ollama implementation via API)
├── aiSecurityBrain.service.ts (Trigger, async wrapper, audit logging)
├── aiSecurityBrain.types.ts (Interfaces and contracts)
├── aiSecurityBrain.schema.ts (Zod schema for strict validation)
├── aiSecurityBrain.prompt.ts (System and task prompts)
└── index.ts (Module exports)
```

## 3. Provider Abstraction

The `AIProvider` interface enforces a strict contract: `analyze(request: AIAnalysisRequest): Promise<AIProviderResponse>`.
Two providers have been implemented:
1. `MockAIProvider`: A deterministic provider that returns predictable assessments (e.g., `HIGH_RISK` when score >= 80) without relying on an external service.
2. `OllamaProvider`: A provider that communicates with a local Ollama instance (defaulting to `http://127.0.0.1:11434`), parsing and validating JSON output strictly.

## 4. Evidence Contract

The sanitized evidence type (`AISecurityEvidence`) was mapped directly against actual data structures from the `adaptiveAuth.service.ts`.
It includes:
- `session` (sessionId, ageSeconds)
- `identity` (userId)
- `risk` (score, level, factors)
- `trust` (state, previousState)
- `biometrics` (modalitiesUsed, fusionDecision)
- `triggerEvent` and `timestamp`.

All raw biometric data, secrets, tokens, and PII (except a generic `userId`) are omitted.

## 5. Output Contract

Using `Zod` (`aiSecurityBrain.schema.ts`), the AI output is strictly validated against an enumerated schema:
- `assessment`: 'NORMAL' | 'SUSPICIOUS' | 'HIGH_RISK' | 'INSUFFICIENT_EVIDENCE'
- `recommendedAction`: 'NONE' | 'OBSERVE' | 'REVIEW' (Intentionally excludes UNLOCK/ALLOW/BLOCK to prevent authoritative action).

## 6. Prompt Architecture

Prompts are isolated in `PromptBuilder`. The architecture guarantees a strict separation between instructions and data:
- `getSystemPrompt()`: Instructs the AI that it is advisory and cannot execute actions.
- `serializeEvidence()`: Serializes sanitized JSON evidence purely as data.
- `getTaskPrompt()`: Instructs the AI to output the structured JSON.

## 7. Trigger Mechanism

The AI is not triggered on every continuous heartbeat. The `shouldTrigger()` logic in `AISecurityBrainService` explicitly looks for:
- `TRUST_STATE_TRANSITION`
- `HIGH_RISK_SCORE` (Score >= 50)
- `BIOMETRIC_ANOMALY` (Conflicts or Spoofs)

It also includes a 10-second deduplication cache window to prevent analysis storms from identical consecutive events.

## 8. Asynchronous Behavior

In `adaptiveAuth.service.ts`, the AI Brain is invoked at the very end of the evaluation cycle using `AISecurityBrainService.triggerAsyncAnalysis(evidence)`. It is executed as a fire-and-forget background task without blocking the return of the `PolicyDecision`.

## 9. Failure Behavior

All failures are safely contained:
- `AI_UNAVAILABLE` or `AI_TIMEOUT`: Provider fails to respond.
- `AI_INVALID_RESPONSE`: JSON parsing fails.
- `AI_SCHEMA_VALIDATION_FAILED`: Ollama returns valid JSON but invalid schema.
In all cases, the error is caught by `AISecurityBrainService`, recorded in the `auditLog` as `AI_SECURITY_ANALYSIS_FAILED`, and the background task exits silently. Authentication is completely unaffected.

## 10. Audit Integration

The standard `auditLog` Prisma model is used. 
- Successes are logged as `AI_SECURITY_ANALYSIS` with the full `AIProviderResponse` and latency stored securely inside the JSON `metadata` column.
- Failures are logged as `AI_SECURITY_ANALYSIS_FAILED` with the `reason` in metadata.

## 11. Security Boundaries

- The AI is never awaited in the authentication critical path.
- The AI never has access to the `PolicyEngine` or database mutators.
- No sensitive data is serialized into the prompt.
- Even if the AI outputs `{ "recommendedAction": "UNLOCK" }`, it will fail schema validation and be discarded.

## 12. Testing Strategy

Unit tests have been written in `backend/tests/services/ai.test.ts` focusing on:
- Trigger logic and deduplication cache.
- Provider fallback/selection via `.env` variables.
- Zod schema validation edge cases (missing fields, unknown enums, invalid types).
- Error mapping (AI_INVALID_RESPONSE handling).

## 13. Ollama Integration Instructions

To switch from the Mock provider to real AI analysis:
1. Ensure Ollama is running locally.
2. Ensure a model (e.g., `llama3` or `mistral`) is pulled (`ollama run llama3`).
3. In `backend/.env`, set:
   ```env
   AI_ENABLED=true
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=llama3
   ```
4. Restart the backend.

## 14. Remaining Work for Phase 3

- **Validate with Real Ollama**: Fire up a model and measure the latency, accuracy, and format compliance of the real LLM output.
- **Prompt Tuning**: The current prompt might need adjustment based on the model's actual zero-shot JSON compliance.
- **Frontend Security Console Integration**: Build the UI to display the AI's explanation and audit logs inside the Administrator dashboard. (The old `geminiService.ts` can be removed or repointed to a new `/api/ai/explain` route).

## Phase 2.6 Security Remediation

### Deduplication
Resolved race condition by moving `lastAnalysisMap` updates into the synchronous `shouldTrigger()` method.

### Memory Cleanup
Added `cleanupStaleEntries` inside `AISecurityBrainService` to periodically purge expired keys from the deduplication map, preventing Node OOM errors.

### Output Bounds
Implemented explicit `.max()` string and array bounds inside `Zod` schema. Configured Axios to enforce a 1MB `maxContentLength` transport cap.

### Prompt Data Boundary
Hardened the prompt with `<SECURITY_EVIDENCE>` tags and explicit system instructions to treat all evidence as untrusted data to mitigate prompt injection.

### Regression Tests
Added test suites for deduplication races, Map memory cleanup, schema string bounds, and prompt string construction.
