// Les déferlantes, en 3D. Quand la nuit annonce une déferlante (jeu/nuit.js), on voit sa
// crête qui s'écroule arriver du côté du vent, quelques secondes avant qu'elle frappe :
// un front d'eau sombre et raide, coiffé d'une lèvre blanche dont l'écume cascade sur le
// devant de la vague, une traîne d'écume derrière, et des embruns que le vent arrache à
// son sommet.
//
// La nuit, on ne verrait presque rien… si la mer ne s'allumait pas : dans l'écume qui
// bouillonne, le plancton (des algues microscopiques, les noctiluques) brille d'une
// lumière bleu-vert quand on le secoue. C'est vrai, et on le voit très bien par une
// nuit de tempête : chaque crête qui déferle s'illumine.
import * as THREE from 'three';
import { GLSL_CARTE_CIEL } from './ciel.js';
import { GLSL_COQUE } from '../bateau/glsl-coque.js';

const VITESSE_CRETE = 12; // m/s (la crête d'une vague de ~8 s de période)
const NU = 40; // sommets le long de la crête
// Le profil en travers, de la mer devant la vague (côté bateau) à la fin de la traîne :
// [recul (m) derrière la lèvre, hauteur du rouleau (fraction), part de la bosse de la
// vague]. Une déferlante est au sommet d'une grosse vague : la crête est posée sur une
// bosse large, qui se fond dans la mer devant et derrière. Les premières rangées font la
// pente de la vague, puis le front, raide ; la rangée LEVRE est le haut de la lèvre.
export const PROFIL = [
  [-9, 0, 0.02], [-6, 0, 0.18], [-3.8, 0, 0.5], [-2.4, 0, 0.75], [-1.5, 0.1, 0.9],
  [-0.9, 0.4, 0.97], [-0.45, 0.78, 1], [-0.1, 1.0, 1],
  [0.6, 0.93, 1], [1.6, 0.72, 0.97], [3.0, 0.48, 0.9], [4.6, 0.3, 0.78], [6.4, 0.16, 0.62],
  [8.3, 0.07, 0.45], [10.5, 0.02, 0.3], [13.5, 0, 0.12], [17, 0, 0.02],
];
const NV = PROFIL.length - 1;
export const RANG_LEVRE = 7;
const LEVRE = RANG_LEVRE / NV; // (vCoord.y du haut de la lèvre)
const TRAINE = 17;

