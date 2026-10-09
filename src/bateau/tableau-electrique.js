// Le tableau électrique : sur le pupitre de la console de la timonerie, à droite du
// traceur, tourné vers le siège de quart — on l'atteint assis comme debout.
//
// Six disjoncteurs à levier, chacun avec son nom et son voyant : les feux de navigation,
// le pilote automatique (son disjoncteur saute quand il lâche : levier tombé, voyant rouge
// qui clignote), l'éclairage (blanc ou rouge), le radar, la VHF, la pompe de cale ; et un
// voltmètre. Les noms sont rétroéclairés : la nuit, ils restent lisibles, sans éblouir.
import * as THREE from 'three';
import { poserSurPupitre } from './interieur-timonerie.js';

const LARGEUR = 0.2;
const HAUTEUR = 0.085;
const CIRCUITS = [['FEUX', 'NAV.'], ['PILOTE'], ['ÉCLAI-', 'RAGE'], ['RADAR'], ['VHF'], ['POMPE', 'CALE']];
// (où sont les leviers et les voyants, en fraction de la largeur du tableau)
const colonne = (k) => (k + 0.5) / CIRCUITS.length * 0.86 + 0.02;

function dessinerFace() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * HAUTEUR) / LARGEUR);
  const cx = canvas.getContext('2d');
  const L = canvas.width;
  const H = canvas.height;
  cx.fillStyle = '#16191d';
  cx.fillRect(0, 0, L, H);
  cx.strokeStyle = '#3a4048';
  cx.lineWidth = 3;
  cx.strokeRect(3, 3, L - 6, H - 6);
  cx.fillStyle = '#c9cdd2';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.font = 'bold 14px system-ui, sans-serif';
  for (const [k, lignes] of CIRCUITS.entries()) {
    const x = colonne(k) * L;
    lignes.forEach((ligne, j) => cx.fillText(ligne, x, H * (lignes.length > 1 ? 0.78 + j * 0.15 : 0.85)));
    // (la saignée où bouge le levier)
    cx.fillStyle = '#05070a';
    cx.fillRect(x - 7, H * 0.4, 14, H * 0.3);
    cx.fillStyle = '#c9cdd2';
  }
  // le voltmètre, à droite
  cx.fillStyle = '#0b1a12';
  cx.fillRect(L * 0.895, H * 0.14, L * 0.09, H * 0.3);
  cx.fillStyle = '#5dffa0';
  cx.font = 'bold 17px ui-monospace, monospace';
  cx.fillText('12,6', L * 0.94, H * 0.3);
  cx.fillStyle = '#c9cdd2';
  cx.font = 'bold 12px system-ui, sans-serif';
  cx.fillText('VOLTS', L * 0.94, H * 0.56);
  cx.fillText('12 V', L * 0.94, H * 0.84);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const ETEINT = new THREE.Color(0x2a1714);
const VERT = new THREE.Color(0x3dff7a);
const ROUGE = new THREE.Color(0xff3a22);
const BLANC = new THREE.Color(0xffe2b0);

export class TableauElectrique {
  // groupe : celui de l'intérieur ; garder : prépare un matériau pour la lumière de la cabine
  constructor(groupe, { noir, inox, garder }) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'tableau-electrique';
    const boitier = new THREE.Mesh(new THREE.BoxGeometry(LARGEUR + 0.012, HAUTEUR + 0.012, 0.012), noir);
    boitier.name = 'tableau-electrique';
    // la face : ses noms rétroéclairés (l'intensité suit la nuit)
    const texture = dessinerFace();
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(LARGEUR, HAUTEUR), garder(new THREE.MeshStandardMaterial({
      map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.25, roughness: 0.55,
    })));
    this.face.position.z = 0.0062;
    this.groupe.add(boitier, this.face);
    // les leviers (ils basculent vers le haut quand le circuit est fermé) et les voyants
    this.leviers = [];
    this.voyants = [];
    for (const k of CIRCUITS.keys()) {
      const x = (colonne(k) - 0.5) * LARGEUR;
      const levier = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.02, 0.008), inox);
      levier.geometry.translate(0, 0.008, 0.004);
      const pivot = new THREE.Group();
      pivot.position.set(x, (0.45 - 0.5) * HAUTEUR, 0.007);
      pivot.add(levier);
      this.groupe.add(pivot);
      this.leviers.push(pivot);
      const voyant = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 14), new THREE.MeshBasicMaterial({ color: ETEINT }));
      voyant.position.set(x, (0.8 - 0.5) * HAUTEUR, 0.0066);
      this.groupe.add(voyant);
      this.voyants.push(voyant);
    }
    poserSurPupitre(this.groupe, 0.66, 0.36, 0.008);
    groupe.add(this.groupe);
    this.position = this.groupe.position.clone();
    this.temps = 0;
  }

  // feux : allumés ; eclairage : 'eteint', 'rouge', 'blanc' ; pilotePanne : son
  // disjoncteur a sauté ; nuit : 0 → 1 (les noms s'éclairent) ; vacille : 0 → 1 (le
  // courant qui hésite)
  regler(dt, { feux, eclairage, pilotePanne, nuit = 0, vacille = 1 }) {
    this.temps += dt;
    const etats = [
      feux ? VERT : ETEINT,
      // (le disjoncteur sauté : le voyant rouge clignote, une fois par seconde)
      pilotePanne ? (this.temps % 1 < 0.5 ? ROUGE : ETEINT) : VERT,
      eclairage === 'blanc' ? BLANC : eclairage === 'rouge' ? ROUGE : ETEINT,
      VERT, VERT, VERT,
    ];
    const fermes = [feux, !pilotePanne, eclairage !== 'eteint', true, true, true];
    for (const [k, v] of this.voyants.entries()) {
      v.material.color.copy(etats[k]).multiplyScalar(etats[k] === ETEINT ? 1 : vacille);
      // (fermé : levier en haut ; ouvert : en bas ; sauté : à mi-course)
      this.leviers[k].rotation.x = fermes[k] ? -0.55 : k === 1 && pilotePanne ? 0.15 : 0.55;
    }
    this.face.material.emissiveIntensity = (0.04 + 0.3 * nuit) * vacille;
  }
}
