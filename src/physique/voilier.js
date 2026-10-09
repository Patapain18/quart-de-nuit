// La physique du voilier : ce qui le fait flotter, pencher, avancer et tourner.
//
// Le bateau est un « solide » : une position, une vitesse, une orientation et une
// vitesse de rotation. À chaque pas de temps (240 par seconde), on additionne toutes
// les forces qui s'exercent sur lui, puis on le fait bouger (2e loi de Newton).
//
// Les forces :
//  1. Son poids, au centre de gravité (bas, grâce aux 1 400 kg de plomb du bulbe).
//  2. La poussée d'Archimède : la coque est découpée en ~300 petits volumes ; chacun
//     est poussé vers le haut s'il est sous l'eau (à proportion de ce qui trempe).
//     C'est ce qui fait tanguer et rouler le bateau sur les vagues, et qui le redresse
//     quand il penche (le côté qui s'enfonce pousse plus fort).
//  3. Le freinage de l'eau sur ces volumes quand ils montent ou descendent.
//  4. La résistance de la coque vers l'avant : elle grimpe très vite au-delà de la
//     « vitesse de coque » (~7 nœuds), quand le bateau creuse sa propre vague.
//  5. La quille et le safran sont des ailes sous l'eau : la quille empêche le bateau de
//     glisser de côté (la « dérive »), le safran le fait tourner.
//  6. Les voiles sont des ailes dans le vent : leur force dépend du vent apparent (le
//     vent réel moins la vitesse du bateau) et de l'angle sous lequel il les frappe.
//     La bôme et le foc tournent librement jusqu'à la limite de leur écoute.
//  7. Les déferlantes : par gros temps, la crête d'une vague s'écroule sur le bateau. Elle
//     le pousse du côté d'où elle vient, haut sur la coque : de travers, elle le couche ;
//     par l'arrière, elle le pousse et fait chasser l'arrière ; de face, elle le freine.
//  8. L'eau embarquée (dans la cale, dans le cockpit) : elle pèse, et elle court vers le
//     côté qui penche (« l'effet de carène liquide ») : un bateau plein d'eau gîte plus,
//     se redresse mal et s'enfonce.
//
// Ce fichier n'utilise que les outils mathématiques de Three (vecteurs, rotations) :
// il tourne aussi dans Node, pour les tests et la « polaire » (scripts/polaire.js).
import { Vector3, Quaternion } from 'three';
import {
  COQUE, ROUF, MAT, COCKPIT, TIMONERIE, ECHELLE, zDe, fondCoque, hauteurLivet, demiLargeurA, bordInterieur, hauteurRouf, hauteurPont,
} from '../bateau/forme.js';

// (les mesures prises à la main sur l'ancien bateau de 9,40 m, mises à la taille de celui-ci :
// L dans le sens de la longueur, B de la largeur, H de la hauteur)
const L = ECHELLE.longueur;
const B = ECHELLE.largeur;
const H = ECHELLE.hauteur;

const RHO_EAU = 1025;
const RHO_AIR = 1.225;
const G = 9.81;
const NOEUD = 0.5144;
const HAUT = new Vector3(0, 1, 0);
// La poussée d'une grosse déferlante (force 1) : de quoi coucher le bateau s'il la prend
// de travers (l'eau d'une crête de 2 m qui arrive à 7 m/s : ~80 kN pendant 0,7 s sur l'ancien
// bateau de 9,40 m). Elle trouve ici un bordé deux fois plus grand, et un bateau qui résiste
// cinq fois plus au roulis (presque trois fois plus lourd, et plus large) : × 1,75 de plus,
// pour que de travers elle le couche comme l'ancien — les crêtes de cette nuit ne sont pas
// plus petites parce que le bateau est plus grand
const POUSSEE_DEFERLANTE = 80000 * L * H * 1.75;
// Le foc ne peut pas être bordé plus près de l'axe que ses rails, sur le pont (~10°)
export const ANGLE_MIN_FOC = 0.17;

