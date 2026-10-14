// -----------------------------------------------------------------------------
// The thermostat widget: a content the core renders exactly as sent, tiles
// bound to features that exist, and its buttons.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_ACTION, WIDGET_KEY } from '../src/widgets.js';
import { FEATURE } from '../src/devices.js';
import { USERNAME } from './helpers/fakePortal.js';
import { addAll, createWorld, featureId } from './helpers/world.js';

const IDS = ['1234567', '2345678', '3456789'];
const settingsOf = (id) => ({ thermostat: `ext:test-integration:thermostat:${id}` });

async function content(world, id, language = 'en') {
  const ack = await world.gladys.fake.widgetGet(WIDGET_KEY, { settings: settingsOf(id), language });
  assert.equal(ack.success, true, ack.error);
  return ack.data.content ?? ack.data;
}

test('every thermostat, every language: rendered exactly as sent, tiles on real features', async () => {
  const world = await createWorld();
  await addAll(world);
  for (const id of IDS) {
    const device = world.gladys.fake.discoveredDevices.find((d) => d.external_id.endsWith(id));
    const featureIds = new Set(device.features.map((f) => f.external_id));
    for (const language of ['en', 'fr', 'de', 'es']) {
      const widget = await content(world, id, language);
      assert.deepEqual(validateWidgetContent(widget), [], `${id} ${language}`);
      for (const component of widget.components) {
        if (component.device_feature) {
          assert.ok(featureIds.has(component.device_feature), `${component.device_feature} exists`);
        }
      }
      const buttons = widget.components.filter((c) => c.type === 'button');
      assert.ok(buttons.length <= 4);
      // A choice shown by the icon, never by a style (invisible in dark mode).
      assert.ok(buttons.every((b) => b.style === undefined));
    }
  }
  world.hub.stop();
});

test('the heat pump in auto: both setpoints, the form, a hold button', async () => {
  const world = await createWorld();
  await addAll(world);
  const widget = await content(world, '2345678', 'fr');
  const tiles = widget.components.filter((c) => c.type === 'value').map((c) => c.label);
  assert.deepEqual(tiles, ['Intérieur', 'Humidité', 'Extérieur', 'Chauffer à', 'Refroidir à']);
  const status = widget.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((item) => `${item.label}: ${item.value}`),
    [
      'Mode: Auto',
      'Équipement: Chauffe',
      'Ventilation: Auto · en marche',
      'Programme: Suivi',
      'Connexion: En ligne',
    ],
  );
  const [set, hold] = widget.components.filter((c) => c.type === 'button');
  assert.equal(set.action.key, WIDGET_ACTION.SET_SETPOINTS);
  assert.deepEqual(
    set.action.fields.map((f) => [f.key, f.default]),
    [
      ['heat', 68],
      ['cool', 76],
      ['hold', 'next'],
    ],
  );
  assert.equal(set.action.fields[0].label.fr, 'Consigne de chauffage (°F)');
  assert.equal(set.action.fields[0].label.en, 'Heat setpoint (°F)');
  assert.equal(hold.action.key, WIDGET_ACTION.PERMANENT_HOLD);
  world.hub.stop();
});

test('the widget form sets both setpoints with their hold', async () => {
  const world = await createWorld();
  await addAll(world);
  const ack = await world.gladys.fake.widgetAction(
    WIDGET_KEY,
    WIDGET_ACTION.SET_SETPOINTS,
    {},
    {
      settings: settingsOf('2345678'),
      values: { heat: 69, cool: 75, hold: 'permanent' },
    },
  );
  assert.equal(ack.success, true);
  const sent = world.portal.commands.at(-1);
  assert.deepEqual([sent.HeatSetpoint, sent.CoolSetpoint, sent.StatusHeat], [69, 75, 2]);
  assert.equal(world.gladys.fake.lastState(featureId(world, '2345678', FEATURE.HOLD)), 'permanent');
  // Then the schedule comes back.
  const resume = await world.gladys.fake.widgetAction(
    WIDGET_KEY,
    WIDGET_ACTION.RESUME_SCHEDULE,
    {},
    {
      settings: settingsOf('2345678'),
    },
  );
  assert.equal(resume.success, true);
  assert.equal(world.portal.commands.at(-1).StatusHeat, 0);
  world.hub.stop();
});

test('a form received without values (older core) changes nothing', async () => {
  const world = await createWorld();
  await addAll(world);
  const sent = world.portal.commands.length;
  const ack = await world.gladys.fake.widgetAction(
    WIDGET_KEY,
    WIDGET_ACTION.SET_SETPOINTS,
    {},
    {
      settings: settingsOf('2345678'),
    },
  );
  assert.equal(ack.success, false);
  assert.equal(world.portal.commands.length, sent);
  world.hub.stop();
});

test('empty states say what to do', async () => {
  const unconfigured = await createWorld({ config: {} });
  const ack = await unconfigured.gladys.fake.widgetGet(WIDGET_KEY, {
    settings: {},
    language: 'de',
  });
  const widget = ack.data.content ?? ack.data;
  assert.match(widget.components[0].text, /Total-Connect-Comfort-Konto/);
  unconfigured.hub.stop();

  const refused = await createWorld({ config: { username: USERNAME, password: 'wrong' } });
  const blocked = await refused.gladys.fake.widgetGet(WIDGET_KEY, {
    settings: settingsOf('1234567'),
    language: 'es',
  });
  assert.match((blocked.data.content ?? blocked.data).components[0].text, /rechazado/);
  refused.hub.stop();

  const world = await createWorld();
  const pick = await world.gladys.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'fr' });
  assert.match((pick.data.content ?? pick.data).components[0].text, /Choisissez un thermostat/);
  world.hub.stop();
});
