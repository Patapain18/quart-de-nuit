// La journée d'apprentissage : l'heure qui avance, le temps qu'il fait, les leçons de Jos
// les unes après les autres, les bouées à rejoindre ou à contourner, les manœuvres que
// l'on reconnaît (virements, empannages) et le journal du carnet de bord.
//
// Ce fichier ne dessine rien et ne parle pas lui-même : il demande à la radio de parler
// et dit au jeu ce qui se passe. Ainsi on peut faire jouer toute la journée par un
// programme, sans navigateur (scripts/test-journee.js), pour vérifier que chaque leçon
// se réussit vraiment avec la vraie physique.
//
// ctx, ce que l'on sait à chaque image (fabriqué par le jeu) :
//   dt, m (les mesures du bateau : vitesse, cap, gîte, angleVentReel, incidences…),
//   physique (ris, deroule, ecouteGV, angleBome, position…), ventDe (d'où vient le vent,
//   en degrés), pilote, regleurAuto, mode ('barre' ou 'pied'), aBord (feux, lampeEssayee,
//   gilet, descenteOuverte, attache, dehors, zone), evenements (ce qui vient d'arriver :
//   'winch-borde'…).
import { AMBIANCES, etatMeteo, interpoler } from '../monde/meteo.js';
import { LECONS } from './lecons.js';
import { directionEnMots } from './radio.js';

export const NOM_BATEAU = 'Morgane';
export const JOS = 'Jos';
export const HEURE_COUCHER = 18.75; // la journée finit quand le soleil se couche

// ---------- Le temps qu'il fait au fil de la journée ----------
// Du matin calme au coucher de soleil menaçant : le vent forcit d'heure en heure, et en
// fin d'après-midi le front orageux monte à l'horizon, au sud-ouest.
const ETAPES_METEO = [
  [9, { ...AMBIANCES['matin-calme'], vent: 8, nuages: 0.2, brume: 0.25 }],
  [12.8, AMBIANCES.midi],
  [16.9, AMBIANCES['fin-apres-midi']],
  [18.45, AMBIANCES['coucher-menacant']],
  [20.5, { ...AMBIANCES['coucher-menacant'], vent: 30, nuages: 0.85, orage: 0.75, pluie: 0.35, front: 0.95 }],
];
export function meteoDuJour(heure) {
  let i = 0;
  while (i < ETAPES_METEO.length - 2 && heure > ETAPES_METEO[i + 1][0]) i++;
  const [h0, a] = ETAPES_METEO[i];
  const [h1, b] = ETAPES_METEO[i + 1];
  const t = Math.min(1, Math.max(0, (heure - h0) / (h1 - h0)));
  const m = interpoler(etatMeteo(a), etatMeteo(b), t);
  m.heure = heure;
  return m;
}

// « 9 h 05 »
export function heureEnTexte(h) {
  const minutes = Math.round(h * 60);
  return `${Math.floor(minutes / 60) % 24} h ${String(minutes % 60).padStart(2, '0')}`;
}

// Les bouées de la journée (des marques de balisage, comme sur la carte)
export const BOUEES = {
  jaune: { nom: 'la bouée jaune', couleur: 'jaune' },
  rouge: { nom: 'la bouée rouge', couleur: 'rouge' },
  verte: { nom: 'la bouée verte', couleur: 'verte' },
};

const enRadians = (d) => (d * Math.PI) / 180;
const tour = (a) => Math.atan2(Math.sin(a), Math.cos(a)); // ramène un angle entre −π et π

export class Journee {
  // radio : { parler(phrases, options) → promesse, libre } ; lecons : la liste des leçons
  constructor({ radio, lecons = LECONS } = {}) {
    this.radio = radio;
    this.lecons = lecons;
    this.heure = lecons[0].heure[0];
    this.i = 0; // la leçon en cours
    this.e = -1; // son étape (-1 : pas encore commencée)
    this.etat = 'lecon'; // 'lecon', 'transition' (l'accéléré entre deux leçons), 'finie'
    this.tLecon = 0;
    this.memo = {};
    this.parle = false; // Jos est en train de donner la consigne de l'étape
    this.jeton = 0;
    this.bouees = new Map(); // id → { id, nom, couleur, x, z }
    this.cible = null; // { id, action : 'approcher' ou 'contourner', balayage… }
    this.debloque = new Set(['barre', 'pilote']);
    this.reflexes = [];
    this.reussies = []; // les leçons réussies (leur numéro), et celles que l'on a passées
    this.passees = [];
    this.journal = [];
    this.compteurs = { virements: 0, empannages: 0, empannagesControles: 0, empannagesSauvages: 0 };
    this.evenements = new Set(); // ce qui est arrivé à cette image
    this.suivi = { cote: 0, coteBome: 0 };
    this.conseils = [];
    this.progression = null;
    this.liste = null;
    this.ecouteurs = {};
  }

