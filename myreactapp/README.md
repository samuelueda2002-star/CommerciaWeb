# Commercia: integração com a API

O layout e a identidade visual existentes foram preservados. A integração utiliza `fetch`, sem novas dependências.

## Executar

A URL informada já está configurada no arquivo local `.env.local`:

```dotenv
REACT_APP_API_BASE_URL=http://168.75.100.157/api/v1
```

Em outro ambiente, copie `.env.example` para `.env.local`, ajuste o endereço incluindo `/api/v1` e reinicie o servidor. As variáveis `REACT_APP_*` são incorporadas no build; não coloque senhas ou tokens nesses arquivos.

```powershell
npm start
```

## Funcionalidades conectadas

| Área | Integração |
| --- | --- |
| Login | `POST /auth/login`, formulário `application/x-www-form-urlencoded` com `username` e `password` |
| Sessão | `GET /auth/me`, primeira filial de `accessible_filial_ids`, Bearer token, restauração e saída |
| Produtos | Cadastro, edição e exclusão com confirmação; catálogo paginado, categorias, preço atual e estoque; busca e filtro por categoria |
| Clientes | Cadastro, edição e exclusão com confirmação; contatos e contagem de pedidos não cancelados; busca por nome e e-mail |
| Categorias | Cadastro e edição com departamento, contagem de produtos da filial e navegação para o catálogo filtrado |
| Vendas | Cadastro online, pedidos paginados, detalhamento dos descontos e valores líquidos, totais do mês, busca na página e filtro de status |
| Dashboard e relatórios | Indicadores operacionais, analytics por período/entidade, ranking, rupturas de estoque, previsões, avaliações de modelos e exportação JSON |
| Usuários | Cadastro com perfis e filiais pelo botão Convidar usuário; listagem paginada das lojas acessíveis |

O campo visual “E-mail” foi mantido, mas seu conteúdo é enviado como `username`, conforme o contrato do backend. Use o identificador de usuário aceito pela API.

Na tela **Clientes**, o botão **Novo cliente** abre um formulário com nome, sobrenome, e-mail e CPF obrigatórios, além de telefone e data de nascimento opcionais. O cadastro envia JSON para `POST /clients?filial_id=...` usando a filial da sessão. O CPF recebe a máscara `000.000.000-00` durante a digitação, aceita somente 11 números e é enviado sem pontuação. Durante o envio, o formulário impede cadastros duplicados; erros preservam os dados para correção. Após salvar, exibe a confirmação, limpa a busca e recarrega a lista de clientes.

O botão **Editar** na coluna **Ações** abre esse formulário com os dados do cliente selecionado e o CPF formatado. **Salvar alterações** atualiza o registro por `PATCH /clients/{client_id}`, confirma o resultado e recarrega a lista. Os campos opcionais podem ser apagados. **Cancelar** fecha o formulário sem enviar alterações.

O botão **Excluir** de cada cliente abre um aviso com seu nome e e-mail. Apenas **Confirmar exclusão** envia `DELETE /clients/{client_id}`. A API desativa o cliente e preserva o cadastro e o histórico de pedidos. Após o sucesso, a lista é recarregada, mantendo a busca; o cliente aparece como **Inativo** e a exclusão fica desabilitada. Cancelar, fechar o aviso ou pressionar Escape não altera o cadastro. Erros mantêm o aviso aberto para nova tentativa.

Na tela **Produtos**, **Novo produto** e **Editar** abrem o formulário de dados do catálogo. Nome, SKU e categoria são obrigatórios; marca, código de barras, descrição, peso, altura, largura e profundidade são opcionais. As categorias são carregadas da filial, com tratamento de falhas, opção de recarregar e aviso quando não há categorias disponíveis. Medidas aceitam vírgula ou ponto decimal e devem ser maiores ou iguais a zero. O código de barras preserva os zeros iniciais.

