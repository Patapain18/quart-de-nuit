// Les cordages courants (ceux que l'on manœuvre) :
//  - l'écoute de grand-voile : du bout de la bôme au chariot du rail, en 4 brins
//    (un palan : on tire 4 fois plus de longueur, mais avec 4 fois moins d'effort) ;
//  - les écoutes de foc : du coin de la voile (le point d'écoute) au chariot sur le
//    pont, puis au winch du cockpit. Celle sous le vent est tendue, l'autre pend ;
//  - les drisses : elles hissent les voiles, descendent le long du mât et reviennent
//    au cockpit sur le toit du rouf.
// Les morceaux droits sont des cylindres qu'on replace à chaque image (sans recréer
// de géométrie) ; seule l'écoute qui pend est recalculée, et pas à chaque image.
import * as THREE from 'three';
import { zDe, hauteurPont, hauteurRouf, COCKPIT, ROUF } from './forme.js';

const HAUT = new THREE.Vector3(0, 1, 0);

class Brin {
  constructor(materiau, rayon) {
    const g = new THREE.CylinderGeometry(rayon, rayon, 1, 6, 1, true);
    g.translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(g, materiau);
    this.mesh.castShadow = true;
    this._d = new THREE.Vector3();
  }
  placer(a, b) {
    this._d.subVectors(b, a);
    const l = this._d.length();
    this.mesh.position.copy(a);
    this.mesh.quaternion.setFromUnitVectors(HAUT, this._d.divideScalar(l || 1));
    this.mesh.scale.set(1, l, 1);
  }
}

export class Cordages {
  constructor(bateau) {
    this.bateau = bateau;
    const m = bateau.mesures;
    const materiau = bateau.materiaux.cordage;
    const groupe = new THREE.Group();
    groupe.name = 'cordages';
    this.groupe = groupe;
    // écoute de grand-voile : 4 brins
    this.brinsGV = [0, 1, 2, 3].map(() => new Brin(materiau, 0.006));
    // écoutes de foc : point d'écoute → chariot → winch, des deux côtés
    this.brinsFoc = [0, 1].map(() => new Brin(materiau, 0.0065));
    this.brinsFocWinch = [0, 1].map(() => new Brin(materiau, 0.0065));
    for (const b of [...this.brinsGV, ...this.brinsFoc, ...this.brinsFocWinch]) groupe.add(b.mesh);
    // l'écoute qui pend (côté au vent)
    this.molle = new THREE.Mesh(new THREE.BufferGeometry(), materiau);
    this.molle.castShadow = true;
    groupe.add(this.molle);
    this.ageMolle = 1;

    // les drisses (fixes) : le long du mât, puis sur le toit jusqu'au cockpit
    const drisses = [];
    for (const [dx, tete] of [[0.03, m.tete - 0.1], [-0.03, m.capelage - 0.3]]) {
      const pts = [
        [dx, tete, m.zMat - 0.075],
        [dx, m.piedMat + 0.25, m.zMat - 0.075],
        [dx * 3, m.piedMat + 0.04, m.zMat + 0.12],
        [dx * 9, hauteurRouf(0.4, dx * 9) + 0.02, zDe(0.4)],
        [dx * 12, hauteurRouf(0.335, dx * 12) + 0.03, zDe(0.335) - 0.05],
      ];
      const courbe = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.2);
      drisses.push(new THREE.TubeGeometry(courbe, 80, 0.005, 5, false));
    }
    for (const g of drisses) {
      const d = new THREE.Mesh(g, materiau);
      d.castShadow = true;
      groupe.add(d);
    }
    bateau.groupe.add(groupe);

    this.winchs = [1, -1].map((s) => new THREE.Vector3(s * (COCKPIT.demiLargeur + 0.04), hauteurPont(0.27, COCKPIT.demiLargeur) + COCKPIT.hiloire + 0.1, zDe(0.27)));
    this.chariots = [1, -1].map((s) => new THREE.Vector3(s * 1.12, hauteurPont(0.42, 1.12) + 0.05, zDe(0.42)));
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  maj(dt) {
    const b = this.bateau;
    const r = b.reglage;
    // écoute de grand-voile : du bout de la bôme au chariot sur le rail
    const bout = new THREE.Vector3(0, -0.07, 3.45).applyAxisAngle(HAUT, r.angleBome).add(b.pivotBome.position);
    const xChariot = THREE.MathUtils.clamp(Math.sin(r.angleBome) * 1.6, -0.7, 0.7);
    const chariot = new THREE.Vector3(xChariot, hauteurPont(0.03, 0) + 0.08, zDe(0.03));
    this.brinsGV.forEach((brin, i) => {
      const e = (i - 1.5) * 0.022;
      this._a.set(bout.x + e, bout.y, bout.z);
      this._b.set(chariot.x + e, chariot.y, chariot.z);
      brin.placer(this._a, this._b);
    });

    // écoutes de foc
    const p = b.voiles.foc.positions;
    const nu = b.voiles.foc.nu;
    const pointEcoute = new THREE.Vector3(p[nu * 3], p[nu * 3 + 1], p[nu * 3 + 2]);
    const cote = r.coteFoc > 0 ? 0 : 1; // index du côté sous le vent
    const autre = 1 - cote;
    this.brinsFoc[cote].placer(pointEcoute, this.chariots[cote]);
    this.brinsFocWinch[cote].placer(this.chariots[cote], this.winchs[cote]);
    this.brinsFocWinch[autre].placer(this.chariots[autre], this.winchs[autre]);
    this.brinsFoc[autre].mesh.visible = false;
    // l'écoute au vent pend en travers du pont (recalculée 10 fois par seconde)
    this.ageMolle += dt;
    if (this.ageMolle > 0.1) {
      this.ageMolle = 0;
      const a = pointEcoute;
      const c = this.chariots[autre];
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const q = a.clone().lerp(c, t);
        q.y -= Math.sin(Math.PI * t) * 0.55; // elle pend (presque une chaînette)
        q.y = Math.max(q.y, hauteurRouf(0.5, q.x) + 0.02);
        pts.push(q);
      }
      this.molle.geometry.dispose();
      this.molle.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0065, 5, false);
    }
  }
}
