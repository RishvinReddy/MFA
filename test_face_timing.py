import time
import cv2
import numpy as np
import os
import urllib.request

print("Loading FaceProcessor...")
t0 = time.time()
from biometric_service.face_processor import FaceProcessor
fp = FaceProcessor()
t1 = time.time()
print(f"Loaded in {t1 - t0:.3f} seconds.")

# Download a sample image WITH A FACE
img_path = "test_face.jpg"
if not os.path.exists(img_path):
    urllib.request.urlretrieve("https://raw.githubusercontent.com/deepinsight/insightface/master/sample-images/t1.jpg", img_path)

img = cv2.imread(img_path)
if img is None:
    print("Failed to load image")
    exit(1)

print("First inference (cold start) WITH FACE...")
t2 = time.time()
faces = fp._model.get(img)
t3 = time.time()
print(f"First inference took {t3 - t2:.3f} seconds. Detected faces: {len(faces)}")

print("Second inference (warm) WITH FACE...")
t4 = time.time()
faces = fp._model.get(img)
t5 = time.time()
print(f"Second inference took {t5 - t4:.3f} seconds. Detected faces: {len(faces)}")
