/**
 * localProfileService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Owns all local profile persistence, migration, and authorization logic.
 *
 * PROTOTYPE NOTICE:
 *   This implementation uses localStorage as a development-time profile
 *   registry. This is intentionally temporary.
 *
 *   Production replacement:
 *     Every call to localStorage here must be replaced with an equivalent
 *     call to the BioShield native profile store API, which provides:
 *       - Encrypted local database backed by TPM/Secure Enclave
 *       - Profile data protected by device-bound keys
 *       - Tamper detection and integrity verification
 *
 *   No component should read localStorage directly for profile data.
 *   All profile access goes through this service.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
    LocalProfile,
    LocalProfileRegistry,
    LoginView,
    AddProfileAuthorization,
} from '../types';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const REGISTRY_KEY      = 'bioshield_local_profiles_v2';
const SCHEMA_VERSION    = 2;
const LEGACY_KEY        = 'bioshield_local_profile';      // v1 single-object key
const ADD_TOKEN_KEY     = 'bioshield_add_profile_token';  // sessionStorage

// ─── Add-profile token TTL ───────────────────────────────────────────────────
const ADD_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
    return `lp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function buildInitials(firstName: string, lastName: string): string {
    const f = (firstName.trim()[0] ?? '').toUpperCase();
    const l = (lastName.trim()[0] ?? '').toUpperCase();
    return f + l || '??';
}

function readRegistry(): LocalProfileRegistry | null {
    try {
        const raw = localStorage.getItem(REGISTRY_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as LocalProfileRegistry;
    } catch {
        return null;
    }
}

function writeRegistry(reg: LocalProfileRegistry): void {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
}

function emptyRegistry(): LocalProfileRegistry {
    return { schemaVersion: SCHEMA_VERSION, profiles: [], activeProfileId: null };
}

// ─── Migration ────────────────────────────────────────────────────────────────

/**
 * One-time, idempotent migration from v1 (single profile object) to v2 (array).
 * Safe to call on every app start — it is a no-op if already migrated.
 */
