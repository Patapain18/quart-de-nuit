// Faire le point : savoir où l'on est.
//
// Le GPS du traceur donne la position à quelques mètres près. Mais il peut lâcher (la foudre sur
// le mât ; une déferlante qui noie son antenne, sur le balcon arrière). Il faut alors faire le
// point « à l'ancienne », comme les marins l'ont fait pendant des siècles :
//  - relever un amer au compas de relèvement : la direction où on le voit, comptée depuis le
//    nord. Sur la carte, on trace depuis l'amer la droite de relèvement, dans la direction
//    opposée : on est quelque part sur elle ;
//  - mesurer au radar sa distance à la pointe du Bec : on est sur un cercle autour d'elle ;
//  - deux de ces lignes se croisent : on est là. Le point est bon quand elles se coupent
//    franchement. Deux relèvements à moins de 30° l'un de l'autre se coupent « à plat » : une
//    petite erreur de lecture déplace beaucoup le point. Un relèvement et une distance prises
//    sur le même amer se coupent toujours à angle droit ;
//  - entre deux points, l'estime : la route suivie (le compas) et la vitesse sur l'eau (le
//    loch) disent où l'on devrait être ; mais la dérive (le bateau glisse sous le vent)
//    l'écarte peu à peu de la vérité.
// Ce fichier ne dessine rien : la rose du compas de relèvement (jeu/compas-de-relevement.js),
// la carte marine (jeu/carte-marine.js) et le traceur (bateau/electronique.js) s'en servent.
import { LIEUX, rivage } from '../rendu/cote.js';

export const MILLE = 1852;
// (à Kervalen, en 2026, la déclinaison magnétique — l'écart entre le nord du compas et le
// vrai nord — est presque nulle : le compas indique le nord vrai)
export const DECLINAISON = 0;

const DEG = Math.PI / 180;
// ramène un angle (degrés) dans ]−180, 180]
export const ecart = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
const auCompas = (a) => ((a % 360) + 360) % 360;

// La pointe du Bec : son extrémité, la plus avancée vers le sud (c'est elle que le radar voit)
export const POINTE = (() => {
  let meilleur = { x: 600, z: rivage(600) };
  for (let x = 200; x <= 1000; x += 2) {
    const z = rivage(x);
    if (z > meilleur.z) meilleur = { x, z };
  }
  return { id: 'pointe', nom: 'la pointe du Bec', court: 'Pointe du Bec', ...meilleur };
})();

// Les amers : ce qu'on peut relever au compas. De jour, les constructions qu'on voit de loin ;
// de nuit, leurs feux (le même endroit : feu = l'identifiant du feu, monde/feux.js).
// y : la hauteur du point qu'on vise (la lanterne, le haut de la tourelle…)
export const AMERS = [
  { id: 'phare', nom: 'le phare du Bec', court: 'Phare du Bec', x: LIEUX.phare.x, z: LIEUX.phare.z, y: LIEUX.phare.y - 6, feu: 'phare' },
  { id: 'semaphore', nom: 'le sémaphore', court: 'Sémaphore', x: LIEUX.semaphore.vigie.x, z: LIEUX.semaphore.vigie.z, y: LIEUX.semaphore.vigie.y, feu: 'semaphore' },
  { id: 'jetee', nom: 'le musoir de la jetée', court: 'Musoir de la jetée', x: LIEUX.jetee.musoir.x, z: LIEUX.jetee.musoir.z, y: 6, feu: 'jetee' },
  { id: 'roche-rouge', nom: 'la tourelle de la Roche Rouge', court: 'Roche Rouge', x: LIEUX.roche.x, z: LIEUX.roche.z, y: 9, feu: 'roche-rouge' },
  { id: 'basse-du-bec', nom: 'la bouée de la Basse du Bec', court: 'Basse du Bec', x: LIEUX.basse.x, z: LIEUX.basse.z, y: 3.5, feu: 'basse-du-bec', flottant: true },
];
export const amer = (id) => (id === 'pointe' ? POINTE : AMERS.find((a) => a.id === id));

