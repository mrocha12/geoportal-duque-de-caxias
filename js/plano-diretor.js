/* ============================================================
   plano-diretor.js - Dashboard do Plano Diretor 2022 (Zoneamento)
   Geoportal Duque de Caxias

   Todos os números e textos vêm exclusivamente dos atributos existentes
   em DATA_PLANO_DIRETOR (Zona, Zona_2, Legislacao, AnoLei, OBJ_Estrat,
   Shape_Area e campos de metadados). Nada é estimado ou inventado.
   O estilo do mapa e o estado do filtro (pdSelectedClass, pdRestyleMap,
   pdClassOf, pdColor) ficam em layers.js, como nas demais camadas.
   ============================================================ */

const PD_ID = "plano_diretor";
let pdSearchText = "";
let pdActiveZonaKey = null;
let pdHighlightLayer = null;
let pdHighlightTimer = null;
let pdLastRows = [];
let pdVisibilitySnapshot = null;

function pdAttr(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
function pdFmtPct(p){ return (p||0).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%"; }
function pdFmtInt(n){ return (n||0).toLocaleString("pt-BR"); }
function pdArea(f){ return Number(f.properties && f.properties.Shape_Area) || 0; }
function pdVal(f, k){
  const v = f.properties ? f.properties[k] : null;
  return (v===undefined || v===null || String(v).trim()==="") ? null : String(v).trim();
}
function pdAllFeats(){ return (DATA_PLANO_DIRETOR && DATA_PLANO_DIRETOR.features) || []; }
function pdScopeFeats(){
  const all = pdAllFeats();
  return pdSelectedClass ? all.filter(f=>pdClassOf(f)===pdSelectedClass) : all;
}
function pdSum(feats){ return feats.reduce((s,f)=>s+pdArea(f),0); }
function pdGroup(feats, keyFn){
  const m = new Map();
  feats.forEach(f=>{
    const k = keyFn(f);
    if(k===null || k===undefined) return;
    const r = m.get(k) || {key:k, n:0, area:0, feats:[]};
    r.n++; r.area += pdArea(f); r.feats.push(f);
    m.set(k, r);
  });
  return Array.from(m.values());
}
function pdSigla(cls){
  const m = /\s-\s([^-]+)$/.exec(cls);
  return m ? m[1].trim() : cls;
}

/* ---------- renderização ---------- */
function pdBarRow(o){
  // o: {name, title, color, valueText, pct (0-100 da barra), active, attrs, tag}
  const tag = o.tag || "div";
  return `<${tag} class="pd-bar-row${o.active?" pd-active":""}"${tag==="button"?' type="button"':""} ${o.attrs||""} title="${pdAttr(o.title||o.name)}">
    <div class="pd-bar-top">
      ${o.color?`<span class="pd-bar-swatch" style="background:${o.color}"></span>`:""}
      <span class="pd-bar-name">${escapeHtml(o.name)}</span>
      <span class="pd-bar-val">${escapeHtml(o.valueText)}</span>
    </div>
    <div class="pd-bar-track"><div class="pd-bar-fill" style="width:${Math.max(0,Math.min(100,o.pct)).toFixed(1)}%;${o.color?`background:${o.color};`:""}"></div></div>
  </${tag}>`;
}

function pdRenderKPIs(all, scope){
  const grid = document.getElementById("pd-kpi-grid");
  const totalAll = pdSum(all), totalScope = pdSum(scope);
  const zonas = new Set(scope.map(f=>pdVal(f,"Zona")).filter(Boolean));
  const classes = new Set(scope.map(pdClassOf));
  const leis = new Set(scope.map(f=>pdVal(f,"Legislacao")).filter(Boolean));
  let biggest;
  if(pdSelectedClass){
    const z = pdGroup(scope, f=>pdVal(f,"Zona")).sort((a,b)=>b.area-a.area)[0];
    biggest = {label:"Maior zona", value:z?z.key:"-", sub:z?usoFormatArea(z.area):""};
  }else{
    const c = pdGroup(all, pdClassOf).sort((a,b)=>b.area-a.area)[0];
    biggest = {label:"Maior classe", value:c?pdSigla(c.key):"-", sub:c?`${usoFormatArea(c.area)} · ${pdFmtPct(totalAll?c.area/totalAll*100:0)}`:""};
  }
  const cards = [
    {label:"Feições (polígonos)", value:pdFmtInt(scope.length), sub:pdSelectedClass?`de ${pdFmtInt(all.length)} na base`:"na camada"},
    {label:"Área total", value:usoFormatArea(totalScope), sub:pdSelectedClass?`${pdFmtPct(totalAll?totalScope/totalAll*100:0)} da área mapeada`:"soma de Shape_Area"},
    {label:"Zonas", value:pdFmtInt(zonas.size), sub:"valores distintos de Zona"},
    {label:"Classes de zoneamento", value:pdFmtInt(classes.size), sub:"valores distintos de Zona_2"},
    {label:"Instrumentos legais", value:pdFmtInt(leis.size), sub:"valores distintos de Legislação"},
    biggest
  ];
  grid.innerHTML = cards.map(c=>`<div class="uso-kpi-card"><div class="uso-kpi-label">${escapeHtml(c.label)}</div><div class="uso-kpi-value" title="${pdAttr(c.value)}">${escapeHtml(c.value)}</div><div class="uso-kpi-sub">${escapeHtml(c.sub||"")}</div></div>`).join("");
}

function pdRenderClasses(all){
  const total = pdSum(all);
  const rows = pdGroup(all, pdClassOf).sort((a,b)=>b.area-a.area);
  const max = rows.length ? rows[0].area : 0;
  const stack = document.getElementById("pd-stack");
  stack.innerHTML = rows.map(r=>{
    const pct = total ? r.area/total*100 : 0;
    const dim = pdSelectedClass && pdSelectedClass!==r.key;
    return `<button type="button" class="pd-stack-seg${dim?" dim":""}" data-cls="${pdAttr(r.key)}" style="width:${pct}%;background:${pdColor(r.key)}" title="${pdAttr(r.key+" — "+usoFormatArea(r.area)+" ("+pdFmtPct(pct)+")")}" aria-label="${pdAttr(r.key)}"></button>`;
  }).join("");
  document.getElementById("pd-class-bars").innerHTML = rows.map(r=>{
    const pct = total ? r.area/total*100 : 0;
    return pdBarRow({tag:"button", name:r.key, color:pdColor(r.key), active:pdSelectedClass===r.key,
      valueText:`${usoFormatArea(r.area)} · ${pdFmtPct(pct)} · ${pdFmtInt(r.n)} ${r.n===1?"feição":"feições"}`,
      pct: max?r.area/max*100:0, attrs:`data-cls="${pdAttr(r.key)}"`});
  }).join("");
  document.querySelectorAll("#pd-stack [data-cls],#pd-class-bars [data-cls]").forEach(el=>{
    el.addEventListener("click", ()=>pdSelectClass(el.getAttribute("data-cls")));
  });
  const sel = document.getElementById("pd-filter-select");
  sel.innerHTML = `<option value="">Todas as classes</option>` + rows.map(r=>`<option value="${pdAttr(r.key)}"${r.key===pdSelectedClass?" selected":""}>${escapeHtml(r.key)}</option>`).join("");
}

function pdRenderGroupBars(elId, scope, field, emptyMsg){
  const el = document.getElementById(elId);
  const total = pdSum(scope);
  const rows = pdGroup(scope, f=>pdVal(f,field)).sort((a,b)=>b.area-a.area);
  const blank = scope.filter(f=>!pdVal(f,field)).length;
  if(!rows.length){ el.innerHTML = `<div class="pd-empty">${escapeHtml(emptyMsg)}</div>`; return; }
  const max = rows[0].area;
  el.innerHTML = rows.map(r=>pdBarRow({name:r.key, valueText:`${usoFormatArea(r.area)} · ${pdFmtPct(total?r.area/total*100:0)} · ${pdFmtInt(r.n)}`, pct:max?r.area/max*100:0})).join("")
    + (blank ? `<div class="pd-note">${pdFmtInt(blank)} ${blank===1?"feição sem valor":"feições sem valor"} neste campo.</div>` : "");
}

function pdRenderYears(scope){
  const el = document.getElementById("pd-years"), note = document.getElementById("pd-years-note");
  const rows = pdGroup(scope, f=>pdVal(f,"AnoLei")).sort((a,b)=>Number(a.key)-Number(b.key));
  if(!rows.length){ el.innerHTML = `<div class="pd-empty">Sem valores de AnoLei.</div>`; note.textContent=""; return; }
  const max = Math.max(...rows.map(r=>r.n));
  const nowY = new Date().getFullYear();
  const odd = rows.filter(r=>Number(r.key)>nowY).map(r=>r.key);
  el.innerHTML = rows.map(r=>`<div class="pd-year" title="${pdAttr("AnoLei "+r.key+": "+r.n+" feições · "+usoFormatArea(r.area))}"><span class="pd-year-n">${pdFmtInt(r.n)}</span><div class="pd-year-bar" style="height:${Math.max(2,r.n/max*100)*0.68}%"></div><span>${escapeHtml(r.key)}</span></div>`).join("");
  note.textContent = odd.length ? `O valor ${odd.join(", ")} consta no campo AnoLei da base original e foi mantido como está.` : "";
}

function pdBuildZonaRows(scope){
  return pdGroup(scope, f=>(pdVal(f,"Zona")||"(sem zona)")+"||"+pdClassOf(f)).map(r=>{
    const f0 = r.feats[0];
    const leis = Array.from(new Set(r.feats.map(f=>pdVal(f,"Legislacao")).filter(Boolean)));
    return {key:r.key, zona:pdVal(f0,"Zona")||"(sem zona)", cls:pdClassOf(f0), leis, n:r.n, area:r.area, feats:r.feats};
  }).sort((a,b)=>b.area-a.area);
}

function pdRenderTable(scope){
  const q = pdNormalize(pdSearchText);
  let rows = pdBuildZonaRows(scope);
  pdLastRows = rows;
  if(q) rows = rows.filter(r=>pdNormalize([r.zona,r.cls,r.leis.join(" ")].join(" ")).indexOf(q)>=0);
  document.getElementById("pd-zonas-count").textContent = `${pdFmtInt(rows.length)} ${rows.length===1?"linha":"linhas"} (zona × classe)`;
  const body = document.getElementById("pd-table-body");
  if(!rows.length){ body.innerHTML = `<tr><td colspan="3" class="pd-empty">Nenhuma zona encontrada.</td></tr>`; return; }
  body.innerHTML = rows.map(r=>`<tr tabindex="0" data-key="${pdAttr(r.key)}" class="${pdActiveZonaKey===r.key?"uso-active":""}" title="${pdAttr(r.leis.join(" · ")||r.zona)}">
      <td>${escapeHtml(r.zona)}${r.n>1?` <span class="pd-hint">${pdFmtInt(r.n)} ${r.n===1?"feição":"feições"}</span>`:""}</td>
      <td><span class="pd-chip"><i style="background:${pdColor(r.cls)}"></i>${escapeHtml(pdSigla(r.cls))}</span></td>
      <td class="uso-num">${escapeHtml(usoFormatArea(r.area))}</td></tr>`).join("");
  body.querySelectorAll("tr[data-key]").forEach(tr=>{
    const go = ()=>pdFocusZona(tr.getAttribute("data-key"));
    tr.addEventListener("click", go);
    tr.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } });
  });
}

