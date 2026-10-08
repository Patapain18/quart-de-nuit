// Le baromètre (src/monde/pression.js), sans navigateur :
//   node scripts/test-barometre.js
// Il annonce le temps au lieu de le suivre : la pression baisse déjà le matin, par beau
// temps ; elle baisse vite bien avant que le vent forcisse (la vieille règle des marins tient :
// une baisse rapide annonce un coup de vent, une très rapide la tempête) ; elle touche le
// fond quand le front passe, puis remonte d'un coup. Par-dessus : la marée barométrique, et le
// bond des grains quand arrive leur rafale. Le baromètre du bord : son aiguille colle (on
// tapote le verre ; le bateau qui tape la décolle), son aiguille témoin, son barographe. Et ce
// qu'en disent Jos et Kervalen Radio.
import {
  Barometre, PRESSIONS, HEURE_DU_FRONT, pressionAuLarge, pressionDuJour, mareeBarometrique, tendance, tendanceRecente, tendanceEnMots, annonce, fleche,
} from '../src/monde/pression.js';
import { Grains } from '../src/monde/grains.js';
import { meteoDuJour, HEURE_COUCHER } from '../src/jeu/journee.js';
import { meteoDeLaNuit, CHAPITRES } from '../src/jeu/nuit.js';
import { LECONS, LISTE_NUIT } from '../src/jeu/lecons.js';
import { Radio } from '../src/jeu/radio.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
const hPa = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(arrondi(x)).toFixed(1)}`;
const vent = (h) => (h < HEURE_COUCHER ? meteoDuJour(h) : meteoDeLaNuit(h)).vent;
const heure = (h) => `${Math.floor(h) % 24} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

