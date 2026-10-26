/* ============================================================
   panels.js - Janelas, painéis e comportamento da interface
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= RECOLHER JANELAS FLUTUANTES ================= */
(function initWindowCollapseButtons(){
  const windows = [
    {panel:"search-box", header:"#search-box-header"},
    {panel:"bookmarks-box", header:".bm-title"},
    {panel:"sketch-box", header:".sk-title"},
    {panel:"measure-box", header:".ms-title"},
    {panel:"radius-box", header:".rd-title"},
    {panel:"legend-panel", header:".lp-header"},
    {panel:"layers-panel", header:".lay-header", minimize:"#lay-minimize-btn", minimizedClass:"lay-minimized"},
    {panel:"panel-basemap", header:".lp-header"},
    {panel:"panel-addlayer", header:".lp-header"},
    {panel:"panel-export", header:".lp-header"},
    {panel:"uso-panel", header:".uso-head", minimize:"#uso-minimize-btn", minimizedClass:"uso-minimized"},
    {panel:"pd-panel", header:".uso-head", minimize:"#pd-minimize-btn", minimizedClass:"uso-minimized"},
    {panel:"fbds-uso-panel", header:".uso-head", minimize:"#fbds-uso-minimize-btn", minimizedClass:"uso-minimized"},
    /* Janelas modais (V31): o recolhimento age sobre a caixa da janela */
    {panel:"attr-table-box", header:".modal-head"},
    {panel:"radius-results-box", header:".modal-head"},
    {panel:"dsh-modal-box", header:".modal-head"},
    {panel:"ibge-modal-box", header:".modal-head"},
    {panel:"help-box", header:".modal-head"},
    {panel:"about-box", header:".modal-head"},
    {panel:"map-export-box", header:".modal-head"}
  ];

  windows.forEach(({panel:panelId,header:headerSelector,minimize:minimizeSelector,minimizedClass})=>{
    const panel = document.getElementById(panelId);
    const header = panel && panel.querySelector(headerSelector);
    if(!panel || !header) return;

    const nativeMinimize = minimizeSelector && panel.querySelector(minimizeSelector);
    if(nativeMinimize){
      nativeMinimize.classList.add("window-collapse-native");
      nativeMinimize.hidden = true;
    }
    else panel.classList.add("window-collapsible");

    header.classList.add("window-collapse-header");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "window-collapse-btn";
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"></path></svg><span>Recolher</span>';

    const existingControl = nativeMinimize || header.querySelector(".lp-close,.search-close,.win-x,.modal-close");
    if(existingControl) existingControl.parentNode.insertBefore(button,existingControl);
    else header.appendChild(button);

    const updateButton = ()=>{
      const collapsed = minimizedClass
        ? panel.classList.contains(minimizedClass)
        : panel.classList.contains("window-collapsed");
      const action = collapsed ? "Expandir janela" : "Recolher janela";
      button.setAttribute("aria-label",action);
      button.setAttribute("title",action);
      button.setAttribute("aria-expanded",String(!collapsed));
    };

    button.addEventListener("click",()=>{
      if(nativeMinimize) nativeMinimize.click();
      else panel.classList.toggle("window-collapsed");
      updateButton();
    });
    if(nativeMinimize){
      new MutationObserver(updateButton).observe(panel,{attributes:true,attributeFilter:["class"]});
    }
    updateButton();

    /* Ao fechar a janela, ela volta expandida na próxima abertura */
    if(!nativeMinimize){
      const host = panel.closest(".modal-overlay") || panel;
      new MutationObserver(()=>{
        if(getComputedStyle(host).display === "none" && panel.classList.contains("window-collapsed")){
          panel.classList.remove("window-collapsed");
          updateButton();
        }
      }).observe(host,{attributes:true,attributeFilter:["class","style"]});
    }
  });
})();

/* ================= LEGEND PANEL ================= */
const legendBody = document.getElementById("legend-body");
const legendPanel = document.getElementById("legend-panel");
let legendTab = "legenda";

function districtEntries(){
  const seen = {};
  DATA_BAIRROS.features.forEach(f=>{
    const d=f.properties.Distrito;
    if(d && !seen[d]) seen[d]=true;
  });
  return Object.keys(seen);
}

function swatchHTML(sw){
  if(!sw) return `<div class="lp-swatch"></div>`;
  if(sw.type==="fill") return `<div class="lp-swatch lp-swatch-poly" style="background:${sw.color};"></div>`;
  if(sw.type==="line") return `<div class="lp-swatch line" style="background:${sw.color};${sw.outlineColor?`box-shadow:0 0 0 1.5px ${sw.outlineColor};`:""}"></div>`;
  if(sw.type==="polygon-outline") return `<div class="lp-swatch lp-swatch-poly" style="background:none;border:2px ${sw.dashed?"dashed":"solid"} ${sw.color};border-radius:2px;"></div>`;
  if(sw.type==="dash") return `<div class="lp-swatch dash"></div>`;
  if(sw.type==="rail") return `<div class="lp-swatch" style="background:none;display:flex;align-items:center;justify-content:center;">
      <svg width="20" height="16" viewBox="0 0 20 16"><g stroke="#4A4A4A" stroke-width="1.6"><line x1="3" y1="2.5" x2="3" y2="13.5"/><line x1="7" y1="2.5" x2="7" y2="13.5"/><line x1="11" y1="2.5" x2="11" y2="13.5"/><line x1="15" y1="2.5" x2="15" y2="13.5"/><line x1="19" y1="2.5" x2="19" y2="13.5"/></g><rect x="0" y="5.4" width="20" height="5.2" fill="#4A4A4A"/><rect x="0" y="7" width="20" height="2" fill="#fff"/></svg>
    </div>`;
  if(sw.type==="icon") return `<div class="lp-swatch" style="background:#fff;border:1px solid #a7a9ac;color:${sw.color};border-radius:50%;">${sw.glyph}</div>`;
  if(sw.type==="security") return `<div style="display:flex;gap:2px;flex:0 0 auto;">${SECURITY_FORCE_SYMBOLS.map(force=>securitySymbolSwatchHTML(force,14)).join("")}</div>`;
  if(sw.type==="gradient") return `<div class="lp-swatch lp-swatch-poly" style="background:linear-gradient(135deg,#ffffcc,#800026);"></div>`;
  if(sw.type==="multi") return `<div class="lp-swatch lp-swatch-poly" style="background:linear-gradient(135deg,#F2C14E 0 25%,#C8553D 25% 50%,#7B5EA7 50% 75%,#4C9F70 75% 100%);"></div>`;
  return `<div class="lp-swatch"></div>`;
}

function securitySymbolSwatchHTML(force,size=18){
  const glyphSize=Math.round(size*.66);
  return `<div class="lp-swatch" style="width:${size}px;height:${size}px;flex:0 0 ${size}px;background:#fff;border:1px solid #a7a9ac;color:${force.color};border-radius:50%;"><svg width="${glyphSize}px" height="${glyphSize}px" viewBox="0 0 32 32" aria-hidden="true">${force.svg}</svg></div>`;
}