// Le relèvement d'un point vu d'un autre (degrés, depuis le nord, dans le sens des aiguilles
// d'une montre ; le nord est vers les z négatifs)
export function relevement(de, vers) {
  return auCompas((Math.atan2(vers.x - de.x, -(vers.z - de.z)) * 180) / Math.PI);
}

// Les erreurs qu'on attend (un écart-type) : pour la zone d'incertitude du point
export const PRECISION = {
  relevement: 2, // degrés : un compas de relèvement à main, dans la houle
  // le radar : un demi-centième de la portée de l'écran, plus la largeur d'un écho
  distance: (porteeMilles) => 0.005 * porteeMilles * MILLE + 15,
};

// ---------- Les lignes de position ----------
// Un relèvement β de l'amer A : on est sur la droite qui part de A vers β + 180°. Sa normale
// n = (cos β, sin β) : n·(P − A) = 0 pour tout point P de la droite.
function ligne(obs) {
  const a = amer(obs.amer);
  if (!a) return null;
  if (obs.type === 'relevement') {
    const b = (obs.valeur - DECLINAISON) * DEG;
    return { type: 'droite', a, n: { x: Math.cos(b), z: Math.sin(b) }, u: { x: -Math.sin(b), z: Math.cos(b) }, sigma: (obs.sigma ?? PRECISION.relevement) * DEG, obs };
  }
  return { type: 'cercle', a, r: obs.valeur, sigma: obs.sigma ?? PRECISION.distance(obs.portee ?? 6), obs };
}

// Ce qu'une ligne « reproche » à un point P : l'écart (m) et sa direction (le gradient)
function residu(l, P) {
  const dx = P.x - l.a.x;
  const dz = P.z - l.a.z;
  if (l.type === 'droite') {
    // (et du bon côté : derrière l'amer, la droite n'existe pas — on y serait au relèvement opposé)
    return { r: l.n.x * dx + l.n.z * dz, g: l.n, sigma: Math.max(300, Math.hypot(dx, dz)) * l.sigma, devant: l.u.x * dx + l.u.z * dz };
  }
  const d = Math.max(1, Math.hypot(dx, dz));
  return { r: d - l.r, g: { x: dx / d, z: dz / d }, sigma: l.sigma, devant: 1 };
}

// Où une droite coupe un cercle (les deux points, du côté où l'on peut être)
function droiteCercle(d, c) {
  // P = A + s·u ; |P − C|² = r²
  const fx = d.a.x - c.a.x;
  const fz = d.a.z - c.a.z;
  const b = 2 * (fx * d.u.x + fz * d.u.z);
  const k = fx * fx + fz * fz - c.r * c.r;
  const delta = b * b - 4 * k;
  if (delta < 0) {
    // (ils ne se touchent pas : le point de la droite le plus proche du cercle)
    const s = Math.max(0, -b / 2);
    return [{ x: d.a.x + d.u.x * s, z: d.a.z + d.u.z * s }];
  }
  return [(-b - Math.sqrt(delta)) / 2, (-b + Math.sqrt(delta)) / 2].filter((s) => s > 0).map((s) => ({ x: d.a.x + d.u.x * s, z: d.a.z + d.u.z * s }));
}

