// L'intérieur du voilier : le carré, sous le rouf.
//
// En descendant les marches de la descente, on trouve :
//  - le carré : deux banquettes face à face, la table au milieu (ses abattants repliés),
//    l'épontille (le poteau qui reprend la poussée du mât posé sur le toit), des étagères
//    de livres derrière les dossiers ;
//  - à tribord, la table à cartes et sa carte marine, avec au-dessus la radio VHF (canal 16 :
//    le canal de veille et de détresse, 156,800 MHz), le tableau électrique (feux de
//    navigation, éclairage), le baromètre et la pendule ;
//  - à bâbord, la cuisine (évier, réchaud, bouilloire) ;
//  - à l'avant, la porte de la cabine avant ; à l'arrière, de part et d'autre des marches,
//    les portes des cabines arrière, le ciré jaune et l'extincteur.
// Du bois verni partout, un plancher en teck et houx, des lattes le long de la coque, un
// plafond crème tenu par des tasseaux de teck, des mains courantes pour se tenir.
//
// La lumière : le jour entre par les quatre hublots, le panneau de pont (sur le toit, au-
// dessus de la table) et la descente quand elle est ouverte ; la nuit, deux plafonniers,
// en blanc ou en rouge (le rouge n'éblouit pas : on garde sa vision de nuit pour remonter
// sur le pont). Ces lumières sont calculées DANS les matériaux de la cabine (GLSL_CABINE) :
// des lumières de Three éclaireraient aussi le pont, à travers le rouf.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ROUF, MAT, DESCENTE_ROUF, HUBLOTS, TIMONERIE, zDe, uDe, demiLargeurA, hauteurRouf, hauteurPont, hauteurLivet,
  bordInterieur, bordsHublot, xCoteRouf,
} from './forme.js';
import { PANNEAU_PONT, tranchesCoteRouf, dansUnHublot } from './modele.js';
import { CARRE, TABLE, TREMIE } from '../joueur/pont.js';
import { boite, entre, uvBois, echelleUV, teinter, bande, preparer } from './outils-geometrie.js';
import { construireInterieurTimonerie } from './interieur-timonerie.js';
import { TableauElectrique } from './tableau-electrique.js';
import { texturesBoisVerni, texturesSolCabine, texturesLattes, texturesPlafond, texturesTissu } from './textures.js';
import { ecranRadio, cadranBarometre, cadranPendule, angleBarometre } from './peintures.js';

// ---------- Les mesures de la cabine ----------
const EP = 0.07; // le plafond est 7 cm sous le pont (l'épaisseur du pont et du vaigrage)
const RETRAIT = 0.035; // le vaigrage est à 3,5 cm de la coque
const Y_SOL = CARRE.plancher;
// (le carré va de la cloison avant jusqu'au pied de la timonerie : derrière, sous son
// plancher surélevé, il n'y a plus que la machine et les coffres)
const Z_ARRIERE = TIMONERIE.zAvant; // la contremarche du plancher de la timonerie
const Z_AVANT = CARRE.zAvant - 0.015; // la cloison avant
const U_ARRIERE = uDe(Z_ARRIERE);
const U_AVANT = uDe(Z_AVANT);
const TROU_PANNEAU = PANNEAU_PONT.trou; // l'ouverture du panneau de pont, dans le toit

// Le profil tribord de la cabine dans la tranche u, du plancher au milieu du toit :
// la coque (points 0 à 8), le dessous du passavant (8 à 11), le côté du rouf, où sont
// les hublots (11 à 14), le toit (14 à 19). Le point 16 est au bord du trou de la
// descente, le point 17 au bord de celui du panneau de pont.
function profil(u) {
  const pts = [];
  const xHaut = demiLargeurA(u, hauteurLivet(u) - EP) - RETRAIT;
  const yHaut = hauteurPont(u, xHaut) - EP;
  for (let j = 0; j <= 8; j++) {
    const y = Y_SOL + (yHaut - Y_SOL) * (j / 8);
    pts.push([j === 8 ? xHaut : demiLargeurA(u, y) - RETRAIT, y]);
  }
  const e = bordInterieur(u);
  const xR = e - RETRAIT;
  for (let j = 1; j <= 3; j++) {
    const x = xHaut + (xR - xHaut) * (j / 3);
    pts.push([x, hauteurPont(u, x) - EP]);
  }
  const yR = pts[pts.length - 1][1];
  const xT = e - ROUF.rentree - RETRAIT + 0.01;
  const yT = hauteurRouf(u, xT) - EP;
  for (let j = 1; j <= 3; j++) pts.push([xR + (xT - xR) * (j / 3), yR + (yT - yR) * (j / 3)]);
  const d = DESCENTE_ROUF.demiLargeur;
  for (const x of [(xT + d) / 2, d, TROU_PANNEAU.demiLargeur, TROU_PANNEAU.demiLargeur / 2, 0]) pts.push([x, hauteurRouf(u, x) - EP]);
  return pts;
}
const PARTIES = { coque: [0, 8], passavant: [8, 11], rouf: [11, 14], toit: [14, 19] };

