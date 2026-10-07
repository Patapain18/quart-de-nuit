// Les grains (src/monde/grains.js), sans navigateur :
//   node scripts/test-grains.js
// On fait passer un grain sur un bateau immobile et on vérifie que tout arrive dans le bon
// ordre, comme sous un vrai grain : le ciel qui s'assombrit, le bruit de l'averse qui
// approche, la rafale (avant la pluie), la pluie battante, puis le vent qui mollit derrière.
// Puis : le vent tourne quand il passe sur le côté ; les grains alentour ne viennent pas sur
// nous ; la même graine refait les mêmes grains ; la partie gardée les retrouve.
import { Grains, REGLAGES_GRAINS, activiteDesGrains } from '../src/monde/grains.js';
import { angleVers, NOEUD } from '../src/monde/meteo.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;

const TEMPETE = { vent: 35, directionVent: 220, orage: 0.9, pluie: 0.6 };
const CALME = { vent: 12, directionVent: 250, orage: 0, pluie: 0 };

// ---------- Un grain droit sur nous ----------
function traversee({ ecart = 0, force = 0.9, dans = 240, duree = 600, pas = 0.1 } = {}) {
  const g = new Grains(7);
  g.maj(0, TEMPETE, 0, 0);
  g.vider(); // (seul le grain lancé : pas de grains alentour)
  g.peuple = true;
  g.attente = 1e9;
  const grain = g.lancer({ x: 0, z: 0, dans, force, orage: 0.8, ecart });
  // (on regarde la rafale dans le sens où va le grain — 10° à droite du vent —, et sur
  // le côté de sa route)
  const a = angleVers(TEMPETE.directionVent + REGLAGES_GRAINS.derive);
  const ux = Math.cos(a);
  const uz = Math.sin(a);
  const serie = [];
  const m = {};
  for (let t = 0; t <= duree; t += pas) {
    g.maj(pas, TEMPETE, 0, 0);
    g.mesurer(0, 0, m);
    serie.push({
      t, pluie: m.pluie, ombre: m.ombre, approche: m.approche, agitation: m.agitation,
      rafale: m.vent.x * ux + m.vent.z * uz, cote: -m.vent.x * uz + m.vent.z * ux,
    });
  }
  return { serie, grain, g };
}
const premier = (serie, f) => serie.find(f)?.t ?? Infinity;
const maxi = (serie, cle) => serie.reduce((m, e) => (e[cle] > m[cle] ? e : m), serie[0]);

console.log('Un grain lancé pour passer sur nous dans 4 minutes :');
const { serie, grain } = traversee();
const pic = maxi(serie, 'pluie');
const rafaleMax = maxi(serie, 'rafale');
const fond = TEMPETE.pluie * REGLAGES_GRAINS.pluieFond;
const tRafale = premier(serie, (e) => e.rafale > 4);
const tPluie = premier(serie, (e) => e.pluie > 0.6);
const tApproche = premier(serie, (e) => e.approche > 0.5);
const tOmbre = premier(serie, (e) => e.ombre > 0.3);
const apres = serie.filter((e) => e.t > pic.t);
const accalmie = apres.reduce((m, e) => Math.min(m, e.rafale), 0);
console.log(`  pluie au plus fort ${arrondi(pic.pluie, 2)} à ${arrondi(pic.t, 0)} s ; rafale +${arrondi(rafaleMax.rafale)} m/s (${arrondi(rafaleMax.rafale / NOEUD, 0)} nœuds) à ${arrondi(rafaleMax.t, 0)} s`);
console.log(`  le ciel s'assombrit à ${arrondi(tOmbre, 0)} s, on entend l'averse à ${arrondi(tApproche, 0)} s, la rafale à ${arrondi(tRafale, 0)} s, la pluie battante à ${arrondi(tPluie, 0)} s ; derrière, le vent mollit de ${arrondi(-accalmie)} m/s`);
verifier(Math.abs(serie[0].pluie - fond) < 0.01, `au début, il pleut comme partout (${arrondi(serie[0].pluie, 2)} = ${fond})`);
verifier(Math.abs(pic.t - 240) < 45, `il arrive à l'heure dite (pluie la plus forte à ${arrondi(pic.t, 0)} s, pour 240)`);
verifier(pic.pluie > 0.9, `dessous, il pleut à verse (${arrondi(pic.pluie, 2)})`);
verifier(rafaleMax.rafale > 0.6 * REGLAGES_GRAINS.rafale * 0.9, `la rafale est forte (+${arrondi(rafaleMax.rafale)} m/s)`);
verifier(tRafale < tPluie - 20 && tRafale > tPluie - 120, `la rafale arrive avant la pluie (${arrondi(tPluie - tRafale, 0)} s avant)`);
verifier(tApproche < tPluie - 15, `on entend l'averse arriver avant qu'elle tombe (${arrondi(tPluie - tApproche, 0)} s avant)`);
verifier(tOmbre < tRafale, 'le ciel s\'assombrit avant la rafale');
verifier(accalmie < -1, `derrière le grain, le vent mollit (${arrondi(accalmie)} m/s)`);
verifier(serie.at(-1).pluie < fond + 0.05 && Math.abs(serie.at(-1).rafale) < 0.5, 'puis tout redevient comme avant');

