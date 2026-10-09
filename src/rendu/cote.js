// La côte de Kervalen, au loin (3 à 4 km au nord du point de départ) : des falaises de
// granit rose, la lande au-dessus (herbe rase, ajoncs, bruyère), une anse avec le village
// de Port-Kervalen et son clocher, la pointe du Bec et son phare, le sémaphore de Jos sur
// la colline, et l'île Brune au large. C'est la côte de la carte marine du carré.
//
// De si loin, ce qui compte, c'est la silhouette, les couleurs et la brume : la côte se
// fond dans l'horizon exactement comme la mer (même calcul, même couleur du ciel). Ses feux
// (le phare : trois éclats toutes les douze secondes, Fl(3) 12s, comme sur la carte ; le
// port ; la bouée de la Basse du Bec) : monde/feux.js et rendu/feux.js.
//
// Repère du monde : -Z = nord, +X = est ; y = 0 au niveau de la mer.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_CARTE_CIEL } from './ciel.js';
import { glslGrains, UNIFORMS_GRAINS } from './glsl/grains.js';

// ---------- Un bruit répétable (pour les reliefs) ----------
function hasard(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function bruit1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return hasard(i) * (1 - s) + hasard(i + 1) * s;
}
function bruit2(x, y) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hasard(a * 57.3 + b * 113.9);
  const a = h(i, j) + (h(i + 1, j) - h(i, j)) * sx;
  const b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * sx;
  return a + (b - a) * sy;
}
const fbm1 = (x, n = 4) => {
  let s = 0;
  let a = 0.5;
  for (let k = 0; k < n; k++) { s += a * bruit1(x * 2 ** k + k * 7.1); a *= 0.5; }
  return s;
};
const fbm2 = (x, y, n = 4) => {
  let s = 0;
  let a = 0.5;
  for (let k = 0; k < n; k++) { s += a * bruit2(x * 2 ** k + k * 3.7, y * 2 ** k - k * 5.3); a *= 0.5; }
  return s;
};
const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- Le tracé de la côte ----------
export const COTE = {
  xOuest: -9500,
  xEst: 7500,
  pointe: { x: 600, avance: 650 }, // la pointe du Bec avance vers le sud
  anse: { x: -1900 }, // l'anse de Port-Kervalen
  ile: { x: -2700, z: -2550, rayon: 380 }, // l'île Brune
};
// Le trait de côte : la position z du rivage pour chaque x (plus z est petit, plus c'est au nord)
export function rivage(x) {
  let z = -3700 + 380 * Math.sin(x / 1900 + 0.6) + 260 * (fbm1(x / 520) - 0.5);
  z += COTE.pointe.avance * Math.exp(-(((x - COTE.pointe.x) / 430) ** 2)); // la pointe du Bec
  z -= 380 * Math.exp(-(((x - COTE.anse.x) / 420) ** 2)); // l'anse
  // aux deux bouts, la côte s'éloigne vers le nord (elle ne s'arrête pas net)
  z -= 2600 * (1 - lisse(COTE.xOuest, COTE.xOuest + 3000, x)) + 2600 * (1 - lisse(COTE.xEst, COTE.xEst - 3000, x));
  return z;
}
// … et s'abaisse jusqu'à disparaître sous l'horizon
const finCote = (x) => lisse(COTE.xOuest, COTE.xOuest + 2200, x) * lisse(COTE.xEst, COTE.xEst - 2200, x);
// La hauteur des falaises le long de la côte (basse au fond de l'anse : la plage, le port)
function hauteurFalaise(x) {
  const h = 30 + 36 * fbm1(x / 900 + 3.3) + 18 * Math.exp(-(((x - COTE.pointe.x) / 300) ** 2));
  return h * (1 - 0.88 * Math.exp(-(((x - COTE.anse.x) / 260) ** 2)));
}
// La hauteur du terrain à « v » mètres à l'intérieur des terres
function hauteurTerrain(x, v) {
  if (v < 0) return Math.max(-30, v * 0.35); // sous l'eau
  return terrainEmerge(x, v) * finCote(x) - 4 * (1 - finCote(x));
}
function terrainEmerge(x, v) {
  const falaise = hauteurFalaise(x);
  const rocher = (fbm2(x / 30, v / 30, 3) - 0.5) * 6 * lisse(0, 8, v) * (1 - lisse(40, 80, v));
  const bord = falaise * lisse(0, 28, v);
  const collines = 95 * fbm2(x / 1300 + 9, v / 1100) * lisse(60, 900, v);
  // la colline du sémaphore, au-dessus de la pointe
  const butte = 55 * Math.exp(-(((x - (COTE.pointe.x - 900)) / 520) ** 2) - (((v - 420) / 380) ** 2));
  return bord + rocher + collines + butte;
}

