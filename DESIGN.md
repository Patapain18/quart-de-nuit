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

Mesures sur le Mac M4 Pro : ~120 images/s en 1920 × 1200 ; la houle coûte 3 ms par image
(0,3 ms sur le fil principal depuis qu'elle est calculée dans un fil à part : étape 17).

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
9. ✅ **Le son, avec de vrais enregistrements** — 34 enregistrements du domaine public
   (CC0 : BigSoundBank de Joseph Sardin, et 12 membres de Freesound, licence vérifiée sur
   chaque page), coupés et réglés par une recette (`scripts/sons/recette.mjs`,
   `npm run sons`, ffmpeg) en **21 sons** pour le jeu (`public/sons/`, 8 Mo) : 16 boucles
   (le vent de la brise à la tempête et ses rafales, le gréement qui siffle puis hurle, la
   mer qui déferle, le cockpit par beau temps enregistré au large, les voiles pleines, la
   pluie sur le pont, une voile qui bat, le moteur du pilote ; dans la cabine : la mer à
   travers la coque, l'eau contre la coque, la pluie sur le toit, la tempête entendue de
   l'intérieur, le vent qui hurle) et 5 planches de sons brefs (16 craquements du bois et
   des cordages, 11 vagues qui frappent, 6 tonnerres, 2 cornes de paquebot, 4 parasites de
   radio). Boucles sans couture : la fin se fond dans le début, et 0,25 s de marge de part et
   d'autre (les MP3 commencent par un silence que les navigateurs n'enlèvent pas tous) ;
   raccords vérifiés. **Le mélange** (`src/son/audio.js`) suit le vent, la pluie, la mer,
   les voiles qui faseyent, le pilote qui pousse la barre ; le bois craque d'autant plus
   que le bateau est secoué ; trois bus : *dehors* (étouffé par la coque quand on descend),
   *dedans* (avec l'écho d'une petite pièce en bois), *bord* ; les sons calculés d'avant
   restent pour le reste (et tant que les enregistrements chargent). **L'atelier du son**
   (`atelier-son.html`) : 9 situations à écouter, les curseurs, le mélange en direct,
   la sonothèque et ses auteurs, et **la mesure du volume ressenti** (LUFS, la norme des
   radios, calculée sans jouer : `src/son/mesure.js`, vérifiée contre ffmpeg à 0,2 près) :
   du matin calme (−28) à la tempête sur le pont (−15), la cabine 4 à 6 points plus bas.
10. ✅ **La trombe**, refaite (`src/rendu/trombe.js`) — Avant : un tube pâle et
    transparent, un petit buisson d'embruns, et le bateau sentait à peine son passage.
    Maintenant : **un nuage-mur** de 1,4 km sous la base des nuages d'orage, une soucoupe
    noire et bosselée qui s'abaisse de 230 m vers son centre et tourne (de plus en plus
    vite vers le centre), sa tranche éclairée par le couchant ; **l'entonnoir** sombre qui
    en descend, évasé en trompette, strié de bandes qui tournent et montent ; à son pied,
    **une gaine et une jupe d'embruns** de 270 m (un bruit lu dans l'espace, qui tourne
    avec elles) et sur la mer **un anneau d'écume en spirales** (dessiné par la mer
    elle-même) ; les **éclairs** de sa cellule tombent autour d'elle (2,5 fois plus
    souvent) ; sous le nuage-mur, **il fait sombre** (l'exposition baisse de 30 %).
    **On l'entend** : son grondement de train de marchandises (le vent de tempête
    enregistré, joué deux fois plus lentement) monte dès 1,5 km et s'éclaircit en
    approchant ; à 300 m, le fracas de l'eau arrachée. **Elle frappe** : un tourbillon de
    74 nœuds au bord de son cœur (40 m), qui se fait sentir jusqu'à 540 m ; à 450 m, Jos
    crie de s'accrocher ; dans ses embruns, l'image se noie dans un brouillard laiteux, des
    gerbes traversent le pont, la vue tremble, des gouttes sur l'objectif ; si elle passe
    sur le bateau : il est couché (56° mesurés) et tourné sur lui-même, 220 L d'eau dans le
    cockpit, la grand-voile se déchire si elle est hissée, le pilote lâche une fois sur
    deux et demie, et un marin détaché est assommé. Puis Jos demande si tout tient.
    **L'atelier** : l'atelier de la mer a sa section « La trombe » (distance, décalage,
    force, sa fin en corde) ; adresse directe : `atelier-mer.html?ambiance=coucher-menacant&trombe=900`.
    Mesuré en temps réel (2400×1500) : la trombe ne coûte rien de visible (8,3 ms par image
    avec ou sans elle).
11. ✅ **La peur** — *Le réel* : la nuit d'orage est plus noire (l'exposition ne monte plus
    au-dessus de 2,5 : on n'y voit que ce qu'éclairent la lampe, les éclairs et les feux du
    bord) ; le faisceau de la lampe se voit dans la pluie et les embruns ; le bois et les
    cordages craquent sans cesse dans la tempête, le gréement hurle, le vent hurle dans les
    ouvertures ; au plus fort, la radio se brouille (des mots se perdent dans les parasites,
    la voix de Jos faiblit) ; quand ça devient grave (couché sur l'eau, la trombe sur nous,
    le bateau qui se remplit), **le cœur bat**, de plus en plus vite. *L'étrange*, jamais
    expliqué ni confirmé (`suivreEtrange` dans `nuit.js`, un hasard à part pour ne rien
    changer aux nuits déjà jouées) : vers minuit, **une lumière sur l'eau**, en tête de mât,
    qui apparaît et disparaît dans le creux des vagues, puis plus rien (il faut être
    dehors) ; vers 0 h 45, **une voix sur le 16**, trop faible et trop brouillée pour
    comprendre (un son calculé, pas la synthèse vocale : une voix sans visage) ; vers 1 h
    40, **Jos ne répond plus** (que des parasites) pendant une demi-heure, puis revient :
    « Il s'est passé… enfin, peu importe » ; vers 3 h, **des coups contre la coque**, à
    l'avant, trois puis un quatrième (seulement si l'on est dans la cabine). Appelé
    juste après, Jos cherche une explication, sans conviction (« Il n'y a aucun bateau
    signalé dans le secteur, à part toi »). Le carnet le note à sa façon. Pour les
    entendre et les voir : l'atelier du son (la voix, les coups, le cœur), et dans le jeu
    `__jeu.peur('lumiere' | 'voix16' | 'coups' | 'sansReponse')`.
