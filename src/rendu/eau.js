// La mer à l'écran.
//
// 1. À chaque image, la houle (mer/houle.js) a calculé ses quatre grilles sur le
//    processeur. On les envoie à la carte graphique, qui en tire pour chaque grille :
//    - le déplacement de l'eau (pour soulever et pousser les sommets du maillage),
//    - la pente de la surface (pour l'éclairage) et l'écume.
//    Des versions de plus en plus floues de ces images (les « mipmaps ») servent au
//    loin, là où les petites vagues ne se voient plus et scintilleraient.
// 2. Le maillage de la mer est une grande toile d'araignée centrée sur la caméra :
//    très fine sous nos yeux, de plus en plus lâche jusqu'à 24 km.
// 3. La couleur de l'eau : le reflet du ciel (de plus en plus fort quand on regarde
//    la mer en rasant : c'est l'effet Fresnel), les éclats du soleil, la lumière qui
//    traverse les crêtes (vert d'eau), le bleu sombre du fond, l'écume et la brume.
import * as THREE from 'three';
import { PassePleinEcran, SOMMET_PLEIN_ECRAN } from './outils.js';
import { GLSL_CARTE_CIEL } from './ciel.js';
import { GLSL_COQUE } from '../bateau/glsl-coque.js';
import { COQUE } from '../bateau/forme.js';
import { glslFront } from './glsl/front.js';
import { LONGUEUR as LONGUEUR_CARGO, GLSL_CARGO } from './forme-cargo.js';
import { GLSL_SCELERATE, reglerUniformsScelerate } from '../mer/scelerate.js';
import { glslGrains } from './glsl/grains.js';

const N_SILLAGE = 24; // points du sillage (le premier : la poupe ; puis un toutes les 2,5 s)
const N_CARGO = 24; // ceux du cargo (un toutes les 7 s : près de trois minutes, plus d'un kilomètre)

const FRAGMENT_PREPARATION = /* glsl */ `
in vec2 vUv;
uniform highp sampler2D uDonnees;
uniform float uPas;
uniform int uN;
layout(location = 0) out vec4 sortieDeplacement;
layout(location = 1) out vec4 sortiePentes;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int n = uN;
  vec4 d = texelFetch(uDonnees, c, 0);
  // positions déplacées des quatre voisins → deux vecteurs le long de la surface
  vec3 xp = texelFetch(uDonnees, ivec2((c.x + 1) % n, c.y), 0).xyz;
  vec3 xm = texelFetch(uDonnees, ivec2((c.x + n - 1) % n, c.y), 0).xyz;
  vec3 zp = texelFetch(uDonnees, ivec2(c.x, (c.y + 1) % n), 0).xyz;
  vec3 zm = texelFetch(uDonnees, ivec2(c.x, (c.y + n - 1) % n), 0).xyz;
  vec3 tx = vec3(2.0 * uPas, 0.0, 0.0) + xp - xm;
  vec3 tz = vec3(0.0, 0.0, 2.0 * uPas) + zp - zm;
  vec3 normale = normalize(cross(tz, tx));
  vec2 pente = -normale.xz / max(normale.y, 0.08);
  sortieDeplacement = d;
  // la pente au carré sert à mesurer, au loin, à quel point la surface est « froissée »
  sortiePentes = vec4(pente, dot(pente, pente), d.w);
}
`;

