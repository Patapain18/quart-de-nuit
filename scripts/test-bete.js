// La bête, née d'un grain (src/jeu/nuit.js, src/monde/grains.js), sans navigateur :
//   node scripts/test-bete.js
// Au coucher du soleil, un grain arrive au vent : on le voit au radar, Jos s'en méfie (il
// traîne : il avance moins vite que les autres) ; ses éclairs se multiplient ; puis la trombe
// naît sous son avant, et avance avec lui. Sa pluie s'enroule autour d'elle (le crochet du
// radar) ; son tourbillon creuse la pression ; elle passe derrière le bateau qui garde sa
// route, et celui qui s'écarte la laisse loin. Le grain, lui, ne souffle guère devant lui.
import { jouerLaNuit } from '../src/jeu/marins.js';
import { BETE, RAYON_TOUCHE, meteoDeLaNuit } from '../src/jeu/nuit.js';
import { Grains, PORTEUR, REGLAGES_GRAINS } from '../src/monde/grains.js';
import { activiteDuGrain, REGLAGES_FOUDRE } from '../src/monde/foudre.js';
import { angleVers } from '../src/monde/meteo.js';
import { heureEnTexte, HEURE_COUCHER } from '../src/jeu/journee.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const arrondi = (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n;
const moyenne = (l) => l.reduce((s, x) => s + x, 0) / Math.max(1, l.length);

// Une radio qui note ce qu'on lui dit, et qui est occupée le temps de le dire (3 s par
// phrase) : comme la vraie, elle met les messages en file, et refuse ceux « si libre »
function radioQuiNote(horloge) {
  const r = {
    dits: [],
    occupe: 0,
    get libre() { return horloge.t >= r.occupe; },
    parler(phrases, { emetteur = 'Kervalen Radio', siLibre = false } = {}) {
      if (siLibre && !r.libre) return { then: (f) => f(false) };
      r.dits.push({ t: horloge.t, phrases, emetteur });
      r.occupe = Math.max(r.occupe, horloge.t) + 3 * phrases.length;
      return { then: (f) => f(true) };
    },
    taire() { r.occupe = horloge.t; },
  };
  return r;
}

