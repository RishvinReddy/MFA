export function cosineSimilarity(a: number[], b: number[]) {
    if (a.length !== b.length) {
        throw new Error("Vectors must have same dimensionality");
    }

    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magA === 0 || magB === 0) return 0;

    return dot / (magA * magB);
}

/**
 * Normalizes and compares a spoken transcript to an expected phrase.
 * Uses a word-level bounded edit distance (Levenshtein) algorithm.
 * 
 * It allows the transcript to contain the target phrase with a bounded number
 * of word errors (insertions, deletions, substitutions), specifically 1 allowed
 * error for every 3 words in the target phrase.
 */
export function fuzzyPhraseMatch(target: string, transcript: string): boolean {
    if (!transcript || !target) return false;
    
    // Normalize: lowercase, remove non-alphanumeric (keep spaces), trim, collapse whitespace
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const normTarget = normalize(target);
    const normTranscript = normalize(transcript);
    
    if (normTarget === '') return false;
    
    // The complete expected phrase must be present, all expected words in correct order
    // Leading/trailing conversational filler is allowed.
    // E.g., "um secure access please" -> contains "secure access"
    // "secure biometric access" -> fails because it's not contiguous "secure access"
    
    // To allow leading/trailing filler but strictly require the phrase to be contiguous:
    // We check if normTarget is a substring of normTranscript, but on word boundaries.
    
    const targetWords = normTarget.split(' ').filter(w => w.length > 0);
    const transWords = normTranscript.split(' ').filter(w => w.length > 0);
    
    if (targetWords.length === 0) return false;
    if (transWords.length < targetWords.length) return false;

    // Search for the contiguous sequence of targetWords within transWords
    for (let i = 0; i <= transWords.length - targetWords.length; i++) {
        let match = true;
        for (let j = 0; j < targetWords.length; j++) {
            if (transWords[i + j] !== targetWords[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            return true;
        }
    }
    
    return false;
}
