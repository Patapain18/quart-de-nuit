// Le front orageux : un mur de cumulonimbus à l'horizon, du côté d'où vient le mauvais
// temps, qui monte dans le ciel à mesure qu'il approche.
//
// Il est loin (de 20 à 120 km) : à cette distance, il n'a plus de relief visible quand on
// bouge, alors on le peint directement dans le ciel, selon la direction du regard (son
// azimut et sa hauteur au-dessus de l'horizon), comme un décor de théâtre :
//  - une silhouette de tours qui bourgeonnent, plus hautes au milieu du front ;
//  - au milieu, l'enclume : les tours butent contre le plafond de l'atmosphère (vers
//    11 km) et s'étalent en un toit plat, effiloché par-dessous ;
//  - un pied noir jusqu'à l'horizon, strié de rideaux de pluie ;
//  - la lumière du soleil couchant sur ses sommets (dorés s'il est derrière nous, un
//    liseré lumineux s'il est derrière le front), et des éclairs dedans, à la nuit tombée.
//
// La même fonction sert au fond du ciel (en détail), au cube des reflets et à la brume
// de l'horizon sur la mer (en simplifié). Le bruit 3D (celui des nuages) est passé par
// son nom : chaque shader l'appelle à sa façon.

export function glslFront(bruit) {
  return /* glsl */ `
uniform vec4 uFront;          // azimut du centre (rad, sens compas), demi-largeur (rad), hauteur des sommets au centre (rad), visibilité
uniform vec4 uFrontEclair;    // un éclair dedans : azimut, hauteur (rad), rayon (rad), intensité
uniform vec3 uFrontAmbiance;  // la lumière du ciel qui l'éclaire
uniform vec3 uFrontSoleil;    // la lumière du soleil sur ses sommets
uniform vec3 uFrontDirSoleil; // d'où vient cette lumière

float ecartAngle(float a, float b) { return mod(a - b + 9.42477796, 6.28318531) - 3.14159265; }

// La hauteur (rad) du haut des tours, à l'écart « da » du centre du front : une dizaine de
// cellules d'orage, des colonnes aux flancs raides et au sommet arrondi, plus hautes au
// milieu (celle du centre est la plus haute : c'est elle qui porte l'enclume), sur un
// socle continu plus bas.
float toursFront(float da) {
  float L = uFront.y;
  float H = uFront.z;
  float x = da / L;
  // (sous l'enclume, une masse commune : on ne voit pas le ciel entre les tours)
  float socle = H * (0.25 + 0.4 * (1.0 - smoothstep(0.15, 0.6, abs(x)))) * pow(max(0.0, 1.0 - x * x), 0.8) * (1.0 - smoothstep(0.75, 1.0, abs(x)));
  float h = socle;
  for (int k = 0; k < 11; k++) {
    float fk = float(k);
    vec3 r = fract(sin(vec3(fk * 12.9898 + 1.3, fk * 78.233 + 4.1, fk * 37.719 + 7.7)) * 43758.5453);
    float xc = (fk / 10.0) * 1.7 - 0.85 + (r.x - 0.5) * 0.12;
    float enveloppe = pow(max(0.0, 1.0 - xc * xc), 0.7);
    // (les trois du milieu montent jusqu'au plafond : elles portent l'enclume)
    bool porteuse = k >= 4 && k <= 6;
    float hk = k == 5 ? H : porteuse ? H * (0.93 + 0.05 * r.y) : H * enveloppe * (0.5 + 0.42 * r.y);
    float wk = H * (porteuse ? 0.32 + 0.12 * r.z : 0.26 + 0.24 * r.z) + hk * 0.3;
    float u = abs(da - xc * L) / wk;
    if (u < 1.0) h = max(h, hk * pow(1.0 - pow(u, 2.2), 0.55));
  }
  return h;
}

// Le front dans la direction d : sa couleur et son opacité. « ciel » : la couleur du ciel
// derrière lui (au loin, la brume l'y fond un peu) ; detail : 1 en plein écran, 0 sinon.
vec4 frontOrage(vec3 d, vec3 ciel, float detail) {
  if (uFront.w < 0.003) return vec4(0.0);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float H = uFront.z;
  float da = ecartAngle(az, uFront.x);
  float x = da / uFront.y;
  float ax = abs(x);
  if (ax > 1.0 || el > H * 1.12) return vec4(0.0);

  // ---- la forme ----
  vec2 q = vec2(da, el) / H;
  // les bourgeonnements du bord : des boules qui gonflent, de plus en plus petites
  float boules = texture(${bruit}, vec3(q * 0.75, 0.37)).r;
  if (detail > 0.5) {
    boules = boules * 0.6 + texture(${bruit}, vec3(q * 2.1, 0.83)).r * 0.27 + texture(${bruit}, vec3(q * 5.8, 0.09)).r * 0.13;
  }
  float tours = toursFront(da);
  float bords = min(1.0, tours / (H * 0.25)); // (pas de bosses là où le front n'est plus qu'un fil)
  float haut = tours + H * 0.22 * (boules - 0.5) * bords;
  float tour = smoothstep(0.0, H * 0.04, haut - el);
  // l'enclume : les tours du milieu butent contre le plafond (vers 11 km) et s'y étalent en
  // un plateau mince qui déborde de part et d'autre, effiloché par-dessous ; sous le
  // débord, on voit le ciel
  float plafond = H * (0.99 + 0.02 * cos(x * 2.5)) + H * 0.025 * (boules - 0.5);
  float etendue = 1.0 - smoothstep(0.3, 0.52, ax);
  float fibres = texture(${bruit}, vec3(q.x * 0.5, q.y * 4.0, 0.17)).b;
  float epaisseur = H * (0.05 + 0.13 * (1.0 - smoothstep(0.05, 0.45, ax)));
  float dessous = plafond - epaisseur + H * 0.05 * (fibres - 0.5);
  float enclume = etendue * smoothstep(dessous - H * 0.03, dessous + H * 0.02, el) * (1.0 - smoothstep(plafond - H * 0.01, plafond + H * 0.006, el));
  float a = max(tour, enclume * 0.9);
  // (dans la brume de la mer et dans ses reflets, son bord s'estompe : sinon, vue d'un peu
  // haut, la mer changerait de couleur d'un coup, le long d'une ligne droite)
  if (detail < 0.5) a *= 1.0 - smoothstep(0.55, 1.0, ax);
  if (a < 0.002) return vec4(0.0);

  // ---- la lumière ----
  float sommetIci = max(haut, enclume > 0.5 ? plafond : 0.0);
  float hRel = clamp(el / max(sommetIci, 1e-4), 0.0, 1.0); // 0 au pied, 1 au sommet
  // le cœur et le pied sont noirs (des kilomètres de nuage au-dessus) ; le haut, gris bleu
  // (gris ardoise : la lumière du ciel bleu, diffusée dans le nuage)
  vec3 couleur = uFrontAmbiance * vec3(0.76, 0.9, 1.2) * mix(0.04, 0.2, pow(hRel, 1.8));
  // le modelé « chou-fleur » : chaque boule est plus claire sur le dessus (elle voit le
  // ciel) et sombre dessous, là où elle s'appuie sur la suivante
  float dessus = 0.5;
  if (detail > 0.5) {
    float sous = texture(${bruit}, vec3((q - vec2(0.0, 0.045)) * 0.75, 0.37)).r * 0.7 + texture(${bruit}, vec3((q - vec2(0.0, 0.016)) * 2.1, 0.83)).r * 0.3;
    float ici = texture(${bruit}, vec3(q * 0.75, 0.37)).r * 0.7 + texture(${bruit}, vec3(q * 2.1, 0.83)).r * 0.3;
    dessus = clamp(0.5 + (sous - ici) * 5.0, 0.0, 1.0);
  }
  couleur *= mix(0.5, 1.6, dessus) * (0.8 + 0.4 * boules);
  // les rideaux de pluie : des stries verticales un peu plus claires sous le nuage
  float pluie = texture(${bruit}, vec3(da * 7.0 / H, el * 0.6 / H, 0.44)).g;
  couleur += uFrontAmbiance * 0.035 * smoothstep(0.35, 0.75, pluie) * (1.0 - smoothstep(0.04, 0.25, hRel));
  // le soleil : surtout sur la face qu'il voit (s'il est derrière nous), et sur les sommets
  vec3 dh = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
  vec3 sh = normalize(vec3(uFrontDirSoleil.x, 0.0, uFrontDirSoleil.z) + 1e-5);
  float face = clamp(dot(-dh, sh) * 0.6 + 0.4, 0.0, 1.0);
  // (soleil bas : seul le haut des tours est au soleil ; couché, seul le haut de l'enclume)
  float ligneOmbre = mix(0.94, 0.4, smoothstep(-0.03, 0.3, uFrontDirSoleil.y));
  float auSoleil = smoothstep(ligneOmbre - 0.1, ligneOmbre + 0.08, hRel);
  // les boules tournées vers le soleil sont claires, celles qui lui tournent le dos, sombres
  vec2 versSoleil = normalize(vec2(ecartAngle(atan(sh.x, -sh.z), az), uFrontDirSoleil.y - el) + 1e-5);
  float relief = 0.6;
  if (detail > 0.5) {
    float plusLoin = texture(${bruit}, vec3((q + versSoleil * 0.07) * 0.75, 0.37)).r;
    relief = clamp(0.55 + (plusLoin - boules) * 3.0, 0.15, 1.0);
  }
  couleur += uFrontSoleil * auSoleil * relief * mix(0.02, 0.45, face * face);
  // contre-jour : le bord mince du nuage s'allume quand le soleil est juste derrière
  float mince = (1.0 - smoothstep(0.0, 0.6, a)) + 0.4 * (1.0 - smoothstep(0.0, H * 0.04, abs(el - sommetIci)));
  couleur += uFrontSoleil * mince * pow(max(dot(d, uFrontDirSoleil), 0.0), 8.0) * 1.2;
  // (et tous ses bords, minces, s'éclaircissent un peu du ciel qui est derrière)
  couleur += uFrontAmbiance * mince * 0.08;
  // un éclair dedans : il illumine une boule du nuage, de l'intérieur
  if (uFrontEclair.w > 0.0) {
    // (une tache irrégulière : la lumière passe par les boules les plus minces)
    vec2 e = vec2(ecartAngle(az, uFrontEclair.x), el - uFrontEclair.y) / uFrontEclair.z;
    e += (vec2(boules, dessus) - 0.5) * 0.9;
    float lueur = exp(-dot(e, e) * 0.8) * (0.25 + 1.6 * boules * boules) * (0.5 + dessus);
    couleur += vec3(0.62, 0.7, 1.0) * uFrontEclair.w * (lueur * 0.25 + 0.03 * a) * (0.5 + 0.5 * hRel);
  }
  // au loin, un voile d'air bleuté : à 40 km, l'air entre lui et nous éclaircit ses noirs
  // (pris au ciel, mais sans son éclat du couchant : sous l'orage, l'air est à l'ombre)
  float brume = clamp(0.62 - H * 1.2, 0.15, 0.55);
  couleur = mix(couleur, min(ciel * 0.6, uFrontAmbiance * vec3(0.4, 0.45, 0.55)), brume);
  return vec4(couleur, a * uFront.w);
}
`;
}
