# Geoportal Duque de Caxias — V11

## Novas camadas (V11)
- **Equipamentos de Cultura e Turismo** (6), **Forças de Segurança** (29), **Secretarias Municipais** (24), **Unidades de Assistência Social** (45) — grupo *Equipamentos*; **Terminais Rodoviários** (7) — grupo *Infraestrutura*; **Plano Diretor 2022 (Zoneamento)** (294 polígonos) — novo grupo *Planejamento Urbano*. Todas desligadas por padrão.
- Integradas a: lista de camadas (ligar/desligar, opacidade, zoom, isolar, tabela), legenda (Plano Diretor com as 11 classes de `Zona_2`), popups e tooltip de passagem do mouse, busca global e chips de busca, Tabela de Atributos (colunas mais relevantes já visíveis; as demais em "Colunas"), Consulta por Raio, exportação (GeoJSON/KML/KMZ/SHP…) e permalink.
- Ícones próprios no padrão das demais camadas de pontos (círculo branco + glifo colorido).
- Dados embutidos exatamente como fornecidos (atributos intactos); apenas a precisão das coordenadas foi reduzida (5 casas nos polígonos do Plano Diretor, 6 nos pontos) para manter o arquivo leve.
- Popups mostram só campos existentes e preenchidos; campos técnicos (OBJECTID, X/Y, Shape_Leng…) continuam disponíveis apenas na Tabela de Atributos.

## Dashboard do Plano Diretor
- Nova janela flutuante (arrastável, redimensionável, minimizável, com "restaurar tamanho"), aberta pelo botão *Dashboard* da camada na lista de camadas ou pelo botão do popup.
- Conteúdo 100% derivado da base: indicadores (feições, área total, zonas, classes, instrumentos legais, maior classe/zona), área por classe de zoneamento (barra proporcional + ranking, clicável), objetivos estratégicos, legislação, ano da lei (`AnoLei`), tabela de zonas com busca e zoom/realce no mapa, e ficha de metadados (categoria, tipo, ano, elaboração, sistema de referência, fonte, contato) com a contagem de feições em que cada campo está preenchido.
- Filtro por classe atualiza todos os blocos e destaca a classe no mapa (as demais ficam esmaecidas); fechar o painel restaura o estilo.
- Exporta a tabela de zonas (CSV/JSON) respeitando o filtro e abre a Tabela de Atributos da camada.
- O valor `2206` no campo `AnoLei` existe na base original e foi mantido, com nota no painel.

## Correções
- **Janela Camadas** abria pequena, no canto esquerdo e sob a barra superior. Causa: ao redimensionar a janela do navegador com o painel fechado, o ajuste de posição media o painel oculto (0×0) e gravava largura/altura zero e posição 4,4. Agora o ajuste só ocorre com o painel visível, é refeito ao abrir e nunca deixa o painel acima da base da barra superior (também ao arrastar/redimensionar).
- Geometria inválida salva anteriormente no navegador (tamanho zero ou posição sob a barra) é descartada automaticamente; o painel volta ao canto superior direito, com 420 px de largura.
- Mesmo ajuste no painel de Uso e Ocupação do Solo (que também deixou de ser reposicionado por script em telas ≤560 px, onde o CSS já o posiciona).

## Identidade visual
- Nova paleta **verde-petróleo (teal)**: barra superior `#0f766e` → `#115e59` (tema claro) e `#0d6b63` → `#0a534d` (tema escuro).
- Cor de destaque dos botões ativos, abas e seleções trocada de azul para teal `#0f8178` (contraste 4,7:1 com texto branco); brilho de textos e links `#5eead4`.
- Tela de abertura, barra de status do tema claro, foco e cores padrão de desenho ajustados para a mesma paleta.
- Mantido em azul o gráfico "Urbana/Rural" do dashboard, para não se confundir com o verde de "Rural".

# Geoportal Duque de Caxias — V10

## Acessibilidade (diretrizes da skill UI UX Pro Max)
- Busca global navegável por teclado: ↓ entra na lista de resultados, ↑/↓/Home/End percorrem, Esc devolve o foco ao campo.
- Resultados da busca agora são uma região `aria-live="polite"` (o `role="listbox"` anterior era inválido, pois os filhos eram botões).
- Foco visível (anel de 2 px) nos resultados da busca, nos temas escuro e claro.
- Avisos (`#toast`) anunciados por leitores de tela (`role="status"`).
- `aria-label` nos botões Ajuda, Sobre e Ligar/Desligar todas as camadas (antes só tinham `title`).

# Geoportal Duque de Caxias — V9

## Novidades
- **Link compartilhável** (`js/permalink.js`): zoom, centro, mapa base e camadas ativas ficam no hash da URL
  (`#z=14.25&c=-22.65000,-43.30000&b=streets&l=bairros,vias`). Novo botão de link na barra superior copia a vista atual.
  Quem abre um link compartilhado entra direto no mapa, sem a tela de abertura.
- **Bibliotecas locais** (`vendor/`): Leaflet, JSZip, shp-write e tokml não dependem mais do unpkg.

## Correções
- Popups de `layers.js` agora escapam o HTML dos atributos (evita XSS se os dados vierem de fontes externas).
- `escapeHtml` passou a ter uma única definição (`utils.js`).
- Corrigido `ReferenceError: updateToolbarStates is not defined` no carregamento (a chamada ficava em `layers.js`,
  antes de `panels.js` definir a função; agora é feita em `app.js`).

## Não alterado nesta versão
- `data/data.js` continua único (~5,8 MB); divisão por camada com carregamento sob demanda fica para uma próxima etapa.
- Código duplicado das janelas arrastáveis (attribute-table, dashboard, ibge, panels, radius).
