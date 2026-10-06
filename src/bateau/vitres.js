// La pluie sur les vitres de la timonerie : des gouttes posées qui grossissent puis
// s'effacent, et des filets d'eau qui coulent en zigzag en laissant une traînée. Le
// pare-brise est tenu à peu près dégagé par les essuie-glaces ; les vitres de côté et de
// l'arrière ruissellent.
//
// Tout est calculé dans le shader des vitres (une seule matière, sans texture) : la
// position sur la vitre vient du modèle (le repère du bateau). Une goutte est un peu plus
// opaque que le verre, et plus lisse : elle reflète le ciel et les éclairs.

const GLSL = /* glsl */ `
uniform float uPluieVitre;  // 0 → 1
uniform float uTempsVitre;
uniform float uEssuie;      // 0 → 1 : le pare-brise balayé
varying vec3 vPosVitre;
varying vec3 vNormaleVitre;

float hasardV(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// les gouttes posées : au plus une par case (1,6 cm), qui apparaît, grossit un peu, s'efface
float gouttesPosees(vec2 uv, float t, float densite) {
  vec2 c = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float h = hasardV(c);
  vec2 o = (vec2(hasardV(c + 7.31), hasardV(c + 3.17)) - 0.5) * 0.5;
  float vie = fract(t * (0.04 + 0.08 * h) + h * 7.0);
  float r = (0.12 + 0.22 * hasardV(c + 1.73)) * (0.7 + 0.3 * vie);
  float d = length((f - o) * vec2(1.0, 0.85));
  float presente = step(1.0 - densite, hasardV(c + 9.1));
  return smoothstep(r, r * 0.55, d) * smoothstep(0.0, 0.08, vie) * (1.0 - smoothstep(0.75, 1.0, vie)) * presente;
}

// les filets : par colonnes de 3 cm, une grosse goutte qui descend en zigzag et sa traînée
float filets(vec2 uv, float t, float densite) {
  float col = floor(uv.x);
  float h = hasardV(vec2(col, 1.7));
  if (h > densite) return 0.0;
  float vitesse = 0.18 + 0.4 * hasardV(vec2(col, 4.1));
  // (la position de la tête le long de la vitre : elle descend, et repart d'en haut)
  float y = fract(uv.y * 0.08 + t * vitesse + h * 13.0);
  // (un zigzag irrégulier : la goutte hésite, repart, d'une colonne à l'autre différemment)
  float x = fract(uv.x) - 0.5 + 0.08 * sin(uv.y * (1.3 + 2.0 * h) + h * 6.0) + 0.04 * sin(uv.y * 5.7 + h * 2.0);
  float tete = smoothstep(0.16, 0.07, length(vec2(x, (y - 0.93) * 9.0)));
  float trainee = smoothstep(0.07, 0.025, abs(x)) * smoothstep(0.93, 0.35, y) * step(y, 0.93) * 0.55;
  return max(tete, trainee);
}

// l'eau sur la vitre au point p (repère du bateau), de normale n : 0 → 1
float eauSurLaVitre(vec3 p, vec3 n) {
  if (uPluieVitre < 0.01) return 0.0;
  // (sur les côtés, la vitre est dans le plan (z, y) ; ailleurs, dans le plan (x, y))
  vec2 q = abs(n.x) > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y);
  // le pare-brise (devant, bas) est essuyé ; les autres vitres ruissellent
  bool pareBrise = p.z < 0.75;
  float d = uPluieVitre * (pareBrise ? 1.0 - 0.85 * uEssuie : 1.0);
  float e = gouttesPosees(q * 62.0, uTempsVitre, 0.25 + 0.6 * d) * smoothstep(0.0, 0.3, d);
  e = max(e, filets(q * vec2(33.0, 33.0), uTempsVitre, 0.2 + 0.55 * d) * smoothstep(0.15, 0.6, d));
  return e;
}
`;

// Prépare la matière des vitres de la timonerie ; rend ses réglages (à changer à chaque image)
export function mouillerLesVitres(materiau) {
  const uniforms = {
    uPluieVitre: { value: 0 },
    uTempsVitre: { value: 0 },
    uEssuie: { value: 0 },
  };
  materiau.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosVitre;\nvarying vec3 vNormaleVitre;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosVitre = position;\nvNormaleVitre = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float eauVitre = eauSurLaVitre(vPosVitre, normalize(vNormaleVitre));
  // (l'eau assombrit un peu le verre et s'y voit surtout par ses reflets, nets)
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.03, 0.035), eauVitre * 0.6);
  diffuseColor.a = mix(diffuseColor.a, 0.42, eauVitre);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.0, eauVitre);');
  };
  materiau.customProgramCacheKey = () => 'vitres-timonerie-pluie';
  materiau.needsUpdate = true;
  return uniforms;
}
