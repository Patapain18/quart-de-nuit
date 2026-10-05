// La houle : la surface de la mer, calculée par la méthode de Tessendorf.
//
// L'idée : on tire au hasard, une fois pour toutes, des milliers de vagues dont
// l'énergie suit le spectre (spectre.js). À chaque instant, chaque vague avance à sa
// propre vitesse (les grandes vont plus vite), et la FFT (fft.js) additionne tout
// pour obtenir, sur une grille, la hauteur de l'eau et son déplacement horizontal
// (qui pointe les crêtes et aplatit les creux, comme les vraies vagues).
//
// Une seule grille ne suffit pas : il faudrait des millions de cases pour avoir à la
// fois les vagues de 300 m et les rides de 10 cm. On empile donc cinq « cascades »,
// des grilles de tailles différentes qui se répètent comme un carrelage, chacune
// chargée d'une gamme de longueurs d'onde. Les trois premières font bouger le bateau ;
// les deux dernières (les rides) ne servent qu'à l'image.
//
// Ce fichier n'utilise pas Three.js : il tourne aussi bien dans le navigateur que
// dans Node (pour les tests et les réglages).

import { creerFFT } from './fft.js';
import { pulsation, spectreDirectionnel } from './spectre.js';

// Les cascades : taille du carreau (m), nombre de cases par côté, et la gamme de
// vagues couverte, en « nombre de vagues par carreau » (de min à max).
// Les tailles ne sont pas des multiples l'une de l'autre, pour que les carrelages
// ne se recouvrent jamais au même endroit (sinon on verrait le motif se répéter).
export const CASCADES = [
  { taille: 1777, n: 128, min: 1, max: 20, physique: true, choppy: 1.0 },   // la houle : 1777 → 89 m
  { taille: 263, n: 128, min: 3, max: 20, physique: true, choppy: 1.15 },   // les vagues : 88 → 13 m
  { taille: 39.3, n: 128, min: 3, max: 20, physique: true, choppy: 1.15 },  // les vaguelettes : 13 → 2 m
  { taille: 5.87, n: 64, min: 3, max: 14, physique: false, choppy: 0.9 },   // les rides : 2 → 0,4 m
  { taille: 1.257, n: 64, min: 3, max: 14, physique: false, choppy: 0.6 },  // les risées : 42 → 9 cm
];

