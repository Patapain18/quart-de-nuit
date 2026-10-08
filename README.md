# Quart de nuit

Un voilier, vu à la première personne. **Une journée pour apprendre à le mener, une nuit de tempête à tenir.** Si le bateau est encore à flot quand le soleil se lève, on a gagné.

> Où on en est (octobre 2026) : le jeu complet, environ 35 minutes. **La journée** : Jos, le vieux marin du sémaphore de Kervalen, t'apprend à la radio à mener le voilier *Morgane*, en 8 leçons, de 9 heures au coucher du soleil (barrer, lire le vent, régler les voiles, virer, empanner, prendre un ris, préparer la nuit), pendant que le front orageux monte à l'horizon. **La nuit** : de 18 h 45 à l'aube, le vent monte jusqu'à 42 nœuds et 55 en rafales, les vagues font 6 mètres et déferlent ; il faut réduire la toile, fuir devant le temps, pomper l'eau qui embarque, réparer ce qui casse, éviter une trombe marine et un cargo, et voir venir les grains (on les voit au radar, Jos les annonce, on entend l'averse arriver, leur rafale vient avant la pluie). L'image est entièrement calculée par le code, sans aucun fichier d'image : la mer, le ciel, le voilier et sa physique, la côte. Le son est fait de vrais enregistrements du domaine public (CC0), mélangés en direct.

**Jouer en ligne : https://patapain18.github.io/quart-de-nuit/**

## Lancer le jeu

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5190/jeu.html. Les ateliers (les coulisses) : `atelier-mer.html` (la mer, le ciel et la lumière), `atelier-bateau.html` (la polaire du voilier), `atelier-tempete.html` (la nuit rejouée en accéléré par des marins automatiques), `atelier-son.html` (écouter et mesurer le son de chaque situation), `atelier-trombe.html` (comparer les trombes marines : leur caractère, leur vie de la naissance à la corde, au crépuscule ou dans la nuit, sous les éclairs, de près, de loin, d'en haut), `atelier-grains.html` (faire passer un grain sur le bateau : son rideau de pluie, sa rafale sur la mer, ses éclairs, ce qu'il fait au bateau en courbes, et le radar), `atelier-risees.html` (les risées : les voir venir sur l'eau, du matin calme au coup de vent, et ce qu'elles font au bateau quand elles arrivent sur lui), `atelier-eclairs.html` (la foudre : un éclair dans le nuage, jusqu'à la mer, en araignée, tout près ou sur le mât, au ralenti ; le tonnerre qu'on entend arriver ; le feu de Saint-Elme ; la carte des nuages d'orage vue d'en haut).

Dans le jeu, des outils de vérification, à lancer dans la console du navigateur : `__jeu.inspecterPont()` (le plan où l'on marche colle-t-il au modèle 3D ? une carte du pont et de la cabine, tous les 4 cm), `__jeu.essayerLaMarche()` (un marin automatique fait le tour du bord et manie chaque chose), `__jeu.essayerLesEntrees()` (trente marins qui visent à peu près la porte de la timonerie ou l'escalier, de partout : combien passent ?), `__jeu.carteDesPassages()` (le bord vu de dessus, là où le corps passe, frôle ou bute, avec le chemin de chaque essai) et `__jeu.carteDesGestes()` (d'où atteint-on chaque chose ? jamais à travers une paroi).

## Comment on joue

Au clavier (français) et à la souris. La souris tourne la tête.

- **À la barre** : Q / D pour tourner (la **barre assistée** garde le cap quand on lâche ; le compas, en haut, montre le cap voulu, d'où vient le vent et là où le bateau ne peut pas aller), Z / S la grand-voile (border, choquer), A / E le foc, C / V l'enrouleur du foc, P le pilote automatique, T le réglage automatique des voiles, X le harnais, Espace pour se lever.
- **À pied** : Z Q S D pour marcher, E pour agir sur ce que l'on regarde (Maj + E : l'action inverse), Maj pour se tenir, C pour s'accroupir, X le harnais.
- **Partout** : F la lampe frontale, L le carnet de bord, Entrée pour passer une phrase de la radio, H pour cacher l'aide, Échap la pause (les options, quitter : la partie est gardée, on la reprend depuis l'accueil).

