// Les embruns : les gerbes d'eau qu'une déferlante projette sur le bateau, ce que l'étrave
// soulève quand elle tape dans une vague, ce que le vent arrache aux crêtes, et le nuage
// d'eau qui tourbillonne au pied de la trombe.
//
// Ce sont des milliers de gouttelettes (des « particules ») : chacune part avec une
// vitesse, retombe (la pesanteur) et le vent l'emporte (les petites plus que les
// grosses). On les calcule ici, en JavaScript, puis la carte graphique les dessine comme
// de petits disques flous. Une goutte ne se voit que si elle est éclairée : par la lampe
// frontale, un éclair, les feux du bord… ou le plancton qu'elle emporte (les embruns des
// crêtes brillent un instant de bleu-vert, la nuit).
import * as THREE from 'three';

const MAX = 6000;
const G = 9.81;

const SOMMET = /* glsl */ `
attribute float aVie;     // ce qui lui reste à vivre (1 → 0)
attribute float aTaille;  // diamètre (m)
attribute float aPhospho; // 1 : elle emporte du plancton qui brille
attribute float aOpacite; // les gouttes sont presque opaques, la brume est légère
uniform float uEchelle;
uniform vec3 uLampePosition;
uniform vec3 uLampeDirection;
uniform float uLampe;
uniform vec3 uAmbiance;
uniform float uEclair;
uniform float uNuit;
varying vec3 vCouleur;
varying float vAlpha;
void main() {
  vec4 vue = modelViewMatrix * vec4(position, 1.0);
  float distance = max(0.05, -vue.z);
  gl_PointSize = clamp(aTaille * uEchelle / distance, 1.0, 96.0);
  // la lumière qu'elle renvoie : le ciel, l'éclair, la lampe frontale (dans son faisceau)
  vec3 versGoutte = position - uLampePosition;
  float dLampe = length(versGoutte);
  float cone = smoothstep(0.82, 0.93, dot(versGoutte / max(dLampe, 1e-3), uLampeDirection));
  float lampe = uLampe * cone / (1.0 + dLampe * dLampe * 0.06);
  vCouleur = uAmbiance * 1.4 + vec3(0.7, 0.75, 0.9) * uEclair + vec3(1.0, 0.92, 0.8) * lampe
           + vec3(0.1, 0.8, 0.7) * aPhospho * uNuit * 0.05 * aVie;
  // les toutes proches (contre l'objectif) sont floues : on les estompe
  vAlpha = aOpacite * aVie * smoothstep(0.15, 0.8, distance);
  gl_Position = projectionMatrix * vue;
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vCouleur;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float a = smoothstep(0.5, 0.12, d) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCouleur * a, a);
}
`;

export class Embruns {
  constructor(scene) {
    this.position = new Float32Array(MAX * 3);
    this.vitesse = new Float32Array(MAX * 3);
    this.vie = new Float32Array(MAX); // 1 → 0
    this.duree = new Float32Array(MAX);
    this.taille = new Float32Array(MAX);
    this.phospho = new Float32Array(MAX);
    this.opacite = new Float32Array(MAX);
    this.prochaine = 0; // la prochaine case libre (on recycle les plus vieilles)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aVie', new THREE.BufferAttribute(this.vie, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTaille', new THREE.BufferAttribute(this.taille, 1));
    g.setAttribute('aPhospho', new THREE.BufferAttribute(this.phospho, 1));
    g.setAttribute('aOpacite', new THREE.BufferAttribute(this.opacite, 1));
    this.geometrie = g;
    this.uniforms = {
      uEchelle: { value: 800 },
      uLampePosition: { value: new THREE.Vector3() },
      uLampeDirection: { value: new THREE.Vector3(0, 0, -1) },
      uLampe: { value: 0 },
      uAmbiance: { value: new THREE.Vector3(0.2, 0.2, 0.2) },
      uEclair: { value: 0 },
      uNuit: { value: 0 },
    };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SOMMET,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    scene.add(this.mesh);
    this.vivantes = 0;
    this.facteur = 1; // (moins de gouttelettes quand l'image est « économique »)
  }

  // Une gouttelette : p (monde), vitesse (m/s), vie (s), taille (m), opacite, phospho (0 ou 1)
  emettre(p, { vx = 0, vy = 0, vz = 0, vie = 1.5, taille = 0.04, opacite = 0.6, phospho = 0 }) {
    if (this.facteur < 1 && Math.random() > this.facteur) return;
    const i = this.prochaine;
    this.prochaine = (this.prochaine + 1) % MAX;
    this.position[i * 3] = p.x;
    this.position[i * 3 + 1] = p.y;
    this.position[i * 3 + 2] = p.z;
    this.vitesse[i * 3] = vx;
    this.vitesse[i * 3 + 1] = vy;
    this.vitesse[i * 3 + 2] = vz;
    this.vie[i] = 1;
    this.duree[i] = vie;
    this.taille[i] = taille;
    this.opacite[i] = opacite;
    this.phospho[i] = phospho;
  }

