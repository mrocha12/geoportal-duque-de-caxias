/* ============================================================
   app.js - Inicialização geral e integração dos módulos
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= INIT ================= */
if(typeof updateToolbarStates === "function") updateToolbarStates();
openPanel("legend-panel", renderLegend);
setTimeout(()=>{ map.invalidateSize(); syncBottomBarAlignment(); }, 200);
window.addEventListener("resize", ()=> map.invalidateSize());
