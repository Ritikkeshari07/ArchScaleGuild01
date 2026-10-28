const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const db = require('./platform/database');
const { definitions } = require('./platform/registry');
const { transition, assertActive } = require('./platform/lifecycle');
const apps = Object.fromEntries(['contacts','products','orders','tasks'].map(id => [id, require(`./apps/${id}`)]));
const publicDir = path.join(__dirname, '../public');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };

function send(res, status, body) { res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }); res.end(JSON.stringify(body)); }
function readBody(req) { return new Promise((resolve,reject) => { let s=''; req.on('data',c=>{s+=c; if(s.length>1e6) reject(new Error('Request too large'));}); req.on('end',()=>{try{resolve(s ? JSON.parse(s) : {});}catch{reject(new Error('Invalid JSON'));}}); }); }
function audit(state, action, moduleId, details='') { state.audit.unshift({ id: crypto.randomUUID(), action, moduleId, details, at:new Date().toISOString() }); state.audit = state.audit.slice(0,100); }
async function route(req,res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res,200,{ definitions, state:db.read() });
  if (req.method === 'POST' && url.pathname === '/api/demo/reset') {
    const state = db.reset();
    const contact = apps.contacts.create({name:'ABC Studio',organization:'ABC Studio',city:'Mumbai'},state);
    const product = apps.products.create({name:'Marble Sample',sku:'MAR-001',category:'Samples',unit:'each',price:500},state);
    const order = apps.orders.create({orderNo:'ORD-001',customerId:contact.id,productId:product.id,quantity:4,status:'Confirmed'},state);
    apps.tasks.create({name:'Confirm delivery',assignedTo:'Demo Admin',orderId:order.id,dueDate:'2026-10-30'},state);
    audit(state,'demo-reset','platform','Loaded ABC Studio example records'); db.write(state);
    return send(res,200,{ok:true});
  }
  const admin = url.pathname.match(/^\/api\/admin\/modules\/([a-z]+)\/(activate|deactivate|retire|delete)$/);
  if (req.method === 'POST' && admin) {
    const [,id,action]=admin; const def=definitions.find(x=>x.id===id);
    if (!def) return send(res,404,{error:'Unknown app.'});
    const state=db.read();
    transition(state,id,action);
    audit(state,action,id,action==='delete'?'Module records removed from disposable JSON database':''); db.write(state);
    return send(res,200,{ok:true,status:state.modules[id].status});
  }
  const record = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (record && ['GET','POST'].includes(req.method)) {
    const id=record[1], app=apps[id], def=definitions.find(x=>x.id===id);
    if (!app || !def) return send(res,404,{error:'Unknown app.'});
    const state=db.read();
    try { assertActive(state,id); } catch(error) { return send(res,409,{error:error.message}); }
    if(req.method==='GET') return send(res,200,state[def.collection]);
    try { const created=app.create(await readBody(req),state); audit(state,'record-created',id,created.id); db.write(state); return send(res,201,created); }
    catch(error) { return send(res,400,{error:error.message}); }
  }
  if (req.method === 'GET') {
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.resolve(publicDir, requested);
    if (!file.startsWith(path.resolve(publicDir)+path.sep) && file!==path.join(publicDir,'index.html')) return send(res,403,{error:'Forbidden'});
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res,404,{error:'Not found'});
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}); return fs.createReadStream(file).pipe(res);
  }
  send(res,404,{error:'Route not found'});
}
const server=http.createServer((req,res)=>route(req,res).catch(e=>send(res,500,{error:e.message})));
const port=Number(process.env.PORT||3000);
server.listen(port,'127.0.0.1',()=>console.log(`Four-app demo running at http://127.0.0.1:${port}`));
module.exports={server};


