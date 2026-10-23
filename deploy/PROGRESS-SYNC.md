# Audit et correction de la progression — 23 octobre 2026

## Diagnostic

Le défaut signalé est confirmé par le code. Firebase Auth conservait l'identité,
mais les états jouables de Miroirs cachés, Petit train et Calcul mental étaient
chargés exclusivement depuis trois clés localStorage communes au navigateur.
Il n'existait aucun document privé de progression ni lecture de sauvegarde à la
connexion. Les classements conservaient certains records et le parcours Train,
sans les réinjecter dans les jeux. Les README annonçaient cette limitation.

Deux conséquences : un nouvel appareil présentait des niveaux initiaux malgré un
compte existant ; deux comptes sur un navigateur pouvaient partager l'affichage
et l'historique locaux. La protection `gameOwner` empêchait certains transferts
publics, mais ne séparait pas le stockage jouable.

## Correctif préparé localement

- Sauvegarde privée `users/{uid}/saves/progress` et cache par UID.
- Au changement de compte, remontage de l'application : aucune partie, aucun état
  React et aucun retour asynchrone ne sont transférés au joueur suivant.
- Fusion transactionnelle des niveaux les plus avancés, meilleurs records,
  tutoriels et union des historiques (100 parties par jeu, identifiants stables).
  Une sauvegarde ancienne ne remet pas un niveau à 1. Les anciennes migrations
  Miroirs et archives de records sont conservées.
- Écoute des mises à jour serveur pendant la session. Le cache est écrit avant
  chaque envoi. Après échec, la reprise utilise ce cache, y compris après
  rechargement. Nouvel essai au retour en ligne, au retour dans l'onglet, toutes
  les 60 secondes lorsque visible et depuis le bouton du profil.
- Récupération initiale des records/parcours déjà attribués à l'UID, y compris
  les entrées de classements par niveau. Un record agrégé Train/Défi n'est pas
  affecté arbitrairement à un niveau. Un score Survie seul ne révèle pas le niveau
  atteint : il faut récupérer l'ancien navigateur pour retrouver ce détail.
- Import volontaire des anciennes sauvegardes depuis Profil. Les anciennes clés
  ne comportent aucun UID : leur attribution automatique serait incorrecte sur
  un navigateur partagé. Le bouton fusionne sans effacer les sources.
- Son et animations restent des préférences par appareil. Le mode invité reste
  local ; une partie abandonnée n'est pas reprise sur un autre appareil.

## Modèle et accès

L'enveloppe de sauvegarde contient exactement `version: 1`, `payload` (JSON privé
sérialisé, 1 à 150 000 caractères), `updatedAt` (date serveur). La sauvegarde est
une donnée déclarée par le joueur, sans rôle ni droit dans le contenu. Les règles
valident l'enveloppe à la création **et** à la mise à jour, imposent l'UID du
chemin et l'existence du profil. Lecture exacte réservée au propriétaire ; liste,
suppression et autres noms de sauvegardes refusés. Le client migre/normalise le
contenu, refuse les versions inconnues et borne les historiques. Le payload n'est
pas utilisé pour des requêtes ; une exemption d'index est prévue.

Les accès aux profils, réservations, amis et classements ne sont pas élargis.
Les règles constituent un prototype testé, à relire avant une ouverture large.

I've set up prototype Security Rules to keep the data in Firestore safe. They
are designed to be secure for owner-only progress saves with strict envelope
validation, payload bounds and server timestamps. However, you should review and
verify them before broadly sharing your app. If you'd like, I can help you harden
these rules.

## Validation reproductible

```powershell
npm test -- --testTimeout=30000
npm run build
npm run test:progress
```

`test:progress` lance seulement Auth/Firestore sur 127.0.0.1 dans le projet fictif
`demo-brain2jeu`. Il exécute les 30 contrôles des nouvelles règles de sauvegarde et
les véritables services TypeScript avec deux instances Firebase indépendantes.
Les tests d'intégration sont ignorés par `npm test` quand les variables des deux
émulateurs locaux ne sont pas présentes ; ils sont exécutés par `test:progress`.

Résultats locaux : 235 tests unitaires/de régression réussis, quatre scénarios
d'intégration réussis (dont 30 assertions d'accès et validation des sauvegardes),
compilation TypeScript/Vite réussie. Le contrôle sur deux vrais appareils et sur
le domaine public reste à faire après publication.

Les attaques testées comprennent : invité et autre UID en lecture/écriture,
listes, sous-collection orpheline, nom de sauvegarde arbitraire, suppression,
version/type incorrect, taille maximale et excessive, champ inconnu/UID/rôle
injecté, horodatage falsifié et suppression d'un champ requis en update. Tous
doivent être refusés sauf le propriétaire avec une enveloppe conforme. Le JSON
interne est volontairement opaque aux règles et n'accorde aucun privilège.

Les scénarios applicatifs couvrent compte A/B/invité, import/migration,
déduplication, préférences locales, échec puis reprise depuis le cache,
callbacks tardifs, restauration sur un appareil vide, écoute en direct,
récupération des anciens records et transactions concurrentes.

La suite historique complète des règles a réussi une première fois (175 contrôles,
y compris les 30 nouveaux). Des relances ont toutefois échoué dans les tests
préexistants de transactions concurrentes sur les records publics Amis ou
Classements (`permission-denied`). Les règles de ces chemins n'ont pas été
modifiées. Ce point reste à investiguer séparément ; il ne faut pas présenter la
suite historique comme systématiquement verte. La commande `test:progress` isole
les contrôles et services de la nouvelle sauvegarde privée et doit tous les
valider sans masquer un refus d'accès.

## Publication Firebase et mise en ligne du front

Les règles et l'exemption d'index ont été publiées le **23 octobre 2026 à 20 h 21
(Paris)** sur `brain2jeu`, base `(default)`, Standard, `europe-west9`. La relecture
distante confirme la correspondance exacte avec les règles testées :
SHA-256 `179d18c08b7ec1d776e3a07623641947f20150424c02be480f6bd2484884ce26`.
La version active est `4d1962b9-b205-46ff-b7ec-22ea2d3c7db1`. L'exemption
`saves.payload` est présente, sans index et sans TTL. Aucun document de joueur
n'a été modifié par cette publication.

Les règles précédentes (`9101d9f5-6829-48cc-b011-bbdbeaaeab0b`) ont été sauvegardées
localement dans `artifacts/firestore-rules-before-progress-sync-20261023.rules` ;
elles correspondent aussi aux sources avant ce correctif. L'accès distant a
fonctionné avec la CLI installée 15.34.0 ; `npx ...@latest` échouait localement avec
`Invalid Version`. Aucune nouvelle base ni nouvelle connexion n'a été nécessaire.

Le **front doit encore être installé sur le VPS** après récupération de `main`.
Pour une prochaine publication Firebase, vérifier les règles distantes existantes
et publier les règles/l'index **avant** le front :

```powershell
npx -y firebase-tools@latest firestore:databases:get '(default)' --project brain2jeu
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project brain2jeu
npm run firebase:check-rules
npm run release:vps
```

Installer ensuite l'archive selon `deploy/README.md`. Vérifier avec un compte de
test sur deux vrais navigateurs : importer les anciennes données sur l'appareil
d'origine, attendre le statut sauvegardé, puis vérifier les niveaux sur l'autre
appareil. Essayer aussi déconnexion/reconnexion, autre compte, hors ligne puis
reprise. Un ancien onglet doit être actualisé pour recevoir le nouveau front.
