// Vérifie le régulateur (la qualité « Auto »), sans navigateur : node scripts/test-regulateur.js
// (rendu/regulateur.js). On lui fait vivre des parties sur des ordinateurs pour rire : une
// carte graphique plus ou moins rapide, un processeur, un écran. À chaque image, l'ordinateur
// met le temps de son morceau le plus lent (le dessin ou le calcul), arrondi au rythme de son
// écran ; le régulateur voit passer ces images, comme dans le jeu, et choisit son cran.
import { Regulateur, CRANS, DERNIER_CRAN, COUTS } from '../src/rendu/regulateur.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};

// Ce que coûte chaque cran à la carte graphique, comparé au premier (COUTS : mesuré sur le
// Mac, voir regulateur.js) ; l'ordinateur pour rire suit le même tableau que le régulateur
let COUT = COUTS.retina;

// (un hasard qui se répète d'une fois à l'autre)
function hasard(graine) {
  let x = graine >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

// Une partie : carte (ms par image au premier cran), processeur (ms par image), écran
// (images par seconde) ; stricte : l'image attend le prochain passage de l'écran (16,7 ou
// 33,3 ms…) au lieu de partir dès qu'elle est prête ; charge(s) : la scène plus ou moins
// lourde au fil de la partie. Rend le cran à chaque instant et les changements.
// (vrais : ce que coûte vraiment chaque cran à cet ordinateur, quand il ne suit pas le
// tableau du régulateur)
function partie({ carte, processeur = 3, ecran = 60, stricte = false, secondes = 300, cran = 1, charge = () => 1, graine = 7, vrais = COUT }) {
  const r = new Regulateur({ cran, maintenant: 0, couts: COUT });
  const h = hasard(graine);
  const periode = 1000 / ecran;
  const crans = []; // (le cran, seconde par seconde)
  const images = []; // (les intervalles, avec leur heure)
  let t = 0;
  let prochainAcoup = 4000;
  while (t < secondes * 1000) {
    const dessin = carte * vrais[r.cran] * charge(t / 1000) * (0.94 + 0.12 * h());
    const calcul = processeur * (0.94 + 0.12 * h());
    let travail = Math.max(dessin, calcul);
    // (de temps en temps, un à-coup : le ramasse-miettes, un shader à préparer…)
    if (t > prochainAcoup) {
      travail += 30 + 60 * h();
      prochainAcoup = t + 3000 + 6000 * h();
    }
    const intervalle = stricte ? Math.max(1, Math.ceil(travail / periode - 0.03)) * periode : Math.max(periode, travail);
    t += intervalle;
    r.noter(intervalle, calcul, t);
    images.push([t, intervalle]);
    while (crans.length < t / 1000) crans.push(r.cran);
  }
  const ips = (de, a) => {
    const choisies = images.filter(([q]) => q >= de * 1000 && q < a * 1000);
    return choisies.length / (a - de);
  };
  const changements = (de = 0, a = secondes) => r.journal.filter((j) => j.quand >= de * 1000 && j.quand < a * 1000).length;
  return { r, crans, ips, changements, fin: r.cran };
}
const nom = (c) => `${c} (${CRANS[c].qualite}, ${Math.round(CRANS[c].finesse * 100)} %)`;
const raconter = (p) => p.r.journal.map((j) => `${(j.quand / 1000).toFixed(0)} s → ${j.cran} (${j.raison})`).join(', ');
// (le premier cran où cette carte graphique tient 60 images par seconde ; le régulateur
// peut s'arrêter juste au-dessus, s'il y tient 54 images par seconde au moins)
const premierQuiTient = (carte) => {
  const c = COUT.findIndex((x) => carte * x * 1.06 <= 1000 / 60);
  return c < 0 ? DERNIER_CRAN : c;
};
const bonCran = (cran, carte) => cran === premierQuiTient(carte) || (cran === premierQuiTient(carte) - 1 && carte * COUT[cran] <= 1000 / 56);

for (const [ecran, couts] of Object.entries(COUTS)) {
  COUT = couts;
  console.log(`\n—— Sur un écran ${ecran === 'retina' ? 'Retina (deux pixels par point)' : 'ordinaire (un pixel par point)'} ——`);

  console.log('Un ordinateur puissant, écran 120 Hz (le Mac de Mathis)');
  {
    const p = partie({ carte: 9, ecran: 120 });
    verifier(p.fin === 0, `il monte au premier cran et y reste : cran ${nom(p.fin)}`);
    verifier(p.changements() <= 1, `${p.changements()} changement(s) en 5 minutes (${raconter(p)})`);
    verifier(p.ips(60, 300) > 100, `${p.ips(60, 300).toFixed(0)} images/s`);
  }

  console.log('Un portable moyen, écran 60 Hz (une carte graphique 3 fois plus lente)');
  for (const stricte of [false, true]) {
    const p = partie({ carte: 30, stricte });
    const attendu = premierQuiTient(30);
    verifier(bonCran(p.fin, 30), `${stricte ? 'écran strict' : 'écran souple'} : le premier cran assez léger, ${nom(p.fin)} (attendu ${attendu})`);
    verifier(p.changements(100) <= 2, `ensuite il ne bouge (presque) plus : ${p.changements(100)} changement(s) en 200 s (${raconter(p)})`);
    verifier(p.ips(100, 300) > 55, `${p.ips(100, 300).toFixed(0)} images/s`);
    const arrivee = p.crans.findIndex((c) => bonCran(c, 30));
    verifier(arrivee >= 0 && arrivee < 25, `il y est en ${arrivee} s`);
  }

  console.log('Un petit portable (même le dernier cran est trop lourd pour lui)');
  {
    const p = partie({ carte: 120 });
    verifier(p.fin === DERNIER_CRAN, `il descend jusqu'au dernier cran : ${nom(p.fin)}`);
    const arrivee = p.crans.findIndex((c) => c === DERNIER_CRAN);
    verifier(arrivee >= 0 && arrivee < 25, `il y est en ${arrivee} s`);
    verifier(p.changements(60) === 0, `et il y reste : ${p.changements(60)} changement(s) ensuite`);
  }

  console.log('Un processeur lent (le calcul du jeu prend 24 ms par image)');
  {
    const p = partie({ carte: 10, processeur: 24 });
    verifier(p.fin === 1 && p.changements() === 0, `il ne baisse pas l'image pour rien : cran ${nom(p.fin)}, ${p.changements()} changement(s)`);
    verifier(p.r.dernier.limite === 'processeur', `il sait que c'est le processeur (${p.r.dernier.limite})`);
  }

  console.log('Un navigateur qui économise la batterie (30 images/s, quoi qu\'il arrive)');
  {
    const p = partie({ carte: 8, ecran: 30 });
    verifier(p.fin === 1, `il revient à son cran : ${nom(p.fin)}`);
    verifier(p.changements(0, 90) <= 6, `deux essais au plus : ${p.changements(0, 90)} changement(s) (${raconter(p)})`);
    verifier(p.changements(90) === 0, `puis plus rien pendant des minutes : ${p.changements(90)}`);
  }

  console.log('Une carte graphique juste assez rapide pour le premier cran (60 Hz, 16 ms)');
  {
    const p = partie({ carte: 16, stricte: true, cran: 0 });
    verifier(p.fin <= 1, `il reste en haut : ${nom(p.fin)}`);
    verifier(p.changements() <= 6, `sans aller-retour sans fin : ${p.changements()} changement(s) (${raconter(p)})`);
    verifier(p.changements(150) <= 2, `${p.changements(150)} changement(s) dans les 150 dernières secondes`);
  }

  console.log('La nuit qui s\'alourdit : la scène coûte 50 % de plus de 100 à 200 s');
  {
    // (au cran 1, 14 ms par image d'habitude : il tient ; 21 ms quand la scène s'alourdit)
    const carte = 14 / COUT[1];
    const p = partie({ carte, secondes: 400, charge: (s) => (s > 100 && s < 200 ? 1.5 : 1) });
    const avant = p.crans[95];
    const pendant = p.crans[190];
    const apres = p.crans[399];
    verifier(pendant > avant, `il descend quand la scène s'alourdit : cran ${avant} → ${pendant}`);
    verifier(apres < pendant, `et remonte après : cran ${apres}`);
    verifier(p.ips(110, 200) > 55, `pendant : ${p.ips(110, 200).toFixed(0)} images/s`);
    verifier(p.changements() <= 12, `${p.changements()} changement(s) en tout (${raconter(p)})`);
  }

  console.log('Une scène qui change tout le temps (±30 % toutes les quelques secondes, comme une vraie nuit)');
  {
    // (la charge saute au hasard entre 0,7 et 1,3, toutes les 2 à 6 secondes)
    const h = hasard(11);
    const sauts = [];
    for (let s = 0, c = 1; s < 400; s += 2 + 4 * h()) sauts.push([s, (c = 0.7 + 0.6 * h())]);
    const charge = (s) => sauts.findLast(([d]) => d <= s)?.[1] ?? 1;
    const p = partie({ carte: 40, secondes: 400, charge });
    const parMinute = (p.changements(60, 400) / 340) * 60;
    verifier(parMinute <= 2, `peu de changements : ${parMinute.toFixed(1)} par minute après la première (${p.changements()} en tout)`);
    verifier(p.ips(60, 400) > 54, `${p.ips(60, 400).toFixed(0)} images/s en moyenne`);
  }

  console.log('Un ordinateur qui ne coûte pas ce que croit le régulateur (l\'autre tableau)');
  {
    const vrais = ecran === 'retina' ? COUTS.ordinaire : COUTS.retina;
    const p = partie({ carte: 30, vrais });
    verifier(p.changements(100) <= 3, `il finit par se poser : ${p.changements(100)} changement(s) en 200 s (${raconter(p)})`);
    verifier(p.ips(100, 300) > 55, `${p.ips(100, 300).toFixed(0)} images/s`);
  }

  console.log('On repart d\'où l\'on était : un cran gardé d\'une partie à l\'autre, trop bas');
  {
    const attendu = premierQuiTient(30);
    const p = partie({ carte: 30, cran: Math.min(DERNIER_CRAN, attendu + 2) });
    const rates = p.r.journal.filter((j) => j.quand < 30000 && j.raison === 'echec').length;
    verifier(bonCran(p.crans[30], 30), `il remonte au bon cran : ${nom(p.crans[30])} au bout de 30 s (${raconter(p)})`);
    verifier(rates <= 1, `en essayant au plus une fois trop haut : ${rates} essai(s) raté(s)`);
  }
}

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
