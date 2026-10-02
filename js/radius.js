/* ============================================================
   radius.js - Ferramenta "Consulta por Raio"
   Geoportal Duque de Caxias

   Permite definir um ponto no mapa e um raio de busca, destacar
   visualmente as feições das camadas que intersectam ou estão
   dentro do círculo, e apresentar os resultados organizados por
   camada em um painel de resultados.
   ============================================================ */

/* ================= GEOMETRIA (sem dependências externas) =================
   Aproximação planar equirretangular em torno do ponto central,
   no mesmo espírito da aproximação já usada em planarAreaM2()
   (ferramentas.js) para medições de área — adequada à escala
   municipal deste Geoportal. */
function radiusLocalXY(centerLat, centerLng, lng, lat){
  const R = 6378137;
  const lat0 = centerLat * Math.PI/180;
  const dLat = (lat - centerLat) * Math.PI/180;
  const dLng = (lng - centerLng) * Math.PI/180;
  return [dLng * R * Math.cos(lat0), dLat * R];
}

function radiusDistPointToSegment(px,py, ax,ay, bx,by){
  const dx = bx-ax, dy = by-ay;
  const lenSq = dx*dx + dy*dy;
  let t = lenSq>0 ? ((px-ax)*dx + (py-ay)*dy)/lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t*dx, cy = ay + t*dy;
  return Math.hypot(px-cx, py-cy);
}

