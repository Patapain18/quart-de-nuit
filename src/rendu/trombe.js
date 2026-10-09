// La trombe marine : une tornade au-dessus de la mer, calculée en volume.
//
// Ce qu'on voit (le détail du calcul est dans glsl/trombe.js) :
//  - le nuage-mur, sous la base des nuages d'orage : une soucoupe sombre qui s'abaisse et
//    tourne, des bandes sous son ventre, des lambeaux de nuage qui montent en spirale ;
//  - l'entonnoir : la vapeur condensée dans l'air qui tourne, un tube courbé par le vent,
//    évasé dans le nuage, strié de bandes qui montent en hélice ;
//  - au pied, la gerbe d'embruns qui tourbillonne, et sur la mer (dessinés par la mer
//    elle-même, eau.js) la tache sombre, les spirales et l'anneau d'écume ;
//  - parfois un rideau de pluie, ou des trombes sœurs.
//
// Sa vie, comme celle des vraies (Golden, 1974) : une tache sombre sur l'eau, des spirales
// autour, l'anneau d'embruns qui se lève pendant que l'entonnoir descend du nuage-mur à
// sa rencontre ; la pleine force ; puis elle s'amincit en corde, se couche, se tord, sa
// vapeur remonte dans le nuage et la gerbe retombe.
//
// Comment c'est dessiné, à chaque image où elle est là :
//  1. la lumière du ciel tout autour : une petite carte de la couleur du ciel dans chaque
//     direction (lue dans le cube des reflets, qui contient les nuages) : c'est la
//     lumière qui éclaire la trombe, du côté du couchant ou du côté noir ;
//  2. le volume, sur une image deux fois plus petite que l'écran : la lumière qui en
//     vient (et sa brume), son opacité, et la distance où il commence ;
//  3. dans la scène, une image plein écran pose ce volume par-dessus ce qui est derrière
//     lui, mais derrière ce qui est devant (le bateau, une crête de vague) : elle se place
//     à la distance où il commence.
import * as THREE from 'three';
import { GLSL_CARTE_CIEL } from './ciel.js';
import { GLSL_OUTILS, PassePleinEcran, SOMMET_PLEIN_ECRAN, cameraPleinEcran } from './outils.js';
import { glslFront } from './glsl/front.js';
import { GLSL_TROMBE } from './glsl/trombe.js';

const lisse = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
// (smoothstep(a, b, x) comme en GLSL)
const smoothstep01 = (a, b, x) => lisse(x, a, b);

// ---------- Les caractères ----------
// Quatre trombes possibles, toutes physiquement plausibles, pour choisir la sienne.
// Les longueurs sont en mètres, les rotations en radians par seconde.
//   ent : l'entonnoir · axe : sa courbe · mur : le nuage-mur · emb : la gerbe d'embruns
//   rideau : la pluie qui l'enveloppe · soeurs : les petites trombes autour · ext : son
//   opacité (extinction par mètre) · teinte : la couleur de la vapeur, la noirceur du mur
export const VARIANTES = {
  colonne: {
    nom: 'La colonne',
    resume: 'Une trombe d\'orage massive : un tronc gris de 50 à 80 m, évasé dans un grand nuage-mur qui tourne, et une gerbe d\'embruns de 100 m.',
    ent: { rPied: 26, rMilieu: 40, rHaut: 190, creux: 0.45, nettete: 0.14, effiloche: 0.38, stries: 0.55, torsion: 0.012, rotation: 1.6, montee: 9, opacite: 1, detail: 0.6, pointeMin: 0 },
    axe: { inclinaison: 110, meandres: 18, vitesse: 0.7 },
    mur: { rayon: 620, abaissement: 300, densite: 1, rotation: 0.07, lambeaux: 0.7, bandes: 0.5 },
    emb: { coeur: 30, hauteur: 110, densite: 1, jupe: 4.6, rotation: 1.6, montee: 18, bouillon: 0.8, plancton: 1 },
    rideau: { angle: -0.6, ouverture: 0.9, rayon: 520, densite: 0.35 },
    soeurs: 0,
    ext: { ent: 0.09, emb: 0.1, mur: 0.09, pluie: 0.004 },
    teinte: [0.62, 0.65, 0.7], noirceur: 0.25,
  },
  fil: {
    nom: 'Le fil',
    resume: 'La trombe des photos : un fil de vapeur de 15 à 20 m, lisse et creux, qui ondule en S sous un nuage bas, et un buisson d\'embruns blanc qui tourbillonne à son pied.',
    ent: { rPied: 7.5, rMilieu: 10, rHaut: 55, creux: 0.72, nettete: 0.06, effiloche: 0.1, stries: 0.6, torsion: 0.03, rotation: 2.6, montee: 6, opacite: 0.9, detail: 0.25, pointeMin: 0 },
    axe: { inclinaison: 70, meandres: 34, vitesse: 0.5 },
    mur: { rayon: 330, abaissement: 100, densite: 0.85, rotation: 0.045, lambeaux: 0.2, bandes: 0.25 },
    emb: { coeur: 14, hauteur: 56, densite: 1.1, jupe: 4.8, rotation: 2.4, montee: 14, bouillon: 1, plancton: 1 },
    rideau: { angle: 0, ouverture: 0, rayon: 400, densite: 0 },
    soeurs: 0,
    ext: { ent: 0.15, emb: 0.11, mur: 0.085, pluie: 0 },
    teinte: [0.8, 0.83, 0.87], noirceur: 0.15,
  },
  bete: {
    nom: 'La bête',
    resume: 'Une trombe noire et large, à moitié cachée dans des rideaux de pluie, sous un nuage-mur énorme et des lambeaux qui filent ; une gerbe grise de 150 m.',
    ent: { rPied: 50, rMilieu: 74, rHaut: 250, creux: 0.2, nettete: 0.26, effiloche: 0.6, stries: 0.4, torsion: 0.008, rotation: 1.0, montee: 12, opacite: 1, detail: 0.9, pointeMin: 0 },
    axe: { inclinaison: 140, meandres: 12, vitesse: 0.6 },
    mur: { rayon: 800, abaissement: 380, densite: 1.2, rotation: 0.07, lambeaux: 1, bandes: 0.4 },
    emb: { coeur: 52, hauteur: 150, densite: 1.1, jupe: 3.6, rotation: 1.2, montee: 20, bouillon: 0.7, plancton: 1.3 },
    rideau: { angle: 0.4, ouverture: 1.9, rayon: 600, densite: 0.6 },
    soeurs: 0,
    ext: { ent: 0.08, emb: 0.09, mur: 0.095, pluie: 0.006 },
    teinte: [0.55, 0.57, 0.6], noirceur: 0.35,
  },
  soeurs: {
    nom: 'Les sœurs',
    resume: 'Une trombe moyenne, et autour d\'elle deux trombes plus fines qui descendent du même nuage, touchent la mer, puis remontent.',
    ent: { rPied: 20, rMilieu: 30, rHaut: 160, creux: 0.5, nettete: 0.1, effiloche: 0.3, stries: 0.55, torsion: 0.016, rotation: 1.8, montee: 8, opacite: 1, detail: 0.5, pointeMin: 0 },
    axe: { inclinaison: 90, meandres: 22, vitesse: 0.6 },
    mur: { rayon: 700, abaissement: 260, densite: 1, rotation: 0.055, lambeaux: 0.5, bandes: 0.45 },
    emb: { coeur: 24, hauteur: 92, densite: 1, jupe: 4.6, rotation: 1.7, montee: 17, bouillon: 0.85, plancton: 1 },
    rideau: { angle: -0.4, ouverture: 0.7, rayon: 560, densite: 0.25 },
    soeurs: 2,
    ext: { ent: 0.1, emb: 0.1, mur: 0.09, pluie: 0.004 },
    teinte: [0.66, 0.69, 0.74], noirceur: 0.25,
  },
};
// (celle du jeu : la bête, choisie par Mathis le 2026-10-07)
export const VARIANTE_DU_JEU = 'bete';

