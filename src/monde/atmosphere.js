// L'atmosphère : pourquoi le ciel est bleu à midi et orange au coucher du soleil.
//
// La lumière du soleil traverse l'air. Les molécules d'air (diffusion de Rayleigh)
// renvoient surtout le bleu dans toutes les directions : le ciel est bleu. Quand le
// soleil est bas, sa lumière traverse beaucoup plus d'air ; le bleu a été dispersé en
// route, il ne reste que l'orange et le rouge. Les poussières et l'humidité (diffusion
// de Mie) font le halo blanc autour du soleil, et l'ozone donne le bleu profond du
// crépuscule.
//
// Ce fichier calcule ces couleurs en JavaScript (pour la couleur de la lumière du
// soleil sur le bateau, et l'éclairage des nuages). Le même calcul existe en GLSL
// pour dessiner le ciel pixel par pixel (rendu/glsl/atmosphere.js).

export const ATMO = {
  rayonTerre: 6360e3,
  rayonAtmo: 6460e3,
  rayleigh: [5.802e-6, 13.558e-6, 33.1e-6], // diffusion par les molécules (rouge, vert, bleu)
  mie: 3.996e-6, // diffusion par les poussières
  mieExtinction: 4.44e-6,
  ozone: [0.65e-6, 1.881e-6, 0.085e-6], // absorption par l'ozone
  hauteurRayleigh: 8000,
  hauteurMie: 1200,
};

// Distances d'entrée et de sortie d'un rayon (origine o, direction d) dans une sphère
// de rayon r centrée au centre de la Terre ; null si le rayon la manque.
function traverserSphere(o, d, r) {
  const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r;
  const delta = b * b - c;
  if (delta < 0) return null;
  const s = Math.sqrt(delta);
  return [-b - s, -b + s];
}

function densites(altitude) {
  return [
    Math.exp(-altitude / ATMO.hauteurRayleigh),
    Math.exp(-altitude / ATMO.hauteurMie),
    Math.max(0, 1 - Math.abs(altitude - 25000) / 15000),
  ];
}

// Fraction de lumière (rouge, vert, bleu) qui traverse l'atmosphère depuis l'altitude
// donnée dans la direction d (vecteur unitaire). 0 si la Terre est sur le chemin.
export function transmittance(altitude, d, pas = 16) {
  const o = [0, ATMO.rayonTerre + altitude, 0];
  const sol = traverserSphere(o, d, ATMO.rayonTerre);
  if (sol && sol[0] > 0) return [0, 0, 0];
  const t = traverserSphere(o, d, ATMO.rayonAtmo);
  if (!t) return [1, 1, 1];
  const longueur = t[1];
  const ds = longueur / pas;
  let r = 0;
  let m = 0;
  let oz = 0;
  for (let i = 0; i < pas; i++) {
    const s = (i + 0.5) * ds;
    const p = [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
    const alt = Math.hypot(p[0], p[1], p[2]) - ATMO.rayonTerre;
    const dens = densites(alt);
    r += dens[0] * ds;
    m += dens[1] * ds;
    oz += dens[2] * ds;
  }
  return [0, 1, 2].map((c) => Math.exp(-(ATMO.rayleigh[c] * r + ATMO.mieExtinction * m + ATMO.ozone[c] * oz)));
}

// Couleur du ciel dans la direction d, éclairé par un astre dans la direction l
// (diffusion simple, 16 pas le long du regard et 8 vers l'astre).
export function couleurCiel(d, l, intensite = 1) {
  const o = [0, ATMO.rayonTerre + 10, 0];
  const t = traverserSphere(o, d, ATMO.rayonAtmo);
  if (!t) return [0, 0, 0];
  let fin = t[1];
  const sol = traverserSphere(o, d, ATMO.rayonTerre);
  if (sol && sol[0] > 0) fin = sol[0];
  const pas = 16;
  let odR = 0;
  let odM = 0;
  let odO = 0;
  const sommeR = [0, 0, 0];
  const sommeM = [0, 0, 0];
  let precedent = 0;
  for (let i = 0; i < pas; i++) {
    // pas plus serrés près de l'observateur, là où l'air est dense
    const u = (i + 1) / pas;
    const s1 = fin * u * u;
    const ds = s1 - precedent;
    const s = precedent + ds * 0.5;
    precedent = s1;
    const p = [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
    const alt = Math.hypot(p[0], p[1], p[2]) - ATMO.rayonTerre;
    const dens = densites(alt);
    odR += dens[0] * ds;
    odM += dens[1] * ds;
    odO += dens[2] * ds;
    const tl = transmittance(alt, l, 8);
    for (let c = 0; c < 3; c++) {
      const tv = Math.exp(-(ATMO.rayleigh[c] * odR + ATMO.mieExtinction * odM + ATMO.ozone[c] * odO));
      sommeR[c] += tl[c] * tv * dens[0] * ds;
      sommeM[c] += tl[c] * tv * dens[1] * ds;
    }
  }
  const mu = d[0] * l[0] + d[1] * l[1] + d[2] * l[2];
  const phaseR = (3 / (16 * Math.PI)) * (1 + mu * mu);
  const g = 0.76;
  const phaseM =
    ((3 / (8 * Math.PI)) * ((1 - g * g) * (1 + mu * mu))) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5));
  return [0, 1, 2].map((c) => intensite * (sommeR[c] * ATMO.rayleigh[c] * phaseR + sommeM[c] * ATMO.mie * phaseM));
}

// Éclairement du ciel sur une surface horizontale (la lumière « d'ambiance ») :
// moyenne de la couleur du ciel sur quelques directions de la voûte, pondérée par cos.
export function ambianceCiel(l, intensite = 1) {
  const somme = [0, 0, 0];
  let poids = 0;
  for (const elev of [0.08, 0.35, 0.7, 1.2]) {
    for (let a = 0; a < 8; a++) {
      const az = (a / 8) * 2 * Math.PI;
      const d = [Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az)];
      const c = couleurCiel(d, l, intensite);
      const w = Math.sin(elev) * Math.cos(elev);
      for (let k = 0; k < 3; k++) somme[k] += c[k] * w;
      poids += w;
    }
  }
  return somme.map((v) => (v / poids) * Math.PI);
}
