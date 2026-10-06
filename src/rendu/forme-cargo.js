// La forme du cargo de 22 h 30 (un porte-conteneurs de 185 m), partagée par son dessin
// (cargo.js) et par la mer (eau.js : l'écume le long de sa coque et son sillage).
// Dans son repère, l'avant est vers -z : l'étrave en z = -92,5, la poupe en z = +92,5.

export const LONGUEUR = 185;
export const DEMI_LARGEUR = 15;
export const FRANC_BORD = 7; // hauteur du pont au-dessus de l'eau

// La demi-largeur de la coque à l'abscisse z : un arrière carré, un long milieu droit, une
// étrave effilée sur les 40 premiers mètres
export function demiLargeur(z) {
  const u = (z + LONGUEUR / 2) / LONGUEUR; // 0 à l'étrave, 1 à la poupe
  if (u < 0.22) return DEMI_LARGEUR * Math.sqrt(Math.max(0, 1 - ((0.22 - u) / 0.22) ** 2)) ** 1.15;
  if (u > 0.94) return DEMI_LARGEUR * (1 - 0.12 * ((u - 0.94) / 0.06) ** 2);
  return DEMI_LARGEUR;
}

// La même, pour les shaders
const f = (x) => x.toFixed(2);
export const GLSL_CARGO = /* glsl */ `
float cargoDemiLargeur(float z) {
  float u = clamp((z + ${f(LONGUEUR / 2)}) / ${f(LONGUEUR)}, 0.0, 1.0);
  if (u < 0.22) return ${f(DEMI_LARGEUR)} * pow(sqrt(max(0.0, 1.0 - pow((0.22 - u) / 0.22, 2.0))), 1.15);
  if (u > 0.94) return ${f(DEMI_LARGEUR)} * (1.0 - 0.12 * pow((u - 0.94) / 0.06, 2.0));
  return ${f(DEMI_LARGEUR)};
}
`;
