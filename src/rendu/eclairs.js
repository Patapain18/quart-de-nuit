// Les éclairs : un trait de foudre qui zigzague du nuage jusqu'à la mer, avec ses
// ramifications. Il n'est visible que pendant le flash (quelques dixièmes de seconde) ;
// le halo de l'image (post.js) lui donne sa lueur.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// Un chemin en zigzag entre a et b : on coupe le segment en deux et on décale le
// milieu au hasard, puis on recommence sur chaque moitié (« déplacement du point milieu »)
function zigzag(a, b, ecart, profondeur, segments, branches, aleatoire) {
  if (profondeur === 0) {
    segments.push(a, b);
    return;
  }
  const milieu = a.clone().lerp(b, 0.5);
  const longueur = a.distanceTo(b);
  milieu.x += (aleatoire() - 0.5) * ecart * longueur;
  milieu.z += (aleatoire() - 0.5) * ecart * longueur;
  milieu.y += (aleatoire() - 0.5) * ecart * longueur * 0.3;
  zigzag(a, milieu, ecart, profondeur - 1, segments, branches, aleatoire);
  zigzag(milieu, b, ecart, profondeur - 1, segments, branches, aleatoire);
  // parfois, une branche part vers le bas
  if (branches && profondeur >= 3 && aleatoire() < 0.35) {
    const direction = b.clone().sub(a).normalize();
    const fin = milieu.clone().add(new THREE.Vector3(
      direction.x + (aleatoire() - 0.5) * 1.6, direction.y * 0.7, direction.z + (aleatoire() - 0.5) * 1.6,
    ).multiplyScalar(longueur * (0.3 + aleatoire() * 0.4)));
    branches.push([milieu, fin]);
  }
}

export class Eclairs {
  constructor() {
    this.materiauTronc = new LineMaterial({ color: 0xffffff, linewidth: 3.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.materiauBranches = new LineMaterial({ color: 0xffffff, linewidth: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.tronc = new LineSegments2(new LineSegmentsGeometry(), this.materiauTronc);
    this.branches = new LineSegments2(new LineSegmentsGeometry(), this.materiauBranches);
    this.groupe = new THREE.Group();
    this.groupe.add(this.tronc, this.branches);
    for (const l of [this.tronc, this.branches]) {
      l.frustumCulled = false;
      l.renderOrder = 5;
    }
    this.groupe.visible = false;
    this.cle = null;
  }

  // Dessine l'éclair qui part du point « centre » (dans le nuage) jusqu'à la mer
  fabriquer(centre, graine) {
    let a = graine >>> 0;
    const aleatoire = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const haut = centre.clone();
    const bas = new THREE.Vector3(centre.x + (aleatoire() - 0.5) * 900, 0, centre.z + (aleatoire() - 0.5) * 900);
    const tronc = [];
    const departsBranches = [];
    zigzag(haut, bas, 0.42, 7, tronc, departsBranches, aleatoire);
    const branches = [];
    for (const [d, f] of departsBranches) zigzag(d, f, 0.5, 4, branches, null, aleatoire);
    const plat = (pts) => pts.flatMap((p) => [p.x, p.y, p.z]);
    this.tronc.geometry.dispose();
    this.branches.geometry.dispose();
    this.tronc.geometry = new LineSegmentsGeometry().setPositions(plat(tronc));
    this.branches.geometry = new LineSegmentsGeometry().setPositions(plat(branches));
  }

  // flash : { centre, debut, proche } ou null ; intensite : force du flash (0 → 2)
  maj(flash, intensite, resolution) {
    if (!flash || intensite < 0.03) {
      this.groupe.visible = false;
      return;
    }
    // un nouvel éclair : on dessine sa forme une seule fois
    if (this.cle !== flash.cle) {
      this.cle = flash.cle;
      this.fabriquer(flash.centre, flash.cle);
    }
    this.groupe.visible = flash.visible;
    const c = Math.min(1, intensite) * 60;
    this.materiauTronc.color.setRGB(0.85 * c, 0.88 * c, c);
    this.materiauBranches.color.setRGB(0.5 * c, 0.53 * c, 0.6 * c);
    this.materiauTronc.resolution.copy(resolution);
    this.materiauBranches.resolution.copy(resolution);
  }
}
