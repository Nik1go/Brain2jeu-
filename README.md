# Déclic

Une application de mini-jeux cérébraux en français, responsive dès **360 px**, construite avec React, TypeScript et Vite. Le premier jeu, **Mémoire — Miroirs cachés**, est entièrement jouable. Petit train, Calcul mental et Fil à fil sont présentés comme à venir.

## Démarrage

```sh
npm install
npm run dev
```

Ouvrir l’adresse affichée par Vite. Pour tester sur un téléphone du même réseau : `npm run dev -- --host 0.0.0.0`, puis ouvrir l’adresse IP locale du PC avec le port indiqué. Le pare-feu doit autoriser le serveur local.

```sh
npm test         # 34 tests du moteur, du rendu et des records
npm run build   # vérification TypeScript + dist de production
npm run preview # aperçu de la version compilée
```

## Fonctionnement

- **Survie** : départ au niveau 1 ; 3 bonnes réponses non nécessairement consécutives pour monter ; 2 erreurs consécutives pour descendre ; fin à 3 erreurs au total. Le score reste acquis.
- **Défi** : 90 secondes, niveau fixe choisi parmi les niveaux débloqués en Survie. Le chronomètre affiche les secondes restantes. Le temps comprend observation et réponse, et est suspendu pendant les corrections.
- **Observation** : 3 secondes, sans balle ; miroirs ensuite retirés du rendu. Un toucher sur une sortie répond immédiatement.
- **Correction** : durée fixe de 2 200 ms pour les deux issues. La balle rejoue le trajet réel avec les miroirs pendant 1 100 ms ; le chemin complet reste visible 450 ms, puis un ✓ vert ou une croix rouge apparaît pendant 650 ms sous la grille, sans masquer le trajet. Les points gagnés apparaissent avec un « + points » animé au verdict.
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

## Dépôt GitHub ultérieur

Le projet est prêt à être versionné. Aucun secret n’est nécessaire à son exécution. Ne pas ajouter `node_modules` ou `dist` au dépôt. Après création d’un dépôt GitHub vide, dans ce dossier :

```sh
git init
git add .
git commit -m "Create Déclic with responsive menu and mirror memory game"
git branch -M main
git remote add origin <URL_DU_DEPOT>
git push -u origin main
```

Si le workflow Sites a déjà initialisé Git, conserver son distant et utiliser `git remote add github <URL_DU_DEPOT>` puis `git push github HEAD:main`.
