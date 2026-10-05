import os
import cv2
import numpy as np
from sklearn.datasets import fetch_lfw_people
from sklearn.metrics import roc_curve, auc
from face_processor import FaceProcessor
import warnings
warnings.filterwarnings('ignore', category=UserWarning, module='onnxruntime')
warnings.filterwarnings('ignore', category=FutureWarning, module='insightface')

def run_face_calibration():
    print("Fetching LFW dataset (min faces per person = 5)...")
    lfw_people = fetch_lfw_people(min_faces_per_person=5, color=True)
    
    images = lfw_people.images # (N, H, W, 3) in RGB, floats [0, 1] usually or uint8?
    # fetch_lfw_people returns float32 in [0, 1] or [0, 255]?
    # Let's check format
    if images.dtype == np.float32 or images.dtype == np.float64:
        if images.max() <= 1.0:
            images = (images * 255).astype(np.uint8)
        else:
            images = images.astype(np.uint8)
    
    target = lfw_people.target
    target_names = lfw_people.target_names
    
    # LIMIT for calibration speed. 200 images gives enough genuine/impostor pairs.
    images = images[:200]
    target = target[:200]
    
    print(f"Loaded {len(images)} images across {len(target_names)} identities.")
    
    print("Initializing InsightFace (buffalo_l) with det_size=160 for LFW images...")
    try:
        from insightface.app import FaceAnalysis
        app = FaceAnalysis(name="buffalo_l")
        # LFW images are 62x47px; we upscale to 160x160, so use det_size=(160,160)
        app.prepare(ctx_id=0, det_size=(160, 160), det_thresh=0.30)
    except Exception as e:
        print(f"InsightFace not available: {e}")
        return
        
    embeddings = {}
    
    print("Extracting embeddings...")
    extracted_count = 0
    from tqdm import tqdm
    for img_rgb, label in tqdm(zip(images, target), total=len(images), desc="Extracting embeddings"):
        ident = target_names[label]
        # Upscale from ~62x47 to 160x160 so the detector fires
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        img_bgr = cv2.resize(img_bgr, (160, 160), interpolation=cv2.INTER_LANCZOS4)
        
        try:
            faces = app.get(img_bgr)
            if len(faces) == 0:
                raise ValueError("FACE_NOT_DETECTED")
            emb = faces[0].embedding.astype(np.float32)
            if ident not in embeddings:
                embeddings[ident] = []
            embeddings[ident].append(emb)
            extracted_count += 1
        except Exception as e:
            pass # No face found
            
    print(f"Successfully extracted {extracted_count} embeddings.")
    
    # 2. Compute comparisons
    genuine_scores = []
    impostor_scores = []
    
    spk_list = list(embeddings.keys())
    
    def cosine_similarity(a, b):
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        
    # Genuine comparisons (same speaker, different recordings)
    for spk in spk_list:
        recs = embeddings[spk]
        for i in range(len(recs)):
            for j in range(i + 1, len(recs)):
                score = cosine_similarity(recs[i], recs[j])
                genuine_scores.append(score)
                
    # Impostor comparisons (different speakers)
    for i in range(len(spk_list)):
        for j in range(i + 1, len(spk_list)):
            spk1 = spk_list[i]
            spk2 = spk_list[j]
            for rec1 in embeddings[spk1]:
                for rec2 in embeddings[spk2]:
                    score = cosine_similarity(rec1, rec2)
                    impostor_scores.append(score)
                    
    genuine_scores = np.array(genuine_scores)
    impostor_scores = np.array(impostor_scores)
    
    if len(genuine_scores) == 0 or len(impostor_scores) == 0:
        print("ERROR: Insufficient data.")
        return

    print("\n# InsightFace Calibration Report\n")
    print(f"Model: buffalo_l")
    print("Similarity metric: Cosine Similarity\n")

    print(f"Genuine samples: {len(genuine_scores)}")
    print(f"Impostor samples: {len(impostor_scores)}\n")

    print("Genuine statistics:")
    print(f"- Min: {np.min(genuine_scores):.4f}")
    print(f"- Max: {np.max(genuine_scores):.4f}")
    print(f"- Mean: {np.mean(genuine_scores):.4f}")
    print(f"- Median: {np.median(genuine_scores):.4f}")
    print(f"- StdDev: {np.std(genuine_scores):.4f}\n")

    print("Impostor statistics:")
    print(f"- Min: {np.min(impostor_scores):.4f}")
    print(f"- Max: {np.max(impostor_scores):.4f}")
    print(f"- Mean: {np.mean(impostor_scores):.4f}")
    print(f"- Median: {np.median(impostor_scores):.4f}")
    print(f"- StdDev: {np.std(impostor_scores):.4f}\n")

    labels = np.concatenate([np.ones(len(genuine_scores)), np.zeros(len(impostor_scores))])
    scores = np.concatenate([genuine_scores, impostor_scores])
    fpr, tpr, thresholds = roc_curve(labels, scores, pos_label=1)
    fnr = 1 - tpr
    
    eer_threshold = thresholds[np.nanargmin(np.absolute((fnr - fpr)))]
    eer = fpr[np.nanargmin(np.absolute((fnr - fpr)))]
    auc_score = auc(fpr, tpr)
    
    print("Threshold table:")
    print("Threshold | FAR | FRR | TAR | TRR")
    print("--- | --- | --- | --- | ---")
    
    candidate_thresholds = np.arange(0.1, 1.0, 0.05)
    for t in candidate_thresholds:
        far = np.sum(impostor_scores >= t) / len(impostor_scores)
        frr = np.sum(genuine_scores < t) / len(genuine_scores)
        tar = 1 - frr
        trr = 1 - far
        print(f"{t:.2f} | {far:.4f} | {frr:.4f} | {tar:.4f} | {trr:.4f}")

    print("\nEER: {:.4f} (at threshold {:.4f})".format(eer, eer_threshold))
    print(f"AUC: {auc_score:.4f}\n")

if __name__ == "__main__":
    run_face_calibration()
