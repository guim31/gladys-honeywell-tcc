// -----------------------------------------------------------------------------
// The login policy: what keeps the portal from locking the user's account.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TccClient } from '../src/tcc/client.js';
import { TccPortal } from '../src/tcc/portal.js';
import { MemorySessionStore, SessionStore } from '../src/store.js';
import { PASSWORD, USERNAME, createFakePortal } from './helpers/fakePortal.js';

function setup({
  portal = createFakePortal(),
  store = new MemorySessionStore(),
  password = PASSWORD,
} = {}) {
  const clock = { t: 1_000_000 };
  const tcc = new TccPortal({
    client: new TccClient({ fetch: portal.fetch, baseUrl: 'https://tcc.test' }),
    store,
    now: () => clock.t,
  });
  tcc.configure(USERNAME, password);
  return { portal, tcc, clock, store };
}

const read = (client) => client.getThermostat(1234567);

test('one login, then the session serves every call', async () => {
  const { portal, tcc } = setup();
  await tcc.run(read);
  await tcc.run(read);
  await tcc.run((client) => client.getLocations());
  assert.equal(portal.logins, 1);
});

test('a refused password is never tried again by itself', async () => {
  const { portal, tcc, clock } = setup({ password: 'wrong' });
  await assert.rejects(tcc.run(read), { kind: 'credentials' });
  for (let i = 0; i < 10; i += 1) {
    clock.t += 60 * 60 * 1000;
    await assert.rejects(tcc.run(read), { kind: 'credentials' });
  }
  assert.equal(portal.logins, 1);
});

test('"Test the connection" allows exactly one more attempt', async () => {
  const { portal, tcc } = setup({ password: 'wrong' });
  await assert.rejects(tcc.run(read), { kind: 'credentials' });
  tcc.reset();
  await assert.rejects(tcc.run(read), { kind: 'credentials' });
  await assert.rejects(tcc.run(read), { kind: 'credentials' });
  assert.equal(portal.logins, 2);
});

test('new credentials start over', async () => {
  const { portal, tcc } = setup({ password: 'wrong' });
  await assert.rejects(tcc.run(read), { kind: 'credentials' });
  assert.equal(tcc.configure(USERNAME, PASSWORD), true);
  await tcc.run(read);
  assert.equal(portal.logins, 2);
  assert.equal(tcc.configure(USERNAME, PASSWORD), false, 'same credentials: nothing to redo');
});

test('a locked account is left alone too', async () => {
  const { portal, tcc, clock } = setup({ portal: createFakePortal({ login: 'locked' }) });
  await assert.rejects(tcc.run(read), { kind: 'locked' });
  clock.t += 24 * 60 * 60 * 1000;
  await assert.rejects(tcc.run(read), { kind: 'locked' });
  assert.equal(portal.logins, 1);
});

test('unclear logins: one per 10 minutes, three at most', async () => {
  const { portal, tcc, clock } = setup({ portal: createFakePortal({ login: 'unclear' }) });
  await assert.rejects(tcc.run(read), { kind: 'login' });
  clock.t += 5 * 60 * 1000;
  await assert.rejects(tcc.run(read), { kind: 'throttled' });
  assert.equal(portal.logins, 1);
  clock.t += 5 * 60 * 1000;
  await assert.rejects(tcc.run(read), { kind: 'login' });
  clock.t += 10 * 60 * 1000;
  await assert.rejects(tcc.run(read), { kind: 'login' });
  assert.ok(tcc.blocked, 'stopped after three');
  clock.t += 24 * 60 * 60 * 1000;
  await assert.rejects(tcc.run(read), { kind: 'login' });
  assert.equal(portal.logins, 3);
});

test('a portal that does not answer waits a minute before the next login', async () => {
  const { portal, tcc, clock } = setup();
  portal.down = true;
  await assert.rejects(tcc.run(read), { kind: 'portal' });
  portal.down = false;
  await assert.rejects(tcc.run(read), { kind: 'throttled' });
  clock.t += 61 * 1000;
  await tcc.run(read);
  assert.equal(tcc.blocked, null);
});

test('an expired session is renewed with one login, and the call replayed', async () => {
  const { portal, tcc, clock } = setup();
  await tcc.run(read);
  clock.t += 30 * 60 * 1000;
  portal.expireSessions();
  const data = await tcc.run(read);
  assert.equal(data.success, true);
  assert.equal(portal.logins, 2);
});

test('a session refused right after its login is not renewed in a loop', async () => {
  const { portal, tcc } = setup();
  await tcc.run(read);
  portal.expireSessions();
  await assert.rejects(tcc.run(read), { kind: 'login' });
  assert.equal(portal.logins, 1);
});

test('the session survives a restart through /data, without the password', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tcc-'));
  const portal = createFakePortal();
  const first = setup({ portal, store: new SessionStore(dir) });
  await first.tcc.run(read);
  const file = join(dir, 'tcc-session.json');
  const saved = readFileSync(file, 'utf8');
  assert.ok(!saved.includes(PASSWORD), 'no password in the file');
  assert.ok(!saved.includes(USERNAME), 'no e-mail address in the file');
  assert.equal(statSync(file).mode & 0o777, 0o600);

  const second = setup({ portal, store: new SessionStore(dir) });
  await second.tcc.run(read);
  assert.equal(portal.logins, 1, 'the saved session was reused');

  // Another account never reuses it.
  const other = setup({ portal, store: new SessionStore(dir) });
  other.tcc.configure('other@example.com', PASSWORD);
  await assert.rejects(other.tcc.run(read), { kind: 'credentials' });
});

test('calls reach the portal one at a time', async () => {
  const { portal, tcc } = setup();
  let active = 0;
  let max = 0;
  const slow = async (client) => {
    active += 1;
    max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await read(client);
    active -= 1;
  };
  await Promise.all([tcc.run(slow), tcc.run(slow), tcc.run(slow)]);
  assert.equal(max, 1);
  assert.equal(portal.logins, 1);
});

test('no credentials: no request at all', async () => {
  const { portal, tcc } = setup();
  tcc.configure('', '');
  await assert.rejects(tcc.run(read), { kind: 'config' });
  assert.equal(portal.requests.length, 0);
});
