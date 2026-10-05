// Le régleur automatique : il borde ou choque les écoutes pour que chaque voile reçoive
// le vent sous son meilleur angle (~20° d'incidence : elle tire fort sans décrocher).
//  - incidence trop forte : la voile est trop bordée, elle freine → on choque (on
//    laisse filer l'écoute, la bôme s'écarte, l'angle diminue) ;
//  - incidence trop faible : la voile faseye → on borde.
// Dans la brise, il « dépuissance » comme un bon équipier : quand le bateau gîte trop
// (au-delà de giteMax), il choque la grand-voile (elle porte moins), le bateau se
// redresse et devient moins ardent. Et quand le barreur doit mettre presque toute la
// barre pour empêcher le bateau de remonter au vent, il choque en grand : la
// grand-voile, à l'arrière, fait tourner le bateau vers le vent ; le foc, à l'avant,
// l'en écarte (« on choque pour abattre »).
// Il sert à tracer la polaire, au pilote du didacticiel, et à l'aide « réglage
// automatique » des débutants.
export const INCIDENCE_IDEALE = 20;
export const GITE_MAX = 20;

const borne = (x, a, b) => Math.min(b, Math.max(a, x));

export function reglerAutomatiquement(bateau, dt, { cible = INCIDENCE_IDEALE, vivacite = 1.6, giteMax = GITE_MAX } = {}) {
  const m = bateau.mesures;
  const ecart = (incidence, vise) => ((incidence - vise) * Math.PI) / 180;
  // chaque degré de gîte en trop retire ~1,2° d'incidence à la grand-voile…
  const exces = Math.max(0, Math.abs(m.gite) - giteMax);
  // … et la barre mise pour abattre (au-delà de 0,25 rad) jusqu'à 30° : elle faseye
  const abattre = -bateau.barre * Math.sign(m.angleVentReel || 1);
  const ardeur = borne((abattre - 0.25) / 0.2, 0, 1);
  const cibleGV = cible - Math.min(18, exces * 1.2) - ardeur * 30;
  if (bateau.ris < 3) bateau.ecouteGV = borne(bateau.ecouteGV + ecart(m.incidenceGV, cibleGV) * vivacite * dt, 0.03, 1.45);
  if (bateau.deroule > 0.05) bateau.ecouteFoc = borne(bateau.ecouteFoc + ecart(m.incidenceFoc, cible) * vivacite * dt, 0.17, 1.2);
}

// La qualité du réglage d'une voile, pour les penons et les conseils :
// 'faseye' (pas assez bordée), 'bon', 'trop-bordee' (elle décroche)
export function etatReglage(incidence) {
  if (incidence < 8) return 'faseye';
  if (incidence > 32) return 'trop-bordee';
  return 'bon';
}
