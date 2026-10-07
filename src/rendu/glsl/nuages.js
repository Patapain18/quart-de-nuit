// Les nuages en volume, calculés par « marche de rayon » : pour chaque pixel du ciel,
// on avance pas à pas le long du regard à travers la couche de nuages ; à chaque pas
// on mesure l'épaisseur du nuage (le bruit 3D) et la lumière du soleil qui y arrive
// (quelques pas de plus vers le soleil). On additionne ce que chaque bout de nuage
// renvoie vers l'œil, en tenant compte de ce qu'il cache derrière lui.
//
// Besoin de : GLSL_ATMOSPHERE (traverserSphere, RAYON_TERRE) et GLSL_OUTILS.
import { GLSL_CARTE_GRAINS } from './grains.js';

export const UNIFORMS_NUAGES = {
  uBruitNuages: { value: null },
  uDeriveNuages: { value: [0, 0] }, // décalage des nuages poussés par le vent (m)
  uTemps: { value: 0 },
  uCouverture: { value: 0.35 },
  uOrage: { value: 0 },
  uBaseNuages: { value: 1300 },
  uEpaisseurNuages: { value: 1800 },
  uDirSoleil: { value: null },
  uSoleilNuages: { value: null }, // lumière du soleil qui arrive aux nuages
  uDirLune: { value: null },
  uLuneNuages: { value: null },
  uAmbHaut: { value: null }, // lumière du ciel au-dessus des nuages
  uAmbBas: { value: null }, // lumière renvoyée par la mer, sous les nuages
  uEclair: { value: null }, // position (m) et intensité d'un éclair
  uCirrus: { value: 0.3 }, // voile de cirrus très haut (0 → 1)
  uTrombeCiel: { value: null }, // le nuage d'orage qui porte la trombe : x, z, rayon (m), force (0 : pas de trombe)
  uCarteGrains: { value: null }, // le ciel bouché au-dessus des grains, vu d'en haut (rendu/grains.js)
  uCarteGrainsCentre: { value: null },
};

