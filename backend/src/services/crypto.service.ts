import crypto from "crypto";
import argon2 from "argon2";
import bcrypt from "bcrypt";

const ALGORITHM = "aes-256-gcm";

export class CryptoService {
    /**
     * Strictly validates the biometric key. Fails closed (throws) if invalid.
     * Must be called during application startup (e.g., in index.ts).
     */
    static validateBiometricKey() {
        const key = process.env.BIOMETRIC_KEY;
        if (!key) {
            throw new Error("FATAL: BIOMETRIC_KEY is not defined in environment variables. Refusing to start.");
        }
        if (key.length !== 64) {
            throw new Error("FATAL: BIOMETRIC_KEY must be exactly 64 hex characters (32 bytes).");
        }
        if (key === '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff' || key === 'your-32-byte-hex-encoded-secure-key-here-must-be-changed') {
            throw new Error("FATAL: Default/hardcoded BIOMETRIC_KEY detected. Refusing to start.");
        }
        // Test parsing
        const buffer = Buffer.from(key, "hex");
        if (buffer.length !== 32) {
            throw new Error("FATAL: BIOMETRIC_KEY could not be parsed into 32 bytes.");
        }
    }

    private static getBiometricKeyBuffer(): Buffer {
        const key = process.env.BIOMETRIC_KEY;
        if (!key || key.length !== 64) {
            throw new Error("BIOMETRIC_KEY is invalid or missing.");
        }
        return Buffer.from(key, "hex");
    }

    /**
     * Hashes a password using Argon2id
     */
    static async hashPassword(password: string): Promise<string> {
        return await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16, // 64 MB
            timeCost: 3,
            parallelism: 1,
        });
    }

    /**
     * Verifies a password against a hash, supporting seamless bcrypt -> Argon2id migration.
     * Returns whether it's valid, the algorithm used, and if a rehash to Argon2id is needed.
     */
    static async verifyPassword(hash: string, plain: string): Promise<{ valid: boolean, algorithm: 'bcrypt' | 'argon2id' | 'unknown', needsRehash: boolean }> {
        try {
            if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
                const valid = await bcrypt.compare(plain, hash);
                return { valid, algorithm: 'bcrypt', needsRehash: valid }; // Needs rehash if valid
            }
            if (hash.startsWith("$argon2")) {
                const valid = await argon2.verify(hash, plain);
                // Currently Argon2id is the target, but if parameters change in the future, argon2.needsRehash() could be checked here.
                return { valid, algorithm: 'argon2id', needsRehash: false };
            }
            return { valid: false, algorithm: 'unknown', needsRehash: false };
        } catch (error) {
            return { valid: false, algorithm: 'unknown', needsRehash: false };
        }
    }

    /**
     * Encrypts biometric template embeddings for protected database storage using AES-256-GCM.
     */
    static encryptTemplate(data: string): string {
        const keyBuffer = this.getBiometricKeyBuffer();
        const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM

        const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag().toString('hex');

        // Format: version:algorithm:iv:authTag:ciphertext
        return `v1:gcm:${iv.toString("hex")}:${authTag}:${encrypted}`;
    }

    /**
     * Decrypts biometric template embeddings using AES-256-GCM.
     */
    static decryptTemplate(data: string): string {
        const parts = data.split(":");
        
        // Handle legacy CBC format if necessary for backwards compatibility during testing
        if (parts.length === 2) {
            const iv = Buffer.from(parts[0], "hex");
            const encryptedText = parts[1];
            const keyBuffer = this.getBiometricKeyBuffer();
            const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv);
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }

        if (parts.length !== 5 || parts[0] !== 'v1' || parts[1] !== 'gcm') {
            throw new Error("Invalid encrypted data format or unsupported version/algorithm");
        }

        const iv = Buffer.from(parts[2], "hex");
        const authTag = Buffer.from(parts[3], "hex");
        const encryptedText = parts[4];
        const keyBuffer = this.getBiometricKeyBuffer();

        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Generates a cryptographically secure random token (e.g., Session IDs, Recovery Codes, Enrollment Tokens)
     */
    static generateSecureToken(bytes: number = 32): string {
        return crypto.randomBytes(bytes).toString("hex");
    }
}
