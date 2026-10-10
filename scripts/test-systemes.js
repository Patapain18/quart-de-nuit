// Vérifie les systèmes du bord, sans navigateur : node scripts/test-systemes.js
// (quart/systemes.js : la batterie et ce qui la vide, le moteur, le pilote, la pompe
// électrique, l'eau qui noie les batteries, les vitres, les volets)
import { Systemes, BATTERIE, MOTEUR, PILOTE, EAU_BATTERIES, CONSO, exposition } from '../src/quart/systemes.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const pas = 1 / 30;
// (un bateau pour rire : sa barre, et son safran bien dans l'eau)
const bateau = (barre = 0) => ({ barre, tenueSafran: 1 });
// faire tourner les systèmes t secondes (vent, mer, heure ; barre : la barre du pilote en
// fonction du temps ; jusqua : on s'arrête dès que c'est vrai — et la fonction rend quand ;
// voilier : ce qu'on veut changer au bateau pour rire, le foc qui bat…)
function tourner(sy, t, { eau = { cale: 0, cockpit: 0 }, vent = 38, mer = 5, heure = 26, barre = (s) => 0.1 * Math.sin(s * 2), jusqua = null, voilier = {} } = {}) {
  const b = { ...bateau(), ...voilier };
  const evts = [];
  evts.quand = null;
  for (let s = 0; s < t; s += pas) {
    b.barre = barre(s);
    for (const e of sy.maj(pas, { physique: b, eau, heure, mer, vent })) evts.push(e[0]);
    if (jusqua?.(sy)) {
      evts.quand = s;
      break;
    }
  }
  return evts;
}
const pourcent = (x) => `${Math.round(x * 100)} %`;

console.log('La batterie');
{
  const sy = new Systemes();
  tourner(sy, 1);
  const a = -sy.batterie.courant;
  verifier(a > 8 && a < 25, `tout en marche, le bord tire ${a.toFixed(1)} A`);
  const avant = sy.batterie.charge;
  tourner(sy, 120);
  const perte = avant - sy.batterie.charge;
  verifier(perte > 0.15 && perte < 0.45, `en une heure de la nuit (deux minutes), elle perd ${pourcent(perte)}`);
  const tout = sy.consommation();
  for (const nom of ['radar', 'traceur', 'feux', 'vhf']) sy.basculerDisjoncteur(nom);
  const economie = tout - sy.consommation();
  verifier(Math.abs(economie - (CONSO.radar + CONSO.traceur + CONSO.feux + CONSO.vhf)) < 1.5, `couper le radar, le traceur, les feux et la VHF : ${economie.toFixed(1)} A de moins`);
  sy.batterie.charge = 0.01;
  const evts = tourner(sy, 30);
  verifier(!sy.courant && evts.includes('batterie-vide') && evts.includes('noir'), 'vide, plus de courant : tout s\'éteint');
  verifier(!sy.piloteEnMarche && !sy.alimente('radar'), 'et le pilote, le radar s\'arrêtent');
}

console.log('Le moteur');
{
  const sy = new Systemes();
  verifier(sy.demarrerMoteur() === 'ok' && sy.moteur.etat === 'lancement', 'on appuie : le démarreur lance');
  const evts = tourner(sy, MOTEUR.lancement + 0.2, { mer: 3 });
  verifier(sy.moteurEnMarche && evts.includes('moteur-demarre'), 'il démarre en deux secondes et demie');
  tourner(sy, 1, { mer: 3 });
  verifier(sy.batterie.courant > 20, `il recharge la batterie (+${Math.round(sy.batterie.courant)} A)`);
  verifier(sy.regime > 0.5, 'et il pousse le bateau (la physique reçoit son régime)');
  const coupe = tourner(sy, 400, { mer: 6.5, jusqua: (x) => !x.moteurEnMarche }).quand;
  verifier(coupe !== null && coupe > 90 && coupe < 330, `dans la grosse mer, il chauffe et se coupe tout seul (au bout de ${coupe === null ? '—' : Math.round(coupe)} s)`);
  verifier(sy.demarrerMoteur() === 'chaud', 'tant qu\'il est chaud, il refuse de repartir');
  const froid = tourner(sy, 200, { jusqua: (x) => x.moteur.temperature < MOTEUR.refroidi }).quand;
  verifier(froid !== null && froid < 120, `il refroidit (repartable au bout de ${froid === null ? '—' : Math.round(froid)} s)`);
  const faible = new Systemes();
  faible.batterie.charge = BATTERIE.demarrage - 0.02;
  verifier(faible.demarrerMoteur() === 'batterie', 'la batterie trop faible : le démarreur ne le lance pas');
}

