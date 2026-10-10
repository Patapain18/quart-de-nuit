// Le voilier complet : le modèle 3D, les voiles, et ses pièces qui bougent (la bôme, le
// safran et la roue, la porte de la timonerie, les essuie-glaces, le levier de la pompe, la
// trappe de la cale, les volets de tempête).
// (La vraie physique est dans physique/voilier.js ; flotter() ne sert qu'aux ateliers.)
import * as THREE from 'three';
import { construireBateau } from './modele.js';
import { Voiles } from './voiles.js';
import { Cordages } from './cordages.js';
import { Instruments } from './instruments.js';
import { Interieur } from './interieur.js';
import { EauABord } from './eau-a-bord.js';
import { Radar } from './radar.js';
import { PaquetDeMer } from './paquet-de-mer.js';
import { Electronique } from './electronique.js';
import { mouillerLesVitres } from './vitres.js';
import { zDe, demiLargeur, COCKPIT, MAT, hauteurLivet, hauteurPont, DALOTS_COCKPIT } from './forme.js';
import { LARGEUR_BATTANT } from './timonerie.js';

export class Bateau {
  constructor() {
    const { groupe, materiaux, pivotBome, pivotSafran, roue, mesures, porte, essuieGlaces, carreaux } = construireBateau();
    // les vitres de la timonerie, une par une (dans l'ordre de quart/systemes.js, VITRES)
    this.carreaux = carreaux;
    this.roue = roue; // (elle tourne avec le safran : le pilote la fait tourner)
    this.porte = porte; // la porte coulissante de la timonerie, vers le cockpit
    this.essuieGlaces = essuieGlaces;
    this.balayage = 0; // (les essuie-glaces : 0 arrêtés → 1 au plus vite, réglé par le jeu)
    // la pluie sur les vitres de la timonerie (réglée par le jeu : pluie 0 → 1)
    this.vitres = mouillerLesVitres(materiaux.vitreTimonerie);
    this.pluieSurLesVitres = 0;
    this._phaseEssuie = 0;
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
    this.levierPompe = this.interieur.levierPompe; // (la pompe de cale, dans la timonerie)
    this.radar = new Radar(this, this.interieur); // (sur la console de la timonerie, et son répétiteur dans le cockpit)
    this.electronique = new Electronique(this, this.interieur, this.instruments); // (le traceur, le pilote)
    this.paquet = new PaquetDeMer(this); // (l'eau verte qui balaie le pont quand une déferlante frappe)
    this.creerDalots();
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

  // L'entrée de la timonerie : la porte coulissante, glissée vers bâbord (ouverte) ou fermée
  // (on garde le nom « descente » : c'est toujours le chemin vers l'intérieur)
  ouvrirDescente(ouverte) {
    this.descenteOuverte = ouverte;
    const [gauche, droite] = this.porte.userData.battants;
    const l = LARGEUR_BATTANT;
    // (ouverte, chacun a coulissé contre la paroi : il dépasse de 3 cm dans l'ouverture, et
    // ne touche pas le lambris, qui se resserre vers le haut)
    gauche.position.x = ouverte ? -2 * l + 0.03 : -l;
    droite.position.x = ouverte ? l - 0.03 : 0;
  }

  // Les vitres de la timonerie : 'ok', 'fendue' ou 'brisee', chacune (etats : dans l'ordre de
  // quart/systemes.js, VITRES)
  montrerVitres(etats) {
    etats.forEach((etat, k) => {
      const c = this.carreaux[k];
      if (!c || c.etat === etat) return;
      c.etat = etat;
      c.verre.visible = etat !== 'brisee';
      c.felure.visible = etat === 'fendue';
      c.eclats.visible = etat === 'brisee';
    });
  }

  // Les dalots du cockpit : ses deux trous d'évacuation (75 mm), aux coins arrière du plancher,
  // derrière la roue, sous leur grille. Quand une déferlante les bouche (vers 4 h 30), un paquet
  // de cordage arraché et un lambeau de la housse de la roue sont plaqués dessus.
  creerDalots() {
    const C = COCKPIT;
    const z = zDe(C.uArriere) - 0.14;
    const y = C.plancher + 0.004;
    this.dalots = DALOTS_COCKPIT.map((x) => new THREE.Vector3(x, y, z));
    for (const p of this.dalots) {
      // (la grille : un disque noir, et ses barreaux d'inox)
      const grille = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20).rotateX(-Math.PI / 2), this.materiaux.noir);
      grille.position.copy(p);
      grille.name = 'dalot';
      this.groupe.add(grille);
      for (const dx of [-0.03, 0, 0.03]) {
        const barreau = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.09), this.materiaux.inox);
        barreau.position.set(p.x + dx, y + 0.002, p.z);
        barreau.name = 'dalot';
        this.groupe.add(barreau);
      }
    }
    // ce qui les bouche : le paquet de cordage (deux boucles écrasées et un bout qui traîne vers
    // l'autre dalot) et le lambeau de housse, bleu marine, plaqué par l'eau
    const bouchon = new THREE.Group();
    bouchon.name = 'dalots-bouches';
    const [a, b] = this.dalots;
    for (const [r, dy, rot] of [[0.075, 0.02, 0.3], [0.06, 0.04, 1.4]]) {
      const boucle = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 22), this.materiaux.cordage);
      boucle.rotation.set(-Math.PI / 2 + 0.25, 0, rot);
      boucle.scale.set(1, 0.6, 1);
      boucle.position.set(a.x + 0.02, a.y + dy, a.z - 0.01);
      bouchon.add(boucle);
    }
    const trajet = new THREE.CatmullRomCurve3([
      new THREE.Vector3(a.x + 0.06, a.y + 0.02, a.z),
      new THREE.Vector3(a.x * 0.3, a.y + 0.012, a.z - 0.09),
      new THREE.Vector3(b.x * 0.4, b.y + 0.012, b.z + 0.03),
      new THREE.Vector3(b.x - 0.02, b.y + 0.015, b.z - 0.01),
    ]);
    bouchon.add(new THREE.Mesh(new THREE.TubeGeometry(trajet, 40, 0.011, 6), this.materiaux.cordage));
    const toile = new THREE.PlaneGeometry(0.26, 0.2, 6, 5);
    const pos = toile.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.012 * Math.sin(pos.getX(i) * 40 + pos.getY(i) * 23) + 0.006 * Math.cos(pos.getY(i) * 61));
    toile.computeVertexNormals();
    const lambeau = new THREE.Mesh(toile, new THREE.MeshStandardMaterial({ color: 0x1e2c44, roughness: 0.9, side: THREE.DoubleSide }));
    lambeau.rotation.set(-Math.PI / 2, 0, 0.5);
    lambeau.position.set(b.x, b.y + 0.016, b.z);
    bouchon.add(lambeau);
    bouchon.visible = false;
    this.groupe.add(bouchon);
    this.bouchonDalots = bouchon;
  }

  // Les dalots bouchés (ou dégagés) ; litres : l'eau du cockpit (ce qui les bouche flotte à
  // moitié, juste sous sa surface : on le voit, même le cockpit plein)
  montrerDalots(bouches, litres = 0) {
    if (this.bouchonDalots.visible !== bouches) this.bouchonDalots.visible = bouches;
    if (bouches) this.bouchonDalots.position.y = Math.max(0, Math.min(0.5, litres / 2100) - 0.025);
  }

  // Le levier de la pompe de cale (angle en radians, de -0,7 à 0,7 : de haut en bas ; il
  // ne monte pas jusqu'aux volets, sous la fenêtre)
  pomper(angle) {
    this.levierPompe.rotation.x = 0.2 + angle * 0.5;
  }

  // Les feux de navigation : rouge à bâbord, vert à tribord (à l'avant), blanc à
  // l'arrière et en tête de mât. Obligatoires la nuit ; ils éclairent un peu le pont, et
  // la mer tout près — chacun seulement dans son secteur, comme les vrais (ils ont un
  // écran) : le rouge et le vert de l'avant jusqu'un peu en arrière du travers, chacun de
  // son côté ; le blanc de poupe vers l'arrière (il éclaire le sillage, pas le cockpit).
  creerFeux() {
    const m = this.mesures;
    // chaque feu : un verre teinté (éteint, il reflète le ciel ; allumé, il brille) posé
    // sur un petit boîtier noir ; le feu de poupe est au bout d'un mât de pavillon
    // (direction : le milieu de son secteur ; angle : le demi-angle de son cône)
    const feu = (couleur, position, portee, direction, angle, pied = null) => {
      const teinte = new THREE.Color(couleur);
      const materiau = new THREE.MeshStandardMaterial({
        color: teinte.clone().lerp(new THREE.Color(1, 1, 1), 0.5), roughness: 0.12, metalness: 0,
        emissive: teinte, emissiveIntensity: 0,
      });
      const verre = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 10), materiau);
      verre.position.set(...position);
      const boitier = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), this.materiaux.noir);
      boitier.position.set(position[0], position[1] - 0.035, position[2]);
      const lumiere = new THREE.SpotLight(couleur, 0, portee, angle, 0.35, 2);
      lumiere.position.set(...position);
      lumiere.target.position.set(...position).add(new THREE.Vector3(...direction).normalize());
      this.groupe.add(verre, boitier, lumiere, lumiere.target);
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
    const cote = (s) => [s * Math.sin(1.0), -0.25, -Math.cos(1.0)];
    this.feux = [
      feu(0xff2a1a, [-0.3, yBalcon, zDe(0.962)], 5, cote(-1), 1.05),
      feu(0x22ff66, [0.3, yBalcon, zDe(0.962)], 5, cote(1), 1.05),
      feu(0xfff4e0, [0, hauteurPont(0.01, 0) + 0.8, zPoupe], 9, [0, -0.3, 1], 1.15, [0, hauteurPont(0.01, 0), zPoupe]),
      feu(0xfff4e0, [0, m.tete + 0.14, m.zMat], 8, [0, -0.35, -1], 1.35),
    ];
    this.allumerFeux(0);
  }

  allumerFeux(niveau) {
    for (const f of this.feux) {
      f.materiau.emissiveIntensity = niveau * 40;
      f.lumiere.intensity = niveau * 0.5;
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
    // (la roue : un tour et demi d'une butée à l'autre, pour 70° de safran)
    this.roue.rotation.z = -(r.angleSafran ?? 0) * 7.7;
    this.voiles.maj(dt, r);
    this.cordages.maj(dt);
    // les essuie-glaces : un aller-retour d'une seconde et demie (ou deux par seconde au plus
    // vite), qui finit son balayage avant de s'arrêter
    if (this.balayage > 0.01 || Math.sin(this._phaseEssuie) > 0.02) {
      this._phaseEssuie += dt * (1.6 + 3 * this.balayage);
      if (this.balayage <= 0.01 && Math.sin(this._phaseEssuie) <= 0.02) this._phaseEssuie = 0;
    }
    // (au repos, couchés en bas de la vitre ; ils balayent ensemble jusqu'à la verticale)
    const balai = Math.max(0, Math.sin(this._phaseEssuie)) ** 0.8;
    for (const e of this.essuieGlaces) e.balancier.rotation.z = e.repos * (1 - balai);
    // (l'eau sur les vitres : elle arrive vite, et met un moment à s'égoutter)
    const v = this.vitres;
    v.uTempsVitre.value += dt;
    v.uPluieVitre.value += (this.pluieSurLesVitres - v.uPluieVitre.value) * Math.min(1, dt * (this.pluieSurLesVitres > v.uPluieVitre.value ? 1.5 : 0.08));
    v.uEssuie.value += ((this.balayage > 0.01 ? 1 : 0) - v.uEssuie.value) * Math.min(1, dt * 2);
  }

  // Les points de vue à bord (repère du bateau)
  static POSTES = {
    // debout derrière la roue
    barreur: new THREE.Vector3(0, COCKPIT.plancher + 1.62, zDe(0.06)),
    // debout dans le cockpit, devant la porte de la timonerie
    debout: new THREE.Vector3(0.0, COCKPIT.plancher + 1.62, zDe(0.17)),
    // au pied du mât
    mat: new THREE.Vector3(0.45, hauteurPont(MAT.u, 0.45) + 1.62, zDe(MAT.u - 0.03)),
  };
}

