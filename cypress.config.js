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

/**
 * ReqRes em CI (IPs partilhados) devolve muito 429. Retries no Node não competem
 * com o timeout de comandos do Cypress e permitem esperas longas.
 */
async function postRegisterComBackoff(body, apiKey, aggressive) {
  const delaysMs = aggressive
    ? [4000, 12000, 22000, 35000, 50000, 70000]
    : [2000, 6000, 14000];

  let out = await postRegisterOnce(body, apiKey);
  if (out.status !== 429) {
    return out;
  }
  for (const ms of delaysMs) {
    await sleep(ms);
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
    taskTimeout: 240000,
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
            await sleep(3000);
          }
          const body = {
            email: cenario.email,
            password: cenario.password ?? "",
          };
          const aggressive = cenario.statusCodeEsperado === 200;
          const { status, body: resBody } = await postRegisterComBackoff(
            body,
            apiKey,
            aggressive
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




