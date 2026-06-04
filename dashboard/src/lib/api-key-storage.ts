const BRAIN_API_KEY_STORAGE_KEY = 'company-brain.dashboard.brain-api-key';

export function readStoredBrainApiKey() {
  try {
    const stored = localStorageForDashboard()?.getItem(BRAIN_API_KEY_STORAGE_KEY)?.trim();
    return stored || undefined;
  } catch {
    return undefined;
  }
}

export function storeBrainApiKey(apiKey: string) {
  try {
    const storage = localStorageForDashboard();
    const trimmed = apiKey.trim();
    if (trimmed) {
      storage?.setItem(BRAIN_API_KEY_STORAGE_KEY, trimmed);
    } else {
      storage?.removeItem(BRAIN_API_KEY_STORAGE_KEY);
    }
  } catch {
    return;
  }
}

export function clearStoredBrainApiKey() {
  try {
    localStorageForDashboard()?.removeItem(BRAIN_API_KEY_STORAGE_KEY);
  } catch {
    return;
  }
}

function localStorageForDashboard() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.localStorage;
}