  // Une déferlante frappe le bateau : une gerbe jaillit du côté où elle arrive, monte et
  // retombe sur le pont, emportée par le vent
  gerbe(f, physique) {
    const o = physique.origine(new THREE.Vector3());
    const vers = f.vers.clone().setY(0).normalize();
    const perp = new THREE.Vector3(-vers.z, 0, vers.x);
    const n = Math.round(500 + 1300 * Math.min(1.3, f.force));
    const p = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const le = (Math.random() - 0.5) * 7; // le long de la coque
      p.copy(o).addScaledVector(vers, -1.8 - Math.random()).addScaledVector(perp, le);
      p.y += 0.4 + Math.random() * 0.8;
      const elan = (3 + Math.random() * 7) * (0.5 + 0.6 * f.force);
      // surtout des gouttelettes, et un peu de brume (les nappes d'eau pulvérisée)
      const brume = Math.random() < 0.15;
      this.emettre(p, {
        vx: vers.x * (2 + Math.random() * 6) + (Math.random() - 0.5) * 3,
        vy: elan * (brume ? 0.6 : 1),
        vz: vers.z * (2 + Math.random() * 6) + (Math.random() - 0.5) * 3,
        vie: brume ? 1.6 + Math.random() * 1.4 : 1.0 + Math.random() * 1.2,
        taille: brume ? 0.5 + Math.random() * 1.3 : 0.015 + Math.random() * 0.05,
        opacite: brume ? 0.1 : 0.65,
        phospho: Math.random() < 0.3 ? 1 : 0,
      });
    }
  }

  // L'étrave tape dans une vague (force 0 → 1) : une gerbe s'élève à l'avant
  etrave(force, physique) {
    const avant = physique.avant;
    const o = physique.origine(new THREE.Vector3());
    const p = new THREE.Vector3();
    const n = Math.round(80 + 400 * force);
    for (let k = 0; k < n; k++) {
      const cote = Math.random() < 0.5 ? -1 : 1;
      p.copy(o).addScaledVector(avant, 3.6 + Math.random() * 0.6);
      p.x += -avant.z * cote * 0.3;
      p.z += avant.x * cote * 0.3;
      p.y += 0.2 + Math.random() * 0.3;
      const brume = Math.random() < 0.15;
      this.emettre(p, {
        vx: -avant.z * cote * (1 + Math.random() * 3) + avant.x * (Math.random() * 2),
        vy: 2 + Math.random() * 5 * force,
        vz: avant.x * cote * (1 + Math.random() * 3) + avant.z * (Math.random() * 2),
        vie: 0.8 + Math.random() * 1.0,
        taille: brume ? 0.4 + Math.random() * 0.6 : 0.015 + Math.random() * 0.04,
        opacite: brume ? 0.1 : 0.55,
      });
    }
  }

  // vent : le vent réel (m/s, monde) ; niveauEau : sous cette hauteur, la goutte retombe
  // dans la mer
  maj(dt, { vent, camera, lampe, ambiance, eclair, nuit, niveauEau = -2 }) {
    const p = this.position;
    const v = this.vitesse;
    let vivantes = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.vie[i] <= 0) continue;
      this.vie[i] -= dt / this.duree[i];
      if (this.vie[i] <= 0 || p[i * 3 + 1] < niveauEau) {
        this.vie[i] = 0;
        continue;
      }
      vivantes++;
      // le vent emporte les petites gouttes bien plus que les grosses
      const prise = Math.min(1, dt * (0.25 / Math.max(0.03, this.taille[i])));
      v[i * 3] += (vent.x - v[i * 3]) * prise;
      v[i * 3 + 2] += (vent.z - v[i * 3 + 2]) * prise;
      v[i * 3 + 1] -= G * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
    }
    this.vivantes = vivantes;
    this.mesh.visible = vivantes > 0;
    if (!vivantes) return;
    this.geometrie.attributes.position.needsUpdate = true;
    this.geometrie.attributes.aVie.needsUpdate = true;
    this.geometrie.attributes.aTaille.needsUpdate = true;
    this.geometrie.attributes.aPhospho.needsUpdate = true;
    this.geometrie.attributes.aOpacite.needsUpdate = true;
    const u = this.uniforms;
    // (taille à l'écran : la hauteur de l'image en pixels, sur la tangente du demi-champ)
    u.uEchelle.value = camera.userData.hauteurPixels / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    if (lampe) {
      u.uLampePosition.value.copy(lampe.position);
      u.uLampeDirection.value.copy(lampe.target.position).sub(lampe.position).normalize();
      u.uLampe.value = lampe.intensity * 0.5;
    }
    u.uAmbiance.value.copy(ambiance);
    u.uEclair.value = eclair;
    u.uNuit.value = nuit;
  }
}