console.log('Le pilote');
{
  const sy = new Systemes();
  sy.pilote.temperature = 0.3;
  tourner(sy, 120, { vent: 32, heure: 24 });
  const calme = sy.pilote.temperature;
  verifier(calme < 0.85 && !sy.pilote.disjoncte, `par 32 nœuds, à minuit, il tient (${pourcent(calme)})`);
  const chaud = new Systemes();
  chaud.pilote.temperature = 0.6;
  const saute = tourner(chaud, 400, { vent: 46, heure: 29, jusqua: (x) => x.pilote.disjoncte }).quand;
  verifier(saute !== null, `par 46 nœuds, à 5 h, il chauffe jusqu'à disjoncter (au bout de ${saute === null ? '—' : Math.round(saute)} s)`);
  verifier(chaud.rearmerPilote() === 'chaud', 'son disjoncteur ne se réarme pas tant qu\'il est chaud');
  const pret = tourner(chaud, 120, { vent: 46, heure: 29, jusqua: (x) => x.pilote.temperature < PILOTE.rearmement }).quand;
  verifier(pret !== null && pret < 60, `il refroidit (réarmable au bout de ${pret === null ? '—' : Math.round(pret)} s)`);
  verifier(chaud.rearmerPilote() === 'ok' && chaud.piloteEnMarche, 'puis il se réarme, et reprend la barre');
  // le moteur le soulage
  const seul = new Systemes();
  const aide = new Systemes();
  aide.demarrerMoteur();
  tourner(seul, 100, { vent: 44, heure: 28 });
  tourner(aide, 100, { vent: 44, heure: 28, mer: 3 });
  verifier(aide.pilote.temperature < seul.pilote.temperature - 0.05, `le moteur le soulage (${pourcent(aide.pilote.temperature)} au lieu de ${pourcent(seul.pilote.temperature)})`);
  // en veille, il refroidit
  const veille = new Systemes();
  veille.pilote.temperature = 0.9;
  veille.basculerPilote();
  tourner(veille, 30);
  verifier(!veille.piloteEnMarche && veille.pilote.temperature < 0.7, `en veille, il ne tient plus la barre, et refroidit (${pourcent(veille.pilote.temperature)} en 30 s)`);
}

console.log('La pompe électrique et l\'eau');
{
  const sy = new Systemes();
  const eau = { cale: 200, cockpit: 0 };
  tourner(sy, 1, { eau });
  verifier(sy.pompe.marche, 'au-dessus de 60 L, son flotteur la met en route');
  tourner(sy, 120, { eau });
  verifier(eau.cale < 20 && !sy.pompe.marche, `elle vide la cale (${Math.round(eau.cale)} L) et s'arrête`);
  sy.basculerDisjoncteur('pompe');
  eau.cale = 200;
  tourner(sy, 30, { eau });
  verifier(eau.cale === 200, 'son disjoncteur coupé : elle ne pompe plus');
  const noyee = new Systemes();
  noyee.batterie.charge = 0.8;
  noyee.basculerDisjoncteur('pompe');
  const eau2 = { cale: EAU_BATTERIES.noyees + 20, cockpit: 0 };
  const evts = tourner(noyee, 1, { eau: eau2 });
  verifier(noyee.batterie.coupee && evts.includes('batteries-noyees') && !noyee.courant, 'l\'eau atteint les batteries : le coupe-batterie saute, plus de courant');
  verifier(Math.abs(noyee.batterie.charge - 0.4) < 0.02, `et elles perdent la moitié de leur charge (${pourcent(noyee.batterie.charge)})`);
  verifier(noyee.rearmerBatterie(eau2.cale) === 'eau', 'tant que l\'eau les baigne, on ne réarme pas');
  eau2.cale = EAU_BATTERIES.mouillees - 50;
  verifier(noyee.rearmerBatterie(eau2.cale) === 'ok' && noyee.courant, 'l\'eau redescendue, le courant revient');
}

