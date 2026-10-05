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

const float PI = 3.14159265359;
${GLSL_CARTE_CIEL}
${GLSL_COQUE}

float saturer(float x) { return clamp(x, 0.0, 1.0); }

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
    float a = clamp(sqrt(variance * 0.5 + uRugosite * uRugosite), 0.02, 0.6);

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

    // l'écume : fraîche et épaisse sur la crête qui déferle, puis une dentelle de bulles
    // qui s'étire dans le sens du vent et s'efface
    vec2 vent = uDirVent;
    vec2 q = vec2(dot(vSource, vent), dot(vSource, vec2(-vent.y, vent.x)));
    float dentelle = texture(uBruit, vec3(q.x * 0.045, q.y * 0.16, 0.21 + uTemps * 0.003)).a * 0.55
                   + texture(uBruit, vec3(q.x * 0.17, q.y * 0.5, 0.63 - uTemps * 0.005)).b * 0.3
                   + texture(uBruit, vec3(vSource * 0.9, 0.4)).a * 0.15;
    // seuil réglé selon le vent : ~1 % de la mer blanchit par 13 nœuds, ~20 % par 48 nœuds
    float fraiche = smoothstep(uSeuilEcume, uSeuilEcume + 0.35, ecume);
    float voile = smoothstep(1.0 - fraiche, 1.0 - fraiche + 0.22, dentelle) * (0.35 + 0.65 * fraiche);
    // au loin, le motif devient une teinte moyenne (sinon il scintille)
    voile = mix(voile, fraiche * 0.5, saturer(distance / 250.0));
    vec3 lumiereEcume = uAmbiance * 0.9 + uSoleil * (0.25 + 0.75 * max(dot(n, uDirSoleil), 0.0)) + uLune * 0.8 + vec3(uEclair * 0.5);
    // l'écume épaisse est blanche, la dentelle laisse voir l'eau verte en dessous
    vec3 couleurEcume = mix(vec3(0.55, 0.72, 0.72), vec3(0.88, 0.9, 0.92), fraiche) * lumiereEcume;
    couleur = mix(couleur, couleurEcume, voile);
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

  // Le bateau creuse la mer (il faut connaître sa position à chaque image)
  suivreBateau(groupe) {
    this.uniforms.uBateauInverse.value.copy(groupe.matrixWorld).invert();
    this.uniforms.uClipCoque.value = 1;
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
    u.uBrume.value = 3 / visibilite;
  }
}
