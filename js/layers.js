/* ============================================================
   layers.js - Carregamento, configuração e controle das camadas
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= OVERLAY LAYERS ================= */
const LAYERS = {}; // id -> {label, leaflet, defaultVisible, swatch:{type,color,glyph}, count, category}

function registerLayer(id, cfg){
  LAYERS[id] = cfg;
  // Permite que ferramentas de clique no mapa (Esboço, Medir, Consulta por
  // Raio) capturem o local do clique mesmo quando ele cai sobre uma feição
  // com popup (o Leaflet interrompe a propagação do clique para o mapa
  // nesses casos). Sem nenhuma ferramenta ativa, o comportamento padrão
  // (abrir popup normalmente) permanece 100% inalterado. Quando nenhuma
  // ferramenta de desenho está ativa, um clique numa feição também
  // sincroniza a Tabela de Atributos (se estiver aberta nessa camada).
  if(cfg && cfg.leaflet && typeof cfg.leaflet.on === "function"){
    cfg.leaflet.on("click", e=>{
      if(typeof isAnyMapToolActive==="function" && isAnyMapToolActive()){
        map.closePopup();
        if(typeof handleToolClick==="function") handleToolClick(e);
      } else if(typeof atOnMapFeatureClicked==="function" && e.layer && e.layer.feature){
        atOnMapFeatureClicked(id, e.layer.feature);
      }
    });
  }
}

// Labels da camada Bairros: só aparecem em zoom de aproximação
const BAIRRO_LABEL_LAYERS = [];
const BAIRRO_LABEL_MIN_ZOOM = 14;
function updateBairroLabels(){
  const show = map.getZoom() >= BAIRRO_LABEL_MIN_ZOOM;
  BAIRRO_LABEL_LAYERS.forEach(l=>{
    if(show){ if(!l.isTooltipOpen()) l.openTooltip(); }
    else { if(l.isTooltipOpen()) l.closeTooltip(); }
  });
}

// 1. Limite Municipal
registerLayer("municipio", {
  label:"Limite Municipal - DCX",
  category:"Limites",
  defaultVisible:true,
  count: DATA_MUNICIPIO.features.length,
  swatch:{type:"polygon-outline", color:"#000000"},
  leaflet: L.geoJSON(DATA_MUNICIPIO, {
    pane:"paneOverlayPoligonos",
    style:{color:"#000000", weight:2.5, fill:false, opacity:0.95},
    onEachFeature:(f,l)=> l.bindPopup(`<b>${escapeHtml(f.properties.NOME||"Município")}</b><br>Limite Municipal de Duque de Caxias (polígono)`)
  })
});

// 2. Bairros / Distritos
registerLayer("bairros", {
  label:"Bairros / Distritos - DCX",
  category:"Limites",
  defaultVisible:true,
  count: DATA_BAIRROS.features.length,
  swatch:{type:"fill", color:"#2fb3a6"},
  isDistrict:true,
  leaflet: L.geoJSON(DATA_BAIRROS, {
    pane:"paneOverlayPoligonos",
    style:f=>({color:"#12140f", weight:1, fillColor:distColor(f.properties.Distrito), fillOpacity:0.55, opacity:0.6}),
    onEachFeature:(f,l)=>{
      const p=f.properties;
      l.bindPopup(`<b>${escapeHtml(p.Name)}</b><br>${escapeHtml(p.Distrito||"")}<br>População (2022): ${escapeHtml(p.PopCenso22 ?? "-")}<br>Área: ${escapeHtml((p.Area||0).toFixed(2))} km²`);
      l.bindTooltip(p.Name||"", {permanent:true, direction:"center", className:"bairro-label"});
      BAIRRO_LABEL_LAYERS.push(l);
    }
  })
});

// 3. Ferrovia
const FERROVIA_COR = "#2b2b2b";
const FERROVIA_TRILHOS = [
  L.geoJSON(DATA_FERROVIA, {pane:"paneOverlayLinhas", interactive:false, style:{color:FERROVIA_COR, weight:5, opacity:1, lineCap:"butt"}}),
  L.geoJSON(DATA_FERROVIA, {pane:"paneOverlayLinhas", interactive:false, style:{color:"#ffffff", weight:2, opacity:1, lineCap:"butt"}})
];
const FERROVIA_DORMENTES = L.geoJSON(DATA_FERROVIA, {
  pane:"paneOverlayLinhas",
  style:{color:FERROVIA_COR, weight:12, opacity:1, dashArray:"2,4.5", lineCap:"butt"},
  onEachFeature:(f,l)=>{
    l.bindPopup(`<b>${escapeHtml(f.properties.NOME||"Ferrovia")}</b><br>Ramal: ${escapeHtml(f.properties.Ramal||"-")}`);
    // Mantém o símbolo íntegro no hover (sem mudar a largura nem trazer os dormentes para frente) e sincroniza a opacidade
    const setStyleOriginal = l.setStyle.bind(l);
    l.setStyle = function(st){
      const s = Object.assign({}, st || {}); s.weight = 12;
      setStyleOriginal(s);
      if(s.opacity !== undefined) FERROVIA_TRILHOS.forEach(g=>g.setStyle({opacity:s.opacity}));
      return l;
    };
    l.bringToFront = function(){ return l; };
  }
});
FERROVIA_DORMENTES.on("add", ()=> FERROVIA_TRILHOS.forEach(g=>g.addTo(map)));
FERROVIA_DORMENTES.on("remove", ()=> FERROVIA_TRILHOS.forEach(g=>map.removeLayer(g)));

registerLayer("ferrovia", {
  label:"Linhas Ferroviárias",
  category:"Infraestrutura",
  defaultVisible:true,
  count: DATA_FERROVIA.features.length,
  swatch:{type:"rail"},
  leaflet: FERROVIA_DORMENTES
});
// Símbolo de trilho (dormentes + dois trilhos): a camada principal desenha os dormentes e duas
// camadas auxiliares (não interativas) desenham a faixa dos trilhos e o vão entre eles. As auxiliares
// entram e saem do mapa junto com a camada principal e acompanham a opacidade dela.

// 4. Vias principais
registerLayer("vias", {
  label:"Principais Vias",
  category:"Infraestrutura",
  defaultVisible:true,
  count: DATA_VIAS.features.length,
  swatch:{type:"line", color:"#FF8C00"},
  leaflet: L.geoJSON(DATA_VIAS, {
    pane:"paneOverlayLinhas",
    style:{color:"#FF8C00", weight:1.5, opacity:0.95},
    onEachFeature:(f,l)=> l.bindPopup(`<b>${escapeHtml(f.properties.NOME||"Via")}</b><br>${escapeHtml(f.properties.Classifica||"")}`)
  })
});

// 4.1 Labels de sigla oficial sobre a camada "Principais Vias" (BR-XXX / RJ-XXX)
// Siglas confirmadas por pesquisa (DER-RJ / DNIT / prefeitura / imprensa). Vias
// sem designação oficial de rodovia estadual/federal cadastrada (as duas vias
// classificadas como "Rodovia Municipal": Estrada de Xerém e Est. do Garrão)
// permanecem intencionalmente sem sigla, para não inventar informação.
const VIAS_SIGLAS = {
  "Av. Automovel Clube": "RJ-107",
  "Av. Pastor Manoel Avelino de Souza": "RJ-115",
  "Av. Governador Leonel de Moura Brizola": "RJ-101",
  "Rodovia Washington Luiz": "BR-040",
  "Rodovia Rio-Magé": "BR-493",
  "Arco Metropolitano": "BR-493",
  "Rodovia Pastor Lourival Machado": "RJ-085",
  "Av. Pres. Kennedy": "RJ-101",
  "Av. Pres. Kennedy - Belford Roxo": "RJ-101",
  "Est. Rio D'Ouro": "RJ-085"
};

const viasLabelsGroup = L.layerGroup();
const VIAS_LABEL_REF_ZOOM = 15; // zoom de referência apenas p/ cálculo do ângulo (projeção conforme: ângulo não muda com o zoom)