// Menor distância (m) do ponto central até uma linha (array de [lng,lat])
function radiusMinDistLineToCenter(coords, centerLat, centerLng){
  if(!coords || !coords.length) return Infinity;
  const pts = coords.map(c=>radiusLocalXY(centerLat, centerLng, c[0], c[1]));
  if(pts.length===1) return Math.hypot(pts[0][0], pts[0][1]);
  let min = Infinity;
  for(let i=1;i<pts.length;i++){
    const d = radiusDistPointToSegment(0,0, pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
    if(d<min) min = d;
  }
  return min;
}

// Ray casting simples — funciona diretamente em coordenadas lat/lon
// (topologicamente equivalente para o teste ponto-em-polígono).
function radiusPointInRing(lng, lat, ring){
  let inside = false;
  for(let i=0, j=ring.length-1; i<ring.length; j=i++){
    const xi=ring[i][0], yi=ring[i][1], xj=ring[j][0], yj=ring[j][1];
    const intersect = ((yi>lat)!==(yj>lat)) && (lng < (xj-xi)*(lat-yi)/((yj-yi)||1e-15) + xi);
    if(intersect) inside = !inside;
  }
  return inside;
}
function radiusPointInPolygon(lng, lat, rings){
  if(!rings || !rings.length) return false;
  if(!radiusPointInRing(lng, lat, rings[0])) return false;
  for(let i=1;i<rings.length;i++){ if(radiusPointInRing(lng, lat, rings[i])) return false; }
  return true;
}
function radiusPolygonMinDistToCenter(rings, centerLat, centerLng){
  let min = Infinity;
  (rings||[]).forEach(ring=>{
    const d = radiusMinDistLineToCenter(ring, centerLat, centerLng);
    if(d<min) min = d;
  });
  return min;
}

// Retorna true se a geometria intersecta ou está contida no círculo de
// centro `centerLatLng` (L.LatLng) e raio `radiusM` (metros).
function geometryWithinRadius(geometry, centerLatLng, radiusM){
  if(!geometry || !geometry.coordinates) return false;
  const clat = centerLatLng.lat, clng = centerLatLng.lng;
  const coords = geometry.coordinates;
  switch(geometry.type){
    case "Point": {
      const [lng,lat] = coords;
      return Math.hypot(...radiusLocalXY(clat,clng,lng,lat)) <= radiusM;
    }
    case "MultiPoint":
      return coords.some(c=> Math.hypot(...radiusLocalXY(clat,clng,c[0],c[1])) <= radiusM);
    case "LineString":
      return radiusMinDistLineToCenter(coords, clat, clng) <= radiusM;
    case "MultiLineString":
      return coords.some(line=> radiusMinDistLineToCenter(line, clat, clng) <= radiusM);
    case "Polygon":
      return radiusPointInPolygon(clng, clat, coords) || radiusPolygonMinDistToCenter(coords, clat, clng) <= radiusM;
    case "MultiPolygon":
      return coords.some(poly=> radiusPointInPolygon(clng, clat, poly) || radiusPolygonMinDistToCenter(poly, clat, clng) <= radiusM);
    default:
      return false;
  }
}

// Distância (m) do ponto central até a feição mais próxima (0 quando o
// centro está dentro de um polígono). Reaproveita os mesmos helpers de
// geometryWithinRadius, usados agora para exibir/ordenar por distância.
function radiusFeatureDistanceMeters(feature, centerLatLng){
  const geom = feature && feature.geometry;
  if(!geom || !geom.coordinates) return Infinity;
  const clat = centerLatLng.lat, clng = centerLatLng.lng;
  const coords = geom.coordinates;
  switch(geom.type){
    case "Point":
      return Math.hypot(...radiusLocalXY(clat,clng,coords[0],coords[1]));
    case "MultiPoint":
      return Math.min(...coords.map(c=>Math.hypot(...radiusLocalXY(clat,clng,c[0],c[1]))));
    case "LineString":
      return radiusMinDistLineToCenter(coords, clat, clng);
    case "MultiLineString":
      return Math.min(...coords.map(line=>radiusMinDistLineToCenter(line, clat, clng)));
    case "Polygon":
      return radiusPointInPolygon(clng, clat, coords) ? 0 : radiusPolygonMinDistToCenter(coords, clat, clng);
    case "MultiPolygon":
      return Math.min(...coords.map(poly=> radiusPointInPolygon(clng, clat, poly) ? 0 : radiusPolygonMinDistToCenter(poly, clat, clng)));
    default:
      return Infinity;
  }
}

/* ================= ESTADO ================= */
let radiusPointMode = false;
let radiusCenter = null;         // L.LatLng
let radiusCircle = null;         // L.Circle
let radiusCenterMarker = null;   // L.Marker (arrastável)
let radiusHandleMarker = null;   // L.Marker (alça de raio arrastável na borda do círculo)
let radiusHandleDragging = false;
let radiusPreviewFrameRequested = false;
const radiusHighlightLayer = L.featureGroup().addTo(map);
let radiusResultsByLayer = null; // {layerId: [{feature, leafletLayer}, ...]}
const radiusAutoEnabledLayers = new Set(); // camadas ligadas automaticamente ao abrir um resultado (para desligar depois)
const radiusExcludedLayers = new Set();     // camadas desmarcadas no filtro "Camadas a consultar"

const RADIUS_COLOR = "#29b6f6";
const RADIUS_HIGHLIGHT_COLOR = "#ff6d00";
const RADIUS_HANDLE_BEARING = 90; // alça posicionada a Leste do centro

// Ponto de destino a uma distância/rumo do centro, usando a mesma
// aproximação equirretangular de radiusLocalXY() (inversa dela).
function radiusDestinationPoint(center, bearingDeg, distanceM){
  const R = 6378137;
  const bearing = bearingDeg * Math.PI/180;
  const dx = distanceM * Math.sin(bearing);
  const dy = distanceM * Math.cos(bearing);
  const lat0 = center.lat * Math.PI/180;
  const dLat = dy / R;
  const dLng = dx / (R * Math.cos(lat0));
  return L.latLng(center.lat + dLat*180/Math.PI, center.lng + dLng*180/Math.PI);
}

function radiusGetMeters(){
  const raw = parseFloat(document.getElementById("rd-radius-input").value);
  const val = (isNaN(raw) || raw<=0) ? 0 : raw;
  const activeUnitBtn = document.querySelector("#rd-units .rd-unit-btn.active");
  const unit = activeUnitBtn ? activeUnitBtn.getAttribute("data-unit") : "m";
  return unit==="km" ? val*1000 : val;
}

function radiusFormatDistance(m){
  return m>=1000 ? (m/1000).toLocaleString("pt-BR",{maximumFractionDigits:2}) + " km" : m.toFixed(0) + " m";
}

function radiusUpdateQueryButtonState(){
  const btn = document.getElementById("rd-query-btn");
  if(btn) btn.disabled = !(radiusCenter && radiusGetMeters()>0);
}

function radiusUpdatePointReadout(){
  const el = document.getElementById("rd-point-readout");
  const copyBtn = document.getElementById("rd-copy-point");
  if(!el) return;
  if(radiusCenter){
    el.textContent = `Ponto definido: ${radiusCenter.lat.toFixed(6)}, ${radiusCenter.lng.toFixed(6)}`;
    if(copyBtn) copyBtn.hidden = false;
  } else {
    el.textContent = "Nenhum ponto definido. Arraste a alça do círculo para ajustar o raio.";
    if(copyBtn) copyBtn.hidden = true;
  }
}

// Cria (ou reaproveita) o círculo e a alça de raio arrastável, evitando
// recriar o círculo a cada ajuste — assim o redimensionamento fica suave.
function radiusDrawCircle(){
  if(!radiusCenter) return;
  const meters = radiusGetMeters();
  const r = meters>0 ? meters : 1;
  if(radiusCircle){
    radiusCircle.setLatLng(radiusCenter);
    radiusCircle.setRadius(r);
  } else {
    radiusCircle = L.circle(radiusCenter, {
      radius: r, color: RADIUS_COLOR, weight:2, dashArray:"5,5",
      fillColor: RADIUS_COLOR, fillOpacity:0.08,
      pane:"paneHighlight", interactive:false
    }).addTo(map);
  }
  if(!radiusHandleDragging) radiusUpdateHandle();
}

// Anima o "nascimento" do círculo (cresce do centro até o raio definido),
// dando um toque mais moderno ao posicionar um novo ponto.
function radiusAnimateCircleGrowth(targetMeters){
  if(!radiusCircle) return;
  const duration = 350;
  const start = performance.now();
  function step(now){
    if(!radiusCircle) return;
    const t = Math.min(1, (now-start)/duration);
    const eased = 1 - Math.pow(1-t, 3);
    radiusCircle.setRadius(Math.max(1, targetMeters*eased));
    if(t<1) requestAnimationFrame(step);
    else radiusCircle.setRadius(Math.max(1, targetMeters));
  }
  requestAnimationFrame(step);
}

// Cria/atualiza a alça arrastável na borda do círculo (a Leste do centro),
// usada para ajustar o raio visualmente, arrastando pelo mapa.
function radiusUpdateHandle(){
  if(!radiusCenter) return;
  const meters = radiusGetMeters();
  const pos = radiusDestinationPoint(radiusCenter, RADIUS_HANDLE_BEARING, meters>0?meters:1);
  if(!radiusHandleMarker){
    radiusHandleMarker = L.marker(pos, {
      icon: L.divIcon({className:"radius-handle-icon", html:'<div class="radius-handle"></div>', iconSize:[14,14], iconAnchor:[7,7]}),
      draggable:true, pane:"paneHighlight", title:"Arraste para ajustar o raio", keyboard:false
    }).addTo(map);
    radiusHandleMarker.on("dragstart", ()=>{ radiusHandleDragging = true; });
    radiusHandleMarker.on("drag", e=>{
      if(!radiusCenter) return;
      const m = Math.max(1, radiusCenter.distanceTo(e.target.getLatLng()));
      radiusApplyMetersFromHandle(m);
    });
    radiusHandleMarker.on("dragend", ()=>{
      radiusHandleDragging = false;
      radiusClearResultsOnly();
      showToast("Raio alterado. Clique em Consultar para atualizar os resultados.");
    });
  } else {
    radiusHandleMarker.setLatLng(pos);
  }
}

// Reflete o raio arrastado pela alça de volta no campo numérico (na
// unidade atualmente selecionada) e no círculo, em tempo real.
function radiusApplyMetersFromHandle(meters){
  const activeUnitBtn = document.querySelector("#rd-units .rd-unit-btn.active");
  const unit = activeUnitBtn ? activeUnitBtn.getAttribute("data-unit") : "m";
  const input = document.getElementById("rd-radius-input");
  input.value = unit==="km" ? Math.round((meters/1000)*100)/100 : Math.round(meters);
  document.querySelectorAll("#rd-chips .rd-chip").forEach(c=>c.classList.remove("active"));
  if(radiusCircle) radiusCircle.setRadius(meters);
  radiusUpdateQueryButtonState();
  radiusSchedulePreview();
}

function radiusSetCenterMarker(latlng){
  if(radiusCenterMarker){ map.removeLayer(radiusCenterMarker); radiusCenterMarker = null; }
  radiusCenterMarker = L.marker(latlng, {
    icon: makeDotIcon(RADIUS_COLOR, "&#10010;", 18),
    draggable:true, pane:"paneHighlight", title:"Arraste para ajustar o ponto"
  }).addTo(map);
  const el = radiusCenterMarker.getElement();
  if(el) el.classList.add("radius-center-marker");
  radiusCenterMarker.on("drag", e=>{
    radiusCenter = e.target.getLatLng();
    if(radiusCircle) radiusCircle.setLatLng(radiusCenter);
    if(!radiusHandleDragging) radiusUpdateHandle();
    radiusUpdatePointReadout();
    radiusSchedulePreview();
  });
  radiusCenterMarker.on("dragend", ()=>{
    radiusClearResultsOnly();
    showToast("Ponto alterado. Clique em Consultar para atualizar os resultados.");
  });
}

function setRadiusPoint(latlng){
  radiusCenter = latlng;
  radiusSetCenterMarker(latlng);
  const meters = radiusGetMeters();
  radiusDrawCircle();
  radiusAnimateCircleGrowth(meters>0 ? meters : 1);
  radiusUpdatePointReadout();
  radiusUpdateQueryButtonState();
  radiusClearResultsOnly();
  radiusSchedulePreview();
  setRadiusPointMode(false);
}

function setRadiusPointMode(active){
  radiusPointMode = !!active;
  const item = document.getElementById("rd-define-point");
  if(item) item.classList.toggle("active", radiusPointMode);
  if(typeof updateToolCursorAndDblClick==="function") updateToolCursorAndDblClick();
}

/* ================= PRÉVIA EM TEMPO REAL (antes de "Consultar") =================
   Enquanto o usuário ajusta o ponto/raio, mostra uma contagem estimada de
   feições, sem destacar nada no mapa nem alterar camadas — só ao clicar em
   "Consultar" o resultado é efetivado (destaque + painel detalhado). */
function radiusComputePreviewCount(meters){
  let total = 0, layerCount = 0;
  DRAW_ORDER.filter(id=>LAYERS[id] && !radiusExcludedLayers.has(id)).forEach(id=>{
    const layer = LAYERS[id];
    if(!layer || !layer.leaflet || !layer.leaflet.eachLayer) return;
    let count = 0;
    layer.leaflet.eachLayer(l=>{
      if(l.feature && l.feature.geometry && geometryWithinRadius(l.feature.geometry, radiusCenter, meters)) count++;
    });
    if(count>0){ total += count; layerCount++; }
  });
  return {total, layerCount};
}

function radiusUpdatePreview(){
  const el = document.getElementById("rd-preview");
  if(!el) return;
  if(!radiusCenter){ el.textContent = ""; return; }
  const meters = radiusGetMeters();
  if(!(meters>0)){ el.textContent = ""; return; }
  const {total, layerCount} = radiusComputePreviewCount(meters);
  el.textContent = total>0
    ? `≈ ${total} feição(ões) em ${layerCount} camada(s) dentro do raio atual — clique em "Consultar" para destacar e ver detalhes.`
    : "Nenhuma feição dentro do raio atual.";
}

function radiusSchedulePreview(){
  if(radiusPreviewFrameRequested) return;
  radiusPreviewFrameRequested = true;
  requestAnimationFrame(()=>{
    radiusPreviewFrameRequested = false;
    radiusUpdatePreview();
  });
}

/* ================= DESTAQUE VISUAL DAS FEIÇÕES ENCONTRADAS ================= */
function radiusBuildHighlight(feature){
  const geom = feature.geometry;
  if(!geom) return null;
  switch(geom.type){
    case "Point":
      return L.circleMarker([geom.coordinates[1], geom.coordinates[0]], {
        radius:12, color:RADIUS_HIGHLIGHT_COLOR, weight:3,
        fillColor:RADIUS_HIGHLIGHT_COLOR, fillOpacity:0.35,
        pane:"paneHighlight", interactive:false
      });
    case "MultiPoint": {
      const group = L.featureGroup();
      geom.coordinates.forEach(c=>{
        L.circleMarker([c[1],c[0]], {
          radius:12, color:RADIUS_HIGHLIGHT_COLOR, weight:3,
          fillColor:RADIUS_HIGHLIGHT_COLOR, fillOpacity:0.35,
          pane:"paneHighlight", interactive:false
        }).addTo(group);
      });
      return group;
    }
    case "LineString":
    case "MultiLineString":
      return L.geoJSON(feature, {
        style:{color:RADIUS_HIGHLIGHT_COLOR, weight:6, opacity:0.85, pane:"paneHighlight"},
        pane:"paneHighlight", interactive:false
      });
    case "Polygon":
    case "MultiPolygon":
      return L.geoJSON(feature, {
        style:{color:RADIUS_HIGHLIGHT_COLOR, weight:3, fill:false, dashArray:"6,4", opacity:0.95, pane:"paneHighlight"},
        pane:"paneHighlight", interactive:false
      });
    default:
      return null;
  }
}

/* ================= CONSULTA ================= */
function runRadiusQuery(){
  if(!radiusCenter){ showToast("Defina um ponto no mapa antes de consultar."); return; }
  const meters = radiusGetMeters();
  if(!(meters>0)){ showToast("Informe um raio válido, maior que zero."); return; }

  radiusDrawCircle();
  radiusHighlightLayer.clearLayers();

  const order = DRAW_ORDER.filter(id=>LAYERS[id] && !radiusExcludedLayers.has(id));
  const resultsByLayer = {};
  let total = 0;

  order.forEach(id=>{
    const layer = LAYERS[id];
    if(!layer || !layer.leaflet || !layer.leaflet.eachLayer) return;
    const matches = [];
    layer.leaflet.eachLayer(l=>{
      if(!l.feature || !l.feature.geometry) return;
      if(geometryWithinRadius(l.feature.geometry, radiusCenter, meters)){
        matches.push({feature:l.feature, leafletLayer:l, distance: radiusFeatureDistanceMeters(l.feature, radiusCenter)});
      }
    });
    if(matches.length){
      matches.sort((a,b)=>a.distance-b.distance);
      resultsByLayer[id] = matches;
      total += matches.length;
      matches.forEach(m=>{
        const hl = radiusBuildHighlight(m.feature);
        if(hl) hl.addTo(radiusHighlightLayer);
      });
      if(typeof atSyncSelectionForLayer==="function") atSyncSelectionForLayer(id, matches.map(m=>m.feature));
    }
  });

  radiusResultsByLayer = resultsByLayer;
  radiusRenderSummary(total, Object.keys(resultsByLayer).length, meters);
  radiusOpenResultsModal(resultsByLayer, meters);
  showToast(total>0
    ? `${total} feição(ões) encontrada(s) dentro do raio de ${radiusFormatDistance(meters)}.`
    : "Nenhuma feição encontrada dentro do raio definido.");
}

function radiusRenderSummary(total, layerCount, meters){
  const el = document.getElementById("rd-summary");
  if(!el) return;
  if(total===0){
    el.innerHTML = `Nenhuma feição encontrada dentro do raio de ${radiusFormatDistance(meters)}.`;
    return;
  }
  el.innerHTML = `<b>${total}</b> feição(ões) em <b>${layerCount}</b> camada(s) dentro do raio de ${radiusFormatDistance(meters)}. `
    + `<span class="rd-view-results" id="rd-view-results">Ver resultados</span>`;
  const link = document.getElementById("rd-view-results");
  if(link) link.addEventListener("click", ()=> radiusOpenResultsModal(radiusResultsByLayer, meters));
}

function radiusClearResultsOnly(){
  radiusHighlightLayer.clearLayers();
  radiusResultsByLayer = null;
  const el = document.getElementById("rd-summary");
  if(el) el.innerHTML = "";
}

function clearRadiusQuery(){
  setRadiusPointMode(false);
  radiusCenter = null;
  if(radiusCircle){ map.removeLayer(radiusCircle); radiusCircle = null; }
  if(radiusCenterMarker){ map.removeLayer(radiusCenterMarker); radiusCenterMarker = null; }
  if(radiusHandleMarker){ map.removeLayer(radiusHandleMarker); radiusHandleMarker = null; }
  radiusHandleDragging = false;
  radiusHighlightLayer.clearLayers();
  radiusResultsByLayer = null;
  radiusAutoEnabledLayers.forEach(id=>{
    if(LAYERS[id] && map.hasLayer(LAYERS[id].leaflet)) toggleLayer(id, false);
  });
  radiusAutoEnabledLayers.clear();
  radiusUpdatePointReadout();
  radiusUpdateQueryButtonState();
  document.querySelectorAll("#rd-chips .rd-chip").forEach(c=>c.classList.remove("active"));
  const el = document.getElementById("rd-summary");
  if(el) el.innerHTML = "";
  const preview = document.getElementById("rd-preview");
  if(preview) preview.textContent = "";
  closeModal("modal-radius-results");
  showToast("Consulta por raio limpa.");
}

/* ================= PAINEL DE RESULTADOS (agrupado por camada, com busca/ordenação) ================= */
let radiusModalResults = null; // referência aos resultados exibidos no modal atualmente aberto
let radiusModalMeters = 0;

function radiusNormalizeText(s){
  return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

function radiusBuildResultItem(id, m, i, showLayerTag){
  const layer = LAYERS[id];
  const props = m.feature.properties || {};
  const cfg = tooltipConfigFor(id, props);
  let title = (cfg.idField && !isBlank(props[cfg.idField]))
    ? String(props[cfg.idField]).trim() : (cfg.idFallback || layer.label);
  if(cfg.idPrefix) title = cfg.idPrefix + title;
  const rows = (cfg.fields||[]).map(([k,label,formatter])=>{
    const v = props[k];
    if(isBlank(v)) return "";
    const vStr = typeof formatter==="function" ? formatter(v) : String(v).trim();
    return `<span class="rd-res-field"><b>${escapeHtml(label)}:</b> ${escapeHtml(vStr)}</span>`;
  }).join("");
  const distTxt = Number.isFinite(m.distance) ? radiusFormatDistance(m.distance) : "";
  const html = `<div class="rd-res-item" data-layer="${id}" data-idx="${i}">
      <div class="rd-res-item-head">
        <div class="rd-res-item-title">${escapeHtml(title)}</div>
        ${distTxt ? `<span class="rd-res-item-distance">${distTxt}</span>` : ""}
      </div>
      ${showLayerTag ? `<div class="rd-res-item-layer-tag">${escapeHtml(layer.label)}</div>` : ""}
      ${rows ? `<div class="rd-res-item-fields">${rows}</div>` : ""}
    </div>`;
  return {title, layerLabel: layer.label, html};
}

function radiusBuildResultsHTML(resultsByLayer, opts){
  opts = opts || {};
  const searchTerm = radiusNormalizeText(opts.searchTerm||"");
  const sortMode = opts.sortMode || "layer";
  const ids = Object.keys(resultsByLayer||{});
  if(!ids.length){
    return `<div class="rd-res-empty">Nenhuma feição encontrada dentro do raio definido.</div>`;
  }

  if(sortMode==="distance"){
    let flat = [];
    ids.forEach(id=>{ resultsByLayer[id].forEach((m,i)=> flat.push({id, i, m})); });
    flat.sort((a,b)=>(a.m.distance||0)-(b.m.distance||0));
    const items = flat
      .map(entry=>radiusBuildResultItem(entry.id, entry.m, entry.i, true))
      .filter(item=> !searchTerm || radiusNormalizeText(item.title).includes(searchTerm) || radiusNormalizeText(item.layerLabel).includes(searchTerm));
    if(!items.length) return `<div class="rd-res-no-match">Nenhum resultado corresponde à busca.</div>`;
    return `<div class="rd-res-list">${items.map(it=>it.html).join("")}</div>`;
  }

  let anyMatch = false;
  const groupsHtml = ids.map(id=>{
    const layer = LAYERS[id];
    const items = resultsByLayer[id]
      .map((m,i)=>radiusBuildResultItem(id, m, i, false))
      .filter(item=> !searchTerm || radiusNormalizeText(item.title).includes(searchTerm));
    if(!items.length) return "";
    anyMatch = true;
    return `<div class="rd-res-group">
      <div class="rd-res-group-title">${escapeHtml(layer.label)} <span class="rd-res-count">${items.length}</span></div>
      <div class="rd-res-list">${items.map(it=>it.html).join("")}</div>
    </div>`;
  }).join("");
  return anyMatch ? groupsHtml : `<div class="rd-res-no-match">Nenhum resultado corresponde à busca.</div>`;
}

function radiusRenderResultsBody(){
  const body = document.getElementById("radius-results-body");
  if(!body) return;
  const searchInput = document.getElementById("rd-res-search");
  const sortSelect = document.getElementById("rd-res-sort");
  const searchTerm = searchInput ? searchInput.value : "";
  const sortMode = sortSelect ? sortSelect.value : "layer";
  body.innerHTML = radiusBuildResultsHTML(radiusModalResults||{}, {searchTerm, sortMode});
  body.querySelectorAll(".rd-res-item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-layer");
      const idx = +el.getAttribute("data-idx");
      const match = radiusModalResults[id] && radiusModalResults[id][idx];
      if(!match) return;
      if(!map.hasLayer(LAYERS[id].leaflet)){ toggleLayer(id, true); radiusAutoEnabledLayers.add(id); }
      const geom = match.feature.geometry;
      if(geom.type==="Point" || geom.type==="MultiPoint"){
        const c = geom.type==="Point" ? geom.coordinates : geom.coordinates[0];
        map.setView([c[1], c[0]], Math.max(map.getZoom(), 16));
      } else {
        try{
          const temp = L.geoJSON(match.feature);
          map.fitBounds(temp.getBounds(), {padding:[40,40]});
        }catch(err){ /* geometria sem bounds válidos */ }
      }
      if(match.leafletLayer && match.leafletLayer.openPopup) match.leafletLayer.openPopup();
    });
  });
}

