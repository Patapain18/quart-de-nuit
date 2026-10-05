// Le voilier en 3D, construit pièce par pièce à partir de sa forme (forme.js).
//
// Vocabulaire du bord (on le retrouvera dans le jeu) :
//   coque, pont, livet (le bord du pont), tableau (l'arrière plat), étrave (l'avant),
//   cockpit (où l'on barre), hiloires (les rebords du cockpit), rouf (la cabine),
//   descente (l'entrée de la cabine), mât, bôme (la barre horizontale de la grand-voile),
//   haubans (câbles qui tiennent le mât sur les côtés), étai (devant), pataras (derrière),
//   barres de flèche (qui écartent les haubans), filières et chandeliers (le garde-corps),
//   balcon (à l'avant), balcon arrière, winchs (treuils), barre franche (le « manche »
//   qui tourne le safran, le gouvernail), quille et son bulbe de plomb.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  COQUE, COCKPIT, ROUF, MAT, DESCENTE_ROUF, HUBLOTS, zDe, uDe, demiLargeur, hauteurLivet, fondCoque, pointCoque,
  hauteurPont, bordInterieur, hauteurRouf, bordsHublot, xCoteRouf,
} from './forme.js';
import { texturesTeck, texturesAntiderapant, texturesCordage } from './textures.js';