// ---------- Sa vie ----------
// age, duree : en secondes (quart/nuit.js : elle vit 200 s). Renvoie ce qui se voit à cet âge.
export const DUREE_NAISSANCE = 50; // de la tache sombre sur l'eau à l'entonnoir qui touche la mer
export const DUREE_CORDE = 60; // la fin : elle s'amincit en corde, se couche, se tord
export function vieDeLaTrombe(age, duree) {
  const n = THREE.MathUtils.clamp(age / DUREE_NAISSANCE, 0, 1);
  const corde = lisse(age, duree - DUREE_CORDE, duree - 12);
  const fin = lisse(age, duree - 16, duree);
  return {
    naissance: n,
    corde,
    fin,
    // sur la mer : la tache sombre (le tout début), les spirales, l'anneau d'embruns
    tache: lisse(n, 0, 0.12) * (1 - 0.75 * lisse(n, 0.45, 0.8)) * (1 - fin),
    spirales: lisse(n, 0.06, 0.35) * (1 - 0.5 * corde) * (1 - fin),
    anneau: lisse(n, 0.22, 0.55) * (1 - 0.65 * corde) * (1 - fin),
    // la gerbe monte quand l'entonnoir arrive
    gerbe: (0.45 + 0.55 * lisse(n, 0.55, 1)) * lisse(n, 0.2, 0.45) * (1 - 0.6 * corde) * (1 - fin),
    // l'entonnoir descend du nuage-mur (lentement, puis il « touche » d'un coup), et y
    // remonte à la fin
    descente: lisse(n, 0.28, 0.95) ** 1.6 * (1 - lisse(fin, 0.35, 1)),
    // le nuage-mur s'abaisse dès le début ; il se dissipe à la toute fin
    mur: lisse(n, 0, 0.6) * (1 - 0.6 * fin),
    opacite: 1 - lisse(fin, 0.5, 1),
  };
}

// ---------- 1. la lumière du ciel tout autour ----------
// Une petite carte (16 × 16) de la lumière qui vient de chaque direction, lue dans le cube
// des reflets (qui contient les nuages) et floutée ; sous l'horizon, la mer, sombre. Elle
// est rangée « en octaèdre » : la sphère des directions dépliée en un carré, qu'on lit sans
// calcul d'angles (plus rapide que des sinus et des arcs).
const GLSL_OCTAEDRE = /* glsl */ `
vec2 versOctaedre(vec3 n) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 e = n.xz;
  if (n.y < 0.0) e = (1.0 - abs(n.zx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0);
  return e * 0.5 + 0.5;
}
vec3 depuisOctaedre(vec2 uv) {
  vec2 e = uv * 2.0 - 1.0;
  vec3 v = vec3(e.x, 1.0 - abs(e.x) - abs(e.y), e.y);
  if (v.y < 0.0) v.xz = (1.0 - abs(v.zx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.z >= 0.0 ? 1.0 : -1.0);
  return normalize(v);
}
`;
const FRAGMENT_CIEL_AUTOUR = /* glsl */ `
in vec2 vUv;
uniform samplerCube uReflets;
${GLSL_OCTAEDRE}
void main() {
  vec3 d = depuisOctaedre(vUv);
  // (un peu de flou autour de la direction)
  vec3 a = normalize(cross(d, abs(d.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(d, a);
  vec3 c = vec3(0.0);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec3 v = normalize(d + (a * float(i) + b * float(j)) * 0.18);
      c += textureLod(uReflets, vec3(v.x, max(v.y, 0.02), v.z), 4.0).rgb;
    }
  }
  c /= 9.0;
  // (sous l'horizon, la mer renvoie peu de lumière : le reflet du ciel en rasant, l'eau sombre)
  c *= mix(0.09, 1.0, smoothstep(-0.12, 0.03, d.y));
  gl_FragColor = vec4(c, 1.0);
}
`;

