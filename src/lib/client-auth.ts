/* Session token kept in localStorage as a fallback for contexts where the
   httpOnly cookie is not persisted or sent (preview proxies, embedded
   iframes, some mobile browsers). The server accepts the token in the
   Authorization header or the cookie — whichever arrives. */

const KEY = "gtu-session-token";

export function saveSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — cookie path still works */
  }
}

export function sessionToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const t = sessionToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}
