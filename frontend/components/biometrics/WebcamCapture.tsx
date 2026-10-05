import React, { useRef, useState, useCallback } from 'react';
import { Camera, CheckCircle, RefreshCw, X } from 'lucide-react';

interface WebcamCaptureProps {
    onCapture: (file: File) => void;
    label?: string;
}

export const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, label = "Face Capture" }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string>('');

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: "user" }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setIsStreaming(true);
                setError('');
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            setError("Camera access denied or unavailable.");
        }
    };

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsStreaming(false);
        }
    }, [stream]);

    const capture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "face_capture.jpg", { type: "image/jpeg" });
                        const previewUrl = URL.createObjectURL(blob);
                        setCapturedImage(previewUrl);
                        onCapture(file);
                        stopCamera();
                    }
                }, 'image/jpeg', 0.9);
            }
        }
    };

    const reset = () => {
        setCapturedImage(null);
        startCamera();
    };

    // Cleanup on unmount
    React.useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    return (
        <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                {label}
            </h3>

            {error && (
                <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <div className="relative w-full max-w-sm aspect-video bg-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {!isStreaming && !capturedImage && !error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <button
                            onClick={startCamera}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Enable Camera
                        </button>
                    </div>
                )}

                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover transform scale-x-[-1] ${capturedImage ? 'hidden' : 'block'}`}
                />

                {capturedImage && (
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                )}

                <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="mt-4 flex gap-3">
                {isStreaming && !capturedImage && (
                    <button
                        onClick={capture}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        Capture
                    </button>
                )}

                {capturedImage && (
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retake
                    </button>
                )}
            </div>
        </div>
    );
};