// ---------- Le crépuscule, trois nuits, trois marins ----------
console.log('Le crépuscule de trois nuits (graines 3, 5 et 7), pour le prudent, le moyen et l\'imprudent');
const GRAINES = [3, 5, 7];
const MARINS = ['prudent', 'moyen', 'imprudent'];
const essais = [];
const debut = Date.now();
for (const graine of GRAINES) {
  const horloges = {};
  const radios = {};
  const suivis = {};
  const r = jouerLaNuit({
    graine, marins: MARINS, heureMax: 21.9,
    radio: (cle) => (radios[cle] = radioQuiNote((horloges[cle] = { t: 0 }))),
    surImage(e, t) {
      const n = e.nuit;
      horloges[e.cle].t = n.t;
      const s = (suivis[e.cle] ??= {
        grainNe: null, grainVu: null, autres: [], naissance: null, sousLAvant: 0, plusPres: { d: Infinity }, creux: 0,
        ventDuGrain: 0, ventApproche: 0, crochet: null, activite: [], eclairs: { grain: [], trombe: [], autour: 0, autourDuree: 0 },
      });
      const p = e.b.position;
      const gb = n.grainBete;
      if (gb && !s.grainNe) {
        s.grainNe = { heure: n.heure, t: n.t, vitesse: Math.hypot(gb.vx, gb.vz), route: Math.atan2(gb.vz, gb.vx), vent: angleVers(n.meteo.directionVent), porteur: !!gb.porteur, id: gb.id, rayon: gb.rayon };
      }
      // (les autres grains : leur vitesse)
      if (Math.round(n.t * 60) % 600 === 0) for (const g of n.grains.liste) if (!g.bete) s.autres.push(Math.hypot(g.vx, g.vz));
      if (gb && gb.faits.vu && !s.grainVu) {
        const c = n.grains.noyau(gb, gb.noyaux[0], {});
        s.grainVu = { t: n.t, distance: Math.hypot(c.x - p.x, c.z - p.z), pluie: n.grains.pluieDesGrains(c.x, c.z) };
      }
      // (son électricité, avant que la trombe naisse)
      if (gb && !n.trombe && !n.faits.has('trombe')) s.activite.push({ dans: n.secondesJusqua(n.prevu.trombe), a: activiteDuGrain(gb, n.meteo.orage) });
      // (les éclairs : ceux de son grain, ceux de la trombe, et tous ceux autour d'elle)
      for (const ev of n.foudre.evenements) {
        if (ev.type !== 'eclair' || ev.eclair.type === 'front') continue;
        const deSonGrain = gb && ev.eclair.grain === gb.id;
        if (deSonGrain) s.eclairs.grain.push({ t: n.t, trombe: !!n.trombe });
        if (ev.eclair.source === 'trombe') s.eclairs.trombe.push(n.t);
        if (n.trombe && (deSonGrain || ev.eclair.source === 'trombe')) s.eclairs.autour++;
      }
      const tr = n.trombe;
      if (tr) {
        s.eclairs.autourDuree += 1 / 60;
        const g = tr.grain;
        const F = n.grains.liste.includes(g) ? n.grains.avant(g, tr.cote, {}) : null;
        if (!s.naissance) {
          const V = Math.hypot(g.vx, g.vz);
          const c = n.grains.noyau(g, g.noyaux[0], {});
          s.naissance = {
            heure: n.heure, t: n.t, distance: tr.distance, cote: tr.cote, ecartAvant: F ? Math.hypot(F.x - tr.x, F.z - tr.z) : Infinity,
            coeurDerriere: ((c.x - tr.x) * g.vx + (c.z - tr.z) * g.vz) / V / g.rayon,
          };
        }
        if (F) s.sousLAvant = Math.max(s.sousLAvant, Math.hypot(F.x - tr.x, F.z - tr.z));
        if (tr.distance < s.plusPres.d) s.plusPres = { d: tr.distance, age: tr.age, touche: tr.touche };
        s.creux = Math.min(s.creux, n.pressionTrombe(p.x, p.z));
        // (le crochet, sur le radar : la pluie autour d'elle, à 300 m, vers 100 s)
        if (!s.crochet && tr.age > 100 && g.crochet) {
          const ux = tr.vx / Math.hypot(tr.vx, tr.vz);
          const uz = tr.vz / Math.hypot(tr.vx, tr.vz);
          const autour = (deg) => {
            const a = (deg * Math.PI) / 180;
            return n.grains.pluieDesGrains(tr.x + 300 * (Math.cos(a) * ux - Math.sin(a) * uz), tr.z + 300 * (Math.cos(a) * uz + Math.sin(a) * ux));
          };
          const droite = moyenne([60, 90, 120, 150].map(autour));
          const gauche = moyenne([-60, -90, -120, -150].map(autour));
          s.crochet = { droite, gauche, oeil: n.grains.pluieDesGrains(tr.x, tr.z), max: Math.max(...[60, 90, 120, 150, 160].map(autour)) };
        }
      }
      // (le vent du grain de la bête, là où est le bateau : pendant qu'elle approche, et après)
      if (gb && n.grains.liste.includes(gb)) {
        const v = { x: 0, z: 0 };
        n.grains.ventDuGrain(gb, p.x, p.z, v);
        const u = Math.hypot(v.x, v.z);
        s.ventDuGrain = Math.max(s.ventDuGrain, u);
        if (!tr || tr.distance <= s.plusPres.d + 1) s.ventApproche = Math.max(s.ventApproche, u);
      }
    },
  });
  for (const e of r) essais.push({ graine, cle: e.cle, nom: e.nom, fin: e.fin, journal: e.journal, stats: e.stats, dits: radios[e.cle].dits, ...suivis[e.cle] });
}
console.log(`  (${arrondi((Date.now() - debut) / 1000)} s)`);
for (const e of essais) {
  const n = e.naissance;
  console.log(`  graine ${e.graine}, ${e.nom.padEnd(13)} grain vu à ${arrondi(e.grainVu?.distance ?? NaN, -1)} m · la bête naît à ${heureEnTexte(n?.heure ?? 0)}, à ${arrondi(n?.distance ?? NaN, -1)} m · au plus près ${arrondi(e.plusPres.d)} m à ${arrondi(e.plusPres.age)} s${e.plusPres.touche ? ' (touché)' : ''} · creux ${arrondi(e.creux, 2)} hPa · vent du grain ${arrondi(e.ventApproche, 1)} puis ${arrondi(e.ventDuGrain, 1)} m/s`);
}

