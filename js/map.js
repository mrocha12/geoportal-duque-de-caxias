/* ============================================================
   map.js - Inicialização do mapa, basemaps e panes
   Geoportal Duque de Caxias
   ============================================================ */
"use strict";

/* ================= BASEMAPS (Esri) ================= */
const ESRI_BASE = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const BASEMAPS = [
  {id:"imagery", label:"Satélite (Imagery)", url: ESRI_BASE+"World_Imagery/MapServer/tile/{z}/{y}/{x}", max:19},
  {id:"streets", label:"Ruas", url: ESRI_BASE+"World_Street_Map/MapServer/tile/{z}/{y}/{x}", max:19},
  {id:"topo", label:"Topográfico", url: ESRI_BASE+"World_Topo_Map/MapServer/tile/{z}/{y}/{x}", max:19},
  {id:"darkgray", label:"Cinza Escuro", url: ESRI_BASE+"Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", max:16},
  {id:"lightgray", label:"Cinza Claro", url: ESRI_BASE+"Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", max:16},
  {id:"terrain", label:"Relevo", url: "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}", max:16, thumbUrl: "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"},
  {id:"natgeo", label:"National Geographic", url: ESRI_BASE+"NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}", max:16},
];
const THUMB = {z:11, x:777, y:1156};

const basemapLayers = {};
BASEMAPS.forEach(b=>{
  if(b.id === "terrain"){
    // Relevo: base neutra + hillshade da Esri. O World Terrain Base raster é legado;
    // o World Hillshade é mantido pela Esri como camada de relevo para basemaps.
    const terrainBase = L.tileLayer(ESRI_BASE+"Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom:19, maxNativeZoom:16, attribution:"Esri"
    });
    const terrainHillshade = L.tileLayer(b.url, {
      maxZoom:19, maxNativeZoom:b.max, opacity:0.58, attribution:"Esri"
    });
    basemapLayers[b.id] = L.layerGroup([terrainBase, terrainHillshade]);
  } else {
    basemapLayers[b.id] = L.tileLayer(b.url, {maxZoom:19, maxNativeZoom:b.max, attribution:"Esri"});
  }
});
let activeBasemapId = "imagery";

/* ================= MAP INIT ================= */
const MUNI_BOUNDS_RAW = [[-22.81049,-43.4169],[-22.4755,-43.19438]]; // [[south,west],[north,east]]
var map = L.map("map", {
  zoomControl:false,
  attributionControl:false,
  minZoom:9,
  maxZoom:19,
  zoomSnap:0,
  layers:[basemapLayers[activeBasemapId]]
});
const municipioLayerTmp = L.geoJSON(DATA_MUNICIPIO);
map.fitBounds(municipioLayerTmp.getBounds(), {padding:[20,20]});
const HOME_VIEW = {center: map.getCenter(), zoom: map.getZoom()};

/* ================= PANES DE EMPILHAMENTO FIXO =================
   Garante pontos > linhas > polígonos sempre, independente da ordem
   em que as camadas são ligadas/desligadas pelo usuário. Não altera
   nenhum comportamento existente de toggle, zoom ou legenda. */
map.createPane("paneOverlayPoligonos"); map.getPane("paneOverlayPoligonos").style.zIndex = 410;
map.createPane("paneOverlayLinhas");    map.getPane("paneOverlayLinhas").style.zIndex = 420;
map.createPane("paneOverlayPontos");    map.getPane("paneOverlayPontos").style.zIndex = 430;
map.createPane("paneViasLabels");       map.getPane("paneViasLabels").style.zIndex = 435;
map.createPane("paneHighlight");        map.getPane("paneHighlight").style.zIndex = 650;