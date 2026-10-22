const http=require('http'),fs=require('fs');const body=fs.readFileSync(process.argv[2],'utf8');let n=0;
http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{n++;fs.appendFileSync(process.argv[3],`req ${n} ${q.url}\n`);s.writeHead(200,{'content-type':'text/event-stream'});
s.write('data: '+JSON.stringify({choices:[{delta:{content:body}}]})+'\n\n');s.end('data: [DONE]\n\n');});}).listen(18999,'127.0.0.1');
