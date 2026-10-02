/* ============================================================
   ferramentas.js - Medição, desenho, coordenadas, escala e ferramentas
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= SALVAR CAMADAS (EXPORTAÇÃO) ================= */
// Formatos suportados e a que tipo de geometria cada um se aplica.
// "any" = ponto, linha ou polígono. "point" = somente camadas de pontos.
const EXPORT_FORMATS = [
  { id:"geojson", label:"GeoJSON (.geojson)",        ext:"geojson", applies:"any"   },
  { id:"kml",     label:"KML (.kml)",                 ext:"kml",     applies:"any"   },
  { id:"kmz",     label:"KMZ (.kmz)",                 ext:"kmz",     applies:"any"   },
  { id:"shp",     label:"Shapefile (.zip: .shp/.shx/.dbf/.prj)", ext:"zip", applies:"any" },
  { id:"csv",     label:"CSV (.csv) — camadas de pontos", ext:"csv", applies:"point" },
];

// Remove acentos e caracteres especiais para gerar nomes de arquivo seguros
function slugifyFileName(text){
  return (text||"camada")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"") || "camada";
}

// Analisa os tipos de geometria presentes numa FeatureCollection
function detectGeomKind(geojson){
  const types = new Set();
  (geojson.features||[]).forEach(f=>{
    const t = f.geometry && f.geometry.type;
    if(!t) return;
    if(t==="Point"||t==="MultiPoint") types.add("point");
    else if(t==="LineString"||t==="MultiLineString") types.add("line");
    else if(t==="Polygon"||t==="MultiPolygon") types.add("polygon");
    else types.add("outro");
  });
  if(types.size===1) return [...types][0];
  if(types.size===0) return "vazio";
  return "mista";
}

function getExportableLayerIds(){
  return DRAW_ORDER.filter(id=>LAYERS[id]);
}

function getLayerGeoJSONClone(id){
  const gj = LAYERS[id].leaflet.toGeoJSON();
  // clone para não expor/alterar por engano a referência interna do Leaflet
  return JSON.parse(JSON.stringify(gj));
}

// Tenta identificar uma propriedade de "nome" para usar no KML
function detectNameProp(geojson){
  const candidates = ["Name","NOME","Nome","nome","NAME","name","NOME_BAIRRO","Distrito"];
  const first = (geojson.features||[])[0];
  if(!first || !first.properties) return null;
  const keys = Object.keys(first.properties);
  for(const c of candidates){ if(keys.includes(c)) return c; }
  return null;
}

function downloadBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}