// ---------- La dépression qui arrive ----------
console.log('La dépression qui arrive (de 9 h au lendemain 7 h)');
{
  // elle baisse sans cesse jusqu'au front, puis remonte
  let baisse = true;
  let remonte = true;
  for (let h = 9; h < HEURE_DU_FRONT - 0.01; h += 0.05) if (pressionAuLarge(h + 0.05) > pressionAuLarge(h) + 1e-9) baisse = false;
  for (let h = HEURE_DU_FRONT + 0.01; h < 31; h += 0.05) if (pressionAuLarge(h + 0.05) < pressionAuLarge(h) - 1e-9) remonte = false;
  let fond = { h: 0, p: Infinity };
  for (let h = 20; h < 31; h += 0.01) if (pressionDuJour(h) < fond.p) fond = { h, p: pressionDuJour(h) };
  console.log(`  ${arrondi(pressionDuJour(9))} hPa à 9 h, au plus bas ${arrondi(fond.p)} hPa à ${heure(fond.h)}, ${arrondi(pressionDuJour(30))} hPa à l'aube`);
  verifier(baisse && remonte, 'la pression baisse sans cesse jusqu\'au front, puis remonte');
  verifier(Math.abs(fond.h - HEURE_DU_FRONT) < 0.2 && fond.p > 980 && fond.p < 988, `elle touche le fond quand le front passe (${heure(fond.h)}, ${arrondi(fond.p)} hPa)`);
  // le matin, par beau temps, elle baisse déjà — lentement
  const matin = tendance(12);
  verifier(matin < -0.1 && matin >= -1.6 && vent(12) <= 13, `à midi, par beau temps (${Math.round(vent(12))} nœuds), elle baisse déjà : ${hPa(matin)} hPa en trois heures (${tendanceEnMots(matin)})`);
  // l'après-midi, elle baisse vite, bien avant le vent
  const apresMidi = tendance(16.5);
  verifier(apresMidi <= -3.6 && vent(16.5) <= 18, `à 16 h 30, ${hPa(apresMidi)} hPa en trois heures (${tendanceEnMots(apresMidi)}) : le vent n'est encore qu'à ${Math.round(vent(16.5))} nœuds`);
  // le bulletin du soir : un coup de vent, force 8 à 9
  const soir = tendance(18);
  verifier(soir <= -3.6 && soir > -6, `à 18 h, quand Kervalen Radio annonce un coup de vent : ${hPa(soir)} hPa (${tendanceEnMots(soir)})`);
  // la baisse la plus rapide, des heures avant le plus fort du vent
  let pire = { h: 0, dp: 0 };
  let ventMax = { h: 0, v: 0 };
  for (let h = 12; h < 30; h += 0.05) {
    if (tendance(h) < pire.dp) pire = { h, dp: tendance(h) };
    if (vent(h) > ventMax.v) ventMax = { h, v: vent(h) };
  }
  console.log(`  la baisse la plus rapide : ${hPa(pire.dp)} hPa en trois heures à ${heure(pire.h)} ; le plus fort du vent : ${Math.round(ventMax.v)} nœuds à ${heure(ventMax.h)}`);
  verifier(ventMax.h - pire.h >= 2.5, `elle annonce la tempête ${arrondi(ventMax.h - pire.h)} h avant son plus fort`);
  // la vieille règle des marins, heure par heure
  let regle = true;
  const fautes = [];
  for (let h = 12; h <= 26; h += 0.25) {
    const dp = tendance(h);
    let max = 0;
    for (let k = h; k <= h + 6; k += 0.25) max = Math.max(max, vent(k));
    if ((dp <= -3.6 && max < 28) || (dp <= -6 && max < 34)) {
      regle = false;
      fautes.push(heure(h));
    }
  }
  verifier(regle, `la vieille règle tient à toute heure : une baisse rapide est suivie d'un coup de vent dans les six heures, une très rapide de la tempête${fautes.length ? ` (sauf à ${fautes.join(', ')})` : ''}`);
  verifier(annonce(-2.5) === 'du vent' && annonce(-4) === 'un coup de vent' && annonce(-7) === 'la tempête' && annonce(-1) === null, 'ce qu\'une baisse annonce : du vent, un coup de vent, la tempête');
  // après le front, elle remonte d'un coup
  const saut = pressionDuJour(HEURE_DU_FRONT + 0.25) - pressionDuJour(HEURE_DU_FRONT);
  const heureApres = pressionDuJour(HEURE_DU_FRONT + 1) - pressionDuJour(HEURE_DU_FRONT);
  verifier(saut >= 0.8 && heureApres >= 2, `le front passé, elle remonte d'un coup : ${hPa(saut)} hPa en un quart d'heure, ${hPa(heureApres)} en une heure`);
  verifier(fleche(tendanceRecente(27.5)) === '↑' && fleche(tendanceRecente(26)) === '↓', 'la flèche de l\'écran : ↓ avant le front, ↑ dès 3 h 30 (quand Jos dit qu\'il remonte)');
  verifier(tendance(30) > 2 && vent(30) <= 15, `à l'aube, elle remonte (${hPa(tendance(30))} hPa en trois heures), le vent est tombé (${Math.round(vent(30))} nœuds)`);
}

// ---------- La marée barométrique ----------
{
  let max = { h: 0, p: -Infinity };
  for (let h = 0; h < 24; h += 0.05) if (mareeBarometrique(h) > max.p) max = { h, p: mareeBarometrique(h) };
  verifier(Math.abs(max.p - 0.45) < 0.01 && (Math.abs(max.h - 10) < 0.1 || Math.abs(max.h - 22) < 0.1) && Math.abs(mareeBarometrique(16) + 0.45) < 0.01,
    `\nla marée barométrique : ${hPa(max.p)} hPa vers 10 h et 22 h, ${hPa(mareeBarometrique(16))} vers 16 h`);
}

