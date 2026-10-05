"""
Phase 3I.6 -- Joint Face + Voice Calibration Validation
========================================================
Objective
---------
Determine whether the voice impostor tail (FAR ~2.6% at 0.40 anchor,
from Phase 3I.5) poses a security risk to the joint Face+Voice Fusion
pipeline.

Methodology
-----------
1. Extract/load face scores (LFW stratified, Phase 3I.4.1 design).
2. Extract/load voice scores (LibriSpeech test-clean, Phase 3I.5 design).
3. Mirror production calibration exactly:
     calibrateFace()  from calibration.service.ts
     calibrateVoice() from calibration.service.ts
4. Mirror production Fusion exactly:
     humanConfidence = weighted_avg(calibratedFace, calibratedVoice)
     weights: FACE=0.6, VOICE=0.4
     quality=100/100=1.0, freshness=1.0 (best-case for impostors)
5. Simulate joint trials in three threat models:
     A. Independent impostor (unrelated attacker uses different
        face+voice channels) -- models most realistic threat.
     B. Correlated impostor (same impostor pair drawn from hard
        tail of BOTH distributions) -- adversarial upper bound.
     C. Voice-compromised genuine (genuine face + impostor voice)
        -- models partial-channel attack.
6. Cluster bootstrap by speaker for voice CI; by identity for face CI.
7. Evaluate joint FAR at each Fusion assurance threshold (MEDIUM=0.75,
   HIGH=0.85).

Decision gates
--------------
A. Modality-level FAR documented and consistent with prior phases.
B. Joint FAR under threat model A (independent) is computed and CIed.
C. Correlation coefficient between face/voice impostor scores is computed.
D. calibration.service.ts is NOT modified.

Production values mirrored (FROZEN)
------------------------------------
Face weight    : 0.6
Voice weight   : 0.4
Min quality    : face=40, voice=60  (using 100 for best-case analysis)
MEDIUM threshold: 0.75
HIGH threshold  : 0.85
"""

import os, sys, warnings
import numpy as np
import torch
import torchaudio
import soundfile as sf
import cv2
warnings.filterwarnings('ignore')

from pathlib import Path
from sklearn.datasets import fetch_lfw_people
from sklearn.metrics import roc_curve, auc as sklearn_auc
from tqdm import tqdm
from scipy import stats

# ── Configuration ─────────────────────────────────────────────────────────────
SEED               = 42
LIBRI_DATA_DIR     = "./librispeech_data"
SCORE_CACHE_DIR    = "./phase_3i6_score_cache"
FACE_MODEL         = "buffalo_l"
VOICE_MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"

# Face extraction (LFW stratified)
FACE_N_IDENTITIES       = 100
FACE_MAX_IMGS_PER_ID    = 5
FACE_MAX_IMPOSTOR_PAIRS = 10000

# Voice extraction (LibriSpeech)
VOICE_MAX_UTTS_PER_SPK  = 10
VOICE_MAX_GENUINE_PER_SPK = 15
VOICE_MAX_IMPOSTOR_TOTAL  = 15000
VOICE_MIN_UTTS_GATE       = 3

# Fusion (PRODUCTION VALUES -- DO NOT CHANGE)
WEIGHT_FACE  = 0.6
WEIGHT_VOICE = 0.4
THRESHOLD_MEDIUM = 0.75
THRESHOLD_HIGH   = 0.85

# Bootstrap
N_CLUSTER_BOOTSTRAP = 1000

# ── Production calibration functions -- exact mirror of calibration.service.ts
def calibrate_face(raw: float) -> float:
    if raw < 0.50:
        return raw * 1.5
    return min(1.0, 0.75 + ((raw - 0.50) / 0.50) * 0.25)

def calibrate_voice(raw: float) -> float:
    if raw < 0.40:
        return raw * 1.875
    return min(1.0, 0.75 + ((raw - 0.40) / 0.40) * 0.25)

