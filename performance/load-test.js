import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

/** ReqRes aplica rate limits / WAF; 50 VUs geram ~94% de falhas (429/403). Carga leve + pausa entre iterações. */
export function setup() {
  if (!__ENV.REQRES_API_KEY) {
    exec.test.abort(
      'REQRES_API_KEY em falta. Sem x-api-key o ReqRes devolve 401. Adicione o secret no GitHub Actions.'
    );
  }
}

export const options = {
  stages: [
    { duration: '30s', target: 2 },
    { duration: '60s', target: 5 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  const url = 'https://reqres.in/api/register';
  const payload = JSON.stringify({ email: 'eve.holt@reqres.in', password: 'pistol' });
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': __ENV.REQRES_API_KEY,
    'X-Reqres-Env': 'prod',
  };
  const params = { headers };

  const res = http.post(url, payload, params);

  check(res, {
    'status é 200': (r) => r.status === 200,
    'tempo de resposta < 800ms': (r) => r.timings.duration < 800,
  });

  sleep(2);
}