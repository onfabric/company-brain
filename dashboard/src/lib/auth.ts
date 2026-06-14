const SIGN_IN_PATH = '/sign-in';
const SIGN_OUT_PATH = '/api/auth/sign-out';
const GET_SESSION_PATH = '/api/auth/get-session';

export type AuthSession = {
  user: { id: string; email: string; name: string };
};

export type AuthContext = {
  readonly session: AuthSession | null;
  ensureSession: () => Promise<AuthSession | null>;
  signOut: () => Promise<void>;
};

// Callers here (`signOut`, the 401 handler, the auth gate) navigate the whole
// document rather than the router, so the href must be origin-absolute, not
// router-relative.
export function signInUrl() {
  const callbackURL = window.location.pathname + window.location.search;
  return `${window.location.origin}${SIGN_IN_PATH}?callbackURL=${encodeURIComponent(callbackURL)}`;
}

export function redirectToSignIn() {
  if (typeof window !== 'undefined') {
    window.location.href = signInUrl();
  }
}

// A single in-memory session cache shared through the router context: the first
// `ensureSession` fetches and de-duplicates concurrent callers, so `beforeLoad`
// reads auth from memory after the initial resolve instead of hitting the
// network on every navigation or intent preload.
export function createAuth(): AuthContext {
  let session: AuthSession | null = null;
  let pending: Promise<AuthSession | null> | null = null;

  return {
    get session() {
      return session;
    },
    async ensureSession() {
      if (session) {
        return session;
      }
      pending ??= fetchSession();
      session = await pending;
      pending = null;
      return session;
    },
    async signOut() {
      await fetch(SIGN_OUT_PATH, { method: 'POST', credentials: 'include' });
      session = null;
      redirectToSignIn();
    },
  };
}

async function fetchSession(): Promise<AuthSession | null> {
  try {
    const response = await fetch(GET_SESSION_PATH, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as AuthSession | null;
    return data?.user ? data : null;
  } catch {
    return null;
  }
}
