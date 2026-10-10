// L'intérieur de la timonerie : la pièce où l'on passe la nuit.
//
// En entrant du cockpit (par la porte à deux battants) :
//  - un plancher de teck et houx, surélevé (22 cm au-dessus du cockpit), percé à bâbord de
//    la trappe de la cale : on la soulève pour voir l'eau, 1,6 m plus bas ;
//  - devant, sous le pare-brise, la console : un pupitre incliné vers le siège de quart, avec
//    l'écran du radar, le traceur de cartes, la commande du pilote, le compas et le tableau
//    électrique, tous à portée de main du siège ; au plafond, devant, la console du plafond
//    (la VHF, les répétiteurs du vent et de la vitesse) ;
//  - le siège de quart, haut, au milieu, face à la grande vitre du pare-brise ;
//  - à bâbord : la pompe de cale à main, sur la paroi, à côté de la trappe ; tout à l'avant,
//    sous le pare-brise, la petite porte basse de la cabine avant (fermée) ;
//  - à tribord : la banquette, le baromètre et la pendule au-dessus ; le ciré et le gilet
//    pendus contre la paroi arrière, à côté de la porte ;
//  - devant chaque vitre (sauf celles de la porte), un volet de tempête : des lames
//    d'aluminium qui descendent de leur coffre, sous le plafond, et la protègent… mais
//    alors on ne voit plus dehors, de ce côté-là. On les commande côté par côté, depuis le
//    siège : quatre boutons sur un petit plan de la timonerie, dans la console du plafond.
// Les parois sont lambrissées sous les vitres ; le plafond est le dessous du toit.
// (Les mesures de la timonerie, de la trappe et de la porte basse sont dans forme.js ; ses
// parois vues de dehors, dans timonerie.js ; la cale, sous le plancher, dans interieur.js.)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TIMONERIE, ROUF, U_TIMONERIE, TRAPPE_CALE, PORTE_AVANT, uDe, bordInterieur, hauteurPont, hauteurRouf,
  xParoiTimonerie, toitTimonerie, zPareBrise,
} from './forme.js';
import {
  FENETRES_COTE, FENETRE_ARRIERE, Y_VITRE_BAS, Y_VITRE_HAUT, pointParoi, pointPareBrise, vitresPareBrise,
} from './timonerie.js';
import { boite, entre, uvBois, teinter, preparer } from './outils-geometrie.js';

const T = TIMONERIE;
const Y = T.plancher;
const EP_PAROI = 0.035; // le lambris est 3,5 cm à l'intérieur des parois
const Z_AR = T.zArriere - EP_PAROI; // la face intérieure de la paroi arrière
const Z_AV = T.zAvant + 0.03; // la cloison avant, sous le pare-brise (côté intérieur)

// La console (sous le pare-brise) : le meuble bas, et le pupitre incliné (son bas et son
// haut : [y, z]) tourné vers le siège ; il déborde de 10 cm au-dessus des genoux. À
// tribord du pupitre, le meuble continue jusqu'à la paroi (un dessus où l'on pose les
// jumelles) ; à bâbord, il laisse la place de la porte basse.
export const CONSOLE = {
  x0: -0.82, x1: 0.88, z0: Z_AV, z1: 1.26, haut: 1.72, pupitre: { bas: [1.72, 1.36], haut: [1.98, 0.98] },
};
// Le siège de quart : haut (on voit par-dessus la console), au milieu, face au pare-brise
export const SIEGE = { x: 0, z: 1.86, assise: Y + 0.64, demiLargeur: 0.25 };
// Les yeux du marin assis au poste
export const YEUX_POSTE = new THREE.Vector3(SIEGE.x, SIEGE.assise + 0.8, SIEGE.z + 0.02);
// La banquette, à tribord, derrière le siège ; la pompe de cale, sur la paroi bâbord
export const BANQUETTE = { x0: 0.86, z0: 2.45, z1: 3.4, haut: Y + 0.42 };
export const POMPE = { z: 2.84, y: Y + 0.45 };

// Le profil intérieur tribord dans la tranche u, en bas (sous les vitres) : la paroi
// verticale jusqu'au pont, le côté du rouf qui rentre, puis le pied de la paroi vitrée.
// Renvoie les 4 points [x, y].
function profilBas(u) {
  const e = bordInterieur(u);
  const xBas = e - 0.05;
  const xR = e - ROUF.rentree - EP_PAROI;
  const xT = T.demiLargeur - EP_PAROI;
  return [[xBas, Y], [xBas, hauteurPont(u, e) - 0.03], [xR, hauteurRouf(u, xR) - 0.05], [xT, hauteurRouf(u, T.demiLargeur) - 0.05]];
}
// La paroi intérieure (le lambris) à la hauteur y de la tranche u, en bas
export const xLambris = (u, y) => {
  const [p0, p1, p2] = profilBas(u);
  if (y <= p1[1]) return p0[0];
  return p1[0] + (p2[0] - p1[0]) * Math.min(1, (y - p1[1]) / (p2[1] - p1[1]));
};
// Le haut de la paroi intérieure (la paroi vitrée), à la hauteur y
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

// La console du plafond : un caisson pendu devant le siège, sous le haut du pare-brise, sa
// face tournée vers le siège (vers le bas et l'arrière) ; on y pose la VHF et les répétiteurs
export const PLAFONNIER = { x0: -0.55, x1: 0.55, centre: new THREE.Vector3(0, 3.04, 1.32), inclinaison: 0.75, epaisseur: 0.1 };
export function surPlafonnier(x, recul = 0.012) {
  // (tourné de l'inclinaison autour de l'axe x : sa face regarde vers le bas et l'arrière)
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PLAFONNIER.inclinaison);
  const normale = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const position = PLAFONNIER.centre.clone().setX(x).addScaledVector(normale, PLAFONNIER.epaisseur / 2 + recul);
  return { position, quaternion: q };
}

