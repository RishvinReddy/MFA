"""
Phase 3I.4.1 -- InsightFace (buffalo_l) Statistical Robustness Audit
====================================================================
Purpose
-------
Validate the Phase 3I.4 preliminary face calibration findings using:
  - Stratified identity sampling (not first-N images)
  - Bootstrap confidence intervals (n=1000) for EER, AUC, FAR@anchor, FRR@anchor
  - Evaluation of BOTH the current 0.50 and proposed 0.40 calibration anchors

This script is AUDIT-ONLY. It does not modify calibration.service.ts.
"""

import cv2
import numpy as np
import warnings
warnings.filterwarnings('ignore')

from sklearn.datasets import fetch_lfw_people
from sklearn.metrics import roc_curve, auc as sklearn_auc
from tqdm import tqdm

# Configuration
SEED               = 42
N_IDENTITIES       = 100
MAX_IMGS_PER_ID    = 5
MAX_IMPOSTOR_PAIRS = 10000
N_BOOTSTRAP        = 1000
ANCHOR_CURRENT     = 0.50
ANCHOR_PROPOSED    = 0.40

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

def run():
    rng = np.random.RandomState(SEED)

    print("Loading LFW (min_faces_per_person=5)...")
    lfw = fetch_lfw_people(min_faces_per_person=5, color=True)
    images, target, target_names = lfw.images, lfw.target, lfw.target_names

    if images.dtype in (np.float32, np.float64):
        images = (images * 255).astype(np.uint8) if images.max() <= 1.0 else images.astype(np.uint8)

    all_identities = np.unique(target)
    print(f"Full dataset: {len(images)} images, {len(all_identities)} identities")

    n_to_sample = min(N_IDENTITIES, len(all_identities))
    selected_ids = rng.choice(all_identities, size=n_to_sample, replace=False)

    selected_indices = []
    for ident in selected_ids:
        idx = np.where(target == ident)[0]
        chosen = rng.choice(idx, size=min(MAX_IMGS_PER_ID, len(idx)), replace=False)
        selected_indices.extend(chosen.tolist())

    selected_indices = sorted(selected_indices)
    sampled_images  = images[selected_indices]
    sampled_targets = target[selected_indices]
    print(f"Stratified sample: {len(sampled_images)} images from {n_to_sample} identities  (seed={SEED}, max_per_id={MAX_IMGS_PER_ID})")

    print("\nInitializing InsightFace (buffalo_l, det_size=160)...")
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_l")
    app.prepare(ctx_id=0, det_size=(160, 160), det_thresh=0.30)

    embeddings_by_id = {}
    detected = failed = 0
    for img_rgb, label in tqdm(zip(sampled_images, sampled_targets), total=len(sampled_images), desc="Embedding"):
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        img_bgr = cv2.resize(img_bgr, (160, 160), interpolation=cv2.INTER_LANCZOS4)
        try:
            faces = app.get(img_bgr)
            if not faces:
                failed += 1
                continue
            emb = faces[0].embedding.astype(np.float32)
            embeddings_by_id.setdefault(int(label), []).append(emb)
            detected += 1
        except Exception:
            failed += 1

    print(f"Detected: {detected}  Failed: {failed}  Rate: {detected/(detected+failed)*100:.1f}%")

    embeddings_by_id = {k: v for k, v in embeddings_by_id.items() if len(v) >= 2}
    id_list = list(embeddings_by_id.keys())
    print(f"Identities with >=2 embeddings: {len(id_list)}")

    if len(id_list) < 2:
        print("ERROR: Insufficient data")
        return

    genuine_scores = []
    for ident in id_list:
        embs = embeddings_by_id[ident]
        for i in range(len(embs)):
            for j in range(i+1, len(embs)):
                genuine_scores.append(cosine_sim(embs[i], embs[j]))
    genuine_scores = np.array(genuine_scores, dtype=np.float32)

    all_impostor = []
    for i in range(len(id_list)):
        for j in range(i+1, len(id_list)):
            for e1 in embeddings_by_id[id_list[i]]:
                for e2 in embeddings_by_id[id_list[j]]:
                    all_impostor.append(cosine_sim(e1, e2))
    all_impostor = np.array(all_impostor, dtype=np.float32)

    if len(all_impostor) > MAX_IMPOSTOR_PAIRS:
        idx = rng.choice(len(all_impostor), MAX_IMPOSTOR_PAIRS, replace=False)
        impostor_scores = all_impostor[idx]
        print(f"Impostor pairs: {len(impostor_scores)} (sampled from {len(all_impostor)} total)")
    else:
        impostor_scores = all_impostor
        print(f"Impostor pairs: {len(impostor_scores)} (all cross-identity pairs)")

    section("POINT ESTIMATES")
    stats_block("Genuine ", genuine_scores)
    stats_block("Impostor", impostor_scores)
    gap = np.min(genuine_scores) - np.max(impostor_scores)
    eer_point, eer_thresh = compute_eer(genuine_scores, impostor_scores)
    auc_point             = compute_auc(genuine_scores, impostor_scores)
    print(f"Score gap (genuine_min - impostor_max): {gap:+.4f}")
    print(f"EER : {eer_point:.4f}  (at threshold {eer_thresh:.4f})")
    print(f"AUC : {auc_point:.4f}")
    print(f"\nAt CURRENT anchor ({ANCHOR_CURRENT:.2f}):  FAR={far(impostor_scores, ANCHOR_CURRENT):.4f}  FRR={frr(genuine_scores, ANCHOR_CURRENT):.4f}")
    print(f"At PROPOSED anchor ({ANCHOR_PROPOSED:.2f}): FAR={far(impostor_scores, ANCHOR_PROPOSED):.4f}  FRR={frr(genuine_scores, ANCHOR_PROPOSED):.4f}")

    section("FAR / FRR TABLE")
    print(f"{'Threshold':>9} | {'FAR':>8} | {'FRR':>8} | {'TAR':>8} | {'TRR':>8}")
    print("-" * 55)
    for t in np.arange(0.10, 0.90, 0.05):
        f = far(impostor_scores, t)
        r = frr(genuine_scores, t)
        marker = " <- current" if abs(t - ANCHOR_CURRENT) < 0.01 else " <- proposed" if abs(t - ANCHOR_PROPOSED) < 0.01 else ""
        print(f"{t:9.2f} | {f:8.4f} | {r:8.4f} | {1-r:8.4f} | {1-f:8.4f}{marker}")

    section(f"BOOTSTRAP CI (n={N_BOOTSTRAP}, seed={SEED})")
    boot_eer     = np.empty(N_BOOTSTRAP)
    boot_auc     = np.empty(N_BOOTSTRAP)
    boot_far_cur = np.empty(N_BOOTSTRAP)
    boot_frr_cur = np.empty(N_BOOTSTRAP)
    boot_far_pro = np.empty(N_BOOTSTRAP)
    boot_frr_pro = np.empty(N_BOOTSTRAP)

    for b in tqdm(range(N_BOOTSTRAP), desc="Bootstrap"):
        g_b   = genuine_scores [rng.choice(len(genuine_scores),  len(genuine_scores),  replace=True)]
        imp_b = impostor_scores[rng.choice(len(impostor_scores), len(impostor_scores), replace=True)]
        boot_eer[b], _ = compute_eer(g_b, imp_b)
        boot_auc[b]    = compute_auc(g_b, imp_b)
        boot_far_cur[b] = far(imp_b, ANCHOR_CURRENT)
        boot_frr_cur[b] = frr(g_b,   ANCHOR_CURRENT)
        boot_far_pro[b] = far(imp_b, ANCHOR_PROPOSED)
        boot_frr_pro[b] = frr(g_b,   ANCHOR_PROPOSED)

    def fmt(arr):
        lo, hi = ci95(arr)
        return f"{np.mean(arr):.4f}  95% CI [{lo:.4f}, {hi:.4f}]"

    print(f"\nEER                         | {fmt(boot_eer)}")
    print(f"AUC                         | {fmt(boot_auc)}")
    print(f"FAR @ {ANCHOR_CURRENT:.2f} (current)   | {fmt(boot_far_cur)}")
    print(f"FRR @ {ANCHOR_CURRENT:.2f} (current)   | {fmt(boot_frr_cur)}")
    print(f"FAR @ {ANCHOR_PROPOSED:.2f} (proposed)  | {fmt(boot_far_pro)}")
    print(f"FRR @ {ANCHOR_PROPOSED:.2f} (proposed)  | {fmt(boot_frr_pro)}")

    section("CALIBRATION DECISION GUIDANCE")
    print("AUDIT-ONLY. calibration.service.ts is NOT modified.")
    print("\nDecision criteria for anchor update:")
    print("  1. FAR @ proposed anchor must be 0.0000 in point estimate")
    print("  2. 95% CI upper bound of FAR @ proposed anchor must be 0.0000")
    print("  3. FRR improvement must be material, not within noise")
    print("  4. Voice anchor must be jointly evaluated before any Face change")
    far_upper_pro = ci95(boot_far_pro)[1]
    far_upper_cur = ci95(boot_far_cur)[1]
    print(f"\n  Current anchor FAR CI upper : {far_upper_cur:.4f}")
    print(f"  Proposed anchor FAR CI upper: {far_upper_pro:.4f}")
    if far_upper_pro == 0.0:
        print("  RESULT: Proposed anchor CI upper = 0.0000 -> statistically safe (pending voice)")
    else:
        print(f"  RESULT: Proposed anchor CI upper = {far_upper_pro:.4f} -> NOT yet safe to change")

if __name__ == "__main__":
    run()