export const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Un bruit de valeur en 3D (pour l'écume qui bouillonne)
const GLSL_BRUIT = /* glsl */ `
float hasard3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float bruit3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hasard3(i), hasard3(i + vec3(1, 0, 0)), f.x), mix(hasard3(i + vec3(0, 1, 0)), hasard3(i + vec3(1, 1, 0)), f.x), f.y);
  float b = mix(mix(hasard3(i + vec3(0, 0, 1)), hasard3(i + vec3(1, 0, 1)), f.x), mix(hasard3(i + vec3(0, 1, 1)), hasard3(i + vec3(1, 1, 1)), f.x), f.y);
  return mix(a, b, f.z);
}
`;

export function materiauEcume(eau) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.userData.uniforms = {
    uTemps: { value: 0 },
    uVie: { value: 0 },
    uPhospho: { value: 0 },
    uLongueur: { value: 30 },
    uEchelle: { value: 1 }, // (le profil en travers, agrandi : la lèvre d'une vague scélérate)
    uCarteCiel: eau.uniforms.uCarteCiel,
    uBrume: eau.uniforms.uBrume,
    // (pour creuser la crête dans la coque : l'eau passe autour du bateau, pas à travers)
    uBateauInverse: eau.uniforms.uBateauInverse,
    uClipCoque: eau.uniforms.uClipCoque,
    // (l'eau du front est éclairée exactement comme la mer)
    uReflets: eau.uniforms.uReflets,
    uSoleil: eau.uniforms.uSoleil,
    uDirSoleil: eau.uniforms.uDirSoleil,
    uLune: eau.uniforms.uLune,
    uDirLune: eau.uniforms.uDirLune,
    uAmbiance: eau.uniforms.uAmbiance,
    uEclair: eau.uniforms.uEclair,
    uCouleurFond: eau.uniforms.uCouleurFond,
    uCouleurTranslucide: eau.uniforms.uCouleurTranslucide,
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, m.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 coord;\nvarying vec2 vCoord;\nvarying vec3 vPosMonde;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCoord = coord;\nvPosMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vCoord; // x : le long de la crête (-0,5 → 0,5), y : du pied du front (0) au bout de la traîne (1)
varying vec3 vPosMonde;
uniform float uTemps;
uniform float uVie;
uniform float uPhospho;
uniform float uLongueur;
uniform float uEchelle;
uniform sampler2D uCarteCiel;
uniform float uBrume;
uniform samplerCube uReflets;
uniform vec3 uSoleil;
uniform vec3 uDirSoleil;
uniform vec3 uLune;
uniform vec3 uDirLune;
uniform vec3 uAmbiance;
uniform float uEclair;
uniform vec3 uCouleurFond;
uniform vec3 uCouleurTranslucide;
${GLSL_CARTE_CIEL}
${GLSL_BRUIT}
${GLSL_COQUE}
// Ce que l'on voit en chaque point de la crête : de l'eau sombre (le front de la vague)
// ou de l'écume (la lèvre, ce qui cascade sur le front, la traîne) ; x : la part
// d'écume, y : l'opacité
vec2 crete() {
  // (dans le repère de la crête, en mètres)
  float le = vCoord.x * uLongueur;
  float travers = vCoord.y * ${TRAINE.toFixed(1)} * uEchelle;
  float bouts = 1.0 - smoothstep(0.24, 0.5, abs(vCoord.x) + 0.12 * (bruit3(vec3(le * 0.3, 0.0, uTemps * 0.3)) - 0.5));
  float front = 1.0 - smoothstep(${(LEVRE * 0.96).toFixed(3)}, ${(LEVRE * 1.03).toFixed(3)}, vCoord.y);
  // un « grain » d'écume : une dentelle de filets blancs (les bords des bulles serrées),
  // par endroits seulement
  float grain = bruit3(vec3(le * 3.1, travers * 3.1 - uTemps * 2.2, uTemps * 0.9));
  float dentelle = (1.0 - smoothstep(0.0, 0.07, abs(grain - 0.5))) * smoothstep(0.45, 0.7, bruit3(vec3(le * 0.7 + 3.0, travers * 0.7, uTemps * 0.5)));
  // le front : l'écume de la lèvre dégringole en coulées (un bruit très étiré vers le bas)
  float hauteurFront = vCoord.y / ${LEVRE.toFixed(3)}; // 0 au pied, 1 en haut de la lèvre
  float coulees = bruit3(vec3(le * 1.3, hauteurFront * 1.6 + uTemps * 1.8, uTemps * 0.4)) * 0.7 + grain * 0.3;
  float face = smoothstep(0.55, 1.0, hauteurFront); // (0 : la pente de la vague, 1 : le haut du front)
  float cascade = smoothstep(0.86 - 0.62 * face, 0.98 - 0.5 * face, coulees + 0.2 * face) * smoothstep(0.35, 0.7, hauteurFront);
  cascade *= 0.6 + 0.4 * max(dentelle, smoothstep(0.85, 1.0, hauteurFront));
  // la traîne : des plaques d'écume reliées par de la dentelle, étirées dans le sens où
  // elles roulent, criblées de bulles
  vec3 p = vec3(le * 0.55, travers * 0.32 - uTemps * 1.4, uTemps * 0.7);
  float n = bruit3(p) * 0.5 + bruit3(p * vec3(2.2, 2.6, 1.9) + 7.1) * 0.3 + bruit3(p * vec3(5.0, 6.0, 3.0) - 3.3) * 0.2;
  n = (n - 0.5) * 2.0 + 0.5;
  float bulles = smoothstep(0.62, 0.8, bruit3(vec3(le * 2.4, travers * 2.4 - uTemps * 3.0, uTemps)));
  float recul = (vCoord.y - ${LEVRE.toFixed(3)}) / ${(1 - LEVRE).toFixed(3)}; // 0 à la lèvre, 1 au bout
  float plaques = smoothstep(0.42 + 0.4 * recul, 0.62 + 0.35 * recul, n - 0.3 * bulles);
  float traine = max(plaques * (0.75 + 0.25 * grain), dentelle * smoothstep(0.25 + 0.3 * recul, 0.45 + 0.3 * recul, n) * 0.4) * (1.0 - smoothstep(0.2, 0.85, recul));
  float ecume = mix(traine, cascade, front);
  // (la pente devant la vague se fond dans la mer ; le front est opaque)
  float opacite = mix(traine * 0.85, 0.96 * smoothstep(0.12, 0.6, hauteurFront), front);
  return vec2(ecume, opacite * bouts * uVie);
}
// des rides et des remous sur l'eau (la hauteur d'un relief, pour les reflets)
float rides(vec3 p) {
  return bruit3(vec3(p.xz * 1.1, uTemps * 1.3)) * 0.6 + bruit3(vec3(p.xz * 2.9 + 5.0, uTemps * 2.1)) * 0.3 + bruit3(vec3(p.xz * 7.0 - 2.0, uTemps * 3.0)) * 0.1;
}`)
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
if (uClipCoque > 0.5 && dansCoque(vPosMonde)) discard;
vec2 cr = crete();
// (l'eau du front : sombre en bas, plus claire et verte en haut, là où la lèvre est assez
// mince pour que la lumière la traverse ; l'écume : blanche)
float hautFront = clamp(vCoord.y / ${LEVRE.toFixed(3)}, 0.0, 1.0);
vec3 eauFront = mix(vec3(0.015, 0.05, 0.055), vec3(0.06, 0.2, 0.19), hautFront * hautFront);
diffuseColor.rgb = mix(eauFront, vec3(0.93, 0.96, 0.97), cr.x);
diffuseColor.a *= cr.y;
if (diffuseColor.a < 0.01) discard;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.12, 0.95, cr.x);')
      // le relief des rides (calculé à l'écran : « bump mapping » par dérivées)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  float h = rides(vPosMonde) * mix(0.35, 0.1, cr.x);
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 dpdx = dFdx(-vViewPosition);
  vec3 dpdy = dFdy(-vViewPosition);
  vec3 r1 = cross(dpdy, normal);
  vec3 r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// le plancton qui s'allume dans les remous : une lueur douce dans l'écume qui roule, et
// des milliers de points qui scintillent (surtout à la lèvre, là où ça bouillonne)
float scintille = smoothstep(0.8, 0.97, bruit3(vec3(vPosMonde.xz * 5.5, uTemps * 5.0)))
                + 0.6 * smoothstep(0.85, 0.98, bruit3(vec3(vPosMonde.zx * 11.0 + 3.0, uTemps * 7.0)));
float lueur = cr.x * (0.12 + 1.1 * scintille) * (1.0 - smoothstep(${LEVRE.toFixed(3)}, ${(LEVRE + 0.3).toFixed(3)}, vCoord.y));
totalEmissiveRadiance += vec3(0.08, 0.66, 0.72) * uPhospho * lueur * 0.38;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
// l'eau (là où il n'y a pas d'écume) : comme la mer (eau.js), le reflet du ciel selon
// l'angle (Fresnel), un corps très sombre, et la lumière qui traverse la lèvre, verte
{
  vec3 nMonde = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 v = normalize(cameraPosition - vPosMonde);
  float nv = max(dot(nMonde, v), 1e-4);
  float fresnel = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  vec3 r = reflect(-v, nMonde);
  r.y = abs(r.y);
  vec3 reflet = textureLod(uReflets, r, 2.5).rgb + vec3(0.55, 0.6, 0.75) * uEclair * 0.4;
  vec3 lumiere = uAmbiance + uSoleil * max(uDirSoleil.y, 0.0) + uLune * max(uDirLune.y, 0.0) + vec3(uEclair * 0.3);
  float mince = clamp(vCoord.y / ${LEVRE.toFixed(3)}, 0.0, 1.0);
  float contreJour = pow(saturate(dot(-v, uDirSoleil) * 0.8 + 0.2), 3.0);
  vec3 corps = uCouleurFond * lumiere + uCouleurTranslucide * (uSoleil * contreJour * 1.4 + uAmbiance * 0.35) * mince * mince * 1.4;
  gl_FragColor.rgb = mix(corps * (1.0 - fresnel) + reflet * fresnel, gl_FragColor.rgb, cr.x);
}
{
  vec3 versPoint = vPosMonde - cameraPosition;
  float distance = length(versPoint);
  vec3 d = versPoint / distance;
  vec3 horizon = texture(uCarteCiel, uvCarteCiel(normalize(vec3(d.x, max(d.y, 0.012), d.z)))).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, horizon, 1.0 - exp(-distance * uBrume));
}`);
  };
  m.customProgramCacheKey = () => 'deferlante-ecume';
  return m;
}

