// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. This module provides the
// defaults (they mirror the manifest, see test/manifest.test.js) and normalizes
// the received object, so the rest of the code never deals with strings,
// blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Minutes between two reads of the portal. A select rather than a number: the
// Gladys form renders numbers without `step`, and the choice is bounded anyway.
// Total Connect Comfort is slow and locks accounts it finds too busy: five
// minutes by default, two at the fastest (Home Assistant reads every 30 s).
export const REFRESH_CHOICES = ['2', '5', '10', '15'];

export const DEFAULT_CONFIG = {
  username: '',
  password: '',
  refresh_minutes: '5',
  language: 'fr',
};

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (value) => (typeof value === 'string' ? value : '');
  const refresh = `${source.refresh_minutes ?? ''}`.trim();
  const language = text(source.language).trim().toLowerCase();
  return {
    // The portal logs in with an e-mail address: surrounding blanks are a
    // copy-paste accident, never part of it. A password is taken as typed.
    username: text(source.username).trim(),
    password: text(source.password),
    refresh_minutes: REFRESH_CHOICES.includes(refresh) ? refresh : DEFAULT_CONFIG.refresh_minutes,
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

export const isConfigured = (config) => config.username !== '' && config.password !== '';

/** Milliseconds between two reads of the portal. */
export const refreshMs = (config) => Number(config.refresh_minutes) * 60 * 1000;
