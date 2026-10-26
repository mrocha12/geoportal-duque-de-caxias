/* ============================================================
   dashboard-aglomerados.js - Dashboard de Aglomerados Subnormais
   Geoportal Duque de Caxias
   ============================================================ */
"use strict";

/* ================= PAINEL MODAL — REDIMENSIONÁVEL (arrastar bordas/cantos) =================
   Reutiliza o mesmo padrão de resize do dashboard de Setores Censitários. */
(function(){
  const box = document.getElementById("agl-modal-box");
  if(!box) return;
  const overlay = document.getElementById("modal-dashboard-aglomerados");
  const GEOM_KEY = "aglDashboardGeom";

  function minW(){ return Math.min(540, window.innerWidth * 0.92); }
  function minH(){ return Math.min(360, window.innerHeight * 0.80); }

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
        box.style.width = w + "px";
        box.style.height = h + "px";
        box.style.left = left + "px";
        box.style.top = top + "px";
      }
      function onUp(){
        box.classList.remove("dsh-resizing");
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
        saveGeom();
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, {once:true});
    });
  });

  /* Arrastar pelo cabeçalho */
  const head = box.querySelector(".modal-head");
  if(head){
    head.addEventListener("pointerdown", e=>{
      if(e.target.closest("button,.dsh-rz")) return;
      e.preventDefault();
      ensureFixed();
      const startX = e.clientX - (parseFloat(box.style.left)||0);
      const startY = e.clientY - (parseFloat(box.style.top)||0);
      document.body.style.userSelect = "none";
      try{ head.setPointerCapture(e.pointerId); }catch(err){}

      function onMove(ev){
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = parseFloat(box.style.width) || box.offsetWidth;
        const h = parseFloat(box.style.height) || box.offsetHeight;
        let left = ev.clientX - startX;
        let top = ev.clientY - startY;
        left = Math.min(Math.max(left, 4), Math.max(4, vw - w - 4));
        top = Math.min(Math.max(top, 4), Math.max(4, vh - h - 4));
        box.style.left = left + "px";
        box.style.top = top + "px";
      }
      function onUp(){
        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", onMove);
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

  const resetBtn = document.getElementById("agl-reset-size");
  if(resetBtn) resetBtn.addEventListener("click", resetGeom);

  window.addEventListener("resize", clampToViewport);

  /* Acessibilidade: foco ao abrir/fechar, Tab preso no painel */
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

/* ================= AGLOMERADOS SUBNORMAIS — CÁLCULO DE ESTATÍSTICAS =================
   Todos os indicadores são calculados dinamicamente a partir das feições
   carregadas em DATA_AGLOMERADOS_SUBORMAIS. Nenhum dado é inventado. */
function computeAglomeradosStats(){
  const feats = DATA_AGLOMERADOS_SUBORMAIS.features || [];
  const n = feats.length;

  /* Área aproximada de cada polígono pelo método shoelace (em graus²),
     depois convertida para km² multiplicando pelo fator local de Duque de Caxias.
     Latitude central ≈ -22.63° → cos(-22.63°) ≈ 0.9228.
     1 grau de latitude ≈ 111.32 km, 1 grau de longitude ≈ 102.70 km. */
  const DEG_LAT_KM = 111.32;
  const LAT_CENTER = -22.63;
  const DEG_LON_KM = DEG_LAT_KM * Math.cos(LAT_CENTER * Math.PI / 180);

  function polygonAreaKm2(ring){
    let area = 0;
    const len = ring.length;
    for(let i = 0; i < len; i++){
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % len];
      area += (x0 * DEG_LON_KM) * (y1 * DEG_LAT_KM) - (x1 * DEG_LON_KM) * (y0 * DEG_LAT_KM);
    }
    return Math.abs(area / 2) / 1e6; // km²
  }

  function featureAreaKm2(geom){
    if(!geom) return 0;
    if(geom.type === "Polygon"){
      const outer = polygonAreaKm2(geom.coordinates[0]);
      const holes = (geom.coordinates.slice(1) || []).reduce((s, h) => s + polygonAreaKm2(h), 0);
      return outer - holes;
    }
    if(geom.type === "MultiPolygon"){
      return geom.coordinates.reduce((s, poly) => {
        const outer = polygonAreaKm2(poly[0]);
        const holes = (poly.slice(1) || []).reduce((sh, h) => sh + polygonAreaKm2(h), 0);
        return s + (outer - holes);
      }, 0);
    }
    return 0;
  }

  let totalAreaKm2 = 0;
  let maxArea = 0, minArea = Infinity;
  let maxFeat = null, minFeat = null;

  const aglAreas = feats.map(f => {
    const area = featureAreaKm2(f.geometry);
    totalAreaKm2 += area;
    if(area > maxArea){ maxArea = area; maxFeat = f; }
    if(area < minArea){ minArea = area; minFeat = f; }
    return { f, area };
  });

  const avgArea = n ? totalAreaKm2 / n : 0;
  const sortedByArea = aglAreas.slice().sort((a, b) => a.area - b.area);
  const medianArea = n ? (n % 2 ?
    sortedByArea[Math.floor(n / 2)].area :
    (sortedByArea[n/2 - 1].area + sortedByArea[n/2].area) / 2) : 0;

  /* Top 5 maiores por área */
  const top5 = aglAreas.slice().sort((a, b) => b.area - a.area).slice(0, 5);

  /* Distribuição por faixa de área — 4 faixas fixas (ha) */
  const FAIXAS = [
    { label:"< 25 ha",          min:0,    max:0.25,  color:"#F48FB1" },
    { label:"25 ha – 100 ha",   min:0.25, max:1.00,  color:"#E91E63" },
    { label:"100 ha – 300 ha",  min:1.00, max:3.00,  color:"#C2185B" },
    { label:"> 300 ha",         min:3.00, max:Infinity, color:"#880E4F" }
  ];
  FAIXAS.forEach(f => { f.count = 0; f.totalArea = 0; });
  aglAreas.forEach(({ area }) => {
    const faixa = FAIXAS.find(f => area >= f.min && area < f.max) || FAIXAS[FAIXAS.length - 1];
    faixa.count++;
    faixa.totalArea += area;
  });

  return { n, totalAreaKm2, avgArea, medianArea, maxArea, minArea, maxFeat, minFeat, top5, FAIXAS, aglAreas };
}

/* ================= RENDERIZAÇÃO DO DASHBOARD ================= */
function renderAglomeradosDashboard(){
  const s = computeAglomeradosStats();
  const fmt  = v => formatNumberPtBR(Math.round(v || 0));
  const fmtA = v => formatNumberPtBR(v, {minimumFractionDigits:2, maximumFractionDigits:2}); // km²
  const fmtH = v => formatNumberPtBR(v * 100, {minimumFractionDigits:1, maximumFractionDigits:1}); // ha

  const html = `
    <div class="dsh-note">Indicadores calculados dinamicamente a partir das <b>${fmt(s.n)}</b> feições de aglomerados subnormais carregadas (Censo IBGE 2010 — IBGE/AGSN). As áreas são estimativas calculadas no navegador a partir dos polígonos.</div>

    <div class="dsh-kpi-grid">
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(233,30,99,.12);color:#E91E63"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg></span><div class="dsh-kpi-label">Aglomerados</div></div><div class="dsh-kpi-value">${fmt(s.n)}</div><div class="dsh-kpi-sub">total de polígonos</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(233,30,99,.12);color:#C2185B"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg></span><div class="dsh-kpi-label">Área total</div></div><div class="dsh-kpi-value">${fmtA(s.totalAreaKm2)} km²</div><div class="dsh-kpi-sub">${fmtH(s.totalAreaKm2)} ha estimados</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(20,184,166,.12);color:#14b8a6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="3 3"/><path d="M6 20V14"/><path d="M12 20V8"/><path d="M18 20V16"/></svg></span><div class="dsh-kpi-label">Área média</div></div><div class="dsh-kpi-value">${fmtH(s.avgArea)} ha</div><div class="dsh-kpi-sub">${fmtA(s.avgArea)} km² por aglomerado</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(6,182,212,.12);color:#06b6d4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="7" y2="12"/><rect x="7" y="7" width="10" height="10" rx="1"/><line x1="12" y1="7" x2="12" y2="17"/><line x1="17" y1="12" x2="20" y2="12"/></svg></span><div class="dsh-kpi-label">Área mediana</div></div><div class="dsh-kpi-value">${fmtH(s.medianArea)} ha</div><div class="dsh-kpi-sub">${fmtA(s.medianArea)} km²</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(34,197,94,.12);color:#22c55e"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></span><div class="dsh-kpi-label">Maior área</div></div><div class="dsh-kpi-value">${fmtH(s.maxArea)} ha</div><div class="dsh-kpi-sub">${s.maxFeat ? escapeHtml(s.maxFeat.properties.NM_AGSN||"—") : "—"}</div></div>
      <div class="dsh-kpi-card"><div class="dsh-kpi-head"><span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(239,68,68,.12);color:#ef4444"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg></span><div class="dsh-kpi-label">Menor área</div></div><div class="dsh-kpi-value">${fmtH(s.minArea)} ha</div><div class="dsh-kpi-sub">${s.minFeat ? escapeHtml(s.minFeat.properties.NM_AGSN||"—") : "—"}</div></div>
    </div>

    <div class="dsh-cols">
      <div>
        <div class="dsh-section-title">Distribuição por faixa de área</div>
        <div id="agl-faixas"></div>
      </div>
      <div>
        <div class="dsh-section-title">Top 5 maiores aglomerados</div>
        <div class="dsh-table-wrap">
          <table class="dsh-table" id="agl-top5">
            <thead><tr><th>#</th><th>Nome</th><th>Código AGSN</th><th>Área (ha)</th><th>% total</th></tr></thead>
            <tbody>
              ${s.top5.map(({f, area}, i) => `<tr data-cod="${escapeHtml(f.properties.CodAGSN||"")}"><td class="dsh-rank">${i+1}</td><td>${escapeHtml(f.properties.NM_AGSN||"—")}</td><td>${escapeHtml(f.properties.CodAGSN||"—")}</td><td>${fmtH(area)}</td><td>${s.totalAreaKm2 ? formatNumberPtBR(area/s.totalAreaKm2*100,{minimumFractionDigits:1,maximumFractionDigits:1}) : "0,0"}%</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const body = document.getElementById("agl-body");
  body.innerHTML = html;

  /* Barras de faixas */
  const faixasWrap = document.getElementById("agl-faixas");
  const maxFaixaArea = Math.max(1, ...s.FAIXAS.map(f => f.totalArea));
  faixasWrap.innerHTML = s.FAIXAS.map(f => {
    const pct = s.totalAreaKm2 ? (f.totalArea / s.totalAreaKm2 * 100) : 0;
    const width = (f.totalArea / maxFaixaArea * 100);
    return `<div class="dsh-bar-row" data-agl-faixa="${f.label}">
      <div class="dsh-bar-swatch" style="background:${f.color};"></div>
      <div class="dsh-bar-label">${f.label}</div>
      <div class="dsh-bar-track"><div class="dsh-bar-fill" style="width:${width}%;background:${f.color};"></div></div>
      <div class="dsh-bar-val">${fmt(f.count)} aglom. · ${formatNumberPtBR(pct,{minimumFractionDigits:1,maximumFractionDigits:1})}%</div>
    </div>`;
  }).join("");

  /* Clicar na barra destaca no mapa */
  faixasWrap.querySelectorAll("[data-agl-faixa]").forEach(row => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      const label = row.getAttribute("data-agl-faixa");
      const faixa = s.FAIXAS.find(f => f.label === label);
      if(!faixa) return;
      const layer = LAYERS["aglomerados_subormais"];
      if(!layer) return;
      if(!map.hasLayer(layer.leaflet)) toggleLayer("aglomerados_subormais", true);
      const { aglAreas } = s;
      layer.leaflet.eachLayer(l => {
        const entry = aglAreas.find(e => e.f === l.feature);
        const area = entry ? entry.area : 0;
        const inFaixa = area >= faixa.min && area < faixa.max;
        l.setStyle(inFaixa
          ? { color:"#880E4F", weight:2.5, fillColor:"#E91E63", fillOpacity:0.85, opacity:1 }
          : { fillOpacity:0.05, opacity:0.15, weight:0.8 });
      });
      faixasWrap.querySelectorAll(".dsh-bar-row").forEach(r => r.classList.toggle("dsh-active", r === row));
      showToast("Aglomerados da faixa destacados no mapa.");
    });
  });

  /* Clicar na tabela vai até o aglomerado no mapa */
  document.querySelectorAll("#agl-top5 tbody tr[data-cod]").forEach(tr => {
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => {
      const cod = tr.getAttribute("data-cod");
      const f = DATA_AGLOMERADOS_SUBORMAIS.features.find(ft => ft.properties.CodAGSN === cod);
      if(!f) return;
      closeAglomeradosDashboard();
      const layer = LAYERS["aglomerados_subormais"];
      if(layer && !map.hasLayer(layer.leaflet)) toggleLayer("aglomerados_subormais", true);
      const temp = L.geoJSON(f);
      map.fitBounds(temp.getBounds(), {padding:[40,40]});
      if(layer){
        layer.leaflet.eachLayer(l => {
          if(l.feature === f && l.openPopup) l.openPopup();
        });
      }
    });
  });
}

