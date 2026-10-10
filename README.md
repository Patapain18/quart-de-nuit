# Quart de nuit

**Minuit. Une tempête, un voilier, et toi seul à bord. Six heures avant l'aube.**

Le pilote automatique tient le bateau vent arrière, les vagues dans le dos. Toi, tu ne barres pas : tu le gardes en vie, comme le gardien de nuit de *Five Nights at Freddy's*. La batterie que tout vide, le moteur qui la recharge mais couvre les bruits, le pilote qui chauffe, l'eau qui monte vers les batteries, les vitres que les vagues brisent si leurs volets sont ouverts… et chaque heure est pire que la précédente. Si le bateau est encore à flot, et toi à bord, quand sonnent six heures, tu as gagné.

> Où on en est (octobre 2026) : **le jeu change de direction** (voir [DESIGN.md](DESIGN.md)). L'ancien jeu — une journée d'apprentissage avec Jos, puis une nuit de navigation — est gardé dans git (étiquette `v1-journee-et-nuit`) et reste en ligne tant que le nouveau n'est pas prêt. Le nouveau se construit sur la branche `la-nuit-seule` : l'étape 1 (la nuit seule, de minuit à six heures, sans Jos ni barre), l'étape 2 (le bateau de 14 m, sa grande timonerie vitrée, ses volets de tempête et sa cale) l'étape 3 (les systèmes du bord : la batterie, le moteur, le pilote qui chauffe, les pompes, les vitres) l'étape 4 (les heures : chaque heure plus dure, chaque vague qu'on entend venir de son côté, les deux sorties forcées) l'étape 5 (l'inexpliqué : le livre de bord de l'ancien propriétaire à la place de Jos, la porte de la cabine avant) et l'étape 6 (le son : plus silencieux, chaque son venant de sa place, de longs creux avant les coups) sont faites.

**Jouer en ligne (l'ancien jeu, pour l'instant) : https://patapain18.github.io/quart-de-nuit/**

