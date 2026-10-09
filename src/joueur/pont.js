// Où l'on peut marcher à bord : le plan du pont, en surfaces.
//
// Chaque surface dit si un point (x, z) du bateau est sur elle et à quelle hauteur.
// Le marin cherche, sous ses pieds, la surface la plus haute qu'il peut atteindre : on
// monte une marche d'au plus 55 cm (du plancher du cockpit au banc, du banc à
// l'hiloire, du passavant au toit du rouf, du cockpit à la timonerie) ; plus haut, c'est
// un mur.
//
// Repère du bateau (voir bateau/forme.js) : -Z vers l'avant, +X tribord, y = 0 à la
// flottaison. Les filières sont à 7 cm du bord : on ne peut pas aller plus loin que
// 12 cm du livet (sauf… si le bateau se couche et qu'on n'est pas attaché).
import {
  COCKPIT, ROUF, MAT, TIMONERIE, TRAPPE_CALE, zDe, uDe, demiLargeur, hauteurPont, bordInterieur, hauteurRouf,
  toitTimonerie,
} from '../bateau/forme.js';

export const MARCHE_MAX = 0.55;
const BORD = 0.12; // distance minimale au livet (les chandeliers et filières)

const dansCockpit = (u) => u >= COCKPIT.uArriere && u <= COCKPIT.uAvant;

// Le toit du rouf : on tient debout sur sa partie plate, devant la timonerie (ses côtés
// penchent vers l'intérieur de 10 cm, et sa face avant vers l'arrière de 12 cm : on les
// enjambe)
const Z_PORTE = TIMONERIE.zArriere; // la paroi arrière de la timonerie (sa porte)
const Z_AVANT_TOIT = zDe(ROUF.uAvant) + 0.12;
const surLeToit = (x, z, u) => z < TIMONERIE.zAvant - 0.03 && z > Z_AVANT_TOIT - 0.02
  && Math.abs(x) <= bordInterieur(u) - ROUF.rentree;

// La timonerie : son plancher surélevé, de la paroi arrière à la cloison avant (sous le
// pare-brise)
export const dansLaTimonerie = (x, z) => z > TIMONERIE.zAvant + 0.03 && z < Z_PORTE - 0.01
  && Math.abs(x) < bordInterieur(uDe(z)) - 0.05;
// La trappe de la cale, dans son plancher : ouverte, c'est un trou (et son couvercle, debout
// sur son bord arrière) ; on n'y marche pas
let trappeOuverte = false;
export function ouvrirTrappe(ouverte) {
  trappeOuverte = ouverte;
}
const dansLaTrappe = (x, z) => trappeOuverte && x > TRAPPE_CALE.x0 - 0.02 && x < TRAPPE_CALE.x1 + 0.02
  && z > TRAPPE_CALE.z0 - 0.02 && z < TRAPPE_CALE.z1 + 0.15;

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
    dans: surLeToit,
    y: (x, z, u) => hauteurRouf(u, Math.min(Math.abs(x), bordInterieur(u) - ROUF.rentree)),
  },
  {
    nom: 'pont-avant',
    dans: (x, z, u) => u >= ROUF.uAvant && u < 0.945 && Math.abs(x) < demiLargeur(u) - BORD,
    y: (x, z, u) => hauteurPont(u, x),
  },
  {
    nom: 'timonerie',
    dans: (x, z) => dansLaTimonerie(x, z) && !dansLaTrappe(x, z),
    y: () => TIMONERIE.plancher,
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

// Obstacles ronds (le mât sur le rouf) : [x, z, rayon, yMin, yMax]
const OBSTACLES = [[0, zDe(MAT.u), 0.17, 1.5, 20]];

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
  // la timonerie est fermée : on n'y entre que par sa porte, pas d'en haut (le toit du
  // rouf, à travers le pare-brise) ni d'à côté (le passavant, à travers une paroi). (Le
  // modèle 3D arrête aussi le corps ; le plan le dit pour lui-même.)
  if (dansLaTimonerie(x, z) && yPieds > TIMONERIE.plancher + 0.25) return null;
  for (const s of surfacesEn(x, z)) {
    // (et on n'en sort pas par le côté : du plancher de la timonerie, le passavant n'est
    // qu'à 30 cm plus haut, mais derrière la paroi ; on y monte du banc ou du pont)
    if (s.nom === 'passavant' && Math.abs(yPieds - TIMONERIE.plancher) < 0.12 && z < Z_PORTE + 0.05) continue;
    if (s.y <= yPieds + MARCHE_MAX) return s;
  }
  return null;
}

// Hauteur du plafond au-dessus d'un point (dans la cabine) : pour baisser la tête
export function plafondEn(x, z, yPieds) {
  // la timonerie : le dessous du toit ; tout contre les parois, le dessous des corniches ;
  // sous la porte, son linteau
  if (dansLaTimonerie(x, z)) {
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
