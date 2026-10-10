# Quart de nuit — cahier de conception

*« Prendre le quart », c'est prendre son tour de garde ; le quart de nuit est le plus dur.*

**Minuit. Une tempête, un voilier, et toi seul à bord. Six heures avant l'aube.**

Le pilote automatique tient le bateau vent arrière, les vagues dans le dos. Toi, tu ne barres
pas : tu le gardes en vie. La batterie que tout vide, les volets à fermer du côté d'où gronde la
vague, l'eau qui monte dans la cale, le moteur qui recharge mais couvre les bruits, le pilote qui
chauffe… chaque heure est pire que la précédente. Si le bateau est encore à flot, et toi à bord,
quand sonnent six heures, tu as gagné. Il y a un an, jour pour jour, on a retrouvé *Morgane* à la
dérive, la timonerie vide ; le livre de bord de son ancien propriétaire est toujours à bord.

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
| La trombe (née vers 3 h 25, elle passe vers 4 h 15, à 150 m au moins, et s'efface vers 4 h 50) | l'écho au radar, et rien d'autre : on ne la voit qu'à la lueur des éclairs | tenir |
| Deux vagues scélérates (elles frappent vers 3 h 15 et 5 h 40) | un grondement énorme, une demi-heure de la nuit avant, de son côté ; un éclair montre le mur | fermer les volets de son côté ; tenir |
| La foudre | les éclairs, le tonnerre de plus en plus proche, le feu de Saint-Elme | réarmer ce qui a sauté |
| L'inexpliqué | un écho qui suit, des pas sur le toit, une voix sur le 16, le sondeur qui marque six mètres, trois coups derrière la porte de la cabine avant, cette porte qui s'entrouvre dans ton dos… ce que racontait le livre de bord | rien : ce n'est jamais confirmé |

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
| 4 h | « Le baromètre n'a jamais été si bas. » | 43 | toutes les 17 s, ×1,05 | la trombe passe, à 150 m au moins ; le front vers 4 h 30 (le vent tourne de 25°, la mer croise) ; les dalots se bouchent (la seconde sortie) ; la porte de la cabine avant s'entrouvre |
| 5 h | « Le vent hurle dans le gréement. » | 46 | toutes les 12 s, ×1,1 | le plus fort : le grain le plus violent ; trois coups derrière la porte de la cabine avant ; la seconde vague scélérate, qui frappe vers 5 h 40 |
| 6 h | | il tombe enfin | | la première lueur : la nuit est finie |

La nuit est gardée au début de chaque heure : après un naufrage, on reprend à cette heure-là
(ou à minuit).

### Le livre de bord (à la place de Jos)

*Morgane* appartenait à Yves Le Bihan. Il y a un an, jour pour jour, on l'a retrouvée à la dérive
au large de Kervalen : le pilote enclenché, la timonerie vide. Son livre de bord est toujours à
bord, sur la banquette (`quart/livre-de-bord.js` ; la touche L, ou E en le regardant). Il fait ce
que faisait Jos : d'abord **ses consignes**, pour qui prendra le quart (tout ce qu'il faut
surveiller) ; puis **sa dernière nuit**, la nuit du 9 au 10 octobre 2025 — une page par heure, qu'on
ne lit qu'une fois cette heure venue (« Une page de plus dans le livre de bord »). Comme les
appels du téléphone dans FNAF, chacune dit ce qui va arriver (la batterie, le grain, les vagues
qu'on entend venir, le foc, les dalots…) et chacune est un peu plus étrange (l'écho qui suit, le
mayday sur le 16, quelqu'un à l'avant, le sondeur, la porte de la cabine avant). La dernière, à
5 h, s'arrête au milieu d'une phrase : « On frappe à la porte de la cabine avant. Trois coups.
Je vais ».

### Les commandes

Au clavier (français) et à la souris. La souris tourne la tête.
- **Assis au poste** (au début de la nuit) : E agit sur ce que tu regardes et qui est à portée
  de main (le radar, le traceur, la commande du pilote, le tableau du moteur, chaque
  disjoncteur du tableau électrique, la VHF et la commande des volets au plafond) ; Espace pour
  se lever (la pompe à main, la trappe, le coupe-batterie, le baromètre : il faut y aller).
