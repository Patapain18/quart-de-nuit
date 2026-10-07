// La trombe marine en volume : ce que la carte graphique calcule pour chaque pixel.
//
// Comme pour les nuages (glsl/nuages.js), on avance pas à pas le long du regard, à
// travers la trombe ; à chaque pas, on mesure combien il y a de « matière » (des
// gouttelettes : la vapeur condensée de l'entonnoir, l'eau de mer arrachée et pulvérisée,
// le nuage-mur, la pluie) et la lumière qui y arrive. On additionne ce que chaque bout de
// matière renvoie vers l'œil, en tenant compte de ce qu'il cache derrière lui.
//
// Ce qu'il y a dedans, de haut en bas (tout est donné dans le repère du pied de la
// trombe : x et z depuis son pied, y depuis la mer) :
//  - le nuage-mur : sous la base des nuages d'orage, une soucoupe de nuage qui s'abaisse
//    vers son centre et TOURNE (le « mésocyclone ») ; des bandes sous son ventre, des
//    lambeaux de nuage qui montent en spirale vers lui ;
//  - l'entonnoir : la vapeur qui se condense dans l'air qui tourne très vite (la pression
//    y chute). Un tube, plus opaque sur ses bords (on y regarde à travers plus de vapeur),
//    souvent creux au milieu, évasé en trompette dans le nuage-mur, courbé par le vent ;
//    sa surface est striée de bandes qui tournent et montent en hélice ;
//  - la gerbe d'embruns : au pied, la mer arrachée. Une gaine d'eau pulvérisée qui monte
//    en tourbillonnant autour du cœur et s'ouvre en haut, une jupe jetée vers l'extérieur,
//    au ras de l'eau, et un « œil » plus clair au centre ;
//  - parfois un rideau de pluie qui l'enveloppe à demi, et des trombes sœurs.
//
// Tout bouge comme l'air : le motif (du bruit 3D, le même que celui des nuages) est lu
// dans un repère qui tourne avec le tourbillon (vite près du cœur, lentement au loin :
// le tourbillon de Rankine) et qui monte avec l'air. Pour que le motif ne s'enroule pas
// sans fin, deux motifs vivent chacun quelques secondes, l'un apparaissant pendant que
// l'autre s'efface — comme la condensation, qui se forme et s'évapore sans cesse.
//
// Besoin de : GLSL_OUTILS (saturer, phaseHG), GLSL_CARTE_CIEL et glslFront (la brume de
// l'horizon, la même que celle de la mer), PI.

