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
  uEclair: { value: null }, // position (m) et intensité d'un éclair (le milieu de son trajet)
  uEclairA: { value: null }, // son trajet dans le nuage : d'où il part (m), son intensité…
  uEclairB: { value: null }, // … où il va (m), et la distance où sa lumière a baissé de moitié (m)
  uCirrus: { value: 0.3 }, // voile de cirrus très haut (0 → 1)
  uTrombeCiel: { value: null }, // le nuage d'orage qui porte la trombe : x, z, rayon (m), force (0 : pas de trombe)
  uCarteGrains: { value: null }, // le ciel bouché au-dessus des grains, vu d'en haut (rendu/grains.js)
  uCarteGrainsCentre: { value: null },
  uNuitNoire: { value: 0 }, // la nuit d'orage, noire (0 → 1) : sans éclair, on ne voit pas les nuages
  uLueurAube: { value: null }, // la lueur du ciel de l'aube (ou du couchant), à l'horizon, du côté du soleil encore caché
  uDirLueur: { value: null }, // d'où elle vient
  uVisibiliteAir: { value: 60000 }, // la visibilité (m) : à cette distance, il reste 5 % de la lumière (monde/meteo.js)
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
uniform vec4 uEclairA;
uniform vec4 uEclairB;
uniform float uCirrus;
uniform vec4 uTrombeCiel;
uniform float uNuitNoire;
uniform vec3 uLueurAube;
uniform vec3 uDirLueur;
uniform float uVisibiliteAir;
${GLSL_CARTE_GRAINS}

const float ECHELLE_FORME = 1.0 / 9000.0;   // le motif de forme se répète tous les 9 km
const float ECHELLE_DETAIL = 1.0 / 1300.0;  // le motif de détail tous les 1,3 km

// Là où il peut y avoir des nuages, au point p (0 → 1) : la carte du temps (de grandes zones de
// 10 à 30 km ; avec 30 % de couverture, environ un tiers du ciel est dans une zone nuageuse),
// le nuage d'orage qui porte une trombe, celui d'un grain (parent : la part de ciel qu'ils
// bouchent ; grain : celle du grain)
float zoneNuages(vec3 p, out float parent, out float grain) {
  vec2 q = p.xz + uDeriveNuages;
  float carte = texture(uBruitNuages, vec3(q * (1.0 / 30000.0), 0.37)).r * 0.65
              + texture(uBruitNuages, vec3(q * (1.0 / 11000.0), 0.81)).r * 0.35;
  float zone = smoothstep(1.0 - uCouverture - 0.12, 1.0 - uCouverture + 0.12, carte);
  // au-dessus d'une trombe, le nuage d'orage qui la porte : le ciel y est bouché
  parent = 0.0;
  if (uTrombeCiel.w > 0.0) {
    parent = uTrombeCiel.w * (1.0 - smoothstep(uTrombeCiel.z * 0.4, uTrombeCiel.z, length(p.xz - uTrombeCiel.xy)));
    zone = max(zone, parent);
  }
  // au-dessus d'un grain, son nuage d'orage : le ciel y est bouché, épais, en tours
  grain = grainsCiel(p.xz);
  zone = max(zone, grain);
  parent = max(parent, grain * 0.85);
  return zone;
}

