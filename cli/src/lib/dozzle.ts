export async function buildDozzleUsersYaml({
  username,
  password,
  email,
  name,
}: {
  username: string;
  password: string;
  email: string;
  name: string;
}): Promise<string> {
  const hash = await Bun.password.hash(password, { algorithm: 'bcrypt' });

  return [
    'users:',
    `  ${yamlKey(username)}:`,
    `    email: ${yamlString(email)}`,
    `    name: ${yamlString(name)}`,
    `    password: ${yamlString(hash)}`,
    '',
  ].join('\n');
}

function yamlKey(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : yamlString(value);
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}
