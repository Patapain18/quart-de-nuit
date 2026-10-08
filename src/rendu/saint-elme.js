// Le feu de Saint-Elme : sous un nuage d'orage, l'air est si chargé d'électricité qu'il
// s'illumine autour des pointes de métal. En tête de mât, une lueur violette, et des
// aigrettes qui partent vers le haut, tremblent, s'éteignent et se rallument ; elles
// grésillent (le son : son/audio.js). On ne le voit que dans le noir. (monde/foudre.js dit
// combien l'air est chargé autour du bateau.)
import * as THREE from 'three';

const SOMMET = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform float uTemps;
uniform float uForce;
float hasard(float x) { return fract(sin(x * 12.9898) * 43758.5453); }
void main() {
  // (la pointe est en bas du carré ; les aigrettes montent)
  vec2 p = (vUv - vec2(0.5, 0.32)) * vec2(2.0, 1.5);
  float r = length(p);
  float a = atan(p.x, p.y); // (0 : vers le haut)
  // des aigrettes : des filaments qui partent de la pointe, surtout vers le haut ; chacune
  // change de direction et s'allume ou s'éteint une dizaine de fois par seconde
  float f = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float direction = (hasard(fi + floor(uTemps * 9.0 + fi * 0.37)) - 0.5) * 2.6;
    float allumee = step(0.35, hasard(fi * 3.1 + floor(uTemps * 14.0 + fi)));
    float largeur = 0.1 + 0.08 * hasard(fi * 7.7);
    float d = a - direction;
    f += allumee * exp(-d * d / (largeur * largeur)) * exp(-r * (2.2 + fi * 0.3)) * smoothstep(0.0, 0.08, r);
  }
  float coeur = exp(-r * r * 60.0);
  float lueur = exp(-r * 6.0) * 0.2;
  float tremble = 0.8 + 0.2 * hasard(floor(uTemps * 30.0));
  // (rien sur les bords du carré : la lueur s'éteint bien avant)
  float masque = 1.0 - smoothstep(0.28, 0.48, length(vUv - 0.5));
  float i = (1.6 * coeur + 0.9 * f + lueur) * tremble * uForce * masque;
  gl_FragColor = vec4(vec3(0.55, 0.45, 1.0) * i * 1.4, 1.0);
}
`;

export class SaintElme {
  constructor(scene) {
    this.materiau = new THREE.ShaderMaterial({
      uniforms: { uTemps: { value: 0 }, uForce: { value: 0 } },
      vertexShader: SOMMET,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.maille = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.materiau);
    this.maille.frustumCulled = false;
    this.maille.renderOrder = 6;
    this.maille.visible = false;
    scene.add(this.maille);
    this.force = 0;
  }

  // force : 0 → 1 (l'air chargé, dans le noir) ; position : la tête du mât, dans le monde
  // (ou null : pas de bateau)
  maj(dt, temps, force, position, camera) {
    // (il s'allume et s'éteint en quelques secondes)
    this.force += (force - this.force) * Math.min(1, dt * 1.5);
    const visible = this.force > 0.01 && !!position;
    this.maille.visible = visible;
    if (!visible) return;
    this.maille.position.copy(position);
    this.maille.quaternion.copy(camera.quaternion);
    const s = 0.9 + 0.4 * this.force;
    this.maille.scale.set(s, s * 1.3, 1);
    this.materiau.uniforms.uTemps.value = temps;
    this.materiau.uniforms.uForce.value = this.force;
  }
}
