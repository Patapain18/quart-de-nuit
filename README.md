# Quart de nuit

Un voilier, vu à la première personne. **Une journée pour apprendre à le mener, une nuit de tempête à tenir.** Si le bateau est encore à flot quand le soleil se lève, on a gagné.

> Où on en est (octobre 2026) : le jeu complet, environ 35 minutes. **La journée** : Jos, le vieux marin du sémaphore de Kervalen, t'apprend à la radio à mener le voilier *Morgane*, en 8 leçons, de 9 heures au coucher du soleil (barrer, lire le vent, régler les voiles, virer, empanner, prendre un ris, préparer la nuit), pendant que le front orageux monte à l'horizon. **La nuit** : de 18 h 45 à l'aube, le vent monte jusqu'à 42 nœuds et 55 en rafales, les vagues font 6 mètres et déferlent ; il faut réduire la toile, fuir devant le temps, pomper l'eau qui embarque, réparer ce qui casse, éviter une trombe marine et un cargo. L'image est entièrement calculée par le code, sans aucun fichier d'image : la mer, le ciel, le voilier et sa physique, la côte. Le son est fait de vrais enregistrements du domaine public (CC0), mélangés en direct.

**Jouer en ligne : https://patapain18.github.io/quart-de-nuit/**

## Lancer le jeu

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5190/jeu.html. Les ateliers (les coulisses) : `atelier-mer.html` (la mer, le ciel et la lumière), `atelier-bateau.html` (la polaire du voilier), `atelier-tempete.html` (la nuit rejouée en accéléré par des marins automatiques), `atelier-son.html` (écouter et mesurer le son de chaque situation).

Dans le jeu, deux outils de vérification, à lancer dans la console du navigateur : `__jeu.inspecterPont()` (le plan où l'on marche colle-t-il au modèle 3D ? une carte du pont et de la cabine, tous les 4 cm) et `__jeu.essayerLaMarche()` (un marin automatique fait le tour du bord et manie chaque chose).

## Comment on joue

Au clavier (français) et à la souris. La souris tourne la tête.

- **À la barre** : Q / D pour tourner (la **barre assistée** garde le cap quand on lâche ; le compas, en haut, montre le cap voulu, d'où vient le vent et là où le bateau ne peut pas aller), Z / S la grand-voile (border, choquer), A / E le foc, C / V l'enrouleur du foc, P le pilote automatique, T le réglage automatique des voiles, X le harnais, Espace pour se lever.
- **À pied** : Z Q S D pour marcher, E pour agir sur ce que l'on regarde (Maj + E : l'action inverse), Maj pour se tenir, C pour s'accroupir, X le harnais.
- **Partout** : F la lampe frontale, L le carnet de bord, Entrée pour passer une phrase de la radio, H pour cacher l'aide, Échap la pause (les options, quitter : la partie est gardée, on la reprend depuis l'accueil).

**Le radar** : l'écran est à la table à cartes, et un petit répétiteur dans le cockpit, au-dessus du compas. Regarde-le et appuie sur E pour changer de portée (0,75 à 6 milles), Maj + E pour le filtre de mer. Il montre la côte, les bouées, les grains, le cargo, la trombe… et parfois autre chose.

**La nuit, ce qui sauve** : au plus fort (plus de 34 nœuds), affaler la grand-voile au pied du mât et fuir sous un mouchoir de foc, les vagues bien dans l'arrière (le vent à 160-170°) ; jamais les déferlantes de travers ; le harnais toujours accroché ; la descente fermée ; pomper (la pompe est dans le cockpit, à bâbord) ; et quand un cargo arrive, l'appeler à la radio (canal 16, à la table à cartes).

Les **options** (accueil ou pause) : la qualité de l'image (économique, moyenne, haute, superbe), la sensibilité de la souris, le champ de vision, la **barre assistée** (ou la vraie barre, plus dure), un **horizon stable** contre le mal de mer, les secousses, les gouttes sur l'écran, le volume, la voix de Jos et les sous-titres.

Le jeu saccade ? Ouvre `jeu.html?perf` : un petit graphique, en haut à gauche, montre le temps de chaque image, compte les à-coups et dit ce qui les a causés.

## Les tests

Tout ce qui ne dépend pas de l'écran se vérifie sans navigateur :

```bash
npm run test-physique   # le voilier flotte, se redresse, avance
npm run test-houle      # la hauteur des vagues selon le vent
npm run test-pont       # on marche partout à bord sans rester coincé, et on rentre dans le cockpit de partout
npm run test-barre      # la barre assistée tient le cap, à toutes les allures et dans la tempête (≈ 1 min)
npm run test-journee    # un élève automatique fait toute la journée (≈ 1 min)
npm run test-tempete    # dans la tempête, la bonne tactique protège vraiment (≈ 2 min)
npm run test-nuit       # trois marins automatiques font la nuit : le prudent voit l'aube (≈ 1 min)
npm run polaire         # la vitesse du voilier selon le vent (src/physique/polaire.json)
```

## Mettre en ligne

Le jeu est publié sur **GitHub Pages**, à l'adresse https://patapain18.github.io/quart-de-nuit/. Il n'y a rien à faire à la main : à chaque envoi (« push ») sur la branche `main`, un ordinateur de GitHub suit la recette `.github/workflows/mettre-en-ligne.yml` : il installe les outils (`npm ci`), fabrique le site (`npm run build`, qui crée le dossier `dist/`, avec des adresses relatives : il vit dans un sous-dossier), puis le publie. On suit son travail dans l'onglet « Actions » du dépôt. Les options, la partie en cours et les nuits enregistrées sont gardées par chaque navigateur, sur son ordinateur.

## Comment c'est fait

Le cahier de conception, étape par étape, avec ce qu'on a appris en route : [DESIGN.md](DESIGN.md). En bref :

- **La mer** : 5 grilles de vagues calculées par FFT (la méthode de Tessendorf, celle des films), le même calcul pour l'image et pour faire flotter le bateau (`src/mer/`, `src/rendu/eau.js`).
- **Le ciel** : une atmosphère physique, des nuages en volume, la lune, ~5 000 étoiles, les éclairs (`src/rendu/ciel.js`).
- **Le voilier** : construit par le code (`src/bateau/`), et sa physique (`src/physique/voilier.js`) : 346 morceaux de coque qui flottent, les voiles et la quille comme des ailes, le safran qui décroche ou sort de l'eau, l'eau embarquée qui pèse.
- **La journée et la nuit** : deux moteurs sans écran (`src/jeu/journee.js`, `src/jeu/nuit.js`), que des programmes peuvent jouer de bout en bout (`src/jeu/marins.js`).
- **Le son** : de vrais enregistrements, tous dans le domaine public (CC0 : BigSoundBank de Joseph Sardin, et Freesound), coupés et réglés par `npm run sons` d'après la recette `scripts/sons/recette.mjs` (8 Mo dans `public/sons/`), puis mélangés en direct par la Web Audio API selon le vent, la pluie, la mer, et selon qu'on est dehors ou dans la cabine (`src/son/audio.js`) ; quelques sons calculés font le reste. La voix de Jos est celle du navigateur. L'**atelier du son** (`atelier-son.html`) fait écouter et mesure le volume ressenti de chaque situation.

Fait avec Three.js (licence MIT) et Vite. Inspiré d'une vidéo d'Isaac Johnson (un voilier sous l'orage, en Three.js). Kervalen, *Morgane*, Jos et le cargo *Ar Men* sont inventés.
