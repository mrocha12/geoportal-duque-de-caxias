/* ============================================================
   attribute-table.js - Ferramenta "Tabela de Atributos"
   Geoportal Duque de Caxias

   Permite escolher uma camada já carregada no Geoportal e ver seus
   registros em tabela: pesquisar, filtrar por campo, ordenar colunas,
   selecionar um ou vários registros (sincronizado com destaque no
   mapa), dar zoom, abrir o popup completo e exportar os resultados
   filtrados/selecionados em CSV ou GeoJSON. Usa exclusivamente os
   dados já carregados nas camadas (LAYERS) — nada é buscado de novo.
   ============================================================ */

/* ================= ESTADO ================= */
let atLayerId = null;
let atFeatures = [];          // [{feature, leafletLayer}, ...] da camada atual
let atColumns = [];           // todas as chaves de propriedades (união), na ordem de 1ª aparição
let atVisibleColumns = new Set();
let atColumnWidths = {};      // {campo: largura em px}
let atFilters = [];           // [{field, type, op, value, value2}]
let atSortField = null;
let atSortDir = "asc";
let atSelectedIndices = new Set(); // índices em atFeatures
let atFilteredIndices = [];        // índices em atFeatures após busca+filtros (já ordenados)
let atPage = 0;
const atPageSize = 100;
let atSearchDebounce = null;
let atMapFilterLayerId = null; // camada cuja visibilidade das feições está temporariamente filtrada

const AT_HIGHLIGHT_COLOR = "#ff6d00";
const atHighlightLayer = L.featureGroup().addTo(map);

