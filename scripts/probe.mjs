#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Probe of the real Total Connect Comfort portal, with the integration's own
// client. Read only, nothing sensitive printed.
//
//   node scripts/probe.mjs
//     One login with an invented account: the portal must refuse it cleanly
//     (expected: "credentials"). ONE attempt only, on an address that is not
//     an account: no account can get locked by it.
//
//   TCC_USERNAME=... TCC_PASSWORD=... node scripts/probe.mjs
//     A real account: one login, the location list, each thermostat read once,
//     and what the integration makes of it. No command is sent. Names, ids,
//     e-mail address and cookies are not printed.
// -----------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { TccClient } from '../src/tcc/client.js';
import { listThermostats, parseThermostat } from '../src/tcc/model.js';

const client = new TccClient();
const username = process.env.TCC_USERNAME;
const password = process.env.TCC_PASSWORD;

if (!username || !password) {
  const fake = `gladys-probe-${randomBytes(6).toString('hex')}@example.com`;
  console.log('No TCC_USERNAME / TCC_PASSWORD: one login with an invented account.');
  try {
    await client.login(fake, randomBytes(12).toString('hex'));
    console.log('UNEXPECTED: the portal accepted an invented account.');
    process.exitCode = 1;
  } catch (err) {
    console.log(`Login refused: kind=${err.kind} status=${err.status ?? '-'} (${err.message})`);
    // `credentials` is the expected answer; `login` means the portal's answer
    // changed shape, `portal` that it could not be reached.
    process.exitCode = err.kind === 'credentials' ? 0 : 1;
  }
} else {
  try {
    await client.login(username, password);
    console.log('Login: OK (authentication cookie received)');
    const locations = await client.getLocations();
    const thermostats = listThermostats(locations);
    console.log(`Locations: ${locations.length}, thermostats: ${thermostats.length}`);
    for (const [index, info] of thermostats.entries()) {
      const raw = await client.getThermostat(info.id);
      const t = parseThermostat(raw);
      const summary = {
        online: t.online,
        unit: t.unit,
        indoorTemperature: t.indoorTemperature,
        indoorHumidity: t.indoorHumidity,
        outdoorTemperature: t.outdoorTemperature,
        heatSetpoint: t.heatSetpoint,
        coolSetpoint: t.coolSetpoint,
        heatLimits: t.heatLimits,
        coolLimits: t.coolLimits,
        deadband: t.deadband,
        modes: t.modes,
        systemMode: t.systemMode,
        equipment: t.equipment,
        hold: t.hold,
        scheduleCapable: t.scheduleCapable,
        holdUntilCapable: t.holdUntilCapable,
        fanModes: t.fanModes,
        fanMode: t.fanMode,
        fanRunning: t.fanRunning,
        // Field names only: what the portal answers today, to compare with
        // the 2016 recordings the fixtures come from.
        uiDataKeys: Object.keys(raw.latestData.uiData).sort(),
        fanDataKeys: Object.keys(raw.latestData.fanData ?? {}).sort(),
      };
      console.log(`Thermostat #${index + 1}:`, JSON.stringify(summary, null, 2));
    }
  } catch (err) {
    console.log(`Failed: kind=${err.kind ?? '-'} status=${err.status ?? '-'} (${err.message})`);
    process.exitCode = 1;
  }
}
