// Les options du joueur : la qualité de l'image, la souris, la vue, le confort (contre le
// mal de mer), la barre (assistée ou non), le son et la voix de Jos.
// Toutes gardées par le navigateur, sous une seule clé. N'importe quelle page peut les
// lire (lireOptions) et les changer (changerOptions) ; ceux qui veulent savoir quand elles
// changent s'abonnent (quandOptionsChangent).
// Si le navigateur refuse de garder quoi que ce soit (navigation privée), les options
// marchent quand même, le temps de la visite.
const CLE = 'quart-de-nuit:options';

export const OPTIONS_DE_BASE = {
  qualite: 'haute', // l'image : 'economique', 'moyenne', 'haute' ou 'superbe'
  sensibilite: 1, // la souris : de 0,3 (lente) à 2,5 (vive)
  inverser: false, // inverser le regard haut / bas
  champ: 72, // le champ de vision (degrés, de haut en bas) : 60 à 90
  stabilisation: 0, // la tête compense le roulis : 0 (comme en vrai) → 1 (horizon presque fixe)
  secousses: true, // la vue tremble quand une vague frappe
  gouttes: true, // les gouttes d'eau sur l'écran
  clignotements: true, // les éclairs vifs, les lumières qui vacillent (sinon : adoucis, pour les yeux sensibles)
  nuit: 'encre', // la nuit d'orage : 'encre' (noir d'encre), 'tres-sombre' ou 'sombre' (pour un écran peu lumineux)
  volume: 0.8, // le son : 0 → 1
  voix: true, // Jos parle (sinon : seulement les sous-titres)
  sousTitres: true, // les sous-titres de la radio
  bruits: false, // les bruits qui comptent, écrits à l'écran (les vagues qu'on entend venir, et d'où)
  casque: false, // le son en trois dimensions (devant, derrière, au-dessus) : avec un casque
  aide: true, // les touches, en bas à gauche
  barreAssistee: true, // Q et D donnent le cap, la barre le tient (sinon : la vraie barre)
  difficulte: 'marin', // la dernière difficulté choisie pour la nuit
};

// Les valeurs permises : une valeur inconnue (une vieille version, une valeur modifiée à
// la main…) est remplacée par celle de base, pour que le jeu ne casse jamais
const LISTES = {
  qualite: ['economique', 'moyenne', 'haute', 'superbe'],
  difficulte: ['matelot', 'marin', 'caphornier'],
  nuit: ['encre', 'tres-sombre', 'sombre'],
};
const BORNES = { sensibilite: [0.3, 2.5], champ: [60, 90], stabilisation: [0, 1], volume: [0, 1] };
function valide(cle, valeur) {
  if (LISTES[cle]) return LISTES[cle].includes(valeur);
  if (BORNES[cle]) return typeof valeur === 'number' && valeur >= BORNES[cle][0] && valeur <= BORNES[cle][1];
  return typeof valeur === typeof OPTIONS_DE_BASE[cle];
}

// Un ordinateur modeste ? (peu de cœurs) : une image moins fine par défaut
function qualiteParDefaut() {
  const coeurs = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 8 : 8;
  return coeurs <= 4 ? 'moyenne' : 'haute';
}

let enMemoire = null;
const abonnes = new Set();

export function lireOptions() {
  let gardees = enMemoire;
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) gardees = JSON.parse(brut);
  } catch { /* stockage refusé ou illisible : on garde ce qu'on a */ }
  const options = { ...OPTIONS_DE_BASE, qualite: qualiteParDefaut() };
  for (const cle of Object.keys(OPTIONS_DE_BASE)) {
    if (gardees && valide(cle, gardees[cle])) options[cle] = gardees[cle];
  }
  return options;
}

export function changerOptions(changements) {
  const options = { ...lireOptions() };
  for (const [cle, valeur] of Object.entries(changements)) {
    if (cle in OPTIONS_DE_BASE && valide(cle, valeur)) options[cle] = valeur;
  }
  enMemoire = options;
  try {
    localStorage.setItem(CLE, JSON.stringify(options));
  } catch { /* stockage refusé : elles restent en mémoire */ }
  for (const f of abonnes) f(options, changements);
  return options;
}

export function quandOptionsChangent(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
