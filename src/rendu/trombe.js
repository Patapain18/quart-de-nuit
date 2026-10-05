// La trombe marine du crépuscule : une tornade au-dessus de la mer.
//
// Ce qu'on voit, c'est de la vapeur d'eau qui se condense dans l'air qui tourne très vite
// (la pression y chute) : un long tube gris, qui descend de la base des nuages jusqu'à
// la mer, plus large en haut (il s'évase dans le nuage), courbé par le vent (en bas,
// l'air va moins vite qu'en haut : le pied traîne derrière), et qui ondule. Le tube est
// plus opaque sur ses bords (on y regarde à travers plus de vapeur) et strié de bandes
// qui tournent. À son pied, la mer est arrachée : un « buisson » d'embruns qui
// tourbillonne, haut de vingt ou trente mètres.
// Elle naît (le tube descend du nuage), vit trois ou quatre minutes, puis s'amincit en
// corde, se tord et disparaît.
import * as THREE from 'three';
import { GLSL_CARTE_CIEL } from './ciel.js';

const SEGMENTS = 40; // autour
const ETAGES = 72; // en hauteur

const GLSL_BRUIT = /* glsl */ `
float hasardT(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float bruitT(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hasardT(i), hasardT(i + vec3(1, 0, 0)), f.x), mix(hasardT(i + vec3(0, 1, 0)), hasardT(i + vec3(1, 1, 0)), f.x), f.y);
  float b = mix(mix(hasardT(i + vec3(0, 0, 1)), hasardT(i + vec3(1, 0, 1)), f.x), mix(hasardT(i + vec3(0, 1, 1)), hasardT(i + vec3(1, 1, 1)), f.x), f.y);
  return mix(a, b, f.z);
}
`;

// Le tube : chaque sommet a son angle autour (a), sa hauteur (t, de 0 au pied à 1 au
// nuage) ; la carte graphique place le tube (rayon, courbure, ondulation)
const SOMMET_TUBE = /* glsl */ `
attribute vec2 at;
uniform float uHauteur;    // de la mer à la base des nuages (m)
uniform float uTemps;
uniform float uForce;      // 0 → 1 : elle se forme, puis s'amincit avant de disparaître
uniform float uCorde;      // 0 → 1 : la fin, quand elle n'est plus qu'une corde tordue
uniform vec2 uVent;        // direction où va le vent (dans le plan)
uniform float uPied;       // la hauteur de la mer à son pied
varying vec3 vPosMonde;
varying vec3 vNormale;
varying vec2 vAt;
vec3 axe(float t) {
  // (le pied traîne derrière le haut, et le tube ondule, de plus en plus quand il meurt)
  vec2 perp = vec2(-uVent.y, uVent.x);
  float traine = (1.0 - t) * (1.0 - t) * (70.0 + 160.0 * uCorde);
  float ondule = sin(t * 5.0 - uTemps * 0.35) * (12.0 + 90.0 * uCorde) * t * (1.0 - t) * 4.0;
  vec2 xz = -uVent * traine + perp * ondule;
  return vec3(xz.x, mix(uPied, uHauteur, t), xz.y);
}
float rayon(float t) {
  float r = 7.0 + 9.0 * t + 55.0 * pow(t, 6.0);
  // il descend du nuage en se formant, et s'amincit en corde à la fin
  return r * mix(1.0, 0.35, uCorde) * (0.6 + 0.4 * uForce);
}
void main() {
  float a = at.x;
  // (en bas, le tube n'est pas encore descendu jusqu'à la mer quand il se forme)
  float t = mix(1.0 - uForce * 1.15, 1.0, at.y);
  t = clamp(t, 0.0, 1.0);
  vec3 c = axe(t);
  vec3 dc = normalize(axe(min(1.0, t + 0.01)) - axe(max(0.0, t - 0.01)));
  vec3 x = normalize(cross(dc, vec3(0.0, 0.0, 1.0)));
  vec3 z = normalize(cross(x, dc));
  // (le tube n'est pas un cylindre parfait : il se gonfle et se pince, et ça tourne)
  float r = rayon(t) * (1.0 + 0.08 * sin(a * 3.0 + t * 20.0 - uTemps * 2.0) + 0.06 * sin(a * 5.0 - t * 37.0 + uTemps * 3.0)
                       + 0.12 * sin(t * 13.0 + uTemps * 0.7) + 0.07 * sin(t * 31.0 - uTemps * 1.3));
  vec3 dir = cos(a) * x + sin(a) * z;
  vec3 p = c + dir * r;
  vNormale = dir;
  vAt = vec2(a, t);
  vec4 monde = modelMatrix * vec4(p, 1.0);
  vPosMonde = monde.xyz;
  gl_Position = projectionMatrix * viewMatrix * monde;
}
`;

