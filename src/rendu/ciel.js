// Le ciel : l'atmosphère, le soleil, la lune, les étoiles, les nuages et les éclairs.
//
// Comment c'est dessiné, à chaque image :
//  1. la « carte du ciel » : une petite image (256 × 128) qui garde la couleur de
//     l'atmosphère dans toutes les directions (calcul coûteux, fait sur peu de pixels) ;
//  2. les nuages en volume, calculés sur une image deux fois plus petite que l'écran
//     (c'est le calcul le plus lourd du jeu) ;
//  3. le fond du ciel, en pleine résolution : carte du ciel + disque du soleil + lune +
//     étoiles, puis les nuages par-dessus ;
//  4. un « cube de reflets » : le ciel vu dans les six directions, en petit, que la mer
//     reflète et qui éclaire le bateau. On en recalcule une face par image.
import * as THREE from 'three';
import { GLSL_ATMOSPHERE } from './glsl/atmosphere.js';
import { GLSL_NUAGES, UNIFORMS_NUAGES } from './glsl/nuages.js';
import { glslFront } from './glsl/front.js';
import { GLSL_OUTILS, PassePleinEcran, SOMMET_PLEIN_ECRAN } from './outils.js';
import { creerBruitNuages } from './bruit-nuages.js';
import { INTENSITE_SOLEIL, geometrieFront } from '../monde/meteo.js';

// Correspondance direction ↔ carte du ciel : la hauteur est « étirée » près de
// l'horizon, là où les couleurs changent le plus vite.
export const GLSL_CARTE_CIEL = /* glsl */ `
vec2 uvCarteCiel(vec3 d) {
  float azimut = atan(d.x, -d.z);
  float elevation = asin(clamp(d.y, -1.0, 1.0));
  float v = 0.5 + 0.5 * sign(elevation) * sqrt(abs(elevation) / (PI * 0.5));
  return vec2(azimut / (2.0 * PI) + 0.5, v);
}
vec3 directionCarteCiel(vec2 uv) {
  float azimut = (uv.x - 0.5) * 2.0 * PI;
  float s = (uv.y - 0.5) * 2.0;
  float elevation = sign(s) * s * s * PI * 0.5;
  return vec3(cos(elevation) * sin(azimut), sin(elevation), -cos(elevation) * cos(azimut));
}
`;

const FRAGMENT_CARTE_CIEL = /* glsl */ `
in vec2 vUv;
uniform vec3 uDirSoleil;
uniform vec3 uDirLune;
uniform float uIntensiteSoleil;
uniform float uIntensiteLune;
${GLSL_ATMOSPHERE}
${GLSL_CARTE_CIEL}
void main() {
  vec3 d = directionCarteCiel(vUv);
  vec3 c = couleurAtmosphere(d, uDirSoleil, uIntensiteSoleil);
  if (uIntensiteLune > 0.0) c += couleurAtmosphere(d, uDirLune, uIntensiteLune);
  // lueur du ciel nocturne (la nuit n'est jamais tout à fait noire)
  c += vec3(0.0011, 0.0016, 0.0032) * (1.0 - 0.6 * smoothstep(0.0, 0.6, d.y));
  gl_FragColor = vec4(c, 1.0);
}
`;

// Les nuages, dans une image plus petite que l'écran
const FRAGMENT_NUAGES = /* glsl */ `
in vec2 vUv;
uniform mat4 uVueProjectionInverse;
uniform vec3 uPositionCamera;
uniform int uPas;
uniform float uImage;
${GLSL_OUTILS}
${GLSL_ATMOSPHERE}
${GLSL_NUAGES}
void main() {
  vec4 lointain = uVueProjectionInverse * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(lointain.xyz / lointain.w - uPositionCamera);
  vec3 origine = vec3(uPositionCamera.x, max(uPositionCamera.y, 1.0), uPositionCamera.z);
  // le point de départ des pas change à chaque image : l'accumulation fait la moyenne
  float decalage = bruitEntrelace(gl_FragCoord.xy + 5.588238 * uImage);
  vec4 n = nuagesVolume(origine, d, uPas, decalage);
  vec4 c = cirrus(d);
  // les cirrus sont derrière les nuages bas
  n.rgb += c.rgb * (1.0 - n.a);
  n.a += c.a * (1.0 - n.a);
  gl_FragColor = n;
}
`;

