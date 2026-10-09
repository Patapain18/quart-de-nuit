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

Tu es dans la timonerie. Dehors, la nuit noire : tu ne vois la mer qu'à ta frontale et dans les
éclairs. Les instruments sont tes caméras : le radar (ce qui arrive), le baromètre (le pire qui
approche), le sondeur (ce qu'il y a dessous…), et bientôt les jauges de la cale et de la
batterie. Les menaces arrivent, chacune avec ses signes et sa parade :

| La menace | Ses signes | La parade |
|---|---|---|
| L'eau qui monte (les fuites s'aggravent d'heure en heure, chaque vague en apporte) | l'alarme de cale, l'eau sur le plancher | pomper |
| Le pilote qui lâche (de plus en plus souvent) | son alarme, le bateau qui se met en travers | réarmer son disjoncteur au tableau |
| Les déferlantes | leur grondement, de leur côté ; l'éclair qui les montre | fermer la porte ; se tenir (Maj) dehors |
| Le foc qui bat (son écoute casse) | son claquement, le bateau qui part | sortir le rouler, harnais accroché |
| La trombe, vers 3 h 30 | l'écho au radar, et rien d'autre : on ne la voit qu'à la lueur des éclairs | tenir |
| Deux vagues scélérates (2 h 30, 5 h 20) | un grondement énorme, une minute avant ; un éclair montre le mur | tenir |
| La foudre | les éclairs, le tonnerre de plus en plus proche, le feu de Saint-Elme | réarmer ce qui a sauté |
| L'inexpliqué | un écho qui suit, des pas sur le pont, une voix sur le 16, des coups sous la coque… | rien : ce n'est jamais confirmé |

À venir (étape 3) : **la batterie**, comme le courant de FNAF — la pompe électrique, le radar,
le projecteur, le pilote la vident ; le moteur la recharge mais couvre tous les bruits ; quand
elle meurt, tout s'éteint — et **les volets des vitres**, comme les portes de FNAF : on les ferme
quand une vague arrive de ce côté, sinon la vitre éclate ; mais volet fermé, on ne voit plus
rien de ce côté.

### Les heures

| | Le vent | Ce qui arrive |
|---|---|---|
| minuit | 32 nœuds, la mer déjà grosse | on prend ses marques |
| 1 h | 35 | un premier grain passe ; le pilote lâche une première fois |
| 2 h | 38 | une voix sur le 16 ; la première vague scélérate (vers 2 h 30) ; l'écoute du foc casse |
| 3 h | 41 | la trombe, vers 3 h 30, dans le noir |
| 4 h | 43 | le front passe vers 4 h 30 : le vent tourne de 25°, la mer croise |
| 5 h | 46 | le plus fort : le grain le plus violent, la seconde vague scélérate, des coups sous la coque |
| 6 h | il tombe enfin | la première lueur : la nuit est finie |

La nuit est gardée au début de chaque heure : après un naufrage, on reprend à cette heure-là
(ou à minuit).

### Les commandes

Au clavier (français) et à la souris. La souris tourne la tête.
- **Assis au poste** (au début de la nuit) : E agit sur ce que tu regardes et qui est à portée
  de main (le radar, le traceur, la VHF, le tableau électrique) ; Espace pour se lever.
- **À pied** : Z Q S D pour marcher, E pour agir (Maj + E : l'action inverse), Maj pour se
  tenir, C pour s'accroupir, X le harnais (dehors).
- **Partout** : F la lampe frontale, L le carnet de bord, H pour cacher l'aide, Échap la pause.

## 3. Feuille de route

Une étape = un résultat visible ; je travaille sur la branche `la-nuit-seule`, et le jeu en
ligne reste l'ancien tant que le nouveau n'est pas jouable.

1. ✅ **La nuit seule** — le jeu commence directement à minuit ; plus de journée, de Jos, de
   barre ni de navigation ; le pilote tient le cap ; six heures de deux minutes, de plus en plus
   dures ; plus de rideaux de pluie.
2. **Le bateau de 14 m** — plus grand, sans carré, une grande timonerie vitrée : les volets des
   vitres, la porte, la console, le tableau, la pompe à main, une trappe vers la cale.
3. **Les systèmes du bord** — la batterie et ce qui la vide, le moteur qui la recharge mais couvre
   les bruits, l'eau qui monte et les deux pompes, le pilote qui chauffe et disjoncte, les volets
   et les vitres qui éclatent ; les veilleurs automatiques pour régler la difficulté.
4. **Les heures** — chaque heure plus dure, chaque menace annoncée par ses signes (le grondement
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
- **Le voilier** (`src/bateau/`) et **sa physique** (`src/physique/voilier.js`) ; le marin qui
  marche à bord (`src/joueur/`), les gestes (E), le radar, le traceur, le tableau électrique.
- **La peur** (`src/quart/peur.js`, `src/rendu/apparitions.js`) : ce qu'on voit du coin de l'œil
  et qui disparaît quand on le regarde.
- **Le son** (`src/son/audio.js`) : de vrais enregistrements du domaine public, mélangés en direct.
- **Les feux de la côte** (`src/monde/feux.js`, `src/rendu/feux.js`) : au loin, au nord, le phare
  et ses faisceaux qu'on perd dans les grains.
