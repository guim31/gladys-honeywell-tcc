# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-14

### Added

- Honeywell / Resideo Wi-Fi thermostats of the Total Connect Comfort portal
  (United States and Canada): one Gladys device per thermostat, in °F or °C,
  with indoor temperature and humidity, outdoor temperature and humidity when
  an outdoor sensor is connected, heat and cool setpoints, system mode,
  emergency heat, equipment status, fan setting, fan running and schedule
  hold.
- Commands: setpoints (within the thermostat's limits and deadband, held until
  the next schedule period like on the thermostat), mode, emergency heat, fan,
  schedule hold.
- "Honeywell thermostat" dashboard widget: temperatures, setpoints, mode,
  equipment, fan, hold and connection, with a form to set the temperature and
  a resume-schedule button.
- Scene triggers "Thermostat connection lost" (thermostat offline, portal
  unreachable or login refused) and "Thermostat connection restored".
- Scene action "Hold a temperature until a time".
- "Test the connection" button in the configuration.
- The portal is read every 5 minutes by default (2, 10 or 15 to choose), and
  again 15 seconds after a command. A refused password is never retried
  automatically, so the portal does not lock the account; the session is kept
  across restarts.
- Feature names, messages, widget and documentation in English, French,
  German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-honeywell-tcc/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-honeywell-tcc/releases/tag/v1.0.1
