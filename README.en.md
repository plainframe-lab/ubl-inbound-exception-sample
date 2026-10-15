# X02 — Local synthetic invoice conversion

[Français](README.md)

An offline technical example converting a restricted UBL 2.1 subset into ERP JSON and classifying exceptions. All twenty invoices are invented. `SYNTH-PA` is a fictional source label, with no real provider or certified integration.

## Run

Use Node 22.17.1 or later in the Node 22 branch. No dependency installation is needed.

```sh
npm test
```

The 40 cases cover 20 deep-equality conversions and 20 exception groups. Tests rewrite `results/`. HTTP and network failures are simulated; no remote requests are made. TypeScript runs with `--experimental-strip-types`; static type checking is not included.

Regenerate fixtures with Python 3:

```sh
python3 fixtures/generate.py
npm test
```

## Try a fictional invoice

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

Save this as an `.mjs` file and run with the same Node flag. `Delivery` is a local envelope, not an API contract. Fixture amounts and unit prices exist solely to exercise arithmetic.

## Contents and limits

- `src/`: conversion, restricted XML reader, tenant-scoped memory ledger.
- `fixtures/`: twenty XML files, independently generated expected JSON, generator.
- `test/` and `results/`: local tests and their results.
- [Technical scope in French](docs/technical-scope.md) and [exception taxonomy](docs/exceptions.md).
- [Rights review](docs/rights-review.md) and [MIT license](LICENSE).

Restricted profile: Invoice 380, EUR, C62, 1–100 lines, simple totals. Unmapped fields are rejected. No XSD/Schematron validation or EN16931 certification, CII or Factur-X support. The XML reader is deliberately incomplete. The ledger is lost on restart; successful conversion does not establish an ERP import. No automatic retries are implemented.

## Rights status

Released under the MIT License (holder: plainframe-lab). On 2026-10-16 the holder confirmed authorship, no employment-related restriction, and permission to distribute. `private: true` only prevents accidental publication to npm.