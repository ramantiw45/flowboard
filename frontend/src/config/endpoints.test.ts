import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCsp, connectSources, DEFAULT_API_BASE_URL, resolveEndpoints } from './endpoints.ts';

test('falls back to localhost:8080 when nothing is configured', () => {
  const { apiBaseUrl, wsUrl } = resolveEndpoints({});
  assert.equal(apiBaseUrl, DEFAULT_API_BASE_URL);
  assert.equal(wsUrl, 'http://localhost:8080/ws-board');
});

test('derives the websocket url from the api url', () => {
  const { wsUrl } = resolveEndpoints({ VITE_API_BASE_URL: 'https://api.example.com/api' });
  // SockJS is given an http(s) URL and picks the ws transport itself, so the
  // scheme is preserved rather than rewritten.
  assert.equal(wsUrl, 'https://api.example.com/ws-board');
});

test('an explicit websocket url wins over the derived one', () => {
  const { wsUrl } = resolveEndpoints({
    VITE_API_BASE_URL: 'https://api.example.com/api',
    VITE_WS_URL: 'wss://realtime.example.com/ws-board',
  });
  assert.equal(wsUrl, 'wss://realtime.example.com/ws-board');
});

test('strips trailing slashes so axios does not join //auth/login', () => {
  const { apiBaseUrl, wsUrl } = resolveEndpoints({
    VITE_API_BASE_URL: 'https://api.example.com/api/',
    VITE_WS_URL: 'wss://api.example.com/ws-board/',
  });
  assert.equal(apiBaseUrl, 'https://api.example.com/api');
  assert.equal(wsUrl, 'wss://api.example.com/ws-board');
});

test('resolves a relative api url against the serving origin', () => {
  const { apiBaseUrl, wsUrl } = resolveEndpoints({ VITE_API_BASE_URL: '/api' }, 'https://app.example.com');
  assert.equal(apiBaseUrl, '/api');
  assert.equal(wsUrl, 'https://app.example.com/ws-board');
});

test('connect-src covers both the http and ws form of every origin', () => {
  const sources = connectSources('https://api.example.com/api', 'wss://api.example.com/ws-board').split(' ');
  assert.deepEqual(sources.sort(), ['https://api.example.com', 'wss://api.example.com']);
});

test('connect-src covers a websocket on a different host than the api', () => {
  const sources = connectSources('https://api.example.com/api', 'wss://realtime.example.com/ws-board').split(' ');
  assert.ok(sources.includes('https://api.example.com'));
  assert.ok(sources.includes('wss://api.example.com'));
  assert.ok(sources.includes('wss://realtime.example.com'));
});

test('connect-src keeps the default localhost origin, as before', () => {
  const { apiBaseUrl, wsUrl } = resolveEndpoints({});
  assert.equal(connectSources(apiBaseUrl, wsUrl), 'http://localhost:8080 ws://localhost:8080');
});

test('the csp is built from the endpoints, not a hardcoded list', () => {
  const csp = buildCsp('https://api.example.com/api', 'wss://api.example.com/ws-board');
  assert.ok(csp.includes("connect-src 'self' https://api.example.com wss://api.example.com"));
  // The regression this module exists to prevent: a stale localhost origin.
  assert.ok(!csp.includes('localhost:8080'));
  assert.ok(csp.includes("frame-ancestors 'none'"));
});

test('the meta copy drops frame-ancestors, which a browser ignores there', () => {
  const csp = buildCsp('http://localhost:8080/api', 'http://localhost:8080/ws-board', { meta: true });
  assert.ok(!csp.includes('frame-ancestors'));
  assert.ok(csp.includes("connect-src 'self' http://localhost:8080 ws://localhost:8080"));
});

test('script-src stays free of unsafe-inline and unsafe-eval', () => {
  const csp = buildCsp('http://localhost:8080/api', 'http://localhost:8080/ws-board');
  const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
  assert.equal(scriptSrc, "script-src 'self'");
});

test('an endpoint that cannot be resolved at all is dropped, not fatal', () => {
  // A relative value legitimately resolves against the base origin, so the only
  // way to fail is an unusable base too. The policy must still be produced.
  assert.equal(connectSources('not a url', 'also not a url', 'also not a base'), '');
  const csp = buildCsp('not a url', 'also not a url', { currentOrigin: 'also not a base' });
  assert.ok(csp.includes("connect-src 'self'"));
  assert.ok(csp.includes("script-src 'self'"));
});

test('a relative endpoint resolves against the serving origin', () => {
  // Not an error case: '/api' is a valid same-origin deployment.
  assert.equal(connectSources('/api', '/ws-board', 'https://app.example.com'),
    'https://app.example.com wss://app.example.com');
});