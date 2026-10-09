// La forme du voilier, en fonctions mathématiques.
//
// Un voilier de 14 m (un « 46 pieds ») à grande timonerie, dessiné comme un architecte
// naval le fait sur son « plan de formes » : on décrit, pour chaque tranche du bateau de
// l'arrière à l'avant, sa largeur, la hauteur de son pont et la profondeur de sa coque.
// (Jusqu'au 9 octobre 2026, c'était un croiseur de 9,40 m : ECHELLE, plus bas, met à la
// taille de celui-ci ce qui avait été mesuré à la main sur l'ancien.)
// Ces mêmes fonctions servent à fabriquer le modèle 3D (modele.js) et à calculer
// la flottaison (combien de coque est sous l'eau, et où).
//
// Repère du bateau : -Z = vers l'avant (l'étrave), +X = tribord (à droite quand on
// regarde l'avant), +Y = vers le haut ; y = 0 est la ligne de flottaison.
// Le paramètre u va de 0 (le tableau arrière) à 1 (l'étrave).

export const COQUE = {
  zArriere: 6.6, // le tableau arrière
  zAvant: -7.4, // le haut de l'étrave
  demiLargeurMax: 2.15, // au livet (le bord du pont)
  uLargeurMax: 0.4,
  demiLargeurTableau: 1.75,
  livetArriere: 1.22, // hauteur du pont au-dessus de l'eau, à l'arrière…
  livetAvant: 1.58, // … et à l'avant
  creuxMax: 0.66, // profondeur de la coque sous la flottaison (sans la quille)
  uPiedEtrave: 0.9, // où l'étrave rejoint la flottaison
  bouchain: [2.8, 1.45], // forme des sections : en U à l'arrière, en V à l'avant
  bouge: 0.1, // le pont est bombé (plus haut au milieu)
};
// Ce qui ailleurs avait été mesuré à la main sur l'ancien bateau de 9,40 m (la quille, le
// safran, les centres de poussée, les rayons de giration…) : multiplié par ces rapports
export const ECHELLE = { longueur: 14 / 9.4, largeur: 2.15 / 1.6, hauteur: 1.375 };

// Le cockpit (aussi large que la timonerie, devant lui) et le rouf (la cabine qui dépasse
// du pont : la timonerie est posée sur son arrière ; devant elle, il couvre la cabine avant)
export const COCKPIT = {
  uArriere: 0.035, // paroi arrière du cockpit
  uAvant: 0.2, // la paroi arrière de la timonerie (et sa porte)
  demiLargeur: 1.45, // bord intérieur des hiloires
  plancher: 0.78, // hauteur du plancher au-dessus de l'eau
  banc: 1.18, // hauteur des bancs
  demiLargeurPuits: 0.95, // le puits entre les bancs
  hiloire: 0.24, // les hiloires dépassent du pont de 24 cm
};
export const ROUF = {
  uArriere: 0.2,
  uAvant: 0.64,
  demiLargeurAvant: 1.05,
  hauteur: 0.48, // au-dessus du pont
  bouge: 0.09,
  rentree: 0.1, // les côtés penchent vers l'intérieur
};
// (le mât est posé sur le rouf, devant la timonerie ; la bôme passe au-dessus de son toit)
export const MAT = { u: 0.56, hauteur: 17, bome: 5.6, hauteurBome: 1.75 };
// L'entrée : la porte de la timonerie, dans la cloison du cockpit (son seuil est 6 cm
// au-dessus du plancher du cockpit : l'eau du cockpit n'entre que s'il est bien plein)
export const DESCENTE_ROUF = {
  demiLargeur: 0.4,
  seuil: COCKPIT.plancher + 0.06,
};

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const zDe = (u) => COQUE.zArriere + (COQUE.zAvant - COQUE.zArriere) * u;
export const uDe = (z) => (z - COQUE.zArriere) / (COQUE.zAvant - COQUE.zArriere);

// Demi-largeur au livet (vue de dessus) : 1,30 m au tableau, 1,60 m au maître-bau,
// puis une entrée fine jusqu'à l'étrave
export function demiLargeur(u) {
  const C = COQUE;
  if (u <= C.uLargeurMax) {
    const t = Math.sin((Math.PI / 2) * (u / C.uLargeurMax));
    return C.demiLargeurTableau + (C.demiLargeurMax - C.demiLargeurTableau) * Math.pow(t, 1.2);
  }
  const t = (u - C.uLargeurMax) / (1 - C.uLargeurMax);
  return C.demiLargeurMax * Math.pow(Math.max(0, Math.cos((Math.PI / 2) * t)), 0.9);
}