12. ✅ **Le radar** (`src/bateau/radar.js`) — un écran à la table à cartes, et son
    répétiteur dans le cockpit, au-dessus du compas (la même image). L'antenne fait un tour
    en 2,5 s ; un rayon tous les 0,7°, 150 cases de distance ; les échos s'allument au
    passage du balayage puis s'estompent (gardés en nombres à virgule : pas de traînées
    grises). Il voit la côte de Kervalen (un rivage brillant, les premières collines, puis
    l'ombre), l'île, les bouées, le cargo, la trombe (une masse dense), les grains (des
    taches de pluie qui dérivent avec le vent) et le fouillis de mer autour du bateau,
    d'autant plus loin que les vagues sont hautes (le filtre de mer l'atténue près du
    bateau). Portées 0,75 / 1,5 / 3 / 6 milles (E sur l'écran), filtre de mer (Maj + E).
    Jos le présente au début de la nuit, et en parle quand le cargo arrive. *Et l'étrange* :
    vers 1 h, un écho par le travers, à 1,2-1,6 mille, qui garde la même distance pendant
    une vingtaine de secondes (il nous suit), puis disparaît. Jos : « Sur le mien, il n'y a
    que toi ».

13. ✅ **Le sillage** (`src/rendu/eau.js`) — le bateau laisse enfin une trace. Le long de
    la coque, l'eau qu'il fend blanchit (plus fort à l'étrave et quand il va vite : la
    « moustache »), en traînées qui filent vers l'arrière. Derrière lui, des remous : on
    garde où était sa poupe toutes les 2,5 s (une minute en tout), et le shader de la mer
    cherche, pour chaque point d'eau, le morceau de route le plus proche : son âge donne la
    largeur (les remous s'étalent) et la force (ils s'effacent). L'écume du sillage a son
    propre motif, étiré le long de la route (des plaques, des veines, un grain de bulles),
    sur une eau turquoise pleine de bulles qui s'éteint plus vite ; puis une traînée d'eau
    lisse (moins de petites rides : elle brille autrement). La nuit, le plancton remué
    s'allume : une lueur bleu-verte et de fines étincelles qui clignotent, seulement dans
    les remous frais (elle s'éteint en quelques secondes). Le sillage suit
    la vraie route (les virages aussi) et ne coûte rien de mesurable (120 images/s).

14. ✅ **Le front orageux** (`src/rendu/glsl/front.js`) — le coucher de soleil était joli,
    pas menaçant. Maintenant, dès la fin d'après-midi, une ligne d'orages monte à l'horizon
    au sud-ouest (d'où vient le vent), et Jos la montre : « ces grosses tours sombres, avec
    un toit plat. C'est le front ». Il est trop loin (de 160 à 22 km) pour avoir du relief
    quand on bouge : on le peint donc dans le ciel, selon la direction du regard, comme un
    décor de théâtre. Une dizaine de cellules d'orage (des colonnes arrondies, plus hautes
    au milieu), une masse commune dessous, et l'enclume : les trois tours du milieu butent
    contre le plafond (11 km) et s'étalent en un plateau mince, effiloché par-dessous. Le
    modelé « chou-fleur » : chaque boule est plus claire sur le dessus (elle voit le ciel) ;
    gris ardoise dans l'ombre, dorée sur les sommets que le soleil couchant éclaire, un
    liseré en contre-jour, et le voile d'air bleuté qui adoucit ses noirs à 40 km. Il
    approche (`front` : 0 → 1, dans la météo) et monte dans le ciel ; il cache le soleil
    qui passerait derrière lui ; la mer le reflète et l'horizon s'assombrit dessous. À la
    nuit tombée, des éclairs l'allument de l'intérieur (et un grondement sourd quand il est
    à moins de 32 km). Au matin, on le revoit de l'autre côté, au nord-nord-est, qui
    s'éloigne dans l'aube (pas devant le soleil levant : il ne gâche pas l'aube). Réglable dans l'atelier de la mer (« Front orageux »). Coût
    mesuré : rien de visible (120 images/s).

15. ✅ **Le paquet de mer** (`src/bateau/paquet-de-mer.js`) — quand une grosse déferlante
    frappe (ou la trombe), une nappe d'eau verte passe par-dessus le livet et balaie le
    pont d'un bord à l'autre en moins d'une seconde, avec sa ligne d'écume en tête, de
    l'eau blanche pleine d'air au début puis des traînées qui filent, et s'écoule
    par-dessus bord en deux secondes. Elle frappe d'où vient la vague : par l'arrière, c'est
    le cockpit qui la prend. Elle est peinte dans le shader des matériaux du pont
    (antidérapant, teck, gelcoat) : elle épouse le passavant, le rouf et le cockpit sans
    rien traverser, efface le relief de l'antidérapant et reflète le ciel ; la nuit, son
    écume s'allume du plancton. (Le pont est dessiné des deux côtés : on tient compte de la
    face vue, sinon la nappe ignorait le passavant.)

16. ✅ **Le sillage du cargo** (`ecumeDuCargo` dans `src/rendu/eau.js`, la forme de sa coque
    partagée dans `src/rendu/forme-cargo.js`) — à la place du « V » d'écume plat qu'il
    traînait (il flottait au-dessus des vagues dans la tempête), la mer dessine elle-même :
    la grosse vague d'étrave qui s'enroule autour de l'étrave et l'eau repoussée le long
    de sa coque ; les deux bras du « V » qui quittent la coque aux épaules de l'étrave puis
    s'ouvrent à 19,5° de sa route (l'angle de Kelvin, le même derrière tous les navires),
    en courtes crêtes en biais qui ne brisent que par endroits ; derrière l'hélice, un
    remous blanc large comme lui (30 m) qui s'étale d'un mètre toutes les trois secondes,
    aux bords déchiquetés, puis une longue cicatrice d'eau lisse qui dure des minutes. On
    garde où était sa poupe toutes les 7 s (près de trois minutes, plus d'un kilomètre) :
    quand il vire pour nous éviter, son sillage tourne avec lui. La nuit, le plancton
    allume sa vague d'étrave et son remous ; au loin, il en reste la lueur moyenne (les
    étincelles s'effacent, pas leur lumière). L'atelier de la mer a un cargo d'essai
    (« Le cargo » : distance, vitesse, « Il vire de 50° », et le point de vue « Autour du
    cargo » ; `?cargo=400` dans l'adresse), et ses photos vont plus vite dans un onglet
    caché (une pause toutes les 30 images, pas à chaque image). Coût : rien de mesurable.

17. ✅ **La houle dans un fil à part** (`src/mer/houle-fil.js`, un « worker ») — les FFT de
    la houle (2,6 ms par image) se font maintenant sur un autre cœur du processeur : pendant
    que le jeu dessine une image, le fil calcule déjà la mer de la suivante (au temps
    t + dt), dans des tableaux qu'on lui prête et qu'il rend aussitôt (on se les passe sans
    les recopier : chaque cascade a son tableau en cours et un tableau libre). Il garde sa
    propre copie de la mer (les mêmes vagues tirées avec la même graine, les mêmes
    réglages) ; l'écume reste sur le fil principal (0,2 ms : elle a besoin de l'image
    d'avant). Si le fil n'a pas fini à temps, ou si la mer a changé d'un coup entre-temps
    (un numéro de version), ou dans les outils d'essai qui enchaînent les images sans rendre
    la main au navigateur, on calcule sur place, comme avant : la mer est la même. Mesures :
    dans le jeu, en pleine tempête, la houle passe de ~3 ms à 0,3 ms par image sur le fil
    principal (tout le travail du fil principal : 1,6 ms par image), 100 % des images
    viennent du fil, 120 images/s sans à-coup ; la mer du fil et une mer calculée sur
    place au même instant diffèrent de moins d'un millimètre (1,5 cm au pire, quand deux
    images arrivent à des intervalles un peu différents). L'atelier de la mer affiche
    « Houle calculée à part ». Ce Mac est limité par l'écran (120 Hz) : le gain servira
    surtout aux ordinateurs plus lents.

Et en passant : sous la pluie et dans les embruns, **le pont ruisselle** (le gelcoat et
l'antidérapant deviennent brillants, le teck fonce : seulement la rugosité et la teinte des
matériaux, sans rien recompiler) ; le navigateur qui refuse un instant de capturer la souris
(juste après Échap) ne laisse plus d'erreur. Images : `docs/etape7-inspection-du-pont.jpg`,
`docs/etape8-le-compas-et-le-radar-du-cockpit.jpg`, `docs/etape10-*.jpg` (la trombe),
`docs/etape11-la-nuit-noire-et-la-lampe.jpg`, `docs/etape12-*.jpg` (le radar),
`docs/etape13-*.jpg` (le sillage), `docs/etape14-*.jpg` (le front orageux), `docs/etape15-*.jpg` (le paquet de mer), `docs/etape16-*.jpg` (le sillage du cargo).

### Le chantier de la peur (octobre 2026) : « l'ambiance est encore trop chill »

Demandé par Mathis le 2026-10-06 : une ambiance bien plus horrifique (paranoïa à cause de
la mer, bruits bizarres, vagues immenses de 10 m…) et un étage pour le bateau, avec une vue
panoramique et la plupart de l'électronique dedans. Ses choix :
- **une timonerie vitrée** sur l'arrière du rouf : on y tient debout, on y monte depuis la
  cabine et on en sort vers le cockpit ; le gréement est rehaussé en conséquence (comme sur
  les vrais voiliers à timonerie) ;
- **on y barre au pilote** (+1°, +10°…) ; il faut sortir pour les voiles, les réparations, et
  quand le pilote lâche ;
- **l'étrange bien plus fort, mais jamais confirmé** : des formes du coin de l'œil qui
  disparaissent quand on les regarde, quelque chose de grand sous la coque, des bruits
  qu'on ne s'explique pas, son nom à la radio ; pas de « screamer » gratuit, quelques vrais
  sursauts bien placés ;
- **des vagues scélérates de 10 m**, deux ou trois, mises en scène et annoncées (un
  grondement, Jos, le radar), tenables si on les prend par l'arrière ou de trois quarts ;
  de travers, le bateau se couche.

Feuille de route :

18. ✅ **La timonerie** (`src/bateau/timonerie.js`, `interieur-timonerie.js`,
    `electronique.js`, `vitres.js`) — un étage vitré sur l'arrière du rouf, de la cloison
    du cockpit jusqu'à 1,24 m vers l'avant, moins large que le rouf (1,16 m) : assis au
    bord du banc, le barreur voit devant lui le long de ses parois, et sur les côtés
    courent des corniches où passent les drisses. Son pare-brise penche vers l'arrière, en
    trois vitres avec deux essuie-glaces (ils balaient tant qu'il pleut) ; neuf vitres en
    tout, sur lesquelles la pluie se pose en gouttes qui grossissent et coule en filets
    qui zigzaguent (le pare-brise essuyé reste à peu près clair, les côtés ruissellent) ;
    une porte de 52 cm vers le cockpit, deux battants qui coulissent à l'intérieur, contre
    la paroi (dehors, ils cachaient le compas et les afficheurs). Dedans, le plancher est
    au niveau du seuil du cockpit : on y tient debout et l'on voit la mer tout autour. La
    console, sous le pare-brise : le radar (déménagé de la table à cartes), un traceur de
    cartes (la côte, les bouées, le trajet parcouru, la ligne du cap, la vitesse et la
    sonde ; E et Maj + E : de 0,75 à 12 milles), la commande du pilote (un écran à cristaux
    liquides : veille, AUTO ou ALARME, le cap voulu, le cap suivi, l'angle de barre) et un
    compas ; au plafond, deux répétiteurs des afficheurs du cockpit (la vitesse et le cap,
    le vent apparent). Sur la paroi tribord, la VHF, le baromètre, la pendule et le
    tableau électrique ; derrière, le siège de quart, un coin cuisine, le ciré pendu près
    de la porte, des étagères sous les corniches ; trois marches descendent au carré, à
    bâbord, par une ouverture dans la cloison. **On y barre au pilote** : E sur le siège, puis Q / D pour 1°, Maj + Q / D pour
    10°, Espace pour se lever ; on agit d'assis sur la VHF, le radar et le traceur. Le mât
    et la bôme sont rehaussés de 44 cm (les voiles gardent leur taille), et la timonerie
    compte dans la flottabilité : couché, le bateau s'appuie sur elle pour se relever. La
    lumière : le carré et la timonerie sont maintenant deux pièces (les lampes de l'une
    n'éclairent l'autre que par l'escalier) ; la nuit, en rouge, le plafonnier de la
    timonerie n'est plus qu'une veilleuse (le bois sombre, les écrans pour seule vraie
    lumière) ; l'œil ne s'y habitue qu'à moitié (on y regarde surtout dehors) ; la pluie
    s'arrête à ses vitres. Les outils d'essai suivent : le marin automatique fait 16 tours
    du bord (la porte, la VHF, le tableau, le traceur, le poste, le siège, l'escalier dans
    les deux sens, le ciré…), `npm run test-pont` vérifie les nouvelles surfaces et les
    plafonds (on se baisse sous le pare-brise en montant l'escalier), et les sept essais
    passent. Images : `docs/etape18-*.jpg`.
19. ✅ **Les vagues scélérates** (`src/mer/scelerate.js`, `src/monde/scelerates.js`,
    `src/rendu/scelerate.js`) — une vague isolée de 10 à 12 m du creux à la crête : une
    vague de Gerstner (crête pointue, pente de 28° juste sous la crête) dans une enveloppe
    plus longue devant que derrière, si bien qu'elle est précédée d'un creux de 4,5 m — « le
    trou dans la mer » des marins qui en ont vu une — et que sa crête court sur 250 m. Le
    même calcul sert à la physique (la houle l'ajoute à ses vagues : le bateau monte, surfe,
    se couche pour de vrai) et à l'image (la mer la dessine, avec sa pente exacte pour les
    reflets, sa face hachée par le vent, l'écume qui dévale le haut de son front et la traîne
    qu'elle laisse derrière elle). Elle naît à 1 150 m au vent du bateau, grandit en
    approchant (elle reste centrée sur lui, s'il file le long d'elle), et sa crête
    s'écroule dans les 250 derniers mètres : une lèvre de 3 m (la crête des déferlantes, en
    très grand) qui arrache des embruns et, la nuit, luit de plancton — une ligne bleu-vert
    qui avance dans le noir. Son annonce : un grondement grave qui enfle pendant une minute,
    avec une pulsation sourde qu'on sent plus qu'on ne l'entend ; Jos (« la bouée du large
    vient de mesurer une vague de onze mètres… mets-la droit dans ton arrière ») ; sa crête
    sur le radar, une longue ligne qui avance ; le message à l'écran. Au dernier moment, la
    nuit, un éclair éclate juste derrière elle (la lumière des éclairs vient maintenant de
    leur direction : un mur d'eau se découpe sur le ciel). Le choc : sa crête frappe toute
    la coque à la fois pendant une seconde, 300 litres d'eau verte dans le cockpit (plus à
    l'intérieur si la porte est ouverte), le pilote arraché une fois sur trois, le marin
    emporté s'il est sur le pont sans harnais. Réglé avec un essai automatique,
    `npm run test-scelerate` (six situations sur trois mers, la vraie physique) : prise
    droit derrière, 15 à 39° de gîte et un surf à 15 nœuds ; de trois quarts arrière
    (145°), 35 à 64° ; par la hanche (115°) ou de travers, couché à chaque fois (76 à 90°).
    Il y en a deux (matelot, 10 m) ou trois (marin 11 m, cap-hornier 12 m) par nuit : la
    première quand le vent monte, vers 21 h 30 ; la deuxième au plus fort, pendant que Jos ne
    répond plus — on ne reçoit de lui que des bribes, et il ne revient qu'une fois la vague
    passée ; la dernière quand le vent tourne, une vague croisée qui vient d'une autre
    direction. Les déferlantes se taisent pendant son passage. Le marin automatique prudent
    met chaque vague droit dans son arrière (`npm run test-nuit` : trois vagues prises à
    157 à 180°, jamais couché) ; l'imprudent, de travers, est emporté. L'atelier de la mer a
    sa section « La vague scélérate » (hauteur, longueur, d'où elle vient ; « La voir de
    près » ; `?scelerate=11` dans l'adresse). Coût : 0,3 ms par image quand elle déferle.
    Images : `docs/etape19-*.jpg`.
20. ✅ **La peur** (`src/jeu/peur.js`, `src/rendu/apparitions.js`) — rien n'est jamais
    confirmé : ce qu'on voit du coin de l'œil disparaît dès qu'on le regarde en face, ce
    qu'on entend, personne d'autre ne l'a entendu. Une **tension** (0 → 1) monte avec la
    nuit (0,05 au coucher, 0,55 vers 2 h, 0,1 à l'aube), avec chaque chose étrange (elle
    retombe en une minute et demie), le danger et le noir ; elle resserre la vue (les bords
    s'assombrissent), pâlit les couleurs, fait monter un bourdonnement très grave (deux
    notes qui battent) et, tout en haut, un sifflement à peine audible ; au-delà de 0,7, le
    cœur bat. Ce qui peut arriver, chacun dans sa fenêtre d'heures, jamais deux à moins de
    75 s, jamais pendant qu'une vague scélérate, la trombe, le cargo ou un danger occupent
    le marin : **la mer gémit** (une voix immense et grave, au loin, deux notes qui ne sonnent
    pas juste, noyée dans un écho de quatre secondes) ; **quelqu'un à l'avant** — une
    silhouette en ciré jaune délavé, comme le tien, capuche rabattue, sans visage, debout sur
    le pont avant, qu'on ne voit qu'au bord de la vue (elle se place là où la timonerie ne la
    cache pas) ; **le reflet** — dans le pare-brise de la timonerie, la lumière allumée,
    quelqu'un debout juste derrière toi (dessiné devant la vitre, à l'endroit où elle
    renverrait quelqu'un qui se tiendrait là : faible, flou, rougi par la veilleuse) ; on se
    retourne : personne, et il n'est plus dans la vitre ; **la forme dans l'eau** — pâle,
    ovale, deux creux sombres, sous la surface le long de la coque (la mer la dessine : elle
    suit chaque ride, et disparaît quand on regarde l'eau en rasant) ; regardée, elle coule ;
    **la chose sous la coque** — le sondeur marque six mètres (il y en a quatre-vingt-dix),
    quelque chose frotte la quille d'un bord à l'autre, le bateau est soulevé et roule, et
    la nuit, le plancton qu'elle remue dessine sa forme : immense, fuselée, une nageoire, une
    queue, trois fois et demie la longueur du bateau ; **des pas sur le pont**, au-dessus de
    soi, quand on est dedans ; **ton nom** chuchoté sur le 16 (« Morgane… »), pendant que Jos
    ne répond plus ; deux vrais sursauts : **un choc énorme** contre la coque après un long
    calme, et **dans un éclair, quelqu'un à l'avant** — à l'éclair suivant, plus personne.
    Le journal de bord note ce qu'on a vu (« Quelqu'un, debout à l'avant. Non :
    personne. ») ; Jos, si on l'appelle, cherche une explication, sans conviction. Ce qu'on
    voit « du coin de l'œil » se mesure sur l'écran (près d'un bord, et non en degrés :
    une première version en degrés plaçait la silhouette hors du cadre dans une fenêtre
    étroite). L'**atelier de la peur** (`jeu.html?peur`) montre la tension, chaque chose
    (possible maintenant ? sinon, ce qu'il lui faut ; où est sa cible sur l'écran), la
    provoque, saute à une heure, et dessine la frise de la nuit. `npm run test-peur` : trois
    nuits avec un marin simulé qui va et vient et regarde partout (fenêtres, espacements,
    jamais pendant une vague…), et surtout que rien n'est jamais confirmé (la silhouette
    regardée disparaît dans la même image, le reflet quand on se retourne, la forme coule).
    Les marins automatiques n'ont pas peur : la nuit de `npm run test-nuit` est inchangée.
    Images : `docs/etape20-*.jpg`.
21. ✅ **L'ambiance** — la nuit se referme quand la peur monte : l'exposition baisse avec
    la tension (jusqu'à 30 % de lumière en moins au plus fort de la peur : l'œil ne s'habitue
    plus aussi bien au noir), en plus de la vue qui se resserre et des couleurs qui pâlissent.
    Les lumières du bord hésitent quand l'étrange arrive (des pas, ton nom, la chose sous la
    coque, ce qu'on a vu puis plus vu) et parfois, quand la peur est haute : la veilleuse
    faiblit presque jusqu'au noir, les écrans du radar, du traceur et du pilote s'éteignent
    à moitié — jamais plus de trois changements par seconde (au-delà, des éclats de lumière
    peuvent être dangereux pour les personnes photosensibles). Des silences : le bruit du
    monde (le vent, la mer, la pluie) se retire un instant avant le choc contre la coque
    (puis le choc), pendant les pas et la voix, et dans le creux de la vague scélérate, à
    l'abri de son mur. Une option, « Des éclairs vifs, des lumières qui vacillent », permet
    de tout adoucir : les éclairs montent et s'éteignent lentement, sans claquer, et rien ne
    vacille. Vérification complète : les neuf essais passent (physique, houle, pont, barre,
    journée, nuit, tempête, scélérates, peur) ; un tour de la nuit heure par heure dans le
    jeu ; au moment le plus chargé (en pleine tempête, la nuit, une vague scélérate qui
    s'écroule sur le bateau), 120 images par seconde, 95 % des images en moins de 10 ms,
    aucune au-delà de 25 ms, 2 ms de travail par image sur le fil principal ; aucune erreur
    dans la console.

### Le chantier du noir (octobre 2026) : « ça fait toujours pas si peur »

Les retours de Mathis le 2026-10-07, après avoir joué la nuit : on a du mal à entrer dans
la timonerie ; on ne voit pas le tableau électrique ; on peut prendre les objets sans
limite de distance, à travers les parois (le ciré, depuis la timonerie) ; et ça ne fait
toujours pas assez peur : il veut qu'il fasse vraiment nuit, qu'on soit obligé de
regarder le radar, ou d'attendre les éclairs pour voir la mer, et une vague scélérate
plus grande. Ses choix :
- **noir d'encre** : au cœur de la tempête, ciel et mer sont noirs ; on ne voit que ce
  qu'éclairent ses lumières (frontale, feux, timonerie), l'écume et le plancton tout près,
  et toute la mer pendant un éclair ;
- **une vague scélérate de 20 m**, plus raide : presque deux fois le mât, toujours
  tenable droit dans l'arrière ;
- **pas de projecteur** : la frontale, les feux, le radar et les éclairs suffisent ;
- **le radar fait peur lui aussi** : des échos qui n'existent pas (un écho qui suit le
  bateau puis s'efface, un écho tout près que l'éclair ne montre jamais).

Feuille de route :

22. ✅ **Les gestes et la timonerie** (`src/joueur/marin.js`, `pont.js`, `gestes.js`,
    `encombrement.js`, `src/bateau/tableau-electrique.js`) — **La porte.** Deux nouveaux
    outils ont mesuré le mal : la carte des passages (`__jeu.carteDesPassages()` : le bord
    vu de dessus, tous les 2 cm, là où le corps passe, frôle ou bute, avec le chemin de
    chaque essai) et les essais d'entrée (`__jeu.essayerLesEntrees()` : trente marins
    lâchés de la barre, des bancs, des winchs, du siège, de l'escalier, qui visent à peu
    près un point de l'autre côté — comme un joueur, sans viser au centimètre). Seuls 6 sur
    27 passaient : la porte ne laisse que 20 cm au corps (52 cm, moins les épaules), et
    juste derrière, le dossier du siège de quart barrait le passage tout droit (le couloir
    entre lui et la cuisine faisait 16 cm, décalé de la porte). Le siège est décalé de 11 cm
    vers tribord ; le marin glisse maintenant le long de ce qui l'arrête (il essaie la même
    direction, tournée de 20°, 40° puis 60°, d'abord du côté qui a marché la fois d'avant)
    au lieu de s'y coller ; et quand il marche vers la porte à peu près de face, il
    s'aligne sur son milieu. Les 30 essais passent, en une seconde en moyenne. Au passage,
    un vieux bug : la porte fermée se traversait (le marin enjambe les petits vides — le
    bord penché du rouf — et elle n'en était qu'un de 12 cm) ; c'est maintenant un mur, et
    si l'on pousse contre, le jeu dit comment l'ouvrir (`npm run test-pont` le vérifie).
    **Les gestes.** On attrapait tout à 1,9 m, à travers les cloisons, le plancher et les
    vitres (le ciré, au pied de l'escalier, depuis la timonerie). Maintenant, à portée de
    main (1,25 m des yeux au bord de la chose), et jamais si quelque chose de dur est entre
    les yeux et elle : un rayon lancé dans la grille de l'encombrement, de boîte en boîte
    (Amanatides et Woo), qui ne compte pas les pièces de la chose elle-même ; la porte
    fermée compte aussi. Un troisième outil le vérifie (`__jeu.carteDesGestes()` : debout et
    accroupi, tous les 10 cm, d'où le jeu propose chaque chose) : le ciré, seulement depuis
    le carré ; la console, depuis la timonerie (et le seuil de la porte ouverte) ; porte
    fermée, plus rien entre le cockpit et la timonerie. **Le tableau électrique** était sur
    la paroi tribord, sous la corniche, derrière le siège, à hauteur des genoux, noir sur du
    bois sombre : invisible. Il est sur le pupitre de la console, entre la commande du pilote
    et le compas : six disjoncteurs à levier (feux de navigation, pilote, éclairage, radar,
    VHF, pompe de cale), leurs voyants, leurs noms rétroéclairés la nuit et un voltmètre ;
    quand le pilote lâche, son disjoncteur saute (levier à mi-course, voyant rouge qui
    clignote). On l'atteint assis au poste. Et le rappel de la leçon disait le ciré « dans
    la timonerie, à côté de la porte » : il est au pied de l'escalier, dans le carré.
    Images : `docs/etape22-*.jpg` (dont la carte des passages, avant et après).
23. ✅ **La nuit noire** (`src/monde/meteo.js`, `src/rendu/eau.js`, `monde3d.js`,
    `apparitions.js`) — noir d'encre : sous les nuages de la tempête, il ne reste que 7 % de
    la lumière du ciel (la lune, le ciel, les nuages, le brouillard), de 21 h environ à
    3 h 30 ; le noir s'installe avec l'orage après le coucher du soleil, et se lève quand
    le front est passé, vers 4 h. On ne voit plus que : les instruments ; la frontale, dont
    la mer reçoit maintenant la lumière (des éclats sur chaque ride tournée vers soi, l'écume
    qui blanchit, la pluie qui brille dans le faisceau) ; les feux de navigation, devenus
    des projecteurs dans leur secteur, comme les vrais (le rouge et le vert teintent l'écume
    de l'étrave, chacun de son côté ; le blanc de poupe éclaire le sillage, plus le
    cockpit) ; le plancton, dans le sillage et maintenant dans chaque vague qui brise près du
    bateau (on devine la mer autour de soi à sa lueur, qui s'éteint au loin dans la pluie) ;
    et les éclairs. Un éclair proche montre toute la mer, les nuages, la pluie ; un éclair
    lointain, surtout le ciel et l'horizon (ce qu'il éclaire autour du bateau baisse avec
    la distance) ; ils viennent par salves, puis de longues attentes dans le noir — et jamais
    plus de trois éclats par seconde : sur un écran presque noir, des éclats plus serrés
    peuvent être dangereux pour les personnes photosensibles (l'option des éclairs doux
    reste là). La silhouette de l'avant ne se voit plus, dans le noir, qu'à la frontale : à
    ses bandes réfléchissantes (comme sur tous les cirés de mer), des traits argentés qui
    flottent au bout du bateau, au bord de la vue ; sans lampe, elle n'apparaît pas. Dehors
    sans lampe, la peur monte plus vite. La veilleuse rouge de la timonerie est deux fois
    plus faible : les écrans y sont la vraie lumière. Une option, « La nuit d'orage »
    (noir d'encre, très sombre, sombre : 7 %, 26 % ou 44 % de la lumière du ciel), pour les
    écrans peu lumineux ; noir d'encre par défaut. 120 images par seconde la nuit,
    frontale et feux allumés (95 % des images en moins de 10 ms, aucune au-delà de 25 ms).
    Images : `docs/etape23-*.jpg` (la même vue à la barre, dans le noir, dans un éclair
    proche et dans un éclair lointain).
24. ✅ **La vague scélérate de 20 m** (`src/mer/scelerate.js`, `src/monde/scelerates.js`,
    `scripts/reglage-scelerate.js`) — 18 m (matelot), 20 m (marin), 22 m (cap-hornier) du
    creux à la crête, presque deux fois le mât, précédée d'un creux de 8 m. Sa forme a été
    choisie avec un nouvel outil, `node scripts/reglage-scelerate.js` (plusieurs réglages à
    la fois, un processus chacun, la vraie physique, trois mers, trois façons de la
    prendre) : à 7,4 fois sa hauteur de long (une pente de 27°, à la limite où une vague se
    brise), le bateau partait en travers dans sa descente, même droit dans l'arrière, et se
    couchait une fois sur trois ; à 8,5 fois (170 m, une pente de 24°) et avec un choc de
    crête un peu moins fort (0,5), la règle est nette : droit derrière, ça passe toujours
    (14 à 44° de gîte, pour 18, 20 et 22 m) ; de trois quarts, ça passe le plus souvent,
    mais elle peut coucher le bateau ; par la hanche ou de travers, couché. Sa lèvre grandit
    avec elle (6 m au-dessus de la crête). L'éclair qui la montre tombe maintenant quand le
    bateau est au fond du creux, à 70 m de la crête : de là, un mur de vingt mètres au-dessus
    de l'arrière (plus près, le bateau est déjà soulevé sur sa pente : on ne la voit plus
    au-dessus de soi). `npm run test-scelerate` est passé à 20 m (`HAUTEUR=22` pour une
    autre) ; `npm run test-nuit` : le prudent prend ses trois vagues de 20 m à 162-175°,
    12 à 28° de gîte ; l'imprudent est emporté par la première. Images :
    `docs/etape24-*.jpg`.
25. ✅ **Les échos fantômes** (`src/jeu/peur.js`, `src/bateau/radar.js`) — deux nouvelles
    choses étranges, dans la peur, jamais confirmées, quand on a un radar sous les yeux (à
    la barre, le répétiteur ; dans la timonerie, la console) : **l'écho qui nous suit**
    (vers 22 h - 2 h 30) — en arrière du travers, de 1,25 à 0,45 mille, toujours au même
    relèvement, quel que soit le cap : il nous suit ; **l'alarme du radar** (vers 1 h -
    4 h 30) — un écho à 270 m, puis 110 m, presque dans notre sillage, dans la zone de
    garde : l'anneau d'un quart de mille clignote en rouge sur l'écran, « ALARME — ZONE DE
    GARDE », des bips à deux notes. Quand un éclair montre la mer, il n'y a rien : l'écho
    n'est plus là au tour d'antenne suivant, l'alarme se tait. Le journal de bord le note,
    Jos cherche une explication (un grain qui file avec le vent, une crête qui brise
    derrière soi…). Ils remplacent l'écho de l'étape 11. L'atelier de la peur les provoque ;
    `npm run test-peur` vérifie que l'un garde son relèvement et se rapproche sans alarme,
    que l'autre fait sonner l'alarme, et qu'un éclair les efface. Image :
    `docs/etape25-l-alarme-du-radar.jpg`.

### La trombe en volume (octobre 2026) : « le rendu de la tornade me dérange encore »

Ce que Mathis a demandé : « une grosse update sur la tornade, en prenant bien en compte
tous les paramètres et en animant bien chaque partie, avec plusieurs rendus pour que je
dise celui que je préfère ».

26. ✅ **La trombe calculée en volume** (`src/rendu/trombe.js`, `src/rendu/glsl/trombe.js`,
    `atelier-trombe.html`) — Avant (étape 10) : un tube de triangles texturé, des « voiles »
    d'embruns, une soucoupe de nuage ; de près, on voyait les surfaces, et rien ne tournait
    vraiment. Maintenant elle est calculée comme les nuages du ciel : pour chaque pixel, on
    avance pas à pas le long du regard à travers sa matière — la vapeur condensée de
    l'entonnoir, l'eau de mer pulvérisée, le nuage-mur, la pluie — et on additionne la
    lumière que chaque bout renvoie vers l'œil, en tenant compte de ce qu'il cache.
    **Ce qu'il y a dedans**, de haut en bas : le **nuage-mur**, la partie abaissée de la
    base des nuages d'orage (un ventre bosselé, au contour irrégulier, des bandes en arcs
    de cercle sur ses flancs, des lambeaux qui montent en spirale vers lui) ; au-dessus,
    le nuage d'orage qui la porte (le ciel y est bouché : `uTrombeCiel` dans
    `glsl/nuages.js`) ; **l'entonnoir** : une trompe, fine sur presque toute sa longueur,
    évasée dans le nuage-mur, souvent creuse (plus opaque sur ses bords), striée de bandes
    qui montent en hélice, l'axe courbé par le vent (le haut emporté, le pied qui traîne)
    et parcouru d'ondulations qui descendent le long du tube ; **la gerbe d'embruns** : un
    dôme bouillonnant d'eau arrachée, aussi large que haut, d'où sort l'entonnoir, plus
    haut près du cœur, retombant sur les bords, un œil plus clair au centre ; parfois un
    **rideau de pluie** derrière elle, et des **trombes sœurs**. Sur la mer (`eau.js`), la
    tache sombre, les bandes d'écume en spirale logarithmique, la couronne d'eau blanche.
    **Tout bouge comme l'air** : le motif (le bruit 3D des nuages) est lu dans un repère
    qui tourne avec le tourbillon — d'un bloc dans le cœur, de moins en moins vite au-delà
    (le tourbillon de Rankine), d'autant plus vite que l'entonnoir est étroit (le moment
    cinétique se conserve) — et qui monte avec l'air (en hélice dans l'entonnoir, en
    gerbe au pied, l'eau qui retombe sur les bords). Pour que le motif ne s'enroule pas
    sans fin, deux motifs vivent chacun quelques secondes, l'un apparaissant pendant que
    l'autre s'efface, comme la condensation qui se forme et s'évapore.
    **Sa vie** (comme les vraies, Golden 1974) : le nuage-mur s'abaisse, une tache sombre
    sur l'eau, des spirales d'écume, l'anneau d'embruns se lève pendant que l'entonnoir
    descend du nuage à sa rencontre (50 s) ; la pleine force ; puis, la dernière minute,
    elle s'amincit en corde, se couche, se tord, sa vapeur remonte dans le nuage et la
    gerbe retombe.
    **La lumière** : une petite carte du ciel tout autour (lue dans le cube des reflets,
    qui contient les nuages, rangée « en octaèdre » pour la lire sans calculer d'angles)
    éclaire chaque bout de matière du côté où il est tourné ; la lueur du couchant sur
    l'horizon fait briller les bords ; la lune ne passe pas le nuage d'orage ; chaque
    matière sait combien d'elle-même la lumière traverse (une corde dans un cercle), et
    une mesure de plus, tout près, modèle les bosses ; l'eau pulvérisée, très blanche,
    renvoie bien plus de lumière qu'un nuage épais ; pendant un éclair, c'est lui la
    lumière principale : la trombe se découpe sur le nuage qu'il allume ; la nuit, l'eau
    arrachée au pied s'allume de plancton, par étincelles qui tournent avec elle.
    **Quatre trombes au choix** (`VARIANTES`) : *la colonne* (une trombe d'orage massive,
    un tronc gris de 50 à 80 m sous un grand nuage-mur), *le fil* (la trombe des photos :
    une corde de vapeur de 15 m qui ondule en S, un buisson d'embruns blanc à son pied),
    *la bête* (noire et large, à demi cachée dans la pluie, sous un nuage-mur énorme),
    *les sœurs* (une trombe et deux plus fines qui descendent du même nuage, touchent la
    mer et remontent). `jeu.html?trombe=fil` pour en essayer une dans le jeu.
    **Comment c'est dessiné** : le volume est calculé sur une image plus petite que
    l'écran (de 0,29 à 0,55 de sa largeur en qualité haute, selon la distance : de près,
    elle remplit l'écran et ses formes sont grandes), décalé au hasard d'un pixel et d'une image à
    l'autre, puis accumulé d'une image à l'autre (en retrouvant chaque point à sa place),
    agrandi par un filtre bicubique, et posé dans la scène à la distance où il commence :
    derrière le bateau et les crêtes qui sont devant lui. On n'avance à petits pas que
    dans la boîte de chaque pièce, et dans chaque boîte, la distance à la vraie matière
    dit jusqu'où sauter. **Ce qu'on a appris en chemin** : le programme de la carte
    graphique était 5 fois trop lent parce que la fonction de la matière y était recopiée
    une dizaine de fois (pour chaque sœur, chaque mesure d'ombre) : réécrit compact
    (variables globales, une seule copie), il est devenu 4 à 5 fois plus rapide ; la
    pluie, matière légère et lisse, coûtait le plus (on la traverse à grands pas) ; puis
    le nuage-mur, qui tourne lentement et presque d'un bloc : un seul motif qui tourne
    suffit (au lieu de deux qui se relaient), deux fois moins de lectures ; le « damier »
    (un pixel sur deux par image) ne gagne rien, la carte graphique calculant les pixels
    par carrés de quatre ; « finish » ne sert à rien pour chronométrer (il rend la main
    tout de suite) : il faut lire un pixel. **Mesuré** (M4 Pro, 1920 × 1200) : sans la
    trombe, 120 images par seconde ; avec elle à l'écran, de 84 à 94 en qualité haute
    (selon sa distance), 100 en économique, 76 en superbe.
    **Corrigés en passant** : le bord du front orageux, trop net dans la brume de la mer
    (vue d'un peu haut, la mer changeait de couleur le long d'une ligne droite) ; le voile
    des embruns de l'étape 10, fait de gros carrés, remplacé par des bouffées douces qui
    défilent.
    **Les outils** : l'atelier de la trombe (`atelier-trombe.html` : les quatre trombes et
    l'ancienne, sa vie au curseur ou en accéléré, quatre moments, six points de vue dont
    une vue immobile pour filmer, les éclairs, les mesures ; `__trombe.planche()`,
    `__trombe.film()` et `filmer()`, `compter()` (pas et éclairages par pixel, et sa carte
    de chaleur), `comparerAuxNuages()`, `couts()` (le prix de chaque ingrédient),
    `seul(['ent', 'emb'])` pour ne voir qu'une pièce) ; `scripts/film.mjs` (les images d'un
    film → une vidéo) ; `scripts/fente.py` (la « fente temporelle » : une ligne de chaque
    image d'un film, empilées ; ce qui tourne ou monte y dessine des traînées obliques,
    pour juger un mouvement sans regarder la vidéo) ; `src/rendu/chrono-gpu.js` (les
    requêtes de minutage de la carte graphique). Images : `docs/etape26-*.jpg`.
    **Son choix** (le même soir) : *la bête*, « en début de nuit, quand il y a encore un
    peu de luminosité ». Elle vient maintenant vers 19 h 25 - 19 h 35 (au lieu de 19 h 05 -
    19 h 20). Mais l'heure du jeu avance vite (une heure en une minute et demie au
    crépuscule) et elle vit plus de quatre minutes : sans rien faire, la nuit noire
    tomberait pendant qu'elle passe. Alors, pendant qu'elle est là, **le crépuscule
    s'attarde** : la lumière du ciel (la hauteur du soleil, l'épaisseur de l'orage, les
    nuages, le front, la brume) n'avance qu'au dixième de l'horloge (`retardLumiere`,
    `meteoIci()` dans `jeu/nuit.js`) ; le vent, la mer, la pluie et les événements restent
    à l'heure, la pendule de la cabine aussi. Quand elle est partie, la nuit tombe en deux
    minutes et demie, jusqu'à rattraper l'horloge. Mesuré dans le jeu : à 20 h 40 à
    l'horloge, le ciel en est à 19 h 38 quand elle passe à 500 m. Le reste, accordé à elle :
    son tourbillon a un cœur de 50 m (au lieu de 40), elle touche le bateau à moins de 95 m
    (au lieu de 75 : le plus épais de sa gerbe) ; « sous le nuage-mur, il fait sombre »
    n'assombrit plus que de 12 % (au lieu de 32 %) ; le plancton de son pied ne s'allume
    vraiment que dans le noir (`uNoir`), sinon c'était un trait de néon sur l'horizon ;
    elle est un peu moins noire, pour qu'on voie encore sa texture à la tombée de la nuit.
    L'atelier de la trombe s'ouvre sur elle, au « Début de nuit (le jeu) ».

### Le monde connecté (octobre 2026) : « que tout l'environnement soit connecté »

Ce que Mathis a demandé, le 2026-10-07 au soir : « j'aimerais bien que tout l'environnement
soit connecté ». Ce que ça veut dire, en jeu vidéo : un monde **systémique** (le contraire
d'un monde *scripté*) — des choses qui existent à un endroit, et qui agissent sur tout ce
qui les entoure. La bête marchait déjà comme ça (son tourbillon pousse le bateau, la mer a
sa tache et ses spirales, le ciel est bouché au-dessus d'elle, les éclairs tombent autour
d'elle, le radar la voit, on l'entend gronder) ; le reste, non : la météo de la nuit
suivait l'horloge et était la même partout ; les grains n'existaient que sur l'écran du
radar (des taches de bruit) ; les rafales tombaient au hasard, sans rien pour les
annoncer ; les éclairs, n'importe où ; le baromètre suivait le temps au lieu de
l'annoncer. Son choix, dans cet ordre :

27. ✅ **Les grains**, qui existent vraiment, et dont tout dépend.
28. ✅ **Les rafales qu'on voit venir** : une tache sombre qui court sur l'eau, la risée.
29. ✅ **Les éclairs qui partent des nuages d'orage**, et plus de n'importe où.
30. ✅ **Le baromètre qui annonce le temps**, au lieu de le suivre.
31. ⬜ **La bête, née d'un des grains** qu'on a vus arriver au radar.

27. ✅ **Les grains** (`src/monde/grains.js`, `src/rendu/glsl/grains.js`, `src/rendu/grains.js`,
    `atelier-grains.html`) — Un grain, comme les vrais vus d'un bateau : un **cœur de
    pluie** de 1,5 à 3 km de large, en deux ou trois morceaux, plus dense à l'avant (là où
    l'air froid descend), qui s'étire en une traîne de pluie plus fine ; **l'air froid**
    qui tombe sous lui et s'étale sur la mer dans tous les sens : devant le grain, il
    s'ajoute au vent, d'un coup — **la rafale arrive avant la pluie** (une minute et demie
    pour un bateau immobile, deux minutes quand on fuit devant lui) ; sur ses côtés, il
    fait **tourner le vent** (dans un sens ou dans l'autre selon le côté où il passe) ;
    derrière lui, il s'oppose au vent : **le vent mollit** après son passage ; au-dessus,
    **son nuage d'orage**, plus large que la pluie, qui déborde loin devant (l'enclume) :
    le ciel s'assombrit avant la rafale ; les plus forts sont **pleins d'éclairs**. Ils
    avancent à 80 % du vent et 10° à sa droite (le vent d'altitude), naissent en une
    minute et demie, vivent, et se dissipent.
    **Ce qui en dépend** — tout ce qui a un rapport avec eux le lit au même endroit :
    - *la pluie* : celle qui tombe ici (sur le pont, sur les vitres, dans le faisceau de la
      frontale, sur l'objectif) est celle de partout (la moitié de la pluie du moment) et
      celle des grains ; le pont mouillé, les essuie-glaces aussi ;
    - *le vent du bateau* : l'air froid des grains s'ajoute au vent, dans la physique ;
      sous un grain, les rafales ordinaires viennent trois fois plus souvent ;
    - *le ciel* : au-dessus de chaque grain, son nuage d'orage (une petite carte, vue d'en
      haut, que lisent les nuages : le ciel y est bouché, en tours) ;
    - *les rideaux de pluie* : sous chaque grain, de la base des nuages jusqu'à la mer,
      chaque morceau de son cœur est une colonne de pluie en cloche (une gaussienne), qui
      penche (le vent pousse la pluie en tombant). Pour un pixel, la pluie que traverse
      le regard se calcule d'un coup (avec la « fonction d'erreur », erf : une cloche
      s'intègre exactement), sans avancer pas à pas ; puis des pans plus ou moins denses
      et de légères traînées verticales. Ils renvoient la lumière du ciel (à l'ombre de
      leur nuage : sombres en haut, plus clairs en bas, où la pluie rejaillit), le soleil
      bas derrière eux (à contre-jour, la pluie s'allume), et l'éclair qui tombe dedans
      (la nuit, c'est ainsi qu'on les voit : tout le rideau s'allume). Sous un grain, on ne
      voit pas à plus de 500 m ;
    - *la mer* : sous la rafale, elle se froisse (elle ne reflète plus le ciel clair de
      l'horizon) et blanchit ; la côte et le cargo disparaissent derrière un rideau ;
    - *les éclairs* tombent dans les grains, tirés au sort selon leur force et leurs
      éclairs (deux sur trois jusqu'à la mer) ; la trombe et l'orage lointain gardent les
      leurs ;
    - *le son* : on **entend l'averse arriver** sur la mer (un grondement sourd qui
      s'éclaircit en approchant), une cinquantaine de secondes avant qu'elle tombe sur le
      pont ;
    - *le radar* voit les vrais grains : leur cœur de pluie, un écho granuleux qui avance
      avec le vent ; la pluie de partout ne fait qu'un léger semis ;
    - *Jos* les voit sur son radar et les annonce, quand ils sont à moins de deux milles :
      d'où ils viennent, à quelle distance, le vent qu'il fera dessous, et ce qu'il faut
      faire (« Réduis maintenant, pas quand il sera sur toi : la grand-voile affalée, un
      mouchoir de foc ») — ou que la toile est bonne ; il rappelle à l'ordre si le grain
      est presque là et la toile toujours haute ; il dit quand il est passé ;
    - *l'écran* : « Un grain arrive derrière, sur bâbord, à 1,6 mille : réduis la toile
      avant sa rafale », « La rafale du grain ! », le panneau (« Grain à 1,2 mille »,
      « Sous le grain »), le journal et le bilan (« rafales à 52 nœuds ») ;
    - *les avaries* : si la rafale d'un grain arrive un peu avant l'heure où l'écoute de foc
      ou le pilote devaient lâcher, c'est elle qui les achève (« Le pilote automatique a
      lâché, dans la rafale d'un grain ») ;
    - *la lumière* : sous son nuage, il fait un peu plus sombre (15 %).
    **La nuit** : des grains alentour, d'autant plus que le temps tourne à l'orage
    (épars au coucher du soleil, une demi-douzaine au plus fort), qui ne viennent jamais
    sur nous ; et quatre lancés exprès, quatre minutes avant d'arriver (au vent, à la
    bonne distance), chacun quand rien d'autre n'arrive, pour qu'on le vive pour
    lui-même : le premier passe de côté vers 22 h 40, juste après la trombe (on n'en prend
    que le bord de la rafale, on le voit à ses éclairs), puis vers 1 h 30, le plus fort
    vers 3 h, au cœur de la tempête, le dernier, plus faible, vers 4 h 30, dans
    l'accalmie. On peut s'écarter de leur route
    (ils passent là où le bateau serait s'il ne changeait rien) ; on ne peut pas les
    distancer. Plus faibles pour le matelot (× 0,8), plus forts pour le cap-hornier
    (× 1,15). Le jour, des grains du décor, selon le temps ; sur l'écran d'accueil, deux
    averses de plus à l'horizon du coucher de soleil (la nuit qui vient).
    **Mesuré** (`npm run test-grains`) : un grain lancé arrive à l'heure dite ; la rafale
    (+13 nœuds pour un grain de force 0,9) 99 s avant la pluie la plus forte ; l'averse entendue 50 s avant ; le ciel
    sombre avant la rafale ; derrière, le vent mollit de 5 nœuds ; sur le côté, il tourne
    pendant trois minutes. `npm run test-nuit` : le prudent prend cinq grains (rafales à
    55 nœuds), réduit avant chacun, comme le dit Jos, et n'est jamais couché.
    **Ce que ça coûte** : la première version calculait les rideaux pour chaque pixel du
    ciel et de la mer : 2,6 ms de plus par image (60 images par seconde au lieu de 71
    dans l'atelier). Maintenant : la mer les calcule à chaque sommet de son maillage (le
    voile change lentement d'un pixel à l'autre : dix fois moins de calculs), le ciel dans
    une petite image (un quart de la largeur de l'écran, agrandie), une seule colonne par
    grain lointain, une seule lecture du bruit par colonne : 0,25 ms.
    **Les outils** : l'atelier des grains (`atelier-grains.html` : faire passer un grain
    sur le bateau, ou à côté, ou le poser à la distance voulue ; sa force, ses éclairs,
    les grains d'alentour ; cinq moments, de l'après-midi d'orage à la nuit au plus fort ;
    cinq points de vue (du cockpit, immobile pour filmer, de loin, d'en haut, sous la
    pluie) ; ce qu'il fait au bateau, en chiffres et en courbes (la pluie, le vent, le vent
    qui tourne, l'averse qu'on entend), et l'écran du radar ; `__grains.planche()`,
    `film()`, `couts()`, `coutsDetailles()` (ce que coûte chaque morceau : on le coupe, on
    compare), `fluidite()` (les vraies images par seconde, avec et sans) ; dans l'atelier
    de la tempête, la courbe de la pluie de chaque marin et une colonne « Grains ».
    Images : `docs/etape27-*.jpg`.
    **Corrigés ensuite** (le 8 octobre : deux défauts plus anciens, repérés pendant
    l'étape) :
    - *l'enclume du front orageux* n'était qu'une planche mince et sombre posée sur les
      tours : au coucher, elle barrait le ciel d'un trait. Elle est refaite comme on la voit
      vraiment, d'en bas : un toit de glace qui part du haut des tours du milieu et
      s'avance vers nous en éventail (il déborde des tours, plus d'un côté que de l'autre),
      de plus en plus haut dans le ciel ; son bord droit, le « toit plat » de Jos, à peine
      effiloché ; dessous, gris, bosselé là où il sort des tours (`enclumeFront` dans
      `glsl/front.js` : pour chaque direction du regard, on retrouve le point de son dessous
      qu'on regarde ; son bord est une ligne droite, pas un arc autour de nous). Et la
      lumière : le soleil couché pour nous ne l'est pas encore à 10 km d'altitude ;
      pendant quelques minutes après le coucher, l'enclume rougeoie, éclairée par en
      dessous, ainsi que le haut des tours, au-dessus de l'ombre de la Terre qui monte
      (`soleilHaut` dans l'éclairage). À l'aube, le front qui s'en va prend une lueur rose.
      Même coût qu'avant (0,035 ms pour le fond du ciel, en plein écran).
    - *la frontière en diagonale sur la mer pendant les éclairs* : le reflet du ciel est un
      cube dont on ne redessine qu'une face par image ; un éclair dure un tiers de seconde :
      une face était allumée, sa voisine pas encore, et la mer montrait la couture entre
      les deux. Maintenant, tant que dure un éclair, on redessine toutes les faces qu'il
      allume (les six pour un éclair dans les nuages, les deux ou trois du front pour un
      éclair lointain), une fois encore quand il s'éteint, et les versions floues du cube
      une seule fois par image ; la lumière d'ambiance du bateau attend la fin de l'éclair
      pour se recalculer (sinon il la gardait une demi-seconde). Coût : 0,1 ms de plus par
      image, le temps de l'éclair.
    Images : `docs/etape27-enclume-avant-apres.jpg`, `docs/etape27-enclume-au-coucher.jpg`,
    `docs/etape27-enclume-de-loin.jpg`, `docs/etape27-eclair-avant-apres.jpg`.

28. ✅ **Les risées** (`src/monde/risees.js`, `src/monde/vent.js`, `src/rendu/risees.js`,
    `atelier-risees.html`) — Les rafales tombaient au hasard dans le temps, les mêmes
    partout, sans rien pour les annoncer. Ce sont maintenant des **risées** : des taches de
    vent plus fort qui existent à un endroit sur la mer, comme les vraies vues d'un bateau.
    Une tache ovale de 70 à 320 m (plus grande quand il souffle fort), plus longue dans le
    sens du vent, au bord irrégulier ; elle **arrive d'un coup** (son bord avant est net : de
    rien au plein en une seconde et demie) et s'en va lentement ; son vent est plus fort de
    12 à 24 % par beau temps, jusqu'à 40 % à l'orage, et il **tourne un peu à droite** (il
    vient de plus haut, où le vent a déjà tourné) ; elle avance avec le vent (un peu plus ou
    un peu moins vite que lui), naît, vit une à deux minutes et s'efface. Plus rares, les
    **molles** : le vent y faiblit, l'eau y est plus lisse, plus claire. Elles vivent là où
    on peut les voir, dans 0,7 à 1,2 km autour du bateau, une centaine à la fois ; sous un
    grain, il y en a bien plus, et l'air froid qui s'étale les pousse en éventail.
    **Ce qui en dépend** :
    - *le vent du bateau* : celui de la risée où il est (`Vent.maj` reçoit sa position) ; la
      respiration lente du vent et ses bascules restent ; à l'orage, il souffle par
      bouffées, même entre deux risées (8 % au-dessus du vent établi : le vent moyen
      ressenti reste celui d'avant, et la nuit garde sa difficulté) ;
    - *la mer* : une petite carte vue d'en haut (3 km de côté, redessinée dix fois par
      seconde ; entre deux, elle glisse avec le vent) dit en chaque point de combien le vent
      y forcit. Dans une risée, l'eau se froisse, par plaques qui filent avec le vent, et
      surtout elle **fonce** : vues en rasant, ses petites rides se tournent vers nous, et
      l'on voit l'eau sombre au lieu du ciel clair de l'horizon (le reflet perdu est
      remplacé par le bleu profond de l'eau : sinon, à contre-jour, une bande turquoise
      apparaissait à l'horizon) ; son bord avant, plus encore ; par vent fort, elle blanchit
      (le seuil de l'écume suit le vent qu'il y fait). Par petit temps, l'effet est plus fort
      (une eau presque lisse se froisse beaucoup pour un peu de vent en plus) ; dans la
      tempête, moins (elle l'est déjà partout). Dans une molle, l'eau se lisse et brille.
      Vue d'en haut, c'est très net ; depuis la barre, une risée qui arrive est une bande
      d'eau sombre qui approche, et les lointaines, des traits sombres près de l'horizon ;
    - *le son* : l'eau froissée qu'on entend chuinter quelques secondes avant que la risée
      arrive, puis le souffle qui passe (par gros temps, le vent le couvre) ;
    - *Jos*, le matin : une étape de plus dans la leçon « Lire le vent ». Il montre les
      taches sombres au vent, en envoie une sur le bateau (elle naît là-bas et grandit en
      approchant ; si on change de route et qu'elle le manque, une autre arrive), et demande
      de la laisser passer ; puis : « Une risée, ça se voit venir : quand elle arrive, choque
      un peu, ou lofe » ;
    - *les marins automatiques* (la nuit, l'atelier de la tempête) et *l'élève* de la
      journée vivent les mêmes risées.
    **Mesuré** (`npm run test-risees`) : une risée envoyée arrive à l'heure (son bord avant à
    0,1 s près) et d'un coup (1,4 s) ; 20 s avant, on la voit venir, formée à 84 %, à 150 m ;
    on l'entend 8 s avant ; le vent ne forcit pas en avance ; dedans, il tourne de 2,4°. Sur
    une heure, comme les rafales d'avant : de 17 % du temps dans une risée le matin à 38 %
    dans la tempête, une à deux par minute, jusqu'à +22 % le matin et +41 % dans la
    tempête ; elles couvrent 31 % de la mer ; le vent et les risées, 7 µs par image.
    **Les essais d'avant** : en fuite dans la tempête (`test-barre`), le bateau est un
    système chaotique : une risée ou une déferlante un peu plus tôt, et une traversée qui
    passait part au lof. Sur 20 traversées (deux mers, dix vents), l'ancien vent tenait le
    cap 17 fois, les risées 18 (écart moyen 8,3° et 7,9°) ; l'essai en fait maintenant dix
    (deux mers, cinq vents) au lieu d'une : il tient 9 fois sur 10. `test-nuit` : le
    prudent ne passe pas toujours au cœur des grains (à 450 m d'un grain fort, il pleut à
    87 %) : le seuil « à verse » passe de 90 à 85 % (il fait 89 %).
    **Ce que ça coûte** : dessiner la carte, 0,4 à 0,9 ms, dix fois par seconde (sur le
    processeur) ; la mer, rien de mesurable.
    **Les outils** : l'atelier des risées (`atelier-risees.html` : cinq moments, du matin
    calme à la tempête, dont un coup de vent de jour qui n'existe pas dans le jeu ; le
    bateau navigue tout seul, à l'allure choisie, la vraie physique ; envoyer une risée ou
    une molle sur lui ; leur force, combien il y en a, les dessiner ou non ; quatre points
    de vue, de la barre à l'avion ; ce qu'elles font au bateau, en chiffres et en courbes
    (le vent, la gîte, la vitesse, ce qu'on entend) ; la carte vue d'en haut ;
    `__risees.planche()`, `film()`, `couts()`, `statistiques()`).
    Images : `docs/etape28-les-risees.jpg`, `docs/etape28-une-risee-arrive.jpg`.

29. ✅ **Les éclairs** (`src/monde/foudre.js`, `src/rendu/eclairs.js`, `src/rendu/saint-elme.js`,
    `atelier-eclairs.html`) — Les éclairs étaient tirés au hasard autour de la caméra, entre
    1 et 11 km, même là où le ciel n'avait pas de nuage d'orage ; seuls ceux des grains et
    de la bête venaient d'un vrai nuage. Maintenant, ils partent tous des nuages d'orage, et
    de nulle part ailleurs :
    - *les grains orageux* : chacun se charge et se décharge à son rythme, jusqu'à huit
      éclairs par minute pour le plus fort (orage 1, force 0,9), quatre fois moins pour un
      grain deux fois moins électrique (comme les vrais : le nombre d'éclairs monte très
      vite avec la force d'un orage) ; ses premiers éclairs quand sa tour a fini de monter,
      les derniers un peu avant la fin de sa pluie ; et quand l'orage s'en va (l'accalmie),
      ceux qui restent n'en font plus guère ;
    - *le nuage de la bête*, au crépuscule ;
    - *le front*, au loin, au coucher du soleil : ses nuages s'allument sur l'horizon, sans
      tonnerre (à 25-40 km, trop loin pour l'entendre : les « éclairs de chaleur ») ;
    - *un décor sans grains* (les ateliers) : des cellules d'orage invisibles, qui existent
      quelque part et avancent avec le vent — les éclairs viennent toujours des mêmes
      endroits.
    Trois sortes, comme les vrais : *dans le nuage* (six sur dix) : on ne voit pas le trait,
    le nuage s'allume de l'intérieur tout le long de l'éclair ; *jusqu'à la mer* (trois sur
    dix) : sous le cœur de pluie, surtout sous son avant (là où l'air chaud monte), et
    parfois loin devant le grain, sous son enclume — la foudre tombe avant la pluie — ; un à
    quatre éclats sur le même trait, le premier avec toutes ses branches, les suivants le
    tronc seul ; *en araignée* (un sur dix) : un trait qui court sous la base des nuages sur
    3 à 10 km, en poussant ses branches devant lui pendant un quart de seconde, et qui finit
    une fois sur trois dans la mer.
    **Ce qui en dépend** :
    - *le trait* (`rendu/eclairs.js`) : une marche au hasard qui garde le cap sur son point
      d'impact, brisée encore à trois échelles (un vrai éclair est tortueux à toutes les
      échelles : de près, chaque morceau droit se révèle brisé) ; ses branches partent de
      côté en descendant, et s'arrêtent en l'air ; on ne le voit pas dans le nuage (il sort
      de sa base) ; la brume et la pluie traversée entre lui et nous l'effacent (derrière un
      rideau, il n'en reste qu'une lueur) ; plus il est près, plus il est épais (de 1,6 à 9
      pixels) ; il reste un instant lumineux entre deux éclats ;
    - *le nuage* s'allume de l'intérieur, le long du trajet de l'éclair : la lumière vient
      du point du trajet le plus proche, baisse comme celle d'une lampe (avec le carré de la
      distance), et se diffuse dans le nuage (après des dizaines de rebonds dans les
      gouttes, il en ressort encore une bonne part : le nuage s'allume comme un abat-jour ;
      les tours épaisses entre lui et nous font écran) ;
    - *la pluie* s'allume le long du trait qui la traverse ; *la mer* : le trait s'y reflète
      en une colonne d'éclats jusqu'au bateau (pour une lumière en forme de trait, l'éclat
      de chaque ride vient du point du trait le plus proche du regard réfléchi : Karis,
      2013), et son pied l'allume tout autour ; *le bateau* est éclairé de son côté ;
    - *le son* : le tonnerre part du point du trait le plus proche de nous (trois secondes
      par kilomètre) et roule tant qu'arrive le son des parties lointaines ; il vient de la
      bonne direction (à droite, à gauche de là où l'on regarde) ; tout près, il claque ; à
      plus de 15 km, on ne l'entend plus dans la tempête ; il voyage dans le temps du jeu
      (en pause, il attend) ; *la radio* crépite à chaque éclair, jusqu'à 25 km ;
    - *l'air chargé* : sous le cœur d'un nuage d'orage (et sous son enclume, devant lui),
      l'électricité de l'air monte ; dans le noir, le *feu de Saint-Elme* s'allume en tête
      de mât : une lueur violette, des aigrettes qui tremblent, un grésillement
      (`rendu/saint-elme.js`) ;
    - *la foudre près du bateau* : le mât, seul point haut à des milles, attire celle qui
      tombe près de lui. Un éclair choisit son point d'impact à la fin de sa descente, à sa
      « distance d'amorçage » (90 m pour 30 000 ampères) : tout ce qui tomberait dans ce
      rayon autour du mât tombe sur lui (30 à 70 m pour un mât de 14,5 m, selon l'éclair).
      Une frappe à moins de 600 m éblouit, claque en même temps que l'éclair, assourdit (le
      monde s'étouffe, les oreilles sifflent), secoue, fait hésiter les écrans ; sur le mât,
      les écrans s'éteignent, le radar redémarre (25 s de préchauffage) et le pilote
      disjoncte (à réarmer au tableau, comme quand il lâche) ;
    - *Jos* : le soir, il annonce les éclairs muets du front ; la nuit, au premier éclair à
      quelques kilomètres, il apprend à compter (« trois secondes, un kilomètre ; s'il se
      rapproche d'un éclair à l'autre, l'orage vient sur toi ») ; d'un grain plein
      d'éclairs : « ne touche ni au mât ni aux haubans » ; il explique le feu de
      Saint-Elme ; il s'inquiète d'une frappe tout près ; et la foudre sur le mât : « il l'a
      menée jusqu'à la quille, c'est fait pour ça » ;
    - *le journal et le bilan* : les frappes proches, le feu de Saint-Elme, la foudre sur le
      mât ; au bilan, le nombre d'éclairs et le plus proche ;
    - *les marins automatiques* (l'atelier de la tempête, `test-nuit`) vivent la même
      foudre : quand elle fait disjoncter le pilote, ils le réarment.
    **Mesuré** (`npm run test-eclairs`) : un grain d'orage au plus fort lance 7,8 éclairs par
    minute (8,1 prévus), tous de son nuage ; 59 % dans le nuage, 29 % jusqu'à la mer, 12 % en
    araignée ; la moitié de la foudre tombe à moins de 0,45 rayon de l'avant de son cœur,
    8 % loin devant lui ; jamais deux éclats à moins de 0,36 s ; sans grain orageux, pas un
    éclair ; un grain qui naît : son premier éclair à 92 s (il se forme en 90 s) ; le
    tonnerre arrive à trois secondes par kilomètre du point le plus proche ; plus de
    tonnerre au-delà de 15 km ; sous un grain posé à 250 m, en deux heures : 336 éclairs
    jusqu'à la mer, aucun dans le rayon où le mât l'aurait attiré, 7 sur le mât. Une nuit,
    le bateau immobile : 1,6 éclair par minute au crépuscule (et quinze dans le front, au
    loin), 7,6 quand le vent monte, 10,7 au cœur de la tempête, 3,1 à l'accalmie ; le feu de
    Saint-Elme, 2 min 20. Cent passages du grain le plus fort : la foudre tombe à moins de
    600 m 89 fois, à moins de 300 m 55 fois, sur le mât 4 fois. La foudre, 1 µs par image.
    **Ce que ça coûte** : 1,5 ms de plus par image (sur 6,4), le temps d'un éclair : les
    nuages allumés de l'intérieur, et le cube des reflets redessiné en entier (pour ne pas
    revoir la couture du 8 octobre). L'épaisseur traversée vers l'éclair se mesure en trois
    pas, sans le détail ; dans le reflet, une épaisseur moyenne suffit (la première version
    coûtait 3,6 ms).
    **Les outils** : l'atelier des éclairs (`atelier-eclairs.html` : six moments, de
    l'après-midi d'orage au plus fort de la nuit ; un grain orageux posé à la distance
    voulue, ou qui passe sur nous ; un éclair là où l'on regarde — dans le nuage, jusqu'à la
    mer, en araignée, tout près, sur le mât ; le feu de Saint-Elme ; le temps ralenti
    (× 0,1) ; le dernier éclair et son tonnerre, qu'on compte ; la carte vue d'en haut, avec
    les nuages d'orage et les éclairs de la dernière minute ; cinq points de vue, dont la
    tête de mât ; le son, le tonnerre et la radio ; `__eclairs.planche()`, `film()`,
    `figer()` (un éclair figé à son plus fort), `couts()`).
    Images : `docs/etape29-les-eclairs.jpg`.

30. ✅ **Le baromètre** (`src/monde/pression.js`, `atelier-barometre.html`) — Sa pression se
    calculait d'après le temps qu'il faisait au même moment : il baissait quand l'orage était
    déjà là. Elle vient maintenant de la dépression qui arrive, et le baromètre annonce le
    temps, comme un vrai :
    - *la dépression* : elle arrive de l'Atlantique et passe au nord pendant la nuit ; son
      front froid traverse la zone vers 3 h 20. Le matin, par beau temps, la pression baisse
      déjà, lentement ; à 16 h 30, quand le vent n'est qu'à 17 nœuds, elle baisse de 4
      hectopascals en trois heures (« en baisse rapide » : un coup de vent arrive) ; vers
      23 h, de plus de 7 (« très rapide » : la tempête), plus de trois heures avant le plus
      fort du vent ; puis plus lentement dans la nuit, avec une dernière chute juste avant le
      front ; elle touche le fond (986 hPa) quand il passe, et remonte d'un coup (un
      hectopascal en un quart d'heure, trois dans l'heure) : le vent tourne à l'ouest, puis
      tombe. La vieille règle des marins tient à toute heure : une baisse rapide (plus de 3,5
      hectopascals en trois heures) est suivie d'un coup de vent dans les six heures, une très
      rapide (plus de 6) de la tempête. (Une courbe sans bosse entre ses points : Fritsch et
      Carlson.)
    - *la marée barométrique* : l'atmosphère respire deux fois par jour (un demi-hectopascal
      plus haut vers 10 h et 22 h) ;
    - *les grains* : l'air froid qui tombe sous eux pèse — quand arrive leur rafale, la
      pression fait un bond (de 2,2 hPa en dix secondes sous un grain fort), reste haute sous
      la pluie, puis retombe un peu plus bas qu'avant, derrière eux (`pressionEn` dans
      `monde/grains.js`, sur le bord même de leur rafale).
    **Le baromètre du bord** (`Barometre`) : son aiguille colle un peu (elle ne part qu'au-delà
    d'un tiers d'hectopascal) — on tapote le verre pour la décoller, et le bateau qui tape dans
    la mer la décolle aussi ; une aiguille témoin, dorée, qu'on cale à la main sur la noire
    pour voir, plus tard, de combien elle a bougé ; un barographe qui enregistre les douze
    dernières heures (quand on arrive en cours de route, ou après une reprise, il comble ce
    qu'il a enregistré).
    **Ce qui en dépend** :
    - *le cadran de la timonerie* : il était posé sous l'appui des vitres, qui le cachait (on
      ne le voyait qu'à genoux devant : le rayon des yeux au cadran touchait le lambris).
      Lui et la pendule sont remontés sur la bande de lambris au-dessus de l'appui, un peu
      plus petits : on les voit du siège et debout ; l'aiguille témoin dorée ;
    - *le geste* : E sur le baromètre (debout dans la timonerie) — on tapote le verre, et
      l'aiguille témoin se cale une fois la noire posée ; le titre donne la pression, et
      l'aiguille témoin ; le message, la tendance et ce qui a changé depuis l'aiguille ;
    - *les instruments à l'écran* : une case « Baromètre », la pression et une flèche (ce
      qu'elle fait en ce moment, sur le dernier quart d'heure : sur trois heures, juste après
      le front, elle montrerait encore la baisse d'avant) ;
    - *le traceur* : la pression et sa tendance en trois heures dans la bande des données (en
      orange quand elle baisse vite), et le barographe dans un coin de la carte ;
    - *Kervalen Radio* : l'avis de coup de vent donne la situation générale (la dépression qui
      se creuse à l'ouest, son front froid cette nuit) et la pression à Kervalen ; le
      bulletin de la radio du bord aussi ;
    - *Jos* : le soir, « Ton baromètre le disait : il baisse depuis ce matin, de plus en plus
      vite » ; la liste de la nuit a une ligne de plus : caler l'aiguille témoin ; à 21 h,
      « ton baromètre dégringole : 6 hectopascals en trois heures » ; à minuit, « il est à
      992, et il baisse encore » — et, si l'on a calé l'aiguille, de combien il a baissé
      depuis ; à 3 h 30, « il remonte, vite : le front est passé » ;
    - *le journal et le bilan* : à chaque chapitre, le vent et le baromètre (« baromètre 999
      hPa, en baisse très rapide ») ; au bilan, le plus bas, et quand.
    **Mesuré** (`npm run test-barometre`) : 1014,8 hPa à 9 h, 985,6 au plus bas à 3 h 21 ;
    à midi, −1,5 en trois heures (12 nœuds de vent) ; à 16 h 30, −3,8 (17 nœuds) ; à 18 h,
    −4,4 ; la baisse la plus rapide, −7,3 à 22 h 54, 3 h 24 avant le plus fort du vent (42
    nœuds à 2 h 18) ; après le front, +1,0 en un quart d'heure, +2,8 en une heure ; la règle
    des marins à chaque quart d'heure de 12 h à 2 h ; la marée, ±0,45 ; un grain fort : un bond
    de 2,2 hPa en 11 s, en même temps que sa rafale, puis −0,6 derrière lui ; à 3 km, à
    peine ; l'aiguille qui colle, la tape, l'aiguille témoin, le barographe ; ce que disent
    Jos et la radio. La pression et sa tendance : 0,3 µs.
    **Les outils** : l'atelier du baromètre (`atelier-barometre.html` : l'heure, de 9 h au
    lendemain 7 h, ou le temps qui passe — une heure en six secondes ; le cadran de près, du
    siège, le traceur, dehors ; tapoter, caler l'aiguille témoin, un grain sur le bateau ; ce
    que montre le baromètre et ce qu'il annonce ; trois courbes : la pression, sa tendance
    avec les bandes des bulletins, le vent ; `__barometre.planche()`).
    Images : `docs/etape30-le-barometre.jpg`, `docs/etape30-la-pression.png`.

## 4. Pistes graphiques notées pour plus tard

Toutes celles du grand chantier sont faites (étapes 13 à 17).