## Lancer le jeu

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5190/jeu.html (et `jeu.html?heure=27.4` pour commencer directement à 3 h 24, pour vérifier). Les ateliers (les coulisses) : `atelier-mer.html` (la mer, le ciel et la lumière), `atelier-trombe.html` (la bête : sa vie de la naissance à la corde, dans la nuit du jeu ou au crépuscule, sous les éclairs, de près, de loin, d'en haut), `atelier-eclairs.html` (la foudre : un éclair dans le nuage, jusqu'à la mer, en araignée, tout près ou sur le mât, au ralenti ; le tonnerre qu'on entend arriver ; le feu de Saint-Elme), `atelier-grains.html` (faire passer un grain sur le bateau : sa rafale, ses éclairs, ce qu'il fait au bateau en courbes, et le radar), `atelier-son.html` (écouter chaque situation de la nuit, déclencher ses événements, et mesurer : le volume ressenti de chacune, la grosse vague qu'on entend venir de son côté, le silence avant les coups). `jeu.html?peur` ouvre, à droite du jeu, l'atelier de la peur (la tension, chaque chose étrange, un bouton pour la provoquer, sauter à une heure de la nuit).

## Comment on joue

Au clavier (français) et à la souris. La souris tourne la tête.

- **Assis au poste** (au début de la nuit, dans la timonerie) : E pour agir sur ce que tu regardes et qui est à portée de main (le radar, le traceur, la commande du pilote, le bouton du moteur, chaque disjoncteur du tableau électrique, la VHF et la commande des volets au plafond) ; Espace pour te lever.
- **À pied** : Z Q S D pour marcher, E pour agir sur ce que l'on regarde (Maj + E : l'action inverse), Maj pour se tenir, C pour s'accroupir, X le harnais (dehors).
- **Partout** : F la lampe frontale, L le livre de bord (les consignes de l'ancien propriétaire, sa dernière nuit page par page, et le journal de la tienne ; la molette tourne les pages), H pour cacher l'aide, Échap la pause (la nuit continue pendant la pause).

**Ce qu'il faut surveiller** (l'heure, en haut à droite, dit aussi la batterie et les alarmes) :
- **les vagues** : chaque heure, elles viennent plus souvent (une toutes les 40 s à minuit, toutes les 12 s à 5 h) et plus grosses ; tu les entends gronder avant qu'elles frappent, de leur côté — devant les plus grosses, tout le reste se tait —, et la nuit un éclair montre parfois leur crête (avec un casque, coche « Je joue avec un casque » dans les options : le son passe en trois dimensions) ;
- **la batterie** : tout ce qui est électrique la vide (le pilote surtout) ; coupe au tableau électrique ce dont tu peux te passer ; vide, tout s'éteint ;
- **le moteur** (son tableau, à gauche de la console) : il recharge la batterie et soulage le pilote, mais il chauffe dans la grosse mer… et tant qu'il tourne, tu n'entends plus venir les vagues qu'au dernier moment ; sans courant, il ne démarre plus ;
- **le pilote** : il chauffe quand il force (sa température est sur son écran) ; trop chaud, il disjoncte et le bateau se met en travers des vagues — en veille il refroidit, et son disjoncteur se réarme au tableau, une fois froid ;
- **l'eau à bord** : la pompe électrique se met en route toute seule ; soulève la trappe du plancher (derrière le siège, à bâbord) pour voir l'eau, et pompe à la main (la pompe est juste à côté) ; si l'eau atteint les batteries, c'est le noir — pompe, puis réarme le coupe-batterie (la clé rouge, derrière la pompe) ;
- **les vitres et leurs volets** : une vague qui frappe un côté fend ses vitres si leurs volets sont ouverts, la suivante les brise ; ferme les volets du côté d'où tu l'entends venir (la commande est au plafond) — mais derrière, on ne voit plus dehors ; fermés, leurs moteurs les tiennent (ils tirent un peu sur la batterie), et sans courant, la mer les force ;
- **la porte de la timonerie** : fermée, sinon les vagues qui remplissent le cockpit entrent à l'intérieur ; cockpit plein, ne l'ouvre pas ;
- **le foc** (la première sortie) : s'il se met à battre (son écoute a cassé), il secoue le bateau et le pilote force — sors le rouler (la bosse d'enrouleur, dans le cockpit, à tribord), harnais accroché ; **dehors**, accroche toujours ton harnais (X), et tiens-toi (Maj) quand une vague arrive ;
- **les dalots** (la seconde sortie) : s'ils se bouchent, le cockpit ne se vide plus et son eau passe sous la porte — sors les dégager, aux coins arrière du cockpit, derrière la roue (tiens E quatre secondes).

Et le reste, tu le verras : les grains, la foudre, la trombe qu'on ne voit qu'à la lueur des éclairs, les vagues scélérates qu'on entend gronder longtemps avant… et ce qui ne s'explique pas. Il y a un an, jour pour jour, on a retrouvé *Morgane* à la dérive, la timonerie vide ; le livre de bord de son ancien propriétaire, Yves Le Bihan, est toujours à bord. Une page de sa dernière nuit se lit à chaque heure.

## Les tests

Tout ce qui ne dépend pas de l'écran se vérifie sans navigateur :

```bash
npm run test-nuit       # trois veilleurs automatiques font la nuit, de minuit à six heures (≈ 1 min) : l'attentif voit l'aube, l'absent coule
npm run test-systemes   # la batterie, le moteur, le pilote qui chauffe, les pompes, l'eau qui noie les batteries, les vitres et les volets
npm run test-heures     # chaque heure plus dure, ce qu'on entend venir (et le moteur qui le couvre), l'éclair qui montre les vagues, les dalots bouchés, la trombe qui s'écarte
npm run test-physique   # le voilier flotte, se redresse, avance
npm run test-houle      # la hauteur des vagues selon le vent
npm run test-pont       # on marche partout à bord sans rester coincé, on rentre dans le cockpit de partout, la porte fermée tient
npm run test-tempete    # dans la tempête, la bonne tactique protège vraiment (≈ 2 min)
npm run test-scelerate  # la vague scélérate de 20 m, prise de six façons, sur trois mers (≈ 2 min)
npm run test-peur       # trois nuits de peur avec un marin simulé : rien n'est jamais confirmé (la porte de la cabine avant ne s'ouvre que dans son dos) ; le livre de bord, une page par heure
npm run test-grains     # un grain passe sur le bateau : tout arrive dans le bon ordre
npm run test-risees     # une risée arrive à l'heure, on la voit venir, le vent ne forcit que quand elle est là
npm run test-eclairs    # les éclairs partent des nuages d'orage ; le tonnerre à l'heure ; le mât attire la foudre ; une nuit, cent grains
npm run test-feux       # les feux de la côte : leurs éclats, leur portée, ce qu'on en voit cette nuit
```

