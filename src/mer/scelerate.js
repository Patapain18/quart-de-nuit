// La vague scélérate : une vague isolée, deux à trois fois plus haute que les autres (10 à
// 12 m du creux à la crête), précédée d'un creux profond — le « trou dans la mer » que
// décrivent les marins qui en ont vu une — et suivie d'un creux moindre. Elle traverse la
// houle à la vitesse des vagues de sa longueur (≈ 13 m/s pour 110 m).
//
// Sa forme : une vague de Gerstner (les points d'eau tournent sur des cercles : la crête
// est pointue, le creux plat) dans une enveloppe : courte derrière la crête, plus longue
// devant (le creux de devant est profond), et une crête longue de ~250 m.
//
// Le même calcul sert à la physique (houle.js, en JavaScript) et à l'image (eau.js, en
// GLSL : GLSL_SCELERATE). Qui la fait vivre (quand elle arrive, sa force qui monte puis
// retombe, le choc) : monde/scelerates.js.

export const G = 9.81;
// la raideur de la crête (Q·k·A au plus fort : < 1, sinon la surface se replierait)
export const RAIDEUR = 0.72;
// l'enveloppe le long de sa course, en longueurs d'onde : devant la crête, derrière
const DEVANT = 0.75;
const DERRIERE = 0.45;

// Une vague scélérate.
//   x, z : où passe sa crête à l'instant tPassage ; dx, dz : vers où elle va ; hauteur :
//   du creux de devant à la crête (m) ; longueur : sa longueur d'onde (m) ; largeur : la
//   demi-longueur de sa crête (m)
// Sa force (0 → 1 : elle grandit, puis s'efface) est réglée de l'extérieur : v.force.
export function creerScelerate({ x, z, dx, dz, hauteur = 11, longueur = 110, largeur = 130, tPassage = 0 }) {
  const k = (2 * Math.PI) / longueur;
  const n = Math.hypot(dx, dz) || 1;
  const v = {
    x, z, dx: dx / n, dz: dz / n, longueur, largeur, tPassage, k,
    vitesse: Math.sqrt(G / k), // la vitesse de sa crête (m/s)
    hauteur: 0, amplitude: 0,
    force: 0,
    deferle: 0, // (0 → 1 : sa crête s'écroule)
  };
  fixerHauteur(v, hauteur);
  return v;
}
// (le creux de devant, à une demi-longueur d'onde, descend de exp(-(0,5/0,75)²) = 0,64 fois
// la crête : la hauteur creux-crête est 1,64 amplitude)
export function fixerHauteur(v, hauteur) {
  v.hauteur = hauteur;
  v.amplitude = hauteur / (1 + Math.exp(-((0.5 / DEVANT) ** 2)));
}

// Où est sa crête à l'instant t (le point du milieu de la crête)
export function positionCrete(v, t, sortie = [0, 0]) {
  const a = v.vitesse * (t - v.tPassage);
  sortie[0] = v.x + v.dx * a;
  sortie[1] = v.z + v.dz * a;
  return sortie;
}

// Où est le point (x, z) par rapport à elle : s le long de sa course (+ : devant la crête,
// là où elle va), l le long de sa crête
export function repereScelerate(v, x, z, t, sortie = [0, 0]) {
  const a = v.vitesse * (t - v.tPassage);
  const qx = x - (v.x + v.dx * a);
  const qz = z - (v.z + v.dz * a);
  sortie[0] = qx * v.dx + qz * v.dz;
  sortie[1] = -qx * v.dz + qz * v.dx;
  return sortie;
}

// Son enveloppe au point (s, l) : 0 → 1
function enveloppe(v, s, l) {
  const sig = (s > 0 ? DEVANT : DERRIERE) * v.longueur;
  return Math.exp(-((s / sig) ** 2) - (l / v.largeur) ** 2);
}

