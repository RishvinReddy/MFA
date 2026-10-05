"""
Phase 3I.6.1 -- Joint Face + Voice Calibration Validation (Corrected Methodology)
================================================================================
Objective
---------
Determine whether the voice impostor tail poses a security risk to the joint
Face+Voice Fusion pipeline, using simulation models based on empirical marginal
distributions.

Methodology Corrections (vs 3I.6)
---------------------------------
1. Removed joint genuine (FRR) claims, as no paired face+voice dataset exists.
2. Removed cross-modal correlation claims, as random independent sampling
   creates artificial independence.
3. Framed Threat Model A strictly as a "marginal-distribution independence simulation".
4. Framed Threat Model B strictly as an "adversarial stress test".
5. Retained exact production calibration & Fusion mirroring.

Methodology
-----------
1. Load face scores (LFW stratified, from cache).
2. Load voice scores (LibriSpeech test-clean, from cache).
3. Mirror production calibration exactly.
4. Mirror production Fusion exactly:
     humanConfidence = (0.6 * face_cal + 0.4 * voice_cal) / 1.0
5. Simulate joint impostor trials (Models A & B).
6. Evaluate joint FAR at Fusion assurance thresholds (MEDIUM=0.75, HIGH=0.85).

Decision gates
--------------
A. Modality-level FAR documented.
B. Joint FAR simulated under Threat Model A.
C. Joint FAR simulated under Threat Model B.
D. calibration.service.ts is NOT modified.
"""

import os, sys, warnings
import numpy as np
warnings.filterwarnings('ignore')
from pathlib import Path
from sklearn.metrics import roc_curve, auc as sklearn_auc

SCORE_CACHE_DIR = "./phase_3i6_score_cache"

WEIGHT_FACE  = 0.6
WEIGHT_VOICE = 0.4
THRESHOLD_MEDIUM = 0.75
THRESHOLD_HIGH   = 0.85

def calibrate_face(raw: float) -> float:
    if raw < 0.50:
        return raw * 1.5
    return min(1.0, 0.75 + ((raw - 0.50) / 0.50) * 0.25)

def calibrate_voice(raw: float) -> float:
    if raw < 0.40:
        return raw * 1.875
    return min(1.0, 0.75 + ((raw - 0.40) / 0.40) * 0.25)

def fuse(face_cal: float, voice_cal: float) -> float:
    num = WEIGHT_FACE * face_cal + WEIGHT_VOICE * voice_cal
    den = WEIGHT_FACE + WEIGHT_VOICE
    return num / den

def compute_eer(genuine, impostor):
    labels = np.concatenate([np.ones(len(genuine)), np.zeros(len(impostor))])
    scores = np.concatenate([genuine, impostor])
    if len(np.unique(labels)) < 2: return np.nan, np.nan
    fpr, tpr, thresholds = roc_curve(labels, scores, pos_label=1)
    fnr = 1 - tpr
    idx = np.nanargmin(np.abs(fnr - fpr))
    return float(fpr[idx]), float(thresholds[idx])

def compute_auc(genuine, impostor):
    labels = np.concatenate([np.ones(len(genuine)), np.zeros(len(impostor))])
    scores = np.concatenate([genuine, impostor])
    if len(np.unique(labels)) < 2: return np.nan
    fpr, tpr, _ = roc_curve(labels, scores, pos_label=1)
    return float(sklearn_auc(fpr, tpr))

def far_at(scores, t): return np.sum(scores >= t) / max(len(scores), 1)

def section(title): print(f"\n{'='*68}\n  {title}\n{'='*68}")
def stats_block(label, arr):
    print(f"{label}: n={len(arr):,}  min={np.min(arr):.4f}  max={np.max(arr):.4f}  "
          f"mean={np.mean(arr):.4f}  median={np.median(arr):.4f}  std={np.std(arr):.4f}")

