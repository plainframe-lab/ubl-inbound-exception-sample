import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createReceiver,classify} from '../src/index.ts';

// Every runtime network primitive used by this project is forbidden in tests.
globalThis.fetch=()=>{throw new Error('Network forbidden');};
const fixtures=JSON.parse(readFileSync(new URL('../fixtures/manifest.json',import.meta.url),'utf8'));
const load=f=>({...f.delivery,xml:readFileSync(new URL('../fixtures/'+f.file,import.meta.url),'utf8')});
const base=load(fixtures[0]);
const rows=[];
const normalized=[];
function checked(id,title,fn) {
  test(`${id} ${title}`,()=>{
    try {fn();rows.push({id,title,passed:true});}
    catch(e) {rows.push({id,title,passed:false,error:e.message});throw e;}
  });
}
function expect(code,overrides={},receiver=createReceiver()) {
  const result=receiver.receive({...base,...overrides});
  assert.equal(result.ok,false);assert.equal(result.exception.code,code);return result.exception;
}
fixtures.forEach((f,i)=>checked(`T${String(i+1).padStart(2,'0')}`,`normalisation ${f.file}`,()=>{
  const result=createReceiver().receive(load(f));
  assert.deepEqual(result,{ok:true,invoice:f.expected});
  normalized.push(result.invoice);
}));
checked('T21','rejet métier distinct du rejet HTTP',()=>{assert.equal(expect('REJECTED',{lifecycle:'REJECTED'}).retryable,false);});
checked('T22','rediffusion du même identifiant PA',()=>{
  const r=createReceiver();assert.equal(r.receive(base).ok,true);expect('DUPLICATE',{},r);
  // Tenant isolation: identical source/business identifiers are valid in another tenant.
  assert.equal(r.receive({...base,customerId:'SYNTH-TENANT-B'}).ok,true);
});
checked('T23','doublon métier sous un nouvel identifiant PA',()=>{
  const r=createReceiver();r.receive(base);expect('DUPLICATE',{invoiceId:'SYNTH-NEW-PA-ID'},r);
  // Same number, different supplier is NOT a duplicate.
  assert.equal(r.receive({...base,invoiceId:'OTHER',xml:base.xml.replace('SYNTH-SUP-01','OTHER-SYNTH-SUP')}).ok,true);
});
checked('T24','délai dépassé et reprise possible',()=>{
  const r=createReceiver();assert.equal(expect('TIMEOUT',{failure:'TIMEOUT'},r).retryable,true);assert.equal(r.receive(base).ok,true);
});
checked('T25','HTTP 401 sans boucle automatique',()=>{assert.equal(expect('UNAUTHORIZED',{httpStatus:401}).retryable,false);});
checked('T26','HTTP 429 et Retry-After',()=>{
  assert.equal(expect('RATE_LIMITED',{httpStatus:429,retryAfter:'120'}).retryAfterSeconds,120);
  assert.equal(classify('RATE_LIMITED','Sun, 04 Oct 2026 04:01:00 GMT',Date.parse('2026-10-04T04:00:00Z')).retryAfterSeconds,60);
  assert.equal(classify('RATE_LIMITED','bad').retryAfterSeconds,60);
  assert.equal(classify('RATE_LIMITED','999999').retryAfterSeconds,86400);
});
checked('T27','champ ID manquant et correction sans empoisonner le registre',()=>{
  const r=createReceiver();expect('SCHEMA_MISMATCH',{xml:base.xml.replace('<cbc:ID>SYNTH-2026-001</cbc:ID>','')},r);assert.equal(r.receive(base).ok,true);
});
checked('T28','devise discordante',()=>{expect('SCHEMA_MISMATCH',{xml:base.xml.replace('currencyID="EUR"','currencyID="USD"')});});
checked('T29','total payable incohérent',()=>{expect('SCHEMA_MISMATCH',{xml:base.xml.replace(/(<cbc:PayableAmount[^>]*>)[^<]+/,(_, opening)=>opening+'999.00')});});
checked('T30','XML tronqué, doublon de champ et limites',()=>{
  expect('SCHEMA_MISMATCH',{xml:base.xml.slice(0,-15)});
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('<cbc:ID>SYNTH-2026-001</cbc:ID>','<cbc:ID>X</cbc:ID><cbc:ID>Y</cbc:ID>')});
  expect('SCHEMA_MISMATCH',{xml:'x'.repeat(262145)});
  expect('SCHEMA_MISMATCH',{xml:'<a>'.repeat(33)+'</a>'.repeat(33)});
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('Atelier fictif','&unrecognized;')});
});
checked('T31','DTD et entité externe bloquées',()=>{expect('SCHEMA_MISMATCH',{xml:'<!DOCTYPE Invoice [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+base.xml});});
checked('T32','HTTP 403',()=>{expect('FORBIDDEN',{httpStatus:403});});
checked('T33','HTTP 404',()=>{expect('NOT_FOUND',{httpStatus:404});});
checked('T34','HTTP 503 transitoire',()=>{assert.equal(expect('UPSTREAM_ERROR',{httpStatus:503}).retryable,true);});
checked('T35','erreur réseau simulée',()=>{assert.equal(expect('NETWORK_ERROR',{failure:'NETWORK_ERROR'}).retryable,true);});
checked('T36','formats CII et Factur-X hors périmètre',()=>{expect('UNSUPPORTED_FORMAT',{format:'CII'});expect('UNSUPPORTED_FORMAT',{format:'Factur-X'});});
checked('T37','URI de namespace usurpée',()=>{
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('CommonBasicComponents-2','FakeBasicComponents-2')});
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('schema:xsd:Invoice-2','schema:xsd:CreditNote-2')});
});
checked('T38','HTTP 400 et 409',()=>{expect('HTTP_ERROR',{httpStatus:400});expect('DUPLICATE',{httpStatus:409});});
checked('T39','date, précision et identité de routage invalides',()=>{
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('2026-10-04','2026-02-30')});
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('>1.01<','>1.001<')});
  expect('SCHEMA_MISMATCH',{customerId:''});
});
checked('T40','champs non mappés bloqués et lignes incohérentes',()=>{
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('</Invoice>','<cac:AllowanceCharge/></Invoice>')});
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('<cbc:ID>SYNTH-SUP-01','<cbc:ID schemeID="unknown">SYNTH-SUP-01')});
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('>1.01<','>9.01<')});
  expect('SCHEMA_MISMATCH',{xml:base.xml.replace('>1</cbc:InvoicedQuantity>','>0</cbc:InvoicedQuantity>')});
});
after(()=>{
  writeFileSync(new URL('../results/normalized-invoices.json',import.meta.url),JSON.stringify(normalized,null,2)+'\n');
  const report={generatedAt:new Date().toISOString(),node:process.version,network:'forbidden; mock envelopes only',fixtureCount:fixtures.length,testCount:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length,cases:rows};
  writeFileSync(new URL('../results/test-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  writeFileSync(new URL('../results/test-results.md',import.meta.url),`# Résultats des essais locaux\n\nExécution : ${report.generatedAt}; Node ${report.node}.\n20 factures fictives, ${report.testCount} cas, ${report.passed} réussis, ${report.failed} échoués. Aucun appel API.\n\n| Cas | Description | Résultat |\n|---|---|---|\n`+rows.map(r=>`| ${r.id} | ${r.title} | ${r.passed?'OK':'ÉCHEC'} |`).join('\n')+'\n\nCes résultats ne prouvent ni validation XSD/Schematron ni intégration réelle avec SYNTH-PA ou un ERP.\n');
});
