// La trombe marine du crépuscule : une tornade au-dessus de la mer.
//
// Ce qu'on voit, de haut en bas :
//  - le nuage-mur : sous la base des nuages d'orage, une grande soucoupe sombre de 1,4 km
//    qui s'abaisse et TOURNE (le « mésocyclone ») ; ses bords sont effilochés, son ventre
//    noir ; le soleil couchant l'éclaire par la tranche, les éclairs par l'intérieur ;
//  - l'entonnoir : de la vapeur d'eau qui se condense dans l'air qui tourne très vite (la
//    pression y chute) ; il descend du nuage-mur jusqu'à la mer, large en haut (il s'y
//    évase), courbé par le vent (le pied traîne derrière) ; plus opaque sur ses bords (on
//    y regarde à travers plus de vapeur), strié de bandes qui tournent et montent ;
//  - le pied : la mer est arrachée. Une gaine d'embruns serrée autour de l'entonnoir, et
//    une jupe d'eau pulvérisée de 200 m qui tourbillonne ; sur la mer, un anneau d'écume
//    qui tourne (dessiné par la mer elle-même, eau.js) ; des gerbes d'embruns.
// Elle naît (l'entonnoir descend du nuage), vit quatre minutes, puis s'amincit en corde,
// se tord et disparaît.
import * as THREE from 'three';
import { GLSL_CARTE_CIEL } from './ciel.js';

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
float fbmT(vec3 p) {
  return bruitT(p) * 0.5 + bruitT(p * 2.03 + 7.1) * 0.27 + bruitT(p * 4.11 + 3.3) * 0.15 + bruitT(p * 8.3 + 1.7) * 0.08;
}
`;

// La brume et la lumière, communes à toutes les pièces
const GLSL_COMMUN = /* glsl */ `
uniform float uTemps;
uniform float uForce;
uniform vec3 uAmbiance;
uniform vec3 uSoleil;
uniform vec3 uDirSoleil;
uniform float uEclair;
uniform sampler2D uCarteCiel;
uniform float uBrume;
${GLSL_CARTE_CIEL}
${GLSL_BRUIT}
vec3 brumer(vec3 c, vec3 posMonde) {
  vec3 versPoint = posMonde - cameraPosition;
  float distance = length(versPoint);
  vec3 d = versPoint / distance;
  vec3 horizon = texture(uCarteCiel, uvCarteCiel(normalize(vec3(d.x, max(d.y, 0.012), d.z)))).rgb;
  return mix(c, horizon, 1.0 - exp(-distance * uBrume * 0.8));
}
`;

// ---------- le nuage-mur ----------
const RAYON_MUR = 720;
const SOMMET_MUR = /* glsl */ `
attribute vec2 at; // angle, rayon (0 → 1)
uniform float uBase;     // la base des nuages (m)
uniform float uCreux;    // de combien le centre descend (m)
uniform float uTemps;
uniform float uForce;
varying vec3 vPosMonde;
varying vec2 vPolaire;
varying float vDessous;
varying vec2 vRadial;
${GLSL_BRUIT}
void main() {
  float r = at.y;
  float a = at.x;
  vRadial = vec2(cos(a), sin(a));
  // le ventre descend vers le centre, bosselé (des « mamelles » de nuage), et tourne
  float tour = uTemps * (0.04 + 0.18 * (1.0 - r) * (1.0 - r));
  vec2 q = vec2(cos(a + tour), sin(a + tour)) * r * 5.0;
  float bosses = fbmT(vec3(q, uTemps * 0.02)) - 0.5;
  float creux = uCreux * uForce * pow(1.0 - r, 1.5);
  vec3 p = vec3(cos(a) * r * ${RAYON_MUR.toFixed(1)}, uBase - creux + bosses * 90.0 * (0.4 + r), sin(a) * r * ${RAYON_MUR.toFixed(1)});
  vPolaire = vec2(a, r);
  vDessous = creux / max(uCreux, 1.0);
  vec4 monde = modelMatrix * vec4(p, 1.0);
  vPosMonde = monde.xyz;
  gl_Position = projectionMatrix * viewMatrix * monde;
}
`;
const FRAGMENT_MUR = /* glsl */ `
#include <common>
${GLSL_COMMUN}
varying vec3 vPosMonde;
varying vec2 vPolaire;
varying float vDessous;
varying vec2 vRadial;
void main() {
  float r = vPolaire.y;
  // il tourne, d'autant plus vite que l'on est près du centre (le bruit est lu dans un
  // repère qui tourne) ; des masses de nuage tordues, pas des cercles
  float tour = uTemps * (0.04 + 0.18 * (1.0 - r) * (1.0 - r));
  float a = vPolaire.x + tour;
  vec2 q = vec2(cos(a), sin(a)) * r * 4.0;
  vec2 tord = vec2(fbmT(vec3(q * 0.7, uTemps * 0.015)), fbmT(vec3(q * 0.7 + 5.2, uTemps * 0.015))) - 0.5;
  float n = fbmT(vec3(q + tord * 2.2, uTemps * 0.02));
  float densite = smoothstep(0.25, 0.55, n + (1.0 - r) * 0.45);
  // le bord, effiloché, se perd dans les nuages
  densite *= 1.0 - smoothstep(0.55, 1.0, r + (n - 0.5) * 0.5);
  densite *= uForce * 0.98;
  if (densite < 0.01) discard;
  // noir dessous ; le couchant éclaire sa tranche ; les éclairs l'allument de l'intérieur
  vec3 radial = vec3(vRadial.x, 0.0, vRadial.y);
  float tranche = max(dot(radial, normalize(vec3(uDirSoleil.x, 0.0, uDirSoleil.z) + 1e-4)), 0.0) * smoothstep(0.4, 0.95, r);
  vec3 c = uAmbiance * (0.22 + 0.3 * n) * mix(1.0, 0.5, vDessous) + uSoleil * 0.16 * tranche * (0.4 + n);
  c += vec3(0.62, 0.66, 0.85) * uEclair * (0.4 + 1.2 * n * n);
  gl_FragColor = vec4(brumer(c, vPosMonde), densite);
}
`;

// ---------- l'entonnoir ----------
const SOMMET_TUBE = /* glsl */ `
attribute vec2 at;
uniform float uHaut;      // le bas du nuage-mur (m)
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
  float traine = (1.0 - t) * (1.0 - t) * (60.0 + 180.0 * uCorde);
  float ondule = sin(t * 5.0 - uTemps * 0.35) * (8.0 + 90.0 * uCorde) * t * (1.0 - t) * 4.0;
  vec2 xz = -uVent * traine + perp * ondule;
  return vec3(xz.x, mix(uPied, uHaut, t), xz.y);
}
float rayon(float t) {
  // serré en bas, il s'évase en trompette dans le nuage-mur
  float r = 15.0 + 22.0 * t + 150.0 * pow(t, 6.0);
  return r * mix(1.0, 0.3, uCorde) * (0.55 + 0.45 * uForce);
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
  float r = rayon(t) * (1.0 + 0.07 * sin(a * 3.0 + t * 20.0 - uTemps * 2.4) + 0.05 * sin(a * 5.0 - t * 37.0 + uTemps * 3.4)
                       + 0.1 * sin(t * 13.0 + uTemps * 0.7) + 0.06 * sin(t * 31.0 - uTemps * 1.3));
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
${GLSL_COMMUN}
uniform float uVoile; // dans les embruns du pied : on ne voit presque plus l'entonnoir
varying vec3 vPosMonde;
varying vec3 vNormale;
varying vec2 vAt;
void main() {
  vec3 v = normalize(cameraPosition - vPosMonde);
  float bord = 1.0 - abs(dot(normalize(vNormale), v));
  // des stries qui tournent autour du tube et montent en spirale (vite : c'est elle qui fait peur)
  float stries = bruitT(vec3(vAt.x * 2.0 + vAt.y * 22.0 - uTemps * 2.6, vAt.y * 46.0, uTemps * 0.3)) * 0.6
               + bruitT(vec3(vAt.x * 5.0 - uTemps * 3.6, vAt.y * 110.0, uTemps * 0.5)) * 0.4;
  float densite = mix(0.72, 1.0, pow(bord, 1.1)) * (0.78 + 0.35 * stries);
  // (un bord effiloché, irrégulier)
  densite *= 0.78 + 0.35 * bruitT(vec3(vAt.x * 6.0 + uTemps * 0.8, vAt.y * 25.0, uTemps * 0.7));
  // le haut se fond dans le nuage-mur, le pied dans la gaine d'embruns
  densite *= smoothstep(0.0, 0.05, vAt.y) * (1.0 - smoothstep(0.72, 0.96, vAt.y)) * uForce * (1.0 - 0.75 * uVoile);
  if (densite < 0.01) discard;
  // sombre, gris d'acier ; le couchant l'éclaire par le côté ; les éclairs par derrière
  float face = max(dot(normalize(vNormale), uDirSoleil), 0.0);
  vec3 c = vec3(0.42, 0.45, 0.5) * (uAmbiance * 0.95 + uSoleil * (0.05 + 0.3 * face * face)) + vec3(0.7, 0.75, 0.95) * uEclair * (0.4 + 0.6 * bord);
  c *= 0.5 + 0.6 * stries;
  // (en bas, l'eau arrachée la blanchit ; en haut, l'ombre du nuage-mur)
  c = mix(c, uAmbiance * 1.4 + uSoleil * 0.12, smoothstep(0.12, 0.0, vAt.y) * 0.45);
  c *= mix(1.0, 0.55, smoothstep(0.5, 0.95, vAt.y));
  gl_FragColor = vec4(brumer(c, vPosMonde), densite);
}
`;

// ---------- le pied : la gaine et la jupe d'embruns ----------
// rayon0, rayon1 : le rayon en bas et en haut ; hauteur ; tour : la vitesse de rotation
const SOMMET_EMBRUNS = /* glsl */ `
attribute vec2 at;
uniform float uTemps;
uniform float uForce;
uniform float uPied;
uniform vec4 uForme; // rayon en bas, rayon en haut, hauteur, vitesse de rotation
varying vec3 vPosMonde;
varying vec2 vAt;
varying vec3 vNormale;
void main() {
  float t = at.y;
  float a = at.x + uTemps * uForme.w * (1.0 - t * 0.3);
  vNormale = vec3(cos(a), 0.25, sin(a));
  float r = mix(uForme.x, uForme.y, pow(t, 0.6)) * (0.7 + 0.3 * uForce) * (1.0 + 0.16 * sin(at.x * 4.0 + uTemps) + 0.09 * sin(at.x * 9.0 - uTemps * 1.7));
  vec3 p = vec3(cos(a) * r, uPied + t * uForme.z * uForce, sin(a) * r);
  vAt = vec2(at.x, t);
  vec4 monde = modelMatrix * vec4(p, 1.0);
  vPosMonde = monde.xyz;
  gl_Position = projectionMatrix * viewMatrix * monde;
}
`;
const FRAGMENT_EMBRUNS = /* glsl */ `
#include <common>
${GLSL_COMMUN}
uniform vec4 uForme;
uniform float uOpacite;
uniform vec3 uCentre;
varying vec3 vPosMonde;
varying vec2 vAt;
varying vec3 vNormale;
void main() {
  // un nuage d'eau pulvérisée qui bouillonne : des boules qui roulent et montent en
  // tournant (le bruit est lu dans l'espace, dans un repère qui tourne avec la gerbe)
  vec3 p = vPosMonde - uCentre;
  float ang = -uTemps * uForme.w * 0.5;
  p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
  float n = fbmT(p * 0.03 + vec3(0.0, -uTemps * 0.7, 0.0));
  // (on regarde à travers plus d'embruns sur les bords de la gerbe)
  vec3 v = normalize(cameraPosition - vPosMonde);
  float bord = 1.0 - abs(dot(normalize(vNormale), v));
  float densite = smoothstep(0.32, 0.62, n + (1.0 - vAt.y) * 0.15) * mix(0.45, 1.0, bord)
                * (1.0 - smoothstep(0.25 + 0.3 * n, 1.0, vAt.y)) * smoothstep(0.0, 0.05, vAt.y) * uOpacite * uForce;
  if (densite < 0.01) discard;
  vec3 c = vec3(0.86, 0.89, 0.92) * (uAmbiance * (1.4 + 0.5 * n) + uSoleil * 0.22) + vec3(0.7, 0.75, 0.95) * uEclair * 0.7;
  gl_FragColor = vec4(brumer(c, vPosMonde), densite);
}
`;

// Une grille de sommets (angle, hauteur ou rayon) que les shaders mettent en forme
function grille(segments, etages, rayonVariable = false) {
  const at = [];
  const indices = [];
  for (let j = 0; j <= etages; j++) {
    const v = rayonVariable ? (j / etages) ** 1.4 : j / etages;
    for (let i = 0; i <= segments; i++) at.push((i / segments) * Math.PI * 2, v);
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
    this.eau = eau;
    const u = eau.uniforms;
    this.uniforms = {
      uHaut: { value: 700 },
      uBase: { value: 900 },
      uCreux: { value: 230 },
      uTemps: { value: 0 },
      uForce: { value: 0 },
      uCorde: { value: 0 },
      uVent: { value: new THREE.Vector2(1, 0) },
      uPied: { value: 0 },
      uVoile: { value: 0 },
      uAmbiance: u.uAmbiance,
      uSoleil: u.uSoleil,
      uDirSoleil: u.uDirSoleil,
      uEclair: u.uEclair,
      uCarteCiel: u.uCarteCiel,
      uBrume: u.uBrume,
    };
    const materiau = (sommet, fragment, propres = {}) => new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, ...propres }, vertexShader: sommet, fragmentShader: fragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.groupe = new THREE.Group();
    this.groupe.name = 'trombe';
    this.mur = new THREE.Mesh(grille(64, 26, true), materiau(SOMMET_MUR, FRAGMENT_MUR));
    this.tube = new THREE.Mesh(grille(48, 90), materiau(SOMMET_TUBE, FRAGMENT_TUBE));
    // la gaine serrée autour de l'entonnoir, et la grande jupe qui tourbillonne
    this.gaine = new THREE.Mesh(grille(48, 16), materiau(SOMMET_EMBRUNS, FRAGMENT_EMBRUNS, {
      uForme: { value: new THREE.Vector4(40, 26, 115, 1.5) }, uOpacite: { value: 0.85 }, uCentre: { value: new THREE.Vector3() },
    }));
    this.jupe = new THREE.Mesh(grille(64, 16), materiau(SOMMET_EMBRUNS, FRAGMENT_EMBRUNS, {
      uForme: { value: new THREE.Vector4(135, 70, 58, 0.6) }, uOpacite: { value: 0.55 }, uCentre: { value: new THREE.Vector3() },
    }));
    // (ordre de dessin : le nuage-mur au fond, puis la jupe, l'entonnoir, la gaine devant)
    [this.mur, this.jupe, this.tube, this.gaine].forEach((m, k) => {
      m.frustumCulled = false;
      m.renderOrder = 3 + k * 0.1;
      this.groupe.add(m);
    });
    this.groupe.visible = false;
    scene.add(this.groupe);
    this._p = new THREE.Vector3();
  }

  // trombe : { x, z, force, age, duree } (jeu/nuit.js), ou null ; directionVent : vers où
  // va le vent (radians, dans le plan) ; temps : l'horloge du monde
  maj(dt, trombe, { temps, directionVent, camera = null }) {
    const visible = !!trombe && trombe.force > 0.01;
    this.groupe.visible = visible;
    this.brouillard = 0;
    // (la mer dessine l'anneau d'écume au pied : sans trombe, rien)
    const ue = this.eau.uniforms.uTrombe;
    if (!visible) {
      if (ue) ue.value.w = 0;
      return;
    }
    const u = this.uniforms;
    u.uTemps.value = temps;
    u.uForce.value = trombe.force;
    // (les 45 dernières secondes, elle s'amincit en corde)
    u.uCorde.value = THREE.MathUtils.smoothstep(trombe.age, trombe.duree - 45, trombe.duree - 5);
    u.uVent.value.set(Math.cos(directionVent), Math.sin(directionVent));
    u.uBase.value = this.ciel.uniformsNuages.uBaseNuages.value + 40;
    u.uHaut.value = u.uBase.value - u.uCreux.value * trombe.force * 0.92;
    u.uPied.value = this.houle.hauteur(trombe.x, trombe.z);
    this.groupe.position.set(trombe.x, 0, trombe.z);
    if (ue) ue.value.set(trombe.x, trombe.z, 38 * (0.6 + 0.4 * trombe.force), trombe.force * (1 - u.uCorde.value * 0.7));
    // dans les embruns du pied, on ne voit plus des voiles d'eau, mais un brouillard blanc
    // qui avale tout (monde3d.js épaissit la brume) : les voiles s'effacent
    if (camera) {
      const d = Math.hypot(camera.position.x - trombe.x, camera.position.z - trombe.z);
      this.brouillard = trombe.force * (1 - THREE.MathUtils.smoothstep(d, 35, 150));
    }
    const dehors = 1 - THREE.MathUtils.smoothstep(this.brouillard, 0.25, 0.75);
    this.gaine.material.uniforms.uOpacite.value = 0.85 * dehors;
    this.jupe.material.uniforms.uOpacite.value = 0.55 * dehors;
    u.uVoile.value = this.brouillard;
    for (const m of [this.gaine, this.jupe]) m.material.uniforms.uCentre.value.set(trombe.x, 0, trombe.z);
    // le pied arrache la mer : des embruns qui tourbillonnent et montent
    if (this.embruns) {
      const n = Math.floor(60 * dt * trombe.force * 40);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = 12 + Math.random() * 45;
        this._p.set(trombe.x + Math.cos(a) * r, u.uPied.value + Math.random() * 4, trombe.z + Math.sin(a) * r);
        const tour = 24 + Math.random() * 18; // m/s, en tournant (sens inverse des aiguilles d'une montre)
        this.embruns.emettre(this._p, {
          vx: Math.sin(a) * tour - Math.cos(a) * 4,
          vy: 6 + Math.random() * 14,
          vz: -Math.cos(a) * tour - Math.sin(a) * 4,
          vie: 1.8 + Math.random() * 2.5,
          taille: 1 + Math.random() * 3,
          opacite: 0.14,
        });
      }
    }
  }
}
