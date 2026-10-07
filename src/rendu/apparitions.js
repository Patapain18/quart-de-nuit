// Les apparitions de la nuit (jeu/peur.js décide quand et où ; ici, ce qu'on voit) :
//  - la silhouette : quelqu'un debout sur le pont avant, en ciré jaune délavé (comme le
//    tien), la capuche rabattue, sans visage ; de dos, regardant la mer — ou, dans un
//    éclair, face à toi. Dans le noir, on ne la voit qu'à ses bandes réfléchissantes (sur
//    la capuche, la poitrine, les bras, comme sur tous les cirés de mer) : elles renvoient
//    la lumière de la frontale vers celui qui la porte, des traits argentés qui flottent
//    au bout du bateau, au bord de la vue ;
//  - le reflet : la même silhouette, dans le pare-brise de la timonerie, juste derrière toi
//    (elle est dessinée DEVANT la vitre, à l'endroit où la vitre renverrait quelqu'un qui
//    se tiendrait derrière toi : quand tu te retournes, il n'y a personne) ;
//  - la forme dans l'eau : une forme pâle, ovale, sous la surface, le long de la coque
//    (c'est la mer qui la dessine : eau.js, uForme — elle suit chaque ride) ;
//  - la chose sous la coque : c'est la mer qui la dessine (eau.js : uChose), le plancton
//    qu'elle remue en passant, une forme immense et fuselée.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TIMONERIE, zPareBrise, hauteurRouf, U_TIMONERIE } from '../bateau/forme.js';
import { teinter, preparer } from '../bateau/outils-geometrie.js';