function viasFlattenParts(geometry){
  if(!geometry) return [];
  if(geometry.type === "LineString") return [geometry.coordinates];
  if(geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

function viasLineLengthMeters(latlngs){
  let d = 0;
  for(let i=1;i<latlngs.length;i++) d += latlngs[i-1].distanceTo(latlngs[i]);
  return d;
}

// Encontra o ponto central (por distância real) do trecho e o ângulo de alinhamento
// com o sentido da linha naquele ponto, evitando texto de cabeça para baixo.
function viasMidpointAndAngle(latlngs){
  const total = viasLineLengthMeters(latlngs);
  if(total <= 0) return null;
  const half = total/2;
  let acc = 0;
  for(let i=1;i<latlngs.length;i++){
    const segLen = latlngs[i-1].distanceTo(latlngs[i]);
    if(segLen>0 && (acc+segLen >= half || i===latlngs.length-1)){
      const t = Math.max(0, Math.min(1, (half-acc)/segLen));
      const mid = L.latLng(
        latlngs[i-1].lat + (latlngs[i].lat - latlngs[i-1].lat)*t,
        latlngs[i-1].lng + (latlngs[i].lng - latlngs[i-1].lng)*t
      );
      const p1 = map.project(latlngs[i-1], VIAS_LABEL_REF_ZOOM);
      const p2 = map.project(latlngs[i], VIAS_LABEL_REF_ZOOM);
      let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180/Math.PI;
      // orientação automática: normaliza para o intervalo [-90, 90] para o texto nunca ficar invertido
      if(angle > 90) angle -= 180;
      if(angle < -90) angle += 180;
      return {latlng:mid, angle};
    }
    acc += segLen;
  }
  return null;
}

function viasAddSiglaLabel(nome, geometry){
  const sigla = VIAS_SIGLAS[nome];
  if(!sigla) return; // sem sigla oficial cadastrada: não rotula (não inventar)
  const parts = viasFlattenParts(geometry);
  if(!parts.length) return;
  // usa o trecho (sub-linha) mais longo em distância real como referência para o label
  let best = null, bestLen = -1;
  parts.forEach(coords=>{
    if(!coords || coords.length<2) return;
    const latlngs = coords.map(c=>L.latLng(c[1], c[0]));
    const len = viasLineLengthMeters(latlngs);
    if(len>bestLen){ bestLen = len; best = latlngs; }
  });
  if(!best) return;
  const res = viasMidpointAndAngle(best);
  if(!res) return;
  const icon = L.divIcon({
    className:"via-sigla-icon",
    html:`<span class="via-sigla-text" style="transform:translate(-50%,-50%) rotate(${res.angle}deg)">${sigla}</span>`,
    iconSize:[0,0],
    iconAnchor:[0,0]
  });
  viasLabelsGroup.addLayer(L.marker(res.latlng, {icon, pane:"paneViasLabels", interactive:false, keyboard:false}));
}

DATA_VIAS.features.forEach(f=> viasAddSiglaLabel(f.properties && f.properties.NOME, f.geometry));

// Mantém o grupo de labels sincronizado com a visibilidade da camada "vias",
// qualquer que seja o mecanismo usado para ligar/desligar a camada (painel de
// camadas, "mostrar/ocultar todas", restaurar camada oculta etc.), sem alterar
// nenhuma dessas funções existentes.
map.on("layeradd", e=>{
  if(e.layer === LAYERS.vias.leaflet && !map.hasLayer(viasLabelsGroup)) viasLabelsGroup.addTo(map);
});
map.on("layerremove", e=>{
  if(e.layer === LAYERS.vias.leaflet && map.hasLayer(viasLabelsGroup)) map.removeLayer(viasLabelsGroup);
});

const ESTACOES_IMAGENS = {
  "GRAMACHO": {
    src:"assets/images/estacoes/estacao_gramacho.png",
    original:"https://upload.wikimedia.org/wikipedia/commons/7/79/Esta%C3%A7%C3%A3o_Gramacho.png",
    source:"https://commons.wikimedia.org/wiki/File:Esta%C3%A7%C3%A3o_Gramacho.png",
    author:"Teteu-wiki", license:"CC BY-SA 4.0", licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
    consultedAt:"2026-10-02", status:"validada", alt:"Plataforma da Estação Gramacho da SuperVia"
  },
  "CENTRO": {
    src:"assets/images/estacoes/estacao_centro.jpg",
    original:"https://upload.wikimedia.org/wikipedia/commons/6/69/Esta%C3%A7%C3%A3o_Duque_de_Caxias.JPG",
    source:"https://commons.wikimedia.org/wiki/File:Esta%C3%A7%C3%A3o_Duque_de_Caxias.JPG",
    author:"Junius", license:"Domínio público (PD-self)", licenseUrl:"https://commons.wikimedia.org/wiki/Template:PD-self",
    consultedAt:"2026-10-02", status:"validada", alt:"Estação ferroviária Duque de Caxias, identificada como Centro nesta camada"
  },
  "JARDIM PRIMAVERA": {
    src:"assets/images/estacoes/estacao_jardim_primavera.png",
    original:"https://upload.wikimedia.org/wikipedia/commons/4/4b/Esta%C3%A7%C3%A3o_Jardim_Primavera.png",
    source:"https://commons.wikimedia.org/wiki/File:Esta%C3%A7%C3%A3o_Jardim_Primavera.png",
    author:"Teteu-wiki", license:"CC BY-SA 4.0", licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
    consultedAt:"2026-10-02", status:"validada", alt:"Estação Jardim Primavera da SuperVia"
  },
  "MANOEL BELO (SANTA LÚCIA)": {
    src:"assets/images/estacoes/estacao_manoel_belo.jpg",
    original:"https://upload.wikimedia.org/wikipedia/commons/9/98/Esta%C3%A7%C3%A3o_Manoel_Belo.JPG",
    source:"https://commons.wikimedia.org/wiki/File:Esta%C3%A7%C3%A3o_Manoel_Belo.JPG",
    author:"Junius", license:"Domínio público (PD-self)", licenseUrl:"https://commons.wikimedia.org/wiki/Template:PD-self",
    consultedAt:"2026-10-02", status:"validada", alt:"Estação Manoel Belo no ramal Vila Inhomirim"
  },
  "SARACURUNA": {
    src:"assets/images/estacoes/estacao_saracuruna.jpg",
    original:"https://upload.wikimedia.org/wikipedia/commons/6/66/Esta%C3%A7%C3%A3o_Saracuruna_%2808-06-2015%29_02.jpg",
    source:"https://commons.wikimedia.org/wiki/File:Esta%C3%A7%C3%A3o_Saracuruna_(08-06-2015)_02.jpg",
    author:"Henrique Freire; crédito: SuperVia/Imprensa RJ", license:"CC BY 2.0 Brasil", licenseUrl:"https://creativecommons.org/licenses/by/2.0/br/",
    consultedAt:"2026-10-02", status:"validada", alt:"Plataforma da Estação Saracuruna em 2015"
  },
  "PARADA ANGÉLICA": { src:null, original:null, source:null, author:null, license:null, consultedAt:"2026-10-02", status:"sem imagem aberta validada" },
  "CAMPOS ELÍSIOS": { src:null, original:null, source:null, author:null, license:null, consultedAt:"2026-10-02", status:"sem imagem aberta validada" },
  "IMBARIÊ": { src:null, original:null, source:null, author:null, license:null, consultedAt:"2026-10-02", status:"sem imagem aberta validada" },
  "CORTE OITO": {
    src:"assets/images/estacoes/estacao_corte_oito.jpg",
    original:"https://upload.wikimedia.org/wikipedia/commons/f/fd/Esta%C3%A7%C3%A3o_Corte_8_%282%29.jpg",
    source:"https://commons.wikimedia.org/wiki/File:Esta%C3%A7%C3%A3o_Corte_8_(2).jpg",
    author:"Marcelo Horn; crédito: SuperVia/Imprensa RJ", license:"CC BY 2.0 Brasil", licenseUrl:"https://creativecommons.org/licenses/by/2.0/br/",
    consultedAt:"2026-10-02", status:"validada", alt:"Plataforma da Estação Corte 8 da SuperVia"
  },
  "PARADA MORABI": { src:null, original:null, source:null, author:null, license:null, consultedAt:"2026-10-02", status:"sem imagem aberta validada" }
};
function estacaoImagemHTML(props, placement){
  const image=ESTACOES_IMAGENS[String(props?.Name||"").trim().toUpperCase()];
  if(!image || !image.src) return "";
  const attribution=`${image.author} · ${image.license}`;
  return `<figure class="ct-photo ct-photo--${placement}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async"><figcaption>Fonte da imagem: <a href="${escapeHtml(image.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attribution)}</a></figcaption></figure>`;
}

const ESCOLAS_IMAGENS = {
  "CIEP BRIZOLÃO MUNICIPALIZADO 338 - CÉLIA RABELO": {
    src:"assets/images/escolas/escola_ciep_338_celia_rabelo.jpg",
    original:"https://upload.wikimedia.org/wikipedia/commons/8/89/CIEP_in_Xer%C3%A9m_-_panoramio.jpg",
    source:"https://commons.wikimedia.org/wiki/File:CIEP_in_Xer%C3%A9m_-_panoramio.jpg",
    author:"paulsmithrj", license:"CC BY-SA 3.0", licenseUrl:"https://creativecommons.org/licenses/by-sa/3.0/",
    consultedAt:"2026-10-02", status:"validada", alt:"CIEP Brizolão Municipalizado 338 Célia Rabelo, em Xerém"
  }
};
const SAUDE_IMAGENS = {};
function escolasImagemHTML(props, placement){
  const image=ESCOLAS_IMAGENS[String(props?.NOME||"").trim().toUpperCase()];
  if(!image || !image.src) return "";
  const attribution=`${image.author} · ${image.license}`;
  return `<figure class="ct-photo ct-photo--${placement}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async"><figcaption>Fonte da imagem: <a href="${escapeHtml(image.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attribution)}</a></figcaption></figure>`;
}
function saudeImagemHTML(props, placement){
  const image=SAUDE_IMAGENS[String(props?.NOME||"").trim().toUpperCase()];
  if(!image || !image.src) return "";
  const attribution=`${image.author} · ${image.license}`;
  return `<figure class="ct-photo ct-photo--${placement}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async"><figcaption>Fonte da imagem: <a href="${escapeHtml(image.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attribution)}</a></figcaption></figure>`;
}


/* ================= FACES DE LOGRADOURO — dados otimizados =================
   Os dados são carregados como JavaScript local para funcionar tanto em servidor
   web quanto quando o Geoportal é aberto localmente, sem depender de fetch/CORS.
*/
let facesLogradouroLoadPromise = null;

function loadFacesLogradouroLayer(){
  const layer = LAYERS["faces_logradouro"];
  if(!layer) return Promise.resolve(false);
  if(layer._loaded) return Promise.resolve(true);
  if(facesLogradouroLoadPromise) return facesLogradouroLoadPromise;

  facesLogradouroLoadPromise = Promise.resolve().then(()=>{
    if(typeof DATA_FACES_LOGRADOURO === "undefined") throw new Error("Dados de Faces de Logradouro não encontrados.");
    layer.leaflet.addData(DATA_FACES_LOGRADOURO);
    // Os eventos de hover precisam ser vinculados depois que as feições
    // são efetivamente adicionadas ao GeoJSON (a vinculação global ocorre
    // antes do carregamento desta camada).
    if(typeof bindHoverToLayer === "function") {
      layer.leaflet.eachLayer(l => bindHoverToLayer(l, "faces_logradouro"));
    }
    layer._loaded = true;
    layer.count = DATA_FACES_LOGRADOURO.features ? DATA_FACES_LOGRADOURO.features.length : layer.count;
    return true;
  }).catch(err=>{
    console.error("Não foi possível carregar Faces de Logradouro:", err);
    layer._loaded = false;
    facesLogradouroLoadPromise = null;
    if(typeof showToast==="function") showToast("Não foi possível carregar a camada Faces de Logradouro.");
    return false;
  });

  return facesLogradouroLoadPromise;
}

registerLayer("faces_logradouro", {
  label:"Faces de Logradouro",
  category:"Infraestrutura",
  defaultVisible:false,
  geometry:"linha",
  zoomControlled:true,
  minZoom:15,
  lazyLoad:true,
  autoShowOnZoom:true,
  _loaded:false,
  count:31509,
  swatch:{type:"line", color:"#FF0000"},
  leaflet: L.geoJSON(null, {
    pane:"paneOverlayLinhas",
    style:{color:"#FF0000", weight:0.8, opacity:0.9},
    onEachFeature:(f,l)=>{
      const p=f.properties||{};
      const tipo=[p.NM_TIP_LOG,p.NM_TIT_LOG].filter(Boolean).join(" ");
      const nome=p.NM_LOG||"Logradouro sem nome";
      const setor=p.CD_SETOR||"-";
      const quadra=p.CD_QUADRA||"-";
      const face=p.CD_FACE||"-";
      const totalRes=p.TOT_RES ?? "-";
      const totalGeral=p.TOT_GERAL ?? "-";
      l.bindPopup(
        `<b>${escapeHtml(nome)}</b>`+
        `<br>${escapeHtml(tipo||"Logradouro")}`+
        `<br>Face: ${escapeHtml(face)}`+
        `<br>Setor: ${escapeHtml(setor)}`+
        `<br>Quadra: ${escapeHtml(quadra)}`+
        `<br>Residências: ${escapeHtml(totalRes)}`+
        `<br>Total: ${escapeHtml(totalGeral)}`
      );
    }
  })
});

// 5. Estações ferroviárias
registerLayer("estacoes", {
  label:"Estações Ferroviárias",
  category:"Infraestrutura",
  defaultVisible:false,
  zoomControlled:true,
  minZoom:14,
  count: DATA_ESTACOES.features.length,
  swatch:{type:"icon", glyph:"&#128646;", color:"#4A4A4A"},
  leaflet: L.geoJSON(DATA_ESTACOES, {
    pane:"paneOverlayPontos",
    pointToLayer:(f,latlng)=> L.marker(latlng,{icon:ICON_ESTACAO, pane:"paneOverlayPontos"}),
    onEachFeature:(f,l)=>{
      const p=f.properties||{};
      const image=estacaoImagemHTML(p,"popup");
      l.bindPopup(`${image}<b>${escapeHtml(p.Name||"Estação")}</b><br>Ramal: ${escapeHtml(p.Ramal||"-")}`);
    }
  })
});

// 6. Unidades de Saúde
registerLayer("saude", {
  label:"Unidades de Saúde",
  category:"Equipamentos",
  defaultVisible:false,
  zoomControlled:true,
  minZoom:14,
  count: DATA_SAUDE.features.length,
  swatch:{type:"icon", glyph:"&#10084;", color:"#CA3000"},
  leaflet: L.geoJSON(DATA_SAUDE, {
    pane:"paneOverlayPontos",
    pointToLayer:(f,latlng)=> L.marker(latlng,{icon:ICON_SAUDE, pane:"paneOverlayPontos"}),
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const image=saudeImagemHTML(p,"popup");
      l.bindPopup(`${image}<b>${escapeHtml(p.NOME)}</b><br>${escapeHtml(p.TIPO||"")}<br>${escapeHtml(p.ENDERECO||"")}<br><span style="color:#a9b3ac">Bairro: ${escapeHtml(p.BAIRRO||"-")}</span>`);
    }
  })
});

// 7. Escolas
registerLayer("escolas", {
  label:"Escolas Municipais",
  category:"Equipamentos",
  defaultVisible:false,
  zoomControlled:true,
  minZoom:14,
  count: DATA_ESCOLAS.features.length,
  swatch:{type:"icon", glyph:"&#127970;", color:"#8333A8"},
  leaflet: L.geoJSON(DATA_ESCOLAS, {
    pane:"paneOverlayPontos",
    pointToLayer:(f,latlng)=> L.marker(latlng,{icon:ICON_ESCOLA, pane:"paneOverlayPontos"}),
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const image=escolasImagemHTML(p,"popup");
      l.bindPopup(`${image}<b>${escapeHtml(p.NOME)}</b><br>${escapeHtml(p.TIPO||"")}<br>${escapeHtml(p.ENDERECO||"")}<br><span style="color:#a9b3ac">Bairro: ${escapeHtml(p.BAIRRO||"-")}</span>`);
    }
  })
});

