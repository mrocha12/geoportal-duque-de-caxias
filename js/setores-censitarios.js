/* ============================================================
   setores-censitarios.js - Funcionalidades dos setores censitários
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= SELEÇÃO DE SETORES CENSITÁRIOS NO MAPA (Dashboard) =================
   Permite clicar em um ou mais setores da camada "censo" diretamente no mapa,
   enquanto o Dashboard estiver aberto, destacando-os visualmente por meio de uma
   camada auxiliar (não interativa) sobreposta, sem alterar o estilo/eventos já
   existentes na camada "censo" (popup, filtro por faixa, etc.). */
let censoSelectedSectors = new Set();
let censoSelectionLayerGroup = null;

function censoDashboardIsOpen(){
  const overlay = document.getElementById("modal-dashboard-censo");
  return !!(overlay && overlay.classList.contains("open"));
}

function censoGetSelectionLayerGroup(){
  if(!censoSelectionLayerGroup) censoSelectionLayerGroup = L.layerGroup();
  return censoSelectionLayerGroup;
}

function censoRenderSelectionHighlight(){
  const group = censoGetSelectionLayerGroup();
  group.clearLayers();
  if(censoSelectedSectors.size > 0 && LAYERS.censo){
    const feats = layerFeatureList("censo").filter(f=>censoSelectedSectors.has(f.properties.CD_SETOR));
    feats.forEach(f=>{
      L.geoJSON(f, {
        pane:"paneOverlayPoligonos",
        interactive:false,
        style:{color:"#00e5ff", weight:3, fillColor:"#00e5ff", fillOpacity:0.28}
      }).addTo(group);
    });
  }
  if(censoSelectedSectors.size > 0){
    if(!map.hasLayer(group)) group.addTo(map);
  } else if(map.hasLayer(group)){
    map.removeLayer(group);
  }
}

function censoToggleSectorSelection(cdSetor){
  if(censoSelectedSectors.has(cdSetor)) censoSelectedSectors.delete(cdSetor);
  else censoSelectedSectors.add(cdSetor);
  censoRenderSelectionHighlight();
  censoRenderSelectionBanner();
}

function censoClearSelection(){
  if(censoSelectedSectors.size===0) return;
  censoSelectedSectors.clear();
  censoRenderSelectionHighlight();
  censoRenderSelectionBanner();
}

