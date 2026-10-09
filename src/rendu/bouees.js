// Les bouées de la journée, en 3D. Ce sont des marques de balisage comme sur la côte
// (balisage IALA, région A, celle de l'Europe) :
//  - jaune : une marque spéciale, avec une croix jaune au sommet ;
//  - rouge : une marque bâbord, avec un cylindre rouge au sommet ;
//  - verte : une marque tribord, avec un cône vert au sommet ;
//  - cardinale-sud : jaune sur noir, deux cônes noirs pointe en bas (les dangers sont au nord
//    d'elle : on passe au sud) — celle de la Basse du Bec (rendu/feux.js), feu blanc.
// Chacune : un flotteur, un pylône en treillis, la marque de tête, un réflecteur radar et
// un feu qui s'allume au crépuscule (il clignote : un éclat toutes les 4 secondes pour la
// jaune, 3 pour la rouge, 2,5 pour la verte).
// Elles flottent : elles montent et descendent avec la vague, et s'inclinent avec elle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TEINTES = { jaune: 0xe8b512, rouge: 0xb51f1a, verte: 0x17803a, 'cardinale-sud': 0xe8b512 };
const FEUX = { jaune: [0xffd86a, 4], rouge: [0xff4a3a, 3], verte: [0x5dff8a, 2.5], 'cardinale-sud': [0xfff0d8, 15] };

// Un cylindre entre deux points
function barre(a, b, rayon) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(rayon, rayon, va.distanceTo(vb), 8, 1);
  g.translate(0, va.distanceTo(vb) / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
  g.translate(...a);
  return g;
}

export function construireBouee(couleur) {
  const peinture = new THREE.MeshStandardMaterial({ color: TEINTES[couleur], roughness: 0.5, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.35, metalness: 0.85 });
  const sombre = new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.8 });
  const groupe = new THREE.Group();
  const peint = [];
  // (la cardinale : le flotteur noir, le pylône jaune — jaune sur noir —, et la marque noire)
  const cardinale = couleur === 'cardinale-sud';
  const noir = [];
  // le flotteur : large et bas, la moitié dans l'eau ; une jupe plus sombre (les algues…)
  const flotteur = new THREE.LatheGeometry([
    [0, -0.9], [0.75, -0.9], [1.05, -0.55], [1.1, 0.1], [1.05, 0.55], [0.55, 0.75], [0, 0.75],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 36);
  (cardinale ? noir : peint).push(flotteur);
  const jupe = new THREE.Mesh(new THREE.CylinderGeometry(1.115, 1.08, 0.5, 36, 1, true), sombre);
  jupe.position.y = -0.45;
  groupe.add(jupe);
  // le pylône : quatre montants qui se resserrent, et des entretoises
  const pieds = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    pieds.push([[Math.cos(a) * 0.62, 0.7, Math.sin(a) * 0.62], [Math.cos(a) * 0.22, 3.0, Math.sin(a) * 0.22]]);
  }
  for (const [a, b] of pieds) peint.push(barre(a, b, 0.045));
  for (const h of [0.35, 0.7]) {
    for (let k = 0; k < 4; k++) {
      const [a0, b0] = pieds[k];
      const [a1, b1] = pieds[(k + 1) % 4];
      const p = (pa, pb) => pa.map((v, i) => v + (pb[i] - v) * h);
      peint.push(barre(p(a0, b0), p(a1, b1), 0.03));
    }
  }
  // la plateforme du haut
  const plateau = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20);
  plateau.translate(0, 3.04, 0);
  peint.push(plateau);
  // la marque de tête
  if (cardinale) {
    // deux cônes noirs, pointe en bas, l'un au-dessus de l'autre
    for (const h of [3.42, 3.98]) {
      const cone = new THREE.ConeGeometry(0.3, 0.46, 20);
      cone.rotateX(Math.PI);
      cone.translate(0, h, 0);
      noir.push(cone);
    }
    const tige = new THREE.CylinderGeometry(0.04, 0.04, 1.05, 8);
    tige.translate(0, 3.6, 0);
    noir.push(tige);
  } else if (couleur === 'jaune') {
    for (const s of [1, -1]) {
      const bras = new THREE.BoxGeometry(0.12, 0.85, 0.12);
      bras.rotateZ(s * Math.PI / 4);
      bras.translate(0, 3.75, 0);
      peint.push(bras);
    }
    const tige = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
    tige.translate(0, 3.25, 0);
    peint.push(tige);
  } else if (couleur === 'rouge') {
    const cyl = new THREE.CylinderGeometry(0.28, 0.28, 0.62, 20);
    cyl.translate(0, 3.55, 0);
    const tige = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8);
    tige.translate(0, 3.15, 0);
    peint.push(cyl, tige);
  } else {
    const cone = new THREE.ConeGeometry(0.36, 0.7, 20);
    cone.translate(0, 3.6, 0);
    const tige = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8);
    tige.translate(0, 3.15, 0);
    peint.push(cone, tige);
  }
  // le réflecteur radar (un octaèdre de tôle), sur le côté du pylône
  const reflecteur = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), metal);
  reflecteur.position.set(0.32, 2.25, 0.32);
  groupe.add(reflecteur);
  // le feu : une petite lanterne
  const [teinteFeu, periode] = FEUX[couleur];
  const lanterne = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 14), new THREE.MeshStandardMaterial({
    color: 0x202020, emissive: teinteFeu, emissiveIntensity: 0, roughness: 0.3,
  }));
  lanterne.position.set(0, cardinale ? 4.36 : couleur === 'jaune' ? 4.28 : couleur === 'rouge' ? 4.0 : 4.08, 0);
  groupe.add(lanterne);
  const fusion = (geos) => mergeGeometries(geos.map((g) => {
    g.deleteAttribute('uv');
    return g.index ? g.toNonIndexed() : g;
  }));
  groupe.add(new THREE.Mesh(fusion(peint), peinture));
  if (noir.length) groupe.add(new THREE.Mesh(fusion(noir), sombre));
  for (const o of groupe.children) {
    o.castShadow = false;
    o.receiveShadow = false;
  }
  return { groupe, lanterne, periode, phase: Math.random() * periode };
}

