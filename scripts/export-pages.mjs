import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Commit these generated files with the sources, then Pages can serve main / (root).
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.BASE_PATH??'/turysamara';
const env={...process.env,SITE_MODE:'review',BASE_PATH:base};
for(const script of ['scripts/build.mjs','scripts/check.mjs']){
  const result=spawnSync(process.execPath,[script],{cwd:root,env,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
const manifestPath=path.join(root,'.pages-manifest.json');
const previous=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{files:[]};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const safe=rel=>typeof rel==='string' && !path.isAbsolute(rel) && !rel.split('/').includes('..') && !/^(?:\.git\/|\.github\/|scripts\/|data\/|docs\/|public\/|package\.json$|README\.md$|\.pages-manifest\.json$)/.test(rel);
const owned=new Map(previous.files.map(f=>[f.path,f.sha256]));
for(const [rel,sha] of owned){
  if(!safe(rel))throw Error('Unsafe generated path: '+rel);
  const file=path.join(root,rel);
  if(fs.existsSync(file)&&hash(file)!==sha)throw Error('Generated file was edited manually: '+rel+'. Move the change to sources before rebuilding.');
}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
const dist=path.join(root,'dist');
const files=walk(dist).map(file=>({path:path.relative(dist,file).split(path.sep).join('/'),sha256:hash(file)}));
for(const file of files){
  if(!safe(file.path))throw Error('Output collides with source directory: '+file.path);
  if(fs.existsSync(path.join(root,file.path))&&!owned.has(file.path))throw Error('Unmanaged file already exists: '+file.path);
}
const next=new Set(files.map(f=>f.path));
for(const rel of owned.keys())if(!next.has(rel))fs.unlinkSync(path.join(root,rel));
for(const file of files){const target=path.join(root,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(dist,file.path),target);}
fs.writeFileSync(manifestPath,JSON.stringify({mode:'review',base,files},null,2)+'\n');
console.log(`Pages ready: ${files.length} files in main / (root), base=${base}. Commit generated files together with source changes.`);
