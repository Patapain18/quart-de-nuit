// L'intérieur de la timonerie.
//
// En entrant du cockpit (par la porte à deux battants), ou en montant de la cabine :
//  - un plancher de teck et houx, surélevé (au niveau du seuil du cockpit), percé à l'avant
//    bâbord de la trémie de l'escalier : trois marches descendent au carré ;
//  - en bas, l'intérieur garde toute la largeur du rouf : des étagères courent sous les
//    corniches (le bord du toit du rouf, de chaque côté de la timonerie, plus étroite) ;
//  - au centre et à tribord, sous le pare-brise, la console : un pupitre incliné vers le
//    siège de quart, avec l'écran du radar, le traceur de cartes, la commande du pilote et
//    le compas ; au plafond, devant, les répétiteurs (vitesse, vent) ; sur la paroi
//    tribord, le baromètre et la pendule, la VHF à portée de main du siège ; le tableau
//    électrique est sur le pupitre (tableau-electrique.js), à portée de main, assis ou debout ;
//  - à bâbord, derrière l'escalier, le coin cuisine (un réchaud sur cardan, l'évier, la
//    bouilloire) et l'extincteur.
// Les parois sont lambrissées sous les vitres ; le plafond est le dessous du toit.
// (Les mesures de la timonerie elle-même sont dans forme.js ; ses parois vues de dehors,
// dans timonerie.js ; la trémie et les marches, dans joueur/pont.js.)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TIMONERIE, ROUF, U_TIMONERIE, uDe, bordInterieur, hauteurRouf, xParoiTimonerie, toitTimonerie, zPareBrise,
} from './forme.js';
import {
  FENETRES_COTE, FENETRE_ARRIERE, Y_VITRE_BAS, Y_VITRE_HAUT, pointParoi, bornesPareBrise, pointPareBrise,
} from './timonerie.js';
import { boite, entre, uvBois, teinter } from './outils-geometrie.js';
import { TREMIE, MARCHES_TIMONERIE } from '../joueur/pont.js';

const T = TIMONERIE;
const Y = T.plancher;
const EP_PAROI = 0.035; // le lambris est 3,5 cm à l'intérieur des parois
const Z_AR = T.zArriere - EP_PAROI; // la face intérieure de la paroi arrière
const Y_CARRE = -0.3;

// La console (au centre et à tribord, sous le pare-brise) : le meuble bas (large : il passe
// sous la corniche), et le pupitre incliné (son bas et son haut : [y, z]) tourné vers le siège
export const CONSOLE = {
  x0: -0.03, x1: 0.53, xBas: 0.72, z0: 0.27, z1: 0.6, haut: 1.15, pupitre: { bas: [1.15, 0.6], haut: [1.45, 0.36] },
};
// (le siège est à tribord de l'axe : de la porte, on entre tout droit en le laissant à sa
// droite, entre lui et la cuisine)
export const SIEGE = { x: 0.36, z: 1.0, assise: 0.95, demiLargeur: 0.19 };
// (un palier de 20 cm entre le haut de l'escalier et la cuisine : on y tourne vers la porte)
// (et 7 cm devant la paroi arrière : le battant de la porte y coulisse)
export const CUISINE = { x0: -0.76, x1: -0.38, z0: 1.05, z1: 1.36, haut: 1.28 };
// Les yeux du marin assis au poste (sur le siège, face au pare-brise)
export const YEUX_POSTE = new THREE.Vector3(SIEGE.x, SIEGE.assise + 0.8, SIEGE.z + 0.02);

// Le profil intérieur tribord dans la tranche u, en bas (sous les corniches) : la paroi
// verticale jusqu'au pont, le côté du rouf, puis le dessous de la corniche jusqu'au pied
// de la timonerie. Renvoie les 4 points [x, y].
function profilBas(u) {
  const xBas = bordInterieur(u) - 0.05;
  const xR = bordInterieur(u) - ROUF.rentree - EP_PAROI;
  const xT = T.demiLargeur - EP_PAROI;
  return [[xBas, Y], [xBas, 0.95], [xR, hauteurRouf(u, xR) - 0.05], [xT, hauteurRouf(u, T.demiLargeur) - 0.05]];
}
// La paroi intérieure (le lambris) à la hauteur y de la tranche u, en bas
export const xLambris = (u, y) => {
  const [p0, p1, p2] = profilBas(u);
  if (y <= p1[1]) return p0[0];
  return p1[0] + (p2[0] - p1[0]) * Math.min(1, (y - p1[1]) / (p2[1] - p1[1]));
};
// Le haut de la paroi intérieure (au-dessus des corniches), à la hauteur y
const xHaut = (u, y) => xParoiTimonerie(u, y) - EP_PAROI;

