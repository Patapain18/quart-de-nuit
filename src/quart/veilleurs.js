// Les veilleurs automatiques : ils font toute la nuit tout seuls, avec la vraie physique et la
// vraie nuit (quart/nuit.js). Ils servent à l'essai (scripts/test-nuit.js) et à régler la
// nuit : est-elle tenable pour qui fait attention, et perdue pour qui ne fait rien ?
//
// Personne ne barre : le pilote tient le bateau vent arrière (le vent à 160°, les vagues dans
// le dos). Chacun a sa façon de veiller :
//  - l'attentif garde la porte fermée et son harnais ; il pompe dès que l'eau passe les
//    planchers, réarme le pilote au tableau dès qu'il lâche, sort rouler le foc qui bat ;
//  - le distrait pompe tard, réarme le pilote au bout d'une minute, laisse parfois la porte
//    ouverte ;
//  - l'absent ne fait rien du tout.
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

// La toile de la nuit : la grand-voile affalée (ferlée sur la bôme), un mouchoir de foc
export const TOILE_DE_NUIT = { ris: 3, deroule: 0.15 };
// L'angle du vent que tient le pilote (vent arrière, les vagues dans le dos)
export const ANGLE_PILOTE = 160;

export const VEILLEURS = {
  attentif: {
    nom: 'l\'attentif',
    aBord: { feux: true, descenteOuverte: false, attache: true, dehors: false },
    pompe: [150, 40], // il pompe au-dessus de 150 L, jusqu'à 40 L
    reparePilote: 12, // s pour aller au tableau et réarmer
    rouleLeFoc: 25, // s pour sortir rouler le foc qui bat
  },
  distrait: {
    nom: 'le distrait',
    aBord: { feux: true, descenteOuverte: false, attache: false, dehors: false },
    pompe: [700, 300],
    reparePilote: 60,
    rouleLeFoc: 90,
    // (de temps en temps, il laisse la porte ouverte un moment)
    porteOuverte: (nuit) => (Math.floor(nuit.t / 50) % 4) === 1,
  },
  absent: {
    nom: 'l\'absent',
    aBord: { feux: false, descenteOuverte: true, attache: false, dehors: false },
    pompe: null,
    reparePilote: null,
    rouleLeFoc: null,
  },
};

// Le pilote (ou la barre lâchée) : il garde l'angle du vent ; sans lui, la barre revient au
// milieu et le bateau finit par se mettre en travers
export function piloter(b, actif, dt) {
  const m = b.mesures;
  if (actif) {
    const cote = m.angleVentReel >= 0 ? 1 : -1;
    const erreur = ecartAngle(m.angleVentReel, cote * ANGLE_PILOTE);
    const sens = b.vitesse.dot(b.avant) < -0.2 ? -1 : 1;
    const voulu = sens * borne(erreur * 0.025 + b.rotation.y * 1.5, -0.55, 0.55);
    b.barre += borne(voulu - b.barre, -0.9 * dt, 0.9 * dt);
  } else {
    b.barre -= Math.sign(b.barre) * Math.min(Math.abs(b.barre), 0.5 * dt);
  }
}

