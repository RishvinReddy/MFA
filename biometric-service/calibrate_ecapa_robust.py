"""
Phase 3I.4.1 -- ECAPA-TDNN (SpeechBrain) Statistical Robustness Audit
======================================================================
Purpose
-------
Bootstrap confidence intervals for the voice calibration study:
  - Reuses the same extraction logic as calibrate_ecapa.py
  - Adds stratified pair construction and 1000-iteration bootstrap CI
  - Evaluates both the current (0.40) and alternative (0.35) anchors
  - AUDIT-ONLY: does not modify calibration.service.ts

Current voice calibration anchor (calibration.service.ts):
  calibrateVoice: rawConfidence < 0.40 -> impostor zone
  EER from Phase 3I.4 preliminary run: 0.0361 at threshold 0.3677
"""

import os
import glob
import numpy as np
import torch
import torchaudio
import soundfile as sf
import warnings
warnings.filterwarnings('ignore')

from sklearn.metrics import roc_curve, auc as sklearn_auc
from speechbrain.inference.speaker import EncoderClassifier
from tqdm import tqdm

# Configuration
SEED               = 42
CALIBRATION_DIR    = r"..\voice_calibration"
MODEL_SOURCE       = "speechbrain/spkrec-ecapa-voxceleb"
N_BOOTSTRAP        = 1000
MAX_IMPOSTOR_PAIRS = 5000
ANCHOR_CURRENT     = 0.40   # Current calibration.service.ts anchor for voice
ANCHOR_ALT         = 0.35   # Alternative to evaluate (EER point from Phase 3I.4)

def cosine_sim(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))

def compute_eer(genuine, impostor):
    labels = np.concatenate([np.ones(len(genuine)), np.zeros(len(impostor))])
    scores = np.concatenate([genuine, impostor])
    if len(np.unique(labels)) < 2:
        return np.nan, np.nan
    fpr, tpr, thresholds = roc_curve(labels, scores, pos_label=1)
    fnr = 1 - tpr
    idx = np.nanargmin(np.abs(fnr - fpr))
    return float(fpr[idx]), float(thresholds[idx])

def compute_auc(genuine, impostor):
    labels = np.concatenate([np.ones(len(genuine)), np.zeros(len(impostor))])
    scores = np.concatenate([genuine, impostor])
    if len(np.unique(labels)) < 2:
        return np.nan
    fpr, tpr, _ = roc_curve(labels, scores, pos_label=1)
    return float(sklearn_auc(fpr, tpr))

def ci95(arr):
    return np.percentile(arr, 2.5), np.percentile(arr, 97.5)

def section(title):
    print(f"\n{'='*60}\n  {title}\n{'='*60}")

def stats_block(label, arr):
    print(f"{label}: count={len(arr)}  min={np.min(arr):.4f}  max={np.max(arr):.4f}  mean={np.mean(arr):.4f}  median={np.median(arr):.4f}  std={np.std(arr):.4f}")

def far(scores, t):
    return np.sum(scores >= t) / max(len(scores), 1)

def frr(scores, t):
    return np.sum(scores < t) / max(len(scores), 1)

def extract_embedding(audio_path, classifier):
    import imageio_ffmpeg, subprocess, tempfile
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_name = tmp.name
    try:
        subprocess.run(
            [ffmpeg_exe, "-y", "-i", audio_path, "-ac", "1", "-ar", "16000", tmp_name],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
        )
        signal_np, fs = sf.read(tmp_name)
    finally:
        os.remove(tmp_name)
    signal = torch.tensor(signal_np, dtype=torch.float32).unsqueeze(0)
    if fs != 16000:
        signal = torchaudio.transforms.Resample(fs, 16000)(signal)
    with torch.no_grad():
        emb = classifier.encode_batch(signal).squeeze()
        emb = torch.nn.functional.normalize(emb, p=2, dim=0)
    return emb.numpy()