function radiusOpenResultsModal(resultsByLayer, meters){
  radiusModalResults = resultsByLayer || {};
  radiusModalMeters = meters;
  const hasResults = Object.keys(radiusModalResults).length > 0;
  document.getElementById("radius-results-note").textContent = hasResults
    ? `Raio de ${radiusFormatDistance(meters)} a partir do ponto definido — resultados organizados por camada.`
    : `Raio de ${radiusFormatDistance(meters)} a partir do ponto definido — nenhuma feição encontrada.`;
  const toolbar = document.getElementById("rd-res-toolbar");
  if(toolbar) toolbar.hidden = !hasResults;
  const searchInput = document.getElementById("rd-res-search");
  const sortSelect = document.getElementById("rd-res-sort");
  if(searchInput) searchInput.value = "";
  if(sortSelect) sortSelect.value = "layer";
  radiusRenderResultsBody();
  openModal("modal-radius-results");
}

/* ================= EXPORTAR RESULTADOS (GeoJSON/CSV) =================
   Reaproveita downloadBlob() e geojsonToCSV() já usados na exportação de
   camadas/esboços (ferramentas.js), combinando todas as feições
   encontradas em um único arquivo, com a camada de origem e a distância
   ao ponto central anexadas a cada feição. */
function radiusBuildExportGeoJSON(){
  const features = [];
  Object.keys(radiusModalResults||{}).forEach(id=>{
    const layer = LAYERS[id];
    radiusModalResults[id].forEach(m=>{
      const f = JSON.parse(JSON.stringify(m.feature));
      f.properties = f.properties || {};
      f.properties._camada = layer.label;
      f.properties._distancia_m = Math.round(m.distance);
      features.push(f);
    });
  });
  return {type:"FeatureCollection", features};
}

