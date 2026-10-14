// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted". Brand names stay as they are.
//
// Feature names and option labels are written once, at device creation, in
// the language of the configuration (Gladys does not tell a device
// integration the user's language). Widgets receive the viewer's language.
// test/i18n.test.js checks that every table has the four languages.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

export const NAMES = {
  en: {
    indoor_temperature: 'Indoor temperature',
    indoor_humidity: 'Indoor humidity',
    outdoor_temperature: 'Outdoor temperature',
    outdoor_humidity: 'Outdoor humidity',
    heat_setpoint: 'Heat setpoint',
    cool_setpoint: 'Cool setpoint',
    mode: 'System mode',
    emergency_heat: 'Emergency heat',
    operating_state: 'Equipment status',
    fan_mode: 'Fan',
    fan_running: 'Fan running',
    hold: 'Schedule hold',
  },
  fr: {
    indoor_temperature: 'Température intérieure',
    indoor_humidity: 'Humidité intérieure',
    outdoor_temperature: 'Température extérieure',
    outdoor_humidity: 'Humidité extérieure',
    heat_setpoint: 'Consigne de chauffage',
    cool_setpoint: 'Consigne de climatisation',
    mode: 'Mode du système',
    emergency_heat: "Chauffage d'urgence",
    operating_state: 'État de fonctionnement',
    fan_mode: 'Ventilation',
    fan_running: 'Ventilation en marche',
    hold: 'Maintien du programme',
  },
  de: {
    indoor_temperature: 'Innentemperatur',
    indoor_humidity: 'Luftfeuchtigkeit innen',
    outdoor_temperature: 'Außentemperatur',
    outdoor_humidity: 'Luftfeuchtigkeit außen',
    heat_setpoint: 'Solltemperatur Heizen',
    cool_setpoint: 'Solltemperatur Kühlen',
    mode: 'Systemmodus',
    emergency_heat: 'Notheizung',
    operating_state: 'Betriebszustand',
    fan_mode: 'Lüfter',
    fan_running: 'Lüfter läuft',
    hold: 'Programm halten',
  },
  es: {
    indoor_temperature: 'Temperatura interior',
    indoor_humidity: 'Humedad interior',
    outdoor_temperature: 'Temperatura exterior',
    outdoor_humidity: 'Humedad exterior',
    heat_setpoint: 'Consigna de calefacción',
    cool_setpoint: 'Consigna de refrigeración',
    mode: 'Modo del sistema',
    emergency_heat: 'Calefacción de emergencia',
    operating_state: 'Estado de funcionamiento',
    fan_mode: 'Ventilador',
    fan_running: 'Ventilador en marcha',
    hold: 'Mantener el programa',
  },
};

// Labels of the text/select options (the values are fixed English keys).
export const OPTION_LABELS = {
  en: {
    fan_auto: 'Auto',
    fan_on: 'On',
    fan_circulate: 'Circulate',
    fan_schedule: 'Follow schedule',
    hold_schedule: 'Follow schedule',
    hold_temporary: 'Until next period',
    hold_permanent: 'Permanent hold',
    hold_vacation: 'Vacation hold',
  },
  fr: {
    fan_auto: 'Auto',
    fan_on: 'Marche',
    fan_circulate: 'Brassage',
    fan_schedule: 'Selon le programme',
    hold_schedule: 'Suivre le programme',
    hold_temporary: "Jusqu'à la période suivante",
    hold_permanent: 'Maintien permanent',
    hold_vacation: 'Maintien vacances',
  },
  de: {
    fan_auto: 'Auto',
    fan_on: 'Ein',
    fan_circulate: 'Umwälzen',
    fan_schedule: 'Nach Programm',
    hold_schedule: 'Programm folgen',
    hold_temporary: 'Bis zur nächsten Periode',
    hold_permanent: 'Dauerhaft halten',
    hold_vacation: 'Urlaubsmodus',
  },
  es: {
    fan_auto: 'Auto',
    fan_on: 'Encendido',
    fan_circulate: 'Recircular',
    fan_schedule: 'Según el programa',
    hold_schedule: 'Seguir el programa',
    hold_temporary: 'Hasta el siguiente período',
    hold_permanent: 'Mantener siempre',
    hold_vacation: 'Modo vacaciones',
  },
};

