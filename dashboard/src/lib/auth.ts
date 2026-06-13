const SIGN_IN_PATH = '/sign-in';
const SIGN_OUT_PATH = '/api/auth/sign-out';
const GET_SESSION_PATH = '/api/auth/get-session';

export type AuthSession = {
  user: { id: string; email: string; name: string };
};

export function signInUrl() {
  const callbackURL = window.location.pathname + window.location.search;
  return `${SIGN_IN_PATH}?callbackURL=${encodeURIComponent(callbackURL)}`;
}

export async function getAuthSession(): Promise<AuthSession | null> {
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

export function redirectToSignIn() {
  if (typeof window !== 'undefined') {
    window.location.href = signInUrl();
  }
}

export async function signOut() {
  await fetch(SIGN_OUT_PATH, { method: 'POST', credentials: 'include' });
  redirectToSignIn();
}
