// L'intérieur du voilier : la timonerie (interieur-timonerie.js) et, sous son plancher, la
// cale, qu'on voit par la trappe.
//
// La cale : le fond de la coque, peint en gris, de la cloison de la cabine avant à celle de
// la machine ; les varangues (les poutres de bois en travers du fond) et les écrous des
// boulons de quille ; la crépine de la pompe et son tuyau ; sur leur étagère, juste sous la
// trappe, les batteries (l'eau, si elle monte, finira par les noyer) ; une baladeuse (une
// ampoule dans sa cage) pendue sous le plancher. L'eau qui entre s'y voit (eau-a-bord.js).
//
// La lumière : la nuit, deux plafonniers dans la timonerie, en blanc ou en rouge (le rouge
// n'éblouit pas : on garde sa vision de nuit pour voir dehors) ; ce qui entre par les vitres
// (le ciel, les éclairs : les volets fermés le coupent) ; la lueur des écrans de la console ;
// et la baladeuse de la cale. Ces lumières sont calculées DANS les matériaux de l'intérieur
// (GLSL_CABINE) : des lumières de Three éclaireraient aussi le pont, à travers les parois.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TIMONERIE, TRAPPE_CALE, uDe, demiLargeur, fondCoque, hauteurLivet, profilSection, exposantSection, bordInterieur,
} from './forme.js';
import { entre, uvBois, teinter, preparer } from './outils-geometrie.js';
import { construireInterieurTimonerie, COTES_VOLETS } from './interieur-timonerie.js';
import { formeBattant } from './timonerie.js';
import { TableauElectrique } from './tableau-electrique.js';
import { texturesBoisVerni, texturesSolCabine, texturesPlafond } from './textures.js';
import { ecranRadio, cadranBarometre, cadranPendule, angleBarometre } from './peintures.js';

// ---------- La cale ----------
const Y = TIMONERIE.plancher;
const RETRAIT = 0.035; // la peinture de la cale : sur la coque, 3,5 cm à l'intérieur
const Y_PLAFOND = Y - 0.04; // le dessous du plancher
const Z_AR = TIMONERIE.zArriere - 0.035; // la cloison de la machine
const Z_AV = TIMONERIE.zAvant + 0.03; // la cloison de la cabine avant
// La cale, au niveau de l'eau qui monte : où commence son fond (fondCoque), et jusqu'où
// l'eau peut monter avant de passer sur le plancher de la timonerie
export const CALE = { fond: Math.min(fondCoque(uDe(Z_AR)), fondCoque(uDe(Z_AV))), plancher: Y, zArriere: Z_AR, zAvant: Z_AV };

// Le profil de la cale (côté tribord) dans la tranche u : la coque, de la quille au dessous
// du plancher, puis le dessous du plancher jusqu'au bord de la timonerie. Points [x, y].
function profilCale(u) {
  const bas = fondCoque(u);
  const haut = hauteurLivet(u);
  const sMax = (Y_PLAFOND - bas) / (haut - bas);
  const pts = [];
  const n = 14;
  for (let k = 0; k <= n; k++) {
    // (plus serré en bas, où la coque tourne)
    const s = sMax * Math.pow(k / n, 1.7);
    const x = Math.max(0, demiLargeur(u) * profilSection(s, exposantSection(u)) - RETRAIT);
    pts.push([x, bas + (haut - bas) * s + 0.03 * (1 - s / sMax)]);
  }
  pts.push([bordInterieur(uDe(TIMONERIE.zArriere)) - 0.05, Y_PLAFOND]);
  return pts;
}

