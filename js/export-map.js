/* Composição cartográfica e exportação do mapa visível. */
(() => {
  "use strict";

  /* ── Referências ao DOM ─────────────────────────────────── */
  const trigger       = document.getElementById("bb-map-export");
  const modal         = document.getElementById("modal-map-export");
  const page          = document.getElementById("map-export-page");
  const previewStage  = document.getElementById("map-export-preview-stage");
  const previewWrap   = document.getElementById("map-export-preview-wrap");
  const status        = document.getElementById("map-export-status");
  const previewStatus = document.getElementById("map-export-preview-status");
  const previewScale  = document.getElementById("map-export-preview-scale");
  const submit        = document.getElementById("map-export-submit");

  /* ── Constantes ─────────────────────────────────────────── */
  const paperSizes = { A4:[210,297], A3:[297,420], A2:[420,594] };

  /* ── Estado ─────────────────────────────────────────────── */
  const positions = {};
  let mapImageData      = "";
  let mapZoom           = 1;
  let mapPanX           = 0;
  let mapPanY           = 0;
  let dragState         = null;
  let selectedKey       = "map";
  let hasManualLayout   = false;
  let customElementCount = 0;
  let currentPreviewScale = 1;
  let zIndexCounter = 10;
  const dynamicElements = new Set();

  const elementNames = {
    map:"Moldura do mapa", title:"Título", legend:"Legenda das camadas",
    north:"Norte", scaleBar:"Escala gráfica", scaleText:"Escala numérica",
    coordinates:"Coordenadas", crs:"Projeção", source:"Fonte dos dados",
    date:"Data", brand:"Geoportal"
  };

  const defaultTexts = {
    title:  "Mapa de Duque de Caxias",
    source: "Dados geográficos do Geoportal | Mapa base: Esri",
    crs:    "SIRGAS 2000 / UTM 23S · EPSG:31983",
    brand:  ["GEOPORTAL","DUQUE DE CAXIAS"]
  };

  /* ── Layouts padrão ─────────────────────────────────────── */
  const landscapeLayout = {
    map:{x:.05,y:.15,w:.66,h:.68},  title:{x:.05,y:.035,w:.68,h:.075},
    legend:{x:.75,y:.15,w:.20,h:.68},
    scaleBar:{x:.065,y:.735,w:.23,h:.065},  scaleText:{x:.32,y:.755,w:.17,h:.045},
    north:{x:.645,y:.17,w:.05,h:.12},
    crs:{x:.05,y:.855,w:.62,h:.045},  source:{x:.05,y:.925,w:.67,h:.04},
    date:{x:.77,y:.105,w:.18,h:.03},  brand:{x:.77,y:.035,w:.18,h:.06},
    coordinates:{x:.75,y:.855,w:.20,h:.065}
  };
  const portraitLayout = {
    map:{x:.05,y:.14,w:.90,h:.48},  title:{x:.05,y:.035,w:.68,h:.065},
    legend:{x:.05,y:.64,w:.90,h:.24},
    scaleBar:{x:.07,y:.535,w:.23,h:.065},  scaleText:{x:.33,y:.555,w:.18,h:.045},
    north:{x:.87,y:.16,w:.055,h:.11},
    crs:{x:.05,y:.89,w:.90,h:.025},  source:{x:.05,y:.93,w:.68,h:.035},
    date:{x:.77,y:.105,w:.18,h:.025},  brand:{x:.77,y:.035,w:.18,h:.06},
    coordinates:{x:.69,y:.89,w:.26,h:.035}
  };

  /* ── Helpers de página ───────────────────────────────────── */
  function selectedOrientation(){
    return document.getElementById("map-export-orientation").value;
  }

  function pageDimensions(){
    const size = paperSizes[document.getElementById("map-export-paper").value] || paperSizes.A4;
    const landscape = selectedOrientation() === "landscape";
    const widthMM   = landscape ? size[1] : size[0];
    const heightMM  = landscape ? size[0] : size[1];
    return { widthMM, heightMM,
      widthPX:  Math.round(widthMM  / 25.4 * 96),
      heightPX: Math.round(heightMM / 25.4 * 96) };
  }

  function setStatus(message, isError = false){
    status.textContent = message;
    status.style.color = isError ? "var(--danger-red)" : "";
  }

  /* ── Fit da pré-visualização ─────────────────────────────── */
  function updatePreviewFit(){
    if(!page || !previewStage) return;
    const dims = pageDimensions();
    const availW = Math.max(120, previewStage.clientWidth  - 32);
    const availH = Math.max(120, previewStage.clientHeight - 32);
    const scale  = Math.min(1, availW / dims.widthPX, availH / dims.heightPX);
    currentPreviewScale = scale;

    page.style.transformOrigin = "top left";
    page.style.transform = `scale(${scale})`;
    previewWrap.style.width  = `${Math.ceil(dims.widthPX  * scale)}px`;
    previewWrap.style.height = `${Math.ceil(dims.heightPX * scale)}px`;

    /* Ajusta handles para manter tamanho visual fixo (~20px) independente do scale */
    const inv = 1 / scale;
    page.style.setProperty("--handle-inv-scale", String(inv));

    if(previewScale) previewScale.textContent = `${Math.round(scale * 100)}%`;
  }

  /* ── Layout e posições ───────────────────────────────────── */
  function applyOrientationLayout(){
    const defaults = selectedOrientation() === "landscape" ? landscapeLayout : portraitLayout;
    Object.keys(positions).forEach(k => delete positions[k]);
    Object.entries(defaults).forEach(([k, v]) => { positions[k] = { ...v }; });
    renderPositions();
  }

  function setDefaultLayout(){
    hasManualLayout = false;
    mapZoom = 1;
    mapPanX = 0;
    mapPanY = 0;
    const zoomEl = document.getElementById("map-export-zoom");
    if(zoomEl) zoomEl.value = "100";
    applyOrientationLayout();
    updateMapImageTransform();
    selectElement("map");
  }

  function applyPageSize(){
    const dims = pageDimensions();
    const baseWidth = selectedOrientation() === "landscape" ? 1123 : 794;
    page.dataset.orientation = selectedOrientation();
    page.style.width  = `${dims.widthPX}px`;
    page.style.height = `${dims.heightPX}px`;
    page.style.setProperty("--paper-scale", String(dims.widthPX / baseWidth));
    updatePreviewFit();
    updateScaleInformation();
  }

  function renderPositions(){
    page.querySelectorAll("[data-map-export-item]").forEach(item => {
      const pos = positions[item.dataset.mapExportItem];
      if(!pos) return;
      item.style.left   = `${pos.x * 100}%`;
      item.style.top    = `${pos.y * 100}%`;
      item.style.width  = `${pos.w * 100}%`;
      item.style.height = `${pos.h * 100}%`;
      item.tabIndex = 0;
      item.setAttribute("role","group");
      item.setAttribute("aria-label", elementNames[item.dataset.mapExportItem] || item.dataset.mapExportLabel || "Elemento do mapa");
    });
    updateScaleInformation();
    updatePropertyControls();
  }

  /* ── Texto de coordenadas ────────────────────────────────── */
  function updateCoordinateText(){
    try {
      if(!map || !positions.map) return;
      const dims       = pageDimensions();
      const frame      = positions.map;
      const mapSize    = map.getSize();
      const frameWidth  = dims.widthPX * frame.w;
      const frameHeight = dims.heightPX * frame.h;
      const imageScale  = Math.min(frameWidth / Math.max(mapSize.x,1), frameHeight / Math.max(mapSize.y,1)) * mapZoom;
      const translX = mapPanX / 100 * frameWidth;
      const translY = mapPanY / 100 * frameHeight;
      const imgW = mapSize.x * imageScale;
      const imgH = mapSize.y * imageScale;
      const visL = Math.max(0, (frameWidth  - imgW) / 2 + translX);
      const visR = Math.min(frameWidth,  (frameWidth  + imgW) / 2 + translX);
      const visT = Math.max(0, (frameHeight - imgH) / 2 + translY);
      const visB = Math.min(frameHeight, (frameHeight + imgH) / 2 + translY);
      const pt = (x, y) => map.containerPointToLatLng([
        mapSize.x / 2 + (x - frameWidth  / 2 - translX) / imageScale,
        mapSize.y / 2 + (y - frameHeight / 2 - translY) / imageScale
      ]);
      const corners = [pt(visL,visT), pt(visR,visT), pt(visL,visB), pt(visR,visB)];
      const south = Math.min(...corners.map(c => c.lat));
      const north = Math.max(...corners.map(c => c.lat));
      const west  = Math.min(...corners.map(c => c.lng));
      const east  = Math.max(...corners.map(c => c.lng));
      const fmt = v => v.toFixed(4) + "°";
      document.getElementById("map-export-coordinates-value").textContent =
        `Lat. ${fmt(south)} a ${fmt(north)}\nLon. ${fmt(west)} a ${fmt(east)}`;
    } catch(e) { /* mapa pode ainda não estar pronto */ }
  }

  /* ── Texto dos elementos ─────────────────────────────────── */
  function textForElement(key){
    if(key === "title")       return defaultTexts.title;
    if(key === "source")      return defaultTexts.source;
    if(key === "crs")         return defaultTexts.crs;
    if(key === "brand")       return defaultTexts.brand.join("\n");
    if(key === "date")        return document.getElementById("map-export-date-value").textContent;
    if(key === "coordinates") return document.getElementById("map-export-coordinates-value").textContent;
    const item = page.querySelector(`[data-map-export-item="${key}"]`);
    return item?.querySelector(".map-export-content")?.textContent || "";
  }

  function setElementText(key, value){
    if(key === "title")            defaultTexts.title = value;
    else if(key === "source")      defaultTexts.source = value;
    else if(key === "crs")         defaultTexts.crs = value;
    else if(key === "brand"){
      const lines = value.split("\n", 2);
      defaultTexts.brand = [lines[0] || "", lines[1] || ""];
    } else if(key === "date")        document.getElementById("map-export-date-value").textContent = value;
    else if(key === "coordinates")   document.getElementById("map-export-coordinates-value").textContent = value;
    else {
      const item = page.querySelector(`[data-map-export-item="${key}"]`);
      const target = item?.querySelector(".map-export-content");
      if(target) target.textContent = value;
    }
    syncText();
    updatePropertyControls();
  }

  function elementIsTextEditable(key){
    return ["title","source","crs","brand","date","coordinates"].includes(key) ||
      !!page.querySelector(`[data-map-export-item="${key}"] .map-export-content`);
  }

  /* ── Font-size: lê do custom property, não do computed style escalado ── */
  function baseFontSize(item){
    /* --element-font-size é o valor salvo explicitamente (em pt/px reais, sem scale) */
    const explicit = Number.parseFloat(item.style.getPropertyValue("--element-font-size"));
    if(explicit && explicit > 0) return explicit;
    /* Fallback: tenta inferir do computed style dividindo pelo paper-scale */
    const paperScale = Number.parseFloat(getComputedStyle(page).getPropertyValue("--paper-scale")) || 1;
    const computed   = Number.parseFloat(getComputedStyle(item).fontSize);
    if(!computed || !Number.isFinite(computed)) return 10;
    /* computed já está em px de tela (não sofre CSS transform), dividimos pelo paper-scale */
    return Math.round(computed / paperScale);
  }

  /* ── Controles de propriedade ────────────────────────────── */
  function updatePropertyControls(){
    const item  = page.querySelector(`[data-map-export-item="${selectedKey}"]`);
    if(!item) return;
    const entry    = document.querySelector(`[data-map-export-entry="${selectedKey}"]`);
    const textProp = document.getElementById("map-export-text-property");
    const logoProp = document.getElementById("map-export-logo-property");
    const mapProp  = document.getElementById("map-export-map-property");
    const editable = elementIsTextEditable(selectedKey);

    document.getElementById("map-export-selected-name").textContent =
      elementNames[selectedKey] || entry?.querySelector("[data-map-export-select]")?.textContent || "Elemento";
    document.getElementById("map-export-element-text").value = editable ? textForElement(selectedKey) : "";
    textProp.hidden = !editable;
    logoProp.hidden = selectedKey !== "logo" && !selectedKey.startsWith("logo-");
    mapProp.hidden  = selectedKey !== "map";
    const fileNameEl = document.getElementById("map-export-logo-file-name");
    if(fileNameEl) fileNameEl.textContent = item.dataset.mapExportFilename || "Nenhum logotipo selecionado";
    document.getElementById("map-export-remove-element").hidden = !dynamicElements.has(selectedKey);

    const geo = positions[selectedKey];
    if(geo){
      document.getElementById("map-export-x").value      = Math.round(geo.x * 100);
      document.getElementById("map-export-y").value      = Math.round(geo.y * 100);
      document.getElementById("map-export-width").value  = Math.round(geo.w * 100);
      document.getElementById("map-export-height").value = Math.round(geo.h * 100);
    }
    document.getElementById("map-export-font-size").value = baseFontSize(item);

    const colorProp = item.style.getPropertyValue("--element-color");
    let hexColor = "#202820";
    if(colorProp){
      const rgb = colorProp.match(/\d+/g);
      if(rgb?.length >= 3) hexColor = "#" + rgb.slice(0,3).map(v => Number(v).toString(16).padStart(2,"0")).join("");
      else if(/^#[0-9a-f]{3,6}$/i.test(colorProp)) hexColor = colorProp;
    }
    document.getElementById("map-export-color").value = hexColor;
    document.getElementById("map-export-align").value = item.style.textAlign || "left";

    /* Seleção visual nos itens da página */
    page.querySelectorAll("[data-map-export-item]").forEach(node => {
      const sel = node.dataset.mapExportItem === selectedKey;
      node.classList.toggle("is-selected", sel);
      node.setAttribute("aria-selected", String(sel));
    });

    /* Seleção visual na lista de elementos */
    document.querySelectorAll("[data-map-export-entry]").forEach(node => {
      const isActive = node.dataset.mapExportEntry === selectedKey;
      const btn = node.querySelector("[data-map-export-select]");
      btn?.setAttribute("aria-pressed", String(isActive));
      node.classList.toggle("is-active", isActive);
    });
  }

  function selectElement(key, focus = false){
    const item = page.querySelector(`[data-map-export-item="${key}"]`);
    if(!item) return;
    selectedKey = key;
    zIndexCounter++;
    item.style.zIndex = zIndexCounter;
    updatePropertyControls();
    if(focus) item.focus({ preventScroll: true });
  }

  /* ── Sincronização de textos ─────────────────────────────── */
  function syncText(){
    document.getElementById("map-export-title-value").textContent  = defaultTexts.title;
    document.getElementById("map-export-source-value").textContent = defaultTexts.source;
    document.getElementById("map-export-crs-value").textContent    = defaultTexts.crs;
    document.getElementById("map-export-brand").textContent        = defaultTexts.brand[0];
    document.getElementById("map-export-brand-subtitle").textContent = defaultTexts.brand[1];
  }

  /* ── Legenda ─────────────────────────────────────────────── */
  function renderVisibleLegend(){
    const list = document.getElementById("map-export-legend-list");
    const visibleIds = DRAW_ORDER.filter(id => LAYERS[id] && map.hasLayer(LAYERS[id].leaflet));
    const entries = [];

    const colorWithAlpha = (color, alpha) => {
      const m = /^#([\da-f]{6})$/i.exec(color || "");
      if(!m) return color;
      const v = Number.parseInt(m[1], 16);
      return `rgba(${v>>16},${(v>>8)&255},${v&255},${alpha})`;
    };

    /* Gera o HTML do swatch usando swatchHTML() (do painel principal) para
       consistência visual total — inclusive line, dash, icon, rail, gradient */
    const makeSwatch = (swatch) => {
      if(!swatch) return typeof swatchHTML === "function" ? swatchHTML(null) : '<div class="lp-swatch"></div>';
      /* Fill com opacidade: constrói inline style e delega ao swatchHTML se possível */
      if(swatch.type === "fill" && swatch.fillOpacity !== undefined){
        const bg  = colorWithAlpha(swatch.color, swatch.fillOpacity);
        const brd = colorWithAlpha(swatch.outlineColor || "#12140f", swatch.outlineOpacity ?? 1);
        return `<div class="lp-swatch" style="background:${bg};border:1px solid ${brd};border-radius:2px;"></div>`;
      }
      /* Todos os outros tipos: delega ao swatchHTML global */
      return typeof swatchHTML === "function"
        ? swatchHTML(swatch)
        : `<div class="lp-swatch" style="background:${swatch.color || '#aaa'};"></div>`;
    };

    const addEntry = (swatch, label) => {
      entries.push(`<div class="map-export-legend-entry">${makeSwatch(swatch)}<span>${escapeHtml(label)}</span></div>`);
    };

    visibleIds.forEach(id => {
      const layer = LAYERS[id];
      if(id === "bairros" && typeof districtEntries === "function"){
        entries.push(`<div class="map-export-legend-group">${escapeHtml(layer.label)}</div>`);
        districtEntries().forEach(d => addEntry({type:"fill",color:distColor(d),fillOpacity:.55,outlineColor:"#12140f",outlineOpacity:.6}, d));
      } else if(id === "censo" && Array.isArray(CENSO_COLORS)){
        addEntry(layer.swatch, layer.label);
        CENSO_COLORS.forEach((color, i) => addEntry({type:"fill",color}, censoRangeLabel(i)));
      } else if(id.startsWith("ucs_") && typeof ucCategoriesPresent === "function"){
        addEntry(layer.swatch, layer.label);
        const data = id === "ucs_estadual" ? DATA_UCS_ESTADUAL : (id === "ucs_federal" ? DATA_UCS_FEDERAL : DATA_UCS_MUNICIPAL);
        ucCategoriesPresent(data).forEach(cat => addEntry({type:"fill",color:ucColor(cat)}, cat));
      } else if(id === "plano_diretor" && typeof pdClassesPresent === "function"){
        addEntry(layer.swatch, layer.label);
        pdClassesPresent().forEach(cat => addEntry({type:"fill",color:pdColor(cat)}, cat));
      } else if(id !== "bairros") addEntry(layer.swatch, layer.label);
    });
    list.innerHTML = entries.join("") || '<div class="map-export-legend-entry">Nenhuma camada sobreposta visível</div>';
  }

  /* ── Visibilidade de elementos ───────────────────────────── */
  function updateElementVisibility(){
    document.querySelectorAll("[data-map-export-toggle]").forEach(input => {
      const item = page.querySelector(`[data-map-export-item="${input.dataset.mapExportToggle}"]`);
      if(item) item.style.display = input.checked ? "" : "none";
      const entry = document.querySelector(`[data-map-export-entry="${input.dataset.mapExportToggle}"]`);
      entry?.classList.toggle("is-hidden", !input.checked);
    });
  }

  /* ── Transformação da imagem do mapa ─────────────────────── */
  function updateMapImageTransform(){
    const image = document.getElementById("map-export-image");
    // panLimit: quanto o usuário pode deslocar antes de ver borda vazia
    const panLimit = (mapZoom - 1) * 50;
    mapPanX = Math.max(-panLimit, Math.min(panLimit, mapPanX));
    mapPanY = Math.max(-panLimit, Math.min(panLimit, mapPanY));
    // A img está position:absolute; top:50%; left:50%
    // Combinamos: centralização (-50%,-50%) + pan do usuário + scale
    image.style.transform = `translate(calc(-50% + ${mapPanX}%), calc(-50% + ${mapPanY}%)) scale(${mapZoom})`;
    const zoomOut = document.getElementById("map-export-zoom-value");
    const zoomPct = `${Math.round(mapZoom * 100)}%`;
    if(zoomOut){ zoomOut.value = zoomPct; zoomOut.textContent = zoomPct; }
    updateCoordinateText();
    updateScaleInformation();
  }

  /* ── Cálculo de escala cartográfica ─────────────────────── */
  function updateScaleInformation(){
    if(!map || !positions.map) return;
    try {
      const centerLat = map.getCenter().lat * Math.PI / 180;
      const mpp = Math.cos(centerLat) * 156543.03392804097 / Math.pow(2, map.getZoom());
      const dims = pageDimensions();
      const size = map.getSize();
      const fW = dims.widthPX  * positions.map.w;
      const fH = dims.heightPX * positions.map.h;
      const imgScale = Math.min(fW / Math.max(size.x,1), fH / Math.max(size.y,1));
      const denom = mpp * 96 / (0.0254 * imgScale * mapZoom);
      if(!Number.isFinite(denom) || denom <= 0) return;
      document.getElementById("map-export-scale-value").textContent = `1:${Math.round(denom).toLocaleString("pt-BR")}`;
      const distances = [10000,5000,2000,1000,500,250,100];
      const dist = distances.find(d => d / denom * 96 / 0.0254 <= 145) || 100;
      const barW = Math.max(24, dist / denom * 96 / 0.0254);
      document.querySelector(".map-export-scale-line").style.width = `${barW}px`;
      document.getElementById("map-export-scale-distance").textContent = dist >= 1000 ? `${dist/1000} km` : `${dist} m`;
      updateCoordinateText();
    } catch(e) {}
  }

  /* ── Captura do mapa ─────────────────────────────────────── */
  async function captureCurrentMap(){
    if(typeof html2canvas !== "function"){
      previewStatus.textContent = "Biblioteca de captura indisponível.";
      setStatus("Não foi possível iniciar a captura do mapa.", true);
      submit.disabled = true;
      return;
    }
    previewStatus.textContent = "Atualizando…";
    setStatus("Capturando a extensão visível do mapa…");
    submit.disabled = true;
    try {
      renderVisibleLegend();
      updateCoordinateText();
      const qualityScale = Math.min(3, Math.max(1, Number(document.getElementById("map-export-dpi").value) / 96));
      const canvas = await html2canvas(map.getContainer(), {
        backgroundColor:"#f4f6f5", useCORS:true, allowTaint:false,
        scale:qualityScale, logging:false, imageTimeout:20000
      });
      mapImageData = canvas.toDataURL("image/png");
      const img = document.getElementById("map-export-image");
      img.src = mapImageData;
      await img.decode();
      previewStatus.textContent = "Extensão atual carregada";
      setStatus("");
      submit.disabled = false;
      updateScaleInformation();
    } catch(err){
      console.error("Falha ao capturar o mapa para exportação:", err);
      previewStatus.textContent = "Falha ao atualizar a prévia";
      setStatus("A captura do mapa falhou. Verifique a conexão com o mapa base e tente novamente.", true);
      submit.disabled = !mapImageData;
    }
  }

  /* ── Abertura do compositor ──────────────────────────────── */
  function openComposer(){
    if(typeof closeToolsMenu === "function") closeToolsMenu();
    openModal("modal-map-export");
    modal.querySelector(".map-export-dialog").focus({ preventScroll:true });
    applyPageSize();
    syncText();
    renderVisibleLegend();
    updateElementVisibility();
    requestAnimationFrame(updatePreviewFit);
    captureCurrentMap();
  }

  /* ── Clamp e snap de posição ─────────────────────────────── */
  function clampPosition(pos, isResize = false){
    if (isResize) {
      pos.x = Math.max(0, pos.x);
      pos.y = Math.max(0, pos.y);
      pos.w = Math.max(.055, Math.min(1 - pos.x, pos.w));
      pos.h = Math.max(.025, Math.min(1 - pos.y, pos.h));
    } else {
      pos.w = Math.max(.055, Math.min(1, pos.w));
      pos.h = Math.max(.025, Math.min(1, pos.h));
      pos.x = Math.max(0, Math.min(1 - pos.w, pos.x));
      pos.y = Math.max(0, Math.min(1 - pos.h, pos.y));
    }
  }

  function snapPosition(key, pos){
    const guideX = page.querySelector(".map-export-guide-x");
    const guideY = page.querySelector(".map-export-guide-y");
    let snappedX = null, snappedY = null;
    const candidates = Object.entries(positions).filter(([k]) => k !== key);
    const snapAxis = (axis, origin, size) => {
      const moving  = [origin, origin + size/2, origin + size];
      const targets = [0, .05, .5, .95, 1];
      candidates.forEach(([, other]) => {
        const start  = axis === "x" ? other.x : other.y;
        const length = axis === "x" ? other.w : other.h;
        targets.push(start, start + length/2, start + length);
      });
      let best = null;
      moving.forEach(v => targets.forEach(t => {
        const d = t - v;
        if(Math.abs(d) <= .012 && (!best || Math.abs(d) < Math.abs(best.delta))) best = { target:t, delta:d };
      }));
      return best;
    };
    const x = snapAxis("x", pos.x, pos.w);
    const y = snapAxis("y", pos.y, pos.h);
    if(x){ pos.x += x.delta; snappedX = x.target; }
    if(y){ pos.y += y.delta; snappedY = y.target; }
    if(guideX){ guideX.style.display = snappedX === null ? "none" : "block"; if(snappedX !== null) guideX.style.left = `${snappedX*100}%`; }
    if(guideY){ guideY.style.display = snappedY === null ? "none" : "block"; if(snappedY !== null) guideY.style.top  = `${snappedY*100}%`; }
    clampPosition(pos);
  }

  function hideGuides(){
    page.querySelectorAll(".map-export-guide").forEach(g => g.style.display = "none");
  }

  /* ── Criação de handles ──────────────────────────────────── */
  function makeHandle(className, label){
    const h = document.createElement("button");
    h.type = "button";
    h.className = className;
    h.setAttribute("aria-label", label);
    if(className === "map-export-grip") h.textContent = "⁝";
    return h;
  }

  /* ── Adicionar entrada na lista de elementos ─────────────── */
  function addListEntry(key, label){
    const row    = document.createElement("label");
    row.dataset.mapExportEntry = key;
    const select = document.createElement("button");
    select.type  = "button";
    select.dataset.mapExportSelect = key;
    select.textContent = label;
    const visible = document.createElement("input");
    visible.type = "checkbox";
    visible.checked = true;
    visible.dataset.mapExportToggle = key;
    visible.setAttribute("aria-label", `Exibir ${label.toLowerCase()}`);
    row.append(select, visible);
    document.getElementById("map-export-element-list").appendChild(row);
    visible.addEventListener("change", updateElementVisibility);
    select.addEventListener("click",  () => selectElement(key, true));
  }

  /* ── Adicionar texto personalizado ───────────────────────── */
  function addTextElement(){
    const key = `text-${++customElementCount}`;
    elementNames[key] = `Texto ${customElementCount}`;
    dynamicElements.add(key);
    positions[key] = { x:.40, y:.82, w:.20, h:.06 };
    const item = document.createElement("div");
    item.className = "map-export-item map-export-custom-text";
    item.dataset.mapExportItem  = key;
    item.dataset.mapExportLabel = elementNames[key];
    const text = document.createElement("span");
    text.className   = "map-export-content";
    text.textContent = "Novo texto";
    item.append(text, makeHandle("map-export-grip",`Mover ${elementNames[key]}`), makeHandle("map-export-resize",`Redimensionar ${elementNames[key]}`));
    page.insertBefore(item, page.querySelector(".map-export-guide-x"));
    addListEntry(key, elementNames[key]);
    renderPositions();
    selectElement(key, true);
  }

  /* ── Adicionar logotipo ──────────────────────────────────── */
  function addLogoElement(file){
    if(!file || !file.type.startsWith("image/")) return;
    if(file.size > 5 * 1024 * 1024){ setStatus("O logotipo deve ter até 5 MB.", true); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const key = `logo-${++customElementCount}`;
      elementNames[key] = "Logotipo";
      dynamicElements.add(key);
      positions[key] = { x:.75, y:.78, w:.16, h:.10 };
      const item = document.createElement("div");
      item.className = "map-export-item map-export-logo";
      item.dataset.mapExportItem  = key;
      item.dataset.mapExportLabel = "Logotipo";
      item.dataset.mapExportFilename = file.name;
      const img = document.createElement("img");
      img.className = "map-export-logo-image";
      img.alt = "Logotipo";
      img.src = String(reader.result);
      item.append(img, makeHandle("map-export-grip","Mover logotipo"), makeHandle("map-export-resize","Redimensionar logotipo"));
      page.insertBefore(item, page.querySelector(".map-export-guide-x"));
      addListEntry(key, "Logotipo");
      renderPositions();
      selectElement(key, true);
    };
    reader.readAsDataURL(file);
  }

  /* ── Remover elemento dinâmico ───────────────────────────── */
  function removeSelectedElement(){
    if(!dynamicElements.has(selectedKey)) return;
    page.querySelector(`[data-map-export-item="${selectedKey}"]`)?.remove();
    document.querySelector(`[data-map-export-entry="${selectedKey}"]`)?.remove();
    delete positions[selectedKey];
    delete elementNames[selectedKey];
    dynamicElements.delete(selectedKey);
    selectElement("map", true);
    renderPositions();
  }

  /* ── Restaurar layout padrão ─────────────────────────────── */
  function restoreDefaultLayout(){
    [...dynamicElements].forEach(key => {
      page.querySelector(`[data-map-export-item="${key}"]`)?.remove();
      document.querySelector(`[data-map-export-entry="${key}"]`)?.remove();
      delete positions[key];
      delete elementNames[key];
    });
    dynamicElements.clear();
    customElementCount = 0;
    document.querySelectorAll("[data-map-export-toggle]").forEach(inp => { inp.checked = true; });
    document.querySelectorAll("[data-map-export-item]").forEach(item => {
      item.style.removeProperty("--element-color");
      item.style.removeProperty("--element-font-size");
      item.style.removeProperty("font-size");
      item.style.removeProperty("text-align");
      item.style.removeProperty("justify-content");
      item.style.removeProperty("z-index");
      item.classList.remove("has-custom-font-size");
    });
    defaultTexts.title  = "Mapa de Duque de Caxias";
    defaultTexts.source = "Dados geográficos do Geoportal | Mapa base: Esri";
    defaultTexts.crs    = "SIRGAS 2000 / UTM 23S · EPSG:31983";
    defaultTexts.brand  = ["GEOPORTAL","DUQUE DE CAXIAS"];
    document.getElementById("map-export-date-value").textContent =
      new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
    syncText();
    updateCoordinateText();
    setDefaultLayout();
    updateElementVisibility();
  }

  /* ── Eventos de pointer (drag/resize/pan) ────────────────── */
  page.addEventListener("pointerdown", event => {
    const item = event.target.closest("[data-map-export-item]");
    if(!item) return;
    const key      = item.dataset.mapExportItem;
    const isResize = event.target.closest(".map-export-resize");
    const isGrip   = event.target.closest(".map-export-grip");
    // Pan: qualquer clique dentro do frame do mapa sem grip/resize
    const isInsideMap = key === "map" && !isResize && !isGrip;
    selectElement(key, false);

    if(isResize){
      dragState = { mode:"resize", key, startX:event.clientX, startY:event.clientY, initial:{...positions[key]}, rect:page.getBoundingClientRect() };
    } else if(isGrip && key === "map"){
      /* Mover o frame do mapa via grip */
      dragState = { mode:"move", key, startX:event.clientX, startY:event.clientY, initial:{...positions[key]}, rect:page.getBoundingClientRect() };
    } else if(isInsideMap){
      /* Pan da imagem interna — usa getBoundingClientRect do frame do mapa */
      dragState = { mode:"pan", key, startX:event.clientX, startY:event.clientY, initialX:mapPanX, initialY:mapPanY, rect:item.getBoundingClientRect() };
    } else if(isGrip || key !== "map"){
      /* Mover qualquer outro elemento */
      dragState = { mode:"move", key, startX:event.clientX, startY:event.clientY, initial:{...positions[key]}, rect:page.getBoundingClientRect() };
    } else {
      return;
    }
    event.preventDefault();
    try { item.setPointerCapture(event.pointerId); } catch(e) {}
  });

  page.addEventListener("pointermove", event => {
    if(!dragState) return;
    if(dragState.mode === "pan"){
      /* Pan da imagem interna: proporcional ao tamanho do frame escalado */
      mapPanX = dragState.initialX + (event.clientX - dragState.startX) / Math.max(dragState.rect.width,  1) * 100;
      mapPanY = dragState.initialY + (event.clientY - dragState.startY) / Math.max(dragState.rect.height, 1) * 100;
      updateMapImageTransform();
      return;
    }
    /* Move e resize: delta em frações da página */
    const rect = dragState.rect; // BoundingClientRect do page (escalado)
    const dx = (event.clientX - dragState.startX) / Math.max(rect.width,  1);
    const dy = (event.clientY - dragState.startY) / Math.max(rect.height, 1);
    const next = positions[dragState.key];
    if(dragState.mode === "move"){
      next.x = dragState.initial.x + dx;
      next.y = dragState.initial.y + dy;
      snapPosition(dragState.key, next);
    } else {
      next.w = dragState.initial.w + dx;
      next.h = dragState.initial.h + dy;
      clampPosition(next, true);
    }
    hasManualLayout = true;
    renderPositions();
  });

  const finishDrag = () => { dragState = null; hideGuides(); };
  page.addEventListener("pointerup",     finishDrag);
  page.addEventListener("pointercancel", finishDrag);

  /* Garante que guias desaparecem se ponteiro sair do documento */
  document.addEventListener("pointerup",     () => { if(dragState){ dragState = null; hideGuides(); } });
  document.addEventListener("pointercancel", () => { if(dragState){ dragState = null; hideGuides(); } });

  /* ── Teclado: mover/redimensionar elemento selecionado ───── */
  page.addEventListener("keydown", event => {
    const item = event.target.closest("[data-map-export-item]");
    if(!item) return;
    const key = item.dataset.mapExportItem;
    if(event.key === "Delete" && dynamicElements.has(key)){
      event.preventDefault();
      selectElement(key);
      removeSelectedElement();
      return;
    }
    if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    selectElement(key);
    const pos  = positions[key];
    const step = event.shiftKey ? .02 : .005;
    if(event.shiftKey){
      pos.w += event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
      pos.h += event.key === "ArrowDown"  ? step : event.key === "ArrowUp"   ? -step : 0;
      clampPosition(pos, true);
    } else {
      pos.x += event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
      pos.y += event.key === "ArrowDown"  ? step : event.key === "ArrowUp"   ? -step : 0;
      clampPosition(pos, false);
    }
    hasManualLayout = true;
    renderPositions();
  });

  /* ── Exportação ──────────────────────────────────────────── */
  function canvasBlob(canvas, mimeType, quality){
    return new Promise((resolve, reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível codificar a imagem.")), mimeType, quality));
  }

  async function createPdfBlob(canvas){
    const dims = pageDimensions();
    const imageBlob  = await canvasBlob(canvas, "image/jpeg", .94);
    const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
    const wPt = dims.widthMM  / 25.4 * 72;
    const hPt = dims.heightMM / 25.4 * 72;
    const enc  = new TextEncoder();
    const text = v => enc.encode(v);
    const streamCmd = `q ${wPt.toFixed(3)} 0 0 ${hPt.toFixed(3)} 0 0 cm /Im0 Do Q`;
    const objects = [
      [text(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)],
      [text(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`)],
      [text(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(3)} ${hPt.toFixed(3)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`)],
      [text(`4 0 obj\n<< /Length ${text(streamCmd).length} >>\nstream\n${streamCmd}\nendstream\nendobj\n`)],
      [text(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`), imageBytes, text("\nendstream\nendobj\n")]
    ];
    const parts   = [text("%PDF-1.4\n")];
    const offsets = [0];
    let byteOffset = parts[0].length;
    objects.forEach(objParts => {
      offsets.push(byteOffset);
      objParts.forEach(p => { parts.push(p); byteOffset += p.length; });
    });
    const xrefOffset = byteOffset;
    const xref = `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    parts.push(text(xref));
    return new Blob(parts, { type:"application/pdf" });
  }

  function download(blob, filename){
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function exportMap(){
    if(!mapImageData || typeof html2canvas !== "function"){
      setStatus("Atualize a pré-visualização antes de exportar.", true);
      return;
    }
    submit.disabled = true;
    setStatus("Compondo o arquivo final…");
    const dims  = pageDimensions();
    const dpi   = Number(document.getElementById("map-export-dpi").value);
    const outW  = Math.round(dims.widthPX  * dpi / 96);
    const outH  = Math.round(dims.heightPX * dpi / 96);
    if(outW * outH > 50000000){
      setStatus("Este tamanho/resolução excede o limite de imagem do navegador. Escolha uma resolução menor.", true);
      submit.disabled = false;
      return;
    }
    /* Clone da página sem transforms, bordas e handles */
    const clone = page.cloneNode(true);
    clone.id = "map-export-render-page";
    clone.classList.add("map-export-rendering");
    clone.style.cssText = `position:relative;left:auto;top:auto;transform:none;box-shadow:none;width:${dims.widthPX}px;height:${dims.heightPX}px;`;
    clone.querySelectorAll(".is-selected").forEach(el => el.classList.remove("is-selected"));
    clone.querySelectorAll(".map-export-grip,.map-export-resize").forEach(h => h.remove());
    /* Remove --handle-inv-scale que só serve para o editor */
    clone.style.removeProperty("--handle-inv-scale");
    const holder = document.createElement("div");
    holder.style.cssText = `position:fixed;left:-200000px;top:0;width:${dims.widthPX}px;height:${dims.heightPX}px;overflow:hidden;pointer-events:none;z-index:-1;`;
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      const canvas = await html2canvas(clone, {
        backgroundColor:"#ffffff", useCORS:true, allowTaint:false,
        scale:dpi / 96, logging:false, imageTimeout:20000
      });
      const format = document.getElementById("map-export-format").value;
      const now    = new Date();
      const stamp  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
      const title  = slugifyFileName(defaultTexts.title || "mapa");
      if(format === "pdf") download(await createPdfBlob(canvas), `geoportal_dcx_${title}_${stamp}.pdf`);
      else download(await canvasBlob(canvas, format === "jpg" ? "image/jpeg" : "image/png", .94), `geoportal_dcx_${title}_${stamp}.${format}`);
      setStatus("Arquivo gerado e baixado com sucesso.");
    } catch(err){
      console.error("Falha ao exportar a composição do mapa:", err);
      setStatus("Não foi possível gerar o arquivo. Reduza a resolução e tente novamente.", true);
    } finally {
      holder.remove();
      submit.disabled = false;
    }
  }

  /* ── Helper: atualiza propriedade de geometria via inputs ── */
  function updateGeometryProperty(id, property){
    const value = Number(document.getElementById(id).value) / 100;
    if(!Number.isFinite(value)) return;
    if(!positions[selectedKey]) return;
    positions[selectedKey][property] = value;
    clampPosition(positions[selectedKey], property === "w" || property === "h");
    hasManualLayout = true;
    renderPositions();
  }

  /* ── Ligação de eventos ──────────────────────────────────── */
  trigger.addEventListener("click", openComposer);

  modal.addEventListener("click", event => {
    if(event.target === modal){
      closeModal("modal-map-export");
      document.getElementById("bb-tools").focus();
    }
    if(event.target.closest('[data-close="modal-map-export"]'))
      requestAnimationFrame(() => document.getElementById("bb-tools").focus());
  });

  document.addEventListener("keydown", event => {
    if(event.key === "Escape" && modal.classList.contains("open")){
      closeModal("modal-map-export");
      document.getElementById("bb-tools").focus();
    }
  }, true);

  document.getElementById("map-export-refresh").addEventListener("click", captureCurrentMap);
  document.getElementById("map-export-submit").addEventListener("click",  exportMap);
  document.getElementById("map-export-reset").addEventListener("click",   restoreDefaultLayout);
  document.getElementById("map-export-add-text").addEventListener("click", addTextElement);
  document.getElementById("map-export-add-logo").addEventListener("click", () => document.getElementById("map-export-logo-file").click());
  document.getElementById("map-export-logo-file").addEventListener("change", event => {
    addLogoElement(event.target.files[0]);
    event.target.value = "";
  });

  document.getElementById("map-export-element-list").addEventListener("click", event => {
    const btn = event.target.closest("[data-map-export-select]");
    if(btn) selectElement(btn.dataset.mapExportSelect, true);
  });

  document.getElementById("map-export-element-text").addEventListener("input", event => setElementText(selectedKey, event.target.value));

  document.getElementById("map-export-x").addEventListener("change",      () => updateGeometryProperty("map-export-x",      "x"));
  document.getElementById("map-export-y").addEventListener("change",      () => updateGeometryProperty("map-export-y",      "y"));
  document.getElementById("map-export-width").addEventListener("change",  () => updateGeometryProperty("map-export-width",  "w"));
  document.getElementById("map-export-height").addEventListener("change", () => updateGeometryProperty("map-export-height", "h"));

  document.getElementById("map-export-font-size").addEventListener("change", event => {
    const item = page.querySelector(`[data-map-export-item="${selectedKey}"]`);
    if(!item) return;
    const size = Math.max(7, Math.min(72, Number(event.target.value) || 10));
    item.style.setProperty("--element-font-size", String(size));
    item.classList.add("has-custom-font-size");
  });

  document.getElementById("map-export-color").addEventListener("input", event => {
    const item = page.querySelector(`[data-map-export-item="${selectedKey}"]`);
    if(item) item.style.setProperty("--element-color", event.target.value);
  });

  document.getElementById("map-export-align").addEventListener("change", event => {
    const item = page.querySelector(`[data-map-export-item="${selectedKey}"]`);
    if(!item) return;
    item.style.textAlign = event.target.value;
    if(item.classList.contains("map-export-title") || item.classList.contains("map-export-custom-text")) item.style.justifyContent = event.target.value === "center" ? "center" : event.target.value === "right" ? "flex-end" : "flex-start";
    if(item.classList.contains("map-export-brand")) item.style.alignItems     = event.target.value === "center" ? "center" : event.target.value === "left"  ? "flex-start" : "flex-end";
  });

  document.getElementById("map-export-remove-element").addEventListener("click", removeSelectedElement);
  document.querySelectorAll("[data-map-export-toggle]").forEach(inp => inp.addEventListener("change", updateElementVisibility));

  document.getElementById("map-export-zoom").addEventListener("input", event => {
    mapZoom = Number(event.target.value) / 100;
    updateMapImageTransform();
  });

  const zoomReset = document.getElementById("map-export-zoom-reset");
  if(zoomReset) zoomReset.addEventListener("click", () => {
    mapZoom = 1; mapPanX = 0; mapPanY = 0;
    const zoomEl = document.getElementById("map-export-zoom");
    if(zoomEl) zoomEl.value = "100";
    updateMapImageTransform();
  });

  document.getElementById("map-export-paper").addEventListener("change", applyPageSize);
  document.getElementById("map-export-orientation").addEventListener("change", () => {
    applyPageSize();
    if(hasManualLayout){
      Object.values(positions).forEach(clampPosition);
      renderPositions();
    } else applyOrientationLayout();
  });
  document.getElementById("map-export-dpi").addEventListener("change", () => {
    if(mapImageData) captureCurrentMap();
  });

  window.addEventListener("resize", updatePreviewFit);
  if(window.ResizeObserver) new ResizeObserver(updatePreviewFit).observe(previewStage);

  /* ── Inicialização ───────────────────────────────────────── */
  setDefaultLayout();
  applyPageSize();
  syncText();
  document.getElementById("map-export-date-value").textContent =
    new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
  updateCoordinateText();
  renderVisibleLegend();
  updateElementVisibility();
  selectElement("map");
  if(map) map.on("moveend", updateCoordinateText);
})();