  // ---------- Pour le jeu ----------
  on(nom, f) { (this.ecouteurs[nom] ??= []).push(f); return this; }
  emettre(nom, ...args) { for (const f of this.ecouteurs[nom] ?? []) f(...args); }
  get lecon() { return this.lecons[this.i]; }
  get etape() { return this.lecon?.etapes[Math.max(0, this.e)]; }
  get objectif() { return this.etat === 'lecon' ? this.etape?.objectif ?? '' : ''; }
  autorise(nom) { return this.debloque.has(nom); }
  debloquer(...noms) { for (const n of noms) this.debloque.add(n); }
  ecrire(texte) {
    const entree = { heure: this.heure, texte };
    this.journal.push(entree);
    this.emettre('journal', entree);
  }
  dire(phrases, { emetteur = JOS, canal = 72, siLibre = false } = {}) {
    return this.radio.parler(phrases, { emetteur, canal, siLibre });
  }

  // ---------- Les bouées ----------
  placerBouee(id, ctx, { cap, distance }) {
    const p = ctx.physique.position;
    const r = enRadians(cap);
    const b = { id, ...BOUEES[id], x: p.x + Math.sin(r) * distance, z: p.z - Math.cos(r) * distance };
    this.bouees.set(id, b);
    return b;
  }
  distanceBouee(id, ctx) {
    const b = this.bouees.get(id);
    const p = ctx.physique.position;
    return Math.hypot(b.x - p.x, b.z - p.z);
  }
  // le cap (degrés compas) vers la bouée, et le même par rapport à l'avant du bateau
  // (+ : elle est sur la droite)
  relevement(id, ctx) {
    const b = this.bouees.get(id);
    const p = ctx.physique.position;
    return ((Math.atan2(b.x - p.x, -(b.z - p.z)) * 180) / Math.PI + 360) % 360;
  }
  relevementRelatif(id, ctx) { return ((this.relevement(id, ctx) - ctx.m.cap + 540) % 360) - 180; }
  // le cap qui met le vent à « angle » degrés, du côté où il est maintenant
  capPourAngleVent(ctx, angle) {
    const cote = ctx.m.angleVentReel >= 0 ? 1 : -1;
    return (((ctx.ventDe - cote * angle) % 360) + 360) % 360;
  }
  contournee(id) { return this.cible?.id === id && this.cible.contournee === true; }
  // où l'on en est du tour de la bouée : l'approche, puis le demi-tour autour
  avanceeContour(id, ctx) {
    const c = this.cible;
    if (!c || c.id !== id) return 0;
    const d = this.distanceBouee(id, ctx);
    const approche = Math.max(0, 1 - (d - 60) / Math.max(1, (c.d0 ?? 300) - 60));
    return 0.5 * Math.min(1, approche) + 0.5 * Math.min(1, Math.abs(c.balayage ?? 0) / (Math.PI * 1.1));
  }

  // ---------- Chaque image ----------
  maj(dt, ctx) {
    this.evenements = new Set(ctx.evenements ?? []);
    ctx.evenements = this.evenements;
    this.suivreManoeuvres(ctx);
    this.suivreCible(ctx);
    if (this.etat === 'transition') {
      this.avancerTransition(dt);
      return;
    }
    if (this.etat !== 'lecon') return;
    const lecon = this.lecon;
    this.tLecon += dt;
    // l'heure avance avec la leçon (sans jamais rattraper l'heure de la suivante)
    const [h0, h1] = lecon.heure;
    this.heure = h0 + (h1 - h0) * Math.min(0.92, this.tLecon / lecon.duree);
    if (this.e < 0) this.commencerLecon(ctx);
    const etape = this.etape;
    this.memo.age = (this.memo.age ?? 0) + dt;
    const reussie = etape.verifier(ctx, this.memo, this);
    this.progression = etape.progression ? Math.min(1, Math.max(0, etape.progression(ctx, this.memo, this) || 0)) : null;
    this.liste = etape.liste ? etape.liste(ctx) : null;
    if (reussie && !this.parle) this.reussirEtape(ctx);
    else this.conseiller(etape, ctx, dt);
  }