export const GLSL_NUAGES = /* glsl */ `
uniform highp sampler3D uBruitNuages;
uniform vec2 uDeriveNuages;
uniform float uTemps;
uniform float uCouverture;
uniform float uOrage;
uniform float uBaseNuages;
uniform float uEpaisseurNuages;
uniform vec3 uDirSoleil;
uniform vec3 uSoleilNuages;
uniform vec3 uDirLune;
uniform vec3 uLuneNuages;
uniform vec3 uAmbHaut;
uniform vec3 uAmbBas;
uniform vec4 uEclair;
uniform float uCirrus;
uniform vec4 uTrombeCiel;
${GLSL_CARTE_GRAINS}

const float ECHELLE_FORME = 1.0 / 9000.0;   // le motif de forme se répète tous les 9 km
const float ECHELLE_DETAIL = 1.0 / 1300.0;  // le motif de détail tous les 1,3 km

// Densité du nuage au point p (mètres, repère du monde) ; h = hauteur relative dans la couche (0 → 1)
float densiteNuage(vec3 p, float h, bool detaille) {
  if (h <= 0.0 || h >= 1.0) return 0.0;
  vec3 q = p + vec3(uDeriveNuages.x, 0.0, uDeriveNuages.y);

  // Carte du temps : où il peut y avoir des nuages (de grandes zones de 10 à 30 km).
  // Avec 30 % de couverture, environ un tiers du ciel est dans une zone nuageuse.
  float carte = texture(uBruitNuages, vec3(q.xz * (1.0 / 30000.0), 0.37)).r * 0.65
              + texture(uBruitNuages, vec3(q.xz * (1.0 / 11000.0), 0.81)).r * 0.35;
  float zone = smoothstep(1.0 - uCouverture - 0.12, 1.0 - uCouverture + 0.12, carte);
  // au-dessus d'une trombe, le nuage d'orage qui la porte : le ciel y est bouché
  float parent = 0.0;
  if (uTrombeCiel.w > 0.0) {
    parent = uTrombeCiel.w * (1.0 - smoothstep(uTrombeCiel.z * 0.4, uTrombeCiel.z, length(p.xz - uTrombeCiel.xy)));
    zone = max(zone, parent);
  }
  // au-dessus d'un grain, son nuage d'orage : le ciel y est bouché, épais, en tours
  float grain = grainsCiel(p.xz);
  zone = max(zone, grain);
  parent = max(parent, grain * 0.85);
  if (zone <= 0.0) return 0.0;

  // Profil vertical : base plate, puis la densité diminue avec la hauteur, ce qui
  // arrondit les sommets en dômes (cumulus) ; l'orage fait des tours plus hautes
  float orage = max(uOrage, grain);
  float profil = smoothstep(0.0, mix(0.07, 0.03, orage), h) * pow(1.0 - h, mix(0.9, 0.45, orage));

  float forme = texture(uBruitNuages, q * ECHELLE_FORME + vec3(0.0, uTemps * 0.0006, 0.0)).r;
  // au cœur d'une zone, le seuil est bas (gros nuages serrés) ; en bordure, il est haut
  // (petits nuages épars) ; par ciel couvert, il descend jusqu'à boucher le ciel
  float plein = smoothstep(0.7, 1.0, uCouverture);
  float seuil = mix(mix(0.92, mix(0.42, 0.05, plein), zone), 0.06, parent);
  float base = saturer((forme * profil - seuil) / (1.0 - seuil));
  if (base <= 0.0 || !detaille) return base;

  // Le détail grignote les bords (en volutes en bas du nuage, en vagues en haut)
  vec3 qd = q * ECHELLE_DETAIL + vec3(uTemps * 0.004, -uTemps * 0.002, 0.0);
  vec4 d = texture(uBruitNuages, qd);
  float detail = d.g * 0.625 + d.b * 0.25 + d.a * 0.125;
  detail = mix(detail, 1.0 - detail, saturer(h * 4.0));
  return saturer(remap(base, detail * mix(0.28, 0.4, uOrage), 1.0, 0.0, 1.0));
}

// Altitude d'un point (la Terre est ronde : au loin, les nuages descendent vers l'horizon)
float altitudeDe(vec3 p) {
  return length(vec3(p.x, p.y + RAYON_TERRE, p.z)) - RAYON_TERRE;
}

// Part de la lumière d'un nuage situé à la distance t qui nous parvient à travers la brume
float voileNuages(float t) { return exp(-t / mix(55000.0, 22000.0, uOrage)); }

// Lumière qui arrive en un point du nuage depuis un astre (direction l) : on mesure
// l'épaisseur de nuage à traverser avec quelques pas vers lui.
float epaisseurVers(vec3 p, vec3 l) {
  float somme = 0.0;
  float pas = 70.0;
  float t = 0.0;
  for (int j = 0; j < 5; j++) {
    t += pas;
    vec3 q = p + l * t;
    float h = (altitudeDe(q) - uBaseNuages) / uEpaisseurNuages;
    somme += densiteNuage(q, h, j < 2) * pas;
    pas *= 1.9;
  }
  return somme;
}

// Diffusion multiple approchée (4 « rebonds » de plus en plus doux et de moins en
// moins orientés) : sans elle, l'intérieur des nuages serait noir. Le facteur final
// règle l'éclat des sommets au soleil (blancs, plus lumineux que le ciel bleu).
vec3 lumiereAstre(float profondeur, float cosTheta, vec3 couleur) {
  float somme = 0.0;
  float a = 1.0, b = 1.0, c = 1.0;
  for (int k = 0; k < 4; k++) {
    float phase = mix(phaseHG(cosTheta, 0.8 * b), phaseHG(cosTheta, -0.3 * b), 0.3);
    somme += c * exp(-profondeur * a) * phase;
    a *= 0.5; b *= 0.5; c *= 0.5;
  }
  // La lumière finit toujours par traverser, en se diffusant : sous un ciel couvert,
  // la base des nuages reste grise et pas noire (approximation de la diffusion)
  somme += 0.035 / (1.0 + 0.12 * profondeur);
  return couleur * somme * 5.0;
}

// Les nuages vus depuis « origine » (m) dans la direction d.
// Renvoie la lumière renvoyée (rgb) et l'opacité (a).
vec4 nuagesVolume(vec3 origine, vec3 d, int pasMax, float decalage) {
  if (d.y < -0.01) return vec4(0.0);
  vec3 o = vec3(0.0, RAYON_TERRE + origine.y, 0.0);
  float tEntree = traverserSphere(o, d, RAYON_TERRE + uBaseNuages).y;
  float tSortie = traverserSphere(o, d, RAYON_TERRE + uBaseNuages + uEpaisseurNuages).y;
  if (tEntree > 160000.0) return vec4(0.0);
  float longueur = min(tSortie - tEntree, mix(9000.0, 16000.0, uOrage));
  float ds = longueur / float(pasMax);
  float t = tEntree + ds * decalage;

  float cosSoleil = dot(d, uDirSoleil);
  float cosLune = dot(d, uDirLune);
  // extinction (par mètre, pour une densité de 1) : un cumulus devient opaque en ~200 m
  float extinctionParDensite = mix(0.016, 0.022, uOrage);

  vec3 lumiere = vec3(0.0);
  float transmission = 1.0;
  for (int i = 0; i < 64; i++) {
    if (i >= pasMax || transmission < 0.015) break;
    vec3 p = origine + d * t;
    float h = (altitudeDe(p) - uBaseNuages) / uEpaisseurNuages;
    float dens = densiteNuage(p, h, true);
    if (dens > 0.002) {
      float sigma = dens * extinctionParDensite;
      // éclairage : soleil, lune, ciel au-dessus, mer en dessous, éclairs
      vec3 lum = vec3(0.0);
      if (max(uSoleilNuages.r, uSoleilNuages.g) > 0.001)
        lum += lumiereAstre(epaisseurVers(p, uDirSoleil) * extinctionParDensite, cosSoleil, uSoleilNuages);
      if (max(uLuneNuages.r, uLuneNuages.b) > 0.0005)
        lum += lumiereAstre(epaisseurVers(p, uDirLune) * extinctionParDensite, cosLune, uLuneNuages);
      // « poudre » : les bords fins d'un nuage sont plus sombres que son cœur vu de face
      float poudre = 1.0 - exp(-dens * 6.0);
      lum *= mix(1.0, poudre, 0.4);
      // lumière du ciel : le haut du nuage voit le ciel, le bas voit la mer (sombre)
      vec3 ambiance = mix(uAmbBas, uAmbHaut, smoothstep(0.0, 1.0, h)) * (1.0 - 0.35 * dens);
      lum += ambiance;
      if (uEclair.w > 0.0) {
        float r = length(p - uEclair.xyz);
        lum += vec3(0.75, 0.82, 1.0) * uEclair.w * exp(-r / 1600.0) * 6.0;
      }
      // intégration qui conserve l'énergie (Hillaire 2015)
      float tr = exp(-sigma * ds);
      lumiere += transmission * lum * (1.0 - tr);
      transmission *= tr;
    }
    t += ds;
  }
  // au loin, la lumière des nuages se fond dans la brume de l'horizon
  // (le fond du ciel remplace ce qui manque par la couleur de l'air)
  float voile = voileNuages(tEntree);
  return vec4(lumiere * voile, 1.0 - transmission);
}

// Voile de cirrus très haut (9 km) : des filaments que le soleil couchant colore
vec4 cirrus(vec3 d) {
  if (d.y < 0.0) return vec4(0.0);
  vec3 o = vec3(0.0, RAYON_TERRE + 2.0, 0.0);
  float t = traverserSphere(o, d, RAYON_TERRE + 9000.0).y;
  vec2 p = (d * t).xz + uDeriveNuages * 3.0;
  // étirés dans le sens du vent
  vec2 q = vec2(p.x * 0.6 + p.y * 0.8, -p.x * 0.8 + p.y * 0.6);
  float n = texture(uBruitNuages, vec3(q.x / 30000.0, q.y / 8000.0, 0.71)).g;
  n += 0.5 * texture(uBruitNuages, vec3(q.x / 9000.0, q.y / 2500.0, 0.29)).b;
  float densite = smoothstep(1.2 - uCirrus * 0.55, 1.45, n) * (1.0 - uOrage) * 0.45 * uCirrus;
  densite *= exp(-t / 120000.0);
  vec3 lum = uSoleilNuages * (0.35 + 2.0 * phaseHG(dot(d, uDirSoleil), 0.6)) + uAmbHaut * 0.6 + uLuneNuages * 0.4;
  return vec4(lum * densite, densite);
}
`;
