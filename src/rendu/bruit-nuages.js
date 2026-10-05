// La « pâte » des nuages : un cube de bruit 3D calculé une fois au démarrage par la
// carte graphique (128 tranches de 128 × 128 pixels).
//
// Quatre bruits, un par couleur :
//   R : la forme des nuages (Perlin-Worley creusé par du Worley : des boules gonflées
//       qui se touchent), recette des nuages des jeux « Horizon » (Schneider, 2015)
//   G, B, A : bruit de Worley à trois finesses, pour grignoter les bords
// Chaque bruit est étiré pour occuper toute la plage 0 → 1 (mesuré : sans ça, la forme
// ne variait qu'entre 0,80 et 0,90 et les nuages étaient tout ou rien).
// Le cube se répète sans couture dans les trois directions.
import * as THREE from 'three';
import { PassePleinEcran, SOMMET_PLEIN_ECRAN } from './outils.js';

const FRAGMENT = /* glsl */ `
in vec2 vUv;
uniform float uCouche;

// Hachage entier (pcg3d) : trois nombres pseudo-aléatoires à partir d'une case
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hasard3(vec3 caseEntiere) {
  return vec3(pcg3d(uvec3(ivec3(caseEntiere) + 4096))) / 4294967295.0;
}

// Bruit de Worley répétable : distance au point le plus proche, parmi un point tiré
// au hasard dans chaque case. Inversé : 1 au centre des « bulles », 0 entre elles.
// Version « adoucie » : au lieu du minimum strict (qui laisse des arêtes droites entre
// deux cellules, d'où des nuages en forme de boîte), un minimum lissé.
float worley(vec3 p, float periode) {
  vec3 c = floor(p);
  vec3 f = fract(p);
  const float K = 10.0;
  float somme = 0.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 voisin = vec3(x, y, z);
    vec3 caseRepetee = mod(c + voisin, periode);
    vec3 point = voisin + hasard3(caseRepetee) - f;
    somme += exp(-K * length(point));
  }
  float d = -log(somme) / K;
  return 1.0 - clamp(d, 0.0, 1.0);
}

// Bruit de Perlin répétable (bruit de gradient)
float perlin(vec3 p, float periode) {
  vec3 c = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float valeurs[8];
  for (int i = 0; i < 8; i++) {
    vec3 coin = vec3(i & 1, (i >> 1) & 1, (i >> 2) & 1);
    vec3 g = normalize(hasard3(mod(c + coin, periode)) * 2.0 - 1.0);
    valeurs[i] = dot(g, f - coin);
  }
  float x00 = mix(valeurs[0], valeurs[1], u.x);
  float x10 = mix(valeurs[2], valeurs[3], u.x);
  float x01 = mix(valeurs[4], valeurs[5], u.x);
  float x11 = mix(valeurs[6], valeurs[7], u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

float perlinFbm(vec3 p, float frequence, int octaves) {
  float somme = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    somme += amplitude * perlin(p * frequence, frequence);
    total += amplitude;
    frequence *= 2.0;
    amplitude *= 0.5;
  }
  return somme / total;
}

float worleyFbm(vec3 p, float frequence) {
  return worley(p * frequence, frequence) * 0.625
       + worley(p * frequence * 2.0, frequence * 2.0) * 0.25
       + worley(p * frequence * 4.0, frequence * 4.0) * 0.125;
}

float remap(float x, float a, float b, float c, float d) { return c + (x - a) / (b - a) * (d - c); }

float etirer(float x, float bas, float haut) { return clamp((x - bas) / (haut - bas), 0.0, 1.0); }

void main() {
  vec3 p = vec3(vUv, uCouche);
  float frequence = 4.0;
  // Perlin « gonflé » (valeur absolue) : des volutes de cumulus
  float pfbm = mix(1.0, perlinFbm(p, 4.0, 7) * 0.5 + 0.5, 0.5);
  pfbm = abs(pfbm * 2.0 - 1.0);
  float g = worleyFbm(p, frequence);
  float b = worleyFbm(p, frequence * 2.0);
  float a = worleyFbm(p, frequence * 4.0);
  float perlinWorley = clamp(remap(pfbm, 0.0, 1.0, g, 1.0), 0.0, 1.0);
  // la forme : creusée par les trois Worley
  float fbm = g * 0.625 + b * 0.25 + a * 0.125;
  float forme = clamp(remap(perlinWorley, fbm - 1.0, 1.0, 0.0, 1.0), 0.0, 1.0);
  gl_FragColor = vec4(
    etirer(forme, 0.775, 0.905),
    etirer(g, 0.25, 0.75),
    etirer(b, 0.25, 0.77),
    etirer(a, 0.26, 0.76)
  );
}
`;

export function creerBruitNuages(renderer, taille = 128) {
  const cible = new THREE.WebGL3DRenderTarget(taille, taille, taille, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
  });
  const texture = cible.texture;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;

  const materiau = new THREE.ShaderMaterial({
    uniforms: { uCouche: { value: 0 } },
    vertexShader: SOMMET_PLEIN_ECRAN,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const passe = new PassePleinEcran(materiau);
  const ancienne = renderer.getRenderTarget();
  for (let z = 0; z < taille; z++) {
    materiau.uniforms.uCouche.value = (z + 0.5) / taille;
    passe.rendre(renderer, cible, z);
  }
  renderer.setRenderTarget(ancienne);
  materiau.dispose();
  return texture;
}
