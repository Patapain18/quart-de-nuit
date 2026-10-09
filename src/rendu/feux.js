// Les feux de la côte à l'écran (monde/feux.js dit ce qu'on en voit d'ici) :
//  - chaque feu : un point de lumière de sa couleur, d'autant plus vif que la lumière qui
//    nous arrive est forte (en multiples du seuil de l'œil) ; il s'éteint dans un grain, et
//    disparaît derrière la crête des vagues quand on est dans un creux ; dans l'air humide,
//    une auréole autour ;
//  - les faisceaux du phare : trois pinceaux qui balaient la nuit. On les voit là où il y a
//    de l'eau dans l'air pour renvoyer leur lumière : un peu dans la brume, beaucoup dans la
//    pluie des grains qu'ils traversent (les rideaux s'allument au passage du faisceau). Ce
//    qu'on voit d'un faisceau se calcule d'un coup : la lumière du phare, à s mètres de lui,
//    éclaire l'air (en 1/s²) ; la largeur du faisceau grandit avec s ; l'air renvoie vers nous
//    une part de ce qu'il reçoit (plus vers l'avant : les gouttes renvoient surtout dans le
//    sens de la lumière) ; et l'air en éteint en chemin, du phare à l'air, puis de l'air à nous ;
//  - la bouée de la Basse du Bec (une cardinale sud : bouees.js), qui flotte, et sa lanterne.
import * as THREE from 'three';
import { N_RIDEAUX } from './glsl/grains.js';
import { construireBouee } from './bouees.js';
import {
  FEUX, SEMAPHORE, COULEURS, OPTIQUE, intensite, lumiereRecue, faisceaux, allumage, eclat,
} from '../monde/feux.js';
import { visibilite } from '../monde/meteo.js';
import { REGLAGES_GRAINS } from '../monde/grains.js';

// Les réglages de l'image (réglés à l'œil, dans l'atelier des feux)
export const REGLAGES_FEUX = {
  point: 0.05, // la lumière du point, au seuil de l'œil…
  gamma: 0.5, // … et comment elle croît avec la lumière reçue (l'œil compresse)
  taille: 0.0075, // (rad : la taille du point à l'écran, quelle que soit la distance : 5 pixels)
  aureole: 0.06, // l'auréole, dans l'air humide
  faisceau: 75, // la lumière des faisceaux (cd/m² → l'image)
  longueur: 26000, // m : jusqu'où on dessine les faisceaux
};

function texturePoint() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255,255,255,1)');
  d.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  d.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SOMMET_FAISCEAU = /* glsl */ `
attribute vec2 aFaisceau; // s (m depuis la lanterne), côté (−1 → 1)
uniform vec3 uOrigine;
uniform vec3 uDir;
uniform float uOuverture; // (la tangente de la demi-largeur du faisceau)
varying float vS;
varying float vCote;
varying vec3 vMonde;
void main() {
  float s = aFaisceau.x;
  vec3 p = uOrigine + uDir * s;
  // (un ruban tourné vers nous, aussi large que le faisceau)
  vec3 versCam = normalize(cameraPosition - p);
  vec3 cote = cross(uDir, versCam);
  float l = length(cote);
  cote = l > 1e-4 ? cote / l : vec3(0.0, 1.0, 0.0);
  p += cote * (1.5 + s * uOuverture) * aFaisceau.y;
  vS = s;
  vCote = aFaisceau.y;
  vMonde = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FRAGMENT_FAISCEAU = /* glsl */ `
