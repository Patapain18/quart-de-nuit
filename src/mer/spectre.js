// Le spectre des vagues : combien d'énergie porte chaque taille et chaque direction de vague.
//
// Deux familles de vagues, comme en vrai au large :
// - la MER DU VENT : levée par le vent local, d'autant plus grosse que le vent est
//   fort et souffle longtemps sur une grande distance (le « fetch »). Spectre JONSWAP,
//   mesuré en mer du Nord dans les années 1970.
// - la HOULE : de longues ondulations régulières venues d'une tempête lointaine,
//   qui existent même quand le vent local est faible.
//
// Unités : ω (oméga) = pulsation en radians par seconde, k = nombre d'onde en
// radians par mètre (une vague de longueur λ a k = 2π / λ).

export const G = 9.81; // pesanteur (m/s²)

// En eau profonde, une vague de nombre d'onde k oscille à la pulsation √(g·k)
export const pulsation = (k) => Math.sqrt(G * k);

// Spectre JONSWAP : énergie S(ω) d'une mer de vent (m²·s).
// vent : vitesse du vent à 10 m au-dessus de l'eau (m/s) ; fetch : distance (m)
// sur laquelle il souffle ; gamma : « pointe » du spectre (3,3 = valeur mesurée).
export function jonswap(w, { vent, fetch, gamma = 3.3 }) {
  if (w <= 0 || vent <= 0) return 0;
  const wp = 22 * Math.cbrt((G * G) / (vent * fetch)); // pulsation du pic
  const alpha = 0.076 * Math.pow((vent * vent) / (fetch * G), 0.22);
  const sigma = w <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((w - wp) ** 2) / (2 * sigma * sigma * wp * wp));
  return ((alpha * G * G) / w ** 5) * Math.exp(-1.25 * (wp / w) ** 4) * Math.pow(gamma, r);
}

// Pulsation du pic de la mer du vent (utile pour l'étalement des directions)
export const pulsationPic = ({ vent, fetch }) => 22 * Math.cbrt((G * G) / (vent * fetch));

// Forme JONSWAP « nue » (sans alpha), centrée sur la pulsation wp :
// sert à fabriquer une houle dont on choisit la hauteur et la période.
function formeJonswap(w, wp, gamma) {
  if (w <= 0) return 0;
  const sigma = w <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((w - wp) ** 2) / (2 * sigma * sigma * wp * wp));
  return (1 / w ** 5) * Math.exp(-1.25 * (wp / w) ** 4) * Math.pow(gamma, r);
}

// Intégrale numérique de f entre a et b (méthode des trapèzes)
function integrer(f, a, b, pas = 4000) {
  const h = (b - a) / pas;
  let somme = 0.5 * (f(a) + f(b));
  for (let i = 1; i < pas; i++) somme += f(a + i * h);
  return somme * h;
}

// Spectre d'une houle de hauteur significative hs (m) et de période periode (s).
// On règle l'échelle pour que l'énergie totale m0 vaille hs² / 16
// (définition de la hauteur significative : Hs = 4·√m0).
const cacheHoule = new Map();
export function spectreHoule(w, { hs, periode, gamma = 7 }) {
  if (hs <= 0) return 0;
  const wp = (2 * Math.PI) / periode;
  const cle = `${periode}|${gamma}`;
  let integrale = cacheHoule.get(cle);
  if (integrale === undefined) {
    integrale = integrer((x) => formeJonswap(x, wp, gamma), wp * 0.3, wp * 6);
    cacheHoule.set(cle, integrale);
  }
  return ((hs * hs) / 16 / integrale) * formeJonswap(w, wp, gamma);
}

// Étalement des directions : la part d'énergie qui part à l'angle θ (en radians)
// de la direction principale. Forme cos^(2s)(θ/2) : s grand = vagues bien alignées
// (houle), s petit = mer désordonnée. L'intégrale sur toutes les directions vaut 1.
const cacheNormalisation = new Map();
export function etalement(theta, s) {
  const cle = Math.round(s * 100);
  let norme = cacheNormalisation.get(cle);
  if (norme === undefined) {
    norme = 1 / integrer((t) => Math.pow(Math.abs(Math.cos(t / 2)), 2 * s), -Math.PI, Math.PI, 2000);
    cacheNormalisation.set(cle, norme);
  }
  return norme * Math.pow(Math.abs(Math.cos(theta / 2)), 2 * s);
}

// Paramètre d'étalement de Mitsuyasu : les vagues du pic sont bien alignées sur le
// vent, les petites vagues partent dans tous les sens.
export function parametreEtalement(w, wp) {
  const smax = 14;
  return w <= wp ? smax * Math.pow(w / wp, 5) : smax * Math.pow(w / wp, -2.5);
}

// Ramène un angle dans [-π, π]
export const angleRelatif = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Le spectre complet en direction : S(ω, θ) pour un état de la mer donné.
//   mer = { vent (m/s), fetch (m), directionVent (rad, d'où part la mer : les
//           vagues avancent VERS cette direction), houle: { hs, periode, direction } }
export function spectreDirectionnel(w, theta, mer) {
  let s = 0;
  if (mer.vent > 0.2) {
    const wp = pulsationPic(mer);
    s += jonswap(w, mer) * etalement(angleRelatif(theta - mer.directionVent), parametreEtalement(w, wp));
  }
  const houle = mer.houle;
  if (houle && houle.hs > 0) {
    s += spectreHoule(w, houle) * etalement(angleRelatif(theta - houle.direction), houle.etalement ?? 24);
  }
  return s;
}

// Hauteur significative attendue de la mer du vent seule (pour les tests)
export function hauteurSignificativeVent(mer) {
  const m0 = integrer((w) => jonswap(w, mer), 0.05, 20, 20000);
  return 4 * Math.sqrt(m0);
}