O cadastro usa `POST /catalog/products?filial_id=...`; a edição usa `PATCH /catalog/products/{product_id}` e mantém o SKU como somente leitura, conforme o contrato da API. Textos opcionais podem ser apagados. A API ignora valores nulos na edição de medidas: para zerar uma medida existente, informe `0`. Após salvar, a tela confirma o resultado, limpa os filtros e atualiza a lista. Preço e estoque são consultados em seus endpoints específicos; o formulário utiliza os campos de `ProductCreate` e `ProductUpdate`.

O botão **Excluir** abre um aviso com o nome e o SKU do produto, explicando que a operação o torna inativo e preserva o cadastro e o histórico de vendas. Apenas **Confirmar exclusão** envia `DELETE /catalog/products/{product_id}`. **Cancelar**, fechar o aviso e pressionar Escape não enviam alterações. Durante a solicitação, os controles impedem envios repetidos. Após o sucesso, a lista é recarregada e mostra o produto como **Inativo**, com a exclusão desabilitada. Falhas mantêm o aviso aberto e permitem tentar novamente.

“Manter-me conectado” usa `localStorage`; sem a opção, a sessão usa `sessionStorage`. Senhas não são armazenadas. Uma resposta 401 encerra a sessão; 403 mantém a sessão e informa a falta de permissão. Requisições têm timeout de 15 segundos e são canceladas ao sair da tela.

Na tela **Categorias**, **Nova categoria** e **Editar** abrem um formulário com nome e departamento obrigatórios. Os departamentos são carregados de `GET /catalog/departments`, com opção de recarregar em caso de erro. O cadastro envia JSON a `POST /catalog/categories?filial_id=...`; a edição usa `PATCH /catalog/categories/{category_id}`. Após salvar, a tela confirma a operação e recarrega os cartões e as contagens. A categoria também passa a aparecer na seleção de produtos. Cancelar não envia alterações; erros preservam os dados digitados.

O OpenAPI consultado em 20/10/2026 oferece leitura, cadastro e edição de categorias, sem rota `DELETE`. Por isso, **Excluir** permanece desabilitado, com uma explicação na tela. A conclusão dessa função depende da implementação no backend; o projeto local contém apenas o frontend.

As listagens de cadastros percorrem a paginação da API (`items`, `total`, `limit`, `offset`). A tela de vendas carrega 50 pedidos por página; o filtro de status é enviado ao servidor e a busca textual considera a página carregada. Os cartões do mês vêm dos relatórios resumidos da API e não mudam ao trocar a página ou o status da listagem. As compras por cliente vêm do relatório paginado por cliente, sem baixar todos os pedidos. Não há substituição por dados fictícios quando uma chamada falha.

## Atualização de vendas, analytics e previsões — 11/11/2026

O OpenAPI em `http://168.75.100.157/openapi.json` foi consultado novamente. O servidor agora publica dashboard, analytics, previsões e usuários, além dos cadastros existentes. Login, indicadores, resumo de vendas e as rotas de analytics e previsões foram validados por HTTP. As telas de dashboard, relatórios e previsões também foram conferidas no navegador com o servidor real. Não foram cadastrados, pagos, cancelados ou excluídos pedidos no servidor durante a validação.

### Vendas online

**Nova venda** abre um formulário no mesmo padrão dos cadastros. São exibidos clientes ativos e produtos ativos com preço vigente e estoque. A oferta só é usada se for maior que zero; caso contrário, vale o preço padrão. O site valida quantidades inteiras, estoque somado entre linhas repetidas e desconto não negativo com até duas casas decimais. Valores monetários de entrada são convertidos em centavos para evitar perda de precisão.

`POST /orders?filial_id=...` envia apenas `client_id`, `payment_method`, `discount` e `items` com `product_id` e `quantity`. O transporte também filtra campos extras: nunca envia `unit_price`, `total`, `occurred_at` ou `client_reference`. O preço final vem do servidor. Falhas, inclusive cliente desativado e validação 422, mantêm o formulário preenchido; o envio bloqueia cliques repetidos.

