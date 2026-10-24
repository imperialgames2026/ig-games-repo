import http from 'node:http';
http.createServer((req,res)=>{
 const paths=[['/auth/v1','auth',9999],['/rest/v1','rest',3000],['/storage/v1','storage',5000],['/functions/v1','edge',9000]];
 const entry=paths.find(([prefix])=>req.url.startsWith(prefix+'/'));
 if(!entry){res.writeHead(404);res.end();return;}
 const [prefix,hostname,port]=entry;
 const target=http.request({hostname,port,path:req.url.slice(prefix.length),method:req.method,headers:{...req.headers,host:hostname}},upstream=>{res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res);});
 target.on('error',()=>{res.writeHead(502);res.end();});req.pipe(target);
}).listen(8000,'0.0.0.0');