// Les tranches de la cabine, de la cloison arrière à la cloison avant : certaines tombent
// exactement sur les bords du trou de la descente et de l'ouverture du panneau de pont
const TRANCHES = [];
const ajouterTranches = (u0, u1, n, premier) => {
  for (let i = premier ? 0 : 1; i <= n; i++) TRANCHES.push(u0 + ((u1 - u0) * i) / n);
};
const U_PANNEAU_ARRIERE = uDe(TROU_PANNEAU.z1);
const U_PANNEAU_AVANT = uDe(TROU_PANNEAU.z0);
ajouterTranches(U_ARRIERE, U_PANNEAU_ARRIERE, 10, true);
ajouterTranches(U_PANNEAU_ARRIERE, U_PANNEAU_AVANT, 4);
ajouterTranches(U_PANNEAU_AVANT, U_AVANT, 6);
// le trou du plafond : le panneau de pont
const dansUnTrou = (x, z) => Math.abs(x) < TROU_PANNEAU.demiLargeur && z > TROU_PANNEAU.z0 && z < TROU_PANNEAU.z1;
const PROFILS = TRANCHES.map(profil);
// l'abscisse de chaque point le long du profil, depuis le plancher (pour les textures)
const ABSCISSES = PROFILS.map((pts) => {
  const s = [0];
  for (let j = 1; j < pts.length; j++) s.push(s[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
  return s;
});

// Le plafond au-dessus d'un point (x, z) : pour accrocher les lampes et les mains courantes
const plafondEn = (x, z) => hauteurRouf(uDe(z), x) - EP;

// ---------- Petits outils de géométrie ----------

// Le vaigrage de la coque à la hauteur y, à l'endroit z (son x, côté tribord). Plus haut
// que la coque, c'est le dessous du pont : rien ne limite.
function bordCoque(z, y) {
  const u = uDe(z);
  const yHaut = hauteurPont(u, demiLargeurA(u, hauteurLivet(u) - EP) - RETRAIT) - EP;
  if (y >= yHaut) return Infinity;
  return demiLargeurA(u, Math.max(y, Y_SOL)) - RETRAIT;
}
// Rentre dans la coque ce qui en dépasserait : vers l'avant, la coque se resserre (en V),
// et les meubles suivent sa courbe
function epouserLaCoque(g, marge = 0.004) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const max = bordCoque(p.getZ(i), p.getY(i)) - marge;
    if (Math.abs(x) > max) p.setX(i, Math.sign(x) * max);
  }
  g.computeVertexNormals();
  return g;
}
// Un meuble : une boîte découpée (pour pouvoir suivre la coque), en bois
function meuble(x0, x1, y0, y1, z0, z1, nz = 10) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 2, 6, nz);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return uvBois(epouserLaCoque(g));
}


// Une boîte aux arêtes adoucies (coussins)
function coussin(l, h, p, x, y, z) {
  const g = new THREE.BoxGeometry(l, h, p, 4, 3, 12);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // on arrondit en tirant les sommets vers une forme de « savon »
    const ax = Math.abs(v.x) / (l / 2);
    const az = Math.abs(v.z) / (p / 2);
    const ay = v.y / (h / 2);
    const r = Math.max(0, ax * az) * 0.25;
    v.x *= 1 - 0.06 * Math.max(0, ay) * ax;
    v.z *= 1 - 0.06 * Math.max(0, ay) * az;
    v.y -= r * h * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.translate(x, y, z);
  return uvBois(epouserLaCoque(g, 0.01), 4);
}


