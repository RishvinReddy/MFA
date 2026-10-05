import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends, Header, Form, Request
from typing import List
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import os
import cv2
import json
import tempfile
import string
import re
import time

try:
    from face_processor import FaceProcessor
    face_processor = FaceProcessor()
    if not face_processor.is_available:
        raise RuntimeError(f"FaceProcessor unavailable: {face_processor._init_error}")
    print("[SUCCESS] InsightFace FaceProcessor loaded successfully.")
except Exception as e:
    print(f"[ERROR] FATAL ERROR: FaceProcessor import failed: {e}. Cannot start service without real face verification.")
    import sys
    sys.exit(1)

USE_MOCK = False

# ── Voice Model ──────────────────────────────────────────────────────────────
try:
    from transformers import pipeline
    print("Loading Whisper model (openai/whisper-tiny)...")
    whisper_pipe = pipeline("automatic-speech-recognition", model="openai/whisper-tiny")
    print("[SUCCESS] Whisper model loaded successfully.")
except Exception as e:
    print(f"[ERROR] Whisper import failed: {e}. Transcription disabled.")
    whisper_pipe = None

try:
    from speechbrain.inference.speaker import EncoderClassifier
    import speechbrain.utils.importutils
    
    # --- MONKEYPATCH SPEECHBRAIN LAZYMODULE ---
    # PyTorch's inspect.getmodule() crashes when iterating over sys.modules
    # if it hits a SpeechBrain LazyModule (like k2_fsa) that raises an ImportError.
    # We patch __getattr__ to raise an AttributeError for '__file__' so hasattr() safely returns False.
    _orig_getattr = speechbrain.utils.importutils.LazyModule.__getattr__
    def _safe_getattr(self, attr):
        if attr == "__file__":
            raise AttributeError(f"LazyModule has no attribute {attr}")
        return _orig_getattr(self, attr)
    speechbrain.utils.importutils.LazyModule.__getattr__ = _safe_getattr
    # ------------------------------------------

    import soundfile as sf
    import torch
    import torchaudio
    
    print("Loading SpeechBrain ECAPA-TDNN...")
    voice_classifier = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        run_opts={"device": "cpu"}
    )
    print("[SUCCESS] SpeechBrain ECAPA-TDNN loaded successfully.")
except Exception as e:
    print(f"[ERROR] FATAL ERROR: SpeechBrain import failed: {e}. Voice features disabled.")
    voice_classifier = None

try:
    import torch
    print("Loading Silero VAD...")
    vad_model, vad_utils = torch.hub.load(
        repo_or_dir='snakers4/silero-vad',
        model='silero_vad',
        force_reload=False,
        trust_repo=True
    )
    (get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks) = vad_utils
    print("[SUCCESS] Silero VAD loaded successfully.")
except Exception as e:
    print(f"[ERROR] FATAL ERROR: Silero VAD import failed: {e}. Voice features disabled.")
    vad_model = None

def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.translate(str.maketrans('', '', string.punctuation))
    return re.sub(r'\s+', ' ', text).strip()

def extract_ecapa_embedding(audio_path: str = None, signal_np: np.ndarray = None, fs: int = None) -> np.ndarray:
    if voice_classifier is None:
        raise RuntimeError("Voice classifier is not available.")
        
    if signal_np is None:
        signal_np, fs = sf.read(audio_path)
    
    signal = torch.tensor(signal_np, dtype=torch.float32)
    if len(signal.shape) == 1:
        signal = signal.unsqueeze(0)
    
    if fs != 16000:
        resampler = torchaudio.transforms.Resample(fs, 16000)
        signal = resampler(signal)
        
    # Extract
    with torch.no_grad():
        embeddings = voice_classifier.encode_batch(signal)
        # Squeeze down to 1D and normalize
        emb = embeddings.squeeze()
        if emb.dim() == 0:
            emb = emb.unsqueeze(0)
        emb_norm = torch.nn.functional.normalize(emb, p=2, dim=0)
        
    return emb_norm.numpy()

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="BioShield Biometric Engine", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.environ.get("BIOMETRIC_API_KEY", "dev_api_key_override_me")

def verify_api_key(x_biometric_api_key: str = Header(None)):
    print(f"DEBUG: expected API_KEY='{API_KEY}', received='{x_biometric_api_key}'")
    if not x_biometric_api_key or x_biometric_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid Biometric API Key")
    return x_biometric_api_key