// Un point du pupitre : x, et t de 0 (en bas) à 1 (en haut), décalé de « recul » vers le
// siège. Renvoie la position et l'orientation (l'axe +z du repère : tourné vers le siège)
const P = CONSOLE.pupitre;
const NORMALE_PUPITRE = new THREE.Vector3(0, -(P.haut[1] - P.bas[1]), P.haut[0] - P.bas[0]).normalize();
// (le vecteur le long du pupitre, vers le haut)
const PENTE_PUPITRE = new THREE.Vector3(0, P.haut[0] - P.bas[0], P.haut[1] - P.bas[1]).normalize();
export function surPupitre(x, t, recul = 0.012) {
  const y = P.bas[0] + (P.haut[0] - P.bas[0]) * t;
  const z = P.bas[1] + (P.haut[1] - P.bas[1]) * t;
  const position = new THREE.Vector3(x, y, z).addScaledVector(NORMALE_PUPITRE, recul);
  // repère : x vers tribord, y le long de la pente, z la normale
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), PENTE_PUPITRE, NORMALE_PUPITRE);
  return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(m) };
}
// Pose un objet sur le pupitre
export function poserSurPupitre(objet, x, t, recul) {
  const { position, quaternion } = surPupitre(x, t, recul);
  objet.position.copy(position);
  objet.quaternion.copy(quaternion);
  return objet;
}

// La console du plafond : un caisson pendu devant, au-dessus du pare-brise, sa face tournée
// vers le siège (vers le bas et l'arrière) ; on y pose les répétiteurs
export const PLAFONNIER = { x0: -0.02, x1: 0.42, centre: new THREE.Vector3(0.2, 2.2, 0.58), inclinaison: 0.75 };
export function surPlafonnier(x, recul = 0.012) {
  // (tourné de l'inclinaison autour de l'axe x : sa face regarde vers le bas et l'arrière)
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PLAFONNIER.inclinaison);
  const normale = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const position = PLAFONNIER.centre.clone().setX(x).addScaledVector(normale, 0.06 + recul);
  return { position, quaternion: q };
}

// ---------- Les surfaces ----------

// Le plancher : de la paroi arrière au pied du pare-brise, d'un côté du rouf à l'autre,
// percé de la trémie (à bâbord)
function geometriePlancher() {
  const forme = new THREE.Shape();
  const n = 8;
  const bord = (z) => bordInterieur(uDe(z)) - 0.05;
  const zAv = T.zAvant;
  // (le contour, vu de dessus : x, -z)
  forme.moveTo(TREMIE.x1, -zAv);
  forme.lineTo(bord(zAv), -zAv);
  for (let k = 1; k <= n; k++) {
    const z = zAv + ((Z_AR - zAv) * k) / n;
    forme.lineTo(bord(z), -z);
  }
  for (let k = n; k >= 0; k--) {
    const z = zAv + ((Z_AR - zAv) * k) / n;
    forme.lineTo(-bord(z), -z);
  }
  forme.lineTo(TREMIE.x0, -zAv);
  forme.lineTo(TREMIE.x0, -TREMIE.z1);
  forme.lineTo(TREMIE.x1, -TREMIE.z1);
  forme.lineTo(TREMIE.x1, -zAv);
  const g = new THREE.ShapeGeometry(forme);
  g.rotateX(-Math.PI / 2); // (x, -z) → (x, 0, z)
  g.translate(0, Y, 0);
  return g;
}

