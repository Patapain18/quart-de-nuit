// Les éclairs à l'écran : le trait de foudre (monde/foudre.js dit par où il passe).
//
// Un trait tortueux, qui sort de la base du nuage et descend jusqu'à la mer (ou jusqu'au
// mât), avec ses branches ; ou qui court sous la base des nuages, en araignée, en poussant
// ses branches devant lui pendant un quart de seconde. On ne le voit que le temps de ses
// éclats : le premier montre toutes ses branches, les suivants seulement le tronc (ils
// repassent par le même chemin) ; entre deux, le trait reste un instant lumineux. Dans le
// nuage, on ne le voit plus (c'est le nuage qui s'allume : rendu/glsl/nuages.js) ; au loin,
// la brume et la pluie l'effacent — derrière un rideau de pluie, il n'en reste qu'une
// lueur. Plus il est près, plus il est épais. Le halo de l'image (post.js) lui donne sa
// lueur.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { DENSITE_PLUIE } from './grains.js';

function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un trait tortueux de a vers b : une marche au hasard qui garde le cap sur b (de plus en
// plus à mesure qu'elle approche), chaque pas dévié au hasard (un vrai éclair change de
// direction tous les quelques dizaines de mètres) ; des branches en partent, de côté et en
// descendant, et leurs propres petites branches. Chaque morceau : { p, q (ses deux bouts),
// e0, e1 (son éclat à chaque bout), chemin (m parcourus depuis le départ), tronc }.
// o : { pas (m), ecart (la tortuosité), branches (la chance d'une branche à chaque pas),
//       eclat, eclatFin, chemin, niveau (0 : le tronc), horizontal (en araignée),
//       plancher (m : les branches s'arrêtent en l'air, au-dessus de cette hauteur) }
function trait(hasard, a, b, o, sortie) {
  const L = a.distanceTo(b);
  const n = Math.max(4, Math.round(L / o.pas));
  const p = a.clone();
  const dir = b.clone().sub(a).normalize();
  const vers = new THREE.Vector3();
  const alea = new THREE.Vector3();
  let parcouru = o.chemin;
  for (let i = 0; i < n; i++) {
    const reste = n - i;
    let q;
    if (reste === 1) q = b.clone();
    else {
      vers.copy(b).sub(p);
      const d = vers.length();
      vers.divideScalar(d);
      // (un écart au hasard, dans toutes les directions ; en araignée, presque à plat)
      alea.set(hasard() * 2 - 1, (hasard() * 2 - 1) * (o.horizontal ? 0.25 : 1), hasard() * 2 - 1);
      const w = 1 + 2.5 * (i / n) ** 2;
      dir.multiplyScalar(0.35).addScaledVector(vers, w).addScaledVector(alea, o.ecart).normalize();
      q = p.clone().addScaledVector(dir, (d / reste) * (0.6 + 0.8 * hasard()));
    }
    const e0 = o.eclat + (o.eclatFin - o.eclat) * (i / n);
    const e1 = o.eclat + (o.eclatFin - o.eclat) * ((i + 1) / n);
    sortie.push({ p: p.clone(), q, e0, e1, chemin: parcouru, tronc: o.niveau === 0 });
    parcouru += p.distanceTo(q);
    // une branche (plus souvent en haut, là où l'éclair a tâtonné en descendant)
    if (o.niveau < 2 && i > 1 && i < n - 2 && hasard() < o.branches * (1 - 0.6 * (i / n))) {
      const longueur = L * (o.niveau === 0 ? 0.12 + 0.3 * hasard() : 0.3 + 0.4 * hasard());
      const cote = new THREE.Vector3(hasard() * 2 - 1, 0, hasard() * 2 - 1);
      cote.addScaledVector(dir, -cote.dot(dir)).normalize();
      const d = dir.clone().addScaledVector(cote, 0.7 + 0.8 * hasard());
      d.y -= o.horizontal ? 0.05 : 0.3;
      d.normalize();
      const fin = q.clone().addScaledVector(d, longueur);
      if (o.plancher !== undefined) fin.y = Math.max(fin.y, o.plancher + hasard() * (q.y - o.plancher) * 0.3);
      trait(hasard, q, fin, {
        ...o, niveau: o.niveau + 1, pas: o.pas * 0.8, branches: o.branches * 0.6,
        eclat: e1 * (o.niveau === 0 ? 0.55 : 0.5), eclatFin: 0.04, chemin: parcouru,
      }, sortie);
    }
    p.copy(q);
  }
}

// Le détail : un vrai éclair est tortueux à toutes les échelles — vu de près, chaque
// morceau droit se révèle lui-même brisé. On coupe chaque morceau en deux, et l'on décale son
// milieu au hasard, de côté (de moins en moins à chaque fois) ; les bouts ne bougent pas :
// les branches restent accrochées au tronc.
function detailler(morceaux, hasard, { niveaux, ecart = 0.16, horizontal = false }) {
  let liste = morceaux;
  let k = ecart;
  for (let n = 0; n < niveaux; n++) {
    const suivante = [];
    for (const m of liste) {
      const d = m.q.clone().sub(m.p);
      const L = d.length();
      if (L < 1.5) {
        suivante.push(m);
        continue;
      }
      d.divideScalar(L);
      const cote = new THREE.Vector3(hasard() * 2 - 1, (hasard() * 2 - 1) * (horizontal ? 0.3 : 1), hasard() * 2 - 1);
      cote.addScaledVector(d, -cote.dot(d));
      const milieu = m.p.clone().lerp(m.q, 0.5).addScaledVector(cote, L * k * (0.4 + 0.6 * hasard()));
      const em = (m.e0 + m.e1) / 2;
      const l1 = m.p.distanceTo(milieu);
      suivante.push({ ...m, q: milieu, e1: em });
      suivante.push({ ...m, p: milieu, e0: em, chemin: m.chemin + l1 });
    }
    liste = suivante;
    k *= 0.6;
  }
  return liste;
}

// Le chemin d'un éclair, selon sa sorte (monde/foudre.js) : la liste de ses morceaux, triés
// dans l'ordre où il les parcourt (pour l'araignée, qui court)
export function cheminEclair(e, { mat = null } = {}) {
  const hasard = generateur(e.graine);
  const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
  const morceaux = [];
  // (la foudre sur le mât : le trait finit en tête de mât, là où il est vraiment)
  const bas = e.bas ? (e.surLeMat && mat ? mat.clone() : V(e.bas)) : null;
  if (e.type === 'mer') {
    const L = V(e.haut).distanceTo(bas);
    trait(hasard, V(e.haut), bas, { pas: L / 60, ecart: 0.9, branches: 0.12, eclat: 1, eclatFin: 1, chemin: 0, niveau: 0, plancher: bas.y + 0.3 * (e.haut.y - bas.y) }, morceaux);
  } else if (e.type === 'araignee') {
    const L = V(e.haut).distanceTo(V(e.bout));
    trait(hasard, V(e.haut), V(e.bout), { pas: L / 90, ecart: 0.7, branches: 0.2, eclat: 0.75, eclatFin: 0.4, chemin: 0, niveau: 0, horizontal: true, plancher: e.haut.y - 350 }, morceaux);
    if (bas) {
      const chemin = morceaux.reduce((m, x) => Math.max(m, x.chemin), 0);
      const L2 = V(e.bout).distanceTo(bas);
      trait(hasard, V(e.bout), bas, { pas: L2 / 50, ecart: 0.9, branches: 0.1, eclat: 1, eclatFin: 1, chemin, niveau: 0, plancher: bas.y + 0.3 * (e.bout.y - bas.y) }, morceaux);
    }
  }
  // (le tronc, plus finement que les branches)
  const fins = detailler(morceaux.filter((m) => m.tronc), hasard, { niveaux: 3, horizontal: e.type === 'araignee' })
    .concat(detailler(morceaux.filter((m) => !m.tronc), hasard, { niveaux: 2, horizontal: e.type === 'araignee' }));
  fins.sort((x, y) => x.chemin - y.chemin);
  return fins;
}

export class EclairsRendu {
  constructor() {
    const materiau = (largeur) => new LineMaterial({
      color: 0xffffff, linewidth: largeur, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.materiauTronc = materiau(3.2);
    this.materiauBranches = materiau(1.4);
    this.tronc = new LineSegments2(new LineSegmentsGeometry(), this.materiauTronc);
    this.branches = new LineSegments2(new LineSegmentsGeometry(), this.materiauBranches);
    this.groupe = new THREE.Group();
    this.groupe.add(this.tronc, this.branches);
    for (const l of [this.tronc, this.branches]) {
      l.frustumCulled = false;
      l.renderOrder = 5;
    }
    // (un trait de rien, invisible : de quoi préparer les shaders avant le premier éclair)
    for (const l of [this.tronc, this.branches]) l.geometry = new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 1, 0]).setColors([0, 0, 0, 0, 0, 0]);
    this.groupe.visible = false;
    this.id = null;
    this.morceaux = { tronc: [], branches: [] };
    this.presDeNous = 1000;
    this.longueur = 1;
  }

  // Le trait d'un nouvel éclair, une fois pour toutes : ses morceaux, et l'éclat de chacun
  // vu d'ici (effacé dans le nuage, par la brume et par la pluie entre lui et nous).
  // o : { camera, base (m : la base des nuages), brume (par m, celle de la mer), grains
  //       (monde/grains.js, ou null), mat (la tête de mât dans le monde) }
  fabriquer(e, { camera, base, brume = 0, grains = null, mat = null }) {
    const morceaux = cheminEclair(e, { mat });
    const c = camera.position;
    const lumiere = (p) => {
      // dans le nuage, on ne voit plus le trait
      const dehors = 1 - THREE.MathUtils.smoothstep(p.y, base - 30, base + 120);
      if (dehors <= 0) return 0;
      // la brume, et la pluie traversée entre lui et nous (les grains : six relevés le long
      // du regard)
      const d = p.distanceTo(c);
      let tau = d * brume * 0.7;
      if (grains) {
        let somme = 0;
        for (let i = 0; i < 6; i++) {
          const s = (i + 0.5) / 6;
          somme += grains.pluieDesGrains(c.x + (p.x - c.x) * s, c.z + (p.z - c.z) * s);
        }
        tau += DENSITE_PLUIE * somme * (d / 6);
      }
      return dehors * Math.exp(-tau);
    };
    const tronc = morceaux.filter((m) => m.tronc);
    const branches = morceaux.filter((m) => !m.tronc);
    let presDeNous = Infinity;
    const remplir = (liste, objet) => {
      const positions = new Float32Array(Math.max(1, liste.length) * 6);
      const couleurs = new Float32Array(Math.max(1, liste.length) * 6);
      liste.forEach((m, i) => {
        positions.set([m.p.x, m.p.y, m.p.z, m.q.x, m.q.y, m.q.z], i * 6);
        const a = m.e0 * lumiere(m.p);
        const b = m.e1 * lumiere(m.q);
        couleurs.set([a, a, a, b, b, b], i * 6);
        if (m.tronc && a > 0.05) presDeNous = Math.min(presDeNous, m.p.distanceTo(c));
      });
      objet.geometry.dispose();
      objet.geometry = new LineSegmentsGeometry().setPositions(positions).setColors(couleurs);
      objet.geometry.instanceCount = liste.length;
    };
    remplir(tronc, this.tronc);
    remplir(branches, this.branches);
    this.morceaux = { tronc, branches };
    this.presDeNous = Number.isFinite(presDeNous) ? presDeNous : 5000;
    this.longueur = morceaux.reduce((m, x) => Math.max(m, x.chemin), 1);
    this.id = e.id;
  }

  // e : l'éclair à dessiner (ou null) ; trait : l'éclat de son trait (0 → ~1,5) ; eclat :
  // l'éclat en cours (0 : le premier) ; age : depuis son premier éclat (s) ; o : comme pour
  // fabriquer, et resolution (la taille de l'image)
  maj(e, { trait = 0, eclat = 0, age = 0, resolution, ...o }) {
    if (!e || !e.visible || trait < 0.01) {
      this.groupe.visible = false;
      return;
    }
    if (this.id !== e.id) this.fabriquer(e, o);
    this.groupe.visible = true;
    // (plus il est près, plus il est épais : quelques pixels au loin, une dizaine tout près)
    const largeur = THREE.MathUtils.clamp(2600 / this.presDeNous, 1.6, 9);
    this.materiauTronc.linewidth = largeur;
    this.materiauBranches.linewidth = Math.max(1.1, largeur * 0.45);
    const k = Math.min(1.5, trait) * 60;
    this.materiauTronc.color.setRGB(0.85 * k, 0.88 * k, k);
    // (les éclats suivants repassent par le tronc seulement)
    const kb = eclat === 0 ? k : k * 0.08;
    this.materiauBranches.color.setRGB(0.6 * kb, 0.63 * kb, 0.72 * kb);
    // l'araignée court : ses morceaux apparaissent dans l'ordre où elle les parcourt
    if (e.type === 'araignee' && eclat === 0) {
      const jusqua = this.longueur * Math.min(1, age / 0.25);
      this.tronc.geometry.instanceCount = compter(this.morceaux.tronc, jusqua);
      this.branches.geometry.instanceCount = compter(this.morceaux.branches, jusqua);
    } else {
      this.tronc.geometry.instanceCount = this.morceaux.tronc.length;
      this.branches.geometry.instanceCount = this.morceaux.branches.length;
    }
    this.materiauTronc.resolution.copy(resolution);
    this.materiauBranches.resolution.copy(resolution);
  }
}

// (combien de morceaux, triés, commencent avant « jusqua »)
function compter(morceaux, jusqua) {
  let n = 0;
  while (n < morceaux.length && morceaux[n].chemin <= jusqua) n++;
  return n;
}
