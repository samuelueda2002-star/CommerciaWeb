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
| Vendas | Pedidos, clientes, totais do mês excluindo cancelados, busca e filtro de status |
| Dashboard e relatórios | Chamadas preparadas para os indicadores e os 16 relatórios documentados, seleção de período e exportação JSON |

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

As listagens percorrem a paginação da API (`items`, `total`, `limit`, `offset`). Os totais da tela de vendas e as contagens por cliente/categoria usam a lista completa da filial. Não há substituição por dados fictícios quando uma chamada falha.

## Estado do backend verificado em 15/10/2026

O OpenAPI publicado em `http://168.75.100.157/openapi.json` disponibiliza autenticação, catálogo, clientes e pedidos. O login e essas listagens foram consultados com sucesso. A filial acessível estava sem registros. O preflight CORS para `http://localhost:3000` também foi aceito.

As rotas `GET /api/v1/dashboard/indicators` e `GET /api/v1/dashboard/reports/sales-summary` retornaram **404**, mesmo com autenticação válida. Não há rotas `/dashboard` no OpenAPI publicado. Essas telas exibem indisponibilidade e permitem tentar novamente; a validação real dos gráficos, métricas e exportação depende da publicação das rotas no backend.

Os adaptadores de relatórios usam os campos descritos no PDF: `last_7_days` com `date`/`total`, resumo com `total_revenue`/`average_ticket`/`cancellation_rate`, categorias com `quantity_sold` e comparação com `revenue_change_pct`. Para o relatório por dia da semana, o adaptador assume `weekday` numérico de 0 (segunda) a 6 (domingo) e `total` ou `total_revenue`. Esses formatos precisam ser confirmados no OpenAPI da versão que publicar os relatórios; campos ausentes aparecem como “—”.

O seletor existente considera “Esta semana” como os últimos sete dias, incluindo hoje, e “Semana anterior” como os sete dias anteriores a esse intervalo. A comparação sempre envia `start_date` e `end_date`. O relatório por filial nunca recebe `filial_id`. O botão de exportação baixa um JSON com os 16 relatórios; se qualquer chamada falhar, informa o erro e não gera um arquivo incompleto. Relatórios de estoque e inatividade usam seus próprios parâmetros (`threshold=5`, `days=30`); a tendência de clientes usa `days=7`.

A API publicada não possui rotas de chat nem de administração de usuários. A tela de usuários mostra apenas a conta autenticada, e o chat informa indisponibilidade. Os botões de nova venda e convite continuam sem fluxo de cadastro e ficam desabilitados. Os cadastros de clientes, produtos e categorias estão disponíveis por **Novo cliente**, **Novo produto** e **Nova categoria**. Não foram criados, pagos, cancelados ou alterados registros no servidor durante a validação.

## Validação

```powershell
$env:CI = 'true'
npm test -- --watchAll=false --runInBand
npm run build
```

Os testes usam respostas simuladas no contrato HTTP para verificar autenticação, sessão, filial, erros, paginação, filtros, totais, períodos, exportação e cancelamento de requisições. A validação com o servidor real foi feita por HTTP; não havia navegador conectado para uma verificação visual interativa.

## Organização

- `src/api/client.js`: configuração, transporte HTTP, token, timeout e erros.
- `src/api/auth.js` e `src/auth/AuthContext.js`: autenticação e ciclo da sessão.
- `src/api/resources.js`: listagens paginadas e enriquecimento de produtos.
- `src/api/dashboard.js`: indicadores e relatórios.
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
