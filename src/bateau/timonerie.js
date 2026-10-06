// La timonerie, vue de dehors : ses parois vitrées, son pare-brise, son toit, la porte
// coulissante vers le cockpit et les essuie-glaces.
//
// Les mesures sont dans forme.js (TIMONERIE). Les parois prolongent les côtés du rouf vers
// le haut ; chaque surface est une grille dont certaines cases sont laissées vides : ce sont
// les fenêtres, que bouchent des vitres posées juste derrière. L'intérieur (le plancher, la
// console, le siège…) est dans interieur.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TIMONERIE, ROUF, DESCENTE_ROUF, COCKPIT, U_TIMONERIE, uDe, hauteurRouf, bordInterieur, piedTimonerie,
  xParoiTimonerie, toitTimonerie, zPareBrise,
} from './forme.js';

const T = TIMONERIE;
const Z_AR = T.zArriere;
const Y_VITRE_BAS = 1.46; // le bas des vitres (un peu au-dessus du pied des parois)
const Y_VITRE_HAUT = T.vitreHaut;
// les fenêtres des côtés, en fraction de la longueur de la paroi (0 : à l'arrière, 1 : au
// pare-brise) : la fenêtre arrière, un montant, la fenêtre avant
const FENETRES_COTE = [[0.07, 0.47], [0.53, 0.93]];
// le pare-brise : trois vitres, le montant central entre les deux du milieu
const PARE_BRISE = { milieu: 0.29, montant: 0.06, bord: 0.06 };

