import { describe, expect, it } from 'bun:test';
import { buildDozzleUsersYaml } from './dozzle.ts';

describe('buildDozzleUsersYaml', () => {
  it('stores a bcrypt password hash instead of the plaintext password', async () => {
    const yaml = await buildDozzleUsersYaml({
      username: 'admin',
      password: 'correct horse battery staple',
      email: 'ops@example.com',
      name: 'Admin',
    });

    const hash = yaml.match(/password: "([^"]+)"/)?.[1];

    expect(yaml).toContain('users:');
    expect(yaml).toContain('admin:');
    expect(yaml).not.toContain('correct horse battery staple');
    expect(hash).toBeDefined();
    expect(await Bun.password.verify('correct horse battery staple', hash ?? '')).toBe(true);
  });
});
