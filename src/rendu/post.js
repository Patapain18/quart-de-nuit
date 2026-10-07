// Le « développement » de l'image, comme pour une photo.
//
// La scène est dessinée dans une image à grande dynamique : le soleil peut y valoir
// des milliers de fois plus que l'ombre d'une voile. Avant l'écran, on :
//  1. fait « baver » la lumière autour des points très lumineux (le halo, ou bloom),
//     comme l'œil ou un objectif ;
//  2. règle l'exposition (le jour est atténué, la nuit éclaircie) ;
//  3. compresse cette grande dynamique dans ce que l'écran sait afficher, sans brûler
//     les blancs ni boucher les noirs (« tone mapping » AgX, celui de Blender) ;
//  4. étalonne les couleurs (saturation, contraste, chaleur), assombrit les bords
//     (vignettage) et ajoute un grain très léger qui évite les bandes dans les dégradés.
// Et quand de l'eau est venue sur « l'objectif » (rendu/gouttes.js), chaque goutte dévie
// et brouille la lumière qui la traverse.
import * as THREE from 'three';
import { PassePleinEcran, SOMMET_PLEIN_ECRAN } from './outils.js';

const FRAGMENT_REDUCTION = /* glsl */ `
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform bool uPremiere;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 lire(vec2 decalage) {
  vec3 c = texture(uSource, vUv + uTexel * decalage).rgb;
  // la première réduction calme les points isolés trop brillants (les éclats du soleil
  // sur l'eau feraient sinon des halos qui clignotent)
  if (uPremiere) c = min(c, vec3(400.0)) / (1.0 + luma(min(c, vec3(400.0))) * 0.08);
  return c;
}
void main() {
  // filtre à 13 points (Jimenez, 2014)
  vec3 a = lire(vec2(-2.0, 2.0)), b = lire(vec2(0.0, 2.0)), c = lire(vec2(2.0, 2.0));
  vec3 d = lire(vec2(-2.0, 0.0)), e = lire(vec2(0.0, 0.0)), f = lire(vec2(2.0, 0.0));
  vec3 g = lire(vec2(-2.0, -2.0)), h = lire(vec2(0.0, -2.0)), i = lire(vec2(2.0, -2.0));
  vec3 j = lire(vec2(-1.0, 1.0)), k = lire(vec2(1.0, 1.0)), l = lire(vec2(-1.0, -1.0)), m = lire(vec2(1.0, -1.0));
  vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(r, 1.0);
}
`;

const FRAGMENT_AGRANDISSEMENT = /* glsl */ `
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uRayon;
void main() {
  vec2 t = uTexel * uRayon;
  vec3 r = texture(uSource, vUv).rgb * 4.0;
  r += (texture(uSource, vUv + vec2(t.x, 0.0)).rgb + texture(uSource, vUv - vec2(t.x, 0.0)).rgb
      + texture(uSource, vUv + vec2(0.0, t.y)).rgb + texture(uSource, vUv - vec2(0.0, t.y)).rgb) * 2.0;
  r += texture(uSource, vUv + t).rgb + texture(uSource, vUv - t).rgb
     + texture(uSource, vUv + vec2(t.x, -t.y)).rgb + texture(uSource, vUv + vec2(-t.x, t.y)).rgb;
  gl_FragColor = vec4(r / 16.0, 1.0);
}
`;

