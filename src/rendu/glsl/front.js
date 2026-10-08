// Le front orageux : un mur de cumulonimbus à l'horizon, du côté d'où vient le mauvais
// temps, qui monte dans le ciel à mesure qu'il approche.
//
// Il est loin (de 20 à 120 km) : à cette distance, il n'a plus de relief visible quand on
// bouge, alors on le peint directement dans le ciel, selon la direction du regard (son
// azimut et sa hauteur au-dessus de l'horizon), comme un décor de théâtre :
//  - une silhouette de tours qui bourgeonnent, plus hautes au milieu du front ;
//  - au milieu, l'enclume : les tours butent contre le plafond de l'atmosphère (vers
//    11 km) et s'y étalent en un toit de glace qui s'avance loin devant le front, vers
//    nous ; on le voit par en dessous, de plus en plus haut dans le ciel à mesure qu'il
//    s'approche, jusqu'à son bord effiloché ;
//  - un pied noir jusqu'à l'horizon, strié de rideaux de pluie ;
//  - la lumière du soleil couchant sur ses sommets (dorés s'il est derrière nous, un
//    liseré lumineux s'il est derrière le front) ; le soleil couché pour nous l'est plus
//    tard pour eux : l'enclume, à 10 km, rougeoie encore quelques minutes, éclairée par
//    en dessous ; et des éclairs dedans, à la nuit tombée.
//
// La même fonction sert au fond du ciel (en détail), au cube des reflets et à la brume
// de l'horizon sur la mer (en simplifié). Le bruit 3D (celui des nuages) est passé par
// son nom : chaque shader l'appelle à sa façon.

