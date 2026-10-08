// Les risées sur la mer (monde/risees.js dit où elles sont) : une petite carte, vue d'en
// haut, de 3 km de côté autour de nous, qui dit en chaque point de combien le vent y
// forcit (dans une risée) ou y faiblit (dans une molle), et où passe leur bord avant. La
// mer la lit (rendu/eau.js) : l'eau y est froissée, plus sombre (elle ne reflète plus le
// ciel clair de l'horizon), plus blanche par vent fort ; dans une molle, plus lisse.
// On la redessine dix fois par seconde ; entre deux, elle glisse avec le vent.
import * as THREE from 'three';
import { vieDeLaRisee } from '../monde/risees.js';

const TAILLE = 256;
const DEMI_COTE = 1500; // (m : une case fait 12 m)
// (le codage d'une case : le vent en plus, de −25 % à +50 %, et le bord avant, de 0 à 0,5)
const PLUS_BAS = -0.25;
const ETENDUE = 0.75;

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// (le même code dans la mer, pour lire une case)
export const GLSL_RISEES = /* glsl */ `
uniform sampler2D uCarteRisees;
uniform vec4 uRiseesCentre; // x, z du centre (m), demi-côté (m : 0, pas de risées), le vent (nœuds)
uniform vec4 uRiseesGlisse; // le chemin du vent depuis qu'on a dessiné la carte (m) ; sa dérive depuis toujours (m, pour leur grain)
// Les risées au point p : x, de combien le vent y forcit (part du vent : − dans une molle) ;
// y, leur bord avant (là où elles arrivent)
vec2 riseesEn(vec2 p) {
  if (uRiseesCentre.z <= 0.0) return vec2(0.0);
  vec2 uv = (p - uRiseesGlisse.xy - uRiseesCentre.xy) / (2.0 * uRiseesCentre.z) + 0.5;
  vec2 bord = min(uv, 1.0 - uv);
  float dedans = min(bord.x, bord.y);
  if (dedans <= 0.0) return vec2(0.0);
  vec2 t = texture(uCarteRisees, uv).rg;
  // (vers le bord de la carte, elles s'effacent : pas de ligne droite sur la mer)
  return vec2(t.x * ${ETENDUE.toFixed(2)} + ${PLUS_BAS.toFixed(2)}, t.y * 0.5) * smoothstep(0.0, 0.08, dedans);
}
`;

export class RiseesRendu {
  constructor() {
    this.octets = new Uint8Array(TAILLE * TAILLE * 2);
    this.carte = new THREE.DataTexture(this.octets, TAILLE, TAILLE, THREE.RGFormat, THREE.UnsignedByteType);
    this.carte.magFilter = THREE.LinearFilter;
    this.carte.minFilter = THREE.LinearFilter;
    this.carte.wrapS = this.carte.wrapT = THREE.ClampToEdgeWrapping;
    this.carte.needsUpdate = true;
    this.uniforms = {
      uCarteRisees: { value: this.carte },
      uRiseesCentre: { value: new THREE.Vector4() },
      uRiseesGlisse: { value: new THREE.Vector4() },
    };
    this.plus = new Float32Array(TAILLE * TAILLE);
    this.moins = new Float32Array(TAILLE * TAILLE);
    this.front = new Float32Array(TAILLE * TAILLE);
    this.age = Infinity;
    this.depuis = 0; // (le temps depuis le dernier dessin)
    this.derive = { x: 0, z: 0 }; // (le chemin du vent depuis toujours, ramené à un tour de motif)
    this.actif = true; // (l'atelier peut les couper, pour comparer)
    this.ms = 0; // (ce que coûte un dessin)
  }

