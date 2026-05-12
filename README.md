# QAOps AI Bank — Cypress, Gemini e K6

Projeto de demonstração de **QAOps**: testes de API com **Cypress**, cenários de teste gerados dinamicamente pelo **Google Gemini**, execução contra a API pública **ReqRes** e um segundo estágio de **testes de carga com K6**. O pipeline no **GitHub Actions** corre Cypress e, em seguida, K6 em cada push para `main`.

---

## O que o projeto faz

| Camada | Descrição |
|--------|-----------|
| **Cypress (E2E/API)** | Spec em `cypress/e2e/api/onboarding.cy.js`: pede ao Gemini uma lista de cenários (email, password, status esperado), executa `POST /api/register` no ReqRes e valida respostas quando o HTTP coincide com o esperado. |
| **Google Gemini** | Integração em Node (`cypress.config.js`) via `@google/generative-ai`: task `gerarMassaDeDadosRegistro` gera JSON de cenários; task `executarCenariosRegistoReqres` faz os pedidos HTTP com retries e limite de tempo (rate limit do ReqRes). |
| **ReqRes** | API de exemplo (`https://reqres.in`). A documentação atual exige **`x-api-key`** e recomenda **`X-Reqres-Env`**. Chave gratuita: [app.reqres.in → API keys](https://app.reqres.in/api-keys). |
| **K6** | Script em `performance/load-test.js`: carga leve sobre o mesmo endpoint de registo, com thresholds tolerantes a falhas HTTP ocasionais (ex.: 429 em CI). |
| **CI** | Workflow `.github/workflows/pipeline.yml`: `npm ci` → Cypress (`cypress-io/github-action`) → K6 (`grafana/k6-action`). |

### Comportamento dos testes Cypress e ReqRes

- Sem **`REQRES_API_KEY`**, o teste falha de propósito (falta autenticação no ReqRes).
- **429** (rate limit) ou **status diferente do esperado pela IA**: o spec **regista aviso no log** e **não falha** o teste — útil para pipelines estáveis com serviços externos.
- Quando o status **bate com o cenário** (200 ou 400), o corpo é validado (`token` ou `error`).

---

## Pré-requisitos

- **Node.js** 18+ (recomendado LTS)
- Conta Google AI / chave **Gemini API**: [Google AI Studio](https://aistudio.google.com/apikey)
- Chave **ReqRes**: [Obter API key](https://app.reqres.in/api-keys)
- Para testes de carga locais: [**k6** instalado](https://grafana.com/docs/k6/latest/set-up/install-k6/) (`brew install k6` no macOS)

---

## Configuração local

1. Clone o repositório e instale dependências:

   ```bash
   npm ci
   ```

2. Copie o exemplo de variáveis e preencha:

   ```bash
   cp .env.example .env
   ```

3. Edite `.env`:

   | Variável | Obrigatório | Descrição |
   |----------|-------------|-----------|
   | `GEMINI_API_KEY` | Sim (Cypress com IA) | Chave da API Gemini |
   | `REQRES_API_KEY` | Sim | Header `x-api-key` do ReqRes |
   | `GEMINI_MODEL` | Não | Modelo (predefinido `gemini-2.5-flash`) |
   | `REQRES_TASK_BUDGET_MS` | Não | Tempo máximo (ms) para pedidos ReqRes na task Node (predefinido ~90000) |

O ficheiro `.env` é carregado por `dotenv` no `cypress.config.js`. Está listado no `.gitignore` — **nunca commite chaves**.

---

## Como correr

### Cypress — modo interativo

```bash
npm run cypress:open
```

Escolha **E2E** e o spec `cypress/e2e/api/onboarding.cy.js`.

### Cypress — modo headless (CI local)

Todos os testes:

```bash
npm run cypress:run
```

Só o fluxo API / Gemini:

```bash
npm run cypress:run:api
```

### K6 (carga)

Com a mesma variável de ambiente:

```bash
export REQRES_API_KEY="sua_chave_reqres"
k6 run performance/load-test.js
```

---

## GitHub Actions

No repositório, configure **Secrets**:

| Secret | Uso |
|--------|-----|
| `GEMINI_API_KEY` | Task Gemini no Cypress |
| `REQRES_API_KEY` | Cypress + K6 |

O workflow dispara em **push** para a branch **`main`**.

---

## Estrutura de pastas

```
├── .github/workflows/pipeline.yml   # CI: Cypress + K6
├── cypress.config.js                # Cypress + tasks Node (Gemini, ReqRes)
├── cypress/
│   ├── e2e/api/onboarding.cy.js     # Spec principal (API + IA)
│   ├── fixtures/
│   └── support/
├── performance/load-test.js         # Script K6
├── .env.example                     # Modelo de variáveis (sem segredos)
└── package.json
```

---

## Resolução de problemas

| Sintoma | O que verificar |
|---------|------------------|
| Erro de modelo Gemini (404) | Atualize `GEMINI_MODEL` para um modelo listado na [documentação Gemini](https://ai.google.dev/gemini-api/docs/models/gemini). |
| `401` no ReqRes | Confirme `REQRES_API_KEY` e headers no código de task / K6. |
| `429` constante | Rate limit do ReqRes ou IP partilhado no CI; os testes Cypress foram desenhados para não falhar apenas por isso. Reduza paralelismo ou espaçe execuções. |
| Timeout da `cy.task` | Ajuste `REQRES_TASK_BUDGET_MS` ou `taskTimeout` derivado em `cypress.config.js`. |

---

## Licença

ISC (conforme `package.json`).
