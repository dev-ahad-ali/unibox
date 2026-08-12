/**
 * The single source of truth for this app's public address.
 *
 * Never build a redirect from `request.url`. Behind a tunnel or a reverse proxy
 * that reflects the internal bind address — with a custom server it resolves to
 * whatever hostname was handed to `next()`, which is how OAuth callbacks ended
 * up pointing at `https://0.0.0.0:8080`. The externally reachable URL is
 * configuration, not something a request can tell us.
 */
export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Absolute URL for an app-relative path, e.g. appUrl("/admin/channels"). */
export function appUrl(path: string) {
  return `${appBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** True when the configured URL is not reachable from the public internet. */
export function isLocalAppUrl() {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(appBaseUrl());
}