**La timonerie** : un étage vitré sur l'arrière du rouf, avec la vue tout autour. On y entre par la porte du cockpit, et trois marches descendent au carré (le ciré et le gilet sont pendus en bas). Sur la console : le radar, le traceur de cartes (E et Maj + E : l'échelle), la commande du pilote, le **tableau électrique** (les feux de navigation, l'éclairage, le disjoncteur du pilote : on l'atteint assis) et les répétiteurs ; sur la paroi tribord, la VHF, le baromètre et la pendule. Assis au poste (E sur le siège), on tient le cap au pilote : Q / D pour 1°, Maj + Q / D pour 10°, Espace pour se lever. Les choses s'attrapent à portée de main, jamais à travers une paroi, une vitre ou la porte fermée.

**Le radar** : l'écran est sur la console de la timonerie, et un petit répétiteur dans le cockpit, au-dessus du compas. Regarde-le et appuie sur E pour changer de portée (0,75 à 6 milles), Maj + E pour le filtre de mer. Il montre la côte, les bouées, les grains (les vrais : ceux qui passent sur la mer), le cargo, la trombe, la crête des vagues scélérates… et parfois ce qui n'est pas là : un écho qui te suit, quoi que tu fasses ; l'alarme de la zone de garde, pour un écho à cent mètres de ton sillage.

**Les risées** : les taches plus sombres qui courent sur l'eau, au vent, sont des risées : du vent plus fort, qui arrive sur toi avec le vent. On les voit venir (et on entend l'eau froissée chuinter juste avant) ; quand une risée est sur toi, le bateau gîte, accélère, et le vent tourne un peu : choque un peu, ou lofe. Les taches plus claires, plus lisses, sont des molles : le vent y faiblit.

**La foudre** : les éclairs partent des nuages d'orage, les grains surtout. Compte les secondes entre l'éclair et le tonnerre : trois secondes, un kilomètre ; s'il se rapproche d'un éclair à l'autre, l'orage vient sur toi (le radar te le montre, et tu peux t'écarter de sa route). Sous un grain orageux, une lueur violette peut s'allumer en tête de mât : le feu de Saint-Elme, l'air chargé d'électricité. La foudre tombe parfois tout près ; et, rarement, sur le mât : il la mène jusqu'à la quille, mais le pilote disjoncte (réarme-le au tableau électrique).

**La nuit noire** : au cœur de la tempête, il fait noir d'encre. Tu ne vois que ce qu'éclairent ta frontale (F) et les feux du bord, le plancton qui s'allume dans ton sillage et dans les vagues qui brisent autour de toi, et, le temps d'un éclair, toute la mer. Le radar devient tes yeux.

**La nuit, ce qui sauve** : au plus fort (plus de 34 nœuds), affaler la grand-voile au pied du mât et fuir sous un mouchoir de foc, les vagues bien dans l'arrière (le vent à 160-170°) ; jamais les déferlantes de travers ; le harnais toujours accroché ; la porte de la timonerie fermée ; pomper (la pompe est dans le cockpit, à bâbord) ; et quand un cargo arrive, l'appeler à la radio (canal 16, dans la timonerie).

**Les vagues scélérates** : deux ou trois fois dans la nuit, une vague de 18 à 22 m, presque deux fois la hauteur du mât. On l'entend gronder une minute avant, Jos prévient (quand il le peut), sa crête avance sur le radar ; au fond du creux qui la précède, un éclair la montre. Mets-la droit dans ton arrière et tiens-toi : de trois quarts, elle peut te coucher ; de travers, elle te couche.

Les **options** (accueil ou pause) : la qualité de l'image (économique, moyenne, haute, superbe), la sensibilité de la souris, le champ de vision, la **barre assistée** (ou la vraie barre, plus dure), un **horizon stable** contre le mal de mer, les secousses, les gouttes sur l'écran, les **éclairs vifs et les lumières qui vacillent** (à décocher si les éclats de lumière te gênent), **la nuit d'orage** (noir d'encre, très sombre ou sombre : pour un écran peu lumineux), le volume, la voix de Jos et les sous-titres.