// Faire le point avec des observations (relèvements, distances) : le point le plus d'accord avec
// toutes (les moindres carrés, chaque ligne pesant selon sa précision), la zone où l'on est
// probablement (l'ellipse d'incertitude : ses demi-axes à un écart-type, en mètres), l'angle sous
// lequel les lignes se coupent. prior : où l'on croit être (l'estime), pour choisir entre deux
// solutions (une droite coupe un cercle en deux points).
export function faireLePoint(observations, prior = null) {
  const lignes = observations.map(ligne).filter(Boolean);
  const res = { possible: false, raison: '', lignes, x: 0, z: 0, ellipse: null, croisement: 0, chapeau: null };
  if (lignes.length < 2) {
    res.raison = lignes.length ? 'Il faut une deuxième ligne : un autre relèvement, ou une distance au radar.' : 'Pas encore de relevé.';
    return res;
  }
  const droites = lignes.filter((l) => l.type === 'droite');
  const cercles = lignes.filter((l) => l.type === 'cercle');
  // (deux relevés du même amer au compas ne font qu'une seule droite ; deux distances de la
  // même pointe, deux cercles autour d'elle, qui ne se coupent pas)
  const amersDroites = new Set(droites.map((d) => d.a.id));
  if (!droites.length) {
    res.raison = 'Deux distances de la même pointe ne se coupent pas : relève aussi un amer au compas.';
    return res;
  }
  if (!cercles.length && amersDroites.size < 2) {
    res.raison = 'Deux relèvements du même amer ne se coupent pas : relève un autre amer.';
    return res;
  }
  // le point de départ des calculs
  let P = null;
  if (amersDroites.size >= 2) {
    P = moindresCarresDroites(droites, prior);
  } else {
    const candidats = droiteCercle(droites[0], cercles[0]);
    const ref = prior ?? { x: POINTE.x, z: POINTE.z + 5 * MILLE };
    candidats.sort((p, q) => Math.hypot(p.x - ref.x, p.z - ref.z) - Math.hypot(q.x - ref.x, q.z - ref.z));
    P = candidats[0] ?? ref;
  }
  // puis quelques pas de Gauss-Newton sur toutes les lignes
  let N = null;
  for (let k = 0; k < 8; k++) {
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    let b1 = 0;
    let b2 = 0;
    for (const l of lignes) {
      const { r, g, sigma } = residu(l, P);
      const w = 1 / (sigma * sigma);
      a11 += w * g.x * g.x;
      a12 += w * g.x * g.z;
      a22 += w * g.z * g.z;
      b1 -= w * g.x * r;
      b2 -= w * g.z * r;
    }
    const det = a11 * a22 - a12 * a12;
    N = { a11, a12, a22, det };
    if (Math.abs(det) < 1e-18) break;
    const dx = (a22 * b1 - a12 * b2) / det;
    const dz = (a11 * b2 - a12 * b1) / det;
    P = { x: P.x + dx, z: P.z + dz };
    if (Math.hypot(dx, dz) < 0.5) break;
  }
  res.possible = true;
  res.x = P.x;
  res.z = P.z;
  // l'ellipse : l'inverse de la matrice des poids (sa covariance)
  if (N && Math.abs(N.det) > 1e-18) {
    const c11 = N.a22 / N.det;
    const c22 = N.a11 / N.det;
    const c12 = -N.a12 / N.det;
    const m = (c11 + c22) / 2;
    const d = Math.sqrt(Math.max(0, ((c11 - c22) / 2) ** 2 + c12 * c12));
    res.ellipse = { a: Math.sqrt(m + d), b: Math.sqrt(Math.max(0, m - d)), angle: 0.5 * Math.atan2(2 * c12, c11 - c22) };
  }
  // l'angle sous lequel les deux lignes les plus franches se coupent (0 → 90°)
  let meilleur = 0;
  for (let i = 0; i < lignes.length; i++) {
    for (let j = i + 1; j < lignes.length; j++) {
      const gi = residu(lignes[i], P).g;
      const gj = residu(lignes[j], P).g;
      const sin = Math.abs(gi.x * gj.z - gi.z * gj.x);
      meilleur = Math.max(meilleur, (Math.asin(Math.min(1, sin)) * 180) / Math.PI);
    }
  }
  res.croisement = meilleur;
  // le « chapeau » : trois droites ne se coupent jamais exactement en un point ; elles
  // dessinent un petit triangle (on est probablement dedans)
  if (droites.length === 3 && !cercles.length) {
    const s = [[0, 1], [1, 2], [2, 0]].map(([i, j]) => intersectionDroites(droites[i], droites[j]));
    if (s.every(Boolean)) res.chapeau = s;
  }
  return res;
}