// Accumulation d'une image à l'autre : chaque image ne calcule qu'une partie des pas
// (décalés au hasard) ; on mélange avec les images précédentes, retrouvées à leur place
// même si la caméra a tourné (les nuages sont si loin que seule la rotation compte).
const FRAGMENT_ACCUMULATION = /* glsl */ `
in vec2 vUv;
uniform sampler2D uBrut;
uniform sampler2D uHistorique;
uniform mat4 uVueProjectionInverse;
uniform mat4 uVueProjectionPrecedente;
uniform vec3 uPositionCamera;
uniform vec2 uTexel;
uniform float uMelange;
uniform bool uReinitialiser;
void main() {
  vec4 courant = texture(uBrut, vUv);
  vec4 lointain = uVueProjectionInverse * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(lointain.xyz / lointain.w - uPositionCamera);
  vec4 clip = uVueProjectionPrecedente * vec4(uPositionCamera + d * 10000.0, 1.0);
  vec2 uvAvant = clip.xy / clip.w * 0.5 + 0.5;
  if (uReinitialiser || clip.w <= 0.0 || any(lessThan(uvAvant, vec2(0.0))) || any(greaterThan(uvAvant, vec2(1.0)))) {
    gl_FragColor = courant;
    return;
  }
  vec4 avant = texture(uHistorique, uvAvant);
  // on borne l'ancienne valeur par les voisins actuels (sinon traînées quand ça change vite)
  vec4 mini = courant, maxi = courant;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++) {
    vec4 v = texture(uBrut, vUv + vec2(x, y) * uTexel);
    mini = min(mini, v);
    maxi = max(maxi, v);
  }
  avant = clamp(avant, mini, maxi);
  gl_FragColor = mix(avant, courant, uMelange);
}
`;

// Une face du cube de reflets : atmosphère (lue dans la carte) + nuages, sans soleil
const SOMMET_CUBE = /* glsl */ `
out vec3 vDirection;
void main() {
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const FRAGMENT_CUBE = /* glsl */ `
in vec3 vDirection;
uniform sampler2D uCarteCiel;
uniform vec3 uPositionCamera;
${GLSL_OUTILS}
${GLSL_ATMOSPHERE}
${GLSL_CARTE_CIEL}
${GLSL_NUAGES}
${glslFront('uBruitNuages')}
void main() {
  vec3 d = normalize(vDirection);
  vec3 dCiel = vec3(d.x, max(d.y, 0.0), d.z);
  vec3 c = texture(uCarteCiel, uvCarteCiel(normalize(dCiel))).rgb;
  // le front orageux, au loin (la mer le reflète)
  vec4 front = frontOrage(normalize(dCiel + vec3(0.0, 0.002, 0.0)), c, 0.0);
  c = mix(c, front.rgb, front.a);
  vec3 origine = vec3(uPositionCamera.x, 2.0, uPositionCamera.z);
  vec4 n = nuagesVolume(origine, normalize(dCiel + vec3(0.0, 0.002, 0.0)), 22, 0.5);
  vec4 ci = cirrus(normalize(dCiel));
  c = c * (1.0 - ci.a) + ci.rgb;
  float tNuage = traverserSphere(vec3(0.0, RAYON_TERRE + 2.0, 0.0), normalize(dCiel + vec3(0.0, 0.001, 0.0)), RAYON_TERRE + uBaseNuages).y;
  c = c * (1.0 - n.a * voileNuages(tNuage)) + n.rgb;
  gl_FragColor = vec4(c, 1.0);
}
`;

// Le fond du ciel, en pleine résolution, dans la scène principale
const SOMMET_FOND = /* glsl */ `
out vec3 vDirection;
void main() {
  vDirection = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww; // tout au fond (profondeur maximale)
}
`;
const FRAGMENT_FOND = /* glsl */ `
in vec3 vDirection;
uniform sampler2D uCarteCiel;
uniform sampler2D uNuagesEcran;
uniform sampler3D uBruitLune;
uniform vec2 uTailleEcran;
uniform vec3 uDirSoleil;
uniform vec3 uDirLune;
uniform float uLuminanceSoleil;
uniform float uLuminanceLune;
uniform float uNuit;
uniform float uTemps;
uniform float uRotationEtoiles;
uniform float uLatitude;
uniform float uTaillePixel; // taille angulaire d'un pixel (radians)
uniform float uEclairCiel;
uniform float uVisibiliteEtoiles;
uniform float uBaseNuages;
uniform float uOrage;
${GLSL_ATMOSPHERE}
${GLSL_CARTE_CIEL}
${glslFront('uBruitLune')}
float voileNuages(float t) { return exp(-t / mix(55000.0, 22000.0, uOrage)); }

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hasard3(vec3 c) { return vec3(pcg3d(uvec3(ivec3(c) + 100000))) / 4294967295.0; }

