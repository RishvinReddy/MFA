import { cosineSimilarity } from '../controllers/biometric.controller';

describe('Biometric Face Verification Logic (Cosine Similarity)', () => {
    
    test('Identical embedding should PASS with similarity 1.0', () => {
        const emb1 = Array(512).fill(0).map(() => Math.random());
        const similarity = cosineSimilarity(emb1, emb1);
        expect(similarity).toBeCloseTo(1.0, 5);
    });

    test('Same person + small embedding noise should PASS with very high similarity', () => {
        const emb1 = Array(512).fill(0).map(() => Math.random() + 0.1);
        const emb2 = emb1.map(val => val + (Math.random() - 0.5) * 0.02); // Add minor noise
        const similarity = cosineSimilarity(emb1, emb2);
        expect(similarity).toBeGreaterThan(0.95);
    });

    test('Clearly different embeddings should FAIL with low similarity', () => {
        // Orthogonal vectors
        const emb1 = Array(512).fill(0);
        emb1[0] = 1.0;
        const emb2 = Array(512).fill(0);
        emb2[1] = 1.0;
        
        const similarity = cosineSimilarity(emb1, emb2);
        expect(similarity).toBe(0.0);
    });

    test('Opposite embedding should yield similarity -1.0', () => {
        const emb1 = Array(512).fill(0).map(() => Math.random() + 0.1);
        const emb2 = emb1.map(val => -val);
        const similarity = cosineSimilarity(emb1, emb2);
        expect(similarity).toBeCloseTo(-1.0, 5);
    });

    test('Empty template should return similarity 0.0', () => {
        const emb1 = [1, 2, 3];
        const emb2: number[] = [];
        const similarity = cosineSimilarity(emb1, emb2);
        expect(similarity).toBe(0.0);
    });

    test('Zero-norm embedding should fail gracefully returning 0.0 instead of NaN', () => {
        const emb1 = Array(512).fill(0);
        const emb2 = Array(512).fill(0).map(() => Math.random());
        const similarity = cosineSimilarity(emb1, emb2);
        expect(similarity).toBe(0.0);
        expect(isNaN(similarity)).toBe(false);
    });

    test('Dimension mismatch should return similarity 0.0', () => {
        const emb1 = Array(512).fill(0).map(() => Math.random());
        const emb2 = Array(256).fill(0).map(() => Math.random());
        const similarity = cosineSimilarity(emb1, emb2);
        expect(similarity).toBe(0.0);
    });
});
