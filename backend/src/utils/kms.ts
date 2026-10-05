import crypto from "crypto";

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.KMS_SECRET || '', "hex");
const iv = crypto.randomBytes(16);

export function encrypt(text: string) {
    if (!process.env.KMS_SECRET) {
        throw new Error("KMS_SECRET is not defined");
    }
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted =
        cipher.update(text, "utf8", "hex") +
        cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string) {
    if (!process.env.KMS_SECRET) {
        throw new Error("KMS_SECRET is not defined");
    }
    const [ivHex, encryptedHex] = text.split(':');
    const ivBuffer = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    const decrypted = decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8');
    return decrypted;
}
