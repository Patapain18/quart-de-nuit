// Le voilier dans la tempête, sans navigateur : node scripts/test-tempete.js
// Au plus fort de la nuit (40 nœuds de vent moyen, rafales à 50, vagues de 5 m, et des
// déferlantes), on vérifie que la physique reste stable, et surtout que les bons choix
// protègent vraiment : réduire la toile, et ne pas prendre les vagues de travers.
import { PhysiqueVoilier } from '../src/physique/voilier.js';
import { reglerAutomatiquement } from '../src/physique/regleur.js';
import { Houle } from '../src/mer/houle.js';
import { Vent } from '../src/monde/vent.js';
import { Deferlantes } from '../src/monde/deferlantes.js';
import { AMBIANCES, etatMeteo, etatMer } from '../src/monde/meteo.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};

const meteo = etatMeteo(AMBIANCES['nuit-tempete']);

// Une tempête est chaotique : un bateau se couche, ou pas, pour un rien. On fait donc
// naviguer tous les bateaux ensemble (sur la même mer, sous les mêmes déferlantes) et
// on recommence sur trois mers différentes, puis on compare les moyennes.
const SCENARIOS = [
  { cle: 'fuiteFoc', nom: 'en fuite (165°), sans grand-voile, foc 25 %', angle: 165, ris: 3, deroule: 0.25 },
  { cle: 'fuite', nom: 'en fuite (150°), 2 ris, foc 30 %', angle: 150, ris: 2, deroule: 0.3 },
  { cle: 'pres', nom: 'au près (55°), 2 ris, foc 50 %', angle: 55, ris: 2, deroule: 0.5 },
  { cle: 'travers', nom: 'de travers (90°), 2 ris, foc 30 %', angle: 90, ris: 2, deroule: 0.3 },
  { cle: 'imprudentPres', nom: 'au près (55°), toute la toile', angle: 55, ris: 0, deroule: 1 },
  { cle: 'imprudentFuite', nom: 'en fuite (150°), toute la toile', angle: 150, ris: 0, deroule: 1 },
];
const MERS = [9, 21, 33];
const DUREE = 180; // secondes par mer (les 20 premières ne comptent pas)

function naviguer(graine) {
  const houle = new Houle({ graine });
  houle.regler(etatMer(meteo));
  const bateaux = SCENARIOS.map((sc, k) => {
    const b = new PhysiqueVoilier();
    b.placer(0, k * 400, (meteo.directionVent + sc.angle) % 360, houle);
    b.ris = sc.ris;
    b.deroule = sc.deroule;
    return {
      sc, b, vent: new Vent(11 + k), deferlantes: new Deferlantes(graine * 7),
      giteMax: 0, couche: 0, gite45: 0, giteSomme: 0, somme: 0, n: 0, valide: true, chocs: 0, coups: 0, giteChoc: 0, apresChoc: 0,
    };
  });
  for (let i = 0; i < DUREE * 60; i++) {
    const t = i / 60;
    houle.calculer(t, 1 / 60);
    for (const e of bateaux) {
      if (!e.valide) continue;
      const { b, sc } = e;
      const m = b.mesures;
      // pilote : garder l'angle au vent réel (et si le bateau recule, après un coup de
      // vent debout, le safran agit à l'envers : on barre à l'envers)
      const erreur = (Math.abs(m.angleVentReel) - sc.angle) * Math.sign(m.angleVentReel || 1);
      const sens = b.vitesse.dot(b.avant) < -0.2 ? -1 : 1;
      b.barre = sens * Math.max(-0.55, Math.min(0.55, erreur * 0.025 + b.rotation.y * 1.5));
      reglerAutomatiquement(b, 1 / 60);
      const vent = e.vent.maj(t, 1 / 60, meteo, 0, b.position.x, b.position.z);
      const frappe = e.deferlantes.maj(1 / 60, meteo);
      if (frappe) {
        b.deferlante(frappe.vers, frappe.force);
        e.chocs++;
        e.apresChoc = 4; // on regarde la gîte dans les 4 secondes qui suivent
        e.giteChoc = 0;
      }
      if (e.apresChoc > 0) {
        e.apresChoc -= 1 / 60;
        e.giteChoc = Math.max(e.giteChoc, Math.abs(m.gite));
        if (e.apresChoc <= 0 && e.giteChoc > 60) e.coups++; // une déferlante l'a couché à plus de 60°
      }
      b.avancer(1 / 60, houle, vent, 4);
      if (b.reprises || !Number.isFinite(b.position.x)) { e.valide = false; continue; }
      if (t > 20) {
        e.giteMax = Math.max(e.giteMax, Math.abs(m.gite));
        if (Math.abs(m.gite) > 70) e.couche++;
        if (Math.abs(m.gite) > 45) e.gite45++;
        e.giteSomme += Math.abs(m.gite);
        e.somme += m.vitesse;
        e.n++;
      }
    }
  }
  return { hs: houle.hauteurSignificative, bateaux };
}

