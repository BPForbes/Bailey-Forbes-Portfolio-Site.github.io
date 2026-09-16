import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.mjs';
const env = { TURNSTILE_SECRET: 'test-only', RESEND_API_KEY: 'test-only', CONTACT_FROM: 'contact@example.com', CONTACT_TO: 'owner@example.com' };
const valid = {name:'Visitor',email:'visitor@example.com',message:'Hello',token:'test-token'};
const request = (data=valid, origin='https://bailey-forbes.com') => new Request('https://contact.example/api/contact', {method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
test('rejects untrusted origin without contacting providers', async () => {
  assert.equal((await worker.fetch(request(valid,'https://evil.example'),env)).status,403);
});
test('fails closed without configured secrets', async () => {assert.equal((await worker.fetch(request(),{})).status,503);});
test('rejects oversized message and malformed email', async () => {
  for (const body of [{...valid,message:'x'.repeat(17000)},{...valid,email:'bad\r\n@example.com'}]) assert.ok((await worker.fetch(request(body),env)).status>=400);
});
test('validates token, hostname and action before sending email', async t => {
  for (const verification of [{success:false},{success:true,hostname:'evil.example',action:'contact'},{success:true,hostname:'bailey-forbes.com',action:'login'}]) {
    let calls=0;
    const mock=t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(verification);});
    assert.equal((await worker.fetch(request(),env)).status,400);
    assert.equal(calls,1);mock.mock.restore();
  }
});
test('successful verification sends fixed recipient and visitor reply-to', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json(calls.length===1?{success:true,hostname:'www.bailey-forbes.com',action:'contact'}:{id:'message-id'});});
  const response=await worker.fetch(request(valid,'https://www.bailey-forbes.com'),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://www.bailey-forbes.com');
  assert.deepEqual(calls[1].body.to,['owner@example.com']);
  assert.equal(calls[1].body.reply_to,valid.email);
  assert.equal(calls[1].body.from,env.CONTACT_FROM);
  assert.ok(!JSON.stringify(calls[1]).includes('test-token'));
});
test('provider failure never returns success', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>++calls===1?Response.json({success:true,hostname:'bailey-forbes.com',action:'contact'}):Response.json({error:'failure'},{status:429}));
  assert.equal((await worker.fetch(request(),env)).status,502);
});
test('CORS preflight is restricted to production origin',async()=>{
  const response=await worker.fetch(new Request('https://contact.example/api/contact',{method:'OPTIONS',headers:{Origin:'https://bailey-forbes.com'}}),env);
  assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Methods'),'POST');
});
