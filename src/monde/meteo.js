// La météo : l'heure, le vent, la mer, les nuages, la pluie, l'orage.
//
// Un « état du temps » est un simple objet de nombres. Le jeu fera glisser
// doucement ces nombres au fil de la journée (beau temps → coup de vent → tempête →
// accalmie), et tout le reste (le ciel, la mer, la lumière, le bateau) les lit.
//
// Conventions marines : le vent et la houle sont donnés par la direction D'OÙ ILS
// VIENNENT, en degrés comme sur un compas (0 = nord, 90 = est, 270 = ouest).
// Un vent de 250 est un vent d'ouest-sud-ouest, il pousse les vagues vers l'est-nord-est.

import { positionsAstres } from './astres.js';
import { transmittance, ambianceCiel, couleurCiel } from './atmosphere.js';

export const NOEUD = 0.5144; // 1 nœud = 0,5144 m/s

// Les ambiances de référence (l'atelier de la mer permet de les régler et de les comparer).
// « regard » : où l'atelier tourne la caméra pour la photo (cap en degrés, ou décalage
// par rapport au soleil, et hauteur du regard au-dessus de l'horizon).
export const AMBIANCES = {
  'matin-calme': {
    regard: { cap: 70, site: 6 },
    nom: 'Matin calme', heure: 6.4, vent: 7, directionVent: 250, nuages: 0.22, orage: 0, pluie: 0, brume: 0.35,
    houle: { hs: 1.1, periode: 11, direction: 285 },
  },
  midi: {
    regard: { cap: 200, site: 8 },
    nom: 'Midi, bonne brise', heure: 12.8, vent: 13, directionVent: 245, nuages: 0.32, orage: 0, pluie: 0, brume: 0.12,
    houle: { hs: 1.2, periode: 11, direction: 280 },
  },
  'fin-apres-midi': {
    regard: { cap: 245, site: 6 },
    nom: 'Fin d\'après-midi', heure: 16.9, vent: 17, directionVent: 235, nuages: 0.42, orage: 0.1, pluie: 0, brume: 0.18,
    front: 0.18, directionFront: 214,
    houle: { hs: 1.6, periode: 12, direction: 270 },
  },
  'coucher-menacant': {
    regard: { soleil: -18, site: 5 },
    nom: 'Coucher de soleil menaçant', heure: 18.45, vent: 24, directionVent: 225, nuages: 0.58, orage: 0.45, pluie: 0.05, brume: 0.25,
    front: 0.7, directionFront: 212,
    houle: { hs: 2.2, periode: 12, direction: 255 },
  },
  'nuit-tempete': {
    regard: { cap: 230, site: 4 },
    nom: 'Nuit de tempête', heure: 1.5, vent: 40, directionVent: 215, nuages: 1, orage: 1, pluie: 1, brume: 0.55,
    front: 1, directionFront: 212,
    houle: { hs: 2.5, periode: 13, direction: 240 },
  },
  aube: {
    regard: { soleil: 15, site: 6 },
    nom: 'L\'aube après la tempête', heure: 5.35, vent: 14, directionVent: 260, nuages: 0.38, orage: 0, pluie: 0, brume: 0.3,
    // (le front s'en va vers le nord-nord-est ; le soleil se lève à côté de lui)
    front: 0.55, directionFront: 28, largeurFront: 40,
    houle: { hs: 3.2, periode: 14, direction: 245 },
  },
};

// Valeurs par défaut de ce qui n'est pas réglé dans une ambiance
// (front : le front orageux, de 0 (au-delà de l'horizon) à 1 (sur nous) ; directionFront :
// d'où on le voit, et largeurFront : sur quelle largeur de l'horizon, à droite et à gauche,
// en degrés)
const DEFAUTS = { fetch: 150, latitude: 47, declinaison: 10, phaseLune: 0.42, front: 0, directionFront: 212, largeurFront: 62 };

export function etatMeteo(ambiance) {
  return { ...DEFAUTS, ...structuredClone(ambiance) };
}

// Mélange de deux états du temps (t = 0 → a, t = 1 → b), pour les transitions
export function interpoler(a, b, t) {
  const m = (x, y) => x + (y - x) * t;
  const angle = (x, y) => x + ((((y - x) % 360) + 540) % 360 - 180) * t; // par le plus court chemin
  return {
    ...a,
    heure: m(a.heure, b.heure),
    vent: m(a.vent, b.vent),
    directionVent: angle(a.directionVent, b.directionVent),
    nuages: m(a.nuages, b.nuages),
    orage: m(a.orage, b.orage),
    pluie: m(a.pluie, b.pluie),
    brume: m(a.brume, b.brume),
    front: m(a.front ?? 0, b.front ?? 0),
    directionFront: angle(a.directionFront ?? 212, b.directionFront ?? 212),
    largeurFront: m(a.largeurFront ?? 62, b.largeurFront ?? 62),
    fetch: m(a.fetch, b.fetch),
    houle: {
      hs: m(a.houle.hs, b.houle.hs),
      periode: m(a.houle.periode, b.houle.periode),
      direction: angle(a.houle.direction, b.houle.direction),
    },
  };
}

