/* Dashboard de Uso e Ocupação do Solo da FBDS. */
let fbdsUsoVisibilitySnapshot = null;

function fbdsUsoEscape(value){
  return String(value == null ? "" : value)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function fbdsUsoFormatArea(hectares){
  return formatAreaPtBR(hectares || 0, "ha");
}

function fbdsUsoFormatPct(value){
  return `${formatNumberPtBR(value||0,{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
}

function fbdsUsoComputeStats(){
  const byClass = new Map();
  let totalArea = 0;
  const features = DATA_FBDS_USO_OCUPACAO.features;
  features.forEach(feature=>{
    const properties = feature.properties || {};
    const classValue = properties[FBDS_USAGE_SYMBOLOGY.property];
    const className = classValue == null || classValue === ""
      ? "Sem classe"
      : String(classValue);
    const area = Number(properties.AREA_HA) || 0;
    const row = byClass.get(className) || {className,area:0,count:0};
    row.area += area;
    row.count += 1;
    byClass.set(className,row);
    totalArea += area;
  });
  const rows = Array.from(byClass.values())
    .map(row=>({...row,pct:totalArea>0?row.area/totalArea*100:0}))
    .sort((a,b)=>b.area-a.area);
  return {rows,totalArea,featureCount:features.length};
}

function fbdsUsoRenderPanel(){
  const panel = document.getElementById("fbds-uso-panel");
  if(!panel) return;
  const stats = fbdsUsoComputeStats();
  const kpis = document.getElementById("fbds-uso-kpi-grid");
  const selectedBanner = document.getElementById("fbds-uso-selection-banner");
  const stack = document.getElementById("fbds-uso-stack");
  const legend = document.getElementById("fbds-uso-legend");
  const tbody = document.getElementById("fbds-uso-table-body");
  const select = document.getElementById("fbds-uso-filter");
  if(!kpis || !selectedBanner || !stack || !legend || !tbody || !select) return;

  const fbdsNorm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const sumArea=test=>stats.rows.filter(row=>test(fbdsNorm(row.className))).reduce((total,row)=>total+row.area,0);
  const builtArea=sumArea(name=>name.indexOf("edificada")>=0);
  const vegArea=sumArea(name=>name.indexOf("formacao florestal")>=0 || name.indexOf("formacao nao florestal")>=0);
  const maxRow=stats.rows.length?stats.rows[0]:null;
  const pctOfTotal=area=>fbdsUsoFormatPct(stats.totalArea>0?area/stats.totalArea*100:0);
  kpis.innerHTML = [
    {icon:"area",label:"Área total mapeada",value:fbdsUsoFormatArea(stats.totalArea),sub:""},
    {icon:"classes",label:"Número de classes",value:formatNumberPtBR(stats.rows.length),sub:""},
    {icon:"top",label:"Maior classe",value:maxRow?maxRow.className:"-",sub:maxRow?fbdsUsoFormatArea(maxRow.area):""},
    {icon:"percent",label:"% da maior classe",value:maxRow?fbdsUsoFormatPct(maxRow.pct):"-",sub:""},
    {icon:"built",label:"Área construída",value:fbdsUsoFormatArea(builtArea),sub:`${pctOfTotal(builtArea)} do total`},
    {icon:"veg",label:"Área de vegetação",value:fbdsUsoFormatArea(vegArea),sub:`${pctOfTotal(vegArea)} do total`}
  ].map(card=>`<div class="uso-kpi-card"><div class="dsh-kpi-head">${dshKpiIconHTML(card.icon)}<div class="uso-kpi-label">${fbdsUsoEscape(card.label)}</div></div><div class="uso-kpi-value" title="${fbdsUsoEscape(card.value)}">${fbdsUsoEscape(card.value)}</div>${card.sub?`<div class="uso-kpi-sub">${fbdsUsoEscape(card.sub)}</div>`:""}</div>`).join("");

  if(fbdsUsageSelectedClass){
    selectedBanner.style.display="flex";
    selectedBanner.innerHTML=`<span>Classe selecionada: <b>${fbdsUsoEscape(fbdsUsageSelectedClass)}</b></span><button type="button" id="fbds-uso-banner-clear">Limpar</button>`;
    document.getElementById("fbds-uso-banner-clear").addEventListener("click",()=>fbdsUsoSetClass(null));
  }else{
    selectedBanner.style.display="none";
    selectedBanner.innerHTML="";
  }

  const donutR=70, donutC=100, donutW=32, donutLen=2*Math.PI*donutR;
  let donutOffset=0;
  let donutHtml=`<svg viewBox="0 0 200 200" width="170" height="170" role="img" aria-label="Gráfico de rosca da distribuição da área por classe"><circle cx="${donutC}" cy="${donutC}" r="${donutR}" fill="none" stroke="rgba(130,130,130,.18)" stroke-width="${donutW}"></circle>`;
  stats.rows.forEach(row=>{
    const frac=stats.totalArea>0?row.area/stats.totalArea:0;
    const dash=Math.max(frac*donutLen,frac>0?0.6:0);
    const active=fbdsUsageSelectedClass===row.className;
    const dimmed=fbdsUsageSelectedClass && !active;
    const label=`${row.className}: ${fbdsUsoFormatPct(row.pct)}`;
    donutHtml+=`<circle class="fbds-donut-seg" data-fbds-class="${fbdsUsoEscape(row.className)}" role="button" tabindex="0" aria-pressed="${active}" aria-label="${fbdsUsoEscape(`${row.className}, ${fbdsUsoFormatPct(row.pct)}`)}" cx="${donutC}" cy="${donutC}" r="${donutR}" fill="none" stroke="${fbdsUsageColor(row.className)}" stroke-width="${active?donutW+6:donutW}" stroke-dasharray="${dash} ${donutLen-dash}" stroke-dashoffset="${-donutOffset}" transform="rotate(-90 ${donutC} ${donutC})" opacity="${dimmed?0.35:1}"><title>${fbdsUsoEscape(label)}</title></circle>`;
    donutOffset+=dash;
  });
  donutHtml+=`<text x="${donutC}" y="${donutC-4}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--panel-text)">${stats.rows.length}</text><text x="${donutC}" y="${donutC+13}" text-anchor="middle" font-size="9" fill="var(--muted-text)">classes</text></svg>`;
  stack.innerHTML=donutHtml;
  stack.querySelectorAll("[data-fbds-class]").forEach(segment=>{
    segment.addEventListener("click",()=>fbdsUsoSelectClass(segment.getAttribute("data-fbds-class")));
    segment.addEventListener("keydown",event=>{
      if(event.key==="Enter" || event.key===" "){
        event.preventDefault();
        fbdsUsoSelectClass(segment.getAttribute("data-fbds-class"));
      }
    });
  });

  legend.innerHTML=stats.rows.map(row=>{
    const active=fbdsUsageSelectedClass===row.className;
    return `<button type="button" class="uso-legend-item${active?" uso-active":""}" data-fbds-class="${fbdsUsoEscape(row.className)}" aria-pressed="${active}">
      <span class="uso-legend-swatch" style="background:${fbdsUsageColor(row.className)}"></span>
      <span class="uso-legend-name" title="${fbdsUsoEscape(row.className)}">${fbdsUsoEscape(row.className)}</span>
      <span class="fbds-uso-legend-area">${fbdsUsoFormatPct(row.pct)}</span>
    </button>`;
  }).join("");
  legend.querySelectorAll("[data-fbds-class]").forEach(button=>{
    button.addEventListener("click",()=>fbdsUsoSelectClass(button.getAttribute("data-fbds-class")));
  });

  const currentValue=fbdsUsageSelectedClass||"";
  if(select.options.length!==stats.rows.length+1 || select.value!==currentValue){
    select.innerHTML=`<option value="">Todas as classes</option>${stats.rows.map(row=>`<option value="${fbdsUsoEscape(row.className)}">${fbdsUsoEscape(row.className)}</option>`).join("")}`;
    select.value=currentValue;
  }
  tbody.innerHTML=stats.rows.map(row=>`<tr class="${fbdsUsageSelectedClass===row.className?"uso-active":""}" data-fbds-class="${fbdsUsoEscape(row.className)}">
    <td>${fbdsUsoEscape(row.className)}</td><td class="uso-num">${fbdsUsoFormatArea(row.area)}</td><td class="uso-num">${fbdsUsoFormatPct(row.pct)}</td>
  </tr>`).join("");
  tbody.querySelectorAll("[data-fbds-class]").forEach(row=>{
    row.addEventListener("click",()=>fbdsUsoSelectClass(row.getAttribute("data-fbds-class")));
  });
}

function fbdsUsoRestyleMap(){
  const layer=LAYERS.uso_ocupacao_fbds;
  if(layer) layer.leaflet.setStyle(fbdsUsageFeatureStyle);
}

function fbdsUsoSetClass(className){
  fbdsUsageSelectedClass=className||null;
  fbdsUsoRestyleMap();
  fbdsUsoRenderPanel();
}

function fbdsUsoSelectClass(className){
  fbdsUsoSetClass(fbdsUsageSelectedClass===className?null:className);
}

function fbdsUsoUpdateLayerControls(){
  renderLegend();
  renderLayersPanel();
  updateLayersBadge();
  updateToolbarStates();
}

function fbdsUsoOpenPanel(){
  const panel=document.getElementById("fbds-uso-panel");
  if(!panel) return;
  if(panel.classList.contains("open")){
    panel.classList.remove("uso-minimized");
    fbdsUsoRenderPanel();
    return;
  }

  if(document.getElementById("modal-dashboard-censo")?.classList.contains("open")) closeCensoDashboard();
  if(document.getElementById("modal-ibge")?.classList.contains("open")) closeModal("modal-ibge");
  if(document.getElementById("uso-panel")?.classList.contains("open")) usoClosePanel();
  if(document.getElementById("pd-panel")?.classList.contains("open")) pdClosePanel();

  fbdsUsoVisibilitySnapshot={};
  Object.keys(LAYERS).forEach(id=>{
    fbdsUsoVisibilitySnapshot[id]=map.hasLayer(LAYERS[id].leaflet);
  });
  Object.keys(LAYERS).forEach(id=>{
    const layer=LAYERS[id];
    if(id==="uso_ocupacao_fbds"){
      if(!map.hasLayer(layer.leaflet)) layer.leaflet.addTo(map);
    }else if(map.hasLayer(layer.leaflet)){
      map.removeLayer(layer.leaflet);
    }
  });
  fbdsUsoUpdateLayerControls();
  panel.classList.add("open");
  panel.classList.remove("uso-minimized");
  const minimizeButton=document.getElementById("fbds-uso-minimize-btn");
  if(minimizeButton) minimizeButton.innerHTML="&#8722;";
  fbdsUsoRenderPanel();
}

function fbdsUsoClosePanel(){
  const panel=document.getElementById("fbds-uso-panel");
  if(!panel) return;
  if(panel.classList.contains("open") && fbdsUsoVisibilitySnapshot){
    Object.keys(fbdsUsoVisibilitySnapshot).forEach(id=>{
      if(!LAYERS[id]) return;
      const shouldBeVisible=fbdsUsoVisibilitySnapshot[id]===true;
      const isVisible=map.hasLayer(LAYERS[id].leaflet);
      if(shouldBeVisible && !isVisible) LAYERS[id].leaflet.addTo(map);
      else if(!shouldBeVisible && isVisible) map.removeLayer(LAYERS[id].leaflet);
    });
    fbdsUsoVisibilitySnapshot=null;
    fbdsUsoUpdateLayerControls();
  }
  panel.classList.remove("open","uso-minimized");
}

function fbdsUsoDownloadCsv(){
  const stats=fbdsUsoComputeStats();
  const quote=value=>`"${String(value).replace(/"/g,'""')}"`;
  const rows=[
    ["classe_uso","area_ha","percentual","quantidade_de_feicoes"],
    ...stats.rows.map(row=>[row.className,row.area.toFixed(4),row.pct.toFixed(4),row.count])
  ];
  const csv="\uFEFF"+rows.map(row=>row.map(quote).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");
  link.href=url;
  link.download="uso-ocupacao-fbds-resumo.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function fbdsUsoResetGeometry(){
  const panel=document.getElementById("fbds-uso-panel");
  if(!panel) return;
  ["left","right","top","width","height"].forEach(property=>{panel.style[property]="";});
  panel.classList.remove("uso-minimized");
  const button=document.getElementById("fbds-uso-minimize-btn");
  if(button) button.innerHTML="&#8722;";
}

