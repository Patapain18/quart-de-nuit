// Le réglage de la vague scélérate : node scripts/reglage-scelerate.js
// Pour choisir sa forme (sa longueur d'onde, pour une hauteur donnée) et la force de sa
// crête qui s'écroule, on essaie plusieurs réglages à la fois — un processus par réglage,
// en parallèle — sur trois mers et trois façons de la prendre (droit derrière, de trois
// quarts, par la hanche), avec la vraie physique (la même que test-scelerate.js).
// Chaque ligne : la gîte au plus fort après le choc, mer par mer (« C » : couché).
//   node scripts/reglage-scelerate.js 20 7.4,8.5,9.5 0.69,0.6 0.35
//     (hauteur, longueurs par mètre de hauteur, forces du choc, leviers)
import { fork } from 'node:child_process';
import { Vector3 } from 'three';
import { fileURLToPath } from 'node:url';
import { PhysiqueVoilier } from '../src/physique/voilier.js';
import { reglerAutomatiquement } from '../src/physique/regleur.js';
import { Houle } from '../src/mer/houle.js';
import { Vent } from '../src/monde/vent.js';
import { AMBIANCES, etatMeteo, etatMer } from '../src/monde/meteo.js';
import { Scelerates } from '../src/monde/scelerates.js';

const meteo = etatMeteo(AMBIANCES['nuit-tempete']);
const ecartAngle = (a, b) => ((a - b + 540) % 360) - 180;
const FUITE = { allure: 165, ris: 3, deroule: 0.22 };
const FACONS = [['derrière', 180], ['3/4', 145], ['hanche', 115]];
const MERS = [5, 17, 29];

// Une mer, trois bateaux (un par façon de la prendre) ; renvoie la gîte maximale de chacun
function essayer(graine, { hauteur, parMetre, force, levier }) {
  const houle = new Houle({ graine });
  houle.regler(etatMer(meteo));
  const bateaux = FACONS.map(([, vague], k) => {
    const b = new PhysiqueVoilier();
    b.placer(k * 4000, 0, (meteo.directionVent + FUITE.allure) % 360, houle);
    b.vitesse.copy(b.avant).multiplyScalar(3);
    b.ris = FUITE.ris;
    b.deroule = FUITE.deroule;
    return { vague, b, vent: new Vent(31 + k + graine), sc: new Scelerates(houle), apres: -1, gite: 0, fini: false };
  });
  for (let i = 0; bateaux.some((e) => !e.fini) && i < 400 * 60; i++) {
    const t = i / 60;
    houle.calculer(t, 1 / 60);
    for (const e of bateaux) {
      if (e.fini) continue;
      const { b } = e;
      const m = b.mesures;
      const erreur = ecartAngle(Math.abs(m.angleVentReel), FUITE.allure) * Math.sign(m.angleVentReel || 1);
      const sens = b.vitesse.dot(b.avant) < -0.2 ? -1 : 1;
      b.barre = sens * Math.max(-0.55, Math.min(0.55, erreur * 0.025 + b.rotation.y * 1.5));
      reglerAutomatiquement(b, 1 / 60);
      if (Math.abs(t - 15) < 1e-6) {
        const cote = Math.sign(m.angleVentReel || 1);
        const depuis = ((m.cap + cote * e.vague) * Math.PI) / 180;
        e.sc.lancer({ x: b.position.x, z: b.position.z, dx: -Math.sin(depuis), dz: Math.cos(depuis), hauteur, longueur: Math.round(hauteur * parMetre) });
      }
      for (const etape of e.sc.maj(1 / 60, b.position.x, b.position.z)) {
        if (etape === 'choc') {
          const v = e.sc.vague.v;
          b.deferlante(new Vector3(v.dx, 0, v.dz), force * Math.max(0.4, v.deferle), { levier, duree: 1 });
          e.apres = 12;
        }
      }
      b.avancer(1 / 60, houle, e.vent.maj(t, 1 / 60, meteo, 0, b.position.x, b.position.z), 4);
      if (b.reprises || !Number.isFinite(b.position.x)) { e.gite = NaN; e.fini = true; continue; }
      if (e.apres > 0) {
        e.apres -= 1 / 60;
        e.gite = Math.max(e.gite, Math.abs(m.gite), m.chavire ? 90 : 0);
        if (e.apres <= 0) e.fini = true;
      }
    }
  }
  return bateaux.map((e) => e.gite);
}

if (process.argv[2] === '--un') {
  // (un processus enfant : un réglage, les trois mers)
  const r = JSON.parse(process.argv[3]);
  const gites = MERS.map((g) => essayer(g, r));
  process.send({ r, gites });
} else {
  const [hauteur = '20', parMetres = '7.4', forces = '0.69', leviers = '0.35'] = process.argv.slice(2);
  const reglages = [];
  for (const parMetre of parMetres.split(',').map(Number)) {
    for (const force of forces.split(',').map(Number)) {
      for (const levier of leviers.split(',').map(Number)) reglages.push({ hauteur: Number(hauteur), parMetre, force, levier });
    }
  }
  const ici = fileURLToPath(import.meta.url);
  const debut = Date.now();
  const resultats = await Promise.all(reglages.map((r) => new Promise((ok) => {
    const p = fork(ici, ['--un', JSON.stringify(r)]);
    p.on('message', ok);
  })));
  for (const { r, gites } of resultats) {
    const col = FACONS.map(([nom], k) => `${nom} ${MERS.map((_, g) => { const v = gites[g][k]; return v > 70 ? `C${Math.round(v)}` : Math.round(v); }).join('/')}`);
    console.log(`H ${r.hauteur} m, L ${Math.round(r.hauteur * r.parMetre)} m (×${r.parMetre}), choc ${r.force}, levier ${r.levier} : ${col.join('  ·  ')}`);
  }
  console.log(`(${Math.round((Date.now() - debut) / 1000)} s)`);
}
