// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, the fake portal, a session
// store in memory, and the integration wired on top through registerHandlers.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemorySessionStore } from '../../src/store.js';
import { PASSWORD, USERNAME, createFakePortal } from './fakePortal.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

export const CREDENTIALS = { username: USERNAME, password: PASSWORD };

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config (credentials by default)
 * @param {object} [options.portal] from createFakePortal
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] run the integration's own timers
 */
export async function createWorld({
  config = { ...CREDENTIALS },
  portal = createFakePortal(),
  devices = [],
  connect = true,
  timers = false,
  store = new MemorySessionStore(),
  clock = { t: Date.parse('2026-10-14T12:00:00Z') },
  timings,
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const hub = registerHandlers(gladys, {
    fetch: portal.fetch,
    store,
    timers,
    now: () => clock.t,
    timings,
  });
  if (connect) {
    await gladys.connect();
  }
  return { gladys, portal, hub, store, clock };
}

/** The user adds every discovered thermostat to Gladys. */
export async function addAll(world) {
  for (const device of world.gladys.fake.discoveredDevices) {
    await world.gladys.fake.deviceCreated(device);
  }
}

/** A device of the Discovery list, by thermostat id. */
export const discovered = (world, id) =>
  world.gladys.fake.discoveredDevices.find((device) => device.external_id.endsWith(`:${id}`));

/** A feature of a discovered device, by key. */
export const featureOf = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`));

export const featureId = (world, id, key) =>
  world.gladys.externalIds('thermostat', id).feature(key);