  commencerLecon(ctx) {
    const lecon = this.lecon;
    if (this.i === 0) {
      const m = ctx.meteo;
      this.ecrire(`Appareillé de Kervalen, le foc à moitié roulé. Vent ${m ? directionEnMots(m.directionVent) : ''} ${m ? Math.round(m.vent) : ''} nœuds.`.replace(/\s+/g, ' '));
    }
    this.ecrire(`Leçon ${this.i + 1} : ${lecon.titre.toLowerCase()}.`);
    lecon.avant?.(this, ctx);
    this.emettre('lecon', lecon, this.i);
    this.commencerEtape(0, ctx);
  }

  commencerEtape(n, ctx) {
    this.e = n;
    this.memo = {};
    this.conseils = [];
    const etape = this.etape;
    etape.debut?.(ctx, this.memo, this);
    if (etape.cible) {
      const b = this.bouees.get(etape.cible.id);
      this.cible = { ...etape.cible, balayage: 0, angle: null, contournee: false, d0: b ? this.distanceBouee(b.id, ctx) : 0 };
    } else {
      this.cible = null;
    }
    const jeton = ++this.jeton;
    if (etape.dire?.length) {
      this.parle = true;
      this.dire(etape.dire, { emetteur: etape.emetteur ?? JOS, canal: etape.canal ?? 72 }).then(() => {
        if (this.jeton === jeton) this.parle = false;
      });
    } else {
      this.parle = false;
    }
    this.emettre('etape', etape);
  }

  reussirEtape(ctx) {
    const lecon = this.lecon;
    const etape = this.etape;
    if (etape.bravo) this.dire([etape.bravo]);
    this.emettre('reussie', etape);
    if (this.e + 1 < lecon.etapes.length) this.commencerEtape(this.e + 1, ctx);
    else this.reussirLecon(ctx);
  }

  reussirLecon(ctx, { passee = false } = {}) {
    const lecon = this.lecon;
    this.reflexes.push(lecon.reflexe);
    (passee ? this.passees : this.reussies).push(this.i);
    if (!passee) this.ecrire(`${lecon.titre} : réussi.`);
    lecon.apres?.(this, ctx);
    if (lecon.fin) this.dire(lecon.fin);
    this.cible = null;
    this.progression = null;
    this.liste = null;
    this.emettre('leconReussie', lecon, this.i);
    // un accéléré jusqu'à l'heure de la leçon suivante (ou jusqu'au coucher du soleil) :
    // le soleil tourne, les nuages filent
    const derniere = this.i + 1 >= this.lecons.length;
    this.etat = 'transition';
    this.transition = {
      de: this.heure,
      a: derniere ? Math.max(this.heure, HEURE_COUCHER) : this.lecons[this.i + 1].heure[0],
      t: 0,
      duree: derniere ? 12 : 7,
      derniere,
    };
    if (derniere) this.ecrire('Bateau paré pour la nuit.');
  }

  // Reprendre la leçon en cours depuis le début (après un incident)
  reprendre() {
    if (this.etat !== 'lecon') return;
    this.radio.taire?.();
    this.jeton++;
    this.parle = false;
    this.e = -1;
    this.cible = null;
  }

  // Reprendre une partie gardée par le navigateur, au début de la leçon n° i : les leçons
  // d'avant ont débloqué leurs commandes et donné leurs réflexes
  restaurer({ lecon, reussies = [], passees = [], compteurs = {}, journal = [] }) {
    this.i = Math.max(0, Math.min(this.lecons.length - 1, lecon));
    this.e = -1;
    this.etat = 'lecon';
    this.tLecon = 0;
    this.heure = this.lecons[this.i].heure[0];
    this.reussies = [...reussies];
    this.passees = [...passees];
    Object.assign(this.compteurs, compteurs);
    this.journal = journal.map((e) => ({ ...e }));
    this.reflexes = [];
    for (let k = 0; k < this.i; k++) {
      this.lecons[k].avant?.(this);
      this.reflexes.push(this.lecons[k].reflexe);
    }
  }

