# Geoportal Duque de Caxias — Histórico de modificações

Arquivo único com todas as modificações, da versão mais recente (V34) para a mais antiga (V9).

## Índice
- [V34 — Todas as janelas movíveis e redimensionáveis](#v34--todas-as-janelas-movíveis-e-redimensionáveis)
- [V33 — Teste: leve transparência no corpo dos painéis e janelas](#v33--teste-leve-transparência-no-corpo-dos-painéis-e-janelas)
- [V32 — Fechar janela desseleciona o elemento do mapa](#v32--fechar-janela-desseleciona-o-elemento-do-mapa)
- [V31 — Padronização do comportamento das janelas](#v31--padronização-do-comportamento-das-janelas)
- [V30 — Marcadores permanece aberto](#v30--marcadores-permanece-aberto)
- [V29 — Efeito de cartões no painel lateral esquerdo](#v29--efeito-de-cartões-no-painel-lateral-esquerdo)
- [V28 — Abertura com o logo em tela cheia](#v28--abertura-com-o-logo-em-tela-cheia)
- [V27 — Logo MR completo na barra superior](#v27--logo-mr-completo-na-barra-superior)
- [V26 — Painel lateral recolhível](#v26--painel-lateral-recolhível)
- [V25 — Legenda e Camadas: hierarquia Geometria > Categoria > Camada](#v25--legenda-e-camadas-hierarquia-geometria--categoria--camada)
- [V24 — Tema claro: todos os textos em preto](#v24--tema-claro-todos-os-textos-em-preto)
- [V23 — Botões de dashboard no painel lateral + botões ON/OFF menores](#v23--botões-de-dashboard-no-painel-lateral--botões-onoff-menores)
- [V22 — Espaçamento do símbolo de Forças de Segurança](#v22--espaçamento-do-símbolo-de-forças-de-segurança)
- [V21 — Legenda e Camadas: organização por geometria e símbolos padronizados](#v21--legenda-e-camadas-organização-por-geometria-e-símbolos-padronizados)
- [V20 — Legenda: botão ON/OFF](#v20--legenda-botão-onoff)
- [V19 — Legenda: símbolos de polígono retangulares](#v19--legenda-símbolos-de-polígono-retangulares)
- [V18 — Paleta grafite + azul elétrico (aparência GIS desktop, discreta)](#v18--paleta-grafite--azul-elétrico-aparência-gis-desktop-discreta)
- [V15 — Petróleo e Gás e dados](#v15--petróleo-e-gás-e-dados)
- [V14 — Paleta Opção A: Azul petróleo + ciano](#v14--paleta-opção-a-azul-petróleo--ciano)
- [V14 — Painel lateral flutuante](#v14--painel-lateral-flutuante)
- [V11 — Novas camadas, Plano Diretor e identidade visual](#v11--novas-camadas-plano-diretor-e-identidade-visual)
- [V10 — Acessibilidade](#v10--acessibilidade)
- [V9 — Novidades e correções](#v9--novidades-e-correções)

---

## V34 — Todas as janelas movíveis e redimensionáveis
- Busca, Marcadores, Esboço, Medir, Consulta por Raio, Legenda, Mapas Base, Adicionar Camada, Exportar, Ajuda, Sobre e Exportar Mapa agora podem ser arrastadas pelo título e redimensionadas pelas bordas e cantos.
- Camadas, Uso e Ocupação, Plano Diretor, Dashboard, IBGE, Tabela de Atributos e Resultados do Raio já tinham esse comportamento e foram mantidos.
- Limites: a janela nunca fica sob a barra superior nem sai da tela (o X e o Recolher ficam sempre acessíveis); é reajustada ao redimensionar o navegador ou girar o aparelho. Tamanho mínimo respeitado; o conteúdo ganha rolagem quando a janela fica pequena.
- Botões Recolher e X preservados; janela recolhida mostra só o cabeçalho e continua movível.
- Arquivos novos: js/janelas-mover.js; estilos no fim de css/janelas.css.

---

## V33 — Teste: leve transparência no corpo dos painéis e janelas
- Só o corpo fica semitransparente (82%), com leve desfoque do mapa atrás: painéis flutuantes, janelas modais e painel lateral. As faixas e cartões internos também (70%).
- Cabeçalhos das janelas continuam sólidos.
- Ajuste fino pelas variáveis `--janela-alpha` e `--janela-alpha-int` em css/transparencia.css; para desfazer, remover esse arquivo e sua linha no index.html.
- Só aparência: nenhuma função alterada.

---

## V32 — Fechar janela desseleciona o elemento do mapa
Ao fechar qualquer janela (botão X ou Esc), o Geoportal limpa a seleção/destaque do mapa:
- Tabela de Atributos: linhas selecionadas e contorno no mapa
- Consulta por Raio: contorno das feições encontradas
- Busca (lateral e do topo): destaque da feição/endereço
- Uso e Ocupação do Solo e Plano Diretor: classe/zona selecionada e destaque
- Setores censitários selecionados no Dashboard
- Distrito destacado pela legenda
- Esboço: feição em edição (alças de vértices)
- Popup aberto da feição selecionada
Camadas, dados, estilos base, filtros e conteúdo dos popups não são alterados.
Arquivos: js/janelas.js (função limparSelecaoMapa) e js/global-search.js (exposição do limpar destaque).

---

## V31 — Padronização do comportamento das janelas
**Cabeçalho padrão:** [Título] [Recolher] [X] em todas as janelas (painéis flutuantes e modais), X no extremo direito (30×30 px), Recolher separado.
- Novo X em Esboço, Medir e Consulta por Raio.
- Novo Recolher em Tabela de Atributos, Resultados da Consulta por Raio, Dashboard, Dados do IBGE, Ajuda, Sobre e Exportar Mapa.
- Janela recolhida volta expandida ao ser reaberta; modais recolhidos não escurecem nem bloqueiam o mapa.

**Fechamento somente por X ou Esc**
- Clicar fora (fundo dos modais, Marcadores, Esboço, Medir, Raio) não fecha mais.
- Escolher um item não fecha mais Mapas Base, Esboço e Medir.
- Esc fecha apenas a janela ativa (última aberta ou usada); antes fechava todas. Esc com o menu Ferramentas aberto fecha só o menu; Esc na busca do topo só limpa a busca.

**Mantido como estava:** sistema de janela única dos painéis laterais (abrir um painel fecha o anterior), barra lateral esquerda (apenas Recolher), menu Ferramentas, popups, dados, camadas e ferramentas.
Arquivos: js/janelas.js e css/janelas.css (novos); ajustes em index.html, panels.js, ferramentas.js, dashboard.js, ibge.js, export-map.js.

---

## V30 — Marcadores permanece aberto
- A janela Marcadores não fecha mais ao escolher "Extensão completa" ou um distrito, nem ao clicar fora dela.
- Fecha somente pelo botão X do cabeçalho, pela tecla Esc ou pelo botão Marcadores da barra lateral.
- Demais janelas (Esboço, Medir, Raio, Busca) mantêm o comportamento anterior.

---

## V29 — Efeito de cartões no painel lateral esquerdo
- Painel com halo azul suave, borda de vidro e reflexo no topo.
- Cada botão virou um cartão arredondado com faixa lateral de destaque, ícone em pastilha e brilho/deslocamento leve no hover.
- Título de seção "Dados" com marcador lateral; entrada suave dos cartões ao carregar.
- Monocromático: apenas a paleta grafite + azul elétrico do geoportal; versão para tema claro incluída.
- Arquivo novo: css/painel-efeito.css (carregado por último). Nenhuma função alterada.

---

## V28 — Abertura com o logo em tela cheia
- Tela inicial agora exibe o logo MR (assets/images/logo-mr-abertura.jpg) ocupando toda a tela.
- Em telas largas a imagem preenche com "cover"; em telas em pé (celular) aparece inteira, sobre fundo desfocado.
- Removidos da abertura (apenas visualmente): título, subtítulo, linhas animadas e cantos; mantidos botão "Entrar no Geoportal", botão fechar, tecla Esc e clique na imagem para entrar.
- Estilo em css/opening-logo.css. Barra superior com logo (V27) mantida. Mapa e ferramentas inalterados.
- Imagem do logo atualizada para a versão "Logo_v1" (abertura em tela cheia e logo da barra superior).
- Abertura passou a mostrar a imagem inteira (contain), sem cortar nenhuma borda; as sobras laterais/superiores são preenchidas com a própria imagem desfocada.
- Imagem da abertura trocada pela "Logo_v2" (formato widescreen 16:9, exibida inteira). O logo da barra superior continua com a Logo_v1.
- Logo da barra superior agora é um link: ao clicar, abre https://marcio-gis-portf.lovable.app em uma nova aba (com efeito de hover e foco por teclado).

---

## V27 — Logo MR completo na barra superior
- Logo completo (MR + "Tecnologia que mapeia.") à esquerda do nome "Geoportal" (assets/images/logo-mr-completo.png).
- Barra superior mais alta (76 px no desktop, 60 px no celular) para acomodar o logo.
- Estilo em css/topbar-fix.css; nenhuma outra ferramenta alterada.

---

## V26 — Painel lateral recolhível

- Novo botão (seta) no topo do painel lateral: recolhe o painel, deixando só o botão visível; clique de novo para expandir.
- A seta gira conforme o estado; rótulo/tooltip alterna entre "Recolher painel lateral" e "Expandir painel lateral"
  (aria-expanded atualizado; acessível por teclado).
- O estado fica salvo no navegador (localStorage) e é restaurado ao reabrir o geoportal.
- No celular (<= 768px) o botão não aparece: o painel já é uma gaveta com botão próprio.
- Nenhuma função dos botões do painel foi alterada.
- Arquivos: index.html, js/panels.js e css/tema-grafite-azul.css.


### Ajuste — botão Recolher sempre visível
- O botão permanece visível quando o painel está recolhido.
- O rótulo visual **Recolher** permanece sempre presente.
- A ação de expandir/recolher e o estado salvo em `localStorage` foram preservados.
- Nenhuma outra ferramenta, camada ou funcionalidade foi alterada.

### Recolhimento das janelas flutuantes
- O botão compacto **Recolher** foi adicionado aos cabeçalhos das janelas e painéis flutuantes.
- Ao recolher, o conteúdo é ocultado e o cabeçalho permanece visível para permitir restaurar a janela.
- Camadas e dashboards reutilizam sua minimização existente; janelas modais permanecem inalteradas.

---

## V25 — Legenda e Camadas: hierarquia Geometria > Categoria > Camada

Mesma hierarquia e mesma ordem nas duas janelas:

PONTOS
- Infraestrutura: Estações, Reservatórios, Terminais Rodoviários
- Equipamentos: Saúde, Escolas, Cemitérios, Religião, Cultura e Turismo, Forças de Segurança, Secretarias, Assistência Social
- Petróleo e Gás: Terminais de Combustíveis, Terminais de GNL, UPGN
LINHAS
- Infraestrutura: Ferrovia, Vias
- Meio Ambiente: Hidrografia
- Petróleo e Gás: Gasodutos
POLÍGONOS
- Limites: Município, Bairros
- Estatísticas: Setores Censitários
- Uso e Ocupação do Solo
- Meio Ambiente: UCs Estadual, Federal, Municipal
- Planejamento Urbano: Plano Diretor

- Camadas: título de geometria + grupos de categoria recolhíveis (contador ligadas/total mantido).
- Legenda: título de geometria + subtítulo de categoria + camadas.
- Categorias na ordem do cadastro de camadas; camadas na ordem de cadastro dentro da categoria
  (a Legenda deixa de seguir a ordem de desenho do mapa e passa a usar a mesma ordem da janela Camadas).
- Camadas GeoJSON do usuário entram em "Camadas do usuário" dentro da sua geometria.
- Sem alteração em nomes, dados, simbologias, DRAW_ORDER ou funcionalidades.
- Arquivos: js/panels.js e css/tema-grafite-azul.css.

---

## V24 — Tema claro: todos os textos em preto

- Variáveis de texto do tema claro passam a #000 (principal e secundário) e uma regra final força preto
  em todos os elementos com texto (títulos, rótulos, botões, campos, tabelas, tooltips, status do mapa).
- Barra superior e cabeçalhos dos painéis ficam CLAROS no tema claro (#E9EEF5, filete #C9D0DA),
  para o texto preto continuar legível. O tema escuro não muda.
- Itens ativos em azul (botões e abas) passam a texto/ícone pretos.
- Placeholders dos campos: preto com 62% de opacidade (para não parecerem texto digitado).
- Exceções: tela de abertura (fundo escuro) e rótulos de bairros sobre o mapa (branco com contorno).
- Arquivos: css/tema-grafite-azul.css e index.html (versão do CSS).

---

## V23 — Botões de dashboard no painel lateral + botões ON/OFF menores

- Botões movidos da barra superior para o painel lateral, em um novo grupo "Dashboards" (abaixo de "Dados"):
  Dashboard dos Setores Censitários, Uso e Ocupação, Plano Diretor.
- Mesmos ids (btn-dashboard-top, btn-uso-top, btn-plano-diretor-top): cliques, exclusão mútua entre painéis e
  estado desabilitado (quando a camada não tem dados) continuam funcionando sem alteração de código.
- Visual igual ao dos demais botões do painel lateral (somente ícone; nome no tooltip e no aria-label).
- "Dados do IBGE" permanece na barra superior.
- Botões ON/OFF: 44x22 -> 36x18 (marcador 16 -> 12px, texto 9 -> 8px), na janela Camadas e na Legenda;
  recuo das sub-listas da Legenda ajustado (53 -> 45px).
- Arquivos: index.html, js/panels.js e css/tema-grafite-azul.css.

---

## V22 — Espaçamento do símbolo de Forças de Segurança

- Causa: o símbolo (4 círculos de 14px + 3 espaços de 2px = 62px) era maior que a coluna padrão de 36px
  e, centralizado, invadia o nome da camada.
- Correção: a coluna dessa camada acompanha a largura do símbolo (alinhado à esquerda) e ganha 9px extras de folga
  até o nome. Vale na Legenda (abas Interativo e Legenda) e na janela Camadas.
- Símbolo, cores e tamanho preservados. Demais camadas e sub-lista de agências sem alteração.
- Arquivos: js/panels.js e css/tema-grafite-azul.css.

---

## V21 — Legenda e Camadas: organização por geometria e símbolos padronizados

- Ordem dos grupos (Legenda e janela Camadas): Pontos -> Linhas -> Polígonos.
- Dentro de cada grupo a ordem de cada janela foi mantida (Legenda: DRAW_ORDER; Camadas: sequência atual das categorias).
- Camadas: os grupos por categoria foram substituídos pelos três grupos de geometria (recolher/expandir e contador "ligadas/total" mantidos).
- Legenda: títulos discretos "Pontos / Linhas / Polígonos".
- Símbolos: coluna de largura fixa de 36px. Polígonos = retângulo 36x18; linhas (vias, hidrografia, gasodutos, ferrovia) = mesma largura, com espessura e cor originais; pontos = ícone original centralizado.
- Também vale para a janela Camadas (polígonos agora retangulares nela também).
- Camadas GeoJSON enviadas pelo usuário são classificadas pela geometria real do arquivo (polígono > linha > ponto).
- Mapa, DRAW_ORDER, legenda da exportação de mapa e dados: sem alterações.
- Arquivos: js/panels.js e css/tema-grafite-azul.css.

---

## V20 — Legenda: botão ON/OFF

- Aba "Interativo" da Legenda: as caixas de seleção foram substituídas pelo mesmo botão ON/OFF da janela Camadas
  (ligado = azul/"ON", desligado = grafite/"OFF"; role="switch" + aria-checked).
- Mesmo comportamento: o botão chama toggleLayer() e a legenda/lista de Camadas são redesenhadas.
- Sub-listas (distritos, faixas do Censo, UCs, Plano Diretor, Segurança) e links "limpar" recuados para alinhar com o rótulo.
- A aba "Legenda" (somente camadas visíveis) permanece sem controles.
- Arquivos: js/panels.js e css/tema-grafite-azul.css.

---

## V19 — Legenda: símbolos de polígono retangulares

- Símbolos de polígono na legenda: altura 18px (inalterada), largura 36px (2x a altura).
- Camadas afetadas: Limite Municipal, Bairros/Distritos, Setores Censitários, Uso e Ocupação do Solo,
  UCs Estadual/Federal/Municipal, Plano Diretor 2022 e camadas GeoJSON carregadas pelo usuário.
- Sub-itens (distritos, faixas do Censo, categorias de UC, classes do Plano Diretor): 14px de altura x 28px de largura.
- Cor, transparência, contorno e raio de borda preservados; mapa não alterado.
- Sub-listas e "limpar destaque/filtro" reindentados para continuar alinhados ao rótulo.
- Não afetados: pontos, linhas, lista de Camadas e legenda da exportação de mapa.
- Arquivos: js/panels.js (classe lp-swatch-poly) e css/tema-grafite-azul.css.

---

## V18 — Paleta grafite + azul elétrico (aparência GIS desktop, discreta)

| Elemento | Cor |
|---|---|
| Barra superior | #151A21 |
| Painel | #20252D |
| Destaque | #3B9EFF |
| Hover | #303740 |
| Texto | #FFFFFF |
| Texto secundário | #AEB6C2 |
| Borda | #3A424D |

- Barra superior e cabeçalhos de painéis sólidos (sem degradê), separados por filete #3A424D.
- Itens ativos em azul; botão ON/OFF das camadas mantido (ligado em azul, desligado em grafite).
- Tema claro: barra grafite e destaque azul mais profundo (#1F7AE0) para manter contraste.
- Ajustes: variáveis no topo de css/tema-grafite-azul.css.
- Só visual: dados, camadas e funcionalidades preservados.

---

## V15 — Petróleo e Gás e dados

### Novo grupo de camadas: Petróleo e Gás
- **Gasodutos de Transporte** (108 trechos, linhas), **Terminais de Combustíveis Líquidos** (133), **Terminais de GNL** (7) e **Unidades de Processamento de Gás Natural – UPGN** (36). Todas desligadas por padrão.
- As bases são **nacionais** (Brasil inteiro). Na região de Caxias/Baía de Guanabara: 9 trechos de gasoduto, 2 UPGNs (U-2500 e U-2600, REDUC), 3 terminais de combustíveis (Braskem, Transpetro TECAM e outros) e o terminal de GNL TR-BGUA.
- Integradas a: lista de camadas (grupo próprio, ligar/desligar, opacidade, isolar, tabela), legenda (aba Legenda e Interativo), popups, tooltip de passagem do mouse, busca global e chips de busca, Tabela de Atributos, Consulta por Raio (incl. filtro "Camadas a consultar"), exportação (GeoJSON/KML/KMZ/SHP…), legenda do Exportar Mapa e link compartilhável.
- Símbolos no padrão das demais camadas de pontos (círculo branco + glifo): tanque (marrom), chama (azul) e planta industrial (cinza-azulado). Gasodutos em linha âmbar.
- Sem zoom mínimo de exibição (diferente das demais camadas de pontos, que só aparecem a partir do zoom 14), pois são poucas feições espalhadas pelo país.
- **Zoom na camada** dessas quatro camadas leva à região de Caxias/Baía de Guanabara (propriedade `zoomBounds`, opcional em qualquer camada), e não ao centro do Brasil.

### Dados
- Atributos mantidos exatamente como fornecidos. Coordenadas com precisão reduzida (5 casas nas linhas, 6 nos pontos).
- Gasodutos: dentro da região metropolitana do Rio (-43,6 a -42,9 / -23,1 a -22,3) a geometria foi mantida sem simplificação; nos demais trechos foi aplicada simplificação Douglas-Peucker de ~22 m. Resultado: 464 mil vértices → 37 mil (≈0,77 MB). `data/data.js` passou de 6,5 para 7,3 MB.
- A acentuação dos textos nos arquivos de origem está corrompida (ex.: "AUTORIZADA OPERAORO", "CubatRo", "Campos El)seos"). Na exibição (popup, tooltip, resultados de raio), apenas os campos de **situação** e **fluido** são normalizados ("Autorizada operação", "Operação", "Gás"), pois o significado é inequívoco. Tabela de Atributos e exportações mostram o valor original. Os demais textos corrompidos precisam ser corrigidos na fonte.
- O campo `CAPACIDADE` dos terminais de GNL é exibido sem unidade, pois o arquivo não informa.

---

## V14 — Paleta Opção A: Azul petróleo + ciano

Aplicação visual da paleta:
- Azul petróleo principal: `#123B5D`
- Azul petróleo escuro: `#0D2C45`
- Painel: `#172B3A`
- Painel secundário: `#203A4D`
- Ciano de destaque: `#00A6C7`
- Ciano claro/glow: `#58D8EA`
- Hover: `#24516D`
- Borda: `#34566D`
- Texto: `#F4F7FA`
- Texto secundário: `#AFC0CC`

A alteração é exclusivamente visual. Camadas, dados, URLs, scripts, APIs, IDs e funcionalidades foram preservados.

---

## V14 — Painel lateral flutuante
- Substituída visualmente a barra lateral esquerda por um painel flutuante sobre o mapa.
- Mantidos os IDs e eventos existentes das ferramentas para preservar a funcionalidade.
- Mantidos tema claro/escuro e comportamento responsivo.
- Busca por categoria reposicionada para abrir ao lado do painel no desktop.
- No mobile, o painel continua acessível pelo botão de ferramentas, como painel flutuante.

---

## V11 — Novas camadas, Plano Diretor e identidade visual

### Novas camadas (V11)
- **Equipamentos de Cultura e Turismo** (6), **Forças de Segurança** (29), **Secretarias Municipais** (24), **Unidades de Assistência Social** (45) — grupo *Equipamentos*; **Terminais Rodoviários** (7) — grupo *Infraestrutura*; **Plano Diretor 2022 (Zoneamento)** (294 polígonos) — novo grupo *Planejamento Urbano*. Todas desligadas por padrão.
- Integradas a: lista de camadas (ligar/desligar, opacidade, zoom, isolar, tabela), legenda (Plano Diretor com as 11 classes de `Zona_2`), popups e tooltip de passagem do mouse, busca global e chips de busca, Tabela de Atributos (colunas mais relevantes já visíveis; as demais em "Colunas"), Consulta por Raio, exportação (GeoJSON/KML/KMZ/SHP…) e permalink.
- Ícones próprios no padrão das demais camadas de pontos (círculo branco + glifo colorido).
- Dados embutidos exatamente como fornecidos (atributos intactos); apenas a precisão das coordenadas foi reduzida (5 casas nos polígonos do Plano Diretor, 6 nos pontos) para manter o arquivo leve.
- Popups mostram só campos existentes e preenchidos; campos técnicos (OBJECTID, X/Y, Shape_Leng…) continuam disponíveis apenas na Tabela de Atributos.

### Dashboard do Plano Diretor
- Nova janela flutuante (arrastável, redimensionável, minimizável, com "restaurar tamanho"), aberta pelo botão *Dashboard* da camada na lista de camadas ou pelo botão do popup.
- Conteúdo 100% derivado da base: indicadores (feições, área total, zonas, classes, instrumentos legais, maior classe/zona), área por classe de zoneamento (barra proporcional + ranking, clicável), objetivos estratégicos, legislação, ano da lei (`AnoLei`), tabela de zonas com busca e zoom/realce no mapa, e ficha de metadados (categoria, tipo, ano, elaboração, sistema de referência, fonte, contato) com a contagem de feições em que cada campo está preenchido.
- Filtro por classe atualiza todos os blocos e destaca a classe no mapa (as demais ficam esmaecidas); fechar o painel restaura o estilo.
- Exporta a tabela de zonas (CSV/JSON) respeitando o filtro e abre a Tabela de Atributos da camada.
- O valor `2206` no campo `AnoLei` existe na base original e foi mantido, com nota no painel.

### Correções
- **Janela Camadas** abria pequena, no canto esquerdo e sob a barra superior. Causa: ao redimensionar a janela do navegador com o painel fechado, o ajuste de posição media o painel oculto (0×0) e gravava largura/altura zero e posição 4,4. Agora o ajuste só ocorre com o painel visível, é refeito ao abrir e nunca deixa o painel acima da base da barra superior (também ao arrastar/redimensionar).
- Geometria inválida salva anteriormente no navegador (tamanho zero ou posição sob a barra) é descartada automaticamente; o painel volta ao canto superior direito, com 420 px de largura.
- Mesmo ajuste no painel de Uso e Ocupação do Solo (que também deixou de ser reposicionado por script em telas ≤560 px, onde o CSS já o posiciona).

### Identidade visual
- Nova paleta **verde-petróleo (teal)**: barra superior `#0f766e` → `#115e59` (tema claro) e `#0d6b63` → `#0a534d` (tema escuro).
- Cor de destaque dos botões ativos, abas e seleções trocada de azul para teal `#0f8178` (contraste 4,7:1 com texto branco); brilho de textos e links `#5eead4`.
- Tela de abertura, barra de status do tema claro, foco e cores padrão de desenho ajustados para a mesma paleta.
- Mantido em azul o gráfico "Urbana/Rural" do dashboard, para não se confundir com o verde de "Rural".

---

## V10 — Acessibilidade

### Acessibilidade (diretrizes da skill UI UX Pro Max)
- Busca global navegável por teclado: ↓ entra na lista de resultados, ↑/↓/Home/End percorrem, Esc devolve o foco ao campo.
- Resultados da busca agora são uma região `aria-live="polite"` (o `role="listbox"` anterior era inválido, pois os filhos eram botões).
- Foco visível (anel de 2 px) nos resultados da busca, nos temas escuro e claro.
- Avisos (`#toast`) anunciados por leitores de tela (`role="status"`).
- `aria-label` nos botões Ajuda, Sobre e Ligar/Desligar todas as camadas (antes só tinham `title`).

---

## V9 — Novidades e correções

### Novidades
- **Link compartilhável** (`js/permalink.js`): zoom, centro, mapa base e camadas ativas ficam no hash da URL
  (`#z=14.25&c=-22.65000,-43.30000&b=streets&l=bairros,vias`). Novo botão de link na barra superior copia a vista atual.
  Quem abre um link compartilhado entra direto no mapa, sem a tela de abertura.
- **Bibliotecas locais** (`vendor/`): Leaflet, JSZip, shp-write e tokml não dependem mais do unpkg.

### Correções
- Popups de `layers.js` agora escapam o HTML dos atributos (evita XSS se os dados vierem de fontes externas).
- `escapeHtml` passou a ter uma única definição (`utils.js`).
- Corrigido `ReferenceError: updateToolbarStates is not defined` no carregamento (a chamada ficava em `layers.js`,
  antes de `panels.js` definir a função; agora é feita em `app.js`).

### Não alterado nesta versão
- `data/data.js` continua único (~5,8 MB); divisão por camada com carregamento sob demanda fica para uma próxima etapa.
- Código duplicado das janelas arrastáveis (attribute-table, dashboard, ibge, panels, radius).

- Faces de Logradouro: removida dependência de fetch/CORS; dados otimizados incorporados em data/faces-logradouros.js. Camada automática a partir do zoom 15.


## Correção Faces de Logradouro – tooltip hover
- Vinculado o hover após o carregamento das feições.
- Tooltip usa `NM_TIP_LOG + espaço + NM_LOG` como nome da via.
- Mantidas as demais configurações.
