// La course du soleil, de la lune et des étoiles dans le ciel.
//
// Repère du monde (celui de Three.js) : +X = est, +Y = haut, -Z = nord.
// L'heure est l'heure SOLAIRE (le soleil est au plus haut à 12 h pile).

const RAD = Math.PI / 180;

// Direction (vecteur unitaire) d'un astre à partir de son angle horaire H (rad,
// 0 = plein sud, au plus haut), de sa déclinaison (rad) et de la latitude (rad).
function directionAstre(angleHoraire, declinaison, latitude) {
  const sinAlt =
    Math.sin(latitude) * Math.sin(declinaison) +
    Math.cos(latitude) * Math.cos(declinaison) * Math.cos(angleHoraire);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  // azimut compté depuis le nord, vers l'est
  let cosAz =
    (Math.sin(declinaison) - Math.sin(altitude) * Math.sin(latitude)) /
    (Math.cos(altitude) * Math.cos(latitude) || 1e-6);
  cosAz = Math.max(-1, Math.min(1, cosAz));
  let azimut = Math.acos(cosAz);
  if (Math.sin(angleHoraire) > 0) azimut = 2 * Math.PI - azimut; // l'après-midi, il passe à l'ouest
  const c = Math.cos(altitude);
  return { x: c * Math.sin(azimut), y: Math.sin(altitude), z: -c * Math.cos(azimut), altitude, azimut };
}

// Position du soleil et de la lune.
//   heure : heure solaire (0-24) · latitude : degrés (47 = au large de la Bretagne)
//   declinaison : degrés (+10 = fin août, les soirées sont longues)
//   phaseLune : 0 = nouvelle lune, 0,5 = pleine lune
export function positionsAstres({ heure, latitude = 47, declinaison = 10, phaseLune = 0.5 }) {
  const lat = latitude * RAD;
  const H = ((heure - 12) / 24) * 2 * Math.PI;
  const soleil = directionAstre(H, declinaison * RAD, lat);
  // La lune suit le soleil avec un retard qui dépend de sa phase : pleine, elle se
  // lève quand le soleil se couche. Sa déclinaison est à peu près opposée à celle du
  // soleil quand elle est pleine (pleine lune d'été = lune basse).
  const declinaisonLune = declinaison * Math.cos(phaseLune * 2 * Math.PI);
  const lune = directionAstre(H - phaseLune * 2 * Math.PI, declinaisonLune * RAD, lat);
  // Rotation du ciel étoilé : les étoiles tournent autour du pôle céleste
  // (l'étoile polaire, au nord, à une hauteur égale à la latitude).
  const rotationEtoiles = H + (declinaison / 360) * 2 * Math.PI;
  return { soleil, lune, rotationEtoiles, latitude: lat };
}

// Durée de la nuit, heure du lever et du coucher (quand le centre du soleil passe
// l'horizon) : utile pour régler la partie.
export function leverCoucher({ latitude = 47, declinaison = 10 }) {
  const cosH = -Math.tan(latitude * RAD) * Math.tan(declinaison * RAD);
  const H = Math.acos(Math.max(-1, Math.min(1, cosH)));
  const demiJour = (H / (2 * Math.PI)) * 24;
  return { lever: 12 - demiJour, coucher: 12 + demiJour };
}
