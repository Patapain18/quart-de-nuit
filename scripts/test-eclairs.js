// La foudre (src/monde/foudre.js), sans navigateur :
//   node scripts/test-eclairs.js
// Les éclairs partent des nuages d'orage, et de nulle part ailleurs : pas un sans grain
// orageux ; chacun dans le nuage de son grain, la foudre sous son cœur (ou devant lui, sous
// son enclume) ; un grain plus fort en lance bien plus ; dans le nuage, jusqu'à la mer, en
// araignée, dans les bonnes proportions ; jamais deux éclats à moins d'un tiers de seconde ;
// le tonnerre arrive à l'heure (trois secondes par kilomètre, depuis le point le plus
// proche) ; le mât attire la foudre qui tombe près de lui ; l'air se charge sous le grain
// (le feu de Saint-Elme). Puis une nuit entière, et cent passages du grain le plus fort.
import { Foudre, REGLAGES_FOUDRE, activiteDuGrain, eclairsParSeconde, lumiereEclair } from '../src/monde/foudre.js';
import { Grains } from '../src/monde/grains.js';
import { meteoDeLaNuit, heureA, DUREE_HEURE } from '../src/quart/nuit.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
const pc = (x) => `${Math.round(x * 100)} %`;
const P = REGLAGES_FOUDRE;
const AU_PLUS_FORT = meteoDeLaNuit(29.3);

// Un grain posé, immobile, dans la force de l'âge
function grainPose(grains, { x = 0, z = 0, force = 0.9, orage = 1, rayon = 1050 } = {}) {
  grains.maj(0, AU_PLUS_FORT, 0, 0);
  grains.liste = [];
  grains.attente = 1e9;
  grains.peuple = true;
  const g = grains.creer({ x, z, rayon, force, orage, duree: 1e9, age: 400, prevu: true });
  g.vx = 0;
  g.vz = 0;
  return g;
}

// Fait vivre la foudre ; rend les éclairs (au moment de leur premier éclat), les tonnerres
// et les frappes
// (figer : les grains posés restent où ils sont)
function vivre(foudre, secondes, { meteo = AU_PLUS_FORT, grains = null, x = 0, z = 0, pas = 1 / 30, avant = null, figer = false } = {}) {
  const eclairs = [];
  const tonnerres = [];
  const frappes = [];
  for (let t = 0; t < secondes; t += pas) {
    avant?.(t);
    if (grains && !figer) {
      grains.maj(pas, meteo, x, z);
      grains.attente = 1e9;
    }
    foudre.maj(pas, { meteo, grains, x, z });
    for (const ev of foudre.evenements) {
      if (ev.type === 'eclair') eclairs.push({ ...ev.eclair, vuA: foudre.t });
      else if (ev.type === 'tonnerre') tonnerres.push({ ...ev, entenduA: foudre.t });
      else frappes.push(ev);
    }
  }
  return { eclairs, tonnerres, frappes };
}

