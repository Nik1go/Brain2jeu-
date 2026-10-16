# Mes amis

La navigation « Ton espace » contient « Mes amis » sous « Ton profil ». Sur mobile, l’entrée s’appelle « Amis ». Un compte et un pseudo sont nécessaires.

La recherche utilise les premiers caractères du pseudo (3 minimum), sans distinction de casse, et retourne jusqu’à 12 profils. Chaque joueur peut consulter les records publics d’un autre joueur, l’inviter, accepter/refuser une invitation, annuler sa demande ou retirer un ami. Les relations apparaissent en temps réel sur les deux comptes.

## Données et requêtes

La base existante `(default)` du projet `brain2jeu` est en édition **Standard**, région `europe-west9` (vérifiée par `firestore:databases:list` et `firestore:databases:get`). Les comptes privés et les réservations de pseudos conservent leurs règles précédentes.

- `users/{uid}` : profil privé existant, lisible uniquement par son propriétaire.
- `usernames/{usernameKey}` : réservation immuable, recherche exacte authentifiée uniquement.
- `publicProfiles/{uid}` : uniquement `username`, `usernameKey`, `records` et `updatedAt`. Le pseudo doit correspondre au profil privé. Lecture par les joueurs connectés ; écriture uniquement par le propriétaire, schéma strict, date serveur.
- `records` : exactement `mirrorSurvival`, `mirrorChallenge`, `train`, `mathSmall`, `mathLarge`, `mathFinance`, entier 0..1 milliard ou `null` pour « Pas encore joué ». Seuls les records croissants sont acceptés. Défi et Petit train affichent le meilleur score parmi leurs niveaux actuels.
- Recherche : `orderBy(usernameKey)`, `startAt(key)`, `endAt(key + '\uf8ff')`, `limit(12)`. Les règles plafonnent les listes à 20. L’index automatique suffit.
- `friendships/{id}` : membres triés `[a,b]`, identifiant `length(a):a` suivi de `length(b):b`, `from`, `to`, `status`, `createdAt`, `updatedAt`. Un seul document par paire, y compris avec des UID personnalisés contenant des séparateurs.
- Relations : `where(members, 'array-contains', uid)`, abonnement temps réel. Lecture et suppression réservées aux membres. Création en `pending` par l’émetteur, acceptation uniquement par le destinataire ; participants et date de création immuables.

Le profil public est initialisé à la prochaine connexion de chaque joueur sur la nouvelle version. Les comptes existants deviennent recherchables après leur première visite connectée sur cette version. Aucune migration administrative ne modifie les comptes existants.

## Publication des scores

Les parties terminées pendant une session connectée publient automatiquement leur score. Les transactions conservent les meilleurs records même si deux appareils publient en même temps. L’historique détaillé et les préférences restent sur l’appareil. Un changement de compte pendant une partie ne transfère pas son score au nouveau compte.

Les anciens records locaux ne sont pas attribués automatiquement à chaque compte d’un navigateur partagé. « Publier mes records de cet appareil » permet de les rattacher explicitement au compte affiché. En cas d’erreur, les résultats locaux restent disponibles et une bannière propose de réessayer. Les publications en attente restent en mémoire pendant la visite ; après rechargement, le bouton de publication permet de récupérer les records locaux.

Les scores sont déclarés par le client de jeu. Les règles vérifient leur format, leur propriétaire et leur progression, pas l’authenticité d’une partie. Ce dispositif ne constitue pas un classement compétitif validé côté serveur.

## Vérification des règles

Les règles sont un prototype testé : données privées séparées des profils publics, schémas fermés, relations limitées aux participants et acceptation réservée au destinataire. Une revue supplémentaire est recommandée avant une diffusion large.

Le runner `scripts/test-firestore-rules.mjs`, complété par `test-friends-rules.mjs`, vérifie **103 contrôles** avec Auth et Firestore locaux :

| Tentative / parcours | Résultat vérifié |
| --- | --- |
| Lecture de profils/relations sans connexion | Refusée |
| Lecture du profil privé d’un autre joueur | Refusée |
| Liste publique sans limite ou limite >20 | Refusée |
| Recherche par préfixe et liste des propres relations | Autorisées |
| Usurpation de pseudo ou écriture pour un autre UID | Refusée |
| Ajout d’e-mail, rôle administrateur, clé arbitraire | Refusé |
| Champ manquant, type incorrect, grande chaîne | Refusé |
| Score négatif, décimal, NaN, chaîne ou dépassement | Refusé |
| Diminution/suppression d’un record existant | Refusée |
| Publications concurrentes | Meilleurs records préservés |
| Invitation acceptée dès sa création | Refusée |
| Membres supplémentaires, paire inversée ou ID incorrect | Refusés |
| Lecture/modification/suppression par un tiers | Refusée |
| Acceptation par l’émetteur, changement des participants/date | Refusés |
| Acceptation par le destinataire | Autorisée et visible aux deux joueurs |
| Retour d’accepté à en attente, invitation inverse | Refusés |
| Annulation, refus, retrait d’un ami | Autorisés aux participants |
| Sous-collection arbitraire | Refusée |

Ni rôle configurable, ni compteur incrémentable, ni chemin libre de média ne sont exposés.

```sh
npm test
npm run build
npm run test:firebase
```

Les tests Firebase refusent de démarrer sans les deux émulateurs sur `127.0.0.1`. Aucun compte réel ni invitation à un joueur réel n’est créé par les tests.

Pour le parcours visuel : démarrer les émulateurs (`npm run firebase:emulators`), puis `scripts/seed-friends-emulator.mjs` avec `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` et `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Ce script crée uniquement trois comptes locaux. Démarrer Vite avec `VITE_USE_FIREBASE_EMULATORS=true`, `VITE_FIREBASE_PROJECT_ID=demo-brain2jeu`, `VITE_FIREBASE_API_KEY=demo-brain2jeu-key`, `VITE_FIREBASE_APP_ID=demo-brain2jeu-app`. Comptes : `alicetest@example.test`, `bobtest@example.test`, `charlytest@example.test`, mot de passe local `LocalTest_42!`.

## Publication

La compilation distante en mode `--dry-run` a réussi. La publication réelle des nouvelles règles est en attente de l’accord explicite du propriétaire : la vérification automatique d’autorisation a refusé cette modification persistante des accès en production. Ne pas publier le nouveau front avant les règles.

Publier les règles avant la nouvelle interface :

```sh
npx firebase deploy --only firestore:rules --project brain2jeu
```

Puis reconstruire le front sur le VPS avec son script habituel. Aucun secret serveur ou nouveau service n’est nécessaire.
