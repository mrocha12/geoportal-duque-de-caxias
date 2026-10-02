/* ============================================================
   dashboard.js - Funcionalidades do Dashboard de Setores Censitários
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= DASHBOARD PANEL — REDIMENSIONÁVEL (arrastar bordas/cantos) ================= */
(function(){
  const box = document.getElementById("dsh-modal-box");
  if(!box) return;
  const overlay = document.getElementById("modal-dashboard-censo");
  const GEOM_KEY = "dshDashboardGeom";
  // Mínimos acompanham o CSS (min(540px,92vw) / min(380px,80vh)) para não estourar em telas pequenas.
  function minW(){ return Math.min(540, window.innerWidth * 0.92); }
  function minH(){ return Math.min(380, window.innerHeight * 0.80); }

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
    head.style.cursor = "move";
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

  const resetBtn = document.getElementById("dsh-reset-size");
  if(resetBtn) resetBtn.addEventListener("click", resetGeom);

  window.addEventListener("resize", clampToViewport);

  /* ---- Acessibilidade: dialog ARIA, foco ao abrir/fechar, Esc fecha, Tab preso no painel ---- */
  if(overlay){
    let lastFocused = null;
    new MutationObserver(()=>{
      if(overlay.classList.contains("open")){
        lastFocused = document.activeElement;
        requestAnimationFrame(()=>box.focus());
      } else if(lastFocused && document.body.contains(lastFocused)){
        lastFocused.focus();
        lastFocused = null;
      }
    }).observe(overlay, {attributes:true, attributeFilter:["class"]});

    document.addEventListener("keydown", e=>{
      if(!overlay.classList.contains("open")) return;
      if(e.key === "Escape"){
        if(typeof closeCensoDashboard==="function") closeCensoDashboard();
        else closeModal("modal-dashboard-censo");
        return;
      }
      if(e.key === "Tab"){
        const focusable = Array.from(box.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
          .filter(el => el.offsetParent !== null && !el.disabled);
        if(focusable.length === 0) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if(e.shiftKey){
          if(document.activeElement === first || document.activeElement === box){ e.preventDefault(); last.focus(); }
        } else if(document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
  }
})();

/* ================= DASHBOARD — SETORES CENSITÁRIOS (POP. 2022) =================
   Todos os indicadores abaixo são calculados dinamicamente a partir das feições
   atualmente carregadas na camada "censo" (campo V0001 = população residente,
   conforme IBGE). Nenhum dado é inventado ou alterado: apenas leitura e agregação
   dos valores já existentes em DATA_CENSO / LAYERS.censo. */
function computeCensoStats(){
  const feats = layerFeatureList("censo");
  const n = feats.length;
  const pops = feats.map(f=> f.properties.V0001 || 0);
  const total = pops.reduce((a,b)=>a+b, 0);
  const avg = n ? total/n : 0;

  const sorted = pops.slice().sort((a,b)=>a-b);
  const median = n ? (n%2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2) : 0;

  let maxFeat=null, minFeat=null;
  feats.forEach(f=>{
    const v = f.properties.V0001||0;
    if(!maxFeat || v>(maxFeat.properties.V0001||0)) maxFeat=f;
    if(!minFeat || v<(minFeat.properties.V0001||0)) minFeat=f;
  });
  const zeroCount = pops.filter(v=>v===0).length;
  const minNonZero = sorted.find(v=>v>0);

  // Faixas: reaproveita os mesmos limiares/cores já usados no mapa (CENSO_BREAKS/CENSO_COLORS),
  // garantindo consistência entre a legenda do mapa e o dashboard.
  const faixas = CENSO_COLORS.map((color,i)=>({i, color, label:censoRangeLabel(i), count:0, pop:0}));
  feats.forEach(f=>{
    const v = f.properties.V0001||0;
    const idx = censoRangeIndex(v);
    faixas[idx].count++;
    faixas[idx].pop += v;
  });

  // Situação (Urbana / Rural) — único outro campo categórico disponível na camada.
  const situacaoMap = {};
  feats.forEach(f=>{
    const s = f.properties.SITUACAO || "Não informado";
    if(!situacaoMap[s]) situacaoMap[s] = {count:0, pop:0};
    situacaoMap[s].count++;
    situacaoMap[s].pop += (f.properties.V0001||0);
  });

  const top5 = feats.slice().sort((a,b)=>(b.properties.V0001||0)-(a.properties.V0001||0)).slice(0,5);

  return {n, total, avg, median, maxFeat, minFeat, zeroCount, minNonZero, faixas, situacaoMap, top5};
}

function renderCensoDashboard(){
  const s = computeCensoStats();
  const fmt = n => Math.round(n||0).toLocaleString("pt-BR");
  const fmt1 = n => (n||0).toLocaleString("pt-BR",{maximumFractionDigits:1, minimumFractionDigits:1});
  const situColors = {"Urbana":"#2196d8","Rural":"#6fbf73"};
  const situOrder = Object.keys(s.situacaoMap).sort((a,b)=> s.situacaoMap[b].pop - s.situacaoMap[a].pop);

  const html = `
    <div class="dsh-note">Indicadores calculados dinamicamente a partir dos ${fmt(s.n)} setores censitários carregados na camada (Censo IBGE 2022 — campo <b>V0001</b> = população residente). Clique em um ou mais setores no mapa para selecioná-los.</div>
    <div class="dsh-selection-banner" id="dsh-selection-banner" style="display:none;"></div>
    <div class="dsh-kpi-grid">
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(59,130,246,.15);color:#3b82f6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="dsh-kpi-label">População total</div></div><div class="dsh-kpi-value">${fmt(s.total)}</div><div class="dsh-kpi-sub">soma de V0001</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(139,92,246,.15);color:#8b5cf6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span><div class="dsh-kpi-label">Setores censitários</div></div><div class="dsh-kpi-value">${fmt(s.n)}</div><div class="dsh-kpi-sub">total de feições</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(20,184,166,.15);color:#14b8a6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="3 3"/><path d="M6 20V14"/><path d="M12 20V8"/><path d="M18 20V16"/></svg></span><div class="dsh-kpi-label">Média por setor</div></div><div class="dsh-kpi-value">${fmt(s.avg)}</div><div class="dsh-kpi-sub">habitantes / setor</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(6,182,212,.15);color:#06b6d4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="7" y2="12"/><rect x="7" y="7" width="10" height="10" rx="1"/><line x1="12" y1="7" x2="12" y2="17"/><line x1="17" y1="12" x2="20" y2="12"/></svg></span><div class="dsh-kpi-label">Mediana por setor</div></div><div class="dsh-kpi-value">${fmt(s.median)}</div><div class="dsh-kpi-sub">habitantes / setor</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(34,197,94,.15);color:#22c55e"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></span><div class="dsh-kpi-label">Maior população</div></div><div class="dsh-kpi-value">${fmt(s.maxFeat ? s.maxFeat.properties.V0001 : 0)}</div><div class="dsh-kpi-sub">setor ${s.maxFeat ? s.maxFeat.properties.CD_SETOR : "-"}</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(239,68,68,.15);color:#ef4444"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg></span><div class="dsh-kpi-label">Menor população</div></div><div class="dsh-kpi-value">${fmt(s.minFeat ? s.minFeat.properties.V0001 : 0)}</div><div class="dsh-kpi-sub">setor ${s.minFeat ? s.minFeat.properties.CD_SETOR : "-"}</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(100,116,139,.15);color:#64748b"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/></svg></span><div class="dsh-kpi-label">Setores com pop. zero</div></div><div class="dsh-kpi-value">${fmt(s.zeroCount)}</div><div class="dsh-kpi-sub">${s.n? fmt1(s.zeroCount/s.n*100):"0,0"}% do total (não residenciais)</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(99,102,241,.15);color:#6366f1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg></span><div class="dsh-kpi-label">Menor pop. (excl. zero)</div></div><div class="dsh-kpi-value">${s.minNonZero!==undefined ? fmt(s.minNonZero) : "-"}</div><div class="dsh-kpi-sub">menor setor com população &gt; 0</div></div>
    </div>

    <div class="dsh-cols">
      <div>
        <div class="dsh-section-title">Distribuição por faixa de população</div>
        <div id="dsh-faixas"></div>
      </div>
      <div>
        <div class="dsh-section-title">Por situação do setor</div>
        <div id="dsh-situacao"></div>
      </div>
    </div>

    <div>
      <div class="dsh-section-title">Top 5 setores por população</div>
      <div class="dsh-table-wrap">
      <table class="dsh-table" id="dsh-top5">
        <thead><tr><th>#</th><th>Setor (CD_SETOR)</th><th>Situação</th><th>População</th><th>% do total</th></tr></thead>
        <tbody>
          ${s.top5.map((f,i)=>`<tr data-cd="${f.properties.CD_SETOR}"><td class="dsh-rank">${i+1}</td><td>${f.properties.CD_SETOR}</td><td>${f.properties.SITUACAO||"-"}</td><td>${fmt(f.properties.V0001)}</td><td>${s.total? fmt1((f.properties.V0001||0)/s.total*100):"0,0"}%</td></tr>`).join("")}
        </tbody>
      </table>
      </div>
    </div>
  `;

  const body = document.getElementById("dsh-body");
  body.innerHTML = html;
  censoRenderSelectionBanner();

  const faixasWrap = document.getElementById("dsh-faixas");
  const maxFaixaPop = Math.max(1, ...s.faixas.map(f=>f.pop));
  faixasWrap.innerHTML = s.faixas.map(f=>{
    const pct = s.total ? (f.pop/s.total*100) : 0;
    const width = (f.pop/maxFaixaPop*100);
    const active = highlightedCensoRange===f.i;
    return `<div class="dsh-bar-row${active?" dsh-active":""}" data-censo-range="${f.i}">
      <div class="dsh-bar-swatch" style="background:${f.color};"></div>
      <div class="dsh-bar-label">${f.label}</div>
      <div class="dsh-bar-track"><div class="dsh-bar-fill" style="width:${width}%;background:${f.color};"></div></div>
      <div class="dsh-bar-val">${fmt(f.count)} setores · ${fmt1(pct)}%</div>
    </div>`;
  }).join("");
  faixasWrap.querySelectorAll("[data-censo-range]").forEach(row=>{
    row.addEventListener("click",()=>{
      const idx = parseInt(row.getAttribute("data-censo-range"),10);
      filterCensoRange(idx);
      faixasWrap.querySelectorAll(".dsh-bar-row").forEach(r=>r.classList.remove("dsh-active"));
      if(highlightedCensoRange===idx) row.classList.add("dsh-active");
      showToast("Setores em destaque no mapa pela faixa selecionada.");
    });
  });

  const situWrap = document.getElementById("dsh-situacao");
  const maxSituPop = Math.max(1, ...situOrder.map(k=>s.situacaoMap[k].pop));
  situWrap.innerHTML = situOrder.map(k=>{
    const d = s.situacaoMap[k];
    const pct = s.total ? (d.pop/s.total*100) : 0;
    const width = (d.pop/maxSituPop*100);
    const color = situColors[k] || "#8d6bc4";
    return `<div class="dsh-bar-row">
      <div class="dsh-bar-swatch" style="background:${color};"></div>
      <div class="dsh-bar-label">${k}</div>
      <div class="dsh-bar-track"><div class="dsh-bar-fill" style="width:${width}%;background:${color};"></div></div>
      <div class="dsh-bar-val">${fmt(d.count)} setores · ${fmt1(pct)}%</div>
    </div>`;
  }).join("");

  document.querySelectorAll("#dsh-top5 tbody tr[data-cd]").forEach(tr=>{
    tr.addEventListener("click",()=>{
      const cd = tr.getAttribute("data-cd");
      const f = layerFeatureList("censo").find(ft=>ft.properties.CD_SETOR===cd);
      if(!f) return;
      closeCensoDashboard();
      if(!map.hasLayer(LAYERS.censo.leaflet)) toggleLayer("censo", true);
      const temp = L.geoJSON(f);
      map.fitBounds(temp.getBounds(),{padding:[40,40]});
      LAYERS.censo.leaflet.eachLayer(l=>{ if(l.feature===f && l.openPopup) l.openPopup(); });
    });
  });
}

/* ================= DESTAQUE INTERATIVO DE DISTRITO (legenda) ================= */
let highlightedDistrict = null;
function highlightDistrict(d){
  highlightedDistrict = (highlightedDistrict===d) ? null : d;
  if(!map.hasLayer(LAYERS.bairros.leaflet)) toggleLayer("bairros", true);
  LAYERS.bairros.leaflet.eachLayer(l=>{
    const dd = l.feature.properties.Distrito;
    if(!highlightedDistrict){ l.setStyle({fillOpacity:0.55, opacity:0.6}); }
    else if(dd===highlightedDistrict){ l.setStyle({fillOpacity:0.85, opacity:1, weight:2}); }
    else{ l.setStyle({fillOpacity:0.08, opacity:0.15}); }
  });
  renderLegend();
}

/* ================= FILTRO POR FAIXA DE POPULAÇÃO (legenda - Setores Censitários) ================= */
let highlightedCensoRange = null;
function filterCensoRange(i){
  highlightedCensoRange = (highlightedCensoRange===i) ? null : i;
  if(!map.hasLayer(LAYERS.censo.leaflet)) toggleLayer("censo", true);
  LAYERS.censo.leaflet.eachLayer(l=>{
    const v = l.feature.properties.V0001||0;
    const idx = censoRangeIndex(v);
    if(highlightedCensoRange===null){
      l.setStyle({color:"#12140f", weight:0.4, fillColor:censoColor(v), fillOpacity:0.7, opacity:1});
    } else if(idx===highlightedCensoRange){
      l.setStyle({color:"#12140f", weight:0.6, fillColor:censoColor(v), fillOpacity:0.85, opacity:1});
    } else {
      l.setStyle({fillOpacity:0, opacity:0, weight:0});
    }
  });
  renderLegend();
}