// 8. Setores censitários (choropleth) - oculto por padrão
const popValues = DATA_CENSO.features.map(f=>f.properties.V0001||0).sort((a,b)=>a-b);
function quantile(arr,q){ const pos=(arr.length-1)*q; const base=Math.floor(pos); const rest=pos-base; return arr[base+1]!==undefined ? arr[base]+rest*(arr[base+1]-arr[base]) : arr[base]; }
const CENSO_BREAKS = [0.2,0.4,0.6,0.8].map(q=>quantile(popValues,q));
const CENSO_COLORS = ["#ffffcc","#fed976","#fd8d3c","#e31a1c","#800026"];
function censoColor(v){
  for(let i=0;i<CENSO_BREAKS.length;i++){ if(v<=CENSO_BREAKS[i]) return CENSO_COLORS[i]; }
  return CENSO_COLORS[CENSO_COLORS.length-1];
}
function censoRangeIndex(v){
  for(let i=0;i<CENSO_BREAKS.length;i++){ if(v<=CENSO_BREAKS[i]) return i; }
  return CENSO_BREAKS.length;
}
function censoRangeLabel(i){
  const fmt = n=>Math.round(n).toLocaleString("pt-BR");
  const lo = i===0 ? popValues[0] : CENSO_BREAKS[i-1];
  const hi = i<CENSO_BREAKS.length ? CENSO_BREAKS[i] : popValues[popValues.length-1];
  return i===0 ? `até ${fmt(hi)}` : `${fmt(lo)} – ${fmt(hi)}`;
}
registerLayer("censo", {
  label:"Setores Censitários (Pop. 2022)",
  category:"Estatísticas",
  defaultVisible:false,
  hasDashboard:true,
  count: DATA_CENSO.features.length,
  swatch:{type:"gradient"},
  leaflet: L.geoJSON(DATA_CENSO, {
    pane:"paneOverlayPoligonos",
    style:f=>({color:"#12140f", weight:0.4, fillColor:censoColor(f.properties.V0001||0), fillOpacity:0.7}),
    onEachFeature:(f,l)=>{
      const p=f.properties;
      l.bindPopup(`<b>Setor ${escapeHtml(p.CD_SETOR)}</b><br>População: ${escapeHtml(p.V0001)}<br>Situação: ${escapeHtml(p.SITUACAO||"-")}`);
      // Seleção de setores no mapa: ativa apenas com o Dashboard aberto, para não
      // alterar o comportamento da camada "censo" fora desse contexto.
      l.on("click", ()=>{
        if(typeof censoDashboardIsOpen==="function" && censoDashboardIsOpen()){
          censoToggleSectorSelection(p.CD_SETOR);
        }
      });
    }
  })
});

// add default-visible layers to map, in a sensible draw order

registerLayer("cemiterios", {
  label:"Cemitérios",
  category:"Equipamentos",
  defaultVisible:false,
  zoomControlled:true,
  minZoom:14,
  count: DATA_CEMITERIOS.features.length,
  swatch:{type:"icon", glyph:"&#10013;", color:"#333333"},
  leaflet: L.geoJSON(DATA_CEMITERIOS, {
    pane:"paneOverlayPontos",
    pointToLayer:(f,latlng)=> L.marker(latlng,{icon:ICON_CEMITERIO, pane:"paneOverlayPontos"}),
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const title = p.NOME || p.Nome || p.nome || "Cemitério";
      const rows = Object.keys(p).filter(k=>k!=="id" && k!=="FID" && k.toLowerCase()!=="nome").slice(0,5).map(k=>`<b>${escapeHtml(k)}:</b> ${escapeHtml(p[k])}`).join("<br>");
      l.bindPopup(`<b>${escapeHtml(title)}</b><br>${rows}`);
    }
  })
});