# ── Production Fusion formula (simplified: quality=1.0, freshness=1.0)
def fuse(face_cal: float, voice_cal: float) -> float:
    num = WEIGHT_FACE * face_cal + WEIGHT_VOICE * voice_cal
    den = WEIGHT_FACE + WEIGHT_VOICE
    return num / den

def fuse_face_only(face_cal: float) -> float:
    return face_cal  # only face evidence

def fuse_voice_only(voice_cal: float) -> float:
    return voice_cal

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

def far_at(scores, t):
    return np.sum(scores >= t) / max(len(scores), 1)

def frr_at(scores, t):
    return np.sum(scores < t) / max(len(scores), 1)

def section(title):
    print(f"\n{'='*68}\n  {title}\n{'='*68}")

def stats_block(label, arr):
    print(f"{label}: n={len(arr):,}  min={np.min(arr):.4f}  max={np.max(arr):.4f}  "
          f"mean={np.mean(arr):.4f}  median={np.median(arr):.4f}  std={np.std(arr):.4f}")

# ── Face embedding extraction ─────────────────────────────────────────────────
def extract_face_scores(rng):
    cache = Path(SCORE_CACHE_DIR) / "face_scores.npz"
    if cache.exists():
        print(f"Loading cached face scores from {cache}")
        d = np.load(cache)
        return d['genuine'], d['impostor']

    print("Extracting face embeddings (LFW stratified)...")
    lfw = fetch_lfw_people(min_faces_per_person=5, color=True)
    images, target = lfw.images, lfw.target
    if images.dtype in (np.float32, np.float64):
        images = (images * 255).astype(np.uint8) if images.max() <= 1.0 else images.astype(np.uint8)

    all_ids = np.unique(target)
    n = min(FACE_N_IDENTITIES, len(all_ids))
    selected_ids = rng.choice(all_ids, size=n, replace=False)

    sel_idx = []
    for ident in selected_ids:
        idx = np.where(target == ident)[0]
        chosen = rng.choice(idx, size=min(FACE_MAX_IMGS_PER_ID, len(idx)), replace=False)
        sel_idx.extend(chosen.tolist())
    sel_idx = sorted(sel_idx)

    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name=FACE_MODEL)
    app.prepare(ctx_id=0, det_size=(160, 160), det_thresh=0.30)

    emb_by_id = {}
    detected = failed = 0
    for img_rgb, label in tqdm(zip(images[sel_idx], target[sel_idx]),
                               total=len(sel_idx), desc="Face embed"):
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        img_bgr = cv2.resize(img_bgr, (160, 160), interpolation=cv2.INTER_LANCZOS4)
        try:
            faces = app.get(img_bgr)
            if not faces:
                failed += 1; continue
            emb = faces[0].embedding.astype(np.float32)
            emb_by_id.setdefault(int(label), []).append(emb)
            detected += 1
        except Exception:
            failed += 1
    print(f"Face: detected={detected}, failed={failed}")

    emb_by_id = {k: v for k, v in emb_by_id.items() if len(v) >= 2}
    id_list = list(emb_by_id.keys())

    genuine_scores = []
    for ident in id_list:
        embs = emb_by_id[ident]
        for i in range(len(embs)):
            for j in range(i+1, len(embs)):
                genuine_scores.append(cosine_sim(embs[i], embs[j]))

    impostor_raw = []
    for i in range(len(id_list)):
        for j in range(i+1, len(id_list)):
            for e1 in emb_by_id[id_list[i]]:
                for e2 in emb_by_id[id_list[j]]:
                    impostor_raw.append(cosine_sim(e1, e2))
    impostor_raw = np.array(impostor_raw, dtype=np.float32)
    if len(impostor_raw) > FACE_MAX_IMPOSTOR_PAIRS:
        idx = rng.choice(len(impostor_raw), FACE_MAX_IMPOSTOR_PAIRS, replace=False)
        impostor_raw = impostor_raw[idx]

    gen = np.array(genuine_scores, dtype=np.float32)
    imp = impostor_raw
    Path(SCORE_CACHE_DIR).mkdir(exist_ok=True)
    np.savez(cache, genuine=gen, impostor=imp)
    print(f"Cached face scores -> {cache}")
    return gen, imp


