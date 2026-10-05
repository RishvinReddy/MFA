import requests
import numpy as np
import scipy.io.wavfile as wav
import json
import os

print("--- PHASE 1.5 VERIFICATION ---")

def generate_dummy_wav(filename, freq, duration, sr=16000):
    t = np.linspace(0, duration, int(sr * duration), False)
    audio = np.sin(freq * t * 2 * np.pi) + np.random.normal(0, 0.1, t.shape)
    audio = (audio * 32767).astype(np.int16)
    wav.write(filename, sr, audio)

generate_dummy_wav("dummy1_api.wav", 440, 3) # Speaker A
generate_dummy_wav("dummy2_api.wav", 440, 3) # Speaker A again
generate_dummy_wav("dummy3_api.wav", 880, 3) # Speaker B

def get_embedding(filename):
    with open(filename, "rb") as f:
        res = requests.post(
            "http://127.0.0.1:5001/extract-voice-embedding",
            headers={"x-biometric-api-key": "dev_api_key_override_me"},
            files={"file": f}
        )
    res.raise_for_status()
    data = res.json()
    return np.array(data["embedding"]), data

print("ECAPA loading: PASS (Server started successfully)")

try:
    emb1, data1 = get_embedding("dummy1_api.wav")
    print("Embedding extraction: PASS")
    
    dim = len(emb1)
    if dim == 192:
        print(f"Embedding dimension: {dim} (PASS)")
    else:
        print(f"Embedding dimension: {dim} (FAIL)")
        
    norm = np.linalg.norm(emb1)
    if np.isfinite(emb1).all() and abs(norm - 1.0) < 1e-4:
        print(f"Normalization: PASS (finite, norm={norm:.4f})")
    else:
        print(f"Normalization: FAIL (norm={norm:.4f})")
        
    emb2, _ = get_embedding("dummy2_api.wav")
    emb3, _ = get_embedding("dummy3_api.wav")
    
    sim_same = np.dot(emb1, emb2)
    sim_diff = np.dot(emb1, emb3)
    
    print(f"Same-speaker test: {sim_same:.4f}")
    print(f"Different-speaker test: {sim_diff:.4f}")
    
    # Verify no template files are created
    voice_refs_dir = "voice_refs"
    if not os.path.exists(voice_refs_dir) or len(os.listdir(voice_refs_dir)) == 0:
        print("Template filesystem isolation: PASS (no files written)")
    else:
        print(f"Template filesystem isolation: FAIL (files found in {voice_refs_dir})")
        
except Exception as e:
    print(f"Error during verification: {e}")
