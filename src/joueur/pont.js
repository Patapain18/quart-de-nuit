// Où l'on peut marcher à bord : le plan du pont, en surfaces.
//
// Chaque surface dit si un point (x, z) du bateau est sur elle et à quelle hauteur.
// Le marin cherche, sous ses pieds, la surface la plus haute qu'il peut atteindre : on
// monte une marche d'au plus 45 cm (du plancher du cockpit au banc, du banc à
// l'hiloire, du passavant au toit du rouf) ; plus haut, c'est un mur.
//
// Repère du bateau (voir bateau/forme.js) : -Z vers l'avant, +X tribord, y = 0 à la
// flottaison. Les filières sont à 7 cm du bord : on ne peut pas aller plus loin que
// 12 cm du livet (sauf… si le bateau se couche et qu'on n'est pas attaché).
import {
  COCKPIT, ROUF, MAT, TIMONERIE, PANNEAU_PONT, zDe, uDe, demiLargeur, hauteurPont, bordInterieur, hauteurRouf,
  toitTimonerie,
} from '../bateau/forme.js';

export const MARCHE_MAX = 0.45;
const BORD = 0.12; // distance minimale au livet (les chandeliers et filières)
// (la face avant du rouf penche vers l'arrière de 12 cm : la cloison avant de la cabine
// est derrière son sommet)
export const CARRE = { plancher: -0.3, zAvant: zDe(ROUF.uAvant) + 0.14, demiLargeur: 0.55 };
export const TABLE = { demiLargeur: 0.22, z0: -1.15, z1: -0.35 };

const dansCockpit = (u) => u >= COCKPIT.uArriere && u <= COCKPIT.uAvant;

// Le toit du rouf : on tient debout sur sa partie plate, devant la timonerie (ses côtés
// penchent vers l'intérieur de 10 cm, et sa face avant vers l'arrière de 12 cm : on les
// enjambe)
const Z_PORTE = TIMONERIE.zArriere; // la paroi arrière de la timonerie (sa porte)
const Z_AVANT_TOIT = zDe(ROUF.uAvant) + 0.12;
const surLeToit = (x, z, u) => z < TIMONERIE.zAvant - 0.03 && z > Z_AVANT_TOIT - 0.02
  && Math.abs(x) <= bordInterieur(u) - ROUF.rentree;

// La timonerie : son plancher surélevé, de la paroi arrière au pied du pare-brise, percé
// à bâbord de la trémie de l'escalier (trois marches vers l'avant descendent au carré)
export const TREMIE = { x0: -0.52, x1: -0.08, z0: TIMONERIE.zAvant, z1: 0.85 };
export const MARCHES_TIMONERIE = [{ z0: 0.62, z1: 0.85, y: 0.27 }, { z0: 0.4, z1: 0.62, y: -0.01 }];
const dansLaTremie = (x, z) => x > TREMIE.x0 && x < TREMIE.x1 && z > TREMIE.z0 - 0.01 && z < TREMIE.z1;
const surLesMarches = (x) => x > TREMIE.x0 + 0.01 && x < TREMIE.x1 - 0.01;
// le dedans de la timonerie, vu de dessus (entre ses parois)
export const dansLaTimonerie = (x, z) => z > TIMONERIE.zAvant && z < Z_PORTE - 0.01
  && Math.abs(x) < bordInterieur(uDe(z)) - 0.05;
// le panneau de pont au-dessus de la table du carré (son cadre dépasse du toit de 4,5 cm)
const Y_PANNEAU = hauteurRouf(uDe((PANNEAU_PONT.z0 + PANNEAU_PONT.z1) / 2), 0) + 0.045;
const surLePanneau = (x, z) => Math.abs(x) <= PANNEAU_PONT.demiLargeur && z >= PANNEAU_PONT.z0 && z <= PANNEAU_PONT.z1;

