const SIGN_IN_PATH = '/sign-in';
const SIGN_OUT_PATH = '/api/auth/sign-out';

export function redirectToSignIn() {
  if (typeof window === 'undefined') {
    return;
  }
  const callbackURL = window.location.pathname + window.location.search;
  window.location.href = `${SIGN_IN_PATH}?callbackURL=${encodeURIComponent(callbackURL)}`;
}

export async function signOut() {
  await fetch(SIGN_OUT_PATH, { method: 'POST', credentials: 'include' });
  redirectToSignIn();
}
