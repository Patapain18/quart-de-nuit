// Les grains : des averses d'orage qui existent quelque part sur la mer. Chacun avance avec
// le vent, naît, vit et meurt ; et tout ce qui est autour de lui en dépend : la pluie qui
// tombe ici, le vent (la rafale qui le précède, le vent qui tourne sur ses côtés, l'accalmie
// derrière lui), le ciel qui s'assombrit au-dessus, les éclairs qui en sortent, le bruit de
// l'averse qui approche, son écho sur le radar, ce que Jos en dit.
//
// Un grain, comme les vrais vus d'un bateau :
//  - un cœur de pluie de 1,5 à 3 km de large, plus dense à l'avant (là où l'air froid
//    descend), qui s'étire en une traîne de pluie plus fine à l'arrière ;
//  - sous lui, cet air froid tombe et s'étale sur la mer dans tous les sens : devant le
//    grain, il s'ajoute au vent, d'un coup (la rafale arrive avant la pluie) ; sur ses
//    côtés, il fait tourner le vent ; derrière lui, il s'y oppose (le vent mollit après son
//    passage) ;
//  - au-dessus, le nuage d'orage, plus large que la pluie : sous lui, il fait plus sombre ;
//  - cet air froid pèse : quand arrive la rafale, le baromètre fait un bond ;
//  - les plus forts sont pleins d'éclairs.
// Ils avancent un peu à droite du vent et un peu moins vite que lui (ils suivent le vent
// d'altitude, freinés par la mer).
//
// Ce fichier ne dessine rien : il dit où sont les grains et ce qu'ils font en chaque point
// (rendu/glsl/grains.js les dessine ; jeu/nuit.js en fait passer sur le bateau ; le radar,
// le son, la physique lisent ce qu'ils font).
import { NOEUD, angleVers } from './meteo.js';

export const REGLAGES_GRAINS = {
  portee: 15000, // on fait vivre les grains à moins de 15 km du bateau
  vitesse: 0.8, // ils avancent à 80 % de la vitesse du vent…
  derive: 10, // … et 10° à sa droite
  pluieFond: 0.5, // hors des grains, il pleut à 50 % de la pluie du moment
  rafale: 7.5, // m/s de plus dans la rafale d'un grain de force 1 (15 nœuds)
  nombre: 6, // les grains alentour, au plus fort de l'orage (sans ceux qui viennent sur nous)
  naissance: 90, // s pour se former
  mort: 110, // s pour se dissiper
  bondPression: 2.5, // hPa : le bond du baromètre sous un grain de force 1, quand arrive sa rafale
  // la pluie au cœur d'un grain de force 1 éteint la lumière à 0,6 % par mètre : on n'y voit pas
  // à plus de 500 m (rendu/grains.js : ses rideaux ; monde/feux.js : les feux qu'elle cache)
  extinctionPluie: 0.006,
};