- **À pied** : Z Q S D pour marcher, E pour agir (Maj + E : l'action inverse), Maj pour se
  tenir, C pour s'accroupir, X le harnais (dehors).
- **Partout** : F la lampe frontale, L le livre de bord, H pour cacher l'aide, Échap la pause.

## 3. Feuille de route

Une étape = un résultat visible. J'ai travaillé sur la branche `la-nuit-seule`, le jeu en ligne
restant l'ancien tant que le nouveau n'était pas jouable ; à l'étape 8, elle a rejoint `main` : la
nuit seule est en ligne.

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
5. ✅ **L'inexpliqué et l'ambiance** — l'écho qui suit, les coups sous la coque, une voix sur la
   VHF, une forme au sondeur ; les notes de l'ancien propriétaire du bateau pour apprendre les
   commandes (à la place de Jos).
6. ✅ **Le son** — plus silencieux, chaque son venant de sa direction, de longs creux avant les coups.
7. ✅ **Les nuages** — corriger leurs défauts.
8. ✅ **Finitions et mise en ligne** — relire tout ce que voit le joueur, corriger les restes,
   publier.

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

### Étape 5 : l'inexpliqué ✅ (10 octobre 2026)

**Le livre de bord d'Yves Le Bihan** remplace Jos (`quart/livre-de-bord.js`, voir plus haut) :
l'accueil le dit en deux phrases (on a retrouvé *Morgane* à la dérive il y a un an, jour pour
jour, la timonerie vide) ; à minuit, un message montre où il est ; à chaque heure, une page de plus
(« Une page de plus dans le livre de bord : 3 h, la nuit d'Yves Le Bihan (L) »), et le livre s'ouvre
sur elle. Le carnet devient ce livre : à gauche, ses consignes puis sa dernière nuit, de son
écriture, à l'encre bleu-noir (la dernière page s'arrête net, la plume a glissé) ; à droite, *ta*
nuit (le journal). Le livre lui-même est posé sur la banquette, une reliure de toile bleue, un
crayon dedans : E pour le lire. Ce qu'il raconte peut arriver… ou pas : rien n'est confirmé, mais
le journal de ta nuit lui répond parfois mot pour mot (« Le sondeur a marqué six mètres »).

