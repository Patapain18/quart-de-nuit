// Les marins automatiques : ils font toute la nuit de tempête tout seuls, avec la vraie
// physique et la vraie nuit (jeu/nuit.js). Ils servent au test (scripts/test-nuit.js) et à
// l'atelier de la tempête (rejouer la nuit en accéléré, comparer les tactiques, régler la
// difficulté).
//
// Chacun a sa façon de faire :
//  - le prudent fait tout ce que Jos conseille : la toile réduite, puis la grand-voile
//    affalée au plus fort (et avant chaque grain qui vient sur lui), les vagues bien dans
//    l'arrière, la descente fermée, le harnais ; il pompe, répare ce qui casse, appelle le
//    cargo, s'écarte de la trombe, et met les vagues scélérates droit dans son arrière ;
//  - le moyen garde ce qu'il avait au coucher du soleil (2 ris, le foc roulé aux deux
//    tiers), le vent à 140°, et ne pompe que quand il y a beaucoup d'eau ;
//  - l'imprudent garde toute la toile, de travers aux vagues, la descente ouverte, sans
//    harnais ni feux, et ne fait rien quand ça casse.
// Tous font la même nuit : même mer, mêmes rafales, mêmes déferlantes (même graine).
import { Vector3 } from 'three';
import { PhysiqueVoilier } from '../physique/voilier.js';
import { reglerAutomatiquement } from '../physique/regleur.js';
import { Houle, CASCADES } from '../mer/houle.js';
import { Vent } from '../monde/vent.js';
import { etatMer } from '../monde/meteo.js';
import { Nuit } from './nuit.js';

const ecartAngle = (a, b) => ((a - b + 540) % 360) - 180;
const borne = (x, a, b) => Math.min(b, Math.max(a, x));

export const MARINS = {
  prudent: {
    nom: 'le prudent',
    debut: { ris: 2, deroule: 0.3 },
    aBord: { feux: true, gilet: true, lampeEssayee: true, descenteOuverte: false, attache: true, dehors: true },
    // l'angle du vent visé (vent sur tribord : on fuit vers l'est, loin de la côte)
    angle(nuit) {
      // une vague scélérate annoncée : droit dans l'arrière (l'angle du vent à ce cap)
      const w = nuit.scelerates?.vague;
      if (w && w.faites.has('annonce') && w.distance > -40) return ecartAngle(nuit.meteo.directionVent, nuit.scelerates.capPourLaFuir);
      if (nuit.trombe && nuit.trombe.force > 0.05 && nuit.trombe.distance < 700) return 95; // s'écarter de sa route
      return nuit.meteo.vent >= 28 ? 165 : 140;
    },
    voiles(nuit, b, e, dt) {
      // (un grain qui vient sur lui, ou sa rafale : il réduit comme pour le vent qu'il fera dessous)
      const m = nuit.menaceGrain;
      const grain = m && m.distance < 2600 ? m.grain.force * 15 : (nuit.ici?.agitation ?? 0) > 0.15 ? 13 : 0;
      const vent = nuit.meteo.vent + grain;
      if (nuit.avaries.grandVoile === 'dechiree' || vent >= 34) b.ris = 3;
      else b.ris = 2;
      if (nuit.avaries.foc === 'dechiree') b.deroule = 0;
      else if (nuit.avaries.ecouteFoc === 'cassee') {
        b.deroule = 0;
        // il va passer une nouvelle écoute à l'avant (un peu plus tard)
        e.reparation = (e.reparation ?? 25) - dt;
        if (e.reparation <= 0) nuit.reparer('ecouteFoc', e.ctx);
      } else b.deroule = vent >= 34 ? 0.22 : 0.3;
    },
    pompe: [90, 15],
    appelleLeCargo: true,
    reparePilote: true,
  },
  moyen: {
    nom: 'le moyen',
    debut: { ris: 2, deroule: 0.3 },
    aBord: { feux: true, gilet: true, lampeEssayee: true, descenteOuverte: false, attache: true, dehors: true },
    angle: () => 140,
    voiles(nuit, b) {
      if (nuit.avaries.grandVoile === 'dechiree') b.ris = 3;
      if (nuit.avaries.ecouteFoc === 'cassee' || nuit.avaries.foc === 'dechiree') b.deroule = 0;
    },
    pompe: [320, 60],
  },
  imprudent: {
    nom: 'l\'imprudent',
    debut: { ris: 0, deroule: 1 },
    aBord: { feux: false, gilet: false, lampeEssayee: false, descenteOuverte: true, attache: false, dehors: true },
    angle: () => 90,
    voiles() {},
    pompe: null,
  },
};