// La coque vue de la cale, d'un côté : une colonne de points par tranche
function geometrieCoqueCale(cote) {
  const positions = [];
  const uvs = [];
  const nz = 16;
  let n = 0;
  for (let i = 0; i <= nz; i++) {
    const z = Z_AR + ((Z_AV - Z_AR) * i) / nz;
    const pts = profilCale(uDe(z));
    n = pts.length;
    let l = 0;
    pts.forEach(([x, y], j) => {
      if (j > 0) l += Math.hypot(x - pts[j - 1][0], y - pts[j - 1][1]);
      positions.push(cote * x, y, z);
      uvs.push(z, l);
    });
  }
  const indices = [];
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      const b = a + n;
      // (les faces tournées vers l'intérieur de la cale)
      if (cote > 0) indices.push(a, a + 1, b, b, a + 1, b + 1);
      else indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Une cloison de la cale (dans la tranche de z) : toute sa section
function geometrieCloisonCale(z) {
  const pts = profilCale(uDe(z));
  const forme = new THREE.Shape();
  forme.moveTo(0, pts[0][1]);
  for (const [x, y] of pts) forme.lineTo(x, y);
  for (let j = pts.length - 1; j >= 0; j--) forme.lineTo(-pts[j][0], pts[j][1]);
  const g = new THREE.ShapeGeometry(forme, 2);
  g.translate(0, 0, z);
  return uvBois(g.toNonIndexed());
}

// La hauteur de la coque (le fond de la cale) en x, dans la tranche u
function fondEn(u, x) {
  const pts = profilCale(u);
  for (let j = 1; j < pts.length; j++) {
    if (pts[j][0] >= Math.abs(x)) {
      const [x0, y0] = pts[j - 1];
      const [x1, y1] = pts[j];
      return y0 + (y1 - y0) * ((Math.abs(x) - x0) / Math.max(1e-6, x1 - x0));
    }
  }
  return Y_PLAFOND;
}

// Une varangue : une poutre de bois posée en travers du fond (son dessous épouse la coque),
// le dessus droit, à 25 cm au-dessus de la quille
function geometrieVarangue(z) {
  const u = uDe(z);
  const yHaut = fondCoque(u) + 0.25;
  const forme = new THREE.Shape();
  const xs = [];
  for (let k = 0; k <= 20; k++) xs.push(-1 + (2 * k) / 20);
  // (jusqu'où va le dessus : là où la coque remonte à sa hauteur)
  let xMax = 0.1;
  while (xMax < 2 && fondEn(u, xMax) < yHaut - 0.01) xMax += 0.02;
  forme.moveTo(-xMax, yHaut);
  for (const t of xs) forme.lineTo(t * xMax, fondEn(u, t * xMax));
  forme.lineTo(xMax, yHaut);
  forme.lineTo(-xMax, yHaut);
  const g = new THREE.ExtrudeGeometry(forme, { depth: 0.08, bevelEnabled: false });
  g.translate(0, 0, z - 0.04);
  return uvBois(g.toNonIndexed());
}

// ---------- L'éclairage de l'intérieur, dans ses matériaux ----------
//
// Huit « sources » dans le repère du bateau : les deux plafonniers de la timonerie, ses
// vitres (le pare-brise, chaque côté, l'arrière et la porte), la lueur des écrans de la
// console, la baladeuse de la cale. Chacune a une position, une direction principale, une
// couleur (son intensité), et une forme : x adoucit l'éclairage tout près (une source n'est
// pas un point), y = la part qui rayonne dans toutes les directions (0 : une fenêtre, qui
// éclaire surtout en face d'elle). On les ajoute aux lumières de Three avec sa propre
// fonction (RE_Direct) : le bois verni a ses reflets, le tissu reste mat.
// Plus une lumière d'ambiance (ce que renvoient les murs), dans la timonerie et dans la cale.
// La cale ne reçoit que la baladeuse, et un peu de la timonerie quand la trappe est ouverte.
const NB_SOURCES = 8;
const BALADEUSE = 7;
const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));
export const GLSL_CABINE_DECLARATIONS = /* glsl */ `
#define NB_SOURCES ${NB_SOURCES}
uniform mat4 uBateauVersMonde;
uniform vec3 uSourcePos[NB_SOURCES];
uniform vec3 uSourceDir[NB_SOURCES];
uniform vec3 uSourceCouleur[NB_SOURCES];
uniform vec2 uSourceForme[NB_SOURCES];
uniform vec3 uAmbianceCabine;
uniform vec3 uAmbianceTimonerie;
uniform float uTrappe;
varying vec3 vPosBateau;

// sous le plancher de la timonerie : la cale
float dansLaCale(vec3 p) { return 1.0 - smoothstep(${f(Y - 0.06)}, ${f(Y - 0.01)}, p.y); }
float visibiliteSource(int i, vec3 p) {
  float cale = dansLaCale(p);
  if (i == ${BALADEUSE}) return cale;
  return mix(1.0, uTrappe * 0.3, cale);
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
    lumiere.color = c * lobe / (d2 + uSourceForme[i].x) * visibiliteSource(i, vPosBateau);
    lumiere.visible = true;
    RE_Direct(lumiere, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  }
  float cale = dansLaCale(vPosBateau);
  // (moins de lumière renvoyée près du plancher, et au fond de la cale)
  float occlusion = mix(mix(0.55, 1.0, smoothstep(${f(Y)}, ${f(Y + 0.9)}, vPosBateau.y)), mix(0.35, 0.8, smoothstep(${f(CALE.fond)}, ${f(Y)}, vPosBateau.y)), cale);
  irradiance += mix(uAmbianceTimonerie, uAmbianceCabine, cale) * occlusion;
}
`;

