// -----------------------------------------------------------------------------
// The integration as Gladys sees it: the SDK's fake Gladys on one side, the
// fake portal on the other.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_TEST, LOST_CAUSE, SCENE_ACTION_HOLD_UNTIL, TRIGGER } from '../src/app.js';
import { FEATURE } from '../src/devices.js';
import { PASSWORD, USERNAME, createFakePortal } from './helpers/fakePortal.js';
import {
  CREDENTIALS,
  addAll,
  createWorld,
  discovered,
  featureId,
  featureOf,
} from './helpers/world.js';

const FURNACE = '1234567';
const HEAT_PUMP = '2345678';
const CABIN = '3456789';

test('discovery publishes one device per thermostat, named by the portal', async () => {
  const { gladys, hub } = await createWorld();
  const devices = gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((d) => [d.name, d.external_id]),
    [
      ['Downstairs', 'ext:test-integration:thermostat:1234567'],
      ['Upstairs', 'ext:test-integration:thermostat:2345678'],
      ['Cabin', 'ext:test-integration:thermostat:3456789'],
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  hub.stop();
});

test('the features follow what each thermostat has', async () => {
  const world = await createWorld();
  const keys = (id) => discovered(world, id).features.map((f) => f.external_id.split(':').pop());
  assert.deepEqual(keys(FURNACE), [
    'indoor_temperature',
    'indoor_humidity',
    'heat_setpoint',
    'cool_setpoint',
    'mode',
    'operating_state',
    'fan_mode',
    'fan_running',
    'hold',
  ]);
  assert.deepEqual(keys(HEAT_PUMP), [
    'indoor_temperature',
    'indoor_humidity',
    'outdoor_temperature',
    'outdoor_humidity',
    'heat_setpoint',
    'cool_setpoint',
    'mode',
    'emergency_heat',
    'operating_state',
    'fan_mode',
    'fan_running',
    'hold',
  ]);
  assert.deepEqual(keys(CABIN), [
    'indoor_temperature',
    'heat_setpoint',
    'mode',
    'operating_state',
    'hold',
  ]);

  const furnace = discovered(world, FURNACE);
  const heat = featureOf(furnace, FEATURE.HEAT_SETPOINT);
  assert.equal(heat.unit, 'fahrenheit');
  assert.deepEqual([heat.min, heat.max, heat.step], [40, 90, 1]);
  assert.equal(featureOf(furnace, FEATURE.HEAT_SETPOINT).name, 'Consigne de chauffage');
  assert.deepEqual(featureOf(furnace, FEATURE.MODE).supported_options, [
    { value: 0, label: 'off' },
    { value: 1, label: 'heat' },
    { value: 2, label: 'cool' },
  ]);
  assert.deepEqual(
    featureOf(furnace, FEATURE.FAN_MODE).supported_options.map((o) => o.value),
    ['auto', 'on', 'circulate'],
  );
  const cabinHeat = featureOf(discovered(world, CABIN), FEATURE.HEAT_SETPOINT);
  assert.deepEqual([cabinHeat.unit, cabinHeat.step], ['celsius', 0.5]);
  assert.equal(featureOf(discovered(world, HEAT_PUMP), FEATURE.MODE).supported_options.length, 4);
  world.hub.stop();
});

test('no state is sent before the user adds a thermostat; all of them once added', async () => {
  const world = await createWorld();
  assert.equal(world.gladys.fake.states.length, 0);
  await addAll(world);
  const last = (id, key) => world.gladys.fake.lastState(featureId(world, id, key));
  assert.equal(last(FURNACE, FEATURE.INDOOR_TEMPERATURE), 58);
  assert.equal(last(FURNACE, FEATURE.HEAT_SETPOINT), 58);
  assert.equal(last(FURNACE, FEATURE.MODE), 1);
  assert.equal(last(FURNACE, FEATURE.OPERATING_STATE), 0);
  assert.equal(last(FURNACE, FEATURE.FAN_MODE), 'circulate');
  assert.equal(last(FURNACE, FEATURE.HOLD), 'permanent');
  assert.equal(last(HEAT_PUMP, FEATURE.MODE), 3);
  assert.equal(last(HEAT_PUMP, FEATURE.EMERGENCY_HEAT), 0);
  assert.equal(last(HEAT_PUMP, FEATURE.OPERATING_STATE), 1);
  assert.equal(last(HEAT_PUMP, FEATURE.OUTDOOR_TEMPERATURE), 34);
  assert.equal(last(HEAT_PUMP, FEATURE.FAN_RUNNING), 1);
  assert.equal(last(CABIN, FEATURE.HEAT_SETPOINT), 20.5);
  // Unknown equipment status: nothing rather than a false "idle".
  assert.equal(last(CABIN, FEATURE.OPERATING_STATE), undefined);
  // Added thermostats get their transport badge.
  assert.deepEqual(world.gladys.fake.transports.at(-1), {
    device_external_id: 'ext:test-integration:thermostat:3456789',
    transport: 'cloud',
  });
  world.hub.stop();
});

test('the container refreshes the states by itself, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { t: Date.parse('2026-10-14T12:00:00Z') };
  const world = await createWorld({ timers: true, clock });
  await addAll(world);
  world.portal.update(FURNACE, { DispTemperature: 61, EquipmentOutputStatus: 1 });

  const pollsBefore = world.gladys.fake.wsMessages.length;
  clock.t += 5 * 60 * 1000;
  t.mock.timers.tick(5 * 60 * 1000);
  // Let the cycle's promises settle.
  for (let i = 0; i < 50; i += 1) await new Promise((resolve) => setImmediate(resolve));

  assert.equal(
    world.gladys.fake.lastState(featureId(world, FURNACE, FEATURE.INDOOR_TEMPERATURE)),
    61,
  );
  assert.equal(world.gladys.fake.lastState(featureId(world, FURNACE, FEATURE.OPERATING_STATE)), 1);
  assert.ok(world.gladys.fake.wsMessages.length >= pollsBefore);
  assert.equal(world.portal.logins, 1, 'one login for everything');
  world.hub.stop();
});

