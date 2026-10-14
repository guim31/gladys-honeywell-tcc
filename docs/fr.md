# Honeywell Total Connect Comfort

## Présentation

Cette intégration amène dans Gladys les **thermostats Wi-Fi Honeywell /
Resideo** du portail **Total Connect Comfort**
([mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/portal),
États-Unis et Canada) : températures, humidité, consignes de chauffage et de
climatisation, mode du système, ventilation, maintien du programme et état de
fonctionnement, avec leurs commandes.

Chaque thermostat du compte devient un appareil Gladys, dans l'unité qu'affiche
le thermostat (°F ou °C).

> Développée sans le matériel : vos retours sont bienvenus. L'intégration
> s'appuie sur des réponses enregistrées du portail et est testée contre un
> portail simulé ; elle n'a pas encore été essayée sur un vrai thermostat.

Cette intégration n'est affiliée ni à Honeywell ni à Resideo.

## Prérequis

- Gladys Assistant 5.2.0 ou plus récent.
- Un compte Total Connect Comfort (celui de l'application « Total Connect
  Comfort ») avec au moins un thermostat, par exemple RTH6580WF, RTH8580WF,
  RTH9580WF, TH6320WF, TH8320WF ou les VisionPRO Wi-Fi.
- **Non pris en charge** : les thermostats Lyric et série T (T5, T6, T9, T10),
  et tout thermostat géré par l'application « Resideo » / « Honeywell Home ».
  Ils utilisent un autre cloud. Le portail européen Evohome n'est pas pris en
  charge non plus.

## Configuration

Dans Gladys, ouvrez **Intégrations → Honeywell Total Connect** et renseignez :

- **Adresse e-mail** et **Mot de passe** : ceux de votre compte Total Connect
  Comfort.
- **Lire le portail toutes les** : 2, 5 (par défaut), 10 ou 15 minutes.
- **Langue des noms de fonctionnalités** : les noms donnés aux fonctionnalités
  quand un thermostat est ajouté à Gladys, et la langue des messages (français
  par défaut).

Cliquez sur **Tester la connexion** : l'intégration se connecte une fois et
liste les thermostats trouvés. Ouvrez ensuite l'onglet **Découverte** et
ajoutez vos thermostats.

**À propos des verrouillages de compte.** Le portail verrouille un compte après
trop d'échecs de connexion, et un compte verrouillé vous bloque aussi dans
l'application Honeywell. L'intégration **ne réessaie donc jamais seule un mot de
passe refusé** : elle attend que vous enregistriez de nouveaux identifiants ou
que vous cliquiez sur **Tester la connexion**. Une réponse de connexion qu'elle
ne comprend pas est réessayée au plus toutes les 10 minutes, trois fois, puis
elle s'arrête de la même façon. La session est gardée dans `/data` (le volume
privé de l'intégration) : un redémarrage de Gladys ne demande pas de nouvelle
connexion.

## Appareils et fonctionnalités

Un appareil par thermostat, avec les fonctionnalités qu'il possède :

| Fonctionnalité                              | Ce que c'est                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Température intérieure                      | La température que mesure le thermostat.                                                                                                |
| Humidité intérieure                         | Quand le thermostat a un capteur d'humidité.                                                                                            |
| Température extérieure, humidité extérieure | Quand une sonde extérieure est reliée au thermostat.                                                                                    |
| Consigne de chauffage, de climatisation     | Pilotables, au °F entier ou au demi-°C, dans les limites du thermostat.                                                                 |
| Mode du système                             | Arrêt, chauffage, climatisation, auto (les modes que le thermostat autorise). Le chauffage d'urgence se lit « chauffage ».              |
| Chauffage d'urgence                         | Pompes à chaleur seulement. L'éteindre revient au « chauffage », jamais à l'« arrêt ».                                                  |
| État de fonctionnement                      | Au repos, chauffe ou refroidit (absent quand le thermostat ne le transmet pas).                                                         |
| Ventilation, ventilation en marche          | Auto, marche, brassage, selon le programme (ceux que propose le thermostat), et si le ventilateur tourne.                               |
| Maintien du programme                       | Suivre le programme, jusqu'à la période suivante, maintien permanent ; un maintien vacances s'affiche mais se règle dans l'application. |

Comme sur le thermostat lui-même, changer une consigne pendant que le programme
tourne la maintient **jusqu'à la période suivante du programme**. Utilisez
**Maintien du programme** pour la rendre permanente ou rendre le thermostat à
son programme.

Une commande part aussitôt, s'affiche aussitôt, et le thermostat est relu
environ 15 secondes après.

## Widget du tableau de bord