O botão **Ver itens** consulta `GET /orders/{id}` e mostra `total` bruto, `discount_allocated` e `net_total` separadamente. Receita por item usa `net_total`; o total da venda usa o `total` líquido do pedido. Datas e agrupamento do mês usam `America/Sao_Paulo`. O site é um cliente online; o fluxo Delphi de `/sync/push` e `/sync/pull` não é executado por ele.

### Analytics e previsões

| Rota | Uso no site |
| --- | --- |
| `/analytics/status` | Data de consolidação, última venda e aviso de atualização com falha |
| `/analytics/sales/daily` | Gráfico diário do dashboard e receita líquida por dia nos relatórios |
| `/analytics/sales/compare` | Receita, custo, margem e quantidade com variação sobre outro período |
| `/analytics/sales/ranking` | Top 10 de produtos/categorias/departamentos por receita, quantidade ou margem |
| `/analytics/stockouts` | Alertas dos produtos da filial com mais dias sem estoque |
| `/analytics/stock/daily` | Histórico de estoque ao clicar no produto de um alerta; ruptura destacada em vermelho |
| `/forecasts/summary` | Cartões de quantidade/receita para 7 ou 14 dias e erro típico WAPE |
| `/forecasts/compare` | Série histórica, previsão tracejada e faixa sombreada de 80% |
| `/forecasts/backtest` | Comparação retroativa entre previsto e realizado, carregada sob demanda |
| `/forecasts/accuracy` | WAPE, MAPE, MAE, viés e número de execuções por modelo/horizonte |
| `/forecasts/runs` | Histórico de execuções na seção de avaliação e na exportação |
| `/forecasts` | Pontos simples na exportação, com `entity_id` obrigatório inclusive para a filial |

Todas essas chamadas enviam `filial_id`. As rotas de entidade enviam `level` e, fora do nível filial, `entity_id`; cada método aceita somente os parâmetros do seu contrato. O ranking e os alertas são da filial no período escolhido e têm identificação própria, mesmo quando o gráfico principal está filtrado por entidade.

O período padrão dos relatórios cobre 28 dias e termina em `last_sale_date`, retornado por `/analytics/status`. O gráfico curto do dashboard usa sete dias com a mesma referência. O usuário pode escolher o período anterior ou datas personalizadas, até 366 dias inclusivos, e informar as duas datas de comparação. Datas após a última venda são tratadas como **sem dados**, em vez de gerar um gráfico com zeros artificiais. Se `last_sale_date` é nulo, não são solicitados gráficos consolidados nem previsões. Uma atualização com falha gera um aviso sem inventar valores.

Percentuais de **analytics e previsões** são frações: `0.1109` é mostrado como `11,09%`; `null` aparece como “—” ou “Sem comparação disponível”, enquanto zero continua `0%`. Os percentuais dos relatórios antigos do dashboard continuam em pontos percentuais e não são multiplicados novamente. As séries diárias usam os pontos retornados pelo servidor, sem preencher intervalos desconhecidos.

O modelo padrão é omitido da query para a API selecionar o mais preciso. O usuário também pode escolher um dos quatro modelos e alternar entre quantidade e receita. Cada cartão identifica seu modelo, e o período previsto é descrito em relação a `data_until`/`train_end`; uma previsão antiga não é apresentada como se tivesse sido gerada hoje. O WAPE dos dias 1–7 é exibido separadamente do erro dos dias 8–14. A escolha de 7 ou 14 dias altera os totais e o horizonte mostrado no gráfico.

404 de previsão significa que ela ainda não foi gerada: o site informa a ausência e mantém os indicadores e históricos disponíveis. 403 preserva a sessão e exibe a explicação do backend, inclusive sobre acesso ao plano. A seção **Confiança da previsão** consulta avaliações e execuções somente quando expandida. Gráficos têm valores acessíveis em tabela e suporte a teclado.

