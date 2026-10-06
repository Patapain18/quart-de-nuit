// Les leçons de la journée, données par Jos, le vieux marin du sémaphore de Kervalen.
//
// Chaque leçon a son heure (le soleil avance avec elle), un « réflexe » à retenir pour
// la nuit, et des étapes. Une étape, c'est :
//  - dire : ce que Jos dit à la radio en la commençant ;
//  - objectif : ce qui s'affiche à l'écran ;
//  - verifier(ctx, memo, journee) : vrai quand c'est réussi (memo : la mémoire de
//    l'étape, par exemple depuis combien de temps on tient le bon réglage) ;
//  - progression : où l'on en est (0 → 1), pour la petite barre de l'écran ;
//  - conseils : ce que Jos dit quand il voit qu'on peine (si : la condition, apres : depuis
//    combien de secondes elle dure, repos : le temps avant de le redire) ;
//  - bravo : ce qu'il dit quand c'est réussi.
// ctx : ce que l'on sait du bateau à cet instant (voir journee.js).
import { etatReglage } from '../physique/regleur.js';

// ---------- Petits outils ----------
const angleVent = (ctx) => Math.abs(ctx.m.angleVentReel); // 0 : face au vent, 180 : vent arrière
const ecartCap = (cap, depart) => ((cap - depart + 540) % 360) - 180; // + : vers la droite
// Une condition à tenir un certain temps (elle repart de zéro si elle cesse)
function tenir(memo, cle, condition, duree, dt) {
  memo[cle] = condition ? (memo[cle] ?? 0) + dt : 0;
  return memo[cle] >= duree;
}
// Un temps qui s'additionne (sans repartir de zéro)
function cumuler(memo, cle, condition, duree, dt) {
  if (condition) memo[cle] = (memo[cle] ?? 0) + dt;
  return (memo[cle] ?? 0) >= duree;
}
const gv = (ctx) => etatReglage(ctx.m.incidenceGV);
const foc = (ctx) => etatReglage(ctx.m.incidenceFoc);
// depuis combien de temps l'étape dure
const depuis = (memo, secondes) => (memo.age ?? 0) > secondes;

// Les conseils qui reviennent souvent
const VENT_DEBOUT = {
  si: (ctx) => angleVent(ctx) < 32 && ctx.m.vitesse < 1.2,
  apres: 6,
  dire: 'Tu es « vent debout » : bloqué face au vent. Garde la barre d\'un côté : le bateau va reculer un peu, abattre, puis repartir.',
};
const GV_FASEYE = {
  si: (ctx) => gv(ctx) === 'faseye',
  apres: 4,
  dire: 'Ta grand-voile faseye, elle claque : borde-la, touche Z.',
};
const GV_TROP_BORDEE = {
  si: (ctx) => gv(ctx) === 'trop-bordee',
  apres: 5,
  dire: 'Ta grand-voile est trop bordée, elle freine : choque un peu, touche S.',
};
const PILOTE_POUR_SE_LEVER = {
  si: (ctx, memo) => ctx.mode === 'barre' && depuis(memo, 25),
  apres: 1,
  repos: 40,
  dire: 'Mets le pilote automatique, touche P, puis lève-toi : Espace.',
};

