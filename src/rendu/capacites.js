// Ce que sait faire le navigateur, et avec quelle carte graphique : pour savoir avant de
// lancer le jeu s'il peut tourner ici (sinon, le dire clairement : src/entree.js), et pour
// choisir la qualité de départ (la qualité « Auto »).
//
// Le jeu demande deux choses :
//  - WebGL 2, le dessin en 3D des navigateurs d'aujourd'hui ;
//  - de pouvoir dessiner dans des images « à virgule » (EXT_color_buffer_float) : la lumière
//    de la nuit va du noir d'encre à l'éclair, des milliers de fois plus fort, et ne tient pas
//    dans les 256 niveaux d'une image ordinaire.
// Et il vaut mieux une carte graphique : un navigateur qui dessine avec le processeur seul
// (l'accélération graphique coupée, ou la carte graphique refusée) fera tourner le jeu, mais
// très lentement.

// (la dernière vérification : le jeu y lit s'il tourne sans carte graphique)
export let derniereVerification = null;

// Essaie, sur une petite toile à part, ce que le jeu demande. Rend { ok, raison, carte,
// sansCarteGraphique } : raison ('webgl2' ou 'flottants') quand le jeu ne peut pas tourner.
export function verifierCapacites() {
  const gl = contexte();
  if (!gl) return (derniereVerification = { ok: false, raison: 'webgl2' });
  const flottants = !!gl.getExtension('EXT_color_buffer_float');
  const carte = nomCarteGraphique(gl);
  lacher(gl);
  if (!flottants) return (derniereVerification = { ok: false, raison: 'flottants', carte });
  // (un navigateur qui dessinerait avec le processeur seul refuse la toile quand on lui dit
  // de ne pas accepter de « gros défaut de performance » ; son nom le trahit aussi)
  let lent = sansCarteGraphique(carte);
  if (!lent) {
    const exigeant = contexte({ failIfMajorPerformanceCaveat: true });
    lent = !exigeant;
    lacher(exigeant);
  }
  return (derniereVerification = { ok: true, carte, sansCarteGraphique: lent });
}

function contexte(options = {}) {
  try {
    return document.createElement('canvas').getContext('webgl2', { powerPreference: 'high-performance', ...options });
  } catch {
    return null;
  }
}
// (rendre tout de suite la toile d'essai : un navigateur n'en garde qu'un petit nombre)
function lacher(gl) {
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
}

// Le nom de la carte graphique, quand le navigateur le donne (« ANGLE (Intel, Intel(R) UHD
// Graphics 620 Direct3D11…) », « Apple M1 »…) ; sinon, une chaîne vide.
// (Firefox le donne directement ; Chrome et Safari, par une extension que Firefox, lui,
// déconseille : on ne la demande que s'il le faut)
export function nomCarteGraphique(gl) {
  try {
    const nom = String(gl.getParameter(gl.RENDERER) ?? '');
    if (nom && !/^webkit webgl$/i.test(nom)) return nom;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? nom) : nom;
  } catch {
    return '';
  }
}

// Le navigateur dessine-t-il sans carte graphique (avec le processeur seul) ? À son nom.
export function sansCarteGraphique(nom) {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(nom);
}
