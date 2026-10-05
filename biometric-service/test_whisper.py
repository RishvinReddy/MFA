import sys
import time
import string
import re

try:
    from transformers import pipeline
except ImportError as e:
    print(f"Error importing transformers: {e}")
    sys.exit(1)

def normalize_text(text: str) -> str:
    # Lowercase
    text = text.lower()
    # Remove punctuation
    text = text.translate(str.maketrans('', '', string.punctuation))
    # Remove leading/trailing and deduplicate internal whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def test_whisper():
    print("Loading Whisper model (openai/whisper-tiny)...")
    start_load = time.time()
    try:
        # Load the whisper-tiny model for automatic speech recognition
        pipe = pipeline("automatic-speech-recognition", model="openai/whisper-tiny")
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")
        sys.exit(1)
        
    load_time = time.time() - start_load
    print(f"Whisper model loaded in {load_time:.2f} seconds.")

    test_wav = "dummy1.wav"
    
    print(f"Transcribing file: {test_wav}...")
    start_transcribe = time.time()
    
    try:
        import librosa
        # Load audio natively to avoid ffmpeg requirement in transformers
        speech, sr = librosa.load(test_wav, sr=16000)
        
        # Transcribe
        result = pipe({"raw": speech, "sampling_rate": sr})
    except Exception as e:
        print(f"Failed to transcribe audio: {e}")
        sys.exit(1)
        
    transcribe_time = time.time() - start_transcribe
    
    raw_text = result["text"]
    normalized = normalize_text(raw_text)
    
    print(f"Transcription complete in {transcribe_time:.2f} seconds.")
    print(f"Raw Transcription: '{raw_text}'")
    print(f"Normalized Transcription: '{normalized}'")
    
if __name__ == "__main__":
    test_whisper()
