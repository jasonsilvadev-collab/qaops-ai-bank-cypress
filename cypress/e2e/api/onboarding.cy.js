describe('API - Fluxo de Registro de Usuário guiado pelo Google Gemini', () => {

  const REQRES_REGISTER_URL = 'https://reqres.in/api/register';
  /** ReqRes devolve 429 sob rate limit; repetir com backoff antes de falhar o teste. */
  const RATE_LIMIT_RETRIES = 4;
  const RATE_LIMIT_BACKOFF_MS = [800, 1600, 3200, 5000];

  function postRegisterComRetry(cenario, reqresHeaders, attempt = 0) {
    cy.request({
      method: 'POST',
      url: REQRES_REGISTER_URL,
      failOnStatusCode: false,
      body: {
        email: cenario.email,
        password: cenario.password ?? '',
      },
      headers: reqresHeaders,
    }).then((response) => {
      if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
        cy.wait(RATE_LIMIT_BACKOFF_MS[attempt] ?? 2000);
        postRegisterComRetry(cenario, reqresHeaders, attempt + 1);
        return;
      }

      expect(
        response.status,
        `status (tentativa ${attempt + 1}; 429=rate limit ReqRes)`
      ).to.eq(cenario.statusCodeEsperado);

      if (cenario.statusCodeEsperado === 200) {
        expect(response.body).to.have.property('token').that.is.a('string');
      }

      if (cenario.statusCodeEsperado === 400) {
        expect(response.body).to.have.property('error');
      }
    });
  }

  it('Deve gerar cenários dinâmicos e validar o comportamento da API reqres.in', () => {
    const reqresKey = Cypress.env('REQRES_API_KEY');
    if (!reqresKey) {
      throw new Error(
        'Defina REQRES_API_KEY (header x-api-key do ReqRes). Chave gratuita: https://app.reqres.in/api-keys — no CI, use o secret REQRES_API_KEY.'
      );
    }

    const reqresHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': reqresKey,
      'X-Reqres-Env': 'prod',
    };

    cy.task('gerarMassaDeDadosRegistro').then((cenariosGerados) => {
      expect(cenariosGerados).to.be.an('array').that.is.not.empty;

      cy.wait(500);

      cenariosGerados.forEach((cenario, index) => {
        cy.log(`Cenário IA: ${cenario.titulo}`);
        if (index > 0) {
          cy.wait(750);
        }
        postRegisterComRetry(cenario, reqresHeaders);
      });
    });
  });
});