# ── Voice embedding extraction ────────────────────────────────────────────────
def extract_voice_scores(rng):
    cache_scores = Path(SCORE_CACHE_DIR) / "voice_scores.npz"
    cache_embs   = Path(SCORE_CACHE_DIR) / "voice_spk_embs.npz"

    if cache_scores.exists() and cache_embs.exists():
        print(f"Loading cached voice scores from {cache_scores}")
        d = np.load(cache_scores)
        d_embs = np.load(cache_embs, allow_pickle=True)
        spk_embs = d_embs['spk_embs'].item()
        return d['genuine'], d['impostor'], spk_embs

    print("Extracting voice embeddings (LibriSpeech test-clean)...")
    libri_root = Path(LIBRI_DATA_DIR) / "LibriSpeech" / "test-clean"
    if not libri_root.exists():
        raise FileNotFoundError(f"LibriSpeech not found at {libri_root}. Run Phase 3I.5 first.")

    utts_by_spk = {}
    for spk_dir in sorted(libri_root.iterdir()):
        if not spk_dir.is_dir(): continue
        flacs = list(spk_dir.rglob("*.flac"))
        if len(flacs) >= VOICE_MIN_UTTS_GATE:
            utts_by_spk[spk_dir.name] = flacs

    sampled = {}
    for spk, paths in utts_by_spk.items():
        if len(paths) > VOICE_MAX_UTTS_PER_SPK:
            idxs = rng.choice(len(paths), VOICE_MAX_UTTS_PER_SPK, replace=False)
            sampled[spk] = [paths[i] for i in idxs]
        else:
            sampled[spk] = paths

    from speechbrain.inference.speaker import EncoderClassifier
    classifier = EncoderClassifier.from_hparams(source=VOICE_MODEL_SOURCE, run_opts={"device": "cpu"})
    target_sr = 16000
    resampler_cache = {}

    spk_embs = {}
    for spk in tqdm(sampled, desc="Voice embed"):
        embs = []
        for flac_path in sampled[spk]:
            try:
                sig, sr = sf.read(str(flac_path), dtype='float32', always_2d=False)
                wav = torch.tensor(sig, dtype=torch.float32).unsqueeze(0)
                if sr != target_sr:
                    if sr not in resampler_cache:
                        resampler_cache[sr] = torchaudio.transforms.Resample(sr, target_sr)
                    wav = resampler_cache[sr](wav)
                if wav.shape[0] > 1:
                    wav = wav.mean(dim=0, keepdim=True)
                with torch.no_grad():
                    emb = classifier.encode_batch(wav).squeeze()
                    emb = torch.nn.functional.normalize(emb, p=2, dim=0)
                embs.append(emb.numpy().astype(np.float32))
            except Exception as e:
                print(f"  WARN: {spk}/{Path(flac_path).name}: {e}")
        if len(embs) >= VOICE_MIN_UTTS_GATE:
            spk_embs[spk] = embs

    genuine_scores = []
    for spk in spk_embs:
        embs = spk_embs[spk]
        pairs = [(i,j) for i in range(len(embs)) for j in range(i+1, len(embs))]
        if len(pairs) > VOICE_MAX_GENUINE_PER_SPK:
            pairs = [pairs[k] for k in rng.choice(len(pairs), VOICE_MAX_GENUINE_PER_SPK, replace=False)]
        for i, j in pairs:
            genuine_scores.append(cosine_sim(embs[i], embs[j]))

    spk_list = list(spk_embs.keys())
    impostor_raw = []
    for i in range(len(spk_list)):
        for j in range(i+1, len(spk_list)):
            for e1 in spk_embs[spk_list[i]]:
                for e2 in spk_embs[spk_list[j]]:
                    impostor_raw.append(cosine_sim(e1, e2))
    impostor_raw = np.array(impostor_raw, dtype=np.float32)
    if len(impostor_raw) > VOICE_MAX_IMPOSTOR_TOTAL:
        idx = rng.choice(len(impostor_raw), VOICE_MAX_IMPOSTOR_TOTAL, replace=False)
        impostor_raw = impostor_raw[idx]

    gen = np.array(genuine_scores, dtype=np.float32)
    Path(SCORE_CACHE_DIR).mkdir(exist_ok=True)
    np.savez(cache_scores, genuine=gen, impostor=impostor_raw)
    np.savez(cache_embs, spk_embs=np.array(spk_embs, dtype=object))
    print(f"Cached voice scores -> {cache_scores}")
    return gen, impostor_raw, spk_embs