// Direction dans le repère des étoiles (qui tourne autour du pôle céleste)
vec3 versCiel(vec3 d) {
  // pôle céleste : au nord, à une hauteur égale à la latitude
  vec3 pole = vec3(0.0, sin(uLatitude), -cos(uLatitude));
  vec3 est = vec3(1.0, 0.0, 0.0);
  vec3 axe3 = cross(est, pole);
  vec3 local = vec3(dot(d, est), dot(d, axe3), dot(d, pole));
  float c = cos(uRotationEtoiles), s = sin(uRotationEtoiles);
  return vec3(c * local.x - s * local.y, s * local.x + c * local.y, local.z);
}

// Un champ d'étoiles : au plus une par case. Leur éclat suit la loi du vrai ciel : chaque
// magnitude de plus (un éclat 2,5 fois plus faible), il y a environ trois fois plus
// d'étoiles. Les plus brillantes (magnitude 0) sont très rares.
vec3 champEtoiles(vec3 d, float echelle, float densite, float magMin, float magMax) {
  vec3 p = d * echelle;
  vec3 c = floor(p);
  vec3 h = hasard3(c);
  if (h.z > densite) return vec3(0.0);
  vec3 position = c + 0.2 + 0.6 * hasard3(c + 17.0);
  vec3 etoile = normalize(position);
  float angle = acos(clamp(dot(d, etoile), -1.0, 1.0));
  float largeur = uTaillePixel * 0.75;
  float tache = exp(-angle * angle / (2.0 * largeur * largeur));
  float magnitude = clamp(magMax + 2.0 * log(max(h.x, 1e-4)) / log(10.0), magMin, magMax);
  float lum = 5.0 * pow(10.0, -0.4 * magnitude);
  // la couleur selon leur température : orangées ou bleutées
  vec3 couleur = mix(vec3(1.0, 0.78, 0.6), vec3(0.75, 0.85, 1.0), h.y);
  return couleur * lum * tache;
}

vec3 etoiles(vec3 d) {
  vec3 dc = versCiel(d);
  // ~5 000 étoiles jusqu'à la magnitude 6 (ce que l'œil voit par nuit noire), et un
  // semis plus faible, à peine visible
  vec3 e = champEtoiles(dc, 180.0, 0.0125, -1.0, 6.0) + champEtoiles(dc, 420.0, 0.006, 5.0, 7.5);
  // scintillement, plus fort près de l'horizon
  float scint = 0.75 + 0.25 * sin(uTemps * 9.0 + dot(floor(dc * 420.0), vec3(1.7, 9.2, 3.1)));
  e *= mix(1.0, scint, 1.0 - smoothstep(0.0, 0.5, d.y));
  // la Voie lactée : une bande laiteuse le long d'un grand cercle
  vec3 axeGalaxie = normalize(vec3(0.45, 0.32, 0.83));
  float bande = exp(-pow(dot(dc, axeGalaxie) / 0.16, 2.0));
  float grain = texture(uBruitLune, dc * 1.7).r * texture(uBruitLune, dc * 4.3).g;
  e += vec3(0.55, 0.6, 0.8) * bande * (0.35 + 1.3 * grain) * 0.0022;
  return e;
}