function geojsonToCSV(geojson){
  const feats = geojson.features||[];
  const propKeys = [];
  feats.forEach(f=>{
    Object.keys(f.properties||{}).forEach(k=>{ if(!propKeys.includes(k)) propKeys.push(k); });
  });
  const header = ["longitude","latitude", ...propKeys];
  const esc = v=>{
    if(v===null||v===undefined) return "";
    const s = String(v).replace(/"/g,'""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  const lines = [header.map(esc).join(",")];
  feats.forEach(f=>{
    let lon = "", lat = "";
    if(f.geometry && f.geometry.type==="Point"){
      lon = f.geometry.coordinates[0]; lat = f.geometry.coordinates[1];
    } else if(f.geometry && f.geometry.type==="MultiPoint" && f.geometry.coordinates[0]){
      lon = f.geometry.coordinates[0][0]; lat = f.geometry.coordinates[0][1];
    }
    const row = [lon, lat, ...propKeys.map(k=> (f.properties||{})[k])];
    lines.push(row.map(esc).join(","));
  });
  return "\uFEFF" + lines.join("\r\n"); // BOM para acentuação correta no Excel
}

function setExportStatus(msg, isError){
  const el = document.getElementById("exp-status");
  el.textContent = msg || "";
  el.classList.toggle("exp-error", !!isError);
}

function renderExportFormatOptions(layerId){
  const geojson = getLayerGeoJSONClone(layerId);
  const geomKind = detectGeomKind(geojson);
  const sel = document.getElementById("exp-format-select");
  const prevValue = sel.value;
  sel.innerHTML = EXPORT_FORMATS.map(f=>{
    const supported = f.applies==="any" || (f.applies==="point" && geomKind==="point");
    return `<option value="${f.id}" ${supported?"":"disabled"}>${f.label}${supported?"":" — indisponível para este tipo de camada"}</option>`;
  }).join("");
  // mantém o formato escolhido se ainda for válido; senão volta para GeoJSON
  const stillValid = [...sel.options].some(o=>o.value===prevValue && !o.disabled);
  sel.value = stillValid ? prevValue : "geojson";

  const layer = LAYERS[layerId];
  const geomLabel = {point:"Pontos", line:"Linhas", polygon:"Polígonos", mista:"Geometria mista", vazio:"Sem feições"}[geomKind] || geomKind;
  document.getElementById("exp-info").innerHTML =
    `<b>${layer.label}</b><br>${geojson.features.length} feição(ões) · ${geomLabel}<br>Sistema de referência: WGS 84 (EPSG:4326)`;
  setExportStatus("");
}

function renderExportPanel(){
  const sel = document.getElementById("exp-layer-select");
  const cats = {};
  getExportableLayerIds().forEach(id=>{
    const c = LAYERS[id].category || "Outras";
    cats[c] = cats[c] || [];
    cats[c].push(id);
  });
  sel.innerHTML = Object.keys(cats).map(cat=>
    `<optgroup label="${cat}">${cats[cat].map(id=>`<option value="${id}">${LAYERS[id].label}</option>`).join("")}</optgroup>`
  ).join("");
  renderExportFormatOptions(sel.value);
  setExportStatus("");
}

document.getElementById("exp-layer-select").addEventListener("change", e=>{
  renderExportFormatOptions(e.target.value);
});

document.getElementById("exp-download-btn").addEventListener("click", async ()=>{
  const layerId = document.getElementById("exp-layer-select").value;
  const format = document.getElementById("exp-format-select").value;
  const layer = LAYERS[layerId];
  if(!layer){ return; }
  const geojson = getLayerGeoJSONClone(layerId);
  if(!geojson.features.length){
    setExportStatus("Esta camada não possui feições para exportar.", true);
    return;
  }
  const slug = "geoportal_dcx_" + slugifyFileName(layer.label);
  setExportStatus("Gerando arquivo...");
  try{
    if(format==="geojson"){
      const blob = new Blob([JSON.stringify(geojson,null,2)], {type:"application/geo+json"});
      downloadBlob(blob, `${slug}.geojson`);
    } else if(format==="csv"){
      const csv = geojsonToCSV(geojson);
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
      downloadBlob(blob, `${slug}.csv`);
    } else if(format==="kml" || format==="kmz"){
      const nameProp = detectNameProp(geojson);
      const kmlStr = tokml(geojson, nameProp ? {name:nameProp} : {});
      if(format==="kml"){
        const blob = new Blob([kmlStr], {type:"application/vnd.google-earth.kml+xml"});
        downloadBlob(blob, `${slug}.kml`);
      } else {
        const zip = new JSZip();
        zip.file("doc.kml", kmlStr);
        const blob = await zip.generateAsync({type:"blob"});
        downloadBlob(blob, `${slug}.kmz`);
      }
    } else if(format==="shp"){
      const blob = await shpwrite.zip(geojson, {outputType:"blob", compression:"DEFLATE", folder:slug, filename:slug});
      downloadBlob(blob, `${slug}.zip`);
    }
    setExportStatus("Arquivo exportado e baixado com sucesso.");
    showToast(`Camada "${layer.label}" exportada em ${format.toUpperCase()}.`);
  } catch(err){
    console.error("Falha ao exportar camada:", err);
    setExportStatus("Não foi possível gerar o arquivo para este formato/camada.", true);
  }
});

/* ================= SKETCH TOOL ================= */
const sketchLayer = L.featureGroup().addTo(map);
let sketchMode = "off";
let sketchDraft = null; // temp points for polyline/polygon
let sketches = [];       // {id, type, layer, style, latlngs}
let sketchIdSeq = 1;
let sketchStyle = { color:"#5eead4", weight:3, fillColor:"#5eead4", fillOpacity:0.2 };
let editingSketchId = null;
let editHandles = [];    // ordered draggable vertex markers
const editHandlesLayer = L.featureGroup().addTo(map);

function positionFlyout(box, anchorBtn){
  // position is now fixed via CSS (top:14px; right:12px) for all panels
}

function isAnyMapToolActive(){
  return sketchMode!=="off" || measureMode!=="off" || (typeof radiusPointMode!=="undefined" && radiusPointMode);
}

// Cancela qualquer ferramenta de clique-no-mapa em uso (Esboço, Medir,
// Consulta por Raio) e qualquer edição de esboço em andamento, descartando
// desenhos/medições não finalizados. Usado pela tecla ESC.
function cancelActiveTools(){
  let cancelled = false;
  if(typeof editingSketchId!=="undefined" && editingSketchId){ stopEditingSketch(); cancelled = true; }
  if(sketchMode!=="off"){ setSketchMode("off"); cancelled = true; }
  if(measureMode!=="off"){ setMeasureMode("off"); cancelled = true; }
  if(typeof radiusPointMode!=="undefined" && (radiusPointMode || (typeof radiusCenter!=="undefined" && radiusCenter)) && typeof clearRadiusQuery==="function"){
    clearRadiusQuery();
    cancelled = true;
  }
  return cancelled;
}

function updateToolCursorAndDblClick(){
  const anyToolActive = isAnyMapToolActive();
  map.getContainer().style.cursor = anyToolActive ? "crosshair" : "";
  if(anyToolActive){ map.doubleClickZoom.disable(); } else { map.doubleClickZoom.enable(); }
}

function setSketchMode(mode){
  sketchMode = mode;
  if(sketchDraft && sketchDraft.layer) sketchLayer.removeLayer(sketchDraft.layer);
  sketchDraft = null;
  document.querySelectorAll("#sketch-box .sk-item[data-mode]").forEach(it=>it.classList.toggle("active", it.getAttribute("data-mode")===mode));
  const activeAny = mode!=="off";
  document.getElementById("bb-sketch").classList.toggle("active", activeAny);
  document.getElementById("bb-sketch").setAttribute("aria-pressed", String(activeAny));
  updateToolCursorAndDblClick();
}

function makeVertexIcon(){
  return L.divIcon({className:"sk-vertex-icon", html:"", iconSize:[12,12], iconAnchor:[6,6]});
}

function registerSketch(type, layer, style, latlngs){
  const id = "sk"+(sketchIdSeq++);
  sketches.push({id, type, layer, style:{...style}, latlngs: latlngs.map(p=>L.latLng(p.lat,p.lng))});
  renderSketchList();
  return id;
}

function renderSketchList(){
  const list = document.getElementById("sk-list");
  if(!list) return;
  if(!sketches.length){ list.innerHTML=""; list.style.display="none"; return; }
  list.style.display="block";
  list.innerHTML = sketches.map(s=>{
    const icon = s.type==="marker" ? "&#128204;" : (s.type==="polyline" ? "&#9585;" : "&#9723;");
    const editing = (editingSketchId===s.id);
    const editBtn = s.type!=="marker" ? `<span class="sk-item-edit" data-id="${s.id}">${editing?"concluir":"editar"}</span>` : "";
    return `<div class="sk-list-item${editing?' editing':''}" data-id="${s.id}">
      <span class="sk-swatch" style="background:${s.style.color}"></span>
      <span class="sk-list-label">${icon}</span>
      <span class="sk-list-actions">${editBtn}<span class="sk-item-del" data-id="${s.id}" title="Excluir">&#10006;</span></span>
    </div>`;
  }).join("");
  list.querySelectorAll(".sk-item-del").forEach(btn=>{
    btn.addEventListener("click",(ev)=>{ ev.stopPropagation(); deleteSketch(btn.getAttribute("data-id")); });
  });
  list.querySelectorAll(".sk-item-edit").forEach(btn=>{
    btn.addEventListener("click",(ev)=>{ ev.stopPropagation(); toggleEditSketch(btn.getAttribute("data-id")); });
  });
}

function deleteSketch(id){
  const idx = sketches.findIndex(s=>s.id===id);
  if(idx<0) return;
  if(editingSketchId===id) stopEditingSketch();
  sketchLayer.removeLayer(sketches[idx].layer);
  sketches.splice(idx,1);
  renderSketchList();
  showToast("Esboço removido.");
}

function stopEditingSketch(){
  if(!editingSketchId) return;
  editHandlesLayer.clearLayers();
  editHandles = [];
  editingSketchId = null;
  renderSketchList();
}

function startEditingSketch(id){
  stopEditingSketch();
  const s = sketches.find(x=>x.id===id);
  if(!s || s.type==="marker") return;
  setSketchMode("off");
  editingSketchId = id;
  const latlngs = s.type==="polygon" ? s.layer.getLatLngs()[0] : s.layer.getLatLngs();
  editHandles = latlngs.map(ll=>{
    const handle = L.marker(ll, {icon:makeVertexIcon(), draggable:true, zIndexOffset:1000}).addTo(editHandlesLayer);
    handle.on("drag", ()=>updateEditedGeometry(s));
    return handle;
  });
  syncSketchStyleInputs(s.style);
  renderSketchList();
  showToast("Arraste os pontos para editar o esboço.");
}

function toggleEditSketch(id){
  if(editingSketchId===id){ stopEditingSketch(); } else { startEditingSketch(id); }
}

function updateEditedGeometry(s){
  const newLatLngs = editHandles.map(h=>h.getLatLng());
  if(s.type==="polygon"){ s.layer.setLatLngs([newLatLngs]); } else { s.layer.setLatLngs(newLatLngs); }
  s.latlngs = newLatLngs.map(p=>L.latLng(p.lat,p.lng));
}

function syncSketchStyleInputs(style){
  const st = style || sketchStyle;
  document.getElementById("sk-line-color").value = st.color;
  document.getElementById("sk-line-weight").value = st.weight;
  document.getElementById("sk-line-weight-val").textContent = st.weight+"px";
  document.getElementById("sk-fill-color").value = st.fillColor || st.color;
  const op = st.fillOpacity!=null ? Math.round(st.fillOpacity*100) : 20;
  document.getElementById("sk-fill-opacity").value = op;
  document.getElementById("sk-fill-opacity-val").textContent = op+"%";
}

function applyStyleToEditingSketch(){
  if(!editingSketchId) return;
  const s = sketches.find(x=>x.id===editingSketchId);
  if(!s) return;
  s.style = {...sketchStyle};
  if(s.type==="polygon"){
    s.layer.setStyle({color:sketchStyle.color, weight:sketchStyle.weight, fillColor:sketchStyle.fillColor, fillOpacity:sketchStyle.fillOpacity});
  } else if(s.type==="polyline"){
    s.layer.setStyle({color:sketchStyle.color, weight:sketchStyle.weight});
  }
  renderSketchList();
}

document.getElementById("sk-line-color").addEventListener("input", e=>{
  sketchStyle.color = e.target.value;
  applyStyleToEditingSketch();
});
document.getElementById("sk-line-weight").addEventListener("input", e=>{
  sketchStyle.weight = parseInt(e.target.value,10);
  document.getElementById("sk-line-weight-val").textContent = sketchStyle.weight+"px";
  applyStyleToEditingSketch();
});
document.getElementById("sk-fill-color").addEventListener("input", e=>{
  sketchStyle.fillColor = e.target.value;
  applyStyleToEditingSketch();
});
document.getElementById("sk-fill-opacity").addEventListener("input", e=>{
  sketchStyle.fillOpacity = parseInt(e.target.value,10)/100;
  document.getElementById("sk-fill-opacity-val").textContent = e.target.value+"%";
  applyStyleToEditingSketch();
});

function handleToolClick(e){
  if(sketchMode==="marker"){
    const layer = L.marker(e.latlng, {icon:makeDotIcon(sketchStyle.color,"&#9998;",18)}).addTo(sketchLayer);
    registerSketch("marker", layer, {color:sketchStyle.color}, [e.latlng]);
  } else if(sketchMode==="polyline" || sketchMode==="polygon"){
    if(!sketchDraft){ sketchDraft = {pts:[e.latlng], layer:null, type:sketchMode}; }
    else { sketchDraft.pts.push(e.latlng); }
    if(sketchDraft.layer) sketchLayer.removeLayer(sketchDraft.layer);
    const Ctor = sketchDraft.type==="polyline" ? L.polyline : L.polygon;
    const opts = sketchDraft.type==="polyline"
      ? {color:sketchStyle.color, weight:sketchStyle.weight, dashArray:"4,4"}
      : {color:sketchStyle.color, weight:sketchStyle.weight, fillColor:sketchStyle.fillColor, fillOpacity:sketchStyle.fillOpacity};
    sketchDraft.layer = Ctor(sketchDraft.pts, opts).addTo(sketchLayer);
  } else if(measureMode==="distance" || measureMode==="area"){
    handleMeasureClick(e.latlng);
  } else if(typeof radiusPointMode!=="undefined" && radiusPointMode){
    setRadiusPoint(e.latlng);
  }
}
map.on("click", handleToolClick);
map.on("dblclick", ()=>{
  if((sketchMode==="polyline"||sketchMode==="polygon") && sketchDraft){
    const minPts = sketchDraft.type==="polygon" ? 3 : 2;
    if(sketchDraft.pts.length>=minPts){
      sketchDraft.layer.setStyle({dashArray:null});
      registerSketch(sketchDraft.type, sketchDraft.layer,
        sketchDraft.type==="polygon"
          ? {color:sketchStyle.color, weight:sketchStyle.weight, fillColor:sketchStyle.fillColor, fillOpacity:sketchStyle.fillOpacity}
          : {color:sketchStyle.color, weight:sketchStyle.weight},
        sketchDraft.pts.slice());
    } else {
      sketchLayer.removeLayer(sketchDraft.layer);
    }
    sketchDraft = null;
  }
  if((measureMode==="distance"||measureMode==="area") && measurePts.length){ finalizeMeasureDraft(); }
});

document.getElementById("sketch-clear").addEventListener("click",()=>{
  stopEditingSketch();
  sketchLayer.clearLayers();
  sketches = [];
  sketchDraft = null;
  renderSketchList();
  showToast("Esboços removidos.");
});
document.getElementById("sketch-export").addEventListener("click",()=>{
  if(!sketches.length){ showToast("Nenhum esboço para exportar."); return; }
  const features = sketches.map(s=>{
    let geometry;
    if(s.type==="marker"){
      const ll = s.layer.getLatLng();
      geometry = {type:"Point", coordinates:[ll.lng, ll.lat]};
    } else if(s.type==="polyline"){
      geometry = {type:"LineString", coordinates:s.layer.getLatLngs().map(p=>[p.lng,p.lat])};
    } else {
      const ring = s.layer.getLatLngs()[0].map(p=>[p.lng,p.lat]);
      if(ring.length && (ring[0][0]!==ring[ring.length-1][0] || ring[0][1]!==ring[ring.length-1][1])) ring.push(ring[0]);
      geometry = {type:"Polygon", coordinates:[ring]};
    }
    return {type:"Feature", properties:{
      id:s.id, tipo:s.type, cor:s.style.color, espessura:s.style.weight,
      cor_preenchimento: s.style.fillColor!=null ? s.style.fillColor : null,
      opacidade_preenchimento: s.style.fillOpacity!=null ? s.style.fillOpacity : null
    }, geometry};
  });
  const fc = {type:"FeatureCollection", features};
  const blob = new Blob([JSON.stringify(fc,null,2)], {type:"application/geo+json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "geoportal_dcx_esbocos.geojson";
  a.click();
  showToast("Esboços exportados em GeoJSON.");
});
document.querySelectorAll("#sketch-box .sk-item[data-mode]").forEach(item=>{
  item.addEventListener("click",()=>{
    const mode = item.getAttribute("data-mode");
    if(mode!=="off") stopEditingSketch();
    setSketchMode(mode==="off" ? "off" : mode);
    closeAllPanels();
  });
});


/* ================= MEASURE TOOL ================= */
let measureMode = "off";
let measurePts = [];
let measureDraftGroup = null;
const measureLayer = L.featureGroup().addTo(map);
const measureReadout = document.getElementById("measure-readout");
let measureUnit = { distance:"m", area:"m2" };
let measurements = []; // {id, type, points, group, value}
let measureIdSeq = 1;

function planarAreaM2(latlngs){
  // aproximação equirretangular (adequada para escala municipal)
  const R = 6378137;
  const lat0 = latlngs.reduce((s,p)=>s+p.lat,0)/latlngs.length * Math.PI/180;
  const pts = latlngs.map(p=>({
    x: p.lng*Math.PI/180 * R * Math.cos(lat0),
    y: p.lat*Math.PI/180 * R
  }));
  let area=0;
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    area += pts[i].x*pts[j].y - pts[j].x*pts[i].y;
  }
  return Math.abs(area/2);
}

function formatDistance(m){
  return measureUnit.distance==="km" ? (m/1000).toFixed(2)+" km" : m.toFixed(0)+" m";
}
function formatArea(m2){
  return measureUnit.area==="ha" ? (m2/10000).toFixed(2)+" ha" : m2.toFixed(0)+" m²";
}
function makeMeasureTooltip(latlng, text, extraClass){
  return L.tooltip({permanent:true, direction:"center", className:"measure-tooltip"+(extraClass?(" "+extraClass):""), interactive:false})
    .setLatLng(latlng).setContent(text);
}

function buildMeasureGroup(type, points){
  const group = L.featureGroup();
  if(type==="distance"){
    L.polyline(points, {color:"#ffd54f", weight:3}).addTo(group);
    points.forEach(p=>L.circleMarker(p,{radius:4,color:"#ffd54f",fillColor:"#ffd54f",fillOpacity:1,interactive:false}).addTo(group));
    let total=0;
    for(let i=1;i<points.length;i++){
      const d = points[i-1].distanceTo(points[i]);
      total += d;
      const mid = L.latLng((points[i-1].lat+points[i].lat)/2, (points[i-1].lng+points[i].lng)/2);
      if(points.length>2) makeMeasureTooltip(mid, formatDistance(d)).addTo(group);
    }
    if(points.length>1){
      makeMeasureTooltip(points[points.length-1], "Total: "+formatDistance(total), "measure-tooltip-total").addTo(group);
    }
    return {group, value:total};
  } else {
    L.polygon(points, {color:"#ffd54f", weight:3, fillOpacity:0.15}).addTo(group);
    points.forEach(p=>L.circleMarker(p,{radius:4,color:"#ffd54f",fillColor:"#ffd54f",fillOpacity:1,interactive:false}).addTo(group));
    const a = planarAreaM2(points);
    const center = points.reduce((acc,p)=>[acc[0]+p.lat/points.length, acc[1]+p.lng/points.length], [0,0]);
    makeMeasureTooltip(L.latLng(center[0],center[1]), formatArea(a), "measure-tooltip-total").addTo(group);
    return {group, value:a};
  }
}

function handleMeasureClick(latlng){
  measurePts.push(latlng);
  if(measureDraftGroup){ measureLayer.removeLayer(measureDraftGroup); measureDraftGroup=null; }
  if(measureMode==="distance"){
    if(measurePts.length===1){
      measureDraftGroup = L.featureGroup([L.circleMarker(latlng,{radius:4,color:"#ffd54f",fillColor:"#ffd54f",fillOpacity:1,interactive:false})]);
    } else {
      measureDraftGroup = buildMeasureGroup("distance", measurePts).group;
    }
  } else if(measureMode==="area"){
    if(measurePts.length<3){
      measureDraftGroup = L.featureGroup(measurePts.map(p=>L.circleMarker(p,{radius:4,color:"#ffd54f",fillColor:"#ffd54f",fillOpacity:1,interactive:false})));
    } else {
      measureDraftGroup = buildMeasureGroup("area", measurePts).group;
    }
  }
  measureDraftGroup.addTo(measureLayer);
  updateMeasureReadout();
}

function updateMeasureReadout(){
  if(measureMode==="distance" && measurePts.length>1){
    let total=0;
    for(let i=1;i<measurePts.length;i++) total += measurePts[i-1].distanceTo(measurePts[i]);
    measureReadout.style.display="block";
    measureReadout.textContent = "Distância: "+formatDistance(total);
    positionReadout();
  } else if(measureMode==="area" && measurePts.length>=3){
    const a = planarAreaM2(measurePts);
    measureReadout.style.display="block";
    measureReadout.textContent = "Área: "+formatArea(a);
    positionReadout();
  } else {
    measureReadout.style.display="none";
  }
}

function positionReadout(){
  const mapRect = document.getElementById("map").getBoundingClientRect();
  measureReadout.style.left = (mapRect.width/2 - 70) + "px";
  measureReadout.style.top = "16px";
}

function finalizeMeasureDraft(){
  if(measureMode==="distance" && measurePts.length>=2){
    commitMeasurement("distance", measurePts.slice());
  } else if(measureMode==="area" && measurePts.length>=3){
    commitMeasurement("area", measurePts.slice());
  }
  if(measureDraftGroup){ measureLayer.removeLayer(measureDraftGroup); measureDraftGroup=null; }
  measurePts = [];
  measureReadout.style.display="none";
}

function commitMeasurement(type, points){
  const {group, value} = buildMeasureGroup(type, points);
  group.addTo(measureLayer);
  const id = "m"+(measureIdSeq++);
  measurements.push({id, type, points, group, value});
  renderMeasureList();
  showToast((type==="distance"?"Medição de distância":"Medição de área")+" adicionada.");
}

function removeMeasurement(id){
  const idx = measurements.findIndex(m=>m.id===id);
  if(idx<0) return;
  measureLayer.removeLayer(measurements[idx].group);
  measurements.splice(idx,1);
  renderMeasureList();
}

function refreshAllMeasurements(){
  measurements.forEach(m=>{
    measureLayer.removeLayer(m.group);
    const {group, value} = buildMeasureGroup(m.type, m.points);
    m.group = group; m.value = value;
    group.addTo(measureLayer);
  });
  renderMeasureList();
}

function renderMeasureList(){
  const list = document.getElementById("ms-list");
  if(!list) return;
  if(!measurements.length){ list.innerHTML=""; list.style.display="none"; return; }
  list.style.display="block";
  list.innerHTML = measurements.map(m=>{
    const label = m.type==="distance" ? ("&#128207; "+formatDistance(m.value)) : ("&#9633; "+formatArea(m.value));
    return `<div class="ms-list-item" data-id="${m.id}"><span>${label}</span><span class="ms-item-del" data-id="${m.id}" title="Remover">&#10006;</span></div>`;
  }).join("");
  list.querySelectorAll(".ms-item-del").forEach(btn=>{
    btn.addEventListener("click",(ev)=>{ ev.stopPropagation(); removeMeasurement(btn.getAttribute("data-id")); });
  });
  list.querySelectorAll(".ms-list-item").forEach(row=>{
    row.addEventListener("click",()=>{
      const m = measurements.find(x=>x.id===row.getAttribute("data-id"));
      if(m && m.group.getBounds){
        const b = m.group.getBounds();
        if(b.isValid()) map.fitBounds(b, {padding:[40,40], maxZoom:18});
      }
    });
  });
}

function syncMeasureUI(){
  document.querySelectorAll("#measure-box .ms-item[data-mode]").forEach(it=>it.classList.toggle("active", it.getAttribute("data-mode")===measureMode));
  document.getElementById("ms-units-distance").style.display = (measureMode==="distance") ? "flex" : "none";
  document.getElementById("ms-units-area").style.display = (measureMode==="area") ? "flex" : "none";
}

function setMeasureMode(mode){
  if(measureDraftGroup){ measureLayer.removeLayer(measureDraftGroup); measureDraftGroup=null; }
  measurePts = [];
  measureReadout.style.display="none";
  measureMode = mode;
  if(mode==="off"){
    measureLayer.clearLayers();
    measurements = [];
    renderMeasureList();
  }
  document.getElementById("bb-measure").classList.toggle("active", mode!=="off");
  document.getElementById("bb-measure").setAttribute("aria-pressed", String(mode!=="off"));
  syncMeasureUI();
  updateToolCursorAndDblClick();
}

document.querySelectorAll("#measure-box .ms-item[data-mode]").forEach(item=>{
  item.addEventListener("click",()=>{
    setMeasureMode(item.getAttribute("data-mode"));
    closeAllPanels();
  });
});
document.querySelectorAll(".ms-unit-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const type = btn.getAttribute("data-unit-type");
    const unit = btn.getAttribute("data-unit");
    measureUnit[type] = unit;
    document.querySelectorAll('.ms-unit-btn[data-unit-type="'+type+'"]').forEach(b=>b.classList.toggle("active", b===btn));
    refreshAllMeasurements();
    if(measureDraftGroup && ((measureMode==="distance" && measurePts.length>1) || (measureMode==="area" && measurePts.length>=3))){
      measureLayer.removeLayer(measureDraftGroup);
      measureDraftGroup = buildMeasureGroup(measureMode, measurePts).group;
      measureDraftGroup.addTo(measureLayer);
    }
    updateMeasureReadout();
  });
});

