describe('API - Fluxo de Registro de Usuário guiado pelo Google Gemini', () => {

  it('Deve gerar cenários dinâmicos e validar o comportamento da API reqres.in', () => {
    
    // O Cypress pede à IA do Google para gerar os cenários
    cy.task('gerarMassaDeDadosRegisto').then((cenariosGerados) => {
      expect(cenariosGerados).to.be.an('array').that.is.not.empty;

      // Para cada cenário que o Gemini inventou, executamos um teste
      cenariosGerados.forEach((cenario) => {
        cy.log(`Cenário IA: ${cenario.titulo}`);

        cy.request({
          method: 'POST',
          url: 'https://reqres.in/api/register',
          failOnStatusCode: false, // Permite que a API devolva Erro 400 sem quebrar o teste
          body: {
            email: cenario.email,
            password: cenario.password
          },
          headers: { 'Content-Type': 'application/json' }
        }).then((response) => {
          
          // Valida se o status real devolvido bate com o previsto pelo Gemini
          expect(response.status).to.eq(cenario.statusCodeEsperado);
          
          // Se for 200 (Sucesso), a API devolve um Token
          if (cenario.statusCodeEsperado === 200) {
            expect(response.body).to.have.property('token').that.is.a('string');
          }
          
          // Se for 400 (Erro), a API devolve uma mensagem de erro
          if (cenario.statusCodeEsperado === 400) {
            expect(response.body).to.have.property('error');
          }
        });
      });
    });
  });
}); 