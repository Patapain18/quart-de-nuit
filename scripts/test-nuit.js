// La nuit de tempête jouée par trois marins automatiques, sans navigateur :
//   node scripts/test-nuit.js            (une mer plus grossière : ≈ 1 min)
//   node scripts/test-nuit.js --fine     (la mer à pleine résolution : ≈ 3 min)
// Les trois marins (src/jeu/marins.js : le prudent, le moyen, l'imprudent) font la même
// nuit. On vérifie que le prudent voit l'aube, que l'imprudent ne la voit pas, et que la
// nuit se déroule comme prévu (la trombe, le cargo, les avaries, l'eau…).
import { jouerLaNuit } from '../src/jeu/marins.js';
import { HEURE_AUBE } from '../src/jeu/nuit.js';
import { heureEnTexte } from '../src/jeu/journee.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};

const debut = performance.now();
let derniere = 0;
const resultats = jouerLaNuit({
  graine: 3,
  fine: process.argv.includes('--fine'),
  surProgres: (nuit, t) => {
    if (t - derniere < 120) return;
    derniere = t;
    console.log(`  ${heureEnTexte(nuit.heure).padStart(8)} · vent ${nuit.meteo.vent.toFixed(0)} nds`);
  },
});
const duree = resultats[0].serie.t.at(-1) ?? 0;
console.log(`(${((performance.now() - debut) / 1000).toFixed(0)} s de calcul pour ${(duree / 60).toFixed(1)} min de nuit)`);

for (const r of resultats) {
  const s = r.stats;
  console.log(`\n${r.nom} : ${r.fin === 'aube' ? 'a vu l\'aube' : `perdu à ${heureEnTexte(r.heureFin)} (${r.fin})`}`);
  console.log(`  ${s.deferlantes} déferlantes, ${s.coups} l'ont couché, gîte max ${Math.round(s.giteMax)}°, couché ${s.couche.toFixed(1)} s`);
  console.log(`  eau : ${Math.round(s.caleMax)} L au plus dans la cale, ${Math.round(s.pompee)} L pompés · ${(s.distance / 1852).toFixed(1)} milles, ${s.vitesseMax.toFixed(1)} nds au plus`);
  console.log(`  trombe à ${Math.round(s.trombeDistance)} m · cargo à ${Math.round(s.cargoDistance)} m${s.cargoAppele ? ' (appelé)' : ''} · avaries : ${r.avaries.map((a) => `${heureEnTexte(a.heure)} ${a.nom}`).join(', ') || 'aucune'}`);
  console.log(`  vagues scélérates : ${r.scelerates.map((v) => `${heureEnTexte(v.heure)} prise à ${Math.round(v.angle)}°, gîte ${Math.round(v.gite)}°`).join(' · ') || 'aucune'}`);
}
const [prudent, moyen, imprudent] = resultats;
console.log('');
verifier(resultats.every((r) => r.fin !== 'instable'), 'la simulation reste stable toute la nuit');
verifier(prudent.fin === 'aube', 'le prudent voit l\'aube');
verifier(prudent.stats.coups <= 2 && prudent.stats.caleMax < 600, 'le prudent n\'est presque jamais couché et garde le bateau au sec');
verifier(imprudent.fin !== 'aube', 'l\'imprudent ne voit pas l\'aube');
verifier(moyen.fin === 'aube' || moyen.heureFin > imprudent.heureFin, 'le moyen tient plus longtemps que l\'imprudent');
verifier(prudent.nuit.faits.has('trombe') && prudent.stats.trombeDistance > 150, 'la trombe est passée, et le prudent s\'en est écarté');
verifier(prudent.nuit.faits.has('cargo') && prudent.stats.cargoAppele && prudent.stats.cargoDistance > 150, 'le cargo est passé au large du prudent, qui l\'a appelé');
verifier(prudent.avaries.some((a) => a.nom === 'ecouteFoc') && prudent.reparees.ecouteFoc === 'reparee', 'l\'écoute de foc a cassé, et le prudent l\'a remplacée');
verifier(prudent.stats.deferlantes >= 12, 'des déferlantes toute la nuit (au moins 12)');
verifier(prudent.scelerates.length === 3, 'trois vagues scélérates sont passées sur le prudent');
verifier(prudent.scelerates.every((v) => v.angle > 140), 'le prudent les a toutes prises par l\'arrière (à plus de 140°)');
verifier(prudent.stats.sceleratesCouche <= 1, 'elles ne l\'ont pas couché (une fois au plus)');
verifier(prudent.heureFin >= HEURE_AUBE, 'la nuit va jusqu\'à 6 h');

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
