/* ============================================================
   opening.js - Tela inicial full screen do Geoportal
   Não altera a lógica do mapa; apenas controla a experiência de abertura.
   ============================================================ */
(function setupOpeningScreen(){
  const screen = document.getElementById('opening-screen');
  const enter = document.getElementById('opening-enter');
  const close = document.getElementById('opening-close');
  if(!screen || !enter || !close) return;

  const STORAGE_KEY = 'geoportal_duque_de_caxias_opening_seen';
  let closing = false;

  const finish = ()=>{
    if(closing) return;
    closing = true;
    try{ sessionStorage.setItem(STORAGE_KEY, '1'); }catch(_){ }
    screen.classList.add('is-closing');
    screen.setAttribute('aria-hidden','true');
    window.setTimeout(()=>{
      screen.style.display='none';
      screen.setAttribute('hidden','');
    }, 650);
  };

  let alreadySeen = false;
  try{ alreadySeen = sessionStorage.getItem(STORAGE_KEY) === '1'; }catch(_){ }
  if(alreadySeen){
    screen.style.display='none';
    screen.setAttribute('hidden','');
    screen.setAttribute('aria-hidden','true');
    return;
  }

  enter.addEventListener('click', finish);
  close.addEventListener('click', finish);
  screen.addEventListener('click', (e)=>{
    if(e.target === screen) finish();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !closing && screen.style.display !== 'none') finish();
  });
})();