export function glslFront(bruit) {
  return /* glsl */ `
uniform vec4 uFront;          // azimut du centre (rad, sens compas), demi-largeur (rad), hauteur des sommets au centre (rad), visibilité
uniform vec4 uFrontEnclume;   // avancée de l'enclume (part de la distance du front), distance du front (km), hauteur de l'ombre de la Terre (part de celle des sommets)
uniform vec4 uFrontEclair;    // un éclair dedans : azimut, hauteur (rad), rayon (rad), intensité
uniform vec3 uFrontAmbiance;  // la lumière du ciel qui l'éclaire
uniform vec3 uFrontSoleil;    // la lumière du soleil sur le bas de ses tours (à 2 km d'altitude)
uniform vec3 uFrontSoleilHaut; // et sur leurs sommets et l'enclume (à 10 km : elle y arrive encore quand le soleil s'est couché pour nous)
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

// L'enclume. Arrivées au plafond de l'atmosphère (vers 11 km), les tours du milieu s'y
// étalent en un toit de glace, devant le front, vers nous, en éventail : plus il s'avance,
// plus il déborde de part et d'autre des tours qui le portent (surtout d'un côté : le vent
// d'altitude l'emporte). On le voit par en dessous : contre les tours, son dessous est un
// peu plus bas que leurs sommets (elles s'y enfoncent) ; plus il s'avance, plus il est
// proche, donc haut dans le ciel, et plus il est mince ; son bord, droit (le « toit
// plat »), s'effiloche à peine. On le peint comme le reste du front, selon la direction
// du regard : on retrouve le point de son dessous qu'on regarde. (Son bord est une ligne
// droite, pas un arc autour de nous : sur les côtés, plus loin, il paraît plus bas. On
// compte donc les distances droit devant, vers le milieu du front.)
struct Enclume {
  float densite; // 0 → 1
  float avance;  // la part de son avancée là où on regarde : 0 contre les tours, 1 à son bord
  float tranche; // 1 sur la tranche de son bord (0 dessous)
  float mince;   // là où elle s'amincit, vers ses bords (0 → 1)
  float voile;   // ses grandes nuances, plus ou moins épaisses (0 → 1)
  float bosses;  // les bosses de son dessous (0 → 1)
  float relief;  // ces bosses, plus claires du côté du soleil (0 → 1)
};
const float DESSOUS_ENCLUME = 0.9; // (son dessous contre les tours : part de la hauteur des sommets)
const float DESSOUS_BORD = 0.95;   // (et à son bord : elle s'amincit)
// (sa demi-largeur, en part de la distance du front : contre les tours, puis à son bord,
// de chaque côté)
const vec3 LARGEUR_ENCLUME = vec3(0.3, 0.42, 0.6);
Enclume enclumeFront(float da, float el, float detail, float coteSoleil) {
  Enclume en = Enclume(0.0, 0.0, 0.0, 0.0, 0.5, 0.5, 0.5);
  float km = uFrontEnclume.y;
  // (q : la hauteur où l'on regarde, rapportée à celle des sommets au-dessus des tours,
  // pour un regard droit devant ; de côté, à hauteur égale, le point est plus loin)
  float tanDa = tan(clamp(da, -1.37, 1.37));
  float q = tan(max(el, 1e-4)) / (tan(uFront.z) * max(cos(da), 0.2));
  // son avancée (son bord ondule à peine)
  float feston = texture(${bruit}, vec3(tanDa * km / 70.0, 0.31, 0.57)).g;
  float e = uFrontEnclume.x * (0.92 + 0.16 * feston);
  float qHaut = 1.0 / (1.0 - e); // le dessus de son bord
  if (q < DESSOUS_ENCLUME - 0.2 || q > qHaut) return en;
  float qBord = DESSOUS_BORD / (1.0 - e); // le dessous de son bord
  // là où le regard rencontre son dessous, qui monte en s'avançant (à la part w de son
  // avancée, q (1 - e w) = kb + (kbBord - kb) w ; sous ce dessous, là où elle sort des
  // tours, on prolonge : son motif continue) ; X : à combien de km du milieu, le long du
  // front
  float wBrut = (q - DESSOUS_ENCLUME) / (q * e + DESSOUS_BORD - DESSOUS_ENCLUME);
  float w = clamp(wBrut, 0.0, 1.0);
  float X = tanDa * km * (1.0 - e * w);
  en.avance = w;
  // sa largeur, en éventail (un peu décalée)
  float ecart = X / km - 0.07;
  float lat = abs(ecart) / mix(LARGEUR_ENCLUME.x, ecart > 0.0 ? LARGEUR_ENCLUME.z : LARGEUR_ENCLUME.y, pow(w, 0.6));
  if (lat > 1.15) return en;
  en.tranche = smoothstep(qBord - 0.006, qBord + 0.006, q);
  // ses motifs : en travers, en km ; en profondeur, en part de son avancée (vue de loin,
  // la perspective l'écrase : un motif en km y deviendrait des rayures)
  vec2 m = vec2(X, wBrut * 30.0);
  // ses grandes nuances, et ses fibres de glace, étirées dans le sens où elle s'étale
  // (vers nous) : on ne les devine qu'à ses bords
  en.voile = texture(${bruit}, vec3(m.x / 14.0, m.y / 22.0, 0.81)).g;
  float fibres = texture(${bruit}, vec3(m.x / 9.0, m.y / 30.0 + 0.4, 0.71)).g;
  // les bosses de son dessous, contre les tours (les « mamelles » des enclumes d'orage) ;
  // celles qui regardent le soleil (de son côté, et vers le bord, d'où vient sa lumière
  // quand il est bas) sont plus claires
  vec3 pb = vec3(m.x / 10.0, m.y / 9.0, 0.43);
  float bosses = texture(${bruit}, pb).g;
  en.bosses = mix(bosses, 0.5, smoothstep(0.1, 0.6, w));
  if (detail > 0.5) {
    float voisine = texture(${bruit}, pb + vec3(0.05 * coteSoleil, 0.05, 0.0)).g;
    en.relief = mix(clamp(0.5 + (voisine - bosses) * 2.0, 0.0, 1.0), 0.5, smoothstep(0.1, 0.6, w));
  }
  // (là où elle sort des tours, son dessous est festonné, pas tiré au cordeau)
  float festonBas = texture(${bruit}, vec3(m.x / 9.0, 0.17, 0.63)).g;
  // sa densité : pleine contre les tours (son dessous y est bosselé), puis de plus en plus
  // mince vers son bord, qui s'effiloche à peine vers le haut, et vers ses côtés
  float plein = 1.0 - 0.45 * smoothstep(0.6, 1.0, w + (fibres - 0.5) * 0.12);
  float v = (q - qBord) / max(qHaut - qBord, 1e-4);
  plein *= 1.0 - en.tranche * smoothstep(0.25, 1.0, v + (fibres - 0.5) * 0.3);
  plein *= 1.0 - smoothstep(0.7, 1.08, lat + (fibres - 0.5) * 0.12);
  en.mince = 1.0 - plein;
  float bosse = (festonBas - 0.5) * 0.12 + (bosses - 0.5) * 0.05 * (1.0 - w);
  en.densite = clamp(smoothstep(DESSOUS_ENCLUME - 0.1, DESSOUS_ENCLUME - 0.02, q + bosse) * plein, 0.0, 1.0);
  return en;
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
  // (le plus haut : le bord de l'enclume)
  float elMax = atan(tan(H) / (1.0 - uFrontEnclume.x * 1.1));
  if (ax > 1.0 || el > elMax) return vec4(0.0);

  // ---- la forme ----
  // les tours
  vec2 q = vec2(da, el) / H;
  float boules = 0.5;
  float haut = 0.0;
  float tour = 0.0;
  if (el < H * 1.12) {
    // les bourgeonnements du bord : des boules qui gonflent, de plus en plus petites
    boules = texture(${bruit}, vec3(q * 0.75, 0.37)).r;
    if (detail > 0.5) {
      boules = boules * 0.6 + texture(${bruit}, vec3(q * 2.1, 0.83)).r * 0.27 + texture(${bruit}, vec3(q * 5.8, 0.09)).r * 0.13;
    }
    float tours = toursFront(da);
    float bords = min(1.0, tours / (H * 0.25)); // (pas de bosses là où le front n'est plus qu'un fil)
    haut = tours + H * 0.22 * (boules - 0.5) * bords;
    // (sous l'enclume, elles montent jusque dedans, sans creux : pas de jour entre les deux)
    haut = max(haut, H * (1.15 * (1.0 - smoothstep(0.1, 0.3, abs(x - 0.06))) + 0.2 * (boules - 0.5)));
    tour = smoothstep(0.0, H * 0.04, haut - el);
  }
  // l'enclume, devant leurs sommets
  vec3 sh = normalize(vec3(uFrontDirSoleil.x, 0.0, uFrontDirSoleil.z) + 1e-5);
  vec3 droite = vec3(cos(uFront.x), 0.0, sin(uFront.x));
  Enclume en = enclumeFront(da, el, detail, dot(sh, droite));
  float plein = 1.0 - (1.0 - tour) * (1.0 - en.densite);
  float a = plein;
  // (dans la brume de la mer et dans ses reflets, son bord s'estompe : sinon, vue d'un peu
  // haut, la mer changerait de couleur d'un coup, le long d'une ligne droite)
  if (detail < 0.5) a *= 1.0 - smoothstep(0.55, 1.0, ax);
  if (a < 0.002) return vec4(0.0);

  // ---- la lumière ----
  vec3 dh = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
  float face = clamp(dot(-dh, sh) * 0.6 + 0.4, 0.0, 1.0);
  float contreJour = pow(max(dot(d, uFrontDirSoleil), 0.0), 8.0);
  // le soleil, à la hauteur où l'on regarde (rapportée à celle des sommets) : là-haut, il
  // traverse moins d'air ; sous l'ombre de la Terre (le soleil couché pour eux aussi),
  // plus rien
  float qh = tan(max(el, 0.0)) / tan(H);
  vec3 soleilIci = mix(uFrontSoleil, uFrontSoleilHaut, smoothstep(0.25, 0.95, qh)) * smoothstep(uFrontEnclume.z - 0.05, uFrontEnclume.z + 0.05, qh);
  // (le soleil bas passe sous l'enclume ; plus haut, elle fait de l'ombre au haut des tours
  // qui la portent)
  float rasant = 1.0 - smoothstep(-0.01, 0.04, uFrontDirSoleil.y);
  float sousEnclume = (1.0 - smoothstep(0.22, 0.4, abs(tan(clamp(da, -1.37, 1.37)) - 0.07))) * smoothstep(0.45, 0.8, qh);
  soleilIci *= 1.0 - 0.85 * sousEnclume * (1.0 - rasant);

  // les tours
  vec3 couleurTour = vec3(0.0);
  float dessus = 0.5;
  float hRel = clamp(el / max(haut, 1e-4), 0.0, 1.0); // 0 au pied, 1 au sommet
  if (tour > 0.0) {
    // le cœur et le pied sont noirs (des kilomètres de nuage au-dessus) ; le haut, gris
    // bleu (gris ardoise : la lumière du ciel bleu, diffusée dans le nuage)
    vec3 c = uFrontAmbiance * vec3(0.76, 0.9, 1.2) * mix(0.04, 0.2, pow(hRel, 1.8));
    // le modelé « chou-fleur » : chaque boule est plus claire sur le dessus (elle voit le
    // ciel) et sombre dessous, là où elle s'appuie sur la suivante
    if (detail > 0.5) {
      float sous = texture(${bruit}, vec3((q - vec2(0.0, 0.045)) * 0.75, 0.37)).r * 0.7 + texture(${bruit}, vec3((q - vec2(0.0, 0.016)) * 2.1, 0.83)).r * 0.3;
      float ici = texture(${bruit}, vec3(q * 0.75, 0.37)).r * 0.7 + texture(${bruit}, vec3(q * 2.1, 0.83)).r * 0.3;
      dessus = clamp(0.5 + (sous - ici) * 5.0, 0.0, 1.0);
    }
    c *= mix(0.5, 1.6, dessus) * (0.8 + 0.4 * boules);
    // les rideaux de pluie : des stries verticales un peu plus claires sous le nuage
    float pluie = texture(${bruit}, vec3(da * 7.0 / H, el * 0.6 / H, 0.44)).g;
    c += uFrontAmbiance * 0.035 * smoothstep(0.35, 0.75, pluie) * (1.0 - smoothstep(0.04, 0.25, hRel));
    // le soleil : surtout sur la face qu'il voit (s'il est derrière nous), et sur les
    // sommets (soleil bas : seul le haut des tours est au soleil ; couché, seul le haut de
    // l'enclume)
    float ligneOmbre = mix(0.94, 0.4, smoothstep(-0.03, 0.3, uFrontDirSoleil.y));
    float auSoleil = smoothstep(ligneOmbre - 0.1, ligneOmbre + 0.08, hRel);
    // les boules tournées vers le soleil sont claires, celles qui lui tournent le dos, sombres
    vec2 versSoleil = normalize(vec2(ecartAngle(atan(sh.x, -sh.z), az), uFrontDirSoleil.y - el) + 1e-5);
    float relief = 0.6;
    if (detail > 0.5) {
      float plusLoin = texture(${bruit}, vec3((q + versSoleil * 0.07) * 0.75, 0.37)).r;
      relief = clamp(0.55 + (plusLoin - boules) * 3.0, 0.15, 1.0);
    }
    c += soleilIci * auSoleil * relief * mix(0.02, 0.45, face * face);
    // contre-jour : le bord mince du nuage s'allume quand le soleil est juste derrière
    float mince = (1.0 - smoothstep(0.0, 0.6, tour)) + 0.4 * (1.0 - smoothstep(0.0, H * 0.04, abs(el - haut)));
    c += soleilIci * mince * contreJour * 1.2;
    // (et tous ses bords, minces, s'éclaircissent un peu du ciel qui est derrière)
    c += uFrontAmbiance * mince * 0.08;
    couleurTour = c;
  }

  // l'enclume
  vec3 couleurEnclume = vec3(0.0);
  if (en.densite > 0.0) {
    // son dessous ne voit que la mer et le bas du ciel : gris contre les tours, où elle
    // est épaisse, plus clair vers son bord, plus mince ; ses bosses sont claires dessous
    // et sombres dans leurs creux
    vec3 gris = uFrontAmbiance * vec3(0.78, 0.9, 1.15) * mix(0.7, 1.3, en.bosses) * (0.88 + 0.24 * en.voile);
    // le soleil couché pour nous ne l'est pas pour elle, à 10 km : il l'éclaire par en
    // dessous, en rasant (surtout les bosses qui le regardent), sauf s'il est derrière le
    // front (les tours lui font de l'ombre). Il entre sous l'enclume par le côté où il est
    // et par son bord : c'est là qu'elle rougeoie le plus
    vec3 versFront = vec3(sin(uFront.x), 0.0, -cos(uFront.x));
    float libre = 1.0 - smoothstep(0.3, 0.85, dot(sh, versFront));
    float cote = clamp(0.5 + 0.8 * x * dot(sh, droite), 0.0, 1.0);
    vec3 dessous = uFrontSoleilHaut * rasant * libre * mix(0.35, 1.0, cote) * mix(0.5, 1.0, en.avance) * (0.012 + 0.025 * en.relief) * (0.75 + 0.5 * en.voile);
    vec3 c = gris * mix(0.13, 0.3, en.avance) + dessous;
    // le soleil haut : un peu de sa lumière traverse son bord, mince ; sa tranche est au
    // soleil s'il est derrière nous ; à contre-jour, ses bords s'allument
    c += uFrontSoleilHaut * (1.0 - rasant) * (en.mince * 0.02 + en.tranche * face * face * 0.05);
    c += uFrontSoleilHaut * en.mince * contreJour * 0.25;
    couleurEnclume = c;
  }
  // (l'enclume passe devant le haut des tours)
  vec3 couleur = (couleurEnclume * en.densite + couleurTour * tour * (1.0 - en.densite)) / max(plein, 1e-4);

  // un éclair dedans : il illumine une boule du nuage, de l'intérieur
  if (uFrontEclair.w > 0.0) {
    // (une tache irrégulière : la lumière passe par les boules les plus minces)
    float grain = mix(boules, en.bosses, en.densite);
    vec2 e = vec2(ecartAngle(az, uFrontEclair.x), el - uFrontEclair.y) / uFrontEclair.z;
    e += (vec2(grain, dessus) - 0.5) * 0.9;
    float lueur = exp(-dot(e, e) * 0.8) * (0.25 + 1.6 * grain * grain) * (0.5 + dessus);
    couleur += vec3(0.62, 0.7, 1.0) * uFrontEclair.w * (lueur * 0.25 + 0.03 * plein) * (0.5 + 0.5 * min(qh, 1.0));
  }
  // au loin, un voile d'air bleuté : à 40 km, l'air entre lui et nous éclaircit ses noirs
  // (pris au ciel, mais sans son éclat du couchant : sous l'orage, l'air est à l'ombre)
  float brume = clamp(0.62 - H * 1.2, 0.15, 0.55) * (1.0 - 0.3 * en.avance * en.densite);
  couleur = mix(couleur, min(ciel * 0.6, uFrontAmbiance * vec3(0.4, 0.45, 0.55)), brume);
  return vec4(couleur, a * uFront.w);
}
`;
}
