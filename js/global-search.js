/* ============================================================
   global-search.js
   Pesquisa unificada no cabeçalho: endereços + atributos das camadas.
   A busca existente por categorias permanece independente.
   ============================================================ */
(function(){
  "use strict";

  const box = document.getElementById("global-search-box");
  const input = document.getElementById("global-search-input");
  const results = document.getElementById("global-search-results");
  const clearBtn = document.getElementById("global-search-clear");
  if(!box || !input || !results) return;

  let layerIndex = [];
  let requestSeq = 0;
  let addressTimer = null;
  let highlightLayer = null;
  let highlightTimer = null;

  const norm = s => (s == null ? "" : String(s)).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function clearSearch(){
    input.value="";
    results.innerHTML="";
    results.hidden=true;
    clearBtn.hidden=true;
    clearHighlight();
    input.focus();
  }
  clearBtn.addEventListener("click", clearSearch);

  function buildLayerIndex(){
    const out=[];
    if(typeof LAYERS === "undefined") return out;
    Object.entries(LAYERS).forEach(([id, layer])=>{
      const geo = layer && layer.leaflet;
      if(!geo || typeof geo.eachLayer !== "function") return;
      geo.eachLayer(l=>{
        const f = l && l.feature;
        if(!f || !f.properties) return;
        const parts=[];
        Object.entries(f.properties).forEach(([key,val])=>{
          if(val === null || val === undefined || val === "") return;
          const str=String(val);
          if(str.length>300) return;
          parts.push({key,value:str,norm:norm(str)});
        });
        if(parts.length) out.push({layerId:id,label:layer.label||id,category:layer.category||"Outras",feature:f,parts});
      });
    });
    return out;
  }
  let layerIndexSig="", layerIndexTime=0;
  function ensureLayerIndex(){
    const sig=typeof LAYERS==="undefined"?"":Object.keys(LAYERS).join("|");
    const now=Date.now();
    if(!layerIndex.length || sig!==layerIndexSig || now-layerIndexTime>60000){
      layerIndex=buildLayerIndex(); layerIndexSig=sig; layerIndexTime=now;
    }
    return layerIndex;
  }

  function searchLayers(q){
    const nq=norm(q); if(!nq) return [];
    const scored=[];
    ensureLayerIndex().forEach(item=>{
      let best=null;
      item.parts.forEach(p=>{
        const idx=p.norm.indexOf(nq); if(idx<0) return;
        const score=(idx===0?0:20)+Math.min(idx,20)+Math.max(0,Math.min(30,p.value.length/10));
        if(!best || score<best.score) best={score,field:p.key,value:p.value};
      });
      if(best) scored.push({...item,...best});
    });
    scored.sort((a,b)=>a.score-b.score || a.label.localeCompare(b.label,"pt"));
    return scored.slice(0,20);
  }

  function geometryBounds(feature){ try{return L.geoJSON(feature).getBounds();}catch(e){return null;} }
  function clearHighlight(){
    if(highlightLayer && map.hasLayer(highlightLayer)) map.removeLayer(highlightLayer);
    highlightLayer=null;
    if(highlightTimer) clearTimeout(highlightTimer);
    highlightTimer=null;
  }
  function highlightFeature(feature){
    clearHighlight();
    const geom=feature&&feature.geometry; if(!geom) return;
    if(geom.type==="Point") highlightLayer=L.circleMarker([geom.coordinates[1],geom.coordinates[0]],{radius:14,color:"#1e9fe0",weight:3,fill:false,opacity:.95,interactive:false,pane:"paneHighlight"}).addTo(map);
    else highlightLayer=L.geoJSON(feature,{style:{color:"#1e9fe0",weight:4,fill:false,opacity:.95,interactive:false},pane:"paneHighlight"}).addTo(map);
    highlightTimer=setTimeout(clearHighlight,5000);
  }
  function selectLayerResult(item){
    const layerObj=LAYERS[item.layerId]; if(!layerObj) return;
    if(typeof toggleLayer==="function" && !map.hasLayer(layerObj.leaflet)) toggleLayer(item.layerId,true);
    const geom=item.feature.geometry;
    if(geom&&geom.type==="Point"){
      map.flyTo([geom.coordinates[1],geom.coordinates[0]],17,{duration:.8});
      setTimeout(()=>{highlightFeature(item.feature);openLayerPopup(item);},850);
    }else{
      const b=geometryBounds(item.feature);
      if(b&&b.isValid()){
        map.flyToBounds(b,{padding:[60,60],duration:.8});
        setTimeout(()=>{highlightFeature(item.feature);openLayerPopup(item);},850);
      }
    }
  }
  function openLayerPopup(item){
    const layerObj=LAYERS[item.layerId];
    if(!layerObj||!layerObj.leaflet||typeof layerObj.leaflet.eachLayer!=="function") return;
    layerObj.leaflet.eachLayer(l=>{if(l.feature===item.feature&&typeof l.openPopup==="function") l.openPopup();});
  }
  function selectAddress(feature){
    const [lon,lat]=feature.geometry.coordinates;
    map.flyTo([lat,lon],18,{duration:.9});
    clearHighlight();
    highlightLayer=L.circleMarker([lat,lon],{radius:10,color:"#1e9fe0",weight:4,fillColor:"#fff",fillOpacity:.9,interactive:false,pane:"paneHighlight"}).addTo(map);
    const p=feature.properties||{};
    const label=[p.name,p.street,p.housenumber,p.locality||p.district,p.city,p.state].filter(Boolean).join(", ");
    setTimeout(()=>L.popup({maxWidth:340}).setLatLng([lat,lon]).setContent(`<b>${esc(label||"Endereço")}</b><br><span style="color:var(--muted-text)">Localização encontrada por geocodificação.</span>`).openOn(map),950);
    highlightTimer=setTimeout(clearHighlight,5000);
  }

  function renderCombined(q, layerItems, addressItems, addressFailed){
    const hasLayers=layerItems.length, hasAddresses=addressItems.length;
    if(!hasLayers&&!hasAddresses){
      results.innerHTML=addressFailed
        ? `<div class="global-search-empty">Não foi possível consultar o serviço de endereços agora (sem conexão ou limite de uso). Tente novamente em instantes.</div>`
        : `<div class="global-search-empty">Nenhum resultado encontrado. Tente informar um endereço, bairro, nome ou atributo de uma camada.</div>`;
      results.hidden=false; return;
    }
    let html="";
    if(hasAddresses){
      html+=`<div class="global-results-heading">ENDEREÇOS</div>`;
      html+=addressItems.map((f,i)=>{
        const p=f.properties||{}; const parts=[p.street&&p.housenumber?`${p.street}, ${p.housenumber}`:p.name||p.street,p.locality||p.district,p.city,p.state].filter(Boolean); const label=[...new Set(parts)].join(", ");
        return `<button type="button" class="global-result" data-address-index="${i}"><span class="global-result-main">${esc(label||q)}</span><span class="global-result-meta">${esc(p.city||"Localização")} · ${esc(p.state||"RJ")}</span></button>`;
      }).join("");
    }
    if(hasLayers){
      html+=`<div class="global-results-heading">CAMADAS DO GEOPORTAL</div>`;
      html+=layerItems.map((it,i)=>`<button type="button" class="global-result" data-layer-index="${i}"><span class="global-result-main">${esc(it.value)}</span><span class="global-result-meta">${esc(it.label)} · ${esc(it.field)}${it.category?" · "+esc(it.category):""}</span></button>`).join("");
    }
    if(addressFailed&&!hasAddresses) html+=`<div class="global-search-empty">Serviço de endereços indisponível no momento; exibindo apenas resultados das camadas.</div>`;
    results.innerHTML=html; results.hidden=false;
    results.querySelectorAll("[data-address-index]").forEach(el=>el.addEventListener("click",()=>{results.hidden=true;selectAddress(addressItems[+el.dataset.addressIndex]);}));
    results.querySelectorAll("[data-layer-index]").forEach(el=>el.addEventListener("click",()=>{results.hidden=true;selectLayerResult(layerItems[+el.dataset.layerIndex]);}));
  }

  function normalizeAddressFeature(item, source){
    if(source === "nominatim"){
      const a=item.address||{};
      const lon=Number(item.lon), lat=Number(item.lat);
      if(!Number.isFinite(lon)||!Number.isFinite(lat)) return null;
      return {
        type:"Feature",
        geometry:{type:"Point",coordinates:[lon,lat]},
        properties:{
          name:item.name||a.amenity||a.building||a.road||"Endereço",
          street:a.road||"",
          housenumber:a.house_number||"",
          locality:a.suburb||a.neighbourhood||a.city_district||"",
          district:a.city_district||"",
          city:a.city||a.town||a.municipality||"Duque de Caxias",
          state:a.state||"Rio de Janeiro",
          postcode:a.postcode||"",
          display_name:item.display_name||"",
          source:"Nominatim"
        }
      };
    }
    const coords=item.geometry&&item.geometry.coordinates;
    if(!Array.isArray(coords)||coords.length<2) return null;
    const p=item.properties||{};
    const osm=p.osm||{};
    const lon=Number(coords[0]), lat=Number(coords[1]);
    if(!Number.isFinite(lon)||!Number.isFinite(lat)) return null;
    return {
      type:"Feature",
      geometry:{type:"Point",coordinates:[lon,lat]},
      properties:{
        name:p.name||p.street||"Endereço",
        street:p.street||"",
        housenumber:p.housenumber||"",
        locality:p.locality||p.district||"",
        district:p.district||"",
        city:p.city||"Duque de Caxias",
        state:p.state||"Rio de Janeiro",
        postcode:p.postcode||"",
        display_name:p.name||"",
        source:source==="photon"?"Photon":"Geocodificador"
      }
    };
  }

  // Limites do município (com folga) — mesmos de map.js (MUNI_BOUNDS_RAW).
  const BBOX={west:-43.44, south:-22.83, east:-43.17, north:-22.46};
  const NOMINATIM_VIEWBOX=`${BBOX.west},${BBOX.north},${BBOX.east},${BBOX.south}`; // esq,topo,dir,base
  const PHOTON_BBOX=`${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`;       // minLon,minLat,maxLon,maxLat
  const addressCache=new Map();
  let addressAbort=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function fetchJson(url, signal){
    const controller=new AbortController();
    const onAbort=()=>controller.abort();
    if(signal){ if(signal.aborted) controller.abort(); else signal.addEventListener("abort",onAbort,{once:true}); }
    const timer=setTimeout(()=>controller.abort(),9000);
    try{
      const res=await fetch(url,{signal:controller.signal});
      if(!res.ok) throw new Error("HTTP "+res.status);
      return await res.json();
    }finally{
      clearTimeout(timer);
      if(signal) signal.removeEventListener("abort",onAbort);
    }
  }

  async function nominatim(q, bounded, signal){
    const params=new URLSearchParams({
      format:"jsonv2", addressdetails:"1", limit:"8", countrycodes:"br",
      viewbox:NOMINATIM_VIEWBOX, bounded:bounded?"1":"0", q, "accept-language":"pt-BR"
    });
    const data=await fetchJson("https://nominatim.openstreetmap.org/search?"+params.toString(), signal);
    return (Array.isArray(data)?data:[]).map(x=>normalizeAddressFeature(x,"nominatim")).filter(Boolean);
  }

  async function photon(q, signal){
    // Photon só aceita lang = default/en/de/fr/it; "pt" gera HTTP 400, então não é enviado.
    const params=new URLSearchParams({q, limit:"8", bbox:PHOTON_BBOX});
    const data=await fetchJson("https://photon.komoot.io/api/?"+params.toString(), signal);
    return (data.features||[]).map(x=>normalizeAddressFeature(x,"photon")).filter(Boolean);
  }

  function dedupe(feats){
    const seen=new Set();
    return feats.filter(f=>{
      const p=f.properties, c=f.geometry.coordinates;
      const k=[p.street||p.name,p.housenumber,p.locality,c[0].toFixed(4),c[1].toFixed(4)].join("|");
      if(seen.has(k)) return false; seen.add(k); return true;
    });
  }

  const isAbort=(e,signal)=>e&&e.name==="AbortError"&&signal&&signal.aborted;

  async function geocode(q, signal){
    // O Geoportal é focado em Duque de Caxias: completar a consulta melhora
    // os resultados quando o usuário digita só rua/número.
    const cityQ=/duque\s+de\s+caxias/i.test(q)?q:`${q}, Duque de Caxias, RJ`;
    let nominatimOk=true, photonOk=true;

    // 1) Nominatim restrito ao município
    try{
      const feats=await nominatim(cityQ,true,signal);
      if(feats.length) return {feats:dedupe(feats),failed:false};
    }catch(e){ if(isAbort(e,signal)) throw e; nominatimOk=false; }

    // 2) Nominatim sem restrição (só viés de região) — respeita 1 req/s da política de uso
    if(nominatimOk){
      try{
        await sleep(1000);
        if(signal.aborted) throw new DOMException("Aborted","AbortError");
        const feats=await nominatim(cityQ+", Brasil",false,signal);
        if(feats.length) return {feats:dedupe(feats),failed:false};
      }catch(e){ if(isAbort(e,signal)) throw e; nominatimOk=false; }
    }

    // 3) Fallback: Photon (Komoot)
    try{
      const feats=await photon(cityQ,signal);
      if(feats.length) return {feats:dedupe(feats),failed:false};
    }catch(e){ if(isAbort(e,signal)) throw e; photonOk=false; }

    return {feats:[],failed:(!nominatimOk&&!photonOk)};
  }

  async function searchAddress(q,seq,layerItems){
    const key=norm(q);
    if(addressCache.has(key)){ renderCombined(q,layerItems,addressCache.get(key),false); return; }
    if(addressAbort) addressAbort.abort();
    addressAbort=new AbortController();
    const signal=addressAbort.signal;
    try{
      const {feats,failed}=await geocode(q,signal);
      if(seq!==requestSeq) return;
      if(feats.length) addressCache.set(key,feats);
      renderCombined(q,layerItems,feats,failed);
    }catch(err){
      if(seq!==requestSeq) return;
      renderCombined(q,layerItems,[],true);
    }
  }

  // O Nominatim público desencoraja busca a cada tecla (limite de 1 req/s),
  // por isso a consulta de endereços espera o usuário parar de digitar.
  function runSearch(immediate){
    const q=input.value.trim(); clearBtn.hidden=!q;
    if(addressAbort){ addressAbort.abort(); addressAbort=null; }
    clearTimeout(addressTimer);
    if(!q){requestSeq++;results.innerHTML="";results.hidden=true;return;}
    if(q.length<3){requestSeq++;results.innerHTML=`<div class="global-search-empty">Digite pelo menos 3 caracteres para pesquisar.</div>`;results.hidden=false;return;}
    const seq=++requestSeq;
    const layerItems=searchLayers(q);
    results.innerHTML=`<div class="global-search-loading"><span class="global-search-spinner"></span> Procurando endereços e informações nas camadas...</div>`;
    results.hidden=false;
    addressTimer=setTimeout(()=>searchAddress(q,seq,layerItems), immediate===true?0:650);
  }

  input.addEventListener("input",()=>runSearch(false));
  // Navegação por teclado nos resultados: ↓ entra na lista, ↑/↓ percorrem,
  // ↑ no primeiro item (ou Esc) devolve o foco ao campo de pesquisa.
  function resultButtons(){ return Array.from(results.querySelectorAll(".global-result")); }
  results.addEventListener("keydown",e=>{
    const items=resultButtons(); const i=items.indexOf(document.activeElement);
    if(i<0) return;
    if(e.key==="ArrowDown"){ e.preventDefault(); (items[i+1]||items[0]).focus(); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); if(i===0) input.focus(); else items[i-1].focus(); }
    else if(e.key==="Home"){ e.preventDefault(); items[0].focus(); }
    else if(e.key==="End"){ e.preventDefault(); items[items.length-1].focus(); }
    else if(e.key==="Escape"){ e.preventDefault(); input.focus(); }
  });
  input.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown" && !results.hidden){
      const first=resultButtons()[0];
      if(first){ e.preventDefault(); first.focus(); return; }
    }
    if(e.key==="Escape"){clearSearch();return;}
    if(e.key==="Enter"){
      e.preventDefault();
      const first=results.querySelector(".global-result");
      if(first){ first.click(); return; }
      if(input.value.trim().length>=3) runSearch(true);
    }
  });
  document.addEventListener("click",e=>{
    if(!box.contains(e.target)){ results.hidden=true; }
  });
  input.addEventListener("focus",()=>{if(input.value.trim()&&results.innerHTML)results.hidden=false;});
})();