// ---------- Les surfaces ----------

// Le plancher : de la paroi arrière à la cloison avant, d'un côté du rouf à l'autre, percé
// de la trappe de la cale
function geometriePlancher() {
  const forme = new THREE.Shape();
  const n = 8;
  const bord = (z) => bordInterieur(uDe(z)) - 0.05;
  // (le contour, vu de dessus : x, -z)
  for (let k = 0; k <= n; k++) {
    const z = Z_AV + ((Z_AR - Z_AV) * k) / n;
    if (k === 0) forme.moveTo(bord(z), -z);
    else forme.lineTo(bord(z), -z);
  }
  for (let k = n; k >= 0; k--) {
    const z = Z_AV + ((Z_AR - Z_AV) * k) / n;
    forme.lineTo(-bord(z), -z);
  }
  const t = TRAPPE_CALE;
  const trou = new THREE.Path();
  trou.moveTo(t.x0, -t.z0);
  trou.lineTo(t.x1, -t.z0);
  trou.lineTo(t.x1, -t.z1);
  trou.lineTo(t.x0, -t.z1);
  trou.lineTo(t.x0, -t.z0);
  forme.holes.push(trou);
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

// Le lambris d'un côté (s = 1 tribord, -1 bâbord) : en bas, la paroi et le côté du rouf ; en
// haut, la face intérieure de la paroi vitrée, percée des fenêtres
function geometrieLambris(s) {
  const geos = [];
  const nz = 12;
  const colonnesBas = [];
  for (let i = 0; i <= nz; i++) {
    const z = Z_AR + ((Z_AV - Z_AR) * i) / nz;
    colonnesBas.push(profilBas(uDe(z)).map(([x, y]) => [s * x, y, z]));
  }
  geos.push(surfaceTranches(colonnesBas));
  // le haut
  const bornes = [0, 0.035, ...FENETRES_COTE.flat(), 0.965, 1];
  bornes.sort((a, b) => a - b);
  const estFenetre = (a0, a1) => FENETRES_COTE.some(([f0, f1]) => a0 >= f0 - 1e-6 && a1 <= f1 + 1e-6);
  const colonnesHaut = bornes.map((a) => {
    const z0 = T.zArriere + (zPareBrise(Y_VITRE_BAS) - T.zArriere) * a;
    return [hauteurRouf(uDe(z0), T.demiLargeur) - 0.05, Y_VITRE_BAS, Y_VITRE_HAUT, T.toit - 0.05].map((y, j) => {
      const z = j === 0 ? z0 : pointParoi(s, a, y)[2];
      return [s * xHaut(uDe(z), y), y, a === 0 ? Z_AR : z];
    });
  });
  geos.push(surfaceTranches(colonnesHaut, (i, j) => !(j === 1 && estFenetre(bornes[i], bornes[i + 1]))));
  return mergeGeometries(geos);
}

// Le lambris du pare-brise, à l'intérieur (3 cm derrière lui), percé des trois vitres ; il
// descend jusqu'au dessous du toit du rouf, où commence la cloison avant
// (ses bords rejoignent le lambris des côtés : c de la face intérieure des parois)
const cBord = (y) => 1 - EP_PAROI / xParoiTimonerie(uDe(zPareBrise(y)), y);
function geometrieLambrisPareBrise() {
  const colonnes = [null, ...vitresPareBrise().flat(), null];
  const estVitre = (k) => k === 1 || k === 3 || k === 5;
  const pts = colonnes.map((c0, k) => [0, 1, 2, 3].map((j) => {
    const y = [hauteurRouf(U_TIMONERIE, 0), Y_VITRE_BAS + 0.04, Y_VITRE_HAUT, T.toit - 0.05][j];
    const c = c0 ?? (k === 0 ? -cBord(y) : cBord(y));
    if (j === 0) {
      const p = pointPareBrise(c, 0);
      return [p[0], hauteurRouf(U_TIMONERIE, p[0]) - 0.075, p[2] + 0.03];
    }
    // (le haut suit le plafond, bombé : sinon un jour le laisserait voir le dessous du toit)
    const p = pointPareBrise(c, y + (j === 3 ? T.bouge * (1 - c * c) : 0));
    return [p[0], p[1], p[2] + 0.03];
  }));
  return surfaceTranches(pts, (i, j) => !(j === 1 && estVitre(i)));
}

// La cloison avant, sous le pare-brise : du plancher au dessous du toit du rouf, d'une paroi
// à l'autre ; percée à bâbord de la porte basse de la cabine avant (la console est devant)
function geometrieCloisonAvant() {
  const u = uDe(Z_AV);
  const [p0, p1, p2, p3] = profilBas(u);
  const forme = new THREE.Shape();
  forme.moveTo(-p0[0], Y);
  forme.lineTo(p0[0], Y);
  forme.lineTo(p1[0], p1[1]);
  forme.lineTo(p2[0], p2[1]);
  forme.lineTo(p3[0], hauteurRouf(U_TIMONERIE, p3[0]) - 0.075);
  for (let k = 1; k < 12; k++) {
    const x = p3[0] * (1 - (2 * k) / 12);
    forme.lineTo(x, hauteurRouf(U_TIMONERIE, x) - 0.075);
  }
  forme.lineTo(-p3[0], hauteurRouf(U_TIMONERIE, p3[0]) - 0.075);
  forme.lineTo(-p2[0], p2[1]);
  forme.lineTo(-p1[0], p1[1]);
  forme.lineTo(-p0[0], Y);
  const PA = PORTE_AVANT;
  const trou = new THREE.Path();
  trou.moveTo(PA.x0, PA.y0);
  trou.lineTo(PA.x1, PA.y0);
  trou.lineTo(PA.x1, PA.y1);
  trou.lineTo(PA.x0, PA.y1);
  trou.lineTo(PA.x0, PA.y0);
  forme.holes.push(trou);
  const g = new THREE.ShapeGeometry(forme, 4);
  g.translate(0, 0, Z_AV + 0.001);
  return uvBois(g.toNonIndexed());
}

// Le lambris de la paroi arrière (à l'intérieur), du plancher au plafond, percé de la porte
// et des deux fenêtres
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

// Un « tunnel » entre deux contours fermés (le tour d'une fenêtre, entre la paroi et le lambris)
function tunnel(dehors, dedans) {
  const positions = [];
  for (let k = 0; k < dehors.length - 1; k++) {
    const a = dehors[k], b = dehors[k + 1], c = dedans[k + 1], d = dedans[k];
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return uvBois(g);
}
const tour = (points) => [...points, points[0]];

// Les embrasures des fenêtres (le tour de chaque vitre, entre la paroi et le lambris), le
// chambranle de la porte et le tour de la trappe (l'épaisseur du plancher), habillés de bois
function geometrieEmbrasures() {
  const geos = [];
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
  for (const [c0, c1] of vitresPareBrise()) {
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
  // le tour de la trappe : les 4 cm du plancher
  const t = TRAPPE_CALE;
  const bordTrappe = (y) => tour([[t.x0, y, t.z0], [t.x1, y, t.z0], [t.x1, y, t.z1], [t.x0, y, t.z1]]);
  geos.push(tunnel(bordTrappe(Y), bordTrappe(Y - 0.04)));
  return mergeGeometries(geos);
}

// Le plafond : le dessous du toit, 5 cm sous le dessus
function geometriePlafond() {
  const n = 12;
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

// Une barre (une boîte de section ep × ep) d'un point à un autre
function barreEntre(a, b, ep = 0.02, ep2 = ep) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const g = new THREE.BoxGeometry(ep, ep2, va.distanceTo(vb));
  g.lookAt(vb.clone().sub(va));
  g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  return g;
}

// ---------- Les volets de tempête ----------
//
// Un volet par vitre : des lames d'aluminium (4 cm chacune) qui descendent de leur coffre,
// juste sous le plafond, dans deux coulisses, 5 cm derrière la vitre. Ils sont rangés par
// côté (avant : les trois vitres du pare-brise ; tribord, bâbord : les deux fenêtres de
// chaque côté ; arrière : les deux petites fenêtres de part et d'autre de la porte), et on
// les ferme côté par côté.
export const COTES_VOLETS = ['avant', 'tribord', 'babord', 'arriere'];
const PAS_LAMES = 0.32; // (la texture : 8 lames de 4 cm)

function texturesLames() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const cx = canvas.getContext('2d');
  const relief = document.createElement('canvas');
  relief.width = 16;
  relief.height = 256;
  const rx = relief.getContext('2d');
  for (let k = 0; k < 8; k++) {
    const y0 = k * 32;
    // une lame : bombée, une rainure sombre entre deux lames
    const g = cx.createLinearGradient(0, y0, 0, y0 + 32);
    g.addColorStop(0, '#5f666c');
    g.addColorStop(0.12, '#c3c9cd');
    g.addColorStop(0.55, '#aab0b5');
    g.addColorStop(0.9, '#7d848a');
    g.addColorStop(1, '#3a3f44');
    cx.fillStyle = g;
    cx.fillRect(0, y0, 16, 32);
    const r = rx.createLinearGradient(0, y0, 0, y0 + 32);
    r.addColorStop(0, '#000');
    r.addColorStop(0.15, '#bbb');
    r.addColorStop(0.5, '#fff');
    r.addColorStop(0.85, '#bbb');
    r.addColorStop(1, '#000');
    rx.fillStyle = r;
    rx.fillRect(0, y0, 16, 32);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bump = new THREE.CanvasTexture(relief);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

// La commande des volets, dans la console du plafond (à tribord des répétiteurs) : un petit
// plan de la timonerie vue de dessus, et un bouton de chaque côté (l'avant en haut), avec son
// voyant (vert : ouvert ; rouge : fermé ; orange qui clignote : il bouge)
const COMMANDE_VOLETS = { x: 0.46, taille: 0.16, boutons: { avant: [0, 0.045], tribord: [0.045, 0], babord: [-0.045, 0], arriere: [0, -0.045] } };
function planDesVolets() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const cx = canvas.getContext('2d');
  cx.fillStyle = '#121619';
  cx.fillRect(0, 0, 256, 256);
  cx.strokeStyle = '#3a4048';
  cx.lineWidth = 4;
  cx.strokeRect(4, 4, 248, 248);
  // la timonerie vue de dessus, au milieu (le pare-brise en haut, la porte en bas) ; les
  // boutons sont de chaque côté (à 72 pixels du milieu), leurs noms dans les coins
  cx.strokeStyle = '#8d959c';
  cx.lineWidth = 3;
  cx.beginPath();
  cx.moveTo(104, 96);
  cx.lineTo(152, 96);
  cx.lineTo(158, 164);
  cx.lineTo(98, 164);
  cx.closePath();
  cx.stroke();
  cx.fillStyle = '#c9cdd2';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.font = 'bold 19px system-ui, sans-serif';
  cx.fillText('VOLETS', 128, 132);
  cx.font = 'bold 17px system-ui, sans-serif';
  cx.fillText('AV', 182, 40);
  cx.fillText('AR', 182, 222);
  cx.fillText('BÂB', 46, 172);
  cx.fillText('TRIB', 208, 172);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function construireCommandeVolets(i, garder) {
  const C = COMMANDE_VOLETS;
  const groupe = new THREE.Group();
  groupe.name = 'commande-volets';
  const texture = planDesVolets();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(C.taille, C.taille), garder(new THREE.MeshStandardMaterial({
    map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.15, roughness: 0.6,
  })));
  groupe.add(face);
  i.boutonsVolets = {};
  i.voyantsVolets = {};
  const caoutchouc = garder(new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.8 }));
  for (const [cote, [bx, by]] of Object.entries(C.boutons)) {
    const bouton = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.015, 0.012, 20).rotateX(Math.PI / 2), caoutchouc);
    bouton.position.set(bx, by, 0.006);
    const voyant = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.02, 24), new THREE.MeshBasicMaterial({ color: 0x3dff7a }));
    voyant.position.set(bx, by, 0.001);
    groupe.add(bouton, voyant);
    i.voyantsVolets[cote] = voyant;
  }
  const { position, quaternion } = surPlafonnier(C.x, 0.002);
  groupe.position.copy(position);
  groupe.quaternion.copy(quaternion);
  i.groupe.add(groupe);
  groupe.updateMatrix();
  for (const [cote, [bx, by]] of Object.entries(C.boutons)) i.boutonsVolets[cote] = new THREE.Vector3(bx, by, 0.012).applyMatrix4(groupe.matrix);
  i.faceCommandeVolets = face;
}