function censoRenderSelectionBanner(){
  const el = document.getElementById("dsh-selection-banner");
  if(!el) return;
  if(censoSelectedSectors.size===0){
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  const fmt = n => Math.round(n||0).toLocaleString("pt-BR");
  const feats = LAYERS.censo ? layerFeatureList("censo").filter(f=>censoSelectedSectors.has(f.properties.CD_SETOR)) : [];
  const totalPop = feats.reduce((a,f)=>a+(f.properties.V0001||0),0);
  el.style.display = "flex";
  el.innerHTML = `<span>${fmt(censoSelectedSectors.size)} setor(es) selecionado(s) — população somada: <b>${fmt(totalPop)}</b></span><button id="dsh-clear-selection-inline">limpar seleção</button>`;
  const btn = document.getElementById("dsh-clear-selection-inline");
  if(btn) btn.addEventListener("click", censoClearSelection);
}

function openCensoDashboard(){
  const overlay = document.getElementById("modal-dashboard-censo");
  if(!overlay) return;

  // Mesmo padrão do Uso e Ocupação: guarda o estado das camadas antes de abrir.
  if(!overlay.classList.contains("open")){
    censoVisibilitySnapshot = {};
    Object.keys(LAYERS).forEach(id=>{
      censoVisibilitySnapshot[id] = map.hasLayer(LAYERS[id].leaflet);
    });

    // Enquanto o Dashboard estiver aberto, somente Setores Censitários fica ativo.
    Object.keys(LAYERS).forEach(id=>{
      const layer = LAYERS[id];
      if(id === "censo"){
        if(!map.hasLayer(layer.leaflet)) layer.leaflet.addTo(map);
      }else if(map.hasLayer(layer.leaflet)){
        map.removeLayer(layer.leaflet);
      }
    });

    renderLegend();
    renderLayersPanel();
    updateLayersBadge();
    updateToolbarStates();
  }

  renderCensoDashboard();
  openModal("modal-dashboard-censo");
  renderLayersPanel();
  updateLayersBadge();
  updateToolbarStates();
}

function closeCensoDashboard(){
  const overlay = document.getElementById("modal-dashboard-censo");
  if(!overlay) return;

  if(overlay.classList.contains("open") && censoVisibilitySnapshot){
    Object.keys(LAYERS).forEach(id=>{
      const layer = LAYERS[id];
      const shouldBeVisible = censoVisibilitySnapshot[id] === true;
      const isVisible = map.hasLayer(layer.leaflet);

      if(shouldBeVisible && !isVisible) layer.leaflet.addTo(map);
      else if(!shouldBeVisible && isVisible) map.removeLayer(layer.leaflet);
    });

    censoVisibilitySnapshot = null;
    renderLegend();
    renderLayersPanel();
    updateLayersBadge();
    updateToolbarStates();
  }

  // Limpa a seleção de setores ao fechar o Dashboard.
  censoClearSelection();

  closeModal("modal-dashboard-censo");
}
document.getElementById("btn-dashboard-top").addEventListener("click",()=>{
  if(document.getElementById("modal-ibge")?.classList.contains("open")) closeModal("modal-ibge");
  if(document.getElementById("uso-panel")?.classList.contains("open") && typeof usoClosePanel==="function") usoClosePanel();
  if(document.getElementById("pd-panel")?.classList.contains("open") && typeof pdClosePanel==="function") pdClosePanel();
  openCensoDashboard();
});
document.getElementById("btn-ibge-top").addEventListener("click",()=>{
  if(document.getElementById("modal-dashboard-censo")?.classList.contains("open") && typeof closeCensoDashboard==="function") closeCensoDashboard();
  if(document.getElementById("uso-panel")?.classList.contains("open") && typeof usoClosePanel==="function") usoClosePanel();
  openModal("modal-ibge");
  ibgeInit();
});
document.getElementById("btn-uso-top").addEventListener("click",()=>{
  if(document.getElementById("modal-dashboard-censo")?.classList.contains("open") && typeof closeCensoDashboard==="function") closeCensoDashboard();
  if(document.getElementById("modal-ibge")?.classList.contains("open")) closeModal("modal-ibge");
  if(document.getElementById("pd-panel")?.classList.contains("open") && typeof pdClosePanel==="function") pdClosePanel();
  if(typeof usoOpenPanel==="function") usoOpenPanel();
});

document.getElementById("btn-plano-diretor-top").addEventListener("click",()=>{
  if(document.getElementById("modal-dashboard-censo")?.classList.contains("open") && typeof closeCensoDashboard==="function") closeCensoDashboard();
  if(document.getElementById("modal-ibge")?.classList.contains("open")) closeModal("modal-ibge");
  if(document.getElementById("uso-panel")?.classList.contains("open") && typeof usoClosePanel==="function") usoClosePanel();
  if(typeof pdOpenPanel==="function") pdOpenPanel();
});

// Close buttons on side-panels (data-panel attribute)
document.querySelectorAll(".lp-close[data-panel]").forEach(btn=>{
  btn.addEventListener("click",()=>closeAllPanels());
});
// Legacy flyout close buttons (sketch-box, measure-box, bookmarks-box)
document.querySelectorAll("[data-close-panel]").forEach(btn=>{
  btn.addEventListener("click",()=>closeAllPanels());
});



document.getElementById("bb-export").addEventListener("click",()=>{
  openPanel("panel-export", renderExportPanel);
});