// (la même chose qu'en GLSL, pour mesurer la lumière d'un endroit)
const lisse = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
function visibiliteSource(i, p, trappe) {
  const cale = 1 - lisse(Y - 0.06, Y - 0.01, p.y);
  if (i === BALADEUSE) return cale;
  return 1 + (trappe * 0.3 - 1) * cale;
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
  materiau.customProgramCacheKey = () => 'cabine-v3';
  return materiau;
}

// Les couleurs des plafonniers (intensité comprise)
const LAMPE_BLANCHE = new THREE.Color(1.0, 0.82, 0.6).multiplyScalar(1.1);
const LAMPE_ROUGE = new THREE.Color(1.0, 0.1, 0.03).multiplyScalar(0.55);
const AMPOULE = new THREE.Color(1.0, 0.62, 0.3).multiplyScalar(0.45);
const NOIR = new THREE.Color(0, 0, 0);
// les vitres de chaque côté : où est leur lumière, vers où elle va (sources 2 à 5)
const VITRES = {
  avant: { source: 2, position: [0, 2.55, 1.0], direction: [0, -0.35, 1], surface: 1.0 },
  tribord: { source: 3, position: [1.15, 2.5, 2.35], direction: [-1, -0.35, 0], surface: 0.85 },
  babord: { source: 4, position: [-1.15, 2.5, 2.35], direction: [1, -0.35, 0], surface: 0.85 },
  arriere: { source: 5, position: [0, 2.4, 3.65], direction: [0, -0.3, -1], surface: 0.3 },
};

