# Déclic

Une application de mini-jeux cérébraux en français, responsive dès **360 px**, construite avec React, TypeScript et Vite. Deux jeux sont entièrement jouables : **Mémoire — Miroirs cachés** et **Organisation — Petit train**. Calcul mental et Fil à fil sont présentés comme à venir.

## Démarrage

```sh
npm install
npm run dev
```

Ouvrir l’adresse affichée par Vite. Pour tester sur un téléphone du même réseau : `npm run dev -- --host 0.0.0.0`, puis ouvrir l’adresse IP locale du PC avec le port indiqué. Le pare-feu doit autoriser le serveur local.

```sh
npm test         # tests des deux moteurs, du rendu et des records
npm run build   # vérification TypeScript + dist de production
npm run preview # aperçu de la version compilée
```

## Petit train

- **8 niveaux uniquement**, de 4 à 11 gares. Les départs durent 120 secondes ; à zéro, les derniers trains continuent jusqu’à leur gare avant le résultat. 0 à 3 fautes débloquent la suite. Une quatrième faute laisse la partie se terminer pour s’entraîner. Les niveaux acquis restent accessibles.
- **Réseau aléatoire sans boucle** : arbres orthogonaux générés sur une grille, avec branches imbriquées, virages fixes et aiguillages orientés dans plusieurs directions. Les cellules occupées empêchent les croisements et les fusions. Dès le niveau 3, les deux branches du premier aiguillage contiennent d’autres choix. La topologie, les couleurs et le décor changent au rejeu ; le nombre d’aiguillages et les limites de longueur/profondeur restent bornés. Une approche de plus de 220 unités (plus de 3,5 s à vitesse normale) précède le premier choix.
- **Aiguillages binaires** : droit ou un virage de 90°, indiqué par le rail actif. Un toucher change aussi la direction d’une locomotive encore dans le cercle de l’aiguillage. La nouvelle trajectoire conserve sa position et sa tangente grâce à une courbe de raccordement ; le trajet déjà parcouru par les wagons reste conservé. Après la sortie du cercle, le changement concerne les trains suivants. Boutons tactiles de 44 px minimum, utilisables au clavier.
- **Vagues irrégulières** : rushs de 5 à 10 trains selon le niveau, petits groupes au rythme variable et trains isolés entourés d’accalmies de 4,5 à 6,5 s. L’ordre, la taille des groupes et les intervalles sont tirés au sort à chaque partie. Les rushs gardent au moins 1,9 s entre deux départs et sont suivis d’un répit ; la vitesse des trains reste constante. La densité de référence augmente progressivement en quatre phases et avec le niveau. Les apparitions continuent jusqu’à 120 s. Le chronomètre reste ensuite à zéro, les aiguillages restent actifs et le résultat attend toutes les livraisons.
- **Couleurs équilibrées** par sacs mélangés. Chaque train partage exactement la couleur et le symbole de sa gare. Les séquences identiques à la précédente sont évitées.
- **Score** : `100 + 25 × (gares − 2)` par bonne livraison, zéro point et une faute pour une mauvaise. Un identifiant de train empêche le double comptage.
- **Tutoriel interactif** au premier départ et depuis les paramètres de Petit train ou le profil Déclic. Aucun résultat du tutoriel n’est enregistré.
- **Persistance locale** séparée (`declic.petit-train.v1`) : niveaux, tutoriel, record par niveau et 100 dernières parties. Les parties de Petit train rejoignent les statistiques de Déclic. En cas de stockage bloqué, la progression reste en mémoire pour la visite.
- **Pause** : le bouton du plateau et la touche Échap suspendent ensemble le chronomètre, les trains et les départs. Reprendre conserve exactement le temps actif. Quitter depuis la pause abandonne la tentative sans enregistrer de résultat.
- Sans pause manuelle, le temps continue en arrière-plan. Au retour, la simulation rattrape chaque apparition et livraison, sans faire disparaître les trains sans résultat.

### Régler ou étendre Petit train

Tous les paramètres sont dans `src/train/config.ts` : `TRAIN_RULES` (temps de départs, densité de référence, vitesse, feedback), `TRAIN_WAVE_RULES` (taille des groupes, espacement minimal, variations et accalmies), `TRAIN_LEVELS` (nombre de gares) et `TRAIN_COLORS` (couleur et symbole stables). La première série utilise onze couleurs. Pour aller au-delà de onze gares, ajouter des couleurs distinctes et adapter l’espacement / la taille du réseau dans `network.ts` pour préserver les zones tactiles.

```text
src/train/config.ts          Niveaux, couleurs et réglages
src/train/network.ts         Génération, géométrie commune au rendu et au mouvement
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
- **Difficulté** : 18 niveaux configurables, plateau limité à 6×6 ; nombre minimal de réflexions demandé croissant. Les positions de miroirs sont uniques et les parcours sont vérifiés avec détection de cycles.
- **Score** : `100 + 25 × (niveau − 1) + max(0, 50 − 5 × floor(secondes de réponse))`.
- **Records** : Survie séparée du Défi, et Défi séparé par niveau. Les anciens records Défi 120 s sont archivés séparément des nouveaux records 90 s. Le tutoriel ne produit aucun résultat.
- **Données locales** : niveaux débloqués, tutoriel, préférences, records et 100 dernières parties. Pas de compte, de serveur de données ou d’analytics. Les statistiques et jours de jeu sont calculés sur cet historique. Aucune synchronisation entre appareils.
- Le chronomètre ne propose pas de pause. Quitter abandonne la partie ; un onglet en arrière-plan ne met pas un Défi en pause.

## Architecture

```text
src/game/engine.ts       Simulation, génération, score, progression et horloge purs
src/game/engine.test.ts  Réflexions, parcours, niveaux, compteurs, temps et records
src/platform/storage.ts Adaptateur de persistance versionné et validation des données
src/components/Board.tsx Plateau SVG et sorties sous forme de vrais boutons
src/components/Art.tsx   Illustrations vectorielles originales intégrées
src/App.tsx              Menu, modes, tutoriel, partie, résultat, progrès et préférences
src/styles.css           Design responsive, safe areas et animations réduites
```

Modifier `LEVELS`, `OBSERVATION_MS`, `CORRECTION_MS` et `CHALLENGE_MS` dans le moteur pour ajuster l’expérience. Les règles ne dépendent ni du DOM ni de React. Pour ajouter un jeu, créer son moteur indépendant et sa vue, puis ajouter son entrée au catalogue `gameInfo`.

Les icônes viennent de Lucide. Les illustrations sont du SVG local ; les polices DM Sans et Nunito Sans sont livrées avec le bundle via Fontsource. Aucun CDN n’est nécessaire. Les licences des polices sont présentes dans leurs packages npm.

## Web et hors connexion

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

## Dépôt GitHub

Le dépôt source est [Nik1go/Brain2jeu-](https://github.com/Nik1go/Brain2jeu-), sur la branche `main`. Le distant `origin` est configuré sur cette URL.

```sh
git clone https://github.com/Nik1go/Brain2jeu-.git
cd Brain2jeu-
npm install
npm run dev
```

Pour les modifications suivantes : `git add`, `git commit`, puis `git push origin main`. Les dépendances, le build et les archives de déploiement sont exclus du dépôt.
