// Le voilier complet : le modèle 3D, les voiles, et ses pièces qui bougent.
//
// Pour l'instant (étape 1), le bateau « flotte » simplement : il suit la hauteur et
// la pente de l'eau sous lui, avec un peu d'inertie, et gîte (penche) sous le vent.
// La vraie physique (poussée de l'eau sur la coque, force du vent dans les voiles,
// safran) viendra à l'étape 2.
import * as THREE from 'three';
import { construireBateau } from './modele.js';
import { Voiles } from './voiles.js';
import { Cordages } from './cordages.js';
import { Instruments } from './instruments.js';
import { Interieur } from './interieur.js';
import { EauABord } from './eau-a-bord.js';
import { zDe, demiLargeur, COCKPIT, DESCENTE_ROUF, hauteurLivet, hauteurPont } from './forme.js';

export class Bateau {
  constructor() {
    const { groupe, materiaux, pivotBome, pivotSafran, mesures, capot, planches, levierPompe } = construireBateau();
    this.capot = capot;
    this.planches = planches;
    this.levierPompe = levierPompe;
    this.groupe = groupe;
    this.materiaux = materiaux;
    this.pivotBome = pivotBome;
    this.pivotSafran = pivotSafran;
    this.mesures = mesures;
    this.voiles = new Voiles(mesures);
    groupe.add(this.voiles.grandVoile.mesh, this.voiles.foc.mesh);
    this.voileFerlee = creerVoileFerlee();
    pivotBome.add(this.voileFerlee);
    this.creerFeux();
    this.cordages = new Cordages(this);
    this.instruments = new Instruments(this);
    this.interieur = new Interieur(this);
    this.eauABord = new EauABord(this); // l'eau embarquée (la nuit de tempête)
    this.descenteOuverte = true;
    this.ouvrirDescente(true);

    // l'état de la flottaison simplifiée
    this.cap = 0; // degrés (0 = nord)
    this.gite = 0; // radians (+ = penche sur tribord)
    this.tangage = 0;
    this.roulis = 0;
    this.altitude = 0;
    this.vitesseVerticale = 0;
    this.reglage = {
      angleBome: -0.25, cote: -1, faseyement: 0, ris: 0, force: 1,
      angleFoc: -0.2, coteFoc: -1, faseyementFoc: 0, deroule: 1,
      barre: 0,
    };
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  // Flottaison simple : on mesure l'eau sous l'étrave, le tableau et les deux flancs
  flotter(dt, houle) {
    const g = this.groupe;
    const cap = THREE.MathUtils.degToRad(this.cap);
    const avant = new THREE.Vector3(Math.sin(cap), 0, -Math.cos(cap));
    const droite = new THREE.Vector3(Math.cos(cap), 0, Math.sin(cap));
    const centre = g.position;
    const lire = (dz, dx) => houle.hauteur(centre.x + avant.x * dz + droite.x * dx, centre.z + avant.z * dz + droite.z * dx);
    const hAvant = lire(3.6, 0);
    const hArriere = lire(-3.4, 0);
    const hTribord = lire(0.3, 1.4);
    const hBabord = lire(0.3, -1.4);
    const hCentre = lire(0, 0);
    const hMoyenne = (hAvant + hArriere + hTribord + hBabord + 2 * hCentre) / 6;
    const tangageCible = Math.atan2(hAvant - hArriere, 7.0);
    const roulisCible = Math.atan2(hTribord - hBabord, 2.8);
    // un ressort amorti : le bateau a du poids, il ne suit pas instantanément l'eau
    const raideur = 9;
    const amortissement = 4.2;
    const acc = (hMoyenne - this.altitude) * raideur - this.vitesseVerticale * amortissement;
    this.vitesseVerticale += acc * dt;
    this.altitude += this.vitesseVerticale * dt;
    const suivi = 1 - Math.exp(-dt * 2.6);
    this.tangage += (tangageCible - this.tangage) * suivi;
    this.roulis += (roulisCible - this.roulis) * suivi * 0.8;
    g.position.y = this.altitude;
    // ordre : cap, puis tangage (le nez monte), puis roulis + gîte
    this._e.set(this.tangage, -cap, this.roulis - this.gite, 'YXZ');
    g.quaternion.setFromEuler(this._e);
  }

  // La descente : planches enlevées et capot glissé vers l'avant (ouverte), ou en place
  ouvrirDescente(ouverte) {
    this.descenteOuverte = ouverte;
    this.planches.visible = !ouverte;
    this.capot.position.z = ouverte ? -DESCENTE_ROUF.course : 0;
  }

  // Le levier de la pompe de cale (angle en radians)
  pomper(angle) {
    this.levierPompe.rotation.x = angle;
  }

  // Les feux de navigation : rouge à bâbord, vert à tribord (à l'avant), blanc à
  // l'arrière et en tête de mât. Obligatoires la nuit ; ils éclairent un peu le pont.
  creerFeux() {
    const m = this.mesures;
    // chaque feu : un verre teinté (éteint, il reflète le ciel ; allumé, il brille) posé
    // sur un petit boîtier noir ; le feu de poupe est au bout d'un mât de pavillon
    const feu = (couleur, position, portee, pied = null) => {
      const teinte = new THREE.Color(couleur);
      const materiau = new THREE.MeshStandardMaterial({
        color: teinte.clone().lerp(new THREE.Color(1, 1, 1), 0.5), roughness: 0.12, metalness: 0,
        emissive: teinte, emissiveIntensity: 0,
      });
      const verre = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 10), materiau);
      verre.position.set(...position);
      const boitier = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), this.materiaux.noir);
      boitier.position.set(position[0], position[1] - 0.035, position[2]);
      const lumiere = new THREE.PointLight(couleur, 0, portee, 2);
      lumiere.position.set(...position);
      this.groupe.add(verre, boitier, lumiere);
      if (pied) {
        const hauteur = position[1] - 0.05 - pied[1];
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, hauteur, 8), this.materiaux.inox);
        tube.position.set(pied[0], pied[1] + hauteur / 2, pied[2]);
        this.groupe.add(tube);
      }
      return { materiau, lumiere, couleur: teinte };
    };
    const yBalcon = hauteurLivet(0.965) + 0.5;
    const zPoupe = zDe(0.006);
    this.feux = [
      feu(0xff2a1a, [-0.22, yBalcon, zDe(0.962)], 2.8),
      feu(0x22ff66, [0.22, yBalcon, zDe(0.962)], 2.8),
      feu(0xfff4e0, [0, hauteurPont(0.01, 0) + 0.72, zPoupe], 4, [0, hauteurPont(0.01, 0), zPoupe]),
      feu(0xfff4e0, [0, m.tete + 0.12, m.zMat], 6),
    ];
    this.allumerFeux(0);
  }

  allumerFeux(niveau) {
    for (const f of this.feux) {
      f.materiau.emissiveIntensity = niveau * 40;
      f.lumiere.intensity = niveau * 0.7;
    }
  }

  maj(dt) {
    const r = this.reglage;
    this.pivotBome.rotation.y = r.angleBome;
    // la toile roulée sur la bôme : le bas de la grand-voile quand on a pris des ris,
    // toute la voile quand elle est affalée
    const ris = r.ris ?? 0;
    this.voileFerlee.visible = ris > 0;
    const grosseur = [0, 0.45, 0.65, 1][ris] ?? 1;
    const boudin = this.voileFerlee.children[0];
    boudin.scale.set(grosseur, grosseur, 1);
    boudin.position.y = 0.06 + 0.1 * grosseur; // posé sur la bôme
    // angle du safran (rad, + = bord de fuite vers tribord) ; la barre franche, de
    // l'autre côté de la mèche, part donc dans l'autre sens
    this.pivotSafran.rotation.y = r.angleSafran ?? -r.barre * 0.55;
    this.voiles.maj(dt, r);
    this.cordages.maj(dt);
  }

  // Les points de vue à bord (repère du bateau)
  static POSTES = {
    // assis au vent sur le banc tribord, la barre à la main
    barreur: new THREE.Vector3(0.62, COCKPIT.banc + 0.82, zDe(0.16)),
    // debout dans le cockpit, devant la descente
    debout: new THREE.Vector3(0.0, COCKPIT.plancher + 1.62, zDe(0.27)),
    // au pied du mât (pour prendre un ris)
    mat: new THREE.Vector3(0.35, 1.0 + 1.6, zDe(0.55)),
  };
}