// ---------- 2. le volume ----------
const FRAGMENT_VOLUME = /* glsl */ `
#include <common>
in vec2 vUv;
layout(location = 0) out vec4 sortieLumiere;
layout(location = 1) out vec4 sortieProfondeur;
uniform mat4 uVueProjectionInverse;
uniform vec3 uPositionCamera;
uniform float uImage;
uniform vec3 uPied;          // le pied de la trombe, dans le monde (x, niveau de la mer, z)
uniform vec4 uBorne;         // nombre de pas au plus, 0, 0, 0
uniform float uCompter;      // (l'atelier : 1, on écrit le nombre de pas et d'éclairages au lieu de la lumière)
uniform float uPixel;        // la taille d'un pixel du volume (rad)
uniform sampler2D uAnneau;
uniform samplerCube uReflets;
uniform sampler2D uCarteCiel;
uniform float uBrume;
uniform vec3 uDirSoleil;
uniform vec3 uSoleil;
uniform vec3 uDirLune;
uniform vec3 uLune;
uniform vec4 uEclair;        // un éclair (position dans le monde, intensité) : celui des nuages
uniform float uEclaire;      // l'éclair qui illumine tout autour de nous
uniform float uNuit;
uniform float uNoir;         // le noir de la nuit d'orage (0 → 1) : le plancton ne se voit que dans le noir
uniform float uOmbres;       // 1 : les ombres de la matière sur elle-même (la qualité)
uniform sampler2D uDeplacement0;
uniform sampler2D uDeplacement1;
uniform vec3 uGrille0;
uniform vec3 uGrille1;
uniform float uPasAngulaire;
${GLSL_OUTILS}
${GLSL_CARTE_CIEL}
${GLSL_TROMBE}
${glslFront('uBruitNuages')}

${GLSL_OCTAEDRE}
// La lumière du ciel qui vient de la direction n (la carte du ciel tout autour)
vec3 cielDans(vec3 n) {
#ifdef MESURE_SANS_CIEL
  return vec3(0.004);
#endif
  return texture(uAnneau, versOctaedre(n)).rgb;
}

// Entrée et sortie d'un rayon dans un cylindre vertical (x² + z² < R², bas < y < haut)
vec2 traverserCylindre(vec3 o, vec3 d, float R, float bas, float haut) {
  float a = dot(d.xz, d.xz);
  float b = dot(o.xz, d.xz);
  float c = dot(o.xz, o.xz) - R * R;
  float t0 = -1e9;
  float t1 = 1e9;
  if (a > 1e-8) {
    float delta = b * b - a * c;
    if (delta < 0.0) return vec2(1.0, -1.0);
    delta = sqrt(delta);
    t0 = (-b - delta) / a;
    t1 = (-b + delta) / a;
  } else if (c > 0.0) return vec2(1.0, -1.0);
  if (abs(d.y) > 1e-6) {
    float ta = (bas - o.y) / d.y;
    float tb = (haut - o.y) / d.y;
    t0 = max(t0, min(ta, tb));
    t1 = min(t1, max(ta, tb));
  } else if (o.y < bas || o.y > haut) return vec2(1.0, -1.0);
  return vec2(max(t0, 0.0), t1);
}

// La hauteur de la mer en (x, z) du monde : les deux grandes grilles de la houle (celles
// des vagues qu'on voit de loin), lues aussi floues que le maillage de la mer à cette distance
float hauteurMer(vec2 xz, float distance) {
  float espacement = max(distance * uPasAngulaire, 0.01);
  float lod0 = log2(max(espacement / uGrille0.y, 1.0)) + 0.5;
  float lod1 = log2(max(espacement / uGrille1.y, 1.0)) + 0.5;
  float h = textureLod(uDeplacement0, xz / uGrille0.x, lod0).y * (1.0 - smoothstep(uGrille0.z - 1.5, uGrille0.z, lod0));
  h += textureLod(uDeplacement1, xz / uGrille1.x, lod1).y * (1.0 - smoothstep(uGrille1.z - 1.5, uGrille1.z, lod1));
  return h;
}

// La couleur de la brume dans la direction d : au ras de l'eau, la même que celle de la
// mer (le ciel de l'horizon, le front orageux) ; plus haut, le ciel et ses nuages
vec3 couleurBrume(vec3 d) {
  vec3 horizon = texture(uCarteCiel, uvCarteCiel(normalize(vec3(d.x, 0.015, d.z)))).rgb;
  vec4 front = frontOrage(normalize(vec3(d.x, 0.004, d.z)), horizon, 0.0);
  horizon = mix(horizon, front.rgb, front.a);
  vec3 haut = textureLod(uReflets, normalize(vec3(d.x, max(d.y, 0.02), d.z)), 2.5).rgb;
  return mix(horizon, haut, smoothstep(0.02, 0.2, d.y));
}

// Sous le nuage d'orage qui la porte, la lumière qui vient d'en haut (la lune) est
// arrêtée : le rayon vers elle traverse des kilomètres de nuage. Seule passe la lumière
// qui arrive par le côté, sous la base des nuages (la lueur du couchant, à l'horizon).
float ombreDuNuage(vec3 p, vec3 l) {
  if (l.y <= 0.0) return 1.0;
  float monte = max(uMur.w - p.y, 0.0) / max(l.y, 0.02);
  vec2 x = p.xz + l.xz * monte - uCentreMur.xy;
  return mix(0.04, 1.0, smoothstep(uMur2.w * 0.55, uMur2.w, length(x)));
}

// Les morceaux du rayon qui traversent la trombe (au plus quatre, triés, réunis s'ils se
// touchent) : on n'avance pas à petits pas dans le vide qui les sépare
vec2 segments[4];
int nSegments;
void ajouterSegment(vec2 iv) {
  if (iv.x >= iv.y || nSegments >= 4) return;
  // (insertion à sa place, dans l'ordre des distances)
  int i = nSegments;
  for (int k = 3; k > 0; k--) {
    if (k > nSegments) continue;
    if (segments[k - 1].x > iv.x) {
      segments[k] = segments[k - 1];
      i = k - 1;
    } else break;
  }
  segments[i] = iv;
  nSegments++;
}
void reunirSegments() {
  int n = 0;
  for (int k = 0; k < 4; k++) {
    if (k >= nSegments) break;
    if (n > 0 && segments[k].x <= segments[n - 1].y + 1.0) segments[n - 1].y = max(segments[n - 1].y, segments[k].y);
    else segments[n++] = segments[k];
  }
  nSegments = n;
}

void main() {
  sortieLumiere = vec4(0.0);
  sortieProfondeur = vec4(0.0);
  vec4 lointain = uVueProjectionInverse * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(lointain.xyz / lointain.w - uPositionCamera);
  // (on calcule dans le repère du pied : x et z depuis lui, y depuis la mer)
  vec3 o = uPositionCamera - uPied;
  nSegments = 0;
  ajouterSegment(traverserCylindre(o - vec3(uCoeurBas.x, 0.0, uCoeurBas.y), d, uCoeurBas.z, -12.0, uCoeurBas.w));
  ajouterSegment(traverserCylindre(o - vec3(uCoeurHaut.x, 0.0, uCoeurHaut.y), d, uCoeurHaut.z, uCoeurHaut.w, uEnt.w * 1.05));
  ajouterSegment(traverserCylindre(o - vec3(uDisque.x, 0.0, uDisque.y), d, uDisque.z, uDisqueY.x, uDisqueY.y));
  if (uZonePluie.z > 0.0) ajouterSegment(traverserCylindre(o - vec3(uZonePluie.x, 0.0, uZonePluie.y), d, uZonePluie.z, -12.0, uZonePluie.w));
  if (nSegments == 0) return;
  reunirSegments();

  vec3 brume = couleurBrume(d);
  // la lumière principale : le soleil, ou après son coucher la lueur du couchant sur
  // l'horizon (la lumière du ciel de ce côté-là, qui fait briller les bords de la vapeur),
  // et la lune quand elle passe entre les nuages. (Une seule direction, la moyenne des
  // deux selon leur éclat : on ne calcule qu'une ombre.)
  vec3 dirCouchant = normalize(vec3(uDirSoleil.x, max(uDirSoleil.y, 0.06), uDirSoleil.z));
  vec3 couchant = uSoleil + cielDans(dirCouchant) * 0.55;
  float eclatCouchant = dot(couchant, vec3(0.2126, 0.7152, 0.0722));
  float eclatLune = uDirLune.y > 0.0 ? dot(uLune, vec3(0.2126, 0.7152, 0.0722)) : 0.0;
  // (pendant un éclair, c'est lui la lumière principale : l'ombre se calcule vers lui, et
  // la trombe se découpe sur le nuage qu'il allume derrière elle)
  vec3 versEclairPied = uEclair.xyz - uPied - vec3(0.0, uEnt.w * 0.5, 0.0);
  float eclatEclair = uEclair.w * exp(-length(versEclairPied) / 1600.0) * 1.6;
  vec3 dirLumiere = normalize(dirCouchant * eclatCouchant + uDirLune * eclatLune + normalize(versEclairPied) * eclatEclair * 4.0 + vec3(0.0, 1e-6, 0.0));
  vec3 lune = uDirLune.y > 0.0 ? uLune : vec3(0.0);
  vec3 lumiere = couchant + lune + vec3(eclatEclair);
  gLumiere = dirLumiere;
  float cosLumiere = dot(dirLumiere, d);
  float phaseLumiere = mix(phaseHG(cosLumiere, 0.65), phaseHG(cosLumiere, -0.25), 0.3) * 4.0 * PI;
  float eclatLumiere = max(lumiere.r, max(lumiere.g, lumiere.b));

  float T = 1.0;
  vec3 L = vec3(0.0);
  float tAvant = -1.0;
  // le premier pas de chaque morceau, décalé d'un pixel à l'autre (et d'une image à
  // l'autre) : sans cela, les pas dessinent des marches d'escalier
  // (le motif de bruit reste le même d'un pixel à l'autre, mais chaque image le décale du
  // nombre d'or : chaque pixel parcourt ainsi tous les décalages, au mieux réparti dans le
  // temps, et l'accumulation en fait la moyenne)
  float decalage = fract(bruitEntrelace(gl_FragCoord.xy) + uImage * 0.6180339887);
  int k = 0;
  float t = segments[0].x + 3.0 * decalage;
  int pasMax = int(uBorne.x);
  float nPas = 0.0;
  float nEclaires = 0.0;
  float nSondes = 0.0;
  for (int i = 0; i < 220; i++) {
    if (i >= pasMax || T < 0.03) break;
    if (t > segments[k].y) {
      // (au morceau suivant)
      k++;
      if (k >= nSegments) break;
      t = max(t, segments[k].x + 3.0 * decalage);
      continue;
    }
    nPas += 1.0;
    vec3 p = o + d * t;
    // (un rayon qui passe sous les vagues s'arrête : la mer cache ce qui est derrière elle)
    if (p.y < 8.0 && p.y < hauteurMer(p.xz + uPied.xz, t) - uPied.y) break;
    // (le détail fin ne se voit que devant : derrière un voile épais, ce n'est pas la peine)
#ifdef MESURE_SANS_DETAIL
    matiere(p, 1);
#else
    matiere(p, T > 0.3 && t < 3000.0 ? 2 : 1);
#endif
    float ds = clamp(gPas, 0.5, 250.0);
    // (loin, un pas plus petit qu'un pixel ne sert à rien)
    ds = max(ds, t * uPixel * 0.8);
    float ent = gEnt;
    float emb = gEmb;
    float mur = gMur;
    float pluie = gPluie;
    float total = ent + emb + mur + pluie;
    // (dans une matière très légère, des pas plus grands)
    ds *= mix(1.6, 1.0, smoothstep(0.02, 0.12, total));
    float sigma = extinctionIci();
    if (sigma > 1e-5) {
      nEclaires += 1.0;
      vec3 n = normalize(gNormale + vec3(0.0, 1e-3, 0.0));
      float profondeur = gProfondeur / total;
      float ombre = gOmbre / total;
      float sigmaMoyen = sigma / total * 0.6;
      // la couleur de la matière : la vapeur de l'entonnoir, l'eau pulvérisée (blanche),
      // le nuage, la pluie (grise)
      vec3 couleur = (ent * uTeinte.rgb + emb * vec3(0.96) + mur * vec3(1.0 - uTeinte.w) + pluie * vec3(0.7)) / total;
      // 1. le ciel tout autour, qui arrive par le côté de la matière tourné vers lui,
      // affaibli par l'épaisseur traversée (sans jamais être tout noir : la lumière
      // rebondit d'une gouttelette à l'autre ; dans l'eau pulvérisée, très blanche, bien plus)
      float occ = exp(-sigmaMoyen * profondeur);
      float partEmbruns = emb / total;
      occ = mix(occ, 1.0, 0.1 + 0.55 * partEmbruns);
      // (devant, en bonne qualité : une mesure de plus, tout près, vers la lumière
      // principale ; elle modèle les bosses : leur côté tourné vers elle est plus clair)
      float odSonde = 0.0;
#ifndef MESURE_SANS_SONDE
      if (uOmbres > 0.5 && T > 0.2 && pluie < 0.7 * total && eclatLumiere > 1e-4) {
        nSondes += 1.0;
        float echelle = (ent * max(uEnt.x, 6.0) * 0.6 + emb * uEmb.x * 0.5 + mur * 60.0 + pluie * 80.0) / total;
        matiere(p + dirLumiere * echelle, 0);
        odSonde = extinctionIci() * echelle * 0.6;
      }
#endif
      // (la lumière du ciel qui vient du même côté que la lumière principale est cachée
      // par les mêmes bosses)
      vec3 recue = cielDans(n) * occ * mix(1.0, exp(-odSonde), 0.5);
      // 2. la lumière principale, dans l'ombre de la matière qui est entre elle et nous :
      // l'épaisseur mesurée par la forme de chaque matière, et la mesure tout près
      if (eclatLumiere > 1e-4) {
        float od = ombre + odSonde;
        float tl = exp(-od);
        // (la lumière diffusée plusieurs fois passe mieux ; dans l'eau pulvérisée, bien mieux)
        tl = max(tl, mix(0.25, 0.55, partEmbruns) * exp(-od * mix(0.25, 0.12, partEmbruns)));
        // (la pluie diffuse surtout la lumière autour d'elle, pas vers l'avant)
        float phaseIci = mix(phaseLumiere, 1.0, pluie / total);
        vec3 arrivee = couchant * ombreDuNuage(p, dirCouchant) + lune * ombreDuNuage(p, uDirLune);
        recue += arrivee * tl * phaseIci * 0.25;
        // 3. l'éclair : de l'intérieur du nuage, il allume ce qui est près de lui ; ce qui
        // est épais lui fait de l'ombre (la trombe se découpe devant le nuage allumé)
        if (uEclair.w > 0.001) {
          vec3 versEclair = uEclair.xyz - (p + uPied);
          float r = length(versEclair);
          float phase = mix(1.0, mix(phaseHG(dot(versEclair / r, d), 0.55), phaseHG(dot(versEclair / r, d), -0.2), 0.3) * 4.0 * PI, 0.35);
          recue += vec3(0.75, 0.82, 1.0) * uEclair.w * exp(-r / 1600.0) * 1.6 * mix(tl, occ, 0.15) * phase;
        }
      }
      // (et l'éclair qui illumine tout le ciel autour de nous)
      recue += vec3(0.6, 0.65, 0.82) * uEclaire * 0.15 * occ;
      // (l'eau pulvérisée renvoie la lumière d'une gouttelette à l'autre bien plus qu'on ne
      // le calcule ici : elle paraît blanche, même par temps sombre)
      recue *= 1.0 + 0.8 * partEmbruns;
      vec3 lum = couleur * recue;
      // 4. la nuit, l'eau arrachée au pied s'allume : le plancton qu'elle emporte
      // (seulement dans le vrai noir : tant qu'il reste de la lumière, on le devine à peine)
      float noirDeNuit = smoothstep(0.5, 0.95, uNuit) * mix(0.25, 1.0, smoothstep(0.35, 0.8, uNoir));
      if (noirDeNuit > 0.0 && emb > 0.0) {
        // (surtout au ras de l'eau, là où elle vient d'être arrachée ; par étincelles, qui
        // s'allument et s'éteignent en tournant avec elle)
        float bas = 1.0 - smoothstep(2.0, 30.0, p.y);
        vec2 qt = tourner(p.xz, uT * uEmb2.x * 0.35);
        float scint = 0.12 + smoothstep(0.55, 0.9, texture(uBruitNuages, vec3(qt * 0.045, p.y * 0.03 + uT * 0.35)).a);
        lum += vec3(0.03, 0.4, 0.42) * uEmb2.w * noirDeNuit * partEmbruns * bas * scint * 0.18;
      }
      // intégration qui conserve l'énergie (Hillaire 2015), et la brume entre la matière et nous
      float tr = exp(-sigma * ds);
      float voile = exp(-t * uBrume);
      L += T * (1.0 - tr) * (lum * voile + brume * (1.0 - voile));
      T *= tr;
      if (tAvant < 0.0 && T < 0.97) tAvant = t;
    }
    t += ds;
  }
  sortieLumiere = vec4(L, 1.0 - T);
  sortieProfondeur = vec4(tAvant < 0.0 ? t : tAvant, 0.0, 0.0, 1.0);
  if (uCompter > 0.5) sortieLumiere = vec4(nPas, nEclaires, nSondes, 1.0);
}
`;

