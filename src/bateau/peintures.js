// Les images de la cabine, peintes par le code dans des canvas au démarrage : l'écran de
// la radio VHF, la carte marine de la table à cartes, les cadrans du baromètre et de la
// pendule. (Comme textures.js, mais avec du texte et des dessins : le canvas 2D s'y prête.)
import * as THREE from 'three';

// L'écran de la radio VHF, dessiné dans un canvas (on peut y écrire le canal, un message)
export function ecranRadio() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const dessiner = (ligne1 = 'CH 16', ligne2 = '156.800', emission = false) => {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0c120f';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = emission ? '#ffd38a' : '#9fe0b8';
    ctx.font = '700 40px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(ligne1, 14, 44);
    ctx.font = '600 28px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(ligne2, 242, 82);
    texture.needsUpdate = true;
  };
  dessiner();
  return { texture, dessiner };
}

// La carte marine posée sur la table à cartes : la côte de Kervalen (imaginaire), les
// fonds (le bleu des petits fonds, les lignes de sonde), les sondes en mètres, une rose
// des vents, un phare, et la route tracée au crayon.
export function carteMarine() {
  const L = 1024;
  const H = 764;
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  let graine = 12345;
  const hasard = () => {
    graine = (graine * 16807) % 2147483647;
    return graine / 2147483647;
  };
  const mer = '#f5f3ec';
  ctx.fillStyle = mer;
  ctx.fillRect(0, 0, L, H);
  // la côte (en haut) avec la pointe du Bec, et l'île Brune
  const bord = 34;
  const cote = new Path2D();
  cote.moveTo(bord, bord);
  const points = [];
  for (let i = 0; i <= 60; i++) {
    const x = bord + ((L - 2 * bord) * i) / 60;
    let y = 150 + 40 * Math.sin(i * 0.21) + 18 * Math.sin(i * 0.77 + 1) + (hasard() - 0.5) * 14;
    y += 210 * Math.exp(-(((x - 700) / 55) ** 2)); // la pointe du Bec
    y -= 60 * Math.exp(-(((x - 300) / 90) ** 2)); // l'anse du port
    points.push([x, y]);
    cote.lineTo(x, y);
  }
  cote.lineTo(L - bord, bord);
  cote.closePath();
  const ile = new Path2D();
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const r = 48 + 14 * Math.sin(a * 3 + 1) + (hasard() - 0.5) * 8;
    const x = 360 + Math.cos(a) * r * 1.4;
    const y = 470 + Math.sin(a) * r;
    if (k === 0) ile.moveTo(x, y);
    else ile.lineTo(x, y);
  }
  ile.closePath();
  // les fonds : chaque ligne de sonde est un trait épais autour de la côte, repeint à l'intérieur
  ctx.lineJoin = 'round';
  for (const [r, dedans] of [[100, mer], [64, '#e4eff3'], [34, '#c9e0ec']]) {
    for (const forme of [cote, ile]) {
      ctx.lineWidth = 2 * r + 2.5;
      ctx.strokeStyle = '#8fb3c7';
      ctx.stroke(forme);
    }
    for (const forme of [cote, ile]) {
      ctx.lineWidth = 2 * r;
      ctx.strokeStyle = dedans;
      ctx.stroke(forme);
    }
  }
  // les terres
  ctx.fillStyle = '#efdc9c';
  ctx.strokeStyle = '#5c4a26';
  ctx.lineWidth = 2;
  for (const forme of [cote, ile]) {
    ctx.fill(forme);
    ctx.stroke(forme);
  }
  // le quadrillage (méridiens et parallèles) et le cadre gradué
  ctx.strokeStyle = 'rgba(60, 70, 80, 0.35)';
  ctx.lineWidth = 1;
  for (let x = bord + 128; x < L - bord; x += 128) {
    ctx.beginPath(); ctx.moveTo(x, bord); ctx.lineTo(x, H - bord); ctx.stroke();
  }
  for (let y = bord + 116; y < H - bord; y += 116) {
    ctx.beginPath(); ctx.moveTo(bord, y); ctx.lineTo(L - bord, y); ctx.stroke();
  }
  ctx.strokeStyle = '#1d1d1d';
  ctx.lineWidth = 2;
  ctx.strokeRect(bord, bord, L - 2 * bord, H - 2 * bord);
  ctx.strokeRect(bord - 12, bord - 12, L - 2 * bord + 24, H - 2 * bord + 24);
  for (let x = bord; x < L - bord; x += 16) {
    ctx.fillStyle = Math.round((x - bord) / 16) % 2 ? '#1d1d1d' : '#f5f3ec';
    ctx.fillRect(x, bord - 11, 16, 10);
    ctx.fillRect(x, H - bord + 1, 16, 10);
  }
  for (let y = bord; y < H - bord; y += 16) {
    ctx.fillStyle = Math.round((y - bord) / 16) % 2 ? '#1d1d1d' : '#f5f3ec';
    ctx.fillRect(bord - 11, y, 10, 16);
    ctx.fillRect(L - bord + 1, y, 10, 16);
  }
  // les sondes (profondeurs en mètres), en italique, plus profondes vers le large
  ctx.fillStyle = '#26323a';
  ctx.font = 'italic 15px Georgia, serif';
  ctx.textAlign = 'center';
  for (let k = 0; k < 140; k++) {
    const x = bord + 20 + hasard() * (L - 2 * bord - 40);
    const y = bord + 20 + hasard() * (H - 2 * bord - 40);
    if (ctx.isPointInPath(cote, x, y) || ctx.isPointInPath(ile, x, y)) continue;
    if (x > 640 && y > 470) continue; // la rose des vents
    if (x < 360 && y > 590) continue; // le cartouche
    const fond = Math.max(2, Math.round(4 + (y - 150) / 11 + hasard() * 6 - Math.exp(-(((x - 360) ** 2 + (y - 470) ** 2) / 9000)) * 18));
    ctx.fillText(String(fond), x, y);
  }
  // le phare de la pointe du Bec (une étoile magenta)
  const phare = [700, points[Math.round((700 - bord) / ((L - 2 * bord) / 60))][1] - 6];
  ctx.fillStyle = '#b0307a';
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 ? 4 : 11;
    ctx.lineTo(phare[0] + Math.cos(a) * r, phare[1] + Math.sin(a) * r);
  }
  ctx.fill();
  ctx.font = 'italic 14px Georgia, serif';
  ctx.fillText('Fl(3) 12s 24m 18M', phare[0] + 4, phare[1] + 30);
  // les noms
  ctx.fillStyle = '#3a2e18';
  ctx.font = '600 22px Georgia, serif';
  ctx.fillText('KERVALEN', 260, 90);
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillText('Pointe du Bec', 700, phare[1] - 26);
  ctx.fillText('Île Brune', 360, 476);
  ctx.fillText('Port-Kervalen', 300, 128);
  // la rose des vents
  const [cx, cy] = [835, 590];
  ctx.strokeStyle = '#b0307a';
  ctx.fillStyle = '#b0307a';
  ctx.lineWidth = 1.5;
  for (const r of [96, 80]) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  for (let deg = 0; deg < 360; deg += 5) {
    const a = (deg * Math.PI) / 180;
    const r0 = deg % 30 === 0 ? 70 : deg % 10 === 0 ? 74 : 77;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0);
    ctx.lineTo(cx + Math.sin(a) * 80, cy - Math.cos(a) * 80);
    ctx.stroke();
    if (deg % 30 === 0) {
      ctx.font = '12px Georgia, serif';
      ctx.fillText(String(deg), cx + Math.sin(a) * 88, cy - Math.cos(a) * 88 + 4);
    }
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy - 66); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx, cy + 66); ctx.lineTo(cx - 9, cy);
  ctx.closePath();
  ctx.fill();
  ctx.font = '600 16px Georgia, serif';
  ctx.fillText('N', cx, cy - 102);
  // le cartouche
  ctx.fillStyle = 'rgba(245, 243, 236, 0.92)';
  ctx.fillRect(bord + 16, H - bord - 128, 316, 112);
  ctx.strokeStyle = '#1d1d1d';
  ctx.lineWidth = 1;
  ctx.strokeRect(bord + 16, H - bord - 128, 316, 112);
  ctx.fillStyle = '#1d1d1d';
  ctx.textAlign = 'left';
  ctx.font = '600 21px Georgia, serif';
  ctx.fillText('ABORDS DE KERVALEN', bord + 30, H - bord - 96);
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillText('De la pointe du Bec à l\'île Brune', bord + 30, H - bord - 72);
  ctx.font = '13px Georgia, serif';
  ctx.fillText('Sondes en mètres — Échelle 1:50 000', bord + 30, H - bord - 48);
  ctx.fillText('Carte n° 7142', bord + 30, H - bord - 28);
  // la route tracée au crayon : des points relevés à l'heure, reliés par des tirets
  ctx.strokeStyle = 'rgba(70, 70, 75, 0.85)';
  ctx.fillStyle = 'rgba(70, 70, 75, 0.9)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([9, 6]);
  const route = [[300, 175], [380, 260], [520, 330], [640, 410], [700, 520], [610, 640]];
  ctx.beginPath();
  route.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'italic 14px "Bradley Hand", "Segoe Print", cursive';
  route.forEach(([x, y], i) => {
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
    if (i > 0) ctx.fillText(`${String(9 + i).padStart(2, '0')}h00`, x + 9, y - 6);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Un cadran rond (baromètre ou pendule), peint dans un canvas
function cadran(dessiner) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.translate(128, 128);
  dessiner(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
// Le baromètre : de 950 à 1050 hectopascals sur 280°, avec les mots d'autrefois
export const angleBarometre = (hPa) => THREE.MathUtils.degToRad(((THREE.MathUtils.clamp(hPa, 945, 1055) - 1000) / 50) * 140);
export function cadranBarometre() {
  return cadran((ctx) => {
    ctx.fillStyle = '#f1e8cf';
    ctx.beginPath(); ctx.arc(0, 0, 126, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a241c';
    ctx.fillStyle = '#2a241c';
    ctx.textAlign = 'center';
    for (let p = 950; p <= 1050; p += 2) {
      const a = angleBarometre(p);
      const long = p % 10 === 0 ? 16 : 8;
      ctx.lineWidth = p % 10 === 0 ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (112 - long), -Math.cos(a) * (112 - long));
      ctx.lineTo(Math.sin(a) * 112, -Math.cos(a) * 112);
      ctx.stroke();
      if (p % 20 === 0) {
        ctx.font = '600 15px Georgia, serif';
        ctx.fillText(String(p), Math.sin(a) * 80, -Math.cos(a) * 80 + 5);
      }
    }
    ctx.font = '600 13px Georgia, serif';
    for (const [p, mot] of [[962, 'TEMPÊTE'], [983, 'PLUIE'], [1004, 'VARIABLE'], [1025, 'BEAU'], [1043, 'TRÈS SEC']]) {
      ctx.save();
      ctx.rotate(angleBarometre(p));
      ctx.fillText(mot, 0, -54);
      ctx.restore();
    }
    ctx.font = 'italic 12px Georgia, serif';
    ctx.fillText('hPa', 0, 62);
  });
}
export function cadranPendule() {
  return cadran((ctx) => {
    ctx.fillStyle = '#f4f2ec';
    ctx.beginPath(); ctx.arc(0, 0, 126, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c1c1c';
    ctx.fillStyle = '#1c1c1c';
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2;
      const long = k % 5 === 0 ? 16 : 7;
      ctx.lineWidth = k % 5 === 0 ? 4 : 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (112 - long), -Math.cos(a) * (112 - long));
      ctx.lineTo(Math.sin(a) * 112, -Math.cos(a) * 112);
      ctx.stroke();
    }
    ctx.font = '600 26px Georgia, serif';
    ctx.textAlign = 'center';
    for (const [h, a] of [[12, 0], [3, 90], [6, 180], [9, 270]]) {
      const r = (a * Math.PI) / 180;
      ctx.fillText(String(h), Math.sin(r) * 76, -Math.cos(r) * 76 + 9);
    }
  });
}
