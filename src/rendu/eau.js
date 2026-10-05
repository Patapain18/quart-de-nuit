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

const N_SILLAGE = 24; // points du sillage (le premier : la poupe ; puis un toutes les 2,5 s)

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
out vec3 vMonde;
out vec2 vSource;
out float vHauteur;

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
  vec3 monde = vec3(xz.x + d.x, d.y, xz.y + d.z);
  // la Terre est ronde : au loin, la mer passe sous l'horizon
  vec2 ecart = monde.xz - cameraPosition.xz;
  monde.y -= dot(ecart, ecart) / (2.0 * 6371000.0);
  vMonde = monde;
  vSource = xz;
  vHauteur = d.y;
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
uniform vec3 uCouleurFond;
uniform vec3 uCouleurTranslucide;
uniform float uForceEcume;
uniform float uSeuilEcume;
uniform vec2 uDirVent;
uniform vec4 uTrombe; // la trombe : x, z, rayon de son cœur (m), force (0 : pas de trombe)
// le sillage : où était la poupe (x, z), à quel instant (s), à quelle vitesse (m/s) ; le
// premier point est la poupe elle-même ; et la boîte qui les contient tous (pour aller vite)
uniform vec4 uSillage[${N_SILLAGE}];
uniform int uSillageN;
uniform vec4 uSillageBoite;
uniform float uVitesseBateau; // m/s
uniform float uPlancton;      // la nuit, l'écume remuée par le bateau s'illumine (0 → 1)