/* ================= LEFT TOOLBAR ================= */
document.getElementById("lt-home").addEventListener("click",()=>{ map.setView(HOME_VIEW.center, HOME_VIEW.zoom); });
document.getElementById("lt-zoomin").addEventListener("click",()=>map.zoomIn());
document.getElementById("lt-zoomout").addEventListener("click",()=>map.zoomOut());
document.getElementById("btn-about").addEventListener("click",()=>openModal("modal-about"));
document.getElementById("btn-help").addEventListener("click",()=>openModal("modal-help"));
document.getElementById("lt-locate").addEventListener("click",()=>{
  if(!navigator.geolocation){ showToast("Geolocalização não suportada neste navegador."); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const latlng = [pos.coords.latitude, pos.coords.longitude];
    L.circleMarker(latlng,{radius:7,color:"#5eead4",fillColor:"#5eead4",fillOpacity:0.9}).addTo(map).bindPopup("Você está aqui").openPopup();
    map.setView(latlng, 15);
  }, ()=> showToast("Não foi possível obter sua localização."));
});

/* search */
const searchBox = document.getElementById("search-box");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const searchChipsEl = document.getElementById("search-chips");

function openSearchBox(){
  closeAllPanels();
  searchBox.style.display = "block";
  searchInput.focus();
}
function closeSearchBox(){
  searchBox.style.display = "none";
}
document.getElementById("lt-search").addEventListener("click",()=>{
  const willOpen = searchBox.style.display!=="block";
  if(willOpen) openSearchBox(); else closeSearchBox();
});
document.getElementById("search-close").addEventListener("click",()=>{
  closeSearchBox();
});