// La radio, sans voix : chaque message est « lu » tout de suite
const radioMuette = { libre: true, parler: () => ({ then: (f) => f(true) }), taire() {} };

// Joue la nuit pour les marins choisis.
//   difficulte : 'matelot', 'marin', 'caphornier' (ou un niveau sur mesure : niveau)
//   graine : la nuit (mer, rafales, déferlantes, imprévus)
//   fine : la mer à pleine résolution (sinon une mer plus grossière, 4 fois plus rapide :
//     la même hauteur de vagues, d'autres vagues)
//   pas : la durée d'une image simulée (s)
//   echantillon : toutes les combien de secondes on note l'état de chacun (pour les courbes)
//   surProgres(nuit, t) : appelé toutes les 10 s simulées
// Renvoie, pour chaque marin : sa fin ('aube', ou la raison du naufrage), ses chiffres
// (nuit.stats), son journal, ses avaries, et ses courbes.
export function jouerLaNuit({
  difficulte = 'marin', niveau = null, graine = 3, marins = Object.keys(MARINS), fine = false,
  pas = 1 / 60, echantillon = 2, surProgres = null,
} = {}) {
  const houle = new Houle({ graine: 4 + graine * 17, cascades: CASCADES.filter((c) => c.physique).map((c) => ({ ...c, n: fine ? c.n : 64 })) });
  const sousPas = Math.max(2, Math.round(pas * 240));
  const equipages = marins.map((cle, k) => {
    const marin = MARINS[cle];
    const nuit = new Nuit({ radio: radioMuette, difficulte, graine });
    if (niveau) nuit.niveau = { ...nuit.niveau, ...niveau };
    const b = new PhysiqueVoilier();
    // au coucher du soleil, à 6 milles au sud de Kervalen (à 2,5 km les uns des autres :
    // la vague scélérate de chacun ne passe que sur lui)
    b.placer(1500 + k * 2500, 7000, (nuit.meteo.directionVent - 140 + 360) % 360, houle);
    b.vitesse.copy(b.avant).multiplyScalar(3);
    Object.assign(b, marin.debut);
    const e = {
      cle, marin, nuit, b, vent: new Vent(21 + graine), pilote: true, enPanne: 0, pompe: false, avaries: [], fin: null,
      serie: { t: [], heure: [], vent: [], rafale: [], pluie: [], hs: [], gite: [], twa: [], vitesse: [], cale: [], cockpit: [] },
      deferlantes: [], scelerates: [],
    };
    nuit.on('cargo', () => { e.cargoVu = 15; });
    nuit.on('avarie', (nom) => e.avaries.push({ heure: nuit.heure, nom }));
    nuit.on('perdue', (raison) => { e.fin = raison; });
    nuit.on('aube', () => { e.fin = 'aube'; });
    nuit.on('deferlante', (f) => e.deferlantes.push({ heure: nuit.heure, force: f.force, angle: f.angle, gite: 0, suivi: 4 }));
    nuit.on('scelerate-choc', (c) => e.scelerates.push({ heure: nuit.heure, angle: c.angle, gite: 0, suivi: 6 }));
    return e;
  });

  let t = 0;
  let ageMer = 99;
  let ageNote = 99;
  let ageProgres = 0;
  const trombe = new Vector3();
  const grain = new Vector3();
  while (equipages.some((e) => !e.fin)) {
    const enCours = equipages.find((e) => !e.fin);
    // la mer suit le temps qu'il fait (toutes les 3 secondes)
    ageMer += pas;
    if (ageMer > 3) {
      ageMer = 0;
      houle.regler(etatMer(enCours.nuit.meteo));
    }
    houle.calculer(t, pas);
    ageNote += pas;
    const noter = ageNote >= echantillon;
    if (noter) ageNote = 0;
    for (const e of equipages) {
      if (e.fin) continue;
      const { b, nuit, marin } = e;
      const m = b.mesures;
      const ctx = { dt: pas, m, physique: b, houle, pilote: e.pilote, mode: e.pilote ? 'pied' : 'barre', aBord: { ...marin.aBord }, evenements: [] };
      e.ctx = ctx;
      nuit.maj(pas, ctx);
      if (nuit.etat !== 'nuit') continue;
      // le pilote a lâché : le marin barre, puis réarme le disjoncteur
      if (nuit.avaries.pilote === 'panne' && e.pilote) {
        e.pilote = false;
        e.enPanne = 40;
      }
      if (!e.pilote && marin.reparePilote) {
        e.enPanne -= pas;
        if (e.enPanne <= 0 && nuit.reparer('pilote', ctx)) e.pilote = true;
      }
      // la barre : garder l'angle du vent (et, si le bateau recule, barrer à l'envers)
      const erreur = ecartAngle(m.angleVentReel, marin.angle(nuit, b));
      const sens = b.vitesse.dot(b.avant) < -0.2 ? -1 : 1;
      b.barre = sens * borne(erreur * 0.025 + b.rotation.y * 1.5, -0.55, 0.55);
      marin.voiles(nuit, b, e, pas);
      reglerAutomatiquement(b, pas);
      // la pompe : 4 litres par seconde, quand il y a trop d'eau
      if (marin.pompe) {
        if (nuit.eau.cale > marin.pompe[0]) e.pompe = true;
        if (nuit.eau.cale < marin.pompe[1]) e.pompe = false;
        if (e.pompe) nuit.pomper(4 * pas);
      }
      // le cargo : on l'appelle sur le 16
      if (e.cargoVu !== undefined && marin.appelleLeCargo) {
        e.cargoVu -= pas;
        if (e.cargoVu <= 0) {
          nuit.appelerCargo(ctx);
          e.cargoVu = undefined;
        }
      }
      // le vent : le vent du moment (ses risées, autour du bateau, plus nombreuses sous un
      // grain), la trombe, et l'air froid qui tombe des grains
      const v = e.vent.maj(t, pas, nuit.meteo, nuit.ici?.agitation ?? 0, b.position.x, b.position.z, nuit.grains).clone();
      nuit.ventTrombe(b.position.x, b.position.z, trombe);
      nuit.ventGrains(b.position.x, b.position.z, grain);
      v.add(trombe).add(grain);
      b.avancer(pas, houle, v, sousPas);
      if (b.reprises) e.fin = 'instable';
      // la gîte après chaque déferlante
      for (const d of [...e.deferlantes, ...e.scelerates]) {
        if (d.suivi <= 0) continue;
        d.suivi -= pas;
        d.gite = Math.max(d.gite, Math.abs(m.gite));
      }
      if (noter) {
        const s = e.serie;
        s.t.push(t);
        s.heure.push(nuit.heure);
        s.vent.push(nuit.meteo.vent);
        s.rafale.push(v.length() / 0.5144);
        s.pluie.push(nuit.ici?.pluie ?? 0);
        s.hs.push(houle.hauteurSignificative);
        s.gite.push(Math.abs(m.gite));
        s.twa.push(Math.abs(m.angleVentReel));
        s.vitesse.push(m.vitesse);
        s.cale.push(nuit.eau.cale);
        s.cockpit.push(nuit.eau.cockpit);
      }
    }
    t += pas;
    ageProgres += pas;
    if (surProgres && ageProgres >= 10) {
      ageProgres = 0;
      surProgres(enCours.nuit, t);
    }
  }
  return equipages.map((e) => ({
    cle: e.cle,
    nom: e.marin.nom,
    fin: e.fin,
    heureFin: e.nuit.heure,
    stats: { ...e.nuit.stats },
    avaries: e.avaries,
    reparees: { ...e.nuit.avaries },
    journal: e.nuit.journal.map((j) => ({ heure: j.heure, texte: j.texte })),
    deferlantes: e.deferlantes.map(({ heure, force, angle, gite }) => ({ heure, force, angle, gite })),
    scelerates: e.scelerates.map(({ heure, angle, gite }) => ({ heure, angle, gite })),
    serie: e.serie,
    nuit: e.nuit,
  }));
}