const FRAGMENT_FINAL = /* glsl */ `
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uHalo;
uniform float uForceHalo;
uniform float uExposition;
uniform float uSaturation;
uniform float uContraste;
uniform vec3 uBalance;      // multiplicateurs des couleurs (chaleur de l'image)
uniform vec3 uTeinteOmbres; // couleur ajoutée dans les ombres
uniform float uVignettage;
uniform float uGrain;
uniform float uTemps;
uniform float uFlash;       // éclair : tout blanchit un instant
uniform float uEmbruns;     // dans les embruns d'une trombe : un voile d'eau pulvérisée
uniform float uLampeVoile;  // le faisceau de la lampe frontale, dans l'eau qui flotte dans l'air
uniform sampler2D uGouttes; // les gouttes sur l'objectif (normale en rg, épaisseur en b, eau en a)
uniform float uForceGouttes;

// AgX (Troy Sobotka), approximation polynomiale de Benjamin Wrensch
vec3 agxContraste(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 c) {
  const mat3 entree = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                           0.0784335999999992, 0.878468636469772, 0.0784336,
                           0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 sortie = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                           -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                           -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  const float evMin = -12.47393;
  const float evMax = 4.026069;
  c = entree * c;
  c = clamp(log2(max(c, vec3(1e-10))), evMin, evMax);
  c = (c - evMin) / (evMax - evMin);
  c = agxContraste(c);
  c = sortie * c;
  return clamp(c, 0.0, 1.0); // (déjà « gamma » : proche de l'espace de l'écran)
}

float hasard(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// (un bruit doux : le hasard, lissé entre les cases)
float bruitDoux(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hasard(i), hasard(i + vec2(1.0, 0.0)), f.x), mix(hasard(i + vec2(0.0, 1.0)), hasard(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  // une goutte est une petite lentille : elle montre la scène décalée (et retournée), et
  // floue (on y mêle l'image brouillée du halo)
  vec4 goutte = texture(uGouttes, vUv);
  float eau = goutte.a * uForceGouttes;
  vec2 normale = (goutte.rg - 0.5) * 2.0;
  vec2 uv = vUv - normale * eau * 0.035;
  vec3 c = texture(uScene, uv).rgb;
  vec3 halo = texture(uHalo, uv).rgb;
  // (un peu floue : elle est trop près pour être nette), avec un liseré sombre sur son
  // bord, là où la lumière se réfléchit dans la goutte au lieu de la traverser
  c = mix(c, halo, eau * 0.2);
  c *= 1.0 - eau * 0.65 * smoothstep(0.6, 0.0, goutte.b);
  c += halo * uForceHalo;
  // (la lampe éclaire les gouttes et les embruns devant les yeux : une lueur au centre de
  // la vue, qui bouge avec le regard, et qui grésille avec la pluie)
  vec2 versCentre = vUv - 0.5;
  float faisceau = exp(-dot(versCentre, versCentre) * 7.0) * (0.85 + 0.15 * hasard(floor(vUv * 160.0) + floor(uTemps * 24.0)));
  c += vec3(1.0, 0.93, 0.82) * uLampeVoile * faisceau;
  c *= uExposition * uBalance;
  c += uTeinteOmbres * 0.02 * uExposition;
  c += vec3(uFlash);
  c = agx(c);
  // étalonnage (dans l'espace de l'écran)
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContraste + 0.5;
  // (l'eau pulvérisée diffuse la lumière : tout se noie dans un gris laiteux, où passent
  // des bouffées plus ou moins épaisses, emportées par le tourbillon)
  if (uEmbruns > 0.0) {
    vec2 p = vUv * vec2(1.6, 1.0);
    float bouffees = bruitDoux(p * 4.0 + vec2(uTemps * 1.9, uTemps * 0.6)) * 0.55
                   + bruitDoux(p * 9.0 + vec2(uTemps * 3.7, -uTemps * 1.1)) * 0.3
                   + bruitDoux(p * 21.0 + vec2(uTemps * 6.5, uTemps * 0.4)) * 0.15;
    float nuee = 0.72 + 0.4 * bouffees;
    c = mix(c, vec3(0.42, 0.47, 0.52) * nuee, uEmbruns * (0.45 + 0.35 * bouffees));
  }
  // vignettage
  vec2 centre = vUv - 0.5;
  c *= 1.0 - uVignettage * dot(centre, centre) * 1.6;
  // grain de film (et anti-bandes)
  float g = hasard(vUv * 1000.0 + fract(uTemps * 13.7)) - 0.5;
  c += g * uGrain + (hasard(vUv * 731.0 + 0.5) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export class Post {
  constructor(renderer, { niveauxHalo = 6, echantillons = 4 } = {}) {
    this.renderer = renderer;
    this.cible = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      samples: echantillons, // anti-crénelage (bords des cordages, des haubans…)
      depthBuffer: true,
    });
    this.niveaux = [];
    for (let i = 0; i < niveauxHalo; i++) {
      this.niveaux.push(new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
      }));
    }
    this.reduction = new PassePleinEcran(new THREE.ShaderMaterial({
      uniforms: { uSource: { value: null }, uTexel: { value: new THREE.Vector2() }, uPremiere: { value: false } },
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_REDUCTION, depthTest: false, depthWrite: false,
    }));
    this.agrandissement = new PassePleinEcran(new THREE.ShaderMaterial({
      uniforms: { uSource: { value: null }, uTexel: { value: new THREE.Vector2() }, uRayon: { value: 1 } },
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_AGRANDISSEMENT, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    }));
    this.reglages = {
      uScene: { value: this.cible.texture },
      uHalo: { value: this.niveaux[0].texture },
      uForceHalo: { value: 0.06 },
      uExposition: { value: 1 },
      uSaturation: { value: 1.08 },
      uContraste: { value: 1.04 },
      uBalance: { value: new THREE.Vector3(1, 1, 1) },
      uTeinteOmbres: { value: new THREE.Vector3(0, 0, 0) },
      uVignettage: { value: 0.35 },
      uGrain: { value: 0.018 },
      uTemps: { value: 0 },
      uFlash: { value: 0 },
      uEmbruns: { value: 0 },
      uLampeVoile: { value: 0 },
      uGouttes: { value: Post.textureVide() },
      uForceGouttes: { value: 0 },
    };
    this.final = new PassePleinEcran(new THREE.ShaderMaterial({
      uniforms: this.reglages,
      vertexShader: SOMMET_PLEIN_ECRAN, fragmentShader: FRAGMENT_FINAL, depthTest: false, depthWrite: false,
    }));
  }

  // L'anticrénelage (les bords des haubans, des cordages…) : 0, 2 ou 4 échantillons
  changerEchantillons(n) {
    if (this.cible.samples === n) return;
    this.cible.dispose();
    this.cible.samples = n;
  }

  // (une texture d'un pixel, transparente : pas de gouttes)
  static textureVide() {
    const t = new THREE.DataTexture(new Uint8Array([128, 128, 0, 0]), 1, 1);
    t.needsUpdate = true;
    return t;
  }

  redimensionner(largeur, hauteur) {
    this.cible.setSize(largeur, hauteur);
    let l = largeur;
    let h = hauteur;
    for (const n of this.niveaux) {
      l = Math.max(1, Math.floor(l / 2));
      h = Math.max(1, Math.floor(h / 2));
      n.setSize(l, h);
    }
  }

  // Dessine la scène dans l'image à grande dynamique, puis la développe à l'écran
  rendre(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.cible);
    r.clear();
    r.render(scene, camera);

    // le halo : on réduit l'image plusieurs fois de moitié, puis on remonte en additionnant
    const red = this.reduction.materiau.uniforms;
    let source = this.cible;
    this.niveaux.forEach((n, i) => {
      red.uSource.value = source.texture;
      red.uTexel.value.set(1 / source.width, 1 / source.height);
      red.uPremiere.value = i === 0;
      this.reduction.rendre(r, n);
      source = n;
    });
    const ag = this.agrandissement.materiau.uniforms;
    for (let i = this.niveaux.length - 1; i > 0; i--) {
      const petit = this.niveaux[i];
      ag.uSource.value = petit.texture;
      ag.uTexel.value.set(1 / petit.width, 1 / petit.height);
      this.agrandissement.rendre(r, this.niveaux[i - 1]);
    }

    this.final.rendre(r, null);
  }
}
