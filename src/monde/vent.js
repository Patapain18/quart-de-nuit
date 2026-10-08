// Le vent réel : jamais tout à fait régulier.
//  - il « respire » : sa force varie doucement de ±10 % (quelques dizaines de secondes) ;
//  - il tourne un peu : sa direction oscille de quelques degrés (les « bascules ») ;
//  - les rafales : ce sont les risées (monde/risees.js), des taches de vent plus fort qui
//    courent sur l'eau, et qu'on voit venir. Quand le bateau est dans l'une d'elles, le vent
//    forcit (+12 à +24 % par beau temps, jusqu'à +40 % à l'orage : par 40 nœuds de vent
//    moyen, des rafales de 48 à 56 nœuds, comme dans un vrai coup de vent) et tourne un peu
//    à droite ; dans une molle, il faiblit. Sous un grain (agitation : monde/grains.js), il
//    y a bien plus de risées, un peu moins fortes : la rafale du grain lui-même (l'air froid
//    qui tombe de lui et s'étale sur la mer) s'y ajoute déjà ;
//  - à l'orage, il ne retombe jamais tout à fait entre deux risées : il souffle par
//    bouffées, en moyenne 8 % au-dessus du vent établi.
import { Vector3 } from 'three';
import { NOEUD, angleVers } from './meteo.js';
import { Risees } from './risees.js';

function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Vent {
  constructor(graine = 7) {
    this.aleatoire = generateur(graine);
    // trois respirations lentes, de périodes différentes (elles ne se répètent jamais pareil)
    this.ondes = [0, 1, 2].map(() => ({ periode: 25 + this.aleatoire() * 60, phase: this.aleatoire() * 6.28 }));
    this.bascules = [0, 1].map(() => ({ periode: 40 + this.aleatoire() * 80, phase: this.aleatoire() * 6.28 }));
    // les risées et les molles, autour du bateau
    this.risees = new Risees(graine * 7919 + 13);
    this.ici = { force: 0, bascule: 0 }; // (celle où est le bateau)
    this.vecteur = new Vector3();
    this.vitesse = 0; // nœuds
    this.direction = 0; // d'où il vient (degrés)
    this.facteurRafale = 0;
  }

  // meteo : l'état du temps (vent moyen en nœuds, direction d'où il vient) ; dt en s ;
  // agitation : sous un grain (0 → 1) ; (x, z) : où est le bateau (les risées vivent autour
  // de lui) ; grains : monde/grains.js (l'air froid qui s'étale pousse les risées), ou rien
  maj(t, dt, meteo, agitation = 0, x = 0, z = 0, grains = null) {
    const orage = meteo.orage ?? 0;
    this.risees.maj(dt, meteo, x, z, { agitation, grains });
    const ici = this.risees.ventEn(x, z, this.ici);
    let respiration = 0;
    for (const o of this.ondes) respiration += Math.sin((t / o.periode) * 6.28 + o.phase);
    respiration *= 0.035 * (1 + orage);
    let bascule = 0;
    for (const o of this.bascules) bascule += Math.sin((t / o.periode) * 6.28 + o.phase);
    bascule *= 3.5 * (1 + orage);

    this.facteurRafale = ici.force;
    this.vitesse = Math.max(0, meteo.vent * (1 + respiration + ici.force + 0.08 * orage));
    this.direction = (meteo.directionVent + bascule + ici.bascule + 360) % 360;
    // vecteur (m/s) dans le sens où va l'air
    const a = angleVers(this.direction);
    this.vecteur.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(this.vitesse * NOEUD);
    return this.vecteur;
  }
}
