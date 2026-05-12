import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Sobe para 50 usuários virtuais
    { duration: '1m', target: 50 },   // Mantém por 1 minuto
    { duration: '30s', target: 0 },   // Desce para 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<600'], // 95% dos pedidos devem responder em menos de 600ms
    http_req_failed: ['rate<0.01'],   // Falhas devem ser menores que 1%
  },
};

export default function () {
  const url = 'https://reqres.in/api/register';
  const payload = JSON.stringify({ email: 'eve.holt@reqres.in', password: 'pistol' });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(url, payload, params);

  check(res, {
    'status é 200': (r) => r.status === 200,
    'tempo de resposta < 600ms': (r) => r.timings.duration < 600,
  });

  sleep(1); 
}