  // risees : monde/risees.js (ou null) ; camera : autour d'elle ; meteo : le vent du moment
  maj(dt, risees, camera, meteo) {
    const u = this.uniforms;
    if (!risees || !this.actif) {
      u.uRiseesCentre.value.z = 0;
      this.age = Infinity;
      return;
    }
    const vx = risees.ux * risees.vent;
    const vz = risees.uz * risees.vent;
    // (leur grain fin file avec le vent ; on le ramène à un tour de motif : 900 m)
    this.derive.x = (this.derive.x + vx * dt) % 900;
    this.derive.z = (this.derive.z + vz * dt) % 900;
    this.age += dt;
    this.depuis += dt;
    if (this.age > 0.1) {
      this.age = 0;
      this.depuis = 0;
      this.dessiner(risees, camera.position.x, camera.position.z);
    }
    u.uRiseesCentre.value.w = meteo?.vent ?? 0;
    u.uRiseesGlisse.value.set(vx * this.depuis, vz * this.depuis, this.derive.x, this.derive.z);
  }

  dessiner(risees, cx, cz) {
    const t0 = performance.now();
    const pas = (2 * DEMI_COTE) / TAILLE;
    // (le centre suit la caméra par sauts de deux cases : la carte ne « nage » pas)
    const ox = Math.round(cx / (2 * pas)) * 2 * pas;
    const oz = Math.round(cz / (2 * pas)) * 2 * pas;
    this.uniforms.uRiseesCentre.value.set(ox, oz, DEMI_COTE, this.uniforms.uRiseesCentre.value.w);
    const { plus, moins, front } = this;
    plus.fill(0);
    moins.fill(0);
    front.fill(0);
    const x0 = ox - DEMI_COTE;
    const z0 = oz - DEMI_COTE;
    for (const r of risees.liste) {
      const f = r.force * vieDeLaRisee(r);
      if (Math.abs(f) < 0.004) continue;
      const v = Math.hypot(r.vx, r.vz) || 1;
      const ux = r.vx / v;
      const uz = r.vz / v;
      const iL = 2 / r.longueur;
      const iW = 2 / r.largeur;
      const k = r.k;
      const rayon = 0.5 * 1.38 * Math.max(r.longueur, r.largeur);
      const i0 = Math.max(0, Math.floor((r.x - rayon - x0) / pas));
      const i1 = Math.min(TAILLE - 1, Math.ceil((r.x + rayon - x0) / pas));
      const j0 = Math.max(0, Math.floor((r.z - rayon - z0) / pas));
      const j1 = Math.min(TAILLE - 1, Math.ceil((r.z + rayon - z0) / pas));
      for (let j = j0; j <= j1; j++) {
        const dz = z0 + (j + 0.5) * pas - r.z;
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + (i + 0.5) * pas - r.x;
          // (la forme de monde/risees.js, recopiée ici pour aller vite)
          const a = (dx * ux + dz * uz) * iL;
          const b = (dz * ux - dx * uz) * iW;
          const d2 = a * a + b * b;
          if (d2 >= 1.9) continue;
          const d = Math.sqrt(d2);
          let bord = 1;
          if (d > 1e-3) {
            const c = a / d;
            const s = b / d;
            const c2 = c * c - s * s;
            const s2 = 2 * c * s;
            bord += k[0] * c2 + k[1] * s2 + k[2] * (c * c2 - s * s2) + k[3] * (s * c2 + c * s2);
          }
          const doux = 0.22 + 0.4 * lisse(0.3, -0.5, a);
          const p = 1 - lisse(1 - doux, 1, d / bord);
          if (p <= 0) continue;
          const o = j * TAILLE + i;
          const w = f * p;
          if (w > 0) {
            if (w > plus[o]) plus[o] = w;
            // (le bord avant : là où elle arrive, l'eau se froisse d'un coup)
            const avant = w * lisse(0.15, 0.75, a) * (1 - lisse(0.55, 1, p));
            if (avant > front[o]) front[o] = avant;
          } else if (w < moins[o]) moins[o] = w;
        }
      }
    }
    const octets = this.octets;
    for (let o = 0; o < plus.length; o++) {
      const x = (plus[o] + moins[o] - PLUS_BAS) / ETENDUE;
      octets[2 * o] = Math.max(0, Math.min(255, Math.round(x * 255)));
      octets[2 * o + 1] = Math.max(0, Math.min(255, Math.round(front[o] * 2 * 255)));
    }
    this.carte.needsUpdate = true;
    this.ms = this.ms * 0.9 + (performance.now() - t0) * 0.1;
  }
}
