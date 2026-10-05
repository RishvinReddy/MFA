from __future__ import annotations

import cv2
import numpy as np
from typing import Optional, Tuple


class FaceProcessor:
    """
    Real face embedding extractor using InsightFace.
    Produces 512-d face embedding vectors.
    """

    def __init__(self) -> None:
        self._model = None
        self._init_error: Optional[str] = None

        try:
            from insightface.app import FaceAnalysis

            self._model = FaceAnalysis(name="buffalo_l")
            # det_thresh is set to default 0.50. Do not lower this without security review.
            self._model.prepare(ctx_id=0, det_size=(640, 640), det_thresh=0.50)
        except Exception as e:
            self._init_error = f"{type(e).__name__}: {e}"
            self._model = None

    @property
    def is_available(self) -> bool:
        return self._model is not None

    def count_faces(self, bgr_img: np.ndarray) -> int:
        if self._model is None:
            raise ValueError("FACE_PROCESSOR_UNAVAILABLE")

        if bgr_img is None or bgr_img.size == 0:
            raise ValueError("INVALID_IMAGE")

        faces = self._model.get(bgr_img)
        return len(faces)

    def get_fast(self, bgr_img: np.ndarray):
        """
        Fast face detection for live liveness frames.
        ONLY runs the SCRFD detector (det_model).
        Deliberately skips ALL secondary models:
          - landmark_3d_68 (expensive)
          - landmark_2d_106 (expensive)
          - genderage (unnecessary for liveness)
          - recognition/w600k_r50 (forbidden during live loop — 512-D embedding)
        This is intentional and audited. Do not add model.get() calls here.
        """
        import time as _time
        if self._model is None:
            raise ValueError("FACE_PROCESSOR_UNAVAILABLE")
        from insightface.app.common import Face

        t_detect_start = _time.perf_counter()
        bboxes, kpss = self._model.det_model.detect(bgr_img, max_num=0, metric='default')
        t_detect_end = _time.perf_counter()

        if bboxes.shape[0] == 0:
            print(f"[get_fast] detect={((t_detect_end-t_detect_start)*1000):.0f}ms faces=0")
            return []

        t_post_start = _time.perf_counter()
        ret = []
        for i in range(bboxes.shape[0]):
            bbox = bboxes[i, 0:4]
            det_score = bboxes[i, 4]
            kps = kpss[i] if kpss is not None else None
            # NOTE: We do NOT call any model.get() here.
            # kps gives us the 5-point keypoints (eyes, nose, mouth corners)
            # which is sufficient for pose estimation in liveness.
            face = Face(bbox=bbox, kps=kps, det_score=det_score)
            ret.append(face)
        t_post_end = _time.perf_counter()

        print(f"[get_fast] detect={((t_detect_end-t_detect_start)*1000):.0f}ms "
              f"post={((t_post_end-t_post_start)*1000):.0f}ms "
              f"faces={len(ret)}")
        return ret

    def extract_embedding(self, bgr_img: np.ndarray) -> np.ndarray:
        embedding, nose_x_ratio, yaw, bbox_size, blur_score = self.extract_embedding_and_pose(bgr_img)
        return embedding


    def extract_embedding_and_pose(self, bgr_img: np.ndarray):
        """
        Returns:
            embedding: np.ndarray
            nose_x_ratio: float | None
            yaw: float | None
            bbox_size: float | None (yüzün görüntüdeki oranı)
            blur_score: float | None (yüksekse net, düşükse bulanık)
        """
        if self._model is None:
            raise ValueError("FACE_PROCESSOR_UNAVAILABLE")

        if bgr_img is None or bgr_img.size == 0:
            raise ValueError("INVALID_IMAGE")

        faces = self._model.get(bgr_img)
        if len(faces) == 0:
            raise ValueError("FACE_NOT_DETECTED")

        face = faces[0]
        embedding = face.embedding.astype(np.float32)
        nose_x_ratio = self._estimate_nose_x_ratio(face)

        # Head pose (yaw) tahmini (landmarklardan basit yaklaşım)
        yaw = self._estimate_head_pose(face)

        # Bounding box oranı (yüzün görüntüdeki alanı)
        bbox_size = self._estimate_bbox_size(face, bgr_img)

        # Blur (bulanıklık) ölçümü
        blur_score = self._estimate_blur_score(bgr_img, face)

        return embedding, nose_x_ratio, yaw, bbox_size, blur_score

    def _estimate_head_pose(self, face) -> float | None:
        """
        Basit head pose tahmini: yaw (sağa/sola dönüş)
        """
        kps = getattr(face, "kps", None)
        if kps is None or len(kps) < 5:
            return None
        pts = np.asarray(kps, dtype=np.float32)
        left_eye = pts[0]
        right_eye = pts[1]
        nose = pts[2]
        # Yaw: gözler arası yatay fark ile burun
        eye_dx = right_eye[0] - left_eye[0]
        nose_dx = nose[0] - (left_eye[0] + right_eye[0]) / 2
        yaw = nose_dx / (eye_dx + 1e-6)
        return float(yaw)

    def _estimate_bbox_size(self, face, bgr_img) -> float | None:
        bbox = getattr(face, "bbox", None)
        if bbox is None or len(bbox) != 4:
            return None
        x1, y1, x2, y2 = bbox
        face_area = max(0, (x2 - x1)) * max(0, (y2 - y1))
        img_area = bgr_img.shape[0] * bgr_img.shape[1]
        if img_area == 0:
            return None
        return float(face_area) / float(img_area)

    def _estimate_blur_score(self, bgr_img, face) -> float | None:
        bbox = getattr(face, "bbox", None)
        if bbox is None or len(bbox) != 4:
            return None
        x1, y1, x2, y2 = [int(v) for v in bbox]
        face_crop = bgr_img[max(0, y1):max(0, y2), max(0, x1):max(0, x2)]
        if face_crop.size == 0:
            return None
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        return float(laplacian_var)

    def _estimate_nose_x_ratio(self, face) -> Optional[float]:
        """
        Estimate nose horizontal position relative to eye line.
        Returns a normalized ratio where ~0.5 is frontal.
        """
        kps = getattr(face, "kps", None)
        if kps is None:
            return None

        pts = np.asarray(kps, dtype=np.float32)
        if pts.shape[0] < 3:
            return None

        left_eye = pts[0]
        right_eye = pts[1]
        nose = pts[2]

        eye_span = float(right_eye[0] - left_eye[0])
        if abs(eye_span) < 1e-6:
            return None

        ratio = float((nose[0] - left_eye[0]) / eye_span)
        if not np.isfinite(ratio):
            return None

        return ratio

    def _estimate_pitch(self, face) -> float | None:
        """
        Estimate pitch (looking up/down) using 2D landmarks (kps).
        kps: 0=LeftEye, 1=RightEye, 2=Nose, 3=LeftMouth, 4=RightMouth
        """
        kps = getattr(face, "kps", None)
        if kps is None or len(kps) < 5:
            return None
        pts = np.asarray(kps, dtype=np.float32)
        left_eye = pts[0]
        right_eye = pts[1]
        nose = pts[2]
        mouth = (pts[3] + pts[4]) / 2.0

        eye_y = (left_eye[1] + right_eye[1]) / 2.0
        nose_y = nose[1]
        mouth_y = mouth[1]

        # Distances
        eye_to_nose = abs(nose_y - eye_y)
        nose_to_mouth = abs(mouth_y - nose_y)

        # Ratio: <1 means looking up, >1 means looking down roughly
        pitch_ratio = eye_to_nose / (nose_to_mouth + 1e-6)
        return float(pitch_ratio)

    def _estimate_ear(self, face) -> float | None:
        """
        Estimate Eye Aspect Ratio using 3D 68 landmarks if available.
        """
        lmk = getattr(face, "landmark_3d_68", None)
        if lmk is None:
            # Fallback to 2d_106 if available
            lmk = getattr(face, "landmark_2d_106", None)
            if lmk is None:
                return None
            
            # Very rough estimation if only 106 landmarks are present
            # For 106 points, eyes are around 35-42 (left) and 89-96 (right)
            # Just approximate the distance or fallback.
            # Insightface returns landmark_3d_68 if the model is loaded.
            return None
            
        pts = np.asarray(lmk, dtype=np.float32)
        
        # 68 points:
        # Left eye: 36, 37, 38, 39, 40, 41
        # Right eye: 42, 43, 44, 45, 46, 47
        
        def eye_aspect_ratio(eye):
            A = np.linalg.norm(eye[1] - eye[5])
            B = np.linalg.norm(eye[2] - eye[4])
            C = np.linalg.norm(eye[0] - eye[3])
            return (A + B) / (2.0 * C + 1e-6)
            
        left_eye = pts[36:42]
        right_eye = pts[42:48]
        
        ear_left = eye_aspect_ratio(left_eye)
        ear_right = eye_aspect_ratio(right_eye)
        
        return float((ear_left + ear_right) / 2.0)