def run():
    rng = np.random.RandomState(SEED)

    print(f"Loading ECAPA-TDNN from {MODEL_SOURCE}...")
    classifier = EncoderClassifier.from_hparams(source=MODEL_SOURCE, run_opts={"device": "cpu"})

    # Collect speakers
    speakers = [d for d in os.listdir(CALIBRATION_DIR)
                if os.path.isdir(os.path.join(CALIBRATION_DIR, d))]
    print(f"Found {len(speakers)} speakers in {CALIBRATION_DIR}")

    embeddings_by_spk = {}
    for spk in tqdm(speakers, desc="Speakers"):
        spk_dir = os.path.join(CALIBRATION_DIR, spk)
        wavs = glob.glob(os.path.join(spk_dir, "*.wav"))
        embs = []
        for wav in wavs:
            try:
                emb = extract_embedding(wav, classifier)
                embs.append(emb)
            except Exception as e:
                print(f"  WARN: {wav}: {e}")
        if embs:
            embeddings_by_spk[spk] = embs

    spk_list = [s for s, embs in embeddings_by_spk.items() if len(embs) >= 2]
    print(f"Speakers with >=2 recordings: {len(spk_list)}")

    if len(spk_list) < 2:
        print("ERROR: Need at least 2 speakers with >=2 recordings each.")
        print("  The voice_calibration directory may have too few samples for bootstrap CI.")
        print("  Run the full VoxCeleb-based calibration for production validation.")
        # Still report point estimates if we have any pairs
        return

    # Genuine pairs
    genuine_scores = []
    for spk in spk_list:
        embs = embeddings_by_spk[spk]
        for i in range(len(embs)):
            for j in range(i+1, len(embs)):
                genuine_scores.append(cosine_sim(embs[i], embs[j]))
    genuine_scores = np.array(genuine_scores, dtype=np.float32)

    # Impostor pairs
    all_impostor = []
    for i in range(len(spk_list)):
        for j in range(i+1, len(spk_list)):
            for e1 in embeddings_by_spk[spk_list[i]]:
                for e2 in embeddings_by_spk[spk_list[j]]:
                    all_impostor.append(cosine_sim(e1, e2))
    all_impostor = np.array(all_impostor, dtype=np.float32)

    if len(all_impostor) > MAX_IMPOSTOR_PAIRS:
        idx = rng.choice(len(all_impostor), MAX_IMPOSTOR_PAIRS, replace=False)
        impostor_scores = all_impostor[idx]
    else:
        impostor_scores = all_impostor

    section("POINT ESTIMATES")
    stats_block("Genuine ", genuine_scores)
    stats_block("Impostor", impostor_scores)
    eer_point, eer_thresh = compute_eer(genuine_scores, impostor_scores)
    auc_point             = compute_auc(genuine_scores, impostor_scores)
    gap = np.min(genuine_scores) - np.max(impostor_scores)
    print(f"Score gap (genuine_min - impostor_max): {gap:+.4f}")
    print(f"EER : {eer_point:.4f}  (at threshold {eer_thresh:.4f})")
    print(f"AUC : {auc_point:.4f}")
    print(f"\nAt CURRENT anchor ({ANCHOR_CURRENT:.2f}):  FAR={far(impostor_scores, ANCHOR_CURRENT):.4f}  FRR={frr(genuine_scores, ANCHOR_CURRENT):.4f}")
    print(f"At ALT anchor    ({ANCHOR_ALT:.2f}):  FAR={far(impostor_scores, ANCHOR_ALT):.4f}  FRR={frr(genuine_scores, ANCHOR_ALT):.4f}")

    section("FAR / FRR TABLE")
    print(f"{'Threshold':>9} | {'FAR':>8} | {'FRR':>8} | {'TAR':>8} | {'TRR':>8}")
    print("-" * 55)
    for t in np.arange(0.10, 0.90, 0.05):
        f = far(impostor_scores, t)
        r = frr(genuine_scores, t)
        marker = " <- current" if abs(t - ANCHOR_CURRENT) < 0.01 else " <- alt" if abs(t - ANCHOR_ALT) < 0.01 else ""
        print(f"{t:9.2f} | {f:8.4f} | {r:8.4f} | {1-r:8.4f} | {1-f:8.4f}{marker}")

    if len(genuine_scores) < 5 or len(impostor_scores) < 10:
        print("\nWARNING: Too few pairs for bootstrap CI to be meaningful.")
        print("  Genuine pairs:", len(genuine_scores))
        print("  Impostor pairs:", len(impostor_scores))
        print("  Bootstrap skipped. Use VoxCeleb for full validation.")
        return

    section(f"BOOTSTRAP CI (n={N_BOOTSTRAP}, seed={SEED})")
    boot_eer     = np.empty(N_BOOTSTRAP)
    boot_auc     = np.empty(N_BOOTSTRAP)
    boot_far_cur = np.empty(N_BOOTSTRAP)
    boot_frr_cur = np.empty(N_BOOTSTRAP)
    boot_far_alt = np.empty(N_BOOTSTRAP)
    boot_frr_alt = np.empty(N_BOOTSTRAP)

    for b in tqdm(range(N_BOOTSTRAP), desc="Bootstrap"):
        g_b   = genuine_scores [rng.choice(len(genuine_scores),  len(genuine_scores),  replace=True)]
        imp_b = impostor_scores[rng.choice(len(impostor_scores), len(impostor_scores), replace=True)]
        boot_eer[b], _ = compute_eer(g_b, imp_b)
        boot_auc[b]    = compute_auc(g_b, imp_b)
        boot_far_cur[b] = far(imp_b, ANCHOR_CURRENT)
        boot_frr_cur[b] = frr(g_b,   ANCHOR_CURRENT)
        boot_far_alt[b] = far(imp_b, ANCHOR_ALT)
        boot_frr_alt[b] = frr(g_b,   ANCHOR_ALT)

    def fmt(arr):
        lo, hi = ci95(arr)
        return f"{np.mean(arr):.4f}  95% CI [{lo:.4f}, {hi:.4f}]"

    print(f"\nEER                         | {fmt(boot_eer)}")
    print(f"AUC                         | {fmt(boot_auc)}")
    print(f"FAR @ {ANCHOR_CURRENT:.2f} (current)   | {fmt(boot_far_cur)}")
    print(f"FRR @ {ANCHOR_CURRENT:.2f} (current)   | {fmt(boot_frr_cur)}")
    print(f"FAR @ {ANCHOR_ALT:.2f} (alt)        | {fmt(boot_far_alt)}")
    print(f"FRR @ {ANCHOR_ALT:.2f} (alt)        | {fmt(boot_frr_alt)}")

    section("CALIBRATION DECISION GUIDANCE")
    print("AUDIT-ONLY. calibration.service.ts is NOT modified.")
    print("\nNote: voice_calibration is a small dataset.")
    print("  CIs computed here should be treated as indicative, not definitive.")
    print("  Production voice calibration requires a VoxCeleb-scale study.")
    far_upper_alt = ci95(boot_far_alt)[1]
    print(f"\n  Current anchor FAR CI upper : {ci95(boot_far_cur)[1]:.4f}")
    print(f"  Alt anchor FAR CI upper     : {far_upper_alt:.4f}")
    if far_upper_alt == 0.0:
        print("  RESULT: Alt anchor CI upper = 0.0000 -> safe for this sample (pending scale-up)")
    else:
        print(f"  RESULT: Alt anchor CI upper = {far_upper_alt:.4f} -> evaluate with larger dataset")

if __name__ == "__main__":
    run()
