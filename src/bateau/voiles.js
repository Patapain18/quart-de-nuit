// Les voiles : la grand-voile (accrochée au mât et à la bôme) et le foc (sur l'étai,
// à l'avant). Leur forme est recalculée à chaque image :
//  - le creux : une voile bien réglée est bombée comme une aile d'avion (12 % de
//    profondeur, le plus creux un peu en avant du milieu) ;
//  - le vrillage : le haut de la voile s'ouvre plus que le bas ;
//  - le faseyement : quand la voile est trop bordée vers le vent (ou pas assez
//    tendue), elle bat comme un drapeau. C'est LE signe qu'elle est mal réglée.
//  - la prise de ris : on réduit la grand-voile par gros temps (le haut descend,
//    le bas est roulé sur la bôme) ; le foc s'enroule autour de l'étai.
import * as THREE from 'three';
import { texturesToile } from './textures.js';

// La toile : tissu, coutures des laizes, lattes, bandes de ris ; elle laisse passer
// la lumière quand le soleil est derrière (la voile s'illumine à contre-jour).
function materiauVoile(textures, { lattes = 0, ris = [] } = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: textures.couleur,
    normalMap: textures.normales,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  m.userData.uniforms = {
    uDirLumiereVue: { value: new THREE.Vector3(0, 1, 0) },
    uLumiere: { value: new THREE.Color(1, 1, 1) },
    uLattes: { value: lattes },
    uDechiree: { value: 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, m.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 voile;\nvarying vec2 vVoile;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVoile = voile;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vVoile; // x : position le long de la corde (0 au guindant, 1 à la chute), y : hauteur (m)
uniform vec3 uDirLumiereVue;
uniform vec3 uLumiere;
uniform float uLattes;
uniform float uDechiree;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
// déchirée : une grande déchirure en biais, aux bords effilochés, et un morceau de la
// chute arraché
if (uDechiree > 0.5) {
  float bord = 0.012 * sin(vVoile.y * 47.0) + 0.008 * sin(vVoile.y * 113.0);
  float fente = abs(vVoile.x - 0.34 - vVoile.y * 0.07 + bord);
  float ouverture = 0.035 * smoothstep(0.6, 2.2, vVoile.y) * smoothstep(5.6, 3.8, vVoile.y);
  if (fente < ouverture) discard;
  float arrache = vVoile.x - 0.78 - 0.06 * sin(vVoile.y * 5.0) + 0.02 * sin(vVoile.y * 31.0);
  if (arrache > 0.0 && vVoile.y > 1.4 && vVoile.y < 4.6) discard;
  diffuseColor.rgb *= 1.0 - 0.25 * smoothstep(0.06, 0.0, fente - ouverture);
}
{
  // coutures des laizes (bandes de tissu horizontales de 85 cm)
  float laize = abs(fract(vVoile.y / 0.85) - 0.5) * 2.0;
  float couture = smoothstep(0.985, 1.0, laize);
  diffuseColor.rgb *= 1.0 - 0.18 * couture;
  // renforts aux coins (plusieurs épaisseurs de tissu, plus sombres)
  float coin = max(smoothstep(0.85, 1.0, 1.0 - length(vec2(vVoile.x * 3.0, vVoile.y * 0.8))),
                   smoothstep(0.85, 1.0, 1.0 - length(vec2((1.0 - vVoile.x) * 3.0, vVoile.y * 0.8))));
  diffuseColor.rgb *= 1.0 - 0.12 * coin;
  // lattes (de longues baguettes glissées dans des fourreaux)
  if (uLattes > 0.0) {
    float l = fract(vVoile.y / uLattes);
    float fourreau = smoothstep(0.0, 0.006, abs(l - 0.5) - 0.012) ;
    diffuseColor.rgb *= mix(0.84, 1.0, fourreau + step(vVoile.x, 0.45));
  }
  // la bordure de la chute, renforcée
  diffuseColor.rgb *= 1.0 - 0.15 * smoothstep(0.975, 1.0, vVoile.x);
}`)
      .replace('#include <opaque_fragment>', `
// la lumière traverse la toile : si le soleil éclaire l'autre face, celle-ci s'illumine
{
  float dos = max(0.0, -dot(normal, uDirLumiereVue));
  outgoingLight += diffuseColor.rgb * uLumiere * dos * 0.32;
}
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'voile';
  return m;
}

// Une voile = une grille (nu le long de la corde × nv en hauteur) dont on recalcule
// les sommets à chaque image.
class Voile {
  constructor(materiau, nu = 18, nv = 28) {
    this.nu = nu;
    this.nv = nv;
    const n = (nu + 1) * (nv + 1);
    this.positions = new Float32Array(n * 3);
    this.coords = new Float32Array(n * 2);
    const indices = [];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        const b = a + nu + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    g.setAttribute('voile', new THREE.BufferAttribute(this.coords, 2));
    const uv = new Float32Array(n * 2);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(indices);
    this.uv = uv;
    this.geometrie = g;
    this.mesh = new THREE.Mesh(g, materiau);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  // forme(i/nu, j/nv) → { p: [x, y, z], hauteur (m) }
  remplir(forme) {
    const { nu, nv, positions, coords, uv } = this;
    let k = 0;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const t = i / nu;
        const v = j / nv;
        const { p, hauteur } = forme(t, v);
        positions[k * 3] = p[0];
        positions[k * 3 + 1] = p[1];
        positions[k * 3 + 2] = p[2];
        coords[k * 2] = t;
        coords[k * 2 + 1] = hauteur;
        uv[k * 2] = p[2] * 0.6 + p[0] * 0.6;
        uv[k * 2 + 1] = hauteur * 0.6;
        k++;
      }
    }
    const g = this.geometrie;
    g.attributes.position.needsUpdate = true;
    g.attributes.voile.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.computeVertexNormals();
  }
}

// Le creux d'une voile le long de sa corde : 0 au guindant et à la chute, maximal
// à la position « creux » (0,4 = 40 % de la corde)
function creux(t, position) {
  const a = Math.log(0.5) / Math.log(position);
  return Math.sin(Math.PI * Math.pow(t, a));
}

export class Voiles {
  // mesures : celles du gréement (modele.js) ; etai : [pied, tête] de l'étai
  constructor(mesures, { couleur } = {}) {
    const toile = texturesToile({ couleur });
    this.materiauGrandVoile = materiauVoile(toile, { lattes: 2.6 });
    this.materiauFoc = materiauVoile(toile);
    this.grandVoile = new Voile(this.materiauGrandVoile, 18, 30);
    this.foc = new Voile(this.materiauFoc, 16, 26);
    this.grandVoile.mesh.name = 'grand-voile';
    this.foc.mesh.name = 'foc';
    this.m = mesures;
    this.temps = 0;
  }

  // reglage : {
  //   angleBome (rad, 0 = dans l'axe, + vers tribord), cote (+1 si la grand-voile se
  //   gonfle vers tribord), faseyement (0 → 1), ris (0, 1, 2),
  //   angleFoc (rad), coteFoc, faseyementFoc, deroule (0 → 1 : foc enroulé → déroulé),
  //   force (0 → 1 : la voile tire, elle est bien tendue) }
  maj(dt, reglage) {
    this.temps += dt;
    this.majGrandVoile(reglage);
    this.majFoc(reglage);
  }

  majGrandVoile(r) {
    const m = this.m;
    const vit = m.vit;
    const ris = r.ris ?? 0;
    // affalée : elle est ferlée sur la bôme (voir Bateau.voileFerlee)
    this.grandVoile.mesh.visible = ris < 3;
    this.materiauGrandVoile.userData.uniforms.uDechiree.value = r.dechiree ? 1 : 0;
    if (ris >= 3) return;
    // chaque ris descend la têtière d'environ 1,5 m
    const hauteurGuindant = m.tete - 0.15 - vit - ris * 1.45;
    const bordure = 3.55; // longueur de la bordure (le bas, le long de la bôme)
    const zGuindant = m.zMat + 0.08;
    const temps = this.temps;
    const fas = r.faseyement ?? 0;
    const cote = r.cote ?? 1;
    const vrillage = 0.22 + 0.12 * fas;
    const profondeur = 0.12 * (1 - 0.75 * fas) * (0.6 + 0.4 * (r.force ?? 1));
    this.grandVoile.remplir((t, v) => {
      // la voile s'affine vers le haut (un peu de « rond » de chute grâce aux lattes)
      const corde = bordure * ((1 - v) * 0.93 + 0.07) + 0.35 * Math.sin(Math.PI * v) * (1 - v * 0.3);
      const angle = r.angleBome + cote * vrillage * v * v;
      const dx = Math.sin(angle);
      const dz = Math.cos(angle);
      // le creux pousse la toile sous le vent, perpendiculairement à la corde
      let bombe = profondeur * corde * creux(t, 0.42) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, v * 1.3 + 0.1)));
      // le faseyement : des vagues qui courent du guindant vers la chute
      const vague = Math.sin(t * 9 - temps * 14 + v * 5) * 0.5 + Math.sin(t * 15 - temps * 23 + v * 9) * 0.25;
      bombe += fas * corde * 0.06 * vague * Math.sin(Math.PI * t) * (0.4 + 0.6 * t);
      const x = dx * corde * t + dz * bombe * cote;
      const z = dz * corde * t - dx * bombe * cote;
      const y = vit + 0.06 + hauteurGuindant * v + 0.06 * t * (1 - v);
      return { p: [x, y, zGuindant + z], hauteur: hauteurGuindant * v };
    });
  }

  majFoc(r) {
    const m = this.m;
    const deroule = r.deroule ?? 1;
    const fas = r.faseyementFoc ?? 0;
    const cote = r.coteFoc ?? 1;
    const temps = this.temps;
    // le guindant suit l'étai, de l'étrave au capelage
    const pied = m.etrave;
    const tete = [0, m.capelage - 0.35, m.zMat - 0.1];
    const bordure = 3.3 * deroule;
    const vrillage = 0.18 + 0.15 * fas;
    const profondeur = 0.13 * (1 - 0.8 * fas);
    this.foc.remplir((t, v) => {
      const lx = pied[0] + (tete[0] - pied[0]) * v;
      const ly = pied[1] + (tete[1] - pied[1]) * v;
      const lz = pied[2] + (tete[2] - pied[2]) * v;
      const corde = bordure * (1 - v) + 0.04;
      const angle = (r.angleFoc ?? 0) + cote * vrillage * v;
      const dx = Math.sin(angle);
      const dz = Math.cos(angle);
      let bombe = profondeur * corde * creux(t, 0.38);
      const vague = Math.sin(t * 10 - temps * 16 + v * 6) * 0.5 + Math.sin(t * 17 - temps * 27 + v * 11) * 0.25;
      bombe += fas * corde * 0.07 * vague * Math.sin(Math.PI * t) * (0.4 + 0.6 * t);
      // la bordure remonte un peu vers le point d'écoute
      const y = ly + 0.25 * t * (1 - v);
      return { p: [lx + dx * corde * t + dz * bombe * cote, y, lz + dz * corde * t - dx * bombe * cote], hauteur: v * 9 };
    });
  }

  // Direction de la lumière (soleil ou lune) vue par la caméra, pour la toile à contre-jour
  eclairer(directionMonde, couleur, camera) {
    const d = directionMonde.clone().transformDirection(camera.matrixWorldInverse);
    for (const m of [this.materiauGrandVoile, this.materiauFoc]) {
      m.userData.uniforms.uDirLumiereVue.value.copy(d);
      m.userData.uniforms.uLumiere.value.copy(couleur);
    }
  }
}