**La porte basse de la cabine avant**, gardée fermée depuis l'étape 2 : elle s'entrouvre (son
loquet saute, ses gonds grincent, de son côté) — jamais sous tes yeux : assis au poste, la console
la cache ; debout, seulement dans ton dos (`porteAvant`, dans `quart/peur.js` : deux fois au plus,
de 4 h 18 à 5 h 51, avec sa propre attente). Il faut se lever pour la voir ; le journal le note
quand on la voit (« La porte de la cabine avant est entrouverte », puis « … de nouveau
entrouverte. Je l'avais refermée ») ; E la referme, ou l'ouvre en grand. Derrière (`construireCabineAvant`) :
la cabine sans lumière — ses matériaux ne prennent pas celle de la timonerie, seulement la
frontale et les éclairs —, une marche, la couchette en V et un sac de couchage défait ; et, au
pied de la marche, là où tombe le regard par la porte de 70 cm, **un ciré jaune en tas**, ses bandes
réfléchissantes qui renvoient la frontale dans le noir. Le ciré de l'ancien propriétaire ? Rien ne
le dit.

**L'inexpliqué de l'ancien jeu, mis au 14 m** (`quart/peur.js`) : plus de carré ni de barre (les
lieux sont la timonerie et le pont), plus de silence de Jos (la VHF grésille toute la nuit). Les
pas sont sur le toit de la timonerie — ou, la porte de la cabine avant ouverte, dans la cabine
avant, et ils viennent de là ; les trois coups de 5 h (`quart/nuit.js`, l'étrange) viennent de
derrière la porte basse (« Trois coups, derrière la porte de la cabine avant ») ; quelqu'un à
l'avant ne se voit plus que de la timonerie, par le pare-brise (du cockpit, la timonerie cache
l'avant) ; la forme pâle dans l'eau se voit aussi debout contre une vitre de côté, ses volets
ouverts ; les échos du radar, seulement à la console. L'étrange de `nuit.js` attend, lui aussi,
qu'une vague scélérate ou la trombe soient passées.

**Ce qui a changé en route** :
- **la seconde vague scélérate frappait entre 5 h 52 et 5 h 58 — ou jamais** (sur une nuit
  d'essai, elle arrivait après six heures, quand la nuit était finie) : elle attendait que la
  trombe ait disparu, et la trombe vivait jusqu'à 5 h 05. La trombe vit maintenant 170 s au lieu de
  200 (elle passe toujours vers 4 h 15, puis s'efface vers 4 h 50), et la scélérate naît vers 5 h :
  elle frappe entre 5 h 36 et 5 h 45 sur les quatre nuits d'essai, au plus fort ;
- la forme dans l'eau ne venait jamais plus en arrière que z = 3,2 m (l'arrière de l'ancien
  bateau) : vue du cockpit, elle était devant soi, au lieu d'un peu en arrière ; elle suit
  maintenant le 14 m, jusqu'au tableau arrière ;
- l'annonce « Minuit » s'affichait quand on commençait directement à une autre heure
  (`jeu.html?heure=28.4`).

**Mesuré** (`npm run test-peur`, 29 vérifications : trois nuits avec un marin simulé, au poste,
debout, dehors ; `npm run test-nuit`) : la porte de la cabine avant s'entrouvre 6 fois en trois
nuits, toujours hors de sa vue ; elle ne se rouvre pas tant qu'on ne l'a pas refermée ; la forme
dans l'eau se voit debout contre la vitre, pas derrière ses volets ni assis au poste ; le livre a
une page par heure, lisible seulement une fois l'heure venue, la dernière inachevée. Les nuits des
veilleurs, la seconde scélérate frappant enfin : l'attentif voit toujours l'aube 4 fois sur 4,
sans noir ni vitre brisée ; le distrait coule entre 4 h 35 et 5 h 25, l'absent entre 3 h 12 et
3 h 58. Les essais de marche : 22 sur 22 (la porte de la cabine avant, le livre).

**Limites** : on ne descend pas dans la cabine avant, on ne fait qu'y regarder ; assis au poste, on
ne voit pas la porte (c'est voulu : il faut se lever) ; le livre dit la même nuit à chaque partie ;
les sons de la porte, des coups et des pas sont encore ceux qu'on calcule (l'étape 6 les
reprendra) ; quelqu'un à l'avant et la forme dans l'eau sont plus rares qu'avant (on vit au poste,
et il faut regarder dans la bonne direction, au bon moment).

**À voir** : `docs/inexplique-*.jpg` (le livre de bord ouvert sur sa dernière nuit ; la cabine avant,
porte ouverte, à la frontale).

### Étape 6 : le son ✅ (10 octobre 2026)

**Chaque son vient de sa place** (`son/audio.js`). L'oreille suit les yeux, à chaque image, dans
le repère du bateau (`ecouter` : tourner la tête change les côtés), et le jeu dit où sont les
choses à bord (`fixerLieux`) : le moteur sous le plancher, à l'arrière ; la cale et sa trappe ; la
pompe à main ; la console ; le haut-parleur de la VHF, au plafond ; le safran (le pilote qui
force) ; les moteurs des volets ; les dalots ; l'étrave ; le foc. Chaque bruit du bord y sonne (le
diesel, l'eau de la cale, la pompe électrique, les bips de la console, le démarreur, les volets
qui descendent), chaque craquement quelque part dans la timonerie. Et ce qui arrive vient de là
où il arrive : le grondement d'une déferlante, de son côté, d'où part sa crête, et qui glisse
jusqu'où elle frappe ; le tonnerre, de son éclair ; la trombe et la vague scélérate, suivies à
chaque image ; une vitre qui se fend, de sa vitre ; les trois coups et la porte, de derrière la
porte basse ; les pas, d'un bord à l'autre du toit (ou dans la cabine avant, sa porte ouverte) ;
le gémissement de la mer, de 300 m au loin ; la quille qui racle, sous soi. Sans casque, c'est un
panoramique franc (gauche, droite), qui s'entend aussi sur des haut-parleurs — dans les graves, la
vraie 3D ne sépare presque pas les deux oreilles (3 dB à 300 Hz). Avec un casque, **une nouvelle
option** (« Je joue avec un casque ») met le son en trois dimensions (HRTF) : devant, derrière,
au-dessus.

**Plus silencieux**. Dans la timonerie, le dehors passe à travers les vitres 3 dB plus bas (la
porte ouverte aussi) ; la tempête enfle toute la nuit (le vent fort monte jusqu'à 44 nœuds, au lieu
d'être déjà à fond à 34) : au poste, minuit −28,7 LUFS, 3 h −26,8, 5 h −25,2 (avant : −26,2,
−24,6 et −23,1) — le calme de minuit inquiète, la tempête de 5 h écrase. La coque qui travaille
craque 6 dB plus bas, et fait maintenant partie du fond.

**De longs creux avant les coups**. Le fond du monde (le dehors, la pluie et le vent de la
timonerie, le hurlement des ouvertures, le pilote, la coque qui craque) peut se retirer ; les
signes (le grondement des vagues, le tonnerre, la trombe, la scélérate), les sons du bord et ceux
de la tête (le sifflement d'angoisse, le cœur) ne s'en vont pas avec lui.
- le vent respire tout seul (`respirer`) : un creux de 4 à 11 s où la tempête se retire de moitié,
  toutes les 30 à 75 s à minuit, de plus en plus espacés (jusqu'à deux minutes vers 6 h) ;
- avant l'étrange, un long creux (`etouffer`) : 5,2 s de silence (−15 dB) avant les trois coups,
  qui frappent 2,6 s après qu'il a commencé ; 5 s pour la porte basse qui s'entrouvre (jusqu'à son
  second grincement) ; 7,8 s pour les pas (jusqu'au dernier, après leur silence) ; 4,6 s avant le
  grand coup sous la coque (au lieu de 1,9 s) ;
- **devant les plus grosses déferlantes** (force 0,85 et plus), dès qu'on les entend, le fond se
  retire de 8 dB jusqu'au choc (`grondementEntendu`) : on n'entend plus qu'elle, qui gronde de son
  côté — et le monde revient avec le fracas. Son grondement naît d'un coup, en une demi-seconde, au
  lieu de monter du silence.

**De vrais enregistrements pour l'étrange** (avec ton accord, trois fichiers de BigSoundBank, CC0 :
« Creaking Door #2 » de Joseph Sardin et Axeline T., « Door » et « Steps on a Wooden Floor #1 » de
Joseph Sardin — 1,7 Mo, dans `sons-bruts/`) : la porte basse grince en deux fois, ralentie (elle
s'arrête, puis s'ouvre encore un peu) ; les coups sont cinq vrais coups sur une porte légère, un
différent à chaque fois, un peu ralentis ; les pas, dix vrais pas sur un plancher, étouffés par le
plafond (on n'entend que le talon qui cogne). Comme je ne peux pas les écouter, je les ai
découpés à la mesure : le volume, centième par centième, montre où chaque coup et chaque pas
frappe. La recette (`scripts/sons/recette.mjs`) a ses trois sons de plus, et `npm run sons -- pas`
ne refait plus que ceux qu'on nomme (sans rien retélécharger).

**L'atelier du son, refait** (`atelier-son.html`) : les sept situations de la nuit (minuit, 3 h et
5 h au poste ; 5 h moteur en marche, porte ouverte, volets fermés ; 4 h 30 dans le cockpit), neuf
curseurs (dont l'heure, le moteur, la porte et les volets), des événements à déclencher (les
vagues de chaque côté et par l'arrière, le tonnerre, un creux du vent, la voix sur le 16, les
coups, la porte, les pas, le cœur), le mélange en direct, et **la mesure** : le volume ressenti de
chaque situation (calculé sans le jouer, en LUFS, contre sa cible) et neuf signes.

**Ce qui a changé en route** :
- le grondement des déferlantes s'arrêtait au bout de 4 s (son bruit ne bouclait pas) : les plus
  grosses, annoncées 5 à 6 s avant, arrivaient en silence ;
- il naissait 20 dB sous son plus fort : dans sa première seconde, il restait 8 dB sous le bruit
  de la tempête — on ne l'entendait qu'à la fin ;
- le moteur en marche, le grondement était couvert deux fois (on ne l'entend que dans son dernier
  tiers, et le moteur l'étouffait encore de 8 dB) : on ne l'entendait jamais. Le moteur ne le
  couvre plus que de 3 dB ;
- les craquements de la coque ne se taisaient pas dans les creux, et sonnaient aussi fort que
  toute la tempête — même dans le silence avant les coups (il ne baissait que de 2 dB) ;
- l'atelier du son s'affichait sans sa mise en forme depuis l'étape 1 (sa feuille de style de base
  était partie avec l'atelier de la tempête) ;
- mesurer « de combien le grondement dépasse le bruit de la tempête » ne voulait plus rien dire,
  puisque la tempête se retire devant lui : l'atelier calcule maintenant le grondement seul, et
  tout le reste sans lui ; et cette mesure variait de 5,5 à 7,6 dB, selon les craquements tombés
  dans la seconde mesurée : le grondement naît maintenant un peu plus fort (+1,6 dB) ;
- la moitié des pas, découpés d'après une première mesure, commençaient juste après le talon (on
  l'aurait coupé) : recalés sur l'impact ; et les vrais pas traînaient (la semelle frotte après le
  talon) au point de se coller les uns aux autres : chacun est coupé à 0,45 s.

**Mesuré** (l'atelier du son, « Mesurer les situations et les signes » ; trois mesures de suite,
à un demi-décibel près) : les sept situations dans leur cible (au poste : minuit −28,5 LUFS, 3 h
−26,8, 5 h −25,7, le moteur en marche −24,6, la porte ouverte −20,8, les volets fermés −27,0 ; le
cockpit −16,4) ; une grosse déferlante de tribord sort de tout le reste de 8,4 dB dès sa première
seconde ; le moteur en marche, on n'en entend rien avant son dernier tiers, puis elle gronde 2,1 dB
sous le reste ; on l'entend 12,2 dB plus à droite qu'à gauche, et 12,4 dB plus à gauche la tête
tournée vers l'arrière ; avant les trois coups, le monde baisse de 14,1 dB, et les coups sortent de
ce silence de 17,8 dB ; les pas sur le toit, de 9,1 dB ; le grincement de la porte, de 8,2 dB (et
les deux viennent de la gauche, où est la porte basse : 7 dB de plus à gauche). Dans le jeu : les
trois enregistrements se chargent et se jouent, le creux suit la vague jusqu'au choc, l'option
casque passe tous les sons placés en 3D, et se garde. Les 13 tests et les essais de marche (22 sur
22) passent.

**Limites** : le diesel, les vitres qui se brisent et les moteurs des volets sont encore des sons
calculés ; sans l'option casque, un son de droite n'est que dans l'oreille droite (franc, mais peu
naturel au casque) ; les mesures se font dans l'atelier, dans le navigateur (on ne peut pas calculer le son
dans Node), pas dans un test `npm` ; et je ne peux rien écouter moi-même : tout est mesuré, rien
n'est entendu — c'est à ton oreille de juger.

**À voir** : `docs/son-l-atelier-mesure-la-nuit.jpg` (la mesure de l'atelier : les sept
situations dans leur cible, et les neuf signes).

### Étape 7 : les nuages ✅ (10 octobre 2026)

Ce que tu disais au virage : les nuages « pas très bien intégrés, avec beaucoup de glitchs », et
« les nuages sombres qui arrivent et que l'on voit au loin », pas très esthétiques. Dans la
nouvelle nuit, on ne voit les nuages qu'à la lueur des éclairs, puis à l'aube (de 5 h 20 au lever,
avec l'accéléré de 6 h à 6 h 48) : c'est là que je les ai photographiés et mesurés — dans le jeu, et
dans l'atelier de la mer avec la météo exacte de la nuit, les nuages figés (leur dérive et leur
horloge remises à zéro) pour comparer avant et après sur la même image.

**Ce qui n'allait pas** :
- les nuages étaient des taches floues, comme de la fumée : leur densité montait sur 300 m environ
  au bord (un vrai cumulus devient opaque en quelques dizaines de mètres), et la marche avançait à
  pas égaux de 250 à 450 m — le bord d'un nuage tombait entre deux pas. Ni l'image réduite ni le
  lissage d'une image à l'autre n'y étaient pour rien (mesuré : en pleine résolution, sans lissage,
  aussi flou) ;
- les nuages lointains étaient des briques : de petits rectangles plats, traversés à grands pas ;
- l'enclume du front faisait une bande rouge tirée à la règle à travers le ciel, et ses tours une
  île noire posée sur l'horizon : sa « brume » l'assombrissait au lieu de l'éclaircir ;
- **le front faisait le tour de l'horizon** : la nuit, il est sur nous, orienté au sud-sud-ouest ;
  à 6 h, au nord-nord-est. Entre 5 h 51 et 6 h, sa direction tournait de 176° par l'ouest, pendant
  qu'il réapparaissait ;
- avant le lever, les nuages étaient d'un violet uniforme, sans relief.

**La nouvelle marche** (`rendu/glsl/nuages.js`, `nuagesVolume`) : à grands pas dans l'air libre, en
ne regardant que la forme des nuages (pas cher), et plus grands encore hors de toute zone nuageuse ;
dès qu'on touche un nuage, on revient un peu en arrière et on le traverse à petits pas (15 m pour un
nuage proche, 200 m au plus au loin), avec son détail et sa lumière ; son bord passé, chaque pas en
traverse à peu près autant (le cœur d'un plafond d'orage n'a pas besoin de cent pas pour être
opaque) ; ressorti, on reprend les grands pas ; on s'arrête au haut utile de la couche (par beau
temps, les nuages n'en occupent que le bas). Les nuages sont trois fois plus denses (un cumulus
opaque en quelques dizaines de mètres : son bord est net), leur base franche ; le bruit 3D qui les
forme est en demi-flottants. La qualité règle le nombre de pas : 28, 36, 48 et 60, de l'économique
au superbe. **La nuit noire, sans éclair**, on ne voit pas les nuages : seule compte leur opacité,
qui cache les étoiles — la marche les traverse alors à grands pas, et reprend les petits dès qu'un
éclair part.