// ---------- Les volumes de la coque ----------
// Chaque volume : centre (repère du bateau), volume (m³), taille (m), surface pour le
// freinage vertical.
function decouperCoque() {
  const volumes = [];
  const nu = 12;
  const ny = 7;
  for (let i = 0; i < nu; i++) {
    const u0 = i / nu;
    const u1 = (i + 1) / nu;
    const uc = (u0 + u1) / 2;
    const dz = Math.abs(zDe(u1) - zDe(u0));
    const bas = fondCoque(uc);
    const haut = hauteurLivet(uc);
    if (haut <= bas) continue;
    const dy = (haut - bas) / ny;
    for (let j = 0; j < ny; j++) {
      const yc = bas + (j + 0.5) * dy;
      const w = demiLargeurA(uc, yc);
      if (w <= 0.01) continue;
      // deux cellules par côté : leur écart à l'axe donne la bonne stabilité en roulis
      for (const cote of [-1, 1]) {
        for (const f of [0.25, 0.75]) {
          volumes.push({
            c: new Vector3(cote * w * f, yc, zDe(uc)),
            v: (w / 2) * dy * dz,
            taille: new Vector3(w / 2, dy, dz),
            surface: (w / 2) * dz,
          });
        }
      }
    }
  }
  // le rouf (une cabine fermée : elle flotte quand le bateau se couche)
  for (let i = 0; i < 4; i++) {
    const uc = ROUF.uArriere + ((i + 0.5) / 4) * (ROUF.uAvant - ROUF.uArriere);
    const e = bordInterieur(uc) - ROUF.rentree / 2;
    const dz = Math.abs(zDe(ROUF.uAvant) - zDe(ROUF.uArriere)) / 4;
    const y0 = hauteurPont(uc, e);
    const h = hauteurRouf(uc, 0) - y0;
    for (const cote of [-1, 1]) {
      volumes.push({ c: new Vector3(cote * e / 2, y0 + h / 2, zDe(uc)), v: e * h * dz, taille: new Vector3(e, h, dz), surface: e * dz });
    }
  }
  // la timonerie (fermée elle aussi : quand le bateau se couche, elle flotte, et l'aide à
  // se redresser, comme sur les vrais voiliers à timonerie)
  for (let i = 0; i < 3; i++) {
    const z = TIMONERIE.zArriere + ((i + 0.5) / 3) * (TIMONERIE.zAvant + 0.1 - TIMONERIE.zArriere);
    const u = (z - COQUE.zArriere) / (COQUE.zAvant - COQUE.zArriere);
    const e = bordInterieur(u) - ROUF.rentree - 0.04;
    const dz = Math.abs(TIMONERIE.zAvant + 0.1 - TIMONERIE.zArriere) / 3;
    const y0 = hauteurRouf(u, e);
    const h = TIMONERIE.toit - y0;
    for (const cote of [-1, 1]) {
      volumes.push({ c: new Vector3(cote * e / 2, y0 + h / 2, z), v: e * h * dz, taille: new Vector3(e, h, dz), surface: e * dz });
    }
  }
  // l'aileron de quille et le bulbe (toujours sous l'eau, sauf si le bateau chavire)
  volumes.push({ c: new Vector3(0, -0.92 * H, -0.15 * L), v: 0.11 * L * B * H, taille: new Vector3(0.12 * B, 1.25 * H, 1.0 * L), surface: 0.12 * L * B });
  volumes.push({ c: new Vector3(0, -1.6 * H, -0.12 * L), v: 0.091 * L * B * H, taille: new Vector3(0.34 * B, 0.3 * H, 1.7 * L), surface: 0.5 * L * B });
  return volumes;
}

// ---------- Les coefficients des voiles ----------
// Pour une voile souple bien creusée, selon l'angle d'incidence α (degrés) entre le vent
// apparent et la corde de la voile : la portance (CL, perpendiculaire au vent) monte
// jusqu'à ~25°, puis la voile « décroche » ; la traînée (CD, dans le sens du vent) grandit.
const TABLE_VOILE = [
  // α, CL, CD
  [0, 0.0, 0.05], [5, 0.45, 0.06], [10, 0.9, 0.09], [15, 1.22, 0.14], [20, 1.42, 0.2],
  [25, 1.48, 0.28], [30, 1.38, 0.37], [45, 1.1, 0.62], [60, 0.8, 0.88], [90, 0.1, 1.2],
  [120, -0.4, 1.1], [150, -0.35, 0.75], [180, 0, 0.5],
];
export function coefficientsVoile(alphaDeg) {
  const a = Math.min(180, Math.abs(alphaDeg));
  for (let i = 1; i < TABLE_VOILE.length; i++) {
    if (a <= TABLE_VOILE[i][0]) {
      const [a0, l0, d0] = TABLE_VOILE[i - 1];
      const [a1, l1, d1] = TABLE_VOILE[i];
      const t = (a - a0) / (a1 - a0);
      return { cl: l0 + (l1 - l0) * t, cd: d0 + (d1 - d0) * t };
    }
  }
  return { cl: 0, cd: 0.5 };
}

// Résistance de vagues de la coque (rapport à son poids) selon le nombre de Froude
// Fn = V / √(g·L) : presque rien à petite vitesse, un mur vers Fn = 0,45 (~7,5 nœuds).
// (un croiseur ne déjauge pas : au-delà, la résistance continue de grimper, et il ne
// dépasse les 10-11 nœuds qu'en surfant une vague)
const TABLE_VAGUES = [[0, 0], [0.1, 0.0001], [0.2, 0.0008], [0.25, 0.0015], [0.3, 0.003], [0.35, 0.0062], [0.4, 0.013], [0.45, 0.028], [0.5, 0.045], [0.55, 0.06], [0.6, 0.085], [0.7, 0.13], [0.8, 0.18], [1.0, 0.28]];
function resistanceVagues(fn) {
  const f = Math.min(1.0, Math.abs(fn));
  for (let i = 1; i < TABLE_VAGUES.length; i++) {
    if (f <= TABLE_VAGUES[i][0]) {
      const [a, b] = TABLE_VAGUES[i - 1];
      const [c, d] = TABLE_VAGUES[i];
      return b + ((d - b) * (f - a)) / (c - a);
    }
  }
  return 0.28;
}

