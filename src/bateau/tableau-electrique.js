// Le tableau électrique : sur le pupitre de la console de la timonerie, à droite du
// traceur, tourné vers le siège de quart — on l'atteint assis comme debout. C'est le courant
// du bord (quart/systemes.js), comme celui du gardien de nuit de FNAF :
//  - à gauche, la batterie : sa jauge (en %), sa tension, et ce qu'on tire (l'ampèremètre :
//    en rouge quand on la vide, en vert quand le moteur la recharge) ; trois voyants : CHARGE
//    (l'alternateur charge), CALE (l'alarme de cale), BATT. (la batterie faible) ;
//  - à droite, huit disjoncteurs à levier, chacun avec son nom et son voyant : le pilote (son
//    disjoncteur saute quand il chauffe trop : levier à mi-course, voyant rouge qui clignote),
//    le radar, le traceur, la VHF, les feux, l'éclairage (blanc ou rouge), la pompe de cale
//    électrique (son voyant s'allume en orange quand elle tourne), les moteurs des volets.
// Les noms sont rétroéclairés : la nuit, ils restent lisibles, sans éblouir.
import * as THREE from 'three';
import { poserSurPupitre } from './interieur-timonerie.js';

const LARGEUR = 0.34;
const HAUTEUR = 0.128;
const CIRCUITS = [['PILOTE'], ['RADAR'], ['TRA-', 'CEUR'], ['VHF'], ['FEUX'], ['ÉCLAI-', 'RAGE'], ['POMPE'], ['VOLETS']];
export const NOMS_CIRCUITS = ['pilote', 'radar', 'traceur', 'vhf', 'feux', 'eclairage', 'pompe', 'volets'];
// (où sont les leviers et les voyants, en fraction de la largeur du tableau)
const DEBUT_LEVIERS = 0.33;
const colonne = (k) => DEBUT_LEVIERS + (k + 0.5) / CIRCUITS.length * (0.98 - DEBUT_LEVIERS);
const Y_LEVIER = 0.6; // (en fraction de la hauteur, depuis le haut)
const Y_VOYANT = 0.36;

const ETEINT = new THREE.Color(0x2a1714);
const VERT = new THREE.Color(0x3dff7a);
const ROUGE = new THREE.Color(0xff3a22);
const ORANGE = new THREE.Color(0xffa21a);
const BLANC = new THREE.Color(0xffe2b0);