// ---------- D'où ils partent ----------
console.log('Un grain d\'orage posé à 6 km, pendant une heure');
{
  const grains = new Grains(3);
  const g = grainPose(grains, { x: 6000, z: 0 });
  const foudre = new Foudre(7);
  const { eclairs } = vivre(foudre, 3600, { grains, figer: true });
  const parMinute = eclairs.length / 60;
  const attendu = eclairsParSeconde(activiteDuGrain(g, AU_PLUS_FORT.orage)) * 60;
  console.log(`  ${eclairs.length} éclairs (${arrondi(parMinute)} par minute ; prévus ${arrondi(attendu)})`);
  verifier(Math.abs(parMinute - attendu) / attendu < 0.12, `il en lance autant que prévu : ${arrondi(parMinute)} par minute`);
  verifier(parMinute > 5 && parMinute < 12, `un grain d'orage au plus fort : ${arrondi(parMinute)} éclairs par minute (les vrais : 2 à 15)`);
  const loinDuGrain = (p) => Math.hypot(p.x - g.x, p.z - g.z);
  const horsNuage = eclairs.filter((e) => e.type !== 'front' && loinDuGrain(e.haut) > 2.6 * g.rayon);
  verifier(horsNuage.length === 0, `tous partent de son nuage (le plus loin à ${arrondi(Math.max(...eclairs.map((e) => loinDuGrain(e.haut))) / g.rayon, 2)} rayon de son centre)`);
  const parSorte = (s) => eclairs.filter((e) => e.type === s).length / eclairs.length;
  console.log(`  dans le nuage ${pc(parSorte('nuage'))}, jusqu'à la mer ${pc(parSorte('mer'))}, en araignée ${pc(parSorte('araignee'))}`);
  verifier(Math.abs(parSorte('mer') - P.mer) < 0.05 && Math.abs(parSorte('araignee') - P.araignee) < 0.04 && parSorte('nuage') > 0.5, 'plus de la moitié restent dans le nuage, un sur trois descend jusqu\'à la mer');
  // la foudre tombe sous son cœur (sous l'avant du cœur, le plus dense, le plus souvent)
  const mer = eclairs.filter((e) => e.type === 'mer' && !e.avantLaPluie);
  const c = grains.noyau(g, g.noyaux[0], {});
  const d = mer.map((e) => Math.hypot(e.bas.x - c.x, e.bas.z - c.z)).sort((a, b) => a - b);
  const mediane = d[Math.floor(d.length / 2)];
  verifier(mediane < 0.6 * g.rayon, `la foudre tombe sous le cœur de pluie : la moitié à moins de ${Math.round(mediane)} m de son avant (${arrondi(mediane / g.rayon, 2)} rayon)`);
  const avant = eclairs.filter((e) => e.avantLaPluie).length / eclairs.filter((e) => e.type === 'mer').length;
  verifier(avant > 0.02 && avant < 0.14, `parfois loin devant lui, avant la pluie : ${pc(avant)} des éclairs vers la mer`);
  // jamais deux éclats à moins d'un tiers de seconde
  const eclats = foudre.compte && eclairs.flatMap((e) => e.eclats.map((x) => x.t)).sort((a, b) => a - b);
  let ecartMin = Infinity;
  for (let i = 1; i < eclats.length; i++) ecartMin = Math.min(ecartMin, eclats[i] - eclats[i - 1]);
  verifier(ecartMin >= P.intervalle - 1e-9, `jamais deux éclats à moins de ${P.intervalle} s (au plus près : ${arrondi(ecartMin, 2)} s) : trois par seconde au plus`);
  const n = eclairs.filter((e) => e.type === 'mer').map((e) => e.eclats.length);
  verifier(Math.min(...n) >= 1 && Math.max(...n) <= 4 && n.reduce((a, b) => a + b, 0) / n.length > 1.8, `vers la mer, un à quatre éclats sur le même trait (${arrondi(n.reduce((a, b) => a + b, 0) / n.length)} en moyenne)`);
}

console.log('\nSans nuage d\'orage, pas d\'éclair');
{
  const grains = new Grains(5);
  const g = grainPose(grains, { x: 3000, orage: 0 });
  const r = vivre(new Foudre(1), 900, { grains, figer: true });
  verifier(r.eclairs.filter((e) => e.type !== 'front').length === 0, 'un grain sans orage, en pleine tempête : pas un éclair en quinze minutes');
  grains.liste = [];
  const r2 = vivre(new Foudre(1), 900, { grains, figer: true });
  verifier(r2.eclairs.filter((e) => e.type !== 'front').length === 0, 'aucun grain : pas un éclair (seulement ceux du front, au loin, s\'il est là)');
  // le grain qui naît : ses premiers éclairs quand sa tour a fini de monter
  const jeune = grainPose(grains, { x: 3000 });
  jeune.age = 0;
  jeune.naissance = 90;
  jeune.duree = 600;
  grains.liste = [jeune];
  const r3 = vivre(new Foudre(2), 600, { grains, figer: true, avant: (t) => { jeune.age = t; } });
  const premier = r3.eclairs.find((e) => e.type !== 'front')?.vuA ?? Infinity;
  const dernier = r3.eclairs.filter((e) => e.type !== 'front').at(-1)?.vuA ?? -Infinity;
  verifier(premier > 45 && dernier < 600 - 25, `un grain qui naît : son premier éclair à ${Math.round(premier)} s (il se forme en 90 s), son dernier ${Math.round(600 - dernier)} s avant sa fin`);
  // un grain moitié moins électrique : bien moins d'éclairs
  const demi = eclairsParSeconde(0.45) / eclairsParSeconde(0.9);
  verifier(demi < 0.3, `deux fois moins électrique : ${Math.round(1 / demi)} fois moins d'éclairs`);
}