export class Bouees {
  constructor(scene, houle) {
    this.scene = scene;
    this.houle = houle;
    this.objets = new Map(); // id → { groupe, lanterne, … }
    this._n = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  // liste : les bouées posées (Map id → { couleur, x, z }) ; nuit : 0 → 1 (le feu s'allume)
  maj(liste, temps, nuit) {
    for (const [id, b] of liste ?? []) {
      let o = this.objets.get(id);
      if (!o) {
        o = construireBouee(b.couleur);
        o.groupe.name = `bouee-${id}`;
        this.scene.add(o.groupe);
        this.objets.set(id, o);
      }
      // à la surface : la hauteur de la vague, et sa pente (la bouée se penche avec elle)
      const h = this.houle.hauteur(b.x, b.z);
      const hx = this.houle.hauteur(b.x + 1.2, b.z) - this.houle.hauteur(b.x - 1.2, b.z);
      const hz = this.houle.hauteur(b.x, b.z + 1.2) - this.houle.hauteur(b.x, b.z - 1.2);
      this._n.set(-hx / 2.4, 1, -hz / 2.4).normalize();
      this._q.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, this._n);
      o.groupe.position.set(b.x, h - 0.12, b.z);
      // (un peu d'inertie : elle ne suit pas la pente instantanément)
      o.groupe.quaternion.slerp(this._q, 0.08);
      // le feu : un éclat d'une demi-seconde par période, quand le jour baisse
      const allume = Math.min(1, Math.max(0, (nuit - 0.15) / 0.35));
      const t = (temps + o.phase) % o.periode;
      o.lanterne.material.emissiveIntensity = allume * (t < 0.5 ? 9 : 0.15);
    }
    // les bouées retirées
    for (const [id, o] of this.objets) {
      if (!liste?.has(id)) {
        this.scene.remove(o.groupe);
        this.objets.delete(id);
      }
    }
  }
}
