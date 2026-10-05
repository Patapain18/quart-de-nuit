// Une lumière sur l'eau, la nuit, au loin : un feu blanc, en tête d'un mât, qui
// apparaît et disparaît dans le creux des vagues, une dizaine de secondes, puis plus rien.
// Pas de bateau sur le radar de Jos, pas de réponse à la radio. (jeu/nuit.js : l'étrange)
//
// Elle est cachée quand une vague, entre elle et nous, monte plus haut que la ligne qui
// va de nos yeux à elle : on mesure la mer à mi-chemin.
import * as THREE from 'three';

function texturePoint() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255,255,255,1)');
  d.addColorStop(0.15, 'rgba(255,244,220,0.9)');
  d.addColorStop(0.45, 'rgba(255,230,190,0.18)');
  d.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class LumiereEtrange {
  constructor(scene, houle) {
    this.houle = houle;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturePoint(), color: 0xfff1d8, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    }));
    this.sprite.renderOrder = 6;
    this.sprite.visible = false;
    scene.add(this.sprite);
    this.age = Infinity;
    this.duree = 11;
    this.x = 0;
    this.z = 0;
  }

  // la faire apparaître en (x, z), pour duree secondes
  montrer(x, z, duree = 11) {
    this.x = x;
    this.z = z;
    this.duree = duree;
    this.age = 0;
  }

  maj(dt, camera) {
    this.age += dt;
    const s = this.sprite;
    if (this.age > this.duree) {
      s.visible = false;
      return;
    }
    // elle s'allume doucement, tient, puis s'éteint ; elle vacille un peu (le bateau roule)
    const enveloppe = THREE.MathUtils.smoothstep(this.age, 0, 1.5) * (1 - THREE.MathUtils.smoothstep(this.age, this.duree - 2.5, this.duree));
    const vacille = 0.75 + 0.25 * Math.sin(this.age * 7.3) * Math.sin(this.age * 2.1 + 1);
    const yLumiere = this.houle.hauteur(this.x, this.z) + 7; // (en tête de mât)
    // une vague entre nous ?
    const mx = (this.x + camera.position.x) / 2;
    const mz = (this.z + camera.position.z) / 2;
    const ligne = (yLumiere + camera.position.y) / 2;
    const cachee = THREE.MathUtils.smoothstep(this.houle.hauteur(mx, mz) + 0.6 - ligne, -0.4, 0.4);
    s.position.set(this.x, yLumiere, this.z);
    // (toujours un point de quelques pixels, quelle que soit la distance)
    const d = camera.position.distanceTo(s.position);
    s.scale.setScalar(d * 0.011);
    s.material.opacity = enveloppe * vacille * (1 - cachee);
    s.visible = s.material.opacity > 0.01;
  }
}
