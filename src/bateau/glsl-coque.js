// La forme de la coque en GLSL : les mêmes fonctions que forme.js, pour que la carte
// graphique sache si un point est DANS le bateau.
// Sert à « creuser » la mer : sans ça, la surface de l'eau traverserait la cabine (on la
// verrait couper le carré à hauteur de la flottaison), et le cockpit quand le bateau gîte.
import { COQUE } from './forme.js';

const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

export const GLSL_COQUE = /* glsl */ `
uniform mat4 uBateauInverse; // monde → repère du bateau
uniform float uClipCoque;    // 1 : on creuse la mer dans la coque

float coqueLivet(float u) { return ${f(COQUE.livetArriere)} + ${f(COQUE.livetAvant - COQUE.livetArriere)} * pow(u, 1.8); }
float coqueDemiLargeur(float u) {
  if (u <= ${f(COQUE.uLargeurMax)}) {
    float t = sin(1.5707963 * (u / ${f(COQUE.uLargeurMax)}));
    return ${f(COQUE.demiLargeurTableau)} + ${f(COQUE.demiLargeurMax - COQUE.demiLargeurTableau)} * pow(t, 1.2);
  }
  float t = (u - ${f(COQUE.uLargeurMax)}) / ${f(1 - COQUE.uLargeurMax)};
  return ${f(COQUE.demiLargeurMax)} * pow(max(0.0, cos(1.5707963 * t)), 0.9);
}
float coqueFond(float u) {
  if (u <= ${f(COQUE.uPiedEtrave)}) return -${f(COQUE.creuxMax)} * sin(3.14159265 * (u + 0.1014) / ${f(COQUE.uPiedEtrave + 0.1014)});
  float t = (u - ${f(COQUE.uPiedEtrave)}) / ${f(1 - COQUE.uPiedEtrave)};
  return coqueLivet(1.0) * pow(t, 0.75);
}
// vrai si le point (repère du monde) est à l'intérieur de la coque, sous le pont
bool dansCoque(vec3 pMonde) {
  vec3 p = (uBateauInverse * vec4(pMonde, 1.0)).xyz;
  float u = (p.z - ${f(COQUE.zArriere)}) / ${f(COQUE.zAvant - COQUE.zArriere)};
  if (u < 0.002 || u > 0.998) return false;
  float bas = coqueFond(u);
  float haut = coqueLivet(u) + 0.06;
  if (p.y < bas + 0.02 || p.y > haut) return false;
  float s = clamp((p.y - bas) / (coqueLivet(u) - bas), 0.0, 1.0);
  float n = ${f(COQUE.bouchain[0])} + ${f(COQUE.bouchain[1] - COQUE.bouchain[0])} * u;
  float w = coqueDemiLargeur(u) * pow(1.0 - pow(1.0 - s, n), 1.0 / n);
  return abs(p.x) < w - 0.025;
}
`;