// Categorias de busca (chips). "cat" liga cada item do índice a um grupo de filtro;
// "layers" liga cada categoria às camadas correspondentes em LAYERS.
const SEARCH_CATEGORIES = [
  {key:"bairros",      label:"Bairros"},
  {key:"escolas",      label:"Escolas"},
  {key:"saude",        label:"Saúde"},
  {key:"estacoes",     label:"Estações"},
  {key:"cemiterios",   label:"Cemitérios"},
  {key:"religiao",     label:"Religião"},
  {key:"reservatorio", label:"Reservatórios"},
  {key:"cultura_turismo", label:"Cultura e Turismo"},
  {key:"seguranca",    label:"Segurança"},
  {key:"secretarias",  label:"Secretarias"},
  {key:"terminais",    label:"Terminais"},
  {key:"assistencia_social", label:"Assistência Social"},
  {key:"plano_diretor", label:"Plano Diretor"},
  {key:"vias",         label:"Vias"},
  {key:"ferrovia",     label:"Ferrovias"},
  {key:"ucs",          label:"UCs"},
  {key:"hidrografia",  label:"Hidrografia"}
];
const SEARCH_ACTIVE_CATEGORIES = new Set(); // vazio = busca tudo

function normalizeStr(s){
  return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function buildSearchIndex(){
  const idx = [];
  const push = (name, tag, layerId, feature, cat) => {
    if(!name || !normalizeStr(name)) return;
    idx.push({name:name.trim(), tag, layerId, feature, cat, normName:normalizeStr(name)});
  };
  DATA_BAIRROS.features.forEach(f=> push(f.properties.Name, "Bairro · "+(f.properties.Distrito||""), "bairros", f, "bairros"));
  DATA_ESCOLAS.features.forEach(f=> push(f.properties.NOME, "Escola · "+(f.properties.TIPO||f.properties.BAIRRO||""), "escolas", f, "escolas"));
  DATA_SAUDE.features.forEach(f=> push(f.properties.NOME, "Saúde · "+(f.properties.TIPO||f.properties.BAIRRO||""), "saude", f, "saude"));
  DATA_ESTACOES.features.forEach(f=> push(f.properties.Name, "Estação · "+(f.properties.Ramal||""), "estacoes", f, "estacoes"));
  DATA_CEMITERIOS.features.forEach(f=> push(f.properties.NOME, "Cemitério"+(f.properties.TIPOCEMITE&&normalizeStr(f.properties.TIPOCEMITE)?(" · "+f.properties.TIPOCEMITE):""), "cemiterios", f, "cemiterios"));
  DATA_RELIGIAO.features.forEach(f=> push(f.properties.NOME, "Religião"+(f.properties.TIPOEDIFRE&&normalizeStr(f.properties.TIPOEDIFRE)?(" · "+f.properties.TIPOEDIFRE):""), "religiao", f, "religiao"));
  DATA_RESERVATORIO.features.forEach(f=> push(f.properties.NOME, "Reservatório"+(f.properties.TIPODEPABA&&normalizeStr(f.properties.TIPODEPABA)?(" · "+f.properties.TIPODEPABA):""), "reservatorio", f, "reservatorio"));
  DATA_CULTURA_TURISMO.features.forEach(f=> push(f.properties.NOME, "Cultura e Turismo"+(f.properties.TIPO?(" · "+f.properties.TIPO):""), "cultura_turismo", f, "cultura_turismo"));
  DATA_SEGURANCA.features.forEach(f=> push(f.properties.PTREF, "Segurança"+(f.properties.Orgao?(" · "+f.properties.Orgao):""), "seguranca", f, "seguranca"));
  DATA_SECRETARIAS.features.forEach(f=> push(f.properties.SECRETARIA, "Secretaria Municipal", "secretarias", f, "secretarias"));
  DATA_TERMINAIS.features.forEach(f=> push(f.properties.NOME, "Terminal"+(f.properties.TIPOEDIFRO?(" · "+f.properties.TIPOEDIFRO):""), "terminais", f, "terminais"));
  DATA_ASSISTENCIA_SOCIAL.features.forEach(f=> push(f.properties.NOME, "Assistência Social"+(f.properties.TIPO?(" · "+f.properties.TIPO):""), "assistencia_social", f, "assistencia_social"));
  DATA_PLANO_DIRETOR.features.forEach(f=> push(f.properties.Zona, "Plano Diretor"+(f.properties.Zona_2?(" · "+String(f.properties.Zona_2).trim()):""), "plano_diretor", f, "plano_diretor"));
  DATA_VIAS.features.forEach(f=> push(f.properties.NOME, "Via"+(f.properties.Classifica&&normalizeStr(f.properties.Classifica)?(" · "+f.properties.Classifica):""), "vias", f, "vias"));
  DATA_FERROVIA.features.forEach(f=> push(f.properties.NOME, "Ferrovia"+(f.properties.Ramal&&normalizeStr(f.properties.Ramal)?(" · "+f.properties.Ramal):""), "ferrovia", f, "ferrovia"));
  if(DATA_UCS_ESTADUAL.features) DATA_UCS_ESTADUAL.features.forEach(f=> push(f.properties.nome_uc, "UC Estadual", "ucs_estadual", f, "ucs"));
  if(DATA_UCS_FEDERAL.features) DATA_UCS_FEDERAL.features.forEach(f=> push(f.properties.nome_uc, "UC Federal", "ucs_federal", f, "ucs"));
  if(DATA_UCS_MUNICIPAL.features) DATA_UCS_MUNICIPAL.features.forEach(f=> push(f.properties.nome_uc, "UC Municipal", "ucs_municipal", f, "ucs"));
  if(DATA_HIDROGRAFIA.features) DATA_HIDROGRAFIA.features.forEach(f=> push(f.properties.NOME, "Hidrografia"+(f.properties.Tipo&&normalizeStr(f.properties.Tipo)?(" · "+f.properties.Tipo.trim()):""), "hidrografia", f, "hidrografia"));
  return idx;
}
const SEARCH_INDEX = buildSearchIndex();

function renderSearchChips(){
  searchChipsEl.innerHTML = SEARCH_CATEGORIES.map(c=>
    `<div class="search-chip${SEARCH_ACTIVE_CATEGORIES.has(c.key)?" active":""}" data-cat="${c.key}">${c.label}</div>`
  ).join("");
  searchChipsEl.querySelectorAll(".search-chip").forEach(el=>{
    el.addEventListener("click",()=>{
      const cat = el.getAttribute("data-cat");
      if(SEARCH_ACTIVE_CATEGORIES.has(cat)) SEARCH_ACTIVE_CATEGORIES.delete(cat);
      else SEARCH_ACTIVE_CATEGORIES.add(cat);
      renderSearchChips();
      runSearch();
    });
  });
}
renderSearchChips();

let currentSearchMatches = [];
let searchSelectedIndex = -1;

function computeSearchMatches(rawQuery){
  const q = normalizeStr(rawQuery);
  let pool = SEARCH_INDEX;
  if(SEARCH_ACTIVE_CATEGORIES.size>0) pool = pool.filter(it=>SEARCH_ACTIVE_CATEGORIES.has(it.cat));
  if(q.length===0){
    if(SEARCH_ACTIVE_CATEGORIES.size===0) return [];
    return pool.slice().sort((a,b)=>a.normName.localeCompare(b.normName,"pt")).slice(0,30);
  }
  const scored = [];
  for(let i=0;i<pool.length;i++){
    const it = pool[i];
    const idx = it.normName.indexOf(q);
    if(idx===-1) continue;
    scored.push({it, idx});
  }
  scored.sort((a,b)=> (a.idx-b.idx) || a.it.normName.localeCompare(b.it.normName,"pt"));
  return scored.slice(0,30).map(s=>s.it);
}

function updateSearchSelectionHighlight(){
  searchResults.querySelectorAll(".search-item[data-idx]").forEach(el=>{
    const isSel = +el.getAttribute("data-idx")===searchSelectedIndex;
    el.classList.toggle("selected", isSel);
    if(isSel) el.scrollIntoView({block:"nearest"});
  });
}

function renderSearchResultsList(){
  searchSelectedIndex = -1;
  if(currentSearchMatches.length===0){
    searchResults.innerHTML = (searchInput.value.trim().length>0 || SEARCH_ACTIVE_CATEGORIES.size>0)
      ? `<div class="search-item" style="cursor:default;">Nenhum resultado</div>` : "";
    return;
  }
  searchResults.innerHTML = currentSearchMatches.map((m,i)=>`<div class="search-item" data-idx="${i}">${m.name}<span class="tag">${m.tag}</span></div>`).join("");
  searchResults.querySelectorAll(".search-item[data-idx]").forEach(el=>{
    el.addEventListener("click",()=>{
      selectSearchResult(currentSearchMatches[+el.getAttribute("data-idx")]);
    });
    el.addEventListener("mouseenter",()=>{
      searchSelectedIndex = +el.getAttribute("data-idx");
      updateSearchSelectionHighlight();
    });
  });
}

function runSearch(){
  currentSearchMatches = computeSearchMatches(searchInput.value);
  renderSearchResultsList();
}
searchInput.addEventListener("input", runSearch);

searchInput.addEventListener("keydown", e=>{
  if(e.key==="ArrowDown"){
    e.preventDefault();
    if(currentSearchMatches.length===0) return;
    searchSelectedIndex = Math.min(searchSelectedIndex+1, currentSearchMatches.length-1);
    updateSearchSelectionHighlight();
  } else if(e.key==="ArrowUp"){
    e.preventDefault();
    if(currentSearchMatches.length===0) return;
    searchSelectedIndex = Math.max(searchSelectedIndex-1, 0);
    updateSearchSelectionHighlight();
  } else if(e.key==="Enter"){
    e.preventDefault();
    if(searchSelectedIndex>=0 && currentSearchMatches[searchSelectedIndex]) selectSearchResult(currentSearchMatches[searchSelectedIndex]);
    else if(currentSearchMatches.length===1) selectSearchResult(currentSearchMatches[0]);
  } else if(e.key==="Escape"){
    closeSearchBox();
    searchInput.blur();
  }
});

// Ctrl+K abre a busca; Esc fecha (mesmo com foco fora do campo)
document.addEventListener("keydown", e=>{
  if((e.ctrlKey || e.metaKey) && (e.key==="k" || e.key==="K")){
    e.preventDefault();
    openSearchBox();
  } else if(e.key==="Escape" && searchBox.style.display==="block"){
    closeSearchBox();
  }
});

/* destaque pulsante no mapa (~3s) + voo até a feição + popup */
let _searchHighlightLayer = null;
let _searchHighlightTimer = null;
function clearSearchHighlight(){
  if(_searchHighlightLayer){ map.removeLayer(_searchHighlightLayer); _searchHighlightLayer=null; }
  if(_searchHighlightTimer){ clearTimeout(_searchHighlightTimer); _searchHighlightTimer=null; }
}
function addSearchPulse(target, isBounds){
  clearSearchHighlight();
  const opts = {color:"#5eead4", weight:3, fill:false, pane:"paneHighlight", className:"search-pulse-path", interactive:false};
  _searchHighlightLayer = isBounds ? L.rectangle(target, opts).addTo(map) : L.circleMarker(target, Object.assign({radius:16}, opts)).addTo(map);
  _searchHighlightTimer = setTimeout(()=>{ if(_searchHighlightLayer){ map.removeLayer(_searchHighlightLayer); _searchHighlightLayer=null; } _searchHighlightTimer=null; }, 3000);
}
function openSearchFeaturePopup(m){
  const layerObj = LAYERS[m.layerId];
  if(!layerObj) return;
  if(!map.hasLayer(layerObj.leaflet)) toggleLayer(m.layerId, true);
  layerObj.leaflet.eachLayer(l=>{ if(l.feature===m.feature && l.openPopup) l.openPopup(); });
}
function flyToSearchResult(m){
  const layerObj = LAYERS[m.layerId];
  if(!layerObj) return;
  if(!map.hasLayer(layerObj.leaflet)) toggleLayer(m.layerId, true);
  const geom = m.feature.geometry;
  let after;
  if(geom.type==="Point"){
    const latlng = [geom.coordinates[1], geom.coordinates[0]];
    map.flyTo(latlng, 17, {duration:0.8});
    after = ()=>{ addSearchPulse(latlng, false); openSearchFeaturePopup(m); };
  } else {
    const temp = L.geoJSON(m.feature);
    const bounds = temp.getBounds();
    map.flyToBounds(bounds, {padding:[50,50], duration:0.8});
    after = ()=>{ addSearchPulse(bounds, true); openSearchFeaturePopup(m); };
  }
  let done = false;
  map.once("moveend", ()=>{ if(done) return; done=true; after(); });
  setTimeout(()=>{ if(done) return; done=true; after(); }, 900);
}
function selectSearchResult(m){
  flyToSearchResult(m);
  // A janela de busca permanece aberta após a seleção;
  // só fecha quando o usuário clicar explicitamente no botão de fechar (ou no toggle/Esc).
}

/* bookmarks (por distrito) */
const bookmarksBox = document.getElementById("bookmarks-box");
const bookmarksList = document.getElementById("bookmarks-list");
document.getElementById("lt-bookmark").addEventListener("click",()=>{
  const willOpen = bookmarksBox.style.display!=="block";
  closeAllPanels();
  bookmarksBox.style.display = willOpen?"block":"none";
});
function buildBookmarks(){
  const groups = {};
  DATA_BAIRROS.features.forEach(f=>{
    const d = f.properties.Distrito || "Outros";
    groups[d] = groups[d] || [];
    groups[d].push(f);
  });
  bookmarksList.innerHTML = "<div class='bm-item' data-home='1'>Extensão completa (município)</div>" +
    Object.keys(groups).map(d=>`<div class="bm-item" data-dist="${d}">${d}</div>`).join("");
  bookmarksList.querySelector("[data-home]").addEventListener("click",()=>{ map.setView(HOME_VIEW.center, HOME_VIEW.zoom); bookmarksBox.style.display="none"; });
  bookmarksList.querySelectorAll("[data-dist]").forEach(el=>{
    el.addEventListener("click",()=>{
      const d = el.getAttribute("data-dist");
      const feats = groups[d];
      const temp = L.geoJSON({type:"FeatureCollection", features:feats});
      map.fitBounds(temp.getBounds(), {padding:[30,30]});
      bookmarksBox.style.display="none";
    });
  });
}
buildBookmarks();

/* ================= COMPASS / SCALE ================= */
function formatScaleDistance(meters){
  if(meters >= 1000) return (meters/1000).toFixed(meters > 10000 ? 0 : 1).replace(".0", "") + " km";
  return meters.toFixed(0) + " m";
}

function updateScale(){
  const y = map.getSize().y/2;
  const barPixels = 148;
  const p1 = map.containerPointToLatLng([0,y]);
  const p2 = map.containerPointToLatLng([barPixels,y]);
  const meters = p1.distanceTo(p2);
  const el = document.getElementById("scale-text");
  const ratioEl = document.getElementById("scale-ratio");
  const labels = [
    document.getElementById("scale-label-0"),
    document.getElementById("scale-label-1"),
    document.getElementById("scale-label-2"),
    document.getElementById("scale-label-3")
  ];

  const physicalMeters = barPixels * 0.0254 / 96;
  const denominator = Math.max(1, meters / physicalMeters);
  const roundedDenominator = denominator >= 100000
    ? Math.round(denominator / 10000) * 10000
    : denominator >= 10000
      ? Math.round(denominator / 1000) * 1000
      : denominator >= 1000
        ? Math.round(denominator / 100) * 100
        : denominator >= 100
          ? Math.round(denominator / 10) * 10
          : Math.round(denominator);

  ratioEl.textContent = "Escala: 1:" + roundedDenominator.toLocaleString("pt-BR");
  el.textContent = formatScaleDistance(meters);

  // Mantém a barra gráfica proporcional e no formato do modelo: 0, 1/4, 1/2 e 1 comprimento.
  const quarter = meters / 4;
  const half = meters / 2;
  labels[0].textContent = "0";
  labels[1].textContent = quarter >= 1000 ? (quarter/1000).toFixed(quarter >= 10000 ? 0 : 1).replace(".0", "") : Math.round(quarter) + " m";
  labels[2].textContent = half >= 1000 ? (half/1000).toFixed(half >= 10000 ? 0 : 1).replace(".0", "") : Math.round(half) + " m";
  labels[3].textContent = formatScaleDistance(meters);
}

const scaleManualToggle = document.getElementById("scale-manual-toggle");
const scaleManualBox = document.getElementById("scale-manual-box");
const scaleManualInput = document.getElementById("scale-manual-input");
const scaleManualApply = document.getElementById("scale-manual-apply");
const scaleManualError = document.getElementById("scale-manual-error");

function setScaleManualError(message){
  scaleManualError.textContent = message || "";
  scaleManualError.style.display = message ? "block" : "none";
}

function formatScaleDenominator(value){
  return Number(value).toLocaleString("pt-BR", {maximumFractionDigits: 0, useGrouping: true});
}

function parseManualScale(value){
  let normalized = String(value || "").trim().replace(/\s+/g,"");
  if(!normalized) return null;

  // O usuário pode informar somente o denominador (ex.: 200000).
  // Também aceitamos 200.000 ou 1:200.000 para manter compatibilidade.
  normalized = normalized.replace(/^1[:\/]/,"");
  normalized = normalized.replace(/\./g,"").replace(/,/g,"");

  if(!/^\d+$/.test(normalized)) return null;
  const denominator = Number(normalized);
  return Number.isFinite(denominator) && denominator >= 1 ? denominator : null;
}

function applyManualScale(){
  const denominator = parseManualScale(scaleManualInput.value);
  if(denominator === null){
    setScaleManualError("Informe apenas o valor da escala, por exemplo 200000.");
    return;
  }

  // A escala cartográfica no navegador é aproximada pela densidade CSS padrão
  // de 96 dpi. O mapa usa zoom fracionário (zoomSnap: 0) para que a escala
  // solicitada não seja arredondada para o nível inteiro seguinte/anterior.
  const lat = map.getCenter().lat;
  const earthRadius = 6378137;
  const tileSize = 256;
  const dpi = 96;
  const metersPerCssPixel = denominator * 0.0254 / dpi;
  const targetZoom = Math.log2(
    (Math.cos(lat * Math.PI / 180) * 2 * Math.PI * earthRadius) /
    (tileSize * metersPerCssPixel)
  );

  const clampedZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), targetZoom));
  map.setZoom(clampedZoom);
  scaleManualInput.value = `1:${formatScaleDenominator(denominator)}`;
  setScaleManualError("");

  if(Math.abs(clampedZoom - targetZoom) > 0.001){
    setScaleManualError(`A escala foi limitada ao zoom disponível (${map.getMinZoom()}–${map.getMaxZoom()}).`);
  }
}

