// Les feux de la côte de Kervalen : le phare de la pointe du Bec, la bouée de la Basse du Bec,
// les deux feux de l'entrée de Port-Kervalen. La nuit, on ne voit plus la côte : seulement eux.
// Chacun a sa signature — sa couleur, son rythme, sa portée —, écrite dans le livre des feux :
// on le reconnaît en comptant ses éclats, et l'on sait alors où l'on est.
//
// Ce fichier ne dessine rien (rendu/feux.js). Il dit où sont les feux, quand ils s'allument
// et s'éteignent, et ce qui en arrive à nos yeux, d'ici, à cet instant :
//  - leur éclat (le rythme : le phare a une optique qui tourne, trois faisceaux qui balaient
//    l'horizon ; les autres s'allument et s'éteignent) ;
//  - leur intensité, qu'on déduit de leur portée nominale (la distance où on les voit encore
//    quand la visibilité est de 10 milles) ;
//  - ce que l'air en éteint en chemin (la loi d'Allard) : la brume du moment, et la pluie
//    des grains qui sont entre eux et nous — un feu se perd dans un grain ;
//  - la rondeur de la Terre (un feu bas passe sous l'horizon) ;
//  - les vagues : dans un creux, la crête la plus proche cache les feux ; on les voit depuis
//    le haut des vagues.
// Le résultat : la lumière reçue, en multiples du seuil de l'œil la nuit (1 : tout juste
// visible ; 100 : un feu franc ; 10 000 : il éblouit).
import { visibilite } from './meteo.js';
import { REGLAGES_GRAINS } from './grains.js';
import { LIEUX } from '../rendu/cote.js';

export const MILLE = 1852;
// L'éclairement le plus faible que l'œil voit, la nuit (lux : la recommandation de l'AISM pour
// les feux de navigation)
export const SEUIL = 2e-7;

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- Les rythmes ----------
// Un rythme simple : la période (s) et ses éclats [début, durée] (s) ; le reste du temps, le
// feu est éteint
const RYTHMES = {
  // un éclat d'une demi-seconde toutes les 4 secondes
  'Fl 4s': { periode: 4, eclats: [[0, 0.5]] },
  // « scintillant par 6 + éclat long » : six éclats rapides (un par seconde), puis un éclat
  // de 2 secondes, toutes les 15 secondes (la marque cardinale sud : 6, comme 6 heures sur une
  // montre — le sud)
  'Q(6)+LFl 15s': { periode: 15, eclats: [[0, 0.3], [1, 0.3], [2, 0.3], [3, 0.3], [4, 0.3], [5, 0.3], [6, 2]] },
};

// Le phare : une optique de trois lentilles côte à côte, qui tourne en 12 secondes ; chacune
// envoie un faisceau étroit (4° de large : un éclat d'un septième de seconde), à 30° de la
// suivante — d'où que l'on soit, on voit passer trois éclats, à une seconde d'écart, toutes
// les 12 secondes
export const OPTIQUE = {
  tour: 12, // s pour un tour
  faisceaux: 3,
  ecart: 30, // ° entre deux faisceaux
  largeur: 2.5, // ° : la demi-largeur du faisceau (à 1/e)
  depart: 40, // ° : où pointe le premier faisceau à t = 0 (relèvement)
};

