# Quart de nuit — cahier de conception

*« Prendre le quart », c'est prendre son tour de garde ; le quart de nuit est le plus dur.*

**Minuit. Une tempête, un voilier, et toi seul à bord. Six heures avant l'aube.**

Le pilote automatique tient le bateau vent arrière, les vagues dans le dos. Toi, tu ne barres
pas : tu le gardes en vie. L'eau qui entre, le pilote qui lâche, la porte, le foc qui bat…
chaque heure est pire que la précédente. Si le bateau est encore à flot, et toi à bord, quand
sonnent six heures, tu as gagné.

---

## 1. Le virage du 9 octobre 2026

Le jeu était devenu très grand : une journée de huit leçons avec Jos, le vieux marin du
sémaphore, à la radio ; une nuit de vingt minutes ; la navigation, les feux de la côte, le
baromètre, le retour au port qui s'annonçait… Mathis : « je trouve que l'on s'est un peu perdu
dans la grandeur du jeu ». Sa nouvelle direction, et ce qu'il a choisi parmi mes propositions :

- **Seulement la nuit de tempête.** Plus de journée, plus de Jos, plus de navigation.
- **On ne barre plus : on gère tout**, pour que le bateau ne coule pas et ne casse pas, comme
  le gardien de nuit de *Five Nights at Freddy's* : on ne peut pas tout surveiller à la fois,
  chaque geste coûte quelque chose, les menaces s'annoncent par des signes.
- **Plus les heures avancent, plus c'est dur.** Une nuit d'abord, de minuit à six heures, en
  **douze minutes** (deux par heure) ; on pourra en ajouter d'autres ensuite.
- **L'horreur de la mer**, des événements climatiques terrifiants et une vraie ambiance ; par
  dessus, **de l'inexpliqué jamais confirmé** (pas de créature).
- **Un bateau plus grand : un voilier de 14 m**, sans le carré du dessous, avec **une grande
  timonerie vitrée** où tout se passe. On en sort **une ou deux fois, forcé**, dans la tempête.
- **Le son plus silencieux** : la pluie, le vent, les éléments autour ; plus de voix ni de
  musique.
- **Les graphismes** : la mer, la trombe et les éclairs sont « parfaits », on les garde ; on
  retire **les rideaux de pluie des grains** ; on corrige les défauts des nuages.