def run():
    rng = np.random.RandomState(42)

    face_cache = Path(SCORE_CACHE_DIR) / "face_scores.npz"
    voice_cache = Path(SCORE_CACHE_DIR) / "voice_scores.npz"

    if not face_cache.exists() or not voice_cache.exists():
        print("ERROR: Score caches not found. Wait for Phase 3I.6 to finish extracting.")
        return

    d_face = np.load(face_cache)
    face_gen, face_imp = d_face['genuine'], d_face['impostor']
    
    d_voice = np.load(voice_cache)
    voice_gen, voice_imp = d_voice['genuine'], d_voice['impostor']

    section("MODALITY-LEVEL SCORE DISTRIBUTIONS")
    stats_block("Face Genuine ", face_gen)
    stats_block("Face Impostor", face_imp)
    stats_block("Voice Genuine ", voice_gen)
    stats_block("Voice Impostor", voice_imp)

    face_imp_cal = np.array([calibrate_face(float(s)) for s in face_imp])
    voice_imp_cal = np.array([calibrate_voice(float(s)) for s in voice_imp])

    section("MODALITY-LEVEL FAR METRICS")
    print(f"Face  @ raw 0.50 (current): FAR={far_at(face_imp, 0.50):.4f}")
    print(f"Face  @ raw 0.40 (proposed): FAR={far_at(face_imp, 0.40):.4f}")
    print(f"Voice @ raw 0.40 (current): FAR={far_at(voice_imp, 0.40):.4f}")

    section("JOINT SIMULATION: INDEPENDENT IMPOSTOR (Model A)")
    print("Threat Model A simulates an independent attacker across both channels.")
    print("NOTE: This models statistical independence; it does NOT empirically prove")
    print("that real face/voice spoof failures are independent.")
    
    n_joint = min(len(face_imp), len(voice_imp), 100000)
    face_imp_s  = rng.choice(face_imp_cal,  n_joint, replace=True)
    voice_imp_s = rng.choice(voice_imp_cal, n_joint, replace=True)
    joint_imp_A = np.array([fuse(f, v) for f, v in zip(face_imp_s, voice_imp_s)])

    joint_far_medium_A = far_at(joint_imp_A, THRESHOLD_MEDIUM)
    joint_far_high_A   = far_at(joint_imp_A, THRESHOLD_HIGH)
    print(f"Joint FAR @ MEDIUM (0.75): {joint_far_medium_A:.6f}  ({joint_far_medium_A*100:.4f}%)")
    print(f"Joint FAR @ HIGH   (0.85): {joint_far_high_A:.6f}  ({joint_far_high_A*100:.4f}%)")

    section("JOINT SIMULATION: CORRELATED IMPOSTOR (Model B - Adversarial)")
    print("Threat Model B pairs the top 5% face impostors with the top 5% voice impostors.")
    print("NOTE: This is an adversarial stress test, NOT an empirical correlation estimate.")
    
    k_pct = 5
    face_hard  = np.percentile(face_imp_cal,  100 - k_pct)
    voice_hard = np.percentile(voice_imp_cal, 100 - k_pct)
    face_hard_scores  = face_imp_cal [face_imp_cal  >= face_hard]
    voice_hard_scores = voice_imp_cal[voice_imp_cal >= voice_hard]
    n_corr = min(len(face_hard_scores), len(voice_hard_scores), 10000)
    face_hard_s  = rng.choice(face_hard_scores,  n_corr, replace=True)
    voice_hard_s = rng.choice(voice_hard_scores, n_corr, replace=True)
    joint_imp_B = np.array([fuse(f, v) for f, v in zip(face_hard_s, voice_hard_s)])

    joint_far_medium_B = far_at(joint_imp_B, THRESHOLD_MEDIUM)
    joint_far_high_B   = far_at(joint_imp_B, THRESHOLD_HIGH)
    print(f"Top-{k_pct}% face impostor threshold (calibrated) : {face_hard:.4f}")
    print(f"Top-{k_pct}% voice impostor threshold (calibrated): {voice_hard:.4f}")
    print(f"Joint FAR @ MEDIUM (0.75): {joint_far_medium_B:.6f}  ({joint_far_medium_B*100:.4f}%)")
    print(f"Joint FAR @ HIGH   (0.85): {joint_far_high_B:.6f}  ({joint_far_high_B*100:.4f}%)")

    section("PRODUCTION FUSION EQUATION")
    print("humanConfidence = (WEIGHT_FACE * face_calibrated + WEIGHT_VOICE * voice_calibrated) / (WEIGHT_FACE + WEIGHT_VOICE)")
    print(f"WEIGHT_FACE  = {WEIGHT_FACE}")
    print(f"WEIGHT_VOICE = {WEIGHT_VOICE}")
    
    section("PHASE 3I.6.1 STATUS")
    print("Audit only complete.")
    print("calibration.service.ts: UNCHANGED")
    print("NOTE: These results simulate Fusion behavior based on marginal distributions.")
    print("They do NOT authorize a calibration change on their own.")

if __name__ == '__main__':
    run()
