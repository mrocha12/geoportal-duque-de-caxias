/* ============================================================
   uso-ocupacao.js - Painel e funcionalidades de Uso e Ocupação do Solo
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= PAINEL USO E OCUPAÇÃO DO SOLO — lógica ================= */
let usoLastStats = null;

function usoFmtPct(p){
  return (p||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
}
function usoEscapeAttr(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;");
}
function usoEscapeHtml(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function usoComputeStats(){
  const feats = (DATA_USO_OCUPACAO && DATA_USO_OCUPACAO.features) || [];
  const byClass = {};
  let total = 0;
  feats.forEach(f=>{
    const p = f.properties || {};
    const classe = (p.Classe===undefined || p.Classe===null || p.Classe==="") ? "Sem classe" : String(p.Classe);
    const area = Number(p.Shape_Area) || 0;
    byClass[classe] = (byClass[classe]||0) + area;
    total += area;
  });
  let rows = Object.keys(byClass).map(classe=>({
    classe: classe,
    area: byClass[classe],
    pct: total>0 ? (byClass[classe]/total*100) : 0
  }));
  rows.sort((a,b)=>b.area-a.area);
  const builtArea = rows.filter(r=>usoNormalize(r.classe).indexOf("constru")>=0).reduce((s,r)=>s+r.area,0);
  const vegArea = rows.filter(r=>usoNormalize(r.classe).indexOf("veget")>=0).reduce((s,r)=>s+r.area,0);
  return {
    rows: rows,
    total: total,
    n: rows.length,
    maxRow: rows.length ? rows[0] : null,
    builtArea: builtArea,
    vegArea: vegArea
  };
}

function usoRenderKPIs(stats){
  const grid = document.getElementById("uso-kpi-grid");
  if(!grid) return;
  const cards = [
    {label:"Área total mapeada", value: usoFormatArea(stats.total), sub:""},
    {label:"Número de classes", value: stats.n, sub:""},
    {label:"Maior classe", value: stats.maxRow ? stats.maxRow.classe : "-", sub: stats.maxRow ? usoFormatArea(stats.maxRow.area) : ""},
    {label:"% da maior classe", value: stats.maxRow ? usoFmtPct(stats.maxRow.pct) : "-", sub:""},
    {label:"Área construída", value: usoFormatArea(stats.builtArea), sub: (stats.total? usoFmtPct(stats.builtArea/stats.total*100):"0,0%")+" do total"},
    {label:"Área de vegetação", value: usoFormatArea(stats.vegArea), sub: (stats.total? usoFmtPct(stats.vegArea/stats.total*100):"0,0%")+" do total"}
  ];
  grid.innerHTML = cards.map(c=>`<div class="uso-kpi-card"><div class="uso-kpi-label">${usoEscapeHtml(c.label)}</div><div class="uso-kpi-value" title="${usoEscapeAttr(c.value)}">${usoEscapeHtml(String(c.value))}</div>${c.sub?`<div class="uso-kpi-sub">${usoEscapeHtml(c.sub)}</div>`:""}</div>`).join("");
}

function usoBuildDonut(stats){
  const svg = document.getElementById("uso-donut");
  if(!svg) return;
  const r=70, cx=100, cy=100, strokeW=32;
  const circumference = 2*Math.PI*r;
  let offset=0;
  let html = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(130,130,130,.18)" stroke-width="${strokeW}"></circle>`;
  stats.rows.forEach(row=>{
    const frac = stats.total>0 ? row.area/stats.total : 0;
    const dash = Math.max(frac*circumference, frac>0 ? 0.6 : 0);
    const gap = circumference-dash;
    const isActive = usoSelectedClass===row.classe;
    const dimmed = usoSelectedClass && !isActive;
    const color = usoColor(row.classe);
    html += `<circle class="uso-donut-seg" data-classe="${usoEscapeAttr(row.classe)}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${isActive?strokeW+6:strokeW}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" opacity="${dimmed?0.35:1}" style="cursor:pointer;"></circle>`;
    offset += dash;
  });
  html += `<text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--panel-text)">${stats.n}</text>`;
  html += `<text x="${cx}" y="${cy+13}" text-anchor="middle" font-size="9" fill="var(--muted-text)">classes</text>`;
  svg.innerHTML = html;
  svg.querySelectorAll(".uso-donut-seg").forEach(seg=>{
    seg.addEventListener("click", ()=> usoSelectClass(seg.getAttribute("data-classe")));
    seg.addEventListener("mousemove", e=>usoShowDonutTooltip(e, seg.getAttribute("data-classe")));
    seg.addEventListener("mouseleave", usoHideDonutTooltip);
  });
}
function usoShowDonutTooltip(e, classe){
  const tip = document.getElementById("uso-donut-tooltip");
  const row = usoLastStats ? usoLastStats.rows.find(r=>r.classe===classe) : null;
  if(!tip || !row) return;
  tip.innerHTML = `<b>${usoEscapeHtml(classe)}</b><br>${usoEscapeHtml(usoFormatArea(row.area))} · ${usoEscapeHtml(usoFmtPct(row.pct))}`;
  tip.style.display = "block";
  const wrap = tip.parentElement.getBoundingClientRect();
  tip.style.left = Math.max(0, e.clientX - wrap.left + 12) + "px";
  tip.style.top = Math.max(0, e.clientY - wrap.top + 12) + "px";
}
function usoHideDonutTooltip(){
  const tip = document.getElementById("uso-donut-tooltip");
  if(tip) tip.style.display = "none";
}

function usoRenderLegend(stats){
  const el = document.getElementById("uso-legend");
  if(!el) return;
  el.innerHTML = stats.rows.map(row=>{
    const active = usoSelectedClass===row.classe;
    return `<div class="uso-legend-item ${active?"uso-active":""}" data-classe="${usoEscapeAttr(row.classe)}">
      <span class="uso-legend-swatch" style="background:${usoColor(row.classe)}"></span>
      <span class="uso-legend-name" title="${usoEscapeAttr(row.classe)}">${usoEscapeHtml(row.classe)}</span>
      <span class="uso-legend-pct">${usoFmtPct(row.pct)}</span>
    </div>`;
  }).join("");
  el.querySelectorAll("[data-classe]").forEach(item=>{
    item.addEventListener("click", ()=> usoSelectClass(item.getAttribute("data-classe")));
  });
}

function usoRenderTable(stats){
  const body = document.getElementById("uso-table-body");
  if(!body) return;
  body.innerHTML = stats.rows.map(row=>{
    const active = usoSelectedClass===row.classe;
    return `<tr class="${active?"uso-active":""}" data-classe="${usoEscapeAttr(row.classe)}">
      <td><span class="uso-legend-swatch" style="background:${usoColor(row.classe)};display:inline-block;margin-right:6px;vertical-align:middle;"></span>${usoEscapeHtml(row.classe)}</td>
      <td class="uso-num">${usoEscapeHtml(usoFormatArea(row.area))}</td>
      <td class="uso-num">${usoFmtPct(row.pct)}</td>
    </tr>`;
  }).join("");
  body.querySelectorAll("tr[data-classe]").forEach(row=>{
    row.addEventListener("click", ()=> usoSelectClass(row.getAttribute("data-classe")));
  });
}

function usoRenderFilterSelect(stats){
  const sel = document.getElementById("uso-filter-select");
  if(!sel) return;
  const current = usoSelectedClass || "";
  sel.innerHTML = `<option value="">Mostrar todas</option>` + stats.rows.map(row=>`<option value="${usoEscapeAttr(row.classe)}" ${row.classe===current?"selected":""}>${usoEscapeHtml(row.classe)}</option>`).join("");
}

function usoRenderSelectionBanner(stats){
  const el = document.getElementById("uso-selection-banner");
  if(!el) return;
  if(!usoSelectedClass){ el.style.display="none"; el.innerHTML=""; return; }
  const row = stats.rows.find(r=>r.classe===usoSelectedClass);
  if(!row){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="flex";
  el.innerHTML = `<span>Selecionado: <b>${usoEscapeHtml(row.classe)}</b> — ${usoEscapeHtml(usoFormatArea(row.area))} (${usoFmtPct(row.pct)})</span><button id="uso-clear-selection-inline">limpar seleção</button>`;
  const btn = document.getElementById("uso-clear-selection-inline");
  if(btn) btn.addEventListener("click", usoClearSelection);
}

function usoUpdateOfflineBanner(){
  const el = document.getElementById("uso-offline-banner");
  if(!el) return;
  const layer = LAYERS["uso_ocupacao"];
  const on = layer && map.hasLayer(layer.leaflet);
  el.style.display = on ? "none" : "block";
}

function usoRenderPanel(){
  const stats = usoComputeStats();
  usoLastStats = stats;
  usoRenderKPIs(stats);
  usoBuildDonut(stats);
  usoRenderLegend(stats);
  usoRenderTable(stats);
  usoRenderFilterSelect(stats);
  usoRenderSelectionBanner(stats);
  usoUpdateOfflineBanner();
}

let usoVisibilitySnapshot = null;

function usoOpenPanel(){
  const panel = document.getElementById("uso-panel");
  if(!panel) return;

  // Captura o estado original apenas na primeira abertura, evitando
  // sobrescrever o estado que deverá ser restaurado ao fechar o painel.
  if(!panel.classList.contains("open")){
    usoVisibilitySnapshot = {};
    Object.keys(LAYERS).forEach(id=>{
      usoVisibilitySnapshot[id] = map.hasLayer(LAYERS[id].leaflet);
    });

    // Torna a camada de Uso e Ocupação visível e oculta temporariamente
    // todas as demais camadas, sem removê-las nem criar uma nova instância.
    Object.keys(LAYERS).forEach(id=>{
      const layer = LAYERS[id];
      if(id === "uso_ocupacao"){
        if(!map.hasLayer(layer.leaflet)) layer.leaflet.addTo(map);
      }else{
        if(map.hasLayer(layer.leaflet)) map.removeLayer(layer.leaflet);
      }
    });

    renderLegend();
    renderLayersPanel();
    updateLayersBadge();
    updateToolbarStates();
  }

  panel.classList.add("open");
  panel.classList.remove("uso-minimized");
  usoRenderPanel();
}

function usoClosePanel(){
  const panel = document.getElementById("uso-panel");
  if(!panel) return;

  // Restaura exatamente a visibilidade existente antes da abertura.
  if(panel.classList.contains("open") && usoVisibilitySnapshot){
    Object.keys(LAYERS).forEach(id=>{
      const layer = LAYERS[id];
      const shouldBeVisible = usoVisibilitySnapshot[id] === true;
      const isVisible = map.hasLayer(layer.leaflet);

      if(shouldBeVisible && !isVisible){
        layer.leaflet.addTo(map);
      }else if(!shouldBeVisible && isVisible){
        map.removeLayer(layer.leaflet);
      }
    });

    usoVisibilitySnapshot = null;
    renderLegend();
    renderLayersPanel();
    updateLayersBadge();
    updateToolbarStates();
  }

  panel.classList.remove("open");
}
function usoToggleMinimize(){
  const panel = document.getElementById("uso-panel");
  const btn = document.getElementById("uso-minimize-btn");
  if(!panel) return;
  const minimized = panel.classList.toggle("uso-minimized");
  if(btn) btn.innerHTML = minimized ? "&#9633;" : "&#8722;";
}

function usoDownload(content, filename, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function usoExportData(format){
  const stats = usoLastStats || usoComputeStats();
  if(format==="csv"){
    let csv = "Classe;Area_m2;Area_formatada;Percentual\n";
    stats.rows.forEach(r=>{
      const classeCsv = String(r.classe).replace(/"/g,'""');
      csv += `"${classeCsv}";${r.area.toFixed(2)};"${usoFormatArea(r.area)}";${r.pct.toFixed(2)}\n`;
    });
    usoDownload(csv, "uso_ocupacao_do_solo.csv", "text/csv;charset=utf-8;");
  } else {
    const json = JSON.stringify(stats.rows.map(r=>({classe:r.classe, area_m2:r.area, area_formatada:usoFormatArea(r.area), percentual:Number(r.pct.toFixed(2))})), null, 2);
    usoDownload(json, "uso_ocupacao_do_solo.json", "application/json;charset=utf-8;");
  }
}

(function usoInitPanelEvents(){
  const filterSel = document.getElementById("uso-filter-select");
  if(filterSel) filterSel.addEventListener("change", e=>{
    const val = e.target.value;
    usoSelectedClass = val || null;
    usoRestyleMap();
    usoRenderPanel();
  });
  const clearBtn = document.getElementById("uso-clear-filter");
  if(clearBtn) clearBtn.addEventListener("click", usoClearSelection);
  const exportCsvBtn = document.getElementById("uso-export-csv");
  if(exportCsvBtn) exportCsvBtn.addEventListener("click", ()=>usoExportData("csv"));
  const exportJsonBtn = document.getElementById("uso-export-json");
  if(exportJsonBtn) exportJsonBtn.addEventListener("click", ()=>usoExportData("json"));
  const closeBtn = document.getElementById("uso-close-btn");
  if(closeBtn) closeBtn.addEventListener("click", usoClosePanel);
  const minBtn = document.getElementById("uso-minimize-btn");
  if(minBtn) minBtn.addEventListener("click", usoToggleMinimize);
})();

/* ---- Arrastar (cabeçalho) e redimensionar (bordas/cantos) do painel Uso e Ocupação do Solo ---- */
(function(){
  const box = document.getElementById("uso-panel");
  if(!box) return;
  function minW(){ return Math.min(300, window.innerWidth * 0.92); }
  function minH(){ return Math.min(180, window.innerHeight * 0.5); }

  function clampToViewport(){
    if(box.offsetWidth === 0 || box.offsetHeight === 0) return; // oculto: não mede 0×0
    if(window.innerWidth <= 560) return; // telas estreitas: posição/largura definidas pelo CSS
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = box.getBoundingClientRect();
    let w = Math.min(r.width, vw - 8);
    let h = Math.min(r.height, vh - 8);
    let left = r.left, top = r.top;
    left = Math.min(Math.max(left, 4), Math.max(4, vw - w - 4));
    top = Math.min(Math.max(top, 4), Math.max(4, vh - h - 4));
    box.style.left = left + "px";
    box.style.top = top + "px";
    box.style.right = "auto";
  }

  // Restaura o painel ao tamanho e posição padrão definidos em CSS (.uso-panel),
  // limpando qualquer ajuste manual de arrastar/redimensionar e desminimizando.
  function resetGeom(){
    box.style.top = "";
    box.style.right = "";
    box.style.left = "";
    box.style.width = "";
    box.style.height = "";
    box.classList.remove("uso-minimized");
    const minBtn = document.getElementById("uso-minimize-btn");
    if(minBtn) minBtn.innerHTML = "&#8722;";
  }
  const resetBtn = document.getElementById("uso-reset-size");
  if(resetBtn) resetBtn.addEventListener("click", resetGeom);

  box.querySelectorAll(".uso-rz").forEach(handle=>{
    handle.addEventListener("pointerdown", e=>{
      if(box.classList.contains("uso-minimized")) return;
      e.preventDefault();
      e.stopPropagation();
      const dir = handle.getAttribute("data-rz");
      const startX = e.clientX, startY = e.clientY;
      const r = box.getBoundingClientRect();
      const startW = r.width, startH = r.height, startLeft = r.left, startTop = r.top;
      const vw = window.innerWidth, vh = window.innerHeight;
      const maxW = vw - 8, maxH = vh - 8;
      const mnW = minW(), mnH = minH();
      box.classList.add("uso-resizing");
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
        top = Math.min(Math.max(top, 4), vh - h - 4);
        box.style.width = w + "px";
        box.style.height = h + "px";
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.right = "auto";
      }
      function onUp(){
        box.classList.remove("uso-resizing");
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, {once:true});
    });
  });

  const head = document.getElementById("uso-head");
  if(head){
    head.addEventListener("pointerdown", e=>{
      if(e.target.closest("button")) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const r = box.getBoundingClientRect();
      const startLeft = r.left, startTop = r.top;
      const vw = window.innerWidth, vh = window.innerHeight;
      box.classList.add("uso-resizing");
      document.body.style.userSelect = "none";
      try{ head.setPointerCapture(e.pointerId); }catch(err){}

      function onMove(ev){
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        const w = box.getBoundingClientRect().width, h = box.getBoundingClientRect().height;
        let left = Math.min(Math.max(startLeft + dx, 4), vw - w - 4);
        let top = Math.min(Math.max(startTop + dy, 4), vh - h - 4);
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.right = "auto";
      }
      function onUp(){
        box.classList.remove("uso-resizing");
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, {once:true});
    });
  }
  window.addEventListener("resize", clampToViewport);
})();