// ---------- Le tonnerre ----------
console.log('\nLe tonnerre');
{
  const foudre = new Foudre(9);
  foudre.maj(0, { meteo: AU_PLUS_FORT, grains: null, x: 0, z: 0 });
  foudre.liberer();
  foudre.retenir(1e9); // (pas d'éclairs naturels : seulement ceux qu'on envoie)
  const e = foudre.lancer({ type: 'mer', x: 3000, z: 0, eclats: 2 });
  const r = vivre(foudre, 30, { avant: () => foudre.retenir(1e9) });
  const t = r.tonnerres.find((x) => x.id === e.id);
  const attendu = e.t0 + e.distance / P.son;
  console.log(`  un éclair qui tombe à ${Math.round(e.distance)} m : le tonnerre arrive ${arrondi(t.entenduA - e.t0)} s après lui, et roule ${arrondi(t.duree)} s`);
  verifier(Math.abs(t.entenduA - attendu) < 0.05 && Math.abs((t.entenduA - e.t0) - e.distance / 340) < 0.05, `trois secondes par kilomètre : ${arrondi(t.entenduA - e.t0)} s pour ${arrondi(e.distance / 1000, 2)} km`);
  // (le point du trait le plus proche : sur le trait qui descend, ou sur ses branches dans le
  // nuage — elles peuvent passer plus près que là où il touche la mer)
  const surSegment = (o, a, b) => {
    const ab = [b.x - a.x, b.y - a.y, b.z - a.z];
    const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const s = Math.max(0, Math.min(1, ((o.x - a.x) * ab[0] + (o.y - a.y) * ab[1] + (o.z - a.z) * ab[2]) / l2));
    return Math.hypot(o.x - a.x - ab[0] * s, o.y - a.y - ab[1] * s, o.z - a.z - ab[2] * s);
  };
  const o = { x: 0, y: 2, z: 0 };
  const plusPres = Math.min(surSegment(o, e.haut, e.bas), surSegment(o, e.nuage[0], e.nuage[1]));
  verifier(Math.abs(e.distance - plusPres) < 1 && e.distance <= Math.hypot(3000, 2) + 1, `il part du point du trait le plus proche de nous (${Math.round(e.distance)} m ; le trait touche la mer à 3 km)`);
  verifier(t.duree > (e.loin - e.distance) / 340, `il roule tant qu'arrive le son des parties plus lointaines du trait (${arrondi(t.duree)} s ; le haut du trait est à ${Math.round(e.loin)} m)`);
  const loin = foudre.lancer({ type: 'mer', x: 22000, z: 0 });
  vivre(foudre, 80, { avant: () => foudre.retenir(1e9) });
  verifier(!foudre.tonnerres.length && loin.distance > P.audible, `à ${Math.round(loin.distance / 1000)} km, on ne l'entend plus (trop loin : au-delà de ${P.audible / 1000} km)`);
  const proche = foudre.lancer({ type: 'mer', x: 300, z: 0 });
  const r2 = vivre(foudre, 5, { avant: () => foudre.retenir(1e9) });
  const t2 = r2.tonnerres.find((x) => x.id === proche.id);
  verifier(t2?.claque && t2.entenduA - proche.t0 < 1.2, `tout près, il claque presque en même temps que l'éclair (${t2 ? arrondi(t2.entenduA - proche.t0, 2) : '?'} s)`);
}

// ---------- Le mât attire la foudre ----------
console.log('\nLe mât attire la foudre');
{
  const grains = new Grains(11);
  const g = grainPose(grains, { x: 250, z: 0 });
  const foudre = new Foudre(13);
  const { frappes, eclairs } = vivre(foudre, 7200, { grains, figer: true });
  const mer = eclairs.filter((e) => e.bas);
  // (aucun éclair ne touche la mer dans le rayon où le mât l'aurait attiré)
  const mal = mer.filter((e) => {
    if (e.surLeMat) return false;
    const amorcage = 10 * e.courant ** 0.65;
    const rayon = Math.sqrt(Math.max(0, 2 * amorcage * P.hauteurMat - P.hauteurMat ** 2));
    return Math.hypot(e.bas.x, e.bas.z) < rayon;
  });
  const surLeMat = mer.filter((e) => e.surLeMat).length;
  const proches = frappes.filter((f) => !f.surLeMat);
  console.log(`  deux heures sous un grain d'orage : ${mer.length} éclairs jusqu'à la mer, ${proches.length} à moins de ${P.proche} m, ${surLeMat} sur le mât`);
  verifier(mal.length === 0, 'aucun ne tombe à la mer là où le mât l\'aurait attiré (sa distance d\'amorçage)');
  verifier(surLeMat >= 1 && surLeMat / mer.length < 0.05, `sous le cœur d'un grain, la foudre finit par tomber sur le mât (${surLeMat} fois sur ${mer.length})`);
  verifier(frappes.every((f) => f.surLeMat || f.distance < P.proche), 'les frappes annoncées sont bien tout près (ou sur le mât)');
}