export class TableauElectrique {
  // groupe : celui de l'intérieur ; garder : prépare un matériau pour la lumière de la cabine
  constructor(groupe, { noir, inox, garder }) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'tableau-electrique';
    const boitier = new THREE.Mesh(new THREE.BoxGeometry(LARGEUR + 0.014, HAUTEUR + 0.014, 0.014), noir);
    boitier.name = 'tableau-electrique';
    // la face : dessinée sur une toile (la jauge et les chiffres changent : on la redessine)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = Math.round((1024 * HAUTEUR) / LARGEUR);
    this.cx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(LARGEUR, HAUTEUR), garder(new THREE.MeshStandardMaterial({
      map: this.texture, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: 0.25, roughness: 0.55,
    })));
    this.face.position.z = 0.0072;
    this.groupe.add(boitier, this.face);
    // les leviers (ils basculent vers le haut quand le circuit est fermé) et les voyants
    this.leviers = [];
    this.voyants = [];
    this.voyantsBatterie = {};
    const enLocal = (fx, fy, z = 0) => new THREE.Vector3((fx - 0.5) * LARGEUR, (0.5 - fy) * HAUTEUR, z);
    for (const k of CIRCUITS.keys()) {
      const levier = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.026, 0.01), inox);
      levier.geometry.translate(0, 0.01, 0.005);
      const pivot = new THREE.Group();
      pivot.position.copy(enLocal(colonne(k), Y_LEVIER, 0.008));
      pivot.add(levier);
      this.groupe.add(pivot);
      this.leviers.push(pivot);
      const voyant = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 14), new THREE.MeshBasicMaterial({ color: ETEINT }));
      voyant.position.copy(enLocal(colonne(k), Y_VOYANT, 0.0076));
      this.groupe.add(voyant);
      this.voyants.push(voyant);
    }
    for (const [nom, fx] of [['charge', 0.04], ['cale', 0.115], ['batterie', 0.19]]) {
      const v = new THREE.Mesh(new THREE.CircleGeometry(0.005, 14), new THREE.MeshBasicMaterial({ color: ETEINT }));
      v.position.copy(enLocal(fx + 0.025, 0.83, 0.0076));
      this.groupe.add(v);
      this.voyantsBatterie[nom] = v;
    }
    poserSurPupitre(this.groupe, 0.64, 0.38, 0.009);
    groupe.add(this.groupe);
    this.groupe.updateMatrix();
    this.position = this.groupe.position.clone();
    // (où l'on vise chaque disjoncteur, dans le repère du bateau)
    this.positionsDisjoncteurs = Object.fromEntries(NOMS_CIRCUITS.map((nom, k) => [nom, enLocal(colonne(k), Y_LEVIER - 0.04, 0.02).applyMatrix4(this.groupe.matrix)]));
    this.positionBatterie = enLocal(0.15, 0.4, 0.02).applyMatrix4(this.groupe.matrix);
    this.temps = 0;
    this.ageDessin = 1;
    this.dessiner({ charge: 0.8, tension: 12.6, courant: -14, alimente: true });
  }

  // La face : la batterie à gauche, les noms des circuits à droite
  dessiner({ charge, tension, courant, alimente }) {
    const cx = this.cx;
    const L = this.canvas.width;
    const H = this.canvas.height;
    cx.fillStyle = '#16191d';
    cx.fillRect(0, 0, L, H);
    cx.strokeStyle = '#3a4048';
    cx.lineWidth = 5;
    cx.strokeRect(4, 4, L - 8, H - 8);
    // (le filet entre la batterie et les circuits)
    cx.beginPath();
    cx.moveTo(L * DEBUT_LEVIERS - 10, 18);
    cx.lineTo(L * DEBUT_LEVIERS - 10, H - 18);
    cx.stroke();
    cx.fillStyle = '#c9cdd2';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.font = 'bold 19px system-ui, sans-serif';
    for (const [k, lignes] of CIRCUITS.entries()) {
      const x = colonne(k) * L;
      lignes.forEach((ligne, j) => cx.fillText(ligne, x, H * (lignes.length > 1 ? 0.12 + j * 0.11 : 0.17)));
      // (la saignée où bouge le levier)
      cx.fillStyle = '#05070a';
      cx.fillRect(x - 12, H * 0.48, 24, H * 0.3);
      cx.fillStyle = '#c9cdd2';
    }
    // la batterie
    cx.textAlign = 'left';
    cx.font = 'bold 26px system-ui, sans-serif';
    cx.fillText('BATTERIE', 28, H * 0.13);
    // (la jauge : dix segments)
    const x0 = 30;
    const y0 = H * 0.25;
    const w = L * 0.11;
    const hSeg = (H * 0.45) / 10;
    for (let k = 0; k < 10; k++) {
      const plein = alimente && charge > (k + 0.5) / 10;
      cx.fillStyle = !plein ? '#0b0f0d' : k < 2 ? '#ff4a2a' : k < 4 ? '#ffb02a' : '#4dff8a';
      cx.fillRect(x0, y0 + (9 - k) * hSeg + 3, w, hSeg - 6);
    }
    // (les chiffres : le pourcentage, la tension, les ampères)
    cx.fillStyle = '#0b1a12';
    cx.fillRect(x0 + w + 18, y0, L * 0.15, H * 0.45);
    if (alimente) {
      cx.fillStyle = '#5dffa0';
      cx.font = 'bold 44px ui-monospace, Menlo, monospace';
      cx.fillText(`${Math.round(charge * 100)} %`, x0 + w + 30, y0 + H * 0.1);
      cx.font = 'bold 30px ui-monospace, Menlo, monospace';
      cx.fillText(`${tension.toFixed(1).replace('.', ',')} V`, x0 + w + 30, y0 + H * 0.24);
      cx.fillStyle = courant >= 0 ? '#5dffa0' : '#ff7a5a';
      cx.fillText(`${courant >= 0 ? '+' : '−'}${Math.abs(Math.round(courant))} A`, x0 + w + 30, y0 + H * 0.37);
    }
    cx.fillStyle = '#c9cdd2';
    cx.font = 'bold 19px system-ui, sans-serif';
    cx.textAlign = 'center';
    for (const [nom, fx] of [['CHARGE', 0.04], ['CALE', 0.115], ['BATT.', 0.19]]) cx.fillText(nom, L * (fx + 0.025), H * 0.93);
    this.texture.needsUpdate = true;
  }

  // Réglé à chaque image, d'après les systèmes du bord (quart/systemes.js : systemes) ; nuit :
  // 0 → 1 (les noms s'éclairent) ; vacille : 0 → 1 (le courant qui hésite)
  regler(dt, { systemes, nuit = 0, vacille = 1 }) {
    this.temps += dt;
    const sy = systemes;
    const courant = sy.courant;
    const d = sy.disjoncteurs;
    const clignote = this.temps % 1 < 0.5;
    for (const [k, nom] of NOMS_CIRCUITS.entries()) {
      let couleur = ETEINT;
      if (courant && d[nom]) {
        couleur = VERT;
        if (nom === 'pilote' && sy.pilote.disjoncte) couleur = clignote ? ROUGE : ETEINT;
        else if (nom === 'pilote' && !sy.pilote.engage) couleur = ORANGE;
        else if (nom === 'eclairage') couleur = sy.eclairage === 'blanc' ? BLANC : sy.eclairage === 'rouge' ? ROUGE : ETEINT;
        else if (nom === 'pompe' && sy.pompe.marche) couleur = ORANGE;
      } else if (courant && nom === 'pilote' && sy.pilote.disjoncte) couleur = clignote ? ROUGE : ETEINT;
      this.voyants[k].material.color.copy(couleur).multiplyScalar(couleur === ETEINT ? 1 : vacille);
      // (fermé : levier en haut ; ouvert : en bas ; sauté : à mi-course)
      const saute = nom === 'pilote' && sy.pilote.disjoncte;
      this.leviers[k].rotation.x = saute ? 0.15 : d[nom] ? -0.55 : 0.55;
    }
    const v = this.voyantsBatterie;
    v.charge.material.color.copy(courant && sy.batterie.courant > 0 ? VERT : ETEINT);
    v.cale.material.color.copy(sy.alarmes.has('cale') && clignote ? ROUGE : ETEINT);
    v.batterie.material.color.copy(sy.alarmes.has('batterie') && clignote ? ORANGE : ETEINT);
    this.face.material.emissiveIntensity = courant ? (0.04 + 0.3 * nuit) * vacille : 0;
    // (la face : quatre fois par seconde)
    this.ageDessin += dt;
    if (this.ageDessin > 0.25) {
      this.ageDessin = 0;
      this.dessiner({ charge: sy.batterie.charge, tension: sy.batterie.tension, courant: sy.batterie.courant, alimente: courant });
    }
  }
}