console.log('\nLe grain de la bête');
const premier = essais[0];
verifier(essais.every((e) => e.grainNe && e.grainNe.heure < HEURE_COUCHER + 0.01), `il est là dès le coucher du soleil (${heureEnTexte(premier.grainNe.heure)})`);
verifier(essais.every((e) => e.grainNe.porteur && Math.abs(e.grainNe.vitesse - PORTEUR.vitesse) < 0.01), `il traîne : ${PORTEUR.vitesse} m/s, quand les autres grains vont à ${arrondi(moyenne(essais.flatMap((e) => e.autres)), 1)} m/s`);
const ecartVent = Math.max(...essais.map((e) => Math.abs((((e.grainNe.route - e.grainNe.vent) * 180) / Math.PI + 540) % 360 - 180)));
verifier(ecartVent < 3, `droit sous le vent (à ${arrondi(ecartVent, 1)}° près ; les autres dérivent de ${REGLAGES_GRAINS.derive}° à sa droite)`);
const distancesVu = essais.map((e) => e.grainVu.distance);
verifier(essais.every((e) => e.grainVu && e.grainVu.t < 21), `on le voit dans les premières secondes de la nuit, quand Jos a fini de parler (de ${arrondi(Math.min(...essais.map((e) => e.grainVu.t)), 1)} à ${arrondi(Math.max(...essais.map((e) => e.grainVu.t)), 1)} s après le coucher du soleil)`);
verifier(Math.min(...distancesVu) > 1400 && Math.max(...distancesVu) < 2800, `à un mille environ (de ${arrondi(Math.min(...distancesVu), -1)} à ${arrondi(Math.max(...distancesVu), -1)} m) : sur le radar, et à l'œil`);
verifier(essais.every((e) => e.grainVu.pluie > 0.3), `son cœur renvoie l'onde du radar (pluie ${arrondi(Math.min(...essais.map((e) => e.grainVu.pluie)), 2)} et plus, l'écho commence à 0,12)`);
const jos = (e, texte) => e.dits.findIndex((d) => d.phrases.some((ph) => ph.includes(texte)));
verifier(essais.every((e) => jos(e, 'je n\'aime pas sa tête') >= 0 && jos(e, 'je n\'aime pas sa tête') < jos(e, 'Une trombe !')), 'Jos s\'en méfie avant qu\'elle naisse : « il avance moins vite que les autres… c\'est sous ces grains-là que naissent les trombes »');
verifier(essais.every((e) => e.journal.findIndex((j) => j.texte.includes('il avance moins vite')) >= 0 && e.journal.findIndex((j) => j.texte.includes('il avance moins vite')) < e.journal.findIndex((j) => j.texte.startsWith('Une trombe marine naît'))), 'le journal le note avant la trombe');
const avant = essais.map((e) => moyenne(e.activite.filter((a) => a.dans > 48).map((a) => a.a)));
const juste = essais.map((e) => moyenne(e.activite.filter((a) => a.dans < 6).map((a) => a.a)));
const saut = Math.min(...juste.map((x, i) => x / avant[i]));
verifier(saut > 1.5, `ses éclairs se multiplient juste avant qu'elle naisse : son électricité ×${arrondi(saut, 2)} (le « saut d'éclairs ») — ${arrondi(REGLAGES_FOUDRE.parMinute * moyenne(avant) ** 2, 1)} éclairs par minute au coucher du soleil, ${arrondi(REGLAGES_FOUDRE.parMinute * moyenne(juste) ** 2, 1)} juste avant`);

console.log('\nLa naissance');
verifier(essais.every((e) => e.naissance.ecartAvant < 1 && Math.abs(e.naissance.cote) <= PORTEUR.cote + 1e-9), `sous l'avant de son grain (à ${PORTEUR.avant} rayon de son centre, à moins de ${PORTEUR.cote} rayon de son axe : de ${arrondi(Math.min(...essais.map((e) => e.naissance.cote)), 2)} à ${arrondi(Math.max(...essais.map((e) => e.naissance.cote)), 2)})`);
verifier(essais.every((e) => e.naissance.coeurDerriere < -0.5), `le cœur du grain derrière elle (à ${arrondi(-moyenne(essais.map((e) => e.naissance.coeurDerriere)), 2)} rayon)`);
const distNaissance = essais.map((e) => e.naissance.distance);
verifier(Math.min(...distNaissance) > 550 && Math.max(...distNaissance) < 1100, `à moins d'un kilomètre du bateau (de ${arrondi(Math.min(...distNaissance), -1)} à ${arrondi(Math.max(...distNaissance), -1)} m)`);
verifier(essais.every((e) => e.sousLAvant < 60), `elle avance avec lui : jamais à plus de ${arrondi(Math.max(...essais.map((e) => e.sousLAvant)))} m de sa place sous son avant (elle serpente de ±22 m)`);
verifier(essais.every((e) => e.journal.some((j) => j.texte.startsWith('Une trombe marine naît sous le grain'))) && essais.every((e) => jos(e, 'regarde sous l\'avant de son nuage') >= 0), 'Jos la voit naître : « regarde sous l\'avant de son nuage, l\'eau tourne… Une trombe ! »');

