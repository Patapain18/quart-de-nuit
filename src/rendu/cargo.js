// Le cargo de 22 h 30 : un porte-conteneurs de 185 m qui croise la route du voilier.
//
// La nuit, on ne voit d'un navire que ses feux — et ils disent tout, à qui sait les lire
// (les règles sont les mêmes sur toutes les mers du monde) :
//  - deux feux blancs de tête de mât, l'un à l'avant, plus bas, l'autre à l'arrière, plus
//    haut : s'ils sont l'un au-dessus de l'autre, il vient droit sur nous ;
//  - un feu rouge à bâbord, un feu vert à tribord, visibles seulement de l'avant jusqu'à
//    un peu en arrière du travers : voir le rouge ET le vert, c'est le voir de face ;
//  - un feu blanc de poupe, visible seulement de l'arrière.
// Chaque feu n'éclaire que dans son « secteur » : on calcule ici, à chaque image, lesquels
// on voit. Plus les hublots du château, la passerelle, et les projecteurs du pont.
//
// Quand il est près, ou dans un éclair, on devine sa masse : la coque noire, les piles de
// conteneurs, le château blanc, la cheminée, et la vague blanche à son étrave.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { brumeCommeLaMer } from './cote.js';

const LONGUEUR = 185;
const DEMI_LARGEUR = 15;
const FRANC_BORD = 7; // hauteur du pont au-dessus de l'eau

function hasard(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// une boîte colorée (les couleurs dans les sommets : tout le cargo tient en un seul dessin)
function boite(lx, ly, lz, x, y, z, couleur) {
  const g = new THREE.BoxGeometry(lx, ly, lz);
  g.translate(x, y, z);
  const c = new THREE.Color(couleur);
  const n = g.attributes.position.count;
  const couleurs = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) couleurs.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  g.deleteAttribute('uv');
  return g;
}

// La demi-largeur de la coque à l'abscisse z (avant en -z) : un arrière carré, un long
// milieu droit, une étrave effilée sur les 40 derniers mètres
function demiLargeur(z) {
  const u = (z + LONGUEUR / 2) / LONGUEUR; // 0 à l'étrave, 1 à la poupe
  if (u < 0.22) return DEMI_LARGEUR * Math.sqrt(Math.max(0, 1 - ((0.22 - u) / 0.22) ** 2)) ** 1.15;
  if (u > 0.94) return DEMI_LARGEUR * (1 - 0.12 * ((u - 0.94) / 0.06) ** 2);
  return DEMI_LARGEUR;
}