**La lumière et l'air** : avant le lever, **la lueur de l'aube** — celle de l'horizon, du côté du
soleil encore caché — éclaire les nuages : leur flanc tourné vers elle s'éclaire, leurs bords minces
s'allument à contre-jour ; elle passe la main au soleil quand il les atteint. Et **la brume** du jeu
(`visibilite`, `monde/meteo.js` : à cette distance, il reste 5 % de la lumière) voile maintenant les
nuages lointains : l'horizon est un dégradé propre, les nuages proches restent nets.

**Le front** (`rendu/glsl/front.js`) : la même brume, celle des basses couches (1,5 km), cache son
pied ; ses sommets, à 11 km, la dépassent. À 60 km, dans 35 km de visibilité, ce n'est plus qu'une
silhouette pâle, couleur du ciel, ses sommets au-dessus de la brume. Un orage qui se défait ne garde
de son enclume qu'un voile (`enclumeFront`, 35 % à l'aube), et son dessous ne rougeoie plus d'un
bout à l'autre. Passé au-dessus de nous (vers 4 h 40), il part vers le nord-nord-est
(`directionFront`, `quart/nuit.js`) : il réapparaît là, sans tourner.

**Mesuré** :
- le coût du ciel sur la carte graphique (Apple M4 Pro, qualité haute, 1920 × 1200) : la nuit
  d'orage, 5 à 6,3 ms au lieu de 7,5 ; l'aube, 6,6 à 9 ms au lieu de 5 à 7 (le soleil et la lueur
  éclairent chaque pas dans un nuage). La nuit fait l'essentiel des douze minutes : en moyenne, le
  ciel coûte moins qu'avant ;
