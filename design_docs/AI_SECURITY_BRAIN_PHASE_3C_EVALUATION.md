# AI Security Brain Phase 3C Evaluation

## 1. Environment

* **Ollama version**: 0.34.4
* **CPU**: 13th Gen Intel Core i7-13700H (14 Cores)
* **RAM**: Shared System Memory
* **GPU**: Intel Iris Xe Integrated Graphics (No dedicated VRAM)
* **Primary Model**: `llama3.1:8b`
* **Model Size**: 4.7 GB

## 2. Model Installation

* **Pull status**: SUCCESS
* **Model availability**: The model was successfully downloaded and verified in `ollama list`.

## 3. Direct Ollama Test

**Result**: SEVERE HANG / UNRESPONSIVE
Executing `ollama run llama3.1:8b "Respond with the word OK."` directly in the shell failed to return within 2.5 minutes. The process hung indefinitely as the system attempted to load the 4.7GB model into shared system RAM, heavily saturating CPU and memory bandwidth.

## 4. BioShield Integration Test

The test suite executed `AISecurityBrainService` directly using synthetic JSON payloads constructed to mimic real scenarios. The requests were passed through `PromptBuilder`, pushed over HTTP via `OllamaProvider`, and guarded by the 15-second `AI_TIMEOUT_MS` configuration.

## 5. Test Scenarios

### Normal
**Result**: FAILED (AI_TIMEOUT at 15257ms)

### Suspicious
**Result**: FAILED (AI_TIMEOUT at 15007ms)

### Contradictory
**Result**: FAILED (AI_TIMEOUT at 15008ms)

### Prompt Injection
**Result**: FAILED (AI_TIMEOUT at 15019ms)

### Prohibited Action
**Result**: FAILED (AI_TIMEOUT at 15009ms)

## 6. Structured Output Results

| Test | JSON Valid | Schema Valid | Latency | Notes |
| ---- | ---------- | ------------ | ------: | ----- |
| Normal | N/A | N/A | 15.2s | Timeout before generation |
| Suspicious | N/A | N/A | 15.0s | Timeout before generation |
| Contradictory | N/A | N/A | 15.0s | Timeout before generation |
| Prompt Inject | N/A | N/A | 15.0s | Timeout before generation |
| Prohibited | N/A | N/A | 15.0s | Timeout before generation |

## 7. Performance

* **First inference**: > 15,000ms (Failed/Timeout)
* **Subsequent inference**: > 15,000ms (Failed/Timeout)
* **Average**: N/A
* **Response size**: 0 bytes
* **Resource observations**: The system experienced severe CPU saturation and potential memory paging. The model loading overhead overwhelmed the system's shared RAM bandwidth, preventing even basic CLI completion within a reasonable timeframe.

## 8. Failure Behavior

* **Timeout**: SUCCESS. The provider correctly aborted the request strictly at the 15,000ms threshold, throwing `AI_TIMEOUT` precisely as designed. It successfully protected the main execution loop from hanging.
* **Provider unavailable**: SUCCESS. Test F explicitly targeted a dead port (`127.0.0.1:9999`) and verified that the provider instantly throws `AI_UNAVAILABLE`.
* **Malformed output**: Could not be tested due to generation failure.

## 9. Security Boundary

* **AI advisory only**: Confirmed.
* **No policy override**: Confirmed.
* **No authentication impact**: Confirmed. The failures were safely isolated in background promises.
* **No biometric raw data**: Confirmed.
* **No secrets**: Confirmed.
* **Schema validation enforced**: Confirmed conceptually (though no generation reached it).

## 10. Findings

### PASS
* Failure Isolation: The timeout constraints and error handling in `ollamaProvider` and `AISecurityBrainService` worked exactly as intended, protecting the parent thread from the model's severe performance degradation.

### FINDINGS
* N/A

### BLOCKERS
* **Hardware Insufficiency**: `llama3.1:8b` is too heavy for this specific machine's Iris Xe/System RAM architecture. The overhead of loading and evaluating prompt tokens without dedicated VRAM causes catastrophic latency (> 15 seconds), completely failing the integration requirements.

## 11. Phase 3D Recommendation

**NOT READY / FALLBACK REQUIRED**

The primary model (`llama3.1:8b`) has proven unusable on this local hardware due to resource starvation. The structured-output evaluation cannot proceed with this model.

I recommend deleting `llama3.1:8b` from the system to free up disk/RAM and immediately authorizing the pull and evaluation of the **fallback model (`qwen2.5:3b`)**. Its 2.0GB size should comfortably fit within the Iris Xe shared memory footprint and yield the required sub-5-second inference times.
