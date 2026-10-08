// Les risées (src/monde/risees.js) et le vent qu'elles font (src/monde/vent.js), sans
// navigateur :
//   node scripts/test-risees.js
// On envoie une risée sur un bateau immobile : elle arrive à l'heure, on la voit venir
// (elle existe, formée, bien avant), et le vent ne forcit que quand elle est là — d'un coup,
// et en tournant un peu à droite. Puis, sur une heure : le vent qu'elles font, selon le
// temps, ressemble aux rafales d'avant (aussi souvent, aussi fort) ; elles vont avec le
// vent ; il y en a plus sous un grain ; la même graine refait les mêmes risées ; et ça ne
// coûte presque rien.
import { Risees, REGLAGES_RISEES, vieDeLaRisee, longueurRisee } from '../src/monde/risees.js';
import { Vent } from '../src/monde/vent.js';
import { NOEUD, angleVers } from '../src/monde/meteo.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;

const BRISE = { vent: 15, directionVent: 240, orage: 0, pluie: 0 };
const TEMPS = [
  ['le matin, 10 nœuds', { vent: 10, directionVent: 250, orage: 0 }],
  ['l\'après-midi, 17 nœuds', { vent: 17, directionVent: 235, orage: 0.1 }],
  ['au coucher, 25 nœuds', { vent: 25, directionVent: 222, orage: 0.6 }],
  ['dans la tempête, 40 nœuds', { vent: 40, directionVent: 215, orage: 1 }],
];

// ---------- Une risée envoyée sur nous ----------
console.log('Une risée envoyée sur un bateau immobile, par 15 nœuds : son milieu arrive dans 40 s');
{
  const r = new Risees(7);
  r.maj(0, BRISE, 0, 0);
  r.vider();
  r.peuple = true;
  // (seule celle-ci : pas d'autres naissances)
  const garde = { ...REGLAGES_RISEES };
  REGLAGES_RISEES.couverture = 0;
  REGLAGES_RISEES.molles = 0;
  const risee = r.envoyer({ x: 0, z: 0, dans: 40, force: 0.3 });
  const serie = [];
  const m = {};
  let vueA20 = null;
  for (let t = 0; t <= 80; t += 0.05) {
    r.maj(0.05, BRISE, 0, 0);
    r.mesurer(0, 0, 0, 0, m);
    serie.push({ t, force: m.force, bascule: m.bascule, niveau: m.niveau, dans: m.approche?.dans ?? null });
    if (vueA20 === null && m.approche && m.approche.dans <= 20) vueA20 = { distance: m.approche.distance, vie: vieDeLaRisee(risee) };
  }
  Object.assign(REGLAGES_RISEES, garde);
  const debut = serie.find((e) => e.force > 0.03)?.t ?? Infinity;
  const plein = serie.find((e) => e.force > 0.27)?.t ?? Infinity;
  const pic = serie.reduce((a, e) => (e.force > a.force ? e : a), serie[0]);
  const fin = serie.findLast((e) => e.force > 0.03)?.t ?? -Infinity;
  const U = BRISE.vent * NOEUD;
  const devant = 40 - (0.5 * risee.longueur) / U; // (son bord avant arrive avant son milieu)
  console.log(`  elle fait ${Math.round(risee.longueur)} × ${Math.round(risee.largeur)} m ; le vent forcit à ${arrondi(debut)} s (+3 %), en plein à ${arrondi(plein)} s, au plus fort ${pic.force.toFixed(2)} à ${arrondi(pic.t)} s ; fini à ${arrondi(fin)} s`);
  verifier(Math.abs(debut - devant) < 4, `elle arrive à l'heure : son bord avant à ${arrondi(debut)} s (prévu ${arrondi(devant)} s)`);
  verifier(plein - debut < 4.5, `elle arrive d'un coup : de rien à presque tout en ${arrondi(plein - debut)} s`);
  verifier(pic.force > 0.27 && pic.force <= 0.3001, `en son cœur, le vent forcit de ${Math.round(pic.force * 100)} % (envoyée : 30 %)`);
  verifier(fin - pic.t > plein - debut, `elle s'en va plus lentement qu'elle n'arrive (${arrondi(fin - pic.t)} s contre ${arrondi(plein - debut)} s)`);
  verifier(serie.filter((e) => e.t < debut - 0.5).every((e) => Math.abs(e.force) < 0.005), 'avant elle, rien : le vent ne forcit pas en avance');
  // (envoyée 40 s avant, elle naît là-bas et grandit en approchant)
  verifier(vueA20 && vueA20.vie > 0.75 && vueA20.distance > 120, `on la voit venir : 20 s avant, elle est presque formée (${vueA20 ? Math.round(vueA20.vie * 100) : '?'} %) à ${vueA20 ? Math.round(vueA20.distance) : '?'} m`);
  verifier(pic.bascule > 1.5, `dedans, le vent tourne à droite de ${arrondi(pic.bascule)}° (il vient de plus haut)`);
  const ecoute = serie.find((e) => e.niveau > 0.3)?.t ?? Infinity;
  verifier(debut - ecoute > 4 && debut - ecoute < 16, `on l'entend arriver ${arrondi(debut - ecoute)} s avant qu'elle soit là`);
}

