// Les vagues scélérates, sans navigateur : node scripts/test-scelerate.js
// Au plus fort de la nuit (40 nœuds, une mer de 5 m), une vague de 20 m arrive sur le
// bateau. On vérifie que la physique tient, que la vague est bien là (le bateau monte et
// descend de 13 à 32 m, avec les vagues de la mer), qu'on la passe en la prenant par
// l'arrière — un grand coup, pas plus —, le plus souvent de trois quarts, et qu'elle couche
// le bateau par la hanche ou de travers.
import { PhysiqueVoilier } from '../src/physique/voilier.js';
import { reglerAutomatiquement } from '../src/physique/regleur.js';
import { Houle } from '../src/mer/houle.js';
import { Vent } from '../src/monde/vent.js';
import { AMBIANCES, etatMeteo, etatMer } from '../src/monde/meteo.js';
import { Scelerates, chocScelerate } from '../src/monde/scelerates.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const ecartAngle = (a, b) => ((a - b + 540) % 360) - 180;

const meteo = etatMeteo(AMBIANCES['nuit-tempete']);
// allure : l'angle du vent réel ; vague : d'où elle vient, par rapport à l'avant (180 : droit
// derrière), du côté du vent ; toile : celle que conseille Jos pour cette allure
const FUITE = { ris: 3, deroule: 0.22 };
const SCENARIOS = [
  { cle: 'arriere', nom: 'en fuite (165°), la vague droit derrière', allure: 165, vague: 180, ...FUITE },
  { cle: 'troisQuarts', nom: 'en fuite, la vague de trois quarts arrière (145°)', allure: 165, vague: 145, ...FUITE },
  { cle: 'hanche', nom: 'en fuite, la vague par la hanche (115°)', allure: 165, vague: 115, ...FUITE },
  { cle: 'croisee', nom: 'en fuite, une vague croisée, de travers (90°)', allure: 165, vague: 90, ...FUITE },
  { cle: 'travers', nom: 'de travers au vent (90°), la vague de travers', allure: 90, vague: 90, ris: 2, deroule: 0.3 },
  { cle: 'face', nom: 'au près (55°), la vague presque de face (35°)', allure: 55, vague: 35, ris: 2, deroule: 0.5 },
];
const MERS = [5, 17, 29];
const HAUTEUR = Number(process.env.HAUTEUR) || 20; // m (HAUTEUR=22 npm run test-scelerate : une autre)
const LANCER = 15; // s : le temps que les bateaux se posent
const APRES = 12; // s : on regarde ce que fait le bateau après le choc

function naviguer(graine) {
  const houle = new Houle({ graine });
  houle.regler(etatMer(meteo));
  const bateaux = SCENARIOS.map((sc, k) => {
    const b = new PhysiqueVoilier();
    // (chacun loin des autres : chaque vague ne passe que sur son bateau)
    b.placer(k * 4000, 0, (meteo.directionVent + sc.allure) % 360, houle);
    b.vitesse.copy(b.avant).multiplyScalar(3);
    b.ris = sc.ris;
    b.deroule = sc.deroule;
    return {
      sc, b, vent: new Vent(31 + k + graine), scelerates: new Scelerates(houle), valide: true,
      choc: null, apres: -1, giteMax: 0, tangageMax: 0, chavire: false, hMin: Infinity, hMax: -Infinity, vitesseMax: 0,
      fini: false, giteAvant: 0, nAvant: 0,
    };
  });
  for (let i = 0; bateaux.some((e) => !e.fini) && i < 400 * 60; i++) {
    const t = i / 60;
    houle.calculer(t, 1 / 60);
    for (const e of bateaux) {
      if (e.fini || !e.valide) continue;
      const { b, sc } = e;
      const m = b.mesures;
      // le pilote garde l'allure (et barre à l'envers si le bateau recule)
      const erreur = ecartAngle(Math.abs(m.angleVentReel), sc.allure) * Math.sign(m.angleVentReel || 1);
      const sens = b.vitesse.dot(b.avant) < -0.2 ? -1 : 1;
      b.barre = sens * Math.max(-0.55, Math.min(0.55, erreur * 0.025 + b.rotation.y * 1.5));
      reglerAutomatiquement(b, 1 / 60);
      // la vague : on la lance du côté du vent, à l'angle voulu
      if (Math.abs(t - LANCER) < 1e-6) {
        const cote = Math.sign(m.angleVentReel || 1);
        const depuis = ((m.cap + cote * sc.vague) * Math.PI) / 180; // d'où elle vient (cap compas)
        // (cap compas → monde : nord = −z, est = +x ; elle va à l'opposé)
        e.scelerates.lancer({ x: b.position.x, z: b.position.z, dx: -Math.sin(depuis), dz: Math.cos(depuis), hauteur: HAUTEUR });
      }
      for (const etape of e.scelerates.maj(1 / 60, b.position.x, b.position.z)) {
        if (etape === 'choc') {
          e.choc = chocScelerate(b, e.scelerates);
          e.apres = APRES;
        }
      }
      const vent = e.vent.maj(t, 1 / 60, meteo, 0, b.position.x, b.position.z);
      b.avancer(1 / 60, houle, vent, 4);
      if (b.reprises || !Number.isFinite(b.position.x)) { e.valide = false; e.fini = true; continue; }
      if (t > LANCER && e.scelerates.active) {
        // la hauteur de l'eau sous le bateau (au centre), pendant le passage
        const h = houle.hauteur(b.position.x, b.position.z);
        if (Math.abs(e.scelerates.vague.distance) < 160) {
          e.hMin = Math.min(e.hMin, h);
          e.hMax = Math.max(e.hMax, h);
        }
        if (e.scelerates.vague.distance > 300) {
          e.giteAvant += Math.abs(m.gite);
          e.nAvant++;
        }
      }
      if (e.apres > 0) {
        e.apres -= 1 / 60;
        e.giteMax = Math.max(e.giteMax, Math.abs(m.gite));
        e.tangageMax = Math.max(e.tangageMax, Math.abs(m.tangage ?? 0));
        e.vitesseMax = Math.max(e.vitesseMax, m.vitesse);
        if (m.chavire) e.chavire = true;
        if (e.apres <= 0) e.fini = true;
      }
    }
  }
  return bateaux;
}

