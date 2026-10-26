/* ============================================================
   utils.js - Funções auxiliares reutilizadas
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= ESCAPE DE HTML (única definição) ================= */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

const ptBRNumberFormatters = new Map();
function formatNumberPtBR(value, options = {}){
  const number = Number(value);
  if(!Number.isFinite(number)) return String(value);
  const key = JSON.stringify(options);
  if(!ptBRNumberFormatters.has(key)){
    ptBRNumberFormatters.set(key, new Intl.NumberFormat("pt-BR", options));
  }
  return ptBRNumberFormatters.get(key).format(number);
}

function formatAreaPtBR(value, sourceUnit = "m2"){
  const areaInHectares = Number(value) * (sourceUnit === "km2" ? 100 : sourceUnit === "ha" ? 1 : 0.0001);
  return `${formatNumberPtBR(areaInHectares,{minimumFractionDigits:2,maximumFractionDigits:2})} ha`;
}

function formatDatePtBR(value, options = {day:"2-digit",month:"long",year:"numeric"}){
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

const FIELD_DISPLAY_ALIASES = {
  CD_SETOR:"Código do setor censitário",
  V0001:"População residente",
  SHAPE_AREA:"Área (ha)",
  CLASSE:"Classe de uso",
  CLASSE_USO:"Classe de uso",
  AREA_HA:"Área (ha)",
  GEOCODIGO:"Código geográfico",
  HIDRO:"Identificação hidrográfica",
  COMP_KM:"Comprimento (km)",
  ZONA:"Zona",
  ZONA_2:"Classe de zoneamento",
  LEGISLACAO:"Legislação",
  ANOLEI:"Ano da lei",
  OBJ_ESTRAT:"Objetivo estratégico",
  POPCENSO22:"População (Censo 2022)",
  DISTRITO:"Distrito",
  BAIRRO:"Bairro",
  NOME:"Nome",
  NAME:"Nome",
  FCLASS:"Classe da via",
  REF:"Referência",
  ONEWAY:"Sentido de circulação",
  MAXSPEED:"Velocidade máxima",
  BRIDGE:"Ponte",
  TUNNEL:"Túnel",
  OSM_ID:"Identificador OSM",
  ENDERECO:"Endereço",
  SECRETARIA:"Secretaria",
  FONTE:"Fonte",
  MUNICIPIO:"Município",
  UF:"Unidade federativa"
};
function canonicalFieldName(value){
  return String(value||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/([A-Z]+)([A-Z][a-z])/g,"$1_$2")
    .replace(/([a-z0-9])([A-Z])/g,"$1_$2")
    .replace(/[^a-zA-Z0-9]+/g,"_")
    .replace(/_+/g,"_").replace(/^_|_$/g,"").toLowerCase();
}
function fieldDisplayLabel(field){
  const key = String(field||"");
  const alias = FIELD_DISPLAY_ALIASES[key.toUpperCase()];
  if(alias) return alias;
  return key.replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/_/g," ")
    .toLocaleLowerCase("pt-BR").replace(/(^|[\s(])([a-zà-ÿ])/g,(_,prefix,letter)=>prefix+letter.toLocaleUpperCase("pt-BR"));
}

/* ================= COORDENADAS DO CURSOR / TEMA ================= */
const cursorCoordinates = document.getElementById("cursor-coordinates");
const copyCoordinatesBtn = document.getElementById("copy-coordinates");
const themeBtn = document.getElementById("btn-theme");
let lastCoordinateText = "";

// Conversão direta para SIRGAS 2000 / UTM 23S (EPSG:31983), sem alterar
// a projeção do mapa, que continua trabalhando em latitude/longitude.
function latLonToUTM23S(lat, lon){
  const a = 6378137.0;
  const eccSquared = 0.00669438002290;
  const k0 = 0.9996;
  const lonOrigin = -45.0;
  const degToRad = Math.PI / 180;

  const latRad = lat * degToRad;
  const lonRad = lon * degToRad;
  const lonOriginRad = lonOrigin * degToRad;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const N = a / Math.sqrt(1 - eccSquared * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = eccPrimeSquared * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);

  const M = a * (
    (1 - eccSquared / 4 - 3 * eccSquared ** 2 / 64 - 5 * eccSquared ** 3 / 256) * latRad
    - (3 * eccSquared / 8 + 3 * eccSquared ** 2 / 32 + 45 * eccSquared ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * eccSquared ** 2 / 256 + 45 * eccSquared ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * eccSquared ** 3 / 3072) * Math.sin(6 * latRad)
  );

  const easting = k0 * N * (
    A + (1 - T + C) * A ** 3 / 6
    + (5 - 18 * T + T ** 2 + 72 * C - 58 * eccPrimeSquared) * A ** 5 / 120
  ) + 500000;

  const northing = k0 * (
    M + N * Math.tan(latRad) * (
      A ** 2 / 2
      + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
      + (61 - 58 * T + T ** 2 + 600 * C - 330 * eccPrimeSquared) * A ** 6 / 720
    )
  );

  // Hemisfério Sul: false northing de 10.000.000 m.
  return {easting, northing: northing + 10000000};
}

const coordinateLat = document.getElementById("coordinate-lat");
const coordinateLon = document.getElementById("coordinate-lon");
const coordinateX = document.getElementById("coordinate-x");
const coordinateY = document.getElementById("coordinate-y");

function formatUTMValue(value){
  return formatNumberPtBR(value, {minimumFractionDigits:2, maximumFractionDigits:2});
}

function formatSIRGAS2000(lat, lon){
  const utm = latLonToUTM23S(lat, lon);
  const coordinateOptions = {minimumFractionDigits:6, maximumFractionDigits:6, useGrouping:false};
  return `SIRGAS 2000 / UTM 23S\nX: ${formatUTMValue(utm.easting)} | Y: ${formatUTMValue(utm.northing)}\nLat: ${formatNumberPtBR(lat,coordinateOptions)} | Lon: ${formatNumberPtBR(lon,coordinateOptions)}`;
}

function updateCursorCoordinates(e){
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  const utm = latLonToUTM23S(lat, lon);
  const coordinateOptions = {minimumFractionDigits:6, maximumFractionDigits:6, useGrouping:false};
  coordinateLat.textContent = formatNumberPtBR(lat,coordinateOptions);
  coordinateLon.textContent = formatNumberPtBR(lon,coordinateOptions);
  coordinateX.textContent = formatUTMValue(utm.easting);
  coordinateY.textContent = formatUTMValue(utm.northing);
  lastCoordinateText = formatSIRGAS2000(lat, lon);
  cursorCoordinates.textContent = lastCoordinateText;
}

map.on("mousemove", updateCursorCoordinates);

copyCoordinatesBtn.addEventListener("click", async ()=>{
  if(!lastCoordinateText){
    showToast("Posicione o cursor sobre o mapa para obter uma coordenada.");
    return;
  }
  try{
    await navigator.clipboard.writeText(lastCoordinateText + " — SIRGAS 2000 / UTM 23S (EPSG:31983)");
    showToast("Coordenada copiada.");
  }catch(err){
    showToast("Não foi possível copiar a coordenada.");
  }
});

function applyTheme(theme){
  const light = theme === "light";
  document.body.classList.toggle("light-theme", light);
  themeBtn.innerHTML = light
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.7 8.7 0 1 0 20.5 15.2Z"></path></svg>';
  themeBtn.title = light ? "Usar tema escuro" : "Usar tema claro";
  themeBtn.setAttribute("aria-label", themeBtn.title);
}

const savedTheme = localStorage.getItem("geoportal-theme");
applyTheme(savedTheme === "light" ? "light" : "dark");

themeBtn.addEventListener("click", ()=>{
  const nextTheme = document.body.classList.contains("light-theme") ? "dark" : "light";
  localStorage.setItem("geoportal-theme", nextTheme);
  applyTheme(nextTheme);
});


/* ================= STYLE HELPERS ================= */
const DIST_COLORS = {
  "1º Distrito": "#2fb3a6",
  "2º Distrito": "#8d6bc4",
  "3º Distrito": "#d3c34d",
  "4º Distrito": "#c1573d",
  "2º e 3º Distritos": "#7d877c",
  "2º e 4º Distritos": "#7d877c",
  "3º e 4º Distritos": "#7d877c",
};
function distColor(d){ return DIST_COLORS[d] || "#7d877c"; }

/* Paleta de tons de verde para as categorias de Unidades de Conservação (UCs).
   Do mais claro (uso sustentável, menos restritivo) ao mais escuro (proteção integral, mais restritivo). */
const UC_CATEGORY_COLORS = {
  "Área de Proteção Ambiental": "#A9D6B6",
  "Reserva Particular do Patrimônio Natural": "#8CC49E",
  "Parque": "#6FAE85",
  "Refúgio de Vida Silvestre": "#4F9868",
  "Reserva Biológica": "#2F7A4F",
};
const UC_CATEGORY_ORDER = ["Reserva Biológica","Refúgio de Vida Silvestre","Parque","Reserva Particular do Patrimônio Natural","Área de Proteção Ambiental"];
const UC_DEFAULT_COLOR = "#6FAE85";
function ucColor(categoria){ return UC_CATEGORY_COLORS[categoria] || UC_DEFAULT_COLOR; }
function ucCategoriesPresent(dataVar){
  const cats = new Set();
  (dataVar && dataVar.features ? dataVar.features : []).forEach(f=>{
    const c = f.properties && f.properties.categoria;
    if(c) cats.add(c);
  });
  const ordered = UC_CATEGORY_ORDER.filter(c=>cats.has(c));
  cats.forEach(c=>{ if(!ordered.includes(c)) ordered.push(c); });
  return ordered;
}

function makeDotIcon(color, glyph, size){
  size = size || 20;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:1.5px solid #0d0f0e;
    display:flex;align-items:center;justify-content:center;font-size:${size*0.55}px;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.6);">${glyph}</div>`;
  return L.divIcon({html, className:"dot-icon", iconSize:[size,size], iconAnchor:[size/2,size/2], popupAnchor:[0,-size/2]});
}