// ---------- Le vent du bateau, sur une heure ----------
function serieDuVent(meteo, { graine = 7, minutes = 60, vb = [0, 0], agitation = 0 } = {}) {
  const v = new Vent(graine);
  const pas = 0.1;
  const forces = [];
  let x = 0;
  let z = 0;
  let somme = 0;
  for (let t = 0; t < minutes * 60; t += pas) {
    x += vb[0] * pas;
    z += vb[1] * pas;
    v.maj(t, pas, meteo, agitation, x, z);
    forces.push(v.facteurRafale);
    somme += v.vitesse;
  }
  return { forces, moyenne: somme / forces.length, v };
}
function statistiques(forces, pas = 0.1) {
  let dedans = 0;
  let rafales = 0;
  let enCours = false;
  let molle = 0;
  for (const f of forces) {
    if (f > 0.06) {
      dedans++;
      if (!enCours) rafales++;
      enCours = true;
    } else enCours = false;
    if (f < -0.03) molle++;
  }
  const minutes = (forces.length * pas) / 60;
  return { temps: dedans / forces.length, parMinute: rafales / minutes, max: Math.max(...forces), molle: molle / forces.length };
}
console.log('\nLe vent du bateau, sur une heure (un bateau qui va à 3 m/s, au travers du vent)');
for (const [nom, meteo] of TEMPS) {
  const a = angleVers(meteo.directionVent) + Math.PI / 2;
  const { forces, moyenne } = serieDuVent(meteo, { vb: [Math.cos(a) * 3, Math.sin(a) * 3] });
  const s = statistiques(forces);
  const orage = meteo.orage;
  console.log(`  ${nom} : ${Math.round(s.temps * 100)} % du temps dans une risée, ${arrondi(s.parMinute, 2)} par minute, au plus +${Math.round(s.max * 100)} %, ${Math.round(s.molle * 100)} % dans une molle ; vent moyen ${arrondi(moyenne)} nœuds`);
  // (les rafales d'avant les risées : de 21 % du temps par beau temps à 61 % dans la tempête,
  // une à trois par minute, au plus +20 % à +40 %)
  verifier(s.temps > 0.12 + 0.12 * orage && s.temps < 0.35 + 0.15 * orage, `${nom} : dans une risée ${Math.round(s.temps * 100)} % du temps`);
  verifier(s.parMinute > 0.6 && s.parMinute < 3.5, `${nom} : ${arrondi(s.parMinute, 2)} risées par minute`);
  verifier(s.max > 0.15 && s.max < 0.46, `${nom} : au plus fort, +${Math.round(s.max * 100)} %`);
  verifier(s.molle > 0.005, `${nom} : des molles aussi (${arrondi(s.molle * 100)} % du temps)`);
  // (à l'orage, le vent souffle par bouffées, même entre les risées : le vent moyen ressenti
  // reste celui d'avant)
  verifier(moyenne > meteo.vent * (1 + 0.1 * orage) && moyenne < meteo.vent * (1.06 + 0.12 * orage), `${nom} : vent moyen ressenti ${arrondi(moyenne)} nœuds (établi ${meteo.vent})`);
}