function moindresCarresDroites(droites, prior) {
  // (deux passes : la précision d'une droite dépend de la distance à l'amer)
  let P = prior;
  for (let k = 0; k < 2; k++) {
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    let b1 = 0;
    let b2 = 0;
    for (const d of droites) {
      const dist = P ? Math.max(300, Math.hypot(P.x - d.a.x, P.z - d.a.z)) : 5000;
      const w = 1 / (dist * d.sigma) ** 2;
      const c = d.n.x * d.a.x + d.n.z * d.a.z;
      a11 += w * d.n.x * d.n.x;
      a12 += w * d.n.x * d.n.z;
      a22 += w * d.n.z * d.n.z;
      b1 += w * d.n.x * c;
      b2 += w * d.n.z * c;
    }
    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-18) return P ?? { x: droites[0].a.x, z: droites[0].a.z + 3000 };
    P = { x: (a22 * b1 - a12 * b2) / det, z: (a11 * b2 - a12 * b1) / det };
  }
  return P;
}

function intersectionDroites(d1, d2) {
  // n1·P = n1·A1 ; n2·P = n2·A2
  const det = d1.n.x * d2.n.z - d1.n.z * d2.n.x;
  if (Math.abs(det) < 1e-9) return null;
  const c1 = d1.n.x * d1.a.x + d1.n.z * d1.a.z;
  const c2 = d2.n.x * d2.a.x + d2.n.z * d2.a.z;
  return { x: (c1 * d2.n.z - c2 * d1.n.z) / det, z: (d1.n.x * c2 - d2.n.x * c1) / det };
}

// En mots : la qualité d'un point (pour la carte, et pour Jos)
export function qualiteDuPoint(p) {
  if (!p?.possible) return '';
  const zone = p.ellipse ? Math.round((2 * p.ellipse.a) / 10) * 10 : null;
  if (p.croisement < 15) return `Les lignes se coupent presque à plat (${Math.round(p.croisement)}°) : ce point est mauvais, tu peux être à ${zone} m de là.`;
  if (p.croisement < 30) return `Les lignes se coupent à ${Math.round(p.croisement)}° : un point moyen (à ${zone} m près).`;
  return `Les lignes se coupent à ${Math.round(p.croisement)}° : un bon point (à ${zone} m près).`;
}

// ---------- L'estime ----------
// Depuis le dernier point sûr (le GPS, ou un point fait à la carte), la route du compas et la
// vitesse du loch : où l'on devrait être. Le loch mesure la vitesse le long de la coque, un peu
// trop bas (il est réglé comme ça : 3 %) ; la dérive — le bateau qui glisse sous le vent — ne
// se voit ni au compas ni au loch : c'est elle qui écarte l'estime de la vérité.
export class Estime {
  constructor() {
    this.depart = null; // { x, z, heure, source }
    this.x = 0;
    this.z = 0;
    this.distance = 0; // m parcourus à l'estime depuis le départ
    this.trace = []; // une position tous les 50 m
  }

  partir(point) {
    this.depart = { ...point };
    this.x = point.x;
    this.z = point.z;
    this.distance = 0;
    this.trace = [{ x: point.x, z: point.z }];
  }

  // cap : celui du compas (degrés) ; vitesse : le loch, en nœuds ; derive : degrés (le loch ne
  // mesure que la vitesse le long de la coque)
  maj(dt, cap, vitesse, derive = 0) {
    if (!this.depart) return;
    const v = vitesse * 0.5144 * Math.cos(derive * DEG) * 0.97;
    const a = cap * DEG;
    this.x += Math.sin(a) * v * dt;
    this.z -= Math.cos(a) * v * dt;
    this.distance += v * dt;
    const dernier = this.trace.at(-1);
    if (Math.hypot(this.x - dernier.x, this.z - dernier.z) > 50) this.trace.push({ x: this.x, z: this.z });
    if (this.trace.length > 600) this.trace.splice(1, 1);
  }
}