## Mettre en ligne

Le jeu est publié sur **GitHub Pages**, à l'adresse https://patapain18.github.io/quart-de-nuit/. Il n'y a rien à faire à la main : à chaque envoi (« push ») sur la branche `main`, un ordinateur de GitHub suit la recette `.github/workflows/mettre-en-ligne.yml` : il installe les outils (`npm ci`), fabrique le site (`npm run build`), puis le publie. Le nouveau jeu vit sur la branche `la-nuit-seule` : il ne sera publié qu'une fois jouable, en la versant dans `main`.

## Comment c'est fait

Le cahier de conception, avec la nouvelle direction et ce qu'on a appris en route : [DESIGN.md](DESIGN.md). En bref :

- **La nuit** (`src/quart/nuit.js`) : un moteur sans écran, de minuit à six heures, qui décide de tout ce qui arrive, heure par heure (`HEURES` : chacune plus dure) ; **les systèmes du bord** (`src/quart/systemes.js`) : la batterie, le moteur, le pilote, les pompes, les vitres ; des veilleurs automatiques peuvent la jouer de bout en bout (`src/quart/veilleurs.js`). Le jeu (`src/quart.js`) la montre, la fait entendre et laisse le marin agir.
- **La mer** : 5 grilles de vagues calculées par FFT (la méthode de Tessendorf, celle des films), le même calcul pour l'image et pour faire flotter le bateau (`src/mer/`, `src/rendu/eau.js`).
- **Le ciel** : une atmosphère physique, des nuages en volume, le front orageux, les éclairs (`src/rendu/ciel.js`).
- **La trombe** : calculée en volume, comme les nuages (`src/rendu/trombe.js`) ; la bête naît sous l'avant d'un grain, et avance avec lui.
- **Les grains** (`src/monde/grains.js`) : des averses d'orage qui existent à un endroit, leur rafale, leur pluie, leur nuage ; **les risées** (`src/monde/risees.js`) ; **la foudre** (`src/monde/foudre.js`) qui part de leurs nuages.
- **Le voilier** : un 14 m à grande timonerie, construit par le code (`src/bateau/` : la coque, la timonerie et ses volets, la cale sous son plancher), et sa physique (`src/physique/voilier.js`) : 352 morceaux de coque qui flottent, l'eau embarquée qui pèse.
- **La peur** (`src/quart/peur.js`, `src/rendu/apparitions.js`) : ce qu'on voit du coin de l'œil et qui disparaît quand on le regarde en face, la porte de la cabine avant qui s'ouvre dans ton dos ; **le livre de bord** de l'ancien propriétaire (`src/quart/livre-de-bord.js`), qui apprend les commandes et raconte sa dernière nuit.
- **Le son** : de vrais enregistrements, tous dans le domaine public (CC0 : BigSoundBank de Joseph Sardin, et Freesound), coupés et réglés par `npm run sons`, puis mélangés en direct par la Web Audio API (`src/son/audio.js`) ; chaque son vient de sa place (le moteur sous le plancher, la VHF au plafond, la vague de son côté…), et l'oreille suit la tête.

Fait avec Three.js (licence MIT) et Vite. Inspiré d'une vidéo d'Isaac Johnson (un voilier sous l'orage, en Three.js). Kervalen et *Morgane* sont inventés.
