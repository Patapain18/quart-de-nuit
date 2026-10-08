// Les grains à l'écran (monde/grains.js dit où ils sont et ce qu'ils font).
//
// 1. Les rideaux de pluie : sous chaque grain, la pluie tombe de la base des nuages jusqu'à
//    la mer. Chaque morceau de son cœur est une colonne de pluie dont la densité décroît
//    en cloche autour de son axe (une gaussienne) ; la colonne penche (le vent pousse la
//    pluie en tombant). Pour un pixel, il faut savoir combien de pluie le regard traverse :
//    pour une cloche, ça se calcule d'un coup (avec la « fonction d'erreur », erf), sans
//    avancer pas à pas ; puis des traînées verticales, plus ou moins denses, qui
//    descendent lentement. Chaque rideau renvoie la lumière du ciel (plus claire en bas),
//    s'illumine à contre-jour quand le soleil est derrière lui, et s'allume tout entier
//    quand un éclair tombe tout près. La mer (rendu/eau.js), le ciel et le cube des reflets
//    (rendu/ciel.js) les dessinent devant ce qu'ils cachent.
// 2. La rafale sur la mer : devant chaque grain, l'air froid qui s'étale ride et blanchit
//    la mer ; son bord avance comme une ligne sombre (la mer froissée ne reflète plus le
//    ciel clair de l'horizon).
// 3. Le nuage d'orage au-dessus (rendu/glsl/nuages.js) : une petite carte, vue d'en haut,
//    de là où le ciel est bouché (rendu/grains.js la calcule).
export const N_RIDEAUX = 12;
export const N_GRAINS = 8;

export const UNIFORMS_GRAINS = {
  uRideaux: { value: null }, // [x, z, largeur σ (m), densité au cœur (1/m)]
  uRideauxB: { value: null }, // [penche x, penche z (m par m de hauteur), graine, 0]
  uRideauxN: { value: 0 },
  uRideauxReglages: { value: null }, // base des nuages (m), temps (s)
  uRideauxLumiere: { value: null }, // la lumière du ciel sur la pluie
  uRideauxSoleil: { value: null }, // le soleil qui arrive jusqu'à elle
  uRideauxDirSoleil: { value: null },
  uRideauxEclair: { value: null }, // l'éclair : le début de son trait (m), intensité…
  uRideauxEclairB: { value: null }, // … et sa fin (m)
  uGrainsVent: { value: null }, // [x, z du cœur dense, rayon (m), intensité]
  uGrainsDir: { value: null }, // [direction de sa route x, z, bord de sa rafale devant lui (en rayons), 0]
  uGrainsN: { value: 0 },
};