console.log('Les vitres et les volets');
{
  verifier(exposition('arriere', 170, 1) > 0.8 && exposition('avant', 170, 1) === 0 && exposition('tribord', 90, 1) === 1 && exposition('babord', 90, 1) === 0, 'une vague de l\'arrière frappe l\'arrière ; de travers tribord, le côté tribord');
  const sy = new Systemes({ hasard: () => 0.5 });
  let entree = 0;
  for (let k = 0; k < 2; k++) entree += sy.frapper(1, 170, 1, 0.9);
  const arriere = sy.vitres.filter((v) => v.cote === 'arriere');
  verifier(arriere.every((v) => v.etat !== 'ok') && sy.vitres.filter((v) => v.cote === 'avant').every((v) => v.etat === 'ok'), `deux grosses vagues de l'arrière : les fenêtres arrière ${arriere.map((v) => v.etat).join(', ')}, le pare-brise intact`);
  for (let k = 0; k < 2; k++) entree += sy.frapper(1, 170, 1, 0.9);
  verifier(arriere.every((v) => v.etat === 'brisee') && entree > 50, `encore deux : elles éclatent, et la mer entre (${Math.round(entree)} L)`);
  const encore = sy.frapper(1, 170, 1, 0.9);
  verifier(encore > 40, `chaque vague suivante, par les trous (${Math.round(encore)} L)`);
  sy.fermerVolets('arriere', true);
  tourner(sy, 3);
  verifier(sy.volets.arriere.fraction === 1, 'les volets descendent en deux secondes et demie');
  const bouche = sy.frapper(1, 170, 1, 0.9);
  verifier(bouche < encore * 0.3, `fermés, ils bouchent presque les trous (${Math.round(bouche)} L)`);
  const abri = new Systemes({ hasard: () => 0.5 });
  abri.fermerVolets('tribord', true);
  tourner(abri, 3);
  for (let k = 0; k < 6; k++) abri.frapper(1.2, 90, 1, 1);
  verifier(abri.vitres.filter((v) => v.cote === 'tribord').every((v) => v.etat === 'ok'), 'derrière leurs volets fermés, les vitres ne craignent rien');
  const vague = new Systemes({ hasard: () => 0.5 });
  vague.frapper(1.3, 95, -1, 1, { scelerate: true });
  verifier(vague.vitres.filter((v) => v.cote === 'babord').every((v) => v.etat === 'brisee'), 'la vague scélérate brise d\'un coup les vitres de son côté');
  const sansCourant = new Systemes();
  sansCourant.batterie.charge = 0;
  verifier(!sansCourant.fermerVolets('avant', true), 'sans courant, les volets ne bougent pas');
}

console.log('Les volets, les portes de FNAF');
{
  const sy = new Systemes({ hasard: () => 0.5 });
  sy.basculerDisjoncteur('pilote'); // (sans le pilote, ce que tire le bord ne bouge plus)
  tourner(sy, 1);
  const ouverts = sy.consommation();
  sy.fermerVolets('arriere', true);
  sy.fermerVolets('tribord', true);
  tourner(sy, 3);
  const tenus = sy.consommation() - ouverts;
  verifier(Math.abs(tenus - 2 * CONSO.voletsTenus) < 0.05, `fermés, leurs moteurs les tiennent : deux côtés tirent ${tenus.toFixed(1).replace('.', ',')} A de plus`);
  sy.basculerDisjoncteur('volets');
  verifier(sy.protection('arriere') === 0.5 && Math.abs(sy.consommation() - ouverts) < 0.05, 'leur disjoncteur coupé, ils ne tirent plus rien… et ne protègent plus qu\'à moitié');
  for (let k = 0; k < 2; k++) sy.frapper(1, 170, 1, 0.9);
  const forcees = sy.vitres.filter((v) => v.cote === 'arriere');
  const tenue = new Systemes({ hasard: () => 0.5 });
  tenue.fermerVolets('arriere', true);
  tourner(tenue, 3);
  for (let k = 0; k < 2; k++) tenue.frapper(1, 170, 1, 0.9);
  verifier(forcees.some((v) => v.integrite < 1) && tenue.vitres.filter((v) => v.cote === 'arriere').every((v) => v.integrite === 1),
    `deux grosses vagues : derrière des volets tenus, rien ; derrière des volets que plus rien ne tient, les vitres s'abîment (${forcees.map((v) => pourcent(v.integrite)).join(', ')})`);
}

console.log('Ce qui fait forcer le pilote');
{
  const travail = (options) => {
    const sy = new Systemes();
    tourner(sy, 30, { vent: 40, barre: () => 0, ...options });
    return sy.pilote.travail;
  };
  const base = travail({});
  const foc = travail({ voilier: { ecouteFocLibre: true, deroule: 0.15 } });
  const plein = travail({ eau: { cale: 0, cockpit: 750 } });
  verifier(Math.abs(foc / base - PILOTE.focBat) < 0.01, `le foc qui bat secoue le bateau : le pilote force ${(foc / base).toFixed(2).replace('.', ',')} fois plus`);
  verifier(plein / base > 1.8 && travail({ eau: { cale: 0, cockpit: 250 } }) === base, `le cockpit plein d'eau (750 L) alourdit l'arrière : ${(plein / base).toFixed(2).replace('.', ',')} fois plus (rien sous 300 L)`);
}

console.log('Garder, reprendre');
{
  const sy = new Systemes({ hasard: () => 0.5 });
  sy.batterie.charge = 0.42;
  sy.basculerDisjoncteur('radar');
  sy.frapper(1.3, 95, 1, 1, { scelerate: true });
  sy.fermerVolets('avant', true);
  const s = JSON.parse(JSON.stringify(sy.instantane()));
  const r = new Systemes();
  r.restaurer(s);
  verifier(Math.abs(r.batterie.charge - 0.42) < 1e-9 && !r.disjoncteurs.radar && r.vitres.filter((v) => v.etat === 'brisee').length === 2 && r.volets.avant.fraction === 1,
    'une heure gardée : la batterie, les disjoncteurs, les vitres et les volets reviennent comme ils étaient');
}

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
