/* ============================================================
   permalink.js - Link compartilhável da vista atual do mapa
   Geoportal Duque de Caxias

   Guarda no hash da URL: zoom (z), centro (c), mapa base (b) e camadas
   ativas (l). Exemplo:
     index.html#z=14.25&c=-22.65000,-43.30000&b=streets&l=bairros,vias

   Não altera nenhuma função existente: apenas usa map, LAYERS, toggleLayer,
   setAllLayers e setBasemap. Escreve a URL com history.replaceState, sem
   poluir o histórico do navegador.
   ============================================================ */
(function setupPermalink(){
  "use strict";
  if(typeof map === "undefined" || typeof LAYERS === "undefined") return;

  const OPENING_KEY = "geoportal_duque_de_caxias_opening_seen";
  const WRITE_DELAY = 350;
  let writeTimer = null;
  let lastHash = "";
  let applying = false;

  /* ---------- leitura ---------- */
  function parseHash(){
    const raw = (location.hash || "").replace(/^#/, "");
    if(!raw || raw.indexOf("=") < 0) return null;
    let params;
    try{ params = new URLSearchParams(raw); }catch(_){ return null; }

    const out = {};
    const z = parseFloat(params.get("z"));
    const c = (params.get("c") || "").split(",").map(parseFloat);
    if(Number.isFinite(z) && c.length === 2 && c.every(Number.isFinite)
       && Math.abs(c[0]) <= 90 && Math.abs(c[1]) <= 180){
      out.zoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), z));
      out.center = [c[0], c[1]];
    }
    const b = params.get("b");
    if(b && basemapLayers[b]) out.basemap = b;
    if(params.has("l")){
      out.layers = (params.get("l") || "").split(",").filter(id=> id && LAYERS[id]);
    }
    return Object.keys(out).length ? out : null;
  }

  /* ---------- aplicação ---------- */
  function apply(state){
    if(!state) return;
    applying = true;
    try{
      if(state.center) map.setView(state.center, state.zoom, {animate:false});

      if(state.basemap && state.basemap !== activeBasemapId){
        // setBasemap mostra um aviso ("Mapa base: ..."); aqui não é desejado.
        const originalToast = window.showToast;
        window.showToast = function(){};
        try{ setBasemap(state.basemap); }
        finally{ window.showToast = originalToast; }
      }

      if(state.layers){
        setAllLayers(false);
        state.layers.forEach(id=> toggleLayer(id, true));
      }
    }catch(err){
      console.warn("Não foi possível aplicar o link compartilhado:", err);
    }finally{
      applying = false;
    }
  }

  /* ---------- escrita ---------- */
  function currentHash(){
    const ctr = map.getCenter();
    const active = Object.keys(LAYERS).filter(id=> map.hasLayer(LAYERS[id].leaflet));
    return "#z=" + map.getZoom().toFixed(2)
         + "&c=" + ctr.lat.toFixed(5) + "," + ctr.lng.toFixed(5)
         + "&b=" + activeBasemapId
         + "&l=" + active.join(",");
  }

  function writeNow(){
    writeTimer = null;
    if(applying) return;
    const h = currentHash();
    if(h === lastHash) return;
    lastHash = h;
    try{ history.replaceState(null, "", location.pathname + location.search + h); }catch(_){ }
  }

  function scheduleWrite(){
    if(applying) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(writeNow, WRITE_DELAY);
  }

  /* ---------- botão "Copiar link" ---------- */
  async function copyLink(){
    clearTimeout(writeTimer);
    writeNow();
    const url = location.href;
    try{
      await navigator.clipboard.writeText(url);
      showToast("Link da vista atual copiado.");
    }catch(_){
      window.prompt("Copie o link desta vista do mapa:", url);
    }
  }

  /* ---------- inicialização ---------- */
  const initial = parseHash();
  if(initial && initial.center){
    // Quem abre um link compartilhado quer ver o mapa direto: pula a abertura.
    try{ sessionStorage.setItem(OPENING_KEY, "1"); }catch(_){ }
  }
  apply(initial);

  map.on("moveend layeradd layerremove", scheduleWrite);
  window.addEventListener("hashchange", ()=>{
    if(location.hash === lastHash) return;
    apply(parseHash());
  });

  const shareBtn = document.getElementById("btn-share");
  if(shareBtn) shareBtn.addEventListener("click", copyLink);

  scheduleWrite();
})();
