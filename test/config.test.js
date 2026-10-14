// -----------------------------------------------------------------------------
// Configuration normalization: the rest of the code never sees blanks,
// strings out of their list or `undefined`.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, isConfigured, normalizeConfig, refreshMs } from '../src/config.js';

test('defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
  assert.equal(isConfigured(normalizeConfig()), false);
  assert.equal(refreshMs(normalizeConfig()), 5 * 60 * 1000);
});

test('the e-mail address is trimmed, the password kept as typed', () => {
  const config = normalizeConfig({ username: '  me@example.com ', password: ' p w ' });
  assert.equal(config.username, 'me@example.com');
  assert.equal(config.password, ' p w ');
  assert.equal(isConfigured(config), true);
});

test('choices outside their list fall back to the default', () => {
  assert.equal(normalizeConfig({ refresh_minutes: '1' }).refresh_minutes, '5');
  assert.equal(normalizeConfig({ refresh_minutes: 10 }).refresh_minutes, '10');
  assert.equal(normalizeConfig({ language: 'IT' }).language, 'fr');
  assert.equal(normalizeConfig({ language: 'DE' }).language, 'de');
  assert.equal(normalizeConfig({ username: 42 }).username, '');
});