/* ================= EVENTOS DA UI ================= */
document.getElementById("rd-define-point").addEventListener("click", ()=>{
  setRadiusPointMode(!radiusPointMode);
  if(radiusPointMode) showToast("Clique no mapa para definir o ponto central da consulta.");
});
document.getElementById("rd-radius-input").addEventListener("input", ()=>{
  document.querySelectorAll("#rd-chips .rd-chip").forEach(c=>c.classList.remove("active"));
  radiusUpdateQueryButtonState();
  if(radiusCenter) radiusDrawCircle();
  radiusSchedulePreview();
});
document.querySelectorAll("#rd-units .rd-unit-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("#rd-units .rd-unit-btn").forEach(b=>b.classList.toggle("active", b===btn));
    document.querySelectorAll("#rd-chips .rd-chip").forEach(c=>c.classList.remove("active"));
    radiusUpdateQueryButtonState();
    if(radiusCenter) radiusDrawCircle();
    radiusSchedulePreview();
  });
});
document.querySelectorAll("#rd-chips .rd-chip").forEach(chip=>{
  chip.addEventListener("click", ()=>{
    document.getElementById("rd-radius-input").value = chip.getAttribute("data-value");
    const unit = chip.getAttribute("data-unit");
    document.querySelectorAll("#rd-units .rd-unit-btn").forEach(b=>b.classList.toggle("active", b.getAttribute("data-unit")===unit));
    document.querySelectorAll("#rd-chips .rd-chip").forEach(c=>c.classList.toggle("active", c===chip));
    radiusUpdateQueryButtonState();
    if(radiusCenter) radiusDrawCircle();
    radiusSchedulePreview();
  });
});
document.getElementById("rd-copy-point").addEventListener("click", async ()=>{
  if(!radiusCenter) return;
  const text = `${radiusCenter.lat.toFixed(6)}, ${radiusCenter.lng.toFixed(6)}`;
  try{
    await navigator.clipboard.writeText(text);
    showToast("Coordenadas do ponto copiadas.");
  }catch(err){
    showToast("Não foi possível copiar as coordenadas.");
  }
});
document.getElementById("rd-query-btn").addEventListener("click", runRadiusQuery);
document.getElementById("rd-clear-btn").addEventListener("click", clearRadiusQuery);
document.getElementById("radius-clear-title").addEventListener("click", clearRadiusQuery);
document.getElementById("rd-use-location").addEventListener("click", ()=>{
  if(!navigator.geolocation){ showToast("Geolocalização não suportada neste navegador."); return; }
  showToast("Obtendo sua localização...");
  navigator.geolocation.getCurrentPosition(pos=>{
    const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    map.setView(latlng, Math.max(map.getZoom(), 16));
    setRadiusPoint(latlng);
  }, ()=> showToast("Não foi possível obter sua localização."));
});

