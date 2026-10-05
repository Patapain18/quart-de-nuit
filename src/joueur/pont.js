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
  COCKPIT, ROUF, MAT, DESCENTE_ROUF, PANNEAU_PONT, zDe, uDe, demiLargeur, hauteurPont, bordInterieur, hauteurRouf,
} from '../bateau/forme.js';

export const MARCHE_MAX = 0.45;
const BORD = 0.12; // distance minimale au livet (les chandeliers et filières)
export const DESCENTE = { demiLargeur: 0.32, zHaut: zDe(COCKPIT.uAvant), marches: [[1.27, 0.2], [1.05, -0.05]] };
// (la face avant du rouf penche vers l'arrière de 12 cm : la cloison avant de la cabine
// est derrière son sommet)
export const CARRE = { plancher: -0.3, zAvant: zDe(ROUF.uAvant) + 0.14, demiLargeur: 0.55 };
export const TABLE = { demiLargeur: 0.22, z0: -1.15, z1: -0.35 };

const dansCockpit = (u) => u >= COCKPIT.uArriere && u <= COCKPIT.uAvant;

// Le toit du rouf : on tient debout sur sa partie plate (ses côtés penchent vers
// l'intérieur de 10 cm, et sa face avant vers l'arrière de 12 cm : on les enjambe)
const Z_CLOISON = zDe(ROUF.uArriere); // la cloison arrière du rouf (la porte de la descente)
const Z_AVANT_TOIT = zDe(ROUF.uAvant) + 0.12;
const surLeToit = (x, z, u) => u > ROUF.uArriere && z > Z_AVANT_TOIT - 0.02
  && Math.abs(x) <= bordInterieur(u) - ROUF.rentree;
// Le capot coulissant de la descente (7 cm au-dessus du toit) : fermé, il couvre le trou
// du toit ; ouvert, il a glissé de 55 cm vers l'avant et découvre l'arrière du trou
const CAPOT = { demiLargeur: 0.39, longueur: 0.84, y: hauteurRouf(ROUF.uArriere + 0.04, 0) + 0.07 };
const capotZ = () => {
  const z1 = Z_CLOISON + 0.02 - (descenteOuverte ? DESCENTE_ROUF.course : 0);
  return [z1 - CAPOT.longueur, z1];
};
// le trou découvert, quand la descente est ouverte (on ne marche pas dedans)
const dansLeTrou = (x, z) => descenteOuverte && Math.abs(x) < DESCENTE_ROUF.demiLargeur + 0.03
  && z > capotZ()[1] - 0.02 && z < Z_CLOISON + 0.03;
const surLeCapot = (x, z) => {
  const [z0, z1] = capotZ();
  return Math.abs(x) <= CAPOT.demiLargeur && z >= z0 && z <= Math.min(z1, Z_CLOISON);
};
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
    dans: (x, z, u) => surLeToit(x, z, u) && !dansLeTrou(x, z) && !surLeCapot(x, z) && !surLePanneau(x, z),
    y: (x, z, u) => hauteurRouf(u, Math.min(Math.abs(x), bordInterieur(u) - ROUF.rentree)),
  },
  {
    nom: 'rouf-capot',
    dans: surLeCapot,
    y: () => CAPOT.y,
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
    nom: 'descente',
    ouverte: true,
    dans: (x, z) => Math.abs(x) < DESCENTE.demiLargeur && z < DESCENTE.zHaut && z >= DESCENTE.marches[1][0],
    y: (x, z) => (z >= DESCENTE.marches[0][0] ? DESCENTE.marches[0][1] : DESCENTE.marches[1][1]),
  },
  {
    // (le carré reste praticable descente fermée : on peut s'enfermer dans la cabine,
    // seules les marches sont barrées par les planches)
    nom: 'carre',
    dans: (x, z) => Math.abs(x) < CARRE.demiLargeur && z < DESCENTE.marches[1][0] && z > CARRE.zAvant
      && !(Math.abs(x) < TABLE.demiLargeur && z > TABLE.z0 && z < TABLE.z1),
    y: () => CARRE.plancher,
  },
];

// La descente est-elle ouverte ? (les planches enlevées, le capot glissé vers l'avant)
let descenteOuverte = true;
export function ouvrirDescente(ouverte) {
  descenteOuverte = ouverte;
  for (const s of SURFACES) if (s.ouverte !== undefined) s.ouverte = ouverte;
}
// le bout du trou du toit que le capot découvre quand on l'ouvre
const Z_CAPOT_OUVERT = zDe(ROUF.uArriere) + 0.02 - DESCENTE_ROUF.course;

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
  // sur le toit, on ne met pas le pied dans le trou de la descente ouverte
  if (yPieds > 1.0 && dansLeTrou(x, z)) return null;
  for (const s of surfacesEn(x, z)) {
    if (s.y <= yPieds + MARCHE_MAX) return s;
  }
  return null;
}

// Hauteur du plafond au-dessus d'un point (dans la cabine) : pour baisser la tête
export function plafondEn(x, z, yPieds) {
  // dehors : sur le pont, et dans le cockpit (même en remontant la dernière marche de la
  // descente, les pieds encore bas)
  if (yPieds > 0.4 || (dansCockpit(uDe(z)) && Math.abs(x) <= COCKPIT.demiLargeur)) return Infinity;
  // sous le capot ouvert, on peut passer la tête dehors
  if (descenteOuverte && Math.abs(x) < DESCENTE_ROUF.demiLargeur - 0.05 && z > Z_CAPOT_OUVERT) return Infinity;
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