function pdRenderMeta(all){
  const fields = [["Categoria","Categoria"],["Tipo","Tipo"],["Ano","Ano"],["Elaboracao","Elaboração"],["Sistema__1","Sistema de referência"],["Fonte","Fonte"],["Contato","Contato"]];
  const html = fields.map(([k,label])=>{
    const rows = pdGroup(all, f=>pdVal(f,k)).sort((a,b)=>b.n-a.n);
    if(!rows.length) return "";
    const txt = rows.map(r=>`${escapeHtml(r.key)} <em>(${pdFmtInt(r.n)} de ${pdFmtInt(all.length)})</em>`).join("<br>");
    return `<div class="pd-meta-row"><div class="pd-meta-label">${escapeHtml(label)}</div><div class="pd-meta-val">${txt}</div></div>`;
  }).join("");
  document.getElementById("pd-meta").innerHTML = html || `<div class="pd-empty">Sem informações de metadados na base.</div>`;
}

function pdRenderBanner(all){
  const el = document.getElementById("pd-selection-banner");
  if(!pdSelectedClass){ el.style.display="none"; el.innerHTML=""; return; }
  const scope = pdScopeFeats(), total = pdSum(all), a = pdSum(scope);
  el.style.display = "flex";
  el.innerHTML = `<span>Filtro: <b>${escapeHtml(pdSelectedClass)}</b> — ${escapeHtml(usoFormatArea(a))} (${pdFmtPct(total?a/total*100:0)})</span>
    <span><button type="button" id="pd-zoom-selection">ver no mapa</button> <button type="button" id="pd-clear-inline">limpar filtro</button></span>`;
  document.getElementById("pd-clear-inline").addEventListener("click", pdClearSelection);
  document.getElementById("pd-zoom-selection").addEventListener("click", ()=>pdZoomTo(scope));
}