/* ================= HELPERS ================= */
function atNormalizeText(s){
  return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

// Só troca "_" por espaço — não inventa tradução, respeitando o dado original.
function atPrettyFieldLabel(key){
  return String(key||"").replace(/_/g," ");
}

function atCollectFeatures(id){
  const layer = LAYERS[id];
  const feats = [];
  if(layer && layer.leaflet && layer.leaflet.eachLayer){
    layer.leaflet.eachLayer(l=>{ if(l.feature) feats.push({feature:l.feature, leafletLayer:l}); });
  }
  return feats;
}

function atDetectFieldType(field){
  let numCount=0, dateCount=0, total=0;
  for(const entry of atFeatures){
    const v = entry.feature.properties ? entry.feature.properties[field] : undefined;
    if(isBlank(v)) continue;
    total++;
    if(typeof v==="number" || (/^-?\d+([.,]\d+)?$/.test(String(v).trim()) && !isNaN(parseFloat(v)))) numCount++;
    else if(/\d{4}/.test(String(v)) && !isNaN(Date.parse(v))) dateCount++;
  }
  if(total===0) return "text";
  if(numCount/total>0.8) return "number";
  if(dateCount/total>0.8) return "date";
  return "text";
}

// Valores distintos existentes no campo, para o usuário escolher
// diretamente no filtro (em vez de digitar). Ordenado (numérico quando
// fizer sentido) e limitado a um total razoável de opções.
const AT_FILTER_VALUE_LIST_LIMIT = 500;
function atGetDistinctValues(field){
  if(!field) return [];
  const set = new Set();
  atFeatures.forEach(entry=>{
    const v = entry.feature.properties ? entry.feature.properties[field] : undefined;
    if(!isBlank(v)) set.add(String(v).trim());
  });
  const arr = Array.from(set);
  arr.sort((a,b)=>a.localeCompare(b, "pt-BR", {numeric:true, sensitivity:"base"}));
  return arr.slice(0, AT_FILTER_VALUE_LIST_LIMIT);
}

/* ================= DESTAQUE NO MAPA (mesmo padrão visual da Consulta por Raio) ================= */
function atBuildHighlight(feature){
  const geom = feature.geometry;
  if(!geom) return null;
  switch(geom.type){
    case "Point":
      return L.circleMarker([geom.coordinates[1], geom.coordinates[0]], {
        radius:12, color:AT_HIGHLIGHT_COLOR, weight:3,
        fillColor:AT_HIGHLIGHT_COLOR, fillOpacity:0.35, pane:"paneHighlight", interactive:false
      });
    case "MultiPoint": {
      const group = L.featureGroup();
      geom.coordinates.forEach(c=>{
        L.circleMarker([c[1],c[0]], {
          radius:12, color:AT_HIGHLIGHT_COLOR, weight:3,
          fillColor:AT_HIGHLIGHT_COLOR, fillOpacity:0.35, pane:"paneHighlight", interactive:false
        }).addTo(group);
      });
      return group;
    }
    case "LineString":
    case "MultiLineString":
      return L.geoJSON(feature, {style:{color:AT_HIGHLIGHT_COLOR, weight:6, opacity:0.85, pane:"paneHighlight"}, pane:"paneHighlight", interactive:false});
    case "Polygon":
    case "MultiPolygon":
      return L.geoJSON(feature, {style:{color:AT_HIGHLIGHT_COLOR, weight:3, fill:false, dashArray:"6,4", opacity:0.95, pane:"paneHighlight"}, pane:"paneHighlight", interactive:false});
    default:
      return null;
  }
}
function atUpdateHighlight(){
  atHighlightLayer.clearLayers();
  atSelectedIndices.forEach(idx=>{
    const entry = atFeatures[idx];
    if(!entry) return;
    const hl = atBuildHighlight(entry.feature);
    if(hl) hl.addTo(atHighlightLayer);
  });
}

function atNavigateToFeature(entry, openPopupFlag){
  if(!entry || !entry.feature) return;
  const layer = LAYERS[atLayerId];
  if(layer && !map.hasLayer(layer.leaflet)) toggleLayer(atLayerId, true);
  const geom = entry.feature.geometry;
  if(!geom) return;
  if(geom.type==="Point" || geom.type==="MultiPoint"){
    const c = geom.type==="Point" ? geom.coordinates : geom.coordinates[0];
    map.setView([c[1],c[0]], Math.max(map.getZoom(),16));
  } else {
    try{
      const temp = L.geoJSON(entry.feature);
      map.fitBounds(temp.getBounds(), {padding:[40,40]});
    }catch(err){ /* geometria sem bounds válidos */ }
  }
  if(openPopupFlag && entry.leafletLayer && entry.leafletLayer.openPopup) entry.leafletLayer.openPopup();
}

function atZoomToIndices(indices){
  if(!indices.length) return;
  const layer = LAYERS[atLayerId];
  if(layer && !map.hasLayer(layer.leaflet)) toggleLayer(atLayerId, true);
  try{
    const group = L.featureGroup(indices.map(i=>L.geoJSON(atFeatures[i].feature)));
    map.fitBounds(group.getBounds(), {padding:[40,40]});
  }catch(err){ showToast("Não foi possível calcular a extensão da seleção."); }
}

/* ================= SINCRONIA COM OUTRAS FERRAMENTAS =================
   Chamada pelo mapa (clique numa feição, via registerLayer em layers.js)
   e pela Consulta por Raio (radius.js) após uma busca — mantém a tabela
   sincronizada com seleções feitas por outras partes do Geoportal. */
function atOnMapFeatureClicked(layerId, feature){
  if(atLayerId !== layerId) return;
  if(!document.getElementById("modal-table").classList.contains("open")) return;
  const idx = atFeatures.findIndex(entry=>entry.feature===feature);
  if(idx<0) return;
  atSelectedIndices = new Set([idx]);
  atUpdateHighlight();
  const posInFiltered = atFilteredIndices.indexOf(idx);
  if(posInFiltered>=0) atPage = Math.floor(posInFiltered/atPageSize);
  atRenderTable();
  requestAnimationFrame(()=>{
    const row = document.querySelector(`#attr-table tr[data-idx="${idx}"]`);
    if(row) row.scrollIntoView({block:"nearest"});
  });
}

function atSyncSelectionForLayer(layerId, features){
  if(atLayerId !== layerId) return;
  if(!document.getElementById("modal-table").classList.contains("open")) return;
  const idxSet = new Set();
  features.forEach(f=>{
    const idx = atFeatures.findIndex(entry=>entry.feature===f);
    if(idx>=0) idxSet.add(idx);
  });
  if(!idxSet.size) return;
  atSelectedIndices = idxSet;
  atUpdateHighlight();
  atPage = 0;
  atRenderTable();
}

/* ================= FILTROS ================= */
function atMatchesFilters(props){
  return atFilters.every(f=>{
    const raw = props[f.field];
    if(f.type==="number"){
      const num = parseFloat(raw);
      if(isNaN(num)) return false;
      const val = parseFloat(f.value);
      switch(f.op){
        case "eq": return num===val;
        case "gt": return num>val;
        case "lt": return num<val;
        case "gte": return num>=val;
        case "lte": return num<=val;
        default: return true;
      }
    }
    if(f.type==="date"){
      if(isBlank(raw)) return false;
      const d = Date.parse(raw);
      if(isNaN(d)) return false;
      switch(f.op){
        case "eq": return new Date(raw).toDateString()===new Date(f.value).toDateString();
        case "before": return d < Date.parse(f.value);
        case "after": return d > Date.parse(f.value);
        case "between": return d >= Date.parse(f.value) && d <= Date.parse(f.value2);
        default: return true;
      }
    }
    const sVal = atNormalizeText(isBlank(raw)?"":String(raw));
    const needle = atNormalizeText(f.value||"");
    switch(f.op){
      case "contains": return sVal.includes(needle);
      case "equals": return sVal===needle;
      case "startswith": return sVal.startsWith(needle);
      default: return true;
    }
  });
}

function atHasActiveMapFilter(){
  const searchTerm = atNormalizeText(document.getElementById("at-search")?.value || "");
  return atFilters.length > 0 || !!searchTerm;
}

// Mantém o filtro apenas como estado visual da camada no mapa.
// Nenhuma feição ou dado original é alterado/excluído.
function atApplyMapVisibility(indices){
  const layer = atLayerId ? LAYERS[atLayerId] : null;
  if(!layer || !layer.leaflet) return;

  const mapFilterActive = atHasActiveMapFilter();

  // Sem filtro: restaura todas as feições da camada, mas somente se a
  // camada estiver atualmente ligada no mapa.
  if(!mapFilterActive){
    if(map.hasLayer(layer.leaflet)){
      atFeatures.forEach(entry=>{
        if(entry.leafletLayer && !map.hasLayer(entry.leafletLayer)){
          layer.leaflet.addLayer(entry.leafletLayer);
        }
      });
    }
    if(atMapFilterLayerId === atLayerId) atMapFilterLayerId = null;
    return;
  }

  atMapFilterLayerId = atLayerId;

  // O filtro só atua sobre as feições da camada quando ela está visível.
  // Se a camada estiver desligada, não a ligamos automaticamente.
  if(!map.hasLayer(layer.leaflet)) return;

  const visibleSet = new Set(indices);
  atFeatures.forEach((entry, idx)=>{
    if(!entry.leafletLayer) return;
    if(visibleSet.has(idx)){
      if(!map.hasLayer(entry.leafletLayer)){
        layer.leaflet.addLayer(entry.leafletLayer);
      }
    }else{
      if(map.hasLayer(entry.leafletLayer)){
        layer.leaflet.removeLayer(entry.leafletLayer);
      }
    }
  });
}

// Restaura a camada ao trocar de camada ou fechar/limpar a tabela,
// sem alterar a visibilidade geral escolhida pelo usuário.
function atRestoreMapFilter(){
  if(!atMapFilterLayerId) return;
  const layer = LAYERS[atMapFilterLayerId];
  if(layer && layer.leaflet && map.hasLayer(layer.leaflet)){
    const features = atCollectFeatures(atMapFilterLayerId);
    features.forEach(entry=>{
      if(entry.leafletLayer && !map.hasLayer(entry.leafletLayer)){
        layer.leaflet.addLayer(entry.leafletLayer);
      }
    });
  }
  atMapFilterLayerId = null;
}

function atApplyFilters(){
  const term = atNormalizeText(document.getElementById("at-search").value||"");
  const indices = [];
  atFeatures.forEach((entry, idx)=>{
    const props = entry.feature.properties || {};
    if(!atMatchesFilters(props)) return;
    if(term){
      const hay = atNormalizeText(Object.values(props).map(v=>isBlank(v)?"":String(v)).join(" | "));
      if(!hay.includes(term)) return;
    }
    indices.push(idx);
  });
  if(atSortField){
    indices.sort((a,b)=>{
      const va = atFeatures[a].feature.properties ? atFeatures[a].feature.properties[atSortField] : undefined;
      const vb = atFeatures[b].feature.properties ? atFeatures[b].feature.properties[atSortField] : undefined;
      const na = parseFloat(va), nb = parseFloat(vb);
      let cmp;
      if(!isNaN(na) && !isNaN(nb) && !isBlank(va) && !isBlank(vb)){
        cmp = na-nb;
      } else {
        cmp = String(va??"").localeCompare(String(vb??""), "pt-BR", {numeric:true, sensitivity:"base"});
      }
      return atSortDir==="asc" ? cmp : -cmp;
    });
  }
  atFilteredIndices = indices;
  atPage = 0;

  // A tabela continua usando exatamente o mesmo conjunto filtrado; além disso,
  // as feições que não atendem ao filtro ficam temporariamente ocultas no mapa.
  atApplyMapVisibility(indices);
  atRenderTable();
}

function atRenderFiltersList(){
  const list = document.getElementById("at-filters-list");
  const opLabels = {contains:"contém",equals:"é igual a",startswith:"começa com",eq:"=",gt:">",lt:"<",gte:"≥",lte:"≤",before:"antes de",after:"depois de",between:"entre"};
  list.innerHTML = atFilters.map((f,i)=>{
    const opLabel = opLabels[f.op] || f.op;
    const valTxt = f.op==="between" ? `${f.value} — ${f.value2}` : f.value;
    return `<div class="at-filter-chip"><span>${escapeHtml(atPrettyFieldLabel(f.field))} ${opLabel} <b>${escapeHtml(String(valTxt))}</b></span><span class="at-filter-remove" data-remove-filter="${i}" title="Remover filtro">✕</span></div>`;
  }).join("");
  list.querySelectorAll("[data-remove-filter]").forEach(el=>{
    el.addEventListener("click", ()=>{
      atFilters.splice(+el.getAttribute("data-remove-filter"), 1);
      document.getElementById("at-clear-filters").hidden = atFilters.length===0;
      atRenderFiltersList();
      atApplyFilters();
    });
  });
}

const AT_OPS_BY_TYPE = {
  text:   [["contains","contém"],["equals","é igual a"],["startswith","começa com"]],
  number: [["eq","="],["gt",">"],["lt","<"],["gte","≥"],["lte","≤"]],
  date:   [["eq","igual"],["before","anterior a"],["after","posterior a"],["between","intervalo"]]
};

function atPopulateFilterFieldOptions(){
  const sel = document.getElementById("at-filter-field");
  sel.innerHTML = atColumns.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(atPrettyFieldLabel(c))}</option>`).join("");
  atPopulateFilterOpOptions();
}
function atPopulateFilterOpOptions(){
  const field = document.getElementById("at-filter-field").value;
  const type = atDetectFieldType(field);
  const opSel = document.getElementById("at-filter-op");
  opSel.innerHTML = AT_OPS_BY_TYPE[type].map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
  atPopulateFilterValueOptions();
  atToggleFilterValue2();
}
// Preenche os selects de valor com os valores existentes no campo
// escolhido, para o usuário selecionar diretamente um deles.
function atPopulateFilterValueOptions(){
  const field = document.getElementById("at-filter-field").value;
  const values = atGetDistinctValues(field);
  const placeholder = `<option value="">Selecione um valor...</option>`;
  const optionsHtml = placeholder + values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  document.getElementById("at-filter-value").innerHTML = optionsHtml;
  document.getElementById("at-filter-value2").innerHTML = optionsHtml;
}
function atToggleFilterValue2(){
  const op = document.getElementById("at-filter-op").value;
  const v2 = document.getElementById("at-filter-value2");
  v2.hidden = op!=="between";
}

/* ================= PAINEL DE COLUNAS ================= */
function atRenderColumnsPanel(){
  const panel = document.getElementById("at-columns-panel");
  panel.innerHTML = atColumns.map(c=>{
    const checked = atVisibleColumns.has(c);
    return `<label class="at-col-check"><input type="checkbox" data-col="${escapeHtml(c)}" ${checked?"checked":""}> ${escapeHtml(atPrettyFieldLabel(c))}</label>`;
  }).join("");
  panel.querySelectorAll("input[data-col]").forEach(cb=>{
    cb.addEventListener("change", e=>{
      const c = e.target.getAttribute("data-col");
      if(e.target.checked) atVisibleColumns.add(c); else atVisibleColumns.delete(c);
      atRenderTable();
    });
  });
}

/* ================= REDIMENSIONAR COLUNAS ================= */
function atAttachColumnResize(){
  document.querySelectorAll("#attr-table .at-th-resize").forEach(handle=>{
    handle.addEventListener("pointerdown", e=>{
      e.preventDefault();
      e.stopPropagation();
      const th = handle.closest("th");
      const field = th.getAttribute("data-field");
      const col = document.querySelector(`#attr-table colgroup col[data-field="${CSS.escape(field)}"]`);
      if(!col) return;
      const startX = e.clientX;
      const startWidth = atColumnWidths[field] || 160;
      try{ handle.setPointerCapture(e.pointerId); }catch(err){}
      function onMove(ev){
        const w = Math.max(60, startWidth + (ev.clientX - startX));
        atColumnWidths[field] = w;
        col.style.width = w+"px";
      }
      function onUp(){
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, {once:true});
    });
  });
}

