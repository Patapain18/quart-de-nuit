// Les feux de la côte (src/monde/feux.js), sans navigateur :
//   node scripts/test-feux.js
// Chaque feu a sa signature : on la retrouve en comptant ses éclats (le phare, d'où qu'on le
// regarde). Ce qu'on en voit dépend de la distance (son intensité vient de sa portée), de la
// rondeur de la Terre, de la brume, de la pluie d'un grain entre lui et nous — il s'y perd —,
// et des vagues : dans un creux, la crête la plus proche cache les feux bas. Ils s'allument
// au coucher du soleil. Le livre des feux dit la même chose qu'eux.
import {
  FEUX, SEMAPHORE, OPTIQUE, MILLE, eclat, rythme, intensite, lumiereRecue, porteeGeographique, allumage,
} from '../src/monde/feux.js';
import { Grains } from '../src/monde/grains.js';
import { meteoDeLaNuit } from '../src/jeu/nuit.js';
import { Houle, CASCADES } from '../src/mer/houle.js';
import { etatMer } from '../src/monde/meteo.js';
import { pageDesFeux, dessinRythme } from '../src/jeu/livre-des-feux.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const arrondi = (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n;
const virgule = (x, n = 1) => arrondi(x, n).toFixed(n).replace('.', ',');
const feu = (id) => FEUX.find((f) => f.id === id);

// Les éclats d'un feu, vus d'un relèvement, pendant « duree » secondes : [{ debut, duree }]
function compterEclats(f, { duree, releve = 0, pas = 0.005, seuil = 0.5 } = {}) {
  const eclats = [];
  let dedans = false;
  for (let t = 0; t < duree; t += pas) {
    const e = eclat(f, t, releve) > seuil;
    if (e && !dedans) eclats.push({ debut: t, duree: 0 });
    if (e) eclats.at(-1).duree += pas;
    dedans = e;
  }
  return eclats;
}

// ---------- Les rythmes ----------
console.log('Les rythmes (on compte les éclats)');
const phare = feu('phare');
const tours = [0, 90, 200, 333].map((releve) => {
  const tout = compterEclats(phare, { duree: 60, releve });
  const groupes = [];
  for (const e of tout) {
    const g = groupes.at(-1);
    if (g && e.debut - g.at(-1).debut < 3) g.push(e);
    else groupes.push([e]);
  }
  // (le premier et le dernier groupe peuvent être coupés par le début ou la fin du compte)
  const entiers = groupes.slice(1, -1);
  return { releve, premier: entiers[0][0].debut, groupes: entiers };
});
const parGroupe = tours.flatMap((x) => x.groupes.map((g) => g.length));
const ecarts = tours.flatMap((x) => x.groupes.flatMap((g) => g.slice(1).map((e, k) => e.debut - g[k].debut)));
const periodes = tours.flatMap((x) => x.groupes.slice(1).map((g, k) => g[0].debut - x.groupes[k][0].debut));
const durees = tours.flatMap((x) => x.groupes.flat().map((e) => e.duree));
verifier(parGroupe.every((n) => n === 3), `le phare : trois éclats par groupe, d'où qu'on le regarde (relèvements ${tours.map((x) => x.releve).join(', ')}°)`);
verifier(ecarts.every((e) => Math.abs(e - 1) < 0.02), `à une seconde d'écart (${virgule(Math.min(...ecarts), 2)} à ${virgule(Math.max(...ecarts), 2)} s)`);
verifier(periodes.every((p) => Math.abs(p - 12) < 0.02), `toutes les douze secondes (${virgule(Math.min(...periodes), 2)} à ${virgule(Math.max(...periodes), 2)} s)`);
verifier(durees.every((d) => d > 0.08 && d < 0.3), `un éclat bref : ${virgule(Math.min(...durees), 2)} s (le faisceau de ${OPTIQUE.largeur * 2}° passe sur nous)`);
// (le faisceau tourne dans le sens des aiguilles d'une montre : à 90° plus loin, il arrive
// 3 s plus tard)
const decale = Math.abs(((((tours[1].premier - tours[0].premier) % 12) + 12) % 12) - (90 / 360) * 12);
verifier(decale < 0.05, `l'optique tourne : à 90° de là, le groupe passe 3 s plus tard (${virgule(decale, 2)} s près)`);