// ---------- Les lieux de la côte (on y met des feux : monde/feux.js) ----------
// Le phare de la pointe du Bec (le pied de sa tour, et sa lanterne) ; la jetée de
// Port-Kervalen et son musoir (le bout, au large) ; la Roche Rouge, de l'autre côté de
// l'entrée du port ; la Basse du Bec, des roches au sud de la pointe, et sa bouée ; le
// sémaphore de Jos, sur la colline, et la fenêtre de sa vigie
export const LIEUX = (() => {
  const px = COTE.pointe.x;
  const pv = 45;
  const pied = hauteurTerrain(px, pv) - 1;
  const phare = { x: px, z: rivage(px) - pv, pied, y: pied + 29.6 };
  const jx = COTE.anse.x + 90;
  const jz = rivage(jx) + 50;
  const jetee = { x: jx, z: jz, angle: 0.5, longueur: 140, musoir: { x: jx + Math.sin(0.5) * 66, z: jz + Math.cos(0.5) * 66 } };
  const rx = COTE.anse.x - 190;
  const roche = { x: rx, z: rivage(rx) + 150 };
  const bx = px + 40;
  const basse = { x: bx, z: rivage(bx) + 460 };
  const sx = px - 900;
  const sv = 400;
  const semaphore = { x: sx, z: rivage(sx) - sv, sol: hauteurTerrain(sx, sv) - 0.5 };
  // (la vigie : la tourelle sur le toit ; sa fenêtre regarde la mer, au sud)
  semaphore.vigie = { x: sx + 4, y: semaphore.sol + 9.4, z: semaphore.z + 2.56 };
  return { phare, jetee, roche, basse, semaphore };
})();

