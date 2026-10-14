// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at info level, a failure that
// lasts is said once and its end once, and no secret of the configuration
// ever reaches the logs, even in debug.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE } from '../src/devices.js';
import { PASSWORD, USERNAME } from './helpers/fakePortal.js';
import { addAll, createWorld } from './helpers/world.js';

/** Capture what the SDK logger prints (console.log / console.error). */
function captureLogs(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => lines.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}

test('a normal cycle writes nothing at info level', async (t) => {
  const world = await createWorld();
  await addAll(world);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 3; i += 1) {
    world.portal.update('1234567', { DispTemperature: 60 + i });
    world.clock.t += 5 * 60 * 1000;
    await world.hub.refresh();
  }
  assert.deepEqual(lines, []);
  world.hub.stop();
});

test('a portal down for hours: one line when it fails, one when it is back', async (t) => {
  const world = await createWorld();
  await addAll(world);
  const lines = captureLogs(t, 'info');
  world.portal.down = true;
  for (let i = 0; i < 12; i += 1) {
    world.clock.t += 5 * 60 * 1000;
    await world.hub.refresh();
  }
  world.portal.down = false;
  world.clock.t += 5 * 60 * 1000;
  await world.hub.refresh();
  const portalLines = lines.filter((line) => line.includes('Total Connect Comfort'));
  assert.equal(portalLines.length, 2, portalLines.join('\n'));
  assert.match(portalLines[0], /\[WARN\].*unreachable/);
  assert.match(portalLines[1], /\[INFO\].*answers again/);
  world.hub.stop();
});

test('no secret in the logs, whatever happens, even in debug', async (t) => {
  const lines = captureLogs(t, 'debug');
  const world = await createWorld();
  await addAll(world);
  // A command, a session that expires, a refused password, a portal down.
  const device = world.gladys.devices[0];
  const feature = device.features.find((f) => f.external_id.endsWith(FEATURE.HEAT_SETPOINT));
  await world.gladys.fake.setValue(device, feature, 60);
  world.portal.expireSessions();
  world.clock.t += 10 * 60 * 1000;
  await world.hub.refresh();
  world.portal.down = true;
  world.clock.t += 10 * 60 * 1000;
  await world.hub.refresh();
  world.portal.down = false;
  await world.gladys.fake.configUpdated({ username: USERNAME, password: 'another secret' });
  world.portal.expireSessions();
  world.clock.t += 10 * 60 * 1000;
  await world.hub.refresh();

  assert.ok(lines.length > 5, 'the scenario logs something');
  const text = lines.join('\n');
  for (const secret of [PASSWORD, 'another secret', USERNAME, 'TOKEN1', '.ASPXAUTH']) {
    assert.ok(!text.includes(secret), `"${secret}" found in the logs`);
  }
  world.hub.stop();
});