- les pas, comptés pixel par pixel : à l'aube, la nouvelle marche fait moins de tours que l'ancienne
  (14 à 22 contre 17 à 33), mais calcule la lumière 1,6 fois plus souvent ; à 36 pas, 13 à 18 % des
  pixels touchaient le plafond (des nuages rongés) : 48 en haute ;
- `npm run test-heures`, trois vérifications de plus : on ne voit le front qu'à partir de 5 h 52, il
  reste à moins de 0,1° de 28° tant qu'on le voit (à 158° sans la correction), son enclume à 35 % ;
- les 13 tests et la construction passent ; les six ambiances de l'atelier de la mer et la trombe
  sous l'éclair, regardées : rien de cassé.

**Limites** : un nuage vu juste au-dessus de soi reste un peu mou (son dessous est éclairé
uniformément) ; l'aube coûte 1 à 2,5 ms de plus qu'avant ; en qualité économique, les petits nuages
lointains perdent un peu de détail ; je n'ai pu regarder que sur cet ordinateur — sur un plus
modeste, à toi de me dire.

**À voir** : `docs/nuages-l-aube-avant-apres.jpg` (6 h 18, vers le front et vers le lever, avant et
après) et `docs/nuages-l-eclair-et-le-lever.jpg` (un éclair à minuit, avant et après ; le dessus à
6 h 18 avant, le lever de 6 h 42 après).