const basse = feu('basse-du-bec');
const b = compterEclats(basse, { duree: 45 });
const courts = b.filter((e) => e.duree < 1);
const longs = b.filter((e) => e.duree > 1.9);
verifier(courts.length === 18 && longs.length === 3, `la Basse du Bec : six éclats rapides et un long, toutes les quinze secondes (en 45 s : ${courts.length} rapides, ${longs.length} longs)`);
verifier(longs.every((e) => e.duree >= 1.95) && Math.abs(longs[1].debut - longs[0].debut - 15) < 0.02, `l'éclat long dure ${virgule(longs[0].duree)} s, et revient toutes les ${virgule(longs[1].debut - longs[0].debut)} s`);
const vert = compterEclats(feu('jetee'), { duree: 40 });
const rouge = compterEclats(feu('roche-rouge'), { duree: 40 });
verifier(vert.length === 10 && rouge.length === 10 && vert.every((e) => Math.abs(e.duree - 0.5) < 0.06), `la jetée et la Roche Rouge : un éclat d'une demi-seconde toutes les quatre secondes (en 40 s : ${vert.length} et ${rouge.length})`);
const ensemble = vert.filter((v) => rouge.some((r) => Math.abs(r.debut - v.debut) < 0.6)).length;
verifier(ensemble === 0, 'le vert et le rouge en alternance (jamais ensemble)');
verifier(SEMAPHORE.fixe && compterEclats(SEMAPHORE, { duree: 10 }).length === 1, 'la fenêtre du sémaphore : une lumière fixe (ce n\'est pas un feu du livre)');

// ---------- L'intensité et la portée ----------
console.log('\nL\'intensité et la portée');
const visibilite10 = { brume: 0, pluie: 0 };
// (une brume qui donne 10 milles de visibilité : 60 km × (1 − 0,9 b) = 18,52 km)
visibilite10.brume = (60000 - 10 * MILLE) / 54000;
const aLaPortee = FEUX.map((f) => lumiereRecue(f, { x: f.x, y: 3, z: f.z + f.portee * MILLE }, { meteo: visibilite10, t: 0 }));
const aLaPorteeMax = FEUX.map((f) => intensite(f) * aLaPortee[FEUX.indexOf(f)].transmission / ((f.portee * MILLE) ** 2 + (f.y - 3) ** 2) / 2e-7);
verifier(aLaPorteeMax.every((x) => Math.abs(x - 1) < 0.03), `à sa portée nominale (par 10 milles de visibilité), chaque feu est tout juste au seuil de l'œil (${aLaPorteeMax.map((x) => virgule(x, 2)).join(', ')})`);
verifier(Math.round(intensite(phare)) > 100000 && intensite(feu('jetee')) < 200, `le phare : ${Math.round(intensite(phare) / 1000)} 000 candelas (portée ${phare.portee} milles) ; la jetée : ${Math.round(intensite(feu('jetee')))} (${feu('jetee').portee} milles)`);
const geo = porteeGeographique(phare.y, 2.5) / MILLE;
verifier(geo > 20 && geo < 26, `la Terre est ronde : le phare (${Math.round(phare.y)} m) passe sous l'horizon à ${virgule(geo)} milles, vu de 2,5 m ; la jetée (${feu('jetee').hauteur} m), à ${virgule(porteeGeographique(feu('jetee').y, 2.5) / MILLE)}`);
const loin = lumiereRecue(phare, { x: phare.x, y: 2.5, z: phare.z + 26 * MILLE }, { meteo: { brume: 0, pluie: 0 } });
verifier(loin.horizon && loin.recu === 0, 'au-delà, on ne le voit plus, même par temps clair');

// ---------- Cette nuit-là ----------
console.log('\nCette nuit-là, au départ (5 milles du phare)');
const depart = { x: 1500, y: 3, z: 7000 };
const heures = [18.8, 19.6, 21, 23, 24.5, 26, 27.4, 28.4, 29.5];
const auDepart = heures.map((h) => {
  const m = meteoDeLaNuit(h);
  const g = new Grains(1);
  g.meteo = m; // (des grains, mais aucun entre lui et nous : la pluie de partout, à moitié)
  g.peuple = true;
  return FEUX.map((f) => {
    const v = lumiereRecue(f, depart, { meteo: m, grains: g, t: 0 });
    return intensite(f) * v.transmission / (v.distance ** 2) / 2e-7;
  });
});
const phares = auDepart.map((x) => x[0]);
verifier(phares.every((x) => x > 100), `entre les grains, le phare se voit toute la nuit (au plus faible ${Math.round(Math.min(...phares))} fois le seuil, au plus fort de la tempête ; ${Math.round(Math.max(...phares))} au coucher)`);
verifier(auDepart.every((x) => x[2] < 6 && x[3] < 6), 'les feux du port, à 6 milles : tout juste visibles au coucher du soleil, perdus ensuite (portée 5 et 6 milles)');