scaleManualToggle.addEventListener("click", ()=>{
  const open = scaleManualBox.classList.toggle("open");
  if(open){
    scaleManualInput.focus();
    scaleManualInput.select();
  }else{
    setScaleManualError("");
  }
});
scaleManualApply.addEventListener("click", applyManualScale);
scaleManualInput.addEventListener("keydown", e=>{
  if(e.key === "Enter") applyManualScale();
});
scaleManualInput.addEventListener("input", ()=>setScaleManualError(""));

map.on("zoomend moveend", updateScale);
map.on("zoomend", updateZoomControlledLayers);
map.on("zoomend", updateBairroLabels);
updateScale();

/* ================= ALINHAMENTO DOS ELEMENTOS INFERIORES ================= */
// A antiga barra inferior de ferramentas foi removida. Mantemos a função
// para compatibilidade com app.js, usando a linha inferior atual como referência.
function syncBottomBarAlignment(){
  const row = document.getElementById("bottom-row");
  if(!row) return;
  const rowCS = getComputedStyle(row);
  const bottomOffset = parseFloat(rowCS.bottom) || 0;
  const gap = 8;
  const bottomValue = row.offsetHeight + bottomOffset + gap;
  const attribution = document.getElementById("attribution");
  if(attribution) attribution.style.bottom = bottomValue + "px";
}
syncBottomBarAlignment();
window.addEventListener("resize", syncBottomBarAlignment);
window.addEventListener("orientationchange", syncBottomBarAlignment);
if(window.ResizeObserver){
  const row = document.getElementById("bottom-row");
  if(row) new ResizeObserver(syncBottomBarAlignment).observe(row);
}