/* ---- Busca, ordenação e exportação dentro do painel de resultados ---- */
document.getElementById("rd-res-search").addEventListener("input", ()=>{
  if(radiusModalResults) radiusRenderResultsBody();
});
document.getElementById("rd-res-sort").addEventListener("change", ()=>{
  if(radiusModalResults) radiusRenderResultsBody();
});
document.getElementById("rd-res-export-geojson").addEventListener("click", ()=>{
  if(!radiusModalResults || !Object.keys(radiusModalResults).length){ showToast("Não há resultados para exportar."); return; }
  const geojson = radiusBuildExportGeoJSON();
  const blob = new Blob([JSON.stringify(geojson,null,2)], {type:"application/geo+json"});
  downloadBlob(blob, "geoportal_dcx_consulta_por_raio.geojson");
  showToast("Resultados exportados em GeoJSON.");
});
document.getElementById("rd-res-export-csv").addEventListener("click", ()=>{
  if(!radiusModalResults || !Object.keys(radiusModalResults).length){ showToast("Não há resultados para exportar."); return; }
  const geojson = radiusBuildExportGeoJSON();
  const csv = geojsonToCSV(geojson);
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  downloadBlob(blob, "geoportal_dcx_consulta_por_raio.csv");
  showToast("Resultados exportados em CSV.");
});