// ---------- Le feu de Saint-Elme ----------
console.log('\nL\'air chargé (le feu de Saint-Elme)');
{
  const grains = new Grains(17);
  const g = grainPose(grains, { x: 0, z: 0 });
  const foudre = new Foudre(19);
  const champ = (x) => {
    foudre.maj(1 / 30, { meteo: AU_PLUS_FORT, grains, x, z: 0 });
    return foudre.champ;
  };
  const dessous = champ(0);
  const a2km = champ(2 * g.rayon + 600);
  const loin = champ(8000);
  verifier(dessous > 0.8 && a2km < 0.35 && loin === 0, `sous le cœur d'un grain d'orage, l'air est chargé (${pc(dessous)}) ; à ${arrondi((2 * g.rayon + 600) / 1000)} km, à peine (${pc(a2km)}) ; loin, pas du tout`);
  g.orage = 0;
  verifier(champ(0) === 0, 'sous un grain sans orage, rien');
}

// ---------- La même graine ----------
{
  const faire = (graine) => {
    const grains = new Grains(23);
    const g = grainPose(grains, { x: 2000 });
    return vivre(new Foudre(graine), 300, { grains, figer: true }).eclairs.map((e) => `${e.type}:${Math.round(e.haut.x)}:${arrondi(e.t0, 2)}`).join(',');
  };
  verifier(faire(5) === faire(5) && faire(5) !== faire(6), '\nla même graine refait les mêmes éclairs (une autre, d\'autres)');
}

// ---------- La lumière d'un éclair ----------
{
  const e = { type: 'mer', eclats: [{ t: 0, force: 1.2 }, { t: 0.5, force: 0.8 }] };
  const l = (t, doux) => lumiereEclair(e, t, doux).v;
  verifier(l(0.02) > 0.8 && l(0.2) < 0.05 && l(0.52) > 0.5 && l(-0.1) === 0, 'chaque éclat s\'allume d\'un coup et s\'éteint en un dixième de seconde');
  verifier(l(0.6, true) > 0.05 && l(0.52, true) <= l(0.4, true) + 1e-9 && Math.max(...[0.05, 0.1, 0.2, 0.3].map((t) => l(t, true))) < 0.5, 'les éclairs doux (pour les yeux sensibles) : un seul éclat, moins fort, qui s\'éteint lentement');
}