// Une aile sous l'eau (quille, safran) : w = vitesse de l'eau par rapport à l'aile,
// corde = direction du bord d'attaque vers le bord de fuite (dans le plan horizontal du
// bateau). La force pousse l'aile dans le sens où l'eau la traverse (perpendiculairement
// à la corde), plus une petite traînée dans le sens de l'eau.
const _n = new Vector3();
function forceAile(w, corde, surface, pente, cd0, sortie) {
  const vitesse2 = w.x * w.x + w.z * w.z;
  sortie.set(0, 0, 0);
  if (vitesse2 < 1e-6) return sortie;
  const vitesse = Math.sqrt(vitesse2);
  _n.set(corde.z, 0, -corde.x); // normale à la corde
  const wn = (w.x * _n.x + w.z * _n.z) / vitesse;
  const wc = (w.x * corde.x + w.z * corde.z) / vitesse;
  const alpha = Math.atan2(Math.abs(wn), Math.abs(wc)); // 0 → 90°
  // portance linéaire jusqu'au décrochage (vers 15°, où elle atteint ~1,1), puis elle
  // retombe vers celle d'une plaque plane
  const lineaire = Math.min(pente * Math.sin(alpha), 1.12);
  const plaque = 1.25 * Math.sin(alpha) + 0.55 * Math.max(0, 1 - alpha / 0.6);
  const decroche = Math.min(1, Math.max(0, (alpha - 0.26) / 0.18));
  const cn = lineaire + (plaque - lineaire) * decroche * decroche * (3 - 2 * decroche);
  const q = 0.5 * RHO_EAU * surface * vitesse2;
  const signe = wn >= 0 ? 1 : -1;
  sortie.x = _n.x * signe * cn * q + (w.x / vitesse) * cd0 * q;
  sortie.z = _n.z * signe * cn * q + (w.z / vitesse) * cd0 * q;
  return sortie;
}

export class PhysiqueVoilier {
  constructor() {
    this.volumes = decouperCoque();
    // Le bateau flotte à sa ligne de flottaison : sa masse vaut le poids de l'eau
    // déplacée par la partie de la coque sous y = 0 (et le centre de gravité est sous
    // le centre de carène, avec le plomb du bulbe)
    let v0 = 0;
    const carene = new Vector3();
    for (const e of this.volumes) {
      const bas = e.c.y - e.taille.y / 2;
      const f = Math.min(1, Math.max(0, (0 - bas) / e.taille.y));
      v0 += e.v * f;
      carene.addScaledVector(e.c, e.v * f);
    }
    carene.divideScalar(v0);
    this.deplacement = v0; // m³
    this.masse = RHO_EAU * v0; // kg
    this.centreCarene = carene.clone();
    this.centreGravite = new Vector3(0, -0.24 * H, carene.z);
    // inertie (rayons de giration réalistes pour un voilier de 14 m, mât compris)
    const m = this.masse;
    this.inertie = new Vector3(m * (2.25 * L) ** 2, m * (2.15 * L) ** 2, m * (1.32 * B) ** 2); // tangage, lacet, roulis
    // (les amortissements de l'ancien bateau, pour des mouvements semblables : un couple
    // d'amortissement grandit comme l'inertie, divisée par le temps, qui s'allonge comme la
    // racine de la taille)
    this.echelleMasse = m / 4900;
    this.inertieInverse = new Vector3(1 / this.inertie.x, 1 / this.inertie.y, 1 / this.inertie.z);

    // état (repère du monde) : position du centre de gravité, vitesse, orientation, rotation
    this.position = new Vector3(0, this.centreGravite.y, 0);
    this.vitesse = new Vector3();
    this.orientation = new Quaternion();
    this.rotation = new Vector3();

    // les commandes
    this.barre = 0; // angle du safran (rad) : + = bord de fuite vers tribord → on tourne à tribord
    this.ecouteGV = 0.35; // angle maximal que l'écoute laisse à la bôme (rad)
    this.ecouteFoc = 0.3;
    this.ris = 0;
    this.deroule = 1;
    // pièces mobiles
    this.angleBome = 0.3;
    this.vitesseBome = 0;
    this.angleFoc = 0.25;
    this.vitesseFoc = 0;

    // le vent (repère du monde) et ce qu'on en mesure à bord
    this.ventReel = new Vector3();
    this.mesures = {
      vitesse: 0, cap: 0, gite: 0, assiette: 0, derive: 0,
      ventApparent: 0, angleVentApparent: 0, angleVentReel: 0,
      incidenceGV: 0, incidenceFoc: 0, forceVoiles: 0, impactEtrave: 0,
    };

    // une déferlante en train de frapper (voir deferlante())
    this.choc = null;
    // l'eau embarquée (kg, autant que de litres) et les avaries de la nuit
    this.eauCale = 0;
    this.eauCockpit = 0;
    this.ecouteFocLibre = false; // l'écoute de foc a cassé : le foc bat au vent
    this.grandVoileDechiree = false;
    this.focDechire = false;

    // la grille de hauteurs d'eau autour du bateau (relevée une fois par image) : toute la
    // coque, et 50 cm de plus de chaque côté (un point tous les 95 cm environ)
    this.grille = {
      nx: 5, nz: 17, x0: -COQUE.demiLargeurMax - 0.25, x1: COQUE.demiLargeurMax + 0.25, z0: COQUE.zAvant - 0.5, z1: COQUE.zArriere + 0.5,
      h: new Float32Array(85), avant: new Float32Array(85), pret: false,
    };
    this._tmp = { a: new Vector3(), b: new Vector3(), c: new Vector3(), d: new Vector3(), e: new Vector3(), f: new Vector3(), q: new Quaternion() };
  }