/* ================= TABELA ================= */
function atUpdateStatusText(){
  const el = document.getElementById("at-status-text");
  if(!el) return;
  const total = atFeatures.length;
  const found = atFilteredIndices.length;
  const selCount = atSelectedIndices.size;
  let txt = found===total ? `${total} registro(s) encontrado(s).` : `${found} registro(s) encontrado(s) de ${total}.`;
  if(selCount>0) txt += ` ${selCount} registro(s) selecionado(s).`;
  el.textContent = txt;
}

function atRenderPager(){
  const pager = document.getElementById("at-pager");
  if(atFilteredIndices.length<=atPageSize){ pager.hidden = true; return; }
  const totalPages = Math.max(1, Math.ceil(atFilteredIndices.length/atPageSize));
  pager.hidden = false;
  document.getElementById("at-page-info").textContent = `Página ${atPage+1} de ${totalPages}`;
  document.getElementById("at-prev-page").disabled = atPage<=0;
  document.getElementById("at-next-page").disabled = atPage>=totalPages-1;
}

function atRenderTable(){
  const table = document.getElementById("attr-table");
  const scroll = document.getElementById("at-table-scroll");
  if(!atLayerId){
    table.innerHTML = "";
    scroll.classList.add("at-empty");
    if(!document.getElementById("at-empty-msg")){
      const msg = document.createElement("div");
      msg.id = "at-empty-msg";
      msg.className = "at-empty-state";
      msg.textContent = "Selecione uma camada acima para ver seus registros.";
      scroll.appendChild(msg);
    }
    document.getElementById("at-pager").hidden = true;
    return;
  }
  const existingMsg = document.getElementById("at-empty-msg");
  if(existingMsg) existingMsg.remove();
  scroll.classList.remove("at-empty");

  if(!atFeatures.length){
    table.innerHTML = "";
    const msg = document.createElement("div");
    msg.id = "at-empty-msg";
    msg.className = "at-empty-state";
    msg.textContent = "Esta camada não possui feições carregadas.";
    scroll.appendChild(msg);
    document.getElementById("at-pager").hidden = true;
    atUpdateStatusText();
    return;
  }

  const pageIndices = atFilteredIndices.slice(atPage*atPageSize, (atPage+1)*atPageSize);
  const visibleCols = atColumns.filter(c=>atVisibleColumns.has(c));

  const colgroup = `<colgroup><col style="width:32px">` +
    visibleCols.map(c=>`<col data-field="${escapeHtml(c)}" style="width:${(atColumnWidths[c]||160)}px">`).join("") +
    `</colgroup>`;

  const thead = `<thead><tr>
      <th class="at-th-checkbox"><input type="checkbox" id="at-th-select-all" title="Selecionar/limpar página atual"></th>` +
    visibleCols.map(c=>{
      const arrow = atSortField===c ? (atSortDir==="asc" ? " ▲" : " ▼") : "";
      return `<th data-field="${escapeHtml(c)}" title="${escapeHtml(c)}">${escapeHtml(atPrettyFieldLabel(c))}<span class="at-sort-arrow">${arrow}</span><span class="at-th-resize"></span></th>`;
    }).join("") + `</tr></thead>`;

  let tbody = "<tbody>";
  pageIndices.forEach(idx=>{
    const entry = atFeatures[idx];
    const props = entry.feature.properties || {};
    const selected = atSelectedIndices.has(idx);
    tbody += `<tr data-idx="${idx}" class="${selected?"at-row-selected":""}">` +
      `<td class="at-td-checkbox"><input type="checkbox" data-select-idx="${idx}" ${selected?"checked":""}></td>` +
      visibleCols.map(c=>{
        const v = props[c];
        const vStr = isBlank(v) ? "" : String(v);
        return `<td title="${escapeHtml(vStr)}">${escapeHtml(vStr)}</td>`;
      }).join("") + `</tr>`;
  });
  tbody += "</tbody>";

  table.innerHTML = colgroup + thead + tbody;

  table.querySelectorAll("thead th[data-field]").forEach(th=>{
    th.addEventListener("click", e=>{
      if(e.target.classList.contains("at-th-resize")) return;
      const field = th.getAttribute("data-field");
      if(atSortField===field){ atSortDir = atSortDir==="asc" ? "desc" : "asc"; }
      else { atSortField = field; atSortDir = "asc"; }
      atApplyFilters();
    });
  });
  atAttachColumnResize();

  table.querySelectorAll("tbody tr[data-idx]").forEach(tr=>{
    const idx = +tr.getAttribute("data-idx");
    tr.addEventListener("click", e=>{
      if(e.target.matches('input[type="checkbox"]')) return;
      atSelectedIndices = new Set([idx]);
      atUpdateHighlight();
      atUpdateStatusText();
      atRenderTable();
      atNavigateToFeature(atFeatures[idx], true);
    });
  });
  table.querySelectorAll("input[data-select-idx]").forEach(cb=>{
    cb.addEventListener("click", e=> e.stopPropagation());
    cb.addEventListener("change", e=>{
      const idx = +e.target.getAttribute("data-select-idx");
      if(e.target.checked) atSelectedIndices.add(idx); else atSelectedIndices.delete(idx);
      atUpdateHighlight();
      atUpdateStatusText();
      atRenderTable();
    });
  });
  const selAllCb = document.getElementById("at-th-select-all");
  if(selAllCb){
    selAllCb.checked = pageIndices.length>0 && pageIndices.every(i=>atSelectedIndices.has(i));
    selAllCb.addEventListener("change", e=>{
      if(e.target.checked) pageIndices.forEach(i=>atSelectedIndices.add(i));
      else pageIndices.forEach(i=>atSelectedIndices.delete(i));
      atUpdateHighlight();
      atUpdateStatusText();
      atRenderTable();
    });
  }

  atUpdateStatusText();
  atRenderPager();
}

