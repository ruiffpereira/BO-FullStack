import { AUTH_IDENTITY_STORAGE_KEY } from "./constants";

export function readStoredIdentity(): {
  userId: string | null;
  username: string | null;
  email: string | null;
} {
  if (typeof window === "undefined") return { userId: null, username: null, email: null };
  try {
    const raw = window.localStorage.getItem(AUTH_IDENTITY_STORAGE_KEY);
    if (!raw) return { userId: null, username: null, email: null };
    const parsed = JSON.parse(raw) as { userId?: unknown; username?: unknown; email?: unknown };
    return {
      userId:
        typeof parsed.userId === "string" && parsed.userId.trim()
          ? parsed.userId
          : null,
      username:
        typeof parsed.username === "string" && parsed.username.trim()
          ? parsed.username
          : null,
      email:
        typeof parsed.email === "string" && parsed.email.trim()
          ? parsed.email
          : null,
    };
  } catch {
    return { userId: null, username: null, email: null };
  }
}

export function writeStoredIdentity(identity: {
  userId: string | null;
  username: string | null;
  email: string | null;
}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AUTH_IDENTITY_STORAGE_KEY,
      JSON.stringify(identity),
    );
  } catch {
    // ignore storage errors
  }
}

export function clearStoredIdentity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_IDENTITY_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