// Une grille de points (colonnes i, rangs j) ; garder(i, j) : la case existe-t-elle ?
function grilleTrouee(ni, nj, point, garder = () => true) {
  const positions = [];
  for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) positions.push(...point(i, j));
  const indices = [];
  for (let i = 0; i < ni; i++) {
    for (let j = 0; j < nj; j++) {
      if (!garder(i, j)) continue;
      const a = i * (nj + 1) + j;
      const b = a + nj + 1;
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

// Les colonnes d'une liste de bornes : chaque intervalle découpé en n morceaux
function decouper(bornes, n = 2) {
  const res = [bornes[0]];
  for (let k = 0; k < bornes.length - 1; k++) {
    for (let m = 1; m <= n; m++) res.push(bornes[k] + ((bornes[k + 1] - bornes[k]) * m) / n);
  }
  return res;
}

// Un point de la paroi tribord (s = 1) ou bâbord (s = -1) : a de 0 (arrière) à 1 (avant),
// à la hauteur y. Le bas suit le pied de la paroi (le haut du côté du rouf).
export function pointParoi(s, a, y) {
  const zAvant = zPareBrise(y);
  const z = Z_AR + (zAvant - Z_AR) * a;
  const u = uDe(z);
  const yy = Math.max(y, piedTimonerie(u).y);
  return [s * xParoiTimonerie(u, yy), yy, z];
}

// La hauteur (y) des rangs d'une paroi : le pied, le bas et le haut des vitres, le toit
const RANGS = (yPied) => [yPied, Y_VITRE_BAS, Y_VITRE_HAUT, T.toit];

function geometrieCotes() {
  const colonnes = decouper([0, ...FENETRES_COTE.flat(), 1], 3);
  const estFenetre = (a0, a1) => FENETRES_COTE.some(([f0, f1]) => a0 >= f0 - 1e-6 && a1 <= f1 + 1e-6);
  return [1, -1].map((s) => grilleTrouee(colonnes.length - 1, 3, (i, j) => {
    const a = colonnes[i];
    const z = Z_AR + (zPareBrise(1.4) - Z_AR) * a;
    const y = RANGS(piedTimonerie(uDe(z)).y)[j];
    return pointParoi(s, a, y);
  }, (i, j) => !(j === 1 && estFenetre(colonnes[i], colonnes[i + 1]))));
}

// Le pare-brise : c de -1 (bâbord) à 1 (tribord), à la hauteur y ; son pied suit le toit
// bombé du rouf
function pointPareBrise(c, y) {
  const z = zPareBrise(y);
  const w = xParoiTimonerie(uDe(z), y);
  const x = c * w;
  const yy = Math.max(y, hauteurRouf(U_TIMONERIE, x));
  return [x, yy, zPareBrise(yy)];
}
// les bornes (en c) des trois vitres du pare-brise, à la hauteur y
function bornesPareBrise(y) {
  const w = xParoiTimonerie(uDe(zPareBrise(y)), y);
  const m = PARE_BRISE.milieu / w;
  const mt = (PARE_BRISE.milieu + PARE_BRISE.montant) / w;
  const b = 1 - PARE_BRISE.bord / w;
  return [-1, -b, -mt, -m, m, mt, b, 1];
}
function geometriePareBrise() {
  const bornes = bornesPareBrise(1.9);
  const colonnes = decouper(bornes, 2);
  const estVitre = (c0, c1) => [[bornes[1], bornes[2]], [bornes[3], bornes[4]], [bornes[5], bornes[6]]]
    .some(([v0, v1]) => c0 >= v0 - 1e-6 && c1 <= v1 + 1e-6);
  return grilleTrouee(colonnes.length - 1, 3, (i, j) => {
    const c = colonnes[i];
    const y = [hauteurRouf(U_TIMONERIE, 0) - 0.12, Y_VITRE_BAS + 0.04, Y_VITRE_HAUT, T.toit][j];
    return pointPareBrise(c, y);
  }, (i, j) => !(j === 1 && estVitre(colonnes[i], colonnes[i + 1])));
}

// Le toit : bombé, il déborde de 5 cm tout autour ; une tranche (la « joue ») fait son bord
function geometrieToit() {
  const deb = 0.05;
  const zAv = zPareBrise(T.toit) - deb;
  const zAr = Z_AR + deb;
  const toit = grilleTrouee(12, 12, (i, j) => {
    const z = zAr + (zAv - zAr) * (i / 12);
    const u = uDe(z);
    const w = xParoiTimonerie(u, T.toit) + deb;
    const x = -w + (2 * w * j) / 12;
    return [x, toitTimonerie(u, x * 0.96) + 0.02, z];
  });
  // la joue du toit : 6 cm de haut, tout le tour
  const tour = [];
  for (let k = 0; k <= 12; k++) {
    const z = zAr + (zAv - zAr) * (k / 12);
    const u = uDe(z);
    tour.push([xParoiTimonerie(u, T.toit) + deb, z]);
  }
  const contour = [
    ...tour.map(([x, z]) => [x, z]),
    ...[...tour].reverse().map(([x, z]) => [-x, z]),
  ];
  contour.push(contour[0]);
  const joue = grilleTrouee(contour.length - 1, 1, (i, j) => {
    const [x, z] = contour[i];
    const u = uDe(z);
    const y = toitTimonerie(u, x * 0.96) + 0.02;
    return [x, j === 0 ? y - 0.06 : y, z];
  });
  return mergeGeometries([toit, joue]);
}

// La paroi arrière (face au cockpit), du plancher du cockpit au toit : en bas, la cloison
// du cockpit sur toute la largeur du rouf ; au-dessus du toit du rouf, la timonerie. La
// porte au milieu, une petite fenêtre de chaque côté
const FENETRE_ARRIERE = { x0: 0.35, x1: 0.52, y0: 1.56, y1: 2.18 };
function geometrieParoiArriere() {
  const u = ROUF.uArriere;
  const e = bordInterieur(u); // (le pied du côté du rouf, sur le pont)
  const xR = e - ROUF.rentree; // (le haut du côté du rouf)
  const w = T.demiLargeur;
  const forme = new THREE.Shape();
  forme.moveTo(-e, COCKPIT.plancher);
  forme.lineTo(e, COCKPIT.plancher);
  forme.lineTo(e, 0.95);
  forme.lineTo(xR, hauteurRouf(u, xR));
  forme.lineTo(w, hauteurRouf(u, w));
  forme.lineTo(xParoiTimonerie(u, T.toit), T.toit);
  for (let k = 1; k < 12; k++) {
    const x = xParoiTimonerie(u, T.toit) * (1 - (2 * k) / 12);
    forme.lineTo(x, toitTimonerie(u, x));
  }
  forme.lineTo(-xParoiTimonerie(u, T.toit), T.toit);
  forme.lineTo(-w, hauteurRouf(u, w));
  forme.lineTo(-xR, hauteurRouf(u, xR));
  forme.lineTo(-e, 0.95);
  forme.lineTo(-e, COCKPIT.plancher);
  const trou = (x0, x1, y0, y1) => {
    const t = new THREE.Path();
    t.moveTo(x0, y0);
    t.lineTo(x1, y0);
    t.lineTo(x1, y1);
    t.lineTo(x0, y1);
    t.lineTo(x0, y0);
    return t;
  };
  const P = T.porte;
  forme.holes.push(trou(-P.demiLargeur, P.demiLargeur, DESCENTE_ROUF.seuil, P.haut));
  const F = FENETRE_ARRIERE;
  forme.holes.push(trou(F.x0, F.x1, F.y0, F.y1));
  forme.holes.push(trou(-F.x1, -F.x0, F.y0, F.y1));
  const g = new THREE.ShapeGeometry(forme, 6);
  g.translate(0, 0, T.zArriere);
  return g;
}

// Les corniches : le bord du toit du rouf qui reste de chaque côté de la timonerie (entre
// ses parois et le haut des côtés du rouf), antidérapant
export function geometrieCorniches() {
  const geos = [];
  const n = 10;
  for (const s of [1, -1]) {
    const positions = [];
    for (let i = 0; i <= n; i++) {
      const u = ROUF.uArriere + ((U_TIMONERIE - ROUF.uArriere) * i) / n;
      const z = T.zArriere + ((T.zAvant - T.zArriere) * i) / n;
      const xR = bordInterieur(u) - ROUF.rentree;
      for (let j = 0; j <= 2; j++) {
        const x = T.demiLargeur + ((xR - T.demiLargeur) * j) / 2;
        positions.push(s * x, hauteurRouf(u, x), z);
      }
    }
    const indices = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        const a = i * 3 + j;
        const b = a + 3;
        if (s > 0) indices.push(a, a + 1, b, b, a + 1, b + 1);
        else indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const uv = new Float32Array((positions.length / 3) * 2);
    for (let k = 0; k < positions.length / 3; k++) {
      uv[k * 2] = positions[k * 3] * 2;
      uv[k * 2 + 1] = positions[k * 3 + 2] * 2;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    geos.push(g);
  }
  return mergeGeometries(geos);
}

// Les vitres : un peu en retrait des trous (2 cm vers l'intérieur)
function geometrieVitres() {
  const vitres = [];
  // les côtés
  for (const s of [1, -1]) {
    for (const [f0, f1] of FENETRES_COTE) {
      vitres.push(grilleTrouee(8, 1, (i, j) => {
        const a = f0 + ((f1 - f0) * i) / 8;
        const p = pointParoi(s, a, j === 0 ? Y_VITRE_BAS : Y_VITRE_HAUT);
        return [p[0] - s * 0.02, p[1], p[2]];
      }));
    }
  }
  // le pare-brise
  const b = bornesPareBrise(1.9);
  for (const [c0, c1] of [[b[1], b[2]], [b[3], b[4]], [b[5], b[6]]]) {
    vitres.push(grilleTrouee(6, 4, (i, j) => {
      const c = c0 + ((c1 - c0) * i) / 6;
      const y = Y_VITRE_BAS + 0.04 + ((Y_VITRE_HAUT - Y_VITRE_BAS - 0.04) * j) / 4;
      const p = pointPareBrise(c, y);
      return [p[0], p[1], p[2] + 0.02];
    }));
  }
  // les fenêtres arrière
  const F = FENETRE_ARRIERE;
  for (const s of [1, -1]) {
    const g = new THREE.PlaneGeometry(F.x1 - F.x0, F.y1 - F.y0);
    g.translate(s * (F.x0 + F.x1) / 2, (F.y0 + F.y1) / 2, Z_AR - 0.02);
    vitres.push(g);
  }
  return mergeGeometries(vitres.map((g) => (g.index ? g.toNonIndexed() : g)));
}

// Les cadres des vitres : un joint noir de 2 cm autour de chaque fenêtre, vu de dehors
function geometrieJoints() {
  const joints = [];
  const bord = (points, ep = 0.02) => {
    for (let k = 0; k < points.length - 1; k++) {
      const a = new THREE.Vector3(...points[k]);
      const b = new THREE.Vector3(...points[k + 1]);
      const l = a.distanceTo(b);
      const g = new THREE.BoxGeometry(ep, ep, l);
      g.lookAt(b.clone().sub(a));
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      joints.push(g);
    }
  };
  for (const s of [1, -1]) {
    for (const [f0, f1] of FENETRES_COTE) {
      const pts = [];
      for (let k = 0; k <= 6; k++) pts.push(pointParoi(s, f0 + ((f1 - f0) * k) / 6, Y_VITRE_HAUT));
      for (let k = 6; k >= 0; k--) pts.push(pointParoi(s, f0 + ((f1 - f0) * k) / 6, Y_VITRE_BAS));
      pts.push(pts[0]);
      bord(pts);
    }
  }
  const b = bornesPareBrise(1.9);
  for (const [c0, c1] of [[b[1], b[2]], [b[3], b[4]], [b[5], b[6]]]) {
    const yb = Y_VITRE_BAS + 0.04;
    bord([pointPareBrise(c0, yb), pointPareBrise(c1, yb), pointPareBrise(c1, Y_VITRE_HAUT), pointPareBrise(c0, Y_VITRE_HAUT), pointPareBrise(c0, yb)]);
  }
  return mergeGeometries(joints);
}

// Les mains courantes : sur le toit, de chaque côté, et de part et d'autre de la porte
function geometrieMainsCourantes() {
  const tubes = [];
  const tube = (pts, r = 0.016) => {
    const courbe = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    tubes.push(new THREE.TubeGeometry(courbe, 24, r, 8, false));
  };
  for (const s of [1, -1]) {
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const z = Z_AR - 0.12 - ((Z_AR - 0.12 - (zPareBrise(T.toit) + 0.12)) * k) / 8;
      const u = uDe(z);
      const x = s * (xParoiTimonerie(u, T.toit) - 0.1);
      pts.push([x, toitTimonerie(u, x) + 0.09, z]);
    }
    tube(pts);
    for (const k of [0, 4, 8]) {
      const p = pts[k];
      tubes.push(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 8).translate(p[0], p[1] - 0.035, p[2]));
    }
    // à côté de la porte, dehors : une poignée verticale
    const x = s * (T.porte.demiLargeur + 0.07);
    tube([[x, 1.05, Z_AR + 0.06], [x, 1.1, Z_AR + 0.07], [x, 1.85, Z_AR + 0.07], [x, 1.9, Z_AR + 0.06]], 0.015);
  }
  return mergeGeometries(tubes);
}

// La porte : deux battants (gelcoat, une vitre en haut), qui coulissent à l'intérieur,
// contre la paroi, chacun de son côté. Le groupe garde ses deux battants : gauche, droite.
function creerPorte(materiaux) {
  const P = T.porte;
  const groupe = new THREE.Group();
  groupe.name = 'porte-timonerie';
  const l = P.demiLargeur + 0.015;
  const h = P.haut - DESCENTE_ROUF.seuil + 0.03;
  const battants = [-1, 1].map((cote) => {
    const b = new THREE.Group();
    const forme = new THREE.Shape();
    forme.moveTo(0, 0);
    forme.lineTo(l, 0);
    forme.lineTo(l, h);
    forme.lineTo(0, h);
    forme.lineTo(0, 0);
    const trou = new THREE.Path();
    trou.moveTo(0.06, h * 0.52);
    trou.lineTo(l - 0.06, h * 0.52);
    trou.lineTo(l - 0.06, h - 0.08);
    trou.lineTo(0.06, h - 0.08);
    trou.lineTo(0.06, h * 0.52);
    forme.holes.push(trou);
    const panneau = new THREE.Mesh(new THREE.ExtrudeGeometry(forme, { depth: 0.025, bevelEnabled: false }), materiaux.gelcoat);
    panneau.castShadow = true;
    panneau.receiveShadow = true;
    const vitre = new THREE.Mesh(new THREE.PlaneGeometry(l - 0.12, h * 0.48 - 0.08), materiaux.vitreTimonerie);
    vitre.position.set(l / 2, h * 0.52 + (h * 0.48 - 0.08) / 2, 0.0125);
    const poignee = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.03), materiaux.inox);
    poignee.position.set(cote > 0 ? 0.05 : l - 0.05, 0.75, 0.04);
    b.add(panneau, vitre, poignee);
    // (fermé : le battant gauche de -l à 0, le droit de 0 à l, derrière l'ouverture, à
    // l'intérieur ; le droit un peu plus en avant, pour croiser le gauche en coulissant)
    b.position.set(cote > 0 ? 0 : -l, DESCENTE_ROUF.seuil - 0.01, T.zArriere - 0.065 - (cote > 0 ? 0.03 : 0));
    groupe.add(b);
    return b;
  });
  groupe.userData.battants = battants;
  return groupe;
}

