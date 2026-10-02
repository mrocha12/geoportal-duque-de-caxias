/* ============================================================
   ibge.js - Funcionalidades relacionadas aos dados do IBGE
   Geoportal Duque de Caxias
   ============================================================ */

/* ================= PAINEL IBGE — REDIMENSIONÁVEL (mesmo padrão do dashboard acima) ================= */
(function(){
  const box = document.getElementById("ibge-modal-box");
  if(!box) return;
  const overlay = document.getElementById("modal-ibge");
  const GEOM_KEY = "ibgeDashboardGeom";
  function minW(){ return Math.min(560, window.innerWidth * 0.92); }
  function minH(){ return Math.min(420, window.innerHeight * 0.80); }

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

  const resetBtn = document.getElementById("ibge-reset-size");
  if(resetBtn) resetBtn.addEventListener("click", resetGeom);

  window.addEventListener("resize", clampToViewport);

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
        closeModal("modal-ibge");
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

/* ================= INTEGRAÇÃO IBGE (Localidades + Agregados/SIDRA + Malhas) =================
   Fontes oficiais utilizadas, todas documentadas em servicodados.ibge.gov.br/api/docs :
   - Localidades:  /api/v1/localidades/municipios[/{id}]
   - Agregados:    /api/v3/agregados/{agregado}/metadados
                   /api/v3/agregados/{agregado}/periodos/-1/variaveis/{variavel}?localidades=N6[{id}]
   - Malhas:       /api/v3/malhas/municipios/{id}?formato=application/vnd.geo+json
   As variáveis de cada agregado são descobertas dinamicamente via metadados (não são "chutadas"),
   evitando erro caso o IBGE renumere um código de variável.
================================================================================================= */
const IBGE_MUNICIPIO_PADRAO = 3301702; // Duque de Caxias/RJ — usado no primeiro carregamento

let ibgeCurrentCodigo = null;
let ibgeMunicipiosList = null;
let ibgeMunicipiosPromise = null;
const ibgeMetaCache = {};
let ibgeBoundaryLayer = null;
let ibgeBoundaryCodigo = null;

function ibgeInit(){
  if(!ibgeCurrentCodigo){
    ibgeLoadMunicipio(IBGE_MUNICIPIO_PADRAO);
  }
}

function ibgeIsMissing(v){
  if(v===undefined || v===null) return true;
  const s = String(v).trim();
  return s==="" || s==="-" || s==="--" || s==="..." || s==="..0" || s===".." || s.toUpperCase()==="X" || s.toLowerCase()==="nan";
}

function ibgeSlug(nome){
  return normalizeStr(nome).replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-");
}

async function ibgeLoadMunicipiosList(){
  if(ibgeMunicipiosList) return ibgeMunicipiosList;
  if(ibgeMunicipiosPromise) return ibgeMunicipiosPromise;
  ibgeMunicipiosPromise = fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome")
    .then(r=>{ if(!r.ok) throw new Error("Falha ao obter a lista de municípios do IBGE"); return r.json(); })
    .then(list=>{
      ibgeMunicipiosList = list.map(m=>{
        const uf = m.microrregiao && m.microrregiao.mesorregiao && m.microrregiao.mesorregiao.UF;
        const sigla = uf ? uf.sigla : "";
        return { id:m.id, nome:m.nome, uf:sigla, norm: normalizeStr(m.nome+" "+sigla) };
      });
      return ibgeMunicipiosList;
    })
    .catch(err=>{ ibgeMunicipiosPromise = null; throw err; });
  return ibgeMunicipiosPromise;
}

/* Descobre, a partir dos metadados oficiais do agregado, o id da variável cujo nome
   confere com um dos padrões informados (evita fixar códigos de variável "no chute"). */
async function ibgeGetMetadata(agregadoId){
  if(ibgeMetaCache[agregadoId]) return ibgeMetaCache[agregadoId];
  const r = await fetch(`https://servicodados.ibge.gov.br/api/v3/agregados/${agregadoId}/metadados`);
  if(!r.ok) throw new Error("metadados do agregado "+agregadoId);
  const j = await r.json();
  ibgeMetaCache[agregadoId] = j;
  return j;
}
function ibgeFindVariavel(meta, patterns){
  if(!meta || !Array.isArray(meta.variaveis)) return null;
  for(const pat of patterns){
    const found = meta.variaveis.find(v => pat.test(v.nome||""));
    if(found) return found;
  }
  return null;
}
function ibgePickResultado(resultados){
  if(!Array.isArray(resultados) || !resultados.length) return null;
  if(resultados.length===1) return resultados[0];
  const totalOne = resultados.find(r=>{
    if(!Array.isArray(r.classificacoes) || !r.classificacoes.length) return true;
    return r.classificacoes.every(c=>{
      const cat = c && c.categoria;
      if(!cat) return true;
      return Object.values(cat).some(v=> /total/i.test(String(v)));
    });
  });
  return totalOne || resultados[0];
}
/* Extrai o valor mais recente NÃO vazio dentro da série retornada (evita mostrar "não disponível"
   apenas porque o período mais recente ainda não foi publicado pelo IBGE para aquele agregado). */
function sidraExtract(json){
  try{
    const v = Array.isArray(json) ? json[0] : null;
    if(!v) return null;
    const resultado = ibgePickResultado(v.resultados);
    const serieObj = resultado && resultado.series && resultado.series[0];
    if(!serieObj) return null;
    const serie = serieObj.serie || {};
    const periodos = Object.keys(serie).sort();
    for(let i=periodos.length-1;i>=0;i--){
      const periodo = periodos[i];
      const raw = serie[periodo];
      if(!ibgeIsMissing(raw)){
        const num = Number(raw);
        if(!isNaN(num)) return { periodo, raw, value:num, unidade: v.unidade };
      }
    }
    return null;
  }catch(err){ return null; }
}
async function ibgeGetIndicadorDe(agregadoId, patterns, codigoMunicipio){
  try{
    const meta = await ibgeGetMetadata(agregadoId);
    const varInfo = ibgeFindVariavel(meta, patterns);
    if(!varInfo) return null;
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${agregadoId}/periodos/-6/variaveis/${varInfo.id}?localidades=N6[${codigoMunicipio}]`;
    const r = await fetch(url);
    if(!r.ok) return null;
    const j = await r.json();
    const ext = sidraExtract(j);
    if(!ext) return null;
    return { periodo: ext.periodo, value: ext.value, unidade: varInfo.unidade || ext.unidade, nomeVariavel: varInfo.nome, agregadoId: String(agregadoId), agregadoNome: meta.nome };
  }catch(err){
    return null;
  }
}

/* Catálogo completo de agregados do IBGE — usado apenas como reserva (fallback), caso o
   agregado fixo abaixo não retorne o indicador (ex.: renumeração, indisponibilidade para o
   nível municipal, etc.). Fonte oficial: /v3/agregados. */
let ibgeAgregadosIndex = null;
let ibgeAgregadosIndexPromise = null;
async function ibgeGetAgregadosIndex(){
  if(ibgeAgregadosIndex) return ibgeAgregadosIndex;
  if(ibgeAgregadosIndexPromise) return ibgeAgregadosIndexPromise;
  ibgeAgregadosIndexPromise = fetch("https://servicodados.ibge.gov.br/api/v3/agregados")
    .then(r=>{ if(!r.ok) throw new Error("lista de agregados do IBGE"); return r.json(); })
    .then(grupos=>{
      const flat = [];
      (grupos||[]).forEach(g=>{ (g.agregados||[]).forEach(a=> flat.push({ id:String(a.id), nome:a.nome||"" })); });
      ibgeAgregadosIndex = flat;
      return flat;
    })
    .catch(err=>{ ibgeAgregadosIndexPromise = null; throw err; });
  return ibgeAgregadosIndexPromise;
}
async function ibgeFindAgregadoIds(nomePatterns, max){
  try{
    const idx = await ibgeGetAgregadosIndex();
    const out = [];
    for(const item of idx){
      if(nomePatterns.some(p=>p.test(item.nome))){
        out.push(item.id);
        if(max && out.length>=max) break;
      }
    }
    return out;
  }catch(err){ return []; }
}

/* Consulta um indicador tentando primeiro o agregado oficial já conhecido e, apenas se este não
   retornar dado, faz uma busca no catálogo de agregados do IBGE por nome (mesma fonte oficial),
   evitando depender de um único número de agregado que o IBGE possa vir a reorganizar. */
async function ibgeGetIndicador(agregadoIdPrincipal, varPatterns, codigoMunicipio, agregadoNomePatterns){
  let res = await ibgeGetIndicadorDe(agregadoIdPrincipal, varPatterns, codigoMunicipio);
  if(res) return res;
  if(agregadoNomePatterns){
    const candidatos = await ibgeFindAgregadoIds(agregadoNomePatterns, 5);
    for(const id of candidatos){
      if(id === String(agregadoIdPrincipal)) continue;
      res = await ibgeGetIndicadorDe(id, varPatterns, codigoMunicipio);
      if(res) return res;
    }
  }
  return null;
}


function ibgeFmtNum(n, maxDec){
  if(n===null || n===undefined || isNaN(n)) return null;
  return n.toLocaleString("pt-BR", {maximumFractionDigits: maxDec!==undefined?maxDec:2});
}
function ibgeCardHTML(label, indic, opts){
  opts = opts||{};
  if(!indic || indic.value===null || indic.value===undefined){
    return `<div class="dsh-kpi-card"><div class="dsh-kpi-label">${label}</div><div class="dsh-kpi-value ibge-na">Não disponível</div></div>`;
  }
  const val = ibgeFmtNum(indic.value, opts.dec);
  return `<div class="dsh-kpi-card">
    <div class="dsh-kpi-label">${label}</div>
    <div class="dsh-kpi-value">${val}${opts.suffix||""}</div>
    <div class="dsh-kpi-sub">${(opts.unidade || indic.unidade || "")}${indic.periodo?(" · "+indic.periodo):""}</div>
  </div>`;
}

async function ibgeLoadMunicipio(codigo){
  codigo = String(codigo);
  ibgeCurrentCodigo = codigo;
  const body = document.getElementById("ibge-body");
  if(!body) return;
  body.innerHTML = `<div class="ibge-status">Consultando dados oficiais do IBGE…</div>`;

  let info;
  try{
    const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigo}`);
    if(!r.ok) throw new Error("município não encontrado");
    info = await r.json();
  }catch(err){
    if(ibgeCurrentCodigo !== codigo) return;
    body.innerHTML = `<div class="ibge-status ibge-error">Não foi possível obter os dados deste município no IBGE. Verifique sua conexão e tente novamente.</div>`;
    return;
  }
  if(ibgeCurrentCodigo !== codigo) return;

  const microrregiao = info.microrregiao;
  const uf = microrregiao && microrregiao.mesorregiao && microrregiao.mesorregiao.UF;
  const ufSigla = uf ? uf.sigla : "";
  const ufNome = uf ? uf.nome : "";
  const regiaoNome = uf && uf.regiao ? uf.regiao.nome : "";
  const mesorregiaoNome = microrregiao && microrregiao.mesorregiao ? microrregiao.mesorregiao.nome : "";
  const microrregiaoNome = microrregiao ? microrregiao.nome : "";
  const linkCidades = ufSigla
    ? `https://cidades.ibge.gov.br/brasil/${ufSigla.toLowerCase()}/${ibgeSlug(info.nome)}/panorama`
    : `https://cidades.ibge.gov.br/`;

  body.innerHTML = `
    <div class="ibge-muni-head">
      <div>
        <div class="ibge-muni-title">${info.nome}<span class="ibge-badge">${ufSigla}</span></div>
        <div class="ibge-muni-sub">Código IBGE: ${info.id} · ${ufNome} · Região ${regiaoNome}${mesorregiaoNome?(" · Mesorregião "+mesorregiaoNome):""}${microrregiaoNome?(" · Microrregião "+microrregiaoNome):""}</div>
      </div>
      <div class="ibge-muni-actions">
        <button class="ibge-mini-btn" id="ibge-toggle-limite">Mostrar limite oficial (malha IBGE) no mapa</button>
      </div>
    </div>
    <div id="ibge-indicadores"><div class="ibge-status">Carregando indicadores…</div></div>
  `;
  wireIbgeBoundaryToggle(codigo);
  ibgeLoadIndicadores(codigo, linkCidades);
}

async function ibgeLoadIndicadores(codigo, linkCidades){
  const wrap = document.getElementById("ibge-indicadores");
  if(!wrap) return;

  const tasks = {
    popEstimada: ibgeGetIndicador(6579, [/popula[cç][aã]o residente estimada/i], codigo, [/estimativas? de popula[cç][aã]o/i]),
    popCenso:    ibgeGetIndicador(9514, [/popula[cç][aã]o residente/i], codigo, [/censo demogr[aá]fico.*popula[cç][aã]o|popula[cç][aã]o.*censo/i]),
    area:        ibgeGetIndicador(1705, [/[aá]rea.*territorial/i], codigo, [/[aá]rea\s+territorial/i]),
    densidade:   ibgeGetIndicador(1712, [/densidade\s+demogr[aá]fica/i], codigo, [/densidade\s+demogr[aá]fica/i]),
    pibTotal:    ibgeGetIndicador(5938, [/^(?!.*per.?\s*capita).*produto interno bruto.*pre[cç]os correntes/i, /^(?!.*per.?\s*capita)produto interno bruto\b/i], codigo, [/produto interno bruto dos munic[íi]pios/i]),
    pibPerCap:   ibgeGetIndicador(5938, [/per.?\s*capita/i, /per\s*cápita/i], codigo, [/produto interno bruto dos munic[íi]pios/i, /pib per\s*capita/i])
  };
  const keys = Object.keys(tasks);
  const results = await Promise.allSettled(keys.map(k=>tasks[k]));
  if(ibgeCurrentCodigo !== codigo) return; // usuário já trocou de município

  const data = {};
  keys.forEach((k,i)=>{ data[k] = results[i].status==="fulfilled" ? results[i].value : null; });

  // O IBGE nem sempre publica "PIB per capita" como variável própria dentro do
  // agregado 5938 (Produto Interno Bruto dos Municípios) — quando isso acontece,
  // a busca acima retorna null e o cartão ficaria "Não disponível" mesmo já tendo,
  // em mãos, tudo que é preciso para calcular o indicador (PIB total ÷ população).
  // Calculamos aqui como reserva, deixando claro na unidade que é um valor
  // derivado (não um número publicado diretamente pelo IBGE sob esse nome).
  if(!data.pibPerCap && data.pibTotal && data.pibTotal.value){
    const pop = data.popCenso || data.popEstimada;
    if(pop && pop.value){
      const unidadeTotal = (data.pibTotal.unidade||"").toLowerCase();
      const pibEmReais = unidadeTotal.includes("mil") ? data.pibTotal.value*1000 : data.pibTotal.value;
      data.pibPerCap = {
        value: pibEmReais / pop.value,
        unidade: "R$ (estimado: PIB total ÷ população)",
        periodo: pop.periodo && pop.periodo!==data.pibTotal.periodo
          ? `PIB ${data.pibTotal.periodo} / pop. ${pop.periodo}`
          : data.pibTotal.periodo
      };
    }
  }

  wrap.innerHTML = `
    <div class="dsh-kpi-grid">
      ${ibgeCardHTML("População estimada", data.popEstimada, {dec:0})}
      ${ibgeCardHTML("População — Censo 2022", data.popCenso, {dec:0})}
      ${ibgeCardHTML("Área territorial", data.area, {dec:1, suffix:" km²"})}
      ${ibgeCardHTML("Densidade demográfica", data.densidade, {dec:2, suffix:" hab/km²"})}
      ${ibgeCardHTML("PIB a preços correntes", data.pibTotal, {dec:0})}
      ${ibgeCardHTML("PIB per capita", data.pibPerCap, {dec:2})}
    </div>
    <div class="dsh-note">Fonte: IBGE — API de Localidades e API de Dados Agregados (SIDRA). O período de referência de cada indicador é o mais recente disponibilizado oficialmente pelo IBGE para aquele agregado; por isso pode variar de um indicador para outro.</div>
    <div class="ibge-unavail">
      <p><b>Indicadores não disponíveis nesta integração:</b> Escolarização, IDHM, Mortalidade infantil, Receitas e Despesas municipais.</p>
      <p>No painel IBGE Cidades esses indicadores são compilados a partir de outras fontes (PNUD/Atlas do Desenvolvimento Humano, INEP/MEC, Ministério da Saúde, Tesouro Nacional/SICONFI) e não fazem parte das APIs de dados abertos do próprio IBGE utilizadas por esta ferramenta — por isso não são exibidos aqui, para evitar apresentar valores incorretos ou desatualizados.</p>
      <p>Consulte-os diretamente em <a href="${linkCidades}" target="_blank" rel="noopener">cidades.ibge.gov.br</a>.</p>
    </div>
  `;
}

function wireIbgeBoundaryToggle(codigo){
  const btn = document.getElementById("ibge-toggle-limite");
  if(!btn) return;
  const isShown = !!(ibgeBoundaryLayer && ibgeBoundaryCodigo===codigo);
  btn.classList.toggle("active", isShown);
  btn.textContent = isShown ? "Ocultar limite oficial (malha IBGE)" : "Mostrar limite oficial (malha IBGE) no mapa";
  btn.onclick = async ()=>{
    if(ibgeBoundaryLayer && ibgeBoundaryCodigo===codigo){
      map.removeLayer(ibgeBoundaryLayer);
      ibgeBoundaryLayer = null; ibgeBoundaryCodigo = null;
      btn.classList.remove("active");
      btn.textContent = "Mostrar limite oficial (malha IBGE) no mapa";
      return;
    }
    btn.disabled = true;
    btn.textContent = "Carregando limite…";
    try{
      const r = await fetch(`https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${codigo}?formato=application/vnd.geo+json`);
      if(!r.ok) throw new Error("malha não disponível");
      const gj = await r.json();
      if(ibgeBoundaryLayer){ map.removeLayer(ibgeBoundaryLayer); ibgeBoundaryLayer = null; }
      ibgeBoundaryLayer = L.geoJSON(gj, {
        style:{color:"#ff9800", weight:2.5, fillColor:"#ff9800", fillOpacity:0.06, dashArray:"6 3"}
      }).addTo(map);
      ibgeBoundaryCodigo = codigo;
      try{ map.fitBounds(ibgeBoundaryLayer.getBounds(), {padding:[30,30]}); }catch(err){}
      btn.classList.add("active");
      btn.textContent = "Ocultar limite oficial (malha IBGE)";
    }catch(err){
      showToast("Não foi possível carregar o limite oficial do IBGE para este município.");
      btn.textContent = "Mostrar limite oficial (malha IBGE) no mapa";
    }finally{
      btn.disabled = false;
    }
  };
}

/* Busca de município (autocomplete client-side sobre a lista oficial do IBGE) */
const ibgeSearchInput = document.getElementById("ibge-search-input");
const ibgeSearchBtn = document.getElementById("ibge-search-btn");
const ibgeSuggestEl = document.getElementById("ibge-suggest");
let ibgeSearchTimer = null;

if(ibgeSearchInput){
  ibgeSearchInput.addEventListener("input", ()=>{
    clearTimeout(ibgeSearchTimer);
    const q = ibgeSearchInput.value;
    ibgeSearchTimer = setTimeout(()=> ibgeUpdateSuggestions(q), 150);
  });
  ibgeSearchInput.addEventListener("keydown", e=>{
    if(e.key==="Enter"){ e.preventDefault(); ibgeSearchByText(ibgeSearchInput.value); }
    if(e.key==="Escape"){ ibgeSuggestEl.classList.remove("open"); }
  });
}
if(ibgeSearchBtn){
  ibgeSearchBtn.addEventListener("click", ()=> ibgeSearchByText(ibgeSearchInput.value));
}
document.addEventListener("click", e=>{
  if(ibgeSuggestEl && !e.target.closest("#modal-ibge .ibge-search-row")) ibgeSuggestEl.classList.remove("open");
});

async function ibgeUpdateSuggestions(q){
  const query = normalizeStr(q);
  if(!ibgeSuggestEl) return;
  if(query.length < 2){ ibgeSuggestEl.classList.remove("open"); ibgeSuggestEl.innerHTML=""; return; }
  let list;
  try{ list = await ibgeLoadMunicipiosList(); }catch(err){ return; }
  const matches = list.filter(m=> m.norm.includes(query)).slice(0,8);
  if(!matches.length){ ibgeSuggestEl.classList.remove("open"); ibgeSuggestEl.innerHTML = `<div class="search-item" style="cursor:default;">Nenhum município encontrado</div>`; ibgeSuggestEl.classList.add("open"); return; }
  ibgeSuggestEl.innerHTML = matches.map(m=>`<div class="search-item" data-id="${m.id}">${m.nome}<span class="tag">${m.uf} · código ${m.id}</span></div>`).join("");
  ibgeSuggestEl.classList.add("open");
  ibgeSuggestEl.querySelectorAll(".search-item[data-id]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id");
      const m = matches.find(x=>String(x.id)===id);
      ibgeSearchInput.value = m ? (m.nome+" - "+m.uf) : "";
      ibgeSuggestEl.classList.remove("open");
      ibgeLoadMunicipio(id);
    });
  });
}

async function ibgeSearchByText(q){
  const query = normalizeStr(q);
  if(!query) return;
  let list;
  try{ list = await ibgeLoadMunicipiosList(); }
  catch(err){
    const body = document.getElementById("ibge-body");
    if(body) body.innerHTML = `<div class="ibge-status ibge-error">Não foi possível carregar a lista de municípios do IBGE. Tente novamente.</div>`;
    return;
  }
  const best = list.find(m=> m.norm===query) || list.find(m=> m.norm.startsWith(query)) || list.find(m=> m.norm.includes(query));
  if(!best){
    const body = document.getElementById("ibge-body");
    if(body) body.innerHTML = `<div class="ibge-status ibge-error">Município não encontrado. Verifique o nome digitado.</div>`;
    return;
  }
  ibgeSearchInput.value = best.nome+" - "+best.uf;
  ibgeSuggestEl.classList.remove("open");
  ibgeLoadMunicipio(best.id);
}