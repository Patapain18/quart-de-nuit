// La nuit de tempête, sans navigateur : node scripts/test-nuit.js
// Trois veilleurs automatiques (src/quart/veilleurs.js) font toute la nuit, de minuit à six
// heures, avec la vraie physique : l'attentif, le distrait, l'absent. On vérifie que la nuit
// dure ce qu'elle doit, que le temps empire d'heure en heure, que ce qui doit arriver arrive
// (les grains, la trombe, les deux vagues scélérates, les avaries), que les systèmes du bord
// font leur travail (la batterie, le moteur, le pilote qui chauffe, les vitres), que qui ne
// fait rien coule, que chaque heure est gardée et qu'on peut la reprendre.
import { jouerLaNuit } from '../src/quart/veilleurs.js';
import { meteoDeLaNuit, heureEnTexte, HEURE_DEBUT, HEURE_AUBE, DUREE_HEURE } from '../src/quart/nuit.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;

// ---------- Le temps qu'il fait ----------
console.log('Le temps, d\'heure en heure');
const vents = [24, 25, 26, 27, 28, 29, 29.6].map((h) => meteoDeLaNuit(h).vent);
console.log(`  le vent : ${vents.map((v) => Math.round(v)).join(', ')} nœuds (minuit, 1 h… 5 h 36)`);
verifier(vents.every((v, i) => i === 0 || v >= vents[i - 1] - 0.5), 'il ne fait que monter jusqu\'au matin');
verifier(vents[0] > 30 && vents[0] < 34 && vents.at(-1) > 44, `de ${Math.round(vents[0])} nœuds à minuit à ${Math.round(vents.at(-1))} au plus fort`);
const tourne = meteoDeLaNuit(29.4).directionVent - meteoDeLaNuit(28).directionVent;
verifier(tourne > 15 && tourne < 35, `le front passe vers 4 h 30 : le vent tourne de ${Math.round(tourne)}°`);
verifier(meteoDeLaNuit(30.4).vent < meteoDeLaNuit(29.6).vent - 8, 'à six heures, il tombe enfin');

// ---------- La nuit entière ----------
console.log('\nToute la nuit, trois veilleurs (≈ 1 min)');
const debut = performance.now();
const resultats = jouerLaNuit({ graine: 3 });
console.log(`  (${Math.round((performance.now() - debut) / 1000)} s)`);
for (const r of resultats) {
  const s = r.stats;
  const sy = r.systemes;
  console.log(`  ${r.nom.padEnd(12)} ${r.fin === 'aube' ? 'a vu l\'aube' : `perdu (${r.fin}) à ${heureEnTexte(r.heureFin)}`} · ${s.deferlantes} déferlantes (couché ${s.coups} fois) · gîte max ${Math.round(s.giteMax)}° · eau à bord au plus ${Math.round(s.caleMax)} L · avaries : ${r.avaries.map((a) => `${a.nom} à ${heureEnTexte(a.heure)}`).join(', ') || 'aucune'}`);
  console.log(`  ${''.padEnd(12)} batterie au plus bas ${Math.round(sy.stats.chargeMin * 100)} %, ${Math.round(sy.stats.noir)} s dans le noir · moteur ${Math.round(sy.stats.moteur)} s · vitres brisées ${sy.stats.vitresBrisees}`);
}
const attentif = resultats.find((r) => r.cle === 'attentif');
const nuit = attentif.nuit;
verifier(attentif.fin === 'aube', 'l\'attentif voit le jour se lever');
verifier(Math.abs(attentif.serie.t.at(-1) - (HEURE_AUBE - HEURE_DEBUT) * DUREE_HEURE) < 10, `la nuit dure ${arrondi(attentif.serie.t.at(-1) / 60)} minutes de jeu (deux par heure)`);
const heures = attentif.journal.filter((j) => /^(Minuit|\d h)\./.test(j.texte)).map((j) => Math.floor(j.heure + 1e-6));
verifier([24, 25, 26, 27, 28, 29].every((h) => heures.includes(h)), `chaque heure sonne, et le journal la note (${heures.length} fois)`);
verifier(nuit.stats.grains >= 3, `les grains passent sur le bateau (${nuit.stats.grains}, rafales jusqu'à ${Math.round(nuit.stats.rafaleMax)} nœuds)`);
const trombe = attentif.journal.find((j) => j.texte.startsWith('Une trombe'));
verifier(trombe && trombe.heure > 27.2 && trombe.heure < 27.8, `la trombe naît vers 3 h 30 (${trombe ? heureEnTexte(trombe.heure) : 'pas vue'}), et passe à ${Math.round(nuit.stats.trombeDistance)} m`);
const scelerates = attentif.journal.filter((j) => j.texte.startsWith('Un grondement énorme'));
verifier(scelerates.length === 2 && scelerates[0].heure > 26.3 && scelerates[0].heure < 26.9 && scelerates[1].heure > 29 && scelerates[1].heure < 29.7,
  `deux vagues scélérates : ${scelerates.map((j) => heureEnTexte(j.heure)).join(' et ')}`);
