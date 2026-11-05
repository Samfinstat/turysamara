import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.csv':'text/csv; charset=utf-8'};
const portArg=process.argv.indexOf('--port');
const port = Number(portArg>=0?process.argv[portArg+1]:(process.env.PORT || 3000));
http.createServer((req,res) => {
  let pathname;
  try {pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400).end();return;}
  const file = path.resolve(root, '.'+pathname);
  if (file!==root && !file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  let target=file;
  try {
    if (fs.statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) {res.writeHead(308,{Location:pathname+'/'}).end();return;}
      target=path.join(file,'index.html');
    }
    if (!fs.statSync(target).isFile()) throw Error();
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
  } catch {target=path.join(root,'404.html');res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});}
  fs.createReadStream(target).pipe(res);
}).listen(port,'0.0.0.0',()=>console.log(`Local: http://localhost:${port}`));