// ---------- 2 bis. l'accumulation d'une image à l'autre ----------
// Chaque image ne fait qu'une partie des pas (décalés au hasard d'un pixel et d'une image
// à l'autre) ; on mélange avec les images précédentes, retrouvées à leur place (le point
// du volume qu'on voyait : la distance où il commence), sans garder ce qui ne ressemble
// plus à ce qu'on voit (on borne par les voisins)
const FRAGMENT_ACCUMULATION = /* glsl */ `
in vec2 vUv;
uniform sampler2D uCourant;
uniform sampler2D uProfondeur;
uniform sampler2D uHistorique;
uniform mat4 uVueProjectionInverse;
uniform mat4 uVueProjectionPrecedente;
uniform vec3 uPositionCamera;
uniform vec2 uTexel;
uniform float uMelange;
uniform bool uReinitialiser;
void main() {
  vec4 courant = texture(uCourant, vUv);
  vec4 p = texture(uProfondeur, vUv);
  vec4 lointain = uVueProjectionInverse * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(lointain.xyz / lointain.w - uPositionCamera);
  float distance = p.w > 0.5 ? p.x : 2000.0;
  vec4 clip = uVueProjectionPrecedente * vec4(uPositionCamera + d * distance, 1.0);
  vec2 uvAvant = clip.xy / clip.w * 0.5 + 0.5;
  if (uReinitialiser || clip.w <= 0.0 || any(lessThan(uvAvant, vec2(0.0))) || any(greaterThan(uvAvant, vec2(1.0)))) {
    gl_FragColor = courant;
    return;
  }
  vec4 avant = texture(uHistorique, uvAvant);
  // (on borne l'ancienne valeur par ce que montrent les voisins : leur moyenne, plus ou
  // moins leur écart habituel — au-delà, c'est que ce qu'on voit a changé)
  vec4 somme = vec4(0.0);
  vec4 somme2 = vec4(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec4 v = texture(uCourant, vUv + vec2(x, y) * uTexel);
      somme += v;
      somme2 += v * v;
    }
  }
  vec4 moyenne = somme / 9.0;
  vec4 ecart = sqrt(max(somme2 / 9.0 - moyenne * moyenne, 0.0));
  avant = clamp(avant, moyenne - 1.5 * ecart, moyenne + 1.5 * ecart);
  gl_FragColor = mix(avant, courant, uMelange);
}
`;

