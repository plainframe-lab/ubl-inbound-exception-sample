// Deliberately restricted XML reader for the prototype, NOT a general XML/XSD validator.
export type XmlNode = { qname: string; name: string; uri: string; attrs: Record<string,string>; children: XmlNode[]; text: string; ns: Record<string,string> };
export class SchemaError extends Error {}
export function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new SchemaError(message);
}
function decode(s: string): string {
  requireValue(!s.includes('<'), 'raw angle bracket');
  requireValue(!/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(s), 'unknown entity');
  return s.replace(/&([^;]+);/g, (_, e: string) => {
    const basic: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if (e in basic) return basic[e];
    const n = e.startsWith('#x') ? parseInt(e.slice(2),16) : Number(e.slice(1));
    requireValue(n===9 || n===10 || n===13 || (n>=32 && n<=0xD7FF) || (n>=0xE000 && n<=0xFFFD) || (n>=0x10000 && n<=0x10FFFF), 'invalid XML character');
    return String.fromCodePoint(n);
  });
}
export function parseXml(input: string): XmlNode {
  requireValue(typeof input==='string' && input.length>0 && Buffer.byteLength(input)<=262144, 'XML empty or over 256 KiB');
  requireValue(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.test(input), 'invalid character');
  requireValue(!/<!DOCTYPE|<!ENTITY/i.test(input), 'DTD/entities forbidden');
  const xml=input.replace(/^\uFEFF/,'').replace(/^<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']UTF-8["'])?\s*\?>/i,'');
  const stack: XmlNode[]=[];
  let root: XmlNode|undefined, pos=0, count=0;
  const namePattern='[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?';
  while(pos<xml.length) {
    if (xml.startsWith('<!--',pos)) {
      const end=xml.indexOf('-->',pos+4);
      requireValue(end>=0 && !xml.slice(pos+4,end).includes('--'), 'invalid comment');
      pos=end+3; continue;
    }
    if (xml[pos]!=='<') {
      const next=xml.indexOf('<',pos), end=next<0?xml.length:next;
      const content=xml.slice(pos,end);
      requireValue(!content.includes(']]>'), 'invalid text');
      if(stack.length) stack.at(-1)!.text+=decode(content);
      else requireValue(!content.trim(), 'text outside document');
      pos=end; continue;
    }
    const close=xml.slice(pos).match(new RegExp('^</('+namePattern+')\\s*>'));
    if(close) {
      requireValue(stack.length && stack.at(-1)!.qname===close[1], 'mismatched end tag');
      stack.pop(); pos+=close[0].length; continue;
    }
    const start=xml.slice(pos).match(new RegExp('^<('+namePattern+')(?=\\s|/?>)'));
    requireValue(start,'unsupported or malformed markup (CDATA/PI excluded)');
    pos+=start[0].length;
    const attrs: Record<string,string>=Object.create(null);
    while(!/^\s*\/?>/.test(xml.slice(pos))) {
      const attr=xml.slice(pos).match(new RegExp('^\\s+('+namePattern+')\\s*=\\s*("[^"]*"|\x27[^\x27]*\x27)'));
      requireValue(attr && !(attr[1] in attrs),'invalid/duplicate attribute');
      attrs[attr[1]]=decode(attr[2].slice(1,-1)); pos+=attr[0].length;
    }
    const end=xml.slice(pos).match(/^\s*(\/?>)/)!; pos+=end[0].length;
    const ns: Record<string,string>={...(stack.at(-1)?.ns ?? {}),xml:'http://www.w3.org/XML/1998/namespace'};
    for(const [key,value] of Object.entries(attrs)) {
      if(key==='xmlns') ns['']=value;
      else if(key.startsWith('xmlns:')) {
        requireValue(key!=='xmlns:xmlns' && (key!=='xmlns:xml' || value===ns.xml) && value.length, 'invalid namespace binding');
        ns[key.slice(6)]=value;
      }
    }
    const parts=start[1].split(':'), prefix=parts.length===2?parts[0]:'';
    requireValue(!prefix || ns[prefix], 'undeclared prefix');
    for (const key of Object.keys(attrs)) if(key.includes(':') && !key.startsWith('xmlns:')) requireValue(ns[key.split(':')[0]], 'undeclared attribute prefix');
    const node: XmlNode={qname:start[1],name:parts.at(-1)!,uri:ns[prefix]??'',attrs,children:[],text:'',ns};
    requireValue(++count<=10000 && stack.length<32,'XML resource limit');
    if(stack.length) stack.at(-1)!.children.push(node);
    else { requireValue(!root,'multiple roots'); root=node; }
    if(end[1]!== '/>') stack.push(node);
  }
  requireValue(root && !stack.length,'truncated XML');
  return root;
}