// nomBruit : le bruit 3D des nuages, sous le nom qu'il porte dans ce shader
export function glslGrains(nomBruit) {
  return /* glsl */ `
uniform vec4 uRideaux[${N_RIDEAUX}];
uniform vec4 uRideauxB[${N_RIDEAUX}];
uniform int uRideauxN;
uniform vec4 uRideauxReglages;
uniform vec3 uRideauxLumiere;
uniform vec3 uRideauxSoleil;
uniform vec3 uRideauxDirSoleil;
uniform vec4 uRideauxEclair;
uniform vec4 uRideauxEclairB;
uniform vec4 uGrainsVent[${N_GRAINS}];
uniform vec4 uGrainsDir[${N_GRAINS}];
uniform int uGrainsN;

// La fonction d'erreur (approchée à mieux qu'un millième : Winitzki)
float erfRideau(float x) {
  float x2 = x * x;
  float e = sqrt(1.0 - exp(-x2 * (1.2732395 + 0.147 * x2) / (1.0 + 0.147 * x2)));
  return x < 0.0 ? -e : e;
}
float phaseRideau(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (12.566371 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

// Les rideaux de pluie le long du rayon o + s d (0 ≤ s ≤ sMax). Rend la lumière qu'ils
// renvoient vers l'œil (rgb, voilée par la brume de densité « brume » vers « couleurBrume »)
// et la part de ce qui est derrière eux qui passe encore (a).
vec4 rideaux(vec3 o, vec3 d, float sMax, float brume, vec3 couleurBrume) {
  vec3 lumiere = vec3(0.0);
  float transmission = 1.0;
  float base = uRideauxReglages.x;
  float temps = uRideauxReglages.y;
  // (ce qui ne dépend que du regard : le soleil derrière la pluie — seulement quand il est
  // bas, sous la base des nuages : plus haut, le nuage la met à l'ombre —, et le sens du
  // travers, pour les traînées)
  vec3 soleil = uRideauxSoleil * (1.0 - smoothstep(0.05, 0.3, uRideauxDirSoleil.y)) * phaseRideau(dot(d, uRideauxDirSoleil), 0.7);
  vec2 travers = normalize(vec2(-d.z, d.x) + 1e-6);
  for (int i = 0; i < ${N_RIDEAUX}; i++) {
    if (i >= uRideauxN || transmission < 0.01) break;
    vec4 a = uRideaux[i];
    vec4 b = uRideauxB[i];
    // la part du rayon entre la mer et la base des nuages
    float s0 = 0.0;
    float s1 = sMax;
    if (abs(d.y) > 1e-5) {
      float sa = -o.y / d.y;
      float sb = (base - o.y) / d.y;
      s0 = max(s0, min(sa, sb));
      s1 = min(s1, max(sa, sb));
    } else if (o.y < 0.0 || o.y > base) continue;
    if (s1 <= s0) continue;
    // (dans un repère qui penche avec la colonne, le rayon reste une droite : la distance à
    // l'axe varie comme une parabole le long du rayon, et la pluie traversée est une
    // gaussienne qu'on intègre d'un coup)
    vec2 A = o.xz - a.xy - b.xy * o.y;
    vec2 B = d.xz - b.xy * d.y;
    float B2 = dot(B, B);
    float sig = a.z;
    float sc;
    float tau;
    if (B2 < 1e-6) {
      sc = 0.5 * (s0 + s1);
      tau = a.w * exp(-dot(A, A) / (sig * sig)) * (s1 - s0);
    } else {
      sc = -dot(A, B) / B2;
      vec2 P = A + B * sc;
      float b2 = dot(P, P);
      if (b2 > 9.0 * sig * sig) continue;
      float lB = sqrt(B2);
      float e0 = (s0 - sc) * lB / sig;
      float e1 = (s1 - sc) * lB / sig;
      if (e0 > 3.0 || e1 < -3.0) continue;
      tau = a.w * exp(-b2 / (sig * sig)) * sig / lB * 0.8862269 * (erfRideau(e1) - erfRideau(e0));
    }
    if (tau < 1e-3) continue;
    // là où le regard passe au plus près de l'axe : des traînées verticales qui descendent
    // lentement, des pans plus ou moins denses ; le haut se fond dans le nuage
    float sp = clamp(sc, s0, s1);
    vec3 q = o + d * sp;
    vec2 axe = q.xz - a.xy - b.xy * q.y;
    float u = dot(axe, travers);
    float h = clamp(q.y / base, 0.0, 1.0);
    // (une seule lecture du bruit : son canal large pour les pans, plus ou moins denses —
    // le rideau n'est jamais égal —, son canal fin pour de légères traînées verticales)
    vec4 n = texture(${nomBruit}, vec3(u / 160.0 + b.z * 7.0, q.y / 1100.0 + temps * 0.01, b.z));
    // (de près, sous la pluie, on ne voit plus de traînées : un voile égal, de tous côtés)
    float motif = mix(1.0, (0.88 + 0.24 * n.a) * (0.45 + 1.1 * n.r), smoothstep(120.0, 900.0, sp));
    tau *= motif * (1.0 - 0.55 * smoothstep(0.7, 1.0, h));
    // sa lumière : le ciel, qui n'y arrive que par les côtés (le nuage au-dessus la met à
    // l'ombre : plus claire en bas, où la pluie rejaillit, sombre en haut) ; le soleil bas
    // derrière elle (la pluie s'illumine à contre-jour) ; l'éclair tout près
    vec3 L = uRideauxLumiere * mix(1.5, 0.35, h) + soleil;
    // (l'éclair : la pluie s'allume tout le long de son trait, qui la traverse)
    if (uRideauxEclair.w > 0.0) {
      vec3 ab = uRideauxEclairB.xyz - uRideauxEclair.xyz;
      float se = clamp(dot(q - uRideauxEclair.xyz, ab) / max(dot(ab, ab), 1.0), 0.0, 1.0);
      L += vec3(0.75, 0.82, 1.0) * uRideauxEclair.w * exp(-length(q - uRideauxEclair.xyz - ab * se) / 1400.0) * 1.6;
    }
    // au loin, dans la brume (un peu moins que la mer : le rideau monte au-dessus d'elle)
    L = mix(L, couleurBrume, 1.0 - exp(-sp * brume * 0.7));
    float tr = exp(-tau);
    lumiere += transmission * L * (1.0 - tr);
    transmission *= tr;
  }
  return vec4(lumiere, transmission);
}

// La rafale des grains sur la mer au point p : x, sa force (0 → 1) ; y, son bord qui
// avance (une bande, devant le grain)
vec2 rafaleGrains(vec2 p) {
  float rafale = 0.0;
  float front = 0.0;
  for (int i = 0; i < ${N_GRAINS}; i++) {
    if (i >= uGrainsN) break;
    vec4 g = uGrainsVent[i];
    vec2 dp = p - g.xy;
    float r = length(dp);
    float R = g.z;
    if (r > 2.4 * R) continue;
    float devant = r > 1.0 ? dot(dp / r, uGrainsDir[i].xy) : 0.0;
    // (le bord de sa rafale, devant lui : à 1,9 rayon — moins pour celui qui porte la
    // trombe : monde/grains.js, bordDeLaRafale)
    float bord = R * (1.05 + (uGrainsDir[i].z - 1.05) * (0.5 + 0.5 * devant));
    float dedans = 1.0 - smoothstep(bord - 0.15 * R, bord + 0.2 * R, r);
    rafale = max(rafale, g.w * dedans * (0.3 + 0.7 * smoothstep(0.0, 0.6 * R, r)) * (0.4 + 0.6 * (0.5 + 0.5 * devant)));
    front = max(front, g.w * smoothstep(0.0, 0.6, devant) * smoothstep(bord + 0.2 * R, bord, r) * smoothstep(bord - 0.5 * R, bord - 0.12 * R, r));
  }
  return vec2(rafale, front);
}
`;
}

// La carte du ciel bouché au-dessus des grains, lue par les nuages
export const GLSL_CARTE_GRAINS = /* glsl */ `
uniform sampler2D uCarteGrains;
uniform vec3 uCarteGrainsCentre; // x, z (m), demi-côté (m) ; 0 : pas de carte
float grainsCiel(vec2 xz) {
  if (uCarteGrainsCentre.z <= 0.0) return 0.0;
  vec2 uv = (xz - uCarteGrainsCentre.xy) / (2.0 * uCarteGrainsCentre.z) + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uCarteGrains, uv).r;
}
`;