// ---------- Le bond des grains ----------
console.log('\nLe bond du baromètre sous un grain');
{
  const meteo = meteoDeLaNuit(26);
  const essai = (ecart) => {
    const grains = new Grains(3);
    grains.maj(0, meteo, 0, 0);
    grains.liste = [];
    grains.attente = 1e9;
    grains.peuple = true;
    const g = grains.lancer({ x: 0, z: 0, dans: 240, force: 0.9, orage: 1, ecart });
    const serie = [];
    for (let k = 0; k < 6000; k++) {
      grains.maj(0.1, meteo, 0, 0);
      grains.liste = grains.liste.filter((x) => x === g);
      grains.attente = 1e9;
      const m = grains.mesurer(0, 0, {});
      serie.push({ t: k / 10, p: grains.pressionEn(0, 0), rafale: m.agitation, pluie: m.pluie });
    }
    return serie;
  };
  const dessus = essai(80);
  const max = Math.max(...dessus.map((e) => e.p));
  const debut = dessus.find((e) => e.p > 0.1 * max);
  const plein = dessus.find((e) => e.p > 0.5 * max);
  const rafale = dessus.find((e) => e.rafale > 0.3);
  const apres = Math.min(...dessus.filter((e) => e.t > plein.t + 60).map((e) => e.p));
  console.log(`  un grain fort qui passe sur le bateau : ${hPa(max)} hPa au plus haut ; le bond commence à ${Math.round(debut.t)} s, à mi-hauteur à ${Math.round(plein.t)} s ; sa rafale arrive à ${Math.round(rafale.t)} s`);
  verifier(max > 1.5 && max < 3, `sous un grain fort, la pression fait un bond de ${hPa(max)} hPa`);
  verifier(plein.t - debut.t < 30, `d'un coup : en ${Math.round(plein.t - debut.t)} s (une marche, au bord de sa rafale)`);
  verifier(Math.abs(debut.t - rafale.t) < 25, 'en même temps que sa rafale (l\'air froid qui tombe de lui pèse)');
  verifier(apres < -0.3, `derrière lui, elle retombe plus bas qu'avant (${hPa(apres)} hPa : le sillage du grain)`);
  const loin = essai(3000);
  verifier(Math.max(...loin.map((e) => Math.abs(e.p))) < 0.2, `un grain qui passe à 3 km : à peine (${hPa(Math.max(...loin.map((e) => Math.abs(e.p))))} hPa)`);
}

// ---------- Le baromètre du bord ----------
console.log('\nLe baromètre du bord');
{
  const b = new Barometre();
  b.maj(0.1, 1000, { heure: 20 });
  // la pression baisse de 0,25 hPa : l'aiguille colle
  for (let k = 0; k < 100; k++) b.maj(0.1, 1000 - 0.0025 * k, { heure: 20 + k * 0.001 });
  verifier(Math.abs(b.aiguille - 1000) < 1e-9, `quand la pression bouge à peine, l'aiguille colle (elle montre encore 1000, la pression est à ${arrondi(1000 - 0.25, 2)})`);
  // une tape sur le verre : elle se décolle et va à la vraie pression
  b.tapoter();
  for (let k = 0; k < 15; k++) b.maj(0.1, 999.75, { heure: 20.1 });
  verifier(Math.abs(b.aiguille - 999.75) < 0.05, `une tape sur le verre : elle va à la vraie pression en une seconde et demie (${arrondi(b.aiguille, 2)})`);
  // l'aiguille témoin
  b.caler(20.1);
  verifier(b.depuisLaTemoin === 0 && b.calee === 20.1, 'on cale l\'aiguille témoin sur la noire');
  // la pression baisse de 3 hPa en une heure de jeu : l'aiguille suit, par à-coups
  let p = 999.75;
  let sauts = 0;
  let avant = b.aiguille;
  for (let k = 0; k < 600; k++) {
    p -= 3 / 600;
    b.maj(0.1, p, { heure: 20.1 + k / 600 });
    if (Math.abs(b.aiguille - avant) > 0.1) sauts++;
    avant = b.aiguille;
  }
  verifier(Math.abs(b.depuisLaTemoin + 3) < 0.4, `trois hectopascals plus tard, l'aiguille témoin le montre : ${hPa(b.depuisLaTemoin)} hPa depuis qu'on l'a calée`);
  // le bateau qui tape dans la mer la décolle : elle suit sans coller
  let ecartMax = 0;
  for (let k = 0; k < 600; k++) {
    p -= 2 / 600;
    b.maj(0.1, p, { secousse: 0.5, heure: 21.1 + k / 600 });
    if (k > 20) ecartMax = Math.max(ecartMax, Math.abs(b.aiguille - p));
  }
  verifier(ecartMax < 0.15, `dans le gros temps, le bateau qui tape la décolle : elle suit à ${arrondi(ecartMax, 2)} hPa près`);
  // le barographe
  const c = new Barometre();
  c.maj(0.1, pressionDuJour(25), { heure: 25, passe: pressionDuJour });
  const debut = c.historique[0];
  verifier(c.historique.length > 110 && Math.abs(debut.heure - 13) < 0.11 && Math.abs(debut.p - pressionDuJour(debut.heure)) < 1e-9, `le barographe : en arrivant à 1 h du matin, il a déjà ses douze heures (${c.historique.length} points, depuis ${heure(debut.heure)})`);
  c.maj(0.1, pressionDuJour(24), { heure: 24, passe: pressionDuJour });
  verifier(c.historique.at(-1).heure === 24 && c.historique.every((x) => x.heure <= 24), 'un saut en arrière (une reprise) : il repart de là');
}

