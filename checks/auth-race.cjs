const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
async function scenario(kind) {
 let state = [], cursor = 0, effect, event, pending = [];
 const service = { getCurrentUser: () => new Promise(resolve => pending.push(resolve)), onAuthStateChange: cb => { event = cb; return () => {}; } };
 let source = fs.readFileSync(require('path').join(__dirname,'../src/context/AuthContext.jsx'),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'').replace(/return \(\s*<AuthContext.Provider[\s\S]*?<\/AuthContext.Provider>\s*\);/, 'return value;');
 const context = { authService:service, console, createContext:()=>({}), useContext:()=>{}, useState:initial=>{ const i=cursor++; state[i]=initial; return [initial,value=>state[i]=value]; }, useCallback:cb=>cb, useRef:value=>({current:value}), useEffect:cb=>effect=cb };
 vm.createContext(context); vm.runInContext(source+'\nthis.mount=AuthProvider;',context); context.mount({children:null}); effect();
 if(kind==='signout') { await event(null); pending[0]({id:'old-user'}); }
 else { const first=event({user:{id:'A'}}); const second=event({user:{id:'B'}}); pending[2]({id:'B'}); await second; pending[1]({id:'A'}); await first; pending[0](null); }
 await new Promise(resolve=>setImmediate(resolve));
 return state[0];
}
(async()=>{for(const kind of ['signout','switch']) {const actual=await scenario(kind);const expected=kind==='signout'?null:'B'; console.log(kind,JSON.stringify(actual)); assert.equal(actual?.id??null,expected);} })().catch(e=>{console.error(e);process.exitCode=1});