/* ---- Símbolos reproduzidos a partir do TOC do ArcGIS Pro fornecido pelo usuário:
   círculo branco com contorno cinza + glifo colorido centralizado ---- */
function makeSymbolIcon(innerSvg, size){
  size = size || 28;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#ffffff;
    border:1.4px solid #a7a9ac;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.55);">
    <svg width="${size*0.66}" height="${size*0.66}" viewBox="0 0 32 32">${innerSvg}</svg>
  </div>`;
  return L.divIcon({html, className:"symbol-icon", iconSize:[size,size], iconAnchor:[size/2,size/2], popupAnchor:[0,-size/2]});
}

// Unidades de Saúde: coração com linha de pulso (ECG), vermelho #CA3000
const SVG_HEART_PULSE = `
  <path d="M16 28.5C16 28.5 3.5 19.8 3.5 11.6 3.5 6.9 7.3 3.5 11.6 3.5c2.3 0 4.4 1.1 5.7 2.9 1.3-1.8 3.4-2.9 5.7-2.9 4.3 0 8.1 3.4 8.1 8.1 0 8.2-12.6 16.9-12.6 16.9z" fill="#CA3000"/>
  <polyline points="6,16.5 11,16.5 13.2,11 16,21 18,14 19.6,16.5 26,16.5" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
`;
const ICON_SAUDE = makeSymbolIcon(SVG_HEART_PULSE, 28);

// Escolas Municipais: prédio com colunas e bandeira, roxo #8333A8
const SVG_SCHOOL_BUILDING = `
  <rect x="6" y="12" width="20" height="3" fill="#8333A8"/>
  <rect x="8" y="15" width="16" height="10" fill="#8333A8"/>
  <rect x="10.5" y="17" width="1.8" height="7" fill="#ffffff"/>
  <rect x="15.1" y="17" width="1.8" height="7" fill="#ffffff"/>
  <rect x="19.7" y="17" width="1.8" height="7" fill="#ffffff"/>
  <rect x="7" y="25" width="18" height="1.8" fill="#8333A8"/>
  <line x1="21" y1="12" x2="21" y2="5" stroke="#8333A8" stroke-width="1.4"/>
  <path d="M21 5 L27 7 L21 9 Z" fill="#8333A8"/>
`;
const ICON_ESCOLA = makeSymbolIcon(SVG_SCHOOL_BUILDING, 28);

// Estações Ferroviárias: trem/metrô visto de frente, cinza escuro #4A4A4A
const ICON_ESTACAO = makeSymbolIcon(`
  <rect x="9" y="7" width="14" height="16" rx="4" fill="#4A4A4A"/>
  <rect x="11.2" y="9.5" width="9.6" height="5.6" rx="1" fill="#ffffff"/>
  <rect x="9" y="17" width="14" height="1.6" fill="#ffffff"/>
  <circle cx="12.2" cy="24" r="1.7" fill="#4A4A4A"/>
  <circle cx="19.8" cy="24" r="1.7" fill="#4A4A4A"/>
`, 28);


const SVG_CROSS = `
  <rect x="13.5" y="4" width="5" height="20" fill="#333333"/>
  <rect x="9" y="10" width="14" height="5" fill="#333333"/>
`;
const ICON_CEMITERIO = makeSymbolIcon(SVG_CROSS, 24);

const SVG_CHURCH = `
  <path d="M16 2 L8 12 L8 28 L24 28 L24 12 Z" fill="#8B4513"/>
  <rect x="14" y="18" width="4" height="10" fill="#ffffff"/>
  <rect x="15" y="6" width="2" height="4" fill="#ffffff"/>
  <rect x="13" y="7" width="6" height="2" fill="#ffffff"/>
`;
const ICON_RELIGIAO = makeSymbolIcon(SVG_CHURCH, 28);

const SVG_DROP = `
  <path d="M16 2 C16 2 6 14 6 20 C6 25.5 10.5 30 16 30 C21.5 30 26 25.5 26 20 C26 14 16 2 16 2 Z" fill="#00BFFF"/>
`;
const ICON_RESERVATORIO = makeSymbolIcon(SVG_DROP, 26);

/* ---- Novas camadas (V11): símbolos no mesmo padrão (círculo branco + glifo colorido) ---- */
// Cultura e Turismo: fachada de teatro/museu com frontão e colunas, magenta #D81B60
const ICON_CULTURA = makeSymbolIcon(`
  <path d="M16 4 L27 11 L5 11 Z" fill="#D81B60"/>
  <rect x="7" y="12.5" width="18" height="2" fill="#D81B60"/>
  <rect x="8.6" y="15.5" width="2.6" height="9" fill="#D81B60"/>
  <rect x="14.7" y="15.5" width="2.6" height="9" fill="#D81B60"/>
  <rect x="20.8" y="15.5" width="2.6" height="9" fill="#D81B60"/>
  <rect x="6" y="25.5" width="20" height="2.4" fill="#D81B60"/>
`, 28);

// Símbolos por órgão, mantendo o padrão circular usado pelos equipamentos.
const SECURITY_FORCE_SYMBOLS = [
  {agency:"Corpo de Bombeiros Militar do Rio de Janeiro", color:"#C62828", svg:`
    <path d="M16 3 27 7v8c0 6.5-4.6 11.3-11 14C9.6 26.3 5 21.5 5 15V7z" fill="#C62828"/>
    <path d="M16 8c1 4-2 5-1 8 .2 1 1 2 1.7 2 1.5-1.5 2-3.2 1.8-5 2 1.7 3 3.7 3 6 0 3-2.3 5-5.1 5s-5-2-5-4.8c0-3.5 3-5.8 3.6-11.2z" fill="#fff"/>
  `},
  {agency:"Guarda Municipal", color:"#202124", svg:`
    <path d="M9 5h14l2.8 7.5L28 16v8h-3a3 3 0 0 0-6 0h-6a3 3 0 0 0-6 0H4v-8l2.2-3.5z" fill="#202124"/>
    <path d="M10 8h12l1.4 4H8.6z" fill="#fff"/>
    <rect x="6.5" y="14.5" width="4" height="2.5" rx=".8" fill="#fff"/>
    <rect x="21.5" y="14.5" width="4" height="2.5" rx=".8" fill="#fff"/>
    <path d="M12 18h8M12.8 20h6.4" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
  `},
  {agency:"Polícia Militar", color:"#039BE5", svg:`
    <path d="M16 3 27 7v8c0 6.5-4.6 11.3-11 14C9.6 26.3 5 21.5 5 15V7z" fill="#039BE5"/>
    <path d="m16 8 2.1 5 5.4.4-4.1 3.5 1.3 5.2-4.7-2.8-4.7 2.8 1.3-5.2-4.1-3.5 5.4-.4z" fill="#fff"/>
  `},
  {agency:"Polícia Rodoviária Federal", color:"#202124", svg:`
    <path d="M3 15.5h3l2.5-5a3 3 0 0 1 2.7-1.7h7.8a3 3 0 0 1 2.5 1.3l3.2 5.4h2.1a2.2 2.2 0 0 1 2.2 2.2v3.5H2.5v-3.5A2.2 2.2 0 0 1 3 15.5z" fill="#202124"/>
    <path d="M10.1 14.2h4.6v-3.8h-2.4c-.6 0-1.1.4-1.3.9zM16 10.4h2.9c.5 0 .9.2 1.2.7l1.8 3.1H16z" fill="#fff"/>
    <circle cx="8.5" cy="21" r="2.8" fill="#202124"/>
    <circle cx="23.5" cy="21" r="2.8" fill="#202124"/>
    <circle cx="8.5" cy="21" r="1.1" fill="#fff"/>
    <circle cx="23.5" cy="21" r="1.1" fill="#fff"/>
  `}
];
const SECURITY_FORCE_ICONS = Object.fromEntries(SECURITY_FORCE_SYMBOLS.map(force=>[
  force.agency.toUpperCase(), makeSymbolIcon(force.svg, 28)
]));
const ICON_SEGURANCA = makeSymbolIcon(`
  <path d="M12 17v-4a4 4 0 0 1 8 0v4z" fill="#1A237E"/>
  <rect x="9" y="17" width="14" height="3.5" rx="1" fill="#1A237E"/>
  <path d="M16 7V4M8.7 10.5l-2-2M23.3 10.5l2-2" fill="none" stroke="#1A237E" stroke-width="2" stroke-linecap="round"/>
  <circle cx="16" cy="13" r="1.4" fill="#fff"/>
`, 28);
function securityForceIcon(feature){
  const agency = String(feature?.properties?.Orgao || "").trim().toUpperCase();
  return SECURITY_FORCE_ICONS[agency] || ICON_SEGURANCA;
}

// Secretarias Municipais: prédio público com cúpula, ciano-escuro #00838F
const ICON_SECRETARIA = makeSymbolIcon(`
  <path d="M10 12 A6 6 0 0 1 22 12 Z" fill="#00838F"/>
  <rect x="15.2" y="3" width="1.6" height="4" fill="#00838F"/>
  <rect x="7" y="12.6" width="18" height="2" fill="#00838F"/>
  <rect x="9" y="15.6" width="2.4" height="8.6" fill="#00838F"/>
  <rect x="14.8" y="15.6" width="2.4" height="8.6" fill="#00838F"/>
  <rect x="20.6" y="15.6" width="2.4" height="8.6" fill="#00838F"/>
  <rect x="6" y="25" width="20" height="2.4" fill="#00838F"/>
`, 28);

// Terminais Rodoviários: ônibus visto de frente, verde #2E7D32
const ICON_TERMINAL = makeSymbolIcon(`
  <rect x="7" y="5" width="18" height="19" rx="3.5" fill="#2E7D32"/>
  <rect x="9.4" y="8" width="13.2" height="7" rx="1.2" fill="#ffffff"/>
  <circle cx="11.6" cy="19.6" r="1.7" fill="#ffffff"/>
  <circle cx="20.4" cy="19.6" r="1.7" fill="#ffffff"/>
  <rect x="9.5" y="24" width="3.2" height="3.4" fill="#2E7D32"/>
  <rect x="19.3" y="24" width="3.2" height="3.4" fill="#2E7D32"/>
`, 28);

// Unidades de Assistência Social: duas pessoas sob um coração, laranja #F57C00
const ICON_ASSISTENCIA = makeSymbolIcon(`
  <path d="M16 11.6 C16 11.6 9.8 8.4 9.8 5.9 C9.8 4.3 11 3.2 12.5 3.2 C14 3.2 15.2 4 16 5.1 C16.8 4 18 3.2 19.5 3.2 C21 3.2 22.2 4.3 22.2 5.9 C22.2 8.4 16 11.6 16 11.6 Z" fill="#F57C00"/>
  <circle cx="10.6" cy="15.6" r="2.7" fill="#F57C00"/>
  <circle cx="21.4" cy="15.6" r="2.7" fill="#F57C00"/>
  <path d="M5.4 27.6 C5.4 22.6 7.6 19.6 10.6 19.6 C13.6 19.6 15.8 22.6 15.8 27.6 Z" fill="#F57C00"/>
  <path d="M16.2 27.6 C16.2 22.6 18.4 19.6 21.4 19.6 C24.4 19.6 26.6 22.6 26.6 27.6 Z" fill="#F57C00"/>
`, 28);

// ---- Petróleo e Gás (V15) ----
// Terminais de Combustíveis Líquidos: tanque de armazenamento, marrom #5D4037
const ICON_TERMINAL_COMBUSTIVEL = makeSymbolIcon(`
  <ellipse cx="16" cy="10" rx="9" ry="3.4" fill="#5D4037"/>
  <path d="M7 10 V24 C7 26 11 27.6 16 27.6 C21 27.6 25 26 25 24 V10 C25 12 21 13.4 16 13.4 C11 13.4 7 12 7 10 Z" fill="#5D4037"/>
  <path d="M7.8 17.2 C9.5 19 12.5 19.8 16 19.8 C19.5 19.8 22.5 19 24.2 17.2" fill="none" stroke="#ffffff" stroke-width="1.3"/>
`, 28);

// Terminais de GNL: chama de gás natural, azul #0277BD
const ICON_TERMINAL_GNL = makeSymbolIcon(`
  <path d="M16 3 C17 8 22.5 10.5 22.5 17.5 C22.5 22.8 19.6 27.5 16 27.5 C12.4 27.5 9.5 22.8 9.5 17.5 C9.5 14.5 11 12.8 12.4 11.2 C12.6 13.4 13.6 14.4 14.6 14.8 C14 10.5 14.2 6.2 16 3 Z" fill="#0277BD"/>
  <path d="M16 17 C17.6 19 19 20.4 19 22.6 C19 24.4 17.7 25.8 16 25.8 C14.3 25.8 13 24.4 13 22.6 C13 20.4 14.4 19 16 17 Z" fill="#ffffff"/>
`, 28);

// Unidades de Processamento de Gás Natural: planta industrial com chaminé, cinza-azulado #455A64
const ICON_UPGN = makeSymbolIcon(`
  <rect x="20.5" y="4.5" width="4" height="11" fill="#455A64"/>
  <path d="M5 15 V9.5 L11 14.6 V9.5 L17 14.6 V15 Z" fill="#455A64"/>
  <rect x="5" y="15" width="22" height="11" fill="#455A64"/>
  <rect x="8" y="18.4" width="3" height="3.2" fill="#ffffff"/>
  <rect x="14" y="18.4" width="3" height="3.2" fill="#ffffff"/>
  <rect x="20" y="18.4" width="3" height="3.2" fill="#ffffff"/>
  <rect x="4" y="26" width="24" height="2.2" fill="#455A64"/>
`, 28);

/* Ícones dos indicadores dos Dashboards — mesmo padrão visual do Dashboard Setores Censitários
   (.dsh-kpi-icon: quadrado 26px, fundo translúcido, traço de 2px, ícone de 15px). */
const DSH_KPI_ICONS = {
  area:     {c:"59,130,246",  h:"#3b82f6", p:'<path d="m4 6 12-3 4 4-2 12-12 2-3-5z"/><path d="m4 6 5 3 11-2M9 9l-3 12M14 8l-2 12"/><path d="m16 3 1 4"/> '},
  classes:  {c:"139,92,246",  h:"#8b5cf6", p:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'},
  features: {c:"139,92,246",  h:"#8b5cf6", p:'<circle cx="6" cy="7" r="2"/><circle cx="17" cy="5" r="2"/><circle cx="11" cy="17" r="2"/><circle cx="19" cy="16" r="2"/><path d="m8 6 7-1M7 9l3 6m3 1 4 0"/> '},
  top:      {c:"245,158,11",  h:"#f59e0b", p:'<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>'},
  percent:  {c:"6,182,212",   h:"#06b6d4", p:'<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'},
  built:    {c:"239,68,68",   h:"#ef4444", p:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>'},
  veg:      {c:"34,197,94",   h:"#22c55e", p:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'},
  zones:    {c:"20,184,166",  h:"#14b8a6", p:'<path d="m12 2 9 5-2 11-8 4-8-5 2-11z"/><path d="m5 6 6 4 10-3M11 10v12m0-12L5 17m6-7 8 8"/> '},
  legal:    {c:"99,102,241",  h:"#6366f1", p:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'}
};
function dshKpiIconHTML(key){
  const i = DSH_KPI_ICONS[key];
  if(!i) return "";
  return `<span class="dsh-kpi-icon" aria-hidden="true" style="background:rgba(${i.c},.15);color:${i.h}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i.p}</svg></span>`;
}
