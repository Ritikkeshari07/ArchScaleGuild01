const labels={contacts:'Contacts',products:'Products',orders:'Orders',tasks:'Tasks'};
const pathName=location.pathname.replace(/\/$/,'');
const isAdmin=pathName==='/admin';
const current=window.ARCHSCALE_APP_ID||(pathName.startsWith('/apps/')?pathName.split('/')[2]:null);
let model;
let isAuthenticated = false;
let renderedStateSignature = '';
const $=s=>document.querySelector(s);
function showLogin(message='Sign in with your local pilot account.') {
  setAuthenticatedUI(false);
  let panel=$('#demo-login');
  if(!panel) {
    panel=document.createElement('div');panel.id='demo-login';panel.className='login-overlay';
    panel.innerHTML=`<section class="login-card" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <span class="eyebrow">ARCHSCALE · SUPABASE</span><h2 id="login-title">Sign in</h2>
      <p>Use your account for the local four-app pilot.</p>
      <form id="demo-login-form">
        <label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="username" required>
        <label for="login-password">Password</label>
        <div class="password-control"><input id="login-password" name="password" type="password" autocomplete="current-password" required><button id="toggle-password" class="password-toggle" type="button" aria-label="Show password" aria-pressed="false">Show</button></div>
        <div class="login-error" role="status" aria-live="polite"></div>
        <button class="primary" type="submit">Sign in</button>
        <button id="signup" class="secondary" type="button">Create local account</button>
        <p class="login-hint">Create your account once, then use Sign in next time.</p>
      </form></section>`;
    document.body.append(panel);
    const passwordInput=panel.querySelector('#login-password');
    panel.querySelector('#toggle-password').addEventListener('click',event=>{
      const button=event.currentTarget,reveal=passwordInput.type==='password';
      passwordInput.type=reveal?'text':'password';button.textContent=reveal?'Hide':'Show';
      button.setAttribute('aria-label',reveal?'Hide password':'Show password');button.setAttribute('aria-pressed',String(reveal));
    });
    panel.querySelector('#signup').addEventListener('click',async event=>{
      const button=event.currentTarget,email=panel.querySelector('[name=email]').value.trim(),password=passwordInput.value,messageBox=panel.querySelector('.login-error');
      if(!email||!password){messageBox.className='login-error';messageBox.textContent='Enter your email and password first.';return;}
      button.disabled=true;button.textContent='Creating account…';messageBox.className='login-error';messageBox.textContent='';
      try {
        const response=await fetch('/api/auth/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
        const result=await response.json();if(!response.ok){const reason=result.error||'Account creation failed.';if(/already (registered|exists)|user already/i.test(reason)){button.disabled=true;button.textContent='Account already exists';messageBox.className='login-error success';messageBox.textContent='This account already exists. Use Sign in after completing the one-time admin setup.';return;}throw new Error(reason);}
        button.textContent='Account created';messageBox.className='login-error success';
        messageBox.textContent=result.message||'Account created. Complete the one-time admin setup, then sign in.';
      } catch(error) {button.disabled=false;button.textContent='Create local account';messageBox.textContent=error.message||'Could not create account.';}
    });
  }
  panel.querySelector('.login-error').textContent=message;panel.querySelector('input').focus();
}
function setAuthenticatedUI(authenticated){
 isAuthenticated=authenticated;
 let actions=document.querySelector('.top .header-actions');
 if(!actions){actions=document.createElement('div');actions.className='header-actions';document.querySelector('.top')?.append(actions);}
 let button=$('#signout');
 if(!button){button=document.createElement('button');button.id='signout';button.type='button';button.textContent='Sign out';actions.append(button);button.addEventListener('click',async()=>{try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}finally{setAuthenticatedUI(false);model=null;renderedStateSignature='';showLogin('You have signed out.');}});}
 button.hidden=!authenticated;
}
async function api(url,options={}){const headers={'content-type':'application/json',...(options.headers||{})};const r=await fetch(url,{...options,headers,credentials:'same-origin'});const data=await r.json().catch(()=>null);if(r.status===401){const wasSignedIn=isAuthenticated;setAuthenticatedUI(false);showLogin(wasSignedIn?'Your session expired. Sign in again.':'Sign in with your local pilot account.');const error=new Error(data?.error||'Sign in required.');error.status=401;throw error;}if(!r.ok)throw new Error(data?.error||'Unexpected server response.');if(!data)throw new Error('Unexpected server response.');return data;}
function esc(x=''){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function options(rows,labelKey='name'){return '<option value="">Manual entry / none</option>'+rows.map(x=>`<option value="${esc(x.id)}">${esc(x[labelKey])}</option>`).join('');}
function field(label,name,type='text',required=false,extra=''){return `<label>${label}<input name="${name}" type="${type}" ${required?'required':''} ${extra}></label>`;}
function render(){
 const s=model.state;
 if(!current&&!isAdmin){
  $('#app-cards').innerHTML=model.definitions.filter(d=>s.modules[d.id]?.status!=='removed').map(d=>{const status=s.modules[d.id]?.status||'deleted',mod=s.modules[d.id]||{},url=mod.deploymentStatus==='deployed'&&mod.deploymentUrl?mod.deploymentUrl:`/apps/${d.id}`;return `<a class="app-card ${status}" href="${esc(url)}"><div><span class="eyebrow">${esc(mod.deploymentMode||'APP')}</span><h3>${d.name}</h3><p>${d.description}</p><small>${esc(mod.workerName||'')} · deployment ${esc(mod.deploymentStatus||'planned')}</small></div><span class="pill ${status}">${status}</span><b class="open-app">Open ${d.name} →</b></a>`}).join('');
 }
 if(isAdmin){
  $('#registry').innerHTML=model.definitions.map(d=>{const status=s.modules[d.id]?.status||'deleted',removed=status==='removed',mod=s.modules[d.id]||{},url=mod.deploymentStatus==='deployed'&&mod.deploymentUrl?mod.deploymentUrl:`/apps/${d.id}`;return `<article class="module ${status}"><div><b>${d.name}</b><span class="pill ${status}">${status}</span><small>${s[d.collection]?.length||0} records · ${d.description}</small><small>Worker: ${esc(mod.workerName||'')} · deployment: ${esc(mod.deploymentStatus||'planned')}</small>${removed?'':`<a class="small-link" href="${esc(url)}">Open app workspace →</a>`}</div><div class="controls"><button data-action="activate" data-id="${d.id}" ${status==='active'||removed?'disabled':''}>Activate</button><button data-action="deactivate" data-id="${d.id}" ${status!=='active'?'disabled':''}>Deactivate</button><button data-action="retire" data-id="${d.id}" ${['retired','deleted','removed'].includes(status)?'disabled':''}>Retire</button><button class="danger" data-action="delete" data-id="${d.id}" ${status==='deleted'||removed?'disabled':''}>Delete data</button><button class="danger" data-action="remove" data-id="${d.id}" ${removed?'disabled':''}>Remove schema</button></div></article>`}).join('');
  $('#audit').innerHTML=s.audit.slice(0,8).map(x=>`<div class="auditrow"><span class="pill">${esc(x.action)}</span><b>${esc(labels[x.moduleId]||x.moduleId)}</b><span>${esc(x.details)}</span><time>${new Date(x.at).toLocaleTimeString()}</time></div>`).join('')||'<p class="muted">No actions yet.</p>';
 }
 if(current){
  if(!labels[current]){ $('#workspace').textContent='App not found.'; return; }
  $('#app-title').textContent=labels[current];
  document.title=`${labels[current]} App Workspace`;
  const status=s.modules[current]?.status||'deleted';
  if(status!=='active'){$('#status-message').innerHTML=`<div class="notice"><b>${labels[current]} is ${status}.</b>${status==='removed'?' Its app-owned schema is no longer installed.':' Ask Super Admin to activate it before using this app.'} Other app workspaces are available separately.</div>`;$('#workspace').innerHTML='';return;}
  $('#status-message').innerHTML='';
  $('#workspace').innerHTML=renderApp(current,s);
 }
}
function renderApp(id,s){const data=s[id]||[];
 const forms={
 contacts:`${field('Name','name','text',true)}${field('Organization','organization')}${field('Email','email','email')}${field('Phone','phone')}${field('City','city')}<label>Related product<select name="productId">${options(s.products)}</select></label>${field('Product name snapshot','productName')}<label>Related order<select name="orderId">${options(s.orders,'orderNo')}</select></label>${field('Order reference snapshot','orderRef')}<label>Related task<select name="taskId">${options(s.tasks)}</select></label>${field('Task name snapshot','taskName')}`,
 products:`${field('Product name','name','text',true)}${field('SKU','sku','text',true)}${field('Category','category')}${field('Unit','unit','text',true)}${field('Price (₹)','price','number',true,'min="0" step="0.01"')}<label>Related contact<select name="contactId">${options(s.contacts)}</select></label>${field('Contact name snapshot','contactName')}<label>Related order<select name="orderId">${options(s.orders,'orderNo')}</select></label>${field('Order reference snapshot','orderRef')}<label>Related task<select name="taskId">${options(s.tasks)}</select></label>${field('Task name snapshot','taskName')}`,
 orders:`${field('Order no.','orderNo','text',true)}<label>Customer from Contacts<select name="customerId">${options(s.contacts)}</select></label>${field('Customer name snapshot','customerName')}<label>Product from Products<select name="productId">${options(s.products)}</select></label>${field('Product name snapshot','productName')}${field('Unit price (₹) fallback','unitPrice','number',false,'min="0" step="0.01"')}${field('Quantity','quantity','number',true,'min="1" step="1"')}${field('Status','status')}<label>Related task<select name="taskId">${options(s.tasks)}</select></label>${field('Task name snapshot','taskName')}`,
 tasks:`${field('Task name','name','text',true)}${field('Assigned to','assignedTo','text',true)}<label>Related order<select name="orderId">${options(s.orders,'orderNo')}</select></label>${field('Order reference snapshot','orderRef')}<label>Related contact<select name="contactId">${options(s.contacts)}</select></label>${field('Contact name snapshot','contactName')}<label>Related product<select name="productId">${options(s.products)}</select></label>${field('Product name snapshot','productName')}${field('Due date','dueDate','date')}${field('Status','status')}`
 };
 const rows=data.map(x=>`<tr>${recordCells(id,x,s)}</tr>`).join('');
 return `<div class="apphead"><div><span class="eyebrow">STANDALONE WORKSPACE · ${id.toUpperCase()}</span><h2>${labels[id]}</h2></div><span class="pill active">active</span></div><p class="muted">This app has its own page and module. Linked information is read from the shared platform.</p><form id="create" data-id="${id}" class="formgrid">${forms[id]}<button class="primary" type="submit">Save ${({contacts:'Contact',products:'Product',orders:'Order',tasks:'Task'})[id]}</button></form><div class="tablewrap"><table><thead><tr>${headers(id)}</tr></thead><tbody>${rows||`<tr><td colspan="8" class="empty">No ${labels[id].toLowerCase()} yet. Load the demo story from the home page or add one above.</td></tr>`}</tbody></table></div>`;
}
function headers(id){return ({contacts:'<th>Name</th><th>Organization</th><th>Email</th><th>Phone</th><th>City</th><th>Related product</th><th>Related order</th><th>Related task</th>',products:'<th>Product</th><th>SKU</th><th>Category</th><th>Unit</th><th>Price</th><th>Related contact</th><th>Related order</th><th>Related task</th>',orders:'<th>Order</th><th>Customer</th><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th><th>Status</th><th>Related task</th>',tasks:'<th>Task</th><th>Assigned to</th><th>Due date</th><th>Status</th><th>Related order</th><th>Related contact</th><th>Related product</th>'})[id];}
function relationshipCell(s,appId,id,snapshot){const value=String(snapshot||'').trim();if(!value)return '';const label=esc(value);const stillExists=Boolean(id)&&(s[appId]||[]).some(record=>record.id===id);return !id||stillExists?label:`${label}<small class="snapshot-note" aria-label="Saved snapshot; source record deleted">Saved snapshot · source record deleted</small>`;}
function recordCells(id,x,s){if(id==='contacts')return `<td>${esc(x.name)}</td><td>${esc(x.organization)}</td><td>${esc(x.email)}</td><td>${esc(x.phone)}</td><td>${esc(x.city)}</td><td>${relationshipCell(s,'products',x.productId,x.productName)}</td><td>${relationshipCell(s,'orders',x.orderId,x.orderRef)}</td><td>${relationshipCell(s,'tasks',x.taskId,x.taskName)}</td>`;if(id==='products')return `<td>${esc(x.name)}</td><td>${esc(x.sku)}</td><td>${esc(x.category)}</td><td>${esc(x.unit)}</td><td>₹${Number(x.price).toFixed(2)}</td><td>${relationshipCell(s,'contacts',x.contactId,x.contactName)}</td><td>${relationshipCell(s,'orders',x.orderId,x.orderRef)}</td><td>${relationshipCell(s,'tasks',x.taskId,x.taskName)}</td>`;if(id==='orders')return `<td>${esc(x.orderNo)}</td><td>${relationshipCell(s,'contacts',x.customerId,x.customerName)}</td><td>${relationshipCell(s,'products',x.productId,x.productName)}</td><td>${x.quantity}</td><td>₹${Number(x.unitPrice).toFixed(2)}</td><td>₹${Number(x.total).toFixed(2)}</td><td>${esc(x.status)}</td><td>${relationshipCell(s,'tasks',x.taskId,x.taskName)}</td>`;if(id==='tasks')return `<td>${esc(x.name)}</td><td>${esc(x.assignedTo)}</td><td>${esc(x.dueDate)}</td><td>${esc(x.status)}</td><td>${relationshipCell(s,'orders',x.orderId,x.orderRef)}</td><td>${relationshipCell(s,'contacts',x.contactId,x.contactName)}</td><td>${relationshipCell(s,'products',x.productId,x.productName)}</td>`;return '';}
async function refresh(){model=await api('/api/state');renderedStateSignature=JSON.stringify(model.state);setAuthenticatedUI(true);render();}
function hasUnsavedFormDraft(){const form=$('#create');return Boolean(form&&[...form.elements].some(field=>field.name&&field.value));}
async function pollSharedState(){if(!isAuthenticated||document.hidden)return;const latest=await api('/api/state');const signature=JSON.stringify(latest.state);if(signature===renderedStateSignature||hasUnsavedFormDraft()||document.activeElement?.closest('#create'))return;model=latest;renderedStateSignature=signature;render();}
window.setInterval(()=>pollSharedState().catch(error=>{if(error.status!==401)console.error('Could not refresh shared app data.',error);}),5000);
document.addEventListener('submit',async e=>{if(e.target.id!=='demo-login-form')return;e.preventDefault();const form=new FormData(e.target);try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({email:form.get('email'),password:form.get('password')})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Sign-in failed.');await refresh();$('#demo-login')?.remove();}catch(error){showLogin(error.message);}});
if(isAdmin){$('#registry').addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const id=b.dataset.id,action=b.dataset.action;if(action==='delete'&&!confirm(`Delete ${labels[id]} records from the local database? Other apps keep their snapshots.`))return;if(action==='remove'&&!confirm(`Permanently remove the ${labels[id]} app schema and its records from this local pilot? Other apps keep saved snapshots and manual-entry fields. This cannot be undone without reinstalling the app.`))return;try{await api(`/api/admin/modules/${id}/${action}`,{method:'POST'});await refresh();}catch(err){alert(err.message);}});}
if(current){$('#workspace').addEventListener('submit',async e=>{if(e.target.id!=='create')return;e.preventDefault();const payload=Object.fromEntries(new FormData(e.target));try{await api(`/api/${e.target.dataset.id}`,{method:'POST',body:JSON.stringify(payload)});await refresh();}catch(err){if(err.status!==401)alert(err.message);}});}
if($('#reset'))$('#reset').addEventListener('click',async()=>{if(!confirm('Reset the local demo database and load the ABC Studio story?'))return;await api('/api/demo/reset',{method:'POST'});await refresh();});
refresh().catch(e=>{if(e.status===401)return;const target=$('#workspace')||$('#app-cards')||$('#registry');if(target)target.textContent=e.message;});