console.log('\nSon passage');
const moyens = essais.filter((e) => e.cle === 'moyen');
const prudents = essais.filter((e) => e.cle === 'prudent');
const imprudents = essais.filter((e) => e.cle === 'imprudent');
const d = (l) => l.map((e) => arrondi(e.plusPres.d)).join(', ');
verifier(moyens.every((e) => e.plusPres.d > 160 && e.plusPres.d < 450 && !e.plusPres.touche), `le moyen garde sa route : elle passe derrière lui, tout près (${d(moyens)} m ; visé : ${BETE.ecart})`);
verifier(prudents.every((e) => e.plusPres.d > 200 && !e.plusPres.touche), `le prudent s'écarte : elle passe loin de lui (${d(prudents)} m)`);
verifier(moyens.every((e) => e.plusPres.age > 90 && e.plusPres.age < 200), `elle passe au plus fort de sa vie (au plus près du moyen à ${moyens.map((e) => arrondi(e.plusPres.age)).join(', ')} s : elle ne devient une corde qu'à 200 s)`);
console.log(`    (l'imprudent : ${d(imprudents)} m)`);
// (le même grain, porteur ou pas : le vent de son air froid devant lui)
const G = new Grains(1);
G.maj(0, meteoDeLaNuit(19.5), 0, 0);
G.vider();
const porteur = G.porteur({ x: 0, z: 0, ux: 1, uz: 0, force: BETE.force, age: 300, duree: 1e9 });
const ordinaire = G.creer({ x: porteur.x, z: porteur.z, rayon: porteur.rayon, force: BETE.force, orage: 1, duree: 1e9, age: 300, prevu: true });
Object.assign(ordinaire, { vx: porteur.vx, vz: porteur.vz, noyaux: porteur.noyaux.map((k) => ({ ...k })) });
const ventDevant = (g, x) => {
  const v = { x: 0, z: 0 };
  G.ventDuGrain(g, x, 0, v);
  return Math.hypot(v.x, v.z);
};
verifier(ventDevant(porteur, 300) < 0.05 && ventDevant(ordinaire, 300) > 3, `son grain ne souffle pas devant elle : à 300 m devant, ${arrondi(ventDevant(porteur, 300), 1)} m/s (un grain ordinaire : ${arrondi(ventDevant(ordinaire, 300), 1)}) — le bord de sa rafale passe sous elle, à ${PORTEUR.bord} rayon devant son cœur, au lieu de 1,9`);
verifier(moyens.every((e) => e.ventApproche < 1), `le moyen ne sent pas le grain pendant qu'elle approche (au plus ${arrondi(Math.max(...moyens.map((e) => e.ventApproche)), 1)} m/s)`);
verifier(moyens.every((e) => e.ventDuGrain > 1.5 && e.ventDuGrain < 5), `puis, quand le cœur du grain passe derrière elle, on prend le bord de sa rafale (${moyens.map((e) => arrondi(e.ventDuGrain, 1)).join(', ')} m/s sur le moyen)`);

console.log('\nLe crochet, sur le radar');
const c = essais.map((e) => e.crochet).filter(Boolean);
verifier(c.length === essais.length && c.every((x) => x.droite > 2 * x.gauche), `la pluie s'enroule autour d'elle, par sa droite (à 300 m : ${arrondi(moyenne(c.map((x) => x.droite)), 2)} à droite, ${arrondi(moyenne(c.map((x) => x.gauche)), 2)} à gauche)`);
verifier(c.every((x) => x.oeil < 0.5 * x.max && x.max > 0.25), `elle est dans l'œil du crochet (pluie ${arrondi(moyenne(c.map((x) => x.oeil)), 2)} sur elle, ${arrondi(moyenne(c.map((x) => x.max)), 2)} autour)`);