  // Place le bateau (position de l'origine du bateau, cap en degrés)
  placer(x, z, capDeg, houle) {
    this.orientation.setFromAxisAngle(HAUT, -capDeg * Math.PI / 180);
    const h = houle ? houle.hauteur(x, z) : 0;
    const cg = this.centreGravite.clone().applyQuaternion(this.orientation);
    this.position.set(x + cg.x, h + cg.y, z + cg.z);
    this.vitesse.set(0, 0, 0);
    this.rotation.set(0, 0, 0);
    this.grille.pret = false;
  }

  // Une déferlante frappe : vers = la direction (horizontale, dans le monde) où va la
  // vague ; force : 0 → 1. Renvoie l'angle (degrés) d'où elle arrive, par rapport à
  // l'étrave (0 : de face, 90 : de travers, 180 : de l'arrière).
  // levier : où elle frappe (1 : une crête de quelques mètres, sur la hanche ou l'épaule ;
  // moins : une crête si longue qu'elle frappe toute la coque à la fois — celle d'une
  // vague scélérate) ; duree : le temps qu'elle pousse (s)
  deferlante(vers, force, { levier = 1, duree = 0.7 } = {}) {
    const v = vers.clone().setY(0).normalize();
    this.choc = { vers: v, force, t: 0, duree, levier };
    const local = v.clone().applyQuaternion(this.orientation.clone().invert());
    return (Math.atan2(Math.abs(local.x), local.z) * 180) / Math.PI;
  }

  // Origine du bateau (pour le modèle 3D) = centre de gravité − décalage tourné
  origine(sortie) {
    return sortie.copy(this.centreGravite).applyQuaternion(this.orientation).negate().add(this.position);
  }

  // Le cap (degrés, 0 = nord) et la direction de l'avant dans le monde
  get avant() { return new Vector3(0, 0, -1).applyQuaternion(this.orientation); }

  // Relève la hauteur de l'eau sous et autour du bateau (une fois par image)
  releverEau(houle, dt) {
    const g = this.grille;
    const avant = this.avant;
    const cap = Math.atan2(avant.x, -avant.z);
    g.cos = Math.cos(cap);
    g.sin = Math.sin(cap);
    const o = this.origine(this._tmp.a);
    g.ox = o.x;
    g.oz = o.z;
    g.avant.set(g.h);
    for (let j = 0; j < g.nz; j++) {
      const z = g.z0 + ((g.z1 - g.z0) * j) / (g.nz - 1);
      for (let i = 0; i < g.nx; i++) {
        const x = g.x0 + ((g.x1 - g.x0) * i) / (g.nx - 1);
        // (x, z) du bateau → monde, en ne tenant compte que du cap
        const wx = g.ox + x * g.cos - z * g.sin;
        const wz = g.oz + x * g.sin + z * g.cos;
        g.h[j * g.nx + i] = houle.hauteur(wx, wz);
      }
    }
    if (!g.pret) g.avant.set(g.h);
    g.dt = dt;
    g.pret = true;
  }

  // Hauteur de l'eau (et sa vitesse verticale) au point (x, z) du monde, lue dans la grille
  eauEn(wx, wz, sortie) {
    const g = this.grille;
    const dx = wx - g.ox;
    const dz = wz - g.oz;
    const x = dx * g.cos + dz * g.sin;
    const z = -dx * g.sin + dz * g.cos;
    const fx = Math.min(g.nx - 1.001, Math.max(0, ((x - g.x0) / (g.x1 - g.x0)) * (g.nx - 1)));
    const fz = Math.min(g.nz - 1.001, Math.max(0, ((z - g.z0) / (g.z1 - g.z0)) * (g.nz - 1)));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const lire = (t) => {
      const a = t[j * g.nx + i] + (t[j * g.nx + i + 1] - t[j * g.nx + i]) * tx;
      const b = t[(j + 1) * g.nx + i] + (t[(j + 1) * g.nx + i + 1] - t[(j + 1) * g.nx + i]) * tx;
      return a + (b - a) * tz;
    };
    sortie.h = lire(g.h);
    // (bornée : si la mer change de forme d'un coup — un nouveau temps —, la différence
    // entre deux images n'est pas une vitesse ; les vraies vagues montent à 2 à 5 m/s)
    sortie.vy = Math.max(-8, Math.min(8, (sortie.h - lire(g.avant)) / Math.max(g.dt, 1e-3)));
    return sortie;
  }