/* ---- Filtro "Camadas a consultar" ---- */
function radiusUpdateLayerFilterSummary(){
  const summary = document.getElementById("rd-layers-summary");
  if(!summary) return;
  const total = DRAW_ORDER.filter(id=>LAYERS[id]).length;
  const excluded = [...radiusExcludedLayers].filter(id=>LAYERS[id]).length;
  summary.textContent = excluded===0 ? "todas" : `${total-excluded} de ${total}`;
}

function radiusRenderLayerFilter(){
  const list = document.getElementById("rd-layers-list");
  if(!list) return;
  const cats = {};
  DRAW_ORDER.filter(id=>LAYERS[id]).forEach(id=>{
    const c = LAYERS[id].category || "Outras";
    cats[c] = cats[c] || [];
    cats[c].push(id);
  });
  let html = "";
  Object.keys(cats).forEach(cat=>{
    html += `<div class="rd-layer-cat">${escapeHtml(cat)}</div>`;
    cats[cat].forEach(id=>{
      const layer = LAYERS[id];
      const checked = !radiusExcludedLayers.has(id);
      html += `<label class="rd-layer-check"><input type="checkbox" data-rd-layer="${id}" ${checked?"checked":""}> ${escapeHtml(layer.label)}</label>`;
    });
  });
  list.innerHTML = html;
  list.querySelectorAll("input[data-rd-layer]").forEach(cb=>{
    cb.addEventListener("change", e=>{
      const id = e.target.getAttribute("data-rd-layer");
      if(e.target.checked) radiusExcludedLayers.delete(id); else radiusExcludedLayers.add(id);
      radiusUpdateLayerFilterSummary();
      radiusSchedulePreview();
    });
  });
  radiusUpdateLayerFilterSummary();
}

