describe('API - Fluxo de Registro de Usuário guiado pelo Google Gemini', () => {
  it('Deve gerar cenários dinâmicos e validar o comportamento da API reqres.in', function () {
    if (!Cypress.env('REQRES_API_KEY')) {
      throw new Error(
        'Defina REQRES_API_KEY (header x-api-key do ReqRes). Chave gratuita: https://app.reqres.in/api-keys — no CI, use o secret REQRES_API_KEY.'
      );
    }

    cy.task('gerarMassaDeDadosRegistro').then((cenariosGerados) => {
      expect(cenariosGerados).to.be.an('array').that.is.not.empty;

      cy.task('executarCenariosRegistoReqres', {
        cenarios: cenariosGerados,
      }).then(function (results) {
        const rateLimitedSucesso = results.some(
          (r) =>
            r.statusRecebido === 429 && r.statusCodeEsperado === 200
        );
        if (rateLimitedSucesso) {
          cy.log(
            'ReqRes manteve 429 após backoff longo (task Node). Ignorar nesta execução — limite do serviço.'
          );
          this.skip();
        }

        results.forEach((r) => {
          cy.log(`Cenário IA: ${r.titulo}`);
          expect(
            r.statusRecebido,
            `${r.titulo} — status HTTP`
          ).to.eq(r.statusCodeEsperado);

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