registerLayer("religiao", {
  label:"Religião",
  category:"Equipamentos",
  defaultVisible:false,
  zoomControlled:true,
  minZoom:14,
  count: DATA_RELIGIAO.features.length,
  swatch:{type:"icon", glyph:"&#9962;", color:"#8B4513"},
  leaflet: L.geoJSON(DATA_RELIGIAO, {
    pane:"paneOverlayPontos",
    pointToLayer:(f,latlng)=> L.marker(latlng,{icon:ICON_RELIGIAO, pane:"paneOverlayPontos"}),
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const title = p.NOME || p.Nome || p.nome || "Templo Religioso";
      const rows = Object.keys(p).filter(k=>k!=="id" && k!=="FID" && k.toLowerCase()!=="nome").slice(0,5).map(k=>`<b>${escapeHtml(k)}:</b> ${escapeHtml(p[k])}`).join("<br>");
      l.bindPopup(`<b>${escapeHtml(title)}</b><br>${rows}`);
    }
  })
});

registerLayer("reservatorio", {
  label:"Reservatório de Água",
  category:"Infraestrutura",
  defaultVisible:false,
  zoomControlled:true,
  minZoom:14,
  count: DATA_RESERVATORIO.features.length,
  swatch:{type:"icon", glyph:"&#128167;", color:"#00BFFF"},
  leaflet: L.geoJSON(DATA_RESERVATORIO, {
    pane:"paneOverlayPontos",
    pointToLayer:(f,latlng)=> L.marker(latlng,{icon:ICON_RESERVATORIO, pane:"paneOverlayPontos"}),
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const title = p.NOME || p.Nome || p.nome || "Reservatório de Água";
      const rows = Object.keys(p).filter(k=>k!=="id" && k!=="FID" && k.toLowerCase()!=="nome").slice(0,5).map(k=>`<b>${escapeHtml(k)}:</b> ${escapeHtml(p[k])}`).join("<br>");
      l.bindPopup(`<b>${escapeHtml(title)}</b><br>${rows}`);
    }
  })
});

/* ================= USO E OCUPAÇÃO DO SOLO — cores dinâmicas por classe ================= */
const USO_PALETTE = ["#2e7d32","#1e88e5","#fdd835","#8d6e63","#66bb6a","#fb8c00","#8e24aa","#00acc1","#e53935","#3949ab","#c0ca33","#00897b","#6d4c41","#d81b60","#546e7a","#f4511e"];
// Cores definidas especificamente para as classes existentes no GeoJSON.
// A comparação é normalizada para manter o funcionamento mesmo com acentos,
 // maiúsculas/minúsculas ou pequenas variações de grafia.
const USO_CLASS_COLORS = {
  "agua": "#2196F3",
  "vegetacao (arvores)": "#1B5E20",
  "area construida": "#E53935",
  "vegetacao inundada": "#81C784",
  "pastagem natural": "#FFB74D",
  "culturas": "#D4A017"
};
const USO_COLOR_CACHE = {};
function usoColor(classe){
  const key = usoNormalize(classe);
  if(Object.prototype.hasOwnProperty.call(USO_CLASS_COLORS, key)){
    return USO_CLASS_COLORS[key];
  }
  if(!USO_COLOR_CACHE[classe]){
    const used = Object.keys(USO_COLOR_CACHE).length;
    USO_COLOR_CACHE[classe] = USO_PALETTE[used % USO_PALETTE.length];
  }
  return USO_COLOR_CACHE[classe];
}
function usoNormalize(s){
  return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
function usoFormatArea(m2){
  m2 = m2 || 0;
  const km2 = m2/1e6;
  if(km2>=1){
    return km2.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' km²';
  }
  const ha = m2/10000;
  return ha.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ha';
}
let usoSelectedClass = null;
function usoFeatureStyle(f){
  const classe = (f.properties && f.properties.Classe) || "Sem classe";
  const color = usoColor(classe);
  const isSelected = usoSelectedClass && classe===usoSelectedClass;
  const isDimmed = usoSelectedClass && classe!==usoSelectedClass;
  return {
    color: isSelected ? "#ffffff" : "#12140f",
    weight: isSelected ? 2 : 0.6,
    fillColor: color,
    fillOpacity: isDimmed ? 0.12 : 0.62,
    opacity: isDimmed ? 0.25 : 0.85
  };
}
function usoRestyleMap(){
  const layer = LAYERS["uso_ocupacao"];
  if(!layer) return;
  layer.leaflet.eachLayer(l=>{
    if(l.feature) l.setStyle(usoFeatureStyle(l.feature));
  });
}
function usoSelectClass(classe){
  usoSelectedClass = (usoSelectedClass===classe) ? null : classe;
  usoRestyleMap();
  if(typeof usoRenderPanel==="function") usoRenderPanel();
}
function usoClearSelection(){
  usoSelectedClass = null;
  usoRestyleMap();
  if(typeof usoRenderPanel==="function") usoRenderPanel();
}

registerLayer("uso_ocupacao", {
  label:"Uso e Ocupação do Solo",
  category:"Uso e Ocupação do Solo",
  defaultVisible:false,
  hasDashboard:true,
  count: DATA_USO_OCUPACAO.features.length,
  swatch:{type:"fill", color:"#66bb6a"},
  leaflet: L.geoJSON(DATA_USO_OCUPACAO, {
    pane:"paneOverlayPoligonos",
    style: f => usoFeatureStyle(f),
    onEachFeature:(f,l)=>{
      const p = f.properties || {};
      const classe = p.Classe || "Sem classe";
      const area = usoFormatArea(p.Shape_Area||0);
      l.bindPopup(`<b>${escapeHtml(classe)}</b><br>Área: ${escapeHtml(area)}`);
      l.on("click", ()=> usoSelectClass(classe));
    }
  })
});

registerLayer("ucs_estadual", {
  label:"UCs Estadual",
  category:"Meio Ambiente",
  defaultVisible:false,
  count: DATA_UCS_ESTADUAL.features ? DATA_UCS_ESTADUAL.features.length : 0,
  swatch:{type:"fill", color:UC_DEFAULT_COLOR},
  leaflet: L.geoJSON(DATA_UCS_ESTADUAL, {
    pane:"paneOverlayPoligonos",
    style:f=>{ const c = ucColor(f.properties && f.properties.categoria); return {color:c, weight:1.5, fillColor:c, fillOpacity:0.45}; },
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const rows = Object.keys(p).filter(k=>k!=="id" && k!=="FID").slice(0,5).map(k=>`<b>${escapeHtml(k)}:</b> ${escapeHtml(p[k])}`).join("<br>");
      l.bindPopup(rows || "UC Estadual");
    }
  })
});

registerLayer("ucs_federal", {
  label:"UCs Federal",
  category:"Meio Ambiente",
  defaultVisible:false,
  count: DATA_UCS_FEDERAL.features ? DATA_UCS_FEDERAL.features.length : 0,
  swatch:{type:"fill", color:UC_DEFAULT_COLOR},
  leaflet: L.geoJSON(DATA_UCS_FEDERAL, {
    pane:"paneOverlayPoligonos",
    style:f=>{ const c = ucColor(f.properties && f.properties.categoria); return {color:c, weight:1.5, fillColor:c, fillOpacity:0.45}; },
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const rows = Object.keys(p).filter(k=>k!=="id" && k!=="FID").slice(0,5).map(k=>`<b>${escapeHtml(k)}:</b> ${escapeHtml(p[k])}`).join("<br>");
      l.bindPopup(rows || "UC Federal");
    }
  })
});

registerLayer("ucs_municipal", {
  label:"UCs Municipal",
  category:"Meio Ambiente",
  defaultVisible:false,
  count: DATA_UCS_MUNICIPAL.features ? DATA_UCS_MUNICIPAL.features.length : 0,
  swatch:{type:"fill", color:UC_DEFAULT_COLOR},
  leaflet: L.geoJSON(DATA_UCS_MUNICIPAL, {
    pane:"paneOverlayPoligonos",
    style:f=>{ const c = ucColor(f.properties && f.properties.categoria); return {color:c, weight:1.5, fillColor:c, fillOpacity:0.45}; },
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const rows = Object.keys(p).filter(k=>k!=="id" && k!=="FID").slice(0,5).map(k=>`<b>${escapeHtml(k)}:</b> ${escapeHtml(p[k])}`).join("<br>");
      l.bindPopup(rows || "UC Municipal");
    }
  })
});

registerLayer("hidrografia", {
  label:"Hidrografia",
  category:"Meio Ambiente",
  defaultVisible:false,
  count: DATA_HIDROGRAFIA.features ? DATA_HIDROGRAFIA.features.length : 0,
  swatch:{type:"line", color:"#0000ff"},
  leaflet: L.geoJSON(DATA_HIDROGRAFIA, {
    pane:"paneOverlayLinhas",
    style:f=>({color:"#0000ff", weight:2, opacity:0.8}),
    onEachFeature:(f,l)=>{
      const p=f.properties;
      const rows = Object.keys(p).filter(k=>k!=="id" && k!=="FID").slice(0,5).map(k=>`<b>${escapeHtml(k)}:</b> ${escapeHtml(p[k])}`).join("<br>");
      l.bindPopup(rows || "Corpo D'água");
    }
  })
});

/* ================= CAMADAS AMBIENTAIS FBDS =================
   Os GeoJSON mantêm os atributos originais; a proveniência e os links dos
   metadados acompanham cada camada para consulta no catálogo e nos popups. */
const FBDS_BASE_URL = "https://geo.fbds.org.br/RJ/DUQUE_DE_CAXIAS/";
const FBDS_USO_URL = FBDS_BASE_URL + "USO/";
const FBDS_HIDRO_URL = FBDS_BASE_URL + "HIDROGRAFIA/";
const FBDS_APP_URL = FBDS_BASE_URL + "APP/";