function pdUpdateOfflineBanner(){
  const el = document.getElementById("pd-offline-banner");
  const layer = LAYERS[PD_ID];
  if(el) el.style.display = (layer && map.hasLayer(layer.leaflet)) ? "none" : "block";
}

function pdRenderPanel(){
  const all = pdAllFeats(), scope = pdScopeFeats();
  pdRenderKPIs(all, scope);
  pdRenderBanner(all);
  pdRenderClasses(all);
  pdRenderGroupBars("pd-obj-bars", scope, "OBJ_Estrat", "Sem objetivos estratégicos informados.");
  pdRenderGroupBars("pd-leg-bars", scope, "Legislacao", "Sem legislação informada.");
  pdRenderYears(scope);
  pdRenderTable(scope);
  pdRenderMeta(all);
  pdUpdateOfflineBanner();
}

/* ---------- interação com o mapa ---------- */
function pdSelectClass(cls){
  pdSelectedClass = (pdSelectedClass===cls) ? null : cls;
  pdActiveZonaKey = null; pdClearHighlight();
  pdRestyleMap();
  pdRenderPanel();
}
function pdClearSelection(){
  pdSelectedClass = null; pdActiveZonaKey = null; pdClearHighlight();
  pdRestyleMap();
  pdRenderPanel();
}
function pdEnsureLayerOn(){
  const layer = LAYERS[PD_ID];
  if(layer && !map.hasLayer(layer.leaflet)) toggleLayer(PD_ID, true);
  pdUpdateOfflineBanner();
}
function pdClearHighlight(){
  if(pdHighlightTimer){ clearTimeout(pdHighlightTimer); pdHighlightTimer = null; }
  if(pdHighlightLayer){ if(map.hasLayer(pdHighlightLayer)) map.removeLayer(pdHighlightLayer); pdHighlightLayer = null; }
}
function pdZoomTo(feats, highlight){
  if(!feats || !feats.length) return;
  pdEnsureLayerOn();
  let b = null;
  try{ b = L.geoJSON({type:"FeatureCollection", features:feats}).getBounds(); }catch(err){}
  if(!b || !b.isValid()){ showToast("Não foi possível calcular a extensão desta seleção."); return; }
  const wide = window.innerWidth > 900;
  map.fitBounds(b, {paddingTopLeft:[40,76], paddingBottomRight:[wide ? Math.min(580, window.innerWidth*0.45) : 40, 40], maxZoom:17});
  if(highlight){
    pdClearHighlight();
    pdHighlightLayer = L.geoJSON({type:"FeatureCollection", features:feats}, {
      pane:"paneHighlight", interactive:false, style:{color:"#ffffff", weight:3, fill:false, opacity:.95, dashArray:"6,4"}
    }).addTo(map);
    pdHighlightTimer = setTimeout(pdClearHighlight, 7000);
  }
}
function pdFocusZona(key){
  const row = pdLastRows.find(r=>r.key===key);
  if(!row) return;
  const same = pdActiveZonaKey===key;
  pdActiveZonaKey = same ? null : key;
  if(same){ pdClearHighlight(); }
  else{ pdZoomTo(row.feats, true); }
  pdRenderTable(pdScopeFeats());
}

