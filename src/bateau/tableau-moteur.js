// Le tableau du moteur : sur le pupitre de la console, à gauche du radar. Deux cadrans — le
// compte-tours et la température de l'eau du moteur (la zone rouge au-dessus de 100 °C) —,
// trois voyants (CHARGE : l'alternateur charge ; TEMP. : il chauffe trop ; HUILE : pas encore de
// pression, pendant qu'il démarre), et le gros bouton : on appuie pour démarrer (le démarreur
// lance le diesel), on appuie encore pour l'arrêter. Son anneau : vert quand il tourne, orange
// qui clignote pendant qu'il lance.
import * as THREE from 'three';
import { poserSurPupitre } from './interieur-timonerie.js';

const LARGEUR = 0.3;
const HAUTEUR = 0.135;
// les cadrans : où (en fraction de la largeur), et leur course (rad, de part et d'autre du haut)
const CADRANS = { tours: 0.17, temperature: 0.47 };
const Y_CADRANS = 0.53; // (leur centre, en fraction de la hauteur, depuis le haut)
const COURSE = 2.2; // (de -126° à +126°)
const BOUTON = 0.83;

const ETEINT = new THREE.Color(0x24130f);
const VERT = new THREE.Color(0x3dff7a);
const ROUGE = new THREE.Color(0xff3a22);
const ORANGE = new THREE.Color(0xffa21a);