function geometrieCoque() {
  // des tranches de l'étrave à la poupe ; chaque tranche : la quille, le flanc, le pont
  const tranches = 48;
  const positions = [];
  const couleurs = [];
  const coque = new THREE.Color(0x1b1e24);
  const flottaison = new THREE.Color(0x5a1812);
  const anneau = (z) => {
    const w = demiLargeur(z);
    // (bas sous l'eau, la ligne de flottaison rouge, le flanc noir, le pavois)
    return [[-w * 0.85, -9], [-w, -1.5], [-w, 1.2], [-w, FRANC_BORD], [w, FRANC_BORD], [w, 1.2], [w, -1.5], [w * 0.85, -9]];
  };
  const teinte = (k) => (k === 1 || k === 6 ? flottaison : coque);
  const indices = [];
  let n = 0;
  for (let i = 0; i <= tranches; i++) {
    const z = -LONGUEUR / 2 + (LONGUEUR * i) / tranches;
    anneau(z).forEach(([x, y], k) => {
      positions.push(x, y, z);
      const c = teinte(k);
      couleurs.push(c.r, c.g, c.b);
    });
    if (i > 0) {
      for (let k = 0; k < 7; k++) {
        const a = n - 8 + k;
        const b = n + k;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    n += 8;
  }
  // le tableau arrière (une plaque)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const tableau = boite(DEMI_LARGEUR * 1.76, FRANC_BORD + 9, 0.3, 0, (FRANC_BORD - 9) / 2, LONGUEUR / 2, 0x1b1e24);
  return mergeGeometries([g.toNonIndexed(), tableau.toNonIndexed()]);
}

// Les conteneurs : des piles de 2 à 6, rangée par rangée, de toutes les couleurs des
// grandes compagnies (assombries : ce sont de vieilles boîtes, et il fait nuit)
function geometrieConteneurs() {
  const couleurs = [0x1d4f7a, 0x8a2a20, 0x6b6e70, 0xb8b4aa, 0x2f5a3a, 0xa8561e, 0x1f2c48, 0x7a6a3a, 0x4a1e3a];
  const geos = [];
  let k = 0;
  // des baies de 13 m, de l'avant jusqu'au château (et une derrière)
  for (let z = -72; z <= 50; z += 13.2) {
    if (z > 28 && z < 46) continue; // (la place du château)
    const w = demiLargeur(z) - 1.2;
    const rangees = Math.floor((w * 2) / 2.5);
    for (let r = 0; r < rangees; r++) {
      const x = -w + 1.25 + r * 2.5;
      const pile = 2 + Math.floor(hasard(k * 3.1 + 1) * 4.5);
      for (let t = 0; t < pile; t++) {
        const c = couleurs[Math.floor(hasard(k * 7.7 + t) * couleurs.length)];
        geos.push(boite(2.42, 2.55, 12.1, x, FRANC_BORD + 1.3 + t * 2.6, z, c));
        k++;
      }
    }
  }
  return mergeGeometries(geos);
}

// Le château (logements et passerelle), la cheminée, les mâts
function geometrieChateau() {
  const blanc = 0xc9c7bd;
  const geos = [
    boite(20, 18, 12, 0, FRANC_BORD + 9, 37, blanc), // les logements
    boite(DEMI_LARGEUR * 2, 0.6, 5, 0, FRANC_BORD + 18.3, 33.5, blanc), // la passerelle et ses ailes
    boite(16, 3.2, 6, 0, FRANC_BORD + 20, 34, blanc), // la timonerie
    boite(6, 9, 6, 0, FRANC_BORD + 13, 50, 0x2b2d33), // la cheminée
    boite(6.2, 1.6, 6.2, 0, FRANC_BORD + 16.2, 50, 0x8c1a16), // sa bande rouge
    boite(0.5, 14, 0.5, 0, FRANC_BORD + 28, 35, 0x9a9a92), // le mât radar
    boite(4, 0.3, 0.3, 0, FRANC_BORD + 33.5, 35, 0x9a9a92),
    boite(0.6, 14, 0.6, 0, FRANC_BORD + 7, -80, 0x9a9a92), // le mât avant
    boite(DEMI_LARGEUR * 1.6, 2.2, 1, 0, FRANC_BORD + 1.1, -84, 0x22252b), // le gaillard
  ];
  return mergeGeometries(geos);
}

// Les hublots et les fenêtres de la passerelle (des rectangles qui brillent)
function geometrieFenetres() {
  const geos = [];
  const couleur = (k) => (hasard(k) < 0.45 ? 0x000000 : hasard(k * 3) < 0.5 ? 0xffc77a : 0xfff0d0);
  let k = 0;
  // la façade avant du château : 5 étages de hublots
  for (let etage = 0; etage < 5; etage++) {
    for (let i = 0; i < 7; i++) {
      geos.push(boite(1.1, 0.9, 0.05, -7.5 + i * 2.5, FRANC_BORD + 2.5 + etage * 3.1, 30.97, couleur(k++)));
    }
  }
  // la passerelle : une longue bande de vitres, à peine éclairée (vert-bleu des écrans)
  for (let i = 0; i < 9; i++) geos.push(boite(1.4, 1.3, 0.05, -7 + i * 1.75, FRANC_BORD + 20.3, 30.97, 0x2a6a5a));
  return mergeGeometries(geos);
}

// Les feux : des points lumineux qui gardent une taille minimale à l'écran (sinon, à
// 2 km, ils disparaîtraient entre deux pixels), et que la pluie atténue avec la distance
const SOMMET_FEUX = /* glsl */ `
attribute vec3 couleur;
attribute float intensite;
uniform float uEchelle;
uniform float uBrume;
varying vec3 vCouleur;
void main() {
  vec4 vue = modelViewMatrix * vec4(position, 1.0);
  float d = -vue.z;
  gl_PointSize = max(2.5, 0.9 * uEchelle / d);
  vCouleur = couleur * intensite * exp(-d * uBrume * 0.55);
  gl_Position = projectionMatrix * vue;
}
`;
const FRAGMENT_FEUX = /* glsl */ `
varying vec3 vCouleur;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCouleur * a * a, 1.0);
}
`;

// [nom, position, couleur, intensité, secteur : depuis l'avant, de (°) → à (°)
// (positif vers tribord)]
const FEUX = [
  ['tete-avant', [0, FRANC_BORD + 14.5, -80], 0xfff6e8, 900, [-112.5, 112.5]],
  ['tete-arriere', [0, FRANC_BORD + 35.5, 35], 0xfff6e8, 900, [-112.5, 112.5]],
  ['babord', [-DEMI_LARGEUR, FRANC_BORD + 18.8, 33], 0xff2a18, 700, [-112.5, 0]],
  ['tribord', [DEMI_LARGEUR, FRANC_BORD + 18.8, 33], 0x18ff60, 700, [0, 112.5]],
  ['poupe', [0, FRANC_BORD + 3, LONGUEUR / 2], 0xfff6e8, 600, [112.5, 247.5]],
  // les projecteurs du pont (orange, au sodium) : visibles de partout
  ['pont-1', [-9, FRANC_BORD + 17, 30.5], 0xffa040, 260, null],
  ['pont-2', [9, FRANC_BORD + 17, 30.5], 0xffa040, 260, null],
  ['pont-3', [0, FRANC_BORD + 15, -82], 0xffa040, 160, null],
];

export class Cargo3D {
  constructor(scene, houle, eau) {
    this.houle = houle;
    this.groupe = new THREE.Group();
    this.groupe.name = 'cargo';
    const materiau = brumeCommeLaMer(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1, side: THREE.DoubleSide }), eau, 'cargo-brume');
    for (const g of [geometrieCoque(), geometrieConteneurs(), geometrieChateau()]) {
      const m = new THREE.Mesh(g, materiau);
      m.frustumCulled = false;
      this.groupe.add(m);
    }
    // les fenêtres : elles brillent d'elles-mêmes
    this.fenetres = new THREE.Mesh(geometrieFenetres(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.fenetres.material.color.setScalar(6);
    this.groupe.add(this.fenetres);
    // les feux
    const n = FEUX.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(FEUX.flatMap(([, p]) => p), 3));
    g.setAttribute('couleur', new THREE.Float32BufferAttribute(FEUX.flatMap(([, , c]) => new THREE.Color(c).toArray()), 3));
    this.intensites = new Float32Array(n);
    g.setAttribute('intensite', new THREE.BufferAttribute(this.intensites, 1));
    this.uniformsFeux = { uEchelle: { value: 800 }, uBrume: eau.uniforms.uBrume };
    this.feux = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniformsFeux, vertexShader: SOMMET_FEUX, fragmentShader: FRAGMENT_FEUX,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.feux.frustumCulled = false;
    this.groupe.add(this.feux);
    // la vague d'étrave : de l'écume blanche qui s'ouvre en V devant la coque
    this.vague = new THREE.Mesh(geometrieVagueEtrave(), brumeCommeLaMer(new THREE.MeshStandardMaterial({
      color: 0xdfe6e8, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide,
    }), eau, 'cargo-vague'));
    this.groupe.add(this.vague);
    this.groupe.visible = false;
    scene.add(this.groupe);
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  // cargo : { x, z, cap (degrés) } (jeu/nuit.js), ou null ; camera : pour les secteurs
  maj(cargo, camera) {
    this.groupe.visible = !!cargo;
    if (!cargo) return;
    const g = this.groupe;
    const cap = (cargo.cap * Math.PI) / 180;
    const avant = new THREE.Vector3(Math.sin(cap), 0, -Math.cos(cap));
    const droite = new THREE.Vector3(Math.cos(cap), 0, Math.sin(cap));
    // il flotte : un si grand navire ne suit que la grande houle (et très peu)
    const h = (dx, dz) => this.houle.hauteur(cargo.x + avant.x * dx + droite.x * dz, cargo.z + avant.z * dx + droite.z * dz);
    const hAvant = h(80, 0);
    const hArriere = h(-80, 0);
    const hTribord = h(0, 15);
    const hBabord = h(0, -15);
    g.position.set(cargo.x, (hAvant + hArriere + hTribord + hBabord) / 4 * 0.6, cargo.z);
    this._e.set(Math.atan2(hAvant - hArriere, 160) * 0.5, -cap, Math.atan2(hTribord - hBabord, 30) * 0.4, 'YXZ');
    g.quaternion.setFromEuler(this._e);
    // les feux visibles d'où l'on est (chacun dans son secteur)
    const versNous = camera.position.clone().sub(g.position).setY(0);
    const relatif = (Math.atan2(versNous.dot(droite), versNous.dot(avant)) * 180) / Math.PI; // + : tribord
    FEUX.forEach(([, , , intensite, secteur], i) => {
      let v = 1;
      if (secteur) {
        let a = relatif;
        if (secteur[1] > 180 && a < 0) a += 360; // (le feu de poupe, de 112,5° à 247,5°)
        v = THREE.MathUtils.smoothstep(a, secteur[0] - 2, secteur[0] + 2) * (1 - THREE.MathUtils.smoothstep(a, secteur[1] - 2, secteur[1] + 2));
      }
      this.intensites[i] = intensite * v;
    });
    this.feux.geometry.attributes.intensite.needsUpdate = true;
    this.uniformsFeux.uEchelle.value = camera.userData.hauteurPixels / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
}

// La vague d'étrave : un V d'écume, posé sur l'eau devant l'étrave
function geometrieVagueEtrave() {
  const positions = [];
  const z0 = -LONGUEUR / 2;
  for (const s of [-1, 1]) {
    // une bande qui part de l'étrave et s'écarte vers l'arrière, en s'élargissant
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push([s * (1 + t * 22), 0.3 - t * 0.2, z0 + 2 + t * 45, 1.5 + t * 4]);
    }
    for (let k = 0; k < 10; k++) {
      const [x0, y0, za, l0] = pts[k];
      const [x1, y1, zb, l1] = pts[k + 1];
      positions.push(x0, y0, za, x1, y1, zb, x0 + s * l0, y0, za);
      positions.push(x1, y1, zb, x1 + s * l1, y1, zb, x0 + s * l0, y0, za);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}