/* ---------- abrir / fechar / minimizar ---------- */
function pdOpenPanel(cls){
  const panel = document.getElementById("pd-panel");
  if(!panel) return;
  if(!panel.classList.contains("open")){
    if(document.getElementById("modal-dashboard-censo")?.classList.contains("open") && typeof closeCensoDashboard === "function") closeCensoDashboard();
    if(document.getElementById("uso-panel")?.classList.contains("open") && typeof usoClosePanel === "function") usoClosePanel();
    pdVisibilitySnapshot = {};
    Object.keys(LAYERS).forEach(id=>{ pdVisibilitySnapshot[id] = map.hasLayer(LAYERS[id].leaflet); });
    Object.keys(LAYERS).forEach(id=>{
      const layer = LAYERS[id];
      if(id === PD_ID){ if(!map.hasLayer(layer.leaflet)) layer.leaflet.addTo(map); }
      else if(map.hasLayer(layer.leaflet)) map.removeLayer(layer.leaflet);
    });
    renderLegend(); renderLayersPanel(); updateLayersBadge(); updateToolbarStates();
  }
  if(typeof cls==="string" && cls) pdSelectedClass = cls;
  panel.classList.add("open");
  panel.classList.remove("uso-minimized");
  const mb = document.getElementById("pd-minimize-btn"); if(mb) mb.innerHTML = "&#8722;";
  pdEnsureLayerOn(); pdRestyleMap(); pdRenderPanel(); map.closePopup();
}
function pdClosePanel(){
  const panel = document.getElementById("pd-panel");
  if(!panel) return;
  if(panel.classList.contains("open") && pdVisibilitySnapshot){
    Object.keys(LAYERS).forEach(id=>{
      const layer = LAYERS[id]; const shouldBeVisible = pdVisibilitySnapshot[id] === true; const isVisible = map.hasLayer(layer.leaflet);
      if(shouldBeVisible && !isVisible) layer.leaflet.addTo(map);
      else if(!shouldBeVisible && isVisible) map.removeLayer(layer.leaflet);
    });
    pdVisibilitySnapshot = null; renderLegend(); renderLayersPanel(); updateLayersBadge(); updateToolbarStates();
  }
  panel.classList.remove("open");
  pdSelectedClass = null; pdActiveZonaKey = null; pdSearchText = "";
  const s = document.getElementById("pd-search"); if(s) s.value = "";
  pdClearHighlight(); pdRestyleMap();
}

