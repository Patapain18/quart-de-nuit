// Le paquet de mer : quand une grosse déferlante frappe le bateau, une nappe d'eau verte
// passe par-dessus le livet et balaie le pont d'un bord à l'autre, avec sa ligne d'écume
// en tête et des traînées blanches, puis s'écoule par-dessus bord en deux secondes.
//
// Elle est peinte sur le pont lui-même, dans le shader de ses matériaux (antidérapant,
// teck, gelcoat) : elle en épouse donc toutes les formes (passavants, rouf, cockpit) sans
// rien traverser. Sur ces surfaces tournées vers le ciel, là où passe la nappe : l'eau
// sombre et lisse (elle efface le relief de l'antidérapant et reflète le ciel), et l'écume.
import * as THREE from 'three';

const VITESSE = 5.5; // m/s : la nappe traverse le bateau en moins d'une seconde

const GLSL = /* glsl */ `
uniform vec4 uPaquet;      // sens de l'écoulement (x, z, repère du bateau), âge (s), force (0 → 1)
uniform float uPaquetZ;    // où il frappe, le long du bateau (m)
uniform float uPaquetLueur; // la nuit, le plancton de l'écume s'allume (0 → 1)
varying vec3 vPaquetPos;
varying vec3 vPaquetNormale;

float hasardP(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruitP(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hasardP(i), hasardP(i + vec2(1, 0)), f.x), mix(hasardP(i + vec2(0, 1)), hasardP(i + vec2(1, 1)), f.x), f.y);
}

// (nappe, écume), de 0 à 1 ; versLeCiel : la normale de la face vue, en hauteur (le pont
// est dessiné des deux côtés : ses normales ne sont pas toutes tournées vers le haut)
vec2 paquetDeMer(float versLeCiel) {
  float age = uPaquet.z;
  if (uPaquet.w < 0.01 || age > 3.2) return vec2(0.0);
  vec2 sens = uPaquet.xy;
  vec2 travers = vec2(-sens.y, sens.x);
  vec2 p = vPaquetPos.xz - vec2(0.0, uPaquetZ);
  float s = dot(p, sens);    // le long de l'écoulement (0 : l'axe du bateau)
  float l = dot(p, travers); // en travers
  // la tête de la nappe avance, irrégulière ; derrière elle, l'eau s'amincit et s'en va
  float irregulier = bruitP(vec2(l * 1.3, age * 2.0)) - 0.5;
  float tete = -3.0 + ${VITESSE.toFixed(1)} * age + irregulier * 0.7;
  float queue = tete - 1.2 - 2.6 * age;
  float dans = smoothstep(tete + 0.05, tete - 0.25, s) * smoothstep(queue - 0.6, queue + 0.6, s);
  // elle s'étale le long du bateau en avançant
  float longueur = 1.6 + 2.8 * age;
  dans *= 1.0 - smoothstep(longueur * 0.7, longueur, abs(l) + irregulier * 0.8);
  // seulement sur ce qui regarde le ciel, et pas plus haut que le toit du rouf (la
  // timonerie dépasse : l'eau la contourne)
  dans *= smoothstep(0.35, 0.75, versLeCiel) * (1.0 - smoothstep(2.05, 2.25, vPaquetPos.y));
  // et elle s'écoule par-dessus bord
  float force = uPaquet.w * (1.0 - smoothstep(1.4, 3.2, age));
  float nappe = clamp(dans * force * 1.4, 0.0, 1.0);
  // l'écume : une ligne en tête, déchirée ; au début, presque toute la nappe est blanche
  // (de l'eau pleine d'air), puis des traînées qui filent avec l'eau et se défont
  float ligne = exp(-pow((s - tete) / 0.3, 2.0)) * (0.6 + bruitP(vec2(l * 4.0, age * 3.0)));
  vec2 q = vec2((s - age * ${VITESSE.toFixed(1)} * 0.8) * 1.4, l * 5.0);
  float motif = bruitP(q) * 0.65 + bruitP(q * 2.7 + 3.0) * 0.35;
  float blanche = 1.0 - smoothstep(0.3, 2.4, age);
  float trainees = smoothstep(0.75 - 0.5 * blanche, 0.95 - 0.4 * blanche, motif);
  float ecume = clamp(ligne + trainees, 0.0, 1.0) * nappe;
  return vec2(nappe, ecume);
}
`;

export class PaquetDeMer {
  constructor(bateau) {
    this.uniforms = {
      uPaquet: { value: new THREE.Vector4(1, 0, 99, 0) },
      uPaquetZ: { value: 0 },
      uPaquetLueur: { value: 0 },
      uBateauInverseP: { value: new THREE.Matrix4() },
    };
    for (const nom of ['antiderapant', 'teck', 'gelcoat']) {
      const m = bateau.materiaux[nom];
      if (m) this.installer(m, nom);
    }
  }

  installer(m, nom) {
    const u = this.uniforms;
    const avant = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      avant?.call(m, shader, renderer);
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
uniform mat4 uBateauInverseP;
varying vec3 vPaquetPos;
varying vec3 vPaquetNormale;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vPaquetPos = (uBateauInverseP * modelMatrix * vec4(transformed, 1.0)).xyz;
  vPaquetNormale = normalize(mat3(uBateauInverseP * modelMatrix) * objectNormal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
${GLSL}`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  // le paquet de mer : l'eau verte, sombre et lisse, et son écume
  vec2 paquet = paquetDeMer(normalize(vPaquetNormale).y * (gl_FrontFacing ? 1.0 : -1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.15, 0.12), paquet.x * 0.9);
  roughnessFactor = mix(roughnessFactor, 0.03, paquet.x);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.92, 0.92), paquet.y);
  roughnessFactor = mix(roughnessFactor, 0.55, paquet.y);
  totalEmissiveRadiance += vec3(0.03, 0.4, 0.42) * paquet.y * uPaquetLueur * 0.04;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize(mix(normal, nonPerturbedNormal, paquet.x));`);
    };
    // (un programme à part pour ces matériaux)
    const cle = m.customProgramCacheKey?.bind(m);
    m.customProgramCacheKey = () => `${cle ? cle() : ''}|paquet-de-mer|${nom}`;
    m.needsUpdate = true;
  }

  // Une déferlante frappe : sens (repère du bateau) dans lequel l'eau s'écoule, et force
  frapper(sens, force) {
    if (force < 0.3) return;
    const u = this.uniforms;
    const d = new THREE.Vector2(sens.x, sens.z);
    if (d.lengthSq() < 1e-4) return;
    d.normalize();
    // (une plus forte remplace une plus faible en cours, sinon on attend la fin)
    if (u.uPaquet.value.z < 1.2 && u.uPaquet.value.w > force) return;
    u.uPaquet.value.set(d.x, d.y, 0, Math.min(1, 0.45 + force * 0.6));
    // elle frappe d'où elle vient : par l'arrière, c'est le cockpit qui prend ; par
    // l'avant, la plage avant
    u.uPaquetZ.value = THREE.MathUtils.clamp(-d.y * 3.9, -4.5, 4.5);
  }

  maj(dt, groupe, nuit = 0) {
    const u = this.uniforms;
    u.uPaquet.value.z += dt;
    u.uPaquetLueur.value = nuit;
    u.uBateauInverseP.value.copy(groupe.matrixWorld).invert();
  }
}