@app.get("/")
def health_check():
    return {
        "status": "active",
        "service": "biometric-engine",
        "engine": "InsightFace",
        "voice": "ECAPA-192 cosine"
    }

@app.get("/health")
def health_check_endpoint():
    return {
        "status": "ready" if (face_processor and face_processor.is_available) else "error",
        "service": "bioshield-biometric-engine",
        "faceDetector": "ready" if (face_processor and face_processor.is_available) else "unavailable",
        "faceEmbeddingModel": "ready" if (face_processor and face_processor.is_available) else "unavailable",
        "voiceModel": "ready"
    }

# ── Face endpoints ─────────────────────────────────────────────────────────────

@app.post("/extract-face", dependencies=[Depends(verify_api_key)])
async def extract_face(request: Request, file: UploadFile = File(...)):
    try:
        async with analysis_lock:
            contents = await file.read()

            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                 return JSONResponse(status_code=400, content={"error": {"code": "INVALID_IMAGE", "message": "Invalid image data."}})

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            mean_brightness = float(np.mean(gray))
            rms_contrast = float(np.std(gray))

            def do_inference(image):
                return face_processor._model.get(image)
            faces = await anyio.to_thread.run_sync(do_inference, img)
            if len(faces) == 0:
                return JSONResponse(status_code=422, content={"error": {"code": "NO_FACE_DETECTED", "message": "No usable face was detected."}})
            if len(faces) > 1:
                return JSONResponse(status_code=422, content={"error": {"code": "MULTIPLE_FACES", "message": "Multiple faces detected."}})

            face = faces[0]
            embedding = face.embedding.astype(np.float32)
            
            # Additional code would go here

        nose_x_ratio = face_processor._estimate_nose_x_ratio(face)
        yaw = face_processor._estimate_head_pose(face)
        bbox_size = face_processor._estimate_bbox_size(face, img)
        blur_score = face_processor._estimate_blur_score(img, face)

        det_score = float(getattr(face, "det_score", 0.99))
        bbox_dict = None
        center_x, center_y = 0.5, 0.5
        if hasattr(face, "bbox") and face.bbox is not None and len(face.bbox) == 4 and img.shape[1] > 0 and img.shape[0] > 0:
            x1, y1, x2, y2 = face.bbox
            center_x = float((x1 + x2) / 2.0) / float(img.shape[1])
            center_y = float((y1 + y2) / 2.0) / float(img.shape[0])
            bbox_dict = {"x": int(x1), "y": int(y1), "width": int(x2 - x1), "height": int(y2 - y1)}

        # Blur quality gate: webcam frames compressed as JPEG are inherently softer than still photos.
        # Laplacian variance < 8.0 reliably indicates severe motion blur or defocus on webcam JPEG.
        # (Lowered from 15.0 as normal webcam frames at 85% JPEG quality typically score 10-50)
        if blur_score is not None and blur_score < 8.0:
            return JSONResponse(status_code=422, content={"error": {"code": "FACE_QUALITY_INSUFFICIENT", "message": f"Image is too blurry for enrollment (sharpness: {blur_score:.1f}, minimum: 8.0). Hold the device still and ensure good lighting."}})

        return {
            "success": True,
            "status": "success",
            "modality": "face",
            "vector_dim": 512,
            "faceCount": 1,
            "face_count": 1,
            "embedding": embedding.tolist(),
            "engine": "InsightFace",
            "model": {
                "name": "buffalo_l",
                "version": "1.2.0",
                "dimensions": 512
            },
            "quality": {
                "score": round(float(blur_score), 2) if blur_score is not None else 80.0,
                "acceptable": True
            },
            "quality_metrics": {
                "blur_score": round(float(blur_score), 2) if blur_score is not None else 0.0,
                "bbox_size": round(float(bbox_size), 4) if bbox_size is not None else 0.0,
                "yaw": round(float(yaw), 4) if yaw is not None else 0.0,
                "nose_x_ratio": round(float(nose_x_ratio), 4) if nose_x_ratio is not None else 0.5,
                "brightness": round(mean_brightness, 2),
                "contrast": round(rms_contrast, 2),
                "center_x": round(center_x, 4),
                "center_y": round(center_y, 4),
                "confidence": round(det_score, 4),
                "bounding_box": bbox_dict
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing face: {str(e)}")
        return JSONResponse(status_code=500, content={"error": {"code": "EMBEDDING_MODEL_FAILURE", "message": f"Face embedding inference failed: {str(e)}"}})

import asyncio
import anyio

is_processing = False
import threading
inference_thread_lock = threading.Lock()
active_inference_count = 0
analysis_lock = asyncio.Lock()


@app.post("/analyze-frame", dependencies=[Depends(verify_api_key)])
async def analyze_frame(request: Request, file: UploadFile = File(...)):
    """
    Real-time video frame analysis endpoint for enrollment and verification UI loops.
    Returns 200 OK with face count, pose (yaw, nose_x_ratio), bounding box size, sharpness, and brightness.
    Never throws 400 Bad Request on missing face or blur, enabling smooth live coaching UI feedback.
    """
    global is_processing
    import time
    t0_req_received = time.time()
    req_id = request.headers.get("x-request-id", "UNKNOWN")
    
    try:
        if is_processing:
            return {"status": "error", "message": "ENGINE_BUSY", "face_count": 0, "quality_metrics": {}}

        is_processing = True
        try:
            contents = await file.read()
            t1_read = time.time()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            t2_decode = time.time()
            
            if img is None:
                return {"status": "error", "message": "Invalid image frame", "face_count": 0, "quality_metrics": {}}

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            mean_brightness = float(np.mean(gray))
            rms_contrast = float(np.std(gray))
            t3_preprocess = time.time()

            h, w = img.shape[:2]
            
            # Diagnostic for Phase 4H.2 Real-Browser Regression
            global active_inference_count
            
            def do_inference(image):
                global active_inference_count
                print(f"SEQUENCE_LOCK_WAIT [analyze_frame] {{ req_id: '{req_id}' }}")
                t_wait = time.time()
                if not inference_thread_lock.acquire(blocking=False):
                    print(f"ENGINE_BUSY {{ req_id: '{req_id}' }}")
                    return None, 0, 0, True # Busy
                
                try:
                    print(f"SEQUENCE_LOCK_ACQUIRED [analyze_frame] {{ req_id: '{req_id}', waitMs: {(time.time()-t_wait)*1000:.1f} }}")
                    active_inference_count += 1
                    print(f"LIVE_INFERENCE_START {{ req_id: '{req_id}', activeInferenceCount: {active_inference_count} }}")
                    
                    t4_detector_start = time.time()
                    res = face_processor.get_fast(image)
                    t5_detector_end = time.time()
                    
                    return res, t4_detector_start, t5_detector_end, False
                finally:
                    active_inference_count -= 1
                    print(f"LIVE_INFERENCE_END {{ req_id: '{req_id}', activeInferenceCount: {active_inference_count} }}")
                    print(f"SEQUENCE_LOCK_RELEASED [analyze_frame] {{ req_id: '{req_id}' }}")
                    inference_thread_lock.release()

            inference_result = await anyio.to_thread.run_sync(do_inference, img)
            if inference_result[3]:
                return {"status": "error", "message": "ENGINE_BUSY", "face_count": 0, "quality_metrics": {}}
            
            faces, t4_start, t5_end, _ = inference_result
            t6_inference = time.time()
            face_count = len(faces)
            
            if face_count != 1:
                global_blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
                t_end = time.time()
                print(f"FACE_FRAME_TIMING {{ requestId: '{req_id}', decodeMs: {(t2_decode-t0_req_received)*1000:.1f}, preprocessMs: {(t3_preprocess-t2_decode)*1000:.1f}, detectorMs: {(t5_end-t4_start)*1000:.1f}, totalMs: {(t_end-t0_req_received)*1000:.1f} }}")
                return {
                    "status": "success",
                    "face_count": face_count,
                    "embedding": None,
                    "quality_metrics": {
                        "blur_score": round(global_blur_score, 2),
                        "bbox_size": 0.0,
                        "yaw": 0.0,
                        "nose_x_ratio": 0.5,
                        "brightness": round(mean_brightness, 2),
                        "contrast": round(rms_contrast, 2),
                        "center_x": 0.5,
                        "center_y": 0.5,
                        "confidence": 0.0,
                        "bounding_box": None
                    }
                }

            face = faces[0]
            embedding = None
            nose_x_ratio = face_processor._estimate_nose_x_ratio(face)
            yaw = face_processor._estimate_head_pose(face)
            bbox_size = face_processor._estimate_bbox_size(face, img)
            t7_face_selection = time.time()
            
            blur_score = face_processor._estimate_blur_score(img, face)
            t8_quality = time.time()

            det_score = float(getattr(face, "det_score", 0.99))
            bbox_dict = None
            center_x, center_y = 0.5, 0.5
            if hasattr(face, "bbox") and face.bbox is not None and len(face.bbox) == 4 and img.shape[1] > 0 and img.shape[0] > 0:
                x1, y1, x2, y2 = face.bbox
                center_x = float((x1 + x2) / 2.0) / float(img.shape[1])
                center_y = float((y1 + y2) / 2.0) / float(img.shape[0])
                bbox_dict = {"x": int(x1), "y": int(y1), "width": int(x2 - x1), "height": int(y2 - y1)}

            t10_total_end = time.time()
            print(f"FACE_FRAME_TIMING {{ requestId: '{req_id}', decodeMs: {(t2_decode-t0_req_received)*1000:.1f}, preprocessMs: {(t3_preprocess-t2_decode)*1000:.1f}, detectorMs: {(t5_end-t4_start)*1000:.1f}, faceSelectionMs: {(t7_face_selection-t6_inference)*1000:.1f}, qualityMs: {(t8_quality-t7_face_selection)*1000:.1f}, totalMs: {(t10_total_end-t0_req_received)*1000:.1f} }}")

            return {
                "status": "success",
                "modality": "face",
                "vector_dim": 512,
                "face_count": 1,
                "embedding": None,
                "engine": "InsightFace",
                "quality_metrics": {
                    "blur_score": round(float(blur_score), 2) if blur_score is not None else 0.0,
                    "bbox_size": round(float(bbox_size), 4) if bbox_size is not None else 0.0,
                    "yaw": round(float(yaw), 4) if yaw is not None else 0.0,
                    "nose_x_ratio": round(float(nose_x_ratio), 4) if nose_x_ratio is not None else 0.5,
                    "brightness": round(mean_brightness, 2),
                    "contrast": round(rms_contrast, 2),
                    "center_x": round(center_x, 4),
                    "center_y": round(center_y, 4),
                    "confidence": round(det_score, 4),
                    "bounding_box": bbox_dict
                }
            }
        finally:
            is_processing = False
    except Exception as e:
        is_processing = False
        print(f"Error processing frame: {str(e)}")
        return JSONResponse(status_code=500, content={"error": {"code": "FRAME_ANALYSIS_FAILED", "message": f"Frame analysis failed: {str(e)}"}})

@app.post("/analyze-sequence", dependencies=[Depends(verify_api_key)])
async def analyze_sequence(request: Request, files: List[UploadFile] = File(...), expected_sequence: str = Form(...)):
    """
    Analyzes a sequence of frames for liveness detection and challenge completion.
    """
    t0_start = time.time()
    req_id = request.headers.get('x-request-id', 'UNKNOWN')
    print(f"[FACE_VERIFY_PYTHON_START] {req_id} - Receiving {len(files)} frames")
    
    try:
        async with analysis_lock:
            sequence_actions = json.loads(expected_sequence)
        if not isinstance(sequence_actions, list):
            sequence_actions = []
            
        embeddings = []
        yaws = []
        pitches = []
        ears = []
        brightness_list = []
        bboxes = []
        
        t1_prep = time.time()
        
        decode_ms = 0.0
        infer_ms = 0.0
        
        for file in files:
            t_file_start = time.time()
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            t_decode = time.time()
            decode_ms += (t_decode - t_file_start) * 1000.0
            
            if img is None:
                continue
                
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            brightness_list.append(float(np.mean(gray)))
            
            def do_seq_inference(image):
                print(f"SEQUENCE_LOCK_WAIT [get_fast] {{ req_id: '{req_id}' }}")
                t_wait = time.time()
                with inference_thread_lock:
                    print(f"SEQUENCE_LOCK_ACQUIRED [get_fast] {{ req_id: '{req_id}', waitMs: {(time.time()-t_wait)*1000:.1f} }}")
                    res = face_processor.get_fast(image)
                print(f"SEQUENCE_LOCK_RELEASED [get_fast] {{ req_id: '{req_id}' }}")
                return res
                
            t_infer_start = time.time()
            faces = await anyio.to_thread.run_sync(do_seq_inference, img)
            t_infer_end = time.time()
            infer_ms += (t_infer_end - t_infer_start) * 1000.0
            
            if len(faces) != 1:
                continue
                
            face = faces[0]
            # Defense in depth: Ensure low-confidence detections never become valid identity matches
            if float(getattr(face, "det_score", 0.0)) < 0.50:
                continue
                
            yaw = face_processor._estimate_head_pose(face)
            pitch = face_processor._estimate_pitch(face)
            
            if yaw is not None: yaws.append(yaw)
            if pitch is not None: pitches.append(pitch)
            
            if hasattr(face, "bbox") and face.bbox is not None and len(face.bbox) == 4:
                bboxes.append(face.bbox)
                
            # We save the image bytes and face to run full embedding later
            embeddings.append(img)
            
            if hasattr(face, "bbox") and face.bbox is not None and len(face.bbox) == 4:
                bboxes.append(face.bbox)

        t_loop_end = time.time()

        if len(embeddings) < 3:
            return {
                "success": False,
                "liveness": 0.0,
                "spoof_detected": False,
                "error": "INSUFFICIENT_DATA"
            }
            
        # 1. Temporal consistency
        # Ensure there is some variance (video is not perfectly static) but not too chaotic
        bbox_var = np.var([b[0] for b in bboxes]) if bboxes else 0
        brightness_var = np.var(brightness_list) if brightness_list else 0
        
        static_spoof = (bbox_var < 0.1 and brightness_var < 0.1)
        
        # 2. Challenge Response verification (Strict Temporal Ordering)
        challenge_score = 1.0
        
        # Build chronological state machine for sequence actions
        state_machine = []
        if sequence_actions:
            for action in sequence_actions:
                if action in ['TURN_LEFT', 'TURN_RIGHT']:
                    state_machine.append(action)
                    state_machine.append('RETURN_NEUTRAL')
                else:
                    # Keep BLINK or LOOK_UP if they appear (unlikely but safe)
                    state_machine.append(action)
            
            # Remove the final RETURN_NEUTRAL so the challenge completes as soon as the last movement is verified
            if state_machine and state_machine[-1] == 'RETURN_NEUTRAL':
                state_machine.pop()
                
            current_state_idx = 0
            
            # All yaw thresholds represent Radians (0.15 rad ≈ 8.6°)
            TURN_THRESHOLD = 0.15
            NEUTRAL_TOLERANCE = 0.08
            
            # 1. Establish neutral_yaw from up to 3 valid, stable frames using median to avoid noise
            neutral_frames = yaws[:min(3, len(yaws))]
            neutral_yaw = float(np.median(neutral_frames)) if neutral_frames else 0.0
            
            failed_state = None
            observed_delta = 0.0
            state_transitions = []
            
            for frame_idx, yaw in enumerate(yaws):
                if current_state_idx >= len(state_machine):
                    break
                    
                target = state_machine[current_state_idx]
                delta_yaw = yaw - neutral_yaw
                
                # Diagnostic tracking of max deviation observed during this state
                if abs(delta_yaw) > abs(observed_delta):
                    observed_delta = delta_yaw
                
                state_advanced = False
                if target == 'TURN_LEFT':
                    if delta_yaw >= TURN_THRESHOLD:
                        state_advanced = True
                elif target == 'TURN_RIGHT':
                    if delta_yaw <= -TURN_THRESHOLD:
                        state_advanced = True
                elif target == 'RETURN_NEUTRAL':
                    if abs(delta_yaw) <= NEUTRAL_TOLERANCE:
                        state_advanced = True
                else:
                    state_advanced = True
                    
                if state_advanced:
                    state_transitions.append({
                        "state": target,
                        "frame": frame_idx,
                        "deltaYaw": delta_yaw
                    })
                    current_state_idx += 1
                    observed_delta = 0.0
            
            if current_state_idx < len(state_machine):
                failed_state = state_machine[current_state_idx]
                return {
                    "success": False,
                    "liveness": 0.2,
                    "spoof_detected": False,
                    "error": "LIVENESS_SEQUENCE_INCOMPLETE",
                    "diagnostics": {
                        "failedState": failed_state,
                        "neutralYaw": neutral_yaw,
                        "observedDeltaYaw": observed_delta,
                        "requiredDeltaYaw": TURN_THRESHOLD,
                        "frameIndex": len(yaws) - 1,
                        "stateTransitions": state_transitions
                    }
                }
            else:
                challenge_score = 1.0
                
        # Calculate liveness
        if static_spoof:
            liveness = 0.1
        else:
            # Baseline 0.5 for non-static, plus up to 0.5 for passing challenges
            liveness = 0.5 + (0.5 * challenge_score)
            
        # Cap at 1.0
        liveness = min(1.0, max(0.0, liveness))
        
        # Select the best neutral frame for identity comparison (lowest absolute yaw)
        best_emb = []
        if len(embeddings) > 0 and len(yaws) == len(embeddings):
            best_idx = 0
            min_abs_yaw = float('inf')
            for i, yaw in enumerate(yaws):
                if abs(yaw) < min_abs_yaw:
                    min_abs_yaw = abs(yaw)
                    best_idx = i
            best_img = embeddings[best_idx]
            
            def extract_best_emb(img):
                print(f"SEQUENCE_LOCK_WAIT [full_emb] {{ req_id: '{req_id}' }}")
                t_wait = time.time()
                with inference_thread_lock:
                    print(f"SEQUENCE_LOCK_ACQUIRED [full_emb] {{ req_id: '{req_id}', waitMs: {(time.time()-t_wait)*1000:.1f} }}")
                    print(f"FULL_EMBEDDING_START {{ req_id: '{req_id}' }}")
                    res = face_processor._model.get(img)
                    print(f"FULL_EMBEDDING_END {{ req_id: '{req_id}' }}")
                print(f"SEQUENCE_LOCK_RELEASED [full_emb] {{ req_id: '{req_id}' }}")
                return res
                    
            t_extract_start = time.time()
            full_faces = await anyio.to_thread.run_sync(extract_best_emb, best_img)
            t_extract_end = time.time()
            infer_ms += (t_extract_end - t_extract_start) * 1000.0
            
            if len(full_faces) == 1:
                best_emb = full_faces[0].embedding.astype(np.float32).tolist()
        elif len(embeddings) > 0:
            # Fallback if yaws array is out of sync for some reason
            def extract_best_emb(img):
                print(f"SEQUENCE_LOCK_WAIT [full_emb_fallback] {{ req_id: '{req_id}' }}")
                t_wait = time.time()
                with inference_thread_lock:
                    print(f"SEQUENCE_LOCK_ACQUIRED [full_emb_fallback] {{ req_id: '{req_id}', waitMs: {(time.time()-t_wait)*1000:.1f} }}")
                    print(f"FULL_EMBEDDING_START {{ req_id: '{req_id}' }}")
                    res = face_processor._model.get(img)
                    print(f"FULL_EMBEDDING_END {{ req_id: '{req_id}' }}")
                print(f"SEQUENCE_LOCK_RELEASED [full_emb_fallback] {{ req_id: '{req_id}' }}")
                return res
            full_faces = await anyio.to_thread.run_sync(extract_best_emb, embeddings[0])
            if len(full_faces) == 1:
                best_emb = full_faces[0].embedding.astype(np.float32).tolist()
        
        spoof_detected = liveness < 0.3 or static_spoof

        t_end = time.time()
        print(f"FACE_SEQUENCE_TIMING {{ requestId: '{req_id}', frameCount: {len(files)}, decodeMs: {decode_ms:.1f}, fullModelInferenceMs: {infer_ms:.1f}, totalMs: {(t_end - t0_start) * 1000.0:.1f} }}")
        print(f"[FACE_VERIFY_PYTHON_END] {req_id}")

        return {
            "success": True,
            "liveness": round(float(liveness), 4),
            "spoof_detected": bool(spoof_detected),
            "embedding": best_emb,
            "metrics": {
                "challenge_score": float(challenge_score),
                "bbox_variance": float(bbox_var),
                "brightness_variance": float(brightness_var),
                "frames_processed": len(embeddings)
            }
        }

    except Exception as e:
        print(f"Error processing sequence: {str(e)}")
        return JSONResponse(status_code=500, content={"error": {"code": "SEQUENCE_ANALYSIS_FAILED", "message": str(e)}})
        print(f"Error in analyze-frame: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Voice endpoints ────────────────────────────────────────────────────────────

@app.post("/extract-voice-embedding", dependencies=[Depends(verify_api_key)])
async def extract_voice_embedding(file: UploadFile = File(...)):
    """
    Extracts a robust 192-d ECAPA-TDNN speaker embedding from live audio.
    Returns the normalized vector which is suitable for cosine similarity matching.
    """
    tmp_path = None
    try:
        if voice_classifier is None:
             raise HTTPException(status_code=503, detail="Voice classifier is not initialized.")
             
        contents = await file.read()
        if len(contents) < 1000:
            raise HTTPException(status_code=400, detail="Audio file too small.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        import soundfile as sf
        import numpy as np
        import torch
        import torchaudio

        # Phase 3 - AUDIO STANDARDIZATION
        speech, sr = sf.read(tmp_path)
        
        # Convert to mono if necessary
        if len(speech.shape) > 1:
            speech = np.mean(speech, axis=1)
            
        # Resample to 16000 if necessary
        if sr != 16000:
            resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)
            speech = resampler(torch.tensor(speech, dtype=torch.float32)).numpy()
            sr = 16000
            
        # Ensure float32 scaling
        speech = np.array(speech, dtype=np.float32)
        total_duration = float(len(speech)) / float(sr)

        # Phase 7 - KEEP WHISPER SEPARATE
        raw_text = ""
        normalized_text = ""
        if whisper_pipe is not None:
            try:
                # Whisper is ONLY used for transcription. Timestamps are disabled.
                transcription = whisper_pipe({"raw": speech, "sampling_rate": sr}, generate_kwargs={"language": "en"}, return_timestamps=False)
                raw_text = transcription["text"]
                normalized_text = normalize_text(raw_text)
            except Exception as w_e:
                print(f"Whisper transcription failed: {w_e}")

        # Phase 4 - VAD PROCESSING
        if vad_model is None:
            raise HTTPException(status_code=503, detail="VAD model is not initialized.")
            
        speech_tensor = torch.tensor(speech, dtype=torch.float32)
        vad_model.eval()
        
        # Detect frame-level speech timestamps
        speech_timestamps = get_speech_timestamps(speech_tensor, vad_model, sampling_rate=16000, speech_pad_ms=150)
        
        # Phase 5 - SAFETY VALIDATION
        if not speech_timestamps:
            raise HTTPException(status_code=400, detail="VAD FAILURE: No speech detected in audio.")
            
        # Concatenate speech segments, removing silence but preserving legitimate pauses
        trimmed_speech_tensor = collect_chunks(speech_timestamps, speech_tensor)
        trimmed_speech = trimmed_speech_tensor.numpy()
        speech_duration = float(len(trimmed_speech)) / 16000.0
        
        if speech_duration < 0.5:
             raise HTTPException(status_code=400, detail=f"VAD FAILURE: Detected speech is too short ({speech_duration:.2f}s) for biometric processing.")

        # Phase 8/9 - Extract ECAPA Embedding
        embedding = extract_ecapa_embedding(signal_np=trimmed_speech, fs=16000)

        # Phase 6 - QUALITY METRICS
        speech_ratio = speech_duration / total_duration if total_duration > 0 else 0.0

        return {
            "success": True,
            "status": "success",
            "modality": "voice",
            "vector_dim": 192,
            "embedding": embedding.tolist(),
            "raw_text": raw_text,
            "normalized_text": normalized_text,
            "engine": "SpeechBrain",
            "model": {
                "name": "spkrec-ecapa-voxceleb",
                "dimensions": 192
            },
            "metrics": {
                "length_bytes": len(contents),
                "total_duration": total_duration,
                "speech_duration": speech_duration,
                "speech_ratio": speech_ratio,
                "vad_segments": len(speech_timestamps)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error extracting voice embedding: {e}")
        return JSONResponse(status_code=500, content={"error": {"code": "VOICE_EXTRACTION_FAILED", "message": str(e)}})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
