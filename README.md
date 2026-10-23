# Brain2jeu

Une application de mini-jeux cérébraux en français, responsive dès **360 px**, construite avec React, TypeScript et Vite. Trois jeux sont entièrement jouables : **Mémoire — Miroirs cachés**, **Organisation — Petit train** et **Rapidité — Calcul mental**. Fil à fil est présenté comme à venir.

Le portail de compte propose e-mail / mot de passe avec pseudo, connexion Google
avec choix du pseudo, récupération du mot de passe et déconnexion. Firebase Auth
et Firestore sont intégrés au code. Le vrai projet `brain2jeu` dispose des
fournisseurs e-mail et Google activés, d’une base Firestore Standard à Paris et
des règles déployées. Le portail est publié sur
[brain2jeu.leofinance.fr](https://brain2jeu.leofinance.fr/).
Voir [la configuration et son état vérifié](deploy/FIREBASE.md). Les jeux restent
accessibles sans compte avec une progression locale. Le correctif de sauvegarde par compte et son déploiement sont décrits dans [l’audit de synchronisation](deploy/PROGRESS-SYNC.md).

## Démarrage

Les **classements globaux et entre amis** sont accessibles depuis la navigation et les résultats : records par mode/niveau, percentile, rang mondial dans le top 1 % et parcours Petit train des amis. Voir [le fonctionnement, les tests et la mise en ligne](deploy/LEADERBOARDS.md).

```sh
npm install
npm run dev
```

Ouvrir l’adresse affichée par Vite. Pour tester sur un téléphone du même réseau : `npm run dev -- --host 0.0.0.0`, puis ouvrir l’adresse IP locale du PC avec le port indiqué. Le pare-feu doit autoriser le serveur local.

```sh
npm test         # tests des trois moteurs, du rendu et des records
npm run build   # vérification TypeScript + dist de production
npm run preview # aperçu de la version compilée
```

## Calcul mental

Sa carte ouvre le choix de **trois niveaux, tous accessibles**, chacun avec son record :

- **1 · Petits nombres** : petits entiers, signes et multiplications jusqu’à 12, puis opérations combinées.
- **2 · Grands calculs** : opérandes jusqu’à 999 et multiplications jusqu’à 50, avec **une seule opération par question**, à tous les paliers.
- **3 · Finance** : parts en pourcentage, prix après hausse ou remise, puis deux variations successives à partir de 15 bonnes réponses. Les montants vont de 100 à 10 000 €. Le texte distingue le montant du pourcentage du prix final. Les réponses restent entières, sans arrondi.

Quatre réponses neutres en grille 2 × 2, validation immédiate, sans défilement pendant la partie dès 360 px. Une réserve commune démarre à **10 s** sur une capacité de **11 s au niveau 1 et 15 s aux niveaux 2 et 3**. Bonne réponse : **+2 s au niveau 1, +3 s au niveau 2, +4 s en Finance**, et **+100 points** dans chaque niveau ; erreur : **−5 s**, sans retrait de points. Le temps continue pendant les 200 ms de correction. À zéro, la partie se termine immédiatement, même entre deux calculs. Les doubles touchers et les réponses tardives sont refusés.

Dans les deux niveaux arithmétiques, additions, soustractions et multiplications entières uniquement ; signes négatifs entre parenthèses, priorités respectées. Chaque niveau se complexifie toutes les cinq bonnes réponses cumulées, sans indicateur de progression pendant la partie. Les nombres restent bornés. Dans les trois niveaux, les quatre propositions forment un groupe de nombres proches : par exemple 48, 50, 52 et 55 pour un résultat de 50. L’écart total est limité à 6, 9, 15 ou 30 unités selon la taille du résultat. La bonne réponse peut être la plus petite, la plus grande ou l’une des deux valeurs centrales ; sa position à l’écran est aussi mélangée. En Finance, les propositions restent positives ou nulles. Les six dernières questions ne sont pas répétées.

Le tutoriel propose un essai adapté au niveau choisi, sans chrono ni points, au premier départ et reste accessible dans **Profil → Tutoriel · Calcul mental** ou depuis le choix des niveaux. Le résultat présente score, record du niveau, bonnes réponses/réponses, précision et durée réelle. **Rejouer** conserve le niveau ; **Menu** revient à leur sélection. Une question sans réponse ne compte pas comme une erreur. Tutoriel, records séparés et 100 dernières parties sont sauvegardés sous `declic.calcul-mental.v1` et intégrés aux progrès globaux. Les anciens records et parties sont conservés dans Petits nombres.

Les réglages sont regroupés dans `src/math/config.ts` (`MATH_RULES`, `MATH_LEVELS`, `MATH_DIFFICULTIES`, `LARGE_DIFFICULTIES`). `expressions.ts` génère et évalue les calculs sans `eval`, `choices.ts` construit les propositions proches, `distractors.ts` les applique aux calculs arithmétiques, `finance.ts` gère les pourcentages, `clock.ts` gère une échéance avec `performance.now()`, `scoring.ts` compte les réponses, `game.ts` coordonne les transitions, `storage.ts` persiste les résultats et `MathExperience.tsx` assure l’affichage. La barre est mise à jour directement à chaque image depuis la même échéance que le moteur, sans transition CSS retardée ni rendu complet du plateau à chaque image. Les doubles-taps sur le fond ne déclenchent pas de zoom. À expiration, les réponses sont bloquées immédiatement et la barre vide est affichée avant le résultat. Le contrôle de l’échéance reste indépendant des animations, y compris après chaque bonus ou pénalité et au retour d’un onglet en arrière-plan. Les préférences de son et d’animations réduites du profil sont respectées.

Les tests vérifient notamment 7 000 questions Petits nombres, 3 500 Grands calculs et 7 000 Finance, l’opération unique en Grands calculs, les signes et priorités, les pourcentages successifs, les choix uniques et proches, la variation du rang et de la position de la bonne réponse, les bornes de difficulté, le plafond temporel, les pénalités fatales, l’expiration pendant une transition, les réponses tardives, le double comptage, le rejeu dans le même niveau, la précision, les records séparés et la migration des sauvegardes.

## Petit train

- **8 niveaux uniquement**, de 4 à 11 gares. Les départs durent 120 secondes ; à zéro, les derniers trains continuent jusqu’à leur gare avant le résultat. 0 à 3 fautes débloquent la suite. Une quatrième faute laisse la partie se terminer pour s’entraîner. Les niveaux acquis restent accessibles.
- **Réseau aléatoire sans boucle** : arbres orthogonaux générés sur une grille, avec branches imbriquées, virages fixes et aiguillages orientés dans plusieurs directions. Les cellules occupées empêchent les croisements et les fusions. Dès le niveau 3, les deux branches du premier aiguillage contiennent d’autres choix. La topologie, les couleurs et le décor changent au rejeu ; le nombre d’aiguillages et les limites de longueur/profondeur restent bornés. Une approche de plus de 220 unités (plus de 3,5 s à vitesse normale) précède le premier choix.
- **Aiguillages binaires** : droit ou un virage de 90°, indiqué par le rail actif. Un toucher change aussi la direction d’une locomotive encore dans le cercle de l’aiguillage. La nouvelle trajectoire conserve sa position et sa tangente grâce à une courbe de raccordement ; le trajet déjà parcouru par les wagons reste conservé. Après la sortie du cercle, le changement concerne les trains suivants. Boutons tactiles de 44 px minimum, utilisables au clavier.
- **Repère de passage** : le cercle s’éclaire légèrement tant que la locomotive est dans la zone où un toucher peut encore l’orienter, dès l’entrée dans le cercle et jusqu’à sa sortie. Il reprend immédiatement son aspect normal quand seul le wagon y est encore. Le rendu et la simulation partagent cette même règle.
- **Erreur discrète** : une croix sur la gare concernée et un double son descendant. Le réglage des sons reste respecté.
- **Rails continus** : lignes et courbes partagent un tracé SVG par voie, sans embouts superposés ni redémarrage des traverses à chaque morceau. Dans les cercles, la voie sélectionnée se raccorde aux rails extérieurs par un masque et un découpage ; l’autre direction reste discrètement indiquée.
- **Vagues irrégulières** : rushs de 5 à 10 trains selon le niveau, petits groupes au rythme variable et trains isolés entourés d’accalmies de 4,5 à 6,5 s. L’ordre, la taille des groupes et les intervalles sont tirés au sort à chaque partie. Les rushs gardent au moins 1,9 s entre deux départs et sont suivis d’un répit ; la vitesse des trains reste constante. La densité de référence augmente progressivement en quatre phases et avec le niveau. Les apparitions continuent jusqu’à 120 s. Le chronomètre reste ensuite à zéro, les aiguillages restent actifs et le résultat attend toutes les livraisons.
- **Couleurs équilibrées** par sacs mélangés. Chaque train partage exactement la couleur et le symbole de sa gare. Les séquences identiques à la précédente sont évitées.
- **Score** : `100 + 25 × (gares − 2)` par bonne livraison, zéro point et une faute pour une mauvaise. Un identifiant de train empêche le double comptage.
- **Tutoriel interactif** au premier départ et depuis les paramètres de Petit train ou le profil Brain2jeu. Aucun résultat du tutoriel n’est enregistré.
- **Persistance locale** séparée (`declic.petit-train.v1`) : niveaux, tutoriel, record par niveau et 100 dernières parties. Les parties de Petit train rejoignent les statistiques de Brain2jeu. En cas de stockage bloqué, la progression reste en mémoire pour la visite.
- **Pause** : le bouton du plateau et la touche Échap suspendent ensemble le chronomètre, les trains et les départs. Reprendre conserve exactement le temps actif. « Recommencer la partie » lance le même niveau avec une autre topologie, de nouveaux départs, un chrono de 2 minutes et les compteurs à zéro. Recommencer ou quitter abandonne la tentative sans enregistrer de résultat ni modifier les records ou les niveaux débloqués.
- Sans pause manuelle, le temps continue en arrière-plan. Au retour, la simulation rattrape chaque apparition et livraison, sans faire disparaître les trains sans résultat.

### Régler ou étendre Petit train

Tous les paramètres sont dans `src/train/config.ts` : `TRAIN_RULES` (temps de départs, densité de référence, vitesse, feedback), `TRAIN_WAVE_RULES` (taille des groupes, espacement minimal, variations et accalmies), `TRAIN_LEVELS` (nombre de gares) et `TRAIN_COLORS` (couleur et symbole stables). La première série utilise onze couleurs. Pour aller au-delà de onze gares, ajouter des couleurs distinctes et adapter l’espacement / la taille du réseau dans `network.ts` pour préserver les zones tactiles.

```text
src/train/config.ts          Niveaux, couleurs et réglages
src/train/network.ts         Génération, géométrie commune au rendu et au mouvement
src/train/rails.ts           Tracés continus et raccords visuels des aiguillages
src/train/waves.ts           Vagues aléatoires, apparitions et sacs de couleurs
src/train/simulation.ts      Circulation, redirection dans les cercles, arrivée des derniers trains
src/train/time.ts            Horloge active et exclusion des durées de pause
src/train/scoring.ts         Points, fautes, résultat unique
src/train/storage.ts         Progression et records indépendants
src/train/TrainBoard.tsx     Plateau SVG forestier et boutons tactiles
src/train/TrainExperience.tsx Niveaux, tutoriel, résultat et paramètres
src/train/TrainPlay.tsx      Partie, bouton pause et reprise
```

Les tests épuisent toutes les combinaisons d’aiguillages pour les huit niveaux et les quatre entrées, vérifient les rushs / accalmies / trains isolés sur 960 horaires aléatoires, les bornes d’espacement et la densité, les départs jusqu’à zéro et les livraisons après zéro, les sacs, les corrections de direction dans tout le cercle sans saut de position, la pause, la variété des topologies, le comptage unique, la progression avec 0–3 / 4+ fautes et la persistance.

## Miroirs cachés — fonctionnement

- **Survie** : départ au niveau 1 ; 3 bonnes réponses non nécessairement consécutives pour monter ; 2 erreurs consécutives pour descendre ; fin à 3 erreurs au total. Le score reste acquis.
- **Défi** : 90 secondes, niveau fixe choisi parmi les niveaux débloqués en Survie. Le chronomètre affiche les secondes restantes. Le temps comprend observation et réponse, et est suspendu pendant les corrections.
- **Observation** : 3 secondes, sans balle ; miroirs ensuite retirés du rendu. Un toucher sur une sortie répond immédiatement.
- **Correction** : durée fixe de 1 600 ms pour les deux issues. La balle rejoue le trajet réel avec les miroirs pendant 500 ms ; le chemin complet reste visible 450 ms, puis un ✓ vert ou une croix rouge apparaît pendant 650 ms sous la grille, sans masquer le trajet. Les points gagnés apparaissent avec un « + points » animé au verdict.
- **Difficulté** : 17 niveaux configurables, à partir de deux miroirs sur une grille 3×3, plateau limité à 6×6. Le nombre de rebonds est tiré selon une loi gaussienne discrète bornée, dont la moyenne augmente à chaque niveau. Le niveau 5 vise environ 2 rebonds (1–3 autorisés), le niveau 8 en vise 3 (2–4 autorisés). À partir du niveau 8, la moyenne augmente de **0,5 rebond par niveau** : 3,5 au niveau 9, 4 au niveau 10, jusqu’à 7,5 au niveau 17. Des bornes symétriques conservent exactement ces moyennes dans la distribution théorique. Chaque plateau a un nombre entier de rebonds. Le générateur respecte le nombre exact tiré, sans retenir un parcours plus long. Les positions de miroirs sont uniques et les parcours sont vérifiés avec détection de cycles.
- **Score** : `100 + 25 × (niveau − 1) + max(0, 50 − 5 × floor(secondes de réponse))`.
- **Records** : Survie séparée du Défi, et Défi séparé par niveau. Les anciens records Défi 120 s sont archivés séparément des nouveaux records 90 s. Le tutoriel ne produit aucun résultat.
- **Données locales de jeu** : niveaux débloqués, tutoriel, préférences, records et 100 dernières parties. Les statistiques et jours de jeu sont calculés sur cet historique. Les comptes optionnels utilisent Firebase Auth et une sauvegarde Firestore privée : niveaux, records, tutoriels et historique sont fusionnés entre appareils. Les anciennes sauvegardes du navigateur sont importables depuis Profil. Voir [les limites et le déploiement](deploy/PROGRESS-SYNC.md).
- Le bouton Pause suspend le chronomètre, le temps de réponse, l’observation et les animations. Reprendre continue la même manche ; Recommencer relance une nouvelle partie du même mode ; Quitter abandonne la partie. Sans pause manuelle, un onglet en arrière-plan ne met pas le Défi en pause.

## Architecture

```text
src/game/engine.ts       Simulation, génération, score, progression et horloge purs
src/game/bounces.ts      Profils de rebonds par niveau et tirage gaussien discret borné
src/game/bounces.test.ts Bornes, distribution des parcours réels, cibles exactes et génération de secours
src/game/engine.test.ts  Réflexions, parcours, niveaux, compteurs, temps et records
src/platform/storage.ts Adaptateur de persistance versionné et validation des données
src/components/Board.tsx Plateau SVG et sorties sous forme de vrais boutons
src/components/Art.tsx   Illustrations vectorielles originales intégrées
src/App.tsx              Menu, modes, tutoriel, partie, résultat, progrès et préférences
src/styles.css           Design responsive, safe areas et animations réduites
```

Modifier `LEVELS`, `OBSERVATION_MS`, `CORRECTION_MS` et `CHALLENGE_MS` dans le moteur pour ajuster l’expérience. `BOUNCE_PROFILES` dans `src/game/bounces.ts` fixe, pour chaque niveau, le centre, l’écart-type et les deux bornes du nombre de rebonds. Les poids sont proportionnels à `exp(−0,5 × ((rebonds − centre) / écart-type)²)` et normalisés sur les entiers autorisés. Le tirage est effectué une seule fois par manche, puis le plateau est recherché pour cette cible exacte. Après 64 configurations infructueuses, une construction de secours place les miroirs supplémentaires hors du trajet et conserve cette cible ; elle évite une boucle ou un parcours plus difficile, même avec une source aléatoire dégénérée. Ce rééquilibrage s’applique à Survie et Défi ; les 17 niveaux, les points, le temps d’observation, les records et les niveaux acquis sont conservés. Les règles ne dépendent ni du DOM ni de React. Pour ajouter un jeu, créer son moteur indépendant et sa vue, puis ajouter son entrée au catalogue `gameInfo`.

Les icônes viennent de Lucide. Les illustrations sont du SVG local ; les polices DM Sans et Nunito Sans sont livrées avec le bundle via Fontsource. Aucun CDN n’est nécessaire. Les licences des polices sont présentes dans leurs packages npm.

## Web et hors connexion

Pour le VPS Nginx et `brain2jeu.leofinance.fr`, suivre [le guide de déploiement](deploy/README.md). `npm run release:vps` génère l'archive statique prête à transférer ; la configuration Nginx et le script d'installation sont dans `deploy/`.

Le manifeste permet une utilisation en fenêtre autonome sur les navigateurs compatibles. Le service worker de production précharge le shell, les scripts, les styles et les polices. Après une première visite terminée en ligne, le jeu peut être rouvert hors connexion. Le service worker nécessite HTTPS ou localhost et n’est pas activé dans le serveur de développement Vite. Lors d’une mise à jour, une actualisation peut être nécessaire.

La publication Sites est configurée dans `.openai/hosting.json`. C’est une publication privée ; son audience ne change pas celle d’un éventuel futur dépôt GitHub. Le dossier `dist/` peut aussi être déployé sur un hébergement statique, avec `base: './'` pour les sous-chemins.

## Préparation Android et iOS

Le projet inclut **Capacitor 8**, sa CLI et `capacitor.config.json` (`webDir: dist`). L’interface et le moteur sont réutilisables dans une WebView native. Les marges des appareils sont prises en compte avec `safe-area-inset-*` et `viewport-fit=cover`.

Quand tu souhaites générer les projets natifs :

```sh
npm install @capacitor/android@^8 @capacitor/ios@^8
npm run build
npm run native:android
npm run native:ios
npm run native:sync
npx cap open android
npx cap open ios
```

`cap add` se lance une seule fois par plateforme ; les changements suivants utilisent `native:sync`. Android demande Android Studio et le SDK Android. La compilation et la signature iOS demandent un Mac avec Xcode. Documentation : [installation](https://capacitorjs.com/docs/getting-started), [environnement natif](https://capacitorjs.com/docs/getting-started/environment-setup).

**Cette livraison prépare la migration ; elle ne contient pas de binaire signé et n’a pas été testée dans un simulateur natif.** Avant les stores : choisir l’identifiant définitif de l’app, générer les icônes/splash natifs, vérifier sur de vrais appareils, préparer les métadonnées et déclarations de confidentialité, puis signer avec les comptes développeur respectifs. Pour une persistance native plus robuste, l’adaptateur `storage.ts` peut être remplacé par Capacitor Preferences sans toucher au moteur.

## Amis et profils publics

« Mes amis », sous « Ton profil », permet de chercher un pseudo, gérer les invitations et consulter les meilleurs scores des trois jeux. Les profils publics ne contiennent aucun e-mail. Les nouvelles parties connectées publient leurs records ; les anciens records locaux se publient depuis le profil public. Données, tests et déploiement : [deploy/FRIENDS.md](deploy/FRIENDS.md).

## Dépôt GitHub

Le dépôt source est [Nik1go/Brain2jeu-](https://github.com/Nik1go/Brain2jeu-), sur la branche `main`. Le distant `origin` est configuré sur cette URL.

```sh
git clone https://github.com/Nik1go/Brain2jeu-.git
cd Brain2jeu-
npm install
npm run dev
```

Pour les modifications suivantes : `git add`, `git commit`, puis `git push origin main`. Les dépendances, le build et les archives de déploiement sont exclus du dépôt.

Les niveaux déjà débloqués sont décalés d’un cran avec la nouvelle progression. L’historique reste intact ; les anciens records sont conservés dans « Records des anciens niveaux » pour ne pas comparer les deux difficultés de départ. Le tutoriel guidé conserve un miroir pour expliquer la réflexion.