(function setupFbdsUsoPanel(){
  const panel=document.getElementById("fbds-uso-panel");
  const header=document.getElementById("fbds-uso-head");
  if(!panel || !header) return;

  document.getElementById("btn-fbds-uso-top").addEventListener("click",fbdsUsoOpenPanel);
  document.getElementById("fbds-uso-close-btn").addEventListener("click",fbdsUsoClosePanel);
  document.getElementById("fbds-uso-reset-size").addEventListener("click",fbdsUsoResetGeometry);
  document.getElementById("fbds-uso-minimize-btn").addEventListener("click",()=>{
    const minimized=panel.classList.toggle("uso-minimized");
    document.getElementById("fbds-uso-minimize-btn").innerHTML=minimized?"&#9633;":"&#8722;";
  });
  document.getElementById("fbds-uso-filter").addEventListener("change",event=>{
    fbdsUsoSetClass(event.target.value||null);
  });
  document.getElementById("fbds-uso-clear-filter").addEventListener("click",()=>fbdsUsoSetClass(null));
  document.getElementById("fbds-uso-open-table").addEventListener("click",()=>openAttributeTable("uso_ocupacao_fbds"));
  document.getElementById("fbds-uso-export-csv").addEventListener("click",fbdsUsoDownloadCsv);

  header.addEventListener("pointerdown",event=>{
    if(event.button!==undefined && event.button!==0 || event.target.closest("button")) return;
    event.preventDefault();
    const rect=panel.getBoundingClientRect();
    const offsetX=event.clientX-rect.left, offsetY=event.clientY-rect.top;
    panel.style.left=`${rect.left}px`;
    panel.style.top=`${rect.top}px`;
    panel.style.right="auto";
    const move=moveEvent=>{
      const maxLeft=Math.max(4,window.innerWidth-panel.offsetWidth-4);
      const maxTop=Math.max(68,window.innerHeight-Math.min(panel.offsetHeight,44)-4);
      panel.style.left=`${Math.min(Math.max(4,moveEvent.clientX-offsetX),maxLeft)}px`;
      panel.style.top=`${Math.min(Math.max(68,moveEvent.clientY-offsetY),maxTop)}px`;
    };
    const stop=()=>{
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",stop);
      window.removeEventListener("pointercancel",stop);
    };
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",stop,{once:true});
    window.addEventListener("pointercancel",stop,{once:true});
  });

  panel.querySelectorAll(".uso-rz").forEach(handle=>{
    handle.addEventListener("pointerdown",event=>{
      if(panel.classList.contains("uso-minimized")) return;
      event.preventDefault();
      event.stopPropagation();
      const direction=handle.getAttribute("data-rz");
      const rect=panel.getBoundingClientRect();
      const startX=event.clientX, startY=event.clientY;
      const move=moveEvent=>{
        const dx=moveEvent.clientX-startX, dy=moveEvent.clientY-startY;
        let left=rect.left, top=rect.top, width=rect.width, height=rect.height;
        if(direction.includes("e")) width=Math.max(300,Math.min(window.innerWidth-8-rect.left,rect.width+dx));
        if(direction.includes("w")){
          left=Math.min(rect.left+dx,rect.right-300);
          left=Math.max(4,left);
          width=rect.right-left;
        }
        if(direction.includes("s")) height=Math.max(180,Math.min(window.innerHeight-8-rect.top,rect.height+dy));
        if(direction.includes("n")){
          top=Math.min(rect.top+dy,rect.bottom-180);
          top=Math.max(68,top);
          height=rect.bottom-top;
        }
        panel.style.left=`${left}px`;
        panel.style.top=`${top}px`;
        panel.style.right="auto";
        panel.style.width=`${width}px`;
        panel.style.height=`${height}px`;
      };
      const stop=()=>{
        window.removeEventListener("pointermove",move);
        window.removeEventListener("pointerup",stop);
        window.removeEventListener("pointercancel",stop);
      };
      window.addEventListener("pointermove",move);
      window.addEventListener("pointerup",stop,{once:true});
      window.addEventListener("pointercancel",stop,{once:true});
    });
  });
})();
