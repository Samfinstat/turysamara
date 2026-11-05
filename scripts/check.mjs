import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const pages=JSON.parse(fs.readFileSync('data/pages.json'));
const semantics=JSON.parse(fs.readFileSync('data/semantics.json'));
const homeHtml=fs.readFileSync('dist/index.html','utf8');
const base=homeHtml.match(/data-base="([^"]*)"/)?.[1];
assert.notEqual(base,undefined,'Missing base path in rendered home page');
assert(!fs.existsSync('dist/review'),'Client build must not contain deliverable exports');
assert(!fs.readFileSync('dist/assets/app.js','utf8').includes('export-seo'),'Client script must not generate downloadable passports');
const ids=new Set(pages.map(p=>p.id));
assert.equal(ids.size,pages.length,'Duplicate page IDs');
for(const k of ['path','title','description'])assert.equal(new Set(pages.map(p=>p[k])).size,pages.length,'Duplicate '+k);
assert.equal(semantics.rows.length,153);
assert.equal(new Set(semantics.rows.map(r=>r.query)).size,153);
assert.equal(semantics.rows.filter(r=>r.allMissing).length,49);
assert.equal(semantics.rows.filter(r=>r.frequencyConflict).length,46);
assert(semantics.rows.some(r=>r.frequency.includes(0)),'Zeros must be preserved');
const ownership=new Map();let linkCount=0,imageCount=0;
for(const p of pages){
 for(const id of [...p.links,...p.items])assert(ids.has(id),`${p.id}: unknown link ${id}`);
 for(const q of p.queryIds){assert(!ownership.has(q),`Query ${q} has two owners`);ownership.set(q,p.id);}
 const html=fs.readFileSync(path.join('dist',p.path,'index.html'),'utf8');
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];assert(main,p.id+': main missing');
 assert.equal((main.match(/<h1\b/g)||[]).length,1,p.id+': H1 count');
 assert.equal((html.match(/<title>/g)||[]).length,1,p.id+': title count');
 assert.equal((html.match(/<meta name="description"/g)||[]).length,1);
 assert(html.includes('<html lang="ru">'));
 assert(!html.includes('&lt;span aria-hidden='),p.id+': escaped markup leaked into labels');
 assert(html.includes('id="open-seo"'),p.id+': missing inspector');
 assert(html.includes('content="noindex,follow"'),p.id+': review must be noindex');
 assert(!html.includes('<link rel="canonical"'),p.id+': review canonical intentionally absent');
 const structured=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert(!JSON.stringify(structured).includes('AggregateRating'));
 assert(!JSON.stringify(structured).includes('"price"'));
 const passport=JSON.parse(html.match(/<script id="page-passport" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(passport.id,p.id);
 assert(!('sections' in passport)&&!('queries' in passport),'Do not embed the complete work package in the inspector data');
 assert(!/\bdownload(?:\s|=|>)/.test(html),'No download controls in client preview');
 assert(!html.includes('id="export-seo"'),'No passport download button');
 assert(!html.includes(base+'/review/'),'No links to work-package exports');
 for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
  const href=m[1];if(!href.startsWith('/'))continue;
  assert(!base||href.startsWith(base+'/'),`${p.id}: base path missing ${href}`);
  const local=href.slice(base.length).split(/[?#]/)[0];let target=path.join('dist',local);
  if(local.endsWith('/'))target=path.join(target,'index.html');
  assert(fs.existsSync(target),`${p.id}: missing target ${href}`);linkCount++;
 }
 for(const m of html.matchAll(/<img\b([^>]+)>/g)){
  const tag=m[1],src=tag.match(/src="([^"]+)"/)?.[1];assert(src?.startsWith(base+'/assets/'));
  assert(fs.existsSync(path.join('dist',src.slice(base.length))));assert(/alt="[^"]*"/.test(tag));assert(/width="\d+"/.test(tag)&&/height="\d+"/.test(tag));imageCount++;
 }
}
for(const r of semantics.rows){assert.equal(r.owner||null,ownership.get(r.id)||null,`Owner mismatch ${r.id}`);assert(r.reason);assert.equal(r.frequency.length,5);assert(r.frequency.every(v=>v===null||(Number.isInteger(v)&&v>=0)));}
const sitemap=fs.readFileSync('dist/sitemap.xml','utf8');assert(!sitemap.includes('<loc>'),'Review sitemap must be empty');
assert(fs.readFileSync('dist/404.html','utf8').includes('data-page="notFound"'));
const robots=fs.readFileSync('dist/robots.txt','utf8');assert(!robots.includes('Disallow: /'));assert(!robots.includes('Sitemap:'));
console.log(`PASS: ${pages.length} pages; 153 queries; ${linkCount} local links; ${imageCount} image references; metadata, JSON-LD, draft indexing and owners verified.`);
