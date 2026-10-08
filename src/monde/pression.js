// La pression de l'air : le baromètre annonce le temps, au lieu de le suivre.
//
// Ce jour-là, une dépression arrive de l'Atlantique. Elle passe au nord de nous pendant la
// nuit, et son front froid traverse la zone vers 3 h 20. Le matin, loin d'elle, la pression
// est haute et baisse à peine ; à mesure qu'elle approche, elle baisse de plus en plus vite —
// bien avant que le vent forcisse : à midi, par beau temps, elle baisse déjà (lentement) ; à
// 16 h 30, de 4 hectopascals en trois heures (« en baisse rapide » : un coup de vent arrive) ;
// vers 22 h, de 7 et demi (« très rapide » : la tempête) — quatre heures avant le plus fort du
// vent ; puis plus lentement, dans la nuit, jusqu'à une dernière chute juste avant le front.
// Elle touche le fond quand le front passe, puis remonte d'un coup (un hectopascal en dix
// minutes, trois dans l'heure qui suit) : le vent tourne à l'ouest, les grains derrière le
// front sont encore violents, puis tout s'apaise. Les vieilles règles des marins le disent : une baisse de plus
// de 2 hectopascals en trois heures annonce du vent, de plus de 6 la tempête ; « longtemps
// annoncé, longtemps duré ».
// Par-dessus :
//  - la « marée barométrique » : l'atmosphère respire deux fois par jour (un demi-hectopascal
//    plus haut vers 10 h et 22 h, plus bas vers 4 h et 16 h) ;
//  - les grains : sous l'air froid qui tombe d'eux, la pression fait un bond d'un à trois
//    hectopascals, d'un coup, quand arrive leur rafale, puis retombe derrière eux
//    (monde/grains.js : pressionEn).
//
// Le baromètre du bord (Barometre) : son aiguille colle un peu (on tapote le verre pour la
// décoller — le bateau qui tape dans la mer la décolle aussi), et une aiguille témoin,
// dorée, qu'on cale à la main sur la noire pour voir, plus tard, de combien elle a bougé.
//
// Les heures sont celles du jeu, du matin de la journée jusqu'au lendemain matin (31 : 7 h).

// La dépression qui arrive : la pression au large, heure par heure (hPa)
export const PRESSIONS = [
  [6, 1015.2],
  [9, 1014.4],
  [11, 1013.6],
  [13, 1012.4],
  [15, 1010.5],
  [16.5, 1008.5],
  [18, 1005.9],
  [18.75, 1004.4],
  [20, 1001.4],
  [21, 998.8],
  [22, 996.2],
  [23, 993.9],
  [24, 991.9],
  [25, 990.2],
  [26, 988.7],
  [26.5, 988.0],
  [27, 987.0],
  [27.2, 986.4],
  [27.35, 986.0], // (le front froid passe : le fond — une dernière chute juste avant —, puis le saut)
  [27.5, 986.8],
  [27.75, 987.6],
  [28, 988.2],
  [28.4, 989.0],
  [29.4, 990.6],
  [30.4, 991.9],
  [31, 992.6],
  [33, 994.6],
];
export const HEURE_DU_FRONT = 27.35;

// Les pentes d'une courbe qui passe par ces points sans jamais dépasser leurs valeurs (pas
// de bosse entre deux points qui montent : la méthode de Fritsch et Carlson)
function pentesMonotones(points) {
  const n = points.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
}
const PENTES = pentesMonotones(PRESSIONS);