export const LECONS = [
  // ---------------------------------------------------------------------------------
  {
    id: 'barrer',
    titre: 'Barrer',
    heure: [9, 10],
    duree: 150,
    reflexe: 'La barre se pousse du côté opposé à celui où l\'on veut aller.',
    etapes: [
      {
        id: 'barrer.appel',
        canal: 16,
        dire: ['Voilier Morgane, Voilier Morgane, ici Jos, au sémaphore de Kervalen.', 'On dégage le seize : je passe sur le soixante-douze.'],
        verifier: () => true,
      },
      {
        id: 'barrer.pilote',
        dire: [
          'Me revoilà. Je te vois à la jumelle, au large de la pointe du Bec. Belle journée pour apprendre : le vent est tout doux.',
          'Pour l\'instant, c\'est le pilote automatique qui barre. Débraye-le : touche P.',
        ],
        objectif: 'Débraye le pilote automatique (P)',
        verifier: (ctx) => !ctx.pilote,
        bravo: 'Voilà. Le bateau est à toi.',
      },
      {
        id: 'barrer.droite',
        dire: [
          'Tu tiens la barre franche, le grand manche en bois. Elle marche à l\'envers : pour que le bateau tourne à droite, on la pousse à gauche.',
          'Au clavier, D fait tourner à droite, Q à gauche. Regarde bien la barre bouger.',
          'Essaie : tourne à droite, d\'une trentaine de degrés. Le cap, sur ton afficheur, va augmenter.',
        ],
        objectif: 'Tourne à droite de 30° (D)',
        debut: (ctx, memo) => { memo.cap = ctx.m.cap; },
        verifier: (ctx, memo) => ecartCap(ctx.m.cap, memo.cap) >= 30,
        progression: (ctx, memo) => ecartCap(ctx.m.cap, memo.cap) / 30,
        conseils: [{ si: (ctx, memo) => ecartCap(ctx.m.cap, memo.cap) < -12, apres: 1, dire: 'Non, là tu tournes à gauche ! Pour aller à droite, c\'est D.' }],
        bravo: 'C\'est ça. Tu as vu la barre partir à gauche ?',
      },
      {
        id: 'barrer.gauche',
        dire: ['Maintenant à gauche, une trentaine de degrés aussi.'],
        objectif: 'Tourne à gauche de 30° (Q)',
        debut: (ctx, memo) => { memo.cap = ctx.m.cap; },
        verifier: (ctx, memo) => ecartCap(ctx.m.cap, memo.cap) <= -30,
        progression: (ctx, memo) => -ecartCap(ctx.m.cap, memo.cap) / 30,
        conseils: [{ si: (ctx, memo) => ecartCap(ctx.m.cap, memo.cap) > 12, apres: 1, dire: 'Ça, c\'est la droite. À gauche, c\'est Q.' }],
        bravo: 'Bien. Tu as la main.',
      },
      {
        id: 'barrer.bouee',
        dire: [
          'Tu vois la bouée jaune, là-bas ? C\'est la bouée de la Basse Plate.',
          'Mets le cap dessus et va la frôler. Doucement sur la barre : un petit coup, et on attend que le bateau réponde.',
        ],
        objectif: 'Rejoins la bouée jaune',
        debut: (ctx, memo, j) => {
          j.placerBouee('jaune', ctx, { cap: j.capPourAngleVent(ctx, 70), distance: 230 });
          memo.d0 = j.distanceBouee('jaune', ctx);
        },
        cible: { id: 'jaune', action: 'approcher' },
        verifier: (ctx, memo, j) => j.distanceBouee('jaune', ctx) < 28,
        progression: (ctx, memo, j) => 1 - (j.distanceBouee('jaune', ctx) - 28) / (memo.d0 - 28),
        conseils: [
          { si: (ctx) => angleVent(ctx) < 38 && ctx.m.vitesse < 2.5, apres: 4, dire: 'Tu es trop face au vent, le bateau s\'arrête. Écarte-toi du vent : la bouée ne va pas s\'envoler.' },
          {
            si: (ctx, memo, j) => Math.abs(j.relevementRelatif('jaune', ctx)) > 50,
            apres: 8,
            dire: (ctx, memo, j) => (j.relevementRelatif('jaune', ctx) > 0
              ? 'La bouée est sur ta droite : tourne à droite, D.'
              : 'La bouée est sur ta gauche : tourne à gauche, Q.'),
          },
        ],
        bravo: 'Pile dessus ! Tu sais barrer.',
      },
    ],
  },

  // ---------------------------------------------------------------------------------
  {
    id: 'vent',
    titre: 'Lire le vent',
    heure: [10, 11],
    duree: 130,
    reflexe: 'Face au vent (moins de 45° de chaque côté), un voilier n\'avance pas : c\'est la zone interdite.',
    etapes: [
      {
        id: 'vent.face',
        dire: [
          'Pour naviguer, il faut toujours savoir d\'où vient le vent.',
          'Lève les yeux : la girouette, tout en haut du mât, pointe vers le vent. Sur ton afficheur, regarde « venant de ». Et les vagues arrivent de là aussi.',
          'Un voilier ne peut pas aller contre le vent. Essaie, tu vas comprendre : mets le nez face au vent.',
        ],
        objectif: 'Mets-toi face au vent',
        verifier: (ctx, memo) => tenir(memo, 'face', angleVent(ctx) < 24, 2, ctx.dt),
        progression: (ctx) => 1 - (angleVent(ctx) - 24) / 80,
        conseils: [{ si: (ctx, memo) => depuis(memo, 30) && angleVent(ctx) > 50, apres: 2, dire: 'Le vent vient du côté où pointe la girouette. Tourne vers lui, franchement.' }],
        bravo: 'Tu entends les voiles claquer ? Le bateau s\'arrête.',
      },
      {
        id: 'vent.travers',
        dire: [
          'Face au vent, c\'est la zone interdite : à peu près quarante-cinq degrés de chaque côté. Là, les voiles ne portent plus.',
          'Ressors de là : mets-toi vent de travers, avec le vent qui arrive bien sur le côté.',
        ],
        objectif: 'Vent de travers (le vent à 90°)',
        verifier: (ctx, memo) => tenir(memo, 'travers', angleVent(ctx) > 72 && angleVent(ctx) < 108 && ctx.m.vitesse > 2.5, 5, ctx.dt),
        progression: (ctx, memo) => (memo.travers ?? 0) / 5,
        conseils: [VENT_DEBOUT],
        bravo: 'Le travers : l\'allure la plus facile, et une des plus rapides.',
      },
      {
        id: 'vent.largue',
        dire: [
          'Écarte-toi encore du vent : c\'est le grand largue, avec le vent qui vient de derrière, en biais.',
          'Pas jusqu\'au vent arrière : la bôme pourrait changer de côté d\'un coup. On verra ça cet après-midi.',
        ],
        objectif: 'Grand largue (le vent à 130–150°)',
        verifier: (ctx, memo) => tenir(memo, 'largue', angleVent(ctx) > 125 && angleVent(ctx) < 155, 5, ctx.dt),
        progression: (ctx, memo) => (memo.largue ?? 0) / 5,
        conseils: [{ si: (ctx) => angleVent(ctx) > 163, apres: 1, repos: 12, dire: 'Pas trop ! Remonte un peu vers le vent, sinon la bôme va passer de l\'autre côté.' }],
        bravo: 'Près, travers, largue : ce sont les allures. Retiens-les bien.',
      },
    ],
  },

  // ---------------------------------------------------------------------------------
  {
    id: 'grand-voile',
    titre: 'La grand-voile',
    heure: [11, 12.25],
    duree: 170,
    reflexe: 'Je choque jusqu\'à ce que la voile faseye, puis je borde juste assez pour que ça cesse.',
    avant: (j) => j.debloquer('regleur', 'grandVoile'),
    etapes: [
      {
        id: 'gv.auto',
        dire: [
          'Jusqu\'ici, le réglage automatique s\'occupait de ta grand-voile. Coupe-le : touche T. Désormais, c\'est toi qui règles.',
        ],
        objectif: 'Coupe le réglage automatique (T)',
        verifier: (ctx) => !ctx.regleurAuto,
        bravo: 'À toi les écoutes.',
      },
      {
        id: 'gv.faseyer',
        dire: [
          'La touche Z borde la grand-voile : elle tire l\'écoute, la bôme se rapproche du milieu. La touche S la choque : elle laisse filer l\'écoute.',
          'Mets-toi au travers, et choque jusqu\'à ce que la voile faseye : son bord avant se met à claquer.',
        ],
        objectif: 'Au travers, choque (S) jusqu\'au faseyement',
        verifier: (ctx, memo) => tenir(memo, 'faseye', angleVent(ctx) > 65 && angleVent(ctx) < 115 && gv(ctx) === 'faseye', 1.2, ctx.dt),
        conseils: [
          { si: (ctx) => angleVent(ctx) < 65 || angleVent(ctx) > 115, apres: 6, dire: 'Mets-toi d\'abord au travers, le vent bien sur le côté.' },
          { si: (ctx, memo) => depuis(memo, 25) && gv(ctx) !== 'faseye', apres: 3, dire: 'Choque encore, touche S, jusqu\'à entendre la voile claquer.' },
        ],
        bravo: 'Tu l\'entends ? Elle ne pousse plus rien.',
      },
      {
        id: 'gv.border',
        dire: ['Borde doucement, Z, juste assez pour que le claquement cesse. Regarde la jauge en bas de l\'écran : elle doit passer au vert.'],
        objectif: 'Borde juste assez (la jauge au vert)',
        verifier: (ctx, memo) => tenir(memo, 'bon', gv(ctx) === 'bon', 4, ctx.dt),
        progression: (ctx, memo) => (memo.bon ?? 0) / 4,
        conseils: [GV_TROP_BORDEE],
        bravo: 'Voilà le bon réglage.',
      },
      {
        id: 'gv.pres',
        dire: ['Maintenant, remonte au près : rapproche-toi du vent, à cinquante degrés environ. Plus on va vers le vent, plus on borde.'],
        objectif: 'Au près (vent à 45–60°), grand-voile au vert',
        verifier: (ctx, memo) => tenir(memo, 'pres', angleVent(ctx) > 42 && angleVent(ctx) < 65 && gv(ctx) === 'bon', 5, ctx.dt),
        progression: (ctx, memo) => (memo.pres ?? 0) / 5,
        conseils: [VENT_DEBOUT, GV_FASEYE, GV_TROP_BORDEE],
        bravo: 'Bien bordée, au près. Tu sens le bateau gîter un peu ? C\'est normal.',
      },
      {
        id: 'gv.largue',
        dire: ['Et maintenant le largue : écarte-toi du vent, vers cent vingt degrés, et choque ce qu\'il faut.'],
        objectif: 'Au largue (110–140°), grand-voile au vert',
        verifier: (ctx, memo) => tenir(memo, 'largue', angleVent(ctx) > 105 && angleVent(ctx) < 145 && gv(ctx) === 'bon', 5, ctx.dt),
        progression: (ctx, memo) => (memo.largue ?? 0) / 5,
        conseils: [GV_FASEYE, GV_TROP_BORDEE],
        bravo: 'Parfait. La grand-voile n\'a plus de secret pour toi.',
      },
    ],
  },

  // ---------------------------------------------------------------------------------
  {
    id: 'foc',
    titre: 'Le foc et les winchs',
    heure: [12.25, 13.5],
    duree: 210,
    reflexe: 'Le foc se borde au winch sous le vent ; ses penons doivent filer bien droit.',
    avant: (j) => j.debloquer('foc', 'enrouleur'),
    etapes: [
      {
        id: 'foc.derouler',
        dire: [
          'Parlons du foc, la voile de l\'avant. Depuis ce matin, il est à moitié roulé autour de l\'étai, le câble qui tient le mât par devant.',
          'Déroule-le complètement : garde la touche V appuyée.',
        ],
        objectif: 'Déroule complètement le foc (garde V appuyé)',
        verifier: (ctx) => ctx.physique.deroule > 0.95,
        progression: (ctx) => ctx.physique.deroule,
        bravo: 'Le voilà. Ça pousse, hein ?',
      },
      {
        id: 'foc.winch',
        dire: [
          'Le foc a deux écoutes, une de chaque côté. Seule celle qui est sous le vent travaille : celle du côté de la voile. Elle s\'enroule sur un winch, un petit treuil.',
          'Remets le pilote, touche P, lève-toi avec Espace, va au winch sous le vent et borde le foc : regarde le winch et garde E appuyé.',
        ],
        objectif: 'Pilote (P), lève-toi, et borde le foc au winch sous le vent (E)',
        verifier: (ctx, memo) => cumuler(memo, 'winch', ctx.evenements.has('winch-borde'), 1, ctx.dt),
        progression: (ctx, memo) => (memo.winch ?? 0) / 1,
        conseils: [PILOTE_POUR_SE_LEVER],
        bravo: 'C\'est du travail de matelot, ça !',
      },
      {
        id: 'foc.regler',
        dire: [
          'Retourne à la barre : regarde-la et appuie sur E.',
          'Sur le foc, il y a des penons, des brins de laine. Quand il est bien réglé, ils filent droit vers l\'arrière.',
          'À la barre, la touche A borde le foc et la touche E le choque. Monte au près et règle-le : sa jauge doit passer au vert.',
        ],
        objectif: 'À la barre, au près, le foc au vert (A / E)',
        verifier: (ctx, memo) => tenir(memo, 'foc', ctx.mode === 'barre' && angleVent(ctx) > 40 && angleVent(ctx) < 68 && foc(ctx) === 'bon', 5, ctx.dt),
        progression: (ctx, memo) => (memo.foc ?? 0) / 5,
        conseils: [
          { si: (ctx) => ctx.mode === 'barre' && foc(ctx) === 'faseye', apres: 4, dire: 'Ton foc faseye : borde-le, touche A.' },
          { si: (ctx) => ctx.mode === 'barre' && foc(ctx) === 'trop-bordee', apres: 5, dire: 'Ton foc est trop bordé : choque un peu, touche E.' },
          VENT_DEBOUT,
        ],
        bravo: 'Bravo. Tu mènes ton bateau tout seul, les deux voiles en main.',
      },
    ],
    fin: ['Si un jour tu veux souffler, la touche T fait les réglages à ta place. Mais n\'en abuse pas : la nuit, c\'est toi qui sentiras le bateau.'],
  },

  // ---------------------------------------------------------------------------------
  {
    id: 'virer',
    titre: 'Virer de bord',
    heure: [13.5, 14.75],
    duree: 230,
    reflexe: 'Pour virer : de la vitesse d\'abord, puis la barre franche, tenue jusqu\'au bout.',
    etapes: [
      {
        id: 'virer.virements',
        dire: [
          'Tu vois la bouée rouge, là-haut ? Elle est droit dans le vent.',
          'Pour y aller, on tire des bords, en zigzag, et on vire de bord : on fait passer le nez du bateau dans le vent pour changer de côté.',
          'Au près, prends de la vitesse. Puis tourne franchement vers le vent, et garde la barre jusqu\'à ce que les voiles passent de l\'autre côté. Fais-en deux.',
        ],
        objectif: 'Vire de bord (deux fois)',
        debut: (ctx, memo, j) => {
          j.placerBouee('rouge', ctx, { cap: ctx.ventDe, distance: 300 });
          memo.virements = j.compteurs.virements;
        },
        cible: { id: 'rouge', action: 'approcher' },
        verifier: (ctx, memo, j) => j.compteurs.virements - memo.virements >= 2,
        progression: (ctx, memo, j) => (j.compteurs.virements - memo.virements) / 2,
        conseils: [
          VENT_DEBOUT,
          { si: (ctx, memo, j) => depuis(memo, 70) && j.compteurs.virements === memo.virements, apres: 1, repos: 45, dire: 'Prends de la vitesse au près, puis vire franchement : la barre à fond, et tiens-la.' },
        ],
        bravo: 'Deux virements ! Tu vois, les voiles changent de côté toutes seules.',
      },
      {
        id: 'virer.bouee',
        dire: ['Maintenant, remonte jusqu\'à la bouée rouge en tirant tes bords, et fais-en le tour.'],
        objectif: 'Contourne la bouée rouge',
        cible: { id: 'rouge', action: 'contourner' },
        verifier: (ctx, memo, j) => j.contournee('rouge'),
        progression: (ctx, memo, j) => j.avanceeContour('rouge', ctx),
        conseils: [
          VENT_DEBOUT,
          { si: (ctx) => angleVent(ctx) < 38 && ctx.m.vitesse < 3, apres: 6, dire: 'Ne pince pas trop : à moins de quarante degrés du vent, le bateau ralentit. Laisse-le respirer.' },
        ],
        bravo: 'Belle remontée au vent !',
      },
    ],
  },

  // ---------------------------------------------------------------------------------
  {
    id: 'empanner',
    titre: 'Empanner',
    heure: [14.75, 15.75],
    duree: 220,
    reflexe: 'Avant d\'empanner, je borde la grand-voile ; debout, je baisse la tête.',
    etapes: [
      {
        id: 'empanner.empannage',
        dire: [
          'On redescend vers la bouée verte, là-bas, sous le vent.',
          'Vent arrière, pour changer de côté, on empanne : c\'est l\'arrière qui passe dans le vent. La bôme traverse alors le cockpit d\'un coup. C\'est la manœuvre la plus dangereuse à bord.',
          'Pour empanner proprement : borde la grand-voile presque au milieu, Z. Tourne doucement jusqu\'à ce que la bôme passe de l\'autre côté, puis choque aussitôt, S.',
        ],
        objectif: 'Empanne en bordant d\'abord la grand-voile (Z)',
        debut: (ctx, memo, j) => {
          j.placerBouee('verte', ctx, { cap: (ctx.ventDe + 180) % 360, distance: 340 });
          memo.controles = j.compteurs.empannagesControles;
        },
        cible: { id: 'verte', action: 'approcher' },
        verifier: (ctx, memo, j) => j.compteurs.empannagesControles > memo.controles,
        conseils: [
          { si: (ctx) => ctx.regleurAuto, apres: 2, dire: 'Coupe le réglage automatique, touche T : un empannage se fait à la main.' },
          { si: (ctx, memo, j) => j.evenements.has('empannage-sauvage'), apres: 0, repos: 6, dire: 'Empannage sauvage ! La bôme a traversé à toute volée. Recommence, en bordant la grand-voile avant.' },
          { si: (ctx) => angleVent(ctx) > 165 && ctx.physique.ecouteGV > 0.6, apres: 2, repos: 15, dire: 'Attention, tu es plein vent arrière avec la grand-voile choquée : la bôme peut passer d\'un coup. Borde d\'abord !' },
          { si: (ctx, memo) => depuis(memo, 50) && angleVent(ctx) < 140, apres: 4, repos: 40, dire: 'Mets-toi vent arrière, en direction de la bouée verte, puis empanne.' },
        ],
        bravo: 'Empannage maîtrisé : la bôme est passée en douceur.',
      },
      {
        id: 'empanner.bouee',
        dire: ['Va faire le tour de la bouée verte. Si tu dois empanner encore, même méthode : on borde, on passe, on choque.'],
        objectif: 'Contourne la bouée verte',
        cible: { id: 'verte', action: 'contourner' },
        verifier: (ctx, memo, j) => j.contournee('verte'),
        progression: (ctx, memo, j) => j.avanceeContour('verte', ctx),
        conseils: [
          { si: (ctx, memo, j) => j.evenements.has('empannage-sauvage'), apres: 0, repos: 8, dire: 'Encore un empannage sauvage ! Borde avant de passer.' },
          VENT_DEBOUT,
        ],
        bravo: 'Parfait.',
      },
    ],
  },

  // ---------------------------------------------------------------------------------
  {
    id: 'ris',
    titre: 'Prendre un ris',
    heure: [15.75, 16.75],
    duree: 220,
    reflexe: 'Quand ça gîte trop, je réduis : un ris dans la grand-voile, le foc roulé.',
    avant: (j) => j.debloquer('ris'),
    etapes: [
      {
        id: 'ris.ris',
        dire: [
          'Le vent forcit, regarde la mer qui blanchit. Quand le bateau gîte trop, plus de vingt-cinq degrés, on réduit la toile.',
          'On prend un ris : on descend un peu la grand-voile et on l\'attache plus bas. Elle devient plus petite.',
          'Mets le pilote, lève-toi, et accroche ton harnais à la ligne de vie, touche X. Puis va au pied du mât, regarde les bosses de ris, et garde E appuyé.',
        ],
        objectif: 'Harnais (X), puis prends un ris au pied du mât (E)',
        verifier: (ctx) => ctx.physique.ris >= 1,
        conseils: [
          PILOTE_POUR_SE_LEVER,
          {
            si: (ctx) => ctx.mode === 'pied' && ctx.aBord.dehors && !ctx.aBord.attache && /passavant|rouf|pont-avant/.test(ctx.aBord.zone),
            apres: 2,
            repos: 15,
            dire: 'Accroche ton harnais, touche X, avant d\'aller à l\'avant !',
          },
        ],
        bravo: 'Un ris de pris ! La voile est plus petite.',
      },
      {
        id: 'ris.foc',
        dire: ['Roule aussi un peu le foc : la touche C, à la barre, ou l\'enrouleur dans le cockpit. Garde-le à moitié.'],
        objectif: 'Roule le foc à moitié (C)',
        verifier: (ctx) => ctx.physique.deroule < 0.62,
        progression: (ctx) => (1 - ctx.physique.deroule) / 0.38,
        bravo: 'Tu vois, le bateau est plus droit, et il va presque aussi vite.',
      },
      {
        id: 'ris.barre',
        dire: ['Reviens à la barre, en restant accroché.'],
        objectif: 'Retourne à la barre (E sur la barre)',
        verifier: (ctx) => ctx.mode === 'barre',
      },
    ],
  },

  // ---------------------------------------------------------------------------------
  {
    id: 'nuit',
    titre: 'Préparer la nuit',
    heure: [16.75, 18.5],
    duree: 260,
    reflexe: 'Avant la nuit : réduire la toile, fermer la porte de la timonerie, s\'attacher, allumer les feux.',
    etapes: [
      {
        id: 'nuit.bulletin',
        emetteur: 'Kervalen Radio',
        canal: 16,
        dire: [
          'Avis de coup de vent pour la zone du large.',
          'Cette nuit, vent de sud-ouest force huit à neuf, rafales à cinquante nœuds. Mer grosse.',
          'Avis aux navigateurs : rejoignez un abri, ou préparez-vous.',
        ],
        debut: (ctx, memo, j) => j.ecrire('Avis de coup de vent pour la nuit : force 8 à 9.'),
        verifier: () => true,
      },
      {
        id: 'nuit.jos',
        dire: [
          'Tu as entendu ? Ça va souffler très fort cette nuit, et tu es trop loin pour rentrer avant.',
          'Regarde au sud-ouest, sur l\'horizon : ces grosses tours sombres, avec un toit plat. C\'est le front. Il sera sur nous à la nuit tombée.',
          'Alors on prépare le bateau, tant qu\'il fait jour. Voilà la liste. Elle est aussi dans ton carnet de bord, touche L.',
        ],
        verifier: () => true,
      },
      {
        id: 'nuit.liste',
        objectif: 'Prépare le bateau pour la nuit',
        liste: (ctx) => LISTE_NUIT.map((item) => ({ texte: item.texte, fait: item.fait(ctx) })),
        verifier: (ctx) => LISTE_NUIT.every((item) => item.fait(ctx)),
        progression: (ctx) => LISTE_NUIT.filter((item) => item.fait(ctx)).length / LISTE_NUIT.length,
        conseils: [{
          si: () => true,
          apres: 35,
          repos: 35,
          dire: (ctx) => LISTE_NUIT.find((item) => !item.fait(ctx))?.rappel ?? 'Tout est prêt ?',
        }],
        bravo: 'Tout est paré. Je n\'aurais pas mieux fait.',
      },
    ],
    fin: [
      'Le soleil se couche. Ton bateau est prêt, et toi aussi.',
      'Je reste à l\'écoute toute la nuit, sur le soixante-douze. Bon quart, matelot.',
    ],
  },
];