/* ===== Organização por tipo de geometria + símbolo padronizado (estilo ArcGIS Pro) =====
   Ordem dos grupos: Pontos -> Linhas -> Polígonos. A ordem das camadas dentro de cada
   grupo é a ordem que cada janela já usava. Não altera DRAW_ORDER nem o mapa. */
const GEOMETRY_GROUPS = [
  {key:"ponto",    label:"Pontos"},
  {key:"linha",    label:"Linhas"},
  {key:"poligono", label:"Polígonos"}
];
function layerGeometryType(id){
  const layer = LAYERS[id];
  if(!layer) return "poligono";
  if(layer.geometry) return layer.geometry;
  const t = layer.swatch && layer.swatch.type;
  if(t==="icon" || t==="security") return "ponto";
  if(t==="line" || t==="rail" || t==="dash") return "linha";
  return "poligono";
}
function layerGeometryGroups(ids){
  return GEOMETRY_GROUPS
    .map(g=>({key:g.key, label:g.label, ids:ids.filter(id=>layerGeometryType(id)===g.key)}))
    .filter(g=>g.ids.length);
}
/* Hierarquia única para Legenda e janela Camadas: Geometria (Pontos > Linhas > Polígonos)
   -> Categoria -> camadas. Categorias na ordem em que aparecem no cadastro de camadas e
   camadas na ordem de cadastro dentro de cada categoria. Só muda a apresentação. */
function layerHierarchy(ids){
  const order = Object.keys(LAYERS);
  const catOf = id => LAYERS[id].category || "Outras";
  const catOrder = [];
  order.forEach(id=>{ const c = catOf(id); if(!catOrder.includes(c)) catOrder.push(c); });
  return GEOMETRY_GROUPS.map(g=>{
    const gids = ids.filter(id=>LAYERS[id] && layerGeometryType(id)===g.key);
    const cats = catOrder.map(c=>({
      cat:c,
      ids:gids.filter(id=>catOf(id)===c).sort((a,b)=>order.indexOf(a)-order.indexOf(b))
    })).filter(x=>x.ids.length);
    return {key:g.key, label:g.label, cats};
  }).filter(g=>g.cats.length);
}
/* Símbolo da Legenda e da janela Camadas: coluna de largura fixa (36px).
   Polígonos e linhas ocupam a largura toda; pontos ficam centralizados. */
function legendSymbolHTML(sw){
  let inner;
  if(sw && sw.type==="rail"){
    inner = `<div class="lp-swatch lp-swatch-rail" style="background:none;display:flex;align-items:center;justify-content:center;"><svg width="36" height="16" viewBox="0 0 36 16"><g stroke="#4A4A4A" stroke-width="1.6"><line x1="3" y1="2.5" x2="3" y2="13.5"/><line x1="8" y1="2.5" x2="8" y2="13.5"/><line x1="13" y1="2.5" x2="13" y2="13.5"/><line x1="18" y1="2.5" x2="18" y2="13.5"/><line x1="23" y1="2.5" x2="23" y2="13.5"/><line x1="28" y1="2.5" x2="28" y2="13.5"/><line x1="33" y1="2.5" x2="33" y2="13.5"/></g><rect x="0" y="5.4" width="36" height="5.2" fill="#4A4A4A"/><rect x="0" y="7" width="36" height="2" fill="#fff"/></svg></div>`;
  } else {
    inner = swatchHTML(sw);
  }
  /* Forças de Segurança: 4 círculos lado a lado (62px) não cabem na coluna de 36px;
     a coluna dessa camada acompanha a largura do símbolo e ganha folga até o nome. */
  const slotClass = (sw && sw.type==="security") ? "lp-sym-slot lp-sym-slot-wide" : "lp-sym-slot";
  return `<span class="${slotClass}">${inner}</span>`;
}

function layerSymbologyRowsHTML(id, marginLeft = 45){
  const entries = layerSymbologyEntries(id);
  if(!entries.length) return "";
  return `<div class="lp-dist-list" style="margin-top:4px;margin-left:${marginLeft}px;">${entries.map(entry=>
    `<div class="lp-row" style="padding:2px 4px;"><div class="lp-swatch lp-swatch-poly" style="width:28px;height:14px;flex:0 0 28px;background:${entry.color};"></div><span style="font-size:11px;">${escapeHtml(entry.name)}</span></div>`
  ).join("")}</div>`;
}