// ---------- 3. le volume posé dans la scène ----------
const SOMMET_COMPOSITION = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
const FRAGMENT_COMPOSITION = /* glsl */ `
uniform sampler2D uLumiere;
uniform sampler2D uProfondeur;
uniform vec2 uTailleEcran;
uniform mat4 uVueProjectionInverse;
uniform vec3 uPositionCamera;
uniform vec3 uAvantCamera;
uniform mat4 uProjection;

// Agrandir l'image du volume (calculée sur moins de pixels) sans la rendre floue : un
// filtre bicubique de Catmull-Rom (9 lectures, en profitant du filtre linéaire de la carte)
vec4 lireNet(sampler2D t, vec2 uv) {
  vec2 taille = vec2(textureSize(t, 0));
  vec2 p = uv * taille;
  vec2 c = floor(p - 0.5) + 0.5;
  vec2 f = p - c;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 o12 = w2 / w12;
  vec2 t0 = (c - 1.0) / taille;
  vec2 t3 = (c + 2.0) / taille;
  vec2 t12 = (c + o12) / taille;
  vec4 r = texture(t, vec2(t0.x, t0.y)) * w0.x * w0.y + texture(t, vec2(t12.x, t0.y)) * w12.x * w0.y + texture(t, vec2(t3.x, t0.y)) * w3.x * w0.y
         + texture(t, vec2(t0.x, t12.y)) * w0.x * w12.y + texture(t, vec2(t12.x, t12.y)) * w12.x * w12.y + texture(t, vec2(t3.x, t12.y)) * w3.x * w12.y
         + texture(t, vec2(t0.x, t3.y)) * w0.x * w3.y + texture(t, vec2(t12.x, t3.y)) * w12.x * w3.y + texture(t, vec2(t3.x, t3.y)) * w3.x * w3.y;
  return max(r, vec4(0.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uTailleEcran;
  vec4 v = lireNet(uLumiere, uv);
  v.a = min(v.a, 1.0);
  if (v.a < 0.002) discard;
  // la distance où le volume commence : la plus proche des quatre voisines (là où il y a
  // du volume), pour ne pas mélanger le bord du volume avec le vide
  ivec2 taille = textureSize(uProfondeur, 0);
  vec2 c = uv * vec2(taille) - 0.5;
  ivec2 i0 = ivec2(floor(c));
  float distance = 1e9;
  for (int x = 0; x <= 1; x++) {
    for (int y = 0; y <= 1; y++) {
      ivec2 ij = clamp(i0 + ivec2(x, y), ivec2(0), taille - 1);
      vec4 p = texelFetch(uProfondeur, ij, 0);
      if (p.w > 0.5) distance = min(distance, p.x);
    }
  }
  if (distance > 1e8) discard;
  // (la profondeur de ce point, comme la carte graphique la range)
  vec4 lointain = uVueProjectionInverse * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(lointain.xyz / lointain.w - uPositionCamera);
  float z = max(distance * dot(d, uAvantCamera), 0.06);
  float zc = uProjection[2][2] * -z + uProjection[3][2];
  gl_FragDepth = clamp(zc / z * 0.5 + 0.5, 0.0, 1.0);
  gl_FragColor = v;
}
`;

// ---------- l'axe et le rayon de l'entonnoir (calculés une fois par image) ----------
// Son écart horizontal (m) à la hauteur h, par rapport au pied. Le haut est emporté par
// le vent, plus fort en altitude (le pied traîne derrière) ; des ondulations descendent
// le long du tube, nulles à ses deux bouts ; à la fin (la corde), il se tord et se couche.
export function axeTrombe(h, dephasage, { H, vent, inclinaison, meandres, vitesse, corde, temps }, sortie = [0, 0]) {
  const u = THREE.MathUtils.clamp(h / H, 0, 1);
  const k = inclinaison * (1 + 2.4 * corde) * u ** 1.5;
  const a = meandres * (1 + 3 * corde) * Math.sin(Math.PI * u ** 0.8);
  const t = temps * vitesse + dephasage;
  // (le long de la normale au vent, et le long du vent)
  const fn = 0.62 * Math.sin(u * 5.1 + t * 0.83 + 1.3) + 0.26 * Math.sin(u * 11.7 + t * 1.61 + 0.4) + 0.2 * corde * Math.sin(u * 21 + t * 2.3);
  const fv = 0.45 * Math.sin(u * 3.7 + t * 0.61 + 2.1) + 0.2 * Math.sin(u * 9.3 + t * 1.37) + 0.25 * corde * Math.sin(u * 15 - t * 1.9);
  sortie[0] = vent.x * (k + a * fv) - vent.y * a * fn;
  sortie[1] = vent.y * (k + a * fv) + vent.x * a * fn;
  return sortie;
}
// Son rayon (m) à la hauteur h : une trompe, fine sur presque toute sa longueur, qui
// s'élargit doucement vers le haut, dans le nuage-mur ; il respire ; à la fin, ce n'est
// plus qu'une corde.
export function rayonTrombe(h, taille, { H, rPied, rMilieu, rHaut, corde, temps }) {
  const u = THREE.MathUtils.clamp(h / H, 0, 1);
  let R = rPied + (rMilieu - rPied) * u + (rHaut - rMilieu) * u ** 3.5;
  R *= 1 + 0.07 * Math.sin(temps * 0.41 + u * 4) + 0.05 * Math.sin(temps * 0.93 - u * 9);
  return R * lerp(1, 0.3, lisse(corde, 0, 0.6)) * taille;
}

// Le triangle qui couvre l'écran
function trianglePleinEcran() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
}