  // Passer la leçon en cours (on sait déjà faire) : ce qu'elle débloque l'est quand même
  passer(ctx) {
    if (this.etat !== 'lecon') return;
    this.radio.taire?.();
    const lecon = this.lecon;
    if (this.e < 0) lecon.avant?.(this, ctx);
    this.ecrire(`Leçon ${this.i + 1} passée : ${lecon.titre.toLowerCase()}.`);
    this.jeton++;
    this.parle = false;
    this.reussirLecon(ctx, { passee: true });
  }

  avancerTransition(dt) {
    const tr = this.transition;
    tr.t += dt;
    const k = Math.min(1, tr.t / tr.duree);
    this.heure = tr.de + (tr.a - tr.de) * k * k * (3 - 2 * k);
    // on attend aussi que Jos ait fini de parler
    if (k >= 1 && this.radio.libre) {
      if (tr.derniere) {
        this.etat = 'finie';
        this.ecrire('Le soleil se couche.');
        this.emettre('finie');
        return;
      }
      this.etat = 'lecon';
      this.i++;
      this.e = -1;
      this.tLecon = 0;
    }
  }

  // Jos voit qu'on peine : il donne un conseil (pas trop souvent, et jamais en coupant la parole)
  conseiller(etape, ctx, dt) {
    if (!etape.conseils) return;
    etape.conseils.forEach((c, k) => {
      const s = (this.conseils[k] ??= { vrai: 0, repos: 0 });
      s.repos = Math.max(0, s.repos - dt);
      s.vrai = c.si(ctx, this.memo, this) ? s.vrai + dt : 0;
      if (s.vrai >= (c.apres ?? 3) && s.repos === 0 && !this.parle && this.radio.libre) {
        const texte = typeof c.dire === 'function' ? c.dire(ctx, this.memo, this) : c.dire;
        this.dire([texte], { siLibre: true });
        s.repos = c.repos ?? 25;
        s.vrai = 0;
      }
    });
  }

  // ---------- Les manœuvres ----------
  // Virer : le vent change de côté par l'avant. Empanner : par l'arrière, et la bôme
  // traverse ; l'empannage est « maîtrisé » si la grand-voile était bordée à ce moment-là.
  suivreManoeuvres(ctx) {
    const twa = ctx.m.angleVentReel;
    const a = Math.abs(twa);
    const s = this.suivi;
    if (a > 10 && a < 170) {
      const cote = Math.sign(twa);
      if (s.cote && cote !== s.cote && a < 90) {
        this.compteurs.virements++;
        this.evenements.add('virement');
      }
      s.cote = cote;
    }
    const coteBome = Math.sign(ctx.physique.angleBome) || s.coteBome;
    if (s.coteBome && coteBome !== s.coteBome && a > 100) {
      this.compteurs.empannages++;
      this.evenements.add('empannage');
      if (ctx.physique.ecouteGV < 0.5) {
        this.compteurs.empannagesControles++;
        this.evenements.add('empannage-controle');
      } else {
        this.compteurs.empannagesSauvages++;
        this.evenements.add('empannage-sauvage');
      }
    }
    s.coteBome = coteBome;
  }

  // Contourner une bouée : on mesure l'angle dont on a tourné autour d'elle, de près
  suivreCible(ctx) {
    const c = this.cible;
    if (!c) return;
    const b = this.bouees.get(c.id);
    if (!b) return;
    const p = ctx.physique.position;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (c.action !== 'contourner' || c.contournee) return;
    if (d < 90) {
      const angle = Math.atan2(p.z - b.z, p.x - b.x);
      if (c.angle !== null) c.balayage += tour(angle - c.angle);
      c.angle = angle;
      if (Math.abs(c.balayage) > Math.PI * 1.1) {
        c.contournee = true;
        this.ecrire(`Contourné ${b.nom}.`);
        this.evenements.add('bouee');
      }
    } else {
      c.angle = null;
      if (d > 170) c.balayage = 0;
    }
  }
}