// Hauteur du livet (le bord du pont) : le pont remonte vers l'avant (la « tonture »)
export const hauteurLivet = (u) => COQUE.livetArriere + (COQUE.livetAvant - COQUE.livetArriere) * Math.pow(u, 1.8);

// Profondeur de la coque sous l'axe : la ligne de quille, qui remonte en étrave à l'avant
export function fondCoque(u) {
  const C = COQUE;
  if (u <= C.uPiedEtrave) return -C.creuxMax * Math.sin(Math.PI * (u + 0.1014) / (C.uPiedEtrave + 0.1014));
  const t = (u - C.uPiedEtrave) / (1 - C.uPiedEtrave);
  return hauteurLivet(1) * Math.pow(t, 0.75);
}

// Forme d'une section : demi-largeur relative (0 → 1) selon la hauteur relative s
// (0 au fond, 1 au livet). n grand = section carrée (en U), n proche de 1 = en V.
export function profilSection(s, n) {
  const t = Math.min(1, Math.max(0, s));
  return Math.pow(1 - Math.pow(1 - t, n), 1 / n);
}
export const exposantSection = (u) => COQUE.bouchain[0] + (COQUE.bouchain[1] - COQUE.bouchain[0]) * u;

// Point de la coque : tranche u, hauteur relative s ; renvoie [x, y, z] (côté tribord)
export function pointCoque(u, s) {
  const bas = fondCoque(u);
  const haut = hauteurLivet(u);
  const y = bas + (haut - bas) * s;
  const x = demiLargeur(u) * profilSection(s, exposantSection(u));
  return [x, y, zDe(u)];
}

// Demi-largeur de la coque à la hauteur y, dans la tranche u (0 si la coque n'y est pas)
export function demiLargeurA(u, y) {
  if (u < 0 || u > 1) return 0;
  const bas = fondCoque(u);
  const haut = hauteurLivet(u);
  if (y < bas || haut <= bas) return 0;
  const s = Math.min(1, (y - bas) / (haut - bas));
  return demiLargeur(u) * profilSection(s, exposantSection(u));
}

// Hauteur du pont (bombé) à la position x de la tranche u
export function hauteurPont(u, x) {
  const w = demiLargeur(u);
  if (w <= 0) return hauteurLivet(u);
  const r = Math.min(1, Math.abs(x) / w);
  return hauteurLivet(u) + COQUE.bouge * (1 - r * r);
}

// Bord intérieur du passavant (le chemin le long du rouf et du cockpit) : le rouf garde la
// largeur du cockpit le long de la timonerie, puis se resserre devant elle
export function bordInterieur(u) {
  if (u < COCKPIT.uArriere || u > ROUF.uAvant) return 0;
  if (u <= U_TIMONERIE) return COCKPIT.demiLargeur;
  const t = lisse(U_TIMONERIE, ROUF.uAvant, u);
  return COCKPIT.demiLargeur + (ROUF.demiLargeurAvant - COCKPIT.demiLargeur) * t;
}

// Hauteur du toit du rouf (bombé) à la position x de la tranche u
export function hauteurRouf(u, x) {
  const base = hauteurPont(u, bordInterieur(u));
  const t = (u - ROUF.uArriere) / (ROUF.uAvant - ROUF.uArriere);
  const h = ROUF.hauteur * (1 - 0.12 * t);
  const w = bordInterieur(u) - ROUF.rentree;
  const r = Math.min(1, Math.abs(x) / Math.max(w, 0.1));
  return base + h + ROUF.bouge * (1 - r * r);
}

// Les hublots du rouf : un de chaque côté, long et profilé (il s'affine vers l'avant),
// entre ces tranches u (à l'arrière, ce sont les vitres de la timonerie)
export const HUBLOTS = [[0.47, 0.59]];

// Le bas et le haut d'un hublot dans la tranche u
export function bordsHublot(u, ua, ub) {
  const a = Math.min(1, Math.max(0, (u - ua) / (ub - ua)));
  const e = bordInterieur(u);
  const pont = hauteurPont(u, e);
  const toit = hauteurRouf(u, e - ROUF.rentree);
  const centre = (pont + toit) / 2 + 0.02;
  const demi = 0.07 * (1 - 0.35 * a) * Math.sin((Math.PI * Math.min(1, a * 6, (1 - a) * 6)) / 2) + 0.012;
  return { bas: centre - demi, haut: centre + demi, centre };
}