// ---------- Le livre des feux ----------
// (caractere : la notation des livres des feux — Fl : à éclats ; (3) : groupés par trois ;
// Q : scintillant ; LFl : éclat long ; W, R, G : blanc, rouge, vert ; 12s : la période ;
// hauteur : du feu au-dessus de la mer, m ; portee : nominale, en milles)
export const FEUX = [
  {
    id: 'phare',
    nom: 'Phare de la pointe du Bec',
    caractere: 'Fl(3) W 12s',
    couleur: 'blanc',
    hauteur: Math.round(LIEUX.phare.y),
    portee: 20,
    structure: 'Tour blanche, le haut rouge',
    explication: 'Trois éclats blancs, à une seconde d\'écart, toutes les douze secondes.',
    x: LIEUX.phare.x, z: LIEUX.phare.z, y: LIEUX.phare.y,
    tournant: true,
  },
  {
    id: 'basse-du-bec',
    nom: 'La Basse du Bec',
    caractere: 'Q(6)+LFl W 15s',
    couleur: 'blanc',
    hauteur: 5,
    portee: 6,
    structure: 'Bouée cardinale sud, jaune sur noir, deux cônes pointe en bas',
    explication: 'Six éclats rapides, puis un long, toutes les quinze secondes. Une cardinale sud : les roches sont au nord d\'elle, passe au sud.',
    x: LIEUX.basse.x, z: LIEUX.basse.z, y: 4.4, // (au-dessus de la mer : la bouée monte et descend avec elle)
    rythme: 'Q(6)+LFl 15s',
    flottant: true,
  },
  {
    id: 'jetee',
    nom: 'Port-Kervalen, musoir de la jetée',
    caractere: 'Fl G 4s',
    couleur: 'vert',
    hauteur: 7,
    portee: 6,
    structure: 'Mât vert',
    explication: 'Un éclat vert toutes les quatre secondes. En entrant au port, laisse-le à tribord.',
    x: LIEUX.jetee.musoir.x, z: LIEUX.jetee.musoir.z, y: 7.6,
    rythme: 'Fl 4s',
  },
  {
    id: 'roche-rouge',
    nom: 'Port-Kervalen, la Roche Rouge',
    caractere: 'Fl R 4s',
    couleur: 'rouge',
    hauteur: 11,
    portee: 5,
    structure: 'Tourelle rouge',
    explication: 'Un éclat rouge toutes les quatre secondes, en alternance avec le vert. En entrant au port, laisse-la à bâbord.',
    x: LIEUX.roche.x, z: LIEUX.roche.z, y: 11,
    rythme: 'Fl 4s',
    decalage: 2, // (s : il s'allume quand le vert s'éteint)
  },
];
// (la fenêtre de la vigie du sémaphore : une lumière jaune, fixe, toute la nuit — ce n'est
// pas un feu de navigation, il n'est pas dans le livre : c'est Jos qui veille)
export const SEMAPHORE = {
  id: 'semaphore', nom: 'La fenêtre du sémaphore', couleur: 'jaune', portee: 4, hauteur: Math.round(LIEUX.semaphore.vigie.y),
  x: LIEUX.semaphore.vigie.x, z: LIEUX.semaphore.vigie.z, y: LIEUX.semaphore.vigie.y, fixe: true,
};

// Les couleurs des feux (linéaires, pour l'image)
export const COULEURS = {
  blanc: [1, 0.93, 0.8],
  vert: [0.22, 1, 0.5],
  rouge: [1, 0.13, 0.08],
  jaune: [1, 0.72, 0.38],
};

// L'intensité d'un feu (candelas), d'après sa portée nominale : à cette distance, par une
// visibilité de 10 milles, il donne tout juste le seuil de l'œil (Allard : E = I·T^d/d²)
export function intensite(feu) {
  const d = feu.portee * MILLE;
  const sigma10 = 3 / (10 * MILLE);
  return SEUIL * d * d * Math.exp(sigma10 * d);
}

// ---------- Son éclat ----------
// Où pointent les faisceaux du phare à l'instant t (relèvements, en degrés)
export function faisceaux(t, sortie = []) {
  const O = OPTIQUE;
  sortie.length = O.faisceaux;
  for (let k = 0; k < O.faisceaux; k++) sortie[k] = (((O.depart + (360 * t) / O.tour + k * O.ecart) % 360) + 360) % 360;
  return sortie;
}
const _f = [];

// L'éclat d'un feu à l'instant t (0 → 1), vu sous le relèvement « releve » (degrés : d'où on
// le voit, depuis le feu — seul le phare en dépend : c'est quand un faisceau nous balaie)
export function eclat(feu, t, releve = 0) {
  if (feu.fixe) return 1;
  if (feu.tournant) {
    let e = 0;
    for (const b of faisceaux(t, _f)) {
      const d = ((releve - b + 540) % 360) - 180;
      e += Math.exp(-((d / OPTIQUE.largeur) ** 2));
    }
    return Math.min(1, e);
  }
  const r = RYTHMES[feu.rythme];
  const u = ((((t - (feu.decalage ?? 0)) % r.periode) + r.periode) % r.periode);
  // (des bords francs, mais pas d'un coup : 40 ms pour s'allumer et s'éteindre — une lampe)
  let e = 0;
  for (const [debut, duree] of r.eclats) e = Math.max(e, lisse(debut, debut + 0.04, u) * (1 - lisse(debut + duree, debut + duree + 0.04, u)));
  return e;
}