// Les surfaces : nom, test d'appartenance, hauteur. (« ouverte » : l'état de la descente)
const SURFACES = [
  {
    nom: 'cockpit',
    dans: (x, z, u) => dansCockpit(u) && Math.abs(x) <= COCKPIT.demiLargeurPuits,
    y: () => COCKPIT.plancher,
  },
  {
    nom: 'banc',
    dans: (x, z, u) => dansCockpit(u) && Math.abs(x) > COCKPIT.demiLargeurPuits && Math.abs(x) <= COCKPIT.demiLargeur,
    y: () => COCKPIT.banc,
  },
  {
    nom: 'hiloire',
    dans: (x, z, u) => dansCockpit(u) && Math.abs(x) > COCKPIT.demiLargeur && Math.abs(x) <= COCKPIT.demiLargeur + 0.07,
    y: (x, z, u) => hauteurPont(u, COCKPIT.demiLargeur) + COCKPIT.hiloire,
  },
  {
    nom: 'pont-arriere',
    dans: (x, z, u) => u >= 0.012 && u < COCKPIT.uArriere && Math.abs(x) < demiLargeur(u) - BORD,
    y: (x, z, u) => hauteurPont(u, x),
  },
  {
    nom: 'passavant',
    dans: (x, z, u) => {
      if (u < COCKPIT.uArriere || u > ROUF.uAvant) return false;
      const interieur = bordInterieur(u) + (dansCockpit(u) ? 0.07 : 0);
      return Math.abs(x) > interieur && Math.abs(x) < demiLargeur(u) - BORD;
    },
    y: (x, z, u) => hauteurPont(u, x),
  },
  {
    nom: 'rouf',
    dans: (x, z, u) => surLeToit(x, z, u) && !surLePanneau(x, z),
    y: (x, z, u) => hauteurRouf(u, Math.min(Math.abs(x), bordInterieur(u) - ROUF.rentree)),
  },
  {
    nom: 'rouf-panneau',
    dans: surLePanneau,
    y: () => Y_PANNEAU,
  },
  {
    nom: 'pont-avant',
    dans: (x, z, u) => u >= ROUF.uAvant && u < 0.945 && Math.abs(x) < demiLargeur(u) - BORD,
    y: (x, z, u) => hauteurPont(u, x),
  },
  {
    nom: 'timonerie',
    dans: (x, z) => dansLaTimonerie(x, z) && !dansLaTremie(x, z),
    y: () => TIMONERIE.plancher,
  },
  {
    // (l'escalier : on descend vers l'avant, sous le toit haut de la timonerie)
    nom: 'marches',
    dans: (x, z) => surLesMarches(x) && z >= MARCHES_TIMONERIE[1].z0 && z < TREMIE.z1,
    y: (x, z) => (z >= MARCHES_TIMONERIE[0].z0 ? MARCHES_TIMONERIE[0].y : MARCHES_TIMONERIE[1].y),
  },
  {
    // le carré, et le pied de l'escalier (sous la trémie)
    nom: 'carre',
    dans: (x, z) => z > CARRE.zAvant && ((Math.abs(x) < CARRE.demiLargeur && z < TIMONERIE.zAvant)
      || (surLesMarches(x) && z < MARCHES_TIMONERIE[1].z0))
      && !(Math.abs(x) < TABLE.demiLargeur && z > TABLE.z0 && z < TABLE.z1),
    y: () => CARRE.plancher,
  },
];

// Les passages étroits : quand on marche vers l'un d'eux à peu près de face, on est guidé
// vers son milieu (le marin s'aligne sans y penser pour franchir une porte : le joueur, qui
// ne voit pas ses épaules, n'a pas à viser au centimètre). x, z : le milieu du seuil ;
// demiLargeur : l'ouverture qui reste quand les battants sont rangés (ils dépassent de 3 cm)
export const PASSAGES = [{ nom: 'porte', x: 0, z: TIMONERIE.zArriere, demiLargeur: TIMONERIE.porte.demiLargeur - 0.015 }];

// La porte de la timonerie est-elle ouverte ? (on garde le nom « descente » : c'est
// toujours le chemin vers l'intérieur)
let descenteOuverte = true;
export function ouvrirDescente(ouverte) {
  descenteOuverte = ouverte;
}

// La porte fermée est un mur : un pas de (x0, z0) à (x1, z1) la traverse-t-il, ou entre-t-il
// dans son épaisseur ? (Dedans, ses battants sont à 7 et 10 cm de la paroi : les yeux en
// restent à 15 cm.) Si elle s'est fermée sur nous, on en sort du côté où l'on est. (Sans ce
// mur, le marin, qui enjambe les petits vides — le bord penché du rouf —, enjambait la bande
// sans sol de la porte fermée.)
const PORTE_DEDANS = 0.28;
const PORTE_DEHORS = 0.08;
export function bloqueParLaPorte(x0, z0, x1, z1) {
  if (descenteOuverte) return false;
  if (Math.min(Math.abs(x0), Math.abs(x1)) > TIMONERIE.porte.demiLargeur + 0.05) return false;
  const a = z0 - Z_PORTE;
  const b = z1 - Z_PORTE;
  if (Math.sign(a) !== Math.sign(b)) return true;
  return b > -PORTE_DEDANS && b < PORTE_DEHORS && Math.abs(b) < Math.abs(a);
}