/* ================= CARREGAR / TROCAR CAMADA ================= */
function atClearToEmptyState(){
  atRestoreMapFilter();
  atLayerId = null;
  atFeatures = [];
  atColumns = [];
  atVisibleColumns = new Set();
  atColumnWidths = {};
  atFilters = [];
  atSortField = null;
  atSortDir = "asc";
  atSelectedIndices = new Set();
  atFilteredIndices = [];
  atPage = 0;
  document.getElementById("at-search").value = "";
  document.getElementById("at-search").disabled = true;
  document.getElementById("at-links-row").hidden = true;
  document.getElementById("at-status-row").hidden = true;
  document.getElementById("at-filters-panel").hidden = true;
  document.getElementById("at-columns-panel").hidden = true;
  document.getElementById("table-note").textContent = "";
  document.getElementById("table-title").textContent = "Tabela de Atributos";
  atHighlightLayer.clearLayers();
  atRenderTable();
}

function atLoadLayer(id){
  if(atLayerId && atLayerId !== id) atRestoreMapFilter();
  atLayerId = id;
  atFeatures = atCollectFeatures(id);
  const colsSet = new Set();
  atFeatures.forEach(entry=> Object.keys(entry.feature.properties||{}).forEach(k=>colsSet.add(k)));
  atColumns = Array.from(colsSet);
  atVisibleColumns = new Set(atColumns.slice(0, Math.min(8, atColumns.length)));
  // Camadas com `tableColumns` definido em layers.js abrem com as colunas mais
  // relevantes primeiro/visíveis (as demais continuam disponíveis em "Colunas").
  const prefCols = (LAYERS[id] && LAYERS[id].tableColumns || []).filter(c=>colsSet.has(c));
  if(prefCols.length){
    atColumns = prefCols.concat(atColumns.filter(c=>prefCols.indexOf(c)<0));
    atVisibleColumns = new Set(prefCols.slice(0, 8));
  }
  atColumnWidths = {};
  atFilters = [];
  atSortField = null;
  atSortDir = "asc";
  atSelectedIndices = new Set();
  atPage = 0;

  const hasFeats = atFeatures.length>0;
  document.getElementById("at-search").value = "";
  document.getElementById("at-search").disabled = !hasFeats;
  document.getElementById("at-links-row").hidden = !hasFeats;
  document.getElementById("at-status-row").hidden = !hasFeats;
  document.getElementById("at-filters-panel").hidden = true;
  document.getElementById("at-columns-panel").hidden = true;
  document.getElementById("at-clear-filters").hidden = true;
  document.getElementById("table-title").textContent = "Tabela de Atributos — " + LAYERS[id].label;
  document.getElementById("table-note").textContent = atColumns.length ? `${atColumns.length} campo(s) disponível(is).` : "";

  atRenderFiltersList();
  atRenderColumnsPanel();
  atPopulateFilterFieldOptions();
  atUpdateHighlight();
  atApplyFilters();
}