console.log('\nUn grain entre lui et nous');
const m23 = meteoDeLaNuit(23);
const grains = new Grains(3);
grains.meteo = m23;
grains.peuple = true;
const sansGrain = lumiereRecue(phare, depart, { meteo: m23, grains, t: 0 });
const milieu = { x: (depart.x + phare.x) / 2, z: (depart.z + phare.z) / 2 };
grains.creer({ x: milieu.x, z: milieu.z, rayon: 900, force: 0.85, orage: 0.4, duree: 1e9, age: 400, prevu: true });
const avecGrain = lumiereRecue(phare, depart, { meteo: m23, grains, t: 0 });
const maxSans = intensite(phare) * sansGrain.transmission / sansGrain.distance ** 2 / 2e-7;
const maxAvec = intensite(phare) * avecGrain.transmission / avecGrain.distance ** 2 / 2e-7;
verifier(maxSans > 100 && maxAvec < 1, `il s'y perd : ${Math.round(maxSans)} fois le seuil sans lui, ${virgule(maxAvec, 2)} derrière lui, sous le seuil de l'œil (${Math.round(avecGrain.pluie)} m de cœur de grain traversés)`);
grains.liste[0].x += 4000;
const apres = lumiereRecue(phare, depart, { meteo: m23, grains, t: 0 });
verifier(intensite(phare) * apres.transmission / apres.distance ** 2 / 2e-7 > 100, 'et revient quand le grain est passé');

// ---------- Les vagues ----------
console.log('\nLes vagues (dans un creux, la crête la plus proche cache les feux)');
function parLesVagues(heure, obs, { duree = 60, pas = 0.1, merPlate = false } = {}) {
  const m = meteoDeLaNuit(heure);
  if (merPlate) Object.assign(m, { vent: 4, houle: { hs: 0.2, periode: 8, direction: 250 } });
  const houle = new Houle({ graine: 7, cascades: CASCADES.filter((c) => c.physique).map((c) => ({ ...c, n: 64 })) });
  houle.regler(etatMer(m));
  const caches = new Map(FEUX.map((f) => [f.id, 0]));
  let n = 0;
  for (let t = 0; t < duree; t += pas) {
    houle.calculer(t, pas);
    // (les yeux : 1,9 m au-dessus de l'eau, là où est le bateau — il monte et descend avec elle)
    const yeux = { x: obs.x, y: houle.hauteur(obs.x, obs.z) + 1.9, z: obs.z };
    for (const f of FEUX) if (lumiereRecue(f, yeux, { meteo: m, houle, t }).cache > 0.5) caches.set(f.id, caches.get(f.id) + 1);
    n++;
  }
  return { hs: houle.hauteurSignificative, caches: Object.fromEntries([...caches].map(([k, v]) => [k, v / n])) };
}
const tempete = parLesVagues(23.5, depart);
verifier(tempete.caches.phare > 0.1 && tempete.caches.phare < 0.6, `dans la tempête (${virgule(tempete.hs)} m de creux), le phare, à 5 milles, est caché ${Math.round(tempete.caches.phare * 100)} % du temps : on le voit du haut des vagues`);
const devantLePort = { x: (feu('jetee').x + feu('roche-rouge').x) / 2, z: feu('jetee').z + 1100 };
const port = parLesVagues(28.6, devantLePort);
verifier(port.caches.jetee > port.caches.phare && port.caches.jetee > 0.05, `les feux bas plus souvent : devant le port, à l'accalmie (${virgule(port.hs)} m), le feu de la jetée (${feu('jetee').hauteur} m) est caché ${Math.round(port.caches.jetee * 100)} % du temps, le phare ${Math.round(port.caches.phare * 100)} %`);
const plate = parLesVagues(28.6, devantLePort, { merPlate: true, duree: 20 });
verifier(Object.values(plate.caches).every((x) => x === 0), 'par mer plate, jamais');

// ---------- L'allumage ----------
console.log('\nL\'allumage');
verifier(allumage(0.2) === 0 && allumage(0.04) === 0, 'éteints le jour (le soleil à plus de 2° au-dessus de l\'horizon)');
verifier(allumage(0) === 1 && allumage(-0.3) === 1, 'allumés quand il se couche, et toute la nuit');

// ---------- Le livre des feux ----------
console.log('\nLe livre des feux');
const { entrees, carte } = pageDesFeux();
verifier(FEUX.every((f) => entrees.includes(f.caractere) && entrees.includes(f.nom) && carte.includes(f.caractere)), `chaque feu y est, avec sa signature (${FEUX.map((f) => f.caractere).join(' · ')}), et sur sa carte`);
const traits = (f) => (dessinRythme(f, { periodes: 1 }).match(/<rect x="[\d.]+" y="2"/g) ?? []).length;
verifier(traits(phare) === 3 && traits(basse) === 7 && traits(feu('jetee')) === 1, `le dessin de leurs éclats, sur une période : ${traits(phare)} pour le phare, ${traits(basse)} pour la Basse du Bec, ${traits(feu('jetee'))} pour la jetée`);
verifier(rythme(phare).periode === 12 && rythme(basse).periode === 15, 'les mêmes périodes que les feux eux-mêmes');

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