// Les essuie-glaces des trois vitres du pare-brise : chacun tourne autour d'un axe au coin
// bas de sa vitre (côté axe du bateau pour les vitres de côté), couché le long du bas de la
// vitre au repos, et balaye jusqu'à la verticale (un quart de cercle, dans la vitre)
function creerEssuieGlaces(materiaux) {
  const b = bornesPareBrise(1.9);
  const liste = [];
  // [bord gauche, bord droit, côté de l'axe (0 : gauche, 1 : droite)]
  const vitres = [[b[1], b[2], 1], [b[3], b[4], 0], [b[5], b[6], 0]];
  for (const [c0, c1, coin] of vitres) {
    const yb = Y_VITRE_BAS + 0.07;
    const gauche = new THREE.Vector3(...pointPareBrise(c0, yb));
    const droite = new THREE.Vector3(...pointPareBrise(c1, yb));
    const haut = new THREE.Vector3(...pointPareBrise((c0 + c1) / 2, Y_VITRE_HAUT - 0.05));
    const largeur = gauche.distanceTo(droite);
    const hauteur = haut.distanceTo(new THREE.Vector3(...pointPareBrise((c0 + c1) / 2, yb)));
    const longueur = Math.min(largeur, hauteur) - 0.08;
    const axe = (coin === 0 ? gauche : droite).clone();
    axe.x += coin === 0 ? 0.04 : -0.04;
    // (le sens du balayage : vers l'autre bord de la vitre)
    const sens = coin === 0 ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.name = 'essuie-glace';
    pivot.position.copy(axe).add(new THREE.Vector3(0, 0, -0.02));
    // (le plan du pare-brise : il penche vers l'arrière)
    pivot.rotation.x = Math.atan2(haut.z - axe.z, haut.y - axe.y);
    const bras = new THREE.Mesh(new THREE.BoxGeometry(0.01, longueur, 0.01), materiaux.noir);
    bras.position.y = longueur / 2;
    const balai = new THREE.Mesh(new THREE.BoxGeometry(0.016, longueur * 0.8, 0.016), materiaux.noir);
    balai.position.set(0, longueur * 0.58, -0.006);
    const balancier = new THREE.Group();
    balancier.add(bras, balai);
    pivot.add(balancier);
    // repos : couché le long du bas de la vitre (vers l'autre bord)
    const repos = sens * -Math.PI / 2 * 0.97;
    balancier.rotation.z = repos;
    liste.push({ pivot, balancier, longueur, repos });
  }
  return liste;
}

export function construireTimonerie(materiaux) {
  return {
    blanc: mergeGeometries([...geometrieCotes(), geometriePareBrise(), geometrieToit(), geometrieParoiArriere()].map((g) => (g.index ? g.toNonIndexed() : g))),
    verre: geometrieVitres(),
    joints: geometrieJoints(),
    mains: geometrieMainsCourantes(),
    porte: creerPorte(materiaux),
    essuieGlaces: creerEssuieGlaces(materiaux),
  };
}

export { FENETRES_COTE, FENETRE_ARRIERE, PARE_BRISE, Y_VITRE_BAS, Y_VITRE_HAUT, bornesPareBrise, pointPareBrise };
export { geometrieParoiArriere };
export const LARGEUR_BATTANT = T.porte.demiLargeur + 0.015;