**Thermostat Honeywell** : choisissez un thermostat dans ses réglages. Il
affiche les températures intérieure et extérieure, l'humidité et les consignes
en usage (tuiles en direct), puis le mode, ce que fait l'équipement, la
ventilation, le maintien et la connexion. Boutons :

- **Régler** : un court formulaire avec les consignes du mode en cours,
  pré-remplies, et leur durée de maintien (jusqu'à la période suivante, ou
  jusqu'à la reprise du programme).
- **Reprendre le prog.** pendant un maintien, ou **Maintenir** pour garder les
  consignes en cours.

Le widget thermostat de Gladys (tableau de bord) fonctionne aussi avec ces
thermostats : créez un thermostat « externe » dans l'intégration thermostat de
Gladys et faites-le pointer sur la consigne de chauffage.

## Déclencheurs de scène

- **Connexion au thermostat perdue** : Gladys ne joint plus un thermostat.
  Filtrez sur le thermostat et sur la cause : `thermostat_offline` (le
  thermostat a perdu son Wi-Fi), `portal_unreachable` (le portail n'a pas
  répondu trois lectures de suite) ou `login_refused` (le portail a refusé la
  connexion). Variables : `thermostat_name`, `cause`.
- **Connexion au thermostat rétablie** : le thermostat répond de nouveau.
  Variable : `thermostat_name`.

## Action de scène

**Maintenir une température jusqu'à une heure** : un maintien temporaire sur un
thermostat, qui revient seul à son programme à l'heure donnée (heure du
thermostat, arrondie au quart d'heure supérieur). Laissez une consigne vide pour
la garder. Sortie : `until`, la fin du maintien (HH:MM).

## Exemples de scènes

- **Des invités ce soir** : le samedi à 18 h, « Maintenir une température
  jusqu'à une heure » avec une consigne de chauffage de 72 jusqu'à 23:30. Le
  programme reprend tout seul.
- **Tout le monde est parti** : quand la maison se vide, réglez **Maintien du
  programme** sur « Maintien permanent » et la consigne de chauffage sur 62 ;
  au retour de quelqu'un, réglez **Maintien du programme** sur « Suivre le
  programme ».
- **Alerte chauffage** : sur « Connexion au thermostat perdue » avec la cause
  `thermostat_offline`, envoyez le message
  « {{triggerEvent.data.thermostat_name}} est hors ligne ».

## Rafraîchissement et limites du portail

Total Connect Comfort n'a pas d'API publique : l'intégration utilise le portail
web comme le ferait un navigateur. Le portail ne publie aucun quota, mais il est
lent et verrouille les comptes qu'il trouve trop actifs. Donc :

- chaque thermostat ajouté à Gladys est lu une fois par période (5 minutes par
  défaut, 2 au plus rapide ; Home Assistant lit toutes les 30 secondes) ;
- la liste du compte n'est lue qu'au démarrage, après un changement de
  configuration et lors d'une nouvelle recherche dans l'onglet Découverte ;
- les requêtes partent une à une, et seul ce qui change est envoyé à Gladys
  (une valeur inchangée est renvoyée toutes les 6 heures pour ne jamais paraître
  périmée).

L'intégration se rafraîchit seule, par son propre minuteur : elle ne dépend pas
de l'interrogation du cœur de Gladys.

## Dépannage

- **« Total Connect Comfort a refusé l'adresse e-mail ou le mot de passe »** :
  vérifiez-les sur [mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/portal),
  puis enregistrez-les de nouveau dans Gladys.
- **« Le compte est verrouillé »** : attendez que le portail le déverrouille
  (connectez-vous sur le site pour vérifier), puis cliquez sur **Tester la
  connexion**.
- **« Total Connect Comfort est injoignable »** : le portail est en panne ou
  lent ; l'intégration réessaie à chaque période.
- **Un thermostat apparaît « injoignable »** : il a perdu son Wi-Fi ;
  vérifiez-le dans l'application Total Connect Comfort.
- **Aucun thermostat trouvé** : le compte est peut-être un compte Resideo /
  Honeywell Home (Lyric, série T), que cette intégration ne prend pas en charge.
- Journaux : mettez `LOG_LEVEL=debug` pour voir chaque lecture. Les mots de
  passe et les cookies de session n'y sont jamais écrits.

## Limites

- Développée sans le matériel : vos retours sont bienvenus.
- Portail des États-Unis et du Canada seulement ; pas de Lyric, de série T,
  d'application Resideo ni d'Evohome.
- Humidificateurs, déshumidificateurs, programmes et maintiens vacances ne sont
  pas gérés (un maintien vacances s'affiche, sans se régler).
- Les heures sont celles du thermostat ; le portail compte en quarts d'heure.
- Le portail n'est pas une API officielle : Honeywell / Resideo peut le modifier
  sans prévenir.
