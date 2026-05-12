require("dotenv").config();
const {defineConfig} = require("cypress");
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Inicializar o cliente do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = defineConfig({
  e2e: {
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

      on("task", {
        gerarMassaDeDadosRegistro,
        // alias (PT-PT) — mesmo handler
        gerarMassaDeDadosRegisto: gerarMassaDeDadosRegistro,
      });
      return config;
    }
  }
})