Le jeu saccade ? Ouvre `jeu.html?perf` : un petit graphique, en haut à gauche, montre le temps de chaque image, compte les à-coups et dit ce qui les a causés.

L'atelier de la peur : `jeu.html?peur` ouvre, à droite du jeu, un panneau qui montre la tension de la nuit, chaque chose étrange qui peut arriver (si elle le pourrait maintenant, et sinon ce qu'il lui faut), un bouton pour la provoquer, des boutons pour sauter à une heure de la nuit, et la frise de toute la nuit.

## Les tests

Tout ce qui ne dépend pas de l'écran se vérifie sans navigateur :

```bash
npm run test-physique   # le voilier flotte, se redresse, avance
npm run test-houle      # la hauteur des vagues selon le vent
npm run test-pont       # on marche partout à bord sans rester coincé, on rentre dans le cockpit de partout, la porte fermée tient
npm run test-barre      # la barre assistée tient le cap, à toutes les allures et dans la tempête (≈ 3 min)
npm run test-journee    # un élève automatique fait toute la journée (≈ 1 min)
npm run test-tempete    # dans la tempête, la bonne tactique protège vraiment (≈ 2 min)
npm run test-nuit       # trois marins automatiques font la nuit : le prudent voit l'aube (≈ 1 min)
npm run test-scelerate  # la vague scélérate de 20 m, prise de six façons, sur trois mers (≈ 2 min)
npm run test-peur       # trois nuits de peur avec un marin simulé : rien n'est jamais confirmé
npm run test-grains     # un grain passe sur le bateau : tout arrive dans le bon ordre (le ciel, l'averse qu'on entend, la rafale, la pluie, l'accalmie)
npm run test-risees     # une risée arrive à l'heure, on la voit venir, le vent ne forcit que quand elle est là ; sur une heure, des rafales comme il faut
npm run test-eclairs    # les éclairs partent des nuages d'orage et de nulle part ailleurs ; le tonnerre à l'heure ; le mât attire la foudre ; une nuit, cent grains
npm run polaire         # la vitesse du voilier selon le vent (src/physique/polaire.json)
node scripts/reglage-scelerate.js 20 7.4,8.5 0.5,0.69 0.35   # régler la vague (plusieurs réglages en parallèle)
```

## Mettre en ligne

Le jeu est publié sur **GitHub Pages**, à l'adresse https://patapain18.github.io/quart-de-nuit/. Il n'y a rien à faire à la main : à chaque envoi (« push ») sur la branche `main`, un ordinateur de GitHub suit la recette `.github/workflows/mettre-en-ligne.yml` : il installe les outils (`npm ci`), fabrique le site (`npm run build`, qui crée le dossier `dist/`, avec des adresses relatives : il vit dans un sous-dossier), puis le publie. On suit son travail dans l'onglet « Actions » du dépôt. Les options, la partie en cours et les nuits enregistrées sont gardées par chaque navigateur, sur son ordinateur.

## Comment c'est fait

Le cahier de conception, étape par étape, avec ce qu'on a appris en route : [DESIGN.md](DESIGN.md). En bref :

