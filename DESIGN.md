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

## 4. Pistes graphiques notées pour plus tard

Toutes celles du grand chantier sont faites (étapes 13 à 17).