// Une surface entre des colonnes de points (une colonne par tranche) : cases(i, j) dit si
// la case existe
function surfaceTranches(colonnes, cases = () => true) {
  const positions = [];
  for (let i = 0; i < colonnes.length - 1; i++) {
    for (let j = 0; j < colonnes[i].length - 1; j++) {
      if (!cases(i, j)) continue;
      const a = colonnes[i][j], b = colonnes[i + 1][j], c = colonnes[i + 1][j + 1], d = colonnes[i][j + 1];
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return uvBois(g);
}

// Le lambris d'un côté (s = 1 tribord, -1 bâbord) : en bas, la paroi, le côté du rouf et le
// dessous de la corniche ; en haut, la face intérieure de la paroi vitrée, percée des fenêtres
function geometrieLambris(s) {
  const geos = [];
  const nz = 10;
  const colonnesBas = [];
  for (let i = 0; i <= nz; i++) {
    const z = Z_AR + ((T.zAvant + 0.02 - Z_AR) * i) / nz;
    colonnesBas.push(profilBas(uDe(z)).map(([x, y]) => [s * x, y, z]));
  }
  geos.push(surfaceTranches(colonnesBas));
  // le haut
  const bornes = [0, 0.035, ...FENETRES_COTE.flat(), 0.965, 1];
  bornes.sort((a, b) => a - b);
  const estFenetre = (a0, a1) => FENETRES_COTE.some(([f0, f1]) => a0 >= f0 - 1e-6 && a1 <= f1 + 1e-6);
  const colonnesHaut = bornes.map((a) => {
    const z0 = T.zArriere + (zPareBrise(1.4) - T.zArriere) * a;
    return [hauteurRouf(uDe(z0), T.demiLargeur) - 0.05, Y_VITRE_BAS, Y_VITRE_HAUT, T.toit - 0.05].map((y, j) => {
      const z = j === 0 ? z0 : pointParoi(s, a, y)[2];
      return [s * xHaut(uDe(z), y), y, a === 0 ? Z_AR : z];
    });
  });
  geos.push(surfaceTranches(colonnesHaut, (i, j) => !(j === 1 && estFenetre(bornes[i], bornes[i + 1]))));
  return mergeGeometries(geos);
}

// Les étagères sous les corniches : une planche et son rebord (le « violon »), et quelques
// objets dessus (des livres à tribord, une lampe torche et des jumelles à bâbord)
function geometrieEtageres(s, boisGeos, objets) {
  const yEtagere = (z) => {
    const [, , p2, p3] = profilBas(uDe(z));
    return Math.min(p2[1], p3[1]) - 0.3;
  };
  const z0 = Z_AR - 0.04;
  const z1 = T.zAvant + 0.4;
  const zm = (z0 + z1) / 2;
  const [, , p2, p3] = profilBas(uDe(zm));
  const y = yEtagere(zm);
  boisGeos.push(uvBois(entre(s * (p3[0] - 0.02), s * (p2[0] + 0.03), y - 0.02, y, z1, z0)));
  boisGeos.push(uvBois(entre(s * (p3[0] - 0.02), s * p3[0], y, y + 0.05, z1, z0)));
  const x = s * (p2[0] + p3[0]) / 2;
  if (s > 0) {
    const couleurs = [0x7a1f1f, 0x1f3a5f, 0x2f5233, 0xb8892b, 0x222222, 0x8a4f2a];
    let z = 1.3;
    for (let k = 0; k < 6; k++) {
      const ep = 0.025 + ((k * 7) % 5) * 0.006;
      const h = 0.15 + ((k * 3) % 4) * 0.012;
      objets.push(teinter(boite(0.13, h, ep, x, y + h / 2, z), couleurs[k]));
      z -= ep + 0.003;
    }
  } else {
    objets.push(teinter(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12).rotateX(Math.PI / 2).translate(x, y + 0.022, 1.05), 0x2b2b2b));
    objets.push(teinter(new THREE.CylinderGeometry(0.03, 0.026, 0.035, 12).rotateX(Math.PI / 2).translate(x, y + 0.022, 0.94), 0x8f8f8f));
    for (const dx of [-0.035, 0.035]) objets.push(teinter(new THREE.CylinderGeometry(0.028, 0.028, 0.13, 12).rotateX(Math.PI / 2).translate(x + dx, y + 0.03, 1.25), 0x1e2326));
  }
}

// Le lambris du pare-brise, à l'intérieur (3 cm derrière lui), percé des trois vitres ; il
// descend jusqu'au plafond du carré (sans laisser de jour sous le toit du rouf)
function geometrieLambrisPareBrise() {
  const bornes = bornesPareBrise(1.9);
  const colonnes = [bornes[0] * 0.95, ...bornes.slice(1, -1), bornes.at(-1) * 0.95];
  const estVitre = (k) => k === 1 || k === 3 || k === 5;
  const pts = colonnes.map((c) => [0, 1, 2, 3].map((j) => {
    if (j === 0) {
      const p = pointPareBrise(c, 0);
      return [p[0], hauteurRouf(U_TIMONERIE, p[0]) - 0.075, p[2] + 0.03];
    }
    // (le haut suit le plafond, bombé : sinon un jour le laisserait voir le dessous du toit)
    const y = [0, Y_VITRE_BAS + 0.04, Y_VITRE_HAUT, T.toit - 0.05 + T.bouge * (1 - c * c)][j];
    const p = pointPareBrise(c, y);
    return [p[0], p[1], p[2] + 0.03];
  }));
  return surfaceTranches(pts, (i, j) => !(j === 1 && estVitre(i)));
}

// Le lambris de la paroi arrière (à l'intérieur), du plancher au plafond, percé de la porte
// et des deux petites fenêtres
function geometrieLambrisArriere() {
  const u = uDe(T.zArriere);
  const Pt = T.porte;
  const F = FENETRE_ARRIERE;
  const [p0, p1, p2, p3] = profilBas(u);
  const forme = new THREE.Shape();
  forme.moveTo(-p0[0], Y);
  forme.lineTo(-Pt.demiLargeur, Y);
  forme.lineTo(-Pt.demiLargeur, Pt.haut);
  forme.lineTo(Pt.demiLargeur, Pt.haut);
  forme.lineTo(Pt.demiLargeur, Y);
  forme.lineTo(p0[0], Y);
  forme.lineTo(p1[0], p1[1]);
  forme.lineTo(p2[0], p2[1]);
  forme.lineTo(p3[0], p3[1]);
  const haut = T.toit - 0.05;
  const wh = xHaut(u, haut);
  forme.lineTo(wh, haut);
  for (let k = 1; k < 12; k++) {
    const x = wh * (1 - (2 * k) / 12);
    forme.lineTo(x, toitTimonerie(u, x) - 0.05);
  }
  forme.lineTo(-wh, haut);
  forme.lineTo(-p3[0], p3[1]);
  forme.lineTo(-p2[0], p2[1]);
  forme.lineTo(-p1[0], p1[1]);
  forme.lineTo(-p0[0], Y);
  for (const s of [1, -1]) {
    const t = new THREE.Path();
    const [x0, x1] = s > 0 ? [F.x0, F.x1] : [-F.x1, -F.x0];
    t.moveTo(x0, F.y0);
    t.lineTo(x1, F.y0);
    t.lineTo(x1, F.y1);
    t.lineTo(x0, F.y1);
    t.lineTo(x0, F.y0);
    forme.holes.push(t);
  }
  const g = new THREE.ShapeGeometry(forme, 4);
  g.translate(0, 0, Z_AR);
  return uvBois(g.toNonIndexed());
}

// Les embrasures des fenêtres (le tour de chaque vitre, entre la paroi et le lambris) et
// le chambranle de la porte, habillés de bois
function geometrieEmbrasures() {
  const geos = [];
  const tour = (points) => [...points, points[0]];
  const tunnel = (dehors, dedans) => {
    const positions = [];
    for (let k = 0; k < dehors.length - 1; k++) {
      const a = dehors[k], b = dehors[k + 1], c = dedans[k + 1], d = dedans[k];
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return uvBois(g);
  };
  for (const s of [1, -1]) {
    for (const [f0, f1] of FENETRES_COTE) {
      const contour = (decalage) => {
        const pts = [];
        for (let k = 0; k <= 6; k++) pts.push(pointParoi(s, f0 + ((f1 - f0) * k) / 6, Y_VITRE_BAS));
        for (let k = 6; k >= 0; k--) pts.push(pointParoi(s, f0 + ((f1 - f0) * k) / 6, Y_VITRE_HAUT));
        return tour(pts.map((p) => [p[0] - s * decalage, p[1], p[2]]));
      };
      geos.push(tunnel(contour(0), contour(EP_PAROI)));
    }
  }
  const b = bornesPareBrise(1.9);
  for (const [c0, c1] of [[b[1], b[2]], [b[3], b[4]], [b[5], b[6]]]) {
    const yb = Y_VITRE_BAS + 0.04;
    const contour = (dz) => tour([[c0, yb], [c1, yb], [c1, Y_VITRE_HAUT], [c0, Y_VITRE_HAUT]].map(([c, y]) => {
      const p = pointPareBrise(c, y);
      return [p[0], p[1], p[2] + dz];
    }));
    geos.push(tunnel(contour(0), contour(0.03)));
  }
  const F = FENETRE_ARRIERE;
  const zA = T.zArriere;
  for (const s of [1, -1]) {
    const [x0, x1] = s > 0 ? [F.x0, F.x1] : [-F.x1, -F.x0];
    const contour = (z) => tour([[x0, F.y0], [x1, F.y0], [x1, F.y1], [x0, F.y1]].map(([x, y]) => [x, y, z]));
    geos.push(tunnel(contour(zA), contour(Z_AR)));
  }
  const Pt = T.porte;
  const chambranle = (z) => [[-Pt.demiLargeur, Y, z], [-Pt.demiLargeur, Pt.haut, z], [Pt.demiLargeur, Pt.haut, z], [Pt.demiLargeur, Y, z]];
  geos.push(tunnel(chambranle(zA), chambranle(Z_AR)));
  return mergeGeometries(geos);
}

// Le plafond : le dessous du toit, 5 cm sous le dessus
function geometriePlafond() {
  const n = 10;
  const positions = [];
  const zAv = zPareBrise(T.toit - 0.05) + 0.03;
  for (let i = 0; i <= n; i++) {
    const z = Z_AR + ((zAv - Z_AR) * i) / n;
    const u = uDe(z);
    const w = xHaut(u, T.toit);
    for (let j = 0; j <= n; j++) {
      const x = -w + (2 * w * j) / n;
      positions.push(x, toitTimonerie(u, x) - 0.05, z);
    }
  }
  const indices = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      const b = a + n + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
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
  return g;
}

// ---------- La construction ----------

// i : l'intérieur (interieur.js) ; outils : ses matériaux et ses listes de géométries
export function construireInterieurTimonerie(i, { mat, garder, ajouter, boisGeos, inoxGeos, noirGeos, objets, cadrans }) {
  const groupe = i.groupe;
  ajouter(geometriePlancher(), mat.sol, 'plancher-timonerie');
  ajouter(mergeGeometries([
    geometrieLambris(1), geometrieLambris(-1), geometrieLambrisPareBrise(), geometrieLambrisArriere(), geometrieEmbrasures(),
  ].map((g) => (g.index ? g.toNonIndexed() : g))), mat.bois, 'lambris-timonerie');
  ajouter(geometriePlafond(), mat.plafond, 'plafond-timonerie');
  for (const s of [1, -1]) geometrieEtageres(s, boisGeos, objets);

  // --- la trémie et l'escalier (à bâbord) ---
  const { x0, x1 } = TREMIE;
  // les deux joues de la trémie, et le nez du plancher (au-dessus de la marche du haut)
  // (les bois débordent de quelques millimètres le plan où l'on marche : aux bords exacts,
  // l'outil d'inspection trouvait le dessus de la marche voisine)
  boisGeos.push(uvBois(entre(x0 - 0.02, x0, Y_CARRE, Y, TREMIE.z0, TREMIE.z1)));
  boisGeos.push(uvBois(entre(x1, x1 + 0.02, Y_CARRE, Y, TREMIE.z0, TREMIE.z1)));
  boisGeos.push(uvBois(entre(x0, x1, MARCHES_TIMONERIE[0].y, Y, TREMIE.z1 - 0.006, TREMIE.z1 + 0.02)));
  for (const m of MARCHES_TIMONERIE) {
    boisGeos.push(uvBois(entre(x0 + 0.005, x1 - 0.005, Y_CARRE, m.y, m.z0 - 0.006, Math.min(m.z1, TREMIE.z1 - 0.006))));
    for (const dz of [0.03, 0.07]) noirGeos.push(entre(x0 + 0.04, x1 - 0.04, m.y, m.y + 0.004, m.z0 + dz - 0.012, m.z0 + dz + 0.012));
  }
  // le bout de plancher du carré, au pied de l'escalier
  const fond = new THREE.PlaneGeometry(x1 - x0, MARCHES_TIMONERIE[1].z0 - TREMIE.z0);
  fond.rotateX(-Math.PI / 2);
  fond.translate((x0 + x1) / 2, Y_CARRE + 0.001, (MARCHES_TIMONERIE[1].z0 + TREMIE.z0) / 2);
  const uvFond = fond.attributes.uv;
  const posFond = fond.attributes.position;
  for (let k = 0; k < uvFond.count; k++) uvFond.setXY(k, posFond.getX(k), posFond.getZ(k));
  ajouter(fond, mat.sol, 'plancher-pied-escalier');
  // une main courante le long de l'escalier, côté bord (sous la corniche)
  {
    const x = x0 - 0.06;
    const pts = [[x, Y + 0.68, TREMIE.z1 + 0.05], [x, Y + 0.66, TREMIE.z1 - 0.2], [x, Y + 0.3, TREMIE.z0 + 0.05]];
    inoxGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 16, 0.016, 8, false));
    for (const p of [pts[0], pts[2]]) inoxGeos.push(new THREE.CylinderGeometry(0.012, 0.012, p[1] - Y, 8).translate(p[0], (p[1] + Y) / 2, p[2]));
  }

  // --- la console ---
  const C = CONSOLE;
  // le meuble bas (il passe sous la corniche, jusqu'à la paroi), puis le haut, sous le pare-brise
  boisGeos.push(uvBois(entre(C.x0, C.xBas, Y, C.haut, C.z0, C.z1)));
  boisGeos.push(uvBois(entre(C.x0, C.x1, C.haut, P.haut[0], C.z0, P.haut[1])));
  // les joues : deux triangles qui ferment les côtés sous le pupitre
  for (const x of [C.x0, C.x1]) {
    const f = new THREE.Shape();
    f.moveTo(P.haut[1], P.haut[0]);
    f.lineTo(P.bas[1], P.bas[0]);
    f.lineTo(P.haut[1], P.bas[0]);
    f.lineTo(P.haut[1], P.haut[0]);
    const joue = new THREE.ShapeGeometry(f);
    joue.rotateY(-Math.PI / 2); // (z, y) dans le plan x
    joue.translate(x, 0, 0);
    boisGeos.push(uvBois(joue.toNonIndexed()));
  }
  // le pupitre : une planche noire mate, où sont posés les écrans
  const longueurPupitre = Math.hypot(P.haut[0] - P.bas[0], P.haut[1] - P.bas[1]);
  const pupitre = new THREE.BoxGeometry(C.x1 - C.x0, longueurPupitre, 0.02);
  const { position: centrePupitre, quaternion: qPupitre } = surPupitre((C.x0 + C.x1) / 2, 0.5, -0.01);
  pupitre.applyQuaternion(qPupitre);
  pupitre.translate(centrePupitre.x, centrePupitre.y, centrePupitre.z);
  noirGeos.push(pupitre);
  // un rebord de bois au bas du pupitre
  const rebord = surPupitre((C.x0 + C.x1) / 2, 0, 0.015);
  boisGeos.push(uvBois(boite(C.x1 - C.x0, 0.03, 0.03, rebord.position.x, rebord.position.y, rebord.position.z)));
  // le compas de route, encastré dans le pupitre, en bas à droite
  const compas = new THREE.CylinderGeometry(0.055, 0.06, 0.035, 28);
  compas.rotateX(Math.PI / 2);
  const posCompas = surPupitre(0.45, 0.17, 0.01);
  compas.applyQuaternion(posCompas.quaternion);
  compas.translate(posCompas.position.x, posCompas.position.y, posCompas.position.z);
  noirGeos.push(compas);
  i.positionCompas = posCompas.position.clone();

  // --- la console du plafond (les répétiteurs y sont posés : electronique.js) ---
  const PL = PLAFONNIER;
  const caisson = new THREE.BoxGeometry(PL.x1 - PL.x0, 0.2, 0.12);
  caisson.rotateX(PL.inclinaison);
  caisson.translate((PL.x0 + PL.x1) / 2, PL.centre.y, PL.centre.z);
  boisGeos.push(uvBois(caisson.toNonIndexed()));
  // (ses deux attaches au plafond)
  for (const x of [PL.x0 + 0.06, PL.x1 - 0.06]) {
    const yHaut = toitTimonerie(uDe(PL.centre.z), x) - 0.05;
    inoxGeos.push(new THREE.CylinderGeometry(0.01, 0.01, yHaut - PL.centre.y, 8).translate(x, (yHaut + PL.centre.y) / 2, PL.centre.z + 0.02));
  }

  // --- le siège de quart ---
  const S = SIEGE;
  inoxGeos.push(new THREE.CylinderGeometry(0.035, 0.05, S.assise - 0.06 - Y, 16).translate(S.x, (S.assise - 0.06 + Y) / 2, S.z));
  inoxGeos.push(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 24).translate(S.x, Y + 0.006, S.z));
  const anneau = new THREE.TorusGeometry(0.15, 0.012, 8, 24);
  anneau.rotateX(Math.PI / 2);
  anneau.translate(S.x, Y + 0.25, S.z);
  inoxGeos.push(anneau);
  const coussins = [];
  const l = S.demiLargeur * 2;
  coussins.push(teinter(new THREE.BoxGeometry(l, 0.08, 0.38).translate(S.x, S.assise - 0.03, S.z), 0x1d2a3a));
  coussins.push(teinter(new THREE.BoxGeometry(l, 0.42, 0.07).translate(S.x, S.assise + 0.25, S.z + 0.2), 0x1d2a3a));
  for (const s of [1, -1]) coussins.push(teinter(new THREE.BoxGeometry(0.05, 0.05, 0.3).translate(S.x + s * (S.demiLargeur - 0.02), S.assise + 0.17, S.z + 0.04), 0x111418));
  ajouter(mergeGeometries(coussins.map((g) => g.toNonIndexed())), garder(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })), 'coussins-timonerie');

  // --- le coin cuisine (bâbord, derrière l'escalier) ---
  const K = CUISINE;
  boisGeos.push(uvBois(entre(K.x0, K.x1, Y, K.haut, K.z0, K.z1)));
  ajouter(entre(K.x0, K.x1 + 0.02, K.haut, K.haut + 0.035, K.z0 - 0.02, K.z1), mat.plan, 'plan-de-travail');
  const yP = K.haut + 0.035;
  // l'évier (à l'arrière), le réchaud sur cardan et la bouilloire (à l'avant)
  inoxGeos.push(entre(-0.68, -0.46, yP, yP + 0.002, 1.24, 1.35));
  noirGeos.push(entre(-0.66, -0.48, yP + 0.002, yP + 0.004, 1.255, 1.335));
  inoxGeos.push(new THREE.CylinderGeometry(0.01, 0.012, 0.12, 10).translate(-0.72, yP + 0.06, 1.3));
  noirGeos.push(entre(-0.7, -0.42, yP, yP + 0.08, 1.06, 1.23));
  for (const z of [1.1, 1.18]) {
    const feu = new THREE.TorusGeometry(0.035, 0.005, 6, 20);
    feu.rotateX(Math.PI / 2);
    feu.translate(-0.56, yP + 0.083, z);
    inoxGeos.push(feu);
  }
  const bouilloire = new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.07, 0.022], [0.068, 0.085], [0.05, 0.115], [0.022, 0.13], [0.019, 0.143], [0, 0.145]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
  bouilloire.translate(-0.56, yP + 0.086, 1.1);
  const verseur = new THREE.CylinderGeometry(0.007, 0.012, 0.075, 8);
  verseur.rotateX(0.9);
  verseur.translate(-0.56, yP + 0.16, 1.04);
  inoxGeos.push(bouilloire, verseur);
  // les portes des placards, sous le plan (vers le passage)
  for (const z of [1.07, 1.21]) boisGeos.push(uvBois(entre(K.x1, K.x1 + 0.015, Y + 0.1, K.haut - 0.07, z, z + 0.13)));
  // l'extincteur, contre le meuble, côté escalier
  const zE = K.z0 - 0.055;
  objets.push(teinter(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 16).translate(-0.62, Y + 0.2, zE), 0xc0201a));
  noirGeos.push(new THREE.CylinderGeometry(0.018, 0.026, 0.05, 12).translate(-0.62, Y + 0.375, zE), entre(-0.645, -0.595, Y + 0.14, Y + 0.17, K.z0 - 0.02, K.z0));

  // --- sur la paroi tribord : le baromètre et la pendule juste après la console, sur la
  // bande de lambris au-dessus de l'appui des vitres (plus bas, l'appui les cachait : on ne
  // les voyait qu'à genoux) ; la VHF à portée de main du siège ---
  const xParoi = (z, y) => xLambris(uDe(z), y) - 0.012;
  const radio = new THREE.Group();
  const boitier = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.14), mat.noir);
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveMap: i.radio.texture, emissiveIntensity: 0.9, roughness: 0.2,
  }));
  ecran.position.set(-0.02, 0.005, 0.0705);
  const combine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.03), mat.noir);
  combine.position.set(0.12, -0.02, 0.06);
  radio.add(boitier, ecran, combine);
  radio.rotation.y = -Math.PI / 2;
  radio.position.set(xParoi(0.88, 1.18) - 0.07, 1.18, 0.88);
  groupe.add(radio);
  i.positionRadio = radio.position.clone();
  const instrument = (y, z, texture, nom) => {
    // (sur la bande, au-dessus de l'appui : la paroi du haut)
    const x = xHaut(uDe(z), y) - 0.012 - 0.015;
    const bord = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 32);
    bord.rotateZ(Math.PI / 2);
    bord.translate(x, y, z);
    inoxGeos.push(bord);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.047, 32), garder(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 })));
    face.rotation.y = -Math.PI / 2;
    face.position.set(x - 0.016, y, z);
    face.name = nom;
    groupe.add(face);
    const centre = new THREE.Group();
    centre.rotation.y = -Math.PI / 2;
    centre.position.set(x - 0.019, y, z);
    groupe.add(centre);
    return centre;
  };
  const barometre = instrument(1.412, 0.62, cadrans.barometre, 'barometre');
  const pendule = instrument(1.412, 0.77, cadrans.pendule, 'pendule');
  const aiguille = (parent, longueur, largeur) => {
    const g = new THREE.BoxGeometry(largeur, longueur, 0.002);
    g.translate(0, longueur * 0.42, 0);
    const a = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
    parent.add(a);
    return a;
  };
  i.aiguilles = {
    pression: aiguille(barometre, 0.044, 0.003),
    heures: aiguille(pendule, 0.028, 0.004),
    minutes: aiguille(pendule, 0.04, 0.0028),
  };
  // l'aiguille témoin du baromètre : dorée, fine, par-dessus la noire (on la cale à la main
  // sur elle, par le bouton du verre, pour voir plus tard de combien elle a bougé)
  const temoin = new THREE.BoxGeometry(0.0016, 0.046, 0.0015);
  temoin.translate(0, 0.046 * 0.42, 0.0022);
  i.aiguilles.temoin = new THREE.Mesh(temoin, new THREE.MeshBasicMaterial({ color: 0xc8a046 }));
  barometre.add(i.aiguilles.temoin);
  const bouton = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16), new THREE.MeshBasicMaterial({ color: 0xa8842e }));
  bouton.rotation.x = Math.PI / 2;
  bouton.position.z = 0.004;
  barometre.add(bouton);
  // (là où l'on vise pour le tapoter : le centre du cadran, dans le repère du bateau)
  i.positionBarometre = barometre.position.clone();

  // --- le plafonnier de la timonerie ---
  const zL = 1.05;
  const yL = toitTimonerie(uDe(zL), 0) - 0.05;
  const dome = new THREE.SphereGeometry(0.07, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  dome.scale(1, 0.45, 1);
  const diffuseur = new THREE.Mesh(dome, garder(new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.4 })));
  diffuseur.position.set(0, yL - 0.012, zL);
  groupe.add(diffuseur);
  inoxGeos.push(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 24).translate(0, yL - 0.006, zL));
  i.lampeTimonerie = { diffuseur, position: new THREE.Vector3(0, yL - 0.07, zL) };
}