// Messages: connection status, action results, refused commands.
export const MESSAGES = {
  en: {
    notConfigured:
      'Enter the e-mail address and the password of your Total Connect Comfort account.',
    credentials:
      'Total Connect Comfort refused the e-mail address or the password. Correct them, then save: no new attempt until then.',
    locked:
      'Total Connect Comfort says the account is locked. Wait for it to unlock, then press "Test the connection".',
    loginUnclear:
      'The Total Connect Comfort login gave an unexpected answer three times: attempts stopped. Press "Test the connection" to try again.',
    unreachable: (reason) =>
      `Total Connect Comfort cannot be reached (${reason}). Next attempt soon.`,
    noThermostat: 'Connected, but no thermostat was found on this Total Connect Comfort account.',
    initFailed: 'Initialization failed, check the integration logs.',
    testOk: (count, names) => `Connected: ${count} thermostat(s) found (${names}).`,
    testNone: 'Connected, but this account has no thermostat.',
    invalid_value: 'Invalid value.',
    setpoint_locked: 'This thermostat does not accept setpoint changes right now.',
    out_of_range: ({ min, max, unit }) => `Setpoint out of range: ${min} to ${max} °${unit}.`,
    mode_unsupported: 'This thermostat does not offer this mode.',
    fan_unsupported: 'This thermostat does not offer this fan setting.',
    hold_unsupported: 'This thermostat does not offer this hold.',
    vacation_read_only: 'A vacation hold is set from the Honeywell app.',
    invalid_time: 'Invalid time: use HH:MM, for example 22:30.',
    no_setpoint: 'Give a heat or a cool setpoint.',
    unknown_thermostat: 'Unknown thermostat: run a new search in the Discovery tab.',
    offline: 'The thermostat is not connected to Total Connect Comfort.',
    rejected: 'Total Connect Comfort refused the command.',
    failed: (reason) => `The command failed: ${reason}.`,
  },
  fr: {
    notConfigured:
      "Saisissez l'adresse e-mail et le mot de passe de votre compte Total Connect Comfort.",
    credentials:
      "Total Connect Comfort a refusé l'adresse e-mail ou le mot de passe. Corrigez-les puis enregistrez : aucun nouvel essai d'ici là.",
    locked:
      'Total Connect Comfort indique que le compte est verrouillé. Attendez son déverrouillage, puis cliquez sur « Tester la connexion ».',
    loginUnclear:
      'La connexion à Total Connect Comfort a reçu trois fois une réponse inattendue : essais arrêtés. Cliquez sur « Tester la connexion » pour réessayer.',
    unreachable: (reason) =>
      `Total Connect Comfort est injoignable (${reason}). Nouvel essai bientôt.`,
    noThermostat:
      "Connecté, mais aucun thermostat n'a été trouvé sur ce compte Total Connect Comfort.",
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    testOk: (count, names) => `Connecté : ${count} thermostat(s) trouvé(s) (${names}).`,
    testNone: "Connecté, mais ce compte n'a aucun thermostat.",
    invalid_value: 'Valeur invalide.',
    setpoint_locked: "Ce thermostat n'accepte pas de changement de consigne pour l'instant.",
    out_of_range: ({ min, max, unit }) => `Consigne hors limites : de ${min} à ${max} °${unit}.`,
    mode_unsupported: 'Ce thermostat ne propose pas ce mode.',
    fan_unsupported: 'Ce thermostat ne propose pas ce réglage de ventilation.',
    hold_unsupported: 'Ce thermostat ne propose pas ce maintien.',
    vacation_read_only: "Un maintien vacances se règle depuis l'application Honeywell.",
    invalid_time: 'Heure invalide : utilisez HH:MM, par exemple 22:30.',
    no_setpoint: 'Indiquez une consigne de chauffage ou de climatisation.',
    unknown_thermostat: "Thermostat inconnu : relancez une recherche dans l'onglet Découverte.",
    offline: "Le thermostat n'est pas connecté à Total Connect Comfort.",
    rejected: 'Total Connect Comfort a refusé la commande.',
    failed: (reason) => `La commande a échoué : ${reason}.`,
  },
  de: {
    notConfigured:
      'Gib die E-Mail-Adresse und das Passwort deines Total-Connect-Comfort-Kontos ein.',
    credentials:
      'Total Connect Comfort hat die E-Mail-Adresse oder das Passwort abgelehnt. Korrigiere sie und speichere: bis dahin kein neuer Versuch.',
    locked:
      'Laut Total Connect Comfort ist das Konto gesperrt. Warte, bis es entsperrt ist, und klicke dann auf „Verbindung testen“.',
    loginUnclear:
      'Die Anmeldung bei Total Connect Comfort hat dreimal unerwartet geantwortet: Versuche gestoppt. Klicke auf „Verbindung testen“, um es erneut zu versuchen.',
    unreachable: (reason) =>
      `Total Connect Comfort ist nicht erreichbar (${reason}). Bald neuer Versuch.`,
    noThermostat:
      'Verbunden, aber auf diesem Total-Connect-Comfort-Konto wurde kein Thermostat gefunden.',
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    testOk: (count, names) => `Verbunden: ${count} Thermostat(e) gefunden (${names}).`,
    testNone: 'Verbunden, aber dieses Konto hat kein Thermostat.',
    invalid_value: 'Ungültiger Wert.',
    setpoint_locked: 'Dieses Thermostat nimmt gerade keine Änderung der Solltemperatur an.',
    out_of_range: ({ min, max, unit }) =>
      `Solltemperatur außerhalb des Bereichs: ${min} bis ${max} °${unit}.`,
    mode_unsupported: 'Dieses Thermostat bietet diesen Modus nicht an.',
    fan_unsupported: 'Dieses Thermostat bietet diese Lüftereinstellung nicht an.',
    hold_unsupported: 'Dieses Thermostat bietet dieses Halten nicht an.',
    vacation_read_only: 'Den Urlaubsmodus stellst du in der Honeywell-App ein.',
    invalid_time: 'Ungültige Uhrzeit: nutze HH:MM, zum Beispiel 22:30.',
    no_setpoint: 'Gib eine Solltemperatur zum Heizen oder Kühlen an.',
    unknown_thermostat: 'Unbekanntes Thermostat: starte eine neue Suche im Tab Erkennung.',
    offline: 'Das Thermostat ist nicht mit Total Connect Comfort verbunden.',
    rejected: 'Total Connect Comfort hat den Befehl abgelehnt.',
    failed: (reason) => `Der Befehl ist fehlgeschlagen: ${reason}.`,
  },
  es: {
    notConfigured:
      'Introduzca la dirección de correo y la contraseña de su cuenta Total Connect Comfort.',
    credentials:
      'Total Connect Comfort ha rechazado la dirección de correo o la contraseña. Corríjalas y guarde: ningún nuevo intento hasta entonces.',
    locked:
      'Total Connect Comfort indica que la cuenta está bloqueada. Espere a que se desbloquee y pulse «Probar la conexión».',
    loginUnclear:
      'El inicio de sesión en Total Connect Comfort ha dado tres veces una respuesta inesperada: intentos detenidos. Pulse «Probar la conexión» para reintentar.',
    unreachable: (reason) =>
      `No se puede acceder a Total Connect Comfort (${reason}). Nuevo intento en breve.`,
    noThermostat:
      'Conectado, pero no se ha encontrado ningún termostato en esta cuenta Total Connect Comfort.',
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    testOk: (count, names) => `Conectado: ${count} termostato(s) encontrado(s) (${names}).`,
    testNone: 'Conectado, pero esta cuenta no tiene ningún termostato.',
    invalid_value: 'Valor no válido.',
    setpoint_locked: 'Este termostato no acepta cambios de consigna en este momento.',
    out_of_range: ({ min, max, unit }) => `Consigna fuera de rango: de ${min} a ${max} °${unit}.`,
    mode_unsupported: 'Este termostato no ofrece este modo.',
    fan_unsupported: 'Este termostato no ofrece este ajuste del ventilador.',
    hold_unsupported: 'Este termostato no ofrece este mantenimiento.',
    vacation_read_only: 'El modo vacaciones se ajusta desde la aplicación Honeywell.',
    invalid_time: 'Hora no válida: use HH:MM, por ejemplo 22:30.',
    no_setpoint: 'Indique una consigna de calefacción o de refrigeración.',
    unknown_thermostat:
      'Termostato desconocido: inicie una nueva búsqueda en la pestaña Descubrimiento.',
    offline: 'El termostato no está conectado a Total Connect Comfort.',
    rejected: 'Total Connect Comfort ha rechazado el comando.',
    failed: (reason) => `El comando ha fallado: ${reason}.`,
  },
};

/** The messages of one language (French when unknown, the default). */
export const messagesFor = (language) => MESSAGES[language] ?? MESSAGES.fr;

/**
 * A multi-language object from a message key, for the texts Gladys localizes
 * itself (connection status, action results).
 * @param {string} key
 * @param {...unknown} args for the message functions
 */
export function localized(key, ...args) {
  return Object.fromEntries(
    LANGUAGES.map((lang) => {
      const message = MESSAGES[lang][key];
      return [lang, typeof message === 'function' ? message(...args) : message];
    }),
  );
}