test('a cycle only publishes what changed', async () => {
  const world = await createWorld();
  await addAll(world);
  const before = world.gladys.fake.states.length;
  world.clock.t += 5 * 60 * 1000;
  await world.hub.refresh();
  assert.equal(world.gladys.fake.states.length, before, 'nothing changed, nothing sent');
  world.portal.update(HEAT_PUMP, { IndoorHumidity: 44 });
  world.clock.t += 5 * 60 * 1000;
  await world.hub.refresh();
  assert.deepEqual(world.gladys.fake.states.slice(before), [
    { device_feature_external_id: featureId(world, HEAT_PUMP, FEATURE.INDOOR_HUMIDITY), state: 44 },
  ]);
  world.hub.stop();
});

test("the core's onPoll is only a fallback: skipped while the timer keeps up", async () => {
  const world = await createWorld();
  await addAll(world);
  const reads = () =>
    world.portal.requests.filter((r) => r.path.endsWith(`CheckDataSession/${FURNACE}`)).length;
  const before = reads();
  const device = world.gladys.devices.find((d) => d.external_id.endsWith(FURNACE));
  assert.deepEqual(await world.gladys.fake.poll(device), { success: true });
  assert.equal(reads(), before);
  world.clock.t += 5 * 60 * 1000;
  await world.gladys.fake.poll(device);
  assert.equal(reads(), before + 1);
  world.hub.stop();
});

/** Send a command as Gladys does, and return the portal command it made. */
async function command(world, id, key, value) {
  const device = world.gladys.devices.find((d) => d.external_id.endsWith(`:${id}`));
  const feature = device.features.find((f) => f.external_id.endsWith(`:${key}`));
  const sent = world.portal.commands.length;
  const ack = await world.gladys.fake.setValue(device, feature, value);
  return { ack, commands: world.portal.commands.slice(sent) };
}

test('setpoint command: sent, published at once, read back later', async () => {
  const world = await createWorld();
  await addAll(world);
  const { ack, commands } = await command(world, HEAT_PUMP, FEATURE.HEAT_SETPOINT, 70);
  assert.deepEqual(ack, { success: true });
  assert.equal(commands.length, 1);
  assert.equal(commands[0].HeatSetpoint, 70);
  assert.equal(commands[0].StatusHeat, 1, 'a temporary hold, like the thermostat screen');
  const last = (key) => world.gladys.fake.lastState(featureId(world, HEAT_PUMP, key));
  assert.equal(last(FEATURE.HEAT_SETPOINT), 70);
  assert.equal(last(FEATURE.HOLD), 'temporary');
  world.hub.stop();
});

test('mode, fan and hold commands', async () => {
  const world = await createWorld();
  await addAll(world);
  assert.equal((await command(world, HEAT_PUMP, FEATURE.MODE, 2)).commands[0].SystemSwitch, 3);
  assert.equal((await command(world, FURNACE, FEATURE.FAN_MODE, 'auto')).commands[0].FanMode, 0);
  const hold = await command(world, FURNACE, FEATURE.HOLD, 'schedule');
  assert.deepEqual([hold.commands[0].StatusHeat, hold.commands[0].StatusCool], [0, 0]);
  assert.equal(world.gladys.fake.lastState(featureId(world, FURNACE, FEATURE.HOLD)), 'schedule');
  world.hub.stop();
});

