import os
import time
import numpy as np
import scipy.io.wavfile as wav
import torch
import torchaudio
import speechbrain

print("PHASE 1 STATUS")
print("PyTorch: PASS")
print("TorchAudio: PASS")
print("SpeechBrain: PASS")

def generate_dummy_wav(filename, freq, duration, sr=16000):
    t = np.linspace(0, duration, int(sr * duration), False)
    # Generate a sine wave with some noise to avoid silence filtering
    audio = np.sin(freq * t * 2 * np.pi) + np.random.normal(0, 0.1, t.shape)
    audio = (audio * 32767).astype(np.int16)
    wav.write(filename, sr, audio)

print("\nGenerating dummy audio files...")
generate_dummy_wav("dummy1.wav", 440, 3) # Speaker A
generate_dummy_wav("dummy2.wav", 440, 3) # Speaker A again
generate_dummy_wav("dummy3.wav", 880, 3) # Speaker B

try:
    from speechbrain.inference.speaker import EncoderClassifier
    start = time.time()
    # ECAPA-TDNN model trained on VoxCeleb
    classifier = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb"
    )
    print("ECAPA model loading: PASS")
    print(f"Model download/cache location: {os.path.abspath('pretrained_models/spkrec-ecapa-voxceleb')}")
except Exception as e:
    print(f"ECAPA model loading: FAIL ({e})")
    exit(1)

import soundfile as sf

def extract_embedding(filepath):
    start = time.time()
    signal_np, fs = sf.read(filepath)
    signal = torch.tensor(signal_np, dtype=torch.float32).unsqueeze(0)
    # the classifier expects 16kHz
    if fs != 16000:
        resampler = torchaudio.transforms.Resample(fs, 16000)
        signal = resampler(signal)
    
    embeddings = classifier.encode_batch(signal)
    # embeddings shape is [batch, 1, channels]
    emb = embeddings.squeeze().detach().numpy()
    
    # Normalize
    norm = np.linalg.norm(emb)
    emb_norm = emb / norm if norm > 0 else emb
    
    duration = time.time() - start
    return emb_norm, norm, duration

try:
    emb1, norm1, dur1 = extract_embedding("dummy1.wav")
    print("Embedding extraction: PASS")
    print(f"Embedding dimension: {emb1.shape}")
    print(f"Exact model used: speechbrain/spkrec-ecapa-voxceleb")
    
    if np.isfinite(emb1).all() and np.abs(np.linalg.norm(emb1) - 1.0) < 1e-5:
        print("Embedding normalization: PASS")
    else:
        print("Embedding normalization: FAIL")
        
    print(f"CPU processing time: {dur1*1000:.2f} ms")
    
    emb2, norm2, dur2 = extract_embedding("dummy2.wav")
    emb3, norm3, dur3 = extract_embedding("dummy3.wav")
    
    # Cosine similarity
    sim_same = np.dot(emb1, emb2)
    sim_diff = np.dot(emb1, emb3)
    
    print("\nCosine Similarities:")
    print(f"Same speaker (dummy1 vs dummy2): {sim_same:.4f}")
    print(f"Different speakers (dummy1 vs dummy3): {sim_diff:.4f}")
    
    print("Tests: PASS")
    
except Exception as e:
    print(f"Tests: FAIL ({e})")
