import os
import warnings

# Suppress ONNX runtime and InsightFace warnings
warnings.filterwarnings('ignore', category=UserWarning, module='onnxruntime')
warnings.filterwarnings('ignore', category=FutureWarning, module='insightface')

import cv2
import numpy as np
from face_processor import FaceProcessor

# Local images
path_a = r"venv\Lib\site-packages\matplotlib\mpl-data\sample_data\grace_hopper.jpg"
path_b = r"venv\Lib\site-packages\skimage\data\astronaut.png"
path_c = r"..\temp_repo\backend\sample_data\face.jpg"

if not os.path.exists(path_a):
    print(f"Error: path_a does not exist at {path_a}")
    exit(1)
if not os.path.exists(path_b):
    print(f"Error: path_b does not exist at {path_b}")
    exit(1)
if not os.path.exists(path_c):
    print(f"Error: path_c does not exist at {path_c}")
    exit(1)

img_a = cv2.imread(path_a)
img_b = cv2.imread(path_b)
img_c = cv2.imread(path_c)

fp = FaceProcessor()
if not fp.is_available:
    print("FaceProcessor not available")
    exit(1)

try:
    emb_a = fp.extract_embedding(img_a)
    print("Face A (Grace Hopper) extracted successfully.")
except Exception as e:
    print("Error extracting Face A:", e)
    exit(1)

try:
    emb_b = fp.extract_embedding(img_b)
    print("Face B (Eileen Collins) extracted successfully.")
except Exception as e:
    print("Error extracting Face B:", e)
    exit(1)

try:
    emb_c = fp.extract_embedding(img_c)
    print("Face C (Sample Face) extracted successfully.")
except Exception as e:
    print("Error extracting Face C:", e)
    exit(1)

def dist_l2(x, y):
    return np.linalg.norm(x - y)

def dist_cos(x, y):
    return np.dot(x, y) / (np.linalg.norm(x) * np.linalg.norm(y))

print("\n=== Biometric Audit: Controlled Test Matrix ===")
print(f"A -> A: Similarity = {dist_cos(emb_a, emb_a):.4f} | L2 Distance = {dist_l2(emb_a, emb_a):.4f}")
print(f"A -> B: Similarity = {dist_cos(emb_a, emb_b):.4f} | L2 Distance = {dist_l2(emb_a, emb_b):.4f}")
print(f"A -> C: Similarity = {dist_cos(emb_a, emb_c):.4f} | L2 Distance = {dist_l2(emb_a, emb_c):.4f}")
print(f"B -> C: Similarity = {dist_cos(emb_b, emb_c):.4f} | L2 Distance = {dist_l2(emb_b, emb_c):.4f}")

# Normalized Euclidean distance
norm_a = emb_a / np.linalg.norm(emb_a)
norm_b = emb_b / np.linalg.norm(emb_b)
norm_c = emb_c / np.linalg.norm(emb_c)

print("\n--- Euclidean Distance on Normalized Embeddings ---")
print(f"A -> A (Normalized L2): {dist_l2(norm_a, norm_a):.4f}")
print(f"A -> B (Normalized L2): {dist_l2(norm_a, norm_b):.4f}")
print(f"A -> C (Normalized L2): {dist_l2(norm_a, norm_c):.4f}")
print(f"B -> C (Normalized L2): {dist_l2(norm_b, norm_c):.4f}")