function dessinerFace() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round((1024 * HAUTEUR) / LARGEUR);
  const cx = canvas.getContext('2d');
  const L = canvas.width;
  const H = canvas.height;
  cx.fillStyle = '#16191d';
  cx.fillRect(0, 0, L, H);
  cx.strokeStyle = '#3a4048';
  cx.lineWidth = 5;
  cx.strokeRect(4, 4, L - 8, H - 8);
  // un cadran : son fond, ses graduations, ses chiffres, sa zone rouge
  const cadran = (fx, titre, graduations, rouge) => {
    const x = fx * L;
    const y = H * Y_CADRANS;
    const r = H * 0.31;
    cx.fillStyle = '#e8e4d8';
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = '#1a1a1a';
    cx.lineWidth = 3;
    cx.stroke();
    // (les angles : 0 en haut, + vers la droite)
    const point = (a, rr) => [x + Math.sin(a) * rr, y - Math.cos(a) * rr];
    if (rouge) {
      cx.strokeStyle = '#c8281a';
      cx.lineWidth = r * 0.13;
      cx.beginPath();
      cx.arc(x, y, r * 0.86, -Math.PI / 2 + rouge * COURSE, -Math.PI / 2 + COURSE);
      cx.stroke();
    }
    cx.strokeStyle = '#1a1a1a';
    cx.fillStyle = '#1a1a1a';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.font = `bold ${Math.round(r * 0.22)}px system-ui, sans-serif`;
    graduations.forEach(([f, texte]) => {
      const a = -COURSE + 2 * COURSE * f;
      const [x0, y0] = point(a, r * 0.92);
      const [x1, y1] = point(a, r * 0.78);
      cx.lineWidth = 4;
      cx.beginPath();
      cx.moveTo(x0, y0);
      cx.lineTo(x1, y1);
      cx.stroke();
      if (texte) {
        const [xt, yt] = point(a, r * 0.6);
        cx.fillText(texte, xt, yt);
      }
    });
    cx.font = `bold ${Math.round(r * 0.17)}px system-ui, sans-serif`;
    cx.fillText(titre, x, y + r * 0.45);
  };
  cadran(CADRANS.tours, 'TR/MIN ×100', [[0, '0'], [1 / 6, '5'], [2 / 6, '10'], [3 / 6, '15'], [4 / 6, '20'], [5 / 6, '25'], [1, '30']], 0.83);
  cadran(CADRANS.temperature, '°C', [[0, '40'], [0.25, '60'], [0.5, '80'], [0.75, '100'], [1, '120']], 0.75);
  // les voyants (leurs noms), et le bouton
  cx.fillStyle = '#c9cdd2';
  cx.textAlign = 'center';
  cx.font = 'bold 22px system-ui, sans-serif';
  for (const [k, nom] of ['CHARGE', 'TEMP.', 'HUILE'].entries()) cx.fillText(nom, L * 0.7, H * (0.24 + k * 0.27) + 26);
  cx.font = 'bold 24px system-ui, sans-serif';
  cx.fillText('MOTEUR', L * BOUTON, H * 0.14);
  cx.font = 'bold 18px system-ui, sans-serif';
  cx.fillText('MARCHE / ARRÊT', L * BOUTON, H * 0.9);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class TableauMoteur {
  // groupe : celui de l'intérieur ; garder : prépare un matériau pour la lumière de la cabine
  constructor(groupe, { noir, inox, garder }) {
    this.groupe = new THREE.Group();
    this.groupe.name = 'tableau-moteur';
    const boitier = new THREE.Mesh(new THREE.BoxGeometry(LARGEUR + 0.014, HAUTEUR + 0.014, 0.014), noir);
    const texture = dessinerFace();
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(LARGEUR, HAUTEUR), garder(new THREE.MeshStandardMaterial({
      map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.2, roughness: 0.5,
    })));
    this.face.position.z = 0.0072;
    this.groupe.add(boitier, this.face);
    const enLocal = (fx, fy, z = 0) => new THREE.Vector3((fx - 0.5) * LARGEUR, (0.5 - fy) * HAUTEUR, z);
    // les aiguilles des cadrans
    const aiguille = (fx) => {
      const pivot = new THREE.Group();
      pivot.position.copy(enLocal(fx, Y_CADRANS, 0.009));
      const g = new THREE.BoxGeometry(0.0028, HAUTEUR * 0.26, 0.0015);
      g.translate(0, HAUTEUR * 0.1, 0);
      pivot.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xc8281a })));
      const moyeu = new THREE.Mesh(new THREE.CircleGeometry(0.004, 14), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
      moyeu.position.z = 0.001;
      pivot.add(moyeu);
      this.groupe.add(pivot);
      return pivot;
    };
    this.aiguilleTours = aiguille(CADRANS.tours);
    this.aiguilleTemperature = aiguille(CADRANS.temperature);
    // les voyants
    this.voyants = ['charge', 'temperature', 'huile'].map((nom, k) => {
      const v = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 14), new THREE.MeshBasicMaterial({ color: ETEINT }));
      v.position.copy(enLocal(0.645, 0.24 + k * 0.27, 0.0076));
      this.groupe.add(v);
      return v;
    });
    // le bouton, et son anneau lumineux
    const bouton = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.012, 24).rotateX(Math.PI / 2), garder(new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.6 })));
    bouton.position.copy(enLocal(BOUTON, 0.52, 0.012));
    this.anneau = new THREE.Mesh(new THREE.RingGeometry(0.019, 0.025, 28), new THREE.MeshBasicMaterial({ color: ETEINT }));
    this.anneau.position.copy(enLocal(BOUTON, 0.52, 0.0078));
    this.groupe.add(bouton, this.anneau);
    poserSurPupitre(this.groupe, -0.635, 0.45, 0.009);
    groupe.add(this.groupe);
    this.groupe.updateMatrix();
    this.positionBouton = enLocal(BOUTON, 0.52, 0.02).applyMatrix4(this.groupe.matrix);
    this.tours = 0;
    this.temps = 0;
  }

  // Réglé à chaque image, d'après les systèmes du bord (quart/systemes.js) ; nuit : 0 → 1 ;
  // vacille : 0 → 1
  regler(dt, { systemes, nuit = 0, vacille = 1 }) {
    this.temps += dt;
    const sy = systemes;
    const m = sy.moteur;
    const courant = sy.courant;
    // le compte-tours : il monte quand le démarreur lance, puis se tient au régime de charge
    // (1 800 tr/min) ; arrêté, il retombe
    const vise = m.etat === 'marche' ? 1800 + 40 * Math.sin(this.temps * 2.3) : m.etat === 'lancement' ? 280 + 60 * Math.sin(this.temps * 30) : 0;
    this.tours += (vise - this.tours) * Math.min(1, dt * (vise > this.tours ? 3 : 1.5));
    const f = (x) => -COURSE + 2 * COURSE * Math.min(1, Math.max(0, x));
    this.aiguilleTours.rotation.z = -f(this.tours / 3000);
    // (la température : 40 °C à 120 °C ; la sonde n'a d'aiguille qu'avec du courant)
    const celsius = 20 + 90 * m.temperature;
    this.aiguilleTemperature.rotation.z = -f(courant ? (celsius - 40) / 80 : 0);
    const clignote = this.temps % 0.6 < 0.3;
    const [charge, temperature, huile] = this.voyants;
    const marche = m.etat === 'marche';
    charge.material.color.copy(courant && marche ? VERT : ETEINT).multiplyScalar(vacille);
    temperature.material.color.copy(courant && m.temperature > 0.88 && clignote ? ROUGE : ETEINT).multiplyScalar(vacille);
    huile.material.color.copy(courant && m.etat === 'lancement' ? ROUGE : ETEINT).multiplyScalar(vacille);
    this.anneau.material.color.copy(!courant ? ETEINT : marche ? VERT : m.etat === 'lancement' ? (clignote ? ORANGE : ETEINT) : ETEINT).multiplyScalar(vacille);
    this.face.material.emissiveIntensity = courant ? (0.03 + 0.25 * nuit) * vacille : 0;
  }
}