// Un volet : point(c, y) donne un point de son plan (déjà décalé vers l'intérieur) ;
// colonnes : les c de ses bords et du milieu ; yHaut, yBas : son haut (dans le coffre) et
// son bas, fermé. maj(f) le descend : 0 roulé, 1 fermé.
function creerVolet(point, colonnes, yHaut, yBas, materiau) {
  const nc = colonnes.length;
  const nr = 6;
  const positions = new Float32Array(nc * (nr + 1) * 3);
  const uvs = new Float32Array(nc * (nr + 1) * 2);
  const indices = [];
  for (let i = 0; i < nc - 1; i++) {
    for (let j = 0; j < nr; j++) {
      const a = i * (nr + 1) + j;
      const b = a + nr + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  const mesh = new THREE.Mesh(g, materiau);
  mesh.name = 'volets';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const maj = (f) => {
    mesh.visible = f > 0.005;
    if (!mesh.visible) return;
    const yb = yHaut - f * (yHaut - yBas);
    for (let i = 0; i < nc; i++) {
      for (let j = 0; j <= nr; j++) {
        const y = yHaut + ((yb - yHaut) * j) / nr;
        const p = point(colonnes[i], y);
        const k = i * (nr + 1) + j;
        positions.set(p, k * 3);
        // (les lames suivent le bas du volet : elles descendent avec lui)
        uvs[k * 2] = i / (nc - 1);
        uvs[k * 2 + 1] = (y - yb) / PAS_LAMES;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };
  maj(0);
  return { mesh, maj };
}

// Tous les volets, leurs coffres et leurs coulisses ; et le centre de chaque vitre
function construireVolets(i, garder) {
  const { map, bump } = texturesLames();
  const materiau = garder(new THREE.MeshStandardMaterial({
    color: 0xd4d9dc, map, bumpMap: bump, bumpScale: 1.2, metalness: 0.45, roughness: 0.42,
  }));
  const coffres = [];
  const volets = Object.fromEntries(COTES_VOLETS.map((c) => [c, { fraction: 0, cible: 0, liste: [] }]));
  const fenetres = [];
  const ajouter = (cote, point, colonnes, yHaut, yBas, centre) => {
    const v = creerVolet(point, colonnes, yHaut, yBas, materiau);
    volets[cote].liste.push(v);
    i.groupe.add(v.mesh);
    // le coffre (le long du haut du volet) et les deux coulisses
    const c0 = colonnes[0];
    const c1 = colonnes.at(-1);
    coffres.push(barreEntre(point(c0, yHaut + 0.03), point(c1, yHaut + 0.03), 0.11, 0.1));
    for (const c of [c0, c1]) coffres.push(barreEntre(point(c, yBas - 0.02), point(c, yHaut), 0.025, 0.025));
    fenetres.push({ cote, centre });
  };
  const COTE_DEDANS = 0.055; // (le plan des volets, derrière la vitre)
  // les fenêtres des côtés
  for (const s of [1, -1]) {
    for (const [f0, f1] of FENETRES_COTE) {
      const point = (a, y) => {
        const p = pointParoi(s, a, y);
        return [p[0] - s * COTE_DEDANS, p[1], p[2]];
      };
      const colonnes = Array.from({ length: 7 }, (_, k) => f0 - 0.012 + ((f1 - f0 + 0.024) * k) / 6);
      const yH = Y_VITRE_HAUT + 0.04;
      const centre = new THREE.Vector3(...point((f0 + f1) / 2, (Y_VITRE_BAS + Y_VITRE_HAUT) / 2));
      ajouter(s > 0 ? 'tribord' : 'babord', point, colonnes, yH, Y_VITRE_BAS - 0.035, centre);
    }
  }
  // le pare-brise
  for (const [c0, c1] of vitresPareBrise()) {
    const point = (c, y) => {
      const p = pointPareBrise(c, y);
      return [p[0], p[1], p[2] + COTE_DEDANS];
    };
    const d = 0.03 / T.demiLargeur;
    const colonnes = Array.from({ length: 5 }, (_, k) => c0 - d + ((c1 - c0 + 2 * d) * k) / 4);
    const centre = new THREE.Vector3(...point((c0 + c1) / 2, (Y_VITRE_BAS + Y_VITRE_HAUT) / 2 + 0.02));
    ajouter('avant', point, colonnes, Y_VITRE_HAUT + 0.04, Y_VITRE_BAS + 0.005, centre);
  }
  // les fenêtres arrière
  const F = FENETRE_ARRIERE;
  for (const s of [1, -1]) {
    const point = (x, y) => [x, y, Z_AR - 0.02];
    const [x0, x1] = s > 0 ? [F.x0 - 0.03, F.x1 + 0.03] : [-F.x1 - 0.03, -F.x0 + 0.03];
    const colonnes = Array.from({ length: 4 }, (_, k) => x0 + ((x1 - x0) * k) / 3);
    const centre = new THREE.Vector3(s * (F.x0 + F.x1) / 2, (F.y0 + F.y1) / 2, Z_AR - 0.02);
    ajouter('arriere', point, colonnes, F.y1 + 0.04, F.y0 - 0.03, centre);
  }
  i.volets = volets;
  i.fenetres = fenetres;
  const m = new THREE.Mesh(mergeGeometries(coffres.map((g) => preparer(g, []))), materiau);
  m.name = 'volets-coffres';
  m.castShadow = true;
  m.receiveShadow = true;
  i.groupe.add(m);
}

// ---------- La construction ----------

// i : l'intérieur (interieur.js) ; outils : ses matériaux et ses listes de géométries
export function construireInterieurTimonerie(i, { mat, garder, ajouter, boisGeos, inoxGeos, noirGeos, objets, cadrans }) {
  const groupe = i.groupe;
  ajouter(geometriePlancher(), mat.sol, 'plancher-timonerie');
  ajouter(mergeGeometries([
    geometrieLambris(1), geometrieLambris(-1), geometrieLambrisPareBrise(), geometrieCloisonAvant(), geometrieLambrisArriere(), geometrieEmbrasures(),
  ].map((g) => (g.index ? g.toNonIndexed() : g))), mat.bois, 'lambris-timonerie');
  ajouter(geometriePlafond(), mat.plafond, 'plafond-timonerie');

  // --- la trappe de la cale : son couvercle, en plancher, qui pivote sur son bord arrière ---
  {
    const t = TRAPPE_CALE;
    const pivot = new THREE.Group();
    pivot.name = 'trappe-cale';
    pivot.position.set((t.x0 + t.x1) / 2, Y, t.z1);
    // (bâti dans le repère du bateau, fermé, pour que le bois continue celui du plancher)
    const couvercle = entre(t.x0 + 0.004, t.x1 - 0.004, Y - 0.03, Y, t.z0 + 0.004, t.z1 - 0.004);
    const uv = couvercle.attributes.uv;
    const pos = couvercle.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k), -pos.getZ(k));
    couvercle.translate(-pivot.position.x, -pivot.position.y, -pivot.position.z);
    const planche = new THREE.Mesh(couvercle, mat.sol);
    planche.castShadow = true;
    planche.receiveShadow = true;
    // l'anneau pour la soulever, couché dans sa cuvette
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 20), mat.inox);
    anneau.rotation.x = Math.PI / 2;
    anneau.position.set(0, 0.002, -(t.z1 - t.z0) + 0.07);
    const cuvette = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), mat.noir);
    cuvette.rotation.x = -Math.PI / 2;
    cuvette.position.set(0, 0.001, -(t.z1 - t.z0) + 0.07);
    pivot.add(planche, cuvette, anneau);
    groupe.add(pivot);
    i.trappe = pivot;
    i.positionTrappe = new THREE.Vector3((t.x0 + t.x1) / 2, Y + 0.12, (t.z0 + t.z1) / 2);
  }

  // --- la console ---
  const C = CONSOLE;
  // le meuble bas (le pupitre déborde au-dessus des genoux), le haut sous le bord du pupitre
  boisGeos.push(uvBois(entre(C.x0, C.x1, Y, C.haut, C.z0, C.z1)));
  boisGeos.push(uvBois(entre(C.x0, C.x1, C.haut, P.haut[0], C.z0, P.haut[1])));
  boisGeos.push(uvBois(entre(C.x0, C.x1, C.haut - 0.02, C.haut, C.z1, P.bas[1])));
  // à tribord, le meuble continue jusqu'à la paroi (son dessus, entouré d'un violon)
  const xT = xLambris(uDe(C.z0), C.haut) - 0.005;
  boisGeos.push(uvBois(entre(C.x1, xT, Y, C.haut, C.z0, C.z1)));
  boisGeos.push(uvBois(entre(C.x1, xT, C.haut, C.haut + 0.035, C.z1 - 0.015, C.z1)));
  boisGeos.push(uvBois(entre(xT - 0.015, xT, C.haut, C.haut + 0.035, C.z0, C.z1)));
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
  // le compas de route, encastré dans le pupitre, au milieu, au-dessus de la commande du pilote
  const compas = new THREE.CylinderGeometry(0.055, 0.06, 0.035, 28);
  compas.rotateX(Math.PI / 2);
  const posCompas = surPupitre(-0.02, 0.64, 0.01);
  compas.applyQuaternion(posCompas.quaternion);
  compas.translate(posCompas.position.x, posCompas.position.y, posCompas.position.z);
  noirGeos.push(compas);
  i.positionCompas = posCompas.position.clone();
  // le repose-pieds, au pied de la console
  {
    const yR = Y + 0.24;
    const zR = C.z1 + 0.05;
    inoxGeos.push(new THREE.CylinderGeometry(0.014, 0.014, 1.1, 10).rotateZ(Math.PI / 2).translate(0.03, yR, zR));
    for (const x of [-0.45, 0.51]) inoxGeos.push(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 8).rotateX(Math.PI / 2).translate(x, yR, zR - 0.025));
  }
  // sur le dessus du meuble tribord : les jumelles et une lampe torche
  {
    const x = (C.x1 + xT) / 2;
    const y = C.haut;
    for (const dx of [-0.035, 0.035]) objets.push(teinter(new THREE.CylinderGeometry(0.028, 0.028, 0.13, 12).rotateX(Math.PI / 2).translate(x + dx - 0.05, y + 0.03, 1.0), 0x1e2326));
    objets.push(teinter(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12).rotateZ(Math.PI / 2).translate(x + 0.08, y + 0.022, 1.12), 0x2b2b2b));
    objets.push(teinter(new THREE.CylinderGeometry(0.03, 0.026, 0.035, 12).rotateZ(Math.PI / 2).translate(x - 0.035, y + 0.022, 1.12), 0x8f8f8f));
  }

  // --- la console du plafond (la VHF et les répétiteurs y sont posés : electronique.js) ---
  const PL = PLAFONNIER;
  const caisson = new THREE.BoxGeometry(PL.x1 - PL.x0, 0.18, PL.epaisseur);
  caisson.rotateX(PL.inclinaison);
  caisson.translate((PL.x0 + PL.x1) / 2, PL.centre.y, PL.centre.z);
  boisGeos.push(uvBois(caisson.toNonIndexed()));
  // (ses deux attaches au plafond)
  for (const x of [PL.x0 + 0.06, PL.x1 - 0.06]) {
    const yHaut = toitTimonerie(uDe(PL.centre.z), x) - 0.05;
    inoxGeos.push(new THREE.CylinderGeometry(0.01, 0.01, yHaut - PL.centre.y, 8).translate(x, (yHaut + PL.centre.y) / 2, PL.centre.z + 0.02));
  }
  // la VHF, encastrée à bâbord dans la console du plafond (son combiné pendu à côté)
  const radio = new THREE.Group();
  const boitier = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.14), mat.noir);
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveMap: i.radio.texture, emissiveIntensity: 0.9, roughness: 0.2,
  }));
  ecran.position.set(-0.02, 0.005, 0.0705);
  const combine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.03), mat.noir);
  combine.position.set(0.13, -0.045, 0.06);
  radio.add(boitier, ecran, combine);
  i.ecranRadio = ecran;
  const posRadio = surPlafonnier(-0.3, -0.055);
  radio.position.copy(posRadio.position);
  radio.quaternion.copy(posRadio.quaternion);
  groupe.add(radio);
  i.positionRadio = radio.position.clone();

  // --- le siège de quart ---
  const S = SIEGE;
  inoxGeos.push(new THREE.CylinderGeometry(0.04, 0.055, S.assise - 0.06 - Y, 16).translate(S.x, (S.assise - 0.06 + Y) / 2, S.z));
  inoxGeos.push(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 24).translate(S.x, Y + 0.006, S.z));
  // (l'anneau repose-pieds)
  const anneau = new THREE.TorusGeometry(0.19, 0.013, 8, 28);
  anneau.rotateX(Math.PI / 2);
  anneau.translate(S.x, Y + 0.3, S.z);
  inoxGeos.push(anneau);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    inoxGeos.push(barreEntre([S.x, Y + 0.3, S.z], [S.x + Math.cos(a) * 0.19, Y + 0.3, S.z + Math.sin(a) * 0.19], 0.014));
  }
  const coussins = [];
  const l = S.demiLargeur * 2;
  coussins.push(teinter(new THREE.BoxGeometry(l, 0.08, 0.44).translate(S.x, S.assise - 0.03, S.z), 0x1d2a3a));
  coussins.push(teinter(new THREE.BoxGeometry(l, 0.46, 0.07).translate(S.x, S.assise + 0.27, S.z + 0.23), 0x1d2a3a));
  for (const s of [1, -1]) coussins.push(teinter(new THREE.BoxGeometry(0.05, 0.05, 0.34).translate(S.x + s * (S.demiLargeur - 0.02), S.assise + 0.19, S.z + 0.04), 0x111418));

  // --- la banquette tribord : son coffre, ses coussins, une couverture pliée ---
  const B = BANQUETTE;
  const xB = xLambris(uDe((B.z0 + B.z1) / 2), Y + 0.1) - 0.005;
  boisGeos.push(uvBois(entre(B.x0, xB, Y, B.haut, B.z0, B.z1)));
  coussins.push(teinter(new THREE.BoxGeometry(xB - B.x0 - 0.02, 0.09, B.z1 - B.z0 - 0.02).translate((B.x0 + xB) / 2 - 0.01, B.haut + 0.045, (B.z0 + B.z1) / 2), 0x1d2a3a));
  {
    // (le dossier, contre la paroi qui rentre en montant : on le cale sur son haut)
    const yD = B.haut + 0.09;
    const xD = xLambris(uDe((B.z0 + B.z1) / 2), yD + 0.26) - 0.055;
    coussins.push(teinter(new THREE.BoxGeometry(0.1, 0.26, B.z1 - B.z0 - 0.04).translate(xD, yD + 0.13, (B.z0 + B.z1) / 2), 0x1d2a3a));
  }
  objets.push(teinter(new THREE.BoxGeometry(0.36, 0.07, 0.3).translate(B.x0 + 0.24, B.haut + 0.125, B.z1 - 0.25), 0x5a1f1d));
  ajouter(mergeGeometries(coussins.map((g) => g.toNonIndexed())), garder(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })), 'coussins-timonerie');

  // --- sur la paroi tribord, au-dessus de l'avant de la banquette : le baromètre et la pendule ---
  const instrument = (y, z, texture, nom) => {
    // (sur la bande de lambris sous les vitres)
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
  const yInstruments = (hauteurRouf(uDe(2.4), T.demiLargeur) - 0.05 + Y_VITRE_BAS) / 2;
  const barometre = instrument(yInstruments, 2.3, cadrans.barometre, 'barometre');
  const pendule = instrument(yInstruments, 2.46, cadrans.pendule, 'pendule');
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

  // --- à bâbord : la pompe de cale à main, sur la paroi (son levier pivote de haut en bas,
  // le long de la paroi), et son tuyau qui descend dans la cale ---
  {
    const uP = uDe(POMPE.z);
    const xMur = -xLambris(uP, POMPE.y);
    const bronze = garder(new THREE.MeshStandardMaterial({ color: 0x9a6b3a, roughness: 0.38, metalness: 0.75 }));
    const corps = mergeGeometries([
      new THREE.CylinderGeometry(0.085, 0.085, 0.13, 24).rotateZ(Math.PI / 2).translate(xMur + 0.075, POMPE.y, POMPE.z),
      new THREE.BoxGeometry(0.02, 0.27, 0.27).translate(xMur + 0.01, POMPE.y, POMPE.z),
      new THREE.CylinderGeometry(0.03, 0.035, 0.07, 16).translate(xMur + 0.075, POMPE.y + 0.11, POMPE.z - 0.04),
    ].map((g) => preparer(g, [])));
    const mesh = new THREE.Mesh(corps, bronze);
    mesh.name = 'pompe-corps';
    mesh.castShadow = true;
    groupe.add(mesh);
    // le tuyau, de la pompe au plancher (il continue dans la cale : interieur.js)
    noirGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(xMur + 0.075, POMPE.y - 0.08, POMPE.z + 0.03),
      new THREE.Vector3(xMur + 0.07, POMPE.y - 0.3, POMPE.z + 0.06),
      new THREE.Vector3(xMur + 0.06, Y - 0.05, POMPE.z + 0.08),
    ]), 12, 0.022, 8, false));
    const pivot = new THREE.Group();
    pivot.name = 'pompe';
    pivot.position.set(xMur + 0.075, POMPE.y + 0.14, POMPE.z - 0.04);
    const levier = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.6, 10).rotateX(Math.PI / 2).translate(0, 0, 0.3), mat.inox);
    const poignee = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.13, 12).rotateX(Math.PI / 2).translate(0, 0, 0.53), mat.noir);
    levier.castShadow = true;
    pivot.add(levier, poignee);
    groupe.add(pivot);
    i.levierPompe = pivot;
    i.positionPompe = new THREE.Vector3(xMur + 0.075, POMPE.y + 0.14, POMPE.z + 0.36);
  }

  // --- le coupe-batterie : une grosse clé rouge sur sa platine, sur la paroi bâbord, derrière la
  // pompe, près de la porte (quand l'eau noie les batteries, il saute ; on le réarme ici) ---
  {
    const z = 3.62;
    const y = Y + 0.27;
    const xMur = -xLambris(uDe(z), y);
    const rouge = garder(new THREE.MeshStandardMaterial({ color: 0xb3201a, roughness: 0.45 }));
    const pieces = [
      new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24).rotateZ(Math.PI / 2).translate(xMur + 0.025, y, z),
      new THREE.BoxGeometry(0.03, 0.025, 0.1).translate(xMur + 0.05, y, z),
    ];
    const cle = new THREE.Mesh(mergeGeometries(pieces.map((g) => preparer(g, []))), rouge);
    cle.name = 'coupe-batterie';
    groupe.add(cle);
    noirGeos.push(new THREE.BoxGeometry(0.012, 0.14, 0.14).translate(xMur + 0.006, y, z));
    i.cleBatterie = cle;
    i.positionCoupeBatterie = new THREE.Vector3(xMur + 0.06, y, z);
  }

  // --- l'extincteur, contre la paroi arrière, à bâbord de la porte ---
  {
    const x = -0.82;
    const z = Z_AR - 0.055;
    objets.push(teinter(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 16).translate(x, Y + 0.24, z), 0xc0201a));
    noirGeos.push(new THREE.CylinderGeometry(0.018, 0.026, 0.05, 12).translate(x, Y + 0.435, z), entre(x - 0.025, x + 0.025, Y + 0.18, Y + 0.21, z + 0.035, Z_AR));
  }

  // --- le ciré jaune et le gilet, pendus contre la paroi arrière, à tribord de la porte ---
  {
    const xC = 0.84;
    const zC = Z_AR - 0.11;
    const yC = 2.15; // (sous la fenêtre arrière)
    const profilCire = [[0.02, 0], [0.17, -0.02], [0.2, -0.1], [0.215, -0.4], [0.23, -0.72], [0.2, -0.76], [0, -0.76]].map(([r, y]) => new THREE.Vector2(r, y));
    const cireG = new THREE.LatheGeometry(profilCire, 18);
    cireG.scale(1, 1, 0.42);
    cireG.translate(xC, yC, zC);
    const capuche = new THREE.SphereGeometry(0.11, 14, 10);
    capuche.scale(1, 1.15, 0.6);
    capuche.translate(xC, yC - 0.02, zC + 0.03);
    const manches = [1, -1].map((s) => new THREE.CylinderGeometry(0.05, 0.06, 0.55, 10).rotateZ(s * 0.12).translate(xC + s * 0.21, yC - 0.32, zC - 0.01));
    const bandeCire = new THREE.CylinderGeometry(0.218, 0.222, 0.035, 18, 1, true);
    bandeCire.scale(1, 1, 0.42);
    bandeCire.translate(xC, yC - 0.48, zC);
    i.cire = new THREE.Mesh(mergeGeometries([
      ...[cireG, capuche, ...manches].map((g) => teinter(g, 0xf0b400)),
      teinter(bandeCire, 0xb9bec4),
    ].map((g) => preparer(g, ['color']))), mat.objets);
    i.cire.name = 'cire-et-gilet';
    i.cire.castShadow = true;
    i.cire.receiveShadow = true;
    groupe.add(i.cire);
    i.positionCire = new THREE.Vector3(xC, yC - 0.3, zC);
    inoxGeos.push(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6).rotateX(Math.PI / 2).translate(xC, yC + 0.02, Z_AR - 0.04));
  }

  // --- la porte basse de la cabine avant (fermée), dans la cloison, à bâbord de la console :
  // peinte d'un vert sombre, un panneau mouluré, un loquet de laiton et sa serrure, une
  // grille d'aération en bas ---
  {
    const PA = PORTE_AVANT;
    const z = Z_AV - 0.02; // (un peu en retrait de la cloison)
    const xm = (PA.x0 + PA.x1) / 2;
    const peinture = garder(new THREE.MeshStandardMaterial({ color: 0x313b34, roughness: 0.78 }));
    const laiton = garder(new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.85 }));
    const porte = [entre(PA.x0, PA.x1, PA.y0, PA.y1, z - 0.025, z)];
    // (la moulure de son panneau : quatre baguettes ; en dessous, la grille d'aération)
    for (const [y0, y1] of [[PA.y0 + 0.24, PA.y1 - 0.06]]) {
      const x0 = PA.x0 + 0.06;
      const x1 = PA.x1 - 0.06;
      porte.push(entre(x0, x1, y0, y0 + 0.015, z, z + 0.008), entre(x0, x1, y1 - 0.015, y1, z, z + 0.008));
      porte.push(entre(x0, x0 + 0.015, y0, y1, z, z + 0.008), entre(x1 - 0.015, x1, y0, y1, z, z + 0.008));
    }
    const mesh = new THREE.Mesh(mergeGeometries(porte.map((g) => preparer(g, []))), peinture);
    mesh.name = 'porte-cabine-avant';
    mesh.receiveShadow = true;
    groupe.add(mesh);
    // le chambranle : trois baguettes de bois verni sur la face de la cloison, et l'embrasure
    boisGeos.push(uvBois(entre(PA.x0 - 0.03, PA.x0, PA.y0 - 0.02, PA.y1 + 0.03, Z_AV, Z_AV + 0.018)));
    boisGeos.push(uvBois(entre(PA.x1, PA.x1 + 0.025, PA.y0 - 0.02, PA.y1 + 0.03, Z_AV, Z_AV + 0.018)));
    boisGeos.push(uvBois(entre(PA.x0 - 0.03, PA.x1 + 0.025, PA.y1, PA.y1 + 0.03, Z_AV, Z_AV + 0.018)));
    boisGeos.push(uvBois(entre(PA.x0, PA.x0 + 0.005, PA.y0, PA.y1, z, Z_AV)), uvBois(entre(PA.x1 - 0.005, PA.x1, PA.y0, PA.y1, z, Z_AV)));
    // le loquet (une barre de laiton sur sa platine) et l'entrée de la serrure
    const yL = PA.y0 + 0.36;
    const laitons = [
      entre(PA.x1 - 0.12, PA.x1 - 0.03, yL - 0.008, yL + 0.008, z + 0.008, z + 0.022),
      entre(PA.x1 - 0.13, PA.x1 - 0.1, yL - 0.025, yL + 0.025, z, z + 0.008),
      entre(PA.x1 - 0.06, PA.x1 - 0.035, yL - 0.09, yL - 0.04, z, z + 0.004),
    ];
    const mL = new THREE.Mesh(mergeGeometries(laitons.map((g) => preparer(g, []))), laiton);
    mL.name = 'loquet-cabine-avant';
    groupe.add(mL);
    noirGeos.push(entre(PA.x1 - 0.051, PA.x1 - 0.044, yL - 0.08, yL - 0.06, z + 0.004, z + 0.005));
    // la grille d'aération, en bas : des lamelles devant un fond sombre
    noirGeos.push(entre(xm - 0.12, xm + 0.12, PA.y0 + 0.06, PA.y0 + 0.17, z + 0.0005, z + 0.001));
    for (let k = 0; k < 4; k++) {
      const y = PA.y0 + 0.07 + k * 0.025;
      boisGeos.push(uvBois(entre(xm - 0.12, xm + 0.12, y, y + 0.012, z + 0.001, z + 0.008)));
    }
    i.positionPorteAvant = new THREE.Vector3(xm, (PA.y0 + PA.y1) / 2, Z_AV);
  }

  // --- les mains courantes du plafond, de chaque côté, pour se tenir quand ça bouge ---
  for (const s of [1, -1]) {
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const z = 1.7 + (1.8 * k) / 10;
      pts.push(new THREE.Vector3(s * 0.72, toitTimonerie(uDe(z), 0.72) - 0.05 - 0.08, z));
    }
    inoxGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.015, 8, false));
    for (const k of [0, 5, 10]) {
      const p = pts[k];
      inoxGeos.push(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8).translate(p.x, p.y + 0.04, p.z));
    }
  }

  // --- les volets de tempête, et leur commande ---
  construireVolets(i, garder);
  construireCommandeVolets(i, garder);

  // --- les deux plafonniers : au-dessus du siège, et vers la porte ---
  i.lampesTimonerie = [1.95, 3.15].map((zL) => {
    const yL = toitTimonerie(uDe(zL), 0) - 0.05;
    const dome = new THREE.SphereGeometry(0.075, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    dome.scale(1, 0.45, 1);
    const diffuseur = new THREE.Mesh(dome, garder(new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.4 })));
    diffuseur.position.set(0, yL - 0.012, zL);
    groupe.add(diffuseur);
    inoxGeos.push(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24).translate(0, yL - 0.006, zL));
    return { diffuseur, position: new THREE.Vector3(0, yL - 0.07, zL) };
  });
}