// ---------- Ce qu'en disent Jos et Kervalen Radio ----------
console.log('\nCe qu\'en disent Jos et Kervalen Radio');
{
  const montee = CHAPITRES.find((c) => c.id === 'montee').dire({ heure: 21 });
  const n = Math.round(-tendance(21));
  verifier(n >= 6 && montee[0].includes(`dégringole : ${n} hectopascals en trois heures`), `21 h : « ${montee[0]} »`);
  const pic = CHAPITRES.find((c) => c.id === 'pic').dire({ heure: 24 }, { barometre: { temoin: 1007.9 } });
  const p = Math.round(pressionDuJour(24));
  verifier(pic[0].includes(`à ${p}, et il baisse encore`) && pic[0].includes(`il a perdu ${Math.round(1007.9 - pressionDuJour(24))} hectopascals`), `minuit : « ${pic[0].slice(0, 120)}… »`);
  const sansTemoin = CHAPITRES.find((c) => c.id === 'pic').dire({ heure: 24 }, {});
  verifier(!/aiguille/.test(sansTemoin[0]), 'sans aiguille témoin calée, Jos n\'en parle pas');
  const lecon = LECONS.find((l) => l.etapes.some((e) => e.id === 'nuit.jos'));
  const jos = lecon.etapes.find((e) => e.id === 'nuit.jos').dire({}, { heure: 17 });
  verifier(jos.some((x) => /baromètre le disait.*4 hectopascals ces trois dernières heures/.test(x)), 'la leçon « Préparer la nuit » (17 h) : « Ton baromètre le disait : … 4 hectopascals ces trois dernières heures »');
  const bulletin = lecon.etapes.find((e) => e.id === 'nuit.bulletin').dire({}, { heure: 17 });
  verifier(bulletin.some((x) => /Situation générale : dépression/.test(x)) && bulletin.some((x) => /Pression à Kervalen : 1007 hectopascals, en baisse rapide/.test(x)), 'l\'avis de coup de vent : la situation générale, et « Pression à Kervalen : 1007 hectopascals, en baisse rapide »');
  verifier(LISTE_NUIT.some((x) => x.id === 'barometre' && x.fait({ aBord: { barometreLu: true } }) && !x.fait({ aBord: {} })), 'la liste de la nuit : « Le baromètre : l\'aiguille témoin calée »');
  let phrases = [];
  Radio.prototype.bulletin.call({ parler: (x) => { phrases = x; } }, meteoDuJour(15), 1.4, { pression: pressionDuJour(15), tendance: tendance(15) });
  verifier(phrases.some((x) => /^Situation générale : dépression se creusant/.test(x)) && phrases.some((x) => /^Pression : 1010 hectopascals, en baisse\.$/.test(x)), `le bulletin de la radio, à 15 h : « ${phrases.find((x) => /^Pression/.test(x))} »`);
}

// ---------- Ce que ça coûte ----------
{
  const debut = performance.now();
  let s = 0;
  for (let i = 0; i < 100000; i++) s += pressionDuJour(9 + (i % 2200) / 100) + tendance(9 + (i % 2200) / 100);
  const us = ((performance.now() - debut) / 100000) * 1000;
  verifier(us < 2 && Number.isFinite(s) && PRESSIONS.length > 10, `\nla pression et sa tendance : ${arrondi(us, 2)} µs`);
}

console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
