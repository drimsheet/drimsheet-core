import mockHasher from '@shared/contracts/__mocks__/hasher.mock';

import authError from '@app/auth/errors/auth.error';
import makePasswordAppService from '@app/auth/services/password.service';

describe('makePasswordAppService', () => {
  let passwordAppService: ReturnType<typeof makePasswordAppService>;

  beforeEach(() => {
    mockHasher.genSalt.mockReset().mockResolvedValue('mock-salt');
    mockHasher.hash.mockReset().mockResolvedValue('hashed-password');
    mockHasher.compare
      .mockReset()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    passwordAppService = makePasswordAppService({ hasher: mockHasher });
  });

  describe('makePassword', () => {
    it('returns a valid password without normalizing it', () => {
      const password = '  StrongPassword1!  ';
      expect(passwordAppService.makePassword(password)).toBe(password);
    });

    it('accepts both exact length boundaries', () => {
      const minimum = 'Aa1!aaaa';
      const maximum = `StrongPassword1!${'a'.repeat(
        128 - 'StrongPassword1!'.length
      )}`;

      expect(passwordAppService.makePassword(minimum)).toBe(minimum);
      expect(passwordAppService.makePassword(maximum)).toBe(maximum);
    });

    it.each([
      null,
      undefined,
      123,
      'Aa1!aaa',
      `Aa1!${'a'.repeat(125)}`,
      'password123!',
      'PASSWORD123!',
      'PasswordTest!',
      'Password123',
    ])('rejects an invalid password: %p', (input) => {
      expect(() => passwordAppService.makePassword(input)).toThrow(
        authError.InvalidPassword
      );
    });
  });

  it('hashes passwords and compares them without exposing the plaintext', async () => {
    const password = 'mySecretPassword123!';
    const hash = await passwordAppService.hash(password);

    expect(hash).not.toBe(password);
    expect(mockHasher.genSalt).toHaveBeenCalledWith(10);
    expect(mockHasher.hash).toHaveBeenCalledWith(password, 'mock-salt');
    await expect(passwordAppService.compare(password, hash)).resolves.toBe(
      true
    );
    await expect(
      passwordAppService.compare('wrongPassword', hash)
    ).resolves.toBe(false);
    expect(mockHasher.compare).toHaveBeenNthCalledWith(1, password, hash);
    expect(mockHasher.compare).toHaveBeenNthCalledWith(
      2,
      'wrongPassword',
      hash
    );
  });
});
