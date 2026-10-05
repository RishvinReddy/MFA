"""
Phase 3I.5 -- Production-Scale ECAPA-TDNN Voice Calibration Study
==================================================================
Dataset
-------
LibriSpeech test-clean  (~40 speakers, ~2,600 utterances, ~346 MB)
Downloaded automatically via torchaudio.datasets.LIBRISPEECH.
Data is stored in ./librispeech_data/ (relative to script location).

Methodology
-----------
1. Extract ECAPA-TDNN embeddings for all utterances.
2. Build genuine pairs (same speaker, different utterance) and
   impostor pairs (different speakers).
3. Point estimates: EER, AUC, FAR/FRR table.
4. Pair bootstrap: resample PAIRS with replacement (baseline, consistent
   with Phase 3I.4.1).
5. Cluster bootstrap (KEY IMPROVEMENT): resample SPEAKERS with replacement,
   then derive all pairs from selected speakers. This respects within-speaker
   correlation and gives more conservative (honest) CIs.
6. Evaluate calibrateVoice() transformation output at each anchor.

This script is AUDIT-ONLY. It does NOT modify calibration.service.ts.

Calibration anchors evaluated
------------------------------
ANCHOR_CURRENT = 0.40   (current calibration.service.ts)
ANCHOR_CANDIDATES = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55]

Decision gate
-------------
An anchor is considered safe if:
  cluster-bootstrap 95% CI upper bound for FAR = 0.0000

Runtime estimate (CPU): ~30-60 min depending on system.
"""

import os
import sys
import numpy as np
import torch
import torchaudio
import soundfile as sf
import warnings
warnings.filterwarnings('ignore')

from pathlib import Path
from sklearn.metrics import roc_curve, auc as sklearn_auc
from tqdm import tqdm

# ── Configuration ─────────────────────────────────────────────────────────────
SEED               = 42
DATA_DIR           = "./librispeech_data"
MODEL_SOURCE       = "speechbrain/spkrec-ecapa-voxceleb"
N_PAIR_BOOTSTRAP   = 1000   # pair-level bootstrap iterations
N_CLUSTER_BOOTSTRAP = 1000  # speaker-level (cluster) bootstrap iterations
MAX_UTTS_PER_SPK   = 10     # cap per speaker to limit runtime
MAX_GENUINE_PER_SPK = 15    # max genuine pairs per speaker (C(k,2) cap)
MAX_IMPOSTOR_TOTAL  = 15000 # cap on total impostor pairs
ANCHOR_CURRENT      = 0.40
ANCHOR_CANDIDATES   = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55]
MIN_SPEAKERS_GATE   = 30    # minimum speakers needed to proceed to 3I.6
MIN_UTTS_GATE       = 3     # minimum utterances per speaker

# ── Helpers ───────────────────────────────────────────────────────────────────
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
    clean = arr[~np.isnan(arr)]
    if len(clean) == 0:
        return np.nan, np.nan
    return np.percentile(clean, 2.5), np.percentile(clean, 97.5)

def far_at(imp, t):
    return np.sum(imp >= t) / max(len(imp), 1)

def frr_at(gen, t):
    return np.sum(gen < t) / max(len(gen), 1)

def calibrate_voice(raw):
    """Mirrors calibration.service.ts calibrateVoice() exactly."""
    if raw < 0.40:
        return raw * 1.875  # [0, 0.40) -> [0, 0.75)
    return min(1.0, 0.75 + ((raw - 0.40) / 0.40) * 0.25)

def section(title):
    print(f"\n{'='*64}\n  {title}\n{'='*64}")