// La liste de la nuit (leçon 8)
export const LISTE_NUIT = [
  {
    id: 'ris',
    texte: 'Deux ris dans la grand-voile',
    fait: (ctx) => ctx.physique.ris >= 2,
    rappel: 'Il te faut deux ris dans la grand-voile : au pied du mât, harnais accroché.',
  },
  {
    id: 'foc',
    texte: 'Le foc roulé aux deux tiers (C)',
    fait: (ctx) => ctx.physique.deroule <= 0.4,
    rappel: 'Roule ton foc aux deux tiers : touche C, à la barre.',
  },
  {
    id: 'gilet',
    texte: 'Ton gilet et ton ciré (dans la cabine)',
    fait: (ctx) => ctx.aBord.gilet,
    rappel: 'Enfile ton gilet et ton ciré : ils sont pendus dans la timonerie, à côté de la porte.',
  },
  {
    id: 'feux',
    texte: 'Les feux de navigation (tableau électrique)',
    fait: (ctx) => ctx.aBord.feux,
    rappel: 'Allume tes feux de navigation : le tableau électrique est dans la timonerie, sur la paroi tribord, derrière le siège.',
  },
  {
    id: 'lampe',
    texte: 'La lampe frontale essayée (F)',
    fait: (ctx) => ctx.aBord.lampeEssayee,
    rappel: 'Essaie ta lampe frontale, touche F : la nuit, tu en auras besoin.',
  },
  {
    id: 'descente',
    texte: 'La porte de la timonerie fermée',
    fait: (ctx) => !ctx.aBord.descenteOuverte,
    rappel: 'Ferme la porte de la timonerie : sinon les vagues qui remplissent le cockpit entreront à l\'intérieur.',
  },
  {
    id: 'harnais',
    texte: 'Ton harnais accroché (X)',
    fait: (ctx) => ctx.aBord.attache,
    rappel: 'Et accroche ton harnais à la ligne de vie, touche X.',
  },
];