  // Une image de simulation (dt ≈ 1/60 s), découpée en petits pas
  avancer(dt, houle, ventReel, pas = 4) {
    this.ventReel.copy(ventReel);
    this.releverEau(houle, dt);
    // (garde-fou : si un calcul déraille — des nombres qui n'en sont plus —, on revient au
    // dernier état sain, le bateau arrêté, plutôt que de le perdre pour toujours)
    const sain = this._sain ??= { position: new Vector3(), orientation: new Quaternion() };
    sain.position.copy(this.position);
    sain.orientation.copy(this.orientation);
    const h = dt / pas;
    for (let k = 0; k < pas; k++) this.pas(h);
    if (!Number.isFinite(this.position.x + this.position.y + this.position.z + this.orientation.w + this.vitesse.x + this.rotation.x)) {
      this.position.copy(sain.position);
      this.orientation.copy(sain.orientation);
      this.vitesse.set(0, 0, 0);
      this.rotation.set(0, 0, 0);
      this.grille.pret = false;
      this.reprises = (this.reprises ?? 0) + 1; // (les tests vérifient que ça n'arrive jamais)
    }
    this.mesurer();
  }

  pas(dt) {
    const T = this._tmp;
    const q = this.orientation;
    const qInv = T.q.copy(q).invert();
    const force = new Vector3(0, -this.masse * G, 0);
    const couple = new Vector3();
    // axes du bateau dans le monde (pour la hauteur verticale de chaque volume penché)
    const ax = new Vector3(1, 0, 0).applyQuaternion(q);
    const ay = new Vector3(0, 1, 0).applyQuaternion(q);
    const az = new Vector3(0, 0, 1).applyQuaternion(q);
    const cg = this.position;
    const eau = { h: 0, vy: 0 };
    const p = T.a;
    const r = T.b;
    const v = T.c;
    const f = T.d;

    // 2-3. Poussée d'Archimède et freinage vertical, volume par volume
    let immerge = 0;
    for (const e of this.volumes) {
      r.copy(e.c).sub(this.centreGravite).applyQuaternion(q); // du centre de gravité au volume
      p.copy(r).add(cg);
      this.eauEn(p.x, p.z, eau);
      // demi-hauteur verticale du volume penché (boîte tournée)
      const demi = 0.5 * (Math.abs(ax.y) * e.taille.x + Math.abs(ay.y) * e.taille.y + Math.abs(az.y) * e.taille.z);
      const fraction = Math.min(1, Math.max(0, (eau.h - (p.y - demi)) / (2 * demi)));
      if (fraction <= 0) continue;
      immerge += e.v * fraction;
      // vitesse du volume = vitesse du bateau + rotation × bras de levier
      v.copy(this.rotation).cross(r).add(this.vitesse);
      const vRel = v.y - eau.vy;
      const poussee = RHO_EAU * G * e.v * fraction;
      const frein = -0.5 * RHO_EAU * 1.1 * e.surface * fraction * vRel * Math.abs(vRel) - 260 * e.surface * fraction * vRel;
      f.set(0, poussee + frein, 0);
      force.add(f);
      couple.add(T.f.copy(r).cross(f));
    }
    this.immersion = immerge / this.deplacement;

    // vitesse du bateau dans son propre repère
    const vLocal = T.c.copy(this.vitesse).applyQuaternion(qInv);
    const rotLocal = T.f.copy(this.rotation).applyQuaternion(qInv);
    const avance = -vLocal.z;
    const enEau = Math.min(1, this.immersion);

    // 4. Résistance de la coque vers l'avant (frottement + vagues)
    const lFlottaison = 8.3 * L;
    const fn = avance / Math.sqrt(G * lFlottaison);
    const frottement = 0.5 * RHO_EAU * 22 * L * H * 0.0042 * avance * Math.abs(avance);
    const vagues = Math.sign(avance) * this.masse * G * resistanceVagues(fn);
    const resistance = new Vector3(0, 0, (frottement + vagues) * enEau); // +z = vers l'arrière
    this.ajouterLocal(resistance, new Vector3(0, -0.2 * H, this.centreGravite.z), force, couple);

    // 5. La quille (et la coque) contre la dérive, le safran pour tourner
    // (point d'appui « effectif » : la quille et l'avant de la coque, placé pour que le
    // bateau soit légèrement ardent, comme un voilier bien réglé)
    const pointQuille = new Vector3(0, -0.75 * H, -1.85 * L);
    const wQuille = this.vitesseEauLocale(vLocal, rotLocal, pointQuille);
    const fq = forceAile(wQuille, new Vector3(0, 0, 1), 2.9 * L * H, 3.4, 0.012, new Vector3());
    this.ajouterLocal(fq.multiplyScalar(enEau), pointQuille, force, couple);
    const pointSafran = new Vector3(0, -0.8 * H, 3.85 * L);
    const wSafran = this.vitesseEauLocale(vLocal, rotLocal, pointSafran);
    const corde = new Vector3(Math.sin(this.barre), 0, Math.cos(this.barre));
    const fs = forceAile(wSafran, corde, 0.52 * L * H, 4.2, 0.012, new Vector3());
    // le safran ne tient que s'il est bien dans l'eau : quand le bateau gîte fort, ou que
    // l'arrière se soulève sur une vague, il remonte vers la surface, aspire de l'air (il
    // « ventile ») et ne tient plus rien : la barre devient molle, c'est le départ au lof
    const ps = pointSafran.clone().sub(this.centreGravite).applyQuaternion(q).add(cg);
    this.eauEn(ps.x, ps.z, eau);
    const tenue = Math.min(1, Math.max(0, (eau.h - ps.y - 0.05) / (0.6 * H))) ** 1.5;
    this.tenueSafran = tenue;
    this.ajouterLocal(fs.multiplyScalar(enEau * tenue), pointSafran, force, couple);
    // la coque freine aussi les mouvements de travers et les rotations (amortissement)
    const travers = -0.5 * RHO_EAU * 1.0 * 3.5 * L * H * vLocal.x * Math.abs(vLocal.x) * enEau;
    this.ajouterLocal(new Vector3(travers, 0, 0), new Vector3(0, -0.3 * H, 0), force, couple);
    const M = this.echelleMasse;
    const amortiLacet = -rotLocal.y * 9000 * M * L ** 1.5 * enEau - rotLocal.y * Math.abs(rotLocal.y) * 30000 * M * L * L * enEau;
    const amortiRoulis = -rotLocal.z * 2500 * M * B * B / Math.sqrt(L) * enEau;
    const amortiTangage = -rotLocal.x * 4000 * M * L ** 1.5 * enEau;
    couple.add(new Vector3(amortiTangage, amortiLacet, amortiRoulis).applyQuaternion(q));

    // 6. Les voiles
    this.forcesVoiles(dt, q, qInv, vLocal, rotLocal, force, couple);
    // … et le « fardage » : le vent sur la coque, le rouf, la timonerie, le mât et le
    // gréement. De face, il n'a prise que sur ~3,4 m² ; de travers, sur ~10 m² (toute la
    // longueur de la coque).
    // Sans voile du tout, dans la tempête, c'est lui qui pousse le bateau (« fuir à sec de
    // toile »)
    const vf = T.e.copy(this.ventReel).applyQuaternion(qInv).sub(vLocal);
    const qf = 0.5 * RHO_AIR * Math.hypot(vf.x, vf.z);
    this.ajouterLocal(new Vector3(qf * 5 * L * H * vf.x, 0, qf * 1.8 * B * H * vf.z), new Vector3(0, 2.2 * H, -0.3 * L), force, couple);

    // 7. Une déferlante : elle monte et retombe en 0,7 s, et frappe la coque du côté d'où
    // elle vient, haut sur le bordé (au livet)
    if (this.choc) {
      const c = this.choc;
      c.t += dt;
      const profil = Math.sin(Math.PI * Math.min(1, c.t / c.duree));
      const d = c.vers.clone().applyQuaternion(qInv);
      d.y = 0;
      d.normalize();
      // (de travers, la crête frappe plus haut : au livet et au rouf ; et elle trouve toute
      // la longueur de la coque, alors que par l'avant ou l'arrière, l'étrave ou le tableau
      // arrière la fendent : trois fois moins de prise)
      const impact = new Vector3(-d.x * 1.3 * B * c.levier, (0.75 + 0.45 * Math.abs(d.x)) * H, -d.z * 3.4 * L * c.levier);
      const exposition = 0.35 + 0.65 * Math.abs(d.x);
      this.ajouterLocal(d.multiplyScalar(POUSSEE_DEFERLANTE * c.force * exposition * profil), impact, force, couple);
      if (c.t >= c.duree) this.choc = null;
    }

    // 8. L'eau embarquée : elle pèse, là où elle est, et court vers le bas
    const masseEau = this.eauCale + this.eauCockpit;
    if (masseEau > 1) {
      // la pesanteur vue du bateau (elle penche avec lui)
      const g = T.e.set(0, -1, 0).applyQuaternion(qInv);
      // dans la cale (sous les planchers, au milieu du bateau) ; plus il y en a, plus
      // elle monte et s'étale d'un bord à l'autre
      if (this.eauCale > 1) {
        const largeur = Math.min(1.1 * B, 0.35 * B + this.eauCale / 1800);
        const p = new Vector3(
          Math.max(-largeur, Math.min(largeur, g.x * 1.6 * B)),
          (-0.42 + Math.min(0.45, this.eauCale / 2600)) * H,
          (0.35 + Math.max(-1.2, Math.min(1.2, -g.z * 2.5))) * L,
        );
        this.ajouterLocal(g.clone().multiplyScalar(this.eauCale * G), p, force, couple);
      }
      // dans le cockpit (le puits entre les bancs : 85 cm de large)
      if (this.eauCockpit > 1) {
        const p = new Vector3(
          Math.max(-COCKPIT.demiLargeurPuits, Math.min(COCKPIT.demiLargeurPuits, g.x * 0.9)),
          COCKPIT.plancher + Math.min(0.5, this.eauCockpit / 2100) / 2,
          zDe((COCKPIT.uArriere + COCKPIT.uAvant) / 2),
        );
        this.ajouterLocal(g.clone().multiplyScalar(this.eauCockpit * G), p, force, couple);
      }
    }

    // Newton : on intègre (Euler semi-implicite)
    this.vitesse.addScaledVector(force, dt / (this.masse + masseEau));
    this.position.addScaledVector(this.vitesse, dt);
    // rotation : couple → accélération angulaire, dans le repère du bateau (inertie diagonale)
    const cLocal = couple.applyQuaternion(qInv);
    const wl = rotLocal;
    const I = this.inertie;
    // termes gyroscopiques ω × (I ω)
    const Iw = new Vector3(I.x * wl.x, I.y * wl.y, I.z * wl.z);
    const gyro = new Vector3().crossVectors(wl, Iw);
    const accel = new Vector3((cLocal.x - gyro.x) / I.x, (cLocal.y - gyro.y) / I.y, (cLocal.z - gyro.z) / I.z);
    wl.addScaledVector(accel, dt);
    this.rotation.copy(wl).applyQuaternion(q);
    // orientation : q ← q + ½ (0, ω) q dt
    const w = this.rotation;
    const dq = new Quaternion(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(q);
    q.set(q.x + dq.x, q.y + dq.y, q.z + dq.z, q.w + dq.w).normalize();
  }

  // vitesse de l'eau par rapport à un point du bateau (repère du bateau)
  vitesseEauLocale(vLocal, rotLocal, point) {
    const v = new Vector3().crossVectors(rotLocal, point).add(vLocal);
    return v.negate();
  }

  // ajoute une force exprimée dans le repère du bateau, appliquée au point donné
  ajouterLocal(forceLocale, pointLocal, force, couple) {
    const fw = forceLocale.clone().applyQuaternion(this.orientation);
    const r = pointLocal.clone().sub(this.centreGravite).applyQuaternion(this.orientation);
    force.add(fw);
    couple.add(r.cross(fw));
  }

  // Les voiles : vent apparent, incidence, force, et mouvement de la bôme et du foc
  forcesVoiles(dt, q, qInv, vLocal, rotLocal, force, couple) {
    const ventLocal = this.ventReel.clone().applyQuaternion(qInv);
    // (ris 3 : la grand-voile est affalée, roulée sur la bôme ; déchirée, il n'en reste
    // qu'un lambeau qui bat)
    // (un 14 m porte ~105 m² de toile : 56 de grand-voile, 48 de foc)
    const surfaceGV = [21, 15.5, 10.5, 0][this.ris] * L * L * 1.2 * (this.grandVoileDechiree ? 0.4 : 1);
    const surfaceFoc = 18 * L * L * 1.2 * this.deroule * (this.focDechire ? 0.5 : 1);
    // centre de poussée de chaque voile = son barycentre (un triangle : au tiers de la
    // hauteur du guindant et au tiers de la bordure)
    // (le vit-de-mulet : le pied de la bôme, au-dessus du toit de la timonerie)
    const vit = hauteurRouf(MAT.u, 0) + MAT.hauteurBome;
    const guindantGV = [10.6, 9.15, 7.7, 0][this.ris] * L;
    const voiles = [
      { cle: 'GV', surface: surfaceGV, pied: new Vector3(0, vit + guindantGV / 3, zDe(MAT.u) + 0.1 * L), corde: 3.55 * L },
      { cle: 'Foc', surface: surfaceFoc, pied: new Vector3(0, hauteurLivet(0.97) + 0.08 + (9.1 * L) / 3, zDe(0.97) + (3.4 * L) / 3), corde: 3.3 * L * this.deroule },
    ];
    this.mesures.forceVoiles = 0;
    for (const s of voiles) {
      if (s.surface < 0.5) {
        this.mesures[`incidence${s.cle}`] = 0;
        continue;
      }
      const angle = s.cle === 'GV' ? this.angleBome : this.angleFoc;
      const cote = angle >= 0 ? 1 : -1; // la voile est du côté tribord si angle > 0
      const c = new Vector3(Math.sin(angle), 0, Math.cos(angle));
      const n = new Vector3(Math.cos(angle) * cote, 0, -Math.sin(angle) * cote); // vers le creux (sous le vent)
      const centre = s.pied.clone().addScaledVector(c, s.corde / 3);
      // vent apparent au centre de poussée (le vent forcit avec la hauteur)
      const gradient = Math.pow(Math.max(1, centre.y + 1) / 10, 0.11);
      const vPoint = new Vector3().crossVectors(rotLocal, centre.clone().sub(this.centreGravite)).add(vLocal);
      const w = ventLocal.clone().multiplyScalar(gradient).sub(vPoint);
      w.y = 0; // seule la composante dans le plan des voiles compte
      const vitesse = w.length();
      if (vitesse < 0.05) continue;
      // incidence : angle entre le vent apparent et la corde, positif quand le vent
      // frappe la face au vent (la voile se gonfle du bon côté)
      const alpha = Math.atan2(w.dot(n), w.dot(c));
      const alphaDeg = (alpha * 180) / Math.PI;
      this.mesures[`incidence${s.cle}`] = alphaDeg;
      const qd = 0.5 * RHO_AIR * s.surface * vitesse * vitesse;
      const coef = coefficientsVoile(alphaDeg);
      const cl = coef.cl;
      // traînée induite : plus une voile porte, plus elle freine (tourbillons de son
      // bord libre) ; c'est ce qui empêche de remonter trop près du vent
      const cd = coef.cd + (cl * cl) / (Math.PI * 3.0);
      const wDir = w.clone().divideScalar(vitesse);
      // portance perpendiculaire au vent, du côté du creux ; à contre (alpha < 0), la voile
      // est poussée de l'autre côté (elle va changer de bord)
      const perp = new Vector3(-wDir.z, 0, wDir.x);
      if (perp.dot(n) < 0) perp.negate();
      let portance = alpha >= 0 ? cl : -Math.abs(cl) * 0.6;
      // (une voile en lambeaux porte mal)
      if ((s.cle === 'GV' && this.grandVoileDechiree) || (s.cle === 'Foc' && this.focDechire)) portance *= 0.5;
      const f = perp.multiplyScalar(qd * portance).addScaledVector(wDir, qd * cd);
      this.ajouterLocal(f, centre, force, couple);
      this.mesures.forceVoiles += f.length();

      // la bôme (ou le point d'écoute du foc) tourne sous la poussée, jusqu'à l'écoute
      const bras = s.corde * 0.45;
      const coupleBome = f.dot(new Vector3(c.z, 0, -c.x)) * bras; // composante perpendiculaire à la corde
      const inertieBome = (s.cle === 'GV' ? 260 : 60) * L ** 3;
      const cleAngle = s.cle === 'GV' ? 'angleBome' : 'angleFoc';
      const cleVit = s.cle === 'GV' ? 'vitesseBome' : 'vitesseFoc';
      // (écoute de foc cassée : plus rien ne retient le point d'écoute, le foc bat au vent)
      const limite = s.cle === 'GV' ? Math.max(0.02, this.ecouteGV)
        : this.ecouteFocLibre ? 2.6 : Math.max(ANGLE_MIN_FOC, this.ecouteFoc);
      let wb = this[cleVit] + ((coupleBome - this[cleVit] * 120 * L ** 3) / inertieBome) * dt;
      let a = this[cleAngle] + wb * dt;
      // le point d'écoute du foc ne passe pas en dedans de son rail (il reste à ~10° de
      // l'axe, d'un côté ou de l'autre, sauf quand il change de bord)
      // l'écoute retient la bôme : au-delà, elle s'arrête net (et rebondit un peu)
      if (Math.abs(a) > limite) {
        a = Math.sign(a) * limite;
        if (Math.sign(wb) === Math.sign(a)) wb = -wb * 0.15;
      }
      // le foc ne passe pas à travers le mât : il change de bord autour de l'étai
      this[cleAngle] = a;
      this[cleVit] = wb;
    }
  }

  // Ce que les instruments du bord affichent
  mesurer() {
    const m = this.mesures;
    const q = this.orientation;
    const qInv = new Quaternion().copy(q).invert();
    const vLocal = this.vitesse.clone().applyQuaternion(qInv);
    const avant = this.avant;
    m.cap = ((Math.atan2(avant.x, -avant.z) * 180) / Math.PI + 360) % 360;
    const horizontale = Math.hypot(this.vitesse.x, this.vitesse.z);
    m.vitesse = horizontale / NOEUD;
    m.derive = (Math.atan2(vLocal.x, Math.max(0.3, -vLocal.z)) * 180) / Math.PI;
    // gîte : l'angle du mât avec la verticale, côté tribord positif
    const haut = new Vector3(0, 1, 0).applyQuaternion(q);
    const droite = new Vector3(1, 0, 0).applyQuaternion(q);
    m.gite = (Math.asin(Math.max(-1, Math.min(1, -droite.y))) * 180) / Math.PI;
    m.assiette = (Math.asin(Math.max(-1, Math.min(1, avant.y))) * 180) / Math.PI;
    m.chavire = haut.y < 0.2;
    const ventLocal = this.ventReel.clone().applyQuaternion(qInv);
    const apparent = ventLocal.clone().sub(vLocal);
    m.ventApparent = Math.hypot(apparent.x, apparent.z) / NOEUD;
    // angle d'où VIENT le vent apparent, par rapport à l'avant (+ = tribord)
    m.angleVentApparent = (Math.atan2(-apparent.x, apparent.z) * 180) / Math.PI;
    m.angleVentReel = (Math.atan2(-ventLocal.x, ventLocal.z) * 180) / Math.PI;
    // l'étrave qui tape dans une vague : elle descend vite vers une eau qui monte
    const etrave = new Vector3(0, 0.35 * H, -4.1 * L);
    const r = etrave.clone().sub(this.centreGravite).applyQuaternion(q);
    const p = r.clone().add(this.position);
    const v = new Vector3().crossVectors(this.rotation, r).add(this.vitesse);
    const eau = this.eauEn(p.x, p.z, {});
    const pres = p.y - eau.h < 0.35;
    const choc = -(v.y - eau.vy);
    m.impactEtrave = pres ? Math.max(0, Math.min(1, (choc - 1.2) / 3)) : 0;
    m.tenueSafran = this.tenueSafran ?? 1;
    m.hauteurEtrave = p.y - eau.h;
  }
}

export { NOEUD };