uniform vec3 uDir;
uniform vec3 uCouleur;
uniform float uIntensite; // (candelas × réglage × ce que la pluie laisse passer jusqu'à nous)
uniform float uOuverture;
uniform float uSigma; // la brume : l'extinction (1/m)
uniform vec4 uRideaux[${N_RIDEAUX}];
uniform int uRideauxN;
uniform vec4 uRideauxReglages;
varying float vS;
varying float vCote;
varying vec3 vMonde;
void main() {
  float s = max(vS, 4.0);
  vec3 v = cameraPosition - vMonde;
  float dc = length(v);
  v /= dc;
  // les gouttes renvoient surtout vers l'avant (Henyey-Greenstein, g = 0,7), et un peu dans
  // toutes les directions (ce que renvoient plusieurs fois les gouttes, et les plus fines) :
  // c'est ce qu'on voit d'un faisceau de côté
  float c = dot(uDir, v);
  float phase = 0.7 * 0.51 / (12.566371 * pow(1.49 - 1.4 * c, 1.5)) + 0.3 / 12.566371;
  // (le regard traverse le faisceau de biais : plus il le longe, plus il en traverse)
  float sinPsi = max(length(cross(uDir, v)), 0.04);
  // l'eau dans l'air, ici : la brume, et la pluie des grains (sous la base des nuages)
  float pluie = 0.0;
  if (vMonde.y < uRideauxReglages.x) {
    for (int i = 0; i < ${N_RIDEAUX}; i++) {
      if (i >= uRideauxN) break;
      vec4 r = uRideaux[i];
      vec2 d = vMonde.xz - r.xy;
      pluie += r.w * exp(-dot(d, d) / (r.z * r.z));
    }
  }
  float diffusion = uSigma + pluie;
  float profil = exp(-3.0 * vCote * vCote);
  float L = uIntensite * 2.0 * uOuverture * diffusion * phase * exp(-uSigma * (s + dc)) / (s * sinPsi);
  gl_FragColor = vec4(uCouleur * L * profil, 1.0);
}
`;

export class FeuxRendu {
  // uniformsGrains : ceux des rideaux de pluie (ciel.grains.uniforms : on lit les mêmes)
  constructor(scene, houle, uniformsGrains) {
    this.houle = houle;
    this.groupe = new THREE.Group();
    this.groupe.name = 'feux-de-la-cote';
    scene.add(this.groupe);
    const tex = texturePoint();
    const sprite = (ordre) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0x000000, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      }));
      s.renderOrder = ordre;
      s.frustumCulled = false;
      this.groupe.add(s);
      return s;
    };
    // les feux, et ce qu'on en voit (lu aussi par le jeu : reconnaître un feu)
    this.feux = [...FEUX, SEMAPHORE].map((feu) => ({
      feu, point: sprite(7), aureole: sprite(6), vu: {}, couleur: new THREE.Color(...COULEURS[feu.couleur]),
    }));
    // la bouée de la Basse du Bec
    const b = construireBouee('cardinale-sud');
    b.groupe.name = 'bouee-basse-du-bec';
    this.groupe.add(b.groupe);
    this.bouee = b;
    this._n = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._v = new THREE.Vector3();
    // les faisceaux du phare
    const n = 72;
    const positions = [];
    const indices = [];
    for (let i = 0; i <= n; i++) {
      // (serrés près du phare, où le faisceau change vite)
      const s = REGLAGES_FEUX.longueur * (i / n) ** 2;
      positions.push(s, -1, s, 1);
      if (i < n) indices.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('aFaisceau', new THREE.Float32BufferAttribute(positions, 2));
    // (three.js veut une « position » pour ses calculs de boîte : une boîte qui contient tout)
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array((n + 1) * 2 * 3).fill(0), 3));
    geo.setIndex(indices);
    const phare = FEUX.find((f) => f.tournant);
    this.phare = phare;
    this.faisceaux = Array.from({ length: OPTIQUE.faisceaux }, () => {
      const m = new THREE.ShaderMaterial({
        vertexShader: SOMMET_FAISCEAU,
        fragmentShader: FRAGMENT_FAISCEAU,
        uniforms: {
          uOrigine: { value: new THREE.Vector3(phare.x, phare.y, phare.z) },
          uDir: { value: new THREE.Vector3(1, 0, 0) },
          uOuverture: { value: Math.tan((OPTIQUE.largeur * 1.2 * Math.PI) / 180) },
          uCouleur: { value: new THREE.Color(...COULEURS[phare.couleur]) },
          uIntensite: { value: 0 },
          uSigma: { value: 1e-4 },
          uRideaux: uniformsGrains.uRideaux,
          uRideauxN: uniformsGrains.uRideauxN,
          uRideauxReglages: uniformsGrains.uRideauxReglages,
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      this.groupe.add(mesh);
      return mesh;
    });
    this._b = [];
    this.masque = { points: true, aureoles: true, faisceaux: true, bouee: true };
  }

  // temps : l'horloge des feux (s) ; camera ; meteo ; grains (ou null) ; hauteurSoleil
  maj(dt, { temps, camera, meteo, grains = null, hauteurSoleil = 0 }) {
    const R = REGLAGES_FEUX;
    const allume = allumage(hauteurSoleil);
    const cam = camera.position;
    const pluieFond = grains ? (meteo.pluie ?? 0) * REGLAGES_GRAINS.pluieFond : meteo.pluie ?? 0;
    const sigma = 3 / visibilite(meteo, pluieFond);
    // la bouée flotte : la hauteur de la vague, et sa pente (elle se penche avec elle)
    const b = this.bouee;
    const B = FEUX.find((f) => f.flottant);
    const h = this.houle.hauteur(B.x, B.z);
    const hx = this.houle.hauteur(B.x + 1.2, B.z) - this.houle.hauteur(B.x - 1.2, B.z);
    const hz = this.houle.hauteur(B.x, B.z + 1.2) - this.houle.hauteur(B.x, B.z - 1.2);
    this._n.set(-hx / 2.4, 1, -hz / 2.4).normalize();
    this._q.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, this._n);
    b.groupe.position.set(B.x, h - 0.12, B.z);
    b.groupe.quaternion.slerp(this._q, 0.08);
    b.groupe.visible = this.masque.bouee;
    // chaque feu : ce qui nous en arrive, et son point
    for (const f of this.feux) {
      const feu = f.feu;
      const vu = lumiereRecue(feu, cam, { t: temps, meteo, grains, houle: this.houle, allume, sortie: f.vu });
      const lum = vu.recu > 0.3 ? R.point * vu.recu ** R.gamma : 0;
      // (la lanterne : au-dessus de la mer pour la bouée ; un peu vers nous, pour ne pas
      // se cacher dans sa propre tour)
      if (feu.flottant) {
        b.groupe.updateMatrixWorld();
        this._p.copy(b.lanterne.position).applyMatrix4(b.groupe.matrixWorld);
        b.lanterne.material.emissiveIntensity = allume * eclat(feu, temps, 0) * 9;
      } else this._p.set(feu.x, feu.y, feu.z);
      const d = cam.distanceTo(this._p);
      this._p.addScaledVector(this._v.copy(this._p).sub(cam).normalize(), -Math.min(4, d * 0.02));
      f.point.position.copy(this._p);
      f.point.scale.setScalar(d * R.taille);
      f.point.material.color.copy(f.couleur).multiplyScalar(lum);
      f.point.visible = this.masque.points && lum > 0;
      // l'auréole : la lumière que l'air humide renvoie tout autour du feu (plus large et plus
      // forte dans la pluie et la brume épaisse)
      const humide = 1 - Math.exp(-(sigma * 2500 + REGLAGES_GRAINS.extinctionPluie * Math.min(vu.pluie, 800)));
      f.aureole.position.copy(this._p);
      f.aureole.scale.setScalar(d * R.taille * (5 + 9 * humide));
      f.aureole.material.color.copy(f.couleur).multiplyScalar(lum * R.aureole * humide);
      f.aureole.visible = this.masque.aureoles && lum > 0 && humide > 0.02;
    }
    // les faisceaux du phare
    const p = this.phare;
    const vuPhare = this.feux.find((f) => f.feu === p).vu;
    // (la pluie entre le phare et nous éteint aussi ses faisceaux ; et pas de faisceau le jour)
    const pluieEntre = Math.exp(-REGLAGES_GRAINS.extinctionPluie * vuPhare.pluie);
    const I = intensite(p) * R.faisceau * allume * pluieEntre;
    faisceaux(temps, this._b);
    this.faisceaux.forEach((mesh, k) => {
      const a = (this._b[k] * Math.PI) / 180;
      const u = mesh.material.uniforms;
      u.uDir.value.set(Math.sin(a), 0, -Math.cos(a));
      u.uIntensite.value = I;
      u.uSigma.value = sigma;
      mesh.visible = this.masque.faisceaux && I > 0;
    });
  }

  // Ce qu'on voit des feux, d'ici (pour le jeu) : [{ feu, recu, cache, distance, releve… }]
  get vus() {
    return this.feux.map((f) => ({ feu: f.feu, ...f.vu }));
  }
}
