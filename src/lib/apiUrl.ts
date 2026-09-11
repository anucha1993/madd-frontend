// Single source of truth for the backend API base URL — both apiClient.ts and authApi.ts
// import this instead of each duplicating the same `process.env.NEXT_PUBLIC_API_URL` line.
function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

  // Defense against "Mixed Content" browser errors: NEXT_PUBLIC_* values are baked in at
  // build time, so a misconfigured env var (http:// instead of https://) on the server that
  // built the app would otherwise silently break every request once deployed behind HTTPS.
  // If the page itself is loaded over HTTPS but the configured API URL is still http://,
  // upgrade it automatically instead of letting the browser block the request.
  if (typeof window !== "undefined" && window.location.protocol === "https:" && raw.startsWith("http://")) {
    return raw.replace("http://", "https://");
  }

  return raw;
}

export const API_URL = resolveApiUrl();
