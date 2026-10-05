// La pluie : des milliers de gouttes dessinées comme de fines traînées (l'œil et les
// caméras voient une goutte qui tombe comme un trait, pas comme un point).
//
// Astuce : on ne déplace pas les gouttes une par une en JavaScript. Chaque goutte a
// une position de départ tirée au hasard dans une grande boîte ; la carte graphique
// calcule où elle est à l'instant t (elle tombe et le vent la pousse), puis la
// « replie » dans une boîte de 36 m centrée sur la caméra : il pleut toujours autour
// de nous, avec un nombre fixe de gouttes.
import * as THREE from 'three';

const SOMMET = /* glsl */ `
attribute vec3 depart;
attribute float bout; // 0 : tête de la goutte, 1 : sa queue
uniform float uTemps;
uniform vec3 uVitesse;
uniform vec3 uCentre;
uniform float uTaille;
uniform float uTrainee;
uniform float uDensite;
uniform vec3 uLampePosition;
uniform vec3 uLampeDirection;
uniform float uLampe;
varying float vAlpha;
varying float vLampe;
float hasard(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
void main() {
  vec3 p = depart * uTaille + uVitesse * uTemps * (0.85 + 0.3 * hasard(depart));
  // repli dans la boîte centrée sur la caméra
  p = mod(p - uCentre + uTaille * 0.5, uTaille) - uTaille * 0.5 + uCentre;
  p -= uVitesse * uTrainee * bout;
  // seule une partie des gouttes existe quand il pleut peu
  float existe = step(hasard(depart.zyx), uDensite);
  // les gouttes qui traversent le faisceau de la lampe frontale brillent
  vec3 versGoutte = p - uLampePosition;
  float dLampe = length(versGoutte);
  float cone = smoothstep(0.82, 0.93, dot(versGoutte / dLampe, uLampeDirection));
  vLampe = uLampe * cone / (1.0 + dLampe * dLampe * 0.08);
  vec4 vue = viewMatrix * vec4(p, 1.0);
  // les gouttes très proches sont floues et larges : on les estompe
  float distance = -vue.z;
  vAlpha = existe * smoothstep(0.4, 2.0, distance) * (1.0 - smoothstep(uTaille * 0.35, uTaille * 0.5, distance)) * (1.0 - bout * 0.85);
  gl_Position = projectionMatrix * vue;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uCouleur;
varying float vAlpha;
varying float vLampe;
void main() {
  vec3 c = uCouleur + vec3(1.0, 0.92, 0.8) * vLampe;
  gl_FragColor = vec4(c * vAlpha, vAlpha);
}
`;

export class Pluie {
  constructor({ gouttes = 22000, taille = 36 } = {}) {
    const departs = new Float32Array(gouttes * 2 * 3);
    const bouts = new Float32Array(gouttes * 2);
    for (let i = 0; i < gouttes; i++) {
      const x = Math.random();
      const y = Math.random();
      const z = Math.random();
      for (let k = 0; k < 2; k++) {
        departs.set([x, y, z], (i * 2 + k) * 3);
        bouts[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gouttes * 2 * 3), 3));
    g.setAttribute('depart', new THREE.BufferAttribute(departs, 3));
    g.setAttribute('bout', new THREE.BufferAttribute(bouts, 1));
    this.uniforms = {
      uTemps: { value: 0 },
      uVitesse: { value: new THREE.Vector3(0, -9, 0) },
      uCentre: { value: new THREE.Vector3() },
      uTaille: { value: taille },
      uTrainee: { value: 0.022 },
      uDensite: { value: 0 },
      uCouleur: { value: new THREE.Vector3(0.5, 0.55, 0.6) },
      uLampePosition: { value: new THREE.Vector3() },
      uLampeDirection: { value: new THREE.Vector3(0, 0, -1) },
      uLampe: { value: 0 },
    };
    this.mesh = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SOMMET,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.facteur = 1; // (moins de gouttes quand l'image est « économique »)
  }

  // intensite : 0 → 1 ; vent : vecteur (m/s) dans le plan horizontal ; eclairage :
  // couleur de la lumière ambiante, éclair : intensité du flash
  maj(temps, camera, { intensite, vent, ambiance, eclair, lampe }) {
    const u = this.uniforms;
    u.uTemps.value = temps;
    u.uCentre.value.copy(camera.position);
    u.uDensite.value = intensite * this.facteur;
    // les gouttes tombent à ~9 m/s et le vent les penche
    u.uVitesse.value.set(vent.x * 0.9, -9.5, vent.z * 0.9);
    // une goutte n'est visible que parce qu'elle renvoie la lumière autour d'elle
    u.uCouleur.value.set(ambiance.x, ambiance.y, ambiance.z).multiplyScalar(1.1).addScalar(eclair * 0.6);
    if (lampe) {
      u.uLampePosition.value.copy(lampe.position);
      u.uLampeDirection.value.copy(lampe.target.position).sub(lampe.position).normalize();
      u.uLampe.value = lampe.intensity * 0.35;
    }
    this.mesh.visible = intensite > 0.01;
  }
}