// Obstacles ronds (le mât sur le rouf, l'épontille dans le carré) : [x, z, rayon, yMin, yMax]
const OBSTACLES = [[0, zDe(MAT.u), 0.17, 1.0, 20], [0, zDe(MAT.u), 0.09, -1, 1.2]];

// Toutes les surfaces sous le point (x, z), de la plus haute à la plus basse
export function surfacesEn(x, z) {
  const u = uDe(z);
  const liste = [];
  for (const s of SURFACES) {
    if (s.ouverte === false) continue;
    if (s.dans(x, z, u)) liste.push({ nom: s.nom, y: s.y(x, z, u) });
  }
  liste.sort((a, b) => b.y - a.y);
  return liste;
}

// La surface où l'on peut poser le pied en (x, z), en venant de la hauteur yPieds :
// la plus haute qui ne demande pas de monter plus d'une marche. null : on ne peut pas y aller.
export function solEn(x, z, yPieds) {
  for (const o of OBSTACLES) {
    if (yPieds > o[3] && yPieds < o[4] && Math.hypot(x - o[0], z - o[1]) < o[2]) return null;
  }
  // la porte fermée barre le passage entre le cockpit et la timonerie (une bande de 12 cm
  // qu'on ne peut franchir d'un pas)
  if (!descenteOuverte && Math.abs(x) < TIMONERIE.porte.demiLargeur + 0.05 && Math.abs(z - Z_PORTE) < 0.06) return null;
  // la timonerie est fermée : on n'y entre que par sa porte ou par l'escalier, pas d'en
  // haut (le toit du rouf, à travers le pare-brise) ni d'à côté (le passavant, à travers
  // une paroi). (Le modèle 3D arrête aussi le corps ; le plan le dit pour lui-même.)
  if (dansLaTimonerie(x, z) && yPieds > TIMONERIE.plancher + 0.25) return null;
  for (const s of surfacesEn(x, z)) {
    // (le passavant s'atteint d'en haut — le banc, l'hiloire, le pont — jamais d'en bas,
    // depuis la timonerie : sa paroi est entre les deux)
    if (s.nom === 'passavant' && yPieds < 0.7) continue;
    if (s.y <= yPieds + MARCHE_MAX) return s;
  }
  return null;
}

// Hauteur du plafond au-dessus d'un point (dans la cabine) : pour baisser la tête
export function plafondEn(x, z, yPieds) {
  // la timonerie (et l'escalier, sous son toit) : le dessous du toit ; plus près des bords,
  // le dessous des corniches (on ne s'y tient pas debout : ce sont des étagères) ; sous la
  // porte, son linteau
  if (dansLaTimonerie(x, z) || (x > TREMIE.x0 && x < TREMIE.x1 && z > TIMONERIE.zAvant - 0.02 && z < Z_PORTE)) {
    const u = uDe(z);
    if (Math.abs(x) < TIMONERIE.demiLargeur - 0.035) return toitTimonerie(u, x) - 0.06;
    return hauteurRouf(u, Math.abs(x)) - 0.06;
  }
  if (Math.abs(x) < TIMONERIE.porte.demiLargeur && Math.abs(z - Z_PORTE) < 0.04) return TIMONERIE.porte.haut;
  // dehors : sur le pont, et dans le cockpit
  if (yPieds > 0.4 || (dansCockpit(uDe(z)) && Math.abs(x) <= COCKPIT.demiLargeur)) return Infinity;
  const u = uDe(z);
  // (le toit est bombé : plus bas sur les côtés)
  if (u >= ROUF.uArriere && u <= ROUF.uAvant) return hauteurRouf(u, Math.min(Math.abs(x), bordInterieur(u) - ROUF.rentree)) - 0.07;
  return hauteurPont(u, x) - 0.06;
}

// Distance au bord (au livet), côté par côté : pour savoir si l'on risque de passer par-dessus
export function margeAuBord(x, z) {
  const u = uDe(z);
  return demiLargeur(Math.min(0.999, Math.max(0, u))) - Math.abs(x);
}