function fbdsPopupHTML(layer, properties, fields){
  const rows = fields.map(([key,label])=>{
    const value = properties[key];
    if(value === undefined || value === null || value === "") return "";
    const shown = typeof value === "number"
      ? value.toLocaleString("pt-BR",{maximumFractionDigits:4})
      : String(value);
    return `<b>${escapeHtml(label)}:</b> ${escapeHtml(shown)}`;
  }).filter(Boolean).join("<br>");
  const source = layer.sourceUrl
    ? `<br>Fonte: <a class="fbds-popup-source" href="${layer.sourceUrl}" target="_blank" rel="noopener noreferrer">FBDS · ${escapeHtml(layer.sourceDataset||"dados da camada")}</a>`
    : "<br>Fonte: FBDS";
  const metadata = layer.metadataUrl
    ? `<br><a class="fbds-popup-source" href="${layer.metadataUrl}" target="_blank" rel="noopener noreferrer">Metadados técnicos (FBDS)</a>`
    : "";
  return `<b>${escapeHtml(layer.label)}</b>${rows?`<br>${rows}`:""}${source}${metadata}`;
}

function fbdsUsageColor(value){
  const normalized = usoNormalize(value);
  const colors = {
    "formacao florestal":"#24733b",
    "formacao nao florestal":"#78a84a",
    "area antropizada":"#d6a43b",
    "area edificada":"#c7463b",
    "agua":"#277da1",
    "silvicultura":"#8d6e45"
  };
  return colors[normalized] || "#777777";
}

let fbdsUsageSelectedClass = null;
function fbdsUsageFeatureStyle(feature){
  const properties = feature.properties || {};
  const className = properties.CLASSE_USO || "Sem classe";
  const color = fbdsUsageColor(className);
  const selected = fbdsUsageSelectedClass;
  const active = selected && className === selected;
  const dimmed = selected && !active;
  return {
    color: active ? "#ffffff" : "#243129",
    weight: active ? 2 : 0.6,
    fillColor: color,
    fillOpacity: dimmed ? 0.12 : 0.62,
    opacity: dimmed ? 0.25 : 0.85
  };
}

function fbdsRegisterGeoLayer(id, config){
  const featureCollection = config.data;
  const fields = config.fields;
  const layerConfig = {
    label:config.label,
    category:"Meio Ambiente",
    geometry:config.geometry,
    defaultVisible:false,
    hasDashboard:config.hasDashboard === true,
    count:featureCollection.features.length,
    swatch:config.swatch,
    sourceName:"Fundação Brasileira para o Desenvolvimento Sustentável (FBDS)",
    sourceUrl:config.sourceUrl,
    sourceDataset:config.sourceDataset,
    metadataUrl:config.metadataUrl
  };
  layerConfig.leaflet=L.geoJSON(featureCollection,{
    pane:config.pane,
    style:config.style,
    pointToLayer:config.pointToLayer,
    onEachFeature:(feature,leafletLayer)=>{
      leafletLayer.bindPopup(fbdsPopupHTML(layerConfig,feature.properties || {},fields));
      if(config.onFeatureClick) leafletLayer.on("click",()=>config.onFeatureClick(feature));
    }
  });
  registerLayer(id,layerConfig);
}

fbdsRegisterGeoLayer("fbds_nascentes",{
  label:"Nascentes (FBDS)", geometry:"ponto", data:DATA_FBDS_NASCENTES,
  pane:"paneOverlayPontos", swatch:{type:"icon",color:"#087f8c",glyph:"●"},
  sourceUrl:FBDS_HIDRO_URL, sourceDataset:"RJ_3301702_NASCENTES",
  metadataUrl:FBDS_HIDRO_URL+"RJ_3301702_NASCENTES.shp.xml",
  fields:[["GEOCODIGO","Código geográfico"],["HIDRO","Identificação hidrográfica"]],
  pointToLayer:(feature,latlng)=>L.circleMarker(latlng,{radius:4,color:"#075b66",weight:1,fillColor:"#00a6b2",fillOpacity:.9})
});
fbdsRegisterGeoLayer("fbds_rios_simples",{
  label:"Rios simples (FBDS)", geometry:"linha", data:DATA_FBDS_RIOS_SIMPLES,
  pane:"paneOverlayLinhas", swatch:{type:"line",color:"#147bd1"},
  sourceUrl:FBDS_HIDRO_URL, sourceDataset:"RJ_3301702_RIOS_SIMPLES",
  metadataUrl:FBDS_HIDRO_URL+"RJ_3301702_RIOS_SIMPLES.shp.xml",
  fields:[["GEOCODIGO","Código geográfico"],["HIDRO","Identificação hidrográfica"],["COMP_KM","Comprimento (km)"]],
  style:{color:"#147bd1",weight:1.7,opacity:.88}
});
fbdsRegisterGeoLayer("fbds_massas_dagua",{
  label:"Massas d'água (FBDS)", geometry:"poligono", data:DATA_FBDS_MASSAS_DAGUA,
  pane:"paneOverlayPoligonos", swatch:{type:"fill",color:"#3287b8"},
  sourceUrl:FBDS_HIDRO_URL, sourceDataset:"RJ_3301702_MASSAS_DAGUA",
  metadataUrl:FBDS_HIDRO_URL+"RJ_3301702_MASSAS_DAGUA.shp.xml",
  fields:[["HIDRO","Identificação hidrográfica"],["NATUREZA","Natureza"],["RIO","Rio"],["SETOR","Setor"],["AREA_HA","Área (ha)"]],
  style:{color:"#155a7a",weight:1,fillColor:"#3287b8",fillOpacity:.55}
});
fbdsRegisterGeoLayer("fbds_rios_duplos",{
  label:"Rios duplos (FBDS)", geometry:"poligono", data:DATA_FBDS_RIOS_DUPLOS,
  pane:"paneOverlayPoligonos", swatch:{type:"fill",color:"#55a5c8"},
  sourceUrl:FBDS_HIDRO_URL, sourceDataset:"RJ_3301702_RIOS_DUPLOS",
  metadataUrl:FBDS_HIDRO_URL+"RJ_3301702_RIOS_DUPLOS.shp.xml",
  fields:[["HIDRO","Identificação hidrográfica"],["AREA_HA","Área (ha)"]],
  style:{color:"#155a7a",weight:1,fillColor:"#55a5c8",fillOpacity:.52}
});
fbdsRegisterGeoLayer("fbds_app",{
  label:"Áreas de Preservação Permanente (APP · FBDS)", geometry:"poligono", data:DATA_FBDS_APP,
  pane:"paneOverlayPoligonos", swatch:{type:"fill",color:"#238b57"},
  sourceUrl:FBDS_APP_URL, sourceDataset:"RJ_3301702_APP",
  metadataUrl:FBDS_APP_URL+"RJ_3301702_APP.shp.xml",
  fields:[["GEOCODIGO","Código geográfico"],["HIDRO","Identificação hidrográfica"],["APP_M","APP (m)"],["AREA_HA","Área (ha)"]],
  style:{color:"#155b38",weight:1,fillColor:"#238b57",fillOpacity:.42}
});
fbdsRegisterGeoLayer("fbds_app_uso",{
  label:"Uso do solo em APP (FBDS)", geometry:"poligono", data:DATA_FBDS_APP_USO,
  pane:"paneOverlayPoligonos", swatch:{type:"multi",color:"#d6a43b"},
  sourceUrl:FBDS_APP_URL, sourceDataset:"RJ_3301702_APP_USO",
  metadataUrl:FBDS_APP_URL+"RJ_3301702_APP_USO.shp.xml",
  fields:[["CLASSE_USO","Classe de uso"],["AREA_HA","Área (ha)"],["GEOCODIGO","Código geográfico"]],
  style:feature=>({color:"#4a473b",weight:.55,fillColor:fbdsUsageColor(feature.properties && feature.properties.CLASSE_USO),fillOpacity:.62})
});
fbdsRegisterGeoLayer("uso_ocupacao_fbds",{
  label:"Uso e ocupação do solo (FBDS)", geometry:"poligono", data:DATA_FBDS_USO_OCUPACAO,
  pane:"paneOverlayPoligonos", swatch:{type:"multi",color:"#24733b"}, hasDashboard:true,
  sourceUrl:FBDS_USO_URL, sourceDataset:"RJ_3301702_USO",
  metadataUrl:FBDS_USO_URL+"RJ_3301702_USO.shp.xml",
  fields:[["CLASSE_USO","Classe de uso"],["AREA_HA","Área (ha)"],["GEOCODIGO","Código geográfico"]],
  style:fbdsUsageFeatureStyle,
  onFeatureClick:feature=>{
    if(typeof fbdsUsoSelectClass==="function") fbdsUsoSelectClass((feature.properties||{}).CLASSE_USO || "Sem classe");
  }
});
/* ================= NOVAS CAMADAS (V11) =================
   Cultura e Turismo, Forças de Segurança, Secretarias Municipais, Terminais
   Rodoviários, Unidades de Assistência Social e Plano Diretor 2022.
   Só são exibidos atributos existentes nos arquivos originais — campos em
   branco são omitidos nos popups. A mesma configuração (título + campos)
   alimenta popup, tooltip de passagem do mouse e resultados da Consulta por Raio. */