// ---------- Les couleurs (linéaires) ----------
// (la végétation renvoie peu de lumière : 10 à 15 % ; le granit un peu plus)
const C = {
  fond: [0.05, 0.055, 0.05],
  granit: [0.21, 0.18, 0.17],
  granitClair: [0.31, 0.27, 0.25],
  lichen: [0.3, 0.25, 0.1],
  herbe: [0.085, 0.125, 0.04],
  herbeClaire: [0.14, 0.17, 0.06],
  ajonc: [0.3, 0.26, 0.035],
  bruyere: [0.13, 0.085, 0.09],
  sable: [0.5, 0.43, 0.31],
};
const melanger = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------- Le terrain de la côte ----------
function geometrieCote() {
  const pasX = 22;
  const xs = [];
  for (let x = COTE.xOuest; x <= COTE.xEst; x += pasX) xs.push(x);
  // en profondeur : serré près du rivage (la falaise), large à l'intérieur
  const vs = [-260, -90, -35, -12, -3, 0, 2, 5, 9, 14, 20, 28, 40, 60, 90, 140, 210, 300, 420, 580, 800, 1100, 1500, 2000, 2700, 3600];
  const positions = [];
  const couleurs = [];
  for (const x of xs) {
    const zr = rivage(x);
    for (const v of vs) {
      positions.push(x, hauteurTerrain(x, v), zr - v);
    }
  }
  const nv = vs.length;
  const indices = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < nv - 1; j++) {
      const a = i * nv + j;
      const b = a + nv;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  // les couleurs : la roche là où c'est raide, la lande au-dessus, le sable dans l'anse
  const n = g.attributes.normal;
  for (let k = 0; k < positions.length / 3; k++) {
    const x = positions[k * 3];
    const y = positions[k * 3 + 1];
    const v = vs[k % nv];
    const raide = 1 - n.getY(k);
    let c;
    if (y < 0.5) {
      c = melanger(C.fond, C.granit, lisse(-6, 0.5, y));
    } else {
      const lande = melanger(C.herbe, C.herbeClaire, fbm2(x / 160, v / 160));
      const fleurs = fbm2(x / 90 + 5, v / 90);
      let haut = melanger(lande, C.ajonc, lisse(0.58, 0.72, fleurs) * 0.8);
      haut = melanger(haut, C.bruyere, lisse(0.62, 0.75, fbm2(x / 120 - 4, v / 120 + 2)) * 0.7);
      let roche = melanger(C.granit, C.granitClair, fbm2(x / 40, y / 12));
      roche = melanger(roche, C.lichen, lisse(0.6, 0.75, fbm2(x / 25, y / 8)) * 0.5);
      c = melanger(haut, roche, lisse(0.28, 0.5, raide));
      // la plage au fond de l'anse
      const plage = Math.exp(-(((x - COTE.anse.x) / 220) ** 2)) * (1 - lisse(4, 12, y));
      c = melanger(c, C.sable, plage);
    }
    couleurs.push(...c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  return g;
}

// L'île Brune : un rocher bombé, des falaises tout autour
function geometrieIle() {
  const { x: cx, z: cz, rayon } = COTE.ile;
  const nA = 96;
  const rayons = [0.0, 0.25, 0.5, 0.7, 0.84, 0.92, 0.97, 1.0, 1.04, 1.1, 1.3];
  const positions = [];
  const couleurs = [];
  for (let a = 0; a < nA; a++) {
    const ang = (a / nA) * Math.PI * 2;
    const bordure = rayon * (0.8 + 0.4 * fbm1(a / 9 + 2.2));
    for (const r of rayons) {
      const d = r * bordure;
      // une falaise de 13 m tout autour, puis un dôme d'herbe ; sous l'eau au-delà du bord
      const y = r <= 1
        ? 18 * lisse(1.0, 0.93, r) + 30 * (1 - r * r) * (0.7 + 0.3 * fbm1(a / 5))
        : -12 * (r - 1) / 0.3;
      positions.push(cx + Math.sin(ang) * d, y, cz - Math.cos(ang) * d);
    }
  }
  const nr = rayons.length;
  const indices = [];
  for (let a = 0; a < nA; a++) {
    const a2 = (a + 1) % nA;
    for (let j = 0; j < nr - 1; j++) {
      const p = a * nr + j;
      const q = a2 * nr + j;
      indices.push(p, q, p + 1, q, q + 1, p + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let k = 0; k < positions.length / 3; k++) {
    const y = positions[k * 3 + 1];
    const raide = 1 - n.getY(k);
    const c = y < 0.5 ? C.fond : melanger(melanger(C.herbe, C.bruyere, 0.5), C.granit, lisse(0.25, 0.45, raide));
    couleurs.push(...c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  return g;
}

// ---------- Les bâtiments ----------
function teinte(g, c) {
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}
const BLANC = [0.78, 0.77, 0.74];
const ARDOISE = [0.07, 0.075, 0.085];
const PIERRE = [0.36, 0.33, 0.31];
const ROUGE = [0.5, 0.06, 0.04];
const VERT = [0.04, 0.3, 0.12];

// Une maison bretonne : murs blancs, toit d'ardoise à deux pentes
function maison(x, y, z, angle, l = 9, p = 6, h = 4.5) {
  const murs = new THREE.BoxGeometry(l, h, p);
  murs.translate(0, h / 2, 0);
  const toit = new THREE.CylinderGeometry(0.01, p * 0.62, l * 1.02, 3, 1);
  // (un prisme triangulaire : l'axe le long de la maison, une arête vers le haut)
  toit.rotateZ(Math.PI / 2);
  toit.rotateX(-Math.PI / 2);
  toit.scale(1, 0.75, 1);
  toit.translate(0, h + p * 0.62 * 0.5 * 0.75, 0);
  const g = mergeGeometries([teinte(murs, BLANC), teinte(toit, ARDOISE)]);
  g.rotateY(angle);
  g.translate(x, y, z);
  return g;
}

function batiments() {
  const geos = [];
  const sol = (x, v) => hauteurTerrain(x, v);
  // le phare de la pointe du Bec : une tour blanche, le haut rouge, la lanterne
  const { x: px, z: pz, pied: py } = LIEUX.phare;
  const pv = 45;
  const tour = new THREE.CylinderGeometry(2.6, 3.4, 24, 20);
  tour.translate(px, py + 12, pz);
  const haut = new THREE.CylinderGeometry(2.7, 2.6, 4, 20);
  haut.translate(px, py + 26, pz);
  const galerie = new THREE.CylinderGeometry(3.4, 3.4, 0.5, 20);
  galerie.translate(px, py + 28.2, pz);
  const coupole = new THREE.ConeGeometry(2.2, 2.2, 16);
  coupole.translate(px, py + 32.2, pz);
  geos.push(teinte(tour, BLANC), teinte(haut, ROUGE), teinte(galerie, ARDOISE), teinte(coupole, ARDOISE));
  geos.push(maison(px - 14, sol(px - 14, pv + 6), pz - 6, 0.2, 11, 7, 4));
  // le sémaphore, sur la colline : le bâtiment blanc, le grand mât et sa vergue
  const { x: sx, z: sz, sol: sy } = LIEUX.semaphore;
  const batiment = new THREE.BoxGeometry(16, 7, 8);
  batiment.translate(sx, sy + 3.5, sz);
  const tourelle = new THREE.BoxGeometry(5, 4, 5);
  tourelle.translate(sx + 4, sy + 9, sz);
  const mat = new THREE.CylinderGeometry(0.35, 0.5, 26, 8);
  mat.translate(sx - 5, sy + 13, sz + 2);
  const vergue = new THREE.BoxGeometry(9, 0.4, 0.4);
  vergue.translate(sx - 5, sy + 21, sz + 2);
  geos.push(teinte(batiment, BLANC), teinte(tourelle, BLANC), teinte(mat, PIERRE), teinte(vergue, PIERRE));
  // le village de Port-Kervalen, au fond de l'anse, et son clocher
  const ax = COTE.anse.x;
  for (let k = 0; k < 18; k++) {
    const x = ax - 260 + (k / 17) * 520 + (hasard(k) - 0.5) * 30;
    const v = 30 + hasard(k + 40) * 160 + Math.abs(x - ax) * 0.35;
    geos.push(maison(x, sol(x, v), rivage(x) - v, hasard(k + 7) * 0.6 - 0.3, 8 + hasard(k + 3) * 5, 6, 4 + hasard(k + 9) * 2));
  }
  const cv = 150;
  const clocher = new THREE.BoxGeometry(5, 18, 5);
  clocher.translate(ax + 20, sol(ax + 20, cv) + 9, rivage(ax + 20) - cv);
  const fleche = new THREE.ConeGeometry(3.6, 14, 4);
  fleche.rotateY(Math.PI / 4);
  fleche.translate(ax + 20, sol(ax + 20, cv) + 25, rivage(ax + 20) - cv);
  const nef = new THREE.BoxGeometry(9, 9, 22);
  nef.translate(ax + 20, sol(ax + 20, cv) + 4.5, rivage(ax + 20) - cv - 14);
  geos.push(teinte(clocher, PIERRE), teinte(fleche, PIERRE), teinte(nef, PIERRE));
  // la jetée du port, et au musoir, le mât vert de son feu
  const J = LIEUX.jetee;
  const jetee = new THREE.BoxGeometry(6, 3, J.longueur);
  jetee.rotateY(J.angle);
  jetee.translate(J.x, 1, J.z);
  geos.push(teinte(jetee, PIERRE));
  const matFeu = new THREE.CylinderGeometry(0.35, 0.45, 4.2, 10);
  matFeu.translate(J.musoir.x, 2.5 + 2.1, J.musoir.z);
  const cone = new THREE.ConeGeometry(0.6, 0.9, 12);
  cone.translate(J.musoir.x, 2.5 + 4.65, J.musoir.z);
  geos.push(teinte(matFeu, VERT), teinte(cone, VERT));
  // la Roche Rouge : une roche, et sa tourelle rouge (une marque bâbord, un cylindre au sommet)
  const R = LIEUX.roche;
  const roche = new THREE.DodecahedronGeometry(9, 1);
  roche.scale(1.3, 0.45, 1);
  roche.translate(R.x, -1, R.z);
  const tourRouge = new THREE.CylinderGeometry(1.5, 2.1, 8, 14);
  tourRouge.translate(R.x, 1.5 + 4, R.z);
  const marque = new THREE.CylinderGeometry(0.7, 0.7, 1.2, 14);
  marque.translate(R.x, 1.5 + 8 + 0.9, R.z);
  geos.push(teinte(roche, [0.12, 0.11, 0.1]), teinte(tourRouge, ROUGE), teinte(marque, ROUGE));
  return mergeGeometries(geos);
}

// ---------- La brume, comme sur la mer ----------
// (sert aussi aux autres choses lointaines : le cargo, la trombe, les déferlantes) ; et
// les rideaux de pluie des grains qui passent devant (rendu/glsl/grains.js)
export function brumeCommeLaMer(materiau, eau, cle = 'cote-brume') {
  materiau.onBeforeCompile = (shader) => {
    shader.uniforms.uCarteCiel = eau.uniforms.uCarteCiel;
    shader.uniforms.uBrume = eau.uniforms.uBrume;
    shader.uniforms.uBruitRideaux = eau.uniforms.uBruit;
    for (const k of Object.keys(UNIFORMS_GRAINS)) shader.uniforms[k] = eau.uniforms[k];
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMonde;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPosMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vPosMonde;
uniform sampler2D uCarteCiel;
uniform float uBrume;
uniform highp sampler3D uBruitRideaux;
${GLSL_CARTE_CIEL}
${glslGrains('uBruitRideaux')}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
{
  vec3 versPoint = vPosMonde - cameraPosition;
  float distance = length(versPoint);
  vec3 d = versPoint / distance;
  vec3 horizon = texture(uCarteCiel, uvCarteCiel(normalize(vec3(d.x, max(d.y, 0.012), d.z)))).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, horizon, 1.0 - exp(-distance * uBrume));
  if (uRideauxN > 0) {
    vec4 r = rideaux(cameraPosition, d, distance, uBrume, horizon);
    gl_FragColor.rgb = gl_FragColor.rgb * r.a + r.rgb;
  }
}`);
  };
  materiau.customProgramCacheKey = () => cle;
  return materiau;
}

export class Cote {
  constructor(scene, eau) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'cote-de-kervalen';
    const materiau = brumeCommeLaMer(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), eau);
    const terre = new THREE.Mesh(mergeGeometries([geometrieCote(), geometrieIle()]), materiau);
    const maisons = new THREE.Mesh(batiments(), brumeCommeLaMer(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), eau));
    // (les feux — le phare, le port, la bouée, la fenêtre du sémaphore — : rendu/feux.js)
    for (const m of [terre, maisons]) {
      m.frustumCulled = false;
      this.groupe.add(m);
    }
    scene.add(this.groupe);
  }
}

// La distance du bateau à la terre (m), pour prévenir quand on s'approche des cailloux
export function distanceALaTerre(x, z) {
  let d = Infinity;
  if (x > COTE.xOuest && x < COTE.xEst) d = z - rivage(x);
  const { x: ix, z: iz, rayon } = COTE.ile;
  d = Math.min(d, Math.hypot(x - ix, z - iz) - rayon * 1.05);
  return d;
}
