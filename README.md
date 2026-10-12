# X02 — Conversion locale de factures synthétiques

[English](README.en.md)

Exemple technique hors ligne : conversion d’un sous-ensemble UBL 2.1 vers un JSON ERP et classification des exceptions. Les vingt factures sont inventées. `SYNTH-PA` est une étiquette fictive, sans fournisseur réel ni intégration certifiée.

## Exécuter

Node 22.17.1 ou ultérieur dans la branche 22 ; aucune dépendance à installer.

```sh
npm test
```

Les 40 cas vérifient 20 conversions par égalité profonde et 20 groupes d’exceptions. Les résultats sont réécrits dans `results/`. Les erreurs HTTP et réseau sont simulées ; aucun appel distant n’est effectué. L’exécution TypeScript utilise `--experimental-strip-types` ; aucune vérification statique des types n’est fournie.

Pour régénérer les données avec Python 3 :

```sh
python3 fixtures/generate.py
npm test
```

## Utiliser une donnée fictive

```js
import { readFileSync } from 'node:fs';
import { createReceiver } from './src/index.ts';
const result = createReceiver().receive({
  customerId: 'SYNTH-TENANT-A', invoiceId: 'SYNTH-PA-001',
  format: 'UBL', lifecycle: 'READY',
  xml: readFileSync('fixtures/invoice-01.xml', 'utf8')
});
console.log(result);
```

Exécuter ce code dans un fichier `.mjs` avec le même indicateur Node. `Delivery` est une enveloppe locale, pas un contrat d’API. Les montants et prix unitaires des fixtures servent uniquement aux calculs de test.

## Contenu et limites

- `src/` : conversion pure, lecteur XML restreint, registre mémoire par client.
- `fixtures/` : vingt fichiers XML, attentes JSON indépendantes et générateur.
- `test/` et `results/` : essais et résultats locaux.
- [Contrat technique](docs/technical-scope.md) et [exceptions](docs/exceptions.md).
- [Examen des droits](docs/rights-review.md) et [proposition MIT](LICENSE.proposed.txt).

Profil limité : Invoice 380, EUR, C62, 1–100 lignes et totaux simples. Les champs hors mapping sont rejetés. Aucun validateur XSD/Schematron ni certification EN16931, CII ou Factur-X. Le lecteur XML n’est pas général. Le registre disparaît au redémarrage ; une conversion réussie ne confirme aucun import ERP. Aucun mécanisme de reprise automatique n’est implémenté.

## Statut des droits

Préparation locale. La proposition MIT attend la confirmation du titulaire `{事業者名}` et l’autorisation de diffusion. `private: true` et `UNLICENSED` conservent ce statut dans les métadonnées ; la proposition ne constitue pas une autorisation déjà acquise. Voir les points non confirmés dans l’examen des droits.