function fmtFonteData(v){
  const n = Number(v);
  if(!Number.isFinite(n) || n<=0) return String(v);
  return new Date(n).toLocaleDateString("pt-BR",{timeZone:"UTC"});
}
const CULTURA_TURISMO_RESUMOS = {
  "TEATRO MUNICIPAL ARMANDO MELLO":"Fundado na década de 1960, é um dos equipamentos culturais mais tradicionais de Duque de Caxias, voltado para apresentações teatrais, oficinas, cursos de artes cênicas e eventos culturais comunitários.",
  "BIBLIOTECA MUNICIPAL GOVERNADOR LEONEL DE MOURA BRIZOLA":"Integra o Centro Cultural Oscar Niemeyer. Oferece acervo diversificado para pesquisa e leitura, espaço para estudo, atividades literárias e projetos de incentivo à leitura na região.",
  "TEATRO MUNICIPAL RAUL CORTEZ":"Projetado por Oscar Niemeyer, é o principal e maior palco do município. Sedia grandes espetáculos de teatro, dança, música, festivais e eventos artísticos de nível regional e nacional.",
  "MUSEU VIVO DE DO SAO BENTO":"Primeiro museu de percurso e comunitário da Baixada Fluminense. Preserva e difunde a história local, o patrimônio socioambiental e a memória afro-brasileira e quilombola da região.",
  "MUSEU MUNICIPAL DE DUQUE DE CAXIAS E DA TAQUARA":"Localizado na antiga Fazenda São José da Taquara, preserva o patrimônio histórico e arquitetônico do período colonial, contando a história do povoamento e desenvolvimento do município.",
  "BIBLIOTECA PUBLICA DE XEREM FERREIRA GULLAR":"Equipamento voltado ao atendimento da comunidade de Xerém, oferecendo consulta a acervo bibliográfico, mediação de leitura e apoio a atividades educativas e culturais do distrito."
};
const CULTURA_TURISMO_IMAGENS = {
  "TEATRO MUNICIPAL ARMANDO MELLO":{
    src:"assets/images/cultura-armando-mello.jpg", alt:"Apresentação teatral no Teatro Municipal Armando Mello",
    credit:"Secretaria Municipal de Cultura e Turismo de Duque de Caxias", source:"https://smct.duquedecaxias.rj.gov.br/noticias/curso-de-iniciacao-teatral-abre-inscricoes-no-teatro-armando-mello/"
  },
  "BIBLIOTECA MUNICIPAL GOVERNADOR LEONEL DE MOURA BRIZOLA":{
    src:"assets/images/cultura-biblioteca-brizola.jpg", alt:"Centro Cultural Oscar Niemeyer, onde fica a Biblioteca Municipal Leonel de Moura Brizola",
    credit:"Arquivo / SECOM DC", source:"https://smct.duquedecaxias.rj.gov.br/noticias/biblioteca-municipal-gov-leonel-de-moura-brizola-celebra-18-anos-com-atividade-cultural/"
  },
  "TEATRO MUNICIPAL RAUL CORTEZ":{
    src:"assets/images/cultura-raul-cortez.jpg", alt:"Fachada do Teatro Municipal Raul Cortez",
    credit:"Gabi Pereira / SMCT DC", source:"https://smct.duquedecaxias.rj.gov.br/noticias/cultura-e-arte-teatro-raul-cortez-e-o-maior-espaco-publico-cultural-da-baixada-fluminense/"
  },
  "MUSEU VIVO DE DO SAO BENTO":{
    src:"assets/images/cultura-museu-vivo-sao-bento.jpg", alt:"Fachada do Museu Vivo de São Bento e busto histórico",
    credit:"Encontra Duque de Caxias", source:"https://www.encontraduquedecaxias.com.br/duque-de-caxias/museu-vivo-de-sao-bento-em-duque-de-caxias.shtml"
  },
  "MUSEU MUNICIPAL DE DUQUE DE CAXIAS E DA TAQUARA":{
    src:"assets/images/cultura-museu-taquara.jpg", alt:"Museu Municipal de Duque de Caxias e da Taquara",
    credit:"Encontra Duque de Caxias", source:"https://www.encontraduquedecaxias.com.br/duque-de-caxias/museu-da-taquara-em-duque-de-caxias.shtml"
  },
  "BIBLIOTECA PUBLICA DE XEREM FERREIRA GULLAR":{
    src:"assets/images/cultura-biblioteca-xerem.jpg", alt:"Fachada da Biblioteca Pública de Xerém Ferreira Gullar",
    credit:"Secretaria Municipal de Cultura e Turismo de Duque de Caxias", source:"https://smct.duquedecaxias.rj.gov.br/noticias/biblioteca-publica-ja-foi-cinema-com-240-lugares-e-continua-encantando-visitantes-em-xerem/"
  }
};
function culturaTurismoImagemHTML(props, placement){
  const image = CULTURA_TURISMO_IMAGENS[String(props?.NOME||"").trim().toUpperCase()];
  if(!image) return "";
  return `<figure class="ct-photo ct-photo--${placement}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async"><figcaption>Fonte: <a href="${escapeHtml(image.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(image.credit)}</a></figcaption></figure>`;
}
/* ---- Petróleo e Gás (V15): formatadores de exibição (os dados originais permanecem intactos) ----
   Nas bases de origem a acentuação foi corrompida (ex.: "OPERAÇÃO" aparece como "OPERAORO",
   "Gás" como "Grs"). Para o campo de situação e o de fluido o significado é inequívoco,
   então a exibição (popup, tooltip, resultados de raio) é normalizada; a Tabela de Atributos
   e as exportações continuam com o valor original. */