test('emergency heat: on is emheat, off goes back to heating, never to off', async () => {
  const world = await createWorld();
  await addAll(world);
  const on = await command(world, HEAT_PUMP, FEATURE.EMERGENCY_HEAT, 1);
  assert.equal(on.commands[0].SystemSwitch, 0);
  const last = (key) => world.gladys.fake.lastState(featureId(world, HEAT_PUMP, key));
  assert.equal(last(FEATURE.EMERGENCY_HEAT), 1);
  assert.equal(last(FEATURE.MODE), 1, 'emergency heat reads as heating');
  const off = await command(world, HEAT_PUMP, FEATURE.EMERGENCY_HEAT, 0);
  assert.equal(off.commands[0].SystemSwitch, 1);
  // Off while not in emergency heat: nothing to send.
  assert.equal((await command(world, HEAT_PUMP, FEATURE.EMERGENCY_HEAT, 0)).commands.length, 0);
  world.hub.stop();
});

test('a refused command says why, in the configured language', async () => {
  const world = await createWorld({ config: { ...CREDENTIALS, language: 'en' } });
  await addAll(world);
  const { ack, commands } = await command(world, FURNACE, FEATURE.HEAT_SETPOINT, 95);
  assert.deepEqual(ack, { success: false, error: 'Setpoint out of range: 40 to 90 °F.' });
  assert.equal(commands.length, 0);
  world.portal.rejectCommands = true;
  const rejected = await command(world, FURNACE, FEATURE.HEAT_SETPOINT, 60);
  assert.equal(rejected.ack.error, 'Total Connect Comfort refused the command.');
  world.hub.stop();
});

test('a command on an offline thermostat is refused before reaching the portal', async () => {
  const world = await createWorld();
  await addAll(world);
  world.portal.update(FURNACE, {}, { deviceLive: false, communicationLost: true });
  world.clock.t += 2 * 60 * 1000;
  const { ack, commands } = await command(world, FURNACE, FEATURE.HEAT_SETPOINT, 60);
  assert.equal(ack.success, false);
  assert.match(ack.error, /pas connecté/);
  assert.equal(commands.length, 0);
  world.hub.stop();
});

test('a thermostat that drops off fires connection_lost, then connection_restored', async () => {
  const world = await createWorld();
  await addAll(world);
  world.portal.update(FURNACE, {}, { deviceLive: false, communicationLost: true });
  world.clock.t += 5 * 60 * 1000;
  await world.hub.refresh();
  const device = 'ext:test-integration:thermostat:1234567';
  assert.deepEqual(world.gladys.fake.sceneEvents, [
    {
      key: TRIGGER.LOST,
      data: { thermostat: device, thermostat_name: 'Downstairs', cause: LOST_CAUSE.THERMOSTAT },
    },
  ]);
  assert.deepEqual(world.gladys.fake.transports.at(-1), {
    device_external_id: device,
    transport: 'unreachable',
  });
  // Still offline: no second event.
  world.clock.t += 5 * 60 * 1000;
  await world.hub.refresh();
  assert.equal(world.gladys.fake.sceneEvents.length, 1);

  world.portal.update(FURNACE, {}, { deviceLive: true, communicationLost: false });
  world.clock.t += 5 * 60 * 1000;
  await world.hub.refresh();
  assert.deepEqual(world.gladys.fake.sceneEvents.at(-1), {
    key: TRIGGER.RESTORED,
    data: { thermostat: device, thermostat_name: 'Downstairs' },
  });
  world.hub.stop();
});

test('a portal down for three cycles: status at once, triggers after the third', async () => {
  const world = await createWorld();
  await addAll(world);
  world.portal.down = true;
  for (let i = 1; i <= 3; i += 1) {
    world.clock.t += 5 * 60 * 1000;
    await world.hub.refresh();
    assert.equal(world.gladys.fake.connectionStatus.connected, false);
    assert.equal(world.gladys.fake.sceneEvents.length, i < 3 ? 0 : 3, `cycle ${i}`);
  }
  assert.ok(world.gladys.fake.sceneEvents.every((e) => e.data.cause === LOST_CAUSE.PORTAL));
  world.portal.down = false;
  world.clock.t += 5 * 60 * 1000;
  await world.hub.refresh();
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  assert.equal(world.gladys.fake.sceneEvents.filter((e) => e.key === TRIGGER.RESTORED).length, 3);
  world.hub.stop();
});

