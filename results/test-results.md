# Résultats des essais locaux

Exécution : 2026-10-12T14:23:24.425Z; Node v22.17.1.
20 factures fictives, 40 cas, 40 réussis, 0 échoués. Aucun appel API.

| Cas | Description | Résultat |
|---|---|---|
| T01 | normalisation invoice-01.xml | OK |
| T02 | normalisation invoice-02.xml | OK |
| T03 | normalisation invoice-03.xml | OK |
| T04 | normalisation invoice-04.xml | OK |
| T05 | normalisation invoice-05.xml | OK |
| T06 | normalisation invoice-06.xml | OK |
| T07 | normalisation invoice-07.xml | OK |
| T08 | normalisation invoice-08.xml | OK |
| T09 | normalisation invoice-09.xml | OK |
| T10 | normalisation invoice-10.xml | OK |
| T11 | normalisation invoice-11.xml | OK |
| T12 | normalisation invoice-12.xml | OK |
| T13 | normalisation invoice-13.xml | OK |
| T14 | normalisation invoice-14.xml | OK |
| T15 | normalisation invoice-15.xml | OK |
| T16 | normalisation invoice-16.xml | OK |
| T17 | normalisation invoice-17.xml | OK |
| T18 | normalisation invoice-18.xml | OK |
| T19 | normalisation invoice-19.xml | OK |
| T20 | normalisation invoice-20.xml | OK |
| T21 | rejet métier distinct du rejet HTTP | OK |
| T22 | rediffusion du même identifiant PA | OK |
| T23 | doublon métier sous un nouvel identifiant PA | OK |
| T24 | délai dépassé et reprise possible | OK |
| T25 | HTTP 401 sans boucle automatique | OK |
| T26 | HTTP 429 et Retry-After | OK |
| T27 | champ ID manquant et correction sans empoisonner le registre | OK |
| T28 | devise discordante | OK |
| T29 | total payable incohérent | OK |
| T30 | XML tronqué, doublon de champ et limites | OK |
| T31 | DTD et entité externe bloquées | OK |
| T32 | HTTP 403 | OK |
| T33 | HTTP 404 | OK |
| T34 | HTTP 503 transitoire | OK |
| T35 | erreur réseau simulée | OK |
| T36 | formats CII et Factur-X hors périmètre | OK |
| T37 | URI de namespace usurpée | OK |
| T38 | HTTP 400 et 409 | OK |
| T39 | date, précision et identité de routage invalides | OK |
| T40 | champs non mappés bloqués et lignes incohérentes | OK |

Ces résultats ne prouvent ni validation XSD/Schematron ni intégration réelle avec SYNTH-PA ou un ERP.