console.log(`Les vagues scélérates (${HAUTEUR} m) dans la tempête (40 nœuds)\n`);
const debut = Date.now();
const resultats = {};
for (const graine of MERS) {
  for (const e of naviguer(graine)) {
    const r = (resultats[e.sc.cle] ??= { sc: e.sc, mers: [] });
    r.mers.push(e);
  }
}
for (const { sc, mers } of Object.values(resultats)) {
  console.log(`${sc.nom} :`);
  for (const e of mers) {
    const c = e.choc;
    console.log(`    gîte max ${e.giteMax.toFixed(0)}° (avant : ${(e.giteAvant / Math.max(1, e.nAvant)).toFixed(0)}° en moyenne), ${e.chavire ? 'mât à l\'horizontale, ' : ''}vitesse max ${e.vitesseMax.toFixed(1)} nds, l'eau sous lui de ${e.hMin.toFixed(1)} à ${e.hMax.toFixed(1)} m${c ? ` ; choc ${c.force.toFixed(2)} à ${c.angle.toFixed(0)}°, ${Math.round(c.cockpit)} L` : ' ; PAS DE CHOC'}${e.valide ? '' : ' ; INSTABLE'}`);
  }
}
console.log('');
const tous = Object.values(resultats).flatMap((r) => r.mers);
verifier(tous.every((e) => e.valide), 'la physique reste stable (aucune reprise, aucun nombre perdu)');
verifier(tous.every((e) => e.choc), 'chaque vague arrive jusqu\'au bateau (le choc a lieu)');
// (de travers, le bateau glisse parfois le long de la crête au lieu de la franchir)
verifier(tous.every((e) => e.hMax - e.hMin > 0.65 * HAUTEUR && e.hMax - e.hMin < 1.6 * HAUTEUR), `le bateau monte et descend de ${Math.round(0.65 * HAUTEUR)} à ${Math.round(1.6 * HAUTEUR)} m en la passant (la vague, plus celles de la mer)`);
const couche = (e) => e.giteMax > 70 || e.chavire;
const r = (cle) => resultats[cle].mers;
verifier(r('arriere').every((e) => e.giteMax < 50 && !e.chavire), 'droit derrière : un grand coup, mais pas plus (gîte < 50°)');
verifier(r('troisQuarts').filter((e) => e.giteMax < 70 && !e.chavire).length >= 2, 'de trois quarts arrière : ça passe le plus souvent (au moins 2 fois sur 3, gîte < 70°)');
verifier(r('hanche').filter(couche).length >= 2, 'par la hanche (115°) : couché (au moins 2 fois sur 3)');
verifier(r('travers').filter(couche).length >= 2, 'de travers : elle couche le bateau (au moins 2 fois sur 3)');
verifier(r('croisee').filter(couche).length >= 2, 'une vague croisée de travers, même en fuite : couché (au moins 2 fois sur 3)');
console.log(`\n(${Math.round((Date.now() - debut) / 1000)} s)`);
console.log(echecs ? `${echecs} vérification(s) en échec.` : 'Tout est bon.');
process.exit(echecs ? 1 : 0);
