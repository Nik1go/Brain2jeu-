# Firebase pour Brain2jeu

## Correction du build VPS sans fichier local

La configuration Web publique officielle du projet est versionnée dans `src/auth/firebase-public.json`. Un checkout neuf peut donc être compilé sur le VPS sans `.env.local` : les boutons Google et e-mail restent actifs. Les variables `VITE_FIREBASE_*` restent des surcharges facultatives ; un projet alternatif exige sa propre clé et son propre identifiant d’application.

La version `assets/index-DwJuuPMV.js`, vérifiée sur le site public, ne contenait ni `apiKey` ni `appId` : Vite avait compilé les variables absentes et désactivé le portail. Le fichier `.env.local` du PC était ignoré par Git et n’arrivait donc pas sur le VPS. Il faut récupérer le correctif, reconstruire le front puis actualiser l’onglet.

Ces valeurs identifient le client Web ; elles ne sont pas des clés d’administration. Voir les [explications Firebase sur les clés du SDK](https://firebase.google.com/docs/projects/api-keys). L’accès aux données reste contrôlé par Auth et les règles Firestore. Ce correctif ne modifie ni les fournisseurs, ni les domaines OAuth, ni les règles d’accès.

L’extension « Mes amis » ajoute des profils publics séparés et des relations privées entre participants. Le fonctionnement et les règles actuelles sont décrits dans [FRIENDS.md](FRIENDS.md). Les mentions ci-dessous sur les records exclusivement locaux décrivent la première livraison de la connexion.

Projet prévu : `brain2jeu`. Domaine du site : `brain2jeu.leofinance.fr`.
Contact : `la.lutz@outlook.fr`.

## État vérifié

La session Google du propriétaire a été renouvelée. L’application Web est
enregistrée, la configuration réelle est présente dans `.env.local`, et les
fournisseurs Email/Mot de passe et Google sont activés dans le vrai projet.
L’API Firestore est active. Les domaines autorisés ont été vérifiés :
`brain2jeu.firebaseapp.com`, `brain2jeu.web.app`, `brain2jeu.leofinance.fr`,
`localhost` et `127.0.0.1`. La facturation du projet n’est pas activée.

La base `(default)` a été créée après accord du propriétaire en édition
**Standard**, mode natif, région **Paris (`europe-west9`)**. L’API a confirmé
`databaseEdition: STANDARD`, `freeTier: true` et le temps réel actif. Les règles
ont été compilées lors d’un déploiement à blanc puis déployées avec succès.

Le portail est publié sur **https://brain2jeu.leofinance.fr/**. Le propriétaire
a exécuté `deploy/publish-auth-firebase.ps1` en saisissant son mot de passe
directement dans son terminal. Le serveur a installé la version
`/var/www/brain2jeu/releases/20261016T075231Z-1272215`.

La vérification indépendante du domaine a confirmé HTTP 200, le JavaScript
`assets/index-Cwk_yWuD.js`, la feuille `assets/index-CiL34Hj1.css`, leurs types
MIME et le service worker avec `Cache-Control: no-store`. Le portail et son
écran d’inscription ont été inspectés dans le navigateur sans erreur console.
Capture : `artifacts/portail-authentification-en-ligne.png`.

L’archive `artifacts/brain2jeu-auth-firebase.tar.gz` reste disponible ; elle
contient le portail compilé avec la configuration réelle, sans mode émulateur.
Le script de publication conserve les anciennes versions sur le serveur.

Les parcours e-mail et les 28 contrôles de règles ont réussi dans les émulateurs.
Un test supplémentaire avec création/suppression de compte temporaire en
production a été refusé par l’examen automatique et n’a pas été exécuté.
La connexion Google avec le compte personnel du propriétaire et la réception
des e-mails restent à essayer lors de sa première utilisation ; aucun compte
personnel n’a été créé pour lui.

## Terminer la configuration distante

1. Pour une session ultérieure, renouveler au besoin la connexion du compte
   Google autorisé sur ce projet :

   ```sh
   npx -y firebase-tools@latest login --reauth
   npx -y firebase-tools@latest firestore:databases:list --project brain2jeu
   ```

2. La base retenue est `(default)`, Standard, à Paris. Pour vérifier son état :
   `npx -y firebase-tools@latest firestore:databases:get '(default)' --project brain2jeu`.
   Pour une future autre base, examiner l’édition et l’identifiant avec
   `firestore:databases:get IDENTIFIANT --project brain2jeu`. Réutiliser la base
   du projet. En l’absence de base, choisir la région avec le propriétaire avant
   création ; la région et l’édition distantes ne sont pas déduites de ce fichier.
   Si la base est nommée, renseigner cet identifiant dans `firebase.json`
   (`firestore.database`) et dans `.env.local` (`VITE_FIREBASE_DATABASE_ID`).
   Une base Enterprise utilisée par ce portail doit proposer les mises à jour
   temps réel pour son écoute de document de profil.

3. Lister les applications Web puis récupérer leur configuration publique :

   ```sh
   npx -y firebase-tools@latest apps:list WEB --project brain2jeu
   npm run firebase:setup
   ```

   S’il y a plusieurs applications : `npm run firebase:setup -- APP_ID`.
   Si aucune application Web n’existe, en enregistrer une dans le même projet,
   puis relancer la récupération. Le script crée ou met à jour les quatre
   variables Web dans `.env.local` sans afficher leur contenu et sans effacer
   les autres paramètres locaux. Ces variables sont des identifiants publics
   du SDK Web, jamais des clés d’administration.

4. Activer les fournisseurs définis dans `firebase.json` :

   ```sh
   npx -y firebase-tools@latest deploy --only auth --project brain2jeu
   ```

   Vérifier l’adresse de support autorisée par Google pour la marque OAuth.
   `la.lutz@outlook.fr` doit être admissible dans le projet Google concerné.
   Le retour OAuth reste `https://brain2jeu.firebaseapp.com/__/auth/handler` :
   le VPS n’a pas à servir lui-même un gestionnaire OAuth Firebase.

5. Dans Firebase Authentication → Paramètres → Domaines autorisés, ajouter
   `brain2jeu.leofinance.fr`, `localhost` et `127.0.0.1`, en conservant les domaines
   existants. Les domaines s’écrivent sans protocole ni chemin.
   La CLI 15.34 ne gère pas `auth.authorizedDomains` dans son schéma ; cette clé
   n’est donc pas ajoutée artificiellement à `firebase.json`.

6. Tester puis déployer les règles, après revue des éventuelles règles déjà
   présentes sur la base sélectionnée :

   ```sh
   npm run test:firebase
   npx -y firebase-tools@latest deploy --only firestore:rules --project brain2jeu
   ```

7. Pour l’archive prête de cette livraison, transférer
   `artifacts/brain2jeu-auth-firebase.tar.gz` et `deploy/install-release.sh` sur le
   VPS selon [README.md](README.md), puis lancer :

   ```sh
   sudo bash /tmp/install-release.sh /tmp/brain2jeu-auth-firebase.tar.gz
   ```

   Pour une livraison ultérieure, reconstruire après récupération de `.env.local`.
   Vérifier sur le vrai domaine
   l’inscription e-mail, le lien de vérification, le mot de passe oublié, Google,
   le choix du pseudo et la reconnexion. Le sélecteur Google distant et la
   réception réelle des e-mails ne sont pas validables par l’émulateur local.

## Comportement du portail

- Inscription classique : pseudo + e-mail + mot de passe + confirmation.
- Connexion classique : e-mail + mot de passe.
- Google : compte Google, puis pseudo obligatoire à la première connexion.
- Pseudo : 3 à 20 lettres ASCII, chiffres ou `_`, unicité sans distinction de
  casse. `Leo` et `LEO` réservent la même clé.
- Un compte Auth dont la création de profil a été interrompue peut reprendre
  cette étape à sa prochaine connexion.
- Connexion persistante ou limitée à la session, récupération du mot de passe,
  envoi d’un e-mail de vérification et déconnexion depuis le profil.
- Les progrès des trois jeux restent locaux à ce navigateur. Cette version
  ne promet pas de synchronisation des scores entre comptes ou appareils.
- Intégration destinée au Web. Les projets Capacitor n’ont pas de connexion
  Google native configurée ni testée dans cette livraison.

## Données et règles

`users/{uid}` contient uniquement `username`, `usernameKey` et `createdAt`.
Le document est lisible par son propriétaire. Les e-mails et mots de passe sont
gérés par Firebase Auth ; le code ne les copie pas dans Firestore.

`usernames/{clé_en_minuscules}` contient seulement `uid`. Un joueur authentifié
peut lire une clé exacte pour réserver un pseudo ; il ne peut pas lister la
collection. La réservation et la création du profil se font dans une transaction.
Les règles utilisent `getAfter()` dans les deux sens pour refuser un profil sans
réservation ou une réservation sans profil correspondant. Le pseudo est immuable
dans cette version ; modification et suppression depuis le client sont refusées.
Les autres collections et sous-collections sont fermées.

Ces règles constituent un prototype à relire avant une large ouverture au public.
Elles limitent les accès au propriétaire, valident strictement les champs et les
tailles, et contrôlent les réservations atomiques ; les tests ne représentent pas
une garantie exhaustive de sécurité.

## Validation locale

`npm run build` vérifie TypeScript et compile. `npm test -- --testTimeout=30000`
exécute la suite existante et les tests de validation des identités. Le délai
étendu est utile pour les tests existants qui génèrent des milliers de calculs.

`npm run test:firebase` utilise exclusivement le projet d’émulation
`demo-brain2jeu`, avec des serveurs liés à `127.0.0.1`. Le script refuse de démarrer
sans les variables explicites des deux émulateurs. Aucun utilisateur de test
n’est créé dans le vrai projet.

Les 28 vérifications Firestore couvrent : accès invité, lecture du profil d’un
autre joueur, listings, usurpation d’UID, réservation isolée, profil sans
réservation, rôle admin ajouté, champ inconnu, taille excessive, mauvais type,
timestamp falsifié, clé incohérente, écrasement sans champs requis, modification
des données immuables, suppression, sous-collection non autorisée et réservation
concurrente. Les états, compteurs, URLs, montants et chemins de stockage ne sont
pas des champs de ce schéma et sont refusés comme champs supplémentaires.

Le même script vérifie aussi l’inscription e-mail contre l’émulateur Auth,
l’accès au profil avec le véritable jeton de ce compte d’émulation, la déconnexion,
le refus d’un mauvais mot de passe, la reconnexion au même UID et la demande de
réinitialisation. Il n’écrit jamais de mot de passe ou jeton dans les journaux.
