export const USERNAME_HINT = '3 à 20 caractères : lettres sans accent, chiffres et _.';

export function usernameKey(value: string): string {
  return value.trim().toLowerCase();
}

export function validUsername(value: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value.trim());
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'username/taken': 'Ce pseudo est déjà pris. Essaie une autre idée !',
    'username/invalid': USERNAME_HINT,
    'auth/invalid-credential': 'L’e-mail ou le mot de passe est incorrect.',
    'auth/wrong-password': 'L’e-mail ou le mot de passe est incorrect.',
    'auth/user-not-found': 'L’e-mail ou le mot de passe est incorrect.',
    'auth/invalid-email': 'Vérifie le format de ton adresse e-mail.',
    'auth/email-already-in-use': 'Un compte utilise déjà cet e-mail. Connecte-toi ou réinitialise ton mot de passe.',
    'auth/weak-password': 'Choisis un mot de passe d’au moins 8 caractères.',
    'auth/password-does-not-meet-requirements': 'Ce mot de passe ne respecte pas les critères de sécurité. Essaie avec des majuscules, minuscules, chiffres et symboles.',
    'auth/popup-closed-by-user': 'La fenêtre Google a été fermée. Tu peux réessayer.',
    'auth/cancelled-popup-request': 'Une connexion Google est déjà en cours.',
    'auth/popup-blocked': 'Ton navigateur bloque la fenêtre Google. Autorise les fenêtres pour ce site puis réessaie.',
    'auth/account-exists-with-different-credential': 'Ce compte utilise une autre méthode de connexion. Connecte-toi avec ta méthode habituelle.',
    'auth/network-request-failed': 'La connexion est indisponible. Vérifie ton accès Internet puis réessaie.',
    'auth/too-many-requests': 'Trop de tentatives. Attends un moment avant de réessayer.',
    'auth/user-disabled': 'Ce compte est désactivé. Contacte l’assistance.',
    'auth/unauthorized-domain': 'La connexion Google n’est pas encore disponible sur cette adresse.',
    'auth/operation-not-allowed': 'Cette méthode de connexion n’est pas encore disponible.',
    'permission-denied': 'Ton profil est momentanément indisponible. Réessaie dans un instant.',
    'unavailable': 'La connexion est indisponible. Réessaie lorsque tu es en ligne.',
    'firebase/not-configured': 'La connexion aux comptes est en cours de préparation. Tu peux jouer sans compte.',
  };
  return messages[code] ?? 'Impossible de terminer cette action. Réessaie dans un instant.';
}