function atPopulateLayerSelect(){
  const sel = document.getElementById("at-layer-select");
  const current = sel.value;
  const cats = {};
  Object.keys(LAYERS).forEach(id=>{
    const c = LAYERS[id].category || "Outras";
    cats[c] = cats[c] || [];
    cats[c].push(id);
  });
  let html = `<option value="">Selecione uma camada...</option>`;
  Object.keys(cats).forEach(cat=>{
    html += `<optgroup label="${escapeHtml(cat)}">` +
      cats[cat].map(id=>`<option value="${id}">${escapeHtml(LAYERS[id].label)}</option>`).join("") +
      `</optgroup>`;
  });
  sel.innerHTML = html;
  if(current && LAYERS[current]) sel.value = current;
}

/* ================= ABRIR A FERRAMENTA =================
   Usada tanto pelo novo botão "Tabela de Atributos" da barra lateral
   (sem camada pré-definida) quanto pelo botão "tabela" já existente
   junto de cada camada no painel de Camadas (com a camada já escolhida). */
function openAttributeTable(id){
  atPopulateLayerSelect();
  const sel = document.getElementById("at-layer-select");
  if(id && LAYERS[id]){
    sel.value = id;
    atLoadLayer(id);
  } else {
    sel.value = "";
    atClearToEmptyState();
  }
  openModal("modal-table");
}