// Le shader des sommets est écrit pour le nombre de grilles de la houle : une ligne
// de code par grille (le GLSL ne sait pas parcourir un tableau de textures).
// Seules les grilles qui déplacent l'eau d'au moins quelques centimètres y figurent.
function sommetEau(cascades) {
  const utiles = cascades.map((c, i) => ({ c, i })).filter(({ c }) => c.taille > 3);
  return /* glsl */ `
${utiles.map(({ i }) => `uniform sampler2D uDeplacement${i};`).join('\n')}
${cascades.map((_, i) => `uniform vec3 uGrille${i}; // taille, texel, niveau de flou maximal`).join('\n')}
uniform vec3 uCentre;
uniform float uPasAngulaire;
uniform sampler2D uCarteCiel;
uniform highp sampler3D uBruit;
uniform float uBrume;
out vec3 vMonde;
out vec2 vSource;
out float vHauteur;
out vec4 vRideaux;
const float PI = 3.14159265359;
${GLSL_SCELERATE}
${GLSL_CARTE_CIEL}
${glslGrains('uBruit')}

// Lit une grille ; au loin (sommets espacés), dans une version floue de la grille
vec3 lireCascade(sampler2D t, vec2 xz, vec3 grille, float espacement) {
  float lod = log2(max(espacement / grille.y, 1.0)) + 0.5;
  float poids = 1.0 - smoothstep(grille.z - 1.5, grille.z, lod);
  if (poids <= 0.0) return vec3(0.0);
  return textureLod(t, xz / grille.x, lod).xyz * poids;
}

void main() {
  vec2 local = position.xz;
  float r = length(local);
  vec2 xz = local + uCentre.xz;
  float espacement = max(r * uPasAngulaire, 0.01);
  vec3 d = vec3(0.0);
${utiles.map(({ i }) => `  d += lireCascade(uDeplacement${i}, xz, uGrille${i}, espacement);`).join('\n')}
  // la vague scélérate, quand il y en a une (mer/scelerate.js)
  Scelerate sc = scelerate(xz);
  d.y += sc.h;
  d.xz += uScelerate.zw * sc.d;
  vec3 monde = vec3(xz.x + d.x, d.y, xz.y + d.z);
  // la Terre est ronde : au loin, la mer passe sous l'horizon
  vec2 ecart = monde.xz - cameraPosition.xz;
  monde.y -= dot(ecart, ecart) / (2.0 * 6371000.0);
  vMonde = monde;
  vSource = xz;
  vHauteur = d.y;
  // les rideaux de pluie des grains entre nous et ce point de la mer (et, sous un grain, la
  // pluie tout autour de nous) : calculés à chaque sommet (le voile change lentement d'un
  // pixel à l'autre ; dix fois moins de calculs)
  vRideaux = vec4(0.0, 0.0, 0.0, 1.0);
  if (uRideauxN > 0) {
    vec3 versPoint = monde - cameraPosition;
    float dist = length(versPoint);
    vec3 dir = versPoint / max(dist, 1e-3);
    vec3 horizon = textureLod(uCarteCiel, uvCarteCiel(normalize(vec3(dir.x, 0.015, dir.z))), 0.0).rgb;
    vRideaux = rideaux(cameraPosition, dir, dist, uBrume, horizon);
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(monde, 1.0);
}
`;
}

// Poids de chaque grille dans l'écume (les rides ne font pas d'écume)
const POIDS_ECUME = [1.1, 1.0, 0.7, 0.25, 0.0];

function fragmentEau(cascades) {
  return /* glsl */ `
in vec3 vMonde;
in vec2 vSource;
in float vHauteur;
in vec4 vRideaux;
${cascades.map((_, i) => `uniform sampler2D uPentes${i};`).join('\n')}
${cascades.map((_, i) => `uniform vec3 uGrille${i};`).join('\n')}
uniform samplerCube uReflets;
uniform sampler2D uCarteCiel;
uniform sampler3D uBruit;
uniform vec3 uDirSoleil;
uniform vec3 uSoleil;
uniform vec3 uDirLune;
uniform vec3 uLune;
uniform vec3 uAmbiance;
uniform float uRugosite;
uniform float uBrume;
uniform float uTemps;
uniform float uHs;
uniform float uEclair;
uniform vec3 uDirEclair; // (vers l'éclair : sa lumière vient de là)
uniform vec3 uCouleurFond;
uniform vec3 uCouleurTranslucide;
uniform float uForceEcume;
uniform float uSeuilEcume;
uniform vec2 uDirVent;
uniform vec4 uTrombe; // la trombe : x, z, rayon de son cœur (m), force (0 : pas de trombe)
uniform vec4 uTrombeVie; // sa vie sur l'eau : la tache sombre, les spirales, l'anneau d'embruns (0 → 1), sa rotation (rad/s)
uniform float uTrombePlancton; // le plancton de sa couronne d'écume (0 → 1 : seulement dans le noir)
// le sillage : où était la poupe (x, z), à quel instant (s), à quelle vitesse (m/s) ; le
// premier point est la poupe elle-même ; et la boîte qui les contient tous (pour aller vite)
uniform vec4 uSillage[${N_SILLAGE}];
uniform int uSillageN;
uniform vec4 uSillageBoite;
uniform float uVitesseBateau; // m/s
uniform float uPlancton;      // la nuit, l'écume remuée par le bateau s'illumine (0 → 1)
// la lumière du bord : la frontale (position, direction ; intensité, cosinus du bord du
// cône et de son plein, portée) et les quatre feux de navigation, chacun dans son secteur
// (position, portée ; direction, cosinus du bord du cône ; couleur × intensité, cosinus
// de son plein)
uniform vec3 uLampePos;
uniform vec3 uLampeDir;
uniform vec4 uLampe;
uniform vec4 uFeux[4];
uniform vec4 uFeuxDir[4];
uniform vec4 uFeuxCouleur[4];
// le cargo : son repère (pour l'écume le long de sa coque), présent ou non et sa vitesse,
// et son sillage (comme celui du bateau)
uniform mat4 uCargoInverse;
uniform vec4 uCargo;          // présent (0 ou 1), vitesse (m/s)
uniform vec4 uCargoSillage[${N_CARGO}];
uniform int uCargoSillageN;
uniform vec4 uCargoBoite;
// la chose sous la coque (jeu/peur.js) : x, z, sa route (rad, dans le plan x z), sa force ;
// elle remue le plancton en passant : on devine sa forme, immense
uniform vec4 uChose;
// la forme pâle sous la surface (jeu/peur.js) : x, z, son orientation (rad), son opacité
uniform vec4 uForme;

const float PI = 3.14159265359;
${GLSL_CARTE_CIEL}
${GLSL_COQUE}
${GLSL_CARGO}
${GLSL_SCELERATE}
// La chose : une forme fuselée de 34 m (plus large vers l'avant, une longue queue), sous
// la surface ; 1 dans son corps, 0 dehors (les bords flous : elle est profonde)
float formeChose(vec2 p) {
  vec2 dir = vec2(cos(uChose.z), sin(uChose.z));
  vec2 q = p - uChose.xy;
  float u = dot(q, dir) / 34.0; // (−0,5 : la queue, 0,5 : la tête)
  float l = dot(q, vec2(-dir.y, dir.x));
  if (abs(u) > 0.7 || abs(l) > 12.0) return 0.0;
  float largeur = 4.6 * smoothstep(-0.62, 0.05, u) * (1.0 - smoothstep(0.32, 0.58, u)) + 0.5;
  // (deux nageoires, à peine ; un bord qui n'est jamais net)
  largeur += 2.4 * exp(-pow((u - 0.16) / 0.05, 2.0)) + 2.2 * exp(-pow((u + 0.6) / 0.035, 2.0));
  largeur *= 0.88 + 0.24 * texture(uBruit, vec3(u * 2.6, 0.83, uTemps * 0.05)).a;
  // (la queue ondule)
  l += sin(u * 9.0 - uTemps * 1.8) * 1.2 * (1.0 - smoothstep(-0.5, 0.0, u));
  return smoothstep(1.8, -1.2, abs(l) - largeur) * smoothstep(-0.68, -0.5, u) * (1.0 - smoothstep(0.52, 0.62, u));
}

// L'écume de la vague scélérate quand sa crête s'écroule : une écume épaisse qui dévale
// le haut du front en coulées (elle avance avec la crête), et derrière, la traîne qu'elle
// laisse sur l'eau (elle reste où elle est tombée, et s'efface)
float ecumeScelerate(Scelerate sc, vec2 p) {
  float deferle = uScelerate3.y;
  if (deferle < 0.01 || sc.e < 0.01) return 0.0;
  float L = uScelerate2.z;
  float W = uScelerate2.w;
  float u = sc.s / L; // (0 à la crête ; + devant, là où elle va)
  // (elle ne brise pas partout pareil le long de sa crête)
  float le = sc.l / W;
  float crete = exp(-le * le * 1.8) * smoothstep(0.25, 0.7, texture(uBruit, vec3(sc.l * 0.011, 0.31, uTemps * 0.02)).a + 0.3);
  // les coulées sur le front : étirées dans la pente, elles descendent
  float coulees = texture(uBruit, vec3(sc.l * 0.06, sc.s * 0.018 - uTemps * 0.11, 0.53 + uTemps * 0.01)).a * 0.7
                + texture(uBruit, vec3(sc.l * 0.19, sc.s * 0.05 - uTemps * 0.3, 0.77)).b * 0.3;
  float bas = 0.025 + 0.11 * deferle * coulees;
  float front = smoothstep(-0.04, -0.005, u) * (1.0 - smoothstep(bas, bas + 0.04, u));
  // la traîne : des plaques posées sur l'eau, de plus en plus rares loin derrière
  float plaques = texture(uBruit, vec3(p * 0.016, 0.17)).a * 0.6 + texture(uBruit, vec3(p * 0.05, 0.43)).b * 0.4;
  float loin = smoothstep(0.0, 0.5, -u);
  float traine = step(u, 0.0) * (1.0 - loin) * smoothstep(0.42 + 0.35 * loin, 0.6 + 0.3 * loin, plaques);
  return deferle * crete * max(front, traine * 0.85);
}
${glslFront('uBruit')}
${glslGrains('uBruit')}

float saturer(float x) { return clamp(x, 0.0, 1.0); }

// L'écume que fait le bateau : le long de la coque (l'eau qu'il fend, plus forte à l'étrave
// et quand il va vite : la « moustache »), puis derrière lui, son sillage : des remous blancs
// qui s'élargissent et s'effacent, puis une traînée d'eau lisse (les petites rides ont été
// effacées : elle brille autrement que la mer autour). Le sillage suit la vraie route du
// bateau (ses virages aussi). Rend (force, voile d'écume, lisse, bulles), de 0 à 1.
// (son motif est étiré le long de la route, pas dans le sens du vent comme celui des vagues)
float motifEcume(float force, float motif) {
  return smoothstep(1.0 - force, 1.0 - force + 0.35, motif) * (0.3 + 0.6 * force);
}
vec4 ecumeDuBateau(vec3 pMonde) {
  if (uClipCoque < 0.5) return vec4(0.0);
  float force = 0.0;
  float bulles = 0.0;
  float voile = 0.0;
  float lisse = 0.0;
  float v = clamp(uVitesseBateau / 3.0, 0.0, 1.3);
  // le long de la coque (dans le repère du bateau)
  vec3 p = (uBateauInverse * vec4(pMonde, 1.0)).xyz;
  float u = (p.z - ${COQUE.zArriere.toFixed(3)}) / ${(COQUE.zAvant - COQUE.zArriere).toFixed(3)};
  if (u > -0.1 && u < 1.08) {
    float w = coqueDemiLargeur(clamp(u, 0.0, 1.0)) * 0.94;
    float d = abs(p.x) - w;
    float proue = smoothstep(0.6, 0.97, u);
    float largeur = 0.3 + (0.5 + 1.2 * proue) * v;
    float bande = (1.0 - smoothstep(0.0, largeur, d)) * smoothstep(-0.6, 0.0, d + 0.3);
    force = saturer(bande * (0.25 + 0.9 * v) * (0.7 + 0.8 * proue));
    bulles = force;
    // des traînées qui filent vers l'arrière à la vitesse du bateau
    float zEau = p.z + uTemps * uVitesseBateau;
    float stries = texture(uBruit, vec3(p.x * 0.5, zEau * 0.1, 0.33)).a * 0.65 + texture(uBruit, vec3(p.x * 1.6, zEau * 0.35, 0.71)).b * 0.35;
    voile = motifEcume(force, stries + proue * 0.15);
  }
  // le sillage
  if (uSillageN > 1 && pMonde.x > uSillageBoite.x && pMonde.x < uSillageBoite.z && pMonde.z > uSillageBoite.y && pMonde.z < uSillageBoite.w) {
    float meilleur = 1e9;
    float age = 0.0;
    float vit = 0.0;
    vec2 sens = vec2(0.0, 1.0);
    for (int i = 0; i < ${N_SILLAGE - 1}; i++) {
      if (i + 1 >= uSillageN) break;
      vec4 a = uSillage[i];
      vec4 b = uSillage[i + 1];
      vec2 ab = b.xy - a.xy;
      vec2 ap = pMonde.xz - a.xy;
      float t = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
      float d = length(ap - ab * t);
      if (d < meilleur) { meilleur = d; age = uTemps - mix(a.z, b.z, t); vit = mix(a.w, b.w, t); sens = ab; }
    }
    sens = length(sens) > 1e-3 ? normalize(sens) : vec2(0.0, 1.0);
    float allure = clamp(vit / 4.0, 0.0, 1.2);
    // les remous : larges comme le bateau à la poupe, puis ils s'étalent et s'effacent
    float largeur = 1.1 + 0.22 * age;
    float coeur = (1.0 - smoothstep(largeur * 0.25, largeur, meilleur)) * allure;
    float fs = coeur * exp(-age / 14.0);
    bulles = max(bulles, coeur * exp(-age / 6.0));
    // (le motif est fixe dans l'eau : on le lit dans le repère de la route)
    vec2 q = vec2(dot(pMonde.xz, sens), dot(pMonde.xz, vec2(-sens.y, sens.x)));
    // de grandes plaques, des veines qui les marbrent, et un grain fin de bulles
    float plaques = texture(uBruit, vec3(q.x * 0.07, q.y * 0.3, 0.47 + age * 0.004)).a;
    float veines = 1.0 - abs(texture(uBruit, vec3(q.x * 0.22, q.y * 0.8, 0.81 - age * 0.006)).b * 2.0 - 1.0);
    float grain = texture(uBruit, vec3(q.x * 0.9, q.y * 2.2, 0.13 + age * 0.01)).a;
    float remous = plaques * 0.5 + veines * veines * 0.32 + grain * 0.18;
    force = max(force, saturer(fs));
    voile = max(voile, motifEcume(saturer(fs), remous));
    // la traînée lisse, plus large et plus longue
    lisse = (1.0 - smoothstep(largeur * 0.8, largeur * 1.9, meilleur)) * exp(-age / 50.0) * allure;
  }
  return vec4(force, voile, saturer(lisse), saturer(bulles));
}

// Le sillage du cargo (185 m, 14 nœuds) : la grosse vague d'étrave et l'eau qu'il repousse
// le long de sa coque ; les deux bras du « V » qui s'ouvrent derrière l'étrave (à 19,5° de
// sa route, comme derrière tout navire : l'angle de Kelvin) ; puis derrière son hélice un
// remous blanc large comme lui, qui s'étale et laisse une longue cicatrice d'eau lisse,
// qui suit sa vraie route. Rend (force, voile d'écume, lisse, bulles), comme pour le bateau.
vec4 ecumeDuCargo(vec3 pMonde) {
  if (uCargo.x < 0.5) return vec4(0.0);
  float force = 0.0;
  float voile = 0.0;
  float lisse = 0.0;
  float bulles = 0.0;
  float v = clamp(uCargo.y / 7.5, 0.0, 1.3);
  // près de lui (dans son repère : l'avant vers -z)
  vec3 p = (uCargoInverse * vec4(pMonde, 1.0)).xyz;
  float derriere = p.z + ${(LONGUEUR_CARGO / 2).toFixed(1)}; // derrière l'étrave (m)
  float ax = abs(p.x);
  if (derriere > -20.0 && derriere < 420.0 && ax < 200.0) {
    // le long de la coque : l'eau repoussée, épaisse à l'étrave (elle s'écarte jusqu'à
    // une dizaine de mètres), plus mince ensuite
    float w = cargoDemiLargeur(p.z);
    float d = ax - w;
    float etrave = 1.0 - smoothstep(0.0, 80.0, derriere);
    float largeur = (2.5 + 13.0 * etrave) * v;
    float coque = derriere < ${LONGUEUR_CARGO.toFixed(1)} + 5.0 ? (1.0 - smoothstep(0.0, largeur, d)) * smoothstep(-3.0, 0.0, d + 1.5) * smoothstep(-12.0, 0.0, derriere) : 0.0;
    // (des traînées qui filent vers l'arrière à sa vitesse)
    float zEau = p.z - uTemps * uCargo.y;
    float stries = texture(uBruit, vec3(p.x * 0.12, zEau * 0.025, 0.41)).a * 0.65 + texture(uBruit, vec3(p.x * 0.4, zEau * 0.09, 0.77)).b * 0.35;
    float fc = saturer(coque * (0.35 + 0.9 * etrave) * v);
    // les bras du V : ils quittent la coque aux épaules de l'étrave, puis s'ouvrent à 19,5°
    float bras = 0.0;
    if (derriere > 5.0) {
      float xa = 4.0 + derriere * 0.36 + 10.0 * smoothstep(0.0, 45.0, derriere);
      float l = 2.0 + derriere * 0.03;
      bras = (1.0 - smoothstep(0.0, l + 3.0, abs(ax - xa))) * exp(-derriere / 170.0) * v;
      // (en courtes crêtes, en biais : les vagues qui divergent, à 35° de sa route, ne
      // brisent que par endroits ; elles dessinent des plumes le long du bras)
      float leLong = ax * 0.574 + derriere * 0.819;
      float travers = ax * 0.819 - derriere * 0.574;
      float cretes = texture(uBruit, vec3(leLong * 0.02, travers * 0.11, 0.63 + uTemps * 0.008)).a * 0.7
                   + texture(uBruit, vec3(leLong * 0.06, travers * 0.3, 0.27)).b * 0.3;
      bras *= smoothstep(0.42, 0.68, cretes + bras * 0.2);
    }
    force = max(fc, saturer(bras));
    voile = max(motifEcume(fc, stries + etrave * 0.2), motifEcume(saturer(bras), stries));
    bulles = max(fc * 0.8, bras * 0.5);
  }
  // le sillage de l'hélice
  if (uCargoSillageN > 1 && pMonde.x > uCargoBoite.x && pMonde.x < uCargoBoite.z && pMonde.z > uCargoBoite.y && pMonde.z < uCargoBoite.w) {
    float meilleur = 1e9;
    float age = 0.0;
    float vit = 0.0;
    vec2 sens = vec2(0.0, 1.0);
    for (int i = 0; i < ${N_CARGO - 1}; i++) {
      if (i + 1 >= uCargoSillageN) break;
      vec4 a = uCargoSillage[i];
      vec4 b = uCargoSillage[i + 1];
      vec2 ab = b.xy - a.xy;
      vec2 ap = pMonde.xz - a.xy;
      float t = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
      float d = length(ap - ab * t);
      if (d < meilleur) { meilleur = d; age = uTemps - mix(a.z, b.z, t); vit = mix(a.w, b.w, t); sens = ab; }
    }
    sens = length(sens) > 1e-3 ? normalize(sens) : vec2(0.0, 1.0);
    float allure = clamp(vit / 7.5, 0.0, 1.2);
    // large comme le navire à la poupe, il s'étale d'un mètre toutes les trois secondes ;
    // ses bords sont déchiquetés
    float largeur = 14.0 + 0.3 * age;
    meilleur *= 0.75 + 0.5 * texture(uBruit, vec3(pMonde.xz * 0.012, 0.91)).a;
    float coeur = (1.0 - smoothstep(largeur * 0.35, largeur, meilleur)) * allure;
    float fs = coeur * exp(-age / 30.0);
    vec2 q = vec2(dot(pMonde.xz, sens), dot(pMonde.xz, vec2(-sens.y, sens.x)));
    float plaques = texture(uBruit, vec3(q.x * 0.022, q.y * 0.07, 0.29 + age * 0.002)).a;
    float veines = 1.0 - abs(texture(uBruit, vec3(q.x * 0.07, q.y * 0.22, 0.61 - age * 0.003)).b * 2.0 - 1.0);
    float grain = texture(uBruit, vec3(q.x * 0.3, q.y * 0.7, 0.05 + age * 0.005)).a;
    float remous = plaques * 0.5 + veines * veines * 0.32 + grain * 0.18;
    force = max(force, saturer(fs));
    voile = max(voile, motifEcume(saturer(fs), remous));
    bulles = max(bulles, coeur * exp(-age / 20.0));
    // la cicatrice : une bande d'eau lisse, plus large, qui dure des minutes
    lisse = (1.0 - smoothstep(largeur * 0.9, largeur * 1.7, meilleur)) * exp(-age / 160.0) * allure;
  }
  return vec4(saturer(force), saturer(voile), saturer(lisse), saturer(bulles));
}

// Reflet d'un astre (modèle GGX : la tache de lumière s'élargit quand l'eau est agitée)
float eclat(vec3 n, vec3 v, vec3 l, float a) {
  vec3 h = normalize(v + l);
  float nl = max(dot(n, l), 0.0);
  float nh = max(dot(n, h), 0.0);
  float nv = max(dot(n, v), 1e-4);
  float vh = max(dot(v, h), 0.0);
  float a2 = a * a;
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = a * 0.5;
  float G = (nl / (nl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));
  float F = 0.02 + 0.98 * pow(1.0 - vh, 5.0);
  return D * G * F / (4.0 * nv);
}

// La lumière qu'une lampe du bord envoie sur ce point de la mer (comme Three le calcule
// pour le bateau : décroissance avec la distance, coupée à sa portée), et sa direction
float eclairement(vec3 position, float portee, float decroissance, out vec3 l) {
  vec3 versLampe = position - vMonde;
  float d = length(versLampe);
  l = versLampe / max(d, 1e-3);
  float k = 1.0 / max(pow(d, decroissance), 0.01);
  if (portee > 0.0) k *= pow(saturer(1.0 - pow(d / portee, 4.0)), 2.0);
  return k;
}

void main() {
  // pas d'eau à l'intérieur du bateau (la cabine, le cockpit quand il gîte)
  if (uClipCoque > 0.5 && dansCoque(vMonde)) discard;
  vec2 pente = vec2(0.0);
  // « froissement » de la surface que l'image ne peut plus montrer (au loin) :
  // il élargit les reflets au lieu de les faire scintiller
  float variance = 0.0;
  float ecume = 0.0;
  vec4 p;
${cascades.map((_, i) => `  p = texture(uPentes${i}, vSource / uGrille${i}.x);
  pente += p.xy; variance += max(p.z - dot(p.xy, p.xy), 0.0); ecume += p.w * ${(POIDS_ECUME[i] ?? 0).toFixed(2)};`).join('\n')}
  ecume *= uForceEcume;
  // la vague scélérate : sa pente ; sa face, hachée par le vent et les embruns, ne fait
  // pas miroir
  Scelerate sc = scelerate(vSource);
  pente += sc.pente;
  float uFace = sc.s / max(uScelerate2.z, 1.0);
  variance += 0.14 * sc.e * (0.35 + 0.65 * uScelerate3.y) * smoothstep(-0.06, 0.01, uFace) * (1.0 - smoothstep(0.12, 0.5, uFace));

  // le bateau : son écume, et l'eau qu'il a lissée derrière lui (moins de petites rides)
  // (celle du bateau et celle du cargo, s'il est là)
  vec4 bateau = max(ecumeDuBateau(vMonde), ecumeDuCargo(vMonde));
  pente *= 1.0 - 0.35 * bateau.z;
  variance *= 1.0 - 0.7 * bateau.z;
  // la rafale d'un grain : l'air froid qui s'étale ride la mer (elle ne reflète plus le
  // ciel clair de l'horizon : elle fonce), et son bord avance comme une ligne sombre
  vec2 rafale = rafaleGrains(vMonde.xz);
  variance += 0.09 * rafale.x + 0.14 * rafale.y;

  vec3 n = normalize(vec3(-pente.x, 1.0, -pente.y));
  vec3 versOeil = cameraPosition - vMonde;
  float distance = length(versOeil);
  vec3 v = versOeil / distance;

  vec3 couleur;
  if (!gl_FrontFacing) {
    // on voit l'eau par en dessous (une crête plus haute que nos yeux) : vert sombre
    couleur = uCouleurTranslucide * (uAmbiance + uSoleil) * 0.4;
  } else {
    float nv = max(dot(n, v), 1e-4);
    float fresnel = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
    float a = clamp(sqrt(variance * 0.5 + uRugosite * uRugosite * (1.0 - 0.6 * bateau.z)), 0.02, 0.6);

    // le reflet du ciel (jamais sous l'horizon : on reflète alors le ciel bas)
    vec3 r = reflect(-v, n);
    r.y = abs(r.y);
    float lod = clamp(log2(a * 200.0), 0.0, 6.0);
    vec3 reflet = textureLod(uReflets, r, lod).rgb;
    // (l'éclair se reflète dans les pentes tournées vers lui ; une vague entre lui et nous
    // reste un mur noir qui se découpe sur le ciel)
    float versEclair = saturer(dot(r, uDirEclair) * 0.75 + 0.25);
    reflet += vec3(0.55, 0.6, 0.75) * uEclair * 0.6 * versEclair * versEclair;

    // les éclats du soleil et de la lune
    vec3 eclats = uSoleil * eclat(n, v, uDirSoleil, a) * 1.6 + uLune * eclat(n, v, uDirLune, a) * 1.6;

    // le bleu du fond et la lumière qui traverse les crêtes
    vec3 lumiere = uAmbiance + uSoleil * max(uDirSoleil.y, 0.0) + uLune * max(uDirLune.y, 0.0) + vec3(uEclair * 0.3 * saturer(dot(n, uDirEclair) * 0.8 + 0.2));
    vec3 corps = uCouleurFond * lumiere;
    float crete = saturer(vHauteur / max(uHs * 0.6, 0.25) * 0.5 + 0.5);
    float contreJour = pow(saturer(dot(-v, uDirSoleil) * 0.8 + 0.2), 3.0);
    float dosVague = saturer(dot(n, -v) * 0.5 + 0.6); // les faces qui se dérobent au regard
    corps += uCouleurTranslucide * (uSoleil * contreJour * 1.4 + uAmbiance * 0.35) * crete * crete * dosVague;

    // la lumière du bord : la frontale dans son cône, les feux tout autour d'eux ; l'eau en
    // renvoie des éclats sur chaque ride tournée vers nous (le faisceau d'une lampe sur
    // l'eau noire : une tache d'étincelles), et un peu de son bleu sombre
    vec3 lumiereBord = vec3(0.0);
    if (uLampe.x > 0.0) {
      vec3 l;
      float k = eclairement(uLampePos, uLampe.w, 1.5, l);
      k *= smoothstep(uLampe.y, uLampe.z, dot(-l, uLampeDir));
      vec3 e = vec3(1.0, 0.91, 0.78) * uLampe.x * k;
      lumiereBord += e * max(dot(n, l), 0.0);
      eclats += e * eclat(n, v, l, max(a, 0.08)) * 1.6;
    }
    for (int i = 0; i < 4; i++) {
      if (uFeux[i].w <= 0.0) continue;
      vec3 l;
      float k = eclairement(uFeux[i].xyz, uFeux[i].w, 2.0, l);
      k *= smoothstep(uFeuxDir[i].w, uFeuxCouleur[i].w, dot(-l, uFeuxDir[i].xyz));
      vec3 e = uFeuxCouleur[i].rgb * k;
      lumiereBord += e * max(dot(n, l), 0.0);
      eclats += e * eclat(n, v, l, max(a, 0.08)) * 1.6;
    }
    corps += uCouleurFond * lumiereBord * 1.5 + uCouleurTranslucide * lumiereBord * 0.25 * crete;

    couleur = corps * (1.0 - fresnel) + reflet * fresnel + eclats;
    // sous les remous du bateau, l'eau pleine de bulles s'éclaircit, turquoise
    couleur += uCouleurTranslucide * lumiere * bateau.w * 0.4 * (1.0 - fresnel);

    // l'écume : fraîche et épaisse sur la crête qui déferle, puis une dentelle de bulles
    // qui s'étire dans le sens du vent et s'efface
    vec2 vent = uDirVent;
    vec2 q = vec2(dot(vSource, vent), dot(vSource, vec2(-vent.y, vent.x)));
    float dentelle = texture(uBruit, vec3(q.x * 0.045, q.y * 0.16, 0.21 + uTemps * 0.003)).a * 0.55
                   + texture(uBruit, vec3(q.x * 0.17, q.y * 0.5, 0.63 - uTemps * 0.005)).b * 0.3
                   + texture(uBruit, vec3(vSource * 0.9, 0.4)).a * 0.15;
    // seuil réglé selon le vent : ~1 % de la mer blanchit par 13 nœuds, ~20 % par 48 nœuds
    // (sous la rafale d'un grain, la mer blanchit davantage)
    float seuil = uSeuilEcume - 0.16 * rafale.x;
    float fraiche = smoothstep(seuil, seuil + 0.35, ecume);
    // la trombe arrache la mer. Sa vie, sur l'eau (Golden, 1974) : d'abord une tache
    // sombre ; puis des bandes d'écume qui s'enroulent en spirales vers son pied ; puis
    // l'anneau d'embruns, une couronne d'eau blanche et chaotique qui tourbillonne autour
    // du cœur (vite près du cœur, lentement au loin : le tourbillon de Rankine)
    float ecumeTrombe = 0.0;
    if (uTrombe.w > 0.01) {
      vec2 dt = vMonde.xz - uTrombe.xy;
      float d = length(dt);
      float R = uTrombe.z;
      if (d < R * 14.0) {
        // (deux motifs qui vivent chacun 3 s, l'un apparaissant quand l'autre s'efface :
        // sinon, tournant plus vite au centre, le motif s'enroulerait sans fin)
        float omega = uTrombeVie.w * R * R / max(d * d, R * R);
        float x = uTemps / 3.0;
        float fa = fract(x);
        float fb = fract(x + 0.5);
        float wa = 1.0 - abs(2.0 * fa - 1.0);
        vec2 qa = mat2(cos(omega * fa * 3.0), sin(omega * fa * 3.0), -sin(omega * fa * 3.0), cos(omega * fa * 3.0)) * dt;
        vec2 qb = mat2(cos(omega * fb * 3.0), sin(omega * fb * 3.0), -sin(omega * fb * 3.0), cos(omega * fb * 3.0)) * dt;
        float ca = floor(x);
        float cb = floor(x + 0.5) + 0.5;
        vec4 na = texture(uBruit, vec3(qa / (R * 1.6), 0.37 + fract(ca * 0.618)));
        vec4 nb = texture(uBruit, vec3(qb / (R * 1.6), 0.37 + fract(cb * 0.618)));
        vec4 n = mix(nb, na, wa);
        // les spirales : des bandes en spirale logarithmique qui s'enroulent vers le cœur
        // et tournent lentement
        float a = atan(dt.y, dt.x);
        float bande = 0.5 + 0.5 * sin(3.0 * (a + 2.3 * log(max(d, 1.0) / R)) + uTemps * 0.9 * uTrombeVie.w);
        float zoneSpirales = smoothstep(R * 0.9, R * 2.2, d) * (1.0 - smoothstep(R * 5.0, R * 13.0, d));
        float spirales = smoothstep(0.62, 0.92, bande * 0.75 + n.a * 0.45) * zoneSpirales * uTrombeVie.y;
        // l'anneau : l'eau blanche, arrachée, qui tourbillonne
        float zoneAnneau = smoothstep(R * 0.3, R * 0.85, d) * (1.0 - smoothstep(R * 1.5, R * 3.4, d + (n.r - 0.5) * R));
        float anneau = zoneAnneau * smoothstep(0.25, 0.55, n.g * 0.6 + n.b * 0.4 + zoneAnneau * 0.2) * uTrombeVie.z;
        ecumeTrombe = max(spirales * 0.75, anneau) * min(1.0, uTrombe.w * 1.5);
        fraiche = max(fraiche, ecumeTrombe);
        // la tache sombre : sous le tourbillon qui naît, l'eau fonce
        couleur *= 1.0 - 0.5 * uTrombeVie.x * (1.0 - smoothstep(R * 0.7, R * 3.0, d));
      }
    }
    float mousseScelerate = ecumeScelerate(sc, vSource);
    fraiche = max(fraiche, mousseScelerate);
    float voile = smoothstep(1.0 - fraiche, 1.0 - fraiche + 0.22, dentelle) * (0.35 + 0.65 * fraiche);
    // au loin, le motif devient une teinte moyenne (sinon il scintille)
    voile = mix(voile, fraiche * 0.5, saturer(distance / 250.0));
    // (l'écume du bateau et du cargo a son propre motif, plus grand : il tient plus loin ;
    // au-delà, sa teinte moyenne, plus claire que la mer mais pas blanche)
    voile = max(voile, mix(bateau.y, bateau.x * 0.35, saturer(distance / 700.0)));
    fraiche = max(fraiche, bateau.x);
    vec3 lumiereEcume = uAmbiance * 0.9 + uSoleil * (0.25 + 0.75 * max(dot(n, uDirSoleil), 0.0)) + uLune * 0.8 + vec3(uEclair * 0.5 * saturer(dot(n, uDirEclair) * 0.8 + 0.25))
                      + lumiereBord * 0.9;
    // l'écume épaisse est blanche, la dentelle laisse voir l'eau verte en dessous
    vec3 couleurEcume = mix(vec3(0.55, 0.72, 0.72), vec3(0.88, 0.9, 0.92), fraiche) * lumiereEcume;
    couleur = mix(couleur, couleurEcume, voile);
    // la nuit, le plancton remué par l'étrave et le sillage s'allume : une lueur bleu-verte
    // et des étincelles qui s'éteignent derrière le bateau
    // (seulement dans les remous frais : la lueur s'éteint en quelques secondes)
    // (la forme pâle, juste sous la surface : un ovale, deux creux plus sombres ; vue à
    // travers l'eau, elle ondule, et disparaît quand on regarde l'eau en rasant — le reflet
    // du ciel la cache)
    if (uForme.w > 0.01) {
      vec2 q = vMonde.xz - uForme.xy;
      vec2 axe = vec2(cos(uForme.z), sin(uForme.z));
      vec2 pf = vec2(dot(q, axe), dot(q, vec2(-axe.y, axe.x))) / vec2(0.95, 0.58);
      pf += 0.07 * vec2(sin(pf.y * 7.0 + uTemps * 2.1), sin(pf.x * 6.0 - uTemps * 1.7));
      float ovale = smoothstep(1.0, 0.45, length(pf));
      if (ovale > 0.0) {
        float creux = smoothstep(0.3, 0.06, length((pf - vec2(0.42, -0.3)) * vec2(0.8, 1.0)))
                    + smoothstep(0.3, 0.06, length((pf - vec2(0.42, 0.3)) * vec2(0.8, 1.0)))
                    + 0.55 * smoothstep(0.32, 0.05, length((pf - vec2(-0.32, 0.0)) * vec2(0.7, 1.6)));
        vec3 pale = vec3(0.62, 0.78, 0.74) * (0.06 + 5.0 * lumiere + vec3(uEclair * 0.4));
        vec3 cf = mix(pale, pale * 0.15, min(1.0, creux));
        couleur = mix(couleur, cf, ovale * uForme.w * 0.6 * (1.0 - fresnel));
      }
    }
    // (la chose sous la coque : le plancton qu'elle remue dessine sa forme, une lueur
    // sourde, des étincelles là où elle bouge le plus — ses bords)
    if (uChose.w > 0.01 && uPlancton > 0.01) {
      float corps = formeChose(vMonde.xz);
      if (corps > 0.0) {
        float bord = corps * (1.0 - corps) * 4.0;
        float etincelle = smoothstep(0.78, 0.95, texture(uBruit, vec3(vMonde.xz * 1.3, uTemps * 0.9)).a);
        float plaques = 0.35 + 0.65 * smoothstep(0.3, 0.7, texture(uBruit, vec3(vMonde.xz * 0.08, 0.27 + uTemps * 0.02)).a);
        couleur += vec3(0.02, 0.32, 0.34) * uPlancton * uChose.w * (corps * 0.018 + bord * plaques * (0.03 + 0.14 * etincelle)) * (1.0 - fresnel * 0.5);
      }
    }
    // (la nuit, chaque crête qui déferle près du bateau s'allume aussi : dans le noir, on
    // devine les vagues qui brisent autour de soi à leur lueur bleu-verte, qui s'éteint
    // au loin, dans la pluie)
    if (uPlancton > 0.01) {
      float brise = smoothstep(uSeuilEcume + 0.05, uSeuilEcume + 0.4, ecume);
      float pres = 1.0 - smoothstep(35.0, 170.0, distance);
      float scintille = smoothstep(0.72, 0.92, texture(uBruit, vec3(vMonde.xz * 1.7, uTemps * 1.3)).a);
      couleur += vec3(0.03, 0.4, 0.42) * uPlancton * brise * pres * (0.009 + 0.035 * scintille) * (1.0 - fresnel * 0.6);
    }
    // (et l'eau que la trombe arrache : la couronne d'embruns, à son pied, luit dans le noir)
    couleur += vec3(0.03, 0.4, 0.42) * uTrombePlancton * ecumeTrombe * (0.06 + 0.3 * smoothstep(0.7, 0.92, texture(uBruit, vec3(vMonde.xz * 0.35, uTemps * 0.9)).a));
    // (et dans l'écume de la vague scélérate qui s'écroule : toute sa crête s'allume)
    couleur += vec3(0.03, 0.4, 0.42) * uPlancton * mousseScelerate * (0.06 + 0.3 * smoothstep(0.75, 0.95, texture(uBruit, vec3(vMonde.xz * 0.9, uTemps * 0.7)).a));
    if (uPlancton > 0.01 && bateau.w > 0.01) {
      // (de toutes petites, qui clignotent ; au loin il n'en reste que la lueur)
      float etincelles = smoothstep(0.7, 0.9, texture(uBruit, vec3(vMonde.xz * 7.0, uTemps * 1.6)).a)
                       + 0.6 * smoothstep(0.74, 0.92, texture(uBruit, vec3(vMonde.zx * 3.3 + 7.0, uTemps * 1.1)).b);
      // (au loin, on ne les distingue plus : il en reste leur lueur moyenne)
      float loin = smoothstep(15.0, 60.0, distance);
      etincelles *= 1.0 - loin;
      couleur += vec3(0.03, 0.4, 0.42) * uPlancton * bateau.w * (bateau.y * 0.028 + etincelles * 0.11 + 0.006 + 0.02 * loin);
    }
  }

  // la brume : au loin, la mer se fond dans le ciel de l'horizon
  vec3 horizon = texture(uCarteCiel, uvCarteCiel(normalize(vec3(-v.x, 0.015, -v.z)))).rgb;
  // (sous le front orageux, l'horizon est noir de pluie)
  vec4 front = frontOrage(normalize(vec3(-v.x, 0.004, -v.z)), horizon, 0.0);
  horizon = mix(horizon, front.rgb, front.a);
  float brume = 1.0 - exp(-distance * uBrume);
  couleur = mix(couleur, horizon, brume);
  // les rideaux de pluie des grains, entre nous et ce point de la mer (calculés aux sommets)
  couleur = couleur * vRideaux.a + vRideaux.rgb;
  gl_FragColor = vec4(couleur, 1.0);
}
`;
}

// La toile d'araignée : des anneaux de plus en plus espacés autour de la caméra
function grilleRadiale(segments, rayonMin, rayonMax) {
  const q = 1 + (2 * Math.PI) / segments;
  const anneaux = Math.ceil(Math.log(rayonMax / rayonMin) / Math.log(q)) + 1;
  const positions = new Float32Array((1 + anneaux * segments) * 3);
  let k = 3;
  for (let a = 0; a < anneaux; a++) {
    const r = Math.min(rayonMin * q ** a, rayonMax);
    for (let s = 0; s < segments; s++) {
      const t = (s / segments) * 2 * Math.PI;
      positions[k++] = Math.cos(t) * r;
      positions[k++] = 0;
      positions[k++] = Math.sin(t) * r;
    }
  }
  const indices = new Uint32Array(segments * 3 + (anneaux - 1) * segments * 6);
  let i = 0;
  for (let s = 0; s < segments; s++) {
    indices[i++] = 0;
    indices[i++] = 1 + ((s + 1) % segments);
    indices[i++] = 1 + s;
  }
  for (let a = 0; a < anneaux - 1; a++) {
    for (let s = 0; s < segments; s++) {
      const i0 = 1 + a * segments + s;
      const i1 = 1 + a * segments + ((s + 1) % segments);
      const j0 = i0 + segments;
      const j1 = i1 + segments;
      indices[i++] = i0; indices[i++] = i1; indices[i++] = j0;
      indices[i++] = i1; indices[i++] = j1; indices[i++] = j0;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  return { geometrie: g, sommets: positions.length / 3 };
}

export class Eau {
  constructor(renderer, houle, ciel, { segments = 384 } = {}) {
    this.renderer = renderer;
    this.houle = houle;
    const anisotropie = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    // Pour chaque grille : l'image envoyée (nombres à virgule, lus tels quels) et
    // l'image préparée par la carte graphique (déplacement + pentes, avec mipmaps)
    this.grilles = houle.cascades.map((c) => {
      const entree = new THREE.DataTexture(c.donnees, c.n, c.n, THREE.RGBAFormat, THREE.FloatType);
      entree.magFilter = entree.minFilter = THREE.NearestFilter;
      entree.generateMipmaps = false;
      entree.needsUpdate = true;
      const sortie = new THREE.WebGLRenderTarget(c.n, c.n, {
        count: 2,
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
        generateMipmaps: true,
        depthBuffer: false,
      });
      sortie.textures[1].anisotropy = anisotropie;
      return { cascade: c, entree, sortie };
    });
    this.passe = new PassePleinEcran(new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uDonnees: { value: null }, uPas: { value: 1 }, uN: { value: 128 } },
      vertexShader: SOMMET_PLEIN_ECRAN,
      fragmentShader: FRAGMENT_PREPARATION,
      depthTest: false,
      depthWrite: false,
    }));

    this.uniforms = {
      uCentre: { value: new THREE.Vector3() },
      uPasAngulaire: { value: (2 * Math.PI) / segments },
      uReflets: { value: ciel.cube.texture },
      uCarteCiel: { value: ciel.carte.texture },
      uBruit: { value: ciel.bruit },
      uDirSoleil: ciel.uniformsNuages.uDirSoleil,
      uSoleil: { value: new THREE.Vector3() },
      uDirLune: ciel.uniformsNuages.uDirLune,
      uLune: { value: new THREE.Vector3() },
      uAmbiance: { value: new THREE.Vector3() },
      uRugosite: { value: 0.06 },
      uBrume: { value: 1 / 60000 },
      uTemps: ciel.uniformsNuages.uTemps,
      uHs: { value: 1 },
      uEclair: { value: 0 },
      uDirEclair: { value: new THREE.Vector3(0, 1, 0) },
      uCouleurFond: { value: new THREE.Vector3(0.0028, 0.0125, 0.024) },
      uCouleurTranslucide: { value: new THREE.Vector3(0.025, 0.16, 0.13) },
      uForceEcume: { value: 1 },
      uTrombe: { value: new THREE.Vector4(0, 0, 30, 0) },
      uTrombeVie: { value: new THREE.Vector4(0, 0, 1, 1) },
      uTrombePlancton: { value: 0 },
      uSillage: { value: Array.from({ length: N_SILLAGE }, () => new THREE.Vector4()) },
      uSillageN: { value: 0 },
      uSillageBoite: { value: new THREE.Vector4() },
      uVitesseBateau: { value: 0 },
      uPlancton: { value: 0 },
      uLampePos: { value: new THREE.Vector3() },
      uLampeDir: { value: new THREE.Vector3(0, -1, 0) },
      uLampe: { value: new THREE.Vector4() },
      uFeux: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      uFeuxDir: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      uFeuxCouleur: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      uSeuilEcume: { value: 0.2 },
      uDirVent: { value: new THREE.Vector2(1, 0) },
      uBateauInverse: { value: new THREE.Matrix4() },
      uClipCoque: { value: 0 },
      uCargoInverse: { value: new THREE.Matrix4() },
      uCargo: { value: new THREE.Vector4() },
      uCargoSillage: { value: Array.from({ length: N_CARGO }, () => new THREE.Vector4()) },
      uCargoSillageN: { value: 0 },
      uCargoBoite: { value: new THREE.Vector4() },
      uScelerate: { value: new THREE.Vector4() },
      uChose: { value: new THREE.Vector4() },
      uForme: { value: new THREE.Vector4() },
      uScelerate2: { value: new THREE.Vector4() },
      uScelerate3: { value: new THREE.Vector4() },
      ...ciel.uniformsFront,
      ...ciel.grains.uniforms,
    };
    // une texture de déplacement, une de pentes et une fiche (taille, texel, flou max) par grille
    this.grilles.forEach(({ cascade: c, sortie }, i) => {
      this.uniforms[`uDeplacement${i}`] = { value: sortie.textures[0] };
      this.uniforms[`uPentes${i}`] = { value: sortie.textures[1] };
      this.uniforms[`uGrille${i}`] = { value: new THREE.Vector3(c.taille, c.pas, Math.log2(c.n)) };
    });
    const cascades = houle.cascades;
    this.materiau = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: sommetEau(cascades),
      fragmentShader: fragmentEau(cascades),
      side: THREE.DoubleSide,
    });
    const { geometrie, sommets } = grilleRadiale(segments, 0.3, 24000);
    this.sommets = sommets;
    this.segments = segments;
    this.mesh = new THREE.Mesh(geometrie, this.materiau);
    this.mesh.frustumCulled = false;
  }

  // Envoie les grilles calculées à la carte graphique et prépare pentes et écume
  preparer(camera) {
    const r = this.renderer;
    const ancienne = r.getRenderTarget();
    const u = this.passe.materiau.uniforms;
    for (const { cascade, entree, sortie } of this.grilles) {
      // (la houle change de tableau à chaque image quand elle est calculée dans son fil)
      entree.image.data = cascade.donnees;
      entree.needsUpdate = true;
      u.uDonnees.value = entree;
      u.uPas.value = cascade.pas;
      u.uN.value = cascade.n;
      this.passe.rendre(r, sortie);
    }
    r.setRenderTarget(ancienne);
    this.uniforms.uCentre.value.set(camera.position.x, 0, camera.position.z);
    // (la vague scélérate, au même instant que la houle)
    reglerUniformsScelerate(this.uniforms, this.houle.scelerates[0], this.houle.temps);
  }

  // Plus ou moins de sommets (la qualité de l'image, dans les options)
  changerDensite(segments) {
    if (segments === this.segments) return;
    this.segments = segments;
    const { geometrie, sommets } = grilleRadiale(segments, 0.3, 24000);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometrie;
    this.sommets = sommets;
    this.uniforms.uPasAngulaire.value = (2 * Math.PI) / segments;
  }

  // Le bateau creuse la mer (il faut connaître sa position à chaque image), et laisse son
  // sillage : on garde où était sa poupe toutes les 2,5 s (une minute en tout)
  suivreBateau(groupe, temps = 0, dt = 1 / 60) {
    const u = this.uniforms;
    u.uBateauInverse.value.copy(groupe.matrixWorld).invert();
    u.uClipCoque.value = 1;
    const poupe = (this._poupe ??= new THREE.Vector3()).set(0, 0, COQUE.zArriere).applyMatrix4(groupe.matrixWorld);
    const avant = this._poupeAvant;
    const h = (this.historique ??= []);
    // (un saut de plus de 30 m : le bateau a été replacé ; ou l'horloge est repartie de zéro :
    // on efface)
    if ((avant && avant.distanceTo(poupe) > 30) || (h.length && temps < h[0].t)) h.length = 0;
    const vitesse = avant && dt > 0 ? Math.min(12, Math.hypot(poupe.x - avant.x, poupe.z - avant.z) / dt) : 0;
    this.vitesse = (this.vitesse ?? 0) + (vitesse - (this.vitesse ?? 0)) * Math.min(1, dt * 2);
    (this._poupeAvant ??= new THREE.Vector3()).copy(poupe);
    if (!h.length || temps - h[0].t > 2.5) {
      h.unshift({ x: poupe.x, z: poupe.z, t: temps, v: this.vitesse });
      if (h.length > N_SILLAGE - 1) h.length = N_SILLAGE - 1;
    }
    const points = u.uSillage.value;
    points[0].set(poupe.x, poupe.z, temps, this.vitesse);
    let x0 = poupe.x, x1 = poupe.x, z0 = poupe.z, z1 = poupe.z;
    h.forEach((q, k) => {
      points[k + 1].set(q.x, q.z, q.t, q.v);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
    });
    u.uSillageN.value = h.length + 1;
    u.uSillageBoite.value.set(x0 - 25, z0 - 25, x1 + 25, z1 + 25);
    u.uVitesseBateau.value = this.vitesse;
  }
  // Le cargo (ou null quand il n'est pas là) : on garde où était sa poupe toutes les 7 s,
  // comme pour le bateau ; son sillage s'efface quand il s'en va
  suivreCargo(groupe, temps = 0, dt = 1 / 60) {
    const u = this.uniforms;
    const h = (this.historiqueCargo ??= []);
    if (!groupe) {
      u.uCargo.value.x = 0;
      u.uCargoSillageN.value = 0;
      h.length = 0;
      this._poupeCargoAvant = null;
      return;
    }
    u.uCargoInverse.value.copy(groupe.matrixWorld).invert();
    const poupe = (this._poupeCargo ??= new THREE.Vector3()).set(0, 0, LONGUEUR_CARGO / 2).applyMatrix4(groupe.matrixWorld);
    const avant = this._poupeCargoAvant;
    // (un saut de plus de 100 m, ou l'horloge repartie : on efface)
    if ((avant && avant.distanceTo(poupe) > 100) || (h.length && temps < h[0].t)) h.length = 0;
    const vitesse = avant && dt > 0 ? Math.min(20, Math.hypot(poupe.x - avant.x, poupe.z - avant.z) / dt) : 0;
    this.vitesseCargo = (this.vitesseCargo ?? 0) + (vitesse - (this.vitesseCargo ?? 0)) * Math.min(1, dt * 1.5);
    (this._poupeCargoAvant ??= new THREE.Vector3()).copy(poupe);
    if (!h.length || temps - h[0].t > 7) {
      h.unshift({ x: poupe.x, z: poupe.z, t: temps, v: this.vitesseCargo });
      if (h.length > N_CARGO - 1) h.length = N_CARGO - 1;
    }
    const points = u.uCargoSillage.value;
    points[0].set(poupe.x, poupe.z, temps, this.vitesseCargo);
    let x0 = poupe.x, x1 = poupe.x, z0 = poupe.z, z1 = poupe.z;
    h.forEach((q, k) => {
      points[k + 1].set(q.x, q.z, q.t, q.v);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
    });
    u.uCargoSillageN.value = h.length + 1;
    u.uCargoBoite.value.set(x0 - 90, z0 - 90, x1 + 90, z1 + 90);
    u.uCargo.value.set(1, this.vitesseCargo, 0, 0);
  }


  // La lumière du bord sur la mer : la frontale (la SpotLight du monde, qui suit le
  // regard) et les feux de navigation ([{ lumiere }], des SpotLight du bateau)
  eclairerParLeBord(lampe, feux) {
    const u = this.uniforms;
    u.uLampePos.value.copy(lampe.position);
    u.uLampeDir.value.subVectors(lampe.target.position, lampe.position).normalize();
    u.uLampe.value.set(lampe.intensity, Math.cos(lampe.angle), Math.cos(lampe.angle * (1 - lampe.penumbra)), lampe.distance);
    for (let i = 0; i < 4; i++) {
      const f = feux[i]?.lumiere;
      const p = u.uFeux.value[i];
      if (!f || f.intensity <= 0) { p.w = 0; continue; }
      const ici = f.getWorldPosition(this._feu ??= new THREE.Vector3());
      p.set(ici.x, ici.y, ici.z, f.distance);
      const vers = f.target.getWorldPosition(this._cible ??= new THREE.Vector3()).sub(ici).normalize();
      u.uFeuxDir.value[i].set(vers.x, vers.y, vers.z, Math.cos(f.angle));
      u.uFeuxCouleur.value[i].set(f.color.r * f.intensity, f.color.g * f.intensity, f.color.b * f.intensity, Math.cos(f.angle * (1 - f.penumbra)));
    }
  }

  // Lumières et ambiance (voir monde/meteo.js) ; pluie : celle qui voile l'air partout (sans
  // celle des grains : leurs rideaux sont dessinés à part)
  regler(meteo, ecl, { pluie = meteo.pluie } = {}) {
    const u = this.uniforms;
    u.uSoleil.value.fromArray(ecl.soleil);
    u.uLune.value.fromArray(ecl.lune);
    u.uAmbiance.value.fromArray(ecl.ambiance);
    u.uHs.value = Math.max(0.3, this.houle.hauteurSignificative);
    // plus il y a de vent, plus la surface est ridée (même entre les vagues)
    // (ce qui reste des vagues trop petites pour les grilles, moins de 9 cm)
    u.uRugosite.value = THREE.MathUtils.lerp(0.02, 0.09, Math.min(1, meteo.vent / 45));
    // écume : seuil mesuré (scripts : répartition de l'écume selon le vent)
    u.uSeuilEcume.value = Math.max(0.12, 0.018 * meteo.vent - 0.06);
    const a = this.houle.mer?.directionVent ?? 0;
    u.uDirVent.value.set(Math.cos(a), Math.sin(a));
    // visibilité : 60 km par beau temps, 1,5 km sous la pluie battante
    const visibilite = THREE.MathUtils.lerp(60000, 6000, meteo.brume) * THREE.MathUtils.lerp(1, 0.25, pluie);
    this.brumeDeBase = 3 / visibilite;
    u.uBrume.value = this.brumeDeBase;
  }
}
