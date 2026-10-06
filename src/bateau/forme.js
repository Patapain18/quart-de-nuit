// La forme du voilier, en fonctions mathématiques.
//
// Un croiseur de 9,40 m (un « 31 pieds »), dessiné comme un architecte naval le fait
// sur son « plan de formes » : on décrit, pour chaque tranche du bateau de l'arrière
// à l'avant, sa largeur, la hauteur de son pont et la profondeur de sa coque.
// Ces mêmes fonctions servent à fabriquer le modèle 3D (modele.js) et à calculer
// la flottaison (combien de coque est sous l'eau, et où).
//
// Repère du bateau : -Z = vers l'avant (l'étrave), +X = tribord (à droite quand on
// regarde l'avant), +Y = vers le haut ; y = 0 est la ligne de flottaison.
// Le paramètre u va de 0 (le tableau arrière) à 1 (l'étrave).

export const COQUE = {
  zArriere: 4.4, // le tableau arrière
  zAvant: -5.0, // le haut de l'étrave
  demiLargeurMax: 1.6, // au livet (le bord du pont)
  uLargeurMax: 0.38,
  demiLargeurTableau: 1.3,
  livetArriere: 0.86, // hauteur du pont au-dessus de l'eau, à l'arrière…
  livetAvant: 1.15, // … et à l'avant
  creuxMax: 0.48, // profondeur de la coque sous la flottaison (sans la quille)
  uPiedEtrave: 0.9, // où l'étrave rejoint la flottaison
  bouchain: [2.8, 1.45], // forme des sections : en U à l'arrière, en V à l'avant
  bouge: 0.07, // le pont est bombé (plus haut au milieu)
};

// Le cockpit et le rouf (la cabine qui dépasse du pont)
export const COCKPIT = {
  uArriere: 0.04, // paroi arrière du cockpit
  uAvant: 0.31, // cloison de la descente (début du rouf)
  demiLargeur: 0.85, // bord intérieur des hiloires
  plancher: 0.45, // hauteur du plancher au-dessus de l'eau
  banc: 0.82, // hauteur des bancs
  demiLargeurPuits: 0.42, // le puits entre les bancs
  hiloire: 0.2, // les hiloires dépassent du pont de 20 cm
};
export const ROUF = {
  uArriere: 0.31,
  uAvant: 0.62,
  demiLargeurAvant: 0.62,
  hauteur: 0.42, // au-dessus du pont
  bouge: 0.08,
  rentree: 0.1, // les côtés penchent vers l'intérieur
};
// (le mât et la bôme ont été rehaussés de 44 cm pour passer au-dessus de la timonerie)
export const MAT = { u: 0.6, hauteur: 12.04, bome: 3.7, hauteurBome: 1.22 };
// L'entrée : la porte de la timonerie, dans la cloison du cockpit (son seuil est 6 cm
// au-dessus du plancher du cockpit : l'eau du cockpit n'entre que s'il est bien plein)
export const DESCENTE_ROUF = {
  demiLargeur: 0.31,
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

// Bord intérieur du passavant (le chemin le long du rouf et du cockpit)
export function bordInterieur(u) {
  if (u < COCKPIT.uArriere || u > ROUF.uAvant) return 0;
  if (u <= COCKPIT.uAvant) return COCKPIT.demiLargeur;
  const t = lisse(ROUF.uArriere, ROUF.uAvant, u);
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
// Un étage vitré sur l'arrière du rouf, de la cloison du cockpit jusqu'à 1,24 m vers
// l'avant. Elle est moins large que le rouf (1,16 m) : le barreur, assis au bord du banc,
// voit devant lui le long de ses parois. Son pare-brise penche vers l'arrière. Dedans, le
// plancher est surélevé (au niveau du seuil du cockpit : on y tient debout et l'on voit
// dehors) ; en bas, l'intérieur garde toute la largeur du rouf (des étagères courent sous
// les bords de son toit) ; trois marches descendent au carré, à bâbord.
export const TIMONERIE = {
  zArriere: zDe(ROUF.uArriere), // la cloison du cockpit
  zAvant: 0.25, // le pied du pare-brise, sur le toit du rouf
  recul: 0.22, // le haut du pare-brise est 22 cm plus en arrière que son pied
  demiLargeur: 0.58, // les parois, au pied
  rentree: 0.03, // (elles penchent un peu vers l'intérieur)
  toit: 2.42, // le toit, au bord (au-dessus de l'eau)
  bouge: 0.04, // (il est bombé : 4 cm de plus au milieu)
  plancher: 0.55,
  vitreHaut: 2.3,
  // la porte vers le cockpit, au milieu de la paroi arrière : deux battants qui coulissent
  // à l'intérieur, contre la paroi, chacun de son côté (dehors, ils cacheraient le compas
  // et les afficheurs du cockpit)
  porte: { demiLargeur: 0.26, haut: 2.3 },
};
export const U_TIMONERIE = uDe(TIMONERIE.zAvant); // (sa tranche avant)
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
// Le panneau de pont (le « hublot » du toit) au-dessus de la table du carré : son
// ouverture tombe sur deux tranches du toit (15 et 10) et deux de ses colonnes (±22 cm) ;
// son cadre d'aluminium la déborde de 4 cm
const TROU_PANNEAU = { demiLargeur: 0.22, z0: zDe(trancheToit(15)), z1: zDe(trancheToit(10)) };
export const PANNEAU_PONT = {
  trou: TROU_PANNEAU,
  demiLargeur: TROU_PANNEAU.demiLargeur + 0.04,
  z0: TROU_PANNEAU.z0 - 0.04,
  z1: TROU_PANNEAU.z1 + 0.04,
};