const rdLayersToggle = document.getElementById("rd-layers-toggle");
const rdLayersPanel = document.getElementById("rd-layers-panel");
function radiusToggleLayerFilterPanel(){
  const willOpen = rdLayersPanel.hidden;
  if(willOpen) radiusRenderLayerFilter();
  rdLayersPanel.hidden = !willOpen;
  rdLayersToggle.setAttribute("aria-expanded", String(willOpen));
}
rdLayersToggle.addEventListener("click", radiusToggleLayerFilterPanel);
rdLayersToggle.addEventListener("keydown", e=>{
  if(e.key==="Enter" || e.key===" "){ e.preventDefault(); radiusToggleLayerFilterPanel(); }
});
document.getElementById("rd-layers-all").addEventListener("click", ()=>{
  radiusExcludedLayers.clear();
  radiusRenderLayerFilter();
  radiusSchedulePreview();
});
document.getElementById("rd-layers-none").addEventListener("click", ()=>{
  DRAW_ORDER.filter(id=>LAYERS[id]).forEach(id=>radiusExcludedLayers.add(id));
  radiusRenderLayerFilter();
  radiusSchedulePreview();
});
radiusUpdateLayerFilterSummary();

function radiusOnPanelOpen(){
  radiusUpdatePointReadout();
  radiusUpdateQueryButtonState();
  radiusUpdateLayerFilterSummary();
  if(rdLayersPanel && !rdLayersPanel.hidden) radiusRenderLayerFilter();
  radiusSchedulePreview();
}

/* ================= MODAL DE RESULTADOS — REDIMENSIONÁVEL E MOVÍVEL =================
   Mesmo padrão de arrastar (pela barra de título) e redimensionar (pelas
   bordas/cantos) já usado nos modais do Dashboard de Setores Censitários e
   do IBGE, aplicado aqui ao painel de resultados da Consulta por Raio. */
(function(){
  const box = document.getElementById("radius-results-box");
  if(!box) return;
  const overlay = document.getElementById("modal-radius-results");
  const GEOM_KEY = "radiusResultsModalGeom";
  function minW(){ return Math.min(360, window.innerWidth * 0.92); }
  function minH(){ return Math.min(260, window.innerHeight * 0.50); }

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

  const resetBtn = document.getElementById("radius-results-reset-size");
  if(resetBtn) resetBtn.addEventListener("click", resetGeom);

  window.addEventListener("resize", clampToViewport);

  if(overlay){
    new MutationObserver(()=>{
      if(overlay.classList.contains("open")) requestAnimationFrame(()=>box.focus());
    }).observe(overlay, {attributes:true, attributeFilter:["class"]});
  }
})();
