# Honeywell Total Connect Comfort

## Presentación

Esta integración trae a Gladys los **termostatos Wi-Fi Honeywell / Resideo**
del portal **Total Connect Comfort**
([mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/portal), Estados
Unidos y Canadá): temperaturas, humedad, consignas de calefacción y de
refrigeración, modo del sistema, ventilador, mantenimiento del programa y
estado de funcionamiento, con sus órdenes.

Cada termostato de la cuenta se convierte en un dispositivo de Gladys, en la
unidad que muestra el termostato (°F o °C).

> Desarrollada sin el hardware: sus comentarios son bienvenidos. La integración
> se basa en respuestas grabadas del portal y se prueba contra un portal
> simulado; todavía no se ha probado con un termostato real.

Esta integración no está afiliada a Honeywell ni a Resideo.

## Requisitos

- Gladys Assistant 5.2.0 o posterior.
- Una cuenta Total Connect Comfort (la de la aplicación «Total Connect
  Comfort») con al menos un termostato, por ejemplo RTH6580WF, RTH8580WF,
  RTH9580WF, TH6320WF, TH8320WF o los VisionPRO Wi-Fi.
- **No compatibles**: los termostatos Lyric y serie T (T5, T6, T9, T10), y
  cualquier termostato gestionado por la aplicación «Resideo» / «Honeywell
  Home». Usan otra nube. El portal europeo Evohome tampoco es compatible.

## Configuración

En Gladys, abra **Integraciones → Honeywell Total Connect** e introduzca:

- **Dirección de correo** y **Contraseña**: las de su cuenta Total Connect
  Comfort.
- **Leer el portal cada**: 2, 5 (por defecto), 10 o 15 minutos.
- **Idioma de los nombres de funciones**: los nombres que reciben las funciones
  cuando se añade un termostato a Gladys, y el idioma de los mensajes (francés
  por defecto).

Pulse **Probar la conexión**: la integración inicia sesión una vez y muestra
los termostatos encontrados. Después abra la pestaña **Descubrimiento** y añada
sus termostatos.

**Sobre los bloqueos de cuenta.** El portal bloquea una cuenta tras demasiados
inicios de sesión fallidos, y una cuenta bloqueada también le impide usar la
aplicación Honeywell. Por eso la integración **nunca vuelve a probar por sí sola
una contraseña rechazada**: espera a que guarde nuevas credenciales o pulse
**Probar la conexión**. Una respuesta de inicio de sesión que no entiende se
reintenta como mucho cada 10 minutos, tres veces, y luego se detiene del mismo
modo. La sesión se guarda en `/data` (el volumen privado de la integración): un
reinicio de Gladys no necesita un nuevo inicio de sesión.

## Dispositivos y funciones

Un dispositivo por termostato, con las funciones que tiene:

| Función                                   | Qué es                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Temperatura interior                      | La temperatura que mide el termostato.                                                                                                   |
| Humedad interior                          | Cuando el termostato tiene un sensor de humedad.                                                                                         |
| Temperatura exterior, humedad exterior    | Cuando hay una sonda exterior conectada al termostato.                                                                                   |
| Consigna de calefacción, de refrigeración | Controlables, en °F enteros o medios °C, dentro de los límites del termostato.                                                           |
| Modo del sistema                          | Apagado, calefacción, refrigeración, auto (los modos que permite el termostato). La calefacción de emergencia se lee como «calefacción». |
| Calefacción de emergencia                 | Solo bombas de calor. Al apagarla se vuelve a «calefacción», nunca a «apagado».                                                          |
| Estado de funcionamiento                  | En reposo, calentando o enfriando (ausente cuando el termostato no lo informa).                                                          |
| Ventilador, ventilador en marcha          | Auto, encendido, recircular, según el programa (los que ofrece el termostato), y si el ventilador funciona.                              |
| Mantener el programa                      | Seguir el programa, hasta el siguiente período, mantener siempre; el modo vacaciones se muestra pero solo se ajusta en la aplicación.    |

Como en el propio termostato, cambiar una consigna mientras el programa está en
marcha la mantiene **hasta el siguiente período del programa**. Use **Mantener
el programa** para hacerla permanente o devolver el termostato a su programa.

Una orden se envía al instante, se muestra al instante, y el termostato se
vuelve a leer unos 15 segundos después.

## Widget del panel

**Termostato Honeywell**: elija un termostato en sus ajustes. Muestra las
temperaturas interior y exterior, la humedad y las consignas en uso (casillas
en directo), y después el modo, lo que hace el equipo, el ventilador, el
mantenimiento y la conexión. Botones:

- **Ajustar**: un breve formulario con las consignas del modo actual,
  rellenadas de antemano, y cuánto tiempo se mantienen (hasta el siguiente
  período, o hasta que reanude el programa).
- **Reanudar programa** durante un mantenimiento, o **Mantener** para conservar
  las consignas actuales.

El widget de termostato de Gladys (panel) también funciona con estos
termostatos: cree un termostato «externo» en la integración de termostatos de
Gladys y apúntelo a la consigna de calefacción.

## Disparadores de escena

- **Conexión con el termostato perdida**: Gladys ya no alcanza un termostato.
  Filtre por termostato y por causa: `thermostat_offline` (el termostato perdió
  su Wi-Fi), `portal_unreachable` (el portal no respondió tres lecturas
  seguidas) o `login_refused` (el portal rechazó el inicio de sesión).
  Variables: `thermostat_name`, `cause`.
- **Conexión con el termostato restablecida**: el termostato vuelve a
  responder. Variable: `thermostat_name`.

## Acción de escena

**Mantener una temperatura hasta una hora**: un mantenimiento temporal en un
termostato, que vuelve solo a su programa a la hora indicada (hora del
termostato, redondeada al cuarto de hora siguiente). Deje una consigna vacía
para conservarla. Salida: `until`, el fin del mantenimiento (HH:MM).

## Ejemplos de escenas

- **Invitados esta noche**: el sábado a las 18 h, «Mantener una temperatura
  hasta una hora» con una consigna de calefacción de 72 hasta las 23:30. El
  programa se reanuda solo.
- **Todos se han ido**: cuando la casa se queda vacía, ponga **Mantener el
  programa** en «Mantener siempre» y la consigna de calefacción en 62; cuando
  alguien vuelva, ponga **Mantener el programa** en «Seguir el programa».
- **Alerta de calefacción**: con «Conexión con el termostato perdida» y la causa
  `thermostat_offline`, envíe el mensaje
  «{{triggerEvent.data.thermostat_name}} está sin conexión».

## Actualización y límites del portal

Total Connect Comfort no tiene API pública: la integración usa el portal web
como lo haría un navegador. El portal no publica ninguna cuota, pero es lento y
bloquea las cuentas que considera demasiado activas. Por eso:

- cada termostato añadido a Gladys se lee una vez por período (5 minutos por
  defecto, 2 como mínimo; Home Assistant lee cada 30 segundos);
- la lista de la cuenta solo se lee al arrancar, tras un cambio de
  configuración y en una nueva búsqueda en la pestaña Descubrimiento;
- las peticiones salen de una en una, y solo se envía a Gladys lo que cambia
  (un valor sin cambios se reenvía cada 6 horas para que nunca parezca
  antiguo).

La integración se actualiza sola, con su propio temporizador: no depende del
sondeo del núcleo de Gladys.

## Solución de problemas

- **«Total Connect Comfort ha rechazado la dirección de correo o la
  contraseña»**: compruébelas en [mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/portal)
  y guárdelas de nuevo en Gladys.
- **«La cuenta está bloqueada»**: espere a que el portal la desbloquee (inicie
  sesión en el sitio web para comprobarlo) y pulse **Probar la conexión**.
- **«No se puede acceder a Total Connect Comfort»**: el portal no funciona o va
  lento; la integración lo vuelve a intentar en cada período.
- **Un termostato aparece «inaccesible»**: perdió su Wi-Fi; compruébelo en la
  aplicación Total Connect Comfort.
- **No se encuentra ningún termostato**: puede que la cuenta sea una cuenta
  Resideo / Honeywell Home (Lyric, serie T), que esta integración no admite.
- Registros: ponga `LOG_LEVEL=debug` para ver cada lectura. Las contraseñas y
  las cookies de sesión nunca se escriben en los registros.

## Limitaciones

- Desarrollada sin el hardware: sus comentarios son bienvenidos.
- Solo el portal de Estados Unidos y Canadá; no Lyric, serie T, aplicación
  Resideo ni Evohome.
- No se gestionan humidificadores, deshumidificadores, programas ni el modo
  vacaciones (el modo vacaciones se muestra, no se ajusta).
- Las horas son las del termostato; el portal cuenta en cuartos de hora.
- El portal no es una API oficial: Honeywell / Resideo puede cambiarlo sin
  previo aviso.