// Petit générateur de nombres pseudo-aléatoires (mulberry32) : avec la même graine,
// on obtient toujours la même mer (pratique pour comparer deux réglages).
function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tirage gaussien (méthode de Box-Muller)
function gaussienne(aleatoire) {
  let u = 0;
  while (u === 0) u = aleatoire();
  const v = aleatoire();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

class Cascade {
  constructor(def, graine) {
    Object.assign(this, def);
    const n = def.n;
    const n2 = n * n;
    this.pas = def.taille / n; // taille d'une case (m)
    // Pour chaque vague (chaque case du spectre) : son hasard, son amplitude,
    // sa pulsation et sa direction (vecteur unitaire)
    this.hasardRe = new Float32Array(n2);
    this.hasardIm = new Float32Array(n2);
    this.h0Re = new Float32Array(n2);
    this.h0Im = new Float32Array(n2);
    this.omega = new Float32Array(n2);
    this.ux = new Float32Array(n2);
    this.uz = new Float32Array(n2);
    this.miroir = new Uint32Array(n2); // indice de la vague opposée (-k)
    // Tableaux de travail de la FFT
    this.aRe = new Float64Array(n2);
    this.aIm = new Float64Array(n2);
    this.bRe = new Float64Array(n2);
    this.bIm = new Float64Array(n2);
    // Le résultat, prêt à envoyer à la carte graphique : 4 nombres par case
    // (déplacement x, hauteur, déplacement z, écume)
    this.donnees = new Float32Array(n2 * 4);
    this.fft = creerFFT(n);

    const aleatoire = generateur(graine);
    const dk = (2 * Math.PI) / def.taille;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        const m = i < n / 2 ? i : i - n; // nombre de vagues par carreau, en x
        const l = j < n / 2 ? j : j - n; // … et en z
        const kx = m * dk;
        const kz = l * dk;
        const k = Math.hypot(kx, kz);
        this.hasardRe[idx] = gaussienne(aleatoire);
        this.hasardIm[idx] = gaussienne(aleatoire);
        this.omega[idx] = k > 0 ? pulsation(k) : 0;
        this.ux[idx] = k > 0 ? kx / k : 0;
        this.uz[idx] = k > 0 ? kz / k : 0;
        this.miroir[idx] = ((n - j) % n) * n + ((n - i) % n);
      }
    }
  }

  // Recalcule l'amplitude de chaque vague pour un nouvel état de la mer.
  // Le hasard ne change pas : la mer « grossit » ou « se calme » sans sauter.
  // (j0, j1 : seulement ces rangs de la grille, pour étaler le calcul sur plusieurs images)
  regler(mer, j0 = 0, j1 = this.n) {
    const { n, taille, min, max } = this;
    const dk = (2 * Math.PI) / taille;
    const kMin = min * dk;
    const kMax = max * dk;
    let energie = j0 === 0 ? 0 : this._energie;
    for (let j = j0; j < j1; j++) {
      for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        const m = i < n / 2 ? i : i - n;
        const l = j < n / 2 ? j : j - n;
        const kx = m * dk;
        const kz = l * dk;
        const k = Math.hypot(kx, kz);
        // Chaque cascade ne s'occupe que de sa gamme de vagues ; la limite haute
        // est exclue pour qu'une vague ne soit jamais comptée deux fois.
        if (k < kMin || k >= kMax || i === n / 2 || j === n / 2) {
          this.h0Re[idx] = 0;
          this.h0Im[idx] = 0;
          continue;
        }
        const w = pulsation(k);
        const theta = Math.atan2(kz, kx);
        // Passage du spectre (ω, θ) à la grille (kx, kz) : S(kx, kz) = S(ω, θ) · dω/dk / k
        const s = (spectreDirectionnel(w, theta, mer) * (9.81 / (2 * w))) / k;
        // Amplitude complexe de la vague (Tessendorf) : son énergie moyenne vaut S·dk²/2
        const a = 0.5 * dk * Math.sqrt(Math.max(s, 0));
        this.h0Re[idx] = this.hasardRe[idx] * a;
        this.h0Im[idx] = this.hasardIm[idx] * a;
        energie += s * dk * dk;
      }
    }
    this._energie = energie;
    if (j1 === n) this.energie = energie; // variance de la hauteur apportée par cette cascade (m²)
  }

  // Calcule la surface au temps t (s). dt sert à faire vieillir l'écume.
  calculer(t, dt, choppyGlobal, ecume) {
    const { n, h0Re, h0Im, omega, ux, uz, miroir, aRe, aIm, bRe, bIm } = this;
    const n2 = n * n;
    // 1) Chaque vague avance : h(k, t) = h0(k)·e^(-iωt) + conj(h0(-k))·e^(+iωt)
    //    puis son déplacement horizontal D(k) = i·(k/|k|)·h(k).
    //    On range h + i·Dx dans le tableau A et Dz dans le tableau B : une FFT
    //    calcule ainsi deux résultats d'un coup (astuce des nombres complexes).
    for (let idx = 0; idx < n2; idx++) {
      const a = h0Re[idx];
      const b = h0Im[idx];
      const mi = miroir[idx];
      const p = h0Re[mi];
      const q = h0Im[mi];
      if (a === 0 && b === 0 && p === 0 && q === 0) {
        aRe[idx] = 0; aIm[idx] = 0; bRe[idx] = 0; bIm[idx] = 0;
        continue;
      }
      const phase = omega[idx] * t;
      const c = Math.cos(phase);
      const s = Math.sin(phase);
      const hr = a * c + b * s + p * c + q * s;
      const hi = b * c - a * s + p * s - q * c;
      const x = ux[idx];
      const z = uz[idx];
      // Dx = i·x·h = -x·hi + i·x·hr, donc
      // A = h + i·Dx = (hr + i·hi) + i·(-x·hi + i·x·hr) = (hr - x·hr) + i·(hi - x·hi)
      aRe[idx] = hr - x * hr;
      aIm[idx] = hi - x * hi;
      // B = Dz = -z·hi + i·z·hr
      bRe[idx] = -z * hi;
      bIm[idx] = z * hr;
    }
    this.fft(aRe, aIm);
    this.fft(bRe, bIm);

    // 2) On recopie le résultat dans le tableau destiné à la carte graphique,
    //    et on fait naître l'écume là où la surface se replie sur elle-même.
    const lambda = this.choppy * choppyGlobal;
    const d = this.donnees;
    for (let idx = 0; idx < n2; idx++) {
      d[idx * 4] = aIm[idx] * lambda; // déplacement x
      d[idx * 4 + 1] = aRe[idx]; // hauteur
      d[idx * 4 + 2] = bRe[idx] * lambda; // déplacement z
    }
    this.calculerEcume(dt, ecume);
  }

  // L'écume naît là où la vague « se casse » : le déplacement horizontal resserre
  // tellement la surface qu'elle se replie (le jacobien J passe sous un seuil).
  // Elle s'efface ensuite lentement, ce qui laisse des traînées derrière les crêtes.
  calculerEcume(dt, { seuil, force, duree }) {
    const { n, pas } = this;
    const d = this.donnees;
    const attenuation = Math.exp(-dt / duree);
    const inv = 1 / (2 * pas);
    for (let j = 0; j < n; j++) {
      const jp = ((j + 1) % n) * n;
      const jm = ((j - 1 + n) % n) * n;
      const jn = j * n;
      for (let i = 0; i < n; i++) {
        const ip = (i + 1) % n;
        const im = (i - 1 + n) % n;
        const dxdx = (d[(jn + ip) * 4] - d[(jn + im) * 4]) * inv;
        const dzdz = (d[(jp + i) * 4 + 2] - d[(jm + i) * 4 + 2]) * inv;
        const dxdz = (d[(jp + i) * 4] - d[(jm + i) * 4]) * inv;
        const dzdx = (d[(jn + ip) * 4 + 2] - d[(jn + im) * 4 + 2]) * inv;
        const jacobien = (1 + dxdx) * (1 + dzdz) - dxdz * dzdx;
        const nouvelle = Math.min(1, Math.max(0, (seuil - jacobien) * force));
        const idx = (jn + i) * 4 + 3;
        d[idx] = Math.max(d[idx] * attenuation, nouvelle);
      }
    }
  }

  // Lit la grille au point (x, z) du monde (interpolation bilinéaire, carrelage répété).
  // Ajoute le résultat dans sortie = [dx, h, dz].
  ajouter(x, z, sortie) {
    const { n, pas } = this;
    const d = this.donnees;
    const fx = x / pas;
    const fz = z / pas;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    const i0 = ((x0 % n) + n) % n;
    const j0 = ((z0 % n) + n) % n;
    const i1 = (i0 + 1) % n;
    const j1 = (j0 + 1) % n;
    const a = (j0 * n + i0) * 4;
    const b = (j0 * n + i1) * 4;
    const c = (j1 * n + i0) * 4;
    const e = (j1 * n + i1) * 4;
    for (let k = 0; k < 3; k++) {
      const haut = d[a + k] + (d[b + k] - d[a + k]) * tx;
      const bas = d[c + k] + (d[e + k] - d[c + k]) * tx;
      sortie[k] += haut + (bas - haut) * tz;
    }
  }
}

