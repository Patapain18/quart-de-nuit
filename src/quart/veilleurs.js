// Les veilleurs automatiques : ils font toute la nuit tout seuls, avec la vraie physique et la
// vraie nuit (quart/nuit.js). Ils servent à l'essai (scripts/test-nuit.js) et à régler la
// nuit : est-elle tenable pour qui fait attention, et perdue pour qui ne fait rien ?
//
// Personne ne barre : le pilote tient le bateau vent arrière (le vent à 160°, les vagues dans
// le dos). Chacun a sa façon de veiller (les systèmes du bord : quart/systemes.js) :
//  - l'attentif garde la porte fermée et son harnais ; il lance le moteur quand la batterie
//    baisse ou que le pilote chauffe (et l'arrête avant qu'il ne chauffe trop) ; il ferme les
//    volets du côté d'où il entend venir une grosse vague, et les rouvre après — et tant que
//    le moteur tourne (il n'entendrait rien venir à temps), il garde fermés ceux du côté d'où
//    viennent les vagues ; il pompe à la main quand l'eau monte malgré la pompe électrique ;
//    il réarme le pilote dès qu'il peut ; il sort rouler le foc qui bat, et dégager les
//    dalots bouchés ;
//  - le distrait ne lance le moteur qu'à l'alarme de la batterie, ne touche pas aux volets,
//    pompe tard, réarme le pilote au bout d'une minute, laisse parfois la porte ouverte, sort
//    tard (sans s'attacher) ;
//  - l'absent ne fait rien du tout (la pompe électrique travaille pour lui… tant qu'il y a
//    du courant).
// Ils n'en savent pas plus qu'un joueur : une vague, ils ne la connaissent que quand ils
// l'entendent (quart/nuit.js : ENTENDRE — le moteur en marche, trop tard), et il leur faut le
// temps de réagir. Quand ils sortent, ils ouvrent la porte (l'eau du cockpit plein entre).
// Tous font la même nuit : même mer, mêmes rafales, mêmes déferlantes (même graine).
import { Vector3 } from 'three';
import { PhysiqueVoilier } from '../physique/voilier.js';
import { reglerAutomatiquement } from '../physique/regleur.js';
import { Houle, CASCADES } from '../mer/houle.js';
import { Vent } from '../monde/vent.js';
import { etatMer, angleVers } from '../monde/meteo.js';
import { Nuit, ENTENDRE, EAU } from './nuit.js';
import { COTES, exposition, BATTERIE, MOTEUR, EAU_BATTERIES } from './systemes.js';

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
    pompe: [300, 80], // il pompe à la main au-dessus de 300 L, jusqu'à 80 L
    reparePilote: 12, // s pour aller au tableau et réarmer
    rouleLeFoc: 25, // s pour sortir rouler le foc qui bat
    // le moteur : lancé quand la batterie descend sous 45 % ou que le pilote chauffe, arrêté
    // quand elle est pleine ou qu'il chauffe trop
    moteur: { batterie: [0.45, 0.92], pilote: 0.78 },
    volets: true, // il ferme les volets du côté d'une grosse vague qu'il entend
    voletsMoteur: true, // (et, le moteur en marche, ceux du côté d'où viennent les vagues)
    reaction: 0.4, // s entre le grondement et sa main sur le bouton des volets
    dalots: 8, // s avant de sortir dégager les dalots bouchés
    degager: 9, // s dehors pour y aller, les dégager, revenir
    attendreQueCaSeVide: true, // (dégagés, il attend dehors que le cockpit se vide avant de rouvrir la porte)
  },
  distrait: {
    nom: 'le distrait',
    aBord: { feux: true, descenteOuverte: false, attache: false, dehors: false },
    pompe: [700, 300],
    reparePilote: 60,
    rouleLeFoc: 90,
    moteur: { batterie: [BATTERIE.faible, 0.7], pilote: null },
    volets: false,
    dalots: 60,
    degager: 12,
    // (de temps en temps, il laisse la porte ouverte un moment)
    porteOuverte: (nuit) => (Math.floor(nuit.t / 50) % 4) === 1,
  },
  absent: {
    nom: 'l\'absent',
    aBord: { feux: false, descenteOuverte: true, attache: false, dehors: false },
    pompe: null,
    reparePilote: null,
    rouleLeFoc: null,
    moteur: null,
    volets: false,
    dalots: null,
  },
};
// (la porte reste ouverte le temps de passer : en sortant, en rentrant)
const PASSER_LA_PORTE = 1.2;

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
      cle, veilleur, nuit, b, vent: new Vent(21 + graine), attentePilote: 0, attenteFoc: 0, pompe: false,
      avaries: [], fin: null, dehors: 0, voletsJusqua: 0, attenteDalots: 0, travailDalots: 0, attenteVidange: 0, porte: 0, etaitDehors: false,
      serie: { t: [], heure: [], vent: [], hs: [], gite: [], vitesse: [], cale: [], cockpit: [], batterie: [], pilote: [], moteur: [], moteurEnMarche: [] },
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
      const aBord = { ...veilleur.aBord, descenteOuverte: veilleur.aBord.descenteOuverte || !!veilleur.porteOuverte?.(nuit) || e.porte > 0, dehors: e.dehors > 0 };
      const ctx = { dt: pas, m, physique: b, houle, mode: 'pied', aBord, evenements: [] };
      e.ctx = ctx;
      nuit.maj(pas, ctx);
      if (nuit.etat !== 'nuit') continue;
      if (nuit.heure >= heureMax) {
        e.fin = 'arret';
        continue;
      }
      const sy = nuit.systemes;
      // le pilote a lâché : le veilleur va réarmer son disjoncteur (s'il y pense ; refusé tant
      // que le pilote est trop chaud : il réessaie)
      if (nuit.avaries.pilote === 'panne') {
        if (e.attentePilote === null) e.attentePilote = veilleur.reparePilote ?? Infinity;
        e.attentePilote -= pas;
        if (e.attentePilote <= 0 && !nuit.reparer('pilote', ctx)) e.attentePilote = 2;
      } else e.attentePilote = null;
      // le moteur
      const mo = veilleur.moteur;
      if (mo) {
        const charge = sy.batterie.charge;
        const chaud = sy.pilote.temperature > (mo.pilote ?? Infinity);
        if (!sy.moteurEnMarche && sy.moteur.etat === 'arrete' && (charge < mo.batterie[0] || chaud) && sy.moteur.temperature < MOTEUR.refroidi) sy.demarrerMoteur();
        if (sy.moteurEnMarche && ((charge > mo.batterie[1] && sy.pilote.temperature < (mo.pilote ?? 2) - 0.15) || sy.moteur.temperature > MOTEUR.alarme + 0.04)) sy.arreterMoteur();
      }
      // les volets : il entend une grosse vague venir (ou la vague scélérate gronder), il ferme
      // ceux de son côté ; il les rouvre quelques secondes après. Le moteur en marche, il
      // n'entendrait rien venir à temps : il garde fermés ceux du côté d'où viennent les vagues.
      if (veilleur.volets) {
        const menaces = [];
        const a = nuit.deferlantes.annonce;
        if (a && a.force > 0.55 && a.dans <= a.entendue - veilleur.reaction) menaces.push(a.vers);
        const w = nuit.scelerates?.vague;
        const portee = sy.moteurEnMarche ? ENTENDRE.scelerateMoteur : ENTENDRE.scelerate;
        if (w && w.distance < portee - 80 && w.distance > -60) menaces.push(nuit.scelerates.direction());
        if (veilleur.voletsMoteur && sy.moteur.etat !== 'arrete') {
          const av = angleVers(nuit.meteo.directionVent);
          menaces.push(new Vector3(Math.cos(av), 0, Math.sin(av)));
        }
        if (menaces.length) {
          const inverse = b.orientation.clone().invert();
          for (const menace of menaces) {
            const local = menace.clone().applyQuaternion(inverse);
            const angle = (Math.atan2(Math.abs(local.x), local.z) * 180) / Math.PI;
            for (const c of COTES) if (exposition(c, angle, local.x > 0 ? -1 : 1) > 0.25 && !sy.voletsFermes(c)) sy.fermerVolets(c, true);
          }
          e.voletsJusqua = nuit.t + 7;
        } else if (nuit.t > e.voletsJusqua) {
          for (const c of COTES) if (sy.voletsFermes(c)) sy.fermerVolets(c, false);
        }
      }
      // les batteries noyées : l'eau redescendue, il réarme le coupe-batterie
      if (veilleur.pompe && sy.batterie.coupee && nuit.eau.cale < EAU_BATTERIES.mouillees) sy.rearmerBatterie(nuit.eau.cale);
      // les sorties forcées. Le foc bat (son écoute a cassé) : il sort le rouler
      if (nuit.avaries.ecouteFoc === 'cassee' && b.deroule > 0.02 && veilleur.rouleLeFoc !== null) {
        e.attenteFoc += pas;
        if (e.attenteFoc > veilleur.rouleLeFoc) {
          e.dehors = 6;
          b.deroule = Math.max(0, b.deroule - 0.22 * pas);
        }
      }
      // les dalots sont bouchés : il sort les dégager (le temps d'y aller, d'enlever ce qui les
      // bouche, de revenir)
      if (nuit.avaries.dalots === 'bouches' && veilleur.dalots !== null) {
        e.attenteDalots += pas;
        if (e.attenteDalots > veilleur.dalots) {
          e.dehors = Math.max(e.dehors, 2);
          e.travailDalots += pas;
          if (e.travailDalots >= veilleur.degager - 2) {
            nuit.reparer('dalots', ctx);
            e.attenteVidange = veilleur.attendreQueCaSeVide ? 30 : 0;
          }
        }
      }
      // (l'attentif reste dehors, attaché, le temps que le cockpit se vide sous le seuil de la porte)
      if (e.attenteVidange > 0) {
        e.attenteVidange -= pas;
        if (nuit.eau.cockpit > EAU.seuil) e.dehors = Math.max(e.dehors, 0.5);
        else e.attenteVidange = 0;
      }
      e.dehors = Math.max(0, e.dehors - pas);
      // (il passe la porte : en sortant, en rentrant — elle reste ouverte un instant)
      if ((e.dehors > 0) !== e.etaitDehors) {
        e.etaitDehors = e.dehors > 0;
        e.porte = PASSER_LA_PORTE;
      }
      e.porte = Math.max(0, e.porte - pas);
      piloter(b, sy.piloteEnMarche, pas);
      reglerAutomatiquement(b, pas);
      // la pompe à main : 4 litres par seconde, quand il y a trop d'eau (en plus de la pompe
      // électrique, qui se met en route toute seule tant qu'il y a du courant)
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
        s.batterie.push(nuit.systemes.batterie.charge);
        s.pilote.push(nuit.systemes.pilote.temperature);
        s.moteur.push(nuit.systemes.moteur.temperature);
        s.moteurEnMarche.push(nuit.systemes.moteurEnMarche ? 1 : 0);
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
    systemes: e.nuit.systemes,
    journal: e.nuit.journal.map((j) => ({ heure: j.heure, texte: j.texte })),
    deferlantes: e.deferlantes.map(({ heure, force, angle, gite }) => ({ heure, force, angle, gite })),
    scelerates: e.scelerates.map(({ heure, angle, gite }) => ({ heure, angle, gite })),
    serie: e.serie,
    nuit: e.nuit,
    // (pour reprendre la nuit là où elle s'est arrêtée)
    ctx: e.ctx,
  }));
}