export class Trombe3D {
  constructor(scene, houle, eau, ciel, embruns) {
    this.houle = houle;
    this.ciel = ciel;
    this.eau = eau;
    this.embruns = embruns;
    this.renderer = ciel.renderer;
    this.echelle = 0.5; // (la taille du volume par rapport à l'écran : la qualité)
    // (et quand elle est tout près, qu'elle remplit l'écran, on la calcule sur moins de
    // pixels : ses formes sont grandes, ça ne se voit pas, et ça coûte bien moins)
    this.reduction = 1;
    this.pasMax = 128;
    this.ombres = true;
    this.brouillard = 0;
    this.visible = false;
    const un = ciel.uniformsNuages;
    const ue = eau.uniforms;
    const v3 = () => new THREE.Vector3();
    const v4 = () => new THREE.Vector4();

    // 1. la lumière du ciel tout autour
    this.anneau = new THREE.WebGLRenderTarget(16, 16, {
      type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
    });
    this.passeAnneau = new PassePleinEcran(new THREE.ShaderMaterial({
      uniforms: { uReflets: { value: ciel.cube.texture } },
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_CIEL_AUTOUR, depthTest: false, depthWrite: false,
    }));

    // 1 bis. le profil des entonnoirs (128 hauteurs × 4 rangées : la grande, ses sœurs)
    this.donneesProfil = new Uint16Array(128 * 4 * 4);
    this.profil = new THREE.DataTexture(this.donneesProfil, 128, 4, THREE.RGBAFormat, THREE.HalfFloatType);
    this.profil.minFilter = THREE.LinearFilter;
    this.profil.magFilter = THREE.LinearFilter;
    this.profil.needsUpdate = true;
    this._axe = [0, 0];

    // 2. le volume
    this.cible = new THREE.WebGLRenderTarget(4, 4, {
      count: 2, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
    });
    this.cible.textures[1].minFilter = THREE.NearestFilter;
    this.cible.textures[1].magFilter = THREE.NearestFilter;
    this.uniforms = {
      uVueProjectionInverse: { value: new THREE.Matrix4() },
      uPositionCamera: { value: v3() },
      uImage: { value: 0 },
      uPied: { value: v3() },
      uBorne: { value: v4() },
      uCompter: { value: 0 },
      uCoeurBas: { value: v4() },
      uCoeurHaut: { value: v4() },
      uDisque: { value: v4() },
      uDisqueY: { value: new THREE.Vector2() },
      uZonePluie: { value: v4() },
      uCentreMur: { value: v4() },
      uPixel: { value: 0.001 },
      uAnneau: { value: this.anneau.texture },
      uReflets: { value: ciel.cube.texture },
      uCarteCiel: { value: ciel.carte.texture },
      uBrume: { value: 1 / 60000 },
      uDirSoleil: un.uDirSoleil,
      uSoleil: ue.uSoleil,
      uDirLune: un.uDirLune,
      uLune: ue.uLune,
      uEclair: un.uEclair,
      uEclaire: { value: 0 },
      uNuit: { value: 0 },
      uNoir: { value: 0 },
      uOmbres: { value: 1 },
      uDeplacement0: ue.uDeplacement0,
      uDeplacement1: ue.uDeplacement1,
      uGrille0: ue.uGrille0,
      uGrille1: ue.uGrille1,
      uPasAngulaire: ue.uPasAngulaire,
      uBruitNuages: un.uBruitNuages,
      uProfil: { value: this.profil },
      ...ciel.uniformsFront,
      uT: { value: 0 },
      uVent: { value: new THREE.Vector2(1, 0) },
      uEnt: { value: v4() },
      uEnt2: { value: v4() },
      uEnt3: { value: v4() },
      uEnt4: { value: v4() },
      uAxe: { value: v4() },
      uMur: { value: v4() },
      uMur2: { value: v4() },
      uEmb: { value: v4() },
      uEmb2: { value: v4() },
      uRideau: { value: v4() },
      uSoeur0: { value: v4() },
      uSoeur1: { value: v4() },
      uExt: { value: v4() },
      uTeinte: { value: v4() },
    };
    this.passeVolume = new PassePleinEcran(new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      defines: {},
      uniforms: this.uniforms,
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_VOLUME, depthTest: false, depthWrite: false,
    }));
    // 2 bis. l'accumulation
    const optionsHistorique = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.historique = [new THREE.WebGLRenderTarget(4, 4, optionsHistorique), new THREE.WebGLRenderTarget(4, 4, optionsHistorique)];
    this.indexHistorique = 0;
    this.reinitialiser = true;
    this.vueProjectionPrecedente = new THREE.Matrix4();
    this.passeAccumulation = new PassePleinEcran(new THREE.ShaderMaterial({
      uniforms: {
        uCourant: { value: this.cible.textures[0] },
        uProfondeur: { value: this.cible.textures[1] },
        uHistorique: { value: null },
        uVueProjectionInverse: this.uniforms.uVueProjectionInverse,
        uVueProjectionPrecedente: { value: this.vueProjectionPrecedente },
        uPositionCamera: this.uniforms.uPositionCamera,
        uTexel: { value: new THREE.Vector2() },
        uMelange: { value: 0.1 },
        uReinitialiser: { value: true },
      },
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_ACCUMULATION, depthTest: false, depthWrite: false,
    }));

    // 3. la composition, dans la scène (avant la pluie et les embruns, qui sont devant)
    this.uniformsComposition = {
      uLumiere: { value: this.cible.textures[0] },
      uProfondeur: { value: this.cible.textures[1] },
      uTailleEcran: { value: new THREE.Vector2(1, 1) },
      uVueProjectionInverse: this.uniforms.uVueProjectionInverse,
      uPositionCamera: this.uniforms.uPositionCamera,
      uAvantCamera: { value: v3() },
      uProjection: { value: new THREE.Matrix4() },
    };
    this.composition = new THREE.Mesh(trianglePleinEcran(), new THREE.ShaderMaterial({
      uniforms: this.uniformsComposition, vertexShader: SOMMET_COMPOSITION, fragmentShader: FRAGMENT_COMPOSITION,
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    }));
    this.composition.frustumCulled = false;
    this.composition.renderOrder = 2.5;
    this.composition.visible = false;
    this.composition.name = 'trombe';
    scene.add(this.composition);
    // (pour la préparation des shaders, au démarrage : monde3d.precompiler)
    this.groupe = this.composition;

    // (pour l'atelier : montrer ou cacher chaque pièce, de 0 à 1)
    this.masque = { ent: 1, emb: 1, mur: 1, pluie: 1, ciel: 1, mer: 1 };
    this._p = v3();
    this._avant = v3();
    this.numeroImage = 0;
    this.choisirVariante(VARIANTE_DU_JEU);
  }

  choisirVariante(nom) {
    this.nomVariante = VARIANTES[nom] ? nom : VARIANTE_DU_JEU;
    this.variante = structuredClone(VARIANTES[this.nomVariante]);
    // (les trombes sœurs ne sont dans le programme de la carte graphique que s'il y en a :
    // il reste plus petit, donc plus rapide)
    const m = this.passeVolume.materiau;
    const soeurs = this.variante.soeurs > 0;
    if (!!m.defines.SOEURS !== soeurs) {
      if (soeurs) m.defines.SOEURS = '';
      else delete m.defines.SOEURS;
      m.needsUpdate = true;
    }
  }

  // La qualité de l'image : la taille du volume, le nombre de pas, les ombres
  reglerQualite({ echelle = 0.5, pas = 128, ombres = true } = {}) {
    this.echelle = echelle;
    this.pasMax = pas;
    this.ombres = ombres;
    if (this._taille) this.redimensionner(this._taille.x, this._taille.y);
  }

  redimensionner(largeur, hauteur) {
    this._taille = new THREE.Vector2(largeur, hauteur);
    const e = this.echelle * this.reduction;
    const l = Math.max(1, Math.round(largeur * e));
    const h = Math.max(1, Math.round(hauteur * e));
    this.cible.setSize(l, h);
    for (const rt of this.historique) rt.setSize(l, h);
    this.passeAccumulation.materiau.uniforms.uTexel.value.set(1 / l, 1 / h);
    this.reinitialiser = true;
    this.uniformsComposition.uTailleEcran.value.set(largeur, hauteur);
  }

  // trombe : { x, z, force, age, duree, grain } (quart/nuit.js), ou null ; directionVent : vers où
  // va le vent (radians, dans le plan) ; temps : l'horloge du monde ; nuit : 0 → 1 ;
  // eclaire : l'éclair autour de nous (monde3d)
  maj(dt, trombe, { temps, directionVent, camera = null, nuit = 0, noir = 0, eclaire = 0 }) {
    const visible = !!trombe && trombe.force > 0.005;
    // (quand elle réapparaît, on oublie les anciennes images)
    if (visible && !this.visible) this.reinitialiser = true;
    this.visible = visible;
    this.composition.visible = visible;
    this.brouillard = 0;
    const ue = this.eau.uniforms;
    const uc = this.ciel.uniformsNuages;
    if (!visible) {
      ue.uTrombe.value.w = 0;
      if (uc.uTrombeCiel) uc.uTrombeCiel.value.w = 0;
      return;
    }
    const V = this.variante;
    const vie = vieDeLaTrombe(trombe.age, trombe.duree);
    this.vie = vie;
    const u = this.uniforms;
    u.uT.value = temps;
    u.uVent.value.set(Math.cos(directionVent), Math.sin(directionVent));
    u.uNuit.value = nuit;
    u.uNoir.value = noir;
    u.uEclaire.value = eclaire;
    // (le plancton de la couronne d'écume, sur la mer : lui aussi, seulement dans le noir)
    if (ue.uTrombePlancton) ue.uTrombePlancton.value = smoothstep01(0.5, 0.95, nuit) * lerp(0.25, 1, smoothstep01(0.35, 0.8, noir));
    const pied = this.houle.hauteur(trombe.x, trombe.z);
    u.uPied.value.set(trombe.x, pied, trombe.z);
    // la base des nuages au-dessus d'elle (le nuage parent), et le nuage-mur dessous
    const baseNuages = uc.uBaseNuages.value;
    const abaissement = V.mur.abaissement * (0.35 + 0.65 * vie.mur);
    const hautEntonnoir = baseNuages - V.mur.abaissement;
    const force = trombe.force;
    const e = V.ent;
    u.uEnt.value.set(e.rPied, e.rMilieu, e.rHaut, hautEntonnoir);
    const pointe = lerp(hautEntonnoir, e.pointeMin, vie.descente);
    u.uEnt2.value.set(pointe, e.creux, e.nettete, e.effiloche);
    u.uEnt3.value.set(e.stries, e.torsion, e.rotation * (0.6 + 0.4 * force), e.montee);
    const k = this.masque;
    u.uEnt4.value.set(e.opacite * vie.opacite * k.ent, e.detail, vie.gerbe, 0);
    u.uAxe.value.set(V.axe.inclinaison, V.axe.meandres, V.axe.vitesse, vie.corde);
    u.uMur.value.set(V.mur.rayon, abaissement, V.mur.densite * (0.4 + 0.6 * vie.mur) * k.mur, baseNuages);
    u.uMur2.value.set(V.mur.rotation, V.mur.lambeaux * vie.mur * k.mur, V.mur.bandes, V.mur.rayon * 2.6);
    const g = V.emb;
    u.uEmb.value.set(g.coeur, g.hauteur, g.densite * k.emb, g.jupe);
    u.uEmb2.value.set(g.rotation, g.montee, g.bouillon, g.plancton);
    const r = V.rideau;
    // (le rideau de pluie est derrière elle, du côté d'où elle vient : elle s'en détache,
    // et le bateau, qu'elle vient chercher sous le vent, n'est pas dedans. Sous son grain
    // — quart/nuit.js —, c'est la pluie du grain qui fait ce rideau : la vraie, en colonnes, et
    // le crochet qui s'enroule autour d'elle — rendu/grains.js — ; on ne dessine pas le sien,
    // qui la cacherait)
    const densitePluie = trombe.grain ? 0 : r.densite * k.pluie;
    u.uRideau.value.set(directionVent + Math.PI + r.angle, r.ouverture, r.rayon, densitePluie * vie.mur);
    this.majSoeurs(temps, vie);
    this.majProfil(temps, vie.corde, hautEntonnoir);
    u.uExt.value.set(V.ext.ent, V.ext.emb, V.ext.mur, V.ext.pluie);
    u.uTeinte.value.set(...V.teinte, V.noirceur);
    // où il y a de la trombe (des cylindres, dans le repère du pied) : le shader n'avance à
    // petits pas que dedans. L'axe ne s'écarte jamais du pied de plus de « ecartAxe » ; le
    // haut de l'entonnoir est au-dessus du pied, emporté par le vent (axeTrombe, glsl/trombe.js).
    const corde = vie.corde;
    const inclinaison = V.axe.inclinaison * (1 + 2.4 * corde);
    const ecartAxe = inclinaison + V.axe.meandres * (1 + 3 * corde) * 1.45;
    const haut = new THREE.Vector2(Math.cos(directionVent), Math.sin(directionVent)).multiplyScalar(inclinaison);
    u.uCentreMur.value.set(haut.x, haut.y, ecartAxe, 0);
    const rayonEntonnoir = (x) => (e.rPied + (e.rMilieu - e.rPied) * x + (e.rHaut - e.rMilieu) * x ** 3.5) * 1.12 * (1 - 0.7 * lisse(corde, 0, 0.6)) * 1.55 + 3;
    const soeurs = V.soeurs > 0 ? 390 + 0.42 * (rayonEntonnoir(0.7) + ecartAxe) : 0;
    const gerbe = g.coeur * g.jupe * 1.15;
    u.uCoeurBas.value.set(0, 0, Math.max(gerbe, rayonEntonnoir(0.7) + ecartAxe, soeurs) + 5, Math.max(hautEntonnoir * 0.72, g.hauteur * 1.45));
    u.uCoeurHaut.value.set(haut.x * 0.5, haut.y * 0.5, rayonEntonnoir(1) + ecartAxe * 0.6 + 5, hautEntonnoir * 0.7);
    u.uDisque.value.set(haut.x, haut.y, V.mur.rayon * 1.18 * 1.15 + 10, 0);
    u.uDisqueY.value.set(baseNuages - V.mur.abaissement * 1.2 - (V.mur.lambeaux > 0 ? 270 : 100), baseNuages + 75);
    // (la boîte du rideau : le cercle qui contient son secteur d'anneau)
    if (densitePluie > 0) {
      const a0 = directionVent + Math.PI + r.angle;
      const points = [];
      for (let i = 0; i <= 8; i++) {
        const a = a0 - r.ouverture + (2 * r.ouverture * i) / 8;
        for (const rr of [0.45, 2.1]) points.push([Math.cos(a) * r.rayon * rr, Math.sin(a) * r.rayon * rr]);
      }
      const xs = points.map((p) => p[0]);
      const zs = points.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const rayonBoite = Math.max(...points.map(([x, z]) => Math.hypot(x - cx, z - cz))) + 10;
      u.uZonePluie.value.set(cx, cz, rayonBoite, baseNuages + 10);
    } else u.uZonePluie.value.set(0, 0, 0, 0);
    u.uBorne.value.set(this.pasMax, 0, 0, 0);

    // la mer : la tache sombre, les spirales, l'anneau d'écume (eau.js)
    ue.uTrombe.value.set(trombe.x, trombe.z, g.coeur, force * k.mer);
    ue.uTrombeVie?.value.set(vie.tache, vie.spirales, vie.anneau, g.rotation);
    // le nuage parent : au-dessus d'elle, le ciel est bouché (glsl/nuages.js)
    uc.uTrombeCiel?.value.set(trombe.x, trombe.z, V.mur.rayon * 2.6, force * k.ciel);

    // dans les embruns du pied, on ne voit plus rien : un brouillard d'eau qui avale tout
    if (camera) {
      const dist = Math.hypot(camera.position.x - trombe.x, camera.position.z - trombe.z);
      // (la résolution du volume selon la distance, avec un peu de marge pour ne pas
      // changer sans cesse d'une image à l'autre)
      // (loin, elle est petite à l'écran : on peut se permettre plus de pixels)
      const r0 = this.reduction;
      const niveaux = [[0, 0.58], [520, 0.74], [1100, 0.95], [1700, 1.1]];
      let i = niveaux.length - 1;
      while (i > 0 && dist < niveaux[i][0]) i--;
      // (on ne redescend que franchement en deçà du seuil : pas de va-et-vient)
      const iAvant = niveaux.findIndex((n) => n[1] === r0);
      if (iAvant > i && dist > niveaux[iAvant][0] - 80) i = iAvant;
      const reduction = niveaux[i][1];
      if (reduction !== r0) {
        this.reduction = reduction;
        if (this._taille) this.redimensionner(this._taille.x, this._taille.y);
      }
      this.brouillard = force * vie.gerbe * (1 - lisse(dist, g.coeur * 1.2, g.coeur * 3.5));
    }
    // le pied arrache la mer : des embruns qui tourbillonnent et montent
    this.emettreEmbruns(dt, trombe, pied, vie);
  }

  // Le profil des entonnoirs, pour la carte graphique (glsl/trombe.js : profil())
  majProfil(temps, corde, H) {
    const V = this.variante;
    const vent = this.uniforms.uVent.value;
    const parametresAxe = { H, vent, inclinaison: V.axe.inclinaison, meandres: V.axe.meandres, vitesse: V.axe.vitesse, corde, temps };
    const parametresRayon = { H, rPied: V.ent.rPied, rMilieu: V.ent.rMilieu, rHaut: V.ent.rHaut, corde, temps };
    const tailles = [1, this.uniforms.uSoeur0.value.z || 1, this.uniforms.uSoeur1.value.z || 1];
    const versDemi = THREE.DataUtils.toHalfFloat;
    const d = this.donneesProfil;
    for (let rangee = 0; rangee < 3; rangee++) {
      if (rangee > 0 && !V.soeurs) break;
      for (let i = 0; i < 128; i++) {
        const h = (i / 127) * H * 1.06;
        const [x, z] = axeTrombe(h, rangee * 2.7, parametresAxe, this._axe);
        const o = (rangee * 128 + i) * 4;
        d[o] = versDemi(x);
        d[o + 1] = versDemi(z);
        d[o + 2] = versDemi(rayonTrombe(h, tailles[rangee], parametresRayon));
        d[o + 3] = 0;
      }
    }
    this.profil.needsUpdate = true;
  }

  // Les trombes sœurs : elles descendent du nuage-mur l'une après l'autre, touchent la mer
  // un moment, puis remontent (un cycle de 70 et 95 s), en tournant autour de la grande
  majSoeurs(temps, vie) {
    const u = this.uniforms;
    const n = this.variante.soeurs;
    const vivante = vie.mur * (1 - vie.corde);
    const cycle = (periode, decale) => {
      const x = ((temps + decale) % periode) / periode;
      return lisse(x, 0.05, 0.4) * (1 - lisse(x, 0.7, 0.95));
    };
    const placer = (cible, k, rayon, taille, periode, decale) => {
      if (n <= k) {
        cible.set(0, 0, 0, 0);
        return;
      }
      const a = temps * 0.02 + k * 2.4;
      cible.set(Math.cos(a) * rayon, Math.sin(a) * rayon, taille, cycle(periode, decale) * vivante);
    };
    placer(u.uSoeur0.value, 0, 270, 0.42, 70, 0);
    placer(u.uSoeur1.value, 1, 390, 0.3, 95, 40);
  }

  emettreEmbruns(dt, trombe, pied, vie) {
    if (!this.embruns) return;
    const g = this.variante.emb;
    const n = Math.floor(60 * dt * trombe.force * vie.gerbe * 40 * (this.embruns.facteur ?? 1));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = g.coeur * (0.6 + Math.random() * 1.6);
      this._p.set(trombe.x + Math.cos(a) * r, pied + Math.random() * 4, trombe.z + Math.sin(a) * r);
      // (en tournant dans le sens inverse des aiguilles d'une montre, vu d'en haut)
      const tour = g.rotation * g.coeur * (0.7 + Math.random() * 0.5);
      this.embruns.emettre(this._p, {
        vx: Math.sin(a) * tour - Math.cos(a) * 4,
        vy: 6 + Math.random() * 14,
        vz: -Math.cos(a) * tour - Math.sin(a) * 4,
        vie: 1.8 + Math.random() * 2.5,
        taille: 1 + Math.random() * 3,
        opacite: 0.14,
      });
    }
  }

  // Prépare (compile) les passes du volume, qui n'apparaissent qu'avec la trombe
  async precompiler(camera) {
    const r = this.renderer;
    const ancienne = r.getRenderTarget();
    try {
      for (const passe of [this.passeAnneau, this.passeVolume, this.passeAccumulation]) await r.compileAsync(passe.mesh, cameraPleinEcran);
      // (et une vraie fois, hors de la vue : ce que la compilation oublie)
      this.passeAnneau.rendre(r, this.anneau);
      this.uniforms.uBorne.value.set(1, 0, 0, 0);
      this.uniforms.uVueProjectionInverse.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
      this.passeVolume.rendre(r, this.cible);
      this.passeAccumulation.materiau.uniforms.uHistorique.value = this.historique[0].texture;
      this.passeAccumulation.rendre(r, this.historique[1]);
      this.reinitialiser = true;
    } finally {
      r.setRenderTarget(ancienne);
    }
  }

  // Calcule le volume (avant de dessiner la scène)
  preparer(camera) {
    if (!this.visible) return;
    const r = this.renderer;
    const ancienne = r.getRenderTarget();
    this.passeAnneau.rendre(r, this.anneau);
    const u = this.uniforms;
    u.uVueProjectionInverse.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    u.uPositionCamera.value.copy(camera.position);
    u.uImage.value = this.numeroImage++ % 4096;
    u.uPixel.value = THREE.MathUtils.degToRad(camera.fov) / Math.max(1, this.cible.height);
    u.uOmbres.value = this.ombres ? 1 : 0;
    u.uBrume.value = this.eau.brumeDeBase ?? this.eau.uniforms.uBrume.value;
    camera.getWorldDirection(this.uniformsComposition.uAvantCamera.value);
    this.uniformsComposition.uProjection.value.copy(camera.projectionMatrix);
    // (le triangle couvre toute l'image : chaque pixel est écrit, pas besoin d'effacer)
    this.passeVolume.rendre(r, this.cible);
    // l'accumulation avec les images précédentes
    const ua = this.passeAccumulation.materiau.uniforms;
    const source = this.historique[this.indexHistorique];
    const cible = this.historique[1 - this.indexHistorique];
    ua.uHistorique.value = source.texture;
    ua.uReinitialiser.value = this.reinitialiser;
    this.passeAccumulation.rendre(r, cible);
    this.indexHistorique = 1 - this.indexHistorique;
    this.uniformsComposition.uLumiere.value = cible.texture;
    this.vueProjectionPrecedente.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.reinitialiser = false;
    r.setRenderTarget(ancienne);
  }
}
