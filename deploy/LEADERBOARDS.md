# Classements et parcours des amis

L’entrée **Classements** est accessible dans la navigation sur ordinateur et mobile, depuis les sélections des trois jeux, depuis **Mes amis** et sur les résultats. Un compte avec pseudo est nécessaire. Les jeux restent accessibles sans compte.

## Comparaisons

- Calcul mental : un classement pour Petits nombres, Grands calculs et Finance.
- Miroirs : Survie avec les règles actuelles ; Défi **90 secondes**, séparé pour chacun des 17 niveaux. Les records des anciennes règles ne sont pas importés.
- Petit train : scores séparés pour chacun des huit niveaux ; onglet **Parcours** pour les niveaux atteints et réussis des amis.
- Global : vingt joueurs par page, pagination par curseur, record du compte affiché même hors de la première page.
- Mes amis : uniquement les relations **acceptées** et le joueur connecté. Une invitation en attente ne suffit pas. Les profils absents et les joueurs sans partie dans ce classement ne comptent pas.
- Les scores égaux partagent le rang de compétition (1, 1, 3). L’ordre d’affichage des ex æquo ne change pas leur rang.

Le rang mondial est `1 + nombre de scores strictement supérieurs`. Le pourcentage est `100 × nombre de scores strictement inférieurs / nombre des autres participants`, tronqué à une décimale ; les égalités ne sont pas des joueurs battus. Un joueur seul reçoit « Premier joueur de ce classement », sans pourcentage inventé. Pour **au moins 100 participants** et si le groupe complet des ex æquo entre dans le premier centile (`(participants − scores inférieurs) / participants <= 0,01`), le résultat affiche directement **« N° X au classement mondial »** et **TOP 1 %**. Il s’agit des participants au mode/niveau, pas de la population générale.

Le résultat attend la publication avant de lire le classement. Si un autre appareil possède déjà un meilleur record pour ce compte, le panneau précise le record partagé utilisé. Une connexion absente ou une erreur donne un état explicite et un bouton Réessayer ; aucun rang fictif n’est présenté. La reprise de connexion réessaie les publications en mémoire.

## Données Firestore

La base existante reste `(default)`, projet `brain2jeu`, édition **Standard**, région `europe-west9`. Aucun nouveau service n’est requis.

`leaderboards/{board}/entries/{uid}` contient exactement `username`, `score` (entier 0..1 milliard), `updatedAt` (date serveur). Identifiants : `math-{small|large|finance}-v1`, `mirror-survival-v2`, `mirror-challenge-v2-l1` à `l17`, `train-v1-l1` à `l8`.

Les joueurs connectés peuvent lire ces pseudonymes et scores, y compris avec les agrégations Firestore. Seul le propriétaire peut créer/améliorer son entrée, avec un pseudo vérifié contre son profil privé ; effacement, baisse de score, clés arbitraires et anciens identifiants de règles sont refusés. Les index automatiques de `score` suffisent. Les trois agrégations comptent la population entière, indépendamment des vingt lignes affichées. Les profils privés et les relations conservent leurs restrictions précédentes.

`publicProfiles/{uid}` accepte en plus le champ facultatif `trainProgress: { unlocked, completed }`. Les deux entiers ne peuvent que progresser. `unlocked` est compris entre 1 et 8, `completed` entre 0 et 8 et inférieur à `unlocked`, sauf au parcours terminé (8/8). Un profil ancien sans ce champ indique « Progression pas encore partagée ». Les abonnements aux profils mettent à jour le parcours quand un ami termine une partie.

Une transaction fusionne les records publics, la progression et les entrées de classement, en conservant les meilleurs résultats de plusieurs appareils. Les anciens records **déjà rattachés au compte** de Calcul et de Survie sont repris automatiquement. L’ancien record agrégé de Défi/Train n’identifie pas son niveau : il faut rejouer ou utiliser **Mes amis → Publier mes records de cet appareil** pour importer les vrais records locaux par niveau. Ce bouton importe aussi le parcours Train. Les anciennes parties d’un navigateur partagé ne sont jamais attribuées automatiquement à un autre compte. Le compte est capturé au départ de chaque nouvelle partie ; un changement de compte pendant celle-ci ne transfère pas le résultat.

Les scores restent déclarés par le client, comme les records publics existants. Les règles assurent l’identité, le format et la monotonie ; elles ne prouvent pas une partie côté serveur. Les lectures agrégées et les abonnements utilisent les quotas Firestore ; la liste globale est paginée.

## Validation locale

`npm test` : 210 tests, dont huit sur les classements (ex æquo, zéro/jamais joué, population, bornes exactes du top 1 %, séparation des niveaux, import et fusion).

`scripts/test-firestore-rules.mjs` : **145 contrôles** avec les émulateurs Auth/Firestore, plus les assertions de pagination, comptages, concurrence et séparation des modes. Un import atomique des 29 classements vérifie aussi les limites d’accès des règles. Aucun compte réel n’est utilisé.

Pour les fixtures visuelles, démarrer les émulateurs avec Java 21+, puis :

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
node scripts/test-firestore-rules.mjs
node scripts/seed-leaderboards-emulator.mjs
```

Le seed refuse toute destination distante. Il prépare AliceTest/BobTest amis, des scores fictifs et deux parcours Train différents. Lancer Vite avec les variables d’émulation décrites dans [FRIENDS.md](FRIENDS.md). Ne jamais utiliser les variables d’émulation pour une compilation de production.

## Mise en ligne

Les sources et le build sont préparés localement. La vérification distante du 16 octobre 2026 a échoué car la session Firebase CLI a expiré ; les nouvelles règles ne sont pas déployées. Les instructions antérieures de publication VPS restent applicables.

Après reconnexion Firebase, publier **les règles avant le front**, puis installer l’archive VPS :

```powershell
npx firebase login --reauth
npx firebase deploy --only firestore:rules --project brain2jeu
npm run release:vps
```

Ne pas publier uniquement le front contre les anciennes règles : les nouveaux chemins seraient refusés. La diffusion en production et la vérification mobile réelle restent à effectuer.
