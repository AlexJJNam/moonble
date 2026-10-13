export const POLICY_VERSION = '2026-10-14';
export function signupConsents() {
  return {
    terms_version: POLICY_VERSION,
    privacy_version: POLICY_VERSION,
    terms_accepted: true,
    privacy_collection_accepted: true,
    accepted_at: new Date().toISOString(),
  };
}
