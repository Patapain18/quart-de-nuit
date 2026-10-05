// L'eau embarquée, qu'on voit : dans le cockpit (une vague l'a rempli ; elle s'écoule par
// les nables) et dans la cabine (quand elle passe au-dessus des planchers).
//
// Sa surface reste à plat quand le bateau penche : c'est un plan du MONDE, pas du bateau.
// Elle court donc vers le côté qui penche. Et elle clapote : quand le bateau est secoué,
// l'eau ne suit pas tout de suite — elle se met perpendiculaire à la pesanteur que l'on
// ressent à bord (la vraie, plus les secousses), avec un temps de retard, et balance
// d'un bord à l'autre (un ressort amorti, d'une période de ~1,5 s).
//
// On dessine un grand rectangle horizontal, et la carte graphique efface tout ce qui
// dépasse : du puits du cockpit, ou de l'intérieur de la coque (le carré).
import * as THREE from 'three';
import { COCKPIT, COQUE, ROUF, zDe } from './forme.js';
import { CARRE } from '../joueur/pont.js';
import { GLSL_CABINE_DECLARATIONS, GLSL_CABINE } from './interieur.js';

const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

// La forme de la coque, dans son propre repère (les mêmes fonctions que forme.js)
const GLSL_FORME = /* glsl */ `
float coqueLivet(float u) { return ${f(COQUE.livetArriere)} + ${f(COQUE.livetAvant - COQUE.livetArriere)} * pow(u, 1.8); }
float coqueDemiLargeur(float u) {
  if (u <= ${f(COQUE.uLargeurMax)}) {
    float t = sin(1.5707963 * (u / ${f(COQUE.uLargeurMax)}));
    return ${f(COQUE.demiLargeurTableau)} + ${f(COQUE.demiLargeurMax - COQUE.demiLargeurTableau)} * pow(t, 1.2);
  }
  float t = (u - ${f(COQUE.uLargeurMax)}) / ${f(1 - COQUE.uLargeurMax)};
  return ${f(COQUE.demiLargeurMax)} * pow(max(0.0, cos(1.5707963 * t)), 0.9);
}
float coqueFond(float u) {
  if (u <= ${f(COQUE.uPiedEtrave)}) return -${f(COQUE.creuxMax)} * sin(3.14159265 * (u + 0.1014) / ${f(COQUE.uPiedEtrave + 0.1014)});
  float t = (u - ${f(COQUE.uPiedEtrave)}) / ${f(1 - COQUE.uPiedEtrave)};
  return coqueLivet(1.0) * pow(t, 0.75);
}
// la demi-largeur intérieure de la coque (le vaigrage), à la hauteur y de la tranche u
float largeurInterieure(float u, float y) {
  float bas = coqueFond(u);
  float s = clamp((y - bas) / (coqueLivet(u) - bas), 0.0, 1.0);
  float n = ${f(COQUE.bouchain[0])} + ${f(COQUE.bouchain[1] - COQUE.bouchain[0])} * u;
  return coqueDemiLargeur(u) * pow(1.0 - pow(1.0 - s, n), 1.0 / n) - 0.08;
}
`;

const GLSL_BRUIT = /* glsl */ `
float hasardE(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float bruitE(vec3 p) {
  vec3 i = floor(p);
  vec3 g = fract(p);
  g = g * g * (3.0 - 2.0 * g);
  float a = mix(mix(hasardE(i), hasardE(i + vec3(1, 0, 0)), g.x), mix(hasardE(i + vec3(0, 1, 0)), hasardE(i + vec3(1, 1, 0)), g.x), g.y);
  float b = mix(mix(hasardE(i + vec3(0, 0, 1)), hasardE(i + vec3(1, 0, 1)), g.x), mix(hasardE(i + vec3(0, 1, 1)), hasardE(i + vec3(1, 1, 1)), g.x), g.y);
  return mix(a, b, g.z);
}
`;