// La pression au large, à cette heure du jeu (hPa)
export function pressionAuLarge(heure) {
  const P = PRESSIONS;
  if (heure <= P[0][0]) return P[0][1];
  if (heure >= P[P.length - 1][0]) return P[P.length - 1][1];
  let i = 0;
  while (heure > P[i + 1][0]) i++;
  const [x0, y0] = P[i];
  const [x1, y1] = P[i + 1];
  const h = x1 - x0;
  const t = (heure - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * PENTES[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * PENTES[i + 1];
}

// La marée barométrique (hPa) : deux fois par jour, plus haut vers 10 h et 22 h
export function mareeBarometrique(heure) {
  return 0.45 * Math.cos((2 * Math.PI * (heure - 10)) / 12);
}

// La pression de la journée et de la nuit du jeu, ici (sans les grains)
export function pressionDuJour(heure) {
  return pressionAuLarge(heure) + mareeBarometrique(heure);
}

// Ce qu'elle a fait ces dernières heures (hPa : négatif, elle baisse). Les bulletins la
// donnent sur trois heures
export function tendance(heure, heures = 3) {
  return pressionDuJour(heure) - pressionDuJour(heure - heures);
}

// Ce qu'elle fait en ce moment (sur le dernier quart d'heure, ramené à trois heures) : la
// flèche de l'écran (sur trois heures, juste après le front, elle montrerait encore la
// baisse d'avant, quand l'aiguille remonte déjà)
export function tendanceRecente(heure) {
  return 12 * (pressionDuJour(heure) - pressionDuJour(heure - 0.25));
}

// Sans journée ni nuit (un atelier, la navigation libre) : la pression qui va avec le temps
// qu'il fait (elle suit le temps au lieu de l'annoncer, faute de savoir ce qui vient)
export function pressionDuTemps(meteo) {
  return 1024 - 6 * (meteo.nuages ?? 0) - 34 * (meteo.orage ?? 0) - 0.15 * Math.max(0, (meteo.vent ?? 0) - 15);
}

// La tendance en mots, comme dans les bulletins (en trois heures : moins de 0,1 hPa,
// stationnaire ; jusqu'à 1,5, lente ; jusqu'à 3,5 ; jusqu'à 6, rapide ; au-delà, très rapide)
export function tendanceEnMots(dp) {
  const a = Math.abs(dp);
  if (a < 0.1) return 'stationnaire';
  const sens = dp < 0 ? 'en baisse' : 'en hausse';
  if (a <= 1.5) return `${sens} lente`;
  if (a <= 3.5) return sens;
  if (a <= 6) return `${sens} rapide`;
  return `${sens} très rapide`;
}

// Ce qu'une baisse annonce (en trois heures), selon la vieille règle : du vent, un coup de
// vent, la tempête — ou rien
export function annonce(dp) {
  if (dp <= -6) return 'la tempête';
  if (dp <= -3.6) return 'un coup de vent';
  if (dp <= -2) return 'du vent';
  return null;
}

// Une flèche pour l'écran : ↑ ↗ → ↘ ↓
export function fleche(dp) {
  if (dp <= -3.6) return '↓';
  if (dp <= -0.5) return '↘';
  if (dp < 0.5) return '→';
  if (dp < 3.6) return '↗';
  return '↑';
}

// ---------- Le baromètre du bord ----------
export const REGLAGES_BAROMETRE = {
  colle: 0.35, // hPa : en deçà, l'aiguille ne bouge pas toute seule (elle colle)
  raideur: 30, // (le ressort qui la ramène à la vraie pression, une fois décollée)
  amorti: 6,
};

export class Barometre {
  constructor() {
    this.aiguille = null; // ce que montre l'aiguille noire (hPa)
    this.temoin = null; // l'aiguille témoin, dorée, calée à la main
    this.calee = null; // (l'heure du jeu où on l'a calée)
    this.vitesse = 0;
    this.libre = 0; // (s : l'aiguille décollée, après une tape)
    this.historique = []; // [{ heure, p }] : la pression, toutes les six minutes du jeu
  }

  // dt (s) ; vraie : la pression de l'air (hPa) ; secousse : 0 → 1 (le bateau qui tape dans
  // la mer décolle l'aiguille) ; heure : celle du jeu (pour l'historique) ; passe(h) : la
  // pression à une heure passée (un barographe enregistre sans cesse : quand on arrive en
  // cours de route, ou après un saut dans le temps, on comble ce qu'il a enregistré)
  maj(dt, vraie, { secousse = 0, heure = null, passe = null } = {}) {
    const R = REGLAGES_BAROMETRE;
    if (this.aiguille === null) {
      this.aiguille = vraie;
      this.temoin ??= vraie;
    }
    this.libre = Math.max(0, this.libre - dt);
    const ecart = vraie - this.aiguille;
    // l'aiguille colle : elle ne part que quand l'écart dépasse un tiers d'hectopascal, ou
    // quand on la décolle (une tape sur le verre, le bateau qui tape)
    if (Math.abs(ecart) > R.colle || this.libre > 0 || secousse > 0.3 || Math.abs(this.vitesse) > 0.02) {
      const n = Math.max(1, Math.ceil(dt / 0.02));
      const h = dt / n;
      for (let k = 0; k < n; k++) {
        const a = R.raideur * (vraie - this.aiguille) - R.amorti * this.vitesse;
        this.vitesse += a * h;
        this.aiguille += this.vitesse * h;
      }
      // (sans tape ni secousse, elle s'arrête un peu avant d'arriver : elle recolle)
      if (this.libre <= 0 && secousse <= 0.3 && Math.abs(vraie - this.aiguille) < R.colle * 0.6 && Math.abs(this.vitesse) < 0.3) this.vitesse = 0;
    } else this.vitesse = 0;
    if (heure !== null) {
      let dernier = this.historique.at(-1);
      // (un saut en arrière : une reprise, ou une autre partie — on efface)
      if (dernier && heure < dernier.heure) {
        this.historique.length = 0;
        dernier = null;
      }
      // (ce qui manque, des douze dernières heures)
      if (passe) {
        const depuis = dernier ? dernier.heure + 0.1 : heure - 12;
        for (let k = 0, h = Math.max(depuis, heure - 12); h < heure - 0.05; k++, h = Math.max(depuis, heure - 12) + 0.1 * k) this.historique.push({ heure: h, p: passe(h) });
        dernier = this.historique.at(-1);
      }
      if (!dernier || heure - dernier.heure >= 0.1 - 1e-6) this.historique.push({ heure, p: vraie });
      while (this.historique.length > 130 || (this.historique.length && this.historique[0].heure < heure - 12.05)) this.historique.shift();
    }
  }

  // Une tape sur le verre : l'aiguille se décolle et va à la vraie pression (en tremblant)
  tapoter() {
    this.libre = 1.5;
    this.vitesse += (Math.random() - 0.5) * 0.6;
  }

  // On cale l'aiguille témoin sur la noire
  caler(heure = null) {
    this.temoin = this.aiguille;
    this.calee = heure;
  }

  // De combien l'aiguille a bougé depuis qu'on a calé la témoin (hPa)
  get depuisLaTemoin() {
    return this.aiguille === null || this.temoin === null ? 0 : this.aiguille - this.temoin;
  }
}