console.log('\nSur le côté (à 700 m d\'un bord, puis de l\'autre) :');
const gauche = traversee({ ecart: 700 }).serie;
const droite = traversee({ ecart: -700 }).serie;
const coteG = maxi(gauche.map((e) => ({ ...e, c: Math.abs(e.cote) })), 'c');
const coteD = maxi(droite.map((e) => ({ ...e, c: Math.abs(e.cote) })), 'c');
// (droit dessous, le vent ne tourne qu'au passage du cœur, là où l'air descend ; sur le
// côté, il tourne longtemps, pendant toute la traversée de la rafale)
const tourne = (s) => s.filter((e) => Math.abs(e.cote) > 2).length * 0.1;
console.log(`  le vent tourne : ${arrondi(coteG.cote)} m/s d'un côté, ${arrondi(coteD.cote)} m/s de l'autre, pendant ${arrondi(tourne(gauche), 0)} s (droit dessous : ${arrondi(tourne(serie), 0)} s) ; pluie ${arrondi(maxi(gauche, 'pluie').pluie, 2)}`);
verifier(coteG.c > 2.5 && coteD.c > 2.5 && Math.sign(coteG.cote) !== Math.sign(coteD.cote), 'il fait tourner le vent, dans un sens ou dans l\'autre selon le côté où il passe');
verifier(tourne(gauche) > 2 * tourne(serie), 'bien plus longtemps que quand il passe droit dessus');
verifier(maxi(gauche, 'pluie').pluie < pic.pluie, 'sur le côté, il pleut moins qu\'en plein dessous');

console.log('\nLes grains alentour (une heure d\'orage, le bateau immobile) :');
{
  const g = new Grains(11);
  let pres = 0;
  let total = 0;
  let pluieMax = 0;
  const comptes = [];
  for (let t = 0; t < 3600; t += 0.5) {
    g.maj(0.5, TEMPETE, 0, 0);
    const p = g.pluieEn(0, 0);
    pluieMax = Math.max(pluieMax, p);
    if (t % 60 === 0) comptes.push(g.liste.length);
    for (const x of g.liste) {
      total++;
      if (Math.hypot(x.x, x.z) < 1500) pres++;
    }
  }
  const moyenne = comptes.reduce((a, b) => a + b, 0) / comptes.length;
  console.log(`  ${arrondi(moyenne)} grains en moyenne (voulu : ${arrondi(activiteDesGrains(TEMPETE) * REGLAGES_GRAINS.nombre)}), pluie sur nous au plus ${arrondi(pluieMax, 2)}`);
  verifier(moyenne > 3 && moyenne < 8, 'il y en a toujours quelques-uns autour');
  verifier(pres / total < 0.01, 'ils ne passent pas sur nous (seuls ceux qu\'on lance exprès)');
  const calme = new Grains(11);
  for (let t = 0; t < 600; t += 0.5) calme.maj(0.5, CALME, 0, 0);
  verifier(calme.liste.length === 0, 'par beau temps, il n\'y en a pas');
}

console.log('\nLa même graine, la partie gardée :');
{
  const a = new Grains(5);
  const b = new Grains(5);
  for (let t = 0; t < 200; t += 0.25) { a.maj(0.25, TEMPETE, 0, 0, 2, -1); b.maj(0.25, TEMPETE, 0, 0, 2, -1); }
  verifier(JSON.stringify(a.instantane()) === JSON.stringify(b.instantane()), 'la même graine refait les mêmes grains');
  const s = a.instantane();
  const c = new Grains(99);
  c.restaurer(JSON.parse(JSON.stringify(s)));
  for (let t = 0; t < 200; t += 0.25) { a.maj(0.25, TEMPETE, 0, 0, 2, -1); c.maj(0.25, TEMPETE, 0, 0, 2, -1); }
  verifier(JSON.stringify(a.instantane()) === JSON.stringify(c.instantane()), 'repris d\'une partie gardée, ils continuent pareil');
}

console.log('\nLa menace (ce que Jos annonce) :');
{
  const { g } = traversee({ duree: 60 });
  const m = g.menace(0, 0);
  verifier(m && m.grain.prevu && m.cpa < 300 && Math.abs(m.dans - 180) < 40, `le grain lancé est vu venir (au plus près ${m ? Math.round(m.cpa) : '—'} m, dans ${m ? Math.round(m.dans) : '—'} s)`);
}

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