const float PI = 3.14159265359;
${GLSL_CARTE_CIEL}
${GLSL_COQUE}

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

  // le bateau : son écume, et l'eau qu'il a lissée derrière lui (moins de petites rides)
  vec4 bateau = ecumeDuBateau(vMonde);
  pente *= 1.0 - 0.35 * bateau.z;
  variance *= 1.0 - 0.7 * bateau.z;

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
    reflet += vec3(0.55, 0.6, 0.75) * uEclair * 0.4;

    // les éclats du soleil et de la lune
    vec3 eclats = uSoleil * eclat(n, v, uDirSoleil, a) * 1.6 + uLune * eclat(n, v, uDirLune, a) * 1.6;

    // le bleu du fond et la lumière qui traverse les crêtes
    vec3 lumiere = uAmbiance + uSoleil * max(uDirSoleil.y, 0.0) + uLune * max(uDirLune.y, 0.0) + vec3(uEclair * 0.3);
    vec3 corps = uCouleurFond * lumiere;
    float crete = saturer(vHauteur / max(uHs * 0.6, 0.25) * 0.5 + 0.5);
    float contreJour = pow(saturer(dot(-v, uDirSoleil) * 0.8 + 0.2), 3.0);
    float dosVague = saturer(dot(n, -v) * 0.5 + 0.6); // les faces qui se dérobent au regard
    corps += uCouleurTranslucide * (uSoleil * contreJour * 1.4 + uAmbiance * 0.35) * crete * crete * dosVague;

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
    float fraiche = smoothstep(uSeuilEcume, uSeuilEcume + 0.35, ecume);
    // la trombe arrache la mer : autour de son pied, un anneau d'écume en spirales qui
    // tournent, d'autant plus vite que l'on est près du cœur
    if (uTrombe.w > 0.01) {
      vec2 dt = vMonde.xz - uTrombe.xy;
      float d = length(dt);
      float R = uTrombe.z;
      float angle = uTemps * 30.0 * R / max(d * d, R * R); // (30 m/s au bord du cœur)
      vec2 tourne = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * dt;
      float spirale = texture(uBruit, vec3(tourne * 0.018, 0.37)).a * 0.6 + texture(uBruit, vec3(tourne * 0.06, 0.71)).b * 0.4;
      float anneau = smoothstep(R * 0.3, R * 0.9, d) * (1.0 - smoothstep(R * 1.6, R * 4.5, d));
      fraiche = max(fraiche, anneau * smoothstep(0.38, 0.62, spirale + anneau * 0.25) * uTrombe.w);
    }
    float voile = smoothstep(1.0 - fraiche, 1.0 - fraiche + 0.22, dentelle) * (0.35 + 0.65 * fraiche);
    // (l'écume du bateau a son propre motif)
    voile = max(voile, bateau.y);
    fraiche = max(fraiche, bateau.x);
    // au loin, le motif devient une teinte moyenne (sinon il scintille)
    voile = mix(voile, fraiche * 0.5, saturer(distance / 250.0));
    vec3 lumiereEcume = uAmbiance * 0.9 + uSoleil * (0.25 + 0.75 * max(dot(n, uDirSoleil), 0.0)) + uLune * 0.8 + vec3(uEclair * 0.5);
    // l'écume épaisse est blanche, la dentelle laisse voir l'eau verte en dessous
    vec3 couleurEcume = mix(vec3(0.55, 0.72, 0.72), vec3(0.88, 0.9, 0.92), fraiche) * lumiereEcume;
    couleur = mix(couleur, couleurEcume, voile);
    // la nuit, le plancton remué par l'étrave et le sillage s'allume : une lueur bleu-verte
    // et des étincelles qui s'éteignent derrière le bateau
    if (uPlancton > 0.01 && bateau.x > 0.01) {
      // (de toutes petites, qui clignotent ; au loin il n'en reste que la lueur)
      float etincelles = smoothstep(0.7, 0.9, texture(uBruit, vec3(vMonde.xz * 7.0, uTemps * 1.6)).a)
                       + 0.6 * smoothstep(0.74, 0.92, texture(uBruit, vec3(vMonde.zx * 3.3 + 7.0, uTemps * 1.1)).b);
      etincelles *= 1.0 - smoothstep(15.0, 60.0, distance);
      couleur += vec3(0.03, 0.4, 0.42) * uPlancton * (bateau.y * 0.05 + bateau.x * (etincelles * 0.14 + 0.01));
    }
  }

  // la brume : au loin, la mer se fond dans le ciel de l'horizon
  vec3 horizon = texture(uCarteCiel, uvCarteCiel(normalize(vec3(-v.x, 0.015, -v.z)))).rgb;
  float brume = 1.0 - exp(-distance * uBrume);
  couleur = mix(couleur, horizon, brume);
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
      uCouleurFond: { value: new THREE.Vector3(0.0028, 0.0125, 0.024) },
      uCouleurTranslucide: { value: new THREE.Vector3(0.025, 0.16, 0.13) },
      uForceEcume: { value: 1 },
      uTrombe: { value: new THREE.Vector4(0, 0, 30, 0) },
      uSillage: { value: Array.from({ length: N_SILLAGE }, () => new THREE.Vector4()) },
      uSillageN: { value: 0 },
      uSillageBoite: { value: new THREE.Vector4() },
      uVitesseBateau: { value: 0 },
      uPlancton: { value: 0 },
      uSeuilEcume: { value: 0.2 },
      uDirVent: { value: new THREE.Vector2(1, 0) },
      uBateauInverse: { value: new THREE.Matrix4() },
      uClipCoque: { value: 0 },
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
      entree.needsUpdate = true;
      u.uDonnees.value = entree;
      u.uPas.value = cascade.pas;
      u.uN.value = cascade.n;
      this.passe.rendre(r, sortie);
    }
    r.setRenderTarget(ancienne);
    this.uniforms.uCentre.value.set(camera.position.x, 0, camera.position.z);
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

  // Lumières et ambiance (voir monde/meteo.js)
  regler(meteo, ecl) {
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
    const visibilite = THREE.MathUtils.lerp(60000, 6000, meteo.brume) * THREE.MathUtils.lerp(1, 0.25, meteo.pluie);
    this.brumeDeBase = 3 / visibilite;
    u.uBrume.value = this.brumeDeBase;
  }
}