verifier(attentif.avaries.some((a) => a.nom === 'pilote') && attentif.avaries.some((a) => a.nom === 'ecouteFoc'), 'le pilote lâche, l\'écoute de foc casse');
const pilotes = attentif.avaries.filter((a) => a.nom === 'pilote');
verifier(pilotes.length >= 2 && pilotes.every((a) => a.heure > 26), `le pilote lâche dans la seconde moitié de la nuit (${pilotes.length} fois : ${pilotes.map((a) => heureEnTexte(a.heure)).join(', ')})`);
const chaud = resultats.some((r) => r.journal.some((j) => j.texte.startsWith('Le pilote a trop chauffé')));
verifier(chaud, 'le pilote finit par trop chauffer, et disjoncte');
verifier(nuit.stats.eclairs > 100, `la foudre : ${nuit.stats.eclairs} éclairs, le plus proche à ${Math.round(nuit.stats.eclairPlusPres)} m`);
const etrange = ['Une voix sur le 16', 'Des coups contre la coque'].filter((t) => resultats.some((r) => r.journal.some((j) => j.texte.startsWith(t))));
verifier(etrange.length === 2, `l'étrange : ${etrange.join(', ').toLowerCase()}`);
const absent = resultats.find((r) => r.cle === 'absent');
// les systèmes du bord
const minAttentif = Math.min(...attentif.serie.batterie);
verifier(minAttentif > 0.25 && attentif.systemes.stats.noir === 0, `l'attentif garde du courant toute la nuit (sa batterie au plus bas : ${Math.round(minAttentif * 100)} %)`);
verifier(attentif.systemes.stats.moteur > 60, `il fait tourner le moteur (${Math.round(attentif.systemes.stats.moteur)} s) pour la recharger`);
const noirAbsent = absent.journal.find((j) => j.texte.startsWith('La batterie est vide'));
verifier(noirAbsent && noirAbsent.heure < 27.5, `l'absent n'a plus de courant ${noirAbsent ? `à ${heureEnTexte(noirAbsent.heure)}` : '— jamais ?'} (sans moteur, la batterie meurt)`);
verifier(absent.fin !== 'aube', `et il ne voit pas l'aube : ${absent.fin === 'aube' ? 'il la voit !' : `${absent.fin} à ${heureEnTexte(absent.heureFin)}`}`);
const brisees = resultats.filter((r) => r.cle !== 'attentif').reduce((n, r) => n + r.systemes.stats.vitresBrisees, 0);
verifier(brisees > 0 && attentif.systemes.stats.vitresBrisees <= 2, `qui ne ferme pas ses volets voit ses vitres éclater (${brisees} pour le distrait et l'absent, ${attentif.systemes.stats.vitresBrisees} pour l'attentif)`);
verifier(absent.stats.caleMax > 4 * Math.max(1, attentif.stats.caleMax), `qui ne pompe pas finit avec ${Math.round(absent.stats.caleMax)} L d'eau à bord (l'attentif : ${Math.round(attentif.stats.caleMax)} L)`);

// ---------- Reprendre une heure ----------
console.log('\nReprendre au début d\'une heure');
{
  const [r] = jouerLaNuit({ graine: 5, veilleurs: ['attentif'], heureMax: 27.5 });
  const n = r.nuit;
  const s = n.sauvegarde;
  verifier(s && s.heure === 27, `à 3 h 30, la nuit a gardé le début de l'heure (${s ? `${s.heure - 24} h` : 'rien'})`);
  const avant = n.journal.length;
  n.restaurer(s, r.ctx);
  verifier(n.heure === 27 && n.etat === 'nuit' && n.journal.length === avant + 1, `reprise à ${heureEnTexte(n.heure)}, le journal le note`);
  const garde = JSON.parse(JSON.stringify(n.instantaneAGarder()));
  verifier(Array.isArray(garde.faits) && garde.heure === 27, 'elle se garde dans le navigateur (en texte)');
}

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