/* ================= EVENTOS DA UI ================= */
document.getElementById("bb-attrtable").addEventListener("click", ()=> openAttributeTable(null));

document.getElementById("at-layer-select").addEventListener("change", e=>{
  const id = e.target.value;
  if(id) atLoadLayer(id); else atClearToEmptyState();
});

document.getElementById("at-search").addEventListener("input", ()=>{
  clearTimeout(atSearchDebounce);
  atSearchDebounce = setTimeout(atApplyFilters, 150);
});

document.getElementById("at-add-filter").addEventListener("click", ()=>{
  const panel = document.getElementById("at-filters-panel");
  panel.hidden = !panel.hidden;
  if(!panel.hidden) document.getElementById("at-columns-panel").hidden = true;
});
document.getElementById("at-filter-field").addEventListener("change", atPopulateFilterOpOptions);
document.getElementById("at-filter-op").addEventListener("change", atToggleFilterValue2);

// Adiciona o filtro atual (campo + operador + valor[es]) à lista e aplica
// imediatamente à tabela.
function atAddFilterFromBuilder(){
  const field = document.getElementById("at-filter-field").value;
  if(!field) return;
  const type = atDetectFieldType(field);
  const op = document.getElementById("at-filter-op").value;
  const value = document.getElementById("at-filter-value").value;
  const value2 = document.getElementById("at-filter-value2").value;
  if(isBlank(value)){ showToast("Selecione um valor para o filtro."); return; }
  if(op==="between" && isBlank(value2)){ showToast("Selecione o valor final do intervalo."); return; }
  atFilters.push({field, type, op, value, value2});
  document.getElementById("at-filter-value").value = "";
  document.getElementById("at-filter-value2").value = "";
  document.getElementById("at-clear-filters").hidden = false;
  atRenderFiltersList();
  atApplyFilters();
}
document.getElementById("at-filter-add-btn").addEventListener("click", atAddFilterFromBuilder);