// Le côté du rouf (sa face extérieure) à la hauteur y de la tranche u : il penche vers
// l'intérieur, du pied (au pont) jusqu'à l'arrondi du haut
export function xCoteRouf(u, y) {
  const e = bordInterieur(u);
  const pont = hauteurPont(u, e);
  const toit = hauteurRouf(u, e - ROUF.rentree);
  return e - ROUF.rentree * 0.85 * ((y - pont) / (toit - 0.035 - pont));
}

// ---------- La timonerie ----------
// Un grand étage vitré sur l'arrière du rouf, de la cloison du cockpit jusqu'à 3 m vers
// l'avant, presque aussi large que lui (2,66 m) : tout se passe là, la nuit. Son pare-brise
// penche vers l'arrière. Dedans, le plancher est surélevé (22 cm au-dessus de celui du
// cockpit) : assis au poste, on voit dehors par-dessus la console. Il n'y a plus de carré :
// sous le plancher, c'est la cale (on la voit par une trappe), et devant, derrière une
// petite porte basse, la cabine avant.
export const TIMONERIE = {
  zArriere: zDe(ROUF.uArriere), // la cloison du cockpit
  zAvant: 0.75, // le pied du pare-brise, sur le toit du rouf
  recul: 0.32, // le haut du pare-brise est 32 cm plus en arrière que son pied
  demiLargeur: 1.33, // les parois, au pied
  rentree: 0.04, // (elles penchent un peu vers l'intérieur)
  toit: 3.2, // le toit, au bord (au-dessus de l'eau)
  bouge: 0.06, // (il est bombé : 6 cm de plus au milieu)
  plancher: 1.0,
  vitreHaut: 3.05,
  // la porte vers le cockpit, au milieu de la paroi arrière : deux battants qui coulissent
  // à l'intérieur, contre la paroi, chacun de son côté
  porte: { demiLargeur: 0.4, haut: 3.0 },
};
export const U_TIMONERIE = uDe(TIMONERIE.zAvant); // (sa tranche avant)
// Dans son plancher, à bâbord, derrière le siège : la trappe de la cale (50 × 50 cm) ; on la
// soulève pour voir l'eau, 1,6 m plus bas. Sous le pare-brise, à bâbord de la console, la
// petite porte basse de la cabine avant (70 cm de haut : le toit du rouf passe au-dessus).
export const TRAPPE_CALE = { x0: -0.9, x1: -0.4, z0: 2.65, z1: 3.15 };
export const PORTE_AVANT = { x0: -1.33, x1: -0.87, y0: TIMONERIE.plancher + 0.02, y1: 1.72 };
// Le pied de la paroi (sur le toit du rouf) dans la tranche u
export function piedTimonerie(u) {
  const x = TIMONERIE.demiLargeur;
  return { x, y: hauteurRouf(u, x) };
}
// La paroi à la hauteur y de la tranche u (elle rentre de 3 cm jusqu'au toit)
export function xParoiTimonerie(u, y) {
  const p = piedTimonerie(u);
  const t = Math.min(1, Math.max(0, (y - p.y) / (TIMONERIE.toit - p.y)));
  return p.x - TIMONERIE.rentree * t;
}
// Le toit, à la position x (bombé)
export function toitTimonerie(u, x) {
  const w = xParoiTimonerie(u, TIMONERIE.toit);
  const r = Math.min(1, Math.abs(x) / Math.max(w, 0.1));
  return TIMONERIE.toit + TIMONERIE.bouge * (1 - r * r);
}
// Le pare-brise : sa position z à la hauteur y (il recule en montant)
export function zPareBrise(y) {
  const pied = hauteurRouf(U_TIMONERIE, 0);
  const t = Math.min(1, Math.max(0, (y - pied) / (TIMONERIE.toit - pied)));
  return TIMONERIE.zAvant + TIMONERIE.recul * t;
}

// Les tranches du toit du rouf (devant la timonerie) : 24, régulières
export const trancheToit = (i) => U_TIMONERIE + (ROUF.uAvant - U_TIMONERIE) * (i / 24);
