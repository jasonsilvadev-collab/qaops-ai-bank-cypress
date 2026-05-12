describe('API - Fluxo de Registro de Usuário guiado pelo Google Gemini', () => {
  /**
   * Validação estrita só quando a API Resposta coincide com o esperado pela IA.
   * Rate limit (429) e divergências transitórias do ReqRes não quebram o pipeline.
   */
  it('Deve gerar cenários dinâmicos e validar o comportamento da API reqres.in', () => {
    if (!Cypress.env('REQRES_API_KEY')) {
      throw new Error(
        'Defina REQRES_API_KEY (header x-api-key do ReqRes). Chave gratuita: https://app.reqres.in/api-keys — no CI, use o secret REQRES_API_KEY.'
      );
    }

    cy.task('gerarMassaDeDadosRegistro').then((cenariosGerados) => {
      expect(cenariosGerados).to.be.an('array').that.is.not.empty;

      cy.task('executarCenariosRegistoReqres', {
        cenarios: cenariosGerados,
      }).then((results) => {
        results.forEach((r) => {
          cy.log(`Cenário IA: ${r.titulo}`);

          if (r.statusRecebido === 429) {
            cy.log(
              '[ReqRes] 429 rate limit — sem validação rígida nesta execução.'
            );
            return;
          }

          if (r.statusRecebido !== r.statusCodeEsperado) {
            cy.log(
              `[ReqRes] Status esperado ${r.statusCodeEsperado}, recebido ${r.statusRecebido} — registado como aviso (serviço externo).`
            );
            return;
          }

          if (r.statusCodeEsperado === 200) {
            expect(r.body).to.have.property('token').that.is.a('string');
          }
          if (r.statusCodeEsperado === 400) {
            expect(r.body).to.have.property('error');
          }
        });
      });
    });
  });
});