### Étape 8 : finitions et mise en ligne ✅ (10 octobre 2026)

**Relu, en jouant** : tout ce que voit le joueur — l'accueil du site et celui du jeu, l'aide, la
pause, le livre de bord, les messages de la nuit, les écrans de fin (un naufrage, puis la reprise de
l'heure) et celui de l'aube avec son bilan, les options, l'« À propos ».

**Corrigé** :
- la pause disait « La nuit ne s'arrête pas pendant la pause » (et le README « la nuit continue ») :
  c'était faux — mesuré, pendant huit secondes de pause, l'heure, la batterie et l'eau de la cale ne
  bougent pas. Elle dit maintenant « La nuit t'attend : pendant la pause, rien n'arrive à bord » ;
- les restes du carnet (l'aide « carnet de bord », le bouton de la pause) : c'est le livre de bord
  depuis l'étape 5 ;
- l'« À propos » : 352 morceaux de coque (et non 346, ceux de l'ancien bateau), l'atelier des grains
  dans les coulisses ;
- les textes de l'accueil (du site et du jeu) et des fins mis au jeu d'aujourd'hui (la batterie,
  les volets, le moteur ; le naufrage rappelle les volets — une vitre brisée laisse entrer la mer — ;
  le chavirage, qu'on réarme le pilote une fois froid) ;
- les options de l'ancien jeu (la voix de Jos, la barre assistée, la difficulté) retirées : plus
  rien ne s'en servait ;
- **l'eau du cockpit**, presque transparente vue de près (étape 4) : sous 21 cm d'eau, on voyait les
  lattes du plancher comme sous une vitre teintée. C'est maintenant de la mer trouble, vert-de-gris,
  qui écume et renvoie la frontale (opaque à 20 cm ; à 7 cm, on devine encore le plancher) ;
- une icône d'onglet (un voilier) sur toutes les pages, et un aperçu pour les partages (le titre, une
  phrase, et une image de la tempête vue de la timonerie : `public/apercu.jpg`).