/* ================= FULLSCREEN / TOAST ================= */
document.getElementById("fullscreen-btn").addEventListener("click",()=>{
  const app = document.getElementById("app");
  if(!document.fullscreenElement){ app.requestFullscreen && app.requestFullscreen(); }
  else{ document.exitFullscreen && document.exitFullscreen(); }
});
let toastTimer=null;
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove("show"), 2600);
}

/* ================= CLOSE FLYOUTS ON OUTSIDE CLICK ================= */
/* "search-box" foi removido desta lista: a janela de busca só deve fechar
   quando o usuário clicar explicitamente no botão de fechar (X), no botão
   de alternância da lupa, ou pressionar Esc — nunca por clique fora ou
   seleção de um item/local no mapa. */
document.addEventListener("click",e=>{
  const flyouts = ["bookmarks-box","sketch-box","measure-box","radius-box"];
  flyouts.forEach(id=>{
    const box = document.getElementById(id);
    if(box.style.display==="block" && !box.contains(e.target) && !e.target.closest("#left-toolbar")){
      box.style.display="none";
    }
  });
});

/* ================= TABELA DE ATRIBUTOS ================= */
function layerFeatureList(id){
  const layer = LAYERS[id];
  const feats = [];
  layer.leaflet.eachLayer(l=>{ if(l.feature) feats.push(l.feature); });
  return feats;
}
/* A função openAttributeTable(id) — usada pelo botão "tabela" de cada
   camada no painel de Camadas — agora é definida em attribute-table.js,
   com busca, filtros, ordenação, seleção, zoom, colunas e exportação. */

