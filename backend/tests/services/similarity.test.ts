import { fuzzyPhraseMatch } from '../../src/utils/similarity';

describe('fuzzyPhraseMatch', () => {
    it('should return true for identical phrases', () => {
        expect(fuzzyPhraseMatch('BioShield secure authentication', 'BioShield secure authentication')).toBe(true);
    });

    it('should ignore case and punctuation', () => {
        expect(fuzzyPhraseMatch('BioShield secure authentication', 'bioshield, secure authentication!')).toBe(true);
    });

    it('should return false if transcription is empty', () => {
        expect(fuzzyPhraseMatch('BioShield secure authentication', '')).toBe(false);
    });

    it('should return false if target is empty', () => {
        expect(fuzzyPhraseMatch('', 'BioShield secure authentication')).toBe(false);
    });

    it('should allow minor variations (e.g. bioshield as two words)', () => {
        expect(fuzzyPhraseMatch('BioShield secure authentication', 'bio shield secure authentication')).toBe(true);
    });

    it('should allow extra words around the exact match', () => {
        expect(fuzzyPhraseMatch('secure access', 'yes secure access now')).toBe(true);
    });

    it('should reject completely different phrases', () => {
        expect(fuzzyPhraseMatch('BioShield verifies my identity', 'hello world this is a test')).toBe(false);
        expect(fuzzyPhraseMatch('open the vault', 'digital shield')).toBe(false);
    });

    it('should handle small target phrases', () => {
        // "secure access" is 2 words. Allowed errors: max(1, floor(2/3)) = 1.
        expect(fuzzyPhraseMatch('secure access', 'secure')).toBe(true); // 1 error (deletion)
        expect(fuzzyPhraseMatch('secure access', 'access')).toBe(true); // 1 error (deletion)
        expect(fuzzyPhraseMatch('secure access', 'hello world')).toBe(false); // 2 errors
    });

    it('should handle large target phrases', () => {
        const target = 'my voice confirms who i am and grants access'; // 9 words. Allowed errors: 3
        expect(fuzzyPhraseMatch(target, 'my voice confirms who i am grants access')).toBe(true); // 1 deletion
        expect(fuzzyPhraseMatch(target, 'voice confirms who am grants access')).toBe(true); // 3 deletions (my, i, and)
        expect(fuzzyPhraseMatch(target, 'this is totally wrong')).toBe(false);
    });
});