**Exportar relatório** baixa JSON com os 16 relatórios antigos, analytics e previsões. Relatórios antigos paginados são percorridos até o fim. O arquivo registra o período, o recorte e a seleção de previsão no momento do clique; previsões ausentes por 404 ficam marcadas como `unavailable`, sem gerar valores simulados. Erros de transporte, validação ou acesso impedem o download. O histórico de estoque de um produto é incluído quando o recorte selecionado é produto. O relatório antigo por filial nunca recebe `filial_id`.

### Usuários e pendências do backend

`GET /users` alimenta a tela de equipe, respeitando as lojas acessíveis conforme a API. **Convidar usuário** abre o cadastro de uma conta com nome completo, login, e-mail, senha inicial e confirmação de senha. Perfis e filiais são lidos de `GET /users/groups` e `GET /companies`; só são oferecidas filiais presentes em `accessible_filial_ids` da sessão, com a filial atual pré-selecionada. É obrigatório escolher pelo menos um perfil e uma filial.

O cadastro envia `POST /users` com apenas `full_name`, `username`, `email`, `password`, `group_ids` e `filial_ids`, sem senha de confirmação nem flags de administrador. O login aceita 3–60 letras ASCII, números, pontos, hífens e sublinhados; a senha aceita 6–72 caracteres e é enviada sem remover espaços. O formulário bloqueia envios repetidos, mantém os dados quando a API rejeita o cadastro e permite recarregar as opções. Cancelar não cria a conta. Após o sucesso, a janela fecha, a busca é limpa e a equipe é recarregada com a confirmação do cadastro. A autorização para criar usuários e atribuir perfis continua sendo validada no backend; erros 403 são exibidos sem encerrar a sessão.

Apesar do nome do botão, a API cria a conta diretamente com a senha informada: não há envio de convite por e-mail. Senhas de novos usuários não são salvas no armazenamento do navegador. A criação foi validada com respostas HTTP simuladas nos testes; nenhuma conta de teste foi criada no servidor compartilhado. O chat continua indisponível, e a API ainda não oferece exclusão de categorias.

O contrato atual de `/auth/me` e `/users` inclui `password_hash`. Os adaptadores do site descartam esse campo antes de guardar a conta na sessão ou alimentar as tabelas. **O backend também deve removê-lo das respostas HTTP**; o descarte no cliente não elimina a exposição na rede.

## Validação

```powershell
$env:CI = 'true'
npm test -- --watchAll=false --runInBand --cacheDirectory=.cache/jest
npm run build
```

Os testes usam respostas simuladas no contrato HTTP para verificar os cadastros existentes, autenticação, sessão, filial, erros, paginação, filtros, percentuais fracionários, datas de negócio, previsões ausentes, atualização com falha, exportação e o contrato estrito das vendas online. As leituras do servidor real complementam essa validação sem registrar vendas de teste no ambiente compartilhado.

## Organização

- `src/api/client.js`: configuração, transporte HTTP, token, timeout e erros.
- `src/api/auth.js` e `src/auth/AuthContext.js`: autenticação e ciclo da sessão.
- `src/api/resources.js`: listagens paginadas e enriquecimento de produtos.
- `src/api/dashboard.js`: indicadores e relatórios.
- `src/api/analytics.js`: os seis endpoints de analytics e os seis de previsões.
- `src/components/AnalyticsReports.js`, `AnalyticsWidgets.js` e `ForecastPanel.js`: filtros, gráficos e avaliações.
- `src/components/OrderForm.js` e `OrderDetails.js`: criação online e detalhamento dos valores líquidos.
- `src/hooks/useApiQuery.js`: carregamento, cancelamento e nova tentativa.
- `src/utils/dashboard.js`: formatação, períodos, gráfico e download.

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
