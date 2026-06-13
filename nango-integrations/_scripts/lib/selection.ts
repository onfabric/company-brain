export function parseSelection(answer: string, validIds: string[]): string[] {
  const value = answer.trim().toLowerCase();
  if (value === 'all' || value === '*') {
    return [...validIds];
  }

  if (value === 'none') {
    return [];
  }

  const ids = value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((token) => idFromToken(token, validIds));
  const unknown = ids.filter((id) => !validIds.includes(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown selection: ${unknown.join(', ')}`);
  }

  return [...new Set(ids)];
}

function idFromToken(token: string, validIds: string[]): string {
  const index = Number.parseInt(token, 10);
  if (Number.isInteger(index) && String(index) === token) {
    const id = validIds[index - 1];
    if (id) {
      return id;
    }
  }

  return token;
}