/* ---------- exportação (da seleção atual) ---------- */
function pdDownload(content, filename, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function pdExport(format){
  const rows = pdBuildZonaRows(pdScopeFeats());
  const suffix = pdSelectedClass ? "_" + pdNormalize(pdSigla(pdSelectedClass)).replace(/[^a-z0-9]+/g,"_") : "";
  if(format==="csv"){
    const q = v => `"${String(v).replace(/"/g,'""')}"`;
    let csv = "\uFEFFZona;Classe_de_zoneamento;Legislacao;Feicoes;Area_m2;Area_formatada\n";
    rows.forEach(r=>{ csv += [q(r.zona),q(r.cls),q(r.leis.join(" | ")),r.n,r.area.toFixed(2),q(usoFormatArea(r.area))].join(";")+"\n"; });
    pdDownload(csv, `plano_diretor_2022_zonas${suffix}.csv`, "text/csv;charset=utf-8;");
  }else{
    const json = JSON.stringify(rows.map(r=>({zona:r.zona, classe_de_zoneamento:r.cls, legislacao:r.leis, feicoes:r.n, area_m2:Number(r.area.toFixed(2)), area_formatada:usoFormatArea(r.area)})), null, 2);
    pdDownload(json, `plano_diretor_2022_zonas${suffix}.json`, "application/json;charset=utf-8;");
  }
}

/* ---------- eventos ---------- */
(function pdInitEvents(){
  const $ = id => document.getElementById(id);
  if(!$("pd-panel")) return;
  $("pd-close-btn").addEventListener("click", pdClosePanel);
  $("pd-minimize-btn").addEventListener("click", ()=>{
    const min = $("pd-panel").classList.toggle("uso-minimized");
    $("pd-minimize-btn").innerHTML = min ? "&#9633;" : "&#8722;";
  });
  $("pd-clear-filter").addEventListener("click", pdClearSelection);
  $("pd-filter-select").addEventListener("change", e=>{
    pdSelectedClass = e.target.value || null; pdActiveZonaKey = null; pdClearHighlight();
    pdRestyleMap(); pdRenderPanel();
  });
  $("pd-search").addEventListener("input", e=>{ pdSearchText = e.target.value; pdRenderTable(pdScopeFeats()); });
  $("pd-enable-layer").addEventListener("click", pdEnsureLayerOn);
  $("pd-open-table").addEventListener("click", ()=>{ if(typeof openAttributeTable==="function") openAttributeTable(PD_ID); });
  $("pd-export-csv").addEventListener("click", ()=>pdExport("csv"));
  $("pd-export-json").addEventListener("click", ()=>pdExport("json"));
  map.on("layeradd layerremove", e=>{
    if(LAYERS[PD_ID] && e.layer===LAYERS[PD_ID].leaflet && $("pd-panel").classList.contains("open")) pdUpdateOfflineBanner();
  });
})();

/* ---- Arrastar (cabeçalho) e redimensionar (bordas/cantos) — mesmo comportamento dos demais painéis.
   O ajuste à tela só ocorre com o painel visível e nunca o deixa sob a barra superior. ---- */
(function pdInitFloating(){
  const box = document.getElementById("pd-panel");
  if(!box) return;
  const minW = ()=>Math.min(320, window.innerWidth*0.92);
  const minH = ()=>Math.min(200, window.innerHeight*0.5);
  function topLimit(){
    const tb = document.getElementById("topbar");
    return tb ? Math.ceil(tb.getBoundingClientRect().bottom)+8 : 66;
  }
  // Em telas estreitas (≤560px) o CSS fixa o painel em left/right com largura automática:
  // mover/redimensionar por script (right:auto) o deixaria com largura do conteúdo.
  const isNarrow = ()=>window.innerWidth<=560;
  function clampToViewport(){
    if(isNarrow()) return;
    if(box.offsetWidth===0 || box.offsetHeight===0) return;
    if(box.classList.contains("uso-minimized")) return;
    const vw = window.innerWidth, vh = window.innerHeight, t0 = topLimit();
    const r = box.getBoundingClientRect();
    const w = Math.min(Math.max(r.width,minW()), vw-8), h = Math.min(Math.max(r.height,minH()), vh-t0-4);
    const left = Math.min(Math.max(r.left,4), Math.max(4,vw-w-4));
    const top = Math.min(Math.max(r.top,t0), Math.max(t0,vh-h-4));
    box.style.width = w+"px"; box.style.height = h+"px"; box.style.left = left+"px"; box.style.top = top+"px"; box.style.right = "auto";
  }
  function resetGeom(){
    ["top","right","left","width","height"].forEach(k=>box.style[k]="");
    box.classList.remove("uso-minimized");
    const mb = document.getElementById("pd-minimize-btn"); if(mb) mb.innerHTML = "&#8722;";
  }
  document.getElementById("pd-reset-size").addEventListener("click", resetGeom);

  box.querySelectorAll(".uso-rz").forEach(handle=>{
    handle.addEventListener("pointerdown", e=>{
      if(box.classList.contains("uso-minimized") || isNarrow()) return;
      e.preventDefault(); e.stopPropagation();
      const dir = handle.getAttribute("data-rz");
      const sx = e.clientX, sy = e.clientY, r = box.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight, t0 = topLimit();
      box.classList.add("uso-resizing"); document.body.style.userSelect = "none";
      try{ handle.setPointerCapture(e.pointerId); }catch(err){}
      function onMove(ev){
        const dx = ev.clientX-sx, dy = ev.clientY-sy;
        let w = r.width, h = r.height, left = r.left, top = r.top;
        if(dir.indexOf("e")>=0) w = Math.min(Math.max(r.width+dx,minW()), vw-8);
        if(dir.indexOf("s")>=0) h = Math.min(Math.max(r.height+dy,minH()), vh-t0-4);
        if(dir.indexOf("w")>=0){ w = Math.min(Math.max(r.width-dx,minW()), vw-8); left = r.left+(r.width-w); }
        if(dir.indexOf("n")>=0){ h = Math.min(Math.max(r.height-dy,minH()), vh-t0-4); top = r.top+(r.height-h); }
        left = Math.min(Math.max(left,4), vw-w-4);
        top = Math.min(Math.max(top,t0), Math.max(t0,vh-h-4));
        box.style.width = w+"px"; box.style.height = h+"px"; box.style.left = left+"px"; box.style.top = top+"px"; box.style.right = "auto";
      }
      function onUp(){
        box.classList.remove("uso-resizing"); document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, {once:true});
    });
  });

  const head = document.getElementById("pd-head");
  head.addEventListener("pointerdown", e=>{
    if(e.target.closest("button") || isNarrow()) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, r = box.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, t0 = topLimit();
    box.classList.add("uso-resizing"); document.body.style.userSelect = "none";
    try{ head.setPointerCapture(e.pointerId); }catch(err){}
    function onMove(ev){
      const b = box.getBoundingClientRect();
      const left = Math.min(Math.max(r.left+ev.clientX-sx,4), vw-b.width-4);
      const top = Math.min(Math.max(r.top+ev.clientY-sy,t0), Math.max(t0,vh-b.height-4));
      box.style.left = left+"px"; box.style.top = top+"px"; box.style.right = "auto";
    }
    function onUp(){
      box.classList.remove("uso-resizing"); document.body.style.userSelect = "";
      document.removeEventListener("pointermove", onMove);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, {once:true});
  });
  head.addEventListener("dblclick", e=>{ if(!e.target.closest("button")) resetGeom(); });
  window.addEventListener("resize", clampToViewport);
  new MutationObserver(()=>{ if(box.classList.contains("open")) requestAnimationFrame(clampToViewport); })
    .observe(box, {attributes:true, attributeFilter:["class"]});
})();