const _r = [0, 0];
// Déplacement (dx, h, dz) du point d'eau (x, z) de la mer « au repos » à l'instant t :
// ajouté à sortie = [dx, h, dz]
export function ajouterScelerate(v, x, z, t, sortie) {
  if (v.force <= 0) return sortie;
  const [s, l] = repereScelerate(v, x, z, t, _r);
  const L = v.longueur;
  if (s < -1.6 * L || s > 2.2 * L || Math.abs(l) > 3 * v.largeur) return sortie;
  const e = enveloppe(v, s, l) * v.force;
  const phase = v.k * s;
  // (le point d'eau recule vers la crête quand il y monte : la crête se resserre)
  const d = -(RAIDEUR / v.k) * e * Math.sin(phase);
  sortie[0] += v.dx * d;
  sortie[1] += v.amplitude * e * Math.cos(phase);
  sortie[2] += v.dz * d;
  return sortie;
}

// Les réglages de la carte graphique (à faire à chaque image) : uScelerate (x, z de la crête
// maintenant, direction), uScelerate2 (amplitude, k, longueur d'onde, demi-longueur de la
// crête), uScelerate3 (force, déferlement)
export function reglerUniformsScelerate(u, v, t) {
  if (!v || v.force <= 0) {
    u.uScelerate3.value.set(0, 0, 0, 0);
    return;
  }
  const [cx, cz] = positionCrete(v, t, _r);
  u.uScelerate.value.set(cx, cz, v.dx, v.dz);
  u.uScelerate2.value.set(v.amplitude, v.k, v.longueur, v.largeur);
  u.uScelerate3.value.set(v.force, v.deferle, 0, 0);
}

// La même chose, pour la carte graphique : au point source p (la mer « au repos »), la
// hauteur, le déplacement le long de la course, l'enveloppe, s (le long de la course),
// l (le long de la crête) et la pente de la surface dans le monde (dh/dx, dh/dz)
export const GLSL_SCELERATE = /* glsl */ `
uniform vec4 uScelerate;
uniform vec4 uScelerate2;
uniform vec4 uScelerate3;
struct Scelerate { float h; float d; float e; float s; float l; vec2 pente; };
Scelerate scelerate(vec2 p) {
  Scelerate r = Scelerate(0.0, 0.0, 0.0, 1e5, 1e5, vec2(0.0));
  float f = uScelerate3.x;
  if (f <= 0.0) return r;
  vec2 dir = uScelerate.zw;
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 q = p - uScelerate.xy;
  float s = dot(q, dir);
  float l = dot(q, perp);
  float A = uScelerate2.x;
  float k = uScelerate2.y;
  float L = uScelerate2.z;
  float W = uScelerate2.w;
  r.s = s;
  r.l = l;
  if (s < -1.6 * L || s > 2.2 * L || abs(l) > 3.0 * W) return r;
  float sig = (s > 0.0 ? ${DEVANT.toFixed(2)} : ${DERRIERE.toFixed(2)}) * L;
  float e = exp(-(s / sig) * (s / sig) - (l / W) * (l / W)) * f;
  float c = cos(k * s);
  float sn = sin(k * s);
  float Q = ${RAIDEUR.toFixed(2)} / k;
  r.h = A * e * c;
  r.d = -Q * e * sn;
  r.e = e;
  // les dérivées le long de la course (s) et de la crête (l)
  float des = -2.0 * s / (sig * sig) * e;
  float del = -2.0 * l / (W * W) * e;
  float dhds = A * (des * c - e * k * sn);
  float ddds = -Q * (des * sn + e * k * c);
  float dhdl = A * del * c;
  float dddl = -Q * del * sn;
  // dans le monde, X = s + d(s, l) (le long de la course), Y = l : on inverse la jacobienne
  float pX = dhds / max(1.0 + ddds, 0.08);
  float pY = dhdl - pX * dddl;
  r.pente = dir * pX + perp * pY;
  return r;
}
`;