console.log('\nSes éclairs, et ceux de son grain');
const parMinute = moyenne(essais.map((e) => e.eclairs.autour / (e.eclairs.autourDuree / 60)));
verifier(parMinute > 5 && parMinute < 12, `${arrondi(parMinute, 1)} éclairs par minute d'elle et de son grain, pendant qu'elle vit (elle seule en faisait ${REGLAGES_FOUDRE.trombe}, avant)`);
const duGrain = moyenne(essais.map((e) => e.eclairs.grain.length));
const deLaTrombe = moyenne(essais.map((e) => e.eclairs.trombe.length));
verifier(duGrain > 3 && deLaTrombe > 3, `les uns partent de son grain (${arrondi(duGrain, 1)} par crépuscule), les autres d'elle (${arrondi(deLaTrombe, 1)})`);

console.log('\nLe baromètre');
const nuitSeule = essais[0];
const creux = (dist) => {
  const c0 = BETE.coeur;
  const v = BETE.vmax;
  const k = dist < c0 ? 1 - (dist * dist) / (2 * c0 * c0) : (c0 * c0) / (2 * dist * dist);
  return (-1.2 * v * v * k) / 100;
};
verifier(Math.abs(creux(0) + 17.3) < 0.1 && Math.abs(creux(150) + 0.96) < 0.02, `son tourbillon creuse la pression : ${arrondi(creux(0), 1)} hPa en son cœur, ${arrondi(creux(150), 2)} à 150 m (de quoi décoller l'aiguille), ${arrondi(creux(RAYON_TOUCHE), 1)} à ${RAYON_TOUCHE} m`);
verifier(essais.every((e) => e.creux < 0 && (e.plusPres.d > 300 || e.creux < -0.2)), `sur les bateaux qu'elle frôle, il plonge (${essais.map((e) => `${arrondi(e.plusPres.d)} m : ${arrondi(e.creux, 2)}`).join(' ; ')})`);
verifier(nuitSeule.stats.pressionMin < Infinity, 'le bilan garde le plus bas');

// ---------- Les reprises et les sauts dans le temps ----------
console.log('\nLes reprises et les sauts dans le temps');
function crepuscule(action, heureMax = 20.6) {
  const vu = { grains: new Set(), trombe: null, avant: Infinity, faits: null, prevu: null };
  jouerLaNuit({
    graine: 3, marins: ['moyen'], heureMax,
    surImage(e) {
      const n = e.nuit;
      action?.(e);
      if (n.grainBete) vu.grains.add(n.grainBete.id);
      if (n.trombe && !vu.trombe) {
        const g = n.trombe.grain;
        vu.trombe = { heure: n.heure, sousSonGrain: !!g && g.bete && n.grains.liste.includes(g) };
        if (vu.trombe.sousSonGrain) {
          const F = n.grains.avant(g, n.trombe.cote, {});
          vu.avant = Math.hypot(F.x - n.trombe.x, F.z - n.trombe.z);
        }
      }
      vu.faits = n.faits;
      vu.prevu = n.prevu;
    },
  });
  return vu;
}
let fait = false;
const reprise = crepuscule((e) => {
  if (!fait && e.nuit.t > 30) {
    fait = true;
    e.nuit.restaurer(e.nuit.sauvegarde, e.ctx);
  }
});
verifier(reprise.grains.size === 2 && reprise.trombe?.sousSonGrain && reprise.avant < 1, 'une reprise au début du crépuscule : le grain revient au vent, et la bête naît encore sous lui');
let saute = false;
const saut1 = crepuscule((e) => {
  if (!saute) {
    saute = true;
    e.nuit.allerA(19.2);
  }
});
verifier(saut1.grains.size >= 1 && saut1.trombe?.sousSonGrain && saut1.avant < 1, 'un saut à 19 h 12 (avant elle) : son grain arrive, plus près, et elle naît sous lui');
saute = false;
const saut2 = crepuscule((e) => {
  if (!saute) {
    saute = true;
    e.nuit.allerA(19.9);
  }
}, 20.3);
verifier(saut2.grains.size === 0 && !saut2.trombe && saut2.faits.has('trombe') && saut2.faits.has('grain0'), 'un saut à 19 h 54 (après elle) : ni elle, ni son grain');
// (une partie gardée avant cette étape : son premier grain prévu vers 20 h 10)
saute = false;
const ancienne = crepuscule((e) => {
  if (!saute) {
    saute = true;
    const s = { ...e.nuit.sauvegarde, prevu: { ...e.nuit.sauvegarde.prevu, grain0: 20.17 } };
    e.nuit.restaurer(s, e.ctx);
  }
});
verifier(ancienne.prevu.grain0 === HEURE_COUCHER && ancienne.trombe?.sousSonGrain, 'une partie gardée avant elle : son grain arrive quand même au coucher du soleil');

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
