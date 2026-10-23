import type { SyncStatus } from './sync';

export function ProgressCard({ signedIn, status, retry, legacyAvailable, importLegacy }: {
  signedIn: boolean; status: SyncStatus; retry: () => void; legacyAvailable: boolean; importLegacy: () => void;
}) {
  return <div className="panel account-card">
    <h2>Sauvegarde des progrès</h2>
    <p role="status">{!signedIn ? 'En mode invité, tes progrès sont conservés dans ce navigateur. Connecte-toi pour les retrouver sur tes autres appareils.' : status === 'synced' ? 'Tes niveaux, records et dernières parties sont sauvegardés dans ton compte.' : status === 'pending' ? 'Synchronisation des progrès en cours. Tu peux continuer à jouer.' : 'La synchronisation n’a pas abouti. Tes progrès sont conservés sur cet appareil et seront réessayés à la prochaine connexion.'}</p>
    {signedIn && status === 'error' && <button className="secondary" onClick={retry}>Réessayer la synchronisation</button>}
    {legacyAvailable && <div>
      <p>Ce navigateur contient aussi des progrès enregistrés avant la synchronisation ou en mode invité. S’ils sont à toi, tu peux les ajouter à ton compte.</p>
      <button className="secondary" onClick={importLegacy}>Ajouter ces progrès à mon compte</button>
    </div>}
  </div>;
}