function fmtSituacaoOperacao(v){
  const s = String(v).trim();
  if(/^autorizada\s+opera/i.test(s)) return "Autorizada operação";
  if(/^opera/i.test(s)) return "Operação";
  return s;
}
function fmtFluidoGas(v){
  const s = String(v).trim();
  return s.replace(/^Gr?s\b/i, "Gás");
}
function fmtExtensaoKm(v){
  const n = Number(String(v).replace(",","."));
  return Number.isFinite(n) ? n.toLocaleString("pt-BR",{maximumFractionDigits:3})+" km" : String(v);
}
function fmtDiametroPol(v){
  const s = String(v).trim();
  return /^[\d.,]+$/.test(s) ? s+" pol" : s;
}
const NEW_LAYER_CFG = {
  cultura_turismo: { idField:"NOME", idFallback:"Equipamento de Cultura e Turismo",
    fields:[["TIPO","Tipo"],["SECRETARIA","Secretaria"],["ENDERECO","Endereço"],["BAIRRO","Bairro"],["DISTRITO","Distrito"],["FONTE","Fonte"],["FonteData","Data da fonte",fmtFonteData]] },
  seguranca: { idField:"PTREF", idFallback:"Força de Segurança",
    fields:[["Orgao","Órgão"],["OBS","Observação"],["Loteamento","Loteamento"],["Fonte","Fonte"]] },
  secretarias: { idField:"SECRETARIA", idFallback:"Secretaria Municipal",
    fields:[["ENDERECO","Endereço"],["FONTE","Fonte"]] },
  terminais: { idField:"NOME", idFallback:"Terminal Rodoviário",
    fields:[["TIPOEDIFRO","Tipo"],["Bairro","Bairro"],["Distrito","Distrito"],["Caxias","Caxias"],["Ano","Ano"],["Fonte","Fonte"],["Elaboraç","Elaboração"],["Contato","Contato"]] },
  assistencia_social: { idField:"NOME", idFallback:"Unidade de Assistência Social",
    fields:[["TIPO","Tipo"],["SECRETARIA","Secretaria"],["ENDERECO","Endereço"],["BAIRRO","Bairro"],["DISTRITO","Distrito"],["FONTE","Fonte"],["FonteData","Data da fonte",fmtFonteData]] },
  gasodutos: { idField:"DUTO", idFallback:"Gasoduto de Transporte",
    fields:[["TRECHO","Trecho"],["DIAM_POL","Diâmetro",fmtDiametroPol],["EXTENS_KM","Extensão",fmtExtensaoKm],["INST_ORIGE","Origem"],["INST_DEST","Destino"],["MUN_ORIG","Município de origem"],["MUN_DEST","Município de destino"],["PROPRIET","Proprietário"],["OPERADOR","Operador"],["TIPO","Tipo"],["FLUIDO","Fluido",fmtFluidoGas]] },
  terminais_combustiveis: { idField:"NOME", idFallback:"Terminal de Combustíveis Líquidos",
    fields:[["RAZAO_SOCI","Razão social"],["AUTORIZACA","Autorização"],["SITUACAO_A","Situação",fmtSituacaoOperacao],["MUNICIPIO","Município"],["UF","UF"],["SIMP","SIMP"]] },
  terminais_gnl: { idField:"NOME", idFallback:"Terminal de GNL",
    fields:[["RAZAO_SOCI","Razão social"],["AUTORIZACA","Autorização"],["SITUACAO_A","Situação",fmtSituacaoOperacao],["CAPACIDADE","Capacidade"],["MUNICIPIO","Município"],["UF","UF"]] },
  upgn: { idField:"NOME", idFallback:"Unidade de Processamento de Gás Natural",
    fields:[["TIPO","Tipo"],["TITULARIDA","Titularidade"],["MUNICIPIO","Município"],["ESTADO","UF"],["FONTE","Fonte"]] },
  plano_diretor: { idField:"Zona", idFallback:"Plano Diretor",
    fields:[["Zona_2","Classe de zoneamento"],["Legislacao","Legislação"],["AnoLei","Ano da lei"],["OBJ_Estrat","Objetivo estratégico"],["Shape_Area","Área",v=> typeof usoFormatArea==="function" ? usoFormatArea(Number(v)||0) : v]] }
};
function newLayerPopupHTML(id, p, extraHtml){
  const cfg = NEW_LAYER_CFG[id];
  p = p || {};
  const has = v => !(v===undefined || v===null || String(v).trim()==="");
  const title = has(p[cfg.idField]) ? String(p[cfg.idField]).trim() : cfg.idFallback;
  const summary = id==="cultura_turismo" ? CULTURA_TURISMO_RESUMOS[String(p.NOME||"").trim().toUpperCase()] : "";
  const rows = cfg.fields.map(([k,label,fmt])=>{
    if(!has(p[k])) return "";
    if(k===cfg.idField) return "";
    const val = typeof fmt==="function" ? fmt(p[k]) : String(p[k]).trim();
    return `<b>${escapeHtml(label)}:</b> ${escapeHtml(val)}`;
  }).filter(Boolean).join("<br>");
  const summaryRow = has(summary) ? `<br><b>Resumo:</b> ${escapeHtml(summary)}` : "";
  const image = id==="cultura_turismo" ? culturaTurismoImagemHTML(p,"popup") : "";
  return `<b>${escapeHtml(title)}</b>${image}${rows?"<br>"+rows:""}${summaryRow}${extraHtml||""}`;
}
function registerPointLayer(id, cfg){
  const data = cfg.bufferMunicipal17km ? petroGasFilterByMunicipalBuffer(cfg.data) : cfg.data;
  const icon = cfg.icon;
  registerLayer(id, {
    label:cfg.label, category:cfg.category, defaultVisible:false,
    zoomControlled:cfg.zoomControlled!==false, minZoom:14,
    zoomBounds:cfg.zoomBounds,
    count:data.features.length,
    swatch:cfg.swatch || {type:"icon", glyph:cfg.glyph, color:cfg.color},
    tableColumns:cfg.tableColumns,
    leaflet: L.geoJSON(data, {
      pane:"paneOverlayPontos",
      pointToLayer:(f,latlng)=> L.marker(latlng,{icon:cfg.iconForFeature?cfg.iconForFeature(f):icon, pane:"paneOverlayPontos"}),
      onEachFeature:(f,l)=> l.bindPopup(newLayerPopupHTML(id, f.properties))
    })
  });
}
registerPointLayer("cultura_turismo", {
  label:"Equipamentos de Cultura e Turismo", category:"Equipamentos", data:DATA_CULTURA_TURISMO, icon:ICON_CULTURA,
  glyph:"&#127917;", color:"#D81B60",
  tableColumns:["NOME","TIPO","SECRETARIA","ENDERECO","BAIRRO","DISTRITO","FONTE"]
});
registerPointLayer("seguranca", {
  label:"Forças de Segurança", category:"Equipamentos", data:DATA_SEGURANCA, icon:ICON_SEGURANCA,
  iconForFeature:securityForceIcon,
  swatch:{type:"security"},
  tableColumns:["PTREF","Orgao","OBS","Loteamento","Fonte"]
});
registerPointLayer("secretarias", {
  label:"Secretarias Municipais", category:"Equipamentos", data:DATA_SECRETARIAS, icon:ICON_SECRETARIA,
  glyph:"&#127963;", color:"#00838F",
  tableColumns:["SECRETARIA","ENDERECO","FONTE"]
});
registerPointLayer("terminais", {
  label:"Terminais Rodoviários", category:"Infraestrutura", data:DATA_TERMINAIS, icon:ICON_TERMINAL,
  glyph:"&#128652;", color:"#2E7D32",
  tableColumns:["NOME","TIPOEDIFRO","Bairro","Distrito","Caxias","Ano","Fonte","Elaboraç","Contato"]
});
registerPointLayer("assistencia_social", {
  label:"Unidades de Assistência Social", category:"Equipamentos", data:DATA_ASSISTENCIA_SOCIAL, icon:ICON_ASSISTENCIA,
  glyph:"&#129309;", color:"#F57C00",
  tableColumns:["NOME","TIPO","SECRETARIA","ENDERECO","BAIRRO","DISTRITO","FONTE"]
});

/* ---- Plano Diretor 2022: zoneamento colorido pela classe (campo Zona_2) ---- */
const PD_CLASS_COLORS = {
  "zona de ocupacao preferencial - zop":"#F2C14E",
  "zona de ocupacao basica - zob":"#F08A4B",
  "zona de ocupacao controlada - zoc":"#C8553D",
  "zona especial de negocios - zen":"#7B5EA7",
  "zona especial de negocios rurais - zen rural":"#B7A4D9",
  "zona especial de interesse social - zeis":"#E05C8A",
  "zona especial de interesse turistico - zeit":"#3FA7D6",
  "zona especial de interesse ambiental - zia":"#4C9F70",
  "curva de nivel acima de 50m":"#9AA5B1",
  "curva de nivel acima de 75m":"#6B7785",
  "cota 50":"#3B4452"
};
const PD_FALLBACK_COLORS = ["#2a9d8f","#e76f51","#8ab17d","#b5838d","#6d597a","#e9c46a"];
const PD_COLOR_CACHE = {};
function pdNormalize(s){ return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," "); }
function pdClassOf(f){
  const v = f && f.properties ? f.properties.Zona_2 : null;
  return (v===undefined || v===null || String(v).trim()==="") ? "Sem classificação" : String(v).trim();
}
function pdColor(cls){
  const k = pdNormalize(cls);
  if(PD_CLASS_COLORS[k]) return PD_CLASS_COLORS[k];
  if(!PD_COLOR_CACHE[k]) PD_COLOR_CACHE[k] = PD_FALLBACK_COLORS[Object.keys(PD_COLOR_CACHE).length % PD_FALLBACK_COLORS.length];
  return PD_COLOR_CACHE[k];
}
function pdIsContour(cls){ const k = pdNormalize(cls); return k.indexOf("curva de nivel")===0 || k==="cota 50"; }
function pdClassesPresent(){
  // classes existentes na base, da maior para a menor área
  const area = {};
  DATA_PLANO_DIRETOR.features.forEach(f=>{ const c=pdClassOf(f); area[c]=(area[c]||0)+(Number(f.properties.Shape_Area)||0); });
  return Object.keys(area).sort((a,b)=>area[b]-area[a]);
}
let pdSelectedClass = null;
function pdFeatureStyle(f){
  const cls = pdClassOf(f);
  const sel = pdSelectedClass && cls===pdSelectedClass;
  const dim = pdSelectedClass && cls!==pdSelectedClass;
  const contour = pdIsContour(cls);
  return {
    color: sel ? "#ffffff" : "#12140f",
    weight: sel ? 2 : (contour ? 0.4 : 0.7),
    fillColor: pdColor(cls),
    fillOpacity: dim ? 0.08 : (contour ? 0.35 : 0.6),
    opacity: dim ? 0.2 : 0.85
  };
}
function pdRestyleMap(){
  const layer = LAYERS["plano_diretor"];
  if(layer) layer.leaflet.eachLayer(l=>{ if(l.feature) l.setStyle(pdFeatureStyle(l.feature)); });
}
registerLayer("plano_diretor", {
  label:"Plano Diretor 2022 (Zoneamento)",
  category:"Planejamento Urbano",
  defaultVisible:false,
  hasDashboard:true,
  count: DATA_PLANO_DIRETOR.features.length,
  swatch:{type:"multi"},
  tableColumns:["Zona","Zona_2","Legislacao","AnoLei","OBJ_Estrat","Shape_Area","Tipo","Categoria","Ano","Elaboracao","Fonte","Contato"],
  leaflet: L.geoJSON(DATA_PLANO_DIRETOR, {
    pane:"paneOverlayPoligonos",
    style: f => pdFeatureStyle(f),
    onEachFeature:(f,l)=>{
      l.bindPopup(()=> newLayerPopupHTML("plano_diretor", f.properties,
        `<br><button type="button" class="pd-popup-btn" onclick="pdOpenPanel()">Abrir dashboard do Plano Diretor</button>`), {maxWidth:320});
      l.on("click", ()=>{
        const panel = document.getElementById("pd-panel");
        if(panel && panel.classList.contains("open") && typeof pdSelectClass==="function") pdSelectClass(pdClassOf(f));
      });
    }
  })
});

/* ================= PETRÓLEO E GÁS (V15) =================
   Bases nacionais (Brasil inteiro): Gasodutos de Transporte, Terminais de Combustíveis
   Líquidos, Terminais de GNL e Unidades de Processamento de Gás Natural (UPGN).
   Apenas feições que intersectam o buffer externo de 17 km do limite municipal são
   exibidas. O botão "Zoom na camada"
   leva à região de Caxias/Baía de Guanabara, e não ao centro do país. */