// Le grain qui porte une trombe (celui de la bête : jeu/nuit.js). Pas un grain comme les
// autres : il traîne. Il avance moins vite que les autres, droit sous le vent (eux dérivent à
// sa droite) : il se nourrit de l'air chaud qu'il aspire devant lui, et ses nouvelles tours
// poussent à l'arrière des anciennes — les orages qui font des trombes sont souvent de ceux-là.
// Elle naît sous son avant, là où l'air chaud monte dans le nuage, et avance avec lui ; sa
// pluie s'enroule autour d'elle (le « crochet » que montrent les radars)
export const PORTEUR = {
  vitesse: 8, // m/s (les autres : 80 % du vent, 10 à 12 m/s au coucher du soleil)
  derive: 0, // ° à droite du vent (les autres : 10°)
  avant: 1.05, // la trombe : à 1,05 rayon devant son centre (son cœur dense est à 0,25)…
  cote: 0.55, // … et à moins de 0,55 rayon de son axe, d'un côté ou de l'autre
  // (son air froid s'étale derrière lui et sur ses côtés, mais guère devant : devant lui,
  // l'air chaud monte dans son nuage. Le bord de sa rafale passe à 0,85 rayon devant son
  // cœur — là où naît sa trombe, entre l'air froid qui tombe et l'air chaud qui monte —, au
  // lieu de 1,9 pour les autres grains)
  bord: 0.85,
};
// (le crochet : une bande de pluie qui part du flanc droit du cœur du grain, derrière elle,
// s'écarte sur sa droite et s'enroule devant elle — dans le sens où elle tourne, comme un
// « 6 » dont elle occupe la boucle, au sec. Des paquets de pluie : a, devant elle (m), b, à
// sa droite (m), s, leur taille (m), w, leur pluie)
const CROCHET = [
  { a: -560, b: 160, s: 200, w: 1 },
  { a: -360, b: 330, s: 170, w: 1.1 },
  { a: -110, b: 390, s: 150, w: 1.05 },
  { a: 150, b: 340, s: 135, w: 1 },
  { a: 330, b: 170, s: 120, w: 0.9 },
  { a: 370, b: -60, s: 100, w: 0.7 },
];

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Combien de grains autour de nous (0 → 1) : il y en a dès que le temps tourne à l'orage
// (d'abord épars, au loin, au coucher du soleil), et d'autant plus qu'il pleut
export function activiteDesGrains(meteo) {
  return lisse(0.25, 0.85, meteo.orage ?? 0) * (0.6 + 0.4 * lisse(0, 0.4, meteo.pluie ?? 0));
}

// La force d'un grain à son âge (0 → 1) : il se forme, vit, puis se dissipe
export function vieDuGrain(g) {
  return lisse(0, g.naissance, g.age) * (1 - lisse(g.duree - REGLAGES_GRAINS.mort, g.duree, g.age));
}

// Où est le bord de la rafale d'un grain (m, depuis son cœur dense), dans cette direction
// (devant : +1 devant lui, −1 derrière) : loin devant lui, plus près derrière — sauf pour un
// porteur (PORTEUR.bord)
export function bordDeLaRafale(g, devant) {
  const loin = g.porteur ? PORTEUR.bord : 1.9;
  return g.rayon * (1.05 + (loin - 1.05) * (0.5 + 0.5 * devant));
}

// Les paquets de pluie du crochet, dans le monde : [{ x, z, s, w, rideau }] — rideau : on le
// dessine aussi en rideau de pluie (rendu/grains.js), sauf ceux qui passent devant elle : ils
// la cacheraient à ceux qu'elle vient chercher (le radar, lui, les voit tous)
const _paquets = CROCHET.map(() => ({}));
export function paquetsDuCrochet(c) {
  CROCHET.forEach((m, k) => Object.assign(_paquets[k], {
    x: c.x + m.a * c.ux - m.b * c.uz, z: c.z + m.a * c.uz + m.b * c.ux, s: m.s, w: m.w, rideau: m.a < 100, a: m.a,
  }));
  return _paquets;
}

// La pluie du crochet au point (x, z) (sans la force du grain) ; c : { x, z (la trombe),
// ux, uz (sa route) }
export function pluieDuCrochet(c, x, z) {
  const dx = x - c.x;
  const dz = z - c.z;
  if (dx * dx + dz * dz > 1100 * 1100) return 0;
  let p = 0;
  for (const m of CROCHET) {
    // (devant : ux, uz ; sa droite : −uz, ux)
    const px = c.x + m.a * c.ux - m.b * c.uz;
    const pz = c.z + m.a * c.uz + m.b * c.ux;
    p += m.w * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (m.s * m.s));
  }
  return p;
}

export class Grains {
  constructor(graine = 1) {
    this.etatHasard = (graine * 2654435761) >>> 0;
    this.liste = [];
    this.prochainId = 1;
    this.t = 0;
    this.attente = 0; // (avant le prochain grain alentour)
    this.peuple = false;
    this.meteo = null;
    // (des grains de plus, pour un décor : sur l'écran d'accueil, deux ou trois averses à
    // l'horizon, dès que le temps tourne à l'orage)
    this.renfort = 0;
    // (la direction et la vitesse des grains, recalculées à chaque image)
    this.ux = 1;
    this.uz = 0;
    this.vitesse = 10;
  }

