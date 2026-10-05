# Quart de nuit — cahier de conception

*Nom de travail. « Prendre le quart », c'est prendre son tour de garde à la barre ;
le quart de nuit est le plus dur.*

Un voilier, vu à la première personne. Une journée pour apprendre à le mener, une nuit
de tempête à tenir. Si le bateau est encore à flot quand le soleil se lève, on a gagné.

Inspiration : la vidéo d'Isaac Johnson (Three.js, octobre 2026) — un croiseur sous un
ciel de coucher de soleil qui tourne à l'orage, une trombe marine, la nuit bleue, la
pluie qui fouette, la radio VHF sur le pont.

---

## 1. Ce qui existe (étape 1 : le décor)

Ouvrir `atelier-mer.html` (serveur : `npm run dev`, port 5190).

| Élément | Comment c'est fait | Fichiers |
|---|---|---|
| La houle | 5 grilles de vagues calculées par FFT (méthode de Tessendorf, celle des films), spectre JONSWAP + houle de fond, de 1 800 m à 9 cm. Hauteur vérifiée par les tests (0,9 m par 10 nœuds, 3,9 m par 30, 7,3 m en tempête). Même calcul pour l'image et pour faire flotter le bateau. | `src/mer/` |
| La mer à l'écran | Toile d'araignée de 270 000 sommets autour de la caméra, reflets du ciel (Fresnel), éclats du soleil, lumière à travers les crêtes, écume calée sur les mesures réelles (~1 % de moutons à 13 nœuds, ~20 % à 48), brume, courbure de la Terre. | `src/rendu/eau.js` |
| Le ciel | Atmosphère physique (bleu, coucher orange, ombre de la Terre), nuages en volume (cumulus, plafond d'orage, éclairage multiple), cirrus, soleil, lune avec ses phases, étoiles qui tournent autour de l'étoile polaire (≈ 5 000 jusqu'à la magnitude 6, qui n'apparaissent qu'à la fin du crépuscule), Voie lactée. | `src/rendu/ciel.js`, `glsl/` |
| La côte | La côte de Kervalen à 3 ou 4 km au nord : falaises de granit, lande (herbe, ajoncs, bruyère), l'anse et le village de Port-Kervalen avec son clocher et sa jetée, la pointe du Bec et son phare (trois éclats toutes les 12 s au crépuscule, comme sur la carte), le sémaphore de Jos, l'île Brune. Elle se fond dans la brume exactement comme la mer. | `src/rendu/cote.js` |
| La tempête | Pluie (22 000 gouttes poussées par le vent, qui brillent dans la lampe frontale), éclairs (flashs, nuages illuminés, trait de foudre), nuit bleue. | `pluie.js`, `eclairs.js` |
| Le voilier | Croiseur de 9,40 m construit par le code : coque, pont antidérapant, cockpit et bancs en teck, rouf et hublots, quille à bulbe, safran et barre franche, mât, bôme, haubans, filières, balcons, winchs, compas, cordages (écoutes, drisses), feux de navigation. | `src/bateau/` |
| Les voiles | Recalculées à chaque image : creux, vrillage, faseyement quand elles sont mal réglées, ris, foc enroulé ; la toile s'illumine à contre-jour. | `voiles.js` |
| L'image | Halo autour des lumières, exposition qui s'adapte (sans compenser toute la nuit), AgX (le rendu de Blender), étalonnage par ambiance (doré au coucher, bleu la nuit). | `post.js` |
| L'atelier | 6 ambiances, curseurs (heure, vent, nuages, orage, pluie, brume, houle), 3 points de vue, photo, planches comparatives, petite balade au clavier. | `atelier-mer.*` |

Mesures sur le Mac M4 Pro : ~120 images/s en 1920 × 1200 ; la houle coûte 3 ms par image.

---

## 2. Le jeu

**Décisions de Mathis (2026-10-05)** : navigation *réaliste mais guidée* (vraie physique,
avec penons, indicateurs et conseils du vieux marin) ; déplacement *libre sur le pont* ;
partie d'*environ 35 min* (15 min de jour, 20 min de nuit) ; *ordinateur d'abord*
(clavier + souris), le téléphone plus tard.

### Une partie

| Moment | Heure à bord | Ce qu'on fait |
|---|---|---|
| **Le jour** | 9 h → 18 h | Apprendre le bateau, leçon par leçon, guidé à la radio. |
| **Le crépuscule** | 18 h → 21 h | L'avis de tempête tombe à la radio. Préparer le bateau. Le front orageux monte à l'horizon pendant le coucher du soleil. |
| **La nuit** | 21 h → 6 h | Tenir. Le vent forcit par paliers jusqu'au pic vers 3 h, puis faiblit. |
| **L'aube** | 6 h | Le soleil se lève sur une mer encore formée : victoire, bilan. |

Le temps est accéléré : environ 15 min de jour et 20 min de nuit.

### Le jour : apprendre pour de vrai

Un vieux marin parle à la radio VHF (canal 16, comme sur la vidéo) et donne une leçon
à la fois, avec des bouées à contourner :

1. **Barrer** : la barre franche se pousse à l'opposé de l'endroit où l'on veut aller.
2. **Lire le vent** : la girouette en tête de mât, les penons sur la voile, les vagues.
3. **Border et choquer** la grand-voile : trop bordée elle freine, pas assez elle faseye.
4. **Le foc** : le dérouler, le régler au winch.
5. **Virer de bord** (passer le nez du bateau dans le vent).
6. **Empanner** (passer l'arrière dans le vent) : attention à la bôme qui traverse le cockpit !
7. **Prendre un ris** : réduire la grand-voile au pied du mât.
8. **Préparer la nuit** : harnais, ligne de vie, gilet, feux, lampe frontale, descente fermée.

Chaque leçon réussie débloque un réflexe dont on aura besoin la nuit.

### La nuit : tenir jusqu'à l'aube

- **Garder le bon angle** face aux vagues (ni de travers, sinon le bateau se couche ;
  ni plein vent arrière, sinon il part au lof et se met en travers).
- **Réduire la toile** quand le vent forcit (2 ris, foc presque roulé) : trop de toile
  = gîte excessive, puis casse.
- **Écoper** : les déferlantes remplissent le cockpit, l'eau descend dans la cabine si la
  descente est ouverte. La pompe de cale se manœuvre à la main.
- **Rester attaché** : sans harnais, une vague peut emporter le marin.
- **Les imprévus** : une écoute qui casse, une voile qui se déchire, une trombe marine
  à éviter, un cargo qui croise (ses feux, un appel radio).
- **Perdre** : chavirer sans se redresser, couler (trop d'eau à bord), passer par-dessus bord.

### Les commandes (clavier + souris, clavier français)

- **À la barre** : Q / D pour tourner (avec la **barre assistée**, réglage par défaut :
  elles donnent le cap, et le bateau le garde quand on lâche ; sans elle, c'est la vraie
  barre), Z / S la grand-voile (border, choquer), A / E le foc,
  C / V l'enrouleur, P le pilote automatique, T le réglage automatique (aide), X le
  harnais (on s'attache aussi à la barre), Espace pour se lever.
- **À pied** : souris pour regarder, ZQSD pour marcher, E pour agir sur ce que l'on
  regarde (Maj + E : l'action inverse), Maj pour se tenir, C pour s'accroupir, X pour
  accrocher ou décrocher son harnais.
- Partout : F la lampe frontale, L le carnet de bord, Entrée pour passer une phrase de
  la radio, H cacher l'aide, Échap la pause (on peut y passer une leçon, recommencer,
  régler les options, quitter : la partie est gardée).

---

## 3. Feuille de route

Une étape = un résultat visible ; je ne lance la suivante qu'après ton feu vert.

1. ✅ **Le décor** — mer, ciel, tempête, voilier, atelier de la mer.
2. ✅ **Naviguer** (`jeu.html`, `atelier-bateau.html`) — vraie physique (`src/physique/`) :
   la coque découpée en 346 volumes flotte d'elle-même (4,9 t, roulis de 2,3 s, elle se
   redresse après 84° de gîte), le vent apparent sur chaque voile (portance, traînée,
   traînée induite), la quille et le safran comme des ailes, la bôme et le foc qui
   tournent librement jusqu'à leur écoute (l'empannage arrive tout seul). Le vent a ses
   rafales et ses bascules (`src/monde/vent.js`). Commandes au clavier français, pilote
   automatique, réglage automatique (aide), ris, enrouleur, lampe. Instruments à bord
   (vitesse et cap, cadran du vent, compas dont la rose tourne, girouette, penons sur le
   foc), jauges de réglage à l'écran. Son calculé : vent, sifflement du gréement, eau,
   ressac, faseyement, winch, claques d'étrave, pluie, tonnerre retardé par la distance.
   Tests : `npm run test-physique`, `npm run test-tempete` ; polaire : `npm run polaire`
   (vitesses proches d'un vrai 31 pieds : 5,4 nœuds au près et 6,9 au travers par 14 nœuds).
   Appris en tempête (48 nœuds, Hs 6,7 m) : au près, même avec 2 ris, le bateau se couche
   souvent ; en fuite au grand largue il est bien plus sûr, mais peut « partir au lof »
   quand une vague le rattrape. À régler à l'étape 5 pour que la nuit soit dure mais tenable.
3. ✅ **Vivre à bord** — se lever de la barre (Espace) et marcher partout : cockpit,
   bancs, hiloires, passavants, toit du rouf, pont avant, descente et carré
   (`src/joueur/pont.js` : les surfaces où l'on pose le pied, une marche de 45 cm au
   plus ; `marin.js` : le marin). Le pont penche et bouge : on sent la pesanteur du
   bateau (gîte, tangage, accélérations), on glisse si l'antidérapant ne tient plus,
   les filières arrêtent… sauf si le bateau se couche — alors, sans harnais (X) ni main
   tenue (Maj), c'est l'homme à la mer. La bôme qui passe pendant un empannage assomme
   (accroupis-toi : C). Les gestes (`gestes.js`) : on regarde et on appuie sur E — la
   barre, les winchs (le foc se borde au winch sous le vent), l'écoute de grand-voile,
   l'enrouleur, le ris au pied du mât (4 s à tenir), la descente, la pompe de cale, la
   radio (bulletin météo de « Kervalen Radio », voix de synthèse + sous-titres) et le
   tableau électrique (feux de navigation, éclairage blanc ou rouge).
   **La cabine** (`src/bateau/interieur.js`) : un vrai carré de croiseur — vaigrages en
   lattes, plafond crème à tasseaux de teck, bois verni (vernis brillant), plancher en
   teck et houx, banquettes, table à abattants, épontille, étagères de livres, table à
   cartes avec sa carte marine de Kervalen, VHF canal 16, tableau électrique, baromètre
   (son aiguille descend avec le mauvais temps) et pendule (l'heure du jeu) sur la
   cloison avant, cuisine (évier, réchaud, bouilloire), ciré jaune, extincteur, mains
   courantes. Les **hublots sont de vrais trous vitrés** : on voit la mer bouger et les
   filières, le soleil entre et dessine des taches qui bougent avec le roulis ; par le
   **panneau de pont** on voit le mât, la bôme et la grand-voile ; la **descente** est
   un vrai trou dans le toit que ferme le capot coulissant. Textures peintes par le
   code (`textures.js`) ; carte et cadrans dans des canvas (`peintures.js`).
   *La lumière de la cabine* est calculée dans ses propres matériaux (8 sources : 4
   hublots, la descente, le panneau, 2 plafonniers, plus la lumière renvoyée par les
   murs et l'ombre de la table) pour ne pas éclairer le pont à travers le rouf ; l'œil
   s'habitue (l'exposition suit la lumière de la cabine : dehors paraît éblouissant).
   Le son est étouffé dans la cabine. Tests : `npm run test-pont`.
   Appris : le test de tempête, refait sur trois mers différentes (une seule mer donnait
   un résultat au hasard), montre qu'aujourd'hui **ce sont les vagues qui couchent le
   bateau** : au près, 2 ris ou toute la toile, il se couche autant (≈ 7 s sur 160 s), et
   la fuite n'est pas assez sûre (≈ 3 s). Il faut que les choix du joueur comptent :
   c'est le premier chantier de l'étape 5.
4. ✅ **La journée d'apprentissage** (« Commencer la journée » sur l'accueil) — Jos, le vieux
   marin du sémaphore de Kervalen, appelle le voilier *Morgane* sur le canal 16 puis passe
   sur le 72 (`src/jeu/radio.js` : une file de messages, on ne se coupe pas la parole).
   Huit leçons (`src/jeu/lecons.js`) de 9 h au coucher du soleil, le vent forcissant
   d'heure en heure (8 → 24 nœuds) : barrer (la bouée jaune), lire le vent (les allures),
   la grand-voile (faseyer puis border), le foc et les winchs (à pied, au winch sous le
   vent), virer de bord (la bouée rouge, au vent), empanner (la bouée verte, sous le vent ;
   l'empannage sauvage est reconnu), prendre un ris (harnais, pied de mât), préparer la
   nuit (l'avis de coup de vent, puis une liste : 2 ris, foc roulé, gilet et ciré dans la
   cabine, feux, lampe, descente fermée, harnais). Les commandes se débloquent au fil des
   leçons ; Jos donne des conseils quand il voit qu'on peine (vent debout, voile qui
   faseye, mauvais côté…). L'heure avance avec la leçon, puis un accéléré mène à la
   suivante. Les bouées sont de vraies marques de balisage qui flottent et s'allument au
   crépuscule (`src/rendu/bouees.js`), avec un repère à l'écran. Le carnet de bord (L) :
   les leçons, les réflexes à retenir pour la nuit, le journal tenu heure par heure.
   Un incident (homme à la mer, bôme, cailloux près de la côte) fait reprendre la leçon.
   Le soir, un bilan. La logique (`src/jeu/journee.js`) ne dépend pas de l'écran :
   `npm run test-journee` fait jouer toute la journée à un élève automatique avec la
   vraie physique (≈ 12 min pour un élève parfait).
   Appris : sous grand-voile seule, le bateau lent est trop ardent (il remonte au vent
   malgré la barre) : on part le foc à moitié déroulé.
5. ✅ **La nuit de tempête** (« Commencer la nuit » au coucher du soleil, ou directement
   depuis l'accueil, bateau non préparé ; trois difficultés : Matelot, Marin, Cap-hornier).
   Le moteur de la nuit (`src/jeu/nuit.js`, sans écran, comme la journée) : quatre
   chapitres de 18 h 45 à l'aube (≈ 19 min : le crépuscule, le vent monte, au cœur de la
   tempête, l'accalmie), le temps qui se gâte heure par heure (25 → 42 nœuds vers 2 h 30,
   rafales à 55, mer de 6 m ; le front couvre la lune après le coucher ; le vent tourne à
   l'ouest à 3 h 30, les étoiles reviennent), Kervalen Radio qui lance l'avis de tempête,
   Jos qui veille sur le 72 (des conseils selon ce qu'il voit : trop de toile, de travers
   aux vagues, harnais, descente, pompe, feux, empannage ; on peut l'appeler).
   **Les déferlantes** (`src/monde/deferlantes.js`) : une toutes les 35 s au plus fort ; on
   les entend gronder et on les voit arriver 3,5 s avant (`src/rendu/deferlantes.js` : un
   front d'eau sombre éclairé comme la mer, posé sur la bosse d'une grosse vague, coiffé
   d'une lèvre dont l'écume dégringole en coulées ; la nuit, **le plancton s'allume** dans
   l'écume, bleu-vert). De travers, une grosse couche le bateau ; par l'arrière, elle le
   pousse. **L'eau à bord** : la déferlante remplit le cockpit (il se vide par ses nables),
   l'eau descend dans la cabine si la descente est ouverte, le bateau suinte dans la
   tempête ; elle pèse et court vers le côté qui penche (la physique la porte) ; on la voit
   (`src/bateau/eau-a-bord.js` : une surface qui reste à plat et clapote, dans le cockpit et
   sur le plancher du carré) ; on pompe (2,5 L par coup). **Les avaries** : l'écoute de foc
   qui casse au plus fort (rouler le foc, puis passer une nouvelle écoute au pied de l'étai,
   harnais accroché), une voile qui se déchire si on garde trop de toile (ou si elle bat),
   le pilote qui lâche (réarmer son disjoncteur au tableau). **La trombe marine** au
   crépuscule (`src/rendu/trombe.js` : un tube de condensation qui descend du nuage,
   tourne, se courbe et finit en corde ; un buisson d'embruns à son pied ; son vent
   tourbillonne à 60 nœuds) : il faut lofer et filer de travers. **Le cargo** de 22 h 30
   (`src/rendu/cargo.js` : 185 m, conteneurs, château aux hublots allumés, et ses feux
   réglementaires, chacun dans son secteur) : il ne nous a pas vus ; on l'appelle au canal
   16 (la radio, à la table à cartes) et il se déroute ; sinon il sonne cinq coups brefs et
   vire au dernier moment (feux éteints, il nous voit bien plus tard). **Perdre** : emporté
   par une déferlante sans harnais, à la mer, coulé (2 000 L), chaviré, abordé, sur les
   cailloux — on reprend au début du chapitre. **L'aube** : le bilan (déferlantes, gîte,
   eau pompée, avaries, trombe, cargo, temps à la barre, distance).
   L'image : embruns (des milliers de gouttelettes que le vent emporte, `embruns.js`),
   gouttes sur l'objectif (`gouttes.js` : chacune est une petite lentille), grand-voile
   affalée et ferlée sur la bôme, voile déchirée. Le son : le grondement d'une déferlante
   puis son fracas, l'eau qui clapote dans la cabine et gargouille dans le cockpit, le
   rugissement de la trombe, le diesel et la corne du cargo, l'alarme du pilote, la voile
   qui se déchire.
   **L'atelier de la tempête** (`atelier-tempete.html`) : la nuit rejouée en accéléré (≈ 30 s,
   dans un fil de calcul à part) par trois marins automatiques (`src/jeu/marins.js` : le
   prudent, le moyen, l'imprudent), mêmes vagues pour tous ; qui voit l'aube, leurs
   courbes (vent, mer, gîte et déferlantes, eau dans la cale), leur journal ; la difficulté
   sur mesure (à recopier dans `DIFFICULTES`) ; et **tes nuits** (le jeu enregistre les
   six dernières sur l'ordinateur), en pointillés à côté des marins.
   Tests : `npm run test-tempete` (la tactique compte), `npm run test-nuit` (le prudent voit
   l'aube, l'imprudent non, la trombe, le cargo, les avaries).
   Appris : 1) au près et de travers, les bateaux finissaient vent debout — le safran
   décrochait trop tôt (il porte maintenant jusqu'à ~1,1, puis décroche en douceur) et
   personne ne choquait : le réglage automatique « dépuissance » (il choque la grand-voile
   au-delà de 20° de gîte, et en grand quand il faut toute la barre pour abattre). 2) Le
   safran sort de l'eau quand le bateau gîte fort ou que l'arrière se soulève : il
   « ventile », c'est le départ au lof. 3) Une déferlante a trois fois plus de prise de
   travers que par l'avant ou l'arrière. Résultat (`test-tempete`) : en fuite sous un bout
   de foc, rien ne couche le bateau ; de travers, 5 déferlantes sur 15 le couchent ; toute
   la toile, il passe 5 fois plus de temps « couché sur l'eau ». 4) Avec la grand-voile au
   grand largue, dès que les déferlantes arrivent (33 nœuds), celles qui frappent la hanche
   font partir le bateau en travers, et aucun pilote ne le retient ; sous foc seul, les
   vagues bien dans l'arrière (160-170°), le pilote tient à 3-10° près. D'où les conseils de
   Jos : affaler dès 34 nœuds, les vagues bien dans l'arrière. 5) La synthèse vocale des
   navigateurs reste parfois bloquée : chaque phrase de la radio a un délai de secours, et
   les messages urgents coupent la parole. 6) Quand la mer change d'un coup, la vitesse de
   l'eau calculée entre deux images explosait : elle est bornée, et un garde-fou ramène le
   bateau à son dernier état sain (les tests vérifient qu'il ne sert jamais).
6. ✅ **Finitions**, et **en ligne** depuis le 2026-10-05 : https://patapain18.github.io/quart-de-nuit/
   (dépôt public `Patapain18/quart-de-nuit`, publié par GitHub Pages à chaque envoi sur `main`) —
   **L'accueil**, sur le coucher de soleil menaçant, avec « Reprendre ta partie » : le
   navigateur garde où l'on en est au début de chaque leçon, au coucher du soleil et au
   début de chaque chapitre de la nuit (et l'état du bateau : ris, foc, feux, gilet,
   descente, harnais). **La pause** dit où l'on en est, et propose de recommencer la leçon
   ou le chapitre, d'ouvrir le carnet ou les options, de quitter (la partie reste gardée).
   **Les options** (`src/jeu/options.js`, gardées par le navigateur) : la qualité de
   l'image (Économique, Moyenne, Haute, Superbe : finesse de l'image, anticrénelage,
   ombres, nuages, densité de la mer, pluie et embruns), la souris (sensibilité,
   inverser), le champ de vision, un **horizon stable contre le mal de mer** (la tête
   compense presque tout le roulis), les secousses, les gouttes sur l'écran, le volume, la
   voix de Jos et ses sous-titres. **L'aube** : le soleil se lève (un accéléré de 20 s
   jusqu'à 6 h 48, le ciel se dégage, le vent tombe), puis le bilan, avec **la note de
   Jos** (★ rescapé, ★★ bon marin, ★★★ loup de mer) et la journée qui a précédé.
   **À propos** (les crédits, et les coulisses : les trois ateliers). **Au chargement,
   tous les shaders sont préparés** : la trombe, le cargo, les déferlantes n'apparaissent
   qu'en pleine nuit, et les compiler à ce moment-là ferait sauter l'image. Sur un
   téléphone, un mot : le jeu se joue au clavier et à la souris (pas de version mobile,
   donc pas d'écran « Tourne ton téléphone »). La page d'entrée du site, le README, la
   recette de mise en ligne (`.github/workflows/mettre-en-ligne.yml`, GitHub Pages) ; le
   site fabriqué pèse 1,1 Mo (tout est calculé).
   Mesures (une petite fenêtre, carte graphique synchronisée) : de 4,1 ms (Économique) à
   5 ms (Superbe) par image au plus fort de la tempête.
   Appris en ligne : la préparation des shaders attendait deux images du navigateur, qui
   n'arrivent pas dans un onglet resté en arrière-plan ; une minuterie prend le relais, et
   l'accueil se débloque au bout de 10 s quoi qu'il arrive.

### Le grand chantier (octobre 2026, après la mise en ligne)

Ce que Mathis a demandé : un grand coup de neuf sur l'image, une trombe à la hauteur de la
vidéo (et qui fasse vraiment quelque chose au joueur), un vrai son, une ambiance qui fait
**peur**, un jeu plus facile, plus d'électronique à bord, et surtout **aucun bug** (« le
ciel fait de petits freezes de temps en temps », « la physique du personnage a des
défauts, notamment pour rentrer dans le cockpit »), avec des outils comme les ateliers
pour vérifier. Ses choix : la peur **réelle, avec une touche d'étrange** (des choses
inexpliquées, jamais confirmées : un écho radar qui n'existe pas, une voix sur le 16, Jos
qui ne répond plus) ; ce qui est dur, c'est **barrer, tenir un cap** ; l'électronique :
**un radar** ; le son : **de vrais enregistrements** (libres de droits, CC0).

7. ✅ **Les bugs** (le personnage, les à-coups) —
   **Le personnage.** Une *inspection du pont* (`src/atelier/inspection-pont.js`, dans le
   jeu : `__jeu.inspecterPont()`) quadrille le bateau tous les 4 cm et compare le plan où
   l'on marche (`src/joueur/pont.js`) au vrai modèle 3D : on marchait dans le vide
   au-dessus de la descente ouverte, on flottait sur les bords penchés du toit, les pieds
   entraient dans le panneau de pont, et surtout la caméra traversait la bôme (à hauteur
   des yeux à l'avant du cockpit) et les boiseries de la cabine. Le défaut du cockpit :
   en remontant de la cabine, tant que les pieds étaient encore sur la marche, le jeu
   croyait le cockpit couvert d'un plafond (le pont) et la tête plongeait d'un coup.
   Corrigé : le marin a maintenant **un corps tiré du modèle 3D** (`src/joueur/encombrement.js` :
   les 42 000 triangles rangés dans une grille de boîtes de 12 cm ; rien n'entre dans ses
   hanches, sa poitrine ni ses yeux, la caméra reste à 15 cm de toute paroi), il **baisse
   la tête sous la bôme** (ou elle lui barre le passage sur le toit), regarde 35 cm devant
   lui pour baisser la tête à temps sous un plafond, descend l'échelle plus lentement,
   monte et descend les marches en souplesse, enjambe le bord penché du rouf ; le toit, le
   capot (ouvert ou fermé) et le panneau ont leurs vraies hauteurs ; la cloison de la
   descente est échancrée jusqu'au toit, comme sur un vrai bateau. Des *essais de marche*
   (`src/atelier/essais-marche.js`, `__jeu.essayerLaMarche()`) : un marin automatique fait
   le tour du bord dans le vrai jeu (winchs, pompe, écoute, mât, étai, radio, tableau,
   ciré, retour à la barre) et vérifie qu'il n'est jamais bloqué, que la caméra ne frôle
   rien (22 cm au plus près) et que la tête ne saute pas (8 cm par image au plus, sur
   l'échelle). `test-pont` fait rentrer le vrai marin dans le cockpit depuis 7 endroits,
   le bateau droit ou gîté à 30°.
   **Les à-coups.** Dans le panneau du navigateur, le jeu tourne enfin à sa vraie vitesse
   (120 images/s sur cet écran) : mesuré en temps réel, 60 s au plus fort de la tempête,
   99,9 % des images en moins de 17 ms. Le seul à-coup régulier : le changement de forme
   de la mer, toutes les 3 s (5 à 8 ms d'un coup) ; il est maintenant **étalé sur 14
   images** (32 rangs de grille par image). Les shaders ne sont plus jamais compilés en
   jeu (préparés pour la bonne cible de rendu, avec une image d'échauffement). Pour la
   suite : `jeu.html?perf` affiche **un compteur de fluidité** (`src/atelier/fluidite.js`) :
   le temps de chaque image, les à-coups, et ce qui les a causés.
8. ✅ **La barre assistée** (`src/jeu/barre-assistee.js`, l'option « Barre », activée par
   défaut) — Q et D font tourner **le cap voulu** (18° par seconde) ; lâchées, le cap
   reste, et un barreur invisible le tient : il pousse la barre selon l'écart, la freine
   avant de dépasser, compense le bateau ardent (l'écart qui dure) et devine le départ au
   lof quand le bateau gîte sous une risée. Il connaît le vent : un cap voulu à moins de
   44° du vent est ramené au près (du même bord, ou de l'autre si l'on a déjà passé le
   vent : on finit le virement commencé). Il n'est pas plus fort que le safran : par grosse
   mer, une vague peut encore faire partir le bateau. **Le compas**, en haut de l'écran à
   la barre : le cap, le cap voulu (jaune ; cyan pour le pilote), d'où vient le vent, le
   cône interdit en rouge, et la nuit au plus fort, la zone verte de la fuite (le vent dans
   le dos). Mesuré (`test-barre`) : par bonne brise, le cap tenu à 1-4° près à toutes les
   allures (la barre lâchée sans aide, le bateau part de 84° en 40 s) ; un virage de 60°
   ou 120° sans dépasser de plus de 6° ; dans la tempête, en fuite, à 2-11° près.
9. **Le son, avec de vrais enregistrements** (CC0) — le vent, la pluie, la mer, les
   déferlantes, les coups de mer sur la coque, le tonnerre, les grincements du bois et des
   cordages, le gréement qui siffle, la voile qui bat, la cabine étouffée, la corne du
   cargo, la radio ; mélangés en direct selon ce qui se passe, et un atelier du son.
10. **La trombe**, refaite : immense, sombre, audible de loin, et qui frappe vraiment le
    bateau (un atelier de la trombe pour la régler).
11. **La peur** : une nuit plus noire, le faisceau de la lampe dans la pluie, le bateau
    qui gémit, la radio qui grésille et Jos qui se tait ; et une touche d'étrange, jamais
    expliquée (un atelier de la peur pour régler l'ambiance chapitre par chapitre).
12. **Le radar**, à la table à cartes : le balayage, la côte, les grains, le cargo, le
    fouillis de la mer, la portée et le gain… et un écho qui n'existe pas.

## 4. Pistes graphiques notées pour plus tard

- Le front orageux du coucher de soleil (un mur de cumulonimbus d'un côté du ciel).
- Le sillage et l'écume le long de la coque (et celui du cargo).
- Le mur de cumulonimbus du front orageux, d'un côté du ciel, au coucher du soleil.
- L'eau verte qui balaie le pont quand une très grosse déferlante passe dessus.
- Le bruit de la mer calculé dans un « worker » (fil de calcul séparé) pour libérer 3 ms par image.