- L'étape 33 (faire le point) est arrêtée et rangée dans la branche `etape-33-faire-le-point` ;
  l'ancien jeu complet est marqué par l'étiquette git `v1-journee-et-nuit` (son cahier aussi :
  toutes les étapes 1 à 32, avec ce qu'on a appris en route).

## 2. Le jeu

### La boucle

Tu es dans la timonerie, assis au poste. Dehors, la nuit noire : tu ne vois la mer qu'à ta
frontale et dans les éclairs. Les instruments sont tes caméras : le radar (ce qui arrive), le
baromètre (le pire qui approche), le sondeur (ce qu'il y a dessous…), la trappe de la cale (l'eau
qui monte). Et comme le courant de FNAF, **la batterie** : tout ce qui est électrique la vide (le
pilote, le radar, la pompe, les volets…), et quand elle meurt, tout s'éteint. Les menaces
arrivent, chacune avec ses signes et sa parade :

| La menace | Ses signes | La parade |
|---|---|---|
| La batterie qui se vide | sa jauge (au tableau, sous l'heure), l'alarme à 20 %, les lumières qui faiblissent | couper ce dont on peut se passer ; lancer le moteur |
| L'eau qui monte (les fuites s'aggravent d'heure en heure, chaque vague en apporte) | l'alarme de cale, l'eau noire qu'on voit monter par la trappe, vers les batteries | la pompe électrique (elle tire sur la batterie) ; la pompe à main ; noyées, les batteries coupent tout |
| Le pilote qui chauffe, puis disjoncte (de plus en plus, la nuit avançant) | sa température sur son écran, son alarme, le bateau qui se met en travers | le moteur le soulage ; en veille, il refroidit ; son disjoncteur se réarme au tableau, une fois froid |
| Le moteur qui chauffe | sa température, son alarme ; il se coupe tout seul | l'arrêter avant ; et tant qu'il tourne, on n'entend plus venir les vagues |
| Les vitres | une vague qui frappe un côté les fend (le claquement, la toile d'araignée), la suivante les brise | fermer les volets de ce côté — mais derrière, on ne voit plus, et fermés ils tirent sur la batterie |
| Les déferlantes (une toutes les 40 s à minuit, toutes les 12 s à 5 h) | leur grondement, de leur côté, de 2,5 s (les petites) à 6 s (les plus grosses) avant le choc — le moteur le couvre : on ne l'entend plus qu'au dernier tiers ; la nuit, un éclair montre la crête des plus grosses | fermer les volets de ce côté ; la porte ; se tenir (Maj) dehors |
| Le foc qui bat (son écoute casse, vers 3 h) | son claquement, le bateau qui part, le pilote qui chauffe plus vite (il force 1,6 fois plus) | sortir le rouler, harnais accroché |
| Les dalots bouchés (vers 4 h 30) | le cockpit reste plein (on le voit par la porte et les fenêtres arrière), on n'entend plus l'eau s'écouler ; l'alarme de cale | sortir les dégager, derrière la roue — sans rouvrir la porte tant que le cockpit est plein |
| La trombe (née vers 3 h 30, elle passe vers 4 h 15, à 150 m au moins) | l'écho au radar, et rien d'autre : on ne la voit qu'à la lueur des éclairs | tenir |
| Deux vagues scélérates (2 h 30, 5 h 20) | un grondement énorme, une minute avant ; un éclair montre le mur | tenir |
| La foudre | les éclairs, le tonnerre de plus en plus proche, le feu de Saint-Elme | réarmer ce qui a sauté |
| L'inexpliqué | un écho qui suit, des pas sur le pont, une voix sur le 16, des coups sous la coque… | rien : ce n'est jamais confirmé |

**Les volets de tempête** sont les portes de FNAF : on les ferme côté par côté, depuis le siège,
quand une vague arrive de ce côté-là… mais volet fermé, on ne voit plus rien de ce côté ; leurs
moteurs les tiennent serrés contre la mer (1,5 A par côté fermé) ; et sans courant (ou leur
disjoncteur coupé), ils ne bougent plus, et plus rien ne les tient : la mer les force, ils ne
protègent plus qu'à moitié. (Sinon, il suffirait de tout fermer pour la nuit.) **Le moteur** est la grande tentation : il recharge la batterie et
soulage le pilote, mais il chauffe, et tant qu'il tourne on n'entend plus le grondement qui
annonce les vagues (on les entend venir de leur côté : c'est ce qui dit quels volets fermer).

### Les heures

Comme les nuits de FNAF, chacune plus dure que la précédente (`HEURES`, dans `quart/nuit.js`).
Quand elle sonne, l'heure s'affiche avec son signe, et le journal le note.

| | Son signe | Le vent | Les déferlantes | Ce qui arrive |
|---|---|---|---|---|
| minuit | « La mer est déjà grosse. » | 32 nœuds | une toutes les 40 s, ×0,85 | on prend ses marques |
| 1 h | « Le baromètre baisse. » | 35 | toutes les 32 s, ×0,9 | un premier grain passe |
| 2 h | « La mer se creuse. » | 38 | toutes les 26 s, ×0,95 | une voix sur le 16 ; la première vague scélérate (vers 2 h 30) |
| 3 h | « Des éclairs, tout autour. » | 41 | toutes les 15 s, ×1 (la scélérate les fait taire un quart d'heure) | l'écoute du foc casse (la première sortie) ; la trombe naît vers 3 h 30, dans le noir |
| 4 h | « Le baromètre n'a jamais été si bas. » | 43 | toutes les 17 s, ×1,05 | la trombe passe, à 150 m au moins ; le front vers 4 h 30 (le vent tourne de 25°, la mer croise) ; les dalots se bouchent (la seconde sortie) |
| 5 h | « Le vent hurle dans le gréement. » | 46 | toutes les 12 s, ×1,1 | le plus fort : le grain le plus violent, la seconde vague scélérate, des coups sous la coque |
| 6 h | | il tombe enfin | | la première lueur : la nuit est finie |

La nuit est gardée au début de chaque heure : après un naufrage, on reprend à cette heure-là
(ou à minuit).

### Les commandes

Au clavier (français) et à la souris. La souris tourne la tête.
- **Assis au poste** (au début de la nuit) : E agit sur ce que tu regardes et qui est à portée
  de main (le radar, le traceur, la commande du pilote, le tableau du moteur, chaque
  disjoncteur du tableau électrique, la VHF et la commande des volets au plafond) ; Espace pour
  se lever (la pompe à main, la trappe, le coupe-batterie, le baromètre : il faut y aller).
- **À pied** : Z Q S D pour marcher, E pour agir (Maj + E : l'action inverse), Maj pour se
  tenir, C pour s'accroupir, X le harnais (dehors).
- **Partout** : F la lampe frontale, L le carnet de bord, H pour cacher l'aide, Échap la pause.

## 3. Feuille de route

Une étape = un résultat visible ; je travaille sur la branche `la-nuit-seule`, et le jeu en
ligne reste l'ancien tant que le nouveau n'est pas jouable.

1. ✅ **La nuit seule** — le jeu commence directement à minuit ; plus de journée, de Jos, de
   barre ni de navigation ; le pilote tient le cap ; six heures de deux minutes, de plus en plus
   dures ; plus de rideaux de pluie.
2. ✅ **Le bateau de 14 m** — plus grand, sans carré, une grande timonerie vitrée : les volets des
   vitres, la porte, la console, le tableau, la pompe à main, une trappe vers la cale.
3. ✅ **Les systèmes du bord** — la batterie et ce qui la vide, le moteur qui la recharge mais couvre
   les bruits, l'eau qui monte et les deux pompes, le pilote qui chauffe et disjoncte, les volets
   et les vitres qui éclatent ; les veilleurs automatiques pour régler la difficulté.
4. ✅ **Les heures** — chaque heure plus dure, chaque menace annoncée par ses signes (le grondement
   qui vient d'un côté, le radar, l'éclair qui montre la vague) ; les deux sorties forcées.
5. **L'inexpliqué et l'ambiance** — l'écho qui suit, les coups sous la coque, une voix sur la
   VHF, une forme au sondeur ; les notes de l'ancien propriétaire du bateau pour apprendre les
   commandes (à la place de Jos).
6. **Le son** — plus silencieux, chaque son venant de sa direction, de longs creux avant les coups.
7. **Les nuages** — corriger leurs défauts.
8. **Finitions et mise en ligne.**

### Étape 1 : la nuit seule ✅ (9 octobre 2026)

**Ce qui part** (l'ancien code reste dans git) : la journée et ses huit leçons
(`jeu/journee.js`, `jeu/lecons.js`), Jos et tout ce qu'il disait, le cargo, la barre et la
barre assistée, les écoutes, les ris, la navigation libre, le livre des feux et la
reconnaissance des feux, l'écran du soir, les ateliers de la tempête, du bateau, des feux, des
risées et du baromètre, les essais de la journée, de la barre, du baromètre et de la bête.

**Ce qui est neuf** :
- `src/quart/nuit.js` — la nuit : de minuit (24) à six heures (30), `DUREE_HEURE` = 120 s.
  Le temps empire d'heure en heure (`meteoDeLaNuit` : 32 → 46 nœuds ; le front vers 4 h 30, le
  vent tourne de 25° ; à six heures il tombe). Les fuites s'aggravent (+25 % par heure). Ce qui
  arrive : trois grains lancés sur le bateau (1 h 20, 2 h 55, 4 h 40), de plus en plus forts ;
  la bête vers 3 h 30, sous son grain (elle vit 200 s : une heure trois quarts de la nuit) ; deux
  vagues scélérates (2 h 30 et 5 h 20, la seconde d'un côté inattendu) ; le pilote qui lâche à
  partir de 1 h 45, puis de plus en plus souvent ; l'écoute du foc vers 3 h ; la foudre des
  grains ; l'étrange (une lumière sur l'eau, une voix sur le 16, des coups contre la coque) et la
  peur (`quart/peur.js`, ses fenêtres d'heures recalées sur la nouvelle nuit : la tension monte
  jusqu'à l'aube au lieu de retomber après 2 h). Chaque heure est notée au journal et gardée.
  (Le baromètre suit la même dépression qu'avant, décalée d'une heure et quart : son fond quand
  le front passe.) Ce que la nuit avait de l'ancien moteur, sans Jos : les déferlantes, l'eau à
  bord, les avaries, la bête, les grains, la foudre, les scélérates, la peur, la reprise.
- `src/quart/veilleurs.js` — trois veilleurs automatiques font la nuit avec la vraie physique
  (l'attentif, le distrait, l'absent), et `piloter` : le pilote tient le vent à 160°.
- `src/quart.js` — le jeu : l'accueil (« Prendre le quart », « Reprendre la nuit à 3 h »), assis
  au poste de la timonerie au début, l'heure en haut à droite (et ce qui ne va pas à bord), les
  annonces de chaque heure, l'écran de six heures et son bilan, le naufrage (« Reprendre à 2 h »,
  « Recommencer à minuit »). La VHF ne répond plus : elle grésille. `jeu.html?heure=27.4` :
  directement à cette heure, pour vérifier.
- les rideaux de pluie des grains ne sont plus dessinés (`ciel.grains.masque.rideaux`) : la pluie
  reste autour du bateau (sur les vitres, dans la lampe, sous les éclairs).

**Mesuré** (`npm run test-nuit`, trois veilleurs, la même nuit) : la nuit dure 12 minutes ;
chaque heure sonne ; le vent 32, 35, 38, 41, 43, 45, 46 nœuds ; quatre grains sur le bateau
(rafales jusqu'à 62 nœuds) ; la trombe à 3 h 29, passée à 130 m ; les scélérates à 2 h 38 et
5 h 32 ; le pilote lâche six fois (1 h 48 → 5 h 51) ; 204 éclairs. L'attentif voit l'aube avec
150 L d'eau à bord au plus ; l'absent, qui ne pompe pas, finit avec 1 890 L. **Mais il voit
l'aube lui aussi : la nuit n'est pas encore assez dangereuse** — c'est le travail des étapes 3 et
4 (les systèmes, puis les menaces de chaque heure).

**À voir** : dans le noir, on ne voit pas la trombe ; à l'éclair, elle apparaît d'un coup, avec
son nuage-mur, par la vitre de côté. `docs/nuit-seule-*.jpg`.

### Étape 2 : le bateau de 14 m ✅ (10 octobre 2026)

**Le bateau** (`bateau/forme.js`) : un voilier de 14 m (un « 46 pieds »), 4,30 m de large, 13,4 t.
Ce qui avait été mesuré à la main sur l'ancien 9,40 m (la quille, le safran, les centres de
poussée des voiles, les rayons de giration…) est mis à sa taille par trois rapports (`ECHELLE` :
1,49 en longueur, 1,34 en largeur, 1,38 en hauteur) ; la masse vient de son déplacement. Plus de
barre franche : une roue sur son piédestal, au milieu du cockpit (le pilote la fait tourner). Un
mât de 17 m, deux étages de barres de flèche, 105 m² de toile.

**La timonerie** (`bateau/timonerie.js`, `bateau/interieur-timonerie.js`) : 3 m de long sur 2,7 m
de large, 2,15 m sous le toit ; son plancher est 22 cm au-dessus de celui du cockpit. Deux grandes
fenêtres de chaque côté (1,15 m), un pare-brise de trois vitres (celle du milieu fait 84 cm : on
l'a devant soi, assis), deux petites fenêtres à l'arrière, de part et d'autre de la porte. Dedans :
- **la console** sous le pare-brise : sur son pupitre incliné, le radar (le plus grand écran), le
  compas (sa rose s'éclaire en rouge la nuit), la commande du pilote, le traceur, le tableau
  électrique ; au plafond, devant, la VHF, les répétiteurs du vent et de la vitesse, et **la
  commande des volets** (un petit plan de la timonerie, un bouton par côté, son voyant : vert
  ouvert, rouge fermé, orange qui clignote quand il bouge). Tout est à portée de main du siège ;
- **le siège de quart**, haut, au milieu ; derrière lui, à tribord, la banquette, le baromètre et
  la pendule au-dessus ; le ciré et le gilet pendus près de la porte ;
- à bâbord, **la pompe de cale à main** sur la paroi (son levier monte et descend le long d'elle),
  et à côté, **la trappe de la cale** dans le plancher ; tout à l'avant, **la petite porte basse de
  la cabine avant**, peinte en vert sombre, fermée (pour plus tard) ;
- **les volets de tempête** : un par vitre (sauf celles de la porte), des lames d'aluminium qui
  descendent de leur coffre en 2,5 s ; fermés, ils coupent la lumière du dehors (et la vue) ;
- deux plafonniers (blanc ou rouge) et des mains courantes au plafond.

**La cale** (`bateau/interieur.js`), sous le plancher : le fond de la coque peint en gris, les
varangues et les écrous des boulons de quille, la crépine de la pompe et son tuyau, **les batteries
sur leur étagère, juste sous la trappe**, et une baladeuse qui s'allume quand on soulève la trappe.
L'eau embarquée y monte (`bateau/eau-a-bord.js`) : noire, elle clapote quand le bateau roule ; au
naufrage, elle arrive au plancher et passe dessus.

**Le reste** : le plan où l'on marche (`joueur/pont.js` : plus de carré ni d'escalier ; la trappe
ouverte est un trou ; on monte d'au plus 55 cm d'un pas — le toit du rouf est 50 cm au-dessus du
passavant) ; les gestes (la pompe, la trappe, les quatre boutons des volets) ; les hublots de la
cabine avant ont leurs rideaux tirés ; l'écume de la coque s'efface derrière la poupe.

**Mesuré** : le bateau flotte et se redresse, 6,6 nœuds sous voiles dans 12 nœuds de vent
(`test-physique`). Il est presque trois fois plus lourd et résiste cinq fois plus au roulis :
avec les déferlantes de l'ancien, de travers, il ne se couchait presque plus (un coup à plus de
60° en trois mers) ; elles poussent maintenant 1,75 fois plus fort. La grille qui lit la mer sous
la coque couvre aussi toute sa longueur (elle s'arrêtait 1,8 m avant l'étrave et 1,6 m avant le
tableau : l'avant et l'arrière flottaient sur une eau fausse, ce qui secouait le bateau au
hasard). Résultat (`test-tempete`, 15 grosses déferlantes en trois mers) : de travers, 4 le
couchent au-delà de 60° ; en fuite à deux ris, 2 ; sous un bout de foc (la toile de la nuit),
aucune — se mettre en travers (le pilote qui lâche) est le danger. L'écart avec la fuite à deux
ris est plus petit qu'avec l'ancien bateau : le test compare maintenant le travers à la toile de
la nuit (au moins 3 coups de plus) et demande seulement « pire » face à la fuite à deux ris. Le marin automatique fait le tour du bord et manie
chaque chose (15 tournées sur 15), on entre et on sort par la porte de partout (24 sur 24 ; on
contourne la roue, d'un mètre de large), le plan du pont passe ses 27 vérifications. La nuit des
trois veilleurs (`test-nuit`) : l'attentif voit l'aube avec 150 L d'eau à bord au plus, le
distrait aussi (1 185 L), et **l'absent, qui ne fait rien, coule à 5 h 19** (2 000 L) — avec
l'ancien bateau, même lui voyait l'aube. La vague scélérate se comporte comme avant
(`test-scelerate` : droit derrière ça passe, de travers ou par la hanche elle couche le bateau).

**À voir** : `docs/bateau-14m-*.jpg` (la timonerie, ses volets fermés, la cale par la trappe et du
dedans, le bateau de dehors, la nuit, la vue au poste).

### Étape 3 : les systèmes du bord ✅ (10 octobre 2026)

Tout est calculé dans `src/quart/systemes.js`, sans image ni son (comme la nuit) : les veilleurs
automatiques s'en servent aussi. Le temps de la nuit passe trente fois plus vite que le vrai :
les ampères sont de vrais ampères, qui vident la batterie en heures de la nuit.
- **La batterie** : 60 Ah (de vieilles batteries), à 80 % à minuit. Tout en marche, le bord tire
  15 à 25 A — le pilote de 1,6 à 13 A selon qu'il force, le radar 3,6, les feux 2,2, le traceur
  1,4, la VHF 0,6, l'éclairage rouge 0,5 (blanc 2,4), la pompe électrique 11 quand elle tourne,
  les volets 9 pendant qu'ils bougent, le démarreur 160 pendant qu'il lance : sans moteur, elle
  meurt vers 2 h. Huit disjoncteurs au tableau, un par appareil. À 20 %, l'alarme ; sous 6 %, les
  lumières faiblissent et hésitent ; à zéro, le noir (plus de pilote, de radar, de pompe, de
  volets, d'écrans).
- **Le moteur** : il démarre en 2,5 s s'il reste 12 % de batterie, recharge 55 A, pousse le bateau
  (4,2 kN à plein régime, dans la physique) et souffle sur le safran (le bateau répond mieux : le
  pilote force moins, mesuré de 20 à 35 % de coups de barre en moins). Il chauffe d'autant plus
  vite que la mer est grosse (sa prise d'eau aspire de l'air quand l'arrière se soulève) : dans la
  mer de 4 h, il se coupe tout seul au bout de deux minutes et demie, et ne repart qu'après trois
  quarts de minute de repos. Tant qu'il tourne, le monde du dehors est couvert (−7 dB, et son
  grondement par-dessus).
- **Le pilote** chauffe avec son travail : la mer qui monte (le vent), ses coups de barre, la
  fatigue de la nuit ; le moteur l'en soulage de moitié. Par 32 nœuds à minuit, il tient (53 %) ;
  par 46 nœuds à 5 h, il disjoncte en moins d'une minute s'il est déjà chaud. Son disjoncteur
  thermique ne se réarme que sous 70 % (une demi-minute de refroidissement). Il ne tombe plus en
  panne à heure fixe : seulement de chaleur, par la foudre sur le mât, une vague scélérate ou la
  trombe qui arrachent la barre.
- **L'eau** : la pompe électrique (son flotteur la lance au-dessus de 60 L, 3 L/s) ; la pompe à main
  (4 L/s, il faut rester à pomper). À 300 L, l'alarme de cale ; à 760 L, l'eau atteint les bornes
  des batteries (sur leur étagère, juste sous la trappe) : le coupe-batterie saute, c'est le noir,
  et elles perdent la moitié de leur charge ; sous 600 L, on le réarme (la clé rouge, derrière la
  pompe).
- **Les vitres** : chaque déferlante frappe les vitres du côté d'où elle vient (de l'arrière, les
  fenêtres arrière ; de travers, un côté ; par l'avant, le pare-brise), si leurs volets sont
  ouverts. Une vitre fendue montre une toile d'araignée ; brisée, des éclats sur le pourtour, et
  la mer entre à chaque vague (et la pluie sans cesse) ; son volet fermé bouche presque le trou.
  La vague scélérate brise d'un coup toutes les vitres de son côté.

Ce qu'on voit et qu'on touche : le **tableau électrique** (la jauge de la batterie, sa tension,
l'ampèremètre, trois voyants, huit disjoncteurs à levier), le **tableau du moteur** (compte-tours,
température, bouton marche/arrêt), la température sur l'**écran du pilote**, la **commande du
pilote** (veille/enclenché), le **coupe-batterie** ; sous l'heure, la batterie en %, et la liste
des alarmes. Les sons : le diesel, son démarreur (et le démarreur qui force, batterie faible), la
pompe électrique, les moteurs des volets, quatre alarmes (la cale, la batterie, le pilote, le
moteur), le verre qui se fend et qui éclate, la coupure de courant ; les déferlantes s'entendent
maintenant venir **de leur côté**.

**Mesuré** (`npm run test-systemes`, 37 vérifications ; `npm run test-nuit`) : la même nuit (graine
3), l'attentif voit l'aube, sans jamais perdre le courant (batterie au plus bas 39 %, 7 minutes de
moteur, une vitre brisée) ; le distrait noie ses batteries vers 3 h (porte ouverte, une grosse
vague), passe cinq minutes dans le noir et coule à 5 h 41 ; l'absent n'a plus de courant à
2 h 14, se met en travers sans pilote, perd cinq vitres et coule à 5 h 05. Sur trois nuits (graines
3, 5, 7) : l'attentif voit l'aube trois fois ; le distrait deux fois, toujours après des minutes
de noir ; l'absent jamais (il coule entre 3 h 11 et 5 h 05). **La nuit est enfin dangereuse** :
qui ne fait rien coule.

**Limites** : la difficulté reste à régler heure par heure (étape 4) ; les veilleurs entendent
parfaitement (ils lisent l'annonce des vagues), un joueur moins : le moteur coûtera plus cher à
un vrai joueur qu'à eux. Les sons sont fonctionnels, ils seront repris à l'étape 6.

**À voir** : `docs/systemes-*.jpg` (la console, le tableau électrique, celui du moteur, les vitres
fendues vues du cockpit, et le noir quand le courant meurt).

### Étape 4 : les heures ✅ (10 octobre 2026)

**Chaque heure plus dure** (`HEURES`, dans `quart/nuit.js`) : chaque heure a son signe (« Le
baromètre baisse. », « Le vent hurle dans le gréement. »…), écrit à l'écran quand elle sonne et
noté au journal, et sa mer : une déferlante toutes les 40 s à minuit, toutes les 12 s à 5 h, et de
plus en plus grosses (×0,85 à ×1,1). Les déferlantes viennent maintenant à un rythme régulier
(l'attente entre deux est tirée autour de la période de l'heure) : avec l'ancien tirage (une
chance par seconde), une nuit pouvait en jeter cinq à minuit et deux à 1 h.

**Chaque menace annoncée par ses signes** :
- une déferlante gronde dès qu'elle s'annonce, de son côté : 2,5 s avant le choc pour les petites,
  6 s pour les plus grosses (`preavis`, dans `monde/deferlantes.js`) — le temps de fermer les
  volets de ce côté, qui mettent 2,5 s à descendre. Mais **le moteur couvre son grondement** : tant
  qu'il tourne, on ne l'entend plus que dans le dernier tiers (`ENTENDRE`), trop tard pour les
  volets. Sa crête, elle, court toujours vers le bateau, et on peut la voir… volets ouverts ;
- la nuit, sous l'orage, les plus grosses (force 0,8 et plus) se découpent trois fois sur quatre
  sur un éclair, 3,2 s avant de frapper (`ECLAIR_VAGUE`) ;
- la vague scélérate gronde elle aussi de son côté (on l'entend à 980 m, le moteur en marche à
  600 m) ;
- la première grosse vague qu'on entend, un message dit ce que veut dire ce grondement (une seule
  fois) ; et pour jouer sans le son, une option écrit les bruits qui comptent (« [Une déferlante
  gronde, par la hanche tribord] »), décochée d'abord : on joue à l'oreille.

**Les volets coûtent quelque chose**, comme les portes de FNAF : fermés, leurs moteurs les tiennent
serrés (1,5 A par côté) ; sans courant, la mer les force (ils ne protègent plus qu'à moitié). Sans
cela, il suffisait de tout fermer pour la nuit.

**Les deux sorties forcées** :
- **le foc qui bat** (son écoute casse vers 3 h, souvent dans la rafale du deuxième grain) : il
  secoue le bateau, le pilote force 1,6 fois plus et chauffe — sortir le rouler ;
- **les dalots bouchés**, vers 4 h 30 (le front est passé, la mer croise ; s'il y a la trombe à
  moins de 300 m, quand elle est passée) : la première déferlante qui remplit le cockpit y jette un
  bout de cordage et un lambeau de la housse de la roue. Le cockpit ne se vide plus (6 % de ses
  dalots) ; plein, son eau passe sous la porte fermée (un litre par seconde par 90 L au-dessus de
  300 L : jusqu'à 5 L/s, plus que la pompe électrique) et l'arrière alourdi fait forcer le pilote
  (jusqu'à 1,9 fois à 750 L). Il faut sortir, contourner la roue, et tenir E quatre secondes sur
  l'un des deux dalots (aux coins arrière du cockpit) — et ne pas rouvrir la porte tant que le
  cockpit est plein : 220 L entrent le temps de passer. Ce qui les bouche flotte sous la surface,
  le bruit de l'eau qui s'écoule se tait, l'heure affiche « Dalots bouchés ».

**Ce qui a changé en route** :
- le cockpit restait plein toute la nuit, même sans dalots bouchés : ses dalots de 5 L/s ne
  suivaient pas une vague toutes les 15 s. Ils font maintenant 75 mm, comme sur un 14 m de haute
  mer (12 L/s à 500 L : plein, le cockpit se vide en une minute trois quarts), et les petites
  déferlantes soulèvent l'arrière sans presque rien jeter à bord (l'eau embarquée suit
  maintenant leur force au-delà de 0,3) ;
- la trombe : personne ne barre, mais le moteur change l'allure du bateau, et elle finissait par
  passer sur lui (33 m à l'étape 3, 12 m pour un veilleur sans pilote, qui dérivait). Elle s'écarte
  maintenant de sa route, de côté, pour passer à 150 m au moins (`ecarterBete`) : on la sent, elle
  ne vient pas sur nous ;
- **la nuit pâlissait dès 4 h 10** : le ciel gardait la date de l'ancien jeu (la fin août, le soleil
  levé à 5 h 16). Les deux heures les plus dures se jouaient donc dans l'aube, et les éclairs qui
  montrent les vagues ne s'y voyaient pas. La nuit est maintenant celle du 10 octobre (la
  déclinaison du soleil à −7°) : noire jusqu'à 5 h 20, la première lueur à 6 h ;
- le carnet de bord coupait la moitié de ses consignes (1 164 px de texte pour une page de 580) : la
  page se déroule à la molette, même quand la souris est prise par le jeu.

**Les veilleurs entendent comme toi** : une vague, ils ne la connaissent qu'à son grondement (le
moteur en marche, trop tard), et il leur faut 0,4 s pour réagir. L'attentif garde donc fermés,
tant que le moteur tourne, les volets du côté d'où viennent les vagues ; il sort dégager les dalots
au bout de huit secondes, et attend dehors, attaché, que le cockpit se vide avant de rouvrir la
porte. Le distrait sort au bout d'une minute, sans s'attacher.

**Mesuré** (`npm run test-heures`, 21 vérifications ; `npm run test-systemes`, 42 ;
`npm run test-nuit` ; quatre nuits, graines 3, 5, 7 et 11) :
- les déferlantes de l'attentif, d'heure en heure, en moyenne : 3 ; 3,75 ; 4,75 ; 5 ; 7,75 ; 7 (à
  5 h, la seconde scélérate les fait taire un moment), et les grosses : 0,75 ; 0,25 ; 0,75 ; 1,25 ;
  1,5 ; 2. Sur la nuit d'essai (graine 3) : 7 de minuit à 2 h, 14 de 4 h à 6 h ;
- **l'attentif voit l'aube 4 fois sur 4**, sans jamais perdre le courant (batterie au plus bas
  38 %), sans une vitre brisée, avec 114 à 231 L d'eau à bord au plus ; ses dalots se bouchent entre
  4 h 40 et 4 h 58 et il les a dégagés huit minutes plus tard ; la trombe passe à 112-276 m ;
- **le distrait coule 4 fois sur 4, mais tard** (entre 4 h 35 et 5 h 26 : à l'étape 3, il voyait
  l'aube deux fois sur trois) ; **l'absent coule entre 3 h 12 et 3 h 58** ;
- tous les essais passent ; les essais de marche, 20 sur 20 (les deux dalots, derrière la roue).

**Limites** : un joueur entendra moins bien que les veilleurs (sur des haut-parleurs d'ordinateur,
la gauche et la droite se distinguent mal : un casque aide) ; les sons des vagues et du moteur
sont encore ceux de l'étape 3, ils seront repris à l'étape 6 ; l'eau du cockpit est presque
transparente vue de près. Le distrait ne voit plus jamais l'aube : la nuit est dure pour qui ne
ferme pas les volets et laisse la porte ouverte — mais on reprend toujours au début de l'heure.

**À voir** : `docs/heures-*.jpg` (5 h qui sonne, dans le noir ; les dalots bouchés, vus accroupi
dans le cockpit ; l'éclair qui montre une grosse déferlante, 2,7 s avant qu'elle frappe).

## 4. Le moteur (ce qu'on garde de l'ancien jeu)

Tout ce qui fait l'image, le son et la physique reste, et sert la nouvelle nuit. Le détail de
chacun, étape par étape, est dans l'ancien cahier (étiquette `v1-journee-et-nuit`).
- **La mer** : 5 grilles de vagues calculées par FFT (Tessendorf), la même pour l'image et pour
  faire flotter le bateau, dans un worker (`src/mer/`, `src/rendu/eau.js`) ; les déferlantes, les
  vagues scélérates de 20 m (`src/monde/scelerates.js`, `src/mer/scelerate.js`), le sillage, le
  plancton qui s'allume.
- **Le ciel** : l'atmosphère, les nuages en volume, le front orageux (`src/rendu/ciel.js`) ;
  **les grains** (`src/monde/grains.js`) : des averses d'orage qui existent à un endroit, leur
  rafale, leur pluie, leur nuage ; **les risées** (`src/monde/risees.js`).
- **La foudre** (`src/monde/foudre.js`, `src/rendu/eclairs.js`) : les éclairs partent des nuages
  d'orage, le tonnerre arrive à trois secondes par kilomètre, le feu de Saint-Elme, le mât qui
  attire la foudre.
- **La trombe** (`src/rendu/trombe.js`) : la bête, en volume.
- **Le voilier** (`src/bateau/`, un 14 m à timonerie depuis l'étape 2) et **sa physique**
  (`src/physique/voilier.js`) ; le marin qui marche à bord (`src/joueur/`), les gestes (E), le
  radar, le traceur, le tableau électrique.
- **La peur** (`src/quart/peur.js`, `src/rendu/apparitions.js`) : ce qu'on voit du coin de l'œil
  et qui disparaît quand on le regarde.
- **Le son** (`src/son/audio.js`) : de vrais enregistrements du domaine public, mélangés en direct.
- **Les feux de la côte** (`src/monde/feux.js`, `src/rendu/feux.js`) : au loin, au nord, le phare
  et ses faisceaux qu'on perd dans les grains.