// dedans : la cabine (éclairée par ses propres lampes) ; sinon le cockpit (dehors)
function materiauEau(uniforms, { dedans }) {
  const m = new THREE.MeshStandardMaterial({
    color: dedans ? 0x1e1e12 : 0x0b1a1c, roughness: dedans ? 0.14 : 0.06, metalness: 0, transparent: true,
  });
  if (dedans) m.envMapIntensity = 0.02;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uNiveau;
uniform vec2 uPente;
uniform vec2 uCentre;
uniform mat4 uMondeVersBateau;
varying vec3 vPosMonde;
${dedans ? 'varying vec3 vPosBateau;' : ''}`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
transformedNormal = normalize((viewMatrix * vec4(normalize(vec3(-uPente.x, 1.0, -uPente.y)), 0.0)).xyz);`)
      .replace('#include <project_vertex>', `
vec4 monde = modelMatrix * vec4(transformed, 1.0);
// (un plan du monde : à plat, sauf quand l'eau balance)
monde.y = uNiveau + dot(uPente, monde.xz - uCentre);
vec4 mvPosition = viewMatrix * monde;
gl_Position = projectionMatrix * mvPosition;
vPosMonde = monde.xyz;
${dedans ? 'vPosBateau = (uMondeVersBateau * monde).xyz;' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform mat4 uMondeVersBateau;
uniform float uTemps;
uniform float uMousse;
varying vec3 vPosMonde;
${dedans ? GLSL_CABINE_DECLARATIONS : ''}
${GLSL_FORME}
${GLSL_BRUIT}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float profondeurEau = 0.0;
{
  // on ne garde que l'eau dans le ${dedans ? 'carré' : 'puits du cockpit'}
  vec3 p = (uMondeVersBateau * vec4(vPosMonde, 1.0)).xyz;
  profondeurEau = p.y - ${f(dedans ? CARRE.plancher : COCKPIT.plancher)};
${dedans ? `  if (p.z < ${f(CARRE.zAvant - 0.015)} || p.z > ${f(zDe(ROUF.uArriere) - 0.015)}) discard;
  if (p.y < ${f(CARRE.plancher - 0.01)}) discard;
  float u = (p.z - ${f(COQUE.zArriere)}) / ${f(COQUE.zAvant - COQUE.zArriere)};
  if (abs(p.x) > largeurInterieure(u, p.y)) discard;`
    : `  if (p.z < ${f(zDe(COCKPIT.uAvant) + 0.02)} || p.z > ${f(zDe(COCKPIT.uArriere) - 0.02)}) discard;
  if (p.y < ${f(COCKPIT.plancher - 0.01)}) discard;
  float demi = p.y < ${f(COCKPIT.banc)} ? ${f(COCKPIT.demiLargeurPuits - 0.01)} : ${f(COCKPIT.demiLargeur - 0.02)};
  if (abs(p.x) > demi) discard;`}
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// des rides qui courent sur l'eau (relief calculé à l'écran)
{
  vec3 q = vec3(vPosMonde.xz * 6.0, uTemps * 1.7);
  float h = (bruitE(q) * 0.6 + bruitE(q * 2.3 + 4.0) * 0.4) * 0.012;
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 dpdx = dFdx(-vViewPosition);
  vec3 dpdy = dFdy(-vViewPosition);
  vec3 r1 = cross(dpdy, normal);
  vec3 r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
// l'eau est d'autant plus opaque qu'elle est profonde (2 cm : on voit le fond ; 30 cm :
// presque plus)
diffuseColor.a = 1.0 - exp(-max(profondeurEau, 0.0) * ${dedans ? '7.0' : '9.0'});
// des bulles et de l'écume quand l'eau vient d'arriver ou qu'elle est secouée
{
  float b = bruitE(vec3(vPosMonde.xz * 9.0, uTemps * 2.0));
  float mousse = smoothstep(0.62, 0.8, b) * uMousse;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.8, 0.78), mousse);
  diffuseColor.a = mix(diffuseColor.a, 0.95, mousse);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.8, smoothstep(0.62, 0.8, bruitE(vec3(vPosMonde.xz * 9.0, uTemps * 2.0))) * uMousse);');
    if (dedans) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lights_fragment_end>', `${GLSL_CABINE}\n#include <lights_fragment_end>`)
        // le reflet de la cabine éclairée (les boiseries) : d'autant plus qu'on la regarde
        // en rasant la surface (Fresnel)
        .replace('#include <opaque_fragment>', `{
  float nv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  outgoingLight += vec3(0.62, 0.38, 0.2) * uAmbianceCabine * 5.0 * fresnel;
  diffuseColor.a = max(diffuseColor.a, fresnel);
}
#include <opaque_fragment>`);
    }
  };
  m.customProgramCacheKey = () => (dedans ? 'eau-cabine' : 'eau-cockpit');
  return m;
}

