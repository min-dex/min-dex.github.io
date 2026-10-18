const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync('app.js','utf8').split('function createLiveRefreshScheduler')[1].split('// Local and remote notifications')[0];
let now=0, serial=0, calls=0;const timers=new Map(),events={};
const context={Date:{now:()=>now},setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id),document:{addEventListener:(name,fn)=>events[name]=fn}};
vm.createContext(context);vm.runInContext('function createLiveRefreshScheduler'+source,context);
const pending=new Map([['a',true]]),schedule=context.createLiveRefreshScheduler(pending,()=>calls++);
function advance(ms){const end=now+ms;while(true){const item=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!item||item[1].at>end)break;now=item[1].at;timers.delete(item[0]);item[1].fn()}now=end}
for(let i=0;i<100;i++)schedule();assert.equal(timers.size,1);advance(79);assert.equal(calls,0);advance(1);assert.equal(calls,1);
schedule(2000);advance(100);events.focusout();advance(80);assert.equal(calls,2);assert.equal(timers.size,0);
for(const name of ['pause','ended','close']){schedule(2000);events[name]();advance(80)}assert.equal(calls,5);
// A failure must replace an already queued fast notification, not vice versa.
schedule();schedule(15000);advance(100);for(let i=0;i<100;i++){schedule();events.focusout()}advance(14899);assert.equal(calls,5);advance(1);assert.equal(calls,6);
pending.clear();schedule();for(const fn of Object.values(events))fn();assert.equal(timers.size,0);
console.log('PASS 80ms burst coalescing, deferred-read preemption, media/dialog wake, preserved 15s error backoff, empty queue');