// ---------- Le GPS ----------
// Il donne la position à quelques mètres près (une erreur qui dérive lentement : l'air, les
// satellites qui passent). Une frappe de foudre tout près lui fait perdre les satellites une
// minute ou deux ; la foudre sur le mât, ou une déferlante qui noie son antenne, le tuent.
export class GPS {
  constructor(graine = 7) {
    this.etat = 'ok'; // 'ok', 'recherche' (il cherche ses satellites), 'mort'
    this.raison = null;
    this.attente = 0;
    this.erreur = { x: 0, z: 0 };
    this.position = null; // ce qu'il donne (null : rien)
    this.dernier = null; // sa dernière position : { x, z, heure }
    let a = graine >>> 0;
    this.hasard = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // (t : le temps du jeu, en secondes : pour savoir, plus tard, de quand date sa dernière position)
  maj(dt, x, z, heure = null, t = null) {
    if (this.etat === 'recherche') {
      this.attente -= dt;
      if (this.attente <= 0) this.etat = 'ok';
    }
    if (this.etat !== 'ok') {
      this.position = null;
      return;
    }
    // (une erreur de 3 m environ, qui change en une minute)
    const k = Math.min(1, dt / 60);
    const s = 3 * Math.sqrt(2 * k);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, this.hasard()))) * Math.cos(2 * Math.PI * this.hasard());
    this.erreur.x += -this.erreur.x * k + s * gauss();
    this.erreur.z += -this.erreur.z * k + s * gauss();
    this.position = { x: x + this.erreur.x, z: z + this.erreur.z };
    this.dernier = { ...this.position, heure, t };
  }

  // il perd ses satellites (duree : s), puis les retrouve
  perdre(duree = 90) {
    if (this.etat !== 'ok') return;
    this.etat = 'recherche';
    this.attente = duree;
    this.position = null;
  }

  griller(raison) {
    this.etat = 'mort';
    this.raison = raison;
    this.position = null;
  }

  reparer() {
    this.etat = 'ok';
    this.raison = null;
  }
}

// ---------- La rose du compas de relèvement ----------
// Un compas à main (comme les petits compas à prisme qu'on porte au cou) : une rose aimantée
// qui flotte dans un liquide. Elle cherche le nord, mais :
//  - quand on tourne vite, le liquide l'entraîne un peu (elle « traîne », puis revient) ;
//  - dans la houle, les secousses du bateau la font osciller de part et d'autre ;
//  - près de l'électronique de la console, ou de la machine, elle est déviée (« la déviation »).
// On lit le chiffre sous le trait du prisme : le relèvement de ce qu'on vise.
export const REGLAGES_ROSE = {
  periode: 2.2, // s : sa période propre (un aimant dans un liquide)
  amortissement: 0.55, // (1 : elle revient sans dépasser)
  secousses: 12, // °/s² par m/s² d'accélération de travers
};

export class RoseCompas {
  constructor() {
    this.phi = 0; // degrés : où pointe son nord (0 : le nord magnétique)
    this.vitesse = 0;
    this.psi = null; // la direction visée à l'image d'avant
    this.deviation = 0;
  }

  // psi : la direction visée (degrés vrais) ; aTravers : l'accélération des mains, de travers à la
  // visée (m/s²) ; deviation : celle de l'endroit où l'on est (degrés)
  maj(dt, psi, aTravers = 0, deviation = 0) {
    if (this.psi === null || dt <= 0) {
      this.psi = psi;
      this.phi = -deviation;
      this.vitesse = 0;
      this.deviation = deviation;
      return;
    }
    const tourne = ecart(psi, this.psi) / dt; // °/s : la vitesse à laquelle on tourne le compas
    this.psi = psi;
    this.deviation += (deviation - this.deviation) * Math.min(1, dt * 2);
    const w0 = (2 * Math.PI) / REGLAGES_ROSE.periode;
    const c = 2 * REGLAGES_ROSE.amortissement * w0;
    // (par petits pas : une image peut durer longtemps)
    const n = Math.max(1, Math.ceil(dt / 0.01));
    const h = dt / n;
    for (let k = 0; k < n; k++) {
      const acc = -w0 * w0 * (this.phi + this.deviation) + c * (tourne - this.vitesse) + REGLAGES_ROSE.secousses * aTravers;
      this.vitesse += acc * h;
      this.phi += this.vitesse * h;
    }
  }

