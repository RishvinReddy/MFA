/**
 * authFlowController.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Authoritative controller for managing secure action intents and authentication
 * purposes across the BioShield identity pipeline.
 *
 * Prevents the lock screen from treating all verification flows as normal login
 * by preserving the requested action (e.g. MANAGE_PROFILES, ADD_LOCAL_USER)
 * in sessionStorage and routing to the appropriate target upon policy ALLOW.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PendingSecureAction, SecureAction, SecureActionContext, AuthenticationPurpose, AuthenticationContext } from '../types';

const PENDING_ACTION_KEY = 'bioshield_pending_secure_action';
const SECURE_ACTION_KEY  = 'bioshield_secure_action';
const AUTH_CONTEXT_KEY   = 'bioshield_auth_context';

export interface PendingActionState {
    action: PendingSecureAction;
    purpose: AuthenticationPurpose;
    profileId: string;
    startedAt: number;
}

export const authFlowController = {
    /**
     * Records why authentication was requested before initiating a verification flow.
     */
    startSecureAction(action: PendingSecureAction, purpose: AuthenticationPurpose, profileId: string, returnTo?: string): void {
        const now = Date.now();
        console.info(`[BioShield AuthFlow] ──> Step 1: Initiating secure action [${action}] with purpose [${purpose}] for authorizer [${profileId}]`);

        const state: PendingActionState = {
            action,
            purpose,
            profileId,
            startedAt: now,
        };
        sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(state));

        const secureContext: SecureActionContext = {
            action: action as SecureAction,
            authorizingProfileId: profileId,
            createdAt: now,
            expiresAt: now + 5 * 60 * 1000, // 5 mins TTL for secure operations
            returnTo: returnTo || (action === 'ADD_LOCAL_USER' ? '/profiles/add' : action === 'MANAGE_PROFILES' ? '/profiles' : '/dashboard'),
        };
        sessionStorage.setItem(SECURE_ACTION_KEY, JSON.stringify(secureContext));
        console.info(`[BioShield AuthFlow] ──> Step 2: Stored SecureActionContext in sessionStorage [${SECURE_ACTION_KEY}]:`, secureContext);

        const context: AuthenticationContext = {
            flowId: `flow-${now}`,
            profileId,
            purpose,
            startedAt: now,
            expiresAt: now + 15 * 60 * 1000, // 15 mins TTL
        };
        sessionStorage.setItem(AUTH_CONTEXT_KEY, JSON.stringify(context));
    },

    /**
     * Returns the currently pending secure action intent, or null if none.
     */
    getPendingAction(): PendingActionState | null {
        try {
            const raw = sessionStorage.getItem(PENDING_ACTION_KEY);
            if (!raw) return null;
            return JSON.parse(raw) as PendingActionState;
        } catch {
            return null;
        }
    },

    /**
     * Returns the authoritative SecureActionContext if valid and not expired.
     */
    getSecureActionContext(): SecureActionContext | null {
        try {
            const raw = sessionStorage.getItem(SECURE_ACTION_KEY);
            if (!raw) return null;
            const context = JSON.parse(raw) as SecureActionContext;
            if (Date.now() > context.expiresAt) {
                console.warn(`[BioShield AuthFlow] ──> SecureActionContext expired at ${new Date(context.expiresAt).toLocaleTimeString()}. Clearing.`);
                sessionStorage.removeItem(SECURE_ACTION_KEY);
                return null;
            }
            return context;
        } catch {
            return null;
        }
    },

    /**
     * Clears any pending action intent from storage after consumption or cancellation.
     */
    clearPendingAction(): void {
        sessionStorage.removeItem(PENDING_ACTION_KEY);
        sessionStorage.removeItem(SECURE_ACTION_KEY);
        sessionStorage.removeItem(AUTH_CONTEXT_KEY);
    },


    /**
     * Checks whether a specific secure action has valid unexpired authorization.
     */
    hasValidAuthorization(action: SecureAction): boolean {
        const expiresRaw = sessionStorage.getItem('bioshield_auth_token_expires');
        if (expiresRaw && Date.now() > Number(expiresRaw)) {
            console.warn(`[BioShield AuthFlow] ──> Authorization token expired. Clearing tokens.`);
            sessionStorage.removeItem('bioshield_manage_profiles_authorized');
            sessionStorage.removeItem('bioshield_add_user_authorized');
            sessionStorage.removeItem('bioshield_auth_token_expires');
            return false;
        }

        if (action === 'MANAGE_PROFILES' && sessionStorage.getItem('bioshield_manage_profiles_authorized') === 'true') {
            console.info(`[BioShield AuthFlow] ──> Valid unexpired authorization token found in sessionStorage for MANAGE_PROFILES`);
            return true;
        }
        if (action === 'ADD_LOCAL_USER' && sessionStorage.getItem('bioshield_add_user_authorized') === 'true') {
            console.info(`[BioShield AuthFlow] ──> Valid unexpired authorization token found in sessionStorage for ADD_LOCAL_USER`);
            return true;
        }
        return false;
    },

    /**
     * Authoritative destination routing after successful authentication.
     * Consumes pending secure action intent and routes accordingly.
     */
    handleAuthenticationSuccess(navigate: (path: string, options?: { replace?: boolean }) => void, defaultRoute: string): void {
        console.info(`[BioShield AuthFlow] ──> Step 3: BioShield verification ceremony completed successfully.`);
        const secureContext = this.getSecureActionContext();
        const pending = this.getPendingAction();
        this.clearPendingAction();
        const purpose = sessionStorage.getItem('bioshield_auth_purpose');
        sessionStorage.removeItem('bioshield_auth_purpose');

        const effectiveAction = secureContext?.action || pending?.action || purpose;
        console.info(`[BioShield AuthFlow] ──> Step 4: Evaluating post-authentication routing. Effective action: [${effectiveAction}]`);

        if (effectiveAction === 'ADD_LOCAL_USER') {
            console.info(`[BioShield AuthFlow] ──> Step 5: Authorization confirmed for ADD_LOCAL_USER. Issuing token and navigating to /profiles/add`);
            sessionStorage.setItem('bioshield_add_user_authorized', 'true');
            sessionStorage.setItem('bioshield_auth_token_expires', String(Date.now() + 5 * 60 * 1000));
            navigate('/profiles/add', { replace: true });
            return;
        }

        if (effectiveAction === 'MANAGE_PROFILES') {
            console.info(`[BioShield AuthFlow] ──> Step 5: Authorization confirmed for MANAGE_PROFILES. Issuing token and navigating to /profiles`);
            sessionStorage.setItem('bioshield_manage_profiles_authorized', 'true');
            sessionStorage.setItem('bioshield_auth_token_expires', String(Date.now() + 5 * 60 * 1000));
            navigate('/profiles', { replace: true });
            return;
        }

        if (!pending || pending.action === 'NONE') {
            console.info(`[BioShield AuthFlow] ──> Step 5: Standard login/unlock session. Navigating to [${defaultRoute}]`);
            navigate(defaultRoute, { replace: true });
            return;
        }

        switch (pending.action) {
            case 'DELETE_PROFILE':
            case 'REENROLL_FACE':
            case 'REENROLL_VOICE':
                console.info(`[BioShield AuthFlow] ──> Step 5: Profile maintenance action [${pending.action}]. Navigating to /profiles`);
                navigate('/profiles', { replace: true });
                return;
            default:
                console.info(`[BioShield AuthFlow] ──> Step 5: Defaulting navigation to [${defaultRoute}]`);
                navigate(defaultRoute, { replace: true });
        }
    },
};
