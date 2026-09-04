/* ══════════════════════ CLAVIER ══════════════════════ */
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
  if (!$("modale").hidden) { if (e.key === "Escape") $("modale").hidden = true; return; }
  if (vue === "exercices" && X.encours && !X.pause) {
    if (X.genre === "chrono") { if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { suivante(); e.preventDefault(); } return; }
    if (e.key === "ArrowLeft") { repondre(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { repondre(1); e.preventDefault(); }
    else if (e.key === "ArrowDown" || e.key === " ") { repondre(0); e.preventDefault(); }
    else if (/^[1-5]$/.test(e.key)) { const b = $("reponses").children[+e.key - 1]; if (b) repondre(+b.dataset.v); }
  } else if (vue === "strategie" && !STR.bloque) {
    const m = { t: "H", r: "S", b: "D", s: "P", a: "U" }[e.key.toLowerCase()];
    const bt = m && $("sBoutons").querySelector(`[data-a="${m}"]`);
    if (bt && !bt.disabled) { repondreStrat(m); e.preventDefault(); }
  } else if (vue === "concentration" && CO.encours) {
    if (e.key === " " || e.key === "Enter") { detendre(); e.preventDefault(); }
  } else if (vue === "table") {
    const k = e.key.toLowerCase();
    if (k === "t") $("bTire").click(); else if (k === "r") $("bReste").click();
    else if (k === "b") $("bDouble").click(); else if (k === "s") $("bSepare").click();
    else if (k === "a") $("bAbandon").click(); else if (k === "d" || k === "Enter") $("bDonne").click();
  }
});