  // Ce qu'on lit sous le trait : le relèvement (degrés)
  get lecture() {
    return auCompas((this.psi ?? 0) - this.phi);
  }
}

// La déviation du compas de relèvement selon l'endroit (degrés) : dehors, rien ; dans la
// timonerie, la console (les écrans, les haut-parleurs) la dévie ; dans le carré, la machine
export function deviationIci({ timonerie = false, carre = false } = {}) {
  if (timonerie) return 7;
  if (carre) return 4;
  return 0;
}

// ---------- Le carnet de navigation ----------
// Ce que le navigateur sait et note : ses relevés (relèvements au compas, distances au radar),
// les points qu'il a portés sur la carte, la position du GPS chaque heure tant qu'il marche,
// et l'estime depuis le dernier point sûr. (Le jeu le tient ; la journée et la nuit le lisent :
// ctx.navigation.)
export class CarnetDeNavigation {
  constructor({ graine = 7 } = {}) {
    this.gps = new GPS(graine);
    this.estime = new Estime();
    this.observations = []; // les relevés du point en cours
    this.anciennes = []; // ceux des points déjà portés (restent au crayon sur la carte)
    this.points = []; // les points portés : { x, z, heure, t, methode, croisement, ellipse, erreur… }
    this.pointsGPS = []; // la position du GPS à chaque heure ronde
    this.version = 0; // (change à chaque nouveauté : la carte se redessine)
    this.vrai = null; // la vraie position (pour juger un point : le joueur ne la voit jamais)
  }

  // x, z : la vraie position du bateau ; heure : celle du bord ; t : le temps du jeu (s) ; cap
  // (compas), vitesse (nœuds), derive (degrés)
  maj(dt, { x, z, heure = null, t = null, cap = 0, vitesse = 0, derive = 0 }) {
    this.vrai = { x, z };
    const avant = this.gps.etat;
    this.gps.maj(dt, x, z, heure, t);
    if (this.gps.etat === 'ok') {
      this.estime.depart = null;
      const p = this.gps.position;
      if (heure !== null && (!this.pointsGPS.length || Math.floor(heure) > this.pointsGPS.at(-1).heure)) {
        this.pointsGPS.push({ x: p.x, z: p.z, heure: Math.floor(heure) });
        this.version++;
      }
      return;
    }
    // le GPS vient de lâcher : l'estime part de sa dernière position (ou d'un point plus récent)
    if (avant === 'ok' || !this.estime.depart) {
      const sur = this.dernierPointSur;
      if (sur) this.estime.partir(sur);
      this.version++;
    }
    this.estime.maj(dt, cap, vitesse, derive);
  }

  // Le dernier point sûr : la dernière position du GPS, ou le dernier point porté, s'il est plus
  // récent (t : le temps du jeu, en secondes)
  get dernierPointSur() {
    const g = this.gps.dernier ? { ...this.gps.dernier, source: 'gps' } : null;
    const p = this.points.at(-1);
    if (p && (!g || (p.t ?? -Infinity) >= (g.t ?? -Infinity))) return { x: p.x, z: p.z, heure: p.heure, t: p.t, source: 'point' };
    return g;
  }

  // Où l'on croit être : le GPS s'il marche ; sinon l'estime
  get position() {
    if (this.gps.position) return { ...this.gps.position, source: 'gps' };
    if (this.estime.depart) return { x: this.estime.x, z: this.estime.z, source: 'estime' };
    return null;
  }