// La silhouette (les pieds à l'origine, face vers −z), 1,78 m
function geometrieSilhouette() {
  const morceaux = [];
  // le ciré : long, jusqu'aux genoux, un peu aplati d'avant en arrière
  const profil = [[0.001, 0.4], [0.29, 0.4], [0.27, 0.62], [0.235, 0.92], [0.245, 1.16], [0.235, 1.34], [0.19, 1.45], [0.085, 1.5], [0.001, 1.5]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const cire = new THREE.LatheGeometry(profil, 18);
  cire.scale(1, 1, 0.72);
  morceaux.push(teinter(cire, 0x7a5c12));
  // les jambes, les bottes
  for (const s of [-1, 1]) {
    const jambe = new THREE.CylinderGeometry(0.068, 0.075, 0.42, 8);
    jambe.translate(s * 0.095, 0.21, 0);
    morceaux.push(teinter(jambe, 0x15171a));
  }
  // les bras, le long du corps
  for (const s of [-1, 1]) {
    const bras = new THREE.CapsuleGeometry(0.058, 0.56, 4, 8);
    bras.rotateZ(s * 0.06);
    bras.translate(s * 0.265, 1.1, 0.02);
    morceaux.push(teinter(bras, 0x6e5410));
    const main = new THREE.SphereGeometry(0.05, 8, 6);
    main.scale(0.8, 1.2, 0.6);
    main.translate(s * 0.285, 0.76, 0.02);
    morceaux.push(teinter(main, 0x2a2622));
  }
  // la tête sous la capuche : la capuche (pointue en arrière), et le trou noir du visage
  const capuche = new THREE.SphereGeometry(0.165, 16, 12);
  capuche.scale(0.92, 1.08, 1.18);
  capuche.translate(0, 1.63, 0.03);
  morceaux.push(teinter(capuche, 0x7a5c12));
  const visage = new THREE.SphereGeometry(0.11, 12, 8);
  visage.scale(0.95, 1.15, 0.5);
  visage.translate(0, 1.6, -0.135);
  morceaux.push(teinter(visage, 0x020202));
  return mergeGeometries(morceaux.map((g) => preparer(g, ['color'])));
}

// Les bandes réfléchissantes du ciré (les pieds à l'origine) : autour de la poitrine, des
// deux bras, et sur le haut de la capuche
function geometrieBandes() {
  const bandes = [];
  const poitrine = new THREE.CylinderGeometry(0.252, 0.25, 0.045, 20, 1, true);
  poitrine.scale(1, 1, 0.74);
  poitrine.translate(0, 1.2, 0);
  bandes.push(poitrine);
  for (const s of [-1, 1]) {
    const bras = new THREE.CylinderGeometry(0.063, 0.063, 0.04, 12, 1, true);
    bras.rotateZ(s * 0.06);
    bras.translate(s * 0.27, 1.16, 0.02);
    bandes.push(bras);
  }
  const capuche = new THREE.CylinderGeometry(0.13, 0.15, 0.035, 18, 1, true);
  capuche.scale(0.92, 1, 1.18);
  capuche.translate(0, 1.73, 0.03);
  bandes.push(capuche);
  return mergeGeometries(bandes.map((g) => g.toNonIndexed()));
}

// Le reflet : sombre, très transparent, les bords qui s'effacent (une vitre mouillée ne
// renvoie qu'une image floue), le visage plus noir que le reste
const SOMMET_REFLET = /* glsl */ `
attribute vec3 color;
varying vec3 vNormale;
varying vec3 vVue;
varying float vClair;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormale = normalize(normalMatrix * normal);
  vVue = normalize(-mv.xyz);
  vClair = dot(color, vec3(0.3, 0.59, 0.11));
  gl_Position = projectionMatrix * mv;
}`;
const FRAGMENT_REFLET = /* glsl */ `
uniform vec3 uCouleur;
uniform float uOpacite;
varying vec3 vNormale;
varying vec3 vVue;
varying float vClair;
void main() {
  float face = abs(dot(normalize(vNormale), normalize(vVue)));
  float a = uOpacite * smoothstep(0.08, 0.7, face) * (vClair < 0.05 ? 1.6 : 1.0);
  gl_FragColor = vec4(uCouleur * (0.35 + 1.6 * vClair), a);
}`;

export class Apparitions {
  constructor(scene, bateau, houle, eau) {
    this.bateau = bateau;
    this.houle = houle;
    this.eau = eau;
    const g = geometrieSilhouette();
    // la silhouette, sur le pont (dans le repère du bateau : elle suit ses mouvements)
    this.materiau = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, transparent: true, opacity: 1 });
    this.silhouette = new THREE.Mesh(g, this.materiau);
    this.silhouette.name = 'silhouette';
    this.silhouette.visible = false;
    this.silhouette.castShadow = false;
    bateau.groupe.add(this.silhouette);
    // (ses bandes réfléchissantes : leur éclat ne dépend que de la lumière qu'elles reçoivent
    // d'une lampe à côté de nos yeux — elles la renvoient vers nous)
    this.materiauBandes = new THREE.MeshBasicMaterial({ color: 0xd9dee2, transparent: true, opacity: 1 });
    this.bandes = new THREE.Mesh(geometrieBandes(), this.materiauBandes);
    this.bandes.name = 'silhouette-bandes';
    this.silhouette.add(this.bandes);
    this._oeil = new THREE.Vector3();
    this._axe = new THREE.Vector3();
    // son reflet, dans le pare-brise (une silhouette sans relief, de la couleur de la
    // lumière de la timonerie)
    this.uniformsReflet = { uCouleur: { value: new THREE.Color(0x3a0d08) }, uOpacite: { value: 0 } };
    this.materiauReflet = new THREE.ShaderMaterial({
      uniforms: this.uniformsReflet, vertexShader: SOMMET_REFLET, fragmentShader: FRAGMENT_REFLET,
      transparent: true, depthWrite: false,
    });
    this.reflet = new THREE.Mesh(g, this.materiauReflet);
    this.reflet.name = 'reflet';
    this.reflet.visible = false;
    this.reflet.matrixAutoUpdate = false;
    this.reflet.renderOrder = 7;
    bateau.groupe.add(this.reflet);
    // la vitre fait miroir : le plan du pare-brise (il penche vers l'arrière)
    const yPied = hauteurRouf(U_TIMONERIE, 0);
    const pente = new THREE.Vector3(0, TIMONERIE.toit - yPied, TIMONERIE.recul).normalize();
    this.normaleVitre = new THREE.Vector3(0, -pente.z, pente.y); // (vers l'intérieur)
    this.pointVitre = new THREE.Vector3(0, 1.9, zPareBrise(1.9));
    this.miroir = new THREE.Matrix4();
    const n = this.normaleVitre;
    const d = this.pointVitre.dot(n);
    // (la symétrie par rapport au plan n·p = d)
    this.miroir.set(
      1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, 2 * d * n.x,
      -2 * n.y * n.x, 1 - 2 * n.y * n.y, -2 * n.y * n.z, 2 * d * n.y,
      -2 * n.z * n.x, -2 * n.z * n.y, 1 - 2 * n.z * n.z, 2 * d * n.z,
      0, 0, 0, 1,
    );
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  // Les objets à préparer (compiler) avant la nuit
  get objets() { return [this.silhouette, this.reflet]; }

  // peur : jeu/peur.js ; temps ; eclairage ('rouge', 'blanc', 'eteint') ; ambiance (la
  // lumière du ciel, [r, g, b]) ; eclair (0 → 1) ; lampe (la frontale allumée) ;
  // faisceau : la frontale elle-même (sa position et sa cible, dans le monde)
  maj(peur, { temps = 0, eclairage = 'eteint', ambiance = [0, 0, 0], eclair = 0, lampe = false, faisceau = null } = {}) {
    const groupe = this.bateau.groupe;
    // la silhouette
    const s = peur?.silhouette;
    this.silhouette.visible = !!s && s.opacite > 0.01;
    if (this.silhouette.visible) {
      this.silhouette.position.set(s.x, s.y, s.z);
      this.silhouette.rotation.set(0, s.face, 0);
      this.materiau.opacity = s.opacite;
      this.materiau.depthWrite = s.opacite > 0.9;
      // ses bandes : dans le faisceau, elles brillent ; dans le halo autour (là où elle se
      // tient, au bord de la vue), moins ; sans lampe, à peine — sauf dans un éclair
      let renvoi = 0;
      if (lampe && faisceau) {
        this.silhouette.getWorldPosition(this._p);
        this._p.y += 1.2;
        const vers = this._v.subVectors(this._p, faisceau.position);
        const d = vers.length();
        const axe = this._axe.subVectors(faisceau.target.position, faisceau.position).normalize();
        const cos = vers.dot(axe) / Math.max(d, 1e-3);
        const cone = THREE.MathUtils.smoothstep(cos, Math.cos(1.25), Math.cos(0.5)) * 0.65 + THREE.MathUtils.smoothstep(cos, Math.cos(0.56), Math.cos(0.3)) * 0.35;
        renvoi = 0.55 * cone / (1 + d * d * 0.004);
      }
      const k = Math.min(1.2, renvoi + 0.6 * eclair + 0.004);
      this.materiauBandes.color.setRGB(0.85 * k, 0.87 * k, 0.88 * k);
      this.materiauBandes.opacity = s.opacite;
    }
    // le reflet : la silhouette debout derrière toi (face à la vitre), renvoyée par le
    // pare-brise
    const r = peur?.reflet;
    this.reflet.visible = !!r && r.opacite > 0.01;
    if (this.reflet.visible) {
      this._m.makeTranslation(r.x, r.y - 1.6, r.z);
      this.reflet.matrix.multiplyMatrices(this.miroir, this._m);
      this.reflet.matrixWorldNeedsUpdate = true;
      this.uniformsReflet.uOpacite.value = 0.13 * r.opacite;
      this.uniformsReflet.uCouleur.value.set(eclairage === 'blanc' ? 0x3a3128 : eclairage === 'rouge' ? 0x4a120a : 0x1c1c1c);
    }
    // la forme dans l'eau : le long de la coque (elle suit le bateau) ; c'est la mer qui la
    // dessine, sous sa surface
    const f = peur?.forme;
    const uf = this.eau.uniforms.uForme.value;
    if (f && f.opacite > 0.01) {
      this._p.set(f.x, 0, f.z).applyMatrix4(groupe.matrixWorld);
      // (allongée le long du bateau)
      const v = this._v.set(0, 0, -1).applyQuaternion(groupe.quaternion);
      uf.set(this._p.x, this._p.z, Math.atan2(v.z, v.x), f.opacite);
    } else uf.w = 0;
    // la chose sous la coque : c'est la mer qui la dessine
    const c = peur?.chose;
    const uc = this.eau.uniforms;
    if (c && c.force > 0) {
      this._p.set(c.x, 0, c.z).applyMatrix4(groupe.matrixWorld);
      // (sa route dans le monde : sa direction dans le repère du bateau, tournée avec lui)
      const v = this._v.set(-c.cote * Math.cos(c.angle), 0, Math.sin(c.angle)).applyQuaternion(groupe.quaternion);
      uc.uChose.value.set(this._p.x, this._p.z, Math.atan2(v.z, v.x), c.force);
    } else uc.uChose.value.w = 0;
  }
}
