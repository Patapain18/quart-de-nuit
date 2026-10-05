// L'atmosphère en GLSL : le même calcul que monde/atmosphere.js, mais fait par la carte
// graphique pour chaque pixel du ciel (voir les explications dans ce fichier-là).

export const GLSL_ATMOSPHERE = /* glsl */ `
const float PI = 3.14159265359;
const float RAYON_TERRE = 6360e3;
const float RAYON_ATMO = 6460e3;
const vec3 BETA_RAYLEIGH = vec3(5.802e-6, 13.558e-6, 33.1e-6);
const float BETA_MIE = 3.996e-6;
const float EXTINCTION_MIE = 4.44e-6;
const vec3 ABSORPTION_OZONE = vec3(0.65e-6, 1.881e-6, 0.085e-6);

// Entrée et sortie d'un rayon dans une sphère centrée au centre de la Terre
vec2 traverserSphere(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float delta = b * b - c;
  if (delta < 0.0) return vec2(1e20, -1e20);
  delta = sqrt(delta);
  return vec2(-b - delta, -b + delta);
}

vec3 densitesAir(float altitude) {
  return vec3(
    exp(-altitude / 8000.0),
    exp(-altitude / 1200.0),
    max(0.0, 1.0 - abs(altitude - 25000.0) / 15000.0)
  );
}

vec3 extinction(vec3 profondeur) {
  return exp(-(BETA_RAYLEIGH * profondeur.x + EXTINCTION_MIE * profondeur.y + ABSORPTION_OZONE * profondeur.z));
}

// Transmission depuis le point p (repère centré sur la Terre) vers l'astre l
vec3 transmissionVers(vec3 p, vec3 l) {
  // Ombre de la Terre, adoucie sur ±2 km (la taille du disque solaire fait une pénombre) :
  // on regarde à quelle distance du centre de la Terre passe le rayon vers l'astre.
  float tProche = dot(-p, l);
  float ombre = 1.0;
  if (tProche > 0.0) ombre = smoothstep(0.0, 1.0, (length(p + l * tProche) - RAYON_TERRE + 2000.0) / 4000.0);
  float longueur = traverserSphere(p, l, RAYON_ATMO).y;
  float ds = longueur / 6.0;
  vec3 profondeur = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    vec3 q = p + l * (float(i) + 0.5) * ds;
    profondeur += densitesAir(length(q) - RAYON_TERRE) * ds;
  }
  return extinction(profondeur) * ombre;
}

float phaseRayleigh(float mu) { return 3.0 / (16.0 * PI) * (1.0 + mu * mu); }
float phaseMie(float mu, float g) {
  float gg = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - gg) * (1.0 + mu * mu)) / ((2.0 + gg) * pow(1.0 + gg - 2.0 * g * mu, 1.5));
}

// Couleur du ciel vue depuis le niveau de la mer dans la direction d,
// éclairée par un astre de direction l et d'intensité donnée.
vec3 couleurAtmosphere(vec3 d, vec3 l, float intensite) {
  vec3 o = vec3(0.0, RAYON_TERRE + 10.0, 0.0);
  // sous l'horizon on regarde la mer : on arrête le rayon à 30 km (brume au ras de l'eau)
  float fin = traverserSphere(o, d, RAYON_ATMO).y;
  vec2 sol = traverserSphere(o, d, RAYON_TERRE);
  if (sol.x > 0.0) fin = min(sol.x, 30000.0);
  const int PAS = 14;
  vec3 profondeur = vec3(0.0);
  vec3 sommeR = vec3(0.0);
  vec3 sommeM = vec3(0.0);
  float precedent = 0.0;
  for (int i = 0; i < PAS; i++) {
    float u = float(i + 1) / float(PAS);
    float s1 = fin * u * u;
    float ds = s1 - precedent;
    vec3 p = o + d * (precedent + ds * 0.5);
    precedent = s1;
    vec3 dens = densitesAir(length(p) - RAYON_TERRE) * ds;
    profondeur += dens;
    vec3 attenuation = transmissionVers(p, l) * extinction(profondeur);
    sommeR += attenuation * dens.x;
    sommeM += attenuation * dens.y;
  }
  float mu = dot(d, l);
  return intensite * (sommeR * BETA_RAYLEIGH * phaseRayleigh(mu) + sommeM * BETA_MIE * phaseMie(mu, 0.76));
}

// Transmission de l'atmosphère depuis le niveau de la mer dans la direction d
// (pour le disque du soleil et de la lune)
vec3 transmissionDepuisMer(vec3 d) {
  return transmissionVers(vec3(0.0, RAYON_TERRE + 2.0, 0.0), d);
}
`;
