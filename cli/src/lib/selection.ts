export type SelectionOption = {
  id: string;
  label: string;
};

export function parseSelectionAnswer(answer: string, options: SelectionOption[]): string[] {
  const value = answer.trim().toLowerCase();
  if (value === 'all' || value === '*') {
    return options.map((option) => option.id);
  }

  if (value === 'none') {
    return [];
  }

  const ids = value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((token) => idFromToken(token, options));
  const unknown = ids.filter((id) => !options.some((option) => option.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown selection: ${unknown.join(', ')}`);
  }

  return [...new Set(ids)];
}

function idFromToken(token: string, options: SelectionOption[]): string {
  const index = Number.parseInt(token, 10);
  if (Number.isInteger(index) && String(index) === token) {
    const option = options[index - 1];
    if (option) {
      return option.id;
    }
  }

  return token;
}
