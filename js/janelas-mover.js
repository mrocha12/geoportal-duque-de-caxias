/* ============================================================
   janelas-mover.js (V34) — Janelas movíveis e redimensionáveis
   Aplica o mesmo comportamento a TODAS as janelas do Geoportal:
   - arrastar pela barra de título;
   - redimensionar por bordas e cantos;
   - restaurar o tamanho e a posição padrão;
   - nunca sair da área visível nem ficar sob a barra superior.
   As janelas que já tinham essa lógica própria (Camadas, Uso e
   Ocupação, Plano Diretor, Dashboard, IBGE, Tabela de Atributos
   e Resultados do Raio) são mantidas como estão.
   ============================================================ */
(function setupJanelasMover(){
  const IDS = [
    "search-box","bookmarks-box","sketch-box","measure-box","radius-box",
    "legend-panel","panel-basemap","panel-addlayer","panel-export",
    "help-box","about-box","map-export-box"
  ];
  /* Janelas sem rolagem interna própria: ganham rolagem ao serem redimensionadas */
  const ROLAGEM = new Set(["search-box","bookmarks-box","sketch-box","measure-box","radius-box"]);
  const DIRS = ["n","s","e","w","ne","nw","se","sw"];
  const IGNORAR = "button,a,input,select,textarea,label,[role=button],#sketch-export,#sketch-clear,#radius-clear-title,.window-collapse-btn";
  const MARGEM = 4;
  const PROPS_GEOMETRIA = [
    "position","margin","right","bottom","transform","maxWidth","maxHeight",
    "left","top","width","height","borderRadius"
  ];

  function topLimit(){
    const tb = document.getElementById("topbar");
    return tb ? Math.ceil(tb.getBoundingClientRect().bottom) + MARGEM : 66;
  }
  const num = v => Math.round(v);
  const clamp = (v,a,b) => Math.min(Math.max(v,a),Math.max(a,b));
  function minW(){ return Math.min(280, window.innerWidth - 2*MARGEM); }
  function minH(box){
    const head = box.querySelector(".window-collapse-header");
    return Math.min((head ? head.offsetHeight : 44) + 60, window.innerHeight - topLimit() - MARGEM);
  }
  const visivel = box => getComputedStyle(box).display !== "none" && box.offsetWidth > 0 && box.offsetHeight > 0;

  function adicionarBotaoRestaurar(box, header, estilosIniciais){
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dsh-icon-btn win-reset-size";
    button.textContent = "\u27f3";
    button.title = "Restaurar tamanho e posição padrão";
    button.setAttribute("aria-label","Restaurar tamanho e posição padrão do painel");
    const fechar = header.querySelector(".lp-close,.search-close,.win-x,.modal-close");
    header.insertBefore(button, fechar || null);
    button.addEventListener("click",()=>{
      PROPS_GEOMETRIA.forEach(prop=>{ box.style[prop] = estilosIniciais[prop]; });
      box.classList.remove("win-user-sized");
      delete box.dataset.winFixa;
      window.dispatchEvent(new Event("resize"));
    });
  }

  function tornarFixa(box){
    if(box.dataset.winFixa === "1") return;
    const r = box.getBoundingClientRect();
    box.dataset.winFixa = "1";
    box.classList.add("win-user-sized");
    box.style.position = "fixed";
    box.style.margin = "0";
    box.style.right = "auto"; box.style.bottom = "auto";
    box.style.transform = "none";
    box.style.maxWidth = "none"; box.style.maxHeight = "none";
    box.style.left = num(r.left) + "px"; box.style.top = num(r.top) + "px";
    box.style.width = num(r.width) + "px"; box.style.height = num(r.height) + "px";
    if(box.id === "map-export-box"){ box.style.borderRadius = "6px"; }
  }

  /* Mantém a janela inteira dentro da tela (controles sempre acessíveis) */
  function ajustar(box){
    if(box.dataset.winFixa !== "1" || !visivel(box)) return;
    if(box.classList.contains("window-collapsed")){
      // recolhida: só garante que o cabeçalho continua visível
      const r0 = box.getBoundingClientRect();
      const l0 = clamp(r0.left, 0, window.innerWidth - r0.width);
      const t0 = clamp(r0.top, topLimit(), window.innerHeight - 44);
      box.style.left = num(l0) + "px"; box.style.top = num(t0) + "px";
      return;
    }
    const vw = window.innerWidth, vh = window.innerHeight, top0 = topLimit();
    const r = box.getBoundingClientRect();
    const w = clamp(r.width, minW(), vw - 2*MARGEM);
    const h = clamp(r.height, minH(box), vh - top0 - MARGEM);
    const left = clamp(r.left, MARGEM, vw - w - MARGEM);
    const top = clamp(r.top, top0, vh - h - MARGEM);
    const set = (k,v)=>{ const s = num(v)+"px"; if(box.style[k] !== s) box.style[k] = s; };
    set("width",w); set("height",h); set("left",left); set("top",top);
  }

  function iniciarArraste(box, header, e){
    if(e.button !== undefined && e.button !== 0) return;
    if(e.target.closest(IGNORAR)) return;
    e.preventDefault();
    tornarFixa(box);
    const r = box.getBoundingClientRect();
    const dx0 = e.clientX - r.left, dy0 = e.clientY - r.top;
    box.classList.add("win-dragging");
    try{ header.setPointerCapture(e.pointerId); }catch(err){}
    const mover = ev=>{
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = box.offsetWidth, h = box.offsetHeight;
      const left = clamp(ev.clientX - dx0, MARGEM, vw - w - MARGEM);
      const top = clamp(ev.clientY - dy0, topLimit(), vh - Math.min(h, 44) - MARGEM);
      box.style.left = num(left) + "px"; box.style.top = num(top) + "px";
    };
    const fim = ()=>{
      box.classList.remove("win-dragging");
      header.removeEventListener("pointermove", mover);
      header.removeEventListener("pointerup", fim);
      header.removeEventListener("pointercancel", fim);
      try{ header.releasePointerCapture(e.pointerId); }catch(err){}
      ajustar(box);
    };
    header.addEventListener("pointermove", mover);
    header.addEventListener("pointerup", fim);
    header.addEventListener("pointercancel", fim);
  }

  function iniciarRedim(box, handle, dir, e){
    if(e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    tornarFixa(box);
    const r = box.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const L = r.left, T = r.top, W = r.width, H = r.height;
    const mw = minW(), mh = minH(box), top0 = topLimit();
    box.classList.add("win-dragging");
    try{ handle.setPointerCapture(e.pointerId); }catch(err){}
    const mover = ev=>{
      const vw = window.innerWidth, vh = window.innerHeight;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let nl = L, nt = T, nw = W, nh = H;
      if(dir.includes("e")) nw = clamp(W + dx, mw, vw - MARGEM - L);
      if(dir.includes("w")){ nl = clamp(L + dx, MARGEM, L + W - mw); nw = L + W - nl; }
      if(dir.includes("s")) nh = clamp(H + dy, mh, vh - MARGEM - T);
      if(dir.includes("n")){ nt = clamp(T + dy, top0, T + H - mh); nh = T + H - nt; }
      box.style.left = num(nl)+"px"; box.style.top = num(nt)+"px";
      box.style.width = num(nw)+"px"; box.style.height = num(nh)+"px";
    };
    const fim = ()=>{
      box.classList.remove("win-dragging");
      handle.removeEventListener("pointermove", mover);
      handle.removeEventListener("pointerup", fim);
      handle.removeEventListener("pointercancel", fim);
      try{ handle.releasePointerCapture(e.pointerId); }catch(err){}
      window.dispatchEvent(new Event("resize")); // conteúdos que reagem a resize (mapas, gráficos)
    };
    handle.addEventListener("pointermove", mover);
    handle.addEventListener("pointerup", fim);
    handle.addEventListener("pointercancel", fim);
  }

  IDS.forEach(id=>{
    const box = document.getElementById(id);
    if(!box) return;
    const header = box.querySelector(".window-collapse-header")
      || box.querySelector(".modal-head,.map-export-head,.lp-header,#search-box-header,.bm-title,.sk-title,.ms-title,.rd-title");
    if(!header) return;
    const estilosIniciais = Object.fromEntries(PROPS_GEOMETRIA.map(prop=>[prop,box.style[prop]]));
    adicionarBotaoRestaurar(box, header, estilosIniciais);
    box.classList.add("win-movel");
    if(ROLAGEM.has(id)) box.classList.add("win-rolagem");
    header.classList.add("win-arrastavel");
    header.addEventListener("pointerdown", e=>iniciarArraste(box, header, e));

    DIRS.forEach(dir=>{
      const h = document.createElement("div");
      h.className = "win-rz win-rz-" + dir;
      h.setAttribute("aria-hidden","true");
      h.addEventListener("pointerdown", e=>iniciarRedim(box, h, dir, e));
      box.appendChild(h);
    });

    // Reabertura: garante que a janela continua dentro da tela atual
    const hostObs = new MutationObserver(()=>ajustar(box));
    hostObs.observe(box,{attributes:true,attributeFilter:["class","style"]});
    const ov = box.closest(".modal-overlay");
    if(ov) hostObs.observe(ov,{attributes:true,attributeFilter:["class"]});
  });

  window.addEventListener("resize", ()=>{
    IDS.forEach(id=>{ const b = document.getElementById(id); if(b) ajustar(b); });
  });
  window.addEventListener("orientationchange", ()=>{
    setTimeout(()=>IDS.forEach(id=>{ const b = document.getElementById(id); if(b) ajustar(b); }), 250);
  });
})();