// Ao escolher um valor diretamente na lista, o filtro é aplicado na hora,
// sem precisar clicar em "Adicionar" — exceto no operador "intervalo",
// que só aplica depois que os dois valores (inicial e final) forem
// escolhidos.
function atMaybeAutoApplyFilter(){
  const field = document.getElementById("at-filter-field").value;
  if(!field) return;
  const op = document.getElementById("at-filter-op").value;
  const value = document.getElementById("at-filter-value").value;
  if(isBlank(value)) return;
  if(op==="between"){
    const value2 = document.getElementById("at-filter-value2").value;
    if(isBlank(value2)) return;
  }
  atAddFilterFromBuilder();
}
document.getElementById("at-filter-value").addEventListener("change", atMaybeAutoApplyFilter);
document.getElementById("at-filter-value2").addEventListener("change", atMaybeAutoApplyFilter);

document.getElementById("at-clear-filters").addEventListener("click", ()=>{
  atFilters = [];
  document.getElementById("at-clear-filters").hidden = true;
  atRenderFiltersList();
  atApplyFilters();
});

document.getElementById("at-columns-toggle").addEventListener("click", ()=>{
  const panel = document.getElementById("at-columns-panel");
  panel.hidden = !panel.hidden;
  if(!panel.hidden) document.getElementById("at-filters-panel").hidden = true;
});

document.getElementById("at-select-all").addEventListener("click", ()=>{
  atFilteredIndices.forEach(i=>atSelectedIndices.add(i));
  atUpdateHighlight();
  atRenderTable();
});
document.getElementById("at-select-clear").addEventListener("click", ()=>{
  atSelectedIndices.clear();
  atUpdateHighlight();
  atRenderTable();
});
document.getElementById("at-zoom-selection").addEventListener("click", ()=>{
  if(!atSelectedIndices.size){ showToast("Nenhum registro selecionado."); return; }
  atZoomToIndices([...atSelectedIndices]);
});
document.getElementById("at-zoom-all").addEventListener("click", ()=>{
  if(!atFilteredIndices.length){ showToast("Nenhum resultado para dar zoom."); return; }
  atZoomToIndices(atFilteredIndices);
});
document.getElementById("at-open-popup").addEventListener("click", ()=>{
  if(atSelectedIndices.size!==1){ showToast("Selecione exatamente um registro para abrir o popup."); return; }
  const idx = [...atSelectedIndices][0];
  atNavigateToFeature(atFeatures[idx], true);
});

function atBuildExportGeoJSON(indices){
  const features = indices.map(i=> JSON.parse(JSON.stringify(atFeatures[i].feature)));
  return {type:"FeatureCollection", features};
}
document.getElementById("at-export-csv").addEventListener("click", ()=>{
  const indices = atSelectedIndices.size ? [...atSelectedIndices] : atFilteredIndices;
  if(!indices.length){ showToast("Não há registros para exportar."); return; }
  const geojson = atBuildExportGeoJSON(indices);
  const csv = geojsonToCSV(geojson);
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  downloadBlob(blob, "geoportal_dcx_" + slugifyFileName(LAYERS[atLayerId].label) + ".csv");
  showToast(`${indices.length} registro(s) exportado(s) em CSV.`);
});
document.getElementById("at-export-geojson").addEventListener("click", ()=>{
  const indices = atSelectedIndices.size ? [...atSelectedIndices] : atFilteredIndices;
  if(!indices.length){ showToast("Não há registros para exportar."); return; }
  const geojson = atBuildExportGeoJSON(indices);
  const blob = new Blob([JSON.stringify(geojson,null,2)], {type:"application/geo+json"});
  downloadBlob(blob, "geoportal_dcx_" + slugifyFileName(LAYERS[atLayerId].label) + ".geojson");
  showToast(`${indices.length} registro(s) exportado(s) em GeoJSON.`);
});

document.getElementById("at-prev-page").addEventListener("click", ()=>{
  if(atPage>0){ atPage--; atRenderTable(); }
});
document.getElementById("at-next-page").addEventListener("click", ()=>{
  const totalPages = Math.max(1, Math.ceil(atFilteredIndices.length/atPageSize));
  if(atPage<totalPages-1){ atPage++; atRenderTable(); }
});

atRenderTable(); // estado inicial vazio

/* ================= MODAL — REDIMENSIONÁVEL E MOVÍVEL =================
   Mesmo padrão já usado no Dashboard, no IBGE e na Consulta por Raio. */