/* ================= ABRIR / FECHAR ================= */
function openAglomeradosDashboard(){
  /* Restaura visibilidade de todas as camadas antes de abrir (não há modo exclusivo) */
  if(!map.hasLayer(LAYERS["aglomerados_subormais"].leaflet)){
    toggleLayer("aglomerados_subormais", true);
  }
  renderAglomeradosDashboard();
  document.getElementById("modal-dashboard-aglomerados").classList.add("open");
  document.getElementById("btn-aglomerados-top").setAttribute("aria-expanded","true");
}

function closeAglomeradosDashboard(){
  document.getElementById("modal-dashboard-aglomerados").classList.remove("open");
  const btn = document.getElementById("btn-aglomerados-top");
  if(btn) btn.setAttribute("aria-expanded","false");
  /* Remove destaques de filtro da camada */
  const layer = LAYERS["aglomerados_subormais"];
  if(layer && map.hasLayer(layer.leaflet)){
    layer.leaflet.eachLayer(l => {
      if(l.setStyle) l.setStyle({color:"#880E4F", weight:1.5, fillColor:"#E91E63", fillOpacity:0.5, opacity:0.9});
    });
  }
}

/* Botão de fechar dentro do modal */
(function(){
  const btn = document.querySelector("[data-close=\"modal-dashboard-aglomerados\"]");
  if(btn) btn.addEventListener("click", closeAglomeradosDashboard);
})();