// La grand-voile ferlée sur la bôme : un long boudin de toile, plus gros près du mât,
// serré tous les 60 cm par un raban (les petites sangles qui la tiennent)
// (la toile roulée court sur presque toute la bôme)
const L_FERLEE = MAT.bome * 0.88;
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
    const r = (0.19 - 0.1 * t) * (1 - 0.18 * Math.abs(Math.cos(t * Math.PI * 7.5)));
    profil.push(new THREE.Vector2(Math.max(0.005, r), 0.2 + t * L_FERLEE));
  }
  profil.unshift(new THREE.Vector2(0.001, 0.16));
  profil.push(new THREE.Vector2(0.001, 0.2 + L_FERLEE + 0.17));
  const boudin = new THREE.LatheGeometry(profil, 18);
  boudin.rotateX(Math.PI / 2); // le long de la bôme (+z)
  boudin.scale(1, 0.8, 1); // un peu aplati
  const corps = new THREE.Mesh(boudin, toile);
  corps.castShadow = true;
  // (le groupe « bas » est grossi selon les ris, et posé sur la bôme : voir maj())
  const bas = new THREE.Group();
  bas.add(corps);
  for (let k = 1; k <= 7; k++) {
    const z = 0.2 + k * 0.62;
    const t = (z - 0.2) / L_FERLEE;
    const r = (0.19 - 0.1 * t) * 1.02;
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 18), sangle);
    anneau.scale.set(1, 0.8, 1);
    anneau.position.set(0, 0, z);
    bas.add(anneau);
  }
  groupe.add(bas);
  return groupe;
}

export { zDe, demiLargeur };
