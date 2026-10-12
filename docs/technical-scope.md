# Contrat technique du prototype

Le module TypeScript s'exécute sur Node **22.17.1**, sans dépendance ni installation. Node supprime les types avec `--experimental-strip-types` ; **aucune vérification statique `tsc` n'a été exécutée**. Cette exécution utilise une fonction expérimentale de Node 22.

## Entrée locale et sortie ERP

`Delivery` est une enveloppe du mock, construite par le client de test. Elle contient `customerId`, `invoiceId`, `format`, `xml`, et éventuellement `lifecycle`, `httpStatus`, `failure`, `retryAfter`. Ce n'est pas le JSON officiel d'SYNTH-PA. Les identifiants des fixtures commencent par `SYNTH-` ; ils ne sont ni des UUID PA ni des identifiants fiscaux valides.

```js
import { createReceiver } from './src/index.ts';
const receiver = createReceiver();
const result = receiver.receive({
  customerId: 'SYNTH-TENANT-A', invoiceId: 'SYNTH-PA-001',
  format: 'UBL', lifecycle: 'READY', xml: '<Invoice …>…</Invoice>'
});
// result.ok === true : JSON ERP dans result.invoice
// result.ok === false : code, retryable et action dans result.exception
```

Le contenu XML abrégé dans l'exemple doit être remplacé par un fichier de `fixtures/`. La sortie complète attendue pour chacune des 20 factures est dans `fixtures/manifest.json`, vérifiée par égalité profonde contre la sortie réelle.

| Champ ERP | Source UBL |
|---|---|
| invoiceNumber / issueDate / dueDate facultative | ID / IssueDate / DueDate |
| supplier / customer | AccountingSupplierParty / AccountingCustomerParty → PartyIdentification.ID et PartyName.Name |
| lines | InvoiceLine : ID, InvoicedQuantity, Item.Name, Price.PriceAmount, LineExtensionAmount |
| totals.net / tax / gross / payable | LegalMonetaryTotal.TaxExclusiveAmount / TaxTotal.TaxAmount / TaxInclusiveAmount / PayableAmount |
| source | PA constante et identifiants de l'enveloppe locale |

Montants en chaînes décimales à deux chiffres, calculs en `bigint` de centimes. Quantité positive, jusqu'à trois décimales ; prix à deux décimales ; montant de ligne arrondi au centime, demi supérieur. La somme des lignes doit égaler le net ; net + taxe = brut = payable. Les namespaces sont comparés par URI, et non par nom de préfixe. Les variantes de préfixes et l'entité `&amp;` font partie des fixtures.

## Profil volontairement limité

UBL 2.1 Invoice, type 380, EUR, unité C62, une identification simple par partie, 1 à 100 lignes, un TaxTotal agrégé. Tous les champs XML non prévus dans la liste du module sont rejetés. Les factures synthétiques utilisent un CustomizationID propre au test : **elles ne sont pas certifiées EN16931 ni adaptées à une émission réglementaire**.

Avoirs, CII, PDF Factur-X, ventilation TVA, adresses, schemeID des identifiants, moyens de paiement, remises, acomptes, arrondis globaux et autres unités/devises sont hors périmètre. Les montants de taxe sont contrôlés par cohérence des totaux ; le taux légal et les catégories TVA ne sont pas validés. Le lecteur XML réduit exclut CDATA, instructions de traitement et DTD. Il limite taille (256 KiB), profondeur (32) et nombre d'éléments (10 000). Ce lecteur n'est pas un validateur XML général : prévoir un parseur maintenu et des validations XSD/Schematron pour une version de production.

## Exceptions et reprise

| Code | Traitement proposé |
|---|---|
| REJECTED | Revue métier, aucun import |
| DUPLICATE | Aucun second import |
| TIMEOUT / NETWORK_ERROR / UPSTREAM_ERROR | Lecture à reprendre avec limite de tentatives |
| UNAUTHORIZED / FORBIDDEN | Vérifier les accès, aucune boucle automatique |
| RATE_LIMITED | Différer ; Retry-After secondes ou date HTTP, défaut 60 s, plafond local 86 400 s |
| SCHEMA_MISMATCH / UNSUPPORTED_FORMAT | Quarantaine et correction explicite |
| NOT_FOUND / HTTP_ERROR | Rapprochement ou revue manuelle |

La classification n'effectue **aucune** reprise, attente, mise en quarantaine sur disque, authentification ou requête. Le statut métier `REJECTED` est distinct d'une réponse HTTP en échec. Aucun message de statut n'est envoyé à SYNTH-PA.

Deux clés de dédoublonnage : `(customerId, invoiceId)` et `(customerId, supplier.id, invoiceNumber)`, sérialisées sans ambiguïté en JSON. Le registre mémoire n'est rempli qu'après validation réussie ; il est isolé par client. Il disparaît au redémarrage. La première réception réussie marque seulement la conversion, **pas la réussite d'un import ERP** : une transaction durable avec contrainte unique/outbox et accusé ERP est indispensable avant production.

## Plan d'une intégration ultérieure (non exécuté)

1. Confirmer les originaux UBL entrants et le schéma de métadonnées ; traduire les vrais statuts en états locaux.
2. Séparer transport authentifié, décodage binaire, conversion pure et import ERP ; gérer les secrets hors git.
3. Valider un profil français réel, compléter le mapping et faire échouer tout champ non pris en charge.
4. Ajouter idempotence durable, réception concurrente, budget de reprises et surveillance sans journaliser le XML.
5. Accuser réception PA seulement après engagement ERP ; tester sandbox et reprise après panne avec autorisation distincte.

Référence structure UBL : [OASIS UBL 2.1](https://docs.oasis-open.org/ubl/os-UBL-2.1/UBL-2.1.html), accès 2026-10-05 via consultation de la source officielle. Les limites du prototype sont des choix internes, pas des exigences de cette norme.
