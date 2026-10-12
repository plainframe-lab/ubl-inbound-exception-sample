# Exception taxonomy / Classification des exceptions

Classification only: no transport, sleeping, retry loop, disk quarantine or ERP write.
Classification uniquement : aucun transport, attente, boucle de reprise, quarantaine sur disque ou import ERP.

| Code | Retryable | Action / Traitement | Test |
|---|---|---|---|
| REJECTED | false | Business review; never import / revue métier | T21 |
| DUPLICATE | false | Skip repeated import / ignorer le doublon | T22, T23, T38 |
| TIMEOUT | true | Bounded read retry / reprise de lecture limitée | T24 |
| UNAUTHORIZED | false | Review credentials manually / vérifier les accès | T25 |
| RATE_LIMITED | true | Defer read; Retry-After / différer la lecture | T26 |
| SCHEMA_MISMATCH | false | Quarantine and review mapping / revoir le mapping | T27–31, T37, T39–40 |
| UNSUPPORTED_FORMAT | false | Explicit adapter required / adaptateur explicite | T36 |
| FORBIDDEN | false | Review permissions / vérifier les permissions | T32 |
| NOT_FOUND | false | Reconcile invoice ID / rapprocher l’identifiant | T33 |
| UPSTREAM_ERROR | true | Bounded read retry / reprise de lecture limitée | T34 |
| NETWORK_ERROR | true | Bounded read retry / reprise de lecture limitée | T35 |
| HTTP_ERROR | false | Review response / examiner la réponse | T38 |

`RATE_LIMITED` accepts seconds or an HTTP date, defaults to 60 seconds and caps the local hint at 86400 seconds. `retryable` is advice, not an executed action. Business rejection differs from HTTP failure. Ledger keys are `(customerId, invoiceId)` and `(customerId, supplier.id, invoiceNumber)`; validation failures do not reserve a key. Storage is volatile and conversion-only.