// Angle (radians, dans le plan horizontal du monde) VERS lequel avance quelque chose
// qui vient du cap « depuis » (degrés compas).
export function angleVers(depuis) {
  const versCap = ((depuis + 180) * Math.PI) / 180; // cap vers lequel ça va
  // cap compas → vecteur monde : nord = -Z, est = +X
  return Math.atan2(-Math.cos(versCap), Math.sin(versCap));
}

// Ce que la mer (houle.js) doit savoir
export function etatMer(meteo) {
  return {
    vent: Math.max(0.5, meteo.vent * NOEUD),
    fetch: meteo.fetch * 1000,
    directionVent: angleVers(meteo.directionVent),
    houle: {
      hs: meteo.houle.hs,
      periode: meteo.houle.periode,
      direction: angleVers(meteo.houle.direction),
    },
  };
}

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Le front orageux vu d'ici (rendu/glsl/front.js le dessine) : d'où on le voit (azimut,
// en radians, sens du compas), sa demi-largeur, la hauteur de ses sommets au-dessus de
// l'horizon (radians) et sa visibilité. Ses sommets sont à 11 km d'altitude ; il est à
// 160 km (front = 0, sous l'horizon) puis s'approche jusqu'à 22 km (front = 1 : il couvre
// déjà le ciel, on ne le voit plus comme un mur).
export function geometrieFront(meteo) {
  const f = meteo.front ?? 0;
  const distance = 160000 * Math.exp(-2 * f);
  const chute = (distance * distance) / (2 * 6371000); // (la Terre est ronde)
  return {
    azimut: ((meteo.directionFront ?? 212) * Math.PI) / 180,
    demiLargeur: ((meteo.largeurFront ?? 62) * Math.PI) / 180,
    sommet: Math.max(0.01, Math.atan((11000 - chute) / distance)),
    distance,
    visibilite: lisse(0.02, 0.12, f) * (1 - lisse(0.9, 0.97, f)),
  };
}
// Part du soleil cachée par le front (0 → 1) : quand il passe derrière ses tours
function soleilDerriereLeFront(meteo, s) {
  const front = geometrieFront(meteo);
  if (front.visibilite <= 0) return 0;
  const ecart = Math.atan2(Math.sin(s.azimut - front.azimut), Math.cos(s.azimut - front.azimut));
  const x = ecart / front.demiLargeur;
  if (Math.abs(x) >= 1) return 0;
  // (la hauteur moyenne des tours ; leurs bosses font une marge)
  const tours = front.sommet * Math.sqrt(1 - x * x) * 0.72;
  const marge = front.sommet * 0.12;
  return front.visibilite * lisse(tours + marge, tours - marge, Math.asin(Math.max(-1, Math.min(1, s.y))));
}

// La lumière qui découle du temps qu'il fait : direction et couleur du soleil et de
// la lune, lumière du ciel, exposition. Les valeurs sont « pré-exposées » : la nuit,
// on éclaire plus que la réalité pour que le joueur voie (comme au cinéma).
export const INTENSITE_SOLEIL = 20; // intensité du soleil dans le calcul du ciel
export function eclairage(meteo) {
  const astres = positionsAstres(meteo);
  const s = astres.soleil;
  const l = astres.lune;
  const dirSoleil = [s.x, s.y, s.z];
  const dirLune = [l.x, l.y, l.z];

  // Transmission de l'atmosphère vers le soleil, au niveau de la mer et à 2 km
  // (là où sont les nuages : ils restent éclairés après le coucher du soleil)
  const tMer = transmittance(2, dirSoleil);
  const tNuages = transmittance(2000, dirSoleil);
  const jour = lisse(-0.12, 0.08, s.y); // 0 la nuit, 1 le jour
  const nuit = 1 - lisse(-0.2, -0.02, s.y);

  // La lune : on la rend plus lumineuse qu'en vrai (≈ 1/400 000 du soleil), sinon on
  // ne verrait rien. Elle compte selon sa phase et sa hauteur.
  const eclatLune = Math.max(0, 1 - Math.abs(meteo.phaseLune - 0.5) * 2) ** 1.5;
  const intensiteLune = 0.9 * eclatLune * lisse(-0.05, 0.12, l.y) * nuit;
  const tLune = transmittance(2, dirLune);

  // La nuit d'orage : noir d'encre. Sous des nuages de plusieurs kilomètres d'épaisseur,
  // sans lune ni lumière à terre, il ne reste presque rien de la lumière du ciel (7 %) : on
  // ne voit plus que ce qu'éclairent les lumières du bord, le plancton et les éclairs. Le
  // noir s'installe avec l'orage, après le coucher du soleil, et se lève quand le front est
  // passé. (noirMax : l'option de la nuit d'orage peut l'adoucir, pour un écran peu lumineux)
  const noir = nuit * lisse(0.55, 0.9, meteo.orage) * (meteo.noirMax ?? 1);
  const reste = 1 - 0.93 * noir;

  // Les nuages épais coupent le soleil direct et assombrissent la lumière du ciel
  const couverture = Math.min(1, meteo.nuages);
  const voile = Math.min(1, lisse(0.55, 1.0, couverture) * 0.88 + meteo.orage * 0.12);
  // (et le front orageux le cache quand il se couche derrière lui)
  const soleilCache = soleilDerriereLeFront(meteo, s);
  const directVisible = Math.max(0, 1 - voile) * (1 - 0.94 * soleilCache);

  // Lumière du ciel (ambiance) : ciel clair calculé, puis assombri par les nuages
  const ambSoleil = ambianceCiel(dirSoleil, INTENSITE_SOLEIL);
  const ambLune = intensiteLune > 0 ? ambianceCiel(dirLune, INTENSITE_SOLEIL * intensiteLune * 0.05) : [0, 0, 0];
  const assombrissement = 1 - 0.55 * lisse(0.4, 1, couverture) - 0.25 * meteo.orage;
  // sous un ciel couvert, la lumière devient grise (les nuages mélangent les couleurs)
  const gris = lisse(0.5, 1, couverture);
  const ambiance = [0, 1, 2].map((c) => {
    const v = (ambSoleil[c] + ambLune[c]) * assombrissement;
    const moyenne = (ambSoleil[0] + ambSoleil[1] + ambSoleil[2] + ambLune[0] + ambLune[1] + ambLune[2]) / 3;
    return (v * (1 - gris * 0.6) + moyenne * assombrissement * gris * 0.6 + 0.0025) * reste;
  });

  // Exposition : comme l'œil (ou l'appareil photo) qui s'habitue à la pénombre ;
  // mais la nuit doit rester la nuit : l'œil ne compense pas tout
  const luminance = 0.2126 * ambiance[0] + 0.7152 * ambiance[1] + 0.0722 * ambiance[2];
  // (et la nuit d'orage est plus noire encore : on n'y voit que ce qu'éclairent la lampe,
  // les éclairs et les feux du bord ; c'est là qu'elle fait peur)
  const expositionMax = 14 + (4 - 14) * nuit - 1.5 * nuit * lisse(0.6, 0.95, meteo.orage);
  const exposition = Math.min(expositionMax, Math.max(0.55, 0.5 / Math.pow(luminance + 0.004, 0.72)));

  // Couleur du ciel au zénith et à l'horizon (pour le brouillard et l'éclairage des nuages)
  const zenith = couleurCiel([0, 1, 0], dirSoleil, INTENSITE_SOLEIL);
  const horizonVent = couleurCiel([Math.sin(s.azimut + Math.PI), 0.02, -Math.cos(s.azimut + Math.PI)], dirSoleil, INTENSITE_SOLEIL);

  return {
    dirSoleil,
    dirLune,
    rotationEtoiles: astres.rotationEtoiles,
    latitude: astres.latitude,
    hauteurSoleil: s.y,
    jour,
    nuit,
    // lumière directe du soleil arrivant sur la mer (déjà atténuée par les nuages)
    soleil: tMer.map((v) => v * 3.2 * directVisible),
    // lumière du soleil qui éclaire les nuages (elle reste orange après le coucher)
    soleilNuages: tNuages.map((v) => v * 3.2),
    lune: tLune.map((v, c) => v * intensiteLune * [0.6, 0.75, 1.0][c] * directVisible * reste),
    // la lune qui éclaire le dessus des nuages (sans être cachée par eux) ; sous un
    // orage, les nuages sont si épais que presque rien ne passe
    luneNuages: tLune.map((v, c) => v * intensiteLune * [0.6, 0.75, 1.0][c] * (1 - 0.82 * meteo.orage) * reste),
    intensiteLune: intensiteLune * reste,
    noir,
    eclatLune,
    ambiance,
    zenith,
    horizon: horizonVent,
    exposition,
    couverture,
    soleilCache,
  };
}

// L'étalonnage des couleurs, comme au cinéma : chaud et saturé à l'heure dorée,
// bleu et peu saturé la nuit (l'œil voit mal les couleurs dans le noir), froid et
// délavé sous l'orage.
export function etalonnage(meteo, ecl) {
  const nuit = ecl.nuit;
  const doree = lisse(0.25, 0.02, ecl.hauteurSoleil) * (1 - nuit); // soleil bas
  const orage = meteo.orage;
  const m = (jour, x, autre) => jour + (autre - jour) * x;
  let saturation = 1.12;
  saturation = m(saturation, doree, 1.18);
  saturation = m(saturation, orage, 0.82);
  saturation = m(saturation, nuit, 0.85);
  const contraste = m(m(1.06, orage, 1.1), nuit, 1.12);
  const balance = [0, 1, 2].map((c) => {
    let v = 1;
    v = m(v, doree, [1.05, 1.0, 0.93][c]);
    v = m(v, orage, [0.95, 0.99, 1.06][c]);
    v = m(v, nuit, [0.66, 0.88, 1.32][c]);
    return v;
  });
  return { saturation, contraste, balance, vignettage: m(0.3, nuit, 0.5) };
}