// ---------- Elles vont avec le vent ----------
console.log('\nOù elles sont, où elles vont');
{
  const r = new Risees(3);
  const meteo = TEMPS[2][1];
  for (let t = 0; t < 120; t += 0.1) r.maj(0.1, meteo, 0, 0);
  const a = angleVers(meteo.directionVent);
  const U = meteo.vent * NOEUD;
  let cosMin = 1;
  let vMin = Infinity;
  let vMax = 0;
  for (const x of r.liste) {
    const v = Math.hypot(x.vx, x.vz);
    cosMin = Math.min(cosMin, (x.vx * Math.cos(a) + x.vz * Math.sin(a)) / v);
    vMin = Math.min(vMin, v / U);
    vMax = Math.max(vMax, v / U);
  }
  verifier(cosMin > 0.999 && vMin > 0.9 && vMax < 1.1, `elles vont avec le vent, de ${arrondi(vMin, 2)} à ${arrondi(vMax, 2)} fois sa vitesse`);
  // (la part de la mer couverte, mesurée sur une grille autour du bateau)
  let couverts = 0;
  let n = 0;
  const m = {};
  for (let i = -20; i <= 20; i++) {
    for (let j = -20; j <= 20; j++) {
      const x = i * 40;
      const z = j * 40;
      if (Math.hypot(x, z) > 800) continue;
      r.ventEn(x, z, m);
      if (m.force > 0.03) couverts++;
      n++;
    }
  }
  verifier(couverts / n > 0.2 && couverts / n < 0.6, `elles couvrent ${Math.round((100 * couverts) / n)} % de la mer autour du bateau (dans ${Math.round(r.rayon)} m : ${r.liste.length} risées et molles)`);
  const L = longueurRisee(U);
  const tailles = r.liste.map((x) => x.longueur);
  verifier(Math.min(...tailles) > 0.65 * L && Math.max(...tailles) < 1.35 * L, `de ${Math.round(Math.min(...tailles))} à ${Math.round(Math.max(...tailles))} m de long (par 25 nœuds)`);
  // sous un grain : bien plus
  const sous = new Risees(3);
  for (let t = 0; t < 120; t += 0.1) sous.maj(0.1, meteo, 0, 0, { agitation: 0.8 });
  verifier(sous.liste.length > r.liste.length * 1.3, `sous un grain, il y en a bien plus (${sous.liste.length} au lieu de ${r.liste.length} ; jamais plus de ${REGLAGES_RISEES.maximum})`);
}

// ---------- La même graine ----------
{
  const a = serieDuVent(TEMPS[1][1], { graine: 11, minutes: 5 }).forces;
  const b = serieDuVent(TEMPS[1][1], { graine: 11, minutes: 5 }).forces;
  const c = serieDuVent(TEMPS[1][1], { graine: 12, minutes: 5 }).forces;
  verifier(a.every((x, i) => x === b[i]) && a.some((x, i) => x !== c[i]), 'la même graine refait les mêmes risées (une autre, d\'autres)');
}

// ---------- Ce que ça coûte ----------
{
  const v = new Vent(5);
  const meteo = TEMPS[1][1];
  const m = {};
  for (let t = 0; t < 30; t += 1 / 60) v.maj(t, 1 / 60, meteo, 0, 0, 0);
  const debut = performance.now();
  const n = 6000;
  for (let i = 0; i < n; i++) {
    v.maj(30 + i / 60, 1 / 60, meteo, 0, i * 0.05, 0);
    v.risees.mesurer(i * 0.05, 0, 3, 0, m);
  }
  const ms = (performance.now() - debut) / n;
  verifier(ms < 0.08, `le vent et les risées : ${arrondi(ms * 1000, 0)} µs par image (${v.risees.liste.length} risées)`);
}

console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
