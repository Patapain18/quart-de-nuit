// Ce que sait faire le navigateur, et avec quelle carte graphique : pour choisir la qualité
// de départ (la qualité « Auto »).

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

// Le navigateur dessine-t-il sans carte graphique (avec le processeur seul : l'accélération
// matérielle est coupée, ou la carte graphique est refusée) ? Le jeu sera alors très lent.
export function sansCarteGraphique(nom) {
  return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(nom);
}
