// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTION_TEST, LOST_CAUSE, SCENE_ACTION_HOLD_UNTIL, TRIGGER } from '../src/app.js';
import { DEFAULT_CONFIG, REFRESH_CHOICES } from '../src/config.js';
import { WIDGET_KEY } from '../src/widgets.js';
import { createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const { gladys: registered, hub } = await createWorld({ connect: false });
hub.stop();
const handlers = registered.handlers;

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

test('identity: name, image, cloud transport, climate category', () => {
  assert.equal(manifest.name, 'Honeywell Total Connect');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-honeywell-tcc:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-honeywell-tcc/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['climate']);
});

test('Gladys 5.2.0 at least: widget buttons that open a form (#3168)', () => {
  assert.ok(isAtLeast(minGladysVersion(), [5, 2, 0]), manifest.gladys_version);
});

test('every manifest action, scene action and widget has its handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions), [ACTION_TEST]);
  assert.deepEqual(keysOf(manifest.scene_actions), [SCENE_ACTION_HOLD_UNTIL]);
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  const registeredKeys = (prefix) =>
    Object.keys(handlers)
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  assert.deepEqual(registeredKeys('action:'), keysOf(manifest.actions));
  assert.deepEqual(registeredKeys('sceneAction:'), keysOf(manifest.scene_actions));
  assert.deepEqual(registeredKeys('widget:'), keysOf(manifest.widgets));
  assert.deepEqual(registeredKeys('widgetAction:'), keysOf(manifest.widgets));
});

test('the scene triggers the code fires are the ones declared, with their causes', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers), [TRIGGER.LOST, TRIGGER.RESTORED]);
  const cause = manifest.scene_triggers[0].fields.find((f) => f.key === 'cause');
  assert.deepEqual(
    cause.options.map((o) => o.value),
    Object.values(LOST_CAUSE),
  );
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.type === 'section') {
      assert.ok(!(field.key in DEFAULT_CONFIG), `section "${field.key}" stores no value`);
      continue;
    }
    assert.ok(field.key in DEFAULT_CONFIG, `${field.key} has a default in the code`);
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, `DEFAULT_CONFIG.${field.key}`);
    }
  }
  const refresh = manifest.config_schema.find((f) => f.key === 'refresh_minutes');
  assert.deepEqual(
    refresh.options.map((o) => o.value),
    REFRESH_CHOICES,
  );
});

test('the password is a secret, and no action carries a secret or a number field', () => {
  // A secret in an action form cannot be filled (Gladys#3154); a number field
  // is rendered without step (decimals refused).
  assert.equal(manifest.config_schema.find((f) => f.key === 'password').type, 'secret');
  const actionFields = [...(manifest.actions ?? []), ...(manifest.scene_actions ?? [])].flatMap(
    (a) => a.fields ?? [],
  );
  assert.ok(actionFields.every((f) => f.type !== 'secret' && f.type !== 'number'));
  // Required scene action fields carry a default, or come from a select.
  for (const action of manifest.scene_actions) {
    for (const field of action.fields.filter((f) => f.required)) {
      assert.ok(field.default !== undefined || field.source === 'devices', field.key);
    }
  }
});

test('section fields are purely presentational, links in https', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('dynamic selects declare a source and no static options', () => {
  for (const field of allFields.filter((f) => f.source !== undefined)) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined, field.key);
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(
    manifest.docker_image.endsWith(`:${manifest.version}`),
    `docker_image must be tagged :${manifest.version}, got "${manifest.docker_image}"`,
  );
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(
      text.length >= 10 && text.length <= 100,
      `description.${lang} has ${text.length} characters (10 to 100 allowed)`,
    );
  }
});

test('field placeholders are multi-language objects', () => {
  for (const field of allFields.filter((f) => f.placeholder !== undefined)) {
    assert.equal(typeof field.placeholder, 'object', `field "${field.key}": placeholder`);
    assert.ok(field.placeholder.en, `field "${field.key}": placeholder needs an English text`);
  }
});