// Une partie du vaigrage, sur toute la longueur de la cabine : les points [i0..i1] du profil
// de chaque tranche, d'un côté (cote = 1 tribord, -1 bâbord). Les textures y sont posées en
// mètres : u le long du bateau, v le long du profil.
function surfaceCabine([i0, i1], cote, percee = false) {
  const positions = [];
  const uvs = [];
  TRANCHES.forEach((u, i) => {
    for (let j = i0; j <= i1; j++) {
      positions.push(cote * PROFILS[i][j][0], PROFILS[i][j][1], zDe(u));
      uvs.push(zDe(u), ABSCISSES[i][j]);
    }
  });
  const n = i1 - i0 + 1;
  const indices = [];
  for (let i = 0; i < TRANCHES.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      const b = a + n;
      if (percee) {
        // les trous du plafond : on ne pose pas les cases qui sont dedans
        const x = (positions[a * 3] + positions[(a + 1) * 3] + positions[b * 3] + positions[(b + 1) * 3]) / 4;
        const z = (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2;
        if (dansUnTrou(x, z)) continue;
      }
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
const deuxCotes = (partie, percee) => mergeGeometries([surfaceCabine(partie, 1, percee), surfaceCabine(partie, -1, percee)]);

// Le vaigrage du côté du rouf : une droite dans chaque tranche (du point 11 au point 14 du
// profil), percée des hublots. Dans chaque tranche : le bas, le bas et le haut du hublot
// (s'il y en a un), le haut. Les textures : u le long du bateau, v le long de la droite.
function cotesDuRouf() {
  const us = tranchesCoteRouf(TRANCHES);
  const geos = [];
  for (const cote of [1, -1]) {
    const positions = [];
    const uvs = [];
    for (const u of us) {
      const p = profil(u);
      const [xR, yR] = p[11];
      const [xT, yT] = p[14];
      const h = HUBLOTS.find(([ua, ub]) => u >= ua - 1e-9 && u <= ub + 1e-9);
      const b = h ? bordsHublot(u, ...h) : { bas: (yR + yT) / 2, haut: (yR + yT) / 2 };
      const longueur = Math.hypot(xT - xR, yT - yR);
      for (const y of [yR, b.bas, b.haut, yT]) {
        const t = (y - yR) / (yT - yR);
        positions.push(cote * (xR + (xT - xR) * t), y, zDe(u));
        uvs.push(zDe(u) * 2, t * longueur * 2);
      }
    }
    const indices = [];
    for (let i = 0; i < us.length - 1; i++) {
      for (let j = 0; j < 3; j++) {
        if (j === 1 && dansUnHublot(us[i], us[i + 1])) continue;
        const a = i * 4 + j;
        const c = a + 4;
        indices.push(a, c, a + 1, c, c + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    geos.push(g);
  }
  return mergeGeometries(geos);
}

// Le plancher, d'un vaigrage à l'autre (sous les banquettes, il s'arrête à 62 cm de l'axe)
function geometriePlancher() {
  const positions = [];
  const uvs = [];
  const n = 9;
  for (const u of TRANCHES) {
    const xF = Math.min(0.62, demiLargeurA(u, Y_SOL) - RETRAIT);
    for (let j = 0; j < n; j++) {
      const x = -xF + (2 * xF * j) / (n - 1);
      positions.push(x, Y_SOL, zDe(u));
      uvs.push(x, zDe(u));
    }
  }
  const indices = [];
  for (let i = 0; i < TRANCHES.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      const b = a + n;
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

// Une cloison qui ferme la cabine dans la tranche u (à la hauteur z) ; encoche : la porte
// de la descente, de la marche du haut jusqu'au toit
function geometrieCloison(u, z, encoche = null) {
  const pts = profil(u);
  const forme = new THREE.Shape();
  forme.moveTo(pts[0][0], pts[0][1]);
  const dernier = encoche === null ? 19 : 16;
  for (let j = 1; j <= dernier; j++) forme.lineTo(pts[j][0], pts[j][1]);
  if (encoche !== null) {
    forme.lineTo(DESCENTE_ROUF.demiLargeur, encoche);
    forme.lineTo(-DESCENTE_ROUF.demiLargeur, encoche);
  }
  for (let j = encoche === null ? dernier - 1 : dernier; j >= 0; j--) forme.lineTo(-pts[j][0], pts[j][1]);
  const g = new THREE.ShapeGeometry(forme, 2);
  echelleUV(g, 2);
  g.translate(0, 0, z);
  return g;
}

// La paroi arrière du carré (sous la timonerie) : toute la section de la cabine, du
// plancher au plafond, percée de l'ouverture de l'escalier (à bâbord)
function geometrieContremarche() {
  const pts = profil(U_ARRIERE);
  const f = new THREE.Shape();
  const yHaut = 1.3; // (le haut de l'ouverture, sous le plafond du carré)
  f.moveTo(TREMIE.x1, Y_SOL);
  for (let j = 0; j <= 19; j++) f.lineTo(pts[j][0], pts[j][1]);
  for (let j = 18; j >= 0; j--) f.lineTo(-pts[j][0], pts[j][1]);
  f.lineTo(TREMIE.x0, Y_SOL);
  f.lineTo(TREMIE.x0, yHaut);
  f.lineTo(TREMIE.x1, yHaut);
  f.lineTo(TREMIE.x1, Y_SOL);
  const g = new THREE.ShapeGeometry(f, 2);
  echelleUV(g, 2);
  g.translate(0, 0, Z_ARRIERE);
  return g;
}

// Le contour d'un hublot vu de l'intérieur (la même forme profilée que dehors), posé sur
// le vaigrage du côté du rouf (ou sur la face extérieure du rouf). decalage : vers
// l'intérieur de la cabine (m) ; marge : agrandit le contour (m, pour le cadre).
// Renvoie les points du bord haut et du bord bas.
function contourHublot(cote, ua, ub, decalage, marge = 0, exterieur = false) {
  const haut = [];
  const bas = [];
  const n = 16;
  for (let k = 0; k <= n; k++) {
    const u = ua + ((ub - ua) * k) / n;
    const b = bordsHublot(u, ua, ub);
    // (au bout, le cadre déborde un peu le long du bateau)
    const zDebord = marge * (k === 0 ? 1 : k === n ? -1 : 0);
    for (const [y, liste] of [[b.haut + marge, haut], [b.bas - marge, bas]]) {
      let x;
      if (exterieur) {
        x = xCoteRouf(u, y);
      } else {
        // le vaigrage du côté du rouf, dans cette tranche : une droite (points 11 et 14 du profil)
        const p = profil(u);
        const [xR, yR] = p[11];
        const [xT, yT] = p[14];
        x = xR + (xT - xR) * ((y - yR) / (yT - yR));
      }
      liste.push(new THREE.Vector3(cote * (x - decalage), y, zDe(u) + zDebord));
    }
  }
  return { haut, bas, centre: new THREE.Vector3().addVectors(haut[n / 2], bas[n / 2]).multiplyScalar(0.5) };
}


// ---------- L'éclairage de la cabine, dans ses matériaux ----------
//
// Huit « sources » dans le repère du bateau : les deux plafonniers, les quatre hublots,
// la descente et le panneau de pont. Chacune a une position, une direction principale,
// une couleur (son intensité), et une forme : x adoucit l'éclairage tout près (une
// source n'est pas un point), y = la part qui rayonne dans toutes les directions (0 : une
// fenêtre, qui éclaire surtout en face d'elle). On les ajoute aux lumières de Three avec
// sa propre fonction (RE_Direct) : le bois verni a ses reflets, le tissu reste mat.
// Plus une lumière d'ambiance (ce que renvoient les murs), plus faible près du plancher,
// et l'ombre de la table sur le plancher.
const NB_SOURCES = 8;
export const GLSL_CABINE_DECLARATIONS = /* glsl */ `
#define NB_SOURCES ${NB_SOURCES}
uniform mat4 uBateauVersMonde;
uniform vec3 uSourcePos[NB_SOURCES];
uniform vec3 uSourceDir[NB_SOURCES];
uniform vec3 uSourceCouleur[NB_SOURCES];
uniform vec2 uSourceForme[NB_SOURCES];
uniform vec3 uAmbianceCabine;
uniform vec3 uAmbianceTimonerie;
uniform vec4 uTableCabine; // centre (x, z) et demi-dimensions de la table
varying vec3 vPosBateau;

// La timonerie et le carré sont deux pièces : le toit du rouf cache presque toute l'une
// aux lampes de l'autre (elles ne se voient que par l'ouverture de l'escalier)
float dansTimonerie(vec3 p) { return smoothstep(0.2, 0.32, p.z) * smoothstep(0.75, 1.0, p.y); }
float visibiliteSource(int i, vec3 p) {
  if (i < 5) return 1.0 - dansTimonerie(p); // (les lampes, les hublots, le panneau du carré)
  if (i == 6) return 1.0; // (les vitres de la timonerie : il en descend un peu dans le carré)
  return smoothstep(-0.5, 0.3, p.z); // (le plafonnier et les écrans de la timonerie)
}

// La table du carré cache les lampes au plancher et aux banquettes
float ombreTable(vec3 p, vec3 s) {
  const float yTable = 0.44;
  if (p.y > yTable - 0.02 || s.y < yTable) return 1.0;
  float t = (yTable - p.y) / (s.y - p.y);
  vec2 h = p.xz + t * (s.xz - p.xz);
  vec2 d = abs(h - uTableCabine.xy) - uTableCabine.zw;
  return smoothstep(-0.03, 0.05, max(d.x, d.y));
}
`;
export const GLSL_CABINE = /* glsl */ `
{
  mat3 versVue = mat3(viewMatrix) * mat3(uBateauVersMonde);
  for (int i = 0; i < NB_SOURCES; i++) {
    vec3 c = uSourceCouleur[i];
    if (c.r + c.g + c.b < 1e-6) continue;
    vec3 versSource = uSourcePos[i] - vPosBateau;
    float d2 = dot(versSource, versSource);
    vec3 l = versSource * inversesqrt(d2);
    float lobe = mix(max(dot(-l, uSourceDir[i]), 0.0), 1.0, uSourceForme[i].y);
    IncidentLight lumiere;
    lumiere.direction = normalize(versVue * l);
    lumiere.color = c * lobe / (d2 + uSourceForme[i].x) * ombreTable(vPosBateau, uSourcePos[i]) * visibiliteSource(i, vPosBateau);
    lumiere.visible = true;
    RE_Direct(lumiere, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  }
  float occlusion = mix(0.42, 1.0, smoothstep(-0.32, 0.65, vPosBateau.y));
  float zoneTimonerie = smoothstep(0.2, 0.32, vPosBateau.z) * smoothstep(0.45, 0.8, vPosBateau.y);
  irradiance += mix(uAmbianceCabine, uAmbianceTimonerie, zoneTimonerie) * occlusion;
}
`;

// (la même chose qu'en GLSL, pour mesurer la lumière d'une pièce)
const lisse = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
function visibiliteSource(i, p) {
  if (i < 5) return 1 - lisse(0.2, 0.32, p.z) * lisse(0.75, 1.0, p.y);
  if (i === 6) return 1;
  return lisse(-0.5, 0.3, p.z);
}

function eclairerDansLaCabine(materiau, uniforms) {
  materiau.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uMondeVersBateau;\nvarying vec3 vPosBateau;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPosBateau = (uMondeVersBateau * modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_CABINE_DECLARATIONS}`)
      .replace('#include <lights_fragment_end>', `${GLSL_CABINE}\n#include <lights_fragment_end>`);
  };
  materiau.customProgramCacheKey = () => 'cabine-v2';
  return materiau;
}

// Les couleurs des plafonniers (intensité comprise)
const LAMPE_BLANCHE = new THREE.Color(1.0, 0.82, 0.6).multiplyScalar(1.1);
const LAMPE_ROUGE = new THREE.Color(1.0, 0.1, 0.03).multiplyScalar(0.55);
const NOIR = new THREE.Color(0, 0, 0);

export class Interieur {
  constructor(bateau) {
    const m = bateau.materiaux;
    this.groupe = new THREE.Group();
    this.groupe.name = 'interieur';

    // Les réglages partagés par tous les matériaux de la cabine
    this.uniforms = {
      uMondeVersBateau: { value: new THREE.Matrix4() },
      uBateauVersMonde: { value: new THREE.Matrix4() },
      uSourcePos: { value: Array.from({ length: NB_SOURCES }, () => new THREE.Vector3()) },
      uSourceDir: { value: Array.from({ length: NB_SOURCES }, () => new THREE.Vector3(0, -1, 0)) },
      uSourceCouleur: { value: Array.from({ length: NB_SOURCES }, () => new THREE.Color(0, 0, 0)) },
      uSourceForme: { value: Array.from({ length: NB_SOURCES }, () => new THREE.Vector2(0.05, 0)) },
      uAmbianceCabine: { value: new THREE.Color(0, 0, 0) },
      uAmbianceTimonerie: { value: new THREE.Color(0, 0, 0) },
      uTableCabine: { value: new THREE.Vector4(0, (TABLE.z0 + TABLE.z1) / 2, TABLE.demiLargeur + 0.015, (TABLE.z1 - TABLE.z0) / 2) },
    };

    // À l'intérieur, la lumière du ciel n'arrive presque pas (le pont et le rouf la
    // cachent) : les matériaux de la cabine ne gardent qu'un soupçon de « lumière
    // d'environnement » (pour les reflets du vernis). Attention : Three n'applique
    // l'intensité d'un matériau que s'il a SA PROPRE carte d'environnement ; voir
    // fixerEnvironnement, appelée à chaque image.
    const AMBIANCE_DEDANS = 0.015;
    this.materiaux = [];
    const garder = (mat) => {
      mat.envMapIntensity = AMBIANCE_DEDANS;
      mat.side = THREE.DoubleSide;
      eclairerDansLaCabine(mat, this.uniforms);
      this.materiaux.push(mat);
      return mat;
    };
    const bois = texturesBoisVerni();
    const sol = texturesSolCabine();
    const lattes = texturesLattes();
    const plafond = texturesPlafond();
    const tissu = texturesTissu();
    const mat = {
      // le vernis : un bois mat sous une couche brillante
      bois: garder(new THREE.MeshPhysicalMaterial({
        map: bois.couleur, normalMap: bois.normales, normalScale: new THREE.Vector2(0.4, 0.4),
        roughness: 0.55, clearcoat: 0.55, clearcoatRoughness: 0.22,
      })),
      sol: garder(new THREE.MeshPhysicalMaterial({
        map: sol.couleur, normalMap: sol.normales, normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3,
      })),
      lattes: garder(new THREE.MeshStandardMaterial({
        map: lattes.couleur, normalMap: lattes.normales, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.6,
      })),
      plafond: garder(new THREE.MeshStandardMaterial({
        map: plafond.couleur, normalMap: plafond.normales, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.8,
      })),
      tissu: garder(new THREE.MeshStandardMaterial({
        map: tissu.couleur, normalMap: tissu.normales, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.95,
      })),
      plan: garder(new THREE.MeshStandardMaterial({ color: 0xe2dccd, roughness: 0.35 })),
      objets: garder(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })),
      noir: garder(m.noir.clone()),
      inox: garder(m.inox.clone()),
      alu: garder(m.alu.clone()),
    };
    this.mat = mat;
    const ajouter = (g, materiau, nom) => {
      const mesh = new THREE.Mesh(g, materiau);
      mesh.name = nom;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.groupe.add(mesh);
      return mesh;
    };
    const boisGeos = [];
    const inoxGeos = [];
    const noirGeos = [];
    const objets = [];

    // --- la coque, le plafond, le plancher, les cloisons ---
    ajouter(deuxCotes(PARTIES.coque), mat.lattes, 'vaigrages');
    ajouter(mergeGeometries([deuxCotes(PARTIES.passavant), deuxCotes(PARTIES.toit, true)]), mat.plafond, 'plafond');
    ajouter(cotesDuRouf(), mat.bois, 'cotes-du-rouf');
    ajouter(geometriePlancher(), mat.sol, 'plancher');
    boisGeos.push(geometrieCloison(U_AVANT, Z_AVANT));
    boisGeos.push(geometrieContremarche());

    // --- les banquettes : coffres, coussins, dossiers ; derrière, l'étagère et ses livres ---
    const coussins = [];
    const zB0 = Z_AVANT + 0.01;
    const zB1 = 0.105;
    for (const s of [1, -1]) {
      boisGeos.push(meuble(s * 0.56, s * 1.04, Y_SOL, Y_SOL + 0.42, zB0, zB1, 16));
      coussins.push(coussin(0.48, 0.1, 1.42, s * 0.8, Y_SOL + 0.47, (zB0 + zB1) / 2));
      coussins.push(coussin(0.1, 0.42, 1.38, s * 1.03, Y_SOL + 0.78, (zB0 + zB1) / 2));
      // le panneau derrière le dossier, l'étagère et son rebord (le « violon »)
      boisGeos.push(meuble(s * 1.08, s * 1.1, Y_SOL + 0.42, 0.7, zB0 + 0.015, zB1 - 0.015, 16));
      boisGeos.push(meuble(s * 1.08, s * 1.62, 0.68, 0.7, zB0 + 0.04, zB1 - 0.04, 16));
      boisGeos.push(meuble(s * 1.08, s * 1.1, 0.7, 0.765, zB0 + 0.04, zB1 - 0.04, 16));
    }
    ajouter(mergeGeometries(coussins), mat.tissu, 'coussins');
    // les livres : rangés contre le rebord, de toutes les couleurs, le dernier penché
    const couleursLivres = [0x7a1f1f, 0x1f3a5f, 0x2f5233, 0xb8892b, 0x222222, 0xe2dccb, 0x8a4f2a, 0x4b2a5e, 0x9a2f2f, 0x2a4a6a];
    for (const [s, z0, nb] of [[1, -1.02, 13], [-1, -0.78, 7]]) {
      let z = z0;
      for (let k = 0; k < nb; k++) {
        const ep = 0.02 + hasardFixe(k * 3 + s) * 0.03;
        const h = 0.12 + hasardFixe(k * 7 + s) * 0.05; // (sous le plafond du passavant)
        const prof = 0.11 + hasardFixe(k * 5 + s) * 0.05;
        const g = new THREE.BoxGeometry(prof, h, ep);
        if (k === nb - 1) {
          // le dernier livre, penché contre les autres
          g.translate(0, h / 2, -ep / 2);
          g.rotateX(-0.42);
          g.translate(s * (1.11 + prof / 2), 0.7, z + ep);
        } else {
          g.translate(s * (1.11 + prof / 2), 0.7 + h / 2, z + ep / 2);
        }
        objets.push(teinter(g, couleursLivres[(k * 3 + (s > 0 ? 0 : 5)) % couleursLivres.length]));
        z += ep + 0.002;
      }
    }

    // --- la table du carré : le plateau et ses violons, les abattants repliés, le pied ---
    const zT = (TABLE.z0 + TABLE.z1) / 2;
    const lT = TABLE.z1 - TABLE.z0;
    const wT = TABLE.demiLargeur;
    boisGeos.push(uvBois(boite(wT * 2, 0.035, lT, 0, 0.42, zT)));
    for (const s of [1, -1]) {
      boisGeos.push(uvBois(boite(0.015, 0.025, lT, s * (wT - 0.0075), 0.45, zT)));
      boisGeos.push(uvBois(boite(wT * 2, 0.025, 0.015, 0, 0.45, zT + s * (lT / 2 - 0.0075))));
      boisGeos.push(uvBois(boite(0.018, 0.4, lT - 0.04, s * (wT + 0.012), 0.21, zT)));
    }
    boisGeos.push(uvBois(boite(0.07, 0.72, 0.07, 0, Y_SOL + 0.36, zT)));
    boisGeos.push(uvBois(boite(0.26, 0.012, 0.26, 0, Y_SOL + 0.006, zT)));

    // l'épontille, sous le pied de mât
    const yToit = plafondEn(0, zDe(MAT.u));
    const epontille = new THREE.CylinderGeometry(0.045, 0.045, yToit - Y_SOL, 16);
    epontille.translate(0, (yToit + Y_SOL) / 2, zDe(MAT.u));
    ajouter(epontille, mat.alu, 'epontille');

    // --- la porte de la cabine avant ---
    const porte = (x0, x1, y0, y1, z, sens) => {
      boisGeos.push(meuble(x0, x1, y0, y1, z, z + sens * 0.025, 1));
      // l'encadrement : trois baguettes
      boisGeos.push(meuble(x0 - 0.03, x0, y0, y1 + 0.03, z, z + sens * 0.035, 1));
      boisGeos.push(meuble(x1, x1 + 0.03, y0, y1 + 0.03, z, z + sens * 0.035, 1));
      boisGeos.push(meuble(x0 - 0.03, x1 + 0.03, y1, y1 + 0.03, z, z + sens * 0.035, 1));
      const poignee = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10);
      poignee.rotateX(Math.PI / 2);
      poignee.translate(x0 + (x1 - x0) * 0.85, y0 + (y1 - y0) * 0.5, z + sens * 0.04);
      inoxGeos.push(poignee);
      // la grille d'aération en bas de la porte : des lamelles devant un fond sombre
      const xm = (x0 + x1) / 2;
      const l = Math.min(0.24, (x1 - x0) * 0.6);
      noirGeos.push(entre(xm - l / 2, xm + l / 2, y0 + 0.08, y0 + 0.2, z + sens * 0.026, z + sens * 0.027));
      for (let k = 0; k < 5; k++) {
        const y = y0 + 0.09 + k * 0.025;
        boisGeos.push(uvBois(entre(xm - l / 2, xm + l / 2, y, y + 0.012, z + sens * 0.026, z + sens * 0.034)));
      }
    };
    // (la porte avant est décalée sur tribord : l'épontille est au milieu)
    porte(0.1, 0.53, Y_SOL + 0.05, Y_SOL + 1.38, Z_AVANT, 1);

    // --- les mains courantes du plafond, pour se tenir quand ça bouge ---
    for (const s of [1, -1]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const z = 0.15 - (1.33 * k) / 12;
        pts.push(new THREE.Vector3(s * 0.4, plafondEn(0.4, z) - 0.07, z));
      }
      boisGeos.push(uvBois(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.016, 8, false), 4));
      for (const k of [0, 6, 12]) {
        const p = pts[k];
        boisGeos.push(uvBois(boite(0.03, 0.075, 0.04, p.x, p.y + 0.035, p.z), 4));
      }
    }

    // --- les plafonniers ---
    this.lampes = [-0.12, -1.05].map((z) => {
      const y = plafondEn(0, z);
      const dome = new THREE.SphereGeometry(0.075, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      dome.scale(1, 0.45, 1);
      const diffuseur = new THREE.Mesh(dome, garder(new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.4 })));
      diffuseur.position.set(0, y - 0.012, z);
      const socle = new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24);
      socle.translate(0, y - 0.006, z);
      inoxGeos.push(socle);
      this.groupe.add(diffuseur);
      return { diffuseur, position: new THREE.Vector3(0, y - 0.07, z) };
    });

    // --- les hublots vus de l'intérieur : le tunnel entre le vaigrage et le rouf (on voit
    // dehors par la vitre teintée), et un cadre sombre autour ---
    this.hublots = [];
    const tour = (c) => [...c.haut, ...c.bas.slice().reverse(), c.haut[0]];
    for (const s of [1, -1]) {
      for (const [ua, ub] of HUBLOTS) {
        const bordDedans = contourHublot(s, ua, ub, 0);
        const bordDehors = contourHublot(s, ua, ub, 0, 0, true);
        noirGeos.push(bande(tour(bordDedans), tour(bordDehors)));
        const cadreDedans = contourHublot(s, ua, ub, 0.006);
        const cadreDehors = contourHublot(s, ua, ub, 0.006, 0.014);
        noirGeos.push(bande(tour(cadreDedans), tour(cadreDehors)));
        // la lumière de ce hublot : au milieu, tournée vers l'intérieur de la cabine (la
        // pente du vaigrage tournée d'un quart de tour) et un peu vers le bas
        const p = profil((ua + ub) / 2);
        const t = new THREE.Vector2(p[14][0] - p[11][0], p[14][1] - p[11][1]).normalize();
        this.hublots.push({ position: bordDedans.centre.clone(), direction: new THREE.Vector3(-s * t.y, -0.25 * Math.abs(t.x), 0).normalize() });
      }
    }

    // --- le panneau de pont, vu d'en dessous : le tunnel jusqu'au toit (on voit le ciel,
    // le mât et la grand-voile par le plexiglas fumé) et un encadrement de teck ---
    const T = TROU_PANNEAU;
    const zP = (T.z0 + T.z1) / 2;
    const yP = plafondEn(T.demiLargeur, zP);
    for (const [a, b] of [[[-1, T.z0], [1, T.z0]], [[-1, T.z1], [1, T.z1]], [[-1, T.z0], [-1, T.z1]], [[1, T.z0], [1, T.z1]]]) {
      const haut = [];
      const bas = [];
      for (let k = 0; k <= 6; k++) {
        // (2 mm en retrait du bord du trou, et sous le cadre d'aluminium du dessus : sinon
        // les deux surfaces se confondent et se disputent l'image)
        const x = (T.demiLargeur - 0.002) * (a[0] + ((b[0] - a[0]) * k) / 6);
        const z = a[1] + ((b[1] - a[1]) * k) / 6 + (a[1] === b[1] ? (a[1] === T.z0 ? 0.002 : -0.002) : 0);
        haut.push(new THREE.Vector3(x, hauteurRouf(uDe(z), x) - 0.012, z));
        bas.push(new THREE.Vector3(x, plafondEn(x, z) - 0.002, z));
      }
      boisGeos.push(uvBois(bande(haut, bas)));
    }
    for (const s of [1, -1]) {
      const w = T.demiLargeur;
      boisGeos.push(uvBois(entre(s * w - 0.035 * s, s * w + 0.015 * s, yP - 0.03, yP + 0.012, T.z0 - 0.035, T.z1 + 0.035)));
      const zBord = s > 0 ? T.z1 : T.z0;
      boisGeos.push(uvBois(entre(-w - 0.015, w + 0.015, yP - 0.03, yP + 0.012, zBord - 0.035 * s, zBord + 0.015 * s)));
    }

    // --- le ciré jaune et le gilet, pendus au pied de l'escalier (à tribord de l'ouverture) ---
    const xC = 0.34;
    const zC = Z_ARRIERE - 0.095;
    const profilCire = [[0.02, 0], [0.17, -0.02], [0.2, -0.1], [0.215, -0.4], [0.23, -0.72], [0.2, -0.76], [0, -0.76]].map(([r, y]) => new THREE.Vector2(r, y));
    const cireG = new THREE.LatheGeometry(profilCire, 18);
    cireG.scale(1, 1, 0.42);
    cireG.translate(xC, 1.1, zC);
    const capuche = new THREE.SphereGeometry(0.11, 14, 10);
    capuche.scale(1, 1.15, 0.6);
    capuche.translate(xC, 1.08, zC + 0.03);
    const manches = [1, -1].map((s) => new THREE.CylinderGeometry(0.05, 0.06, 0.55, 10).rotateZ(s * 0.12).translate(xC + s * 0.21, 0.78, zC - 0.01));
    const bandeCire = new THREE.CylinderGeometry(0.218, 0.222, 0.035, 18, 1, true);
    bandeCire.scale(1, 1, 0.42);
    bandeCire.translate(xC, 0.62, zC);
    this.cire = new THREE.Mesh(mergeGeometries([
      ...[cireG, capuche, ...manches].map((g) => teinter(g, 0xf0b400)),
      teinter(bandeCire, 0xb9bec4),
    ].map((g) => preparer(g, ['color']))), mat.objets);
    this.cire.name = 'cire-et-gilet';
    this.cire.castShadow = true;
    this.cire.receiveShadow = true;
    this.groupe.add(this.cire);
    this.positionCire = new THREE.Vector3(xC, 0.8, zC);
    inoxGeos.push(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6).rotateX(Math.PI / 2).translate(xC, 1.12, Z_ARRIERE - 0.03));

    // --- la timonerie (interieur-timonerie.js) : son plancher, son escalier, la console, le
    // siège de quart, la cuisine, la VHF et le tableau électrique… ---
    this.radio = ecranRadio();
    construireInterieurTimonerie(this, {
      mat, garder, ajouter, boisGeos, inoxGeos, noirGeos, objets,
      cadrans: { barometre: cadranBarometre(), pendule: cadranPendule() },
    });
    // le tableau électrique, sur le pupitre de la console
    this.tableau = new TableauElectrique(this.groupe, { noir: mat.noir, inox: mat.inox, garder });
    this.positionTableau = this.tableau.position.clone();

    // tout le bois verni en un seul objet ; de même pour l'inox, le noir et les objets
    ajouter(mergeGeometries(boisGeos.map((g) => preparer(g, ['uv']))), mat.bois, 'boiseries');
    ajouter(mergeGeometries(inoxGeos.map((g) => preparer(g, []))), mat.inox, 'inox');
    ajouter(mergeGeometries(noirGeos.map((g) => preparer(g, []))), mat.noir, 'noir');
    ajouter(mergeGeometries(objets.map((g) => preparer(g, ['color']))), mat.objets, 'objets');

    // ---------- Les sources de lumière ----------
    const u = this.uniforms;
    const placer = (i, position, direction, forme) => {
      u.uSourcePos.value[i].copy(position);
      u.uSourceDir.value[i].copy(direction).normalize();
      u.uSourceForme.value[i].copy(forme);
    };
    // 0, 1 : les plafonniers du carré ; 2, 3 : ses deux hublots ; 4 : le panneau de pont ;
    // 5 : le plafonnier de la timonerie ; 6 : ses vitres (le jour, la timonerie est pleine de
    // lumière, et il en descend un peu dans le carré) ; 7 : la lueur des écrans de la console
    this.lampes.forEach((l, i) => placer(i, l.position, new THREE.Vector3(0, -1, 0), new THREE.Vector2(0.03, 0.35)));
    // (un hublot éclaire aussi vers le haut : la lumière renvoyée par la mer et le pont)
    this.hublots.forEach((h, i) => placer(2 + i, h.position, h.direction, new THREE.Vector2(0.04, 0.15)));
    placer(4, new THREE.Vector3(0, yP + EP * 0.5, zP), new THREE.Vector3(0, -1, 0), new THREE.Vector2(0.06, 0.05));
    placer(5, this.lampeTimonerie.position, new THREE.Vector3(0, -1, 0), new THREE.Vector2(0.03, 0.35));
    placer(6, new THREE.Vector3(0, 1.95, 0.86), new THREE.Vector3(0, -1, 0), new THREE.Vector2(0.45, 0.6));
    placer(7, new THREE.Vector3(0.49, 1.36, 0.52), new THREE.Vector3(0, 0.45, 0.89), new THREE.Vector2(0.02, 0.15));
    // où l'on mesure la lumière de la cabine (pour l'œil qui s'habitue) : au milieu du carré
    this.pointMesure = new THREE.Vector3(0, 0.6, -0.3);
    this.pointMesureTimonerie = new THREE.Vector3(0, 1.6, 0.95);
    this.luminance = 0;
    this.luminanceTimonerie = 0;

    this.eclairage = 'eteint';
    this._ciel = new THREE.Color();
    this._chaud = new THREE.Color();
    bateau.groupe.add(this.groupe);
  }

  // Suit le bateau (à chaque image, après l'avoir placé) : pour passer du repère du monde
  // à celui du bateau dans les matériaux de la cabine
  suivre(groupe) {
    const u = this.uniforms;
    u.uBateauVersMonde.value.compose(groupe.position, groupe.quaternion, groupe.scale);
    u.uMondeVersBateau.value.copy(u.uBateauVersMonde.value).invert();
  }

  // La lumière du ciel, très atténuée, pour les reflets du vernis
  fixerEnvironnement(texture) {
    if (!texture) return;
    for (const m of this.materiaux) {
      if (m.envMap !== texture) {
        m.envMap = texture;
        m.needsUpdate = true;
      }
    }
  }

  // Réglé à chaque image.
  //   eclairage : 'eteint', 'blanc' ou 'rouge' (les plafonniers) ; feux : les feux de
  //   navigation sont-ils allumés (le voyant du tableau) ; ciel : [r, g, b], la lumière du
  //   ciel (eclairage(meteo).ambiance) ; eclair : un éclair illumine les hublots ;
  //   descente : 0 (fermée) → 1 (ouverte) ; pression (hPa) et heure, pour les cadrans ;
  //   temoin (hPa) : l'aiguille témoin du baromètre, calée à la main
  //   vacille : 0 → 1, la lumière des plafonniers (1 : normale ; moins : elle faiblit, quand
  //   le courant hésite) ; pilotePanne : le disjoncteur du pilote a sauté (le tableau) ;
  //   nuit : 0 → 1 (les noms du tableau s'éclairent) ; dt : le temps écoulé
  regler({
    eclairage, feux, ciel, eclair = 0, descente = 1, pression = 1015, temoin = null, heure = 12, vacille = 1, pilotePanne = false, nuit = 0, dt = 0,
  }) {
    this.eclairage = eclairage;
    const u = this.uniforms;
    const S = u.uSourceCouleur.value;
    // la luminance du ciel vue par une ouverture (sa lumière ramenée à un angle solide),
    // un peu réchauffée : par les hublots entre aussi le soleil renvoyé par le pont et la mer
    const L = this._ciel.fromArray(ciel).multiplyScalar(1 / Math.PI);
    const lum = 0.2126 * L.r + 0.7152 * L.g + 0.0722 * L.b;
    L.lerp(this._chaud.setRGB(lum * 1.08, lum * 0.98, lum * 0.84), 0.45);
    L.r += eclair * 0.6;
    L.g += eclair * 0.65;
    L.b += eclair * 0.8;
    const lampe = eclairage === 'blanc' ? LAMPE_BLANCHE : eclairage === 'rouge' ? LAMPE_ROUGE : NOIR;
    // (le plafonnier de la timonerie est plus faible : on y veille la nuit, il ne doit pas
    // éblouir — on garde sa vision de nuit pour voir dehors, par les vitres ; en rouge, ce
    // n'est plus qu'une veilleuse : le bois sombre, les écrans pour seule vraie lumière)
    const kTimonerie = eclairage === 'rouge' ? 0.07 : 0.35;
    for (const [i, l, k] of [[0, this.lampes[0], 1], [1, this.lampes[1], 1], [5, this.lampeTimonerie, kTimonerie]]) {
      S[i].copy(lampe).multiplyScalar(k * vacille);
      l.diffuseur.material.emissive.copy(lampe).multiplyScalar(3.2 * k * vacille);
    }
    // les hublots du carré (≈ 4 dm² de vitre chacun), le panneau de pont (un plexiglas fumé :
    // 35 % passe), les grandes vitres de la timonerie (et sa porte, quand elle est ouverte)
    S[2].copy(L).multiplyScalar(0.07);
    S[3].copy(L).multiplyScalar(0.07);
    S[4].copy(L).multiplyScalar(0.18 * 0.6);
    S[6].copy(L).multiplyScalar(0.5 + 0.08 * descente);
    // (les écrans de la console : une faible lueur verte, toujours là)
    S[7].setRGB(0.0012, 0.004, 0.0028);

    // la lumière qui arrive au milieu du carré et au milieu de la timonerie, et celle que
    // renvoient les murs crème
    const mesurer = (pm) => {
      const c = [0, 0, 0];
      for (let i = 0; i < NB_SOURCES; i++) {
        const p = u.uSourcePos.value[i];
        const dx = pm.x - p.x;
        const dy = pm.y - p.y;
        const dz = pm.z - p.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        const dir = u.uSourceDir.value[i];
        const cos = Math.max(0, (dx * dir.x + dy * dir.y + dz * dir.z) / Math.sqrt(d2));
        const forme = u.uSourceForme.value[i];
        const k = (forme.y + (1 - forme.y) * cos) / (d2 + forme.x) * visibiliteSource(i, pm);
        c[0] += S[i].r * k;
        c[1] += S[i].g * k;
        c[2] += S[i].b * k;
      }
      return c;
    };
    const [r, g, b] = mesurer(this.pointMesure);
    const timonerie = mesurer(this.pointMesureTimonerie);
    // (renvoyée par une cabine de bois verni : la lumière d'ambiance est plus chaude)
    u.uAmbianceCabine.value.setRGB(r * 0.6, g * 0.54, b * 0.45);
    u.uAmbianceTimonerie.value.setRGB(timonerie[0] * 0.6, timonerie[1] * 0.54, timonerie[2] * 0.45);
    // (une lumière très colorée, comme le rouge, compte un peu plus que sa luminance :
    // sinon l'œil s'y habituerait jusqu'à voir la cabine en plein jour… rouge)
    const luminance = ([cr, cg, cb]) => 1.45 * Math.max(0.2126 * cr + 0.7152 * cg + 0.0722 * cb, 0.45 * Math.max(cr, cg, cb));
    this.luminance = luminance([r, g, b]);
    this.luminanceTimonerie = luminance(timonerie);

    // le tableau (ses voyants et ses leviers), l'aiguille du baromètre, les aiguilles de la pendule
    this.tableau.regler(dt, { feux, eclairage, pilotePanne, nuit, vacille });
    this.aiguilles.pression.rotation.z = -angleBarometre(pression);
    this.aiguilles.temoin.rotation.z = -angleBarometre(temoin ?? pression);
    const h = ((heure % 12) + 12) % 12;
    this.aiguilles.heures.rotation.z = -(h / 12) * Math.PI * 2;
    this.aiguilles.minutes.rotation.z = -(h % 1) * Math.PI * 2;
  }

  // L'exposition qui convient à la cabine (l'œil qui s'habitue) : comme dehors, plus il
  // fait sombre, plus on ouvre… mais pas sans limite (la nuit, une cabine éteinte reste noire).
  // timonerie : on y est (sa lumière à elle)
  exposition(nuit, timonerie = false) {
    const e = 1.8 / Math.pow((timonerie ? this.luminanceTimonerie : this.luminance) + 0.002, 0.72);
    return THREE.MathUtils.clamp(e, 0.6, THREE.MathUtils.lerp(9, 3.2, nuit));
  }
}

// Un « hasard » fixe (toujours le même pour le même nombre) : les livres ne changent pas
function hasardFixe(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

