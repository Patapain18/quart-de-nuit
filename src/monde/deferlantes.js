// Les déferlantes : par gros temps (à partir d'une trentaine de nœuds), des crêtes de
// vagues s'écroulent. Ce fichier décide QUAND une déferlante frappe le bateau, avec
// QUELLE force, et D'OÙ elle vient (le vent pousse les vagues : elles arrivent du côté
// du vent, à une quinzaine de degrés près). Ce qu'elle fait au bateau est dans la
// physique (physique/voilier.js, deferlante()).
//
// Le jeu (la nuit) et le test de la tempête se servent du même tirage.
import { Vector3 } from 'three';
import { angleVers } from './meteo.js';

function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Combien de déferlantes frappent le bateau, par seconde, selon le vent (nœuds) :
// aucune sous 28 nœuds, une toutes les 35 s environ à 40 nœuds
export function frequenceDeferlantes(vent, difficulte = 1) {
  return (Math.max(0, (vent - 28) / 12) / 35) * difficulte;
}

export class Deferlantes {
  constructor(graine = 3) {
    this.hasard = generateur(graine);
    this.annonce = null; // la prochaine : elle arrive dans quelques secondes (on la voit venir)
    this.attente = 8;
  }

  // Une image : renvoie la déferlante qui frappe maintenant ({ force, vers }), sinon null.
  // Avant de frapper, chacune est « annoncée » quelques secondes : this.annonce
  // ({ force, vers, dans }) permet de la montrer qui approche et de l'entendre gronder.
  maj(dt, meteo, difficulte = 1) {
    if (this.annonce) {
      this.annonce.dans -= dt;
      if (this.annonce.dans <= 0) {
        const frappe = this.annonce;
        this.annonce = null;
        return frappe;
      }
      return null;
    }
    this.attente -= dt;
    if (this.attente > 0) return null;
    this.attente = 1;
    // un tirage par seconde
    if (this.hasard() > frequenceDeferlantes(meteo.vent, difficulte)) return null;
    // la plupart sont petites, les grosses sont rares (une sur sept dépasse 0,95 : de
    // travers, celle-là couche le bateau)
    const force = 0.3 + 0.9 * this.hasard() ** 2;
    const ecart = (this.hasard() - 0.5) * 30; // degrés
    const a = angleVers(meteo.directionVent + ecart);
    this.annonce = { force, vers: new Vector3(Math.cos(a), 0, Math.sin(a)), dans: 3.5, duree: 3.5 };
    this.attente = 6; // pas deux d'affilée
    return null;
  }
}
