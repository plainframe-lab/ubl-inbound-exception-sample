import { parseXml, requireValue, SchemaError } from './xml.ts';
import type { XmlNode } from './xml.ts';

const UBL='urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
const CAC='urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const CBC='urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
export type ExceptionCode='REJECTED'|'DUPLICATE'|'TIMEOUT'|'UNAUTHORIZED'|'RATE_LIMITED'|'SCHEMA_MISMATCH'|'UNSUPPORTED_FORMAT'|'FORBIDDEN'|'NOT_FOUND'|'UPSTREAM_ERROR'|'NETWORK_ERROR'|'HTTP_ERROR';
export type Exception={ code:ExceptionCode; retryable:boolean; action:string; retryAfterSeconds?:number };
export type NormalizedInvoice={ schemaVersion:'x02.erp.v1'; source:{pa:'SYNTH-PA';customerId:string;invoiceId:string;format:'UBL'}; invoiceNumber:string; issueDate:string; dueDate?:string; currency:'EUR'; supplier:{id:string;name:string}; customer:{id:string;name:string}; lines:{id:string;description:string;quantity:string;unitCode:string;unitPrice:string;net:string}[]; totals:{net:string;tax:string;gross:string;payable:string} };
export type Result={ok:true;invoice:NormalizedInvoice}|{ok:false;exception:Exception};
// Local adapter envelope. This is NOT asserted to be SYNTH-PA's wire JSON schema.
export type Delivery={customerId:string;invoiceId:string;format:string;xml:string; lifecycle?:'READY'|'REJECTED'; httpStatus?:number; retryAfter?:string; failure?:'TIMEOUT'|'NETWORK_ERROR'};
export function classify(code:ExceptionCode, retryAfter?:string, now=Date.now()): Exception {
  const actions:Record<ExceptionCode,string>={REJECTED:'manual business review; never import',DUPLICATE:'skip import',TIMEOUT:'retry bounded read',UNAUTHORIZED:'renew credentials manually before retry',RATE_LIMITED:'defer bounded read; honor Retry-After',SCHEMA_MISMATCH:'quarantine; review mapping',UNSUPPORTED_FORMAT:'quarantine; add explicit format adapter',FORBIDDEN:'review permissions',NOT_FOUND:'reconcile invoice identifier',UPSTREAM_ERROR:'retry bounded read',NETWORK_ERROR:'retry bounded read',HTTP_ERROR:'review HTTP response'};
  const result:Exception={code,retryable:['TIMEOUT','RATE_LIMITED','UPSTREAM_ERROR','NETWORK_ERROR'].includes(code),action:actions[code]};
  if(code==='RATE_LIMITED') {
    const n=retryAfter && /^\d+$/.test(retryAfter)?Number(retryAfter):Math.ceil((Date.parse(retryAfter??'')-now)/1000);
    result.retryAfterSeconds=Number.isFinite(n)&&n>=0?Math.min(n,86400):60;
  }
  return result;
}
function children(n:XmlNode, name:string, uri:string):XmlNode[] {return n.children.filter(x=>x.name===name && x.uri===uri);}
function one(n:XmlNode,name:string,uri:string,optional=false):XmlNode|undefined {
  const found=children(n,name,uri); requireValue(found.length===(optional && !found.length?0:1),`cardinality ${name}`); return found[0];
}
function value(n:XmlNode):string {requireValue(!n.children.length && n.text.trim(),`scalar ${n.name}`);return n.text.trim();}
function text(n:XmlNode,name:string,optional=false):string|undefined {const x=one(n,name,CBC,optional);return x?value(x):undefined;}
function aggregate(n:XmlNode,name:string):XmlNode {return one(n,name,CAC)!;}
function allow(n:XmlNode,basic:string[],agg:string[]) {
  requireValue(!n.text.trim(),'mixed text');
  for(const c of n.children) requireValue((c.uri===CBC && basic.includes(c.name)) || (c.uri===CAC && agg.includes(c.name)),`unsupported field ${c.name}`);
}
function cents(s:string):bigint {
  requireValue(/^\d{1,12}(\.\d{1,2})?$/.test(s),'amount precision/sign');
  const [a,b='']=s.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));
}
function money(n:XmlNode,name:string,currency:string):string {
  const x=one(n,name,CBC)!;requireValue(x.attrs.currencyID===currency,'currency mismatch'); return format(cents(value(x)));
}
function format(n:bigint):string {return `${n/100n}.${(n%100n).toString().padStart(2,'0')}`;}
function date(s:string):string {requireValue(/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s,'invalid date');return s;}
function party(n:XmlNode):{id:string;name:string} {
  allow(n,[],['Party']);const p=aggregate(n,'Party');allow(p,[],['PartyIdentification','PartyName']);
  const id=aggregate(p,'PartyIdentification'),name=aggregate(p,'PartyName');allow(id,['ID'],[]);allow(name,['Name'],[]);
  return {id:text(id,'ID')!,name:text(name,'Name')!};
}
export function normalize(d:Delivery):NormalizedInvoice {
  requireValue(typeof d.customerId==='string' && d.customerId.trim() && typeof d.invoiceId==='string' && d.invoiceId.trim(),'missing local routing identifiers');
  const root=parseXml(d.xml);requireValue(root.uri===UBL && root.name==='Invoice','UBL Invoice namespace/root');
  const checkAttributes=(n:XmlNode):void=>{
    for(const key of Object.keys(n.attrs)) {
      const namespace=key==='xmlns' || key.startsWith('xmlns:');
      const amount=n.uri===CBC && ['TaxAmount','LineExtensionAmount','TaxExclusiveAmount','TaxInclusiveAmount','PayableAmount','PriceAmount'].includes(n.name) && key==='currencyID';
      const quantity=n.uri===CBC && n.name==='InvoicedQuantity' && key==='unitCode';
      requireValue(namespace || amount || quantity,'unsupported attribute');
    }
    n.children.forEach(checkAttributes);
  };
  checkAttributes(root);
  allow(root,['UBLVersionID','CustomizationID','ProfileID','ID','IssueDate','DueDate','InvoiceTypeCode','DocumentCurrencyCode'],['AccountingSupplierParty','AccountingCustomerParty','TaxTotal','LegalMonetaryTotal','InvoiceLine']);
  requireValue(text(root,'UBLVersionID')==='2.1','UBL 2.1 only');
  text(root,'CustomizationID');text(root,'ProfileID'); // recorded in original only; no profile certification
  requireValue(text(root,'InvoiceTypeCode')==='380','invoice type 380 only');
  const currency=text(root,'DocumentCurrencyCode')!;requireValue(currency==='EUR','EUR only');
  const taxNode=aggregate(root,'TaxTotal');allow(taxNode,['TaxAmount'],[]);
  const tax=money(taxNode,'TaxAmount',currency);
  const total=aggregate(root,'LegalMonetaryTotal');
  allow(total,['LineExtensionAmount','TaxExclusiveAmount','TaxInclusiveAmount','PayableAmount'],[]);
  const net=money(total,'TaxExclusiveAmount',currency),gross=money(total,'TaxInclusiveAmount',currency),payable=money(total,'PayableAmount',currency);
  requireValue(money(total,'LineExtensionAmount',currency)===net && cents(net)+cents(tax)===cents(gross) && gross===payable,'inconsistent totals (prepayments/rounding excluded)');
  const sourceLines=children(root,'InvoiceLine',CAC);requireValue(sourceLines.length>0 && sourceLines.length<=100,'line count');
  const lines=sourceLines.map(l=>{
    allow(l,['ID','InvoicedQuantity','LineExtensionAmount'],['Item','Price']);
    const q=one(l,'InvoicedQuantity',CBC)!; const quantity=value(q);
    requireValue(/^\d{1,9}(\.\d{1,3})?$/.test(quantity) && Number(quantity)>0,'quantity precision/sign');
    requireValue(q.attrs.unitCode==='C62','unit C62 only');
    const item=aggregate(l,'Item');allow(item,['Name'],[]);
    const price=aggregate(l,'Price');allow(price,['PriceAmount'],[]);
    const unitPrice=money(price,'PriceAmount',currency),net=money(l,'LineExtensionAmount',currency);
    const [a,b='']=quantity.split('.');const thousandths=BigInt(a)*1000n+BigInt(b.padEnd(3,'0'));
    requireValue((cents(unitPrice)*thousandths+500n)/1000n===cents(net),'line amount mismatch');
    return {id:text(l,'ID')!,description:text(item,'Name')!,quantity,unitCode:'C62',unitPrice,net};
  });
  requireValue(new Set(lines.map(l=>l.id)).size===lines.length,'duplicate line IDs');
  requireValue(lines.reduce((s,l)=>s+cents(l.net),0n)===cents(net),'line sum mismatch');
  const dueDate=text(root,'DueDate',true);
  return {schemaVersion:'x02.erp.v1',source:{pa:'SYNTH-PA',customerId:d.customerId,invoiceId:d.invoiceId,format:'UBL'},invoiceNumber:text(root,'ID')!,issueDate:date(text(root,'IssueDate')!),...(dueDate?{dueDate:date(dueDate)}:{}),currency:'EUR',supplier:party(aggregate(root,'AccountingSupplierParty')),customer:party(aggregate(root,'AccountingCustomerParty')),lines,totals:{net,tax,gross,payable}};
}
// In-memory ledger: production needs a durable atomic ERP transaction/outbox.
export function createReceiver() {
  const deliveries=new Set<string>(), business=new Set<string>();
  return { receive(d:Delivery):Result {
    const fail=(code:ExceptionCode):Result=>({ok:false,exception:classify(code,d.retryAfter)});
    if(d.failure) return fail(d.failure);
    const s=d.httpStatus??200;
    if(s===401) return fail('UNAUTHORIZED'); if(s===429) return fail('RATE_LIMITED');
    if(s===403) return fail('FORBIDDEN'); if(s===404) return fail('NOT_FOUND');
    if(s===409) return fail('DUPLICATE'); if(s>=500 && s<=599) return fail('UPSTREAM_ERROR');
    if(s!==200) return fail('HTTP_ERROR');
    if(d.lifecycle==='REJECTED') return fail('REJECTED');
    if(d.lifecycle!==undefined && d.lifecycle!=='READY') return fail('SCHEMA_MISMATCH');
    if(d.format!=='UBL') return fail('UNSUPPORTED_FORMAT');
    try {
      const invoice=normalize(d);
      const deliveryKey=JSON.stringify([d.customerId,d.invoiceId]);
      const businessKey=JSON.stringify([d.customerId,invoice.supplier.id,invoice.invoiceNumber]);
      if(deliveries.has(deliveryKey) || business.has(businessKey)) return fail('DUPLICATE');
      deliveries.add(deliveryKey);business.add(businessKey);
      return {ok:true,invoice};
    } catch(e) { if(e instanceof SchemaError) return fail('SCHEMA_MISMATCH'); throw e; }
  }};
}