function renderLegend(){
  let html = "";
  /* Na aba Interativo cada linha tem o botão ON/OFF (36px + espaçamento): recua as sub-listas na mesma medida */
  const subIndent = legendTab==="interativo" ? 45 : 0;
  const ids = DRAW_ORDER.filter(id=>LAYERS[id]);
  layerHierarchy(ids).forEach(grp=>{
  grp.cats.forEach(catGrp=>{
  const grpIds = catGrp.ids.filter(id=> legendTab!=="legenda" || map.hasLayer(LAYERS[id].leaflet));
  if(!grpIds.length) return;
  html += `<div class="lp-cat-title">${escapeHtml(catGrp.cat)}</div>`;
  grpIds.forEach(id=>{
    const layer = LAYERS[id];
    const visible = map.hasLayer(layer.leaflet);
    if(legendTab==="legenda" && !visible) return;
    html += `<div class="lp-section">`;
    if(legendTab==="interativo"){
      html += `<div class="lp-row"><button type="button" class="lay-vis lay-switch" data-legend-vis="${id}" role="switch" aria-checked="${visible}" aria-label="${escapeHtml(layer.label)}: ${visible?"ligada":"desligada"}" title="${visible?"Desligar camada":"Ligar camada"}"><span class="lay-switch-label" aria-hidden="true">${visible?"ON":"OFF"}</span><span class="lay-switch-thumb" aria-hidden="true"></span></button> ${legendSymbolHTML(layer.swatch)} <span>${layer.label}</span></div>`;
    } else {
      html += `<div class="lp-row">${legendSymbolHTML(layer.swatch)} <span>${layer.label}</span></div>`;
    }
    if(id==="bairros" && (legendTab==="legenda"?visible:true)){
      html += `<div class="lp-dist-list" style="margin-top:4px;margin-left:${45+subIndent}px;">`;
      districtEntries().forEach(d=>{
        const isActive = highlightedDistrict===d;
        html += `<div class="lp-row lp-dist-item ${isActive?"active-highlight":""}" data-highlight="${d}" style="padding:2px 4px;"><div class="lp-swatch lp-swatch-poly" style="width:28px;height:14px;flex:0 0 28px;background:${distColor(d)};"></div><span style="font-size:11px;">${d}</span></div>`;
      });
      html += `</div>`;
      if(highlightedDistrict) html += `<span class="lp-clear-highlight" style="margin-left:${45+subIndent}px;" id="clear-dist-highlight">limpar destaque</span>`;
    }
    if(id==="censo" && (legendTab==="legenda"?visible:true)){
      html += `<div class="lp-dist-list" style="margin-top:4px;margin-left:${45+subIndent}px;">`;
      CENSO_COLORS.forEach((color,i)=>{
        const isActive = highlightedCensoRange===i;
        html += `<div class="lp-row lp-dist-item ${isActive?"active-highlight":""}" data-censo-range="${i}" style="padding:2px 4px;cursor:pointer;"><div class="lp-swatch lp-swatch-poly" style="width:28px;height:14px;flex:0 0 28px;background:${color};"></div><span style="font-size:11px;">${censoRangeLabel(i)}</span></div>`;
      });
      html += `</div>`;
      if(highlightedCensoRange!==null) html += `<span class="lp-clear-highlight" style="margin-left:${45+subIndent}px;" id="clear-censo-highlight">limpar filtro</span>`;
    }
    if(id==="seguranca" && (legendTab==="legenda"?visible:true)){
      html += `<div class="lp-dist-list" style="margin-top:4px;margin-left:${45+subIndent}px;">`;
      SECURITY_FORCE_SYMBOLS.forEach(force=>{
        html += `<div class="lp-row" style="padding:2px 4px;">${securitySymbolSwatchHTML(force,18)}<span style="font-size:11px;">${escapeHtml(force.agency)}</span></div>`;
      });
      html += `</div>`;
    }
    if((id==="ucs_estadual" || id==="ucs_federal" || id==="ucs_municipal") && (legendTab==="legenda"?visible:true)){
      const ucData = id==="ucs_estadual" ? DATA_UCS_ESTADUAL : (id==="ucs_federal" ? DATA_UCS_FEDERAL : DATA_UCS_MUNICIPAL);
      const cats = ucCategoriesPresent(ucData);
      if(cats.length){
        html += `<div class="lp-dist-list" style="margin-top:4px;margin-left:${45+subIndent}px;">`;
        cats.forEach(c=>{
          html += `<div class="lp-row" style="padding:2px 4px;"><div class="lp-swatch lp-swatch-poly" style="width:28px;height:14px;flex:0 0 28px;background:${ucColor(c)};"></div><span style="font-size:11px;">${c}</span></div>`;
        });
        html += `</div>`;
      }
    }
    if(layer.symbology && (legendTab==="legenda"?visible:true)){
      html += layerSymbologyRowsHTML(id,45+subIndent);
    }
    html += `</div>`;
  });
  });
  });
  if(!html) html = `<div style="color:var(--muted-text);font-size:12px;">Nenhuma camada visível. Use a aba "Interativo" para ativar camadas.</div>`;
  legendBody.innerHTML = html;
  if(legendTab==="interativo"){
    legendBody.querySelectorAll("[data-legend-vis]").forEach(btn=>{
      btn.addEventListener("click",e=>{
        e.stopPropagation();
        const id = btn.getAttribute("data-legend-vis");
        toggleLayer(id, !map.hasLayer(LAYERS[id].leaflet));
      });
    });
  }
  legendBody.querySelectorAll("[data-highlight]").forEach(row=>{
    row.addEventListener("click",()=> highlightDistrict(row.getAttribute("data-highlight")));
  });
  const clearBtn = document.getElementById("clear-dist-highlight");
  if(clearBtn) clearBtn.addEventListener("click", e=>{ e.stopPropagation(); highlightDistrict(highlightedDistrict); });
  legendBody.querySelectorAll("[data-censo-range]").forEach(row=>{
    row.addEventListener("click",()=> filterCensoRange(parseInt(row.getAttribute("data-censo-range"),10)));
  });
  const clearCensoBtn = document.getElementById("clear-censo-highlight");
  if(clearCensoBtn) clearCensoBtn.addEventListener("click", e=>{ e.stopPropagation(); filterCensoRange(highlightedCensoRange); });
}