// Le rythme d'un feu, pour le dessiner (le livre des feux, l'atelier) : ses éclats sur une
// période [début, durée], vus d'un point quelconque
export function rythme(feu) {
  if (feu.tournant) {
    const p = OPTIQUE.tour;
    const duree = (2 * OPTIQUE.largeur * 0.83) / (360 / p);
    const pas = OPTIQUE.ecart / (360 / p);
    return { periode: p, eclats: Array.from({ length: OPTIQUE.faisceaux }, (_, k) => [k * pas, duree]) };
  }
  if (feu.fixe) return { periode: 1, eclats: [[0, 1]] };
  return RYTHMES[feu.rythme];
}

// Les feux sont allumés du coucher au lever du soleil (une cellule les allume quand le jour
// baisse) : hauteurSoleil, le sinus de la hauteur du soleil
export function allumage(hauteurSoleil) {
  return lisse(0.035, 0.0, hauteurSoleil);
}

// ---------- Ce qui en arrive jusqu'à nous ----------
// La portée géographique (m) : un feu à H mètres, vu par des yeux à h mètres au-dessus de la
// mer, passe sous l'horizon au-delà de 2,08 milles × (√H + √h) (la réfraction de l'air
// comprise : l'horizon recule un peu)
export function porteeGeographique(H, h) {
  return 2.08 * (Math.sqrt(Math.max(0, H)) + Math.sqrt(Math.max(0, h))) * MILLE;
}

// La lumière d'un feu qui arrive à l'observateur, à l'instant t.
//   obs : { x, y, z } (les yeux, dans le monde) ; meteo : le temps qu'il fait ;
//   grains : monde/grains.js (la pluie entre lui et nous), ou null ; houle : pour les vagues
//   (sa hauteur en chaque point), ou null ; allume : 0 → 1 ; sortie : pour ne rien créer
// Rend { recu : en multiples du seuil (0 : rien), eclat, transmission (0 → 1 : ce que l'air en
// laisse passer), pluie (l'épaisseur de pluie traversée, en « mètres de cœur de grain »),
// cache (0 → 1 : la crête d'une vague devant), horizon (true : sous l'horizon), distance,
// releve (d'où on le voit, degrés compas) }
export function lumiereRecue(feu, obs, { t = 0, meteo, grains = null, houle = null, allume = 1, sortie = {} } = {}) {
  const dx = feu.x - obs.x;
  const dz = feu.z - obs.z;
  const dh = Math.hypot(dx, dz);
  // (une bouée monte et descend avec la vague)
  const yFeu = feu.flottant && houle ? houle.hauteur(feu.x, feu.z) + feu.y : feu.y;
  const d = Math.max(1, Math.hypot(dh, yFeu - obs.y));
  // (d'où le feu nous voit : le relèvement de l'observateur depuis le feu)
  const releveDepuisFeu = ((Math.atan2(-dx, dz) * 180) / Math.PI + 360) % 360;
  sortie.distance = dh;
  sortie.releve = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
  sortie.eclat = allume * eclat(feu, t, releveDepuisFeu);
  // la Terre est ronde : les yeux au-dessus de la mer, ici
  const mer = houle ? houle.hauteur(obs.x, obs.z) : 0;
  const h = Math.max(0.5, obs.y - mer);
  sortie.horizon = dh > porteeGeographique(yFeu, h);
  // la brume du moment, et la pluie des grains le long de la ligne (en douze points)
  const pluieFond = grains ? (meteo.pluie ?? 0) * REGLAGES_GRAINS.pluieFond : meteo.pluie ?? 0;
  const sigma = 3 / visibilite(meteo, pluieFond);
  let pluie = 0;
  if (grains) {
    const n = 12;
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      pluie += grains.pluieDesGrains(obs.x + dx * f, obs.z + dz * f) * (dh / n);
    }
  }
  sortie.pluie = pluie;
  sortie.transmission = Math.exp(-sigma * d - REGLAGES_GRAINS.extinctionPluie * pluie);
  // les vagues : la ligne qui va de nos yeux au feu passe-t-elle sous une crête, près de nous ?
  let cache = 0;
  if (houle && dh > 30) {
    const ux = dx / dh;
    const uz = dz / dh;
    for (const s of [6, 12, 20, 32, 50, 75, 110, 160, 230, 320]) {
      if (s > dh * 0.5) break;
      const ligne = obs.y + ((yFeu - obs.y) * s) / dh;
      cache = Math.max(cache, lisse(-0.25, 0.25, houle.hauteur(obs.x + ux * s, obs.z + uz * s) - ligne));
      if (cache >= 1) break;
    }
  }
  sortie.cache = cache;
  const E = sortie.horizon ? 0 : (intensite(feu) * sortie.eclat * sortie.transmission * (1 - cache)) / (d * d);
  sortie.recu = E / SEUIL;
  return sortie;
}
