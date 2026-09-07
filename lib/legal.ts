import { appBaseUrl, appUrl } from "@/lib/app-url";

/**
 * Operator-specific details the published policies have to name.
 *
 * A legal entity and a privacy contact belong to whoever runs this deployment,
 * not to the code, so they are configuration. The defaults are derived from the
 * app's own domain rather than left as placeholder text, because these pages
 * are read by Meta's App Review team and a visible "TODO" is a rejection.
 */

/** Bump when the wording of a policy changes materially. */
export const POLICY_EFFECTIVE_DATE = "2026-09-07";

export function appDomain() {
  try {
    return new URL(appBaseUrl()).host;
  } catch {
    return "localhost";
  }
}

/** The registered business that publishes these policies. */
export function legalEntity() {
  return process.env.NEXT_PUBLIC_LEGAL_ENTITY?.trim() || "Unibox";
}

/** Postal address, shown only when configured — an empty line reads worse than none. */
export function legalAddress() {
  return process.env.NEXT_PUBLIC_LEGAL_ADDRESS?.trim() || undefined;
}

export function privacyEmail() {
  return process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || `privacy@${appDomain()}`;
}

export function supportEmail() {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || `support@${appDomain()}`;
}

/** Where Meta's data deletion callback is registered. */
export const DATA_DELETION_CALLBACK_PATH = "/api/data-deletion";
export const DATA_DELETION_PATH = "/legal/data-deletion";
export const PRIVACY_PATH = "/legal/privacy";
export const TERMS_PATH = "/legal/terms";

/** Absolute URL a deletion confirmation code resolves to. */
export function deletionStatusUrl(code: string) {
  return appUrl(`${DATA_DELETION_PATH}?code=${encodeURIComponent(code)}`);
}