def build_pairs_from_speaker_embs(spk_embs, rng, max_genuine_per_spk, max_impostor_total):
    """
    Build genuine and impostor pairs from a dict {spk_id: [emb, ...]}.
    Returns (genuine_scores, impostor_scores, genuine_meta, impostor_meta).
    """
    spk_list = list(spk_embs.keys())
    genuine_scores = []
    for spk in spk_list:
        embs = spk_embs[spk]
        pairs = [(i, j) for i in range(len(embs)) for j in range(i+1, len(embs))]
        if len(pairs) > max_genuine_per_spk:
            sel = rng.choice(len(pairs), max_genuine_per_spk, replace=False)
            pairs = [pairs[k] for k in sel]
        for i, j in pairs:
            genuine_scores.append(cosine_sim(embs[i], embs[j]))

    impostor_scores = []
    for i in range(len(spk_list)):
        for j in range(i+1, len(spk_list)):
            for e1 in spk_embs[spk_list[i]]:
                for e2 in spk_embs[spk_list[j]]:
                    impostor_scores.append(cosine_sim(e1, e2))

    impostor_scores = np.array(impostor_scores, dtype=np.float32)
    if len(impostor_scores) > max_impostor_total:
        idx = rng.choice(len(impostor_scores), max_impostor_total, replace=False)
        impostor_scores = impostor_scores[idx]

    return np.array(genuine_scores, dtype=np.float32), impostor_scores

