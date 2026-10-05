import prisma from '../prisma';

export interface FusionConfigCache {
    weights: {
        face: number;
        voice: number;
        keyboardBehavior: number;
        mouseBehavior: number;
    };
    minimumQuality: {
        face: number;
        voice: number;
    };
    evidenceTTL: {
        face: number; // in seconds
        voice: number;
        behavior: number;
    };
    confidenceThresholds: {
        low: number;
        medium: number;
        high: number;
    };
    configurationVersion: number;
    updatedAt: Date;
}

export class ConfigService {
    private static cache: FusionConfigCache | null = null;
    private static lastFetched: number = 0;
    private static readonly CACHE_TTL_MS = 60000; // 1 minute local TTL

    /**
     * Retrieves the FusionConfiguration, utilizing an in-memory cache.
     * The cache is refreshed if expired. 
     * In a clustered environment, a Redis pub/sub would invalidate this instantly.
     */
    static async getFusionConfig(): Promise<FusionConfigCache> {
        const now = Date.now();
        if (this.cache && (now - this.lastFetched) < this.CACHE_TTL_MS) {
            return this.cache;
        }

        // Fetch from DB (assuming ID 'default' or picking the latest)
        let configRecord = await prisma.fusionConfiguration.findFirst({
            orderBy: { version: 'desc' }
        });

        // If none exists, create default prototype config
        if (!configRecord) {
            configRecord = await prisma.fusionConfiguration.create({
                data: {
                    version: 1,
                    faceWeight: 0.6,
                    voiceWeight: 0.4,
                    behaviorWeight: 0.0, // Milestone 3
                    deviceWeight: 0.0,
                    minimumFaceConfidence: 0.7,
                    minimumVoiceConfidence: 0.7,
                    signalExpirySeconds: 300
                }
            });
        }

        this.cache = {
            weights: {
                face: configRecord.faceWeight,
                voice: configRecord.voiceWeight,
                keyboardBehavior: configRecord.behaviorWeight,
                mouseBehavior: configRecord.behaviorWeight
            },
            minimumQuality: {
                face: 40, // Reduced from 60 to allow typical webcam blur scores (laplacian variance ~50)
                voice: 60
            },
            evidenceTTL: {
                face: configRecord.signalExpirySeconds,
                voice: configRecord.signalExpirySeconds,
                behavior: configRecord.signalExpirySeconds
            },
            confidenceThresholds: {
                low: 0.4,
                medium: 0.75,
                high: 0.85
            },
            configurationVersion: configRecord.version,
            updatedAt: configRecord.updatedAt
        };

        this.lastFetched = now;
        return this.cache;
    }

    /**
     * Force invalidates the local cache. Should be called when an admin updates the config.
     */
    static invalidateCache() {
        this.cache = null;
        this.lastFetched = 0;
    }
}