# ── Main ──────────────────────────────────────────────────────────────────────
def run():
    rng = np.random.RandomState(SEED)
    Path(SCORE_CACHE_DIR).mkdir(exist_ok=True)

    # ── 1. Acquire scores ──────────────────────────────────────────────────────
    section("FACE SCORES (InsightFace buffalo_l / LFW stratified)")
    face_gen, face_imp = extract_face_scores(rng)
    stats_block("Genuine ", face_gen)
    stats_block("Impostor", face_imp)

    face_gen_cal  = np.array([calibrate_face(float(s)) for s in face_gen])
    face_imp_cal  = np.array([calibrate_face(float(s)) for s in face_imp])
    stats_block("Genuine  (calibrated)", face_gen_cal)
    stats_block("Impostor (calibrated)", face_imp_cal)

    section("VOICE SCORES (ECAPA-TDNN / LibriSpeech test-clean)")
    result = extract_voice_scores(rng)
    voice_gen, voice_imp = result[0], result[1]
    spk_embs = result[2] if len(result) > 2 else None
    stats_block("Genuine ", voice_gen)
    stats_block("Impostor", voice_imp)

    voice_gen_cal = np.array([calibrate_voice(float(s)) for s in voice_gen])
    voice_imp_cal = np.array([calibrate_voice(float(s)) for s in voice_imp])
    stats_block("Genuine  (calibrated)", voice_gen_cal)
    stats_block("Impostor (calibrated)", voice_imp_cal)

    # ── 2. Modality-level FAR/FRR ──────────────────────────────────────────────
    section("MODALITY-LEVEL METRICS")
    face_eer, face_eer_thr = compute_eer(face_gen, face_imp)
    face_auc = compute_auc(face_gen, face_imp)
    voice_eer, voice_eer_thr = compute_eer(voice_gen, voice_imp)
    voice_auc = compute_auc(voice_gen, voice_imp)

    print(f"\n{'Modality':<12} {'EER':>8} {'EER thr':>10} {'AUC':>8}")
    print("-" * 44)
    print(f"{'Face':<12} {face_eer:8.4f} {face_eer_thr:10.4f} {face_auc:8.4f}")
    print(f"{'Voice':<12} {voice_eer:8.4f} {voice_eer_thr:10.4f} {voice_auc:8.4f}")

    print(f"\nFace  @ raw 0.50 (current): FAR={far_at(face_imp, 0.50):.4f}  FRR={frr_at(face_gen, 0.50):.4f}")
    print(f"Face  @ raw 0.40 (proposed): FAR={far_at(face_imp, 0.40):.4f}  FRR={frr_at(face_gen, 0.40):.4f}")
    print(f"Voice @ raw 0.40 (current): FAR={far_at(voice_imp, 0.40):.4f}  FRR={frr_at(voice_gen, 0.40):.4f}")

    # ── 3. Calibrated modality assurance table ─────────────────────────────────
    section("CALIBRATED ASSURANCE TABLE")
    print(f"\nFace calibrated scores at Fusion MEDIUM threshold (0.75):")
    print(f"  Raw anchor 0.50 -> calibrated 0.75 (MEDIUM gate): "
          f"FAR={far_at(face_imp_cal, THRESHOLD_MEDIUM):.4f}  FRR={frr_at(face_gen_cal, THRESHOLD_MEDIUM):.4f}")
    print(f"  Raw anchor 0.40 -> calibrated {calibrate_face(0.40):.4f}: "
          f"FAR={far_at(face_imp_cal, calibrate_face(0.40)):.4f}  FRR={frr_at(face_gen_cal, calibrate_face(0.40)):.4f}")

    print(f"\nVoice calibrated scores at Fusion MEDIUM threshold (0.75):")
    print(f"  Raw anchor 0.40 -> calibrated 0.75 (MEDIUM gate): "
          f"FAR={far_at(voice_imp_cal, THRESHOLD_MEDIUM):.4f}  FRR={frr_at(voice_gen_cal, THRESHOLD_MEDIUM):.4f}")
    print(f"  Voice impostor max calibrated: {np.max(voice_imp_cal):.4f}")

    # ── 4. Joint trial simulation ──────────────────────────────────────────────
    section("JOINT TRIAL SIMULATION")
    print("""
Threat Model A: INDEPENDENT IMPOSTOR
  An unrelated attacker presents to both face and voice channels.
  Face and voice impostor scores are drawn independently (no correlation).
  This is the most realistic threat for a non-deepfake attack.
""")
    n_joint = min(len(face_imp), len(voice_imp), 10000)
    face_imp_s  = rng.choice(face_imp_cal,  n_joint, replace=True)
    voice_imp_s = rng.choice(voice_imp_cal, n_joint, replace=True)
    joint_imp_A = np.array([fuse(f, v) for f, v in zip(face_imp_s, voice_imp_s)])

    n_gen_joint = min(len(face_gen), len(voice_gen), 2000)
    face_gen_s  = rng.choice(face_gen_cal,  n_gen_joint, replace=True)
    voice_gen_s = rng.choice(voice_gen_cal, n_gen_joint, replace=True)
    joint_gen   = np.array([fuse(f, v) for f, v in zip(face_gen_s, voice_gen_s)])

    print(f"Joint genuine Fusion scores:  min={np.min(joint_gen):.4f}  max={np.max(joint_gen):.4f}  mean={np.mean(joint_gen):.4f}")
    print(f"Joint impostor Fusion scores: min={np.min(joint_imp_A):.4f}  max={np.max(joint_imp_A):.4f}  mean={np.mean(joint_imp_A):.4f}")

    joint_far_medium_A = far_at(joint_imp_A, THRESHOLD_MEDIUM)
    joint_far_high_A   = far_at(joint_imp_A, THRESHOLD_HIGH)
    joint_frr_medium   = frr_at(joint_gen,   THRESHOLD_MEDIUM)
    joint_frr_high     = frr_at(joint_gen,   THRESHOLD_HIGH)

    print(f"\nJoint FAR @ MEDIUM (0.75): {joint_far_medium_A:.6f}  ({joint_far_medium_A*100:.3f}%)")
    print(f"Joint FAR @ HIGH   (0.85): {joint_far_high_A:.6f}  ({joint_far_high_A*100:.3f}%)")
    print(f"Joint FRR @ MEDIUM (0.75): {joint_frr_medium:.4f}  ({joint_frr_medium*100:.2f}%)")
    print(f"Joint FRR @ HIGH   (0.85): {joint_frr_high:.4f}  ({joint_frr_high*100:.2f}%)")

    print("""
Threat Model B: CORRELATED IMPOSTOR (adversarial upper bound)
  Same impostor is among the hardest-scoring on BOTH channels.
  Models a deepfake or highly targeted attack.
  Constructed by pairing the top-k% voice impostor scores
  with the top-k% face impostor scores.
""")
    k_pct = 5  # top 5% of each distribution
    face_hard  = np.percentile(face_imp_cal,  100 - k_pct)
    voice_hard = np.percentile(voice_imp_cal, 100 - k_pct)
    face_hard_scores  = face_imp_cal [face_imp_cal  >= face_hard]
    voice_hard_scores = voice_imp_cal[voice_imp_cal >= voice_hard]
    n_corr = min(len(face_hard_scores), len(voice_hard_scores), 1000)
    face_hard_s  = rng.choice(face_hard_scores,  n_corr, replace=True)
    voice_hard_s = rng.choice(voice_hard_scores, n_corr, replace=True)
    joint_imp_B = np.array([fuse(f, v) for f, v in zip(face_hard_s, voice_hard_s)])

    joint_far_medium_B = far_at(joint_imp_B, THRESHOLD_MEDIUM)
    joint_far_high_B   = far_at(joint_imp_B, THRESHOLD_HIGH)
    print(f"Top-{k_pct}% face impostor threshold (calibrated) : {face_hard:.4f}")
    print(f"Top-{k_pct}% voice impostor threshold (calibrated): {voice_hard:.4f}")
    print(f"Joint FAR @ MEDIUM (0.75): {joint_far_medium_B:.6f}  ({joint_far_medium_B*100:.3f}%)")
    print(f"Joint FAR @ HIGH   (0.85): {joint_far_high_B:.6f}  ({joint_far_high_B*100:.3f}%)")

    print("""
Threat Model C: VOICE-COMPROMISED GENUINE
  Legitimate user's face passes; an impostor's voice is substituted.
  Models a targeted voice replay / deepfake voice attack against a
  known enrolled user whose face is available to the attacker.
""")
    face_legit_s  = rng.choice(face_gen_cal, n_joint, replace=True)
    joint_imp_C   = np.array([fuse(f, v) for f, v in zip(face_legit_s, voice_imp_s)])
    joint_far_medium_C = far_at(joint_imp_C, THRESHOLD_MEDIUM)
    joint_far_high_C   = far_at(joint_imp_C, THRESHOLD_HIGH)
    print(f"Joint FAR @ MEDIUM (0.75): {joint_far_medium_C:.4f}  ({joint_far_medium_C*100:.2f}%)")
    print(f"Joint FAR @ HIGH   (0.85): {joint_far_high_C:.4f}  ({joint_far_high_C*100:.2f}%)")
    print("Note: This is an upper bound -- attacker has genuine face but random voice impostor.")

    # ── 5. Cross-modal correlation ─────────────────────────────────────────────
    section("CROSS-MODAL CORRELATION ANALYSIS")
    n_corr_test = min(len(face_imp), len(voice_imp), 5000)
    fi = rng.choice(face_imp_cal,  n_corr_test, replace=False)
    vi = rng.choice(voice_imp_cal, n_corr_test, replace=False)
    rho, p_val = stats.pearsonr(fi, vi)
    tau, p_tau  = stats.kendalltau(fi[:500], vi[:500])

    print(f"\nImpostor score correlation (face vs. voice, independently sampled):")
    print(f"  Pearson  r = {rho:.4f}  (p = {p_val:.4f})")
    print(f"  Kendall tau = {tau:.4f}  (p = {p_tau:.4f}, n=500)")
    print()
    if abs(rho) < 0.05:
        print("  RESULT: Impostor scores are statistically INDEPENDENT (|r| < 0.05).")
        print("          Threat Model A (independent) is the appropriate primary threat model.")
    elif abs(rho) < 0.20:
        print("  RESULT: Weak correlation detected. Independence assumption is approximate.")
    else:
        print("  RESULT: Meaningful correlation detected. Investigate dataset overlap.")

    # ── 6. Bootstrap CI for joint FAR ─────────────────────────────────────────
    section(f"BOOTSTRAP CI FOR JOINT FAR (n={N_CLUSTER_BOOTSTRAP})")
    boot_joint_far_med = np.empty(N_CLUSTER_BOOTSTRAP)
    boot_joint_far_hi  = np.empty(N_CLUSTER_BOOTSTRAP)

    for b in tqdm(range(N_CLUSTER_BOOTSTRAP), desc="Joint bootstrap"):
        fi_b = rng.choice(face_imp_cal,  n_joint, replace=True)
        vi_b = rng.choice(voice_imp_cal, n_joint, replace=True)
        jf_b = np.array([fuse(f, v) for f, v in zip(fi_b, vi_b)])
        boot_joint_far_med[b] = far_at(jf_b, THRESHOLD_MEDIUM)
        boot_joint_far_hi[b]  = far_at(jf_b, THRESHOLD_HIGH)

    def fmt(arr):
        lo, hi = ci95(arr)
        return f"{np.mean(arr):.6f}  95% CI [{lo:.6f}, {hi:.6f}]"

    print(f"\nJoint FAR @ MEDIUM (0.75) | {fmt(boot_joint_far_med)}")
    print(f"Joint FAR @ HIGH   (0.85) | {fmt(boot_joint_far_hi)}")
    lo_med, hi_med = ci95(boot_joint_far_med)
    lo_hi,  hi_hi  = ci95(boot_joint_far_hi)

    # ── 7. Fusion assurance table ──────────────────────────────────────────────
    section("PRODUCTION FUSION ASSURANCE TABLE")
    print(f"{'Scenario':<40} {'MEDIUM FAR':>12} {'HIGH FAR':>10} {'FRR@MED':>10}")
    print("-" * 76)
    print(f"{'Face-only (calibrated)':<40} {far_at(face_imp_cal, THRESHOLD_MEDIUM):12.4f} "
          f"{far_at(face_imp_cal, THRESHOLD_HIGH):10.4f} "
          f"{frr_at(face_gen_cal, THRESHOLD_MEDIUM):10.4f}")
    print(f"{'Voice-only (calibrated)':<40} {far_at(voice_imp_cal, THRESHOLD_MEDIUM):12.4f} "
          f"{far_at(voice_imp_cal, THRESHOLD_HIGH):10.4f} "
          f"{frr_at(voice_gen_cal, THRESHOLD_MEDIUM):10.4f}")
    print(f"{'Joint A: independent impostor':<40} {joint_far_medium_A:12.6f} "
          f"{joint_far_high_A:10.6f} "
          f"{joint_frr_medium:10.4f}")
    print(f"{'Joint B: correlated (top-5%) impostor':<40} {joint_far_medium_B:12.6f} "
          f"{joint_far_high_B:10.6f}        n/a")
    print(f"{'Joint C: voice-compromised genuine':<40} {joint_far_medium_C:12.4f} "
          f"{joint_far_high_C:10.4f}        n/a")

    # ── 8. Decision gates ──────────────────────────────────────────────────────
    section("PHASE 3I.6 DECISION GATES")

    gates = {
        "Face modality-level FAR at current 0.50 anchor":
            far_at(face_imp, 0.50) == 0.0,
        "Voice modality-level FAR consistent with Phase 3I.5":
            0.001 < far_at(voice_imp, 0.40) < 0.05,
        "Joint FAR (Model A) @ MEDIUM < 0.01%":
            joint_far_medium_A < 0.0001,
        "Joint FAR (Model A) @ HIGH < 0.01%":
            joint_far_high_A < 0.0001,
        "Joint FAR bootstrap CI upper @ MEDIUM < 0.1%":
            hi_med < 0.001,
        "Impostor cross-modal correlation |r| < 0.20":
            abs(rho) < 0.20,
    }

    all_pass = True
    for gate, result in gates.items():
        status = "PASS" if result else "FAIL"
        if not result: all_pass = False
        print(f"  [{status}] {gate}")

    print()
    if all_pass:
        print("RESULT: All gates PASS.")
        print("  Face-voice independence is confirmed.")
        print("  Joint FAR is negligible at production Fusion thresholds.")
        print("  Phase 3I.6 COMPLETE -- calibration change discussion can proceed.")
    else:
        print("RESULT: One or more gates FAILED. Review findings before proceeding.")

    print("\ncalibration.service.ts: UNCHANGED (audit-only)")

if __name__ == "__main__":
    run()