const resultats = Object.fromEntries(SCENARIOS.map((sc) => [sc.cle, { couche: 0, gite45: 0, giteMoy: 0, vitesse: 0, giteMax: 0, coups: 0, valide: true }]));
for (const graine of MERS) {
  const { hs, bateaux } = naviguer(graine);
  console.log(`Mer n° ${graine} : vent ${meteo.vent} nœuds, vagues Hs ${hs.toFixed(1)} m, ${bateaux[0].chocs} déferlantes`);
  for (const e of bateaux) {
    const vitesse = e.somme / Math.max(1, e.n);
    console.log(`  ${e.sc.nom.padEnd(46)} ${vitesse.toFixed(1)} nds · gîte moy. ${(e.giteSomme / Math.max(1, e.n)).toFixed(0)}° max ${e.giteMax.toFixed(0)}° · ${(e.gite45 / 60).toFixed(0)} s à plus de 45° · couché ${(e.couche / 60).toFixed(1)} s · ${e.coups} déferlante(s) à plus de 60°`);
    const r = resultats[e.sc.cle];
    r.coups += e.coups;
    r.gite45 += e.gite45 / 60 / MERS.length;
    r.giteMoy += e.giteSomme / Math.max(1, e.n) / MERS.length;
    r.couche += e.couche / 60 / MERS.length;
    r.vitesse += vitesse / MERS.length;
    r.giteMax = Math.max(r.giteMax, e.giteMax);
    r.valide &&= e.valide;
  }
}
console.log('En moyenne sur les trois mers :');
for (const sc of SCENARIOS) {
  const r = resultats[sc.cle];
  console.log(`  ${sc.nom.padEnd(46)} ${r.vitesse.toFixed(1)} nds · gîte moy. ${r.giteMoy.toFixed(0)}° · ${r.gite45.toFixed(0)} s sur 160 à plus de 45° · couché ${r.couche.toFixed(1)} s · ${r.coups} coup(s) à plus de 60°`);
  verifier(r.valide, `${sc.nom} : la simulation reste stable`);
}
const R = resultats;
verifier(R.fuiteFoc.couche < 0.5 && R.fuiteFoc.coups === 0, 'en fuite sous un bout de foc : rien ne le couche (la meilleure tactique)');
verifier(R.fuiteFoc.vitesse < 10, 'sous un bout de foc, il ne file pas trop vite (moins de 10 nœuds en moyenne)');
verifier(R.fuite.couche < 1.5, 'en fuite, toile réduite : le bateau ne se couche presque jamais');
verifier(R.fuite.vitesse < 11, 'en fuite, il ne dépasse pas ~11 nœuds en moyenne (un croiseur ne déjauge pas)');
// (la toile de la nuit du jeu, c'est la fuite sous un bout de foc : le pilote qui lâche met le
// bateau en travers, et là, les déferlantes le couchent ; la fuite à deux ris, que le jeu
// n'utilise plus, est entre les deux)
verifier(R.travers.coups >= R.fuiteFoc.coups + 3 && R.travers.coups > R.fuite.coups, `prendre les vagues de travers est bien plus dangereux que fuir (les déferlantes le couchent : ${R.travers.coups} fois de travers, ${R.fuite.coups} en fuite à deux ris, ${R.fuiteFoc.coups} sous un bout de foc)`);
verifier(R.imprudentPres.gite45 > R.pres.gite45 * 2 + 3, 'au près, toute la toile, il passe bien plus de temps couché sur l\'eau qu\'avec 2 ris');
verifier(R.imprudentFuite.gite45 > R.fuite.gite45 * 2 + 2 || R.imprudentFuite.coups > R.fuite.coups, 'en fuite aussi, trop de toile le met en danger');

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
