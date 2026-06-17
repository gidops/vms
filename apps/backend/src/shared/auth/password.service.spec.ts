import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hashes and verifies a password (argon2 round-trip)', async () => {
    const hash = await svc.hash('Passw0rd!');
    expect(hash).toContain('$argon2');
    await expect(svc.verify(hash, 'Passw0rd!')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await svc.hash('Passw0rd!');
    await expect(svc.verify(hash, 'wrong')).resolves.toBe(false);
  });
});
