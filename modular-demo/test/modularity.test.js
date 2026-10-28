const test = require('node:test');
const assert = require('node:assert/strict');
const { initialState } = require('../src/platform/registry');
const { transition, assertActive, resetDemoState } = require('../src/platform/lifecycle');
const contacts = require('../src/apps/contacts');
const products = require('../src/apps/products');
const orders = require('../src/apps/orders');
const tasks = require('../src/apps/tasks');

test('product deletion leaves order snapshots and permits manual order entry', () => {
  const s = initialState();
  const c = contacts.create({ name:'ABC Studio' },s);
  const p = products.create({ name:'Marble Sample',sku:'M-1',price:500,unit:'each' },s);
  const prior = orders.create({ orderNo:'ORD-001',customerId:c.id,productId:p.id,quantity:4 },s);
  transition(s,'products','delete');
  assert.equal(s.products.length,0);
  assert.equal(s.orders[0].productName,'Marble Sample');
  assert.equal(s.orders[0].unitPrice,500);
  assert.equal(s.orders[0].total,2000);
  const next = orders.create({ orderNo:'ORD-002',customerName:'Manual Customer',productName:'Manual Item',unitPrice:125,quantity:2 },s);
  assert.equal(next.productId,null);
  assert.equal(next.total,250);
  assert.equal(prior.customerName,'ABC Studio');
});

test('orders can be removed while tasks retain the order reference snapshot', () => {
  const s = initialState();
  const c = contacts.create({name:'ABC Studio'},s);
  const p = products.create({name:'Marble Sample',sku:'M-1',price:500},s);
  const o = orders.create({orderNo:'ORD-001',customerId:c.id,productId:p.id,quantity:4},s);
  tasks.create({name:'Confirm delivery',assignedTo:'Alex',orderId:o.id},s);
  transition(s,'orders','delete');
  assert.equal(s.orders.length,0);
  assert.equal(s.tasks[0].orderId,o.id);
  assert.equal(s.tasks[0].orderRef,'ORD-001');
  const independent = tasks.create({name:'Call supplier',assignedTo:'Alex',orderRef:'ORD-OLD'},s);
  assert.equal(independent.orderId,null);
  assert.equal(independent.orderRef,'ORD-OLD');
});

test('deactivate and retire preserve owned records; delete only clears the selected app', () => {
  const s=initialState();
  contacts.create({name:'Kept Contact'},s);
  transition(s,'contacts','deactivate');
  assert.equal(s.modules.contacts.status,'inactive');
  assert.throws(()=>assertActive(s,'contacts'),/inactive/);
  assert.equal(s.contacts.length,1);
  transition(s,'contacts','retire');
  assert.equal(s.modules.contacts.status,'retired');
  assert.throws(()=>assertActive(s,'contacts'),/retired/);
  assert.equal(s.contacts.length,1);
  transition(s,'contacts','delete');
  assert.equal(s.modules.contacts.status,'deleted');
  assert.throws(()=>assertActive(s,'contacts'),/deleted/);
  assert.equal(s.contacts.length,0);
  assert.equal(s.products.length,0);
  assert.throws(()=>transition(s,'unknown','delete'),/Unknown app/);
});

test('demo reset preserves deployed Worker metadata while restoring app lifecycle defaults', () => {
  const previous = initialState();
  previous.modules.products.deploymentStatus = 'deployed';
  previous.modules.products.deploymentUrl = 'https://products.example.test';
  previous.modules.products.workerName = 'products-worker';
  previous.modules.products.repositoryPath = 'apps/products';
  transition(previous, 'products', 'deactivate');

  const reset = resetDemoState(previous);
  assert.equal(reset.modules.products.status, 'active');
  assert.equal(reset.modules.products.deploymentStatus, 'deployed');
  assert.equal(reset.modules.products.deploymentUrl, 'https://products.example.test');
  assert.equal(reset.modules.products.workerName, 'products-worker');
  assert.equal(reset.modules.products.repositoryPath, 'apps/products');
  assert.deepEqual(reset.products, []);
});

test('contact and task removal do not remove other apps or saved customer snapshots', () => {
  const s=initialState();
  const c=contacts.create({name:'ABC Studio'},s);
  const p=products.create({name:'Marble Sample',sku:'M-1',price:500},s);
  const o=orders.create({orderNo:'ORD-001',customerId:c.id,productId:p.id,quantity:4},s);
  tasks.create({name:'Confirm delivery',assignedTo:'Alex',orderId:o.id},s);
  transition(s,'contacts','delete');
  assert.equal(s.orders[0].customerName,'ABC Studio');
  assert.equal(s.orders[0].productName,'Marble Sample');
  assert.equal(s.products.length,1);
  assert.equal(s.tasks[0].orderRef,'ORD-001');
  transition(s,'tasks','delete');
  assert.equal(s.tasks.length,0);
  assert.equal(s.orders.length,1);
  assert.equal(s.products.length,1);
  const manual=orders.create({orderNo:'ORD-002',customerName:'Manual Studio',productName:'Manual Item',unitPrice:10,quantity:1},s);
  assert.equal(manual.total,10);
});

test('every app can connect to each of the other three and keep snapshots after deletion', () => {
  const s = initialState();
  s.products.push({ id:'seed-product', name:'Marble Sample', price:500 });
  s.orders.push({ id:'seed-order', orderNo:'ORD-001' });
  s.tasks.push({ id:'seed-task', name:'Confirm delivery' });
  const c = contacts.create({ name:'ABC Studio', productId:'seed-product', orderId:'seed-order', taskId:'seed-task' },s);
  const p = products.create({ name:'Granite Sample', sku:'G-1', price:250, contactId:c.id, orderId:'seed-order', taskId:'seed-task' },s);
  const o = orders.create({ orderNo:'ORD-002', customerId:c.id, productId:p.id, taskId:'seed-task', quantity:2 },s);
  const t = tasks.create({ name:'Pack sample', assignedTo:'Alex', orderId:o.id, contactId:c.id, productId:p.id },s);

  assert.equal(c.productId,'seed-product');
  assert.equal(c.orderRef,'ORD-001');
  assert.equal(c.taskName,'Confirm delivery');
  assert.equal(p.contactId,c.id);
  assert.equal(p.orderRef,'ORD-001');
  assert.equal(p.taskName,'Confirm delivery');
  assert.equal(o.customerId,c.id);
  assert.equal(o.productId,p.id);
  assert.equal(o.taskId,'seed-task');
  assert.equal(t.orderId,o.id);
  assert.equal(t.contactId,c.id);
  assert.equal(t.productId,p.id);

  transition(s,'contacts','delete');
  assert.equal(s.products[1].contactName,'ABC Studio');
  assert.equal(s.orders[1].customerName,'ABC Studio');
  assert.equal(s.tasks[1].contactName,'ABC Studio');
  transition(s,'products','delete');
  assert.equal(s.orders[1].productName,'Granite Sample');
  assert.equal(s.tasks[1].productName,'Granite Sample');
  transition(s,'orders','delete');
  assert.equal(s.tasks[1].orderRef,'ORD-002');
  transition(s,'tasks','delete');
  assert.equal(s.products.length,0);
  assert.equal(s.orders.length,0);
  assert.equal(s.tasks.length,0);
});