**Vérifié** : la version construite, servie comme elle le sera en ligne — l'accueil, le jeu (la nuit
démarre, les 24 sons se chargent, aucune erreur), les cinq ateliers ; les 13 tests ; les essais de
marche (22 sur 22). Les parties gardées de l'ancien jeu ne gênent pas : la nuit seule garde les
siennes sous une autre clé, avec un numéro de version, et vérifie les options une à une.

**Mis en ligne** : la branche `la-nuit-seule` a rejoint `main`, et GitHub Pages publie à chaque envoi
sur `main` : https://patapain18.github.io/quart-de-nuit/ — la nuit seule remplace l'ancien jeu, qui
reste dans git (étiquette `v1-journee-et-nuit`).

## 4. Le moteur (ce qu'on garde de l'ancien jeu)

Tout ce qui fait l'image, le son et la physique reste, et sert la nouvelle nuit. Le détail de
chacun, étape par étape, est dans l'ancien cahier (étiquette `v1-journee-et-nuit`).
- **La mer** : 5 grilles de vagues calculées par FFT (Tessendorf), la même pour l'image et pour
  faire flotter le bateau, dans un worker (`src/mer/`, `src/rendu/eau.js`) ; les déferlantes, les
  vagues scélérates de 20 m (`src/monde/scelerates.js`, `src/mer/scelerate.js`), le sillage, le
  plancton qui s'allume.
- **Le ciel** : l'atmosphère, les nuages en volume (traversés à pas variables depuis l'étape 7), le
  front orageux (`src/rendu/ciel.js`) ;
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
- **Le son** (`src/son/audio.js`) : de vrais enregistrements du domaine public, mélangés en direct ;
  chaque son vient de sa place (depuis l'étape 6).
- **Les feux de la côte** (`src/monde/feux.js`, `src/rendu/feux.js`) : au loin, au nord, le phare
  et ses faisceaux qu'on perd dans les grains.
