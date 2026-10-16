import { describe, expect, it } from 'vitest';
import { authErrorMessage, usernameKey, validUsername } from './identity';

describe('Identité des joueurs', () => {
  it('réserve les variantes de casse sous la même clé', () => {
    expect(usernameKey('  Leo_42 ')).toBe('leo_42');
    expect(usernameKey('LEO_42')).toBe(usernameKey('leo_42'));
  });
  it('refuse les pseudos qui pourraient modifier un chemin ou dépasser les bornes', () => {
    for (const value of ['ab', 'a'.repeat(21), 'a/b', '..', 'léon', 'leo 42', '<script>']) {
      expect(validUsername(value), value).toBe(false);
    }
    expect(validUsername('  Leo_42  ')).toBe(true);
    expect(validUsername('a'.repeat(20))).toBe(true);
  });
  it('ne révèle pas si un e-mail existe pendant la connexion', () => {
    expect(authErrorMessage({ code: 'auth/user-not-found' })).toBe(authErrorMessage({ code: 'auth/wrong-password' }));
    expect(authErrorMessage(new Error('private server details'))).not.toContain('private');
  });
});
