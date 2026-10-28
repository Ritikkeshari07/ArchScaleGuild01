const test = require('node:test');
const assert = require('node:assert/strict');
const { initialState } = require('../src/platform/registry');
const { transition, assertActive } = require('../src/platform/lifecycle');
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

