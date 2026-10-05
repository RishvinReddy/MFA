# AI Security Brain Local Model Selection

## 1. Environment

* **Ollama version**: 0.34.4
* **OS**: Windows
* **CPU**: 13th Gen Intel(R) Core(TM) i7-13700H (14 Cores, 20 Logical Processors)
* **RAM**: Unknown exact value (WMI query omitted output, but 13th Gen i7 laptops typically range from 16GB-32GB)
* **GPU**: Intel(R) Iris(R) Xe Graphics (Integrated)
* **VRAM**: Shared System Memory

*Note: The absence of a dedicated Nvidia GPU means inference will rely heavily on system RAM bandwidth and CPU AVX extensions. The i7-13700H is highly capable, but model size must be constrained to prevent OS swapping.*

## 2. BioShield Workload

* **Expected input size**: ~300-800 tokens. The `AISecurityEvidence` JSON is minimal, focusing on score integers, states (`TRUSTED`, `CHALLENGE`), and short string arrays.
* **Expected output size**: ~150-250 tokens. Enforced by Zod `.max()` constraints.
* **Invocation triggers**: Sparse. It does NOT run on the continuous 30s heartbeat. It only triggers on `TRUST_STATE_TRANSITION`, `HIGH_RISK_SCORE` (>= 50), or `BIOMETRIC_ANOMALY`.
* **Latency expectations**: Asynchronous background task. Strict sub-second latency is not required because it does not block the user's authentication flow. 3-8 seconds is acceptable for telemetry generation.
* **Privacy requirements**: 100% Local. Bound to `127.0.0.1:11434`. No external API calls allowed.

## 3. Candidate Models

| Model | Approx. Size | Resource Profile | Structured Output | Reasoning | Latency | Suitability |
| ----- | -----------: | ---------------- | ----------------- | --------- | ------- | ----------- |
| `llama3.1:8b` | 4.7 GB | High CPU/RAM. | Excellent JSON instruction adherence. | Strong security logic. | Medium on CPU. | High (Accuracy focused) |
| `mistral:7b` | 4.1 GB | High CPU/RAM. | Good JSON formatting. | Solid deductive reasoning. | Medium on CPU. | Medium (Baseline) |
| `qwen2.5:3b` | 2.0 GB | Low CPU/RAM. Fits in memory easily. | Great coding/JSON capabilities. | Surprisingly strong for 3B. | Fast on CPU. | High (Speed focused) |
| `phi3:mini` | 2.3 GB | Very Low CPU/RAM. | Good JSON output, sometimes verbose. | Good logic processing. | Very Fast on CPU. | Medium (Speed focused) |

## 4. Recommended Model

**`llama3.1:8b`**

*Technical Reasons:* 
BioShield requires a model that strictly separates `<SECURITY_EVIDENCE>` data from system instructions (prompt injection resistance) and rigidly adheres to the `AIOutputSchema` without hallucinating markdown blocks or prefixing responses with "Here is the JSON:". `llama3.1:8b` excels at strict formatting and instruction adherence. Because the AI trigger is sparse and asynchronous, the Intel i7-13700H has more than enough multi-core CPU power to execute this 4.7GB model within a reasonable time window (~5s) without blocking the primary authentication engines.

## 5. Fallback Model

**`qwen2.5:3b`**

*Technical Reasons:*
If `llama3.1:8b` consumes too much shared RAM (causing the laptop to page/swap) or runs too hot, `qwen2.5:3b` is the best fallback. At only 2.0GB, it loads instantly into RAM and produces highly accurate structured output due to its strong coding-oriented training.

## 6. Pull Command

```powershell
ollama pull llama3.1:8b
```
*(DO NOT EXECUTE UNTIL PHASE 3C)*

## 7. Configuration

Update `backend/.env`:
```text
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
AI_TIMEOUT_MS=15000
```

## 8. Phase 3C Preparation

To perform real inference testing:
1. Pull the model using the command above.
2. Update the backend `.env` configuration file with the exact model name.
3. Start the backend server (`npm run dev`).
4. Trigger a high-risk authentication event intentionally (e.g., spoof a biometric conflict).
5. Verify that `ollama` executes the inference by observing CPU/Memory spikes.
6. Check the BioShield `AuditLog` table to verify if the LLM successfully returned Zod-compliant JSON or if it failed parsing/schema checks.