export class Houle {
  constructor({ graine = 1, cascades = CASCADES } = {}) {
    this.cascades = cascades.map((def, i) => new Cascade(def, graine * 1013 + i * 7919));
    this.choppy = 1;
    this.ecume = { seuil: 0.8, force: 5, duree: 3.5 };
    this.temps = 0;
    this._s = [0, 0, 0];
  }

  // Nouvel état de la mer (vent, fetch, direction, houle) : voir spectre.js
  // progressif : un morceau de cascade (32 rangs) par image, au lieu des cinq cascades d'un
  // coup (5 à 8 ms : une image ratée toutes les 3 secondes pendant la partie, quand le
  // temps change peu à peu)
  regler(mer, { progressif = false } = {}) {
    this.mer = mer;
    if (progressif) {
      this.aRegler = [];
      for (const c of this.cascades) for (let j = 0; j < c.n; j += 32) this.aRegler.push([c, j, Math.min(c.n, j + 32)]);
    } else {
      this.aRegler = null;
      for (const c of this.cascades) c.regler(mer);
    }
    // L'écume : les « moutons » apparaissent vers 10 nœuds de vent et couvrent environ
    // un cinquième de la mer à 50 nœuds (mesures de Monahan) ; plus le vent est fort,
    // plus les traînées d'écume durent.
    const force = Math.min(1, Math.max(0, (mer.vent / 0.5144 - 10) / 40));
    this.ecume.seuil = 0.78 + 0.13 * force;
    this.ecume.duree = 2 + 6 * force;
  }

  // Écart-type de la hauteur, et hauteur significative (Hs = 4 écarts-types),
  // c'est-à-dire à peu près la hauteur creux-crête des plus grosses vagues courantes.
  get hauteurSignificative() {
    let v = 0;
    for (const c of this.cascades) v += c.energie ?? 0;
    return 4 * Math.sqrt(v);
  }

  // Efface l'écume (quand le temps change d'un coup, dans l'atelier)
  effacerEcume() {
    for (const c of this.cascades) for (let i = 3; i < c.donnees.length; i += 4) c.donnees[i] = 0;
  }

  calculer(t, dt = 1 / 60) {
    this.temps = t;
    if (this.aRegler?.length) {
      const [c, j0, j1] = this.aRegler.shift();
      c.regler(this.mer, j0, j1);
    }
    for (const c of this.cascades) c.calculer(t, dt, this.choppy, this.ecume);
  }

  // Somme des cascades « physiques » au point (x, z) de la grille non déplacée
  lire(x, z) {
    const s = this._s;
    s[0] = 0; s[1] = 0; s[2] = 0;
    for (const c of this.cascades) if (c.physique) c.ajouter(x, z, s);
    return s;
  }

  // Hauteur de l'eau au point (x, z) du monde.
  // Difficulté : la grille donne la hauteur d'un point d'eau qui a été DÉPLACÉ
  // horizontalement. On cherche donc le point de départ p tel que p + D(p) = (x, z),
  // en quelques essais successifs (chaque essai corrige le précédent).
  hauteur(x, z) {
    let px = x;
    let pz = z;
    for (let i = 0; i < 5; i++) {
      const s = this.lire(px, pz);
      px = x - s[0];
      pz = z - s[2];
    }
    return this.lire(px, pz)[1];
  }
}
