// Petits outils de rendu partagés : un triangle qui couvre tout l'écran (pour les
// passes qui calculent une image pixel par pixel) et quelques fonctions GLSL.
import * as THREE from 'three';

// Un seul grand triangle qui déborde de l'écran : plus simple et un peu plus rapide
// qu'un rectangle de deux triangles.
const geometriePleinEcran = new THREE.BufferGeometry();
geometriePleinEcran.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
geometriePleinEcran.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
export const cameraPleinEcran = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export class PassePleinEcran {
  constructor(materiau) {
    this.mesh = new THREE.Mesh(geometriePleinEcran, materiau);
    this.mesh.frustumCulled = false;
  }
  get materiau() { return this.mesh.material; }
  set materiau(m) { this.mesh.material = m; }
  // couche : pour une cible 3D, la tranche à dessiner (ou la face, pour un cube)
  rendre(renderer, cible = null, couche = 0) {
    renderer.setRenderTarget(cible, couche);
    renderer.render(this.mesh, cameraPleinEcran);
  }
}

// Le sommet commun des passes plein écran : il transmet les coordonnées de l'écran (vUv)
export const SOMMET_PLEIN_ECRAN = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const GLSL_OUTILS = /* glsl */ `
float remap(float x, float a, float b, float c, float d) {
  return c + (x - a) / (b - a) * (d - c);
}
float saturer(float x) { return clamp(x, 0.0, 1.0); }

// Bruit « dégradé entrelacé » (Jorge Jimenez) : un motif de bruit très régulier qui
// casse les escaliers des calculs par petits pas sans faire de taches.
float bruitEntrelace(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}

// Fonction de phase de Henyey-Greenstein : quelle part de lumière repart dans la
// direction du regard (g > 0 : surtout vers l'avant, comme dans un nuage)
float phaseHG(float cosTheta, float g) {
  float gg = g * g;
  return (1.0 - gg) / (4.0 * 3.14159265 * pow(1.0 + gg - 2.0 * g * cosTheta, 1.5));
}
`;
