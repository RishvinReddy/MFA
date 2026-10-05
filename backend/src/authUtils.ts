
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'super_refresh_secret_key_change_in_prod';

if (!JWT_SECRET) {
    throw new Error("CRITICAL: JWT_SECRET environment variable is missing.");
}

interface TokenPayload {
    id: string;
    email: string;
    role: string;
}

export const generateToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
        return null;
    }
};

export const verifyRefreshToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
    } catch (error) {
        return null;
    }
};

export const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

export const hashRefreshToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};