// Toute la nuit, pour chaque veilleur. Rend ce que chacun a vécu : sa fin ('aube', ou la
// raison du naufrage), l'heure, ses chiffres, ses avaries, son journal, ses courbes.
export function jouerLaNuit({
  graine = 3, veilleurs = Object.keys(VEILLEURS), fine = false, pas = 1 / 60, echantillon = 2,
  surProgres = null, heureMax = Infinity, surImage = null, niveau = null,
} = {}) {
  const houle = new Houle({ graine: 4 + graine * 17, cascades: CASCADES.filter((c) => c.physique).map((c) => ({ ...c, n: fine ? c.n : 64 })) });
  const sousPas = Math.max(2, Math.round(pas * 240));
  const equipages = veilleurs.map((cle, k) => {
    const veilleur = VEILLEURS[cle];
    const nuit = new Nuit({ graine, niveau: niveau ?? undefined });
    const b = new PhysiqueVoilier();
    // à minuit, au large de Kervalen (à 2,5 km les uns des autres : la vague scélérate de
    // chacun ne passe que sur lui)
    const m = nuit.meteo;
    b.placer(1500 + k * 2500, 7000, (m.directionVent - ANGLE_PILOTE + 360) % 360, houle);
    b.vitesse.copy(b.avant).multiplyScalar(3);
    Object.assign(b, TOILE_DE_NUIT);
    const e = {
      cle, veilleur, nuit, b, vent: new Vent(21 + graine), pilote: true, attentePilote: 0, attenteFoc: 0, pompe: false,
      avaries: [], fin: null, dehors: 0,
      serie: { t: [], heure: [], vent: [], hs: [], gite: [], vitesse: [], cale: [], cockpit: [] },
      deferlantes: [], scelerates: [],
    };
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
      const { b, nuit, veilleur } = e;
      const m = b.mesures;
      const aBord = { ...veilleur.aBord, descenteOuverte: veilleur.aBord.descenteOuverte || !!veilleur.porteOuverte?.(nuit), dehors: e.dehors > 0 };
      const ctx = { dt: pas, m, physique: b, houle, pilote: e.pilote, mode: 'pied', aBord, evenements: [] };
      e.ctx = ctx;
      nuit.maj(pas, ctx);
      if (nuit.etat !== 'nuit') continue;
      if (nuit.heure >= heureMax) {
        e.fin = 'arret';
        continue;
      }
      // le pilote a lâché : le veilleur va réarmer son disjoncteur (s'il y pense)
      if (nuit.avaries.pilote === 'panne' && e.pilote) {
        e.pilote = false;
        e.attentePilote = veilleur.reparePilote ?? Infinity;
      }
      if (!e.pilote) {
        e.attentePilote -= pas;
        if (e.attentePilote <= 0 && nuit.reparer('pilote', ctx)) e.pilote = true;
      }
      // le foc bat (son écoute a cassé) : il sort le rouler
      if (nuit.avaries.ecouteFoc === 'cassee' && b.deroule > 0.02 && veilleur.rouleLeFoc !== null) {
        e.attenteFoc += pas;
        if (e.attenteFoc > veilleur.rouleLeFoc) {
          e.dehors = 6;
          b.deroule = Math.max(0, b.deroule - 0.22 * pas);
        }
      }
      e.dehors = Math.max(0, e.dehors - pas);
      piloter(b, e.pilote, pas);
      reglerAutomatiquement(b, pas);
      // la pompe : 4 litres par seconde, quand il y a trop d'eau
      if (veilleur.pompe) {
        if (nuit.eau.cale > veilleur.pompe[0]) e.pompe = true;
        if (nuit.eau.cale < veilleur.pompe[1]) e.pompe = false;
        if (e.pompe) nuit.pomper(4 * pas);
      }
      // le vent : le vent du moment (ses risées), la trombe, et l'air froid qui tombe des grains
      const v = e.vent.maj(t, pas, nuit.meteo, nuit.ici?.agitation ?? 0, b.position.x, b.position.z, nuit.grains).clone();
      nuit.ventTrombe(b.position.x, b.position.z, trombe);
      nuit.ventGrains(b.position.x, b.position.z, grain);
      v.add(trombe).add(grain);
      b.avancer(pas, houle, v, sousPas);
      if (b.reprises) e.fin = 'instable';
      surImage?.(e, t);
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
        s.hs.push(houle.hauteurSignificative);
        s.gite.push(Math.abs(m.gite));
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
    nom: e.veilleur.nom,
    fin: e.fin,
    heureFin: e.nuit.heure,
    stats: { ...e.nuit.stats },
    avaries: e.avaries,
    etatAvaries: { ...e.nuit.avaries },
    journal: e.nuit.journal.map((j) => ({ heure: j.heure, texte: j.texte })),
    deferlantes: e.deferlantes.map(({ heure, force, angle, gite }) => ({ heure, force, angle, gite })),
    scelerates: e.scelerates.map(({ heure, angle, gite }) => ({ heure, angle, gite })),
    serie: e.serie,
    nuit: e.nuit,
    // (pour reprendre la nuit là où elle s'est arrêtée)
    ctx: e.ctx,
  }));
}
