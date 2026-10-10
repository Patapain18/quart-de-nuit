// Le compteur de fluidité : un petit graphique, en haut à gauche, du temps entre deux
// images pendant les 4 dernières secondes. On l'ouvre en ajoutant ?perf à l'adresse du jeu
// (jeu.html?perf).
//
// Une barre par image : verte quand tout va bien, orange quand une image a pris deux fois
// plus de temps que d'habitude, rouge au-delà de 1/30 de seconde (là, l'œil voit l'à-coup).
// Dessous : les images par seconde, le nombre d'à-coups depuis le début, et pour le
// dernier à-coup, la partie du calcul qui a pris le plus de temps (la mer, la physique,
// le dessin…) : de quoi me dire ce qui coince. Et la qualité de l'image en ce moment
// (etat : ce que le jeu en dit — en Auto, le cran choisi par le régulateur).
const NOMS = {
  houle: 'la mer (vagues)', simulation: 'la physique et le jeu', bateau: 'le bateau',
  lumiere: 'la lumière', eau: 'l\'eau', ciel: 'le ciel', rendu: 'le dessin', 'regler (mer)': 'le changement de mer',
};

export function afficherFluidite(monde, { etat = null } = {}) {
  const largeur = 300;
  const hauteur = etat ? 124 : 96;
  const canvas = document.createElement('canvas');
  canvas.width = largeur * 2;
  canvas.height = hauteur * 2;
  Object.assign(canvas.style, {
    position: 'fixed', left: '8px', top: '8px', width: `${largeur}px`, height: `${hauteur}px`,
    zIndex: 50, pointerEvents: 'none', borderRadius: '6px', background: 'rgba(8, 12, 14, 0.72)',
  });
  document.body.append(canvas);
  const g = canvas.getContext('2d');
  g.scale(2, 2);
  const chrono = monde.chrono;
  chrono.actif = true;
  chrono.gpu = false;
  const intervalles = [];
  let dernier = null;
  let acoups = 0;
  let cause = '';
  const boucle = (t) => {
    if (dernier !== null) {
      const dt = t - dernier;
      intervalles.push(dt);
      while (intervalles.length > 480) intervalles.shift();
      const tri = [...intervalles].sort((a, b) => a - b);
      const mediane = tri[Math.floor(tri.length / 2)] ?? 16;
      if (dt > Math.max(25, mediane * 2) && intervalles.length > 30) {
        acoups++;
        // la partie du calcul la plus longue, dans l'image d'avant
        const im = chrono.images.at(-1);
        if (im) {
          const [nom, ms] = Object.entries(im).filter(([k]) => k !== 'temps' && k !== 'total').sort((a, b) => b[1] - a[1])[0] ?? [];
          cause = nom ? `${Math.round(dt)} ms : ${NOMS[nom] ?? nom} (${ms.toFixed(1)} ms)` : `${Math.round(dt)} ms`;
          if (im.total < dt * 0.5) cause = `${Math.round(dt)} ms : hors du jeu (le navigateur, la carte graphique)`;
        }
      }
      if (chrono.images.length > 600) chrono.images.splice(0, chrono.images.length - 300);
      dessiner(mediane);
    }
    dernier = t;
    requestAnimationFrame(boucle);
  };
  const dessiner = (mediane) => {
    g.clearRect(0, 0, largeur, hauteur);
    const haut = 56;
    const echelle = haut / 50; // 50 ms en haut du graphique
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    for (const ms of [1000 / 60, 1000 / 30]) {
      const y = 6 + haut - ms * echelle;
      g.moveTo(6, y);
      g.lineTo(largeur - 6, y);
    }
    g.stroke();
    const n = intervalles.length;
    const pas = (largeur - 12) / 480;
    for (let i = 0; i < n; i++) {
      const v = intervalles[i];
      g.fillStyle = v > 1000 / 30 ? '#e8443a' : v > mediane * 2 ? '#f0a030' : '#4fb06a';
      const h = Math.min(haut, v * echelle);
      g.fillRect(6 + (480 - n + i) * pas, 6 + haut - h, Math.max(1, pas), h);
    }
    g.fillStyle = '#d6e2e4';
    g.font = '11px system-ui, sans-serif';
    g.fillText(`${Math.round(1000 / mediane)} images/s · à-coups : ${acoups}`, 6, haut + 22);
    g.fillStyle = '#9fb0b3';
    g.fillText(cause ? `dernier : ${cause}` : 'aucun à-coup', 6, haut + 36);
    if (etat) {
      // (deux lignes au plus : on coupe la phrase entre deux mots)
      const mots = etat().replace(/^En ce moment : /, '').split(' ');
      const lignes = [''];
      for (const m of mots) {
        const essai = lignes.at(-1) ? `${lignes.at(-1)} ${m}` : m;
        if (g.measureText(essai).width > largeur - 12 && lignes.at(-1)) lignes.push(m);
        else lignes[lignes.length - 1] = essai;
      }
      g.fillStyle = '#c8b27a';
      lignes.slice(0, 2).forEach((l, i) => g.fillText(l, 6, haut + 50 + i * 14));
    }
  };
  requestAnimationFrame(boucle);
}