// ---------- Une nuit entière ----------
console.log('\nUne nuit entière (le bateau immobile ; les grains de la nuit, et ceux qui passent sur lui)');
// (les grains de la nuit — quart/nuit.js —, et celui de la bête, qui passe au large)
const PLANS = [
  { arrivee: 1.35 * DUREE_HEURE, force: 0.6, orage: 0.5, ecart: 380 },
  { arrivee: 2.9 * DUREE_HEURE, force: 0.8, orage: 0.8, ecart: 200 },
  { arrivee: 3.55 * DUREE_HEURE, force: 0.6, orage: 1, ecart: 900 },
  { arrivee: 4.65 * DUREE_HEURE, force: 0.95, orage: 1, ecart: 120 },
];
const HEURES = 6;
const LE_FORT = 3;
function nuitDeFoudre(graine, { seulementLeFort = false } = {}) {
  const grains = new Grains(graine * 31337 + 7);
  const foudre = new Foudre(graine * 977 + 3);
  const fin = HEURES * DUREE_HEURE;
  const lances = new Set();
  const pas = 1 / 20;
  const parHeure = Array.from({ length: HEURES }, () => ({ eclairs: 0, front: 0 }));
  const frappes = [];
  let saintElme = 0;
  const de = seulementLeFort ? PLANS[LE_FORT].arrivee - 260 : 0;
  const a = seulementLeFort ? PLANS[LE_FORT].arrivee + 180 : fin;
  for (let t = de; t < a; t += pas) {
    const ch = Math.min(HEURES - 1, Math.floor(t / DUREE_HEURE));
    const meteo = meteoDeLaNuit(heureA(t));
    PLANS.forEach((p, k) => {
      if (seulementLeFort && k !== LE_FORT) return;
      if (!lances.has(k) && t >= p.arrivee - 240) {
        lances.add(k);
        grains.maj(0, meteo, 0, 0);
        grains.lancer({ x: 0, z: 0, dans: 240, force: p.force, orage: p.orage, ecart: (graine % 2 ? 1 : -1) * p.ecart });
      }
    });
    grains.maj(pas, meteo, 0, 0);
    if (seulementLeFort) grains.liste = grains.liste.filter((g) => g.prevu);
    foudre.maj(pas, { meteo, grains, x: 0, z: 0 });
    if (foudre.champ > 0.6) saintElme += pas;
    for (const ev of foudre.evenements) {
      if (ev.type === 'eclair') parHeure[ch][ev.eclair.type === 'front' ? 'front' : 'eclairs']++;
      if (ev.type === 'frappe') frappes.push(ev);
    }
  }
  return { parHeure, frappes, saintElme, compte: foudre.compte };
}
{
  const r = nuitDeFoudre(1);
  const parMinute = r.parHeure.map((c) => c.eclairs / (DUREE_HEURE / 60));
  parMinute.forEach((x, h) => console.log(`  ${h} h : ${arrondi(x)} éclairs par minute`));
  const debut = (parMinute[0] + parMinute[1]) / 2;
  const finNuit = (parMinute[4] + parMinute[5]) / 2;
  verifier(finNuit > debut, `de plus en plus d'éclairs : ${arrondi(debut)} par minute entre minuit et 2 h, ${arrondi(finNuit)} entre 4 h et 6 h`);
  verifier(Math.max(...parMinute) > 4 && Math.max(...parMinute) < 25, `au plus fort : ${arrondi(Math.max(...parMinute))} par minute`);
  verifier(r.saintElme > 30 && r.saintElme < 400, `le feu de Saint-Elme, sous les grains orageux : ${Math.round(r.saintElme)} s dans la nuit`);
}
console.log('\nCent passages du grain le plus fort (orage 1, force 0,95, son cœur à 120 m du bateau)');
{
  let surLeMat = 0;
  let avecProche = 0;
  let avec300 = 0;
  const N = 100;
  for (let s = 1; s <= N; s++) {
    const r = nuitDeFoudre(s, { seulementLeFort: true });
    if (r.frappes.some((f) => f.surLeMat)) surLeMat++;
    if (r.frappes.some((f) => !f.surLeMat)) avecProche++;
    if (r.frappes.some((f) => !f.surLeMat && f.distance < 300)) avec300++;
  }
  console.log(`  au moins une frappe à moins de ${P.proche} m : ${avecProche} fois sur ${N} ; à moins de 300 m : ${avec300} ; sur le mât : ${surLeMat}`);
  verifier(avecProche >= 60, `sous le grain le plus fort, la foudre tombe presque toujours tout près (${avecProche} fois sur ${N})`);
  verifier(avec300 >= 20 && avec300 <= 75, `à moins de 300 m, souvent (${avec300} fois sur ${N})`);
  verifier(surLeMat <= 8, `sur le mât, rarement (${surLeMat} fois sur ${N})`);
}

// ---------- Ce que ça coûte ----------
{
  const grains = new Grains(29);
  grainPose(grains, { x: 3000 });
  for (let k = 0; k < 6; k++) grains.creer({ x: 4000 + k * 1500, z: -3000 + k * 900, rayon: 900, force: 0.7, orage: 0.8, duree: 1e9, age: 400, prevu: true });
  const foudre = new Foudre(31);
  for (let i = 0; i < 600; i++) foudre.maj(1 / 60, { meteo: AU_PLUS_FORT, grains, x: 0, z: 0 });
  const debut = performance.now();
  const n = 20000;
  for (let i = 0; i < n; i++) foudre.maj(1 / 60, { meteo: AU_PLUS_FORT, grains, x: 0, z: 0 });
  const us = ((performance.now() - debut) / n) * 1000;
  verifier(us < 20, `\nla foudre : ${arrondi(us, 1)} µs par image (${grains.liste.length} grains d'orage)`);
}

console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