// Une surface d'eau (et son clapot)
class Surface {
  constructor(bateau, { dedans, largeur, z0, z1, y }) {
    this.uniforms = {
      uNiveau: { value: -100 },
      uPente: { value: new THREE.Vector2() },
      uCentre: { value: new THREE.Vector2() },
      uTemps: { value: 0 },
      uMousse: { value: 0 },
      uMondeVersBateau: bateau.interieur.uniforms.uMondeVersBateau,
    };
    // (dans la cabine, la lumière de la cabine)
    if (dedans) {
      for (const cle of ['uBateauVersMonde', 'uSourcePos', 'uSourceDir', 'uSourceCouleur', 'uSourceForme', 'uAmbianceCabine', 'uTableCabine']) {
        this.uniforms[cle] = bateau.interieur.uniforms[cle];
      }
    }
    const g = new THREE.PlaneGeometry(largeur * 2, Math.abs(z1 - z0), 2, 4);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, (z0 + z1) / 2);
    this.materiau = materiauEau(this.uniforms, { dedans });
    if (dedans) bateau.interieur.materiaux.push(this.materiau);
    this.mesh = new THREE.Mesh(g, this.materiau);
    this.mesh.name = dedans ? 'eau-cabine' : 'eau-cockpit';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    bateau.groupe.add(this.mesh);
    this.centre = new THREE.Vector3(0, y, (z0 + z1) / 2);
    this.y0 = y;
    // le clapot : la direction de la surface (repère du bateau), et sa vitesse
    this.normale = new THREE.Vector3(0, 1, 0);
    this.vitesse = new THREE.Vector3();
    this._m = new THREE.Matrix4();
  }

  // hauteur : l'eau au-dessus du fond (m) ; pesanteur : la pesanteur ressentie à bord
  // (repère du bateau) ; mousse : 0 → 1
  maj(dt, groupe, hauteur, pesanteur, mousse, temps) {
    this.mesh.visible = hauteur > 0.004;
    if (!this.mesh.visible) return;
    // l'eau veut se mettre perpendiculaire à la pesanteur ressentie ; elle y va comme un
    // ressort amorti (elle dépasse, revient, balance)
    const cible = pesanteur.clone().negate().normalize();
    const k = (2 * Math.PI / 1.5) ** 2;
    this.vitesse.addScaledVector(cible.sub(this.normale), k * dt).multiplyScalar(Math.exp(-dt * 1.4));
    this.normale.addScaledVector(this.vitesse, dt).normalize();
    // (de son centre, en hauteur du monde ; et sa pente dans le monde)
    const c = this.centre.clone();
    c.y = this.y0 + hauteur;
    c.applyMatrix4(this._m.compose(groupe.position, groupe.quaternion, groupe.scale));
    const n = this.normale.clone().applyQuaternion(groupe.quaternion);
    // (on garde la pente raisonnable : l'eau ne se met pas debout)
    const ny = Math.max(0.75, n.y);
    const u = this.uniforms;
    u.uNiveau.value = c.y;
    u.uCentre.value.set(c.x, c.z);
    u.uPente.value.set(-n.x / ny, -n.z / ny);
    u.uTemps.value = temps;
    u.uMousse.value = mousse;
  }
}

export class EauABord {
  constructor(bateau) {
    this.cockpit = new Surface(bateau, {
      dedans: false, largeur: COCKPIT.demiLargeur, z0: zDe(COCKPIT.uAvant), z1: zDe(COCKPIT.uArriere), y: COCKPIT.plancher,
    });
    this.cabine = new Surface(bateau, {
      dedans: true, largeur: 1.45, z0: CARRE.zAvant, z1: zDe(ROUF.uArriere), y: CARRE.plancher,
    });
    this.avant = { cockpit: 0, cabine: 0 };
    this.mousse = { cockpit: 0, cabine: 0 };
  }

  // litresCockpit, litresCabine : l'eau au-dessus du plancher de chacun ; pesanteur : la
  // pesanteur ressentie à bord (repère du bateau, m/s²)
  maj(dt, groupe, { litresCockpit = 0, litresCabine = 0, pesanteur, temps = 0 }) {
    const g = pesanteur ?? new THREE.Vector3(0, -9.81, 0);
    // la mousse : quand l'eau arrive d'un coup, elle bouillonne, puis se calme
    for (const [cle, litres] of [['cockpit', litresCockpit], ['cabine', litresCabine]]) {
      const arrivee = Math.max(0, litres - this.avant[cle]) / Math.max(dt, 1e-3);
      this.mousse[cle] = Math.min(1, this.mousse[cle] * Math.exp(-dt * 0.6) + arrivee / 600);
      this.avant[cle] = litres;
    }
    // (le puits du cockpit fait ~2,1 m² ; le plancher du carré ~4 m²)
    this.cockpit.maj(dt, groupe, litresCockpit / 2100, g, Math.max(0.25, this.mousse.cockpit), temps);
    this.cabine.maj(dt, groupe, litresCabine / 4000, g, 0.15 + this.mousse.cabine * 0.85, temps);
  }
}