export const GLSL_TROMBE = /* glsl */ `
uniform float uT;          // l'horloge (s)
uniform vec2 uVent;        // la direction où va le vent (unitaire, dans le plan x-z)
uniform vec4 uEnt;         // l'entonnoir : rayon au pied, au milieu, en haut (m), hauteur où il entre dans le nuage-mur
uniform vec4 uEnt2;        // hauteur de sa pointe (la condensation s'arrête là), creux (0 : plein, 1 : creux), netteté du bord, effilochage
uniform vec4 uEnt3;        // stries, torsion de l'hélice (rad/m), rotation au pied (rad/s), montée (m/s)
uniform vec4 uEnt4;        // opacité (0 → 1), poids du détail fin, force de la gerbe d'embruns (0 → 1), 0
uniform vec4 uAxe;         // inclinaison (m, au sommet), ondulations (m), leur vitesse, corde (0 → 1 : la fin)
uniform vec4 uMur;         // le nuage-mur : rayon (m), abaissement au centre (m), densité, base des nuages (m)
uniform vec4 uMur2;        // sa rotation (rad/s au bord de son cœur), lambeaux, bandes, rayon du nuage parent (m)
uniform vec4 uEmb;         // la gerbe : rayon du cœur (m), hauteur de la gaine (m), densité, rayon de la jupe (× cœur)
uniform vec4 uEmb2;        // rotation au bord du cœur (rad/s), montée (m/s), bouillonnement, plancton
uniform vec4 uRideau;      // la pluie : direction (rad), demi-ouverture (rad), rayon (m), densité
uniform vec4 uSoeur0;      // les trombes sœurs : décalage x, z (m), taille (× la grande), descente (0 → 1)
uniform vec4 uSoeur1;
uniform vec4 uExt;         // extinction (par mètre, pour une densité 1) : entonnoir, embruns, nuage-mur, pluie
uniform vec4 uTeinte;      // la couleur de la vapeur de l'entonnoir (rgb), noirceur du nuage-mur (0 → 1)
uniform vec4 uCentreMur;   // le centre du nuage-mur (x, z : au-dessus du haut de l'entonnoir), écart maximal de l'axe (m), 0
uniform vec4 uCoeurBas;    // les boîtes (des cylindres) de chaque pièce : le bas de l'entonnoir et la gerbe (centre x, z, rayon, haut)
uniform vec4 uCoeurHaut;   // le haut de l'entonnoir (centre x, z, rayon, bas) ; son haut : uEnt.w
uniform vec4 uDisque;      // le nuage-mur et ses lambeaux (centre x, z, rayon, 0)
uniform vec2 uDisqueY;     // leur bas et leur haut (m)
uniform vec4 uZonePluie;   // la boîte du rideau de pluie : centre x, z, rayon, haut (m) (rayon 0 : pas de pluie)
uniform highp sampler3D uBruitNuages;

const float TAU = 6.28318530718;
float carre(float x) { return x * x; }
vec2 tourner(vec2 q, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * q.x - s * q.y, s * q.x + c * q.y);
}

// Le bruit dans un repère qui tourne avec le tourbillon et monte avec l'air.
//   q : écart horizontal à l'axe (m) ; h : hauteur (m)
//   omega : vitesse de rotation (rad/s ; > 0 : dans le sens inverse des aiguilles d'une
//   montre, vu d'en haut, comme les tourbillons de l'hémisphère nord) ; montee (m/s)
//   torsion : les motifs suivent une hélice (rad par mètre de hauteur)
//   echelle : taille du motif (horizontale, verticale), en mètres
//   periode : la vie d'un motif (s) ; graine : pour que chaque usage ait son motif
vec4 bruitTourbillon(vec2 q, float h, float omega, float montee, float torsion, vec2 echelle, float periode, float graine) {
  float x = uT / periode + graine;
  float fa = fract(x);
  float fb = fract(x + 0.5);
  float ca = floor(x);
  float cb = floor(x + 0.5) + 0.5;
  float ta = fa * periode;
  float tb = fb * periode;
  vec2 qa = tourner(q, omega * ta + torsion * h);
  vec2 qb = tourner(q, omega * tb + torsion * h);
  vec3 pa = vec3(qa.x / echelle.x, (h - montee * ta) / echelle.y, qa.y / echelle.x) + fract(vec3(0.6180339, 0.3819660, 0.7548776) * ca) * 17.0;
  vec3 pb = vec3(qb.x / echelle.x, (h - montee * tb) / echelle.y, qb.y / echelle.x) + fract(vec3(0.6180339, 0.3819660, 0.7548776) * cb) * 17.0;
  vec4 na = texture(uBruitNuages, pa);
  vec4 nb = texture(uBruitNuages, pb);
  float wa = 1.0 - abs(2.0 * fa - 1.0);
  float wb = 1.0 - wa;
  // (le mélange de deux bruits est moins contrasté que chacun d'eux : on lui rend son contraste)
  return clamp(0.5 + ((na - 0.5) * wa + (nb - 0.5) * wb) * inversesqrt(wa * wa + wb * wb), 0.0, 1.0);
}

// Le même bruit, mais un seul motif, qui tourne d'un bloc (pour ce qui tourne lentement et
// d'un bloc, comme le nuage-mur : il ne s'enroule pas, et ça coûte deux fois moins)
vec4 bruitTourne(vec2 q, float h, float angle, float montee, vec2 echelle, float graine) {
  vec2 qt = tourner(q, angle);
  return texture(uBruitNuages, vec3(qt.x / echelle.x, (h - montee * uT) / echelle.y, qt.y / echelle.x) + graine);
}

// ---------- l'axe et le rayon de l'entonnoir ----------
// Calculés une fois par image (trombe.js, profilTrombe) pour 128 hauteurs, et rangés dans
// une petite texture (une rangée par trombe : la grande, puis ses sœurs) : l'écart de
// l'axe au pied (x, z), et le rayon. La carte graphique n'a plus qu'à les y lire.
uniform sampler2D uProfil;
vec3 profil(float h, float rangee) {
  float u = clamp(h / (uEnt.w * 1.06), 0.0, 1.0);
  return texture(uProfil, vec2(u * (127.0 / 128.0) + 0.5 / 128.0, (rangee + 0.5) / 4.0)).xyz;
}

// Ce qu'on retient d'un point de la trombe (des variables globales, remplies par
// matiere() : le programme reste petit, ce que la carte graphique préfère) : la densité de
// chaque matière, et pour l'éclairage, d'où vient la lumière du ciel (la « normale »), à
// quelle profondeur dans la matière on est (la lumière du ciel y arrive affaiblie), et
// l'épaisseur de matière vers la lumière principale (son ombre)
float gEnt;        // la vapeur de l'entonnoir
float gEmb;        // les embruns
float gMur;        // le nuage-mur (et ses lambeaux)
float gPluie;
vec3 gNormale;     // (pondérée par les densités)
float gProfondeur;
float gOmbre;
float gPas;        // le pas conseillé pour aller plus loin sans rien manquer (m)

// La direction de la lumière principale (fixée pour chaque rayon) : chaque matière sait
// à peu près combien d'elle-même la lumière traverse pour arriver jusqu'au point (une corde
// dans un cercle : l'entonnoir, la gerbe, le ventre du nuage-mur coupés à l'horizontale)
vec3 gLumiere = vec3(0.0, 1.0, 0.0);
float cordeCercle(vec2 q, float R, vec3 l) {
  float lh = length(l.xz);
  if (lh < 1e-3) return 1e4;
  vec2 dh = l.xz / lh;
  float b = dot(q, dh);
  float delta = b * b - (dot(q, q) - R * R);
  if (delta <= 0.0) return 0.0;
  return max(-b + sqrt(delta), 0.0) / lh;
}
float versLeHaut(float h, float haut, vec3 l) {
  return l.y > 0.01 ? max(haut - h, 0.0) / l.y : 1e4;
}

// ---------- l'entonnoir ----------
// centre : son pied (m, depuis le pied de la grande) ; taille (1 : la grande) ; pointe :
// hauteur où sa condensation s'arrête ; niveau : 0 grossier (pour les ombres), 1 normal,
// 2 avec le détail fin
float densiteEntonnoir(vec3 p, vec2 centre, float taille, float pointe, float rangee, int niveau) {
  float h = p.y;
  float H = uEnt.w;
  if (h < -3.0 || h > H * 1.04 || pointe >= H) return 0.0;
  vec3 pr = profil(h, rangee);
  float R = pr.z;
  float dephasage = rangee * 2.7;
  // (une première borne, sans calculer l'axe : l'axe ne s'écarte jamais de plus de
  // uCentreMur.z du pied)
  float loin = length(p.xz - centre) - (R * 1.55 + 3.0 + uCentreMur.z * taille);
  if (loin > 0.0) {
    gPas = min(gPas, max(loin * 0.8, 1.5));
    return 0.0;
  }
  vec2 c = centre + pr.xy;
  vec2 q = p.xz - c;
  // (penché, le tube coupé à l'horizontale est une ellipse : on mesure la vraie distance
  // à son axe, en raccourcissant l'écart dans le sens de la pente)
  vec2 pente = (profil(h + 6.0, rangee).xy - pr.xy) / 6.0;
  float s2 = dot(pente, pente);
  if (s2 > 1e-5) {
    vec2 ps = pente * inversesqrt(s2);
    q += ps * dot(q, ps) * (inversesqrt(1.0 + s2) - 1.0);
  }
  float r = length(q);
  // (jusqu'où son bord effiloché peut aller ; au-delà, ou sous sa pointe : rien, et on
  // peut avancer d'autant)
  float horsEnveloppe = max(r - R * (1.0 + uEnt2.w * 0.62 + uEnt2.z) - 1.0, pointe - 3.0 - h);
  if (horsEnveloppe > 0.0) {
    gPas = min(gPas, max(horsEnveloppe * 0.8, 1.0));
    return 0.0;
  }
  gPas = min(gPas, max(R * mix(0.1, 0.22, smoothstep(0.15, 0.5, abs(r / R - 1.0))), 0.8));
  // la condensation descend du nuage-mur à la naissance (sa pointe) et y remonte à la fin
  float bas = smoothstep(pointe, pointe + 10.0 + R * 2.0, h);
  // (il tourne d'autant plus vite qu'il est étroit : le moment cinétique se conserve)
  float omega = uEnt3.z * carre(uEnt.x / max(R / taille, 1.0));
  // (un motif vit 10 s : le temps de faire le tour du tube, qu'on le voie tourner)
  vec4 n = bruitTourbillon(q, h, omega, uEnt3.w, uEnt3.y, vec2(max(R, 5.0) * 1.15, 60.0 + 0.1 * H), 10.0, dephasage * 0.37);
  float rr = r / R + (n.r * 0.6 + n.g * 0.4 - 0.5) * uEnt2.w;
  if (niveau >= 2) {
    // (de fins lambeaux qui tournent plus vite et s'effilochent sur le bord)
    vec4 f = bruitTourbillon(q, h, omega * 1.35, uEnt3.w * 1.3, uEnt3.y * 1.4, vec2(max(R, 5.0) * 0.32, 18.0), 4.0, dephasage * 0.37 + 0.41);
    rr += (f.b - 0.5) * uEnt2.w * uEnt4.y;
  }
  float bord = smoothstep(1.0 + uEnt2.z, 1.0 - uEnt2.z, rr);
  float creux = mix(1.0 - uEnt2.y, 1.0, smoothstep(0.3, 0.9, rr));
  // les stries : des bandes plus claires qui montent en hélice (le motif fin, étiré le long
  // de l'hélice)
  float stries = 1.0 - uEnt3.x * smoothstep(0.35, 0.8, n.a * 0.7 + n.b * 0.3);
  float haut = 1.0 - smoothstep(0.72, 1.0, h / H);
  float d = bord * creux * stries * haut * bas * uEnt4.x;
  if (d > 0.0 && niveau > 0) {
    // (pour l'éclairage : la lumière du ciel arrive par le côté, plus ou moins enfoui)
    gNormale += vec3(q / max(r, 0.01), 0.15) * d;
    gProfondeur += max(R - r, 0.0) * mix(1.0, 0.45, uEnt2.y) * d;
    gOmbre += uExt.x * mix(0.8, 0.45, uEnt2.y) * uEnt4.x * min(cordeCercle(q, R, gLumiere), versLeHaut(h, H, gLumiere)) * d;
  }
  return d;
}

// ---------- la gerbe d'embruns ----------
// Un dôme bouillonnant d'eau pulvérisée, aussi large que haut, d'où sort l'entonnoir : plus
// haut près du cœur (la gaine, où l'eau monte en tournant), plus bas sur les bords (la
// jupe, où elle retombe), plus dense en bas ; son contour est creusé en volutes par le
// bouillonnement, comme celui d'un nuage
float densiteEmbruns(vec3 p, vec2 centre, float taille, float gerbe, float dephasage, int niveau) {
  float Rc = uEmb.x * taille;
  float Hs = uEmb.y * mix(0.25, 1.0, gerbe) * taille;
  if (gerbe <= 0.0 || Rc < 0.5) return 0.0;
  float h = p.y;
  vec2 q = p.xz - centre;
  float r = length(q);
  float Rj = Rc * uEmb.w;
  float horsEnveloppe = max(r - Rj * 1.12, h - Hs * 1.3);
  if (horsEnveloppe > 0.0) {
    gPas = min(gPas, max(horsEnveloppe * 0.8, 1.2));
    return 0.0;
  }
  gPas = min(gPas, max(Rc * 0.15, 1.2));
  // tourbillon de Rankine : tout tourne d'un bloc dans le cœur, de moins en moins vite au-delà
  float omega = uEmb2.x * Rc * Rc / max(r * r, Rc * Rc);
  // l'eau monte en tournant près du cœur ; plus loin, elle retombe
  float montee = uEmb2.y * (1.0 - smoothstep(Rc, 2.6 * Rc, r)) - 3.5 * smoothstep(1.8 * Rc, 3.5 * Rc, r);
  vec4 n = bruitTourbillon(q, h, omega, montee, 0.0, vec2(Rc * 0.75 + 6.0, Rc * 0.6 + 6.0), 3.6, dephasage * 0.37 + 0.71);
  float bouillon = n.r;
  // la hauteur du dôme à cette distance du cœur (bosselée par le bouillonnement : de grosses
  // volutes qui roulent en montant)
  float hDome = Hs * mix(1.0, 0.2, smoothstep(Rc * 0.9, Rj, r)) * (0.6 + 0.75 * bouillon + 0.3 * (n.g - 0.5));
  float forme = (1.0 - smoothstep(0.5, 1.0, max(h, 0.0) / hDome))
              * (1.0 - smoothstep(Rj * 0.55, Rj * 1.05, r + (bouillon - 0.5) * Rc * 1.2));
  // (la gaine : autour du cœur, un mur plus dense où l'eau monte)
  float rs = Rc * (1.0 + 0.6 * max(h, 0.0) / Hs);
  forme = max(forme, exp(-carre((r - rs) / (Rc * 0.55))) * (1.0 - smoothstep(0.6, 1.25, max(h, 0.0) / Hs + (bouillon - 0.5) * 0.4)));
  // plus dense en bas ; l'œil : au centre, au ras de l'eau, l'air descend, plus clair
  forme *= mix(0.6, 1.0, exp(-max(h, 0.0) / (0.3 * Hs))) * smoothstep(0.15 * Rc, 0.6 * Rc, r);
  if (forme <= 0.001) return 0.0;
  // des volutes : le bouillonnement creuse le contour (comme celui des nuages, glsl/nuages.js)
  float erosion = n.g * 0.55 + n.b * 0.45;
  if (niveau >= 2) {
    vec4 f = bruitTourbillon(q, h, omega * 1.5, montee * 1.3, 0.0, vec2(Rc * 0.22 + 2.0, Rc * 0.18 + 2.0), 2.2, dephasage * 0.37 + 0.13);
    erosion = mix(erosion, f.a, 0.45);
  }
  float creuse = (1.0 - erosion) * 0.45 + (1.0 - bouillon) * 0.3 * uEmb2.z;
  float d = saturer((forme - creuse) / max(1.0 - creuse, 0.05)) * uEmb.z * gerbe;
  if (d > 0.0 && niveau > 0) {
    float bord = Rj * (1.0 - 0.6 * smoothstep(0.0, Hs, h));
    // (au ras de l'eau, la gerbe voit l'horizon tout autour : la lumière lui vient de là)
    gNormale += vec3(q / max(r, 0.01), 0.25) * d;
    gProfondeur += (max(bord - r, 0.0) * 0.35 + max(hDome - h, 0.0) * 0.25) * d;
    gOmbre += uExt.y * 0.5 * uEmb.z * min(cordeCercle(q, bord, gLumiere), versLeHaut(h, hDome, gLumiere)) * d;
  }
  return d;
}

// ---------- le nuage-mur, et ses lambeaux ----------
float densiteMur(vec3 p, int niveau) {
  float Rw = uMur.x;
  if (Rw < 1.0 || uMur.z <= 0.0) return 0.0;
  vec2 q = p.xz - uCentreMur.xy;
  float r = length(q);
  float h = p.y;
  float Hc = uMur.w;
  // il tourne, lentement, presque d'un bloc (un tour en un peu plus d'une minute)
  float angle = uT * uMur2.x;
  float omega = uMur2.x;
  // (sa forme d'ensemble n'est pas un cercle parfait : un grand bruit, qui tourne avec lui,
  // déforme son contour et son ventre)
  float grand = texture(uBruitNuages, vec3(tourner(q, angle * 0.5) / (Rw * 2.4), 0.17)).r;
  float s = r / (Rw * (0.72 + 0.56 * grand));
  float bas = Hc - uMur.y * pow(saturer(1.0 - s * s), 1.5) * (0.7 + 0.6 * grand);
  float lambeaux = uMur2.y;
  float horsEnveloppe = max(max(s - 1.15, (bas - (lambeaux > 0.0 ? 260.0 : 90.0) - h) / Rw), (h - Hc - 70.0) / Rw) * Rw;
  if (horsEnveloppe > 0.0) {
    gPas = min(gPas, max(horsEnveloppe * 0.7, 3.0));
    return 0.0;
  }
  float d = 0.0;
  vec2 radial = q / max(r, 0.01);
  // (au-dessus de ses lambeaux : le nuage lui-même)
  if (h > bas - 95.0) {
    // (près du ventre, net, des pas courts : sinon, d'un pixel à l'autre, le premier pas
    // tombe avant ou après lui, et l'image grésille)
    gPas = min(gPas, mix(5.0, 9.0 + 0.03 * r, smoothstep(30.0, 90.0, abs(h - bas))));
    vec4 n = bruitTourne(q, h, angle, 0.6, vec2(230.0, 150.0), 0.29);
    // (sur ses flancs, des bandes en arcs de cercle, comme des assiettes empilées : le motif
    // écrasé dans le sens du rayon et en hauteur)
    vec4 b = vec4(0.5);
    if (niveau > 0) b = bruitTourne(q + radial * dot(q, radial) * uMur2.z * 2.5, h, angle, 0.4, vec2(130.0, 38.0), 0.83);
    // c'est la partie abaissée de la base des nuages : un ventre bosselé, assez net, qui
    // remonte jusqu'à la base, où il se fond dans les nuages d'orage au-dessus
    float bosses = (n.r - 0.5) * 80.0 + (b.g - 0.5) * 35.0;
    // (près du ventre, de plus petites bosses : des « mamelles » de nuage qui roulent)
    if (niveau >= 2 && abs(h - bas) < 70.0) {
      vec4 f = bruitTourne(q, h, angle * 1.3, 1.5, vec2(55.0, 26.0), 0.61);
      bosses += (f.r - 0.5) * 34.0;
    }
    float dessous = smoothstep(bas - 12.0, bas + 18.0, h + bosses);
    float dessus = 1.0 - smoothstep(Hc - 30.0, Hc + 50.0, h);
    float bord = 1.0 - smoothstep(0.72, 1.1, s + (n.r - 0.5) * 0.35);
    d = dessous * dessus * bord;
    // (des bords en volutes, comme ceux des nuages : la forme creusée par le bruit)
    d = saturer((d * (0.55 + 0.7 * (n.r * 0.7 + b.r * 0.3)) - 0.22) / 0.78);
    // (les bandes : des strates plus ou moins denses qui tournent avec lui)
    d *= (1.0 - uMur2.z * 0.35 * smoothstep(0.45, 0.75, b.a)) * uMur.z;
  }
  // les lambeaux : de petits morceaux de nuage déchiquetés, sous lui, qui montent en
  // spirale vers son ventre (aspirés par le tourbillon) ; (une grande tache dit d'abord
  // s'il peut y en avoir là : sinon, on traverse à grands pas)
  float l = 0.0;
  if (h <= bas - 95.0) gPas = min(gPas, 45.0);
  if (niveau > 0 && lambeaux > 0.0 && s > 0.15 && s < 1.1 && h < bas + 10.0 && h > bas - 220.0) {
    float tache = texture(uBruitNuages, vec3(tourner(q, angle) / 900.0, 0.53)).g;
    if (tache > 0.35) {
      gPas = min(gPas, 12.0 + 0.015 * r);
      // (ils montent et tournent plus vite que lui : ils sont aspirés)
      vec4 f = bruitTourbillon(q, h, omega * 2.2, 6.0, 0.0, vec2(34.0, 20.0), 7.0, 0.47);
      l = smoothstep(0.66, 0.84, f.r * 0.65 + f.g * 0.35 + (tache - 0.5) * 0.3) * smoothstep(bas - 220.0, bas - 130.0, h) * (1.0 - smoothstep(bas - 20.0, bas + 10.0, h))
        * smoothstep(0.15, 0.35, s) * (1.0 - smoothstep(0.8, 1.1, s)) * lambeaux;
    }
  }
  float total = d + l;
  if (total > 0.0 && niveau > 0) {
    gNormale += vec3(radial * 0.45, -1.0) * total;
    gProfondeur += max(h - bas, 0.0) * 0.5 * d;
    // (la largeur du ventre à cette hauteur, et la base des nuages au-dessus)
    float sh = sqrt(saturer(1.0 - pow(saturer((Hc - h) / max(uMur.y, 1.0)), 0.6667)));
    gOmbre += uExt.z * 0.6 * uMur.z * min(cordeCercle(q, Rw * max(sh, 0.05) * (0.72 + 0.56 * grand), gLumiere), versLeHaut(h, Hc + 40.0, gLumiere)) * total;
  }
  return total;
}

// ---------- le rideau de pluie ----------
float densiteRideau(vec3 p) {
  if (uRideau.w <= 0.0) return 0.0;
  vec2 q = p.xz;
  float r = length(q);
  float R = uRideau.z;
  float h = p.y;
  float horsEnveloppe = max(max(R * 0.45 - r, r - R * 2.1), h - uMur.w);
  if (horsEnveloppe > 0.0) {
    gPas = min(gPas, max(horsEnveloppe * 0.8, 4.0));
    return 0.0;
  }
  float da = abs(mod(atan(q.y, q.x) - uRideau.x + PI, TAU) - PI);
  if (da > uRideau.y) {
    // (hors du secteur où il pleut : la distance jusqu'à son bord)
    gPas = min(gPas, max(r * sin(min(da - uRideau.y, 1.5)) * 0.8, 4.0));
    return 0.0;
  }
  // (la pluie est un voile léger et lisse : de grands pas suffisent)
  gPas = min(gPas, 80.0);
  float secteur = 1.0 - smoothstep(uRideau.y * 0.5, uRideau.y, da);
  float anneau = smoothstep(R * 0.45, R * 0.85, r) * (1.0 - smoothstep(R * 1.3, R * 2.1, r));
  // des traînées qui tombent (le motif étiré en hauteur, qui descend)
  vec3 pr = vec3(q.x / 80.0, (h + uT * 9.0) / 520.0, q.y / 80.0);
  float n = texture(uBruitNuages, pr).g * 0.6 + texture(uBruitNuages, pr * vec3(2.3, 1.6, 2.3) + 0.31).b * 0.4;
  float haut = 1.0 - smoothstep(uMur.w - 160.0, uMur.w, h);
  // (un voile, à peine strié : la pluie de loin n'est pas faite de traits)
  float d = secteur * anneau * haut * mix(0.45, 1.0, smoothstep(0.3, 0.7, n)) * uRideau.w;
  gNormale += vec3(0.0, d, 0.0);
  return d;
}

// La distance d'un point à un cylindre vertical (négative dedans)
float horsCylindre(vec3 p, vec2 c, float R, float bas, float haut) {
  return max(length(p.xz - c) - R, max(bas - p.y, p.y - haut));
}

// Tout ce qu'il y a au point p (repère du pied) : remplit gEnt, gEmb, gMur, gPluie, et le
// pas conseillé gPas. (On ne calcule une pièce que si le point est dans sa boîte ; sinon,
// la distance à sa boîte dit jusqu'où on peut avancer sans la manquer.)
void matiere(vec3 p, int niveau) {
  gEnt = 0.0;
  gEmb = 0.0;
  gMur = 0.0;
  gPluie = 0.0;
  gNormale = vec3(0.0);
  gProfondeur = 0.0;
  gOmbre = 0.0;
  gPas = 250.0;
  float horsCoeur = min(horsCylindre(p, uCoeurBas.xy, uCoeurBas.z, -12.0, uCoeurBas.w),
                        horsCylindre(p, uCoeurHaut.xy, uCoeurHaut.z, uCoeurHaut.w, uEnt.w * 1.05));
  if (horsCoeur <= 0.0) {
    if (uEnt4.x > 0.0) gEnt = densiteEntonnoir(p, vec2(0.0), 1.0, uEnt2.x, 0.0, niveau);
    if (uEmb.z > 0.0) gEmb = densiteEmbruns(p, vec2(0.0), 1.0, uEnt4.z, 0.0, niveau);
#ifdef SOEURS
    // (ses sœurs : plus petites, elles descendent du même nuage-mur)
    if (uSoeur0.w > 0.0) {
      gEnt = max(gEnt, densiteEntonnoir(p, uSoeur0.xy, uSoeur0.z, mix(uEnt.w, 0.0, uSoeur0.w), 1.0, niveau));
      gEmb = max(gEmb, densiteEmbruns(p, uSoeur0.xy, uSoeur0.z, smoothstep(0.86, 1.0, uSoeur0.w), 2.7, niveau));
    }
    if (uSoeur1.w > 0.0) {
      gEnt = max(gEnt, densiteEntonnoir(p, uSoeur1.xy, uSoeur1.z, mix(uEnt.w, 0.0, uSoeur1.w), 2.0, niveau));
      gEmb = max(gEmb, densiteEmbruns(p, uSoeur1.xy, uSoeur1.z, smoothstep(0.86, 1.0, uSoeur1.w), 5.3, niveau));
    }
#endif
  } else gPas = min(gPas, max(horsCoeur, 1.0));
  float horsDisque = horsCylindre(p, uDisque.xy, uDisque.z, uDisqueY.x, uDisqueY.y);
  if (horsDisque <= 0.0) gMur = densiteMur(p, niveau);
  else gPas = min(gPas, max(horsDisque, 1.0));
  if (uZonePluie.z > 0.0 && niveau > 0) {
    float horsPluie = horsCylindre(p, uZonePluie.xy, uZonePluie.z, -12.0, uZonePluie.w);
    if (horsPluie <= 0.0) gPluie = densiteRideau(p);
    else gPas = min(gPas, max(horsPluie, 1.0));
  }
}

float extinctionIci() {
  return gEnt * uExt.x + gEmb * uExt.y + gMur * uExt.z + gPluie * uExt.w;
}
`;