/* ================= HOVER TOOLTIP GENÉRICO (todas as camadas ativas) ================= */
const UC_TOOLTIP_FIELDS = [["categoria","Categoria"],["grupo","Grupo"],["esfera","Esfera"],["ha_total","Área (ha)"]];
const TOOLTIP_CONFIG = {
  municipio:    { idField:"NOME", idFallback:"Limite Municipal de Duque de Caxias", fields:[] },
  bairros:      { idField:"Name", fields:[["Distrito","Distrito"],["PopCenso22","População (2022)"],["Area","Área (km²)"]] },
  ferrovia:     { idField:"NOME", idFallback:"Linha Ferroviária", fields:[["Ramal","Ramal"]] },
  vias:         { idField:"NOME", idFallback:"Via", fields:[["Classifica","Classificação"]] },
  estacoes:     { idField:"Name", fields:[["Ramal","Ramal"]] },
  saude:        { idField:"NOME", fields:[["TIPO","Tipo"],["BAIRRO","Bairro"],["ENDERECO","Endereço"]] },
  escolas:      { idField:"NOME", fields:[["TIPO","Tipo"],["BAIRRO","Bairro"],["ENDERECO","Endereço"]] },
  censo:        { idField:"CD_SETOR", idPrefix:"Setor ", fields:[["V0001","População"],["SITUACAO","Situação"]] },
  cemiterios:   { idField:"NOME", idFallback:"Cemitério", fields:[["TIPOCEMITE","Tipo"],["DENOMINACA","Denominação"]] },
  religiao:     { idField:"NOME", idFallback:"Templo Religioso", fields:[["RELIGIAO","Religião"],["TIPOEDIFRE","Tipo de Edif."]] },
  reservatorio: { idField:"NOME", idFallback:"Reservatório de Água", fields:[["TIPODEPABA","Tipo"],["SITUACAOAG","Situação"]] },
  ucs_estadual: { idField:"nome_uc", idFallback:"UC Estadual", fields:UC_TOOLTIP_FIELDS },
  ucs_federal:  { idField:"nome_uc", idFallback:"UC Federal", fields:UC_TOOLTIP_FIELDS },
  ucs_municipal:{ idField:"nome_uc", idFallback:"UC Municipal", fields:UC_TOOLTIP_FIELDS },
  hidrografia:  { idField:"NOME", idFallback:"Corpo D'água", fields:[["Tipo","Tipo"],["REGIME","Regime"],["COINCIDECO","Coincidência"]] },
  cultura_turismo:    NEW_LAYER_CFG.cultura_turismo,
  seguranca:          NEW_LAYER_CFG.seguranca,
  secretarias:        NEW_LAYER_CFG.secretarias,
  terminais:          NEW_LAYER_CFG.terminais,
  assistencia_social: NEW_LAYER_CFG.assistencia_social,
  plano_diretor:      NEW_LAYER_CFG.plano_diretor,
  uso_ocupacao: { idField:"Classe", idFallback:"Uso e Ocupação do Solo", fields:[["Shape_Area","Área", v => typeof usoFormatArea === 'function' ? usoFormatArea(v||0) : v]] }
};
const hoverTip = document.getElementById("hover-tooltip");
let hoverActive = false;