function migrateLegacyProfile(): void {
    // Already migrated?
    const existing = readRegistry();
    if (existing && existing.schemaVersion === SCHEMA_VERSION) return;

    const legacyRaw = localStorage.getItem(LEGACY_KEY);

    if (!legacyRaw) {
        // No legacy data — initialise an empty v2 registry
        writeRegistry(emptyRegistry());
        return;
    }

    try {
        const legacy = JSON.parse(legacyRaw) as {
            name?: string;
            profileId?: string;
            enrolledAt?: string;
            role?: string;
            pin?: string;
        };

        const firstName = legacy.name ?? 'Unknown';
        const lastName  = '';

        const converted: LocalProfile = {
            id:          legacy.profileId ?? generateId(),
            firstName,
            lastName,
            displayName: firstName,
            initials:    buildInitials(firstName, lastName),
            role:        (legacy.role === 'ADMIN' ? 'ADMIN' : 'USER'),
            isPrimary:   true,
            createdAt:   legacy.enrolledAt ? new Date(legacy.enrolledAt).getTime() : Date.now(),
            updatedAt:   Date.now(),
            enrollment: {
                face:        true,
                voice:       true,
                fingerprint: false,
                cognitive:   false,
                pin:         !!legacy.pin,
            },
            // TODO(production): remove _devPin — replace with native secure credential call
            _devPin: legacy.pin,
        };

        writeRegistry({
            schemaVersion:   SCHEMA_VERSION,
            profiles:        [converted],
            activeProfileId: converted.id,
        });

        // Remove old key so it does not resurface
        localStorage.removeItem(LEGACY_KEY);

    } catch {
        // Corrupt legacy data — start fresh
        writeRegistry(emptyRegistry());
        localStorage.removeItem(LEGACY_KEY);
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BootstrapResult {
    initialView: LoginView;
    profiles: LocalProfile[];
    activeProfile: LocalProfile | null;
}

export const localProfileService = {

    /**
     * Run on every app start.
     * Performs migration, then returns the correct initial view and profile list.
     * This is the single authoritative place that determines which view opens.
     */
    bootstrap(): BootstrapResult {
        migrateLegacyProfile();

        const reg = readRegistry() ?? emptyRegistry();
        const { profiles, activeProfileId } = reg;

        if (profiles.length === 0) {
            return { initialView: 'WELCOME_SETUP', profiles: [], activeProfile: null };
        }

        if (profiles.length === 1) {
            const active = profiles[0];
            this.setActiveProfile(active.id);
            return { initialView: 'UNLOCK', profiles, activeProfile: active };
        }

        // 2+ profiles — show selector; highlight most-recently-used but don't auto-select
        const recent = profiles.find(p => p.id === activeProfileId) ?? null;
        return { initialView: 'PROFILE_SELECT', profiles, activeProfile: recent };
    },

    listProfiles(): LocalProfile[] {
        const reg = readRegistry();
        return reg?.profiles ?? [];
    },

    getProfile(id: string): LocalProfile | null {
        const reg = readRegistry();
        return reg?.profiles.find(p => p.id === id) ?? null;
    },

    /**
     * Creates a new profile and appends it to the registry.
     * Never overwrites existing profiles.
     * Returns the created profile.
     */
    createProfile(data: {
        id?: string;
        firstName: string;
        lastName: string;
        displayName?: string;
        role: 'USER' | 'ADMIN';
        pin?: string;
        email?: string;
        userId?: string;
        enrollment?: {
            face?: boolean;
            voice?: boolean;
            fingerprint?: boolean;
            cognitive?: boolean;
            pin?: boolean;
        };
    }): LocalProfile {
        const reg = readRegistry() ?? emptyRegistry();

        const isPrimary = reg.profiles.length === 0;
        const now       = Date.now();
        const id        = data.id ?? generateId();
        const displayName = (data.displayName && data.displayName.trim() !== '')
            ? data.displayName.trim()
            : `${data.firstName.trim()} ${data.lastName.trim()}`.trim();

        const profile: LocalProfile = {
            id,
            firstName:   data.firstName.trim(),
            lastName:    data.lastName.trim(),
            displayName,
            initials:    buildInitials(data.firstName, data.lastName),
            role:        data.role,
            isPrimary,
            createdAt:   now,
            updatedAt:   now,
            email:       data.email,
            userId:      data.userId,
            enrollment: {
                face:        data.enrollment?.face ?? false,
                voice:       data.enrollment?.voice ?? false,
                fingerprint: data.enrollment?.fingerprint ?? false,
                cognitive:   data.enrollment?.cognitive ?? false,
                pin:         data.enrollment?.pin ?? !!data.pin,
            },
            // TODO(production): remove _devPin — replace with native secure credential call
            _devPin: data.pin,
        };

        reg.profiles.push(profile);
        if (isPrimary) reg.activeProfileId = id;
        writeRegistry(reg);

        return profile;
    },

    /**
     * Updates the activeProfileId in the registry.
     * This highlights a recently-used profile in the selector but does NOT
     * authenticate the user — authentication happens via the biometric pipeline.
     */
    setActiveProfile(id: string): void {
        const reg = readRegistry();
        if (!reg) return;
        reg.activeProfileId = id;
        writeRegistry(reg);
    },

    /**
     * Marks enrollment fields as complete for a given profile.
     */
    markEnrollmentComplete(
        id: string,
        fields: Partial<LocalProfile['enrollment']>
    ): void {
        const reg = readRegistry();
        if (!reg) return;
        const idx = reg.profiles.findIndex(p => p.id === id);
        if (idx === -1) return;
        reg.profiles[idx].enrollment = {
            ...reg.profiles[idx].enrollment,
            ...fields,
        };
        reg.profiles[idx].updatedAt = Date.now();
        writeRegistry(reg);
    },

    /**
     * Validates a PIN for a given profile.
     * TODO(production): remove this — replace with native secure credential call.
     */
    validatePin(id: string, pin: string): boolean {
        const profile = this.getProfile(id);
        if (!profile) return false;
        // TODO(production): remove _devPin check — replace with native secure credential call
        return profile._devPin === pin;
    },

    /**
     * Deletes a profile by ID from the local registry.
     * Prevents deletion if it is the only profile or if it is the primary profile without explicit reset.
     */
    deleteProfile(id: string): { success: boolean; error?: string } {
        const reg = readRegistry();
        if (!reg) return { success: false, error: 'Registry unreadable' };

        if (reg.profiles.length <= 1) {
            return { success: false, error: 'Cannot delete the only remaining profile on the device.' };
        }

        const idx = reg.profiles.findIndex(p => p.id === id);
        if (idx === -1) return { success: false, error: 'Profile not found.' };

        if (reg.profiles[idx].isPrimary) {
            return { success: false, error: 'Primary local identity cannot be removed without a full system reset.' };
        }

        reg.profiles.splice(idx, 1);

        if (reg.activeProfileId === id) {
            reg.activeProfileId = reg.profiles[0]?.id ?? null;
        }

        writeRegistry(reg);
        return { success: true };
    },

    /**
     * Updates the local PIN for a profile.
     */
    updatePin(id: string, newPin: string): boolean {
        const reg = readRegistry();
        if (!reg) return false;
        const idx = reg.profiles.findIndex(p => p.id === id);
        if (idx === -1) return false;

        reg.profiles[idx]._devPin = newPin;
        reg.profiles[idx].enrollment.pin = true;
        reg.profiles[idx].updatedAt = Date.now();
        writeRegistry(reg);
        return true;
    },

    /**
     * Renames a profile.
     */
    renameProfile(id: string, firstName: string, lastName: string): boolean {
        const reg = readRegistry();
        if (!reg) return false;
        const idx = reg.profiles.findIndex(p => p.id === id);
        if (idx === -1) return false;

        const f = firstName.trim();
        const l = lastName.trim();
        reg.profiles[idx].firstName = f;
        reg.profiles[idx].lastName = l;
        reg.profiles[idx].displayName = `${f} ${l}`.trim();
        reg.profiles[idx].initials = buildInitials(f, l);
        reg.profiles[idx].updatedAt = Date.now();
        writeRegistry(reg);
        return true;
    },

    // ─── Add-Profile Authorization Token ────────────────────────────────────

    /**
     * Issues a short-lived token authorizing ONE new profile to be created.
     * Stored in sessionStorage (not localStorage) so it dies with the tab.
     */
    issueAddProfileToken(authorizedProfileId: string): void {
        const token: AddProfileAuthorization = {
            purpose:             'ADD_LOCAL_PROFILE',
            authorizedProfileId,
            issuedAt:            Date.now(),
            expiresAt:           Date.now() + ADD_TOKEN_TTL_MS,
        };
        sessionStorage.setItem(ADD_TOKEN_KEY, JSON.stringify(token));
    },

    /**
     * Validates and consumes the add-profile token.
     * Returns the token if valid, null if missing or expired.
     * Clears the token after consuming (one-use).
     */
    consumeAddProfileToken(): AddProfileAuthorization | null {
        try {
            const raw = sessionStorage.getItem(ADD_TOKEN_KEY);
            if (!raw) return null;

            const token = JSON.parse(raw) as AddProfileAuthorization;

            if (
                token.purpose !== 'ADD_LOCAL_PROFILE' ||
                Date.now() > token.expiresAt
            ) {
                sessionStorage.removeItem(ADD_TOKEN_KEY);
                return null;
            }

            sessionStorage.removeItem(ADD_TOKEN_KEY);
            return token;
        } catch {
            sessionStorage.removeItem(ADD_TOKEN_KEY);
            return null;
        }
    },

    /**
     * Returns true if a valid (non-expired) add-profile token exists.
     * Does NOT consume it.
     */
    hasValidAddProfileToken(): boolean {
        try {
            const raw = sessionStorage.getItem(ADD_TOKEN_KEY);
            if (!raw) return false;
            const token = JSON.parse(raw) as AddProfileAuthorization;
            return token.purpose === 'ADD_LOCAL_PROFILE' && Date.now() <= token.expiresAt;
        } catch {
            return false;
        }
    },

    /**
     * Wipes ALL BioShield data from localStorage and sessionStorage.
     * This returns the device to its first-run / factory state.
     * USE WITH CAUTION — this is irreversible.
     */
    resetAllData(): void {
        // Remove all known BioShield localStorage keys
        const localKeys = [
            REGISTRY_KEY,
            LEGACY_KEY,
            'bioshield_authenticated_session',
            'bioshield_auth_token_expires',
            'bioshield_face_enrolled',
            'bioshield_voice_enrolled',
            'bioshield_manage_profiles_authorized',
        ];
        localKeys.forEach(key => localStorage.removeItem(key));

        // Remove all known BioShield sessionStorage keys
        const sessionKeys = [
            ADD_TOKEN_KEY,
            'bioshield_add_user_authorized',
            'bioshield_auth_stage',
            'bioshield_auth_evidence',
            'bioshield_secure_action',
        ];
        sessionKeys.forEach(key => sessionStorage.removeItem(key));
    },
};