// La lune : une sphère éclairée par le soleil (d'où sa phase), avec ses « mers » sombres
vec3 disqueLune(vec3 d) {
  float rayon = 0.0048;
  float cosA = dot(d, uDirLune);
  if (cosA < cos(rayon * 1.6)) return vec3(0.0);
  // point de la sphère lunaire vu dans cette direction
  vec3 droite = normalize(cross(uDirLune, vec3(0.0, 1.0, 0.0)));
  vec3 haut = cross(droite, uDirLune);
  vec2 q = vec2(dot(d, droite), dot(d, haut)) / rayon;
  float r2 = dot(q, q);
  float bord = 1.0 - smoothstep(0.92, 1.0, sqrt(r2));
  if (r2 >= 1.0) return vec3(0.0);
  vec3 normale = normalize(droite * q.x + haut * q.y - uDirLune * sqrt(1.0 - r2));
  // éclairée par le soleil : la partie tournée vers lui
  float eclairee = smoothstep(-0.05, 0.12, dot(normale, uDirSoleil));
  float mers = texture(uBruitLune, normale * 0.35 + 0.5).r;
  float albedo = mix(0.55, 1.0, smoothstep(0.35, 0.65, mers));
  float cendree = 0.012; // lumière cendrée : la partie sombre reçoit la lumière de la Terre
  return vec3(1.0, 0.97, 0.92) * uLuminanceLune * albedo * (eclairee + cendree) * bord;
}

