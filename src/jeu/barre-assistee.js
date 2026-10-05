// La barre assistée : on ne pousse plus la barre soi-même, on donne le cap.
//
// À la vraie barre, tenir un cap est un métier : le bateau répond en retard, il « veut »
// remonter au vent (il est ardent : lâchée, la barre revient au milieu et le bateau lofe),
// chaque vague le fait embarder. Ici, Q et D font tourner le cap voulu (18° par seconde) ;
// quand on lâche, le cap reste où il est, et un barreur invisible tient la barre pour
// l'y garder :
//  - il pousse la barre d'autant plus que le bateau est loin du cap (proportionnel) ;
//  - il freine la rotation du bateau avant qu'il ne dépasse le cap (dérivée) ;
//  - il se souvient de l'écart qui dure — le bateau ardent qui tire toujours du même côté —
//    et le compense peu à peu (intégrale) : c'est ce que fait la main du barreur.
// Et il connaît le vent : un voilier ne remonte pas à moins de 44° du vent. Si l'on
// lâche les touches avec le cap voulu dans ce « cône interdit », il le sort du cône : au
// près du même bord, ou, si le cap voulu a déjà passé le vent, au près de l'autre bord
// (on finit le virement de bord commencé).
// Il n'est pas plus fort que le safran : par grosse mer, une vague peut quand même
// faire partir le bateau, et il faut de la vitesse pour que la barre agisse.
// (Sans aucun écran : les tests le font naviguer, scripts/test-barre.js)

export const VITESSE_CAP = 18; // degrés par seconde, touche enfoncée
export const ANGLE_MIN = 44; // on ne remonte pas plus près du vent
const AVANCE_MAX = 90; // le cap voulu ne prend jamais plus de 90° d'avance sur le bateau
export const BARRE_MAX = 0.6;
const VITESSE_BARRE = 1.2; // la main pousse la barre à 1,2 rad/s au plus
const GITE_BARRE = 0.012; // rad de barre par degré de gîte (contre l'envie de lofer)

export const ecartCap = (a, b) => ((a - b + 540) % 360) - 180; // a - b, entre -180 et 180

export class BarreAssistee {
  constructor() {
    this.capVoulu = null; // null : pas encore de cap (on prend celui du bateau)
    this.integrale = 0;
  }

  // On prend la barre (ou on débraye le pilote) : on garde le cap du moment
  reprendre(cap = null) {
    this.capVoulu = cap;
    this.integrale = 0;
  }

  // D'où vient le vent (cap, en degrés), d'après les mesures du bateau
  static origineDuVent(m) {
    return (m.cap + m.angleVentReel + 360) % 360;
  }

  // axe : -1 (Q, à gauche), 0, 1 (D, à droite). Bouge la barre de physique (un PhysiqueVoilier).
  maj(dt, axe, physique) {
    const m = physique.mesures;
    if (this.capVoulu === null) this.capVoulu = m.cap;
    if (axe) {
      this.capVoulu = (this.capVoulu + axe * VITESSE_CAP * dt + 360) % 360;
    } else if (physique.ventReel.lengthSq() > 1) {
      // touches lâchées : le cap voulu hors du cône où le bateau ne peut pas aller
      const vent = BarreAssistee.origineDuVent(m);
      const a = ecartCap(vent, this.capVoulu); // > 0 : le vent vient de tribord du cap voulu
      if (Math.abs(a) < ANGLE_MIN) {
        // le cap voulu a-t-il franchi le lit du vent (de l'autre côté que le bateau) ? Alors
        // c'est un virement de bord : on le finit, au près sur l'autre bord. Sinon, on
        // reste au près, du même bord.
        const bordBateau = m.angleVentReel >= 0 ? 1 : -1; // 1 : le vent vient de tribord
        const vire = Math.sign(a || bordBateau) !== bordBateau;
        this.capVoulu = (vent + (vire ? bordBateau : -bordBateau) * ANGLE_MIN + 360) % 360;
      }
    }
    let erreur = ecartCap(m.cap, this.capVoulu); // > 0 : le bateau est à droite du cap voulu
    if (Math.abs(erreur) > AVANCE_MAX) {
      this.capVoulu = (m.cap - Math.sign(erreur) * AVANCE_MAX + 360) % 360;
      erreur = Math.sign(erreur) * AVANCE_MAX;
    }
    // (l'intégrale ne sert qu'à tenir le cap : pendant qu'on tourne, ou loin du cap, elle
    // se repose ; elle ne pousse jamais la barre de plus de 0,25 rad)
    if (axe || Math.abs(erreur) > 12) this.integrale *= Math.exp(-dt * 1.5);
    else this.integrale = Math.max(-30, Math.min(30, this.integrale + erreur * dt));
    // si une vague a fait reculer le bateau, le safran agit à l'envers : la main aussi
    const recule = physique.vitesse.dot(physique.avant) < -0.2 ? -1 : 1;
    // (et dès que le bateau gîte sous une risée, il va vouloir lofer : la main le devine)
    const voulu = recule * Math.max(-BARRE_MAX, Math.min(BARRE_MAX,
      -erreur * 0.035 - this.integrale * 0.008 + physique.rotation.y * 1.6 + m.gite * GITE_BARRE));
    physique.barre += Math.max(-VITESSE_BARRE * dt, Math.min(VITESSE_BARRE * dt, voulu - physique.barre));
  }
}