(function(){
  const box = document.getElementById("attr-table-box");
  if(!box) return;
  const overlay = document.getElementById("modal-table");
  const GEOM_KEY = "attrTableModalGeom";
  function minW(){ return Math.min(420, window.innerWidth * 0.94); }
  function minH(){ return Math.min(320, window.innerHeight * 0.50); }

  function ensureFixed(){
    if(box.style.position === "fixed") return;
    const r = box.getBoundingClientRect();
    box.style.position = "fixed";
    box.style.margin = "0";
    box.style.left = r.left + "px";
    box.style.top = r.top + "px";
    box.style.width = r.width + "px";
    box.style.height = r.height + "px";
  }

  function clampToViewport(){
    if(box.style.position !== "fixed") return;
    const vw = window.innerWidth, vh = window.innerHeight;
    let w = Math.min(parseFloat(box.style.width) || box.offsetWidth, vw - 8);
    let h = Math.min(parseFloat(box.style.height) || box.offsetHeight, vh - 8);
    w = Math.max(w, Math.min(minW(), vw - 8));
    h = Math.max(h, Math.min(minH(), vh - 8));
    let left = parseFloat(box.style.left) || 0;
    let top = parseFloat(box.style.top) || 0;
    left = Math.min(Math.max(left, 4), Math.max(4, vw - w - 4));
    top = Math.min(Math.max(top, 4), Math.max(4, vh - h - 4));
    box.style.width = w + "px";
    box.style.height = h + "px";
    box.style.left = left + "px";
    box.style.top = top + "px";
  }

  function saveGeom(){
    if(box.style.position !== "fixed") return;
    try{
      localStorage.setItem(GEOM_KEY, JSON.stringify({
        left: box.style.left, top: box.style.top, width: box.style.width, height: box.style.height
      }));
    }catch(err){}
  }

  function loadGeom(){
    let g = null;
    try{ g = JSON.parse(localStorage.getItem(GEOM_KEY) || "null"); }catch(err){}
    if(!g) return;
    box.style.position = "fixed";
    box.style.margin = "0";
    box.style.left = g.left; box.style.top = g.top;
    box.style.width = g.width; box.style.height = g.height;
    clampToViewport();
  }

  function resetGeom(){
    box.style.position = "";
    box.style.margin = "";
    box.style.left = ""; box.style.top = "";
    box.style.width = ""; box.style.height = "";
    try{ localStorage.removeItem(GEOM_KEY); }catch(err){}
  }

  loadGeom();

  box.querySelectorAll(".dsh-rz").forEach(handle=>{
    handle.addEventListener("pointerdown", e=>{
      e.preventDefault();
      e.stopPropagation();
      ensureFixed();
      const dir = handle.getAttribute("data-rz");
      const startX = e.clientX, startY = e.clientY;
      const r = box.getBoundingClientRect();
      const startW = r.width, startH = r.height, startLeft = r.left, startTop = r.top;
      const vw = window.innerWidth, vh = window.innerHeight;
      const maxW = vw - 8, maxH = vh - 8;
      const mnW = minW(), mnH = minH();
      box.classList.add("dsh-resizing");
      document.body.style.userSelect = "none";
      try{ handle.setPointerCapture(e.pointerId); }catch(err){}

      function onMove(ev){
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        let w = startW, h = startH, left = startLeft, top = startTop;
        if(dir.includes("e")) w = Math.min(Math.max(startW + dx, mnW), maxW);
        if(dir.includes("s")) h = Math.min(Math.max(startH + dy, mnH), maxH);
        if(dir.includes("w")){
          w = Math.min(Math.max(startW - dx, mnW), maxW);
          left = startLeft + (startW - w);
        }
        if(dir.includes("n")){
          h = Math.min(Math.max(startH - dy, mnH), maxH);
          top = startTop + (startH - h);
        }
        left = Math.min(Math.max(left, 4), vw - w - 4);
        top = Math.min(Math.max(top, 4), vh - h - 4);
        box.style.width = w + "px";
        box.style.height = h + "px";
        box.style.left = left + "px";
        box.style.top = top + "px";
      }
      function onUp(){
        box.classList.remove("dsh-resizing");
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        saveGeom();
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, {once:true});
    });
  });

  const head = box.querySelector(".modal-head");
  if(head){
    head.addEventListener("pointerdown", e=>{
      if(e.target.closest("button")) return;
      e.preventDefault();
      ensureFixed();
      const startX = e.clientX, startY = e.clientY;
      const r = box.getBoundingClientRect();
      const startLeft = r.left, startTop = r.top;
      const vw = window.innerWidth, vh = window.innerHeight;
      box.classList.add("dsh-resizing");
      document.body.style.userSelect = "none";
      try{ head.setPointerCapture(e.pointerId); }catch(err){}

      function onMove(ev){
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        const w = box.getBoundingClientRect().width, h = box.getBoundingClientRect().height;
        let left = Math.min(Math.max(startLeft + dx, 4), vw - w - 4);
        let top = Math.min(Math.max(startTop + dy, 4), vh - h - 4);
        box.style.left = left + "px";
        box.style.top = top + "px";
      }
      function onUp(){
        box.classList.remove("dsh-resizing");
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

  const resetBtn = document.getElementById("attr-table-reset-size");
  if(resetBtn) resetBtn.addEventListener("click", resetGeom);

  window.addEventListener("resize", clampToViewport);

  if(overlay){
    new MutationObserver(()=>{
      if(overlay.classList.contains("open")) requestAnimationFrame(()=>box.focus());
    }).observe(overlay, {attributes:true, attributeFilter:["class"]});
  }
})();