export class Interieur {
  constructor(bateau) {
    const m = bateau.materiaux;
    this.groupe = new THREE.Group();
    this.groupe.name = 'interieur';

    // Les réglages partagés par tous les matériaux de l'intérieur
    this.uniforms = {
      uMondeVersBateau: { value: new THREE.Matrix4() },
      uBateauVersMonde: { value: new THREE.Matrix4() },
      uSourcePos: { value: Array.from({ length: NB_SOURCES }, () => new THREE.Vector3()) },
      uSourceDir: { value: Array.from({ length: NB_SOURCES }, () => new THREE.Vector3(0, -1, 0)) },
      uSourceCouleur: { value: Array.from({ length: NB_SOURCES }, () => new THREE.Color(0, 0, 0)) },
      uSourceForme: { value: Array.from({ length: NB_SOURCES }, () => new THREE.Vector2(0.05, 0)) },
      uAmbianceCabine: { value: new THREE.Color(0, 0, 0) },
      uAmbianceTimonerie: { value: new THREE.Color(0, 0, 0) },
      uTrappe: { value: 0 },
    };

    // À l'intérieur, la lumière du ciel n'arrive que par les vitres (calculée à part) : les
    // matériaux ne gardent qu'un soupçon de « lumière d'environnement » (pour les reflets du
    // vernis). Attention : Three n'applique l'intensité d'un matériau que s'il a SA PROPRE
    // carte d'environnement ; voir fixerEnvironnement, appelée à chaque image.
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
    const plafond = texturesPlafond();
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
      plafond: garder(new THREE.MeshStandardMaterial({
        map: plafond.couleur, normalMap: plafond.normales, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.8,
      })),
      // la cale : la coque peinte en gris (mouillée, elle brille un peu), le bois brut des varangues
      cale: garder(new THREE.MeshStandardMaterial({ color: 0x77797a, roughness: 0.42 })),
      boisCale: garder(new THREE.MeshStandardMaterial({ map: bois.couleur, color: 0x8a7a6a, roughness: 0.85 })),
      acier: garder(new THREE.MeshStandardMaterial({ color: 0x45484b, roughness: 0.5, metalness: 0.8 })),
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

    // --- la cale : la coque, ses deux cloisons, les varangues et les boulons de quille ---
    ajouter(mergeGeometries([geometrieCoqueCale(1), geometrieCoqueCale(-1), geometrieCloisonCale(Z_AR + 0.001), geometrieCloisonCale(Z_AV - 0.001)].map((g) => preparer(g, ['uv']))), mat.cale, 'cale');
    const varangues = [];
    const acier = [];
    for (let z = Z_AV + 0.3; z < Z_AR - 0.15; z += 0.5) {
      varangues.push(geometrieVarangue(z));
      // (sur les trois du milieu, les écrous des boulons de la quille)
      if (z > 1.4 && z < 2.9) {
        const yH = fondCoque(uDe(z)) + 0.25;
        for (const x of [-0.07, 0.07]) {
          acier.push(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 20).translate(x, yH + 0.003, z));
          acier.push(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 6).translate(x, yH + 0.021, z));
          acier.push(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10).translate(x, yH + 0.03, z));
        }
      }
    }
    ajouter(mergeGeometries(varangues.map((g) => preparer(g, ['uv']))), mat.boisCale, 'varangues');

    // --- les batteries, sur leur étagère, juste sous la trappe (à bâbord de son milieu) ---
    {
      const t = TRAPPE_CALE;
      const x0 = t.x0 - 0.02;
      const x1 = t.x0 + 0.34;
      const z0 = t.z0 + 0.06;
      const z1 = t.z1 - 0.06;
      const yE = 0.2;
      const etagere = [uvBois(entre(x0 - 0.03, x1 + 0.03, yE - 0.03, yE, z0 - 0.03, z1 + 0.03))];
      // (ses deux pieds, jusqu'au fond)
      for (const z of [z0, z1]) {
        const yF = fondEn(uDe(z), (x0 + x1) / 2);
        etagere.push(uvBois(entre(x0, x1, yF - 0.02, yE - 0.03, z - 0.02, z + 0.02)));
      }
      ajouter(mergeGeometries(etagere.map((g) => preparer(g, ['uv']))), mat.boisCale, 'etagere-batteries');
      const h = 0.3;
      for (const [za, zb] of [[z0, (z0 + z1) / 2 - 0.01], [(z0 + z1) / 2 + 0.01, z1]]) {
        objets.push(teinter(entre(x0, x1, yE, yE + h, za, zb), 0x26292c));
        objets.push(teinter(entre(x0 + 0.01, x1 - 0.01, yE + h, yE + h + 0.012, za + 0.01, zb - 0.01), 0x33373a));
        // les bornes : rouge (+) et noire (−)
        const zm = (za + zb) / 2;
        objets.push(teinter(new THREE.CylinderGeometry(0.015, 0.018, 0.035, 12).translate(x0 + 0.06, yE + h + 0.03, zm), 0xb3201a));
        objets.push(teinter(new THREE.CylinderGeometry(0.015, 0.018, 0.035, 12).translate(x1 - 0.06, yE + h + 0.03, zm), 0x151515));
      }
      // les gros câbles, qui montent vers le tableau
      const cable = (x, couleur) => objets.push(teinter(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, yE + h + 0.05, (z0 + z1) / 2), new THREE.Vector3(x, yE + h + 0.2, z0 - 0.05), new THREE.Vector3(x + 0.1, Y_PLAFOND - 0.02, z0 - 0.4),
      ]), 16, 0.012, 8, false), couleur));
      cable(x0 + 0.06, 0xb3201a);
      cable(x1 - 0.06, 0x151515);
      this.batteries = { x0, x1, z0, z1, bas: yE, haut: yE + h };
    }

    // --- la crépine de la pompe, au fond, et son tuyau qui monte vers la pompe à main ---
    {
      // (il passe derrière les batteries, contre la coque)
      const zC = 3.2;
      const yF = fondEn(uDe(zC), 0.35);
      noirGeos.push(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16).translate(-0.35, yF + 0.06, zC));
      noirGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.35, yF + 0.11, zC), new THREE.Vector3(-0.6, yF + 0.3, zC + 0.05),
        new THREE.Vector3(-1.15, 0.35, zC), new THREE.Vector3(-1.29, Y_PLAFOND - 0.02, 2.92),
      ]), 24, 0.022, 8, false));
    }

    // --- la baladeuse : une ampoule dans sa cage, pendue sous le plancher, devant la trappe ---
    {
      const pos = new THREE.Vector3(-0.35, Y_PLAFOND - 0.16, TRAPPE_CALE.z0 - 0.2);
      this.ampoule = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), garder(new THREE.MeshStandardMaterial({ color: 0xf2e6cc, roughness: 0.3, emissive: 0x000000 })));
      this.ampoule.position.copy(pos);
      this.groupe.add(this.ampoule);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        noirGeos.push(new THREE.TorusGeometry(0.045, 0.003, 4, 16).rotateY(a).translate(pos.x, pos.y, pos.z));
      }
      noirGeos.push(new THREE.CylinderGeometry(0.004, 0.004, Y_PLAFOND - pos.y - 0.04, 6).translate(pos.x, (Y_PLAFOND + pos.y + 0.04) / 2, pos.z));
      this.positionAmpoule = pos;
    }

    // --- la timonerie (interieur-timonerie.js) : son plancher, la console, le siège, la
    // banquette, la pompe, la trappe, la porte basse, les volets… ---
    this.radio = ecranRadio();
    construireInterieurTimonerie(this, {
      mat, garder, ajouter, boisGeos, inoxGeos, noirGeos, objets,
      cadrans: { barometre: cadranBarometre(), pendule: cadranPendule() },
    });
    // la face intérieure des battants de la porte : du bois verni, éclairé comme la timonerie,
    // et une poignée de ce côté-ci
    {
      const { forme, l } = formeBattant();
      const habillage = uvBois(new THREE.ShapeGeometry(forme));
      bateau.porte.userData.battants.forEach((b, k) => {
        const face = new THREE.Mesh(habillage, mat.bois);
        face.name = 'porte-timonerie-dedans';
        face.position.z = -0.002;
        face.receiveShadow = true;
        const poignee = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.03), mat.inox);
        poignee.position.set(k === 1 ? 0.05 : l - 0.05, 0.92, -0.017);
        b.add(face, poignee);
      });
    }
    // le tableau électrique, sur le pupitre de la console
    this.tableau = new TableauElectrique(this.groupe, { noir: mat.noir, inox: mat.inox, garder });
    this.positionTableau = this.tableau.position.clone();

    // tout le bois verni en un seul objet ; de même pour l'inox, le noir, l'acier et les objets
    ajouter(mergeGeometries(boisGeos.map((g) => preparer(g, ['uv']))), mat.bois, 'boiseries');
    ajouter(mergeGeometries(inoxGeos.map((g) => preparer(g, []))), mat.inox, 'inox');
    ajouter(mergeGeometries(noirGeos.map((g) => preparer(g, []))), mat.noir, 'noir');
    ajouter(mergeGeometries(acier.map((g) => preparer(g, []))), mat.acier, 'boulons-de-quille');
    ajouter(mergeGeometries(objets.map((g) => preparer(g, ['color']))), mat.objets, 'objets');

    // ---------- Les sources de lumière ----------
    const u = this.uniforms;
    const placer = (i, position, direction, forme) => {
      u.uSourcePos.value[i].copy(position);
      u.uSourceDir.value[i].copy(direction).normalize();
      u.uSourceForme.value[i].copy(forme);
    };
    // 0, 1 : les plafonniers ; 2 à 5 : les vitres (avant, tribord, bâbord, arrière et porte) ;
    // 6 : la lueur des écrans de la console ; 7 : la baladeuse de la cale
    this.lampesTimonerie.forEach((l, i) => placer(i, l.position, new THREE.Vector3(0, -1, 0), new THREE.Vector2(0.03, 0.35)));
    for (const v of Object.values(VITRES)) placer(v.source, new THREE.Vector3(...v.position), new THREE.Vector3(...v.direction), new THREE.Vector2(0.45, 0.3));
    placer(6, new THREE.Vector3(0, 1.98, 1.15), new THREE.Vector3(0, 0.45, 0.89), new THREE.Vector2(0.02, 0.15));
    placer(BALADEUSE, this.positionAmpoule, new THREE.Vector3(0, -1, 0), new THREE.Vector2(0.02, 0.7));
    // où l'on mesure la lumière (pour l'œil qui s'habitue) : au milieu de la timonerie, et
    // au fond de la cale
    this.pointMesure = new THREE.Vector3(-0.6, 0.2, 2.9);
    this.pointMesureTimonerie = new THREE.Vector3(0, 2.0, 2.3);
    this.luminance = 0;
    this.luminanceTimonerie = 0;

    this.eclairage = 'eteint';
    this.trappeOuverte = false;
    this._ciel = new THREE.Color();
    this._chaud = new THREE.Color();
    bateau.groupe.add(this.groupe);
  }

  // Suit le bateau (à chaque image, après l'avoir placé) : pour passer du repère du monde
  // à celui du bateau dans les matériaux de l'intérieur
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

  // La trappe de la cale : ouverte (le couvercle debout, penché vers l'arrière) ou fermée
  ouvrirTrappe(ouverte) {
    this.trappeOuverte = ouverte;
    this.trappe.rotation.x = ouverte ? 1.83 : 0;
    this.uniforms.uTrappe.value = ouverte ? 1 : 0;
  }

  // Les volets de tempête d'un côté ('avant', 'tribord', 'babord', 'arriere') : on les
  // ferme (ils descendent en 2,5 s) ou on les ouvre
  // (immediat : sans attendre qu'ils descendent, au début d'une partie)
  fermerVolets(cote, fermes, immediat = false) {
    const v = this.volets[cote];
    v.cible = fermes ? 1 : 0;
    if (!immediat) return;
    v.fraction = v.cible;
    for (const volet of v.liste) volet.maj(v.fraction);
  }
  voletsFermes(cote) { return this.volets[cote].cible > 0.5; }
  // (0 : roulés, 1 : fermés ; entre les deux, ils bougent)
  etatVolets(cote) { return this.volets[cote].fraction; }

  // Réglé à chaque image.
  //   eclairage : 'eteint', 'blanc' ou 'rouge' (les plafonniers) ; feux : les feux de
  //   navigation sont-ils allumés (le voyant du tableau) ; ciel : [r, g, b], la lumière du
  //   ciel (eclairage(meteo).ambiance) ; eclair : un éclair illumine les vitres ;
  //   descente : 0 (porte fermée) → 1 (ouverte) ; pression (hPa) et heure, pour les cadrans ;
  //   temoin (hPa) : l'aiguille témoin du baromètre, calée à la main ;
  //   vacille : 0 → 1, la lumière des plafonniers (1 : normale ; moins : elle faiblit, quand
  //   le courant hésite) ; pilotePanne : le disjoncteur du pilote a sauté (le tableau) ;
  //   baladeuse : l'ampoule de la cale est allumée ; nuit : 0 → 1 (les noms du tableau
  //   s'éclairent) ; dt : le temps écoulé
  regler({
    eclairage, feux, ciel, eclair = 0, descente = 1, pression = 1015, temoin = null, heure = 12, vacille = 1, pilotePanne = false,
    baladeuse = false, nuit = 0, dt = 0,
  }) {
    this.eclairage = eclairage;
    // les volets avancent vers où on les a mis ; leurs voyants, sur la commande du plafond
    this._tempsVoyants = (this._tempsVoyants ?? 0) + dt;
    for (const cote of COTES_VOLETS) {
      const v = this.volets[cote];
      const bouge = v.fraction !== v.cible;
      const voyant = this.voyantsVolets[cote].material.color;
      if (bouge) voyant.setHex(this._tempsVoyants % 0.5 < 0.25 ? 0xffa21a : 0x2a1a0a);
      else voyant.setHex(v.cible > 0.5 ? 0xff3a22 : 0x3dff7a);
      voyant.multiplyScalar(vacille);
      if (!bouge) continue;
      const pas = dt / 2.5;
      v.fraction = v.cible > v.fraction ? Math.min(v.cible, v.fraction + pas) : Math.max(v.cible, v.fraction - pas);
      for (const volet of v.liste) volet.maj(v.fraction);
    }
    this.faceCommandeVolets.material.emissiveIntensity = (0.03 + 0.2 * nuit) * vacille;
    const u = this.uniforms;
    const S = u.uSourceCouleur.value;
    // la luminance du ciel vue par une ouverture (sa lumière ramenée à un angle solide),
    // un peu réchauffée : par les vitres entre aussi la lumière renvoyée par le pont et la mer
    const L = this._ciel.fromArray(ciel).multiplyScalar(1 / Math.PI);
    const lum = 0.2126 * L.r + 0.7152 * L.g + 0.0722 * L.b;
    L.lerp(this._chaud.setRGB(lum * 1.08, lum * 0.98, lum * 0.84), 0.45);
    L.r += eclair * 0.6;
    L.g += eclair * 0.65;
    L.b += eclair * 0.8;
    // (les plafonniers sont faibles : on veille la nuit, ils ne doivent pas éblouir — on
    // garde sa vision de nuit pour voir dehors, par les vitres ; en rouge, ce n'est plus
    // qu'une veilleuse : le bois sombre, les écrans pour seule vraie lumière)
    const lampe = eclairage === 'blanc' ? LAMPE_BLANCHE : eclairage === 'rouge' ? LAMPE_ROUGE : NOIR;
    const k = (eclairage === 'rouge' ? 0.09 : 0.35) * vacille;
    this.lampesTimonerie.forEach((l, i) => {
      S[i].copy(lampe).multiplyScalar(k);
      l.diffuseur.material.emissive.copy(lampe).multiplyScalar(3.2 * k);
    });
    // les vitres, chacune selon ce que laissent passer ses volets (la porte, à l'arrière,
    // quand elle est ouverte)
    for (const [cote, v] of Object.entries(VITRES)) {
      const ouvert = 1 - 0.97 * this.volets[cote].fraction;
      S[v.source].copy(L).multiplyScalar(0.5 * v.surface * ouvert + (cote === 'arriere' ? 0.25 * descente : 0));
    }
    // (les écrans de la console : une faible lueur verte, toujours là)
    S[6].setRGB(0.0012, 0.004, 0.0028).multiplyScalar(vacille);
    // (la baladeuse de la cale)
    S[BALADEUSE].copy(baladeuse ? AMPOULE : NOIR).multiplyScalar(vacille);
    this.ampoule.material.emissive.copy(baladeuse ? AMPOULE : NOIR).multiplyScalar(6 * vacille);

    // la lumière qui arrive au milieu de la timonerie et au fond de la cale, et celle que
    // renvoient les murs
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
        const kv = (forme.y + (1 - forme.y) * cos) / (d2 + forme.x) * visibiliteSource(i, pm, u.uTrappe.value);
        c[0] += S[i].r * kv;
        c[1] += S[i].g * kv;
        c[2] += S[i].b * kv;
      }
      return c;
    };
    const [r, g, b] = mesurer(this.pointMesure);
    const timonerie = mesurer(this.pointMesureTimonerie);
    // (renvoyée par une pièce de bois verni : la lumière d'ambiance est plus chaude ; la cale,
    // grise, la renvoie moins)
    u.uAmbianceCabine.value.setRGB(r * 0.45, g * 0.42, b * 0.38);
    u.uAmbianceTimonerie.value.setRGB(timonerie[0] * 0.6, timonerie[1] * 0.54, timonerie[2] * 0.45);
    // (une lumière très colorée, comme le rouge, compte un peu plus que sa luminance :
    // sinon l'œil s'y habituerait jusqu'à voir la pièce en plein jour… rouge)
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

  // L'exposition qui convient à l'intérieur (l'œil qui s'habitue) : comme dehors, plus il
  // fait sombre, plus on ouvre… mais pas sans limite (la nuit, une pièce éteinte reste noire).
  // timonerie : on y est (sa lumière à elle ; sinon, celle de la cale)
  exposition(nuit, timonerie = false) {
    const e = 1.8 / Math.pow((timonerie ? this.luminanceTimonerie : this.luminance) + 0.002, 0.72);
    return THREE.MathUtils.clamp(e, 0.6, THREE.MathUtils.lerp(9, 3.2, nuit));
  }
}
