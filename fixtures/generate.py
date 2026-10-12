"""Generate fictional UBL fixtures and independent ERP expected JSON (stdlib only)."""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import json

HERE = Path(__file__).parent
def amount(v): return str(Decimal(v).quantize(Decimal('.01'), rounding=ROUND_HALF_UP))
def c(tag, value, attrs=''): return f'<cbc:{tag}{attrs}>{value}</cbc:{tag}>'
def a(tag, value): return f'<cac:{tag}>{value}</cac:{tag}>'
manifest=[]
for i in range(1,21):
    supplier={'id':f'SYNTH-SUP-{i:02}', 'name':f'Atelier fictif {i:02} &amp; Démo'}
    customer={'id':f'SYNTH-ERP-{i:02}', 'name':f'ERP fictif {i:02}'}
    def party(p): return a('Party', a('PartyIdentification',c('ID',p['id']))+a('PartyName',c('Name',p['name'])))
    lines=[]
    for j in range(1,(i%3)+2):
        quantity=Decimal('1.5') if i%4==0 else Decimal(j)
        price=Decimal(i)+Decimal(j)/100
        lines.append({'id':str(j),'description':f'Service synthétique {i:02}/{j}', 'quantity':str(quantity),'unitCode':'C62','unitPrice':amount(price),'net':amount(price*quantity)})
    net=sum(Decimal(l['net']) for l in lines)
    tax=(net*(Decimal('0') if i%5==0 else Decimal('.2'))).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
    totals={'net':amount(net),'tax':amount(tax),'gross':amount(net+tax),'payable':amount(net+tax)}
    m=lambda tag,v:c(tag,v,' currencyID="EUR"')
    body=c('UBLVersionID','2.1')+c('CustomizationID','urn:x02:synthetic:restricted-v1')+c('ProfileID','urn:x02:offline')+c('ID',f'SYNTH-2026-{i:03}')+c('IssueDate','2026-10-04')
    if i%2: body+=c('DueDate','2026-11-03')
    body+=c('InvoiceTypeCode','380')+c('DocumentCurrencyCode','EUR')+a('AccountingSupplierParty',party(supplier))+a('AccountingCustomerParty',party(customer))
    body+=a('TaxTotal',m('TaxAmount',totals['tax']))+a('LegalMonetaryTotal',m('LineExtensionAmount',totals['net'])+m('TaxExclusiveAmount',totals['net'])+m('TaxInclusiveAmount',totals['gross'])+m('PayableAmount',totals['payable']))
    for l in lines:
        body+=a('InvoiceLine',c('ID',l['id'])+c('InvoicedQuantity',l['quantity'],' unitCode="C62"')+m('LineExtensionAmount',l['net'])+a('Item',c('Name',l['description']))+a('Price',m('PriceAmount',l['unitPrice'])))
    xml='<?xml version="1.0" encoding="UTF-8"?>\n<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">'+body+'</Invoice>\n'
    if i==20: xml=xml.replace('cbc:','basic:').replace('xmlns:cbc=','xmlns:basic=').replace('cac:','agg:').replace('xmlns:cac=','xmlns:agg=')
    filename=f'invoice-{i:02}.xml'
    (HERE/filename).write_text(xml,encoding='utf-8')
    expected={'schemaVersion':'x02.erp.v1','source':{'pa':'SYNTH-PA','customerId':'SYNTH-TENANT-A','invoiceId':f'SYNTH-PA-{i:03}','format':'UBL'},'invoiceNumber':f'SYNTH-2026-{i:03}','issueDate':'2026-10-04','currency':'EUR','supplier':{**supplier,'name':supplier['name'].replace('&amp;','&')},'customer':customer,'lines':lines,'totals':totals}
    if i%2: expected['dueDate']='2026-11-03'
    manifest.append({'file':filename,'delivery':{'customerId':'SYNTH-TENANT-A','invoiceId':f'SYNTH-PA-{i:03}','format':'UBL','lifecycle':'READY'},'expected':expected})
(HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