// ---------- Matériaux ----------
export function creerMateriaux() {
  const teck = texturesTeck();
  const anti = texturesAntiderapant();
  const cordage = texturesCordage();
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  const m = {
    gelcoat: std({ color: 0xf1efe9, roughness: 0.32, metalness: 0 }),
    antiderapant: std({ color: 0xeeece6, roughness: 0.62, normalMap: anti.normales, normalScale: new THREE.Vector2(0.9, 0.9) }),
    teck: std({ map: teck.couleur, normalMap: teck.normales, roughness: 0.78 }),
    verre: std({ color: 0x0d1418, roughness: 0.06, metalness: 0.1 }),
    // les vitres des hublots et le plexiglas du panneau : teintés, à moitié transparents
    vitre: std({ color: 0x1c2a30, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false }),
    alu: std({ color: 0xc4c8cc, roughness: 0.34, metalness: 0.92 }),
    inox: std({ color: 0xdfe2e5, roughness: 0.16, metalness: 1 }),
    cable: std({ color: 0x7c8186, roughness: 0.42, metalness: 0.85 }),
    noir: std({ color: 0x1b1d20, roughness: 0.5, metalness: 0.1 }),
    cordage: std({ map: cordage.couleur, normalMap: cordage.normales, roughness: 0.82 }),
    coque: std({ color: 0xffffff, roughness: 0.3, metalness: 0 }),
    plomb: std({ color: 0x2b2b2e, roughness: 0.6, metalness: 0.3 }),
  };
  // La coque : antifouling sous l'eau, liseré bleu marine à la flottaison, une fine
  // ligne de « bande de pavois » sous le livet, et la coque blanche. Les couleurs sont
  // calculées selon la hauteur, dans le shader (des limites nettes, sans texture).
  m.coque.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLocal;
uniform float uLivetArriere;
uniform float uLivetAvant;
uniform float uZArriere;
uniform float uZAvant;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float u = clamp((vLocal.z - uZArriere) / (uZAvant - uZArriere), 0.0, 1.0);
  float livet = uLivetArriere + (uLivetAvant - uLivetArriere) * pow(u, 1.8);
  float y = vLocal.y;
  vec3 blanc = vec3(0.93, 0.925, 0.91);
  vec3 marine = vec3(0.016, 0.03, 0.075);
  vec3 antifouling = vec3(0.09, 0.03, 0.025);
  vec3 c = blanc;
  c = mix(c, marine, step(y, 0.12));
  c = mix(c, antifouling, step(y, 0.035));
  // fine ligne bleue sous le livet
  c = mix(c, marine, step(livet - 0.13, y) * step(y, livet - 0.10));
  diffuseColor.rgb = c;
}`);
    Object.assign(shader.uniforms, {
      uLivetArriere: { value: COQUE.livetArriere },
      uLivetAvant: { value: COQUE.livetAvant },
      uZArriere: { value: COQUE.zArriere },
      uZAvant: { value: COQUE.zAvant },
    });
  };
  m.coque.customProgramCacheKey = () => 'coque-voilier';
  return m;
}

// ---------- Outils de géométrie ----------

// Une surface en grille : f(i, j) → { p: [x, y, z], uv: [u, v] }
function grille(nu, nv, f) {
  const positions = [];
  const uvs = [];
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const { p, uv } = f(i / nu, j / nv);
      positions.push(...p);
      uvs.push(...(uv ?? [i / nu, j / nv]));
    }
  }
  const indices = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j;
      const b = a + nv + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Le même objet de l'autre côté du bateau (bâbord) : x → -x, et l'ordre des sommets
// inversé pour que les faces restent tournées vers l'extérieur
function miroir(g) {
  const m = g.clone();
  const p = m.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
  const idx = m.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  m.computeVertexNormals();
  return m;
}
const paire = (g) => [g, miroir(g)];

// Un cylindre entre deux points (câbles, tubes, chandeliers)
function barre(a, b, rayon, segments = 8) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const longueur = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(rayon, rayon, longueur, segments, 1, false);
  g.translate(0, longueur / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.applyQuaternion(q);
  g.translate(va.x, va.y, va.z);
  g.deleteAttribute('uv');
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

// Un tube qui suit une courbe (balcons, main courante)
function tubeCourbe(points, rayon, segments = 48) {
  const courbe = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  return new THREE.TubeGeometry(courbe, segments, rayon, 8, false);
}

// Une boîte placée et orientée
function boite(l, h, p, position, rotation = [0, 0, 0]) {
  const g = new THREE.BoxGeometry(l, h, p);
  g.rotateX(rotation[0]);
  g.rotateY(rotation[1]);
  g.rotateZ(rotation[2]);
  g.translate(...position);
  return g;
}

// Un quadrilatère (4 coins dans l'ordre) avec ses coordonnées de texture
function quad(a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

// Coordonnées de texture « vues de dessus » (1 unité = 1 m), pour le teck et le pont
function uvDessus(g, echelle = 1) {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) * echelle;
    uv[i * 2 + 1] = p.getZ(i) * echelle;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Retire d'une surface les triangles dont le centre tombe dans un trou (x, z) : la grille
// doit avoir des lignes exactement sur les bords du trou
function percer(g, dansLeTrou) {
  const p = g.attributes.position;
  const idx = g.index.array;
  const garde = [];
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k];
    const b = idx[k + 1];
    const c = idx[k + 2];
    const x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3;
    const z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
    if (!dansLeTrou(x, z)) garde.push(a, b, c);
  }
  g.setIndex(garde);
  return g;
}

// Répartition non régulière des tranches : plus serrées aux deux bouts
const repartir = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

// ---------- Les pièces ----------

// Les tranches du toit du rouf : 8 jusqu'au bord avant du trou de la descente, 24 ensuite
const U_TROU_DESCENTE = uDe(zDe(ROUF.uArriere) - DESCENTE_ROUF.longueur);
const trancheToit = (i) => (i <= 8
  ? ROUF.uArriere + (U_TROU_DESCENTE - ROUF.uArriere) * (i / 8)
  : U_TROU_DESCENTE + (ROUF.uAvant - U_TROU_DESCENTE) * ((i - 8) / 24));
// Le panneau de pont (le « hublot » du toit) au-dessus de la table du carré : son
// ouverture tombe sur deux tranches du toit (25 et 21) et deux de ses colonnes (±22 cm) ;
// son cadre d'aluminium la déborde de 4 cm
const TROU_PANNEAU = { demiLargeur: 0.22, z0: zDe(trancheToit(25)), z1: zDe(trancheToit(21)) };
export const PANNEAU_PONT = {
  trou: TROU_PANNEAU,
  demiLargeur: TROU_PANNEAU.demiLargeur + 0.04,
  z0: TROU_PANNEAU.z0 - 0.04,
  z1: TROU_PANNEAU.z1 + 0.04,
};

// Une surface faite de colonnes (une par tranche u) de points [x, y] ; garder(i, j) dit
// si la case entre les colonnes i, i+1 et les rangs j, j+1 existe (pour les trous)
function surfaceColonnes(us, rangs, garder = () => true) {
  const positions = [];
  let n = 0;
  for (const u of us) {
    const r = rangs(u);
    n = r.length;
    for (const [x, y] of r) positions.push(x, y, zDe(u));
  }
  const indices = [];
  for (let i = 0; i < us.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      if (!garder(i, j)) continue;
      const a = i * n + j;
      const b = a + n;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Les tranches d'un côté du rouf : régulières, plus 16 dans chaque hublot (pour en suivre la forme)
export function tranchesCoteRouf(base) {
  const us = [...base];
  for (const [ua, ub] of HUBLOTS) for (let k = 0; k <= 16; k++) us.push(ua + ((ub - ua) * k) / 16);
  us.sort((a, b) => a - b);
  return us.filter((u, i) => i === 0 || u - us[i - 1] > 1e-6);
}
export const dansUnHublot = (u0, u1) => HUBLOTS.some(([ua, ub]) => u0 >= ua - 1e-9 && u1 <= ub + 1e-9);

function geometrieCoque() {
  const tribord = grille(90, 28, (a, b) => {
    const u = repartir(a);
    // plus de points près du fond et du livet
    const s = 0.5 - 0.5 * Math.cos(Math.PI * b);
    return { p: pointCoque(u, s), uv: [u * 9.4, s] };
  });
  // le tableau arrière, fermé par un éventail
  const points = [];
  for (let j = 0; j <= 20; j++) points.push(pointCoque(0, j / 20));
  const centre = [0, (fondCoque(0) + hauteurLivet(0)) / 2, zDe(0)];
  const positions = [...centre];
  const tour = [];
  for (const p of [...points].reverse()) tour.push([-p[0], p[1], p[2]]);
  for (const p of points) tour.push(p);
  // le haut du tableau suit le bouge du pont
  for (let k = 1; k < 10; k++) {
    const x = demiLargeur(0) * (1 - (2 * k) / 10);
    tour.push([x, hauteurPont(0, x), zDe(0)]);
  }
  for (const p of tour) positions.push(...p);
  const indices = [];
  for (let k = 0; k < tour.length; k++) indices.push(0, 1 + k, 1 + ((k + 1) % tour.length));
  const tableau = new THREE.BufferGeometry();
  tableau.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  tableau.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  tableau.setIndex(indices);
  tableau.computeVertexNormals();
  return mergeGeometries([...paire(tribord), tableau]);
}

function geometriePont() {
  const morceaux = [];
  // pont arrière (derrière le cockpit), passavants (le long du cockpit et du rouf),
  // pont avant (devant le rouf) ; chaque morceau va de son bord intérieur au livet
  const morceau = (u0, u1, nu, interieur) =>
    grille(nu, 8, (a, b) => {
      const u = u0 + (u1 - u0) * a;
      const w = demiLargeur(u);
      const xi = Math.min(interieur(u), w);
      const x = xi + (w - xi) * b;
      return { p: [x, hauteurPont(u, x), zDe(u)] };
    });
  morceaux.push(morceau(0, COCKPIT.uArriere, 3, () => 0));
  morceaux.push(morceau(COCKPIT.uArriere, ROUF.uAvant, 40, bordInterieur));
  morceaux.push(morceau(ROUF.uAvant, 1, 50, () => 0));
  return uvDessus(mergeGeometries(morceaux.flatMap(paire)), 2);
}

// Le rail de fargue : une petite lisse de teck le long du livet
function geometrieFargue() {
  const g = grille(80, 1, (a, b) => {
    const u = a * 0.985;
    const w = demiLargeur(u) - 0.015;
    return { p: [w, hauteurLivet(u) + b * 0.045, zDe(u)], uv: [zDe(u), b * 0.05] };
  });
  return paire(g);
}

function geometrieCockpit() {
  const C = COCKPIT;
  const z0 = zDe(C.uArriere);
  const z1 = zDe(C.uAvant);
  const teck = [];
  const blanc = [];
  // le plancher (caillebotis de teck) et les bancs
  teck.push(uvDessus(quad([-C.demiLargeurPuits, C.plancher, z0], [C.demiLargeurPuits, C.plancher, z0], [C.demiLargeurPuits, C.plancher, z1], [-C.demiLargeurPuits, C.plancher, z1])));
  for (const s of [1, -1]) {
    teck.push(uvDessus(quad([s * C.demiLargeurPuits, C.banc, z0], [s * C.demiLargeur, C.banc, z0], [s * C.demiLargeur, C.banc, z1], [s * C.demiLargeurPuits, C.banc, z1])));
    // devant des bancs
    blanc.push(quad([s * C.demiLargeurPuits, C.plancher, z0], [s * C.demiLargeurPuits, C.banc, z0], [s * C.demiLargeurPuits, C.banc, z1], [s * C.demiLargeurPuits, C.plancher, z1]));
    // hiloire : face intérieure, chapeau de teck, face extérieure
    const n = 24;
    const hiloire = (decalage, bas) => grille(n, 1, (a, b) => {
      const u = C.uArriere + (C.uAvant - C.uArriere) * a;
      const x = s * (C.demiLargeur + decalage);
      const haut = hauteurPont(u, C.demiLargeur) + C.hiloire;
      const y0 = bas(u);
      return { p: [x, y0 + (haut - y0) * b, zDe(u)] };
    });
    blanc.push(hiloire(0, () => C.banc));
    blanc.push(hiloire(0.07, (u) => hauteurPont(u, C.demiLargeur + 0.07)));
    teck.push(uvDessus(grille(n, 1, (a, b) => {
      const u = C.uArriere + (C.uAvant - C.uArriere) * a;
      const y = hauteurPont(u, C.demiLargeur) + C.hiloire;
      return { p: [s * (C.demiLargeur + b * 0.07), y, zDe(u)] };
    }), 3));
  }
  // paroi arrière du cockpit (jusqu'au pont arrière)
  blanc.push(quad([-C.demiLargeur, C.plancher, z0], [C.demiLargeur, C.plancher, z0], [C.demiLargeur, hauteurPont(C.uArriere, C.demiLargeur), z0], [-C.demiLargeur, hauteurPont(C.uArriere, C.demiLargeur), z0]));
  return { teck: mergeGeometries(teck), blanc: mergeGeometries(blanc) };
}

function geometrieRouf() {
  const R = ROUF;
  const cotes = [];
  // les côtés du rouf, penchés vers l'intérieur, avec un arrondi en haut, percés des
  // hublots : dans chaque tranche, le pied, le bas et le haut du hublot, puis l'arrondi
  const us = tranchesCoteRouf(Array.from({ length: 31 }, (_, i) => R.uArriere + ((R.uAvant - R.uArriere) * i) / 30));
  for (const s of [1, -1]) {
    cotes.push(surfaceColonnes(us, (u) => {
      const e = bordInterieur(u);
      const toit = hauteurRouf(u, e - R.rentree);
      const pont = hauteurPont(u, e);
      const h = HUBLOTS.find(([ua, ub]) => u >= ua - 1e-9 && u <= ub + 1e-9);
      const b = h ? bordsHublot(u, ...h) : { bas: (pont + toit) / 2 + 0.02, haut: (pont + toit) / 2 + 0.02 };
      return [
        [e, pont],
        [xCoteRouf(u, b.bas), b.bas],
        [xCoteRouf(u, b.haut), b.haut],
        [e - R.rentree * 0.85, toit - 0.035],
        [e - R.rentree * 0.95, toit - 0.008],
        [e - R.rentree, toit],
      ].map(([x, y]) => [s * x, y]);
    }, (i, j) => !(j === 1 && dansUnHublot(us[i], us[i + 1]))));
  }
  // le toit, bombé, percé du trou de la descente (à l'arrière, au milieu) : la grille a
  // des tranches et des colonnes exactement sur les bords du trou
  const D = DESCENTE_ROUF;
  const tranche = (a) => trancheToit(Math.round(a * 32));
  const colonne = (w, b) => {
    const j = Math.round(b * 16);
    if (j <= 5) return -w + (w - D.demiLargeur) * (j / 5);
    if (j <= 11) return -D.demiLargeur + 2 * D.demiLargeur * ((j - 5) / 6);
    return D.demiLargeur + (w - D.demiLargeur) * ((j - 11) / 5);
  };
  const toit = percer(grille(32, 16, (a, b) => {
    const u = tranche(a);
    const x = colonne(bordInterieur(u) - R.rentree, b);
    return { p: [x, hauteurRouf(u, x), zDe(u)] };
  }), (x, z) => (Math.abs(x) < D.demiLargeur && z > zDe(U_TROU_DESCENTE))
    || (Math.abs(x) < TROU_PANNEAU.demiLargeur && z > TROU_PANNEAU.z0 && z < TROU_PANNEAU.z1));
  // la face avant (inclinée vers l'arrière : le haut est en retrait de 12 cm)
  const avant = grille(1, 16, (a, b) => {
    const e = bordInterieur(R.uAvant);
    const w = e - R.rentree;
    const xBas = -e + 2 * e * b;
    const xHaut = -w + 2 * w * b;
    const zBas = zDe(R.uAvant);
    const zHaut = zBas + 0.12;
    return a < 0.5
      ? { p: [xBas, hauteurPont(R.uAvant, xBas), zBas] }
      : { p: [xHaut, hauteurRouf(R.uAvant, xHaut), zHaut] };
  });
  // la cloison arrière (face au cockpit), du plancher du cockpit jusqu'au toit,
  // percée de la descente
  const zc = zDe(R.uArriere);
  const e = bordInterieur(R.uArriere);
  const w = e - R.rentree;
  const forme = new THREE.Shape();
  forme.moveTo(-e, COCKPIT.plancher);
  forme.lineTo(e, COCKPIT.plancher);
  forme.lineTo(e, hauteurPont(R.uArriere, e));
  for (let k = 0; k <= 16; k++) {
    const x = w - (2 * w * k) / 16;
    forme.lineTo(x, hauteurRouf(R.uArriere, x));
  }
  forme.lineTo(-e, hauteurPont(R.uArriere, e));
  const trou = new THREE.Path();
  const largeurDescente = 0.34;
  const basDescente = D.seuil;
  trou.moveTo(-largeurDescente, basDescente);
  trou.lineTo(-largeurDescente + 0.02, hauteurRouf(R.uArriere, 0) - 0.02);
  trou.lineTo(largeurDescente - 0.02, hauteurRouf(R.uArriere, 0) - 0.02);
  trou.lineTo(largeurDescente, basDescente);
  forme.holes.push(trou);
  const cloison = new THREE.ShapeGeometry(forme, 4);
  cloison.translate(0, 0, zc);
  // les planches de la descente (en retrait de 4 cm) : du teck
  const planches = boite(largeurDescente * 2, hauteurRouf(R.uArriere, 0) - basDescente, 0.03, [0, (basDescente + hauteurRouf(R.uArriere, 0)) / 2, zc - 0.04]);
  // le capot coulissant de la descente, sur le toit : fermé, il couvre le trou (et
  // dépasse de 2 cm au-dessus de la cloison)
  const capot = boite(0.78, 0.07, 0.84, [0, hauteurRouf(R.uArriere + 0.04, 0) + 0.035, zc - 0.40]);
  // le panneau de pont, au-dessus de la table du carré : un cadre d'aluminium et un
  // plexiglas fumé, qui laisse entrer le jour dans la cabine
  const P = PANNEAU_PONT;
  const uP = uDe((P.z0 + P.z1) / 2);
  const yBasP = hauteurRouf(uP, P.demiLargeur) - 0.01;
  const yHautP = hauteurRouf(uP, 0) + 0.045;
  const hP = yHautP - yBasP;
  const yP = (yBasP + yHautP) / 2;
  const lP = P.z1 - P.z0;
  const cadre = mergeGeometries([
    boite(0.04, hP, lP, [P.demiLargeur - 0.02, yP, (P.z0 + P.z1) / 2]),
    boite(0.04, hP, lP, [-P.demiLargeur + 0.02, yP, (P.z0 + P.z1) / 2]),
    boite(P.demiLargeur * 2, hP, 0.04, [0, yP, P.z0 + 0.02]),
    boite(P.demiLargeur * 2, hP, 0.04, [0, yP, P.z1 - 0.02]),
  ]);
  const plexi = boite(P.demiLargeur * 2 - 0.03, 0.012, lP - 0.03, [0, yHautP - 0.004, (P.z0 + P.z1) / 2]);
  // les vitres des hublots : 6 mm devant les trous du rouf, teintées (on voit dehors depuis
  // la cabine, et un peu la cabine depuis dehors)
  const vitres = [];
  for (const s of [1, -1]) {
    for (const [ua, ub] of HUBLOTS) {
      vitres.push(grille(16, 1, (a, b) => {
        const u = ua + (ub - ua) * a;
        const h = bordsHublot(u, ua, ub);
        const y = b < 0.5 ? h.bas : h.haut;
        return { p: [s * (xCoteRouf(u, y) + 0.006), y, zDe(u)] };
      }));
    }
  }
  // les mains courantes en teck sur le toit
  const mains = [];
  for (const s of [1, -1]) {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const u = 0.35 + (0.58 - 0.35) * (k / 12);
      const x = s * (bordInterieur(u) - R.rentree - 0.14);
      pts.push([x, hauteurRouf(u, x) + 0.07, zDe(u)]);
    }
    mains.push(tubeCourbe(pts, 0.016, 40));
    for (const k of [0, 4, 8, 12]) {
      const p = pts[k];
      mains.push(barre([p[0], p[1] - 0.075, p[2]], p, 0.014));
    }
  }
  return {
    blanc: mergeGeometries([...cotes, avant, cloison]),
    capot,
    panneau: { cadre, plexi },
    planches: uvDessus(planches, 3),
    antiderapant: uvDessus(toit, 2),
    verre: mergeGeometries(vitres),
    teck: mergeGeometries(mains.map((g) => uvDessus(g, 3))),
  };
}

// La quille (aileron + bulbe de plomb) et le safran
function geometrieQuille() {
  const profil = (corde, epaisseur) => {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      // profil d'aile symétrique (NACA 00xx)
      const e = 5 * epaisseur * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
      pts.push([t * corde, e * corde]);
    }
    return pts;
  };
  const aileron = (zAvant, cordeHaut, cordeBas, yHaut, yBas, epaisseur, fleche) => {
    const haut = profil(cordeHaut, epaisseur);
    const bas = profil(cordeBas, epaisseur);
    const nb = haut.length;
    const g = grille(nb * 2 - 2, 1, (a, b) => {
      const k = Math.round(a * (nb * 2 - 2));
      const cote = k < nb ? 1 : -1;
      const i = k < nb ? k : nb * 2 - 2 - k;
      const ph = haut[i];
      const pb = bas[i];
      const y = yHaut + (yBas - yHaut) * b;
      const p = b < 0.5 ? ph : pb;
      return { p: [cote * p[1], y, zAvant + p[0] + (b < 0.5 ? 0 : fleche)] };
    });
    return g;
  };
  const quille = aileron(-0.75, 1.25, 0.82, -0.3, -1.55, 0.12, 0.28);
  const bulbe = new THREE.SphereGeometry(1, 24, 12);
  bulbe.scale(0.17, 0.15, 0.85);
  bulbe.translate(0, -1.6, -0.12);
  return { quille: mergeGeometries([quille, bulbe]) };
}

function geometrieSafran() {
  // centré sur la mèche (l'axe de rotation) : il tournera avec la barre
  const profil = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const e = 5 * 0.12 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
    profil.push([t, e]);
  }
  const nb = profil.length;
  const g = grille(nb * 2 - 2, 1, (a, b) => {
    const k = Math.round(a * (nb * 2 - 2));
    const cote = k < nb ? 1 : -1;
    const i = k < nb ? k : nb * 2 - 2 - k;
    const corde = 0.46 - 0.12 * b;
    const p = profil[i];
    return { p: [cote * p[1] * corde, -0.15 - 1.3 * b, -0.12 + p[0] * corde + 0.06 * b] };
  });
  return g;
}

// ---------- Le gréement ----------

function mesuresGreement() {
  const zMat = zDe(MAT.u);
  const piedMat = hauteurRouf(MAT.u, 0);
  const tete = piedMat + MAT.hauteur;
  const capelage = piedMat + MAT.hauteur * 0.92; // où l'étai et les haubans s'accrochent
  const barres = piedMat + MAT.hauteur * 0.55;
  const cadenes = [demiLargeur(MAT.u + 0.01) - 0.1, hauteurPont(MAT.u + 0.01, demiLargeur(MAT.u) - 0.1), zDe(MAT.u - 0.015)];
  const etrave = [0, hauteurLivet(1) + 0.08, zDe(1) + 0.08];
  return { zMat, piedMat, tete, capelage, barres, cadenes, etrave, vit: piedMat + MAT.hauteurBome };
}

function geometrieGreement() {
  const g = mesuresGreement();
  const mat = new THREE.CylinderGeometry(1, 1, MAT.hauteur, 20, 1);
  mat.scale(0.085, 1, 0.13);
  mat.translate(0, g.piedMat + MAT.hauteur / 2, g.zMat);
  // barres de flèche, un peu poussées vers l'arrière
  const bout = (s) => [s * 0.78, g.barres, g.zMat + 0.18];
  const barresFleche = [1, -1].map((s) => barre([0, g.barres, g.zMat], bout(s), 0.022));
  // les câbles : haubans, bas-haubans, étai, pataras
  const cables = [];
  for (const s of [1, -1]) {
    const cadene = [s * g.cadenes[0], g.cadenes[1], g.cadenes[2]];
    cables.push(barre([0, g.capelage, g.zMat], bout(s), 0.0045));
    cables.push(barre(bout(s), cadene, 0.0045));
    cables.push(barre([s * 0.05, g.barres - 0.15, g.zMat], [s * g.cadenes[0], g.cadenes[1], g.cadenes[2] - 0.35], 0.0045));
    cables.push(barre([s * 0.05, g.barres - 0.15, g.zMat], [s * g.cadenes[0], g.cadenes[1], g.cadenes[2] + 0.35], 0.0045));
  }
  cables.push(barre([0, g.capelage, g.zMat - 0.06], g.etrave, 0.005));
  cables.push(barre([0, g.tete, g.zMat + 0.06], [0, hauteurPont(0, 0) + 0.1, zDe(0) - 0.05], 0.0045));
  // tête de mât
  const tete = boite(0.12, 0.08, 0.36, [0, g.tete + 0.04, g.zMat + 0.05]);
  return { alu: mergeGeometries([mat, ...barresFleche, tete]), cable: mergeGeometries(cables), mesures: g };
}

// Les filières : chandeliers tous les ~1,9 m, deux rangs de câble, balcons avant et arrière
function geometrieFilieres() {
  const tubes = [];
  const cables = [];
  const us = [0.08, 0.27, 0.46, 0.66, 0.84];
  const hauteur = 0.62;
  const pied = (u, s) => {
    const x = s * (demiLargeur(u) - 0.07);
    return [x, hauteurPont(u, x), zDe(u)];
  };
  for (const s of [1, -1]) {
    const sommets = [];
    for (const u of us) {
      const p = pied(u, s);
      const h = [p[0] * 0.995, p[1] + hauteur, p[2]];
      tubes.push(barre(p, h, 0.012));
      sommets.push(h);
    }
    // balcon arrière : il descend vers le tableau
    const pa = pied(0.012, s);
    const coinArriere = [pa[0] * 0.92, pa[1] + hauteur + 0.05, pa[2]];
    tubes.push(barre(pa, coinArriere, 0.014));
    tubes.push(tubeCourbe([coinArriere, [coinArriere[0] * 0.98, coinArriere[1], zDe(0.05)], sommets[0]], 0.013, 16));
    // balcon avant : une boucle autour de l'étrave
    const pb = pied(0.93, s);
    tubes.push(barre(pb, [pb[0], pb[1] + hauteur, pb[2]], 0.014));
    // deux rangs de câble
    for (const f of [0.5, 1]) {
      const pts = [[coinArriere[0], coinArriere[1] - hauteur * (1 - f) - 0.05, coinArriere[2]], ...sommets.map((h) => [h[0], h[1] - hauteur * (1 - f), h[2]]), [pb[0], pb[1] + hauteur * f, pb[2]]];
      for (let k = 0; k < pts.length - 1; k++) cables.push(barre(pts[k], pts[k + 1], 0.0028, 5));
    }
  }
  // balcon avant
  const bout = [0, hauteurLivet(0.985) + 0.62, zDe(0.985)];
  const pbT = [demiLargeur(0.93) - 0.07, hauteurPont(0.93, demiLargeur(0.93)) + 0.62, zDe(0.93)];
  tubes.push(tubeCourbe([pbT, [pbT[0] * 0.55, pbT[1] + 0.02, zDe(0.965)], bout, [-pbT[0] * 0.55, pbT[1] + 0.02, zDe(0.965)], [-pbT[0], pbT[1], pbT[2]]], 0.014, 40));
  tubes.push(barre([0, hauteurLivet(0.985), zDe(0.985)], bout, 0.013));
  // balcon arrière : la traverse
  const pa = [demiLargeur(0.012) - 0.07, 0, zDe(0.012)];
  const ya = hauteurPont(0.012, pa[0]) + 0.67;
  tubes.push(tubeCourbe([[pa[0] * 0.92, ya, pa[2]], [pa[0] * 0.5, ya + 0.02, pa[2] - 0.02], [-pa[0] * 0.5, ya + 0.02, pa[2] - 0.02], [-pa[0] * 0.92, ya, pa[2]]], 0.014, 30));
  return { inox: mergeGeometries(tubes), cable: mergeGeometries(cables) };
}

// Winchs, taquets, rail d'écoute, compas, instruments
function geometrieAccastillage() {
  const inox = [];
  const noir = [];
  // un winch : une embase large, un tambour un peu creusé, un chapeau noir
  const winch = (x, y, z) => {
    const profil = [[0, 0], [0.085, 0], [0.085, 0.015], [0.062, 0.03], [0.055, 0.06], [0.058, 0.1], [0.062, 0.115]];
    const tambour = new THREE.LatheGeometry(profil.map(([r, h]) => new THREE.Vector2(r, h)), 28);
    tambour.translate(x, y, z);
    inox.push(tambour);
    const dessus = new THREE.CylinderGeometry(0.05, 0.06, 0.04, 28);
    dessus.translate(x, y + 0.135, z);
    noir.push(dessus);
  };
  const uw = 0.27;
  const yHiloire = hauteurPont(uw, COCKPIT.demiLargeur) + COCKPIT.hiloire;
  for (const s of [1, -1]) {
    winch(s * (COCKPIT.demiLargeur + 0.04), yHiloire, zDe(uw));
    winch(s * 0.55, hauteurRouf(0.335, 0.55), zDe(0.335));
    // taquets sur le pont arrière
    noir.push(boite(0.2, 0.04, 0.05, [s * 1.0, hauteurPont(0.02, 1.0) + 0.03, zDe(0.02)]));
  }
  // rail d'écoute de grand-voile, en travers du pont arrière
  const yRail = hauteurPont(0.03, 0) + 0.03;
  inox.push(boite(1.5, 0.03, 0.04, [0, yRail, zDe(0.03)]));
  noir.push(boite(0.12, 0.05, 0.08, [0, yRail + 0.035, zDe(0.03)]));
  // compas de route sur la cloison, à tribord de la descente
  const zc = zDe(ROUF.uArriere) + 0.012;
  const compas = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 32);
  compas.rotateX(Math.PI / 2);
  compas.translate(0.58, 1.05, zc + 0.02);
  noir.push(compas);
  // deux afficheurs (vent, vitesse) au-dessus de la descente, à bâbord
  noir.push(boite(0.13, 0.13, 0.03, [-0.52, 1.13, zc + 0.01]));
  noir.push(boite(0.13, 0.13, 0.03, [-0.68, 1.13, zc + 0.01]));
  return { inox: mergeGeometries(inox), noir: mergeGeometries(noir) };
}

// Les lignes de vie : deux sangles plates le long des passavants, du cockpit à l'étrave,
// où l'on accroche son harnais par gros temps (un ruban posé sur le pont)
function geometrieLignesDeVie() {
  const sangles = [];
  for (const s of [1, -1]) {
    sangles.push(grille(40, 1, (a, b) => {
      const u = 0.06 + (0.9 - 0.06) * a;
      const x = s * (Math.max(0.3, demiLargeur(u) - 0.32) + (b - 0.5) * 0.025);
      return { p: [x, hauteurPont(u, x) + 0.008, zDe(u)] };
    }));
  }
  return mergeGeometries(sangles);
}

// ---------- Assemblage ----------

export function construireBateau() {
  const materiaux = creerMateriaux();
  const groupe = new THREE.Group();
  groupe.name = 'voilier';
  const ajouter = (geometrie, materiau, nom) => {
    const m = new THREE.Mesh(geometrie, materiau);
    m.name = nom;
    m.castShadow = true;
    m.receiveShadow = true;
    groupe.add(m);
    return m;
  };

  ajouter(geometrieCoque(), materiaux.coque, 'coque');
  ajouter(geometriePont(), materiaux.antiderapant, 'pont');
  ajouter(uvDessus(mergeGeometries(geometrieFargue()), 2), materiaux.teck, 'fargue');
  const cockpit = geometrieCockpit();
  ajouter(cockpit.teck, materiaux.teck, 'cockpit-teck');
  ajouter(cockpit.blanc, materiaux.gelcoat, 'cockpit');
  const rouf = geometrieRouf();
  ajouter(rouf.blanc, materiaux.gelcoat, 'rouf');
  const capot = ajouter(rouf.capot, materiaux.gelcoat, 'capot-descente');
  const planches = ajouter(rouf.planches, materiaux.teck, 'planches-descente');
  ajouter(rouf.antiderapant, materiaux.antiderapant, 'rouf-toit');
  ajouter(rouf.verre, materiaux.vitre, 'hublots').castShadow = false;
  ajouter(rouf.panneau.cadre, materiaux.alu, 'panneau-cadre');
  ajouter(rouf.panneau.plexi, materiaux.vitre, 'panneau-plexi').castShadow = false;
  ajouter(rouf.teck, materiaux.teck, 'rouf-teck');
  ajouter(geometrieQuille().quille, materiaux.plomb, 'quille');
  const greement = geometrieGreement();
  ajouter(greement.alu, materiaux.alu, 'mat');
  ajouter(greement.cable, materiaux.cable, 'haubans');
  const filieres = geometrieFilieres();
  ajouter(filieres.inox, materiaux.inox, 'balcons');
  ajouter(filieres.cable, materiaux.cable, 'filieres');
  const acc = geometrieAccastillage();
  ajouter(acc.inox, materiaux.inox, 'winchs');
  ajouter(acc.noir, materiaux.noir, 'accastillage');
  ajouter(geometrieLignesDeVie(), new THREE.MeshStandardMaterial({ color: 0xe8c21a, roughness: 0.75 }), 'lignes-de-vie');
  // la pompe de cale à main, sur le devant du banc bâbord (un hublot de bronze et son levier)
  const pompe = new THREE.Group();
  pompe.name = 'pompe';
  const embase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), materiaux.inox);
  embase.rotation.z = Math.PI / 2;
  const levier = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), materiaux.noir);
  levier.geometry.translate(0, 0.21, 0);
  levier.position.x = 0.02;
  pompe.add(embase, levier);
  pompe.position.set(-COCKPIT.demiLargeurPuits - 0.005, COCKPIT.plancher + 0.2, zDe(0.12));
  groupe.add(pompe);

  // Les pièces mobiles : chacune dans un groupe qui tourne autour de son axe
  const m = greement.mesures;
  // la bôme pivote autour du mât (au vit-de-mulet)
  const pivotBome = new THREE.Group();
  pivotBome.position.set(0, m.vit, m.zMat + 0.07);
  pivotBome.name = 'pivot-bome';
  const bome = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, MAT.bome, 16), materiaux.alu);
  bome.geometry.scale(0.055, 1, 0.075);
  bome.geometry.rotateX(Math.PI / 2);
  bome.geometry.translate(0, 0, MAT.bome / 2);
  bome.castShadow = true;
  pivotBome.add(bome);
  groupe.add(pivotBome);

  // le safran et la barre franche tournent autour de la mèche
  const zMeche = zDe(0.065);
  const pivotSafran = new THREE.Group();
  pivotSafran.position.set(0, 0, zMeche);
  pivotSafran.name = 'pivot-safran';
  const safran = new THREE.Mesh(geometrieSafran(), materiaux.gelcoat);
  safran.castShadow = true;
  pivotSafran.add(safran);
  const yTete = COCKPIT.plancher + 0.36;
  const tete = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, yTete - COCKPIT.plancher, 16), materiaux.inox);
  tete.position.y = (yTete + COCKPIT.plancher) / 2;
  pivotSafran.add(tete);
  const barreFranche = new THREE.Mesh(tubeCourbe([[0, yTete, 0], [0, yTete + 0.05, -0.5], [0, yTete + 0.14, -1.05], [0, yTete + 0.2, -1.32]], 0.025, 24), materiaux.teck);
  uvDessus(barreFranche.geometry, 3);
  barreFranche.castShadow = true;
  pivotSafran.add(barreFranche);
  groupe.add(pivotSafran);

  const levierPompe = groupe.getObjectByName('pompe').children[1];
  return { groupe, materiaux, pivotBome, pivotSafran, mesures: m, capot, planches, levierPompe };
}