  // Noter un relèvement (degrés, lu au compas) ou une distance (m, lue au radar).
  //   quand : { heure, t } ; vrai : la vraie valeur (pour juger, plus tard)
  relever(amerId, valeur, quand = {}) {
    return this.noter({ type: 'relevement', amer: amerId, valeur, ...quand });
  }

  mesurer(valeur, portee, quand = {}) {
    return this.noter({ type: 'distance', amer: 'pointe', valeur, portee, ...quand });
  }

  noter(obs) {
    const o = { ...obs, x: this.vrai?.x ?? null, z: this.vrai?.z ?? null };
    this.observations.push(o);
    // (pas plus de six à la fois : les plus anciens s'effacent)
    if (this.observations.length > 6) this.observations.shift();
    this.version++;
    return o;
  }

  // Le point que donnent les relevés en cours (sans le porter)
  get pointEnCours() {
    return faireLePoint(this.observations, this.position);
  }

  // Porter le point sur la carte : il devient le dernier point sûr (l'estime repart de lui)
  porter(quand = {}) {
    const p = this.pointEnCours;
    if (!p.possible) return null;
    const obs = this.observations;
    const types = obs.map((o) => o.type);
    const nR = types.filter((t) => t === 'relevement').length;
    const methode = types.includes('distance')
      ? (nR > 1 ? `${nR} relèvements et une distance` : 'un relèvement et une distance')
      : `${['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'][nR] ?? nR} relèvements`;
    // (juger : là où était vraiment le bateau quand on a fait les relevés)
    const avecPosition = obs.filter((o) => o.x !== null);
    const vx = avecPosition.length ? avecPosition.reduce((s, o) => s + o.x, 0) / avecPosition.length : null;
    const vz = avecPosition.length ? avecPosition.reduce((s, o) => s + o.z, 0) / avecPosition.length : null;
    const point = {
      x: p.x, z: p.z, ellipse: p.ellipse, croisement: p.croisement, methode,
      heure: quand.heure ?? obs.at(-1)?.heure ?? null, t: quand.t ?? obs.at(-1)?.t ?? 0,
      observations: obs.map((o) => ({ ...o })),
      erreur: vx === null ? null : Math.hypot(p.x - vx, p.z - vz),
      // (et ce que disait le GPS au même moment, s'il marchait)
      ecartGPS: this.gps.position ? Math.hypot(p.x - this.gps.position.x, p.z - this.gps.position.z) : null,
    };
    this.points.push(point);
    this.anciennes.push(...obs);
    if (this.anciennes.length > 18) this.anciennes.splice(0, this.anciennes.length - 18);
    this.observations = [];
    if (this.gps.etat !== 'ok') this.estime.partir({ x: point.x, z: point.z, heure: point.heure, source: 'point' });
    this.version++;
    return point;
  }

  effacer() {
    this.observations = [];
    this.version++;
  }

  // Le GPS est mort (la nuit le décide : nuit.js)
  perdreGPS(raison) {
    if (this.gps.etat === 'mort') return;
    this.gps.griller(raison);
    this.version++;
  }

  // Une partie gardée : ce qu'il faut pour reprendre (le reste se refait)
  instantane() {
    return {
      gps: this.gps.etat === 'mort' ? { raison: this.gps.raison, dernier: this.gps.dernier } : null,
      points: this.points.map(({ observations, ...p }) => p),
      pointsGPS: this.pointsGPS.slice(-30),
    };
  }

  restaurer(s) {
    if (!s) return;
    this.points = s.points ?? [];
    this.pointsGPS = s.pointsGPS ?? [];
    this.observations = [];
    this.anciennes = [];
    if (s.gps) {
      this.gps.dernier = s.gps.dernier;
      this.gps.griller(s.gps.raison);
      this.estime.depart = null;
    } else {
      this.gps.reparer();
    }
    this.version++;
  }
}
