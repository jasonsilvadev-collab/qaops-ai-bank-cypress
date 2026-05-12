require("dotenv").config();
const {defineConfig} = require("cypress");
const {GoogleGenerativeAI} = require("@google/generative-ai");

const REQRES_REGISTER_URL = "https://reqres.in/api/register";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postRegisterOnce(body, apiKey) {
  const res = await fetch(REQRES_REGISTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "X-Reqres-Env": "prod",
    },
    body: JSON.stringify(body),
  });
  let json = {};
  try {
    json = await res.json();
  } catch (_) {
    /* corpo vazio ou não-JSON */
  }
  return { status: res.status, body: json };
}

/** Orçamento máximo para ReqRes dentro da task (evita ultrapassar o timeout do Cypress). */
const REQRES_TASK_BUDGET_MS =
  Number(process.env.REQRES_TASK_BUDGET_MS) || 90000;

async function postRegisterComBackoff(body, apiKey, aggressive, deadlineMs) {
  const delaysMs = aggressive
    ? [800, 2000, 5000, 12000, 25000]
    : [500, 2000, 6000];

  let out = await postRegisterOnce(body, apiKey);
  if (out.status !== 429) {
    return out;
  }
  for (const ms of delaysMs) {
    const now = Date.now();
    if (now >= deadlineMs) {
      return out;
    }
    const wait = Math.min(ms, deadlineMs - now);
    if (wait < 400) {
      return out;
    }
    await sleep(wait);
    out = await postRegisterOnce(body, apiKey);
    if (out.status !== 429) {
      return out;
    }
  }
  return out;
}

// Inicializar o cliente do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = defineConfig({
  e2e: {
    // Margem sobre REQRES_TASK_BUDGET_MS + esperas entre cenários + rede
    taskTimeout: Math.min(
      900000,
      REQRES_TASK_BUDGET_MS + 120000
    ),
    // Repositório de variáveis expostas em Cypress.env(...) nos specs
    env: {
      REQRES_API_KEY: process.env.REQRES_API_KEY || "",
    },
    setupNodeEvents(on, config){
      async function gerarMassaDeDadosRegistro() {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error(
            "GEMINI_API_KEY não definida. Crie um ficheiro .env na raiz do projeto com GEMINI_API_KEY=..."
          );
        }
        try {
          // gemini-1.5-flash devolve 404 na API atual; usar modelo estável documentado em ai.google.dev
          const modelId =
            process.env.GEMINI_MODEL || "gemini-2.5-flash";
          const model = genAI.getGenerativeModel({ model: modelId });
          const prompt = `Você é um QA Engineer Sênior. Retorne APENAS um array JSON válido, sem formatação markdown (sem aspas crases ou a palavra json).
            Gere exatamente 3 cenários de teste para POST https://reqres.in/api/register (JSON body: email, password).
            Cada objeto deve ter: 'titulo' (string), 'email' (string), 'password' (string), 'statusCodeEsperado' (number).
            Regras obrigatórias:
            - Para exatamente UM cenário com statusCodeEsperado 200 (sucesso), use SEMPRE email "eve.holt@reqres.in" e password "pistol" (único par que o mock ReqRes devolve token).
            - Para os outros cenários com statusCodeEsperado 400, use password vazia "" ou omita o campo password no JSON do cenário (o cliente de teste enviará string vazia), e email pode ser "eve.holt@reqres.in" ou outro formato inválido.
            Não use status 401 nos cenários gerados.`;
          const result = await model.generateContent(prompt);
          const responseText = result.response.text();
          const cleanJson = responseText.replace(/```json|```/g, "").trim();
          return JSON.parse(cleanJson);
        } catch (error) {
          console.error("Erro na integração com o Gemini", error);
          throw error;
        }
      }

      async function executarCenariosRegistoReqres({ cenarios }) {
        const apiKey = process.env.REQRES_API_KEY;
        if (!apiKey) {
          throw new Error(
            "REQRES_API_KEY em falta no processo Node (defina no .env ou no CI)."
          );
        }
        if (!Array.isArray(cenarios) || cenarios.length === 0) {
          throw new Error("cenarios deve ser um array não vazio");
        }
        const deadline = Date.now() + REQRES_TASK_BUDGET_MS;
        // Cenário 200 primeiro (token) — tende a ser o mais sensível ao rate limit
        const sorted = [...cenarios].sort((a, b) => {
          if (a.statusCodeEsperado === 200 && b.statusCodeEsperado !== 200) {
            return -1;
          }
          if (b.statusCodeEsperado === 200 && a.statusCodeEsperado !== 200) {
            return 1;
          }
          return 0;
        });

        const results = [];
        for (let i = 0; i < sorted.length; i++) {
          const cenario = sorted[i];
          if (i > 0) {
            const gap = Math.min(2500, Math.max(0, deadline - Date.now()));
            if (gap >= 400) {
              await sleep(gap);
            }
          }
          const body = {
            email: cenario.email,
            password: cenario.password ?? "",
          };
          const aggressive = cenario.statusCodeEsperado === 200;
          const { status, body: resBody } = await postRegisterComBackoff(
            body,
            apiKey,
            aggressive,
            deadline
          );
          results.push({
            titulo: cenario.titulo,
            statusCodeEsperado: cenario.statusCodeEsperado,
            statusRecebido: status,
            body: resBody,
          });
        }
        return results;
      }

      on("task", {
        gerarMassaDeDadosRegistro,
        gerarMassaDeDadosRegisto: gerarMassaDeDadosRegistro,
        executarCenariosRegistoReqres,
      });
      return config;
    }
  }
})




