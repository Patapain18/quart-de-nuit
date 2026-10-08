// Les risées : des taches de vent plus fort qui courent sur l'eau, poussées par le vent
// (et, plus rares, des molles : des taches de vent plus faible). Elles existent quelque part :
// on les voit venir de loin (l'eau y est plus sombre, froissée ; sous le vent fort, plus
// blanche), puis le bateau les sent quand elles arrivent sur lui.
//
// Une risée, comme les vraies vues d'un bateau :
//  - une tache ovale de 70 à 320 m, plus longue dans le sens du vent (plus grande quand il
//    souffle fort), au bord irrégulier ;
//  - elle arrive d'un coup (son bord avant est net) et s'en va lentement (derrière, elle
//    s'efface) ;
//  - son vent est plus fort (de 12 à 24 % par beau temps, jusqu'à 40 % à l'orage) et il
//    tourne un peu à droite : il vient de plus haut, où le vent tourne déjà (dans notre
//    hémisphère) ;
//  - elle avance avec le vent (un peu plus ou un peu moins vite que lui), naît, vit une à
//    deux minutes, et s'efface ;
//  - sous un grain, il y en a bien plus, et l'air froid qui s'étale les pousse.
// Les molles, au contraire : le vent y faiblit, l'eau y est plus lisse, plus claire.
//
// Ce fichier ne dessine rien : il dit où sont les risées et ce qu'elles font en chaque
// point (monde/vent.js en tire le vent du bateau ; rendu/risees.js les dessine sur la mer ;
// le son, Jos, l'atelier lisent celle qui arrive).
import { NOEUD, angleVers } from './meteo.js';

export const REGLAGES_RISEES = {
  couverture: 0.3, // la part de la mer couverte de risées par beau temps…
  couvertureOrage: 0.35, // … et en plus, à l'orage
  molles: 0.07, // la part couverte de molles
  naissance: 14, // s pour se former
  mort: 22, // s pour s'effacer
  bascule: 8, // ° : le vent d'une risée de force 1 tourne de tant vers la droite
  maximum: 200, // (jamais plus de risées à la fois)
};

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// La force d'une risée à son âge (0 → 1) : elle se forme, vit, puis s'efface
export function vieDeLaRisee(r, age = r.age) {
  return lisse(0, r.naissance, age) * (1 - lisse(r.duree - REGLAGES_RISEES.mort, r.duree, age));
}

// La taille moyenne des risées (m) selon le vent (m/s) : plus il souffle, plus elles sont
// grandes (et elles passent plus vite)
export function longueurRisee(vent) {
  return 60 + 9 * vent;
}

export class Risees {
  constructor(graine = 1) {
    this.etatHasard = (graine * 2654435761 + 97) >>> 0;
    this.liste = [];
    this.prochainId = 1;
    this.peuple = false;
    this.meteo = null;
    this.rayon = 1000; // (elles vivent dans ce rayon autour du bateau)
    // le vent du moment : où il va (vecteur unitaire) et sa vitesse (m/s)
    this.ux = 1;
    this.uz = 0;
    this.vent = 5;
    this.agitation = 0;
    this._g = { x: 0, y: 0, z: 0 };
  }

