require("dotenv").config();
const {defineConfig} = require("cypress");
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Inicializar o cliente do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = defineConfig({
  e2e:{
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
            Gere 3 cenários de teste para uma API de Registro de Usuários. A API exige e-mails válidos como 'eve.holt@reqres.in'. O JSON deve ter os campos: 'titulo' (string), 'email' (string), 'password' (string, deixe vazia para forçar erro) e 'statusCodeEsperado' (number, 200 para sucesso com dados completos, 400 para erro se faltar a password).`;
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