# ── Main ──────────────────────────────────────────────────────────────────────
def run():
    rng = np.random.RandomState(SEED)

    # 1. Load LibriSpeech test-clean — walk filesystem directly with soundfile
    #    (avoids torchaudio.datasets which requires torchcodec on Python 3.13+)
    section("DATASET: LibriSpeech test-clean")
    os.makedirs(DATA_DIR, exist_ok=True)

    # Download tarball if the directory isn't already present
    libri_root = Path(DATA_DIR) / "LibriSpeech" / "test-clean"
    if not libri_root.exists():
        print(f"Downloading LibriSpeech test-clean -> {DATA_DIR}")
        import urllib.request, tarfile
        url = "https://www.openslr.org/resources/12/test-clean.tar.gz"
        tar_path = Path(DATA_DIR) / "test-clean.tar.gz"
        urllib.request.urlretrieve(url, tar_path)
        with tarfile.open(tar_path, "r:gz") as t:
            t.extractall(DATA_DIR)
        tar_path.unlink()
        print("Download complete.")
    else:
        print(f"Using cached LibriSpeech at {libri_root}")

    # Walk speaker directories: test-clean/{spk_id}/{chapter_id}/*.flac
    utts_by_spk = {}  # spk_id (str) -> list of Path
    for spk_dir in sorted(libri_root.iterdir()):
        if not spk_dir.is_dir():
            continue
        spk_id = spk_dir.name
        flacs = list(spk_dir.rglob("*.flac"))
        if flacs:
            utts_by_spk[spk_id] = flacs

    total_utts = sum(len(v) for v in utts_by_spk.values())
    print(f"Total utterances found : {total_utts}")
    print(f"Unique speakers        : {len(utts_by_spk)}")
    for spk in sorted(utts_by_spk):
        print(f"  Speaker {spk}: {len(utts_by_spk[spk])} utterances")

    # Filter and cap
    eligible_spks = {s: u for s, u in utts_by_spk.items() if len(u) >= MIN_UTTS_GATE}
    print(f"\nSpeakers with >= {MIN_UTTS_GATE} utterances: {len(eligible_spks)}")

    if len(eligible_spks) < MIN_SPEAKERS_GATE:
        print(f"WARNING: Only {len(eligible_spks)} speakers meet the minimum gate ({MIN_SPEAKERS_GATE}).")
        print("Phase 3I.5 cannot authorize Phase 3I.6 with this result.")
        print("Continuing analysis for informational purposes...")

    sampled_utts = {}  # spk_id -> list of Path
    for spk, paths in eligible_spks.items():
        if len(paths) > MAX_UTTS_PER_SPK:
            idxs = rng.choice(len(paths), MAX_UTTS_PER_SPK, replace=False)
            sampled_utts[spk] = [paths[i] for i in idxs]
        else:
            sampled_utts[spk] = paths

    total_utts = sum(len(u) for u in sampled_utts.values())
    print(f"Sampled utterances for embedding: {total_utts} from {len(sampled_utts)} speakers")

    # 2. Extract ECAPA-TDNN embeddings
    section("EMBEDDING EXTRACTION")
    print(f"Loading ECAPA-TDNN from {MODEL_SOURCE}...")
    from speechbrain.inference.speaker import EncoderClassifier
    classifier = EncoderClassifier.from_hparams(source=MODEL_SOURCE, run_opts={"device": "cpu"})

    spk_embs = {}
    target_sr = 16000
    resampler_cache = {}

    for spk in tqdm(sampled_utts, desc="Speakers"):
        embs = []
        for flac_path in sampled_utts[spk]:
            try:
                # Load FLAC directly with soundfile (no torchcodec required)
                signal_np, sr = sf.read(str(flac_path), dtype='float32', always_2d=False)
                waveform = torch.tensor(signal_np, dtype=torch.float32).unsqueeze(0)
                if sr != target_sr:
                    if sr not in resampler_cache:
                        resampler_cache[sr] = torchaudio.transforms.Resample(sr, target_sr)
                    waveform = resampler_cache[sr](waveform)
                if waveform.shape[0] > 1:
                    waveform = waveform.mean(dim=0, keepdim=True)
                with torch.no_grad():
                    emb = classifier.encode_batch(waveform).squeeze()
                    emb = torch.nn.functional.normalize(emb, p=2, dim=0)
                embs.append(emb.numpy().astype(np.float32))
            except Exception as e:
                print(f"  WARN: {spk} / {flac_path.name}: {e}")
        if len(embs) >= MIN_UTTS_GATE:
            spk_embs[spk] = embs

    n_spk = len(spk_embs)
    n_embs = sum(len(e) for e in spk_embs.values())
    print(f"Successfully embedded: {n_embs} utterances from {n_spk} speakers")

    # 3. Build pairs
    section("PAIR CONSTRUCTION")
    genuine_scores, impostor_scores = build_pairs_from_speaker_embs(
        spk_embs, rng, MAX_GENUINE_PER_SPK, MAX_IMPOSTOR_TOTAL
    )
    print(f"Genuine pairs : {len(genuine_scores)}")
    print(f"Impostor pairs: {len(impostor_scores)}")

    if len(genuine_scores) == 0 or len(impostor_scores) == 0:
        print("ERROR: Could not build pairs.")
        return

    # 4. Point estimates
    section("POINT ESTIMATES — RAW SCORES")
    def stats(label, arr):
        print(f"{label}: count={len(arr)}  min={np.min(arr):.4f}  max={np.max(arr):.4f}  "
              f"mean={np.mean(arr):.4f}  median={np.median(arr):.4f}  std={np.std(arr):.4f}")
    stats("Genuine ", genuine_scores)
    stats("Impostor", impostor_scores)
    gap = np.min(genuine_scores) - np.max(impostor_scores)
    eer_pt, eer_thr = compute_eer(genuine_scores, impostor_scores)
    auc_pt = compute_auc(genuine_scores, impostor_scores)
    print(f"Score gap (genuine_min - impostor_max): {gap:+.4f}")
    print(f"EER : {eer_pt:.4f}  (at threshold {eer_thr:.4f})")
    print(f"AUC : {auc_pt:.4f}")

    # 5. FAR/FRR table
    section("FAR / FRR TABLE")
    print(f"{'Threshold':>9} | {'FAR':>8} | {'FRR':>8} | {'TAR':>8} | {'TRR':>8} | CalibOut")
    print("-" * 70)
    for t in np.arange(0.10, 0.90, 0.05):
        f = far_at(impostor_scores, t)
        r = frr_at(genuine_scores, t)
        cal = calibrate_voice(float(t))
        marker = ""
        for ac in ANCHOR_CANDIDATES:
            if abs(t - ac) < 0.01:
                marker = f" <- {'current' if abs(ac - ANCHOR_CURRENT) < 0.01 else str(ac)}"
                break
        print(f"{t:9.2f} | {f:8.4f} | {r:8.4f} | {1-r:8.4f} | {1-f:8.4f} | {cal:.4f}{marker}")

    # 6. calibrateVoice() transformation evaluation
    section("calibrateVoice() TRANSFORMATION AUDIT")
    calib_genuine  = np.array([calibrate_voice(float(s)) for s in genuine_scores])
    calib_impostor = np.array([calibrate_voice(float(s)) for s in impostor_scores])
    stats("Genuine  (calibrated)", calib_genuine)
    stats("Impostor (calibrated)", calib_impostor)
    calib_eer_pt, calib_eer_thr = compute_eer(calib_genuine, calib_impostor)
    calib_auc_pt = compute_auc(calib_genuine, calib_impostor)
    print(f"Calibrated EER : {calib_eer_pt:.4f}  (at calibrated score {calib_eer_thr:.4f})")
    print(f"Calibrated AUC : {calib_auc_pt:.4f}")
    print()
    print("Assurance contribution at candidate anchors after calibration:")
    for ac in ANCHOR_CANDIDATES:
        cal_ac = calibrate_voice(ac)
        f = far_at(calib_impostor, cal_ac)
        r = frr_at(calib_genuine, cal_ac)
        marker = " <- current" if abs(ac - ANCHOR_CURRENT) < 0.01 else ""
        print(f"  Raw anchor {ac:.2f} -> calibrated {cal_ac:.4f}: FAR={f:.4f}  FRR={r:.4f}{marker}")

    # 7. Pair bootstrap
    section(f"PAIR BOOTSTRAP CI (n={N_PAIR_BOOTSTRAP})")
    pb_eer = np.empty(N_PAIR_BOOTSTRAP)
    pb_auc = np.empty(N_PAIR_BOOTSTRAP)
    pb_far = {ac: np.empty(N_PAIR_BOOTSTRAP) for ac in ANCHOR_CANDIDATES}
    pb_frr = {ac: np.empty(N_PAIR_BOOTSTRAP) for ac in ANCHOR_CANDIDATES}

    for b in tqdm(range(N_PAIR_BOOTSTRAP), desc="Pair bootstrap"):
        g_b   = genuine_scores [rng.choice(len(genuine_scores),  len(genuine_scores),  replace=True)]
        imp_b = impostor_scores[rng.choice(len(impostor_scores), len(impostor_scores), replace=True)]
        pb_eer[b], _ = compute_eer(g_b, imp_b)
        pb_auc[b]    = compute_auc(g_b, imp_b)
        for ac in ANCHOR_CANDIDATES:
            pb_far[ac][b] = far_at(imp_b, ac)
            pb_frr[ac][b] = frr_at(g_b,   ac)

    def fmt(arr):
        lo, hi = ci95(arr)
        return f"{np.mean(arr[~np.isnan(arr)]):.4f}  95% CI [{lo:.4f}, {hi:.4f}]"

    print(f"\nEER | {fmt(pb_eer)}")
    print(f"AUC | {fmt(pb_auc)}")
    for ac in ANCHOR_CANDIDATES:
        cur = " (current)" if abs(ac - ANCHOR_CURRENT) < 0.01 else ""
        print(f"FAR @ {ac:.2f}{cur} | {fmt(pb_far[ac])}")
        print(f"FRR @ {ac:.2f}{cur} | {fmt(pb_frr[ac])}")

    # 8. Cluster (speaker) bootstrap — KEY METHODOLOGICAL IMPROVEMENT
    section(f"CLUSTER BOOTSTRAP BY SPEAKER (n={N_CLUSTER_BOOTSTRAP})")
    print("Resampling SPEAKERS with replacement, then deriving all pairs from selected speakers.")
    print("This respects within-speaker correlation — gives more conservative (honest) CIs.\n")

    spk_keys = list(spk_embs.keys())
    n_spk = len(spk_keys)

    cb_eer = np.full(N_CLUSTER_BOOTSTRAP, np.nan)
    cb_auc = np.full(N_CLUSTER_BOOTSTRAP, np.nan)
    cb_far = {ac: np.full(N_CLUSTER_BOOTSTRAP, np.nan) for ac in ANCHOR_CANDIDATES}
    cb_frr = {ac: np.full(N_CLUSTER_BOOTSTRAP, np.nan) for ac in ANCHOR_CANDIDATES}

    for b in tqdm(range(N_CLUSTER_BOOTSTRAP), desc="Cluster bootstrap"):
        sel_spk_idx = rng.choice(n_spk, n_spk, replace=True)
        sel_spks = [spk_keys[i] for i in sel_spk_idx]
        # Build cluster-resampled embedding dict (with duplicated speaker IDs renamed)
        boot_embs = {}
        for rank, spk in enumerate(sel_spks):
            boot_embs[f"spk_{rank:04d}"] = spk_embs[spk]

        if len(boot_embs) < 2:
            continue

        g_b, imp_b = build_pairs_from_speaker_embs(
            boot_embs, rng, MAX_GENUINE_PER_SPK, MAX_IMPOSTOR_TOTAL
        )
        if len(g_b) < 2 or len(imp_b) < 2:
            continue

        cb_eer[b], _ = compute_eer(g_b, imp_b)
        cb_auc[b]    = compute_auc(g_b, imp_b)
        for ac in ANCHOR_CANDIDATES:
            cb_far[ac][b] = far_at(imp_b, ac)
            cb_frr[ac][b] = frr_at(g_b,   ac)

    print(f"\nEER | {fmt(cb_eer)}")
    print(f"AUC | {fmt(cb_auc)}")
    for ac in ANCHOR_CANDIDATES:
        cur = " (current)" if abs(ac - ANCHOR_CURRENT) < 0.01 else ""
        print(f"FAR @ {ac:.2f}{cur} | {fmt(cb_far[ac])}")
        print(f"FRR @ {ac:.2f}{cur} | {fmt(cb_frr[ac])}")

    # 9. Decision gate
    section("PHASE 3I.5 DECISION GATE")
    print(f"Speakers embedded:           {len(spk_embs)}")
    print(f"Gate: >= {MIN_SPEAKERS_GATE} speakers with >= {MIN_UTTS_GATE} utterances")
    gate_spk = len(spk_embs) >= MIN_SPEAKERS_GATE
    print(f"Speaker count gate:  {'PASS' if gate_spk else 'FAIL'}")

    print("\nAnchor safety check (cluster bootstrap 95% CI upper bound for FAR):")
    any_safe = False
    for ac in ANCHOR_CANDIDATES:
        _, hi = ci95(cb_far[ac])
        safe = hi == 0.0
        any_safe = any_safe or safe
        cur = " (current)" if abs(ac - ANCHOR_CURRENT) < 0.01 else ""
        print(f"  Anchor {ac:.2f}{cur}: cluster CI upper = {hi:.4f}  -> {'SAFE' if safe else 'NOT SAFE'}")

    print()
    if gate_spk and any_safe:
        print("RESULT: Phase 3I.5 COMPLETE — at least one anchor is statistically safe.")
        print("        Proceed to Phase 3I.6 (Joint Face + Voice Calibration Validation).")
    elif not gate_spk:
        print("RESULT: Speaker count gate FAILED — Phase 3I.6 NOT yet authorized.")
    else:
        print("RESULT: No anchor achieves cluster CI upper FAR = 0.0000.")
        print("        Phase 3I.6 NOT yet authorized.")
        print("        Action: investigate impostor score distribution and dataset quality.")

    print("\nAUDIT-ONLY. calibration.service.ts is NOT modified.")

if __name__ == "__main__":
    run()