  // Un petit hasard reproductible
  hasard() {
    const a = (this.etatHasard = (this.etatHasard + 0x6d2b79f5) >>> 0);
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- Elles vivent ----------
  // meteo : le temps qu'il fait ; (x, z) : le bateau ; agitation : sous un grain, là où il
  // est (0 → 1) ; grains : monde/grains.js (l'air froid qui s'étale pousse les risées)
  maj(dt, meteo, x, z, { agitation = 0, grains = null } = {}) {
    this.meteo = meteo;
    this.agitation = agitation;
    this.orienter(meteo);
    const L = longueurRisee(this.vent);
    // (on ne les fait vivre que là où on peut les voir : plus elles sont petites, moins loin)
    this.rayon = Math.min(1200, Math.max(700, 8 * L));
    if (!this.peuple) {
      this.peuple = true;
      const n = this.combien();
      for (let i = 0; i < n; i++) this.naitre(x, z, { partout: true });
    }
    // elles avancent, vieillissent, s'effacent ; celles qui sont restées loin derrière
    // nous disparaissent (en s'effaçant)
    const loin = 1.35 * this.rayon;
    this.ageVents = (this.ageVents ?? 0) + dt;
    const vents = grains && this.ageVents > 0.5;
    if (vents) this.ageVents = 0;
    for (const r of this.liste) {
      r.age += dt;
      // (elles vont avec le vent, chacune un peu à sa façon ; l'air froid d'un grain les
      // pousse en plus, en éventail)
      if (vents) {
        grains.ventEn(r.x, r.z, this._g);
        r.gx = this._g.x;
        r.gz = this._g.z;
      }
      r.vx = this.ux * this.vent * r.vitesse + (grains ? r.gx : 0);
      r.vz = this.uz * this.vent * r.vitesse + (grains ? r.gz : 0);
      r.x += r.vx * dt;
      r.z += r.vz * dt;
      if (Math.hypot(r.x - x, r.z - z) > loin && r.duree > r.age + 6) r.duree = r.age + 6;
    }
    this.liste = this.liste.filter((r) => r.age < r.duree);
    // de nouvelles naissent, pour qu'il y en ait toujours autant (plus, à l'orage et sous
    // un grain)
    const cible = this.combien();
    for (let k = 0; k < 4 && this.liste.length < cible; k++) this.naitre(x, z);
  }

  // Le vent du moment : sa direction et sa vitesse
  orienter(meteo) {
    const a = angleVers(meteo.directionVent);
    this.ux = Math.cos(a);
    this.uz = Math.sin(a);
    this.vent = Math.max(0.5, meteo.vent * NOEUD);
  }

  // Combien il en faut dans leur rayon, pour couvrir la mer comme il faut
  combien() {
    const orage = this.meteo?.orage ?? 0;
    const L = longueurRisee(this.vent);
    const aire = (Math.PI / 4) * L * L * 0.75; // (une tache moyenne : L × 0,75 L)
    const couverture = (REGLAGES_RISEES.couverture + REGLAGES_RISEES.couvertureOrage * orage) * (1 + 1.5 * this.agitation) + REGLAGES_RISEES.molles;
    return Math.min(REGLAGES_RISEES.maximum, Math.round((couverture * Math.PI * this.rayon * this.rayon) / aire));
  }

  // Une risée (ou une molle) qui naît quelque part autour de nous : dans un disque un peu
  // décalé vers le vent (c'est de là qu'elles viennent). partout : pour peupler la mer
  // d'un coup (elles ont déjà leur âge)
  naitre(x, z, { partout = false } = {}) {
    const meteo = this.meteo ?? {};
    const orage = meteo.orage ?? 0;
    const R = this.rayon;
    const a = this.hasard() * Math.PI * 2;
    const d = R * Math.sqrt(this.hasard());
    const cx = x - this.ux * 0.3 * R + Math.cos(a) * d;
    const cz = z - this.uz * 0.3 * R + Math.sin(a) * d;
    const orageR = REGLAGES_RISEES.couverture + REGLAGES_RISEES.couvertureOrage * orage;
    const molle = this.hasard() < REGLAGES_RISEES.molles / (REGLAGES_RISEES.molles + orageR * (1 + 1.5 * this.agitation));
    // (par petit temps, elles comptent un peu moins ; à l'orage, bien plus ; sous un grain,
    // il y en a plus, un peu moins fortes : sa rafale à lui s'ajoute déjà)
    const vent = meteo.vent ?? 10;
    const ampleur = (0.6 + 0.4 * Math.min(1, vent / 12));
    const force = molle
      ? -(0.06 + 0.08 * this.hasard()) * ampleur
      : (0.12 + 0.12 * this.hasard()) * (1 + 0.7 * orage) * ampleur * (1 - 0.3 * orage * this.agitation);
    const L = longueurRisee(this.vent) * (0.7 + 0.6 * this.hasard());
    const duree = (50 + 80 * this.hasard()) * (1 - 0.3 * orage);
    return this.creer({
      x: cx, z: cz, force, longueur: L, largeur: L * (0.55 + 0.4 * this.hasard()), duree,
      age: partout ? this.hasard() * duree : 0,
    });
  }

  creer({ x, z, force, longueur, largeur, duree, age = 0, naissance = REGLAGES_RISEES.naissance, vitesse = null, envoyee = false }) {
    // le bord, irrégulier : quelques ondulations, propres à chaque risée
    const k = [0, 1, 2, 3].map((i) => (this.hasard() * 2 - 1) * (i < 2 ? 0.13 : 0.08));
    const r = {
      id: this.prochainId++, x, z, force, longueur, largeur, duree, age, naissance,
      vitesse: vitesse ?? 0.92 + 0.16 * this.hasard(), vx: 0, vz: 0, gx: 0, gz: 0, k, envoyee,
    };
    r.vx = this.ux * this.vent * r.vitesse;
    r.vz = this.uz * this.vent * r.vitesse;
    this.liste.push(r);
    if (this.liste.length > REGLAGES_RISEES.maximum) this.liste.shift();
    return r;
  }

  // Une risée envoyée sur le point (x, z), qui va à (vbx, vbz) : son milieu y arrive dans
  // « dans » secondes (elle naît pour l'occasion, et grandit en approchant). ecart : à
  // combien de mètres sur le côté elle passe
  envoyer({ x, z, vbx = 0, vbz = 0, dans = 45, force = 0.32, ecart = 0, longueur = null }) {
    const L = longueur ?? longueurRisee(this.vent) * 1.15;
    const wx = this.ux * this.vent - vbx;
    const wz = this.uz * this.vent - vbz;
    const w = Math.hypot(wx, wz) || 1;
    const r = this.creer({
      x: x - wx * dans + (-wz / w) * ecart, z: z - wz * dans + (wx / w) * ecart,
      force, longueur: L, largeur: L * 0.85, duree: dans + 70, vitesse: 1, envoyee: true,
    });
    return r;
  }

  vider() {
    this.liste = [];
    this.peuple = false;
  }

  // ---------- Ce qu'elles font ----------
  // La forme d'une risée au point (x, z) : 1 en son cœur, 0 dehors (sans sa force)
  profil(r, x, z) {
    const v = Math.hypot(r.vx, r.vz) || 1;
    const ux = r.vx / v;
    const uz = r.vz / v;
    const dx = x - r.x;
    const dz = z - r.z;
    const a = ((dx * ux + dz * uz) * 2) / r.longueur; // + : devant (là où elle va)
    const b = ((dz * ux - dx * uz) * 2) / r.largeur;
    const d2 = a * a + b * b;
    if (d2 >= 1.9) return 0;
    const d = Math.sqrt(d2);
    let bord = 1;
    if (d > 1e-3) {
      const c = a / d;
      const s = b / d;
      const c2 = c * c - s * s;
      const s2 = 2 * c * s;
      bord += r.k[0] * c2 + r.k[1] * s2 + r.k[2] * (c * c2 - s * s2) + r.k[3] * (s * c2 + c * s2);
    }
    // devant, un bord net (elle arrive d'un coup) ; derrière, elle s'efface lentement
    const doux = 0.22 + 0.4 * lisse(0.3, -0.5, a);
    return 1 - lisse(1 - doux, 1, d / bord);
  }

  // Le vent des risées au point (x, z) : force (part du vent en plus : + dans une risée,
  // − dans une molle) et bascule (° : de combien il tourne, + vers la droite)
  ventEn(x, z, sortie = {}) {
    let plus = 0;
    let moins = 0;
    for (const r of this.liste) {
      const f = r.force * vieDeLaRisee(r);
      if (f === 0) continue;
      const p = this.profil(r, x, z);
      if (p <= 0) continue;
      if (f > 0) plus = Math.max(plus, f * p);
      else moins = Math.min(moins, f * p);
    }
    sortie.force = plus + moins;
    sortie.bascule = REGLAGES_RISEES.bascule * (plus + moins);
    return sortie;
  }

  // Tout ce qu'elles font au point (x, z) pour un bateau qui va à (vbx, vbz) :
  //   force, bascule (comme ventEn) ;
  //   approche : la prochaine risée qui passera sur lui { risee, distance (m, jusqu'à son
  //     bord), dans (s), force (celle qu'elle aura en arrivant) }, ou null ;
  //   niveau (0 → 1) : l'eau froissée qui arrive et qui passe (le bruit de la risée)
  mesurer(x, z, vbx = 0, vbz = 0, sortie = {}) {
    this.ventEn(x, z, sortie);
    let prochaine = null;
    for (const r of this.liste) {
      if (r.force <= 0) continue;
      const wx = r.vx - vbx;
      const wz = r.vz - vbz;
      const w = Math.hypot(wx, wz);
      if (w < 0.5) continue;
      const dx = x - r.x;
      const dz = z - r.z;
      const leLong = (dx * wx + dz * wz) / w; // (+ : nous sommes devant elle)
      const travers = (dz * wx - dx * wz) / w;
      const demiL = 0.45 * r.largeur;
      if (Math.abs(travers) > demiL) continue;
      const bord = leLong - 0.5 * r.longueur * Math.sqrt(1 - (travers / demiL) ** 2);
      if (bord < 0) continue;
      const dans = bord / w;
      if (dans > 120) continue;
      const force = r.force * vieDeLaRisee(r, r.age + dans);
      if (force < 0.08) continue;
      if (!prochaine || dans < prochaine.dans) prochaine = { risee: r, distance: bord, dans, force };
    }
    sortie.approche = prochaine;
    // (on entend l'eau froissée arriver quelques secondes avant, puis la risée passer)
    const arrive = prochaine ? Math.min(1, prochaine.force / 0.3) * lisse(14, 0, prochaine.dans) : 0;
    sortie.niveau = Math.max(arrive * 0.8, Math.min(1, Math.max(0, sortie.force) / 0.3));
    return sortie;
  }
}
