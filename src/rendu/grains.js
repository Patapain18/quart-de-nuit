// Les grains à l'écran : à chaque image, ce que les shaders doivent en savoir (voir
// glsl/grains.js) — les colonnes de pluie des plus proches (les plus proches d'abord : on
// les traverse dans l'ordre), leurs rafales sur la mer, et la carte du ciel bouché au-dessus
// d'eux (lue par les nuages).
import * as THREE from 'three';
import { N_RIDEAUX, N_GRAINS } from './glsl/grains.js';
import { bordDeLaRafale, paquetsDuCrochet, REGLAGES_GRAINS } from '../monde/grains.js';

// La pluie au cœur d'un grain de force 1 éteint la lumière à 0,6 % par mètre : on n'y voit
// pas à plus de 500 m (et de loin, le rideau est presque opaque)
export const DENSITE_PLUIE = REGLAGES_GRAINS.extinctionPluie;
const LOIN = 6000; // (au-delà, une seule colonne de pluie par grain)
const TAILLE_CARTE = 128;
const DEMI_COTE = 16000; // (la carte du ciel bouché couvre 32 km autour de nous)

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class GrainsRendu {
  constructor() {
    const v4 = (n) => Array.from({ length: n }, () => new THREE.Vector4());
    this.uniforms = {
      uRideaux: { value: v4(N_RIDEAUX) },
      uRideauxB: { value: v4(N_RIDEAUX) },
      uRideauxN: { value: 0 },
      uRideauxReglages: { value: new THREE.Vector4(650, 0, 0, 0) },
      uRideauxLumiere: { value: new THREE.Vector3() },
      uRideauxSoleil: { value: new THREE.Vector3() },
      uRideauxDirSoleil: { value: new THREE.Vector3(0, 1, 0) },
      uRideauxEclair: { value: new THREE.Vector4() },
      uRideauxEclairB: { value: new THREE.Vector4() },
      uGrainsVent: { value: v4(N_GRAINS) },
      uGrainsDir: { value: v4(N_GRAINS) },
      uGrainsN: { value: 0 },
    };
    // la carte du ciel bouché, vue d'en haut (un nombre par case : 0 → 1)
    this.donnees = new Uint16Array(TAILLE_CARTE * TAILLE_CARTE);
    this.carte = new THREE.DataTexture(this.donnees, TAILLE_CARTE, TAILLE_CARTE, THREE.RedFormat, THREE.HalfFloatType);
    this.carte.magFilter = THREE.LinearFilter;
    this.carte.minFilter = THREE.LinearFilter;
    this.carte.wrapS = this.carte.wrapT = THREE.ClampToEdgeWrapping;
    this.carte.needsUpdate = true;
    this.uniformsCarte = { uCarteGrains: { value: this.carte }, uCarteGrainsCentre: { value: new THREE.Vector3() } };
    this.ageCarte = Infinity;
    // (pour mesurer ce que coûte chaque morceau, l'atelier des grains peut en couper un)
    this.masque = { rideaux: true, rafales: true, carte: true, ciel: true };
    this.colonnes = [];
    this.vents = [];
    this._q = {};
  }

  // grains : monde/grains.js (ou null) ; base : la base des nuages (m) ; ecl : l'éclairage
  // (monde/meteo.js) ; eclair : { trait: [a, b] (le trait qui traverse la pluie, m),
  // intensite } (l'éclair du moment)
  maj(dt, grains, camera, { base, temps, ecl, eclair }) {
    const u = this.uniforms;
    const cx = camera.position.x;
    const cz = camera.position.z;
    // (z : la brume, que le monde règle — rendu/monde3d.js)
    u.uRideauxReglages.value.x = base;
    u.uRideauxReglages.value.y = temps;
    // (w : les rideaux devant le fond du ciel)
    u.uRideauxReglages.value.w = this.masque.ciel ? 1 : 0;
    // la lumière : la pluie renvoie celle du ciel (un éclairement : divisé par π, c'est
    // une luminance), et le soleil quand il arrive jusqu'à elle
    const a = ecl.ambiance;
    u.uRideauxLumiere.value.set(a[0], a[1], a[2]).multiplyScalar(0.3 / Math.PI);
    u.uRideauxSoleil.value.fromArray(ecl.soleil).multiplyScalar(0.3);
    u.uRideauxDirSoleil.value.fromArray(ecl.dirSoleil);
    if (eclair?.trait && eclair.intensite > 0) {
      const [a, b] = eclair.trait;
      u.uRideauxEclair.value.set(a.x, a.y, a.z, eclair.intensite);
      u.uRideauxEclairB.value.set(b.x, b.y, b.z, 0);
    } else u.uRideauxEclair.value.w = 0;

    // les colonnes de pluie et les rafales, des plus proches aux plus lointaines
    const colonnes = this.colonnes;
    const vents = this.vents;
    colonnes.length = 0;
    vents.length = 0;
    for (const g of grains?.liste ?? []) {
      const I = grains.intensite(g);
      if (I < 0.02) continue;
      const v = Math.hypot(g.vx, g.vz) || 1;
      const ux = g.vx / v;
      const uz = g.vz / v;
      // (le haut du rideau est en arrière : en tombant, la pluie est poussée vers l'avant)
      const px = -ux * g.penche;
      const pz = -uz * g.penche;
      if (Math.hypot(g.x - cx, g.z - cz) > LOIN) {
        // au loin, une seule colonne suffit (aussi dense en son milieu que ses morceaux réunis)
        let x = 0;
        let z = 0;
        let somme = 0;
        let epaisseur = 0;
        for (const n of g.noyaux) {
          const q = grains.noyau(g, n, this._q);
          x += q.x * n.w;
          z += q.z * n.w;
          somme += n.w;
          epaisseur += n.w * q.s;
        }
        const s = 0.85 * g.rayon;
        colonnes.push({
          x: x / somme, z: z / somme, s, densite: (DENSITE_PLUIE * I * epaisseur) / s, px, pz, graine: g.graine,
          distance: Math.hypot(x / somme - cx, z / somme - cz) - 2 * s,
        });
      } else {
        for (const n of g.noyaux) {
          const q = grains.noyau(g, n, this._q);
          colonnes.push({
            x: q.x, z: q.z, s: q.s, densite: DENSITE_PLUIE * I * n.w, px, pz, graine: (g.graine + n.a * 0.37 + 1) % 1,
            distance: Math.hypot(q.x - cx, q.z - cz) - 2 * q.s,
          });
        }
        // (sous un porteur, la pluie qui s'enroule autour de sa trombe : monde/grains.js)
        const k = g.crochet?.force ?? 0;
        if (k > 0.05) {
          for (const m of paquetsDuCrochet(g.crochet)) {
            if (!m.rideau) continue;
            colonnes.push({
              x: m.x, z: m.z, s: m.s, densite: DENSITE_PLUIE * I * m.w * k, px, pz, graine: (g.graine + m.a * 0.0011 + 2) % 1,
              distance: Math.hypot(m.x - cx, m.z - cz) - 2 * m.s,
            });
          }
        }
      }
      const c = grains.noyau(g, g.noyaux[0], this._q);
      vents.push({ x: c.x, z: c.z, R: g.rayon, I, ux, uz, loin: bordDeLaRafale(g, 1) / g.rayon, distance: Math.hypot(c.x - cx, c.z - cz) - 2.4 * g.rayon });
    }
    colonnes.sort((p, q) => p.distance - q.distance);
    vents.sort((p, q) => p.distance - q.distance);
    const nc = Math.min(N_RIDEAUX, colonnes.length);
    for (let i = 0; i < nc; i++) {
      const c = colonnes[i];
      u.uRideaux.value[i].set(c.x, c.z, c.s, c.densite);
      u.uRideauxB.value[i].set(c.px, c.pz, c.graine, 0);
    }
    u.uRideauxN.value = this.masque.rideaux ? nc : 0;
    const nv = Math.min(N_GRAINS, vents.length);
    for (let i = 0; i < nv; i++) {
      const w = vents[i];
      u.uGrainsVent.value[i].set(w.x, w.z, w.R, w.I);
      u.uGrainsDir.value[i].set(w.ux, w.uz, w.loin, 0);
    }
    u.uGrainsN.value = this.masque.rafales ? nv : 0;

    // la carte du ciel bouché, quatre fois par seconde (les grains avancent de quelques
    // mètres pendant ce temps ; une case fait 250 m)
    this.ageCarte += dt;
    if (this.ageCarte > 0.25) {
      this.ageCarte = 0;
      this.dessinerCarte(grains, cx, cz);
    }
  }

  // Le nuage d'un grain, vu d'en haut : plus large que sa pluie, il déborde loin devant lui
  // (l'enclume, poussée par le vent d'altitude) — comme son ombre (monde/grains.js)
  dessinerCarte(grains, cx, cz) {
    const centre = this.uniformsCarte.uCarteGrainsCentre.value;
    const liste = grains?.liste.filter((g) => grains.intensite(g) > 0.02) ?? [];
    if (!liste.length || !this.masque.carte) {
      centre.z = 0;
      return;
    }
    const pas = (2 * DEMI_COTE) / TAILLE_CARTE;
    // (le centre suit la caméra par sauts de deux cases : la carte ne « nage » pas)
    const ox = Math.round(cx / (2 * pas)) * 2 * pas;
    const oz = Math.round(cz / (2 * pas)) * 2 * pas;
    centre.set(ox, oz, DEMI_COTE);
    const valeurs = (this._valeurs ??= new Float32Array(TAILLE_CARTE * TAILLE_CARTE));
    valeurs.fill(0);
    const x0 = ox - DEMI_COTE;
    const z0 = oz - DEMI_COTE;
    for (const g of liste) {
      const I = grains.intensite(g);
      const v = Math.hypot(g.vx, g.vz) || 1;
      const ux = g.vx / v;
      const uz = g.vz / v;
      const rMax = 2.8 * g.rayon * 1.35;
      const i0 = Math.max(0, Math.floor((g.x - rMax - x0) / pas));
      const i1 = Math.min(TAILLE_CARTE - 1, Math.ceil((g.x + rMax - x0) / pas));
      const j0 = Math.max(0, Math.floor((g.z - rMax - z0) / pas));
      const j1 = Math.min(TAILLE_CARTE - 1, Math.ceil((g.z + rMax - z0) / pas));
      for (let j = j0; j <= j1; j++) {
        const z = z0 + (j + 0.5) * pas;
        for (let i = i0; i <= i1; i++) {
          const x = x0 + (i + 0.5) * pas;
          const dx = x - g.x;
          const dz = z - g.z;
          const r = Math.hypot(dx, dz);
          const devant = r > 1 ? (dx * ux + dz * uz) / r : 0;
          const k = I * (1 - lisse(0.9 * g.rayon, 2.8 * g.rayon, r / (1 + 0.35 * devant)));
          const o = j * TAILLE_CARTE + i;
          if (k > valeurs[o]) valeurs[o] = k;
        }
      }
    }
    const versDemi = THREE.DataUtils.toHalfFloat;
    for (let o = 0; o < valeurs.length; o++) this.donnees[o] = versDemi(valeurs[o]);
    this.carte.needsUpdate = true;
  }
}
