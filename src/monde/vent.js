// Le vent réel : jamais tout à fait régulier.
//  - il « respire » : sa force varie doucement de ±10 % (quelques dizaines de secondes) ;
//  - il tourne un peu : sa direction oscille de quelques degrés (les « bascules ») ;
//  - les rafales : de temps en temps le vent forcit d'un coup pendant quelques secondes
//    (+12 à +24 % par beau temps, +20 à +40 % dans les grains d'orage : par 40 nœuds de
//    vent moyen, des rafales de 48 à 56 nœuds, comme dans un vrai coup de vent) ; sous un
//    grain (agitation : monde/grains.js), elles viennent bien plus souvent, mais un peu moins
//    fort : la rafale du grain lui-même (l'air froid qui tombe de lui et s'étale sur la mer)
//    s'y ajoute déjà.
import { Vector3 } from 'three';
import { NOEUD, angleVers } from './meteo.js';

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
    this.rafale = { force: 0, cible: 0, duree: 0, prochaine: 8 };
    this.vecteur = new Vector3();
    this.vitesse = 0; // nœuds
    this.direction = 0; // d'où il vient (degrés)
    this.facteurRafale = 0;
  }

  // meteo : l'état du temps (vent moyen en nœuds, direction d'où il vient) ; dt en s ;
  // agitation : sous un grain (0 → 1)
  maj(t, dt, meteo, agitation = 0) {
    const r = this.rafale;
    const orage = meteo.orage ?? 0;
    // les rafales arrivent plus souvent et plus fort quand le temps se dégrade, et sous un grain
    r.prochaine -= dt * (1 + 2 * agitation);
    if (r.prochaine <= 0 && r.duree <= 0) {
      r.cible = (0.12 + this.aleatoire() * 0.12) * (1 + orage * 0.7 * (1 - 0.45 * agitation)) * Math.min(1, meteo.vent / 12);
      r.duree = 3 + this.aleatoire() * 7;
      r.prochaine = (18 + this.aleatoire() * 40) * (1 - orage * 0.6);
    }
    if (r.duree > 0) {
      r.duree -= dt;
      r.force += (r.cible - r.force) * Math.min(1, dt * 1.8); // la rafale monte en ~1 s
    } else {
      r.force += (0 - r.force) * Math.min(1, dt * 0.5); // et retombe plus lentement
    }
    let respiration = 0;
    for (const o of this.ondes) respiration += Math.sin((t / o.periode) * 6.28 + o.phase);
    respiration *= 0.035 * (1 + orage);
    let bascule = 0;
    for (const o of this.bascules) bascule += Math.sin((t / o.periode) * 6.28 + o.phase);
    bascule *= 3.5 * (1 + orage);

    this.facteurRafale = r.force;
    this.vitesse = Math.max(0, meteo.vent * (1 + respiration + r.force));
    this.direction = (meteo.directionVent + bascule + r.force * 8 + 360) % 360;
    // vecteur (m/s) dans le sens où va l'air
    const a = angleVers(this.direction);
    this.vecteur.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(this.vitesse * NOEUD);
    return this.vecteur;
  }
}
