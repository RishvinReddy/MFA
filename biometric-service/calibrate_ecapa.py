import os
import glob
import numpy as np
import torch
import torchaudio
import soundfile as sf
from speechbrain.inference.speaker import EncoderClassifier
from sklearn.metrics import roc_curve, auc
from scipy.optimize import brentq
from scipy.interpolate import interp1d

# Paths
CALIBRATION_DIR = r"..\voice_calibration"
MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"

print("Loading SpeechBrain ECAPA-TDNN...")
voice_classifier = EncoderClassifier.from_hparams(source=MODEL_SOURCE, run_opts={"device": "cpu"})

def extract_ecapa_embedding(audio_path: str) -> np.ndarray:
    import imageio_ffmpeg
    import subprocess
    import tempfile

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_name = tmp.name
    
    try:
        subprocess.run([ffmpeg_exe, "-y", "-i", audio_path, "-ac", "1", "-ar", "16000", tmp_name], 
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        signal_np, fs = sf.read(tmp_name)
    finally:
        os.remove(tmp_name)

    signal = torch.tensor(signal_np, dtype=torch.float32).unsqueeze(0)
    if fs != 16000:
        resampler = torchaudio.transforms.Resample(fs, 16000)
        signal = resampler(signal)
    with torch.no_grad():
        embeddings = voice_classifier.encode_batch(signal)
        emb = embeddings.squeeze()
        emb_norm = torch.nn.functional.normalize(emb, p=2, dim=0)
    return emb_norm.numpy()

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def run_calibration():
    # 1. Collect and extract embeddings
    embeddings = {} # dict of speaker -> list of (phrase_id, embedding)
    
    speakers = [d for d in os.listdir(CALIBRATION_DIR) if os.path.isdir(os.path.join(CALIBRATION_DIR, d))]
    
    for spk in speakers:
        spk_dir = os.path.join(CALIBRATION_DIR, spk)
        wavs = glob.glob(os.path.join(spk_dir, "*.wav"))
        embeddings[spk] = []
        for wav in wavs:
            fname = os.path.basename(wav)
            phrase_id = fname.split("_")[1].replace(".wav", "")
            try:
                emb = extract_ecapa_embedding(wav)
                embeddings[spk].append((phrase_id, emb, wav))
                print(f"Extracted {spk}/{fname}")
            except Exception as e:
                print(f"Error extracting {wav}: {e}")

    # 2. Compute comparisons
    genuine_scores = []
    impostor_scores = []
    
    spk_list = list(embeddings.keys())
    
    # Genuine comparisons (same speaker, different recordings)
    for spk in spk_list:
        recs = embeddings[spk]
        for i in range(len(recs)):
            for j in range(i + 1, len(recs)):
                score = cosine_similarity(recs[i][1], recs[j][1])
                genuine_scores.append(score)
                
    # Impostor comparisons (different speakers)
    for i in range(len(spk_list)):
        for j in range(i + 1, len(spk_list)):
            spk1 = spk_list[i]
            spk2 = spk_list[j]
            for rec1 in embeddings[spk1]:
                for rec2 in embeddings[spk2]:
                    score = cosine_similarity(rec1[1], rec2[1])
                    impostor_scores.append(score)
                    
    genuine_scores = np.array(genuine_scores)
    impostor_scores = np.array(impostor_scores)
    
    # 3. Compute distributions
    if len(genuine_scores) == 0 or len(impostor_scores) == 0:
        print("ERROR: Insufficient data to compute distributions.")
        return

    print("\n# ECAPA Calibration Report\n")
    print(f"Model: {MODEL_SOURCE}")
    print("Embedding dimension: 192")
    print("Preprocessing: torchaudio.transforms.Resample to 16000Hz")
    print("Normalization: L2 (torch.nn.functional.normalize)")
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

    # 4. Compute EER
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
        # FAR = False Acceptance Rate = Impostors > t / Total Impostors
        far = np.sum(impostor_scores >= t) / len(impostor_scores)
        # FRR = False Rejection Rate = Genuines < t / Total Genuines
        frr = np.sum(genuine_scores < t) / len(genuine_scores)
        # TAR = 1 - FRR
        tar = 1 - frr
        # TRR = 1 - FAR
        trr = 1 - far
        print(f"{t:.2f} | {far:.4f} | {frr:.4f} | {tar:.4f} | {trr:.4f}")

    print("\nEER: {:.4f} (at threshold {:.4f})".format(eer, eer_threshold))
    print(f"AUC: {auc_score:.4f}\n")

if __name__ == "__main__":
    run_calibration()