const FRAGMENT_TUBE = /* glsl */ `
#include <common>
uniform float uTemps;
uniform float uForce;
uniform vec3 uAmbiance;
uniform vec3 uSoleil;
uniform vec3 uDirSoleil;
uniform float uEclair;
uniform sampler2D uCarteCiel;
uniform float uBrume;
varying vec3 vPosMonde;
varying vec3 vNormale;
varying vec2 vAt;
${GLSL_CARTE_CIEL}
${GLSL_BRUIT}
void main() {
  vec3 v = normalize(cameraPosition - vPosMonde);
  float bord = 1.0 - abs(dot(normalize(vNormale), v));
  // des stries qui tournent autour du tube (et montent en spirale)
  float stries = bruitT(vec3(vAt.x * 2.0 + vAt.y * 18.0 - uTemps * 1.6, vAt.y * 40.0, uTemps * 0.3)) * 0.65
               + bruitT(vec3(vAt.x * 5.0 - uTemps * 2.4, vAt.y * 90.0, uTemps * 0.5)) * 0.35;
  float densite = mix(0.32, 0.9, pow(bord, 1.4)) * (0.6 + 0.55 * stries);
  // (un bord effiloché, irrégulier)
  densite *= 0.7 + 0.55 * bruitT(vec3(vAt.x * 6.0 + uTemps * 0.8, vAt.y * 25.0, uTemps * 0.7));
  // le haut se fond dans le nuage, le pied s'effiloche dans les embruns
  densite *= smoothstep(0.0, 0.08, vAt.y) * (1.0 - smoothstep(0.68, 0.95, vAt.y)) * uForce;
  if (densite < 0.01) discard;
  // éclairée par le ciel du couchant (et par le soleil bas, à travers le nuage)
  float face = max(dot(normalize(vNormale), uDirSoleil), 0.0);
  vec3 c = vec3(0.62, 0.64, 0.68) * (uAmbiance * 1.3 + uSoleil * (0.12 + 0.3 * face)) + vec3(0.7, 0.75, 0.9) * uEclair * 0.6;
  c *= 0.75 + 0.35 * stries;
  // (le haut est dans l'ombre du nuage : il s'y fond)
  c *= mix(1.0, 0.4, smoothstep(0.45, 0.9, vAt.y));
  // la brume, comme pour la mer et la côte
  vec3 versPoint = vPosMonde - cameraPosition;
  float distance = length(versPoint);
  vec3 d = versPoint / distance;
  vec3 horizon = texture(uCarteCiel, uvCarteCiel(normalize(vec3(d.x, max(d.y, 0.012), d.z)))).rgb;
  c = mix(c, horizon, 1.0 - exp(-distance * uBrume));
  gl_FragColor = vec4(c, densite);
}
`;

// Le buisson d'embruns au pied : un cône évasé, vu en transparence, qui tourne
const SOMMET_BUISSON = /* glsl */ `
attribute vec2 at;
uniform float uTemps;
uniform float uForce;
uniform float uPied;
varying vec3 vPosMonde;
varying vec2 vAt;
void main() {
  float a = at.x + uTemps * 0.9 * (1.0 - at.y * 0.3);
  float t = at.y;
  float r = mix(50.0, 14.0, pow(t, 0.6)) * (0.7 + 0.3 * uForce) * (1.0 + 0.18 * sin(at.x * 4.0 + uTemps) + 0.1 * sin(at.x * 9.0 - uTemps * 1.7));
  vec3 p = vec3(cos(a) * r, uPied + t * 38.0 * uForce, sin(a) * r);
  vAt = vec2(at.x, t);
  vec4 monde = modelMatrix * vec4(p, 1.0);
  vPosMonde = monde.xyz;
  gl_Position = projectionMatrix * viewMatrix * monde;
}
`;
const FRAGMENT_BUISSON = /* glsl */ `
#include <common>
uniform float uTemps;
uniform float uForce;
uniform vec3 uAmbiance;
uniform vec3 uSoleil;
uniform float uEclair;
uniform sampler2D uCarteCiel;
uniform float uBrume;
varying vec3 vPosMonde;
varying vec2 vAt;
${GLSL_CARTE_CIEL}
${GLSL_BRUIT}
void main() {
  // (un nuage d'eau pulvérisée qui bouillonne : un bruit doux, à grandes taches)
  float n = bruitT(vec3(vAt.x * 1.6 + uTemps * 0.9, vAt.y * 2.5 - uTemps * 1.2, uTemps * 0.3)) * 0.65
          + bruitT(vec3(vAt.x * 4.0 - uTemps * 1.5, vAt.y * 6.0, uTemps * 0.6)) * 0.35;
  float densite = smoothstep(0.25, 0.75, n) * (1.0 - smoothstep(0.35, 1.0, vAt.y)) * smoothstep(0.0, 0.1, vAt.y) * 0.6 * uForce;
  if (densite < 0.01) discard;
  vec3 c = vec3(0.85, 0.88, 0.9) * (uAmbiance * 1.5 + uSoleil * 0.25) + vec3(0.7, 0.75, 0.9) * uEclair * 0.6;
  vec3 versPoint = vPosMonde - cameraPosition;
  float distance = length(versPoint);
  vec3 d = versPoint / distance;
  vec3 horizon = texture(uCarteCiel, uvCarteCiel(normalize(vec3(d.x, max(d.y, 0.012), d.z)))).rgb;
  c = mix(c, horizon, 1.0 - exp(-distance * uBrume));
  gl_FragColor = vec4(c, densite);
}
`;