document.querySelectorAll(".lp-tab").forEach(tab=>{
  tab.addEventListener("click",()=>{
    document.querySelectorAll(".lp-tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    legendTab = tab.getAttribute("data-tab");
    renderLegend();
  });
});

/* ================= LAYERS PANEL (Camadas de mapa) =================
   Painel reconstruído para uma experiência mais próxima de um GIS
   profissional (grupos recolhíveis, pesquisa, isolar camada, menu de
   opções por camada), preservando 100% da lógica de dados/visibilidade
   já existente: toggleLayer(), setLayerOpacity(), setAllLayers(),
   openAttributeTable(), openCensoDashboard(), usoOpenPanel() e o
   bloqueio "somente esta camada" dos dashboards continuam sendo a
   única fonte de verdade sobre o que está ligado/desligado no mapa. */
const layersBody = document.getElementById("layers-body");
const layersBadge = document.getElementById("layers-badge");
const layCountEl = document.getElementById("lay-count");
const laySearchInput = document.getElementById("lay-search");
const laySearchClearBtn = document.getElementById("lay-search-clear");

let layersSearchQuery = "";
let layersExpandedId = null;      // camada com o painel de detalhes/opções aberto
const layersGroupCollapsed = {};  // categoria -> bool
let layersIsolatedId = null;      // camada atualmente isolada (só ela visível)
let layersIsolateSnapshot = null; // visibilidade anterior ao isolamento, p/ restaurar

function layNormalize(s){
  return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

function layGroupedIds(){
  /* Mesma hierarquia da Legenda: geometria -> categoria. Chave = "geometria|categoria". */
  const out = {};
  layerHierarchy(Object.keys(LAYERS)).forEach(g=>{
    g.cats.forEach(c=>{ out[g.key+"|"+c.cat] = c.ids; });
  });
  return out;
}

function renderLayersPanel(){
  const censoOnlyMode = !!document.getElementById("modal-dashboard-censo")?.classList.contains("open");
  const exclusiveMode = censoOnlyMode;
  const exclusiveKeepId = censoOnlyMode ? "censo" : null;
  const query = layNormalize(layersSearchQuery.trim());

  const cats = layGroupedIds();
  const catNames = Object.keys(cats);
  let html = "";
  let totalVisible = 0, totalCount = 0, anyMatch = false;

  catNames.forEach(cat=>{
    const catLabel = cat.slice(cat.indexOf("|")+1);
    const ids = cats[cat].filter(id=> !query || layNormalize(LAYERS[id].label).includes(query));
    if(query && ids.length===0) return;
    anyMatch = true;
    const collapsed = !!layersGroupCollapsed[cat] && !query; // pesquisa sempre expande p/ mostrar resultados
    const groupVisible = ids.filter(id=>map.hasLayer(LAYERS[id].leaflet)).length;
    totalVisible += groupVisible;
    totalCount += ids.length;

    html += `<div class="lay-group">
      <button class="lay-group-head" data-group-toggle="${escapeHtml(cat)}" aria-expanded="${!collapsed}">
        <svg class="lay-chev ${collapsed?"":"open"}" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5 5 5-5"/></svg>
        <span class="lay-group-name">${escapeHtml(catLabel)}</span>
        <span class="lay-group-count">${groupVisible}/${ids.length}</span>
      </button>
      <div class="lay-group-body"${collapsed?" hidden":""}>`;

    ids.forEach(id=>{
      const layer = LAYERS[id];
      const visible = map.hasLayer(layer.leaflet);
      const locked = exclusiveMode && id !== exclusiveKeepId;
      const disabledAttr = locked ? " disabled aria-disabled=\"true\"" : "";
      const isExpanded = layersExpandedId === id;
      const isIsolated = layersIsolatedId === id;
      const isDimmedByIsolate = layersIsolatedId && !isIsolated;

      html += `<div class="lay-row${isExpanded?" expanded":""}${isIsolated?" isolated":""}${isDimmedByIsolate?" dimmed":""}" data-censo-disabled="${locked?"true":"false"}" data-row="${id}">
        <button class="lay-vis lay-switch" data-vis="${id}" role="switch" aria-checked="${visible}" aria-label="${escapeHtml(layer.label)}: ${visible?"ligada":"desligada"}" title="${visible?"Desligar camada":"Ligar camada"}"${disabledAttr}>
          <span class="lay-switch-label" aria-hidden="true">${visible?"ON":"OFF"}</span>
          <span class="lay-switch-thumb" aria-hidden="true"></span>
        </button>
        <span class="lay-swatch-wrap">${legendSymbolHTML(layer.swatch)}</span>
        <button class="lay-name" data-select="${id}" title="${escapeHtml(layer.label)}"${disabledAttr}>${escapeHtml(layer.label)}</button>
        ${isIsolated ? `<span class="lay-iso-tag" title="Camada isolada">isolada</span>` : ""}
        <span class="lay-featcount">${layer.count}</span>
        <button class="lay-kebab" data-menu="${id}" aria-haspopup="true" aria-expanded="${isExpanded}" title="Opções da camada"${disabledAttr}>&#8942;</button>
      </div>`;

      if(isExpanded){
        const pct = Math.round((layer._opacity ?? 1)*100);
        html += `<div class="lay-detail">
          <div class="lay-detail-actions">
            <button class="lay-detail-btn" data-act="zoom" data-id="${id}"${disabledAttr}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L21 21"/></svg>Zoom
            </button>
            <button class="lay-detail-btn" data-act="table" data-id="${id}"${disabledAttr}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/></svg>Tabela
            </button>
            ${layer.hasDashboard ? `<button class="lay-detail-btn" data-act="dashboard" data-id="${id}"${disabledAttr}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>Dashboard
            </button>` : ""}
            <button class="lay-detail-btn${isIsolated?" active":""}" data-act="isolate" data-id="${id}"${disabledAttr}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 1 2.3 5.6"/><path d="M4 20v-4.5h4.5"/></svg>${isIsolated?"Sair do isolamento":"Isolar"}
            </button>
          </div>
          <div class="opacity-row">
            <span class="opacity-label">Opacidade</span>
            <input type="range" min="0" max="100" value="${pct}" data-opacity="${id}"${disabledAttr}>
            <span class="opacity-val">${pct}%</span>
          </div>
          <div class="lay-detail-meta">${layer.count} feições · ${escapeHtml(layer.category)}</div>
          ${layer.symbology?layerSymbologyRowsHTML(id,0):""}
          ${layer.sourceName?`<div class="lay-detail-source">Fonte: <a href="${layer.sourceUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(layer.sourceName)}</a>${layer.metadataUrl?` · <a href="${layer.metadataUrl}" target="_blank" rel="noopener noreferrer">Metadados</a>`:""}<br>Base: ${escapeHtml(layer.sourceDataset||"")}</div>`:""}
        </div>`;
      }
    });

    html += `</div></div>`;
  });

  if(!anyMatch){
    html = `<div class="lay-empty">Nenhuma camada encontrada${query?` para "${escapeHtml(layersSearchQuery.trim())}"`:""}.</div>`;
  }

  layersBody.innerHTML = html;
  if(layCountEl) layCountEl.textContent = `(${totalVisible}/${totalCount})`;

  layersBody.querySelectorAll("[data-group-toggle]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const cat = btn.getAttribute("data-group-toggle");
      layersGroupCollapsed[cat] = !layersGroupCollapsed[cat];
      renderLayersPanel();
    });
  });
  layersBody.querySelectorAll("[data-vis]").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      const id = btn.getAttribute("data-vis");
      toggleLayer(id, !map.hasLayer(LAYERS[id].leaflet));
    });
  });
  layersBody.querySelectorAll("[data-select]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-select");
      layersExpandedId = (layersExpandedId===id) ? null : id;
      renderLayersPanel();
    });
  });
  layersBody.querySelectorAll("[data-menu]").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      const id = btn.getAttribute("data-menu");
      layersExpandedId = (layersExpandedId===id) ? null : id;
      renderLayersPanel();
    });
  });
  layersBody.querySelectorAll("[data-act]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const layer = LAYERS[id];
      if(act==="zoom"){
        if(!map.hasLayer(layer.leaflet)) toggleLayer(id,true);
        try{ map.fitBounds(layer.zoomBounds || layer.leaflet.getBounds(), {padding:[30,30]}); }catch(err){ showToast("Não foi possível calcular a extensão desta camada."); }
      } else if(act==="table"){
        openAttributeTable(id);
      } else if(act==="dashboard"){
        if(id==="censo"){ openCensoDashboard(); }
        if(id==="uso_ocupacao" && typeof usoOpenPanel==="function"){ usoOpenPanel(); }
        if(id==="uso_ocupacao_fbds" && typeof fbdsUsoOpenPanel==="function"){ fbdsUsoOpenPanel(); }
        if(id==="plano_diretor" && typeof pdOpenPanel==="function"){ pdOpenPanel(); }
      } else if(act==="isolate"){
        toggleIsolateLayer(id);
      }
    });
  });
  layersBody.querySelectorAll("input[data-opacity]").forEach(rg=>{
    rg.addEventListener("input",e=>{
      const id = e.target.getAttribute("data-opacity");
      const val = e.target.value/100;
      setLayerOpacity(id,val);
      const out = e.target.nextElementSibling;
      if(out) out.textContent = e.target.value+"%";
    });
  });

  const unisolateBtn = document.getElementById("lay-unisolate");
  if(unisolateBtn) unisolateBtn.disabled = !layersIsolatedId;

  updateLayersBadge();
}

/* ---- Isolar camada: mostra somente a camada escolhida, preservando o
   estado anterior de cada camada para restaurar depois. Não interfere
   com os modos exclusivos dos dashboards, que controlam a visibilidade. ---- */
function toggleIsolateLayer(id){
  const dashboardOpen = [
    "modal-dashboard-censo","uso-panel","pd-panel","fbds-uso-panel"
  ].some(panelId=>document.getElementById(panelId)?.classList.contains("open"));
  if(dashboardOpen) return;
  if(layersIsolatedId === id){
    restoreFromIsolate();
    return;
  }
  if(!layersIsolateSnapshot){
    layersIsolateSnapshot = {};
    Object.keys(LAYERS).forEach(lid=>{ layersIsolateSnapshot[lid] = map.hasLayer(LAYERS[lid].leaflet); });
  }
  Object.keys(LAYERS).forEach(lid=>{
    const shouldShow = lid === id;
    const isVisible = map.hasLayer(LAYERS[lid].leaflet);
    if(shouldShow && !isVisible) toggleLayer(lid,true);
    else if(!shouldShow && isVisible) toggleLayer(lid,false);
  });
  layersIsolatedId = id;
  renderLayersPanel();
}
function restoreFromIsolate(){
  if(layersIsolateSnapshot){
    Object.keys(layersIsolateSnapshot).forEach(lid=>{
      if(!LAYERS[lid]) return;
      const shouldShow = layersIsolateSnapshot[lid];
      const isVisible = map.hasLayer(LAYERS[lid].leaflet);
      if(shouldShow && !isVisible) toggleLayer(lid,true);
      else if(!shouldShow && isVisible) toggleLayer(lid,false);
    });
  }
  layersIsolateSnapshot = null;
  layersIsolatedId = null;
  renderLayersPanel();
}
const layUnisolateBtn = document.getElementById("lay-unisolate");
if(layUnisolateBtn) layUnisolateBtn.addEventListener("click", restoreFromIsolate);

/* ---- Pesquisa de camadas ---- */
if(laySearchInput){
  laySearchInput.addEventListener("input",e=>{
    layersSearchQuery = e.target.value;
    if(laySearchClearBtn) laySearchClearBtn.hidden = !layersSearchQuery;
    renderLayersPanel();
  });
}
if(laySearchClearBtn){
  laySearchClearBtn.addEventListener("click",()=>{
    layersSearchQuery = "";
    laySearchInput.value = "";
    laySearchClearBtn.hidden = true;
    laySearchInput.focus();
    renderLayersPanel();
  });
}

/* ---- Expandir/recolher todos os grupos ---- */
const layExpandAllBtn = document.getElementById("lay-expand-all");
const layCollapseAllBtn = document.getElementById("lay-collapse-all");
if(layExpandAllBtn) layExpandAllBtn.addEventListener("click",()=>{
  Object.keys(layGroupedIds()).forEach(cat=> layersGroupCollapsed[cat]=false);
  renderLayersPanel();
});
if(layCollapseAllBtn) layCollapseAllBtn.addEventListener("click",()=>{
  Object.keys(layGroupedIds()).forEach(cat=> layersGroupCollapsed[cat]=true);
  renderLayersPanel();
});

/* ---- Janela flutuante: arrastar (cabeçalho), redimensionar (bordas/
   cantos), minimizar e restaurar tamanho/posição — o mesmo padrão de
   comportamento usado nos painéis "Dados do IBGE", "Uso e Ocupação do
   Solo" e "Dashboard". Reaproveita as mesmas classes de alça de
   redimensionamento (.dsh-rz) já usadas nesses painéis. ---- */
(function(){
  const box = document.getElementById("layers-panel");
  if(!box) return;
  const GEOM_KEY = "layersPanelGeom";
  function minW(){ return Math.min(300, window.innerWidth * 0.92); }
  function minH(){ return Math.min(220, window.innerHeight * 0.5); }

  // Limite superior: o painel nunca pode ficar sob a barra superior.
  function topLimit(){
    const tb = document.getElementById("topbar");
    return tb ? Math.ceil(tb.getBoundingClientRect().bottom) + 8 : 66;
  }
  function isShown(){
    return box.classList.contains("open") && box.offsetWidth > 0 && box.offsetHeight > 0;
  }

  function clampToViewport(){
    if(box.classList.contains("lay-minimized")) return;
    // Painel fechado (display:none) mede 0×0: ajustar agora gravaria largura/altura
    // zero e posição 4,4 (canto esquerdo, sob a barra). Só ajusta quando visível.
    if(!isShown()) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const top0 = topLimit();
    const r = box.getBoundingClientRect();
    let w = Math.min(Math.max(r.width, minW()), vw - 8);
    let h = Math.min(Math.max(r.height, minH()), vh - top0 - 4);
    let left = r.left, top = r.top;
    left = Math.min(Math.max(left, 4), Math.max(4, vw - w - 4));
    top = Math.min(Math.max(top, top0), Math.max(top0, vh - h - 4));
    box.style.width = w + "px";
    box.style.height = h + "px";
    box.style.left = left + "px";
    box.style.top = top + "px";
    box.style.right = "auto";
  }

  function saveGeom(){
    try{
      localStorage.setItem(GEOM_KEY, JSON.stringify({
        left: box.style.left, top: box.style.top, width: box.style.width, height: box.style.height
      }));
    }catch(err){}
  }
  function loadGeom(){
    let g = null;
    try{ g = JSON.parse(localStorage.getItem(GEOM_KEY) || "null"); }catch(err){}
    if(!g || !g.left) return;
    // Descarta geometria inválida salva por versões anteriores (tamanho 0 ou
    // posição sob a barra superior) — o painel volta ao padrão.
    const gw = parseFloat(g.width), gh = parseFloat(g.height), gt = parseFloat(g.top);
    if(!(gw >= 300) || !(gh >= 220) || !(gt >= 60)){
      try{ localStorage.removeItem(GEOM_KEY); }catch(err){}
      return;
    }
    box.style.left = g.left; box.style.top = g.top;
    box.style.width = g.width; box.style.height = g.height;
    box.style.right = "auto";
  }
  function resetGeom(){
    box.style.top = "";
    box.style.right = "";
    box.style.left = "";
    box.style.width = "";
    box.style.height = "";
    box.classList.remove("lay-minimized");
    const minBtn = document.getElementById("lay-minimize-btn");
    if(minBtn) minBtn.innerHTML = "&#8722;";
    try{ localStorage.removeItem(GEOM_KEY); }catch(err){}
  }
  loadGeom();
  // Ao abrir, garante posição/tamanho válidos (dentro da tela e abaixo da barra).
  new MutationObserver(()=>{ if(box.classList.contains("open")) requestAnimationFrame(clampToViewport); })
    .observe(box, {attributes:true, attributeFilter:["class"]});

  const resetBtn = document.getElementById("lay-reset-size");
  if(resetBtn) resetBtn.addEventListener("click", resetGeom);

  const minimizeBtn = document.getElementById("lay-minimize-btn");
  if(minimizeBtn) minimizeBtn.addEventListener("click", ()=>{
    const minimized = box.classList.toggle("lay-minimized");
    minimizeBtn.innerHTML = minimized ? "&#9633;" : "&#8722;";
  });

  box.querySelectorAll(".dsh-rz").forEach(handle=>{
    handle.addEventListener("pointerdown", e=>{
      if(box.classList.contains("lay-minimized")) return;
      e.preventDefault();
      e.stopPropagation();
      const dir = handle.getAttribute("data-rz");
      const startX = e.clientX, startY = e.clientY;
      const r = box.getBoundingClientRect();
      const startW = r.width, startH = r.height, startLeft = r.left, startTop = r.top;
      const vw = window.innerWidth, vh = window.innerHeight;
      const maxW = vw - 8, maxH = vh - 8;
      const mnW = minW(), mnH = minH();
      box.classList.add("lay-resizing");
      document.body.style.userSelect = "none";
      try{ handle.setPointerCapture(e.pointerId); }catch(err){}

      function onMove(ev){
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        let w = startW, h = startH, left = startLeft, top = startTop;
        if(dir.indexOf("e")>=0) w = Math.min(Math.max(startW + dx, mnW), maxW);
        if(dir.indexOf("s")>=0) h = Math.min(Math.max(startH + dy, mnH), maxH);
        if(dir.indexOf("w")>=0){
          w = Math.min(Math.max(startW - dx, mnW), maxW);
          left = startLeft + (startW - w);
        }
        if(dir.indexOf("n")>=0){
          h = Math.min(Math.max(startH - dy, mnH), maxH);
          top = startTop + (startH - h);
        }
        left = Math.min(Math.max(left, 4), vw - w - 4);
        top = Math.min(Math.max(top, topLimit()), Math.max(topLimit(), vh - h - 4));
        box.style.width = w + "px";
        box.style.height = h + "px";
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.right = "auto";
      }
      function onUp(){
        box.classList.remove("lay-resizing");
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        saveGeom();
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, {once:true});
    });
  });

  const head = document.getElementById("layers-head");
  if(head){
    head.addEventListener("pointerdown", e=>{
      if(e.target.closest("button")) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const r = box.getBoundingClientRect();
      const startLeft = r.left, startTop = r.top;
      const vw = window.innerWidth, vh = window.innerHeight;
      box.classList.add("lay-resizing");
      document.body.style.userSelect = "none";
      try{ head.setPointerCapture(e.pointerId); }catch(err){}

      function onMove(ev){
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        const w = box.getBoundingClientRect().width, h = box.getBoundingClientRect().height;
        let left = Math.min(Math.max(startLeft + dx, 4), vw - w - 4);
        let top = Math.min(Math.max(startTop + dy, topLimit()), Math.max(topLimit(), vh - h - 4));
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.right = "auto";
      }
      function onUp(){
        box.classList.remove("lay-resizing");
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        saveGeom();
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, {once:true});
    });
    head.addEventListener("dblclick", e=>{
      if(e.target.closest("button")) return;
      resetGeom();
    });
  }
  window.addEventListener("resize", clampToViewport);
})();

function updateLayersBadge(){
  const n = Object.keys(LAYERS).filter(id=>map.hasLayer(LAYERS[id].leaflet)).length + extraLayerCount;
  layersBadge.textContent = n;
}

function updateToolbarStates(){
  const anyLayerOn = Object.keys(LAYERS).some(id=>map.hasLayer(LAYERS[id].leaflet)) || extraLayerCount > 0;
  // O dashboard lê os dados de LAYERS.censo diretamente (via layerFeatureList),
  // não depende da camada estar visível no mapa — então a checagem certa é se
  // os dados de setores censitários foram carregados, não se estão no mapa.
  const censoLoaded = !!(LAYERS.censo && LAYERS.censo.count > 0);
  document.getElementById("bb-export").disabled = !anyLayerOn;
  document.getElementById("bb-legend").disabled = !anyLayerOn;
  document.getElementById("btn-dashboard-top").disabled = !censoLoaded;
  const pdTopBtn = document.getElementById("btn-plano-diretor-top");
  if(pdTopBtn) pdTopBtn.disabled = !(LAYERS.plano_diretor && LAYERS.plano_diretor.count > 0);
  const censoDashboardOpen = !!document.getElementById("modal-dashboard-censo")?.classList.contains("open");
  const allOnBtn = document.getElementById("layers-all-on");
  const allOffBtn = document.getElementById("layers-all-off");
  if(allOnBtn) allOnBtn.disabled = censoDashboardOpen;
  if(allOffBtn) allOffBtn.disabled = censoDashboardOpen;
  // Espelha o estado disabled nos itens correspondentes do menu overflow (⋯)

}

function getMapScaleDenominator(){
  const scaleY = map.getSize().y / 2;
  const scaleStart = map.containerPointToLatLng([0, scaleY]);
  const scaleEnd = map.containerPointToLatLng([148, scaleY]);
  return scaleStart.distanceTo(scaleEnd) / (148 * 0.0254 / 96);
}

function isLayerWithinDisplayScale(layer){
  return !layer.maxScale || getMapScaleDenominator() <= layer.maxScale;
}

function updateZoomControlledLayers(){
  const censoDashboardOpen = !!document.getElementById("modal-dashboard-censo")?.classList.contains("open");
  const pdDashboardOpen = !!document.getElementById("pd-panel")?.classList.contains("open");
  if(censoDashboardOpen || pdDashboardOpen){
    const keepId = censoDashboardOpen ? "censo" : "plano_diretor";
    let changed = false;
    Object.keys(LAYERS).forEach(id=>{
      if(id === keepId) return;
      const layer = LAYERS[id];
      if(map.hasLayer(layer.leaflet)){ map.removeLayer(layer.leaflet); changed = true; }
    });
    if(changed){ renderLegend(); renderLayersPanel(); }
    return;
  }
  let changed = false;
  Object.keys(LAYERS).forEach(id=>{
    const layer = LAYERS[id];
    if(!layer.zoomControlled) return;
    const shouldShow = map.getZoom() >= (layer.minZoom || 14) && isLayerWithinDisplayScale(layer);
    const isVisible = map.hasLayer(layer.leaflet);
    if(shouldShow && !isVisible && !(layer.respectUserToggle && layer._userOff)){
      layer.leaflet.addTo(map);
      changed = true;
    } else if(!shouldShow && isVisible){
      map.removeLayer(layer.leaflet);
      changed = true;
    }
  });
  if(changed){
    if(atLayerId && typeof atApplyMapVisibility === "function"){
      atApplyMapVisibility(atFilteredIndices);
    }
    renderLegend();
    renderLayersPanel();
  }
}

function toggleLayer(id, visible){
  const layer = LAYERS[id];
  if(!layer) return;
  const censoDashboardOpen = !!document.getElementById("modal-dashboard-censo")?.classList.contains("open");
  const pdDashboardOpen = !!document.getElementById("pd-panel")?.classList.contains("open");
  if(censoDashboardOpen && id !== "censo") return;
  if(pdDashboardOpen && id !== "plano_diretor") return;
  if(layer.respectUserToggle) layer._userOff = !visible; // intenção do usuário, antes do ajuste por zoom
  if(layer.zoomControlled && visible &&
    (map.getZoom() < (layer.minZoom || 14) || !isLayerWithinDisplayScale(layer))) visible = false;
  if(visible && !map.hasLayer(layer.leaflet)) layer.leaflet.addTo(map);
  if(!visible && map.hasLayer(layer.leaflet)) map.removeLayer(layer.leaflet);
  // Se a Tabela de Atributos estiver filtrando esta camada, reaplica apenas
  // a visibilidade das feições após ligar/desligar a camada.
  if(id === atLayerId && typeof atApplyMapVisibility === "function"){
    atApplyMapVisibility(atFilteredIndices);
  }
  renderLegend();
  renderLayersPanel();
  if(id==="uso_ocupacao" && typeof usoUpdateOfflineBanner==="function") usoUpdateOfflineBanner();
}

function setAllLayers(visible){
  const censoDashboardOpen = !!document.getElementById("modal-dashboard-censo")?.classList.contains("open");
  const pdDashboardOpen = !!document.getElementById("pd-panel")?.classList.contains("open");
  if(censoDashboardOpen || pdDashboardOpen){
    const exclusiveId = censoDashboardOpen ? "censo" : "plano_diretor";
    const censoLayer = LAYERS[exclusiveId];
    if(censoLayer){
      if(visible && !map.hasLayer(censoLayer.leaflet)) censoLayer.leaflet.addTo(map);
      if(!visible && map.hasLayer(censoLayer.leaflet)) map.removeLayer(censoLayer.leaflet);
    }
    renderLegend();
    renderLayersPanel();
    return;
  }
  Object.keys(LAYERS).forEach(id=>{
    const layer = LAYERS[id];
    let v = visible;
    if(layer.respectUserToggle) layer._userOff = !visible;
    if(layer.zoomControlled && v &&
      (map.getZoom() < (layer.minZoom || 14) || !isLayerWithinDisplayScale(layer))) v = false;
    if(v && !map.hasLayer(layer.leaflet)) layer.leaflet.addTo(map);
    if(!v && map.hasLayer(layer.leaflet)) map.removeLayer(layer.leaflet);
  });
  if(atLayerId && typeof atApplyMapVisibility === "function"){
    atApplyMapVisibility(atFilteredIndices);
  }
  renderLegend();
  renderLayersPanel();
  if(typeof usoUpdateOfflineBanner==="function") usoUpdateOfflineBanner();
}
document.getElementById("layers-all-on").addEventListener("click",()=>setAllLayers(true));
document.getElementById("layers-all-off").addEventListener("click",()=>setAllLayers(false));

// Mantém os checkboxes do painel "Camadas de mapa" sempre sincronizados com o
// estado real das camadas no mapa, mesmo quando a visibilidade muda por outras
// vias (ex.: controle por zoom, busca, "ir até a camada", etc.)
let _layersSyncPending = false;
function syncLayersPanelState(){
  if(_layersSyncPending) return;
  _layersSyncPending = true;
  requestAnimationFrame(()=>{
    _layersSyncPending = false;
    updateLayersBadge();
    updateToolbarStates();
    const panelEl = document.getElementById("layers-panel");
    if(!panelEl || !panelEl.classList.contains("open")) return;
    renderLayersPanel();
  });
}
map.on("layeradd layerremove", syncLayersPanelState);

function setLayerOpacity(id, val){
  const layer = LAYERS[id];
  layer._opacity = val;
  const gj = layer.leaflet;
  if(gj.setStyle){
    gj.eachLayer(l=>{
      if(l.setStyle){ l.setStyle({opacity:val, fillOpacity: (l.options.fillOpacity!==undefined? Math.min(val,0.85):val)}); }
      if(l.setOpacity) l.setOpacity(val);
    });
  }
}

updateZoomControlledLayers();
updateBairroLabels();
updateArruamentoOsmLabels();

/* ================= BASEMAP GALLERY ================= */
const basemapGrid = document.getElementById("basemap-grid");
function renderBasemapGrid(){
  basemapGrid.innerHTML = BASEMAPS.map(b=>{
    const thumbTemplate = b.thumbUrl || b.url;
    const thumbUrl = thumbTemplate.replace("{z}",THUMB.z).replace("{y}",THUMB.y).replace("{x}",THUMB.x);
    return `<div class="bm-card ${b.id===activeBasemapId?"selected":""}" data-basemap="${b.id}">
      <div class="bm-thumb"><img src="${thumbUrl}" loading="lazy" alt="${b.label}"></div>
      <div class="bm-label">${b.label}</div>
    </div>`;
  }).join("");
  basemapGrid.querySelectorAll(".bm-card").forEach(card=>{
    card.addEventListener("click",()=>{
      const id = card.getAttribute("data-basemap");
      setBasemap(id);
      // V31: o painel Mapas Base permanece aberto após a escolha (fecha só por X ou Esc)
    });
  });
}
function setBasemap(id){
  if(id===activeBasemapId) return;
  map.removeLayer(basemapLayers[activeBasemapId]);
  basemapLayers[id].addTo(map);
  if(typeof basemapLayers[id].bringToBack === "function") basemapLayers[id].bringToBack();
  activeBasemapId = id;
  showToast("Mapa base: "+BASEMAPS.find(b=>b.id===id).label);
}

/* ================= ADD LAYER MODAL ================= */
const addlayerList = document.getElementById("addlayer-list");
function renderAddLayerModal(){
  const hidden = Object.keys(LAYERS).filter(id=>!map.hasLayer(LAYERS[id].leaflet));
  if(hidden.length===0){
    addlayerList.innerHTML = `<div style="color:var(--muted-text);font-size:12px;">Todas as camadas do geoportal já estão ativas. Você pode carregar um arquivo GeoJSON externo abaixo.</div>`;
    return;
  }
  addlayerList.innerHTML = `<div style="font-size:12px;color:var(--muted-text);margin-bottom:8px;">Camadas disponíveis para adicionar:</div>` +
    hidden.map(id=>`<div class="lp-row" style="cursor:pointer;" data-add="${id}">${swatchHTML(LAYERS[id].swatch)} <span>${LAYERS[id].label}</span></div>`).join("");
  addlayerList.querySelectorAll("[data-add]").forEach(row=>{
    row.addEventListener("click",()=>{
      toggleLayer(row.getAttribute("data-add"), true);
      renderAddLayerModal();
      showToast("Camada adicionada ao mapa.");
    });
  });
}

document.getElementById("file-add-layer").addEventListener("change",e=>{
  if(e.target.files[0]) loadExternalGeoJSON(e.target.files[0]);
});

function loadExternalGeoJSON(file, cb){
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const gj = JSON.parse(e.target.result);
      const color = "#"+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,"0");
      const id = "custom_"+Date.now();
      const leaflet = L.geoJSON(gj, {
        style:{color:color, weight:2, fillColor:color, fillOpacity:0.4},
        pointToLayer:(f,latlng)=> L.circleMarker(latlng,{radius:6,color:color,fillColor:color,fillOpacity:0.9}),
        onEachFeature:(f,l)=>{
          const p=f.properties||{};
          const rows = Object.keys(p).slice(0,8).map(k=>`${escapeHtml(k)}: ${escapeHtml(p[k])}`).join("<br>");
          l.bindPopup(rows || "Feição sem atributos");
        }
      }).addTo(map);
      /* Geometria predominante do arquivo (polígono > linha > ponto) */
      const gTypes = (gj.features||[]).map(f=>f && f.geometry && f.geometry.type || "");
      const userGeometry = gTypes.some(t=>/Polygon/.test(t)) ? "poligono"
                         : gTypes.some(t=>/LineString/.test(t)) ? "linha"
                         : gTypes.some(t=>/Point/.test(t)) ? "ponto" : "poligono";
      const userSwatch = userGeometry==="linha" ? {type:"line", color}
                       : userGeometry==="ponto" ? {type:"icon", glyph:"&#9679;", color}
                       : {type:"fill", color};
      registerLayer(id, {
        label: file.name.replace(/\.(json|geojson)$/i,""),
        category:"Camadas do usuário",
        defaultVisible:true,
        count: (gj.features||[]).length,
        swatch:userSwatch,
        geometry:userGeometry,
        leaflet
      });
      DRAW_ORDER.push(id);
      extraLayerCount++;
      attachHoverTooltip(id);
      try{ map.fitBounds(leaflet.getBounds(), {padding:[30,30]}); }catch(err){}
      renderLegend(); renderLayersPanel(); renderAddLayerModal();
      showToast("Camada \""+file.name+"\" carregada.");
      if(cb) cb();
    }catch(err){
      showToast("Não foi possível ler o arquivo. Verifique se é um GeoJSON válido.");
    }
  };
  reader.readAsText(file);
}

/* ================= MODALS (About / Attribute Table — remain as full overlays) ================= */
function openModal(id){
  document.getElementById(id).classList.add("open");
  const trigger = document.querySelector('[aria-controls="'+id+'"]');
  if(trigger) trigger.setAttribute("aria-expanded","true");
}
function closeModal(id){
  document.getElementById(id).classList.remove("open");
  const trigger = document.querySelector('[aria-controls="'+id+'"]');
  if(trigger) trigger.setAttribute("aria-expanded","false");
}
document.querySelectorAll(".modal-close").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const id = btn.getAttribute("data-close");
    if(id==="modal-dashboard-censo" && typeof closeCensoDashboard==="function") closeCensoDashboard();
    else closeModal(id);
  });
});
/* V31: clicar no fundo (fora da janela) NÃO fecha mais os modais.
   Fechamento somente pelo botão X ou pela tecla Esc (js/janelas.js). */

/* ================= SINGLE-WINDOW PANEL SYSTEM ================= */
// All IDs of panels that compete for the top-right slot
const ALL_PANELS = [
  "legend-panel","layers-panel","panel-basemap","panel-addlayer","panel-export",
  "sketch-box","measure-box","radius-box","bookmarks-box","search-box"
];
// Button IDs that map 1:1 to their panel
const PANEL_BTNS = {
  "legend-panel":  "bb-legend",
  "layers-panel":  "bb-layers",
  "panel-basemap": "bb-basemaps",
  "panel-addlayer":"bb-addlayer",
  "panel-export":  "bb-export",
  "sketch-box":    "bb-sketch",
  "measure-box":   "bb-measure",
  "radius-box":    "bb-radius",
};
// Botões cujo estado é comunicado via aria-pressed (toggles) em vez de
// aria-expanded (abre um painel/diálogo lateral).
const TOGGLE_BTNS = ["bb-measure","bb-sketch","bb-radius"];

function closeAllPanels(){
  ALL_PANELS.forEach(id=>{
    const el = document.getElementById(id);
    if(el){
      el.classList.remove("open");
      el.style.display = ""; // clear any inline style so CSS .open rules can work
    }
  });
  Object.values(PANEL_BTNS).forEach(btnId=>{
    const b = document.getElementById(btnId);
    if(b){
      b.classList.remove("active");
      if(TOGGLE_BTNS.includes(btnId)) b.setAttribute("aria-pressed","false");
      else b.setAttribute("aria-expanded","false");
    }
  });
  if(typeof closeToolsMenu === "function") closeToolsMenu();
}

function openPanel(panelId, onOpen){
  const el = document.getElementById(panelId);
  const isOpen = el.classList.contains("open");
  closeAllPanels();
  if(!isOpen){
    el.classList.add("open");
    const btnId = PANEL_BTNS[panelId];
    if(btnId){
      const btn = document.getElementById(btnId);
      btn.classList.add("active");
      if(TOGGLE_BTNS.includes(btnId)) btn.setAttribute("aria-pressed","true");
      else btn.setAttribute("aria-expanded","true");
    }
    if(onOpen) onOpen();
  }
}

// Escape cancela qualquer ferramenta de clique-no-mapa em uso (Esboço,
// Medir, Consulta por Raio) e fecha todos os painéis laterais (inclusive
// busca/favoritos) e quaisquer modais (.modal-overlay) abertos, sem
// interferir nos listeners de Escape específicos de cada modal (foco,
// etc.), que continuam a rodar normalmente pois observam a própria
// mudança de classe.
document.addEventListener("keydown", e=>{
  if(e.key !== "Escape") return;
  if(typeof cancelActiveTools === "function") cancelActiveTools();
  // V31: Esc fecha apenas a janela ativa (js/janelas.js), não mais todas de uma vez.
  const menu = document.getElementById("tools-menu");
  if(menu && !menu.hidden && typeof closeToolsMenu === "function"){
    closeToolsMenu();
    e.__geoEscConsumido = true; // fechou só o menu; mantém as janelas
  }
});

/* ================= BOTTOM TOOLBAR ================= */
document.getElementById("bb-layers").addEventListener("click",()=>{
  const layersPanelEl = document.getElementById("layers-panel");
  if(layersPanelEl) layersPanelEl.classList.remove("lay-minimized");
  const layMinBtn = document.getElementById("lay-minimize-btn");
  if(layMinBtn) layMinBtn.innerHTML = "&#8722;";
  openPanel("layers-panel", renderLayersPanel);
});
document.getElementById("layers-close").addEventListener("click",()=>closeAllPanels());

document.getElementById("bb-legend").addEventListener("click",()=>{
  openPanel("legend-panel", renderLegend);
});
document.getElementById("legend-close").addEventListener("click",()=>closeAllPanels());

document.getElementById("bb-basemaps").addEventListener("click",()=>{
  openPanel("panel-basemap", renderBasemapGrid);
});
document.getElementById("bb-addlayer").addEventListener("click",()=>{
  openPanel("panel-addlayer", renderAddLayerModal);
});
document.getElementById("bb-sketch").addEventListener("click",()=>{
  openPanel("sketch-box", ()=>{ syncSketchStyleInputs(); renderSketchList(); });
});
document.getElementById("bb-measure").addEventListener("click",()=>{
  openPanel("measure-box", ()=>{ syncMeasureUI(); renderMeasureList(); });
});
document.getElementById("bb-radius").addEventListener("click",()=>{
  openPanel("radius-box", ()=>{ if(typeof radiusOnPanelOpen==="function") radiusOnPanelOpen(); });
});
let censoVisibilitySnapshot = null;

/* ================= PAINEL LATERAL RECOLHÍVEL ================= */
(function initToolbarCollapse(){
  const bar = document.getElementById("left-toolbar");
  const btn = document.getElementById("lt-collapse");
  if(!bar || !btn) return;
  const KEY = "geoportal.painelLateralRecolhido";
  function apply(collapsed){
    bar.classList.toggle("collapsed", collapsed);
    btn.setAttribute("aria-expanded", String(!collapsed));
    // O texto visual permanece sempre "Recolher".
    // Tooltip e acessibilidade continuam indicando a ação do estado atual.
    const actionLabel = collapsed ? "Expandir painel lateral" : "Recolher painel lateral";
    btn.setAttribute("aria-label", actionLabel);
    btn.setAttribute("title", actionLabel);
  }
  let saved = false;
  try{ saved = localStorage.getItem(KEY)==="1"; }catch(e){}
  apply(saved);
  btn.addEventListener("click", ()=>{
    const next = !bar.classList.contains("collapsed");
    apply(next);
    try{ localStorage.setItem(KEY, next ? "1" : "0"); }catch(e){}
  });
})();
