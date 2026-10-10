/* ============================================================
   janelas.js (V31) — Padronização do comportamento das janelas
   - Janela fecha somente pelo botão X ou pela tecla Esc.
   - Esc fecha apenas a janela ativa (a última aberta ou usada).
   - Clique fora / troca de foco não fecham janelas.
   Reaproveita o botão X de cada janela, preservando a lógica
   de fechamento já existente (restaurar camadas, foco etc.).
   ============================================================ */
(function setupJanelas(){
  const PAINEIS = [
    "search-box","bookmarks-box","sketch-box","measure-box","radius-box",
    "legend-panel","layers-panel","panel-basemap","panel-addlayer","panel-export",
    "uso-panel","pd-panel","fbds-uso-panel"
  ];
  const SEL_FECHAR = ".lp-close,.search-close,.win-x,.modal-close,#uso-close-btn,#pd-close-btn,#fbds-uso-close-btn";

  const visivel = el => !!el && getComputedStyle(el).display !== "none" && el.getClientRects().length > 0;

  function janelas(){
    const lista = [];
    PAINEIS.forEach(id=>{ const el = document.getElementById(id); if(visivel(el)) lista.push(el); });
    document.querySelectorAll(".modal-overlay.open").forEach(ov=>{
      const box = ov.querySelector(".modal-box");
      if(box) lista.push(box);
    });
    return lista;
  }

  let ordem = [];            // da menos para a mais recente
  function ativar(el){
    if(!el) return;
    ordem = ordem.filter(x=>x!==el);
    ordem.push(el);
  }
  function janelaDe(alvo){
    if(!alvo || !alvo.closest) return null;
    return janelas().find(w=>w.contains(alvo)) || null;
  }

  /* Janela ativa = a última usada (clique/foco) ou aberta */
  document.addEventListener("pointerdown", e=>{ ativar(janelaDe(e.target)); }, true);
  document.addEventListener("focusin", e=>{ ativar(janelaDe(e.target)); }, true);

  /* Detecta abertura de janelas e as torna ativas */
  const jaAbertas = new Set();
  function sincronizar(){
    const agora = janelas();
    agora.forEach(w=>{ if(!jaAbertas.has(w)){ jaAbertas.add(w); ativar(w); } });
    Array.from(jaAbertas).forEach(w=>{ if(!agora.includes(w)) jaAbertas.delete(w); });
    ordem = ordem.filter(w=>agora.includes(w));
  }
  const obs = new MutationObserver(sincronizar);
  PAINEIS.forEach(id=>{
    const el = document.getElementById(id);
    if(el) obs.observe(el,{attributes:true,attributeFilter:["class","style"]});
  });
  document.querySelectorAll(".modal-overlay").forEach(ov=>obs.observe(ov,{attributes:true,attributeFilter:["class"]}));
  sincronizar();

  function fecharAtiva(){
    sincronizar();
    const abertas = janelas();
    if(!abertas.length) return false;
    const alvo = ordem.filter(w=>abertas.includes(w)).pop() || abertas[abertas.length-1];
    const btn = alvo.querySelector(SEL_FECHAR);
    if(btn){ btn.click(); return true; }
    return false;
  }

  document.addEventListener("keydown", e=>{
    if(e.key !== "Escape" || e.defaultPrevented || e.__geoEscConsumido) return;
    // Esc dentro da busca do topo apenas limpa a busca (comportamento existente)
    if(e.target && e.target.closest && e.target.closest("#global-search-box")) return;
    fecharAtiva();
  });

  /* ------------------------------------------------------------
     Desselecionar o elemento do mapa ao fechar QUALQUER janela
     (botão X ou Esc). Cada bloco limpa apenas o estado de seleção /
     destaque; camadas, dados, estilos base e popups-conteúdo ficam
     intactos.
     ------------------------------------------------------------ */
  function tentar(fn){ try{ fn(); }catch(err){ console.warn("[janelas] limpar seleção:", err); } }

  function limparSelecaoMapa(){
    // Tabela de Atributos: linhas selecionadas + contorno no mapa
    tentar(()=>{
      if(typeof atSelectedIndices !== "undefined" && atSelectedIndices.size){
        atSelectedIndices = new Set();
        atUpdateHighlight();
        const ov = document.getElementById("modal-table");
        if(ov && ov.classList.contains("open") && typeof atRenderTable === "function") atRenderTable();
      }
    });
    // Consulta por Raio: contorno das feições encontradas
    tentar(()=>{ if(typeof radiusHighlightLayer !== "undefined") radiusHighlightLayer.clearLayers(); });
    // Busca (campo lateral): destaque pulsante
    tentar(()=>{ if(typeof clearSearchHighlight === "function") clearSearchHighlight(); });
    // Busca global (topo): destaque azul da feição/endereço
    tentar(()=>{ if(typeof window.limparDestaqueBuscaGlobal === "function") window.limparDestaqueBuscaGlobal(); });
    // Uso e Ocupação do Solo: classe selecionada
    tentar(()=>{ if(typeof usoSelectedClass !== "undefined" && usoSelectedClass && typeof usoClearSelection === "function") usoClearSelection(); });
    // Plano Diretor: classe/zona selecionada + destaque
    tentar(()=>{
      if(typeof pdClearSelection === "function" &&
         ((typeof pdSelectedClass !== "undefined" && pdSelectedClass) ||
          (typeof pdActiveZonaKey !== "undefined" && pdActiveZonaKey) ||
          (typeof pdHighlightLayer !== "undefined" && pdHighlightLayer))) pdClearSelection();
    });
    // Setores censitários selecionados
    tentar(()=>{ if(typeof censoClearSelection === "function") censoClearSelection(); });
    // Distrito destacado pela legenda
    tentar(()=>{
      if(typeof highlightedDistrict !== "undefined" && highlightedDistrict){
        if(typeof LAYERS !== "undefined" && LAYERS.bairros && map.hasLayer(LAYERS.bairros.leaflet)) highlightDistrict(highlightedDistrict);
        else highlightedDistrict = null;
      }
    });
    // Esboço: feição em edição (alças de vértices)
    tentar(()=>{ if(typeof editingSketchId !== "undefined" && editingSketchId && typeof stopEditingSketch === "function") stopEditingSketch(); });
    // Popup aberto da feição selecionada
    tentar(()=>{ if(typeof map !== "undefined") map.closePopup(); });
  }

  /* Qualquer fechamento (X ou Esc, que também aciona o X) limpa a seleção.
     Roda depois do tratador próprio de cada janela (fase de bolha). */
  const SEL_JANELA = "#" + PAINEIS.join(",#") + ",.modal-box";
  document.addEventListener("click", e=>{
    const btn = e.target && e.target.closest ? e.target.closest(SEL_FECHAR) : null;
    if(!btn || !btn.closest(SEL_JANELA)) return;
    limparSelecaoMapa();
  });

  window.GeoJanelas = { fecharAtiva, janelas, limparSelecaoMapa };
})();