function grilleTube(segments, etages) {
  const at = [];
  const indices = [];
  for (let j = 0; j <= etages; j++) {
    for (let i = 0; i <= segments; i++) at.push((i / segments) * Math.PI * 2, j / etages);
  }
  for (let j = 0; j < etages; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(at.length * 1.5), 3));
  g.setAttribute('at', new THREE.Float32BufferAttribute(at, 2));
  g.setIndex(indices);
  return g;
}

export class Trombe3D {
  constructor(scene, houle, eau, ciel, embruns) {
    this.houle = houle;
    this.ciel = ciel;
    this.embruns = embruns;
    const u = eau.uniforms;
    this.uniforms = {
      uHauteur: { value: 900 },
      uTemps: { value: 0 },
      uForce: { value: 0 },
      uCorde: { value: 0 },
      uVent: { value: new THREE.Vector2(1, 0) },
      uPied: { value: 0 },
      uAmbiance: u.uAmbiance,
      uSoleil: u.uSoleil,
      uDirSoleil: u.uDirSoleil,
      uEclair: u.uEclair,
      uCarteCiel: u.uCarteCiel,
      uBrume: u.uBrume,
    };
    const materiau = (sommet, fragment) => new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: sommet, fragmentShader: fragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.groupe = new THREE.Group();
    this.groupe.name = 'trombe';
    this.tube = new THREE.Mesh(grilleTube(SEGMENTS, ETAGES), materiau(SOMMET_TUBE, FRAGMENT_TUBE));
    this.buisson = new THREE.Mesh(grilleTube(32, 10), materiau(SOMMET_BUISSON, FRAGMENT_BUISSON));
    for (const m of [this.tube, this.buisson]) {
      m.frustumCulled = false;
      m.renderOrder = 4;
      this.groupe.add(m);
    }
    this.groupe.visible = false;
    scene.add(this.groupe);
    this._p = new THREE.Vector3();
  }

  // trombe : { x, z, force, age, duree } (jeu/nuit.js), ou null ; directionVent : vers où
  // va le vent (radians, dans le plan) ; temps : l'horloge du monde
  maj(dt, trombe, { temps, directionVent }) {
    this.groupe.visible = !!trombe && trombe.force > 0.01;
    if (!this.groupe.visible) return;
    const u = this.uniforms;
    u.uTemps.value = temps;
    u.uForce.value = trombe.force;
    // (les 40 dernières secondes, elle s'amincit en corde)
    u.uCorde.value = THREE.MathUtils.smoothstep(trombe.age, trombe.duree - 45, trombe.duree - 5);
    u.uVent.value.set(Math.cos(directionVent), Math.sin(directionVent));
    u.uHauteur.value = this.ciel.uniformsNuages.uBaseNuages.value + 60;
    u.uPied.value = this.houle.hauteur(trombe.x, trombe.z);
    this.groupe.position.set(trombe.x, 0, trombe.z);
    // le pied arrache la mer : des embruns qui tourbillonnent et montent
    if (this.embruns) {
      const n = Math.floor(60 * dt * trombe.force * 30);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 22;
        this._p.set(trombe.x + Math.cos(a) * r, u.uPied.value + Math.random() * 3, trombe.z + Math.sin(a) * r);
        const tour = 18 + Math.random() * 14; // m/s, en tournant (sens inverse des aiguilles d'une montre)
        this.embruns.emettre(this._p, {
          vx: Math.sin(a) * tour - Math.cos(a) * 3,
          vy: 4 + Math.random() * 10,
          vz: -Math.cos(a) * tour - Math.sin(a) * 3,
          vie: 1.5 + Math.random() * 2,
          taille: 0.8 + Math.random() * 2.5,
          opacite: 0.12,
        });
      }
    }
  }
}