void main() {
  vec3 d = normalize(vDirection);
  vec3 dCiel = vec3(d.x, max(d.y, 0.0), d.z);
  vec3 c = texture(uCarteCiel, uvCarteCiel(normalize(dCiel))).rgb;

  // ce qui est derrière les nuages : soleil, lune, étoiles
  vec3 derriere = vec3(0.0);
  float cosSoleil = dot(d, uDirSoleil);
  float rayonSoleil = 0.0047;
  if (cosSoleil > cos(rayonSoleil * 1.5)) {
    float r = acos(clamp(cosSoleil, -1.0, 1.0)) / rayonSoleil;
    float bord = 1.0 - smoothstep(0.85, 1.0, r);
    float assombrissement = 1.0 - 0.6 * (1.0 - sqrt(max(0.0, 1.0 - r * r))); // bord du disque plus sombre
    derriere += transmissionDepuisMer(d) * uLuminanceSoleil * bord * assombrissement;
  }
  if (uNuit > 0.001) {
    vec3 transmission = transmissionDepuisMer(dCiel);
    // (les étoiles n'apparaissent qu'à la fin du crépuscule, quand le ciel est assez
    // sombre : sinon l'œil, qui s'habitue à la pénombre, les verrait toutes d'un coup)
    float apparition = smoothstep(0.55, 0.95, uNuit);
    derriere += (etoiles(d) * uNuit * apparition * uVisibiliteEtoiles + disqueLune(d) * mix(1.0, uVisibiliteEtoiles, 0.7)) * transmission;
  }
  // le front orageux, devant le ciel (il cache le soleil qui se couche derrière lui), mais
  // derrière les nuages proches
  vec4 front = frontOrage(d, c, 1.0);
  c = mix(c, front.rgb, front.a);
  derriere *= 1.0 - front.a;
  vec4 n = texture(uNuagesEcran, gl_FragCoord.xy / uTailleEcran);
  // les nuages lointains prennent la couleur de l'air (la brume entre eux et nous)
  float tNuage = traverserSphere(vec3(0.0, RAYON_TERRE + 2.0, 0.0), dCiel + vec3(0.0, 0.001, 0.0), RAYON_TERRE + uBaseNuages).y;
  float voile = voileNuages(tNuage);
  c += derriere * (1.0 - n.a);
  c = c * (1.0 - n.a * voile) + n.rgb;
  c += vec3(0.6, 0.65, 0.8) * uEclairCiel * (0.4 + 0.6 * n.a);
  gl_FragColor = vec4(c, 1.0);
}
`;

export class Ciel {
  constructor(renderer) {
    this.renderer = renderer;
    this.bruit = creerBruitNuages(renderer, 128);

    const v3 = () => new THREE.Vector3();
    // Les réglages des nuages, partagés par toutes les passes qui les dessinent
    this.uniformsNuages = THREE.UniformsUtils.clone(UNIFORMS_NUAGES);
    const u = this.uniformsNuages;
    u.uBruitNuages.value = this.bruit;
    u.uDeriveNuages.value = new THREE.Vector2();
    for (const nom of ['uDirSoleil', 'uSoleilNuages', 'uDirLune', 'uLuneNuages', 'uAmbHaut', 'uAmbBas']) u[nom].value = v3();
    u.uEclair.value = new THREE.Vector4();
    u.uTrombeCiel.value = new THREE.Vector4();
    // Le front orageux (glsl/front.js), partagé par le fond, le cube et la mer
    this.uniformsFront = {
      uFront: { value: new THREE.Vector4() },
      uFrontEclair: { value: new THREE.Vector4() },
      uFrontAmbiance: { value: v3() },
      uFrontSoleil: { value: v3() },
      uFrontDirSoleil: { value: v3() },
    };

    // 1. la carte du ciel
    this.carte = new THREE.WebGLRenderTarget(256, 128, {
      type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false,
    });
    this.carte.texture.wrapS = THREE.RepeatWrapping;
    this.passeCarte = new PassePleinEcran(new THREE.ShaderMaterial({
      uniforms: {
        uDirSoleil: u.uDirSoleil, uDirLune: u.uDirLune,
        uIntensiteSoleil: { value: INTENSITE_SOLEIL }, uIntensiteLune: { value: 0 },
      },
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_CARTE_CIEL, depthTest: false, depthWrite: false,
    }));

    // 2. les nuages à l'écran (taille réglée par redimensionner)
    this.nuagesEcran = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false,
    });
    this.passeNuages = new PassePleinEcran(new THREE.ShaderMaterial({
      uniforms: {
        ...u,
        uVueProjectionInverse: { value: new THREE.Matrix4() },
        uPositionCamera: { value: v3() },
        uPas: { value: 36 },
        uImage: { value: 0 },
      },
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_NUAGES, depthTest: false, depthWrite: false,
    }));
    this.echelleNuages = 0.5;
    const optionsNuages = {
      type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false,
    };
    this.historique = [new THREE.WebGLRenderTarget(4, 4, optionsNuages), new THREE.WebGLRenderTarget(4, 4, optionsNuages)];
    this.indexHistorique = 0;
    this.vueProjectionPrecedente = new THREE.Matrix4();
    this.reinitialiserNuages = true;
    this.passeAccumulation = new PassePleinEcran(new THREE.ShaderMaterial({
      uniforms: {
        uBrut: { value: this.nuagesEcran.texture },
        uHistorique: { value: null },
        uVueProjectionInverse: { value: null },
        uVueProjectionPrecedente: { value: this.vueProjectionPrecedente },
        uPositionCamera: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uMelange: { value: 0.12 },
        uReinitialiser: { value: true },
      },
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_ACCUMULATION, depthTest: false, depthWrite: false,
    }));
    this.passeAccumulation.materiau.uniforms.uVueProjectionInverse.value = this.passeNuages.materiau.uniforms.uVueProjectionInverse.value;
    this.passeAccumulation.materiau.uniforms.uPositionCamera.value = this.passeNuages.materiau.uniforms.uPositionCamera.value;
    this.numeroImage = 0;

    // 3. le fond du ciel
    this.fond = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          uCarteCiel: { value: this.carte.texture },
          uNuagesEcran: { value: this.nuagesEcran.texture },
          uBruitLune: { value: this.bruit },
          uTailleEcran: { value: new THREE.Vector2(1, 1) },
          uDirSoleil: u.uDirSoleil, uDirLune: u.uDirLune,
          uLuminanceSoleil: { value: 4000 },
          uLuminanceLune: { value: 0 },
          uNuit: { value: 0 },
          uTemps: u.uTemps,
          uRotationEtoiles: { value: 0 },
          uLatitude: { value: 0.82 },
          uTaillePixel: { value: 0.001 },
          uEclairCiel: { value: 0 },
          uVisibiliteEtoiles: { value: 1 },
          uBaseNuages: u.uBaseNuages,
          uOrage: u.uOrage,
          ...this.uniformsFront,
        },
        vertexShader: SOMMET_FOND, fragmentShader: FRAGMENT_FOND,
        side: THREE.BackSide, depthWrite: false, depthTest: false,
      }),
    );
    this.fond.frustumCulled = false;
    this.fond.renderOrder = -1000;

    // 4. le cube de reflets
    this.cube = new THREE.WebGLCubeRenderTarget(128, {
      type: THREE.HalfFloatType, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.cameraCube = new THREE.CubeCamera(0.5, 10, this.cube);
    // on dessine les faces nous-mêmes (une par image) : il faut orienter les six caméras
    this.cameraCube.coordinateSystem = renderer.coordinateSystem;
    this.cameraCube.updateCoordinateSystem();
    this.sceneCube = new THREE.Scene();
    this.materiauCube = new THREE.ShaderMaterial({
      uniforms: { ...u, ...this.uniformsFront, uCarteCiel: { value: this.carte.texture }, uPositionCamera: { value: v3() } },
      vertexShader: SOMMET_CUBE, fragmentShader: FRAGMENT_CUBE, side: THREE.BackSide, depthWrite: false, depthTest: false,
    });
    this.sceneCube.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.materiauCube));
    this.faceCube = 0;
    this.cubeComplet = false;

    // Lumière d'ambiance pour le bateau (cube préfiltré par Three, mis à jour de temps en temps)
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.environnement = null;
    this.ageEnvironnement = Infinity;
  }

  redimensionner(largeur, hauteur) {
    const l = Math.max(1, Math.round(largeur * this.echelleNuages));
    const h = Math.max(1, Math.round(hauteur * this.echelleNuages));
    this.nuagesEcran.setSize(l, h);
    for (const rt of this.historique) rt.setSize(l, h);
    this.passeAccumulation.materiau.uniforms.uTexel.value.set(1 / l, 1 / h);
    this.reinitialiserNuages = true;
    this.fond.material.uniforms.uTailleEcran.value.set(largeur, hauteur);
  }

  // Met à jour toutes les valeurs du ciel à partir de la météo et de l'éclairage
  regler(meteo, ecl, temps, { brusque = false } = {}) {
    const u = this.uniformsNuages;
    if (brusque) this.reinitialiserNuages = true;
    u.uTemps.value = temps;
    u.uDirSoleil.value.fromArray(ecl.dirSoleil);
    u.uDirLune.value.fromArray(ecl.dirLune);
    u.uSoleilNuages.value.fromArray(ecl.soleilNuages);
    u.uLuneNuages.value.fromArray(ecl.luneNuages).multiplyScalar(0.6);
    // lumière du ciel au-dessus des nuages : le ciel clair ; en dessous : la mer, sombre
    const amb = new THREE.Vector3().fromArray(ecl.ambiance);
    // (l'ambiance est un éclairement : divisé par π, c'est la luminance du ciel)
    u.uAmbHaut.value.copy(amb).multiplyScalar((0.75 + 0.25 * (1 - meteo.orage)) / Math.PI);
    u.uAmbBas.value.copy(amb).multiplyScalar(0.05);
    u.uCouverture.value = meteo.nuages;
    u.uCirrus.value = meteo.cirrus ?? 0.3;
    u.uOrage.value = meteo.orage;
    u.uBaseNuages.value = THREE.MathUtils.lerp(1350, 650, meteo.orage);
    u.uEpaisseurNuages.value = THREE.MathUtils.lerp(1700, 3600, meteo.orage);
    this.passeCarte.materiau.uniforms.uIntensiteLune.value = INTENSITE_SOLEIL * ecl.intensiteLune * 0.05;
    const f = this.fond.material.uniforms;
    f.uNuit.value = ecl.nuit;
    f.uVisibiliteEtoiles.value = (1 - meteo.pluie) * (1 - 0.8 * meteo.brume);
    f.uLuminanceLune.value = 2.5 * ecl.eclatLune * ecl.nuit + 0.3;
    f.uRotationEtoiles.value = ecl.rotationEtoiles;
    f.uLatitude.value = ecl.latitude;
    // le front orageux : plus il approche, plus il monte dans le ciel
    const uf = this.uniformsFront;
    const front = geometrieFront(meteo);
    uf.uFront.value.set(front.azimut, front.demiLargeur, front.sommet, front.visibilite);
    uf.uFrontAmbiance.value.copy(amb).multiplyScalar(1 / Math.PI);
    uf.uFrontSoleil.value.fromArray(ecl.soleilNuages).multiplyScalar(2.5);
    uf.uFrontDirSoleil.value.fromArray(ecl.dirSoleil);
  }

  // Le vent pousse les nuages (vitesse en m/s, angle vers lequel ils vont)
  deriver(dt, vitesse, angle) {
    const d = this.uniformsNuages.uDeriveNuages.value;
    d.x -= Math.cos(angle) * vitesse * dt;
    d.y -= Math.sin(angle) * vitesse * dt;
  }

  eclair(position, intensite) {
    this.uniformsNuages.uEclair.value.set(position.x, position.y, position.z, intensite);
    this.fond.material.uniforms.uEclairCiel.value = intensite * 0.02;
  }

  // Les calculs qui précèdent le dessin de la scène
  preparer(camera, { toutLeCube = false } = {}) {
    const r = this.renderer;
    const ancienne = r.getRenderTarget();
    this.passeCarte.rendre(r, this.carte);

    const un = this.passeNuages.materiau.uniforms;
    un.uVueProjectionInverse.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    un.uPositionCamera.value.copy(camera.position);
    un.uImage.value = this.numeroImage++ % 64;
    this.passeNuages.rendre(r, this.nuagesEcran);
    // accumulation avec les images précédentes
    const ua = this.passeAccumulation.materiau.uniforms;
    const source = this.historique[this.indexHistorique];
    const cible = this.historique[1 - this.indexHistorique];
    ua.uHistorique.value = source.texture;
    ua.uReinitialiser.value = this.reinitialiserNuages;
    this.passeAccumulation.rendre(r, cible);
    this.indexHistorique = 1 - this.indexHistorique;
    this.fond.material.uniforms.uNuagesEcran.value = cible.texture;
    this.vueProjectionPrecedente.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.reinitialiserNuages = false;

    const ecran = r.getDrawingBufferSize(new THREE.Vector2());
    const fov = THREE.MathUtils.degToRad(camera.fov);
    this.fond.material.uniforms.uTaillePixel.value = fov / ecran.y;

    // le cube : une face par image (ou les six d'un coup quand le temps change brusquement)
    this.materiauCube.uniforms.uPositionCamera.value.copy(camera.position);
    this.cameraCube.position.set(0, 0, 0);
    this.cameraCube.updateMatrixWorld();
    const faces = toutLeCube || !this.cubeComplet ? [0, 1, 2, 3, 4, 5] : [this.faceCube];
    const cameras = this.cameraCube.children;
    for (const face of faces) {
      r.setRenderTarget(this.cube, face);
      r.render(this.sceneCube, cameras[face]);
    }
    // (après chaque face, Three refait les « mipmaps », les versions floues du cube
    // que la mer lit quand elle est agitée)
    this.cubeComplet = true;
    this.faceCube = (this.faceCube + 1) % 6;
    r.setRenderTarget(ancienne);
  }

  // Éclairage d'ambiance du bateau (recalculé au plus toutes les demi-secondes)
  environnementPour(dt, force = false) {
    this.ageEnvironnement += dt;
    if (force || this.ageEnvironnement > 0.5 || !this.environnement) {
      const ancien = this.environnement;
      this.environnement = this.pmrem.fromCubemap(this.cube.texture, ancien ?? undefined);
      this.ageEnvironnement = 0;
    }
    return this.environnement.texture;
  }
}
