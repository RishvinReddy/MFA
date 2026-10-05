import React, { useRef, useState } from 'react';
import { Mic, Square, Play, RefreshCw, CheckCircle } from 'lucide-react';

interface AudioRecorderProps {
    onCapture: (file: File) => void;
    label?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onCapture, label = "Voice Sample" }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string>('');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                const file = new File([blob], "voice_sample.wav", { type: "audio/wav" });
                onCapture(file);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setError('');
        } catch (err) {
            console.error("Error accessing microphone:", err);
            setError("Microphone access denied or unavailable.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const reset = () => {
        setAudioUrl(null);
        setIsRecording(false);
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 transition-colors">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Mic className={`w-4 h-4 ${isRecording ? 'text-red-500 animate-pulse' : 'text-blue-600'}`} />
                {label}
            </h3>

            {error && (
                <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <div className="flex items-center gap-4">
                {!isRecording && !audioUrl && (
                    <button
                        onClick={startRecording}
                        className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                    >
                        <Mic className="w-8 h-8" />
                    </button>
                )}

                {isRecording && (
                    <button
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg animate-pulse"
                    >
                        <Square className="w-6 h-6 fill-current" />
                    </button>
                )}

                {audioUrl && (
                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <audio src={audioUrl} controls className="h-8 w-48" />
                        <button
                            onClick={reset}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <div className="text-emerald-500">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                    </div>
                )}
            </div>

            <p className="mt-3 text-xs text-slate-400 text-center">
                {isRecording ? "Listening... Speak naturally." : audioUrl ? "Voice sample captured." : "Press mic to record voice sample."}
            </p>
        </div>
    );
};