// considera valores vazios, nulos ou compostos só por espaço em branco (comum em bases hidrográficas/UCs)
function isBlank(v){
  return v===undefined || v===null || String(v).trim()==="";
}

function tooltipConfigFor(id, props){
  if(TOOLTIP_CONFIG[id]) return TOOLTIP_CONFIG[id];
  // fallback genérico para camadas carregadas pelo usuário: usa o primeiro atributo não-vazio como título
  const keys = Object.keys(props||{}).filter(k=>!isBlank(props[k]));
  return { idField: keys[0], fields: keys.slice(1,6).map(k=>[k,k]) };
}

function buildTooltipHTML(feature, id){
  const props = feature.properties || {};
  const layer = LAYERS[id];
  const cfg = tooltipConfigFor(id, props);
  let titleText = cfg.idField && !isBlank(props[cfg.idField])
    ? String(props[cfg.idField]).trim() : (cfg.idFallback || (layer ? layer.label : "Feição"));
  if(cfg.idPrefix) titleText = cfg.idPrefix + titleText;
  let rows = (cfg.fields||[]).map(([k,label,formatter])=>{
    const v = props[k];
    if(isBlank(v)) return "";
    let vStr = "";
    if (typeof formatter === "function") {
      vStr = formatter(v);
    } else {
      vStr = String(v).trim();
    }
    return `<div class="hv-row"><span class="hv-k">${escapeHtml(label)}</span><span class="hv-v" title="${escapeHtml(vStr)}">${escapeHtml(vStr)}</span></div>`;
  }).join("");
  if(id==="cultura_turismo"){
    const summary = CULTURA_TURISMO_RESUMOS[String(props.NOME||"").trim().toUpperCase()];
    if(!isBlank(summary)) rows += `<div class="hv-row hv-summary"><span class="hv-k">Resumo</span><span class="hv-v" title="${escapeHtml(summary)}">${escapeHtml(summary)}</span></div>`;
  }
  const image = id==="cultura_turismo" ? culturaTurismoImagemHTML(props,"hover") : id==="estacoes" ? estacaoImagemHTML(props,"hover") : id==="escolas" ? escolasImagemHTML(props,"hover") : id==="saude" ? saudeImagemHTML(props,"hover") : "";
  return `<div class="hv-layer">${escapeHtml(layer ? layer.label : id)}</div><div class="hv-title">${escapeHtml(titleText)}</div>${image}${rows}`;
}

function showHoverTooltip(feature, id){
  hoverTip.innerHTML = buildTooltipHTML(feature, id);
  hoverTip.style.display = "block";
}
function hideHoverTooltip(){
  hoverActive = false;
  hoverTip.style.display = "none";
  if(sketchMode==="off" && measureMode==="off") map.getContainer().style.cursor = "";
}
hoverTip.addEventListener("mouseleave", hideHoverTooltip);
function positionHoverTooltip(clientX, clientY){
  const pad = 16;
  const vw = window.innerWidth, vh = window.innerHeight;
  const margin = 8;
  const {width:w, height:h} = hoverTip.getBoundingClientRect();
  let x = clientX + pad, y = clientY + pad;
  if(x + w > vw - margin) x = clientX - w - pad;
  if(y + h > vh - margin) y = clientY - h - pad;
  x = Math.max(margin, Math.min(x, vw - w - margin));
  y = Math.max(margin, Math.min(y, vh - h - margin));
  hoverTip.style.left = x + "px";
  hoverTip.style.top = y + "px";
}

function bindHoverToLayer(l, id){
  const isPath = !!l.setStyle;
  l.on("mouseover", e=>{
    hoverActive = true;
    if(sketchMode==="off" && measureMode==="off") map.getContainer().style.cursor = "pointer";
    if(isPath){
      l.setStyle({weight:3, opacity:1, fillOpacity: Math.min((l.options.fillOpacity ?? 0.6) + 0.3, 0.92)});
      if(l.bringToFront) l.bringToFront();
    } else {
      const el = l.getElement && l.getElement();
      if(el) el.classList.add("marker-hover");
    }
    showHoverTooltip(l.feature, id);
    if(e.originalEvent) positionHoverTooltip(e.originalEvent.clientX, e.originalEvent.clientY);
  });
  l.on("mouseout", e=>{
    if(isPath){
      const gj = LAYERS[id] && LAYERS[id].leaflet;
      if(gj && gj.resetStyle) gj.resetStyle(l);
    } else {
      const el = l.getElement && l.getElement();
      if(el) el.classList.remove("marker-hover");
    }
    if(e.originalEvent && hoverTip.contains(e.originalEvent.relatedTarget)) return;
    hideHoverTooltip();
  });
}
function attachHoverTooltip(id){
  const layer = LAYERS[id];
  if(!layer || !layer.leaflet || !layer.leaflet.eachLayer) return;
  layer.leaflet.eachLayer(l=> bindHoverToLayer(l, id));
}
// aplica a TODAS as camadas já registradas (ativas ou não — passam a funcionar assim que forem exibidas)
Object.keys(LAYERS).forEach(id=> attachHoverTooltip(id));
// acompanha o cursor suavemente enquanto uma feição estiver em hover
map.getContainer().addEventListener("mousemove", e=>{
  if(hoverActive) positionHoverTooltip(e.clientX, e.clientY);
});
// esconde imediatamente ao sair do canvas do mapa
map.getContainer().addEventListener("mouseleave", hideHoverTooltip);