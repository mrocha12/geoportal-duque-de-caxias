/* ============================================================
   controls.js - Controles do mapa e interface
   Geoportal Duque de Caxias
   ============================================================ */

// ===== Controle responsivo da barra lateral em telas touch/mobile =====// ===== Controle responsivo da barra lateral em telas touch/mobile =====
(function setupMobileToolbar(){
  const toggle=document.getElementById('mobile-toolbar-toggle');
  const toolbar=document.getElementById('left-toolbar');
  if(!toggle || !toolbar) return;
  const setOpen=(open)=>{
    toolbar.classList.toggle('mobile-open',open);
    toggle.setAttribute('aria-expanded',open?'true':'false');
    toggle.setAttribute('title',open?'Fechar ferramentas':'Abrir ferramentas');
    toggle.setAttribute('aria-label',open?'Fechar ferramentas':'Abrir ferramentas');
  };
  toggle.addEventListener('click',()=>setOpen(!toolbar.classList.contains('mobile-open')));
  toolbar.addEventListener('click',(e)=>{
    if(window.innerWidth<=768 && e.target.closest('.lt-btn')) setOpen(false);
  });
  window.addEventListener('resize',()=>{ if(window.innerWidth>768) setOpen(false); });
})();

// ===== Identificação dos botões da barra lateral =====
(function setupToolbarTooltips(){
  const toolbar = document.getElementById('left-toolbar');
  if(!toolbar || window.matchMedia('(hover: none)').matches) return;

  let tip = document.getElementById('toolbar-tooltip');
  if(!tip){
    tip = document.createElement('div');
    tip.id = 'toolbar-tooltip';
    tip.setAttribute('role','tooltip');
    document.body.appendChild(tip);
  }

  let timer = null;
  let activeButton = null;

  const hide = ()=>{
    clearTimeout(timer);
    activeButton = null;
    tip.classList.remove('is-visible');
    timer = setTimeout(()=>{ tip.style.display='none'; }, 120);
  };

  const show = (button)=>{
    const label = button.getAttribute('aria-label') || button.getAttribute('title');
    if(!label) return;
    clearTimeout(timer);
    activeButton = button;
    tip.textContent = label;
    tip.style.display = 'block';

    const r = button.getBoundingClientRect();
    const gap = 9;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = r.right + gap;
    let top = r.top + (r.height - th) / 2;

    // Mantém o tooltip dentro da janela, inclusive em telas menores.
    if(left + tw > window.innerWidth - 8){
      left = r.left - tw - gap;
      tip.classList.add('tooltip-left');
    }else{
      tip.classList.remove('tooltip-left');
    }
    top = Math.max(8, Math.min(top, window.innerHeight - th - 8));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;

    requestAnimationFrame(()=>{
      if(activeButton === button) tip.classList.add('is-visible');
    });
  };

  toolbar.querySelectorAll('.lt-btn').forEach(button=>{
    button.addEventListener('mouseenter',()=>show(button));
    button.addEventListener('mouseleave',hide);
    button.addEventListener('focus',()=>show(button));
    button.addEventListener('blur',hide);
  });

  window.addEventListener('resize',()=>{ if(activeButton) show(activeButton); });
  window.addEventListener('scroll',hide,{passive:true});
})();

// ===== Menu único de Ferramentas =====
// O menu é controlado aqui, no módulo geral da interface, e não depende de
// setores-censitarios.js. Ele é movido para o body para evitar problemas de
// empilhamento/clipping causados pela barra lateral.
(function setupToolsMenu(){
  const toolsBtn = document.getElementById('bb-tools');
  const toolsMenu = document.getElementById('tools-menu');
  if(!toolsBtn || !toolsMenu) return;

  // Evita que o menu fique preso ao stacking context da barra lateral.
  if(toolsMenu.parentElement !== document.body) document.body.appendChild(toolsMenu);

  const positionMenu = ()=>{
    const r = toolsBtn.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(238, Math.max(220, window.innerWidth - r.right - gap - 8));
    toolsMenu.style.width = `${width}px`;

    let left = r.right + gap;
    let top = r.top;
    const menuHeight = toolsMenu.offsetHeight || 260;

    if(left + width > window.innerWidth - 8){
      left = Math.max(8, r.left - width - gap);
    }
    if(top + menuHeight > window.innerHeight - 8){
      top = Math.max(8, window.innerHeight - menuHeight - 8);
    }

    toolsMenu.style.left = `${Math.round(left)}px`;
    toolsMenu.style.top = `${Math.round(top)}px`;
  };

  window.closeToolsMenu = function(){
    toolsMenu.hidden = true;
    toolsBtn.setAttribute('aria-expanded','false');
    toolsBtn.classList.remove('active');
  };

  const openToolsMenu = ()=>{
    toolsMenu.hidden = false;
    toolsBtn.setAttribute('aria-expanded','true');
    positionMenu();
  };

  toolsBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    if(!toolsMenu.hidden){
      window.closeToolsMenu();
      return;
    }
    // Fecha outros painéis sem chamar novamente closeToolsMenu através do
    // fluxo normal: aqui o menu ainda está fechado e será aberto em seguida.
    if(typeof closeAllPanels === 'function') closeAllPanels();
    openToolsMenu();
  });

  toolsMenu.addEventListener('click', (e)=>{
    const item = e.target.closest('.tools-menu-item');
    if(!item) return;
    // Deixa o listener específico de cada ferramenta executar normalmente.
    // O fechamento ocorre no próximo ciclo para não interromper o clique.
    setTimeout(()=>window.closeToolsMenu(), 0);
  });

  document.addEventListener('click', (e)=>{
    if(toolsMenu.hidden) return;
    if(e.target.closest('#tools-menu') || e.target.closest('#bb-tools')) return;
    window.closeToolsMenu();
  });

  window.addEventListener('resize', ()=>{
    if(!toolsMenu.hidden) positionMenu();
  });
  window.addEventListener('scroll', ()=>{
    if(!toolsMenu.hidden) positionMenu();
  }, true);

  // Mantém o botão principal ativo enquanto uma das ferramentas estiver ativa.
  const syncMainButton = ()=>{
    const active = ['bb-measure','bb-sketch','bb-radius','bb-attrtable','bb-export','bb-map-export']
      .some(id=>{
        const el=document.getElementById(id);
        return el && (el.classList.contains('active') || el.getAttribute('aria-expanded')==='true' || el.getAttribute('aria-pressed')==='true');
      });
    if(!toolsMenu.hidden) return;
    toolsBtn.classList.toggle('active', active);
  };

  ['bb-measure','bb-sketch','bb-radius','bb-attrtable','bb-export','bb-map-export'].forEach(id=>{
    const el=document.getElementById(id);
    if(el && window.MutationObserver){
      new MutationObserver(syncMainButton).observe(el,{attributes:true,attributeFilter:['class','aria-expanded','aria-pressed']});
    }
  });

  window.closeToolsMenu();
})();