// La grand-voile ferlée sur la bôme : un long boudin de toile, plus gros près du mât,
// serré tous les 60 cm par un raban (les petites sangles qui la tiennent)
function creerVoileFerlee() {
  const groupe = new THREE.Group();
  groupe.name = 'voile-ferlee';
  const toile = new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.88 });
  const sangle = new THREE.MeshStandardMaterial({ color: 0x1d3b5c, roughness: 0.7 });
  const profil = [];
  for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    // (rayon le long de la bôme : gros au mât, fin vers la chute, avec des renflements
    // entre les rabans)
    const r = (0.14 - 0.08 * t) * (1 - 0.18 * Math.abs(Math.cos(t * Math.PI * 5.5)));
    profil.push(new THREE.Vector2(Math.max(0.005, r), 0.15 + t * 3.25));
  }
  profil.unshift(new THREE.Vector2(0.001, 0.12));
  profil.push(new THREE.Vector2(0.001, 3.42));
  const boudin = new THREE.LatheGeometry(profil, 18);
  boudin.rotateX(Math.PI / 2); // le long de la bôme (+z)
  boudin.scale(1, 0.8, 1); // un peu aplati
  const corps = new THREE.Mesh(boudin, toile);
  corps.castShadow = true;
  // (le groupe « bas » est grossi selon les ris, et posé sur la bôme : voir maj())
  const bas = new THREE.Group();
  bas.add(corps);
  for (let k = 1; k <= 5; k++) {
    const z = 0.15 + k * 0.6;
    const t = (z - 0.15) / 3.25;
    const r = (0.14 - 0.08 * t) * 1.02;
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 18), sangle);
    anneau.scale.set(1, 0.8, 1);
    anneau.position.set(0, 0, z);
    bas.add(anneau);
  }
  groupe.add(bas);
  return groupe;
}

export { zDe, demiLargeur };