- **La mer** : 5 grilles de vagues calculées par FFT (la méthode de Tessendorf, celle des films), le même calcul pour l'image et pour faire flotter le bateau (`src/mer/`, `src/rendu/eau.js`).
- **Le ciel** : une atmosphère physique, des nuages en volume, la lune, ~5 000 étoiles, les éclairs (`src/rendu/ciel.js`).
- **La trombe marine** : calculée en volume, comme les nuages (`src/rendu/trombe.js`, `src/rendu/glsl/trombe.js`) : le nuage-mur qui tourne, l'entonnoir qui descend à la rencontre de la gerbe d'embruns, la mer qui s'enroule en spirales, sa vie jusqu'à la corde. Celle du jeu est *la bête* : noire et large, à demi cachée dans la pluie, elle vient au début de la nuit, quand il reste un peu de lumière (le crépuscule s'attarde pendant son passage). Trois autres caractères restent à essayer (`jeu.html?trombe=colonne`, `fil` ou `soeurs`). Pour juger leur mouvement : l'atelier de la trombe filme (`__trombe.film('nom')`), `node scripts/film.mjs nom` en fait une vidéo, et `python3 scripts/fente.py nom ligne 0.45 0.4 0.6` une « fente temporelle » (ce qui tourne y dessine des traînées obliques).
- **Le voilier** : construit par le code (`src/bateau/`), et sa physique (`src/physique/voilier.js`) : 346 morceaux de coque qui flottent, les voiles et la quille comme des ailes, le safran qui décroche ou sort de l'eau, l'eau embarquée qui pèse.
- **La journée et la nuit** : deux moteurs sans écran (`src/jeu/journee.js`, `src/jeu/nuit.js`), que des programmes peuvent jouer de bout en bout (`src/jeu/marins.js`).
- **Les grains** (`src/monde/grains.js`) : des averses d'orage qui existent à un endroit, avancent avec le vent, naissent et meurent ; tout ce qui les touche en dépend — la pluie qui tombe ici, le vent du bateau (la rafale de l'air froid qui tombe d'eux arrive avant la pluie ; sur leurs côtés, le vent tourne ; derrière eux, il mollit), leur nuage d'orage au-dessus, leurs rideaux de pluie (calculés d'un coup dans les shaders : `src/rendu/glsl/grains.js`), la mer froissée sous la rafale, les éclairs qui tombent dedans, le bruit de l'averse qui approche, l'écho au radar, ce que dit Jos, les avaries qui lâchent dans la rafale. Le premier morceau du « monde connecté » (`DESIGN.md`).
- **Les risées** (`src/monde/risees.js`) : les rafales ne tombent plus au hasard. Ce sont des taches de vent plus fort (et des molles, de vent plus faible) qui existent à un endroit autour du bateau, avancent avec le vent, naissent, vivent une à deux minutes et s'effacent : le bateau les sent quand il est dedans (`src/monde/vent.js`), la mer les dessine (une petite carte vue d'en haut, `src/rendu/risees.js` : l'eau y est froissée, plus sombre, plus blanche par vent fort), on les entend arriver, et Jos les montre le matin.
- **La foudre** (`src/monde/foudre.js`) : les éclairs partent des nuages d'orage, et de nulle part ailleurs — les grains orageux (chacun à son rythme, selon sa force et son âge), le nuage de la bête, le front au loin. Dans le nuage, jusqu'à la mer (sous le cœur de pluie, parfois loin devant, avant la pluie), en araignée sous la base des nuages. Le trait (`src/rendu/eclairs.js`) est tortueux à toutes les échelles, sort de la base du nuage, s'efface dans la pluie et la brume ; le nuage s'allume de l'intérieur le long de l'éclair, la mer reflète son trait en colonne ; le tonnerre part du point le plus proche (3 s par kilomètre) et vient de la bonne direction ; la radio crépite ; le feu de Saint-Elme (`src/rendu/saint-elme.js`) ; le mât attire la foudre qui tombe près de lui.
- **Le son** : de vrais enregistrements, tous dans le domaine public (CC0 : BigSoundBank de Joseph Sardin, et Freesound), coupés et réglés par `npm run sons` d'après la recette `scripts/sons/recette.mjs` (8 Mo dans `public/sons/`), puis mélangés en direct par la Web Audio API selon le vent, la pluie, la mer, et selon qu'on est dehors ou dans la cabine (`src/son/audio.js`) ; quelques sons calculés font le reste. La voix de Jos est celle du navigateur. L'**atelier du son** (`atelier-son.html`) fait écouter et mesure le volume ressenti de chaque situation.

Fait avec Three.js (licence MIT) et Vite. Inspiré d'une vidéo d'Isaac Johnson (un voilier sous l'orage, en Three.js). Kervalen, *Morgane*, Jos et le cargo *Ar Men* sont inventés.
