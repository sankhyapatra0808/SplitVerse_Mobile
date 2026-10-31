// Safe, read-only SplitVerse staging load test (k6, no Node/npm packages required).
// Use disposable Firebase test-user ID tokens only; see performance/README.md.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const base = (__ENV.SPLITVERSE_STAGING_URL || 'http://localhost:5000').replace(/\/+$/, '');
const tokens = (__ENV.SPLITVERSE_TEST_TOKENS || '').split(',').map((token) => token.trim()).filter(Boolean);
const parsedHost = /^https?:\/\/([^/:?#]+)/i.exec(base);
if (!parsedHost) throw new Error('SPLITVERSE_STAGING_URL must be an http(s) URL.');
const targetHost = parsedHost[1].toLowerCase();
const knownProductionHosts = ['splitverse-api.onrender.com', 'split-verse.vercel.app'];
if (knownProductionHosts.includes(targetHost)) {
  throw new Error('Refusing known SplitVerse production host. Use a separate local/staging deployment.');
}
if (!['localhost', '127.0.0.1', '10.0.2.2'].includes(targetHost) && __ENV.SPLITVERSE_STAGING_CONFIRMED !== 'YES') {
  throw new Error('For a remote staging host explicitly set SPLITVERSE_STAGING_CONFIRMED=YES.');
}
if (tokens.length === 0) {
  throw new Error('SPLITVERSE_TEST_TOKENS must contain disposable staging Firebase ID token(s).');
}

const failed = new Rate('workflow_failed');
const maxVus = Number(__ENV.SPLITVERSE_MAX_VUS || 30);
if (!Number.isSafeInteger(maxVus) || maxVus < 1 || maxVus > 200) {
  throw new Error('SPLITVERSE_MAX_VUS must be between 1 and 200.');
}

export const options = {
  scenarios: {
    readOnlyTraffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.min(maxVus, 5) },
        { duration: '1m', target: Math.min(maxVus, 10) },
        { duration: '2m', target: maxVus },
        { duration: '1m', target: maxVus },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    workflow_failed: ['rate<0.01'],
  },
};

function read(path, token, name) {
  const response = http.get(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    tags: { workflow: name },
    timeout: '20s',
  });
  const success = check(response, { [`${name}: success`]: (res) => res.status === 200 });
  failed.add(!success);
  sleep(0.3 + Math.random() * 0.5);
}

export default function () {
  const token = tokens[(__VU - 1) % tokens.length];
  group('Session initialization', () => read('/api/auth/me', token, 'session'));
  group('Dashboard', () => read('/api/dashboard/summary', token, 'dashboard'));
  group('Rooms', () => {
    read('/api/split-rooms', token, 'rooms');
    read('/api/split-rooms/net-settlements', token, 'net-settlements');
  });
  group('Wallet and history', () => {
    read('/api/wallet/summary', token, 'wallet');
    read('/api/transactions', token, 'transactions');
  });
  group('Friends', () => read('/api/friends', token, 'friends'));
  sleep(1 + Math.random() * 2);
}