  // Un petit hasard reproductible (son état se garde avec la partie)
  hasard() {
    const a = (this.etatHasard = (this.etatHasard + 0x6d2b79f5) >>> 0);
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- Ils vivent ----------
  // meteo : le temps qu'il fait ; (x, z) : le bateau ; (vbx, vbz) : sa vitesse (m/s)
  maj(dt, meteo, x, z, vbx = 0, vbz = 0) {
    this.meteo = meteo;
    this.t += dt;
    this.orienter(meteo);
    if (!this.peuple) {
      this.peupler(meteo, x, z, vbx, vbz);
      this.peuple = true;
    }
    // (le vent tourne doucement : les grains suivent en une minute environ — sauf celui qui
    // a sa propre route : celui qui porte une trombe)
    const k = Math.min(1, dt / 60);
    for (const g of this.liste) {
      g.vx += ((g.route ? g.route.x : this.ux * this.vitesse) - g.vx) * k;
      g.vz += ((g.route ? g.route.z : this.uz * this.vitesse) - g.vz) * k;
      // (glisse : un petit écart à sa route, sans qu'il tourne — jeu/nuit.js s'en sert pour
      // amener le grain de la bête là où elle doit naître)
      g.x += (g.vx + (g.glisse?.x ?? 0)) * dt;
      g.z += (g.vz + (g.glisse?.z ?? 0)) * dt;
      g.age += dt;
    }
    const portee = REGLAGES_GRAINS.portee * 1.3;
    this.liste = this.liste.filter((g) => g.age < g.duree && (g.prevu || Math.hypot(g.x - x, g.z - z) < portee));
    // les grains alentour : autant qu'en veut le temps qu'il fait (ceux qui viennent sur
    // nous ne comptent pas)
    this.attente -= dt;
    const voulu = this.combienAlentour(meteo);
    const alentour = this.liste.filter((g) => !g.prevu).length;
    if (this.attente <= 0 && alentour < voulu - 0.3) {
      this.naitreAlentour(x, z, vbx, vbz, { age: 0 });
      this.attente = 12 + this.hasard() * 30;
    }
  }

  // Où vont les grains (direction et vitesse, m/s) avec ce vent
  orienter(meteo) {
    const a = angleVers(meteo.directionVent + REGLAGES_GRAINS.derive);
    this.ux = Math.cos(a);
    this.uz = Math.sin(a);
    this.vitesse = Math.max(3, meteo.vent * NOEUD * REGLAGES_GRAINS.vitesse);
  }

  // Combien de grains alentour avec ce temps (sans ceux qui viennent sur nous)
  combienAlentour(meteo) {
    return activiteDesGrains(meteo) * REGLAGES_GRAINS.nombre + this.renfort * lisse(0.2, 0.4, meteo.orage ?? 0);
  }

  // Au début (ou après un saut dans le temps) : des grains déjà là, à tous les âges
  peupler(meteo, x, z, vbx = 0, vbz = 0) {
    this.orienter(meteo);
    const n = Math.round(this.combienAlentour(meteo));
    for (let i = 0; i < n; i++) this.naitreAlentour(x, z, vbx, vbz, { partout: true });
  }

  vider() {
    this.liste = [];
    this.peuple = false;
  }

  // Un grain alentour : au vent de nous le plus souvent (il viendra), entre 3,5 km et la
  // portée ; jamais sur notre route (il passe à plus de 1,8 km de nous : ceux qui viennent
  // sur nous sont lancés exprès, voir lancer)
  naitreAlentour(x, z, vbx, vbz, { partout = false, age = null } = {}) {
    const portee = REGLAGES_GRAINS.portee;
    const auVent = Math.atan2(-this.uz, -this.ux);
    for (let essai = 0; essai < 8; essai++) {
      const a = partout || this.hasard() < 0.3 ? this.hasard() * Math.PI * 2 : auVent + (this.hasard() - 0.5) * 2.6;
      const r = 3500 + this.hasard() * (portee - 3500);
      const gx = x + Math.cos(a) * r;
      const gz = z + Math.sin(a) * r;
      // (le point de sa route le plus proche de nous, s'il vient vers nous)
      const wx = this.ux * this.vitesse - vbx;
      const wz = this.uz * this.vitesse - vbz;
      const w2 = Math.max(1e-6, wx * wx + wz * wz);
      const t = -((gx - x) * wx + (gz - z) * wz) / w2;
      const cpa = t > 0 ? Math.hypot(gx - x + wx * t, gz - z + wz * t) : r;
      if (cpa < 1800) continue;
      const duree = 420 + this.hasard() * 600;
      return this.creer({
        x: gx, z: gz,
        rayon: 600 + this.hasard() * 700,
        force: 0.45 + this.hasard() * 0.5,
        orage: this.hasard() < 0.55 ? 0.2 + this.hasard() * 0.8 : 0,
        duree,
        age: age ?? REGLAGES_GRAINS.naissance + this.hasard() * (duree * 0.6),
      });
    }
    return null;
  }

  // Un grain qui viendra sur le bateau (x, z), dans « dans » secondes : il naît au vent,
  // à la bonne distance, et passe à « ecart » mètres de l'endroit où sera le bateau s'il
  // garde sa route (à demi-vitesse : il peut ralentir, tourner). Son cœur le plus dense
  // arrive à l'heure dite ; sa rafale, une minute avant.
  lancer({ x, z, vbx = 0, vbz = 0, dans = 240, force = 0.8, orage = 0.6, ecart = 0, rayon = null }) {
    if (this.meteo) this.orienter(this.meteo);
    const R = rayon ?? 650 + force * 450;
    const cx = x + vbx * dans * 0.5;
    const cz = z + vbz * dans * 0.5;
    const lx = -this.uz;
    const lz = this.ux;
    const d = this.vitesse * dans + 0.25 * R;
    return this.creer({
      x: cx - this.ux * d + lx * ecart,
      z: cz - this.uz * d + lz * ecart,
      rayon: R, force, orage, prevu: true,
      duree: dans + 330,
      naissance: Math.min(REGLAGES_GRAINS.naissance, dans * 0.6),
    });
  }

  // Un grain qui porte une trombe (PORTEUR) : (x, z) là où elle est, sous son avant ; (ux,
  // uz) sa route ; cote : où elle est sur son avant (−1 → 1, de sa gauche à sa droite). Il
  // est déjà formé (âge), et vit jusqu'à « duree »
  porteur({ x, z, ux, uz, cote = 0, force = 0.6, orage = 1, age = 150, duree = 700 }) {
    const P = PORTEUR;
    const R = 650 + force * 450;
    const b = cote * P.cote;
    const g = this.creer({
      x: x - (P.avant * ux - b * uz) * R,
      z: z - (P.avant * uz + b * ux) * R,
      rayon: R, force, orage, duree, age, prevu: true,
    });
    g.vx = ux * P.vitesse;
    g.vz = uz * P.vitesse;
    g.route = { x: g.vx, z: g.vz };
    g.porteur = true;
    return g;
  }

  // Un point de l'avant d'un grain (là où naît la trombe d'un porteur) : b, en rayons, de sa
  // gauche (−) à sa droite (+)
  avant(g, b = 0, sortie = {}) {
    const v = Math.hypot(g.vx, g.vz) || 1;
    const ux = g.vx / v;
    const uz = g.vz / v;
    sortie.x = g.x + (PORTEUR.avant * ux - b * uz) * g.rayon;
    sortie.z = g.z + (PORTEUR.avant * uz + b * ux) * g.rayon;
    return sortie;
  }

  creer({ x, z, rayon, force, orage, duree, age = 0, naissance = REGLAGES_GRAINS.naissance, prevu = false }) {
    const h = () => this.hasard();
    const g = {
      id: this.prochainId++,
      x, z, vx: this.ux * this.vitesse, vz: this.uz * this.vitesse,
      rayon, force, orage, age, duree, naissance, prevu,
      // le cœur en morceaux, dans le repère de sa route (en rayons : a vers l'avant, b sur
      // le côté ; s : la taille ; w : la pluie) — devant le plus dense, derrière la traîne
      noyaux: [
        { a: 0.25, b: (h() - 0.5) * 0.3, s: 0.55 + h() * 0.15, w: 1 },
        { a: -0.45 - h() * 0.25, b: (h() - 0.5) * 0.7, s: 0.7 + h() * 0.2, w: 0.45 + h() * 0.2 },
      ],
      // le rideau de pluie penche : le vent la pousse en tombant (le haut est en arrière ;
      // en mètres par mètre de hauteur)
      penche: 0.2 + h() * 0.3,
      graine: h(),
      // (ce que la nuit en a déjà fait : annoncé, senti, passé)
      faits: {},
    };
    if (h() < 0.6) g.noyaux.push({ a: (h() - 0.5) * 0.8, b: (h() < 0.5 ? -1 : 1) * (0.45 + h() * 0.35), s: 0.45 + h() * 0.2, w: 0.35 + h() * 0.3 });
    this.liste.push(g);
    return g;
  }

  // ---------- Ce qu'ils font en un point ----------
  // La force d'un grain maintenant (0 → 1)
  intensite(g) { return g.force * vieDuGrain(g); }

  // Où est un morceau de son cœur (m, dans le monde)
  noyau(g, n, sortie = {}) {
    const v = Math.hypot(g.vx, g.vz) || 1;
    const ux = g.vx / v;
    const uz = g.vz / v;
    sortie.x = g.x + (n.a * ux - n.b * uz) * g.rayon;
    sortie.z = g.z + (n.a * uz + n.b * ux) * g.rayon;
    sortie.s = n.s * g.rayon;
    return sortie;
  }

  // La pluie d'un grain au point (x, z) : 0 → 1 et plus (au cœur, ses morceaux s'ajoutent)
  pluieDuGrain(g, x, z, I = this.intensite(g)) {
    if (I <= 0) return 0;
    const dx = x - g.x;
    const dz = z - g.z;
    if (dx * dx + dz * dz > (g.rayon * 2.6) ** 2) return 0;
    let p = 0;
    const q = this._q ??= {};
    for (const n of g.noyaux) {
      this.noyau(g, n, q);
      p += n.w * Math.exp(-((x - q.x) ** 2 + (z - q.z) ** 2) / (q.s * q.s));
    }
    // (sous l'avant d'un porteur, la pluie qui s'enroule autour de sa trombe)
    const c = g.crochet;
    if (c && c.force > 0) p += c.force * pluieDuCrochet(c, x, z);
    return I * p;
  }

  // La pluie de partout, hors des grains (0 → 1)
  pluieFond() { return (this.meteo?.pluie ?? 0) * REGLAGES_GRAINS.pluieFond; }

  // La pluie des grains seuls au point (x, z), 0 → 1
  pluieDesGrains(x, z) {
    let sec = 1;
    for (const g of this.liste) sec *= 1 - Math.min(1, this.pluieDuGrain(g, x, z));
    return 1 - sec;
  }

  // La pluie au point (x, z), 0 → 1 : celle de partout, et celle des grains
  pluieEn(x, z) {
    const fond = this.pluieFond();
    return fond + (1 - fond) * this.pluieDesGrains(x, z);
  }

  // Le vent d'un grain au point (x, z) (m/s, à ajouter au vent) : l'air froid qui tombe sous
  // son cœur et s'étale. Son bord (le « front de rafale ») est loin devant lui, plus près
  // derrière ; il souffle fort jusqu'à son bord, puis plus rien ; faiblement juste sous le
  // cœur (l'air y descend) ; plus fort devant (le grain le pousse) que derrière.
  // Rend aussi l'agitation (0 → 1 : les bourrasques, sous le grain)
  ventDuGrain(g, x, z, sortie, I = this.intensite(g)) {
    if (I <= 0.01) return 0;
    const c = this.noyau(g, g.noyaux[0], this._c ??= {});
    const dx = x - c.x;
    const dz = z - c.z;
    const r = Math.hypot(dx, dz);
    const R = g.rayon;
    if (r > R * 2.4) return 0;
    const v = Math.hypot(g.vx, g.vz) || 1;
    const devant = r > 1 ? (dx * g.vx + dz * g.vz) / (r * v) : 0; // +1 : devant lui, −1 : derrière
    const bord = bordDeLaRafale(g, devant);
    const dedans = 1 - lisse(bord - 0.15 * R, bord + 0.2 * R, r);
    if (dedans <= 0) return 0;
    const U = I * REGLAGES_GRAINS.rafale * dedans * (0.3 + 0.7 * lisse(0, 0.6 * R, r)) * (0.4 + 0.6 * (0.5 + 0.5 * devant));
    if (r > 1) {
      sortie.x += (dx / r) * U;
      sortie.z += (dz / r) * U;
    }
    return I * dedans;
  }

  // La pression sous un grain au point (x, z) (hPa, à ajouter) : l'air froid qui tombe sous
  // son cœur est plus lourd ; la pression fait un bond d'un à trois hectopascals quand arrive
  // sa rafale (son bord est celui de la rafale : ventDuGrain), reste haute sous la pluie, puis
  // retombe derrière lui, un peu plus bas qu'avant (le sillage du grain)
  pressionDuGrain(g, x, z, I = this.intensite(g)) {
    if (I <= 0.01) return 0;
    const c = this.noyau(g, g.noyaux[0], this._c ??= {});
    const dx = x - c.x;
    const dz = z - c.z;
    const r = Math.hypot(dx, dz);
    const R = g.rayon;
    if (r > R * 4) return 0;
    const v = Math.hypot(g.vx, g.vz) || 1;
    const devant = r > 1 ? (dx * g.vx + dz * g.vz) / (r * v) : 0;
    const bord = bordDeLaRafale(g, devant);
    const dedans = 1 - lisse(bord - 0.15 * R, bord + 0.2 * R, r);
    const haute = REGLAGES_GRAINS.bondPression * I * dedans * (0.55 + 0.45 * Math.exp(-((r / R) ** 2)));
    const derriere = lisse(-0.2, -0.8, devant) * (1 - dedans) * (1 - lisse(2 * R, 4 * R, r));
    return haute - 0.7 * I * derriere;
  }

  // La pression des grains au point (x, z) (hPa, à ajouter à celle du large)
  pressionEn(x, z) {
    let p = 0;
    for (const g of this.liste) p += this.pressionDuGrain(g, x, z);
    return p;
  }

  // Le vent des grains au point (x, z) (m/s, à ajouter au vent)
  ventEn(x, z, sortie) {
    sortie.x = 0;
    sortie.y = 0;
    sortie.z = 0;
    for (const g of this.liste) this.ventDuGrain(g, x, z, sortie);
    return sortie;
  }

  // Tout ce qu'ils font au point (x, z), en une fois :
  //   pluie (0 → 1), vent { x, z } (m/s à ajouter), agitation (0 → 1 : les bourrasques),
  //   ombre (0 → 1 : sous leur nuage), approche (0 → 1 : une averse arrive, on l'entend),
  //   grain : celui qui compte le plus ici (ou null)
  mesurer(x, z, sortie = {}) {
    const vent = (sortie.vent ??= { x: 0, y: 0, z: 0 });
    vent.x = 0;
    vent.y = 0;
    vent.z = 0;
    let sec = 1;
    let agitation = 0;
    let ombre = 0;
    let approche = 0;
    let meilleur = 0;
    sortie.grain = null;
    for (const g of this.liste) {
      const I = this.intensite(g);
      if (I <= 0) continue;
      const p = Math.min(1, this.pluieDuGrain(g, x, z, I));
      sec *= 1 - p;
      agitation = Math.max(agitation, this.ventDuGrain(g, x, z, vent, I));
      // (son nuage déborde loin devant lui — l'enclume, poussée par le vent d'altitude —,
      // moins derrière : le ciel s'assombrit bien avant la rafale)
      const r = Math.hypot(x - g.x, z - g.z);
      const v = Math.hypot(g.vx, g.vz) || 1;
      const devant = r > 1 ? ((x - g.x) * g.vx + (z - g.z) * g.vz) / (r * v) : 0;
      ombre = Math.max(ombre, I * (1 - lisse(0.8 * g.rayon, 2.6 * g.rayon, r / (1 + 0.35 * devant))));
      // (l'averse qui arrive : on l'entend gronder sur la mer avant qu'elle soit là — d'autant
      // plus qu'elle est près, et seulement de ce côté-là : devant elle)
      const c = this.noyau(g, g.noyaux[0], this._c ??= {});
      const bord = Math.hypot(x - c.x, z - c.z) - 0.8 * g.rayon;
      // (plus fort devant lui ; le passage de devant à derrière se fait en douceur, selon où
      // l'on est le long de sa route — même quand son centre passe juste sur nous)
      const leLong = ((x - g.x) * g.vx + (z - g.z) * g.vz) / v;
      const vers = 0.35 + 0.65 * lisse(-0.3 * g.rayon, 0.3 * g.rayon, leLong);
      approche = Math.max(approche, I * vers * lisse(900, 80, bord));
      const compte = Math.max(p, I * (1 - lisse(0.5 * g.rayon, 3 * g.rayon, r)) * 0.5);
      if (compte > meilleur) { meilleur = compte; sortie.grain = g; }
    }
    const fond = (this.meteo?.pluie ?? 0) * REGLAGES_GRAINS.pluieFond;
    sortie.pluie = fond + (1 - fond) * (1 - sec);
    sortie.agitation = agitation;
    sortie.ombre = Math.min(1, ombre);
    sortie.approche = approche;
    return sortie;
  }

  // Le grain le plus menaçant pour un bateau en (x, z), à la vitesse (vbx, vbz) : celui
  // qui passera le plus près de lui dans les minutes qui viennent. Rend { grain, distance
  // (m, à son cœur), cpa (m : au plus près), dans (s : quand) } ou null
  menace(x, z, vbx = 0, vbz = 0, { horizon = 420, cpaMax = 1500 } = {}) {
    let meilleur = null;
    for (const g of this.liste) {
      if (g.force * (g.age < g.naissance ? 1 : vieDuGrain(g)) < 0.3) continue;
      const c = this.noyau(g, g.noyaux[0], this._c ??= {});
      const rx = c.x - x;
      const rz = c.z - z;
      const wx = g.vx - vbx;
      const wz = g.vz - vbz;
      const w2 = Math.max(1e-6, wx * wx + wz * wz);
      const t = Math.max(0, -(rx * wx + rz * wz) / w2);
      if (t > horizon) continue;
      const cpa = Math.hypot(rx + wx * t, rz + wz * t);
      if (cpa > cpaMax) continue;
      if (!meilleur || t < meilleur.dans) meilleur = { grain: g, distance: Math.hypot(rx, rz), cpa, dans: t };
    }
    return meilleur;
  }

  // ---------- La partie gardée ----------
  instantane() {
    return {
      etatHasard: this.etatHasard, t: this.t, attente: this.attente, prochainId: this.prochainId, peuple: this.peuple,
      liste: this.liste.map(copieGrain),
    };
  }

  restaurer(s) {
    if (!s) return;
    Object.assign(this, {
      etatHasard: s.etatHasard, t: s.t, attente: s.attente, prochainId: s.prochainId, peuple: s.peuple,
      liste: s.liste.map(copieGrain),
    });
  }
}

function copieGrain(g) {
  return {
    ...g, noyaux: g.noyaux.map((n) => ({ ...n })), faits: { ...g.faits },
    route: g.route && { ...g.route }, crochet: g.crochet && { ...g.crochet }, glisse: g.glisse && { ...g.glisse },
  };
}
