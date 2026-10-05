import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const MASTER_KEY_HEX = process.env.MASTER_KEY_HEX;

if (!MASTER_KEY_HEX || MASTER_KEY_HEX.length !== 64) {
    throw new Error("CRITICAL: MASTER_KEY_HEX must be a 64-character (32-byte) hex string in .env");
}

const masterKey = Buffer.from(MASTER_KEY_HEX, 'hex');

/**
 * Generate a random Data Engine Key (DEK) for envelope encryption
 * @returns { plaintext, ciphertextBlob }
 */
export async function generateDataKey() {
    // Generate a random 32-byte (256-bit) Data Encryption Key
    const plaintext = crypto.randomBytes(32);
    
    // Encrypt this DEK with our Master Key
    const ciphertextBlob = await encryptWithKMS(plaintext);

    return {
        plaintext,
        ciphertextBlob
    };
}

/**
 * Encrypts data using AES-256-GCM with the Master Key
 * @param plaintext The data to encrypt
 * @returns A Buffer containing [IV (12 bytes) | Auth Tag (16 bytes) | Ciphertext]
 */
export async function encryptWithKMS(plaintext: Uint8Array): Promise<Buffer> {
    const iv = crypto.randomBytes(12); // 96-bit IV is standard for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    
    let ciphertext = cipher.update(plaintext);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    
    const authTag = cipher.getAuthTag(); // 16 bytes
    
    // Combine into a single blob: IV + AuthTag + Ciphertext
    return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypts data using AES-256-GCM with the Master Key
 * @param ciphertextBlob Buffer containing [IV (12 bytes) | Auth Tag (16 bytes) | Ciphertext]
 * @returns The decrypted plaintext Buffer
 */
export async function decryptWithKMS(ciphertextBlob: Uint8Array): Promise<Buffer> {
    const buffer = Buffer.from(ciphertextBlob);
    
    if (buffer.length < 28) { // 12 bytes IV + 16 bytes AuthTag
        throw new Error("Invalid ciphertext blob length");
    }
    
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(authTag);
    
    try {
        let plaintext = decipher.update(ciphertext);
        plaintext = Buffer.concat([plaintext, decipher.final()]);
        return plaintext;
    } catch (err) {
        throw new Error("Decryption failed. The data may be tampered with or the Master Key is incorrect.");
    }
}