const PETROGAS_ZOOM_BOUNDS = [[-23.10,-43.60],[-22.30,-42.90]];
const PETROGAS_CATEGORY = "Petróleo e Gás";
const PETROGAS_GAS_COLOR = "#F9A825";
const PETROGAS_BUFFER_METERS = 17000;
const PETROGAS_BOUNDS_PADDING = 0.2;
function petroGasFilterByMunicipalBuffer(data){
  const municipality = DATA_MUNICIPIO.features[0].geometry;
  const polygonCoords = municipality.type === "Polygon" ? [municipality.coordinates] : municipality.coordinates;
  const allCoords = polygonCoords.flat(2);
  const bounds = allCoords.reduce((b,c)=>({
    minLon:Math.min(b.minLon,c[0]), maxLon:Math.max(b.maxLon,c[0]),
    minLat:Math.min(b.minLat,c[1]), maxLat:Math.max(b.maxLat,c[1])
  }), {minLon:Infinity,maxLon:-Infinity,minLat:Infinity,maxLat:-Infinity});
  const centerLon=(bounds.minLon+bounds.maxLon)/2, centerLat=(bounds.minLat+bounds.maxLat)/2;
  const project=coord=>{
    const rad=Math.PI/180, lat=coord[1]*rad, lon=coord[0]*rad;
    const lat0=centerLat*rad, dLon=lon-centerLon*rad;
    const cosC=Math.max(-1,Math.min(1,Math.sin(lat0)*Math.sin(lat)+Math.cos(lat0)*Math.cos(lat)*Math.cos(dLon)));
    const c=Math.acos(cosC), k=c<1e-10 ? 1 : c/Math.sin(c);
    return [6371008.8*k*Math.cos(lat)*Math.sin(dLon),
      6371008.8*k*(Math.cos(lat0)*Math.sin(lat)-Math.sin(lat0)*Math.cos(lat)*Math.cos(dLon))];
  };
  const polygons=polygonCoords.map(poly=>poly.map(ring=>ring.map(project)));
  const boundaries=polygons.flatMap(poly=>poly.flatMap(ring=>ring.slice(1).map((point,i)=>[ring[i],point])));
  const nearBounds=coord=>coord[0]>=bounds.minLon-PETROGAS_BOUNDS_PADDING && coord[0]<=bounds.maxLon+PETROGAS_BOUNDS_PADDING &&
    coord[1]>=bounds.minLat-PETROGAS_BOUNDS_PADDING && coord[1]<=bounds.maxLat+PETROGAS_BOUNDS_PADDING;
  const pointInRing=(point,ring)=>{
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i], b=ring[j];
      if((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    }
    return inside;
  };
  const inMunicipality=point=>polygons.some(poly=>pointInRing(point,poly[0]) && !poly.slice(1).some(hole=>pointInRing(point,hole)));
  const pointSegmentDistance=(p,a,b)=>{
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
  };
  const segmentsIntersect=(a,b,c,d)=>{
    const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
    const onSegment=(p,q,r)=>q[0]>=Math.min(p[0],r[0]) && q[0]<=Math.max(p[0],r[0]) &&
      q[1]>=Math.min(p[1],r[1]) && q[1]<=Math.max(p[1],r[1]);
    const abC=cross(a,b,c), abD=cross(a,b,d), cdA=cross(c,d,a), cdB=cross(c,d,b);
    return (abC*abD<0 && cdA*cdB<0) || (abC===0 && onSegment(a,c,b)) || (abD===0 && onSegment(a,d,b)) ||
      (cdA===0 && onSegment(c,a,d)) || (cdB===0 && onSegment(c,b,d));
  };
  const pointInBuffer=coord=>{
    if(!nearBounds(coord)) return false;
    const point=project(coord);
    return inMunicipality(point) || boundaries.some(([a,b])=>pointSegmentDistance(point,a,b)<=PETROGAS_BUFFER_METERS);
  };
  const segmentInBuffer=(start,end)=>{
    if(Math.max(start[0],end[0])<bounds.minLon-PETROGAS_BOUNDS_PADDING || Math.min(start[0],end[0])>bounds.maxLon+PETROGAS_BOUNDS_PADDING ||
       Math.max(start[1],end[1])<bounds.minLat-PETROGAS_BOUNDS_PADDING || Math.min(start[1],end[1])>bounds.maxLat+PETROGAS_BOUNDS_PADDING) return false;
    const a=project(start), b=project(end);
    return boundaries.some(([c,d])=>segmentsIntersect(a,b,c,d) ||
      Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b))<=PETROGAS_BUFFER_METERS);
  };
  const geometryInBuffer=geometry=>{
    if(!geometry) return false;
    if(geometry.type==="Point") return pointInBuffer(geometry.coordinates);
    if(geometry.type==="MultiPoint") return geometry.coordinates.some(pointInBuffer);
    if(geometry.type==="LineString") return geometry.coordinates.some(pointInBuffer) ||
      geometry.coordinates.some((point,i)=>i>0 && segmentInBuffer(geometry.coordinates[i-1],point));
    if(geometry.type==="MultiLineString") return geometry.coordinates.some(line=>geometryInBuffer({type:"LineString",coordinates:line}));
    if(geometry.type==="GeometryCollection") return geometry.geometries.some(geometryInBuffer);
    return false;
  };
  return Object.assign({},data,{features:data.features.filter(feature=>geometryInBuffer(feature.geometry))});
}
const DATA_GASODUTOS_BUFFERED = petroGasFilterByMunicipalBuffer(DATA_GASODUTOS);
/* Símbolo: linha amarela com entorno preto. A camada principal desenha o contorno preto (mais largo) e uma
   camada auxiliar não interativa desenha a linha amarela por cima; ela entra/sai do mapa junto com a principal
   e acompanha a opacidade. */
const GASODUTOS_LINHA_BRANCA = L.geoJSON(DATA_GASODUTOS_BUFFERED, {
  pane:"paneOverlayLinhas", interactive:false, style:{color:"#FFD600", weight:3, opacity:0.95}
});
registerLayer("gasodutos", {
  label:"Gasodutos de Transporte", category:PETROGAS_CATEGORY, defaultVisible:false,
  count: DATA_GASODUTOS_BUFFERED.features.length,
  swatch:{type:"line", color:"#FFD600", outlineColor:"#000000"},
  zoomBounds: PETROGAS_ZOOM_BOUNDS,
  tableColumns:["DUTO","TRECHO","DIAM_POL","EXTENS_KM","INST_ORIGE","INST_DEST","MUN_ORIG","MUN_DEST","PROPRIET","OPERADOR","TIPO","FLUIDO"],
  leaflet: L.geoJSON(DATA_GASODUTOS_BUFFERED, {
    pane:"paneOverlayLinhas",
    style:{color:"#000000", weight:6, opacity:0.95},
    onEachFeature:(f,l)=>{
      l.bindPopup(newLayerPopupHTML("gasodutos", f.properties), {maxWidth:320});
      // Mantém o símbolo íntegro no hover (largura fixa, sem trazer o contorno para frente) e sincroniza a opacidade
      const setStyleOriginal = l.setStyle.bind(l);
      l.setStyle = function(st){
        const s = Object.assign({}, st || {}); s.weight = 6;
        setStyleOriginal(s);
        if(s.opacity !== undefined) GASODUTOS_LINHA_BRANCA.setStyle({opacity:s.opacity});
        return l;
      };
      l.bringToFront = function(){ return l; };
    }
  })
});
LAYERS.gasodutos.leaflet.on("add", ()=> GASODUTOS_LINHA_BRANCA.addTo(map));
LAYERS.gasodutos.leaflet.on("remove", ()=> map.removeLayer(GASODUTOS_LINHA_BRANCA));
registerPointLayer("terminais_combustiveis", {
  label:"Terminais de Combustíveis Líquidos", category:PETROGAS_CATEGORY, data:DATA_TERMINAIS_COMBUSTIVEIS, icon:ICON_TERMINAL_COMBUSTIVEL,
  glyph:"&#9981;", color:"#5D4037", zoomControlled:false, zoomBounds:PETROGAS_ZOOM_BOUNDS, bufferMunicipal17km:true,
  tableColumns:["NOME","RAZAO_SOCI","AUTORIZACA","SITUACAO_A","MUNICIPIO","UF","SIMP"]
});
registerPointLayer("terminais_gnl", {
  label:"Terminais de GNL", category:PETROGAS_CATEGORY, data:DATA_TERMINAIS_GNL, icon:ICON_TERMINAL_GNL,
  glyph:"&#128293;", color:"#0277BD", zoomControlled:false, zoomBounds:PETROGAS_ZOOM_BOUNDS, bufferMunicipal17km:true,
  tableColumns:["NOME","RAZAO_SOCI","AUTORIZACA","SITUACAO_A","CAPACIDADE","MUNICIPIO","UF"]
});
registerPointLayer("upgn", {
  label:"Unidades de Processamento de Gás Natural", category:PETROGAS_CATEGORY, data:DATA_UPGN, icon:ICON_UPGN,
  glyph:"&#127981;", color:"#455A64", zoomControlled:false, zoomBounds:PETROGAS_ZOOM_BOUNDS, bufferMunicipal17km:true,
  tableColumns:["NOME","TIPO","TITULARIDA","MUNICIPIO","ESTADO","FONTE"]
});

const DRAW_ORDER = ["uso_ocupacao","censo","bairros","plano_diretor","municipio","ucs_estadual","ucs_federal","ucs_municipal","hidrografia","fbds_rios_simples","fbds_massas_dagua","fbds_rios_duplos","fbds_app","fbds_app_uso","uso_ocupacao_fbds","fbds_nascentes","vias","ferrovia","gasodutos","estacoes","terminais","terminais_combustiveis","terminais_gnl","upgn","saude","escolas","assistencia_social","secretarias","seguranca","cultura_turismo","cemiterios","religiao","reservatorio"];
DRAW_ORDER.forEach(id=>{ if(LAYERS[id].defaultVisible) LAYERS[id].leaflet.addTo(map); });

let extraLayerCount = 0; // user-added layers via file
// updateToolbarStates() é definida em panels.js (carregado depois); a chamada inicial fica em app.js.