test('a refused password: a clear status, triggers, and no new attempt until the config changes', async () => {
  const portal = createFakePortal();
  const world = await createWorld({ portal });
  await addAll(world);
  portal.expireSessions();
  const { gladys, hub, clock } = world;
  // The password changed on the portal side.
  await gladys.fake.configUpdated({ username: USERNAME, password: 'old password' });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /refused the e-mail address or the password/,
  );
  assert.equal(gladys.fake.connectionStatus.message.de.includes('Korrigiere'), true);
  assert.ok(gladys.fake.sceneEvents.every((e) => e.data.cause === LOST_CAUSE.LOGIN));
  const logins = portal.logins;
  for (let i = 0; i < 20; i += 1) {
    clock.t += 5 * 60 * 1000;
    await hub.refresh();
  }
  assert.equal(portal.logins, logins, 'the portal is left alone');
  await gladys.fake.configUpdated({ username: USERNAME, password: PASSWORD });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(portal.logins, logins + 1);
  hub.stop();
});

test('"Test the connection" lists the thermostats, and retries a refused login once', async () => {
  const world = await createWorld({ config: { username: USERNAME, password: 'wrong' } });
  const first = await world.gladys.fake.action(ACTION_TEST);
  assert.equal(first.success, true);
  assert.match(first.data.message?.en ?? first.data.en, /refused/);
  assert.equal(world.portal.logins, 2, 'the start, then the test');

  await world.gladys.fake.configUpdated({ ...CREDENTIALS });
  const ok = await world.gladys.fake.action(ACTION_TEST);
  const message = ok.data.message ?? ok.data;
  assert.equal(message.en, 'Connected: 3 thermostat(s) found (Downstairs, Upstairs, Cabin).');
  assert.equal(message.fr, 'Connecté : 3 thermostat(s) trouvé(s) (Downstairs, Upstairs, Cabin).');
  world.hub.stop();
});

test('not configured: a status asking for the account, no request to the portal', async () => {
  const world = await createWorld({ config: {} });
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.en, /e-mail address and the password/);
  assert.equal(world.portal.requests.length, 0);
  world.hub.stop();
});

test('scene action: hold until a time', async () => {
  const world = await createWorld();
  await addAll(world);
  const ack = await world.gladys.fake.sceneAction(SCENE_ACTION_HOLD_UNTIL, {
    thermostat: 'ext:test-integration:thermostat:3456789',
    heat_setpoint: '21,5',
    cool_setpoint: '',
    until: '22:30',
  });
  assert.deepEqual(ack, { success: true, data: { outputs: { until: '22:30' } } });
  const sent = world.portal.commands.at(-1);
  assert.deepEqual(
    [sent.HeatSetpoint, sent.StatusHeat, sent.HeatNextPeriod, sent.CoolNextPeriod],
    [21.5, 1, 90, 90],
  );
  const bad = await world.gladys.fake.sceneAction(SCENE_ACTION_HOLD_UNTIL, {
    thermostat: 'ext:test-integration:thermostat:3456789',
    until: 'tonight',
  });
  assert.equal(bad.success, false);
  assert.match(bad.error, /Heure invalide/);
  world.hub.stop();
});

test('a thermostat added in Gladys gets every state again, at once', async () => {
  const world = await createWorld();
  const device = discovered(world, CABIN);
  await world.gladys.fake.deviceCreated(device);
  assert.equal(world.gladys.fake.lastState(featureId(world, CABIN, FEATURE.HEAT_SETPOINT)), 20.5);
  assert.ok(world.gladys.fake.widgetRefreshes.length >= 1);
  world.hub.stop();
});

test('a restart reuses the saved session: no login', async () => {
  const first = await createWorld();
  first.hub.stop();
  const second = await createWorld({ portal: first.portal, store: first.store });
  assert.equal(first.portal.logins, 1);
  assert.equal(second.gladys.fake.discoveredDevices.length, 3);
  second.hub.stop();
});

test('the account changes: the previous thermostats are forgotten', async () => {
  const world = await createWorld();
  await world.gladys.fake.configUpdated({ username: 'other@example.com', password: PASSWORD });
  assert.equal(world.hub.thermostats.size, 0);
  world.hub.stop();
});

test('the password never leaves for anything but the login form', async () => {
  const world = await createWorld();
  await addAll(world);
  await command(world, FURNACE, FEATURE.HEAT_SETPOINT, 60);
  const carrying = world.portal.requests.filter((r) =>
    `${r.search}${r.body ?? ''}`.includes(encodeURIComponent(PASSWORD).replace(/%20/g, '+')),
  );
  assert.deepEqual(
    carrying.map((r) => `${r.method} ${r.path}`),
    ['POST /portal'],
  );
  world.hub.stop();
});
