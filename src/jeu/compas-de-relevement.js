// Le compas de relèvement porté à l'œil (touche B) : ce qu'on voit en visant.
//
// Un petit compas à prisme, comme ceux que les marins portent au cou : on le tient devant
// l'œil, on vise l'amer au-dessus de lui, et le prisme montre en dessous un morceau de la rose,
// avec un trait (la ligne de foi) : le chiffre sous le trait est le relèvement. La rose flotte
// dans un liquide : elle traîne quand on tourne, oscille dans la houle (monde/navigation.js :
// RoseCompas) — il faut tenir le compas immobile un instant, et lire quand elle s'est posée.
// La nuit, ses graduations sont lumineuses (vertes), pour ne pas avoir à l'éclairer.
//
// L'écran : la rose dans la fenêtre du prisme (sous le centre de la vue, on vise au-dessus),
// le trait qui monte jusqu'à ce qu'on vise, le nom de l'amer reconnu, les touches.
const CHAMP = 22; // degrés de rose visibles de part et d'autre du trait
const NOMS = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' };

const arrondi = (g, x, y, l, h, r) => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + l, y, x + l, y + h, r);
  g.arcTo(x + l, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + l, y, r);
  g.closePath();
};

export class CompasDeRelevement {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.largeur = 0;
    this.hauteur = 0;
  }

  // lecture : ce que montre la rose sous le trait (degrés) ; nuit : 0 → 1 ; cible : { nom,
  // connu } ou null ; note : { texte, age } (le dernier relèvement noté) ; aide : les touches ;
  // deviation : true dans la timonerie (l'électronique dévie le compas)
  dessiner({ lecture, nuit = 0, cible = null, note = null, aide = true, deviation = false }) {
    const c = this.canvas;
    const ratio = Math.min(2, devicePixelRatio || 1);
    const L = c.clientWidth;
    const H = c.clientHeight;
    if (!L || !H) return;
    if (L !== this.largeur || H !== this.hauteur) {
      this.largeur = L;
      this.hauteur = H;
      c.width = Math.round(L * ratio);
      c.height = Math.round(H * ratio);
    }
    const g = this.g;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, L, H);
    const cx = L / 2;
    const cy = H / 2;

    // le compas devant l'œil : son corps sombre en bas de la vue, les bords qui s'assombrissent
    const v = g.createRadialGradient(cx, cy, Math.min(L, H) * 0.3, cx, cy, Math.max(L, H) * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, L, H);
    const lf = Math.min(440, L * 0.56); // la largeur de la fenêtre du prisme
    const hf = 74;
    const yf = cy + Math.min(120, H * 0.14); // le haut de la fenêtre
    const corps = Math.min(620, L * 0.8);
    g.fillStyle = '#121518';
    arrondi(g, cx - corps / 2, yf - 26, corps, H - yf + 60, 46);
    g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    g.lineWidth = 2;
    g.stroke();

    // la fenêtre du prisme : un morceau de la rose, vu par la tranche (elle est ronde : les
    // graduations se resserrent vers les bords)
    const x0 = cx - lf / 2;
    g.save();
    arrondi(g, x0, yf, lf, hf, 10);
    g.clip();
    const fond = g.createLinearGradient(0, yf, 0, yf + hf);
    if (nuit > 0.5) {
      fond.addColorStop(0, '#04100b');
      fond.addColorStop(1, '#0b1d15');
    } else {
      fond.addColorStop(0, '#d9ddd2');
      fond.addColorStop(1, '#f2f3ec');
    }
    g.fillStyle = fond;
    g.fillRect(x0, yf, lf, hf);
    const encre = nuit > 0.5 ? 'rgba(140, 250, 185, 0.95)' : 'rgba(22, 26, 24, 0.92)';
    if (nuit > 0.5) {
      g.shadowColor = 'rgba(90, 255, 160, 0.65)';
      g.shadowBlur = 6;
    }
    g.strokeStyle = encre;
    g.fillStyle = encre;
    g.textAlign = 'center';
    const R = lf * 0.52; // le rayon apparent de la rose
    const k = 1.25 / CHAMP; // radians de « tranche » par degré
    const debut = Math.floor(lecture - CHAMP - 1);
    for (let d = debut; d <= lecture + CHAMP + 1; d++) {
      const a = (d - lecture) * k;
      if (Math.abs(a) > 1.45) continue;
      const x = cx + Math.sin(a) * R;
      const fondu = Math.cos(a);
      const deg = ((d % 360) + 360) % 360;
      const dix = deg % 10 === 0;
      const cinq = deg % 5 === 0;
      const longueur = dix ? 22 : cinq ? 15 : 9;
      g.globalAlpha = 0.25 + 0.75 * fondu;
      g.lineWidth = dix ? 2 : 1.2;
      g.beginPath();
      g.moveTo(x, yf + hf);
      g.lineTo(x, yf + hf - longueur);
      g.stroke();
      if (dix) {
        g.font = `${deg % 90 === 0 ? 700 : 600} ${Math.round(17 * (0.75 + 0.25 * fondu))}px ui-monospace, Menlo, monospace`;
        // (les points cardinaux en lettres ; les autres, le nombre de degrés)
        g.fillText(NOMS[deg] ?? String(deg), x, yf + hf - longueur - 9);
      }
    }
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    // la ligne de foi : le trait rouge au milieu
    g.strokeStyle = nuit > 0.5 ? 'rgba(255, 110, 90, 0.95)' : '#d8281c';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx, yf);
    g.lineTo(cx, yf + hf);
    g.stroke();
    // (un reflet sur le verre du prisme)
    const reflet = g.createLinearGradient(0, yf, 0, yf + hf * 0.45);
    reflet.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    reflet.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = reflet;
    g.fillRect(x0, yf, lf, hf * 0.45);
    g.restore();
    g.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    g.lineWidth = 3;
    arrondi(g, x0, yf, lf, hf, 10);
    g.stroke();

    // le trait de visée, qui monte du prisme jusqu'à ce qu'on vise (le centre de la vue)
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    g.lineWidth = 1;
    g.setLineDash([4, 5]);
    g.beginPath();
    g.moveTo(cx, yf - 4);
    g.lineTo(cx, cy + 14);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx - 10, cy);
    g.lineTo(cx - 4, cy);
    g.moveTo(cx + 4, cy);
    g.lineTo(cx + 10, cy);
    g.moveTo(cx, cy + 4);
    g.lineTo(cx, cy + 12);
    g.stroke();

    // la lecture, en grand, sous la fenêtre (le chiffre sous le trait, arrondi au degré)
    const lu = ((Math.round(lecture) % 360) + 360) % 360;
    g.font = '700 22px ui-monospace, Menlo, monospace';
    g.fillStyle = 'rgba(240, 236, 220, 0.92)';
    g.fillText(`${String(lu).padStart(3, '0')}°`, cx, yf + hf + 28);

    // ce qu'on vise : son nom (ou ce qu'on en sait)
    g.font = '600 14px system-ui, sans-serif';
    if (cible) {
      g.fillStyle = cible.connu ? 'rgba(255, 214, 140, 0.95)' : 'rgba(230, 230, 230, 0.8)';
      g.fillText(cible.nom, cx, yf - 12);
    }
    // les touches, et ce qu'on vient de noter
    g.font = '500 13px system-ui, sans-serif';
    g.fillStyle = 'rgba(230, 236, 240, 0.78)';
    if (aide) g.fillText('E : noter le relèvement  ·  B : baisser le compas', cx, yf + hf + 52);
    if (deviation) {
      g.fillStyle = 'rgba(255, 190, 120, 0.9)';
      g.fillText('Ici, l\'électronique dévie le compas : relève dehors', cx, yf + hf + 72);
    }
    if (note && note.age < 3) {
      g.globalAlpha = Math.min(1, (3 - note.age) * 2);
      g.font = '600 15px system-ui, sans-serif';
      g.fillStyle = 'rgba(255, 228, 170, 0.98)';
      g.fillText(note.texte, cx, yf - 36);
      g.globalAlpha = 1;
    }
  }

  effacer() {
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