// Densité du nuage au point p (mètres, repère du monde), dans sa zone (zoneNuages) ; h = hauteur
// relative dans la couche (0 → 1)
float densiteDansZone(vec3 p, float h, bool detaille, float zone, float parent, float grain) {
  if (h <= 0.0 || h >= 1.0 || zone <= 0.0) return 0.0;
  vec3 q = p + vec3(uDeriveNuages.x, 0.0, uDeriveNuages.y);

  // Profil vertical : base plate, puis la densité diminue avec la hauteur, ce qui
  // arrondit les sommets en dômes (cumulus) ; l'orage fait des tours plus hautes
  float orage = max(uOrage, grain);
  // (la base : franche, sur une cinquantaine de mètres — vue d'en dessous, une base qui monte
  // en douceur sur 130 m n'était qu'un brouillard flou)
  float profil = smoothstep(0.0, mix(0.03, 0.02, orage), h) * pow(1.0 - h, mix(0.9, 0.45, orage));

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
float densiteNuage(vec3 p, float h, bool detaille) {
  if (h <= 0.0 || h >= 1.0) return 0.0;
  float parent, grain;
  float zone = zoneNuages(p, parent, grain);
  return densiteDansZone(p, h, detaille, zone, parent, grain);
}

// Altitude d'un point (la Terre est ronde : au loin, les nuages descendent vers l'horizon)
float altitudeDe(vec3 p) {
  return length(vec3(p.x, p.y + RAYON_TERRE, p.z)) - RAYON_TERRE;
}

// Part de la lumière d'un nuage situé à la distance t qui nous parvient à travers la brume : celle
// des basses couches (1,5 km), avec la visibilité du jeu — comme pour le front (glsl/front.js)
float voileNuages(float t) { return exp(-3.0 * t * min(1.0, 1500.0 / max(uBaseNuages, 1.0)) / max(uVisibiliteAir, 2000.0)); }

// Lumière qui arrive en un point du nuage depuis un astre (direction l) : on mesure
// l'épaisseur de nuage à traverser avec quelques pas vers lui.
float epaisseurVers(vec3 p, vec3 l) {
  float somme = 0.0;
  float pas = 40.0;
  float t = 0.0;
  for (int j = 0; j < 5; j++) {
    t += pas;
    vec3 q = p + l * t;
    float h = (altitudeDe(q) - uBaseNuages) / uEpaisseurNuages;
    somme += densiteNuage(q, h, j < 2) * pas;
    pas *= 2.1;
  }
  return somme;
}

// L'épaisseur de nuage entre un point et la lueur de l'aube (direction l) : trois pas, sans le
// détail (elle vient d'une grande part du ciel : ses ombres sont douces)
float epaisseurVersLueur(vec3 p, vec3 l) {
  float somme = 0.0;
  float pas = 60.0;
  float t = 0.0;
  for (int j = 0; j < 3; j++) {
    t += pas;
    vec3 q = p + l * t;
    float h = (altitudeDe(q) - uBaseNuages) / uEpaisseurNuages;
    somme += densiteNuage(q, h, false) * pas;
    pas *= 2.5;
  }
  return somme;
}

// L'épaisseur de nuage entre un point et l'éclair (direction l) : trois pas, sans le détail
// (sa lumière se diffuse dans le nuage : la forme d'ensemble suffit)
float epaisseurVersEclair(vec3 p, vec3 l) {
  float somme = 0.0;
  float pas = 120.0;
  float t = 0.0;
  for (int j = 0; j < 3; j++) {
    t += pas;
    vec3 q = p + l * t;
    float h = (altitudeDe(q) - uBaseNuages) / uEpaisseurNuages;
    somme += densiteNuage(q, h, false) * pas;
    pas *= 2.6;
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

// Le pas de la marche (m) à la distance t : fin près de nous (un nuage proche est grand à
// l'écran : son bord doit être net), plus long au loin (il n'y fait que quelques pixels) ; plus
// long dans l'orage (sa base déchiquetée n'a pas de bord net, et on ne la voit qu'à l'éclair)
float pasNuages(float t) { return clamp(t * 0.025, 60.0, 800.0) * mix(1.0, 1.7, uOrage); }

// Le haut utile de la couche (0 → 1) : au-dessus, le profil vertical ne laisse plus passer aucun
// nuage, même là où le bruit est au plus fort — par beau temps, ils n'en occupent que le bas
// (au-dessus d'un grain ou d'une trombe, toute la couche)
float hautUtileNuages() {
  bool tours = uTrombeCiel.w > 0.0 || uCarteGrainsCentre.z > 0.0;
  float seuilMin = tours ? 0.06 : mix(0.42, 0.05, smoothstep(0.7, 1.0, uCouverture));
  float exposant = mix(0.9, 0.45, tours ? 1.0 : uOrage);
  return clamp(1.03 - pow(seuilMin, 1.0 / exposant), 0.05, 1.0);
}

// Les nuages vus depuis « origine » (m) dans la direction d.
// Renvoie la lumière renvoyée (rgb) et l'opacité (a).
// On avance à grands pas dans l'air libre, en ne regardant que la forme des nuages (pas
// cher) ; dès qu'on touche un nuage, on revient un peu en arrière et on le traverse à petits
// pas, avec son détail et sa lumière ; ressorti (quelques pas vides), on reprend les grands
// pas. (Avec un pas unique de 250 à 450 m, comme avant, le bord d'un nuage tombait entre
// deux pas : les nuages proches étaient flous, et les lointains, des briques.)
vec4 nuagesVolume(vec3 origine, vec3 d, int pasMax, float decalage) {
  if (d.y < -0.01) return vec4(0.0);
  vec3 o = vec3(0.0, RAYON_TERRE + origine.y, 0.0);
  float tEntree = traverserSphere(o, d, RAYON_TERRE + uBaseNuages).y;
  float tSortie = traverserSphere(o, d, RAYON_TERRE + uBaseNuages + uEpaisseurNuages * hautUtileNuages()).y;
  if (tEntree > 160000.0) return vec4(0.0);
  float tFin = tEntree + min(tSortie - tEntree, mix(14000.0, 20000.0, uOrage));
  float t = tEntree + pasNuages(tEntree) * decalage;

  float cosSoleil = dot(d, uDirSoleil);
  float cosLune = dot(d, uDirLune);
  // extinction (par mètre, pour une densité de 1) : un cumulus devient opaque en quelques
  // dizaines de mètres — son bord est net
  float extinctionParDensite = mix(0.05, 0.06, uOrage);

  vec3 lumiere = vec3(0.0);
  float transmission = 1.0;
  bool dedans = false;
  int vides = 0;
  // (la nuit noire, sans éclair, on ne voit pas les nuages : seule compte leur opacité, qui cache
  // les étoiles — on les traverse à grands pas, sans s'attarder sur leur bord)
  bool econome = uNuitNoire > 0.75 && uEclairA.w <= 0.0;
  for (int i = 0; i < 96; i++) {
    if (i >= pasMax || transmission < 0.01 || t > tFin) break;
    float grand = pasNuages(t);
    vec3 p = origine + d * t;
    float h = (altitudeDe(p) - uBaseNuages) / uEpaisseurNuages;
    if (!dedans) {
      float parent, grain;
      float zone = zoneNuages(p, parent, grain);
      if (zone <= 0.0) {
        // (hors de toute zone nuageuse, pas un nuage à des centaines de mètres : on saute)
        t += grand * 2.0;
      } else if (densiteDansZone(p, h, false, zone, parent, grain) > 0.0) {
        dedans = true;
        vides = 0;
        // (le bord était entre ce pas et le précédent)
        t = max(tEntree, t - grand * 0.8);
      } else t += grand;
      continue;
    }
    float fin = econome ? grand * 2.0 : grand * mix(0.25, 0.4, uOrage);
    float ds = fin;
    float dens = densiteNuage(p, h, true);
    if (dens <= 0.002) {
      if (++vides >= 4) dedans = false;
    } else {
      vides = 0;
      float sigma = dens * extinctionParDensite;
      // (une fois son bord passé — on n'y voit déjà plus qu'à moitié —, chaque pas traverse à
      // peu près autant de nuage : au cœur d'un plafond d'orage, pas besoin de cent petits pas
      // pour savoir qu'il est opaque ; le bord, lui, garde ses petits pas : il reste net)
      if (!econome && transmission < 0.6) ds = clamp(0.45 / max(sigma, 1e-4), fin, grand * 0.75);
      // éclairage : soleil, lune, ciel au-dessus, mer en dessous, éclairs
      vec3 lum = vec3(0.0);
      if (max(uSoleilNuages.r, uSoleilNuages.g) > 0.001)
        lum += lumiereAstre(epaisseurVers(p, uDirSoleil) * extinctionParDensite, cosSoleil, uSoleilNuages);
      if (max(uLuneNuages.r, uLuneNuages.b) > 0.0005)
        lum += lumiereAstre(epaisseurVers(p, uDirLune) * extinctionParDensite, cosLune, uLuneNuages);
      // avant le lever (et après le coucher), la lueur de l'horizon, du côté du soleil caché : le
      // flanc du nuage tourné vers elle s'éclaire, ses bords minces s'allument à contre-jour (elle
      // vient d'une grande part du ciel : ses ombres sont douces)
      if (max(uLueurAube.r, uLueurAube.g) > 0.0005)
        lum += lumiereAstre(epaisseurVersLueur(p, uDirLueur) * extinctionParDensite * 0.5, dot(d, uDirLueur), uLueurAube);
      // « poudre » : les bords fins d'un nuage sont plus sombres que son cœur vu de face
      float poudre = 1.0 - exp(-dens * 6.0);
      lum *= mix(1.0, poudre, 0.4);
      // lumière du ciel : le haut du nuage voit le ciel, le bas voit la mer (sombre)
      vec3 ambiance = mix(uAmbBas, uAmbHaut, smoothstep(0.0, 1.0, h)) * (1.0 - 0.35 * dens);
      lum += ambiance;
      // l'éclair : il court dans le nuage, qui s'allume de l'intérieur tout le long de son
      // trajet. Sa lumière vient du point du trajet le plus proche ; elle traverse le nuage en
      // s'y diffusant (après des dizaines de rebonds dans les gouttes, il en ressort encore
      // une bonne part, de tous côtés : le nuage s'allume comme un abat-jour) ; là où il est
      // mince, elle passe tout droit (ses bords s'illuminent)
      if (uEclairA.w > 0.0) {
        vec3 ab = uEclairB.xyz - uEclairA.xyz;
        float s = clamp(dot(p - uEclairA.xyz, ab) / max(dot(ab, ab), 1.0), 0.0, 1.0);
        vec3 versEclair = uEclairA.xyz + ab * s - p;
        float r = length(versEclair);
        vec3 l = versEclair / max(r, 1.0);
#ifdef ECLAIR_SIMPLE
        // (le reflet du ciel sur la mer, flou : une épaisseur moyenne suffit)
        float traverse = 6.0 * smoothstep(0.0, 400.0, r);
#else
        float traverse = epaisseurVersEclair(p, l) * extinctionParDensite * smoothstep(0.0, 400.0, r);
#endif
        float diffuse = 1.0 / (1.0 + 0.11 * traverse);
        float droit = exp(-traverse) * phaseHG(dot(d, l), 0.6) * 4.0;
        // (comme une lampe : la lumière baisse avec le carré de la distance, au-delà de
        // quelques centaines de mètres)
        float portee = r / uEclairB.w;
        lum += vec3(0.75, 0.82, 1.0) * uEclairA.w / (1.0 + portee * portee) * (diffuse + droit) * 4.0;
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
