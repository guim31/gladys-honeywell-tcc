// -----------------------------------------------------------------------------
// The HTTP client of the portal, against the fake portal: login and its
// refusals, session expiry, the location list, the commands, the cookies.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TccClient, AUTH_COOKIE, parseSetCookie } from '../src/tcc/client.js';
import { PASSWORD, USERNAME, createFakePortal } from './helpers/fakePortal.js';

const clientOf = (portal) => new TccClient({ fetch: portal.fetch, baseUrl: 'https://tcc.test' });

test('a good login holds the authentication cookie despite its malformed expiry', async () => {
  const portal = createFakePortal();
  const client = clientOf(portal);
  await client.login(USERNAME, PASSWORD);
  assert.equal(client.hasSession(), true);
  assert.equal(client.exportCookies()[AUTH_COOKIE], 'TOKEN1');
  // The form post carries the credentials in its body, never in the URL.
  const post = portal.requests.find((r) => r.method === 'POST' && r.path === '/portal');
  assert.equal(post.search, '');
  assert.match(post.body, /UserName=someone%40example\.com/);
});

test('a refused login is a credentials error, even with a page mentioning locks', async () => {
  const client = clientOf(createFakePortal());
  await assert.rejects(client.login(USERNAME, 'wrong'), { kind: 'credentials' });
  assert.equal(client.hasSession(), false);
});

test('a lock message in the error summary is a locked account', async () => {
  const client = clientOf(createFakePortal({ login: 'locked' }));
  await assert.rejects(client.login(USERNAME, PASSWORD), { kind: 'locked' });
});

test('an answer that is neither a session nor a refusal is an unclear login', async () => {
  const client = clientOf(createFakePortal({ login: 'unclear' }));
  await assert.rejects(client.login(USERNAME, PASSWORD), { kind: 'login' });
});

test('a portal that does not answer is a portal error, not a refused password', async () => {
  const portal = createFakePortal();
  portal.down = true;
  await assert.rejects(clientOf(portal).login(USERNAME, PASSWORD), {
    kind: 'portal',
    message: '/portal: ECONNREFUSED',
  });
  portal.down = false;
  portal.serverError = true;
  await assert.rejects(clientOf(portal).login(USERNAME, PASSWORD), { kind: 'portal' });
});

test('the location list is read page by page until an empty page', async () => {
  const portal = createFakePortal();
  const client = clientOf(portal);
  await client.login(USERNAME, PASSWORD);
  const locations = await client.getLocations();
  assert.deepEqual(
    locations.map((l) => l.LocationID),
    [7654321, 7654322],
  );
  const pages = portal.requests.filter((r) => r.path.includes('GetLocationListData'));
  assert.deepEqual(
    pages.map((r) => r.search),
    ['?page=1&filter=', '?page=2&filter='],
  );
});

test('an expired session is told apart: redirect to the login page', async () => {
  const portal = createFakePortal();
  const client = clientOf(portal);
  await client.login(USERNAME, PASSWORD);
  portal.expireSessions();
  await assert.rejects(client.getThermostat(1234567), { kind: 'session' });
});

test('the login page served instead of JSON is an expired session too', async () => {
  const client = new TccClient({
    baseUrl: 'https://tcc.test',
    fetch: async () =>
      new Response('<html><form action="/portal">login</form></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
  });
  await assert.rejects(client.getLocations(), { kind: 'session' });
});

test('a command sends every field, null meaning unchanged, and checks the answer', async () => {
  const portal = createFakePortal();
  const client = clientOf(portal);
  await client.login(USERNAME, PASSWORD);
  await client.submitChanges('1234567', { HeatSetpoint: 62 });
  assert.deepEqual(portal.commands, [
    {
      DeviceID: 1234567,
      SystemSwitch: null,
      HeatSetpoint: 62,
      CoolSetpoint: null,
      HeatNextPeriod: null,
      CoolNextPeriod: null,
      StatusHeat: null,
      StatusCool: null,
      FanMode: null,
    },
  ]);
  portal.rejectCommands = true;
  await assert.rejects(client.submitChanges('1234567', { HeatSetpoint: 63 }), {
    kind: 'rejected',
  });
});

test('thermostat data without uiData is a portal error', async () => {
  const portal = createFakePortal();
  const client = clientOf(portal);
  await client.login(USERNAME, PASSWORD);
  await assert.rejects(client.getThermostat(999), { kind: 'portal' });
});

test('Set-Cookie: expires ignored, an empty value or Max-Age=0 deletes', () => {
  assert.deepEqual(parseSetCookie('.ASPXAUTH_TRUEHOME=ABC; expires=garbage; path=/'), {
    name: '.ASPXAUTH_TRUEHOME',
    value: 'ABC',
    expired: false,
  });
  assert.equal(parseSetCookie('a=; path=/').value, '');
  assert.equal(parseSetCookie('a=1; Max-Age=0').expired, true);
  assert.equal(parseSetCookie('broken').name, '');
});

test('cookies saved and restored skip the login', async () => {
  const portal = createFakePortal();
  const first = clientOf(portal);
  await first.login(USERNAME, PASSWORD);
  const second = clientOf(portal);
  second.importCookies(first.exportCookies());
  await second.getThermostat(1234567);
  assert.equal(portal.logins, 1);
});