// Une crête : une bande de (nu + 1) × (NV + 1) sommets, recalculée à chaque image
export class Crete {
  constructor(materiau, nu = NU) {
    this.nu = nu;
    const NU = nu;
    const n = (NU + 1) * (NV + 1);
    this.positions = new Float32Array(n * 3);
    const coords = new Float32Array(n * 2);
    const indices = [];
    for (let j = 0; j <= NV; j++) {
      for (let i = 0; i <= NU; i++) {
        const k = j * (NU + 1) + i;
        coords[k * 2] = i / NU - 0.5;
        coords[k * 2 + 1] = j / NV;
        if (i < NU && j < NV) indices.push(k, k + 1, k + NU + 1, k + 1, k + NU + 2, k + NU + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    g.setAttribute('coord', new THREE.BufferAttribute(coords, 2));
    // (des normales dès le départ : sans elles, les shaders préparés au chargement seraient
    // ceux des « facettes plates », et il faudrait les refaire en pleine nuit)
    const normales = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) normales[k * 3 + 1] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
    g.setIndex(indices);
    this.geometrie = g;
    this.materiau = materiau;
    this.mesh = new THREE.Mesh(g, materiau);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    this.active = false;
  }
}

export class Deferlantes3D {
  // embruns : pour les gerbes arrachées au sommet des crêtes (rendu/embruns.js)
  constructor(scene, houle, eau, embruns) {
    this.houle = houle;
    this.embruns = embruns;
    this.cretes = [0, 1, 2].map(() => {
      const c = new Crete(materiauEcume(eau));
      scene.add(c.mesh);
      return c;
    });
    this.phospho = 0;
    this._p = new THREE.Vector3();
    this._perp = new THREE.Vector3();
  }

  // Une déferlante arrive : annonce = { force, vers (où elle va), dans (s avant de frapper) }
  annoncer(annonce) {
    const c = this.cretes.find((x) => !x.active) ?? this.cretes[0];
    c.active = true;
    c.force = annonce.force;
    c.vers = annonce.vers.clone().setY(0).normalize();
    c.t = annonce.dans; // secondes avant l'impact (négatif après)
    c.age = 0;
    c.longueur = 24 + 30 * Math.min(1.2, annonce.force);
    c.hauteur = 0.7 + 1.5 * Math.min(1.2, annonce.force); // la hauteur du front (m)
    c.decalage = (Math.random() - 0.5) * 6;
    c.mesh.visible = true;
  }

  // centre : la position du bateau (monde) ; nuit : 0 → 1 (le plancton ne se voit que la nuit)
  maj(dt, temps, centre, { nuit = 0, vent = null } = {}) {
    for (const c of this.cretes) {
      if (!c.active) continue;
      c.t -= dt;
      c.age += dt;
      // (au moment du choc, la crête est sur le bateau : on la cache, les embruns et l'eau
      // dans le cockpit prennent le relais ; elle reparaît sous le vent, et s'éteint)
      const surLeBateau = lisse(0.3, 0.1, c.t) * lisse(-0.75, -0.5, c.t);
      const vie = lisse(0, 0.9, c.age) * (1 - lisse(1.5, 3.2, -c.t)) * (1 - surLeBateau);
      if (c.t < -3.2) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      const u = c.materiau.userData.uniforms;
      u.uTemps.value = temps;
      u.uVie.value = vie;
      u.uPhospho.value = nuit * (0.6 + 0.6 * c.force);
      u.uLongueur.value = c.longueur;
      // la crête court vers le bateau ; elle passe sur lui, puis continue sous le vent
      const perp = this._perp.set(-c.vers.z, 0, c.vers.x);
      const cx = centre.x - c.vers.x * VITESSE_CRETE * c.t + perp.x * c.decalage;
      const cz = centre.z - c.vers.z * VITESSE_CRETE * c.t + perp.z * c.decalage;
      const pos = c.positions;
      // (la vague se dresse en arrivant : le front grandit pendant la première seconde)
      const dresse = 0.35 + 0.65 * lisse(0, 1.2, c.age);
      // la bosse de la vague sous la crête (elle s'efface en arrivant sur le bateau)
      const vague = (0.6 + 1.1 * Math.min(1.2, c.force)) * dresse * Math.max(lisse(0.25, 0.9, c.t), lisse(-0.6, -1.3, c.t));
      let k = 0;
      for (let j = 0; j <= NV; j++) {
        const [recul, haut, bosseVague] = PROFIL[j];
        for (let i = 0; i <= NU; i++) {
          const s = i / NU - 0.5;
          const bouts = 1 - lisse(0.3, 0.5, Math.abs(s));
          // (la crête n'est pas droite : elle ondule, et ses bouts traînent derrière)
          const courbe = Math.sin(s * 5.1 + c.force * 3) * 1.2 + (s * 2) ** 2 * 2.5;
          const x = cx + perp.x * s * c.longueur - c.vers.x * (recul + courbe);
          const z = cz + perp.z * s * c.longueur - c.vers.z * (recul + courbe);
          const bosse = (c.hauteur * dresse * haut * (0.85 + 0.15 * Math.sin(s * 13 + temps * 2)) + vague * bosseVague) * bouts;
          pos[k++] = x;
          pos[k++] = this.houle.hauteur(x, z) + bosse + 0.05;
          pos[k++] = z;
        }
      }
      c.geometrie.attributes.position.needsUpdate = true;
      c.geometrie.computeVertexNormals();
      // le vent arrache des embruns au sommet de la lèvre : une fine poussière d'eau, et
      // une brume plus légère qui fume derrière la crête
      if (this.embruns && vie > 0.3) {
        const n = Math.floor((10 + 40 * c.force) * dt * 30 * vie);
        for (let q = 0; q < n; q++) {
          const s = (Math.random() - 0.5) * 0.8;
          const i = Math.round((s + 0.5) * NU);
          const kk = (RANG_LEVRE * (NU + 1) + i) * 3; // la rangée du haut de la lèvre
          this._p.set(pos[kk], pos[kk + 1] + 0.15, pos[kk + 2]);
          const brume = Math.random() < 0.18;
          this.embruns.emettre(this._p, {
            vx: c.vers.x * (VITESSE_CRETE + 1) + (vent?.x ?? 0) * 0.3 + (Math.random() - 0.5) * 2,
            vy: (brume ? 0.8 : 1.5) + Math.random() * 3 * c.force,
            vz: c.vers.z * (VITESSE_CRETE + 1) + (vent?.z ?? 0) * 0.3 + (Math.random() - 0.5) * 2,
            vie: brume ? 1.2 + Math.random() * 1.2 : 0.6 + Math.random() * 0.9,
            taille: brume ? 0.6 + Math.random() * 1.2 : 0.015 + Math.random() * 0.045,
            opacite: brume ? 0.07 : 0.55,
            phospho: Math.random() < 0.3 ? 1 : 0,
          });
        }
      }
    }
  }
}
