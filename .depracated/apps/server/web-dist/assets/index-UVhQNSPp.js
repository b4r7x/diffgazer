import{r as Ky,a as Yy,g as qy,b,j as d,O as Fy,u as Xy,c as ea,d as Yh,e as qh,f as Qy,h as Qa,i as $y,k as Jy,R as Wy}from"./router-C6lT6upl.js";(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))u(o);new MutationObserver(o=>{for(const f of o)if(f.type==="childList")for(const _ of f.addedNodes)_.tagName==="LINK"&&_.rel==="modulepreload"&&u(_)}).observe(document,{childList:!0,subtree:!0});function s(o){const f={};return o.integrity&&(f.integrity=o.integrity),o.referrerPolicy&&(f.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?f.credentials="include":o.crossOrigin==="anonymous"?f.credentials="omit":f.credentials="same-origin",f}function u(o){if(o.ep)return;o.ep=!0;const f=s(o);fetch(o.href,f)}})();var so={exports:{}},Wi={},ro={exports:{}},uo={};var lh;function Py(){return lh||(lh=1,(function(l){function i(H,B){var Q=H.length;H.push(B);e:for(;0<Q;){var Le=Q-1>>>1,Ge=H[Le];if(0<o(Ge,B))H[Le]=B,H[Q]=Ge,Q=Le;else break e}}function s(H){return H.length===0?null:H[0]}function u(H){if(H.length===0)return null;var B=H[0],Q=H.pop();if(Q!==B){H[0]=Q;e:for(var Le=0,Ge=H.length,Te=Ge>>>1;Le<Te;){var L=2*(Le+1)-1,N=H[L],x=L+1,w=H[x];if(0>o(N,Q))x<Ge&&0>o(w,N)?(H[Le]=w,H[x]=Q,Le=x):(H[Le]=N,H[L]=Q,Le=L);else if(x<Ge&&0>o(w,Q))H[Le]=w,H[x]=Q,Le=x;else break e}}return B}function o(H,B){var Q=H.sortIndex-B.sortIndex;return Q!==0?Q:H.id-B.id}if(l.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var f=performance;l.unstable_now=function(){return f.now()}}else{var _=Date,h=_.now();l.unstable_now=function(){return _.now()-h}}var p=[],v=[],y=1,T=null,E=3,U=!1,I=!1,D=!1,K=!1,le=typeof setTimeout=="function"?setTimeout:null,ve=typeof clearTimeout=="function"?clearTimeout:null,ae=typeof setImmediate<"u"?setImmediate:null;function q(H){for(var B=s(v);B!==null;){if(B.callback===null)u(v);else if(B.startTime<=H)u(v),B.sortIndex=B.expirationTime,i(p,B);else break;B=s(v)}}function ie(H){if(D=!1,q(H),!I)if(s(p)!==null)I=!0,te||(te=!0,Ie());else{var B=s(v);B!==null&&ye(ie,B.startTime-H)}}var te=!1,ge=-1,ne=5,Xe=-1;function yt(){return K?!0:!(l.unstable_now()-Xe<ne)}function dt(){if(K=!1,te){var H=l.unstable_now();Xe=H;var B=!0;try{e:{I=!1,D&&(D=!1,ve(ge),ge=-1),U=!0;var Q=E;try{t:{for(q(H),T=s(p);T!==null&&!(T.expirationTime>H&&yt());){var Le=T.callback;if(typeof Le=="function"){T.callback=null,E=T.priorityLevel;var Ge=Le(T.expirationTime<=H);if(H=l.unstable_now(),typeof Ge=="function"){T.callback=Ge,q(H),B=!0;break t}T===s(p)&&u(p),q(H)}else u(p);T=s(p)}if(T!==null)B=!0;else{var Te=s(v);Te!==null&&ye(ie,Te.startTime-H),B=!1}}break e}finally{T=null,E=Q,U=!1}B=void 0}}finally{B?Ie():te=!1}}}var Ie;if(typeof ae=="function")Ie=function(){ae(dt)};else if(typeof MessageChannel<"u"){var rt=new MessageChannel,nt=rt.port2;rt.port1.onmessage=dt,Ie=function(){nt.postMessage(null)}}else Ie=function(){le(dt,0)};function ye(H,B){ge=le(function(){H(l.unstable_now())},B)}l.unstable_IdlePriority=5,l.unstable_ImmediatePriority=1,l.unstable_LowPriority=4,l.unstable_NormalPriority=3,l.unstable_Profiling=null,l.unstable_UserBlockingPriority=2,l.unstable_cancelCallback=function(H){H.callback=null},l.unstable_forceFrameRate=function(H){0>H||125<H?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):ne=0<H?Math.floor(1e3/H):5},l.unstable_getCurrentPriorityLevel=function(){return E},l.unstable_next=function(H){switch(E){case 1:case 2:case 3:var B=3;break;default:B=E}var Q=E;E=B;try{return H()}finally{E=Q}},l.unstable_requestPaint=function(){K=!0},l.unstable_runWithPriority=function(H,B){switch(H){case 1:case 2:case 3:case 4:case 5:break;default:H=3}var Q=E;E=H;try{return B()}finally{E=Q}},l.unstable_scheduleCallback=function(H,B,Q){var Le=l.unstable_now();switch(typeof Q=="object"&&Q!==null?(Q=Q.delay,Q=typeof Q=="number"&&0<Q?Le+Q:Le):Q=Le,H){case 1:var Ge=-1;break;case 2:Ge=250;break;case 5:Ge=1073741823;break;case 4:Ge=1e4;break;default:Ge=5e3}return Ge=Q+Ge,H={id:y++,callback:B,priorityLevel:H,startTime:Q,expirationTime:Ge,sortIndex:-1},Q>Le?(H.sortIndex=Q,i(v,H),s(p)===null&&H===s(v)&&(D?(ve(ge),ge=-1):D=!0,ye(ie,Q-Le))):(H.sortIndex=Ge,i(p,H),I||U||(I=!0,te||(te=!0,Ie()))),H},l.unstable_shouldYield=yt,l.unstable_wrapCallback=function(H){var B=E;return function(){var Q=E;E=B;try{return H.apply(this,arguments)}finally{E=Q}}}})(uo)),uo}var ih;function eb(){return ih||(ih=1,ro.exports=Py()),ro.exports}var sh;function tb(){if(sh)return Wi;sh=1;var l=eb(),i=Ky(),s=Yy();function u(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var a=2;a<arguments.length;a++)t+="&args[]="+encodeURIComponent(arguments[a])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function o(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function f(e){var t=e,a=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(a=t.return),e=t.return;while(e)}return t.tag===3?a:null}function _(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function h(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function p(e){if(f(e)!==e)throw Error(u(188))}function v(e){var t=e.alternate;if(!t){if(t=f(e),t===null)throw Error(u(188));return t!==e?null:e}for(var a=e,n=t;;){var r=a.return;if(r===null)break;var c=r.alternate;if(c===null){if(n=r.return,n!==null){a=n;continue}break}if(r.child===c.child){for(c=r.child;c;){if(c===a)return p(r),e;if(c===n)return p(r),t;c=c.sibling}throw Error(u(188))}if(a.return!==n.return)a=r,n=c;else{for(var m=!1,g=r.child;g;){if(g===a){m=!0,a=r,n=c;break}if(g===n){m=!0,n=r,a=c;break}g=g.sibling}if(!m){for(g=c.child;g;){if(g===a){m=!0,a=c,n=r;break}if(g===n){m=!0,n=c,a=r;break}g=g.sibling}if(!m)throw Error(u(189))}}if(a.alternate!==n)throw Error(u(190))}if(a.tag!==3)throw Error(u(188));return a.stateNode.current===a?e:t}function y(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=y(e),t!==null)return t;e=e.sibling}return null}var T=Object.assign,E=Symbol.for("react.element"),U=Symbol.for("react.transitional.element"),I=Symbol.for("react.portal"),D=Symbol.for("react.fragment"),K=Symbol.for("react.strict_mode"),le=Symbol.for("react.profiler"),ve=Symbol.for("react.consumer"),ae=Symbol.for("react.context"),q=Symbol.for("react.forward_ref"),ie=Symbol.for("react.suspense"),te=Symbol.for("react.suspense_list"),ge=Symbol.for("react.memo"),ne=Symbol.for("react.lazy"),Xe=Symbol.for("react.activity"),yt=Symbol.for("react.memo_cache_sentinel"),dt=Symbol.iterator;function Ie(e){return e===null||typeof e!="object"?null:(e=dt&&e[dt]||e["@@iterator"],typeof e=="function"?e:null)}var rt=Symbol.for("react.client.reference");function nt(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===rt?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case D:return"Fragment";case le:return"Profiler";case K:return"StrictMode";case ie:return"Suspense";case te:return"SuspenseList";case Xe:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case I:return"Portal";case ae:return e.displayName||"Context";case ve:return(e._context.displayName||"Context")+".Consumer";case q:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case ge:return t=e.displayName||null,t!==null?t:nt(e.type)||"Memo";case ne:t=e._payload,e=e._init;try{return nt(e(t))}catch{}}return null}var ye=Array.isArray,H=i.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,B=s.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Q={pending:!1,data:null,method:null,action:null},Le=[],Ge=-1;function Te(e){return{current:e}}function L(e){0>Ge||(e.current=Le[Ge],Le[Ge]=null,Ge--)}function N(e,t){Ge++,Le[Ge]=e.current,e.current=t}var x=Te(null),w=Te(null),X=Te(null),F=Te(null);function ee(e,t){switch(N(X,t),N(w,e),N(x,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?Nm(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=Nm(t),e=Cm(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}L(x),N(x,e)}function z(){L(x),L(w),L(X)}function $(e){e.memoizedState!==null&&N(F,e);var t=x.current,a=Cm(t,e.type);t!==a&&(N(w,e),N(x,a))}function re(e){w.current===e&&(L(x),L(w)),F.current===e&&(L(F),Xi._currentValue=Q)}var he,Ee;function xe(e){if(he===void 0)try{throw Error()}catch(a){var t=a.stack.trim().match(/\n( *(at )?)/);he=t&&t[1]||"",Ee=-1<a.stack.indexOf(`
    at`)?" (<anonymous>)":-1<a.stack.indexOf("@")?"@unknown:0:0":""}return`
`+he+e+Ee}var we=!1;function jt(e,t){if(!e||we)return"";we=!0;var a=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var n={DetermineComponentFrameRoot:function(){try{if(t){var Y=function(){throw Error()};if(Object.defineProperty(Y.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(Y,[])}catch(k){var M=k}Reflect.construct(e,[],Y)}else{try{Y.call()}catch(k){M=k}e.call(Y.prototype)}}else{try{throw Error()}catch(k){M=k}(Y=e())&&typeof Y.catch=="function"&&Y.catch(function(){})}}catch(k){if(k&&M&&typeof k.stack=="string")return[k.stack,M.stack]}return[null,null]}};n.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var r=Object.getOwnPropertyDescriptor(n.DetermineComponentFrameRoot,"name");r&&r.configurable&&Object.defineProperty(n.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var c=n.DetermineComponentFrameRoot(),m=c[0],g=c[1];if(m&&g){var S=m.split(`
`),O=g.split(`
`);for(r=n=0;n<S.length&&!S[n].includes("DetermineComponentFrameRoot");)n++;for(;r<O.length&&!O[r].includes("DetermineComponentFrameRoot");)r++;if(n===S.length||r===O.length)for(n=S.length-1,r=O.length-1;1<=n&&0<=r&&S[n]!==O[r];)r--;for(;1<=n&&0<=r;n--,r--)if(S[n]!==O[r]){if(n!==1||r!==1)do if(n--,r--,0>r||S[n]!==O[r]){var G=`
`+S[n].replace(" at new "," at ");return e.displayName&&G.includes("<anonymous>")&&(G=G.replace("<anonymous>",e.displayName)),G}while(1<=n&&0<=r);break}}}finally{we=!1,Error.prepareStackTrace=a}return(a=e?e.displayName||e.name:"")?xe(a):""}function Ct(e,t){switch(e.tag){case 26:case 27:case 5:return xe(e.type);case 16:return xe("Lazy");case 13:return e.child!==t&&t!==null?xe("Suspense Fallback"):xe("Suspense");case 19:return xe("SuspenseList");case 0:case 15:return jt(e.type,!1);case 11:return jt(e.type.render,!1);case 1:return jt(e.type,!0);case 31:return xe("Activity");default:return""}}function Ja(e){try{var t="",a=null;do t+=Ct(e,a),a=e,e=e.return;while(e);return t}catch(n){return`
Error generating stack: `+n.message+`
`+n.stack}}var Ot=Object.prototype.hasOwnProperty,_a=l.unstable_scheduleCallback,wt=l.unstable_cancelCallback,Lt=l.unstable_shouldYield,Fr=l.unstable_requestPaint,Bt=l.unstable_now,Ep=l.unstable_getCurrentPriorityLevel,ld=l.unstable_ImmediatePriority,id=l.unstable_UserBlockingPriority,rs=l.unstable_NormalPriority,Ap=l.unstable_LowPriority,sd=l.unstable_IdlePriority,Rp=l.log,Np=l.unstable_setDisableYieldValue,si=null,Vt=null;function Wa(e){if(typeof Rp=="function"&&Np(e),Vt&&typeof Vt.setStrictMode=="function")try{Vt.setStrictMode(si,e)}catch{}}var Zt=Math.clz32?Math.clz32:Lp,Cp=Math.log,wp=Math.LN2;function Lp(e){return e>>>=0,e===0?32:31-(Cp(e)/wp|0)|0}var us=256,cs=262144,os=4194304;function jn(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function ds(e,t,a){var n=e.pendingLanes;if(n===0)return 0;var r=0,c=e.suspendedLanes,m=e.pingedLanes;e=e.warmLanes;var g=n&134217727;return g!==0?(n=g&~c,n!==0?r=jn(n):(m&=g,m!==0?r=jn(m):a||(a=g&~e,a!==0&&(r=jn(a))))):(g=n&~c,g!==0?r=jn(g):m!==0?r=jn(m):a||(a=n&~e,a!==0&&(r=jn(a)))),r===0?0:t!==0&&t!==r&&(t&c)===0&&(c=r&-r,a=t&-t,c>=a||c===32&&(a&4194048)!==0)?t:r}function ri(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function jp(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function rd(){var e=os;return os<<=1,(os&62914560)===0&&(os=4194304),e}function Xr(e){for(var t=[],a=0;31>a;a++)t.push(e);return t}function ui(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function Op(e,t,a,n,r,c){var m=e.pendingLanes;e.pendingLanes=a,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=a,e.entangledLanes&=a,e.errorRecoveryDisabledLanes&=a,e.shellSuspendCounter=0;var g=e.entanglements,S=e.expirationTimes,O=e.hiddenUpdates;for(a=m&~a;0<a;){var G=31-Zt(a),Y=1<<G;g[G]=0,S[G]=-1;var M=O[G];if(M!==null)for(O[G]=null,G=0;G<M.length;G++){var k=M[G];k!==null&&(k.lane&=-536870913)}a&=~Y}n!==0&&ud(e,n,0),c!==0&&r===0&&e.tag!==0&&(e.suspendedLanes|=c&~(m&~t))}function ud(e,t,a){e.pendingLanes|=t,e.suspendedLanes&=~t;var n=31-Zt(t);e.entangledLanes|=t,e.entanglements[n]=e.entanglements[n]|1073741824|a&261930}function cd(e,t){var a=e.entangledLanes|=t;for(e=e.entanglements;a;){var n=31-Zt(a),r=1<<n;r&t|e[n]&t&&(e[n]|=t),a&=~r}}function od(e,t){var a=t&-t;return a=(a&42)!==0?1:Qr(a),(a&(e.suspendedLanes|t))!==0?0:a}function Qr(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function $r(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function dd(){var e=B.p;return e!==0?e:(e=window.event,e===void 0?32:Jm(e.type))}function fd(e,t){var a=B.p;try{return B.p=e,t()}finally{B.p=a}}var Pa=Math.random().toString(36).slice(2),Tt="__reactFiber$"+Pa,Mt="__reactProps$"+Pa,ul="__reactContainer$"+Pa,Jr="__reactEvents$"+Pa,Ip="__reactListeners$"+Pa,Mp="__reactHandles$"+Pa,_d="__reactResources$"+Pa,ci="__reactMarker$"+Pa;function Wr(e){delete e[Tt],delete e[Mt],delete e[Jr],delete e[Ip],delete e[Mp]}function cl(e){var t=e[Tt];if(t)return t;for(var a=e.parentNode;a;){if(t=a[ul]||a[Tt]){if(a=t.alternate,t.child!==null||a!==null&&a.child!==null)for(e=Dm(e);e!==null;){if(a=e[Tt])return a;e=Dm(e)}return t}e=a,a=e.parentNode}return null}function ol(e){if(e=e[Tt]||e[ul]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function oi(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(u(33))}function dl(e){var t=e[_d];return t||(t=e[_d]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function bt(e){e[ci]=!0}var md=new Set,hd={};function On(e,t){fl(e,t),fl(e+"Capture",t)}function fl(e,t){for(hd[e]=t,e=0;e<t.length;e++)md.add(t[e])}var Dp=RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"),gd={},pd={};function kp(e){return Ot.call(pd,e)?!0:Ot.call(gd,e)?!1:Dp.test(e)?pd[e]=!0:(gd[e]=!0,!1)}function fs(e,t,a){if(kp(t))if(a===null)e.removeAttribute(t);else{switch(typeof a){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var n=t.toLowerCase().slice(0,5);if(n!=="data-"&&n!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+a)}}function _s(e,t,a){if(a===null)e.removeAttribute(t);else{switch(typeof a){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+a)}}function Ra(e,t,a,n){if(n===null)e.removeAttribute(a);else{switch(typeof n){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(a);return}e.setAttributeNS(t,a,""+n)}}function ta(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function vd(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function zp(e,t,a){var n=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof n<"u"&&typeof n.get=="function"&&typeof n.set=="function"){var r=n.get,c=n.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return r.call(this)},set:function(m){a=""+m,c.call(this,m)}}),Object.defineProperty(e,t,{enumerable:n.enumerable}),{getValue:function(){return a},setValue:function(m){a=""+m},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Pr(e){if(!e._valueTracker){var t=vd(e)?"checked":"value";e._valueTracker=zp(e,t,""+e[t])}}function yd(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var a=t.getValue(),n="";return e&&(n=vd(e)?e.checked?"true":"false":e.value),e=n,e!==a?(t.setValue(e),!0):!1}function ms(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var Up=/[\n"\\]/g;function aa(e){return e.replace(Up,function(t){return"\\"+t.charCodeAt(0).toString(16)+" "})}function eu(e,t,a,n,r,c,m,g){e.name="",m!=null&&typeof m!="function"&&typeof m!="symbol"&&typeof m!="boolean"?e.type=m:e.removeAttribute("type"),t!=null?m==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+ta(t)):e.value!==""+ta(t)&&(e.value=""+ta(t)):m!=="submit"&&m!=="reset"||e.removeAttribute("value"),t!=null?tu(e,m,ta(t)):a!=null?tu(e,m,ta(a)):n!=null&&e.removeAttribute("value"),r==null&&c!=null&&(e.defaultChecked=!!c),r!=null&&(e.checked=r&&typeof r!="function"&&typeof r!="symbol"),g!=null&&typeof g!="function"&&typeof g!="symbol"&&typeof g!="boolean"?e.name=""+ta(g):e.removeAttribute("name")}function bd(e,t,a,n,r,c,m,g){if(c!=null&&typeof c!="function"&&typeof c!="symbol"&&typeof c!="boolean"&&(e.type=c),t!=null||a!=null){if(!(c!=="submit"&&c!=="reset"||t!=null)){Pr(e);return}a=a!=null?""+ta(a):"",t=t!=null?""+ta(t):a,g||t===e.value||(e.value=t),e.defaultValue=t}n=n??r,n=typeof n!="function"&&typeof n!="symbol"&&!!n,e.checked=g?e.checked:!!n,e.defaultChecked=!!n,m!=null&&typeof m!="function"&&typeof m!="symbol"&&typeof m!="boolean"&&(e.name=m),Pr(e)}function tu(e,t,a){t==="number"&&ms(e.ownerDocument)===e||e.defaultValue===""+a||(e.defaultValue=""+a)}function _l(e,t,a,n){if(e=e.options,t){t={};for(var r=0;r<a.length;r++)t["$"+a[r]]=!0;for(a=0;a<e.length;a++)r=t.hasOwnProperty("$"+e[a].value),e[a].selected!==r&&(e[a].selected=r),r&&n&&(e[a].defaultSelected=!0)}else{for(a=""+ta(a),t=null,r=0;r<e.length;r++){if(e[r].value===a){e[r].selected=!0,n&&(e[r].defaultSelected=!0);return}t!==null||e[r].disabled||(t=e[r])}t!==null&&(t.selected=!0)}}function xd(e,t,a){if(t!=null&&(t=""+ta(t),t!==e.value&&(e.value=t),a==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=a!=null?""+ta(a):""}function Sd(e,t,a,n){if(t==null){if(n!=null){if(a!=null)throw Error(u(92));if(ye(n)){if(1<n.length)throw Error(u(93));n=n[0]}a=n}a==null&&(a=""),t=a}a=ta(t),e.defaultValue=a,n=e.textContent,n===a&&n!==""&&n!==null&&(e.value=n),Pr(e)}function ml(e,t){if(t){var a=e.firstChild;if(a&&a===e.lastChild&&a.nodeType===3){a.nodeValue=t;return}}e.textContent=t}var Hp=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function Td(e,t,a){var n=t.indexOf("--")===0;a==null||typeof a=="boolean"||a===""?n?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":n?e.setProperty(t,a):typeof a!="number"||a===0||Hp.has(t)?t==="float"?e.cssFloat=a:e[t]=(""+a).trim():e[t]=a+"px"}function Ed(e,t,a){if(t!=null&&typeof t!="object")throw Error(u(62));if(e=e.style,a!=null){for(var n in a)!a.hasOwnProperty(n)||t!=null&&t.hasOwnProperty(n)||(n.indexOf("--")===0?e.setProperty(n,""):n==="float"?e.cssFloat="":e[n]="");for(var r in t)n=t[r],t.hasOwnProperty(r)&&a[r]!==n&&Td(e,r,n)}else for(var c in t)t.hasOwnProperty(c)&&Td(e,c,t[c])}function au(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var Gp=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),Bp=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function hs(e){return Bp.test(""+e)?"javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')":e}function Na(){}var nu=null;function lu(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var hl=null,gl=null;function Ad(e){var t=ol(e);if(t&&(e=t.stateNode)){var a=e[Mt]||null;e:switch(e=t.stateNode,t.type){case"input":if(eu(e,a.value,a.defaultValue,a.defaultValue,a.checked,a.defaultChecked,a.type,a.name),t=a.name,a.type==="radio"&&t!=null){for(a=e;a.parentNode;)a=a.parentNode;for(a=a.querySelectorAll('input[name="'+aa(""+t)+'"][type="radio"]'),t=0;t<a.length;t++){var n=a[t];if(n!==e&&n.form===e.form){var r=n[Mt]||null;if(!r)throw Error(u(90));eu(n,r.value,r.defaultValue,r.defaultValue,r.checked,r.defaultChecked,r.type,r.name)}}for(t=0;t<a.length;t++)n=a[t],n.form===e.form&&yd(n)}break e;case"textarea":xd(e,a.value,a.defaultValue);break e;case"select":t=a.value,t!=null&&_l(e,!!a.multiple,t,!1)}}}var iu=!1;function Rd(e,t,a){if(iu)return e(t,a);iu=!0;try{var n=e(t);return n}finally{if(iu=!1,(hl!==null||gl!==null)&&(ar(),hl&&(t=hl,e=gl,gl=hl=null,Ad(t),e)))for(t=0;t<e.length;t++)Ad(e[t])}}function di(e,t){var a=e.stateNode;if(a===null)return null;var n=a[Mt]||null;if(n===null)return null;a=n[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(n=!n.disabled)||(e=e.type,n=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!n;break e;default:e=!1}if(e)return null;if(a&&typeof a!="function")throw Error(u(231,t,typeof a));return a}var Ca=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),su=!1;if(Ca)try{var fi={};Object.defineProperty(fi,"passive",{get:function(){su=!0}}),window.addEventListener("test",fi,fi),window.removeEventListener("test",fi,fi)}catch{su=!1}var en=null,ru=null,gs=null;function Nd(){if(gs)return gs;var e,t=ru,a=t.length,n,r="value"in en?en.value:en.textContent,c=r.length;for(e=0;e<a&&t[e]===r[e];e++);var m=a-e;for(n=1;n<=m&&t[a-n]===r[c-n];n++);return gs=r.slice(e,1<n?1-n:void 0)}function ps(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function vs(){return!0}function Cd(){return!1}function Dt(e){function t(a,n,r,c,m){this._reactName=a,this._targetInst=r,this.type=n,this.nativeEvent=c,this.target=m,this.currentTarget=null;for(var g in e)e.hasOwnProperty(g)&&(a=e[g],this[g]=a?a(c):c[g]);return this.isDefaultPrevented=(c.defaultPrevented!=null?c.defaultPrevented:c.returnValue===!1)?vs:Cd,this.isPropagationStopped=Cd,this}return T(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var a=this.nativeEvent;a&&(a.preventDefault?a.preventDefault():typeof a.returnValue!="unknown"&&(a.returnValue=!1),this.isDefaultPrevented=vs)},stopPropagation:function(){var a=this.nativeEvent;a&&(a.stopPropagation?a.stopPropagation():typeof a.cancelBubble!="unknown"&&(a.cancelBubble=!0),this.isPropagationStopped=vs)},persist:function(){},isPersistent:vs}),t}var In={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},ys=Dt(In),_i=T({},In,{view:0,detail:0}),Vp=Dt(_i),uu,cu,mi,bs=T({},_i,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:du,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==mi&&(mi&&e.type==="mousemove"?(uu=e.screenX-mi.screenX,cu=e.screenY-mi.screenY):cu=uu=0,mi=e),uu)},movementY:function(e){return"movementY"in e?e.movementY:cu}}),wd=Dt(bs),Zp=T({},bs,{dataTransfer:0}),Kp=Dt(Zp),Yp=T({},_i,{relatedTarget:0}),ou=Dt(Yp),qp=T({},In,{animationName:0,elapsedTime:0,pseudoElement:0}),Fp=Dt(qp),Xp=T({},In,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),Qp=Dt(Xp),$p=T({},In,{data:0}),Ld=Dt($p),Jp={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Wp={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},Pp={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function ev(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=Pp[e])?!!t[e]:!1}function du(){return ev}var tv=T({},_i,{key:function(e){if(e.key){var t=Jp[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=ps(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Wp[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:du,charCode:function(e){return e.type==="keypress"?ps(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?ps(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),av=Dt(tv),nv=T({},bs,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),jd=Dt(nv),lv=T({},_i,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:du}),iv=Dt(lv),sv=T({},In,{propertyName:0,elapsedTime:0,pseudoElement:0}),rv=Dt(sv),uv=T({},bs,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),cv=Dt(uv),ov=T({},In,{newState:0,oldState:0}),dv=Dt(ov),fv=[9,13,27,32],fu=Ca&&"CompositionEvent"in window,hi=null;Ca&&"documentMode"in document&&(hi=document.documentMode);var _v=Ca&&"TextEvent"in window&&!hi,Od=Ca&&(!fu||hi&&8<hi&&11>=hi),Id=" ",Md=!1;function Dd(e,t){switch(e){case"keyup":return fv.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function kd(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var pl=!1;function mv(e,t){switch(e){case"compositionend":return kd(t);case"keypress":return t.which!==32?null:(Md=!0,Id);case"textInput":return e=t.data,e===Id&&Md?null:e;default:return null}}function hv(e,t){if(pl)return e==="compositionend"||!fu&&Dd(e,t)?(e=Nd(),gs=ru=en=null,pl=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return Od&&t.locale!=="ko"?null:t.data;default:return null}}var gv={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function zd(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!gv[e.type]:t==="textarea"}function Ud(e,t,a,n){hl?gl?gl.push(n):gl=[n]:hl=n,t=cr(t,"onChange"),0<t.length&&(a=new ys("onChange","change",null,a,n),e.push({event:a,listeners:t}))}var gi=null,pi=null;function pv(e){xm(e,0)}function xs(e){var t=oi(e);if(yd(t))return e}function Hd(e,t){if(e==="change")return t}var Gd=!1;if(Ca){var _u;if(Ca){var mu="oninput"in document;if(!mu){var Bd=document.createElement("div");Bd.setAttribute("oninput","return;"),mu=typeof Bd.oninput=="function"}_u=mu}else _u=!1;Gd=_u&&(!document.documentMode||9<document.documentMode)}function Vd(){gi&&(gi.detachEvent("onpropertychange",Zd),pi=gi=null)}function Zd(e){if(e.propertyName==="value"&&xs(pi)){var t=[];Ud(t,pi,e,lu(e)),Rd(pv,t)}}function vv(e,t,a){e==="focusin"?(Vd(),gi=t,pi=a,gi.attachEvent("onpropertychange",Zd)):e==="focusout"&&Vd()}function yv(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return xs(pi)}function bv(e,t){if(e==="click")return xs(t)}function xv(e,t){if(e==="input"||e==="change")return xs(t)}function Sv(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Kt=typeof Object.is=="function"?Object.is:Sv;function vi(e,t){if(Kt(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var a=Object.keys(e),n=Object.keys(t);if(a.length!==n.length)return!1;for(n=0;n<a.length;n++){var r=a[n];if(!Ot.call(t,r)||!Kt(e[r],t[r]))return!1}return!0}function Kd(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Yd(e,t){var a=Kd(e);e=0;for(var n;a;){if(a.nodeType===3){if(n=e+a.textContent.length,e<=t&&n>=t)return{node:a,offset:t-e};e=n}e:{for(;a;){if(a.nextSibling){a=a.nextSibling;break e}a=a.parentNode}a=void 0}a=Kd(a)}}function qd(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?qd(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function Fd(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=ms(e.document);t instanceof e.HTMLIFrameElement;){try{var a=typeof t.contentWindow.location.href=="string"}catch{a=!1}if(a)e=t.contentWindow;else break;t=ms(e.document)}return t}function hu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var Tv=Ca&&"documentMode"in document&&11>=document.documentMode,vl=null,gu=null,yi=null,pu=!1;function Xd(e,t,a){var n=a.window===a?a.document:a.nodeType===9?a:a.ownerDocument;pu||vl==null||vl!==ms(n)||(n=vl,"selectionStart"in n&&hu(n)?n={start:n.selectionStart,end:n.selectionEnd}:(n=(n.ownerDocument&&n.ownerDocument.defaultView||window).getSelection(),n={anchorNode:n.anchorNode,anchorOffset:n.anchorOffset,focusNode:n.focusNode,focusOffset:n.focusOffset}),yi&&vi(yi,n)||(yi=n,n=cr(gu,"onSelect"),0<n.length&&(t=new ys("onSelect","select",null,t,a),e.push({event:t,listeners:n}),t.target=vl)))}function Mn(e,t){var a={};return a[e.toLowerCase()]=t.toLowerCase(),a["Webkit"+e]="webkit"+t,a["Moz"+e]="moz"+t,a}var yl={animationend:Mn("Animation","AnimationEnd"),animationiteration:Mn("Animation","AnimationIteration"),animationstart:Mn("Animation","AnimationStart"),transitionrun:Mn("Transition","TransitionRun"),transitionstart:Mn("Transition","TransitionStart"),transitioncancel:Mn("Transition","TransitionCancel"),transitionend:Mn("Transition","TransitionEnd")},vu={},Qd={};Ca&&(Qd=document.createElement("div").style,"AnimationEvent"in window||(delete yl.animationend.animation,delete yl.animationiteration.animation,delete yl.animationstart.animation),"TransitionEvent"in window||delete yl.transitionend.transition);function Dn(e){if(vu[e])return vu[e];if(!yl[e])return e;var t=yl[e],a;for(a in t)if(t.hasOwnProperty(a)&&a in Qd)return vu[e]=t[a];return e}var $d=Dn("animationend"),Jd=Dn("animationiteration"),Wd=Dn("animationstart"),Ev=Dn("transitionrun"),Av=Dn("transitionstart"),Rv=Dn("transitioncancel"),Pd=Dn("transitionend"),ef=new Map,yu="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");yu.push("scrollEnd");function ma(e,t){ef.set(e,t),On(t,[e])}var Ss=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},na=[],bl=0,bu=0;function Ts(){for(var e=bl,t=bu=bl=0;t<e;){var a=na[t];na[t++]=null;var n=na[t];na[t++]=null;var r=na[t];na[t++]=null;var c=na[t];if(na[t++]=null,n!==null&&r!==null){var m=n.pending;m===null?r.next=r:(r.next=m.next,m.next=r),n.pending=r}c!==0&&tf(a,r,c)}}function Es(e,t,a,n){na[bl++]=e,na[bl++]=t,na[bl++]=a,na[bl++]=n,bu|=n,e.lanes|=n,e=e.alternate,e!==null&&(e.lanes|=n)}function xu(e,t,a,n){return Es(e,t,a,n),As(e)}function kn(e,t){return Es(e,null,null,t),As(e)}function tf(e,t,a){e.lanes|=a;var n=e.alternate;n!==null&&(n.lanes|=a);for(var r=!1,c=e.return;c!==null;)c.childLanes|=a,n=c.alternate,n!==null&&(n.childLanes|=a),c.tag===22&&(e=c.stateNode,e===null||e._visibility&1||(r=!0)),e=c,c=c.return;return e.tag===3?(c=e.stateNode,r&&t!==null&&(r=31-Zt(a),e=c.hiddenUpdates,n=e[r],n===null?e[r]=[t]:n.push(t),t.lane=a|536870912),c):null}function As(e){if(50<Bi)throw Bi=0,Lc=null,Error(u(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var xl={};function Nv(e,t,a,n){this.tag=e,this.key=a,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=n,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Yt(e,t,a,n){return new Nv(e,t,a,n)}function Su(e){return e=e.prototype,!(!e||!e.isReactComponent)}function wa(e,t){var a=e.alternate;return a===null?(a=Yt(e.tag,t,e.key,e.mode),a.elementType=e.elementType,a.type=e.type,a.stateNode=e.stateNode,a.alternate=e,e.alternate=a):(a.pendingProps=t,a.type=e.type,a.flags=0,a.subtreeFlags=0,a.deletions=null),a.flags=e.flags&65011712,a.childLanes=e.childLanes,a.lanes=e.lanes,a.child=e.child,a.memoizedProps=e.memoizedProps,a.memoizedState=e.memoizedState,a.updateQueue=e.updateQueue,t=e.dependencies,a.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},a.sibling=e.sibling,a.index=e.index,a.ref=e.ref,a.refCleanup=e.refCleanup,a}function af(e,t){e.flags&=65011714;var a=e.alternate;return a===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=a.childLanes,e.lanes=a.lanes,e.child=a.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=a.memoizedProps,e.memoizedState=a.memoizedState,e.updateQueue=a.updateQueue,e.type=a.type,t=a.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function Rs(e,t,a,n,r,c){var m=0;if(n=e,typeof e=="function")Su(e)&&(m=1);else if(typeof e=="string")m=Oy(e,a,x.current)?26:e==="html"||e==="head"||e==="body"?27:5;else e:switch(e){case Xe:return e=Yt(31,a,t,r),e.elementType=Xe,e.lanes=c,e;case D:return zn(a.children,r,c,t);case K:m=8,r|=24;break;case le:return e=Yt(12,a,t,r|2),e.elementType=le,e.lanes=c,e;case ie:return e=Yt(13,a,t,r),e.elementType=ie,e.lanes=c,e;case te:return e=Yt(19,a,t,r),e.elementType=te,e.lanes=c,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case ae:m=10;break e;case ve:m=9;break e;case q:m=11;break e;case ge:m=14;break e;case ne:m=16,n=null;break e}m=29,a=Error(u(130,e===null?"null":typeof e,"")),n=null}return t=Yt(m,a,t,r),t.elementType=e,t.type=n,t.lanes=c,t}function zn(e,t,a,n){return e=Yt(7,e,n,t),e.lanes=a,e}function Tu(e,t,a){return e=Yt(6,e,null,t),e.lanes=a,e}function nf(e){var t=Yt(18,null,null,0);return t.stateNode=e,t}function Eu(e,t,a){return t=Yt(4,e.children!==null?e.children:[],e.key,t),t.lanes=a,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var lf=new WeakMap;function la(e,t){if(typeof e=="object"&&e!==null){var a=lf.get(e);return a!==void 0?a:(t={value:e,source:t,stack:Ja(t)},lf.set(e,t),t)}return{value:e,source:t,stack:Ja(t)}}var Sl=[],Tl=0,Ns=null,bi=0,ia=[],sa=0,tn=null,va=1,ya="";function La(e,t){Sl[Tl++]=bi,Sl[Tl++]=Ns,Ns=e,bi=t}function sf(e,t,a){ia[sa++]=va,ia[sa++]=ya,ia[sa++]=tn,tn=e;var n=va;e=ya;var r=32-Zt(n)-1;n&=~(1<<r),a+=1;var c=32-Zt(t)+r;if(30<c){var m=r-r%5;c=(n&(1<<m)-1).toString(32),n>>=m,r-=m,va=1<<32-Zt(t)+r|a<<r|n,ya=c+e}else va=1<<c|a<<r|n,ya=e}function Au(e){e.return!==null&&(La(e,1),sf(e,1,0))}function Ru(e){for(;e===Ns;)Ns=Sl[--Tl],Sl[Tl]=null,bi=Sl[--Tl],Sl[Tl]=null;for(;e===tn;)tn=ia[--sa],ia[sa]=null,ya=ia[--sa],ia[sa]=null,va=ia[--sa],ia[sa]=null}function rf(e,t){ia[sa++]=va,ia[sa++]=ya,ia[sa++]=tn,va=t.id,ya=t.overflow,tn=e}var Et=null,Pe=null,Ue=!1,an=null,ra=!1,Nu=Error(u(519));function nn(e){var t=Error(u(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw xi(la(t,e)),Nu}function uf(e){var t=e.stateNode,a=e.type,n=e.memoizedProps;switch(t[Tt]=e,t[Mt]=n,a){case"dialog":De("cancel",t),De("close",t);break;case"iframe":case"object":case"embed":De("load",t);break;case"video":case"audio":for(a=0;a<Zi.length;a++)De(Zi[a],t);break;case"source":De("error",t);break;case"img":case"image":case"link":De("error",t),De("load",t);break;case"details":De("toggle",t);break;case"input":De("invalid",t),bd(t,n.value,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name,!0);break;case"select":De("invalid",t);break;case"textarea":De("invalid",t),Sd(t,n.value,n.defaultValue,n.children)}a=n.children,typeof a!="string"&&typeof a!="number"&&typeof a!="bigint"||t.textContent===""+a||n.suppressHydrationWarning===!0||Am(t.textContent,a)?(n.popover!=null&&(De("beforetoggle",t),De("toggle",t)),n.onScroll!=null&&De("scroll",t),n.onScrollEnd!=null&&De("scrollend",t),n.onClick!=null&&(t.onclick=Na),t=!0):t=!1,t||nn(e,!0)}function cf(e){for(Et=e.return;Et;)switch(Et.tag){case 5:case 31:case 13:ra=!1;return;case 27:case 3:ra=!0;return;default:Et=Et.return}}function El(e){if(e!==Et)return!1;if(!Ue)return cf(e),Ue=!0,!1;var t=e.tag,a;if((a=t!==3&&t!==27)&&((a=t===5)&&(a=e.type,a=!(a!=="form"&&a!=="button")||Yc(e.type,e.memoizedProps)),a=!a),a&&Pe&&nn(e),cf(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));Pe=Mm(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));Pe=Mm(e)}else t===27?(t=Pe,vn(e.type)?(e=$c,$c=null,Pe=e):Pe=t):Pe=Et?ca(e.stateNode.nextSibling):null;return!0}function Un(){Pe=Et=null,Ue=!1}function Cu(){var e=an;return e!==null&&(Ht===null?Ht=e:Ht.push.apply(Ht,e),an=null),e}function xi(e){an===null?an=[e]:an.push(e)}var wu=Te(null),Hn=null,ja=null;function ln(e,t,a){N(wu,t._currentValue),t._currentValue=a}function Oa(e){e._currentValue=wu.current,L(wu)}function Lu(e,t,a){for(;e!==null;){var n=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,n!==null&&(n.childLanes|=t)):n!==null&&(n.childLanes&t)!==t&&(n.childLanes|=t),e===a)break;e=e.return}}function ju(e,t,a,n){var r=e.child;for(r!==null&&(r.return=e);r!==null;){var c=r.dependencies;if(c!==null){var m=r.child;c=c.firstContext;e:for(;c!==null;){var g=c;c=r;for(var S=0;S<t.length;S++)if(g.context===t[S]){c.lanes|=a,g=c.alternate,g!==null&&(g.lanes|=a),Lu(c.return,a,e),n||(m=null);break e}c=g.next}}else if(r.tag===18){if(m=r.return,m===null)throw Error(u(341));m.lanes|=a,c=m.alternate,c!==null&&(c.lanes|=a),Lu(m,a,e),m=null}else m=r.child;if(m!==null)m.return=r;else for(m=r;m!==null;){if(m===e){m=null;break}if(r=m.sibling,r!==null){r.return=m.return,m=r;break}m=m.return}r=m}}function Al(e,t,a,n){e=null;for(var r=t,c=!1;r!==null;){if(!c){if((r.flags&524288)!==0)c=!0;else if((r.flags&262144)!==0)break}if(r.tag===10){var m=r.alternate;if(m===null)throw Error(u(387));if(m=m.memoizedProps,m!==null){var g=r.type;Kt(r.pendingProps.value,m.value)||(e!==null?e.push(g):e=[g])}}else if(r===F.current){if(m=r.alternate,m===null)throw Error(u(387));m.memoizedState.memoizedState!==r.memoizedState.memoizedState&&(e!==null?e.push(Xi):e=[Xi])}r=r.return}e!==null&&ju(t,e,a,n),t.flags|=262144}function Cs(e){for(e=e.firstContext;e!==null;){if(!Kt(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function Gn(e){Hn=e,ja=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function At(e){return of(Hn,e)}function ws(e,t){return Hn===null&&Gn(e),of(e,t)}function of(e,t){var a=t._currentValue;if(t={context:t,memoizedValue:a,next:null},ja===null){if(e===null)throw Error(u(308));ja=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else ja=ja.next=t;return a}var Cv=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(a,n){e.push(n)}};this.abort=function(){t.aborted=!0,e.forEach(function(a){return a()})}},wv=l.unstable_scheduleCallback,Lv=l.unstable_NormalPriority,ft={$$typeof:ae,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function Ou(){return{controller:new Cv,data:new Map,refCount:0}}function Si(e){e.refCount--,e.refCount===0&&wv(Lv,function(){e.controller.abort()})}var Ti=null,Iu=0,Rl=0,Nl=null;function jv(e,t){if(Ti===null){var a=Ti=[];Iu=0,Rl=kc(),Nl={status:"pending",value:void 0,then:function(n){a.push(n)}}}return Iu++,t.then(df,df),t}function df(){if(--Iu===0&&Ti!==null){Nl!==null&&(Nl.status="fulfilled");var e=Ti;Ti=null,Rl=0,Nl=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function Ov(e,t){var a=[],n={status:"pending",value:null,reason:null,then:function(r){a.push(r)}};return e.then(function(){n.status="fulfilled",n.value=t;for(var r=0;r<a.length;r++)(0,a[r])(t)},function(r){for(n.status="rejected",n.reason=r,r=0;r<a.length;r++)(0,a[r])(void 0)}),n}var ff=H.S;H.S=function(e,t){Q_=Bt(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&jv(e,t),ff!==null&&ff(e,t)};var Bn=Te(null);function Mu(){var e=Bn.current;return e!==null?e:We.pooledCache}function Ls(e,t){t===null?N(Bn,Bn.current):N(Bn,t.pool)}function _f(){var e=Mu();return e===null?null:{parent:ft._currentValue,pool:e}}var Cl=Error(u(460)),Du=Error(u(474)),js=Error(u(542)),Os={then:function(){}};function mf(e){return e=e.status,e==="fulfilled"||e==="rejected"}function hf(e,t,a){switch(a=e[a],a===void 0?e.push(t):a!==t&&(t.then(Na,Na),t=a),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,pf(e),e;default:if(typeof t.status=="string")t.then(Na,Na);else{if(e=We,e!==null&&100<e.shellSuspendCounter)throw Error(u(482));e=t,e.status="pending",e.then(function(n){if(t.status==="pending"){var r=t;r.status="fulfilled",r.value=n}},function(n){if(t.status==="pending"){var r=t;r.status="rejected",r.reason=n}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,pf(e),e}throw Zn=t,Cl}}function Vn(e){try{var t=e._init;return t(e._payload)}catch(a){throw a!==null&&typeof a=="object"&&typeof a.then=="function"?(Zn=a,Cl):a}}var Zn=null;function gf(){if(Zn===null)throw Error(u(459));var e=Zn;return Zn=null,e}function pf(e){if(e===Cl||e===js)throw Error(u(483))}var wl=null,Ei=0;function Is(e){var t=Ei;return Ei+=1,wl===null&&(wl=[]),hf(wl,e,t)}function Ai(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function Ms(e,t){throw t.$$typeof===E?Error(u(525)):(e=Object.prototype.toString.call(t),Error(u(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function vf(e){function t(C,A){if(e){var j=C.deletions;j===null?(C.deletions=[A],C.flags|=16):j.push(A)}}function a(C,A){if(!e)return null;for(;A!==null;)t(C,A),A=A.sibling;return null}function n(C){for(var A=new Map;C!==null;)C.key!==null?A.set(C.key,C):A.set(C.index,C),C=C.sibling;return A}function r(C,A){return C=wa(C,A),C.index=0,C.sibling=null,C}function c(C,A,j){return C.index=j,e?(j=C.alternate,j!==null?(j=j.index,j<A?(C.flags|=67108866,A):j):(C.flags|=67108866,A)):(C.flags|=1048576,A)}function m(C){return e&&C.alternate===null&&(C.flags|=67108866),C}function g(C,A,j,V){return A===null||A.tag!==6?(A=Tu(j,C.mode,V),A.return=C,A):(A=r(A,j),A.return=C,A)}function S(C,A,j,V){var pe=j.type;return pe===D?G(C,A,j.props.children,V,j.key):A!==null&&(A.elementType===pe||typeof pe=="object"&&pe!==null&&pe.$$typeof===ne&&Vn(pe)===A.type)?(A=r(A,j.props),Ai(A,j),A.return=C,A):(A=Rs(j.type,j.key,j.props,null,C.mode,V),Ai(A,j),A.return=C,A)}function O(C,A,j,V){return A===null||A.tag!==4||A.stateNode.containerInfo!==j.containerInfo||A.stateNode.implementation!==j.implementation?(A=Eu(j,C.mode,V),A.return=C,A):(A=r(A,j.children||[]),A.return=C,A)}function G(C,A,j,V,pe){return A===null||A.tag!==7?(A=zn(j,C.mode,V,pe),A.return=C,A):(A=r(A,j),A.return=C,A)}function Y(C,A,j){if(typeof A=="string"&&A!==""||typeof A=="number"||typeof A=="bigint")return A=Tu(""+A,C.mode,j),A.return=C,A;if(typeof A=="object"&&A!==null){switch(A.$$typeof){case U:return j=Rs(A.type,A.key,A.props,null,C.mode,j),Ai(j,A),j.return=C,j;case I:return A=Eu(A,C.mode,j),A.return=C,A;case ne:return A=Vn(A),Y(C,A,j)}if(ye(A)||Ie(A))return A=zn(A,C.mode,j,null),A.return=C,A;if(typeof A.then=="function")return Y(C,Is(A),j);if(A.$$typeof===ae)return Y(C,ws(C,A),j);Ms(C,A)}return null}function M(C,A,j,V){var pe=A!==null?A.key:null;if(typeof j=="string"&&j!==""||typeof j=="number"||typeof j=="bigint")return pe!==null?null:g(C,A,""+j,V);if(typeof j=="object"&&j!==null){switch(j.$$typeof){case U:return j.key===pe?S(C,A,j,V):null;case I:return j.key===pe?O(C,A,j,V):null;case ne:return j=Vn(j),M(C,A,j,V)}if(ye(j)||Ie(j))return pe!==null?null:G(C,A,j,V,null);if(typeof j.then=="function")return M(C,A,Is(j),V);if(j.$$typeof===ae)return M(C,A,ws(C,j),V);Ms(C,j)}return null}function k(C,A,j,V,pe){if(typeof V=="string"&&V!==""||typeof V=="number"||typeof V=="bigint")return C=C.get(j)||null,g(A,C,""+V,pe);if(typeof V=="object"&&V!==null){switch(V.$$typeof){case U:return C=C.get(V.key===null?j:V.key)||null,S(A,C,V,pe);case I:return C=C.get(V.key===null?j:V.key)||null,O(A,C,V,pe);case ne:return V=Vn(V),k(C,A,j,V,pe)}if(ye(V)||Ie(V))return C=C.get(j)||null,G(A,C,V,pe,null);if(typeof V.then=="function")return k(C,A,j,Is(V),pe);if(V.$$typeof===ae)return k(C,A,j,ws(A,V),pe);Ms(A,V)}return null}function ue(C,A,j,V){for(var pe=null,Ze=null,_e=A,Ce=A=0,ze=null;_e!==null&&Ce<j.length;Ce++){_e.index>Ce?(ze=_e,_e=null):ze=_e.sibling;var Ke=M(C,_e,j[Ce],V);if(Ke===null){_e===null&&(_e=ze);break}e&&_e&&Ke.alternate===null&&t(C,_e),A=c(Ke,A,Ce),Ze===null?pe=Ke:Ze.sibling=Ke,Ze=Ke,_e=ze}if(Ce===j.length)return a(C,_e),Ue&&La(C,Ce),pe;if(_e===null){for(;Ce<j.length;Ce++)_e=Y(C,j[Ce],V),_e!==null&&(A=c(_e,A,Ce),Ze===null?pe=_e:Ze.sibling=_e,Ze=_e);return Ue&&La(C,Ce),pe}for(_e=n(_e);Ce<j.length;Ce++)ze=k(_e,C,Ce,j[Ce],V),ze!==null&&(e&&ze.alternate!==null&&_e.delete(ze.key===null?Ce:ze.key),A=c(ze,A,Ce),Ze===null?pe=ze:Ze.sibling=ze,Ze=ze);return e&&_e.forEach(function(Tn){return t(C,Tn)}),Ue&&La(C,Ce),pe}function be(C,A,j,V){if(j==null)throw Error(u(151));for(var pe=null,Ze=null,_e=A,Ce=A=0,ze=null,Ke=j.next();_e!==null&&!Ke.done;Ce++,Ke=j.next()){_e.index>Ce?(ze=_e,_e=null):ze=_e.sibling;var Tn=M(C,_e,Ke.value,V);if(Tn===null){_e===null&&(_e=ze);break}e&&_e&&Tn.alternate===null&&t(C,_e),A=c(Tn,A,Ce),Ze===null?pe=Tn:Ze.sibling=Tn,Ze=Tn,_e=ze}if(Ke.done)return a(C,_e),Ue&&La(C,Ce),pe;if(_e===null){for(;!Ke.done;Ce++,Ke=j.next())Ke=Y(C,Ke.value,V),Ke!==null&&(A=c(Ke,A,Ce),Ze===null?pe=Ke:Ze.sibling=Ke,Ze=Ke);return Ue&&La(C,Ce),pe}for(_e=n(_e);!Ke.done;Ce++,Ke=j.next())Ke=k(_e,C,Ce,Ke.value,V),Ke!==null&&(e&&Ke.alternate!==null&&_e.delete(Ke.key===null?Ce:Ke.key),A=c(Ke,A,Ce),Ze===null?pe=Ke:Ze.sibling=Ke,Ze=Ke);return e&&_e.forEach(function(Zy){return t(C,Zy)}),Ue&&La(C,Ce),pe}function Je(C,A,j,V){if(typeof j=="object"&&j!==null&&j.type===D&&j.key===null&&(j=j.props.children),typeof j=="object"&&j!==null){switch(j.$$typeof){case U:e:{for(var pe=j.key;A!==null;){if(A.key===pe){if(pe=j.type,pe===D){if(A.tag===7){a(C,A.sibling),V=r(A,j.props.children),V.return=C,C=V;break e}}else if(A.elementType===pe||typeof pe=="object"&&pe!==null&&pe.$$typeof===ne&&Vn(pe)===A.type){a(C,A.sibling),V=r(A,j.props),Ai(V,j),V.return=C,C=V;break e}a(C,A);break}else t(C,A);A=A.sibling}j.type===D?(V=zn(j.props.children,C.mode,V,j.key),V.return=C,C=V):(V=Rs(j.type,j.key,j.props,null,C.mode,V),Ai(V,j),V.return=C,C=V)}return m(C);case I:e:{for(pe=j.key;A!==null;){if(A.key===pe)if(A.tag===4&&A.stateNode.containerInfo===j.containerInfo&&A.stateNode.implementation===j.implementation){a(C,A.sibling),V=r(A,j.children||[]),V.return=C,C=V;break e}else{a(C,A);break}else t(C,A);A=A.sibling}V=Eu(j,C.mode,V),V.return=C,C=V}return m(C);case ne:return j=Vn(j),Je(C,A,j,V)}if(ye(j))return ue(C,A,j,V);if(Ie(j)){if(pe=Ie(j),typeof pe!="function")throw Error(u(150));return j=pe.call(j),be(C,A,j,V)}if(typeof j.then=="function")return Je(C,A,Is(j),V);if(j.$$typeof===ae)return Je(C,A,ws(C,j),V);Ms(C,j)}return typeof j=="string"&&j!==""||typeof j=="number"||typeof j=="bigint"?(j=""+j,A!==null&&A.tag===6?(a(C,A.sibling),V=r(A,j),V.return=C,C=V):(a(C,A),V=Tu(j,C.mode,V),V.return=C,C=V),m(C)):a(C,A)}return function(C,A,j,V){try{Ei=0;var pe=Je(C,A,j,V);return wl=null,pe}catch(_e){if(_e===Cl||_e===js)throw _e;var Ze=Yt(29,_e,null,C.mode);return Ze.lanes=V,Ze.return=C,Ze}}}var Kn=vf(!0),yf=vf(!1),sn=!1;function ku(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function zu(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function rn(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function un(e,t,a){var n=e.updateQueue;if(n===null)return null;if(n=n.shared,(Ye&2)!==0){var r=n.pending;return r===null?t.next=t:(t.next=r.next,r.next=t),n.pending=t,t=As(e),tf(e,null,a),t}return Es(e,n,t,a),As(e)}function Ri(e,t,a){if(t=t.updateQueue,t!==null&&(t=t.shared,(a&4194048)!==0)){var n=t.lanes;n&=e.pendingLanes,a|=n,t.lanes=a,cd(e,a)}}function Uu(e,t){var a=e.updateQueue,n=e.alternate;if(n!==null&&(n=n.updateQueue,a===n)){var r=null,c=null;if(a=a.firstBaseUpdate,a!==null){do{var m={lane:a.lane,tag:a.tag,payload:a.payload,callback:null,next:null};c===null?r=c=m:c=c.next=m,a=a.next}while(a!==null);c===null?r=c=t:c=c.next=t}else r=c=t;a={baseState:n.baseState,firstBaseUpdate:r,lastBaseUpdate:c,shared:n.shared,callbacks:n.callbacks},e.updateQueue=a;return}e=a.lastBaseUpdate,e===null?a.firstBaseUpdate=t:e.next=t,a.lastBaseUpdate=t}var Hu=!1;function Ni(){if(Hu){var e=Nl;if(e!==null)throw e}}function Ci(e,t,a,n){Hu=!1;var r=e.updateQueue;sn=!1;var c=r.firstBaseUpdate,m=r.lastBaseUpdate,g=r.shared.pending;if(g!==null){r.shared.pending=null;var S=g,O=S.next;S.next=null,m===null?c=O:m.next=O,m=S;var G=e.alternate;G!==null&&(G=G.updateQueue,g=G.lastBaseUpdate,g!==m&&(g===null?G.firstBaseUpdate=O:g.next=O,G.lastBaseUpdate=S))}if(c!==null){var Y=r.baseState;m=0,G=O=S=null,g=c;do{var M=g.lane&-536870913,k=M!==g.lane;if(k?(ke&M)===M:(n&M)===M){M!==0&&M===Rl&&(Hu=!0),G!==null&&(G=G.next={lane:0,tag:g.tag,payload:g.payload,callback:null,next:null});e:{var ue=e,be=g;M=t;var Je=a;switch(be.tag){case 1:if(ue=be.payload,typeof ue=="function"){Y=ue.call(Je,Y,M);break e}Y=ue;break e;case 3:ue.flags=ue.flags&-65537|128;case 0:if(ue=be.payload,M=typeof ue=="function"?ue.call(Je,Y,M):ue,M==null)break e;Y=T({},Y,M);break e;case 2:sn=!0}}M=g.callback,M!==null&&(e.flags|=64,k&&(e.flags|=8192),k=r.callbacks,k===null?r.callbacks=[M]:k.push(M))}else k={lane:M,tag:g.tag,payload:g.payload,callback:g.callback,next:null},G===null?(O=G=k,S=Y):G=G.next=k,m|=M;if(g=g.next,g===null){if(g=r.shared.pending,g===null)break;k=g,g=k.next,k.next=null,r.lastBaseUpdate=k,r.shared.pending=null}}while(!0);G===null&&(S=Y),r.baseState=S,r.firstBaseUpdate=O,r.lastBaseUpdate=G,c===null&&(r.shared.lanes=0),_n|=m,e.lanes=m,e.memoizedState=Y}}function bf(e,t){if(typeof e!="function")throw Error(u(191,e));e.call(t)}function xf(e,t){var a=e.callbacks;if(a!==null)for(e.callbacks=null,e=0;e<a.length;e++)bf(a[e],t)}var Ll=Te(null),Ds=Te(0);function Sf(e,t){e=Ba,N(Ds,e),N(Ll,t),Ba=e|t.baseLanes}function Gu(){N(Ds,Ba),N(Ll,Ll.current)}function Bu(){Ba=Ds.current,L(Ll),L(Ds)}var qt=Te(null),ua=null;function cn(e){var t=e.alternate;N(ut,ut.current&1),N(qt,e),ua===null&&(t===null||Ll.current!==null||t.memoizedState!==null)&&(ua=e)}function Vu(e){N(ut,ut.current),N(qt,e),ua===null&&(ua=e)}function Tf(e){e.tag===22?(N(ut,ut.current),N(qt,e),ua===null&&(ua=e)):on()}function on(){N(ut,ut.current),N(qt,qt.current)}function Ft(e){L(qt),ua===e&&(ua=null),L(ut)}var ut=Te(0);function ks(e){for(var t=e;t!==null;){if(t.tag===13){var a=t.memoizedState;if(a!==null&&(a=a.dehydrated,a===null||Xc(a)||Qc(a)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var Ia=0,Ne=null,Qe=null,_t=null,zs=!1,jl=!1,Yn=!1,Us=0,wi=0,Ol=null,Iv=0;function it(){throw Error(u(321))}function Zu(e,t){if(t===null)return!1;for(var a=0;a<t.length&&a<e.length;a++)if(!Kt(e[a],t[a]))return!1;return!0}function Ku(e,t,a,n,r,c){return Ia=c,Ne=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,H.H=e===null||e.memoizedState===null?s_:ic,Yn=!1,c=a(n,r),Yn=!1,jl&&(c=Af(t,a,n,r)),Ef(e),c}function Ef(e){H.H=Oi;var t=Qe!==null&&Qe.next!==null;if(Ia=0,_t=Qe=Ne=null,zs=!1,wi=0,Ol=null,t)throw Error(u(300));e===null||mt||(e=e.dependencies,e!==null&&Cs(e)&&(mt=!0))}function Af(e,t,a,n){Ne=e;var r=0;do{if(jl&&(Ol=null),wi=0,jl=!1,25<=r)throw Error(u(301));if(r+=1,_t=Qe=null,e.updateQueue!=null){var c=e.updateQueue;c.lastEffect=null,c.events=null,c.stores=null,c.memoCache!=null&&(c.memoCache.index=0)}H.H=r_,c=t(a,n)}while(jl);return c}function Mv(){var e=H.H,t=e.useState()[0];return t=typeof t.then=="function"?Li(t):t,e=e.useState()[0],(Qe!==null?Qe.memoizedState:null)!==e&&(Ne.flags|=1024),t}function Yu(){var e=Us!==0;return Us=0,e}function qu(e,t,a){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~a}function Fu(e){if(zs){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}zs=!1}Ia=0,_t=Qe=Ne=null,jl=!1,wi=Us=0,Ol=null}function It(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return _t===null?Ne.memoizedState=_t=e:_t=_t.next=e,_t}function ct(){if(Qe===null){var e=Ne.alternate;e=e!==null?e.memoizedState:null}else e=Qe.next;var t=_t===null?Ne.memoizedState:_t.next;if(t!==null)_t=t,Qe=e;else{if(e===null)throw Ne.alternate===null?Error(u(467)):Error(u(310));Qe=e,e={memoizedState:Qe.memoizedState,baseState:Qe.baseState,baseQueue:Qe.baseQueue,queue:Qe.queue,next:null},_t===null?Ne.memoizedState=_t=e:_t=_t.next=e}return _t}function Hs(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function Li(e){var t=wi;return wi+=1,Ol===null&&(Ol=[]),e=hf(Ol,e,t),t=Ne,(_t===null?t.memoizedState:_t.next)===null&&(t=t.alternate,H.H=t===null||t.memoizedState===null?s_:ic),e}function Gs(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return Li(e);if(e.$$typeof===ae)return At(e)}throw Error(u(438,String(e)))}function Xu(e){var t=null,a=Ne.updateQueue;if(a!==null&&(t=a.memoCache),t==null){var n=Ne.alternate;n!==null&&(n=n.updateQueue,n!==null&&(n=n.memoCache,n!=null&&(t={data:n.data.map(function(r){return r.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),a===null&&(a=Hs(),Ne.updateQueue=a),a.memoCache=t,a=t.data[t.index],a===void 0)for(a=t.data[t.index]=Array(e),n=0;n<e;n++)a[n]=yt;return t.index++,a}function Ma(e,t){return typeof t=="function"?t(e):t}function Bs(e){var t=ct();return Qu(t,Qe,e)}function Qu(e,t,a){var n=e.queue;if(n===null)throw Error(u(311));n.lastRenderedReducer=a;var r=e.baseQueue,c=n.pending;if(c!==null){if(r!==null){var m=r.next;r.next=c.next,c.next=m}t.baseQueue=r=c,n.pending=null}if(c=e.baseState,r===null)e.memoizedState=c;else{t=r.next;var g=m=null,S=null,O=t,G=!1;do{var Y=O.lane&-536870913;if(Y!==O.lane?(ke&Y)===Y:(Ia&Y)===Y){var M=O.revertLane;if(M===0)S!==null&&(S=S.next={lane:0,revertLane:0,gesture:null,action:O.action,hasEagerState:O.hasEagerState,eagerState:O.eagerState,next:null}),Y===Rl&&(G=!0);else if((Ia&M)===M){O=O.next,M===Rl&&(G=!0);continue}else Y={lane:0,revertLane:O.revertLane,gesture:null,action:O.action,hasEagerState:O.hasEagerState,eagerState:O.eagerState,next:null},S===null?(g=S=Y,m=c):S=S.next=Y,Ne.lanes|=M,_n|=M;Y=O.action,Yn&&a(c,Y),c=O.hasEagerState?O.eagerState:a(c,Y)}else M={lane:Y,revertLane:O.revertLane,gesture:O.gesture,action:O.action,hasEagerState:O.hasEagerState,eagerState:O.eagerState,next:null},S===null?(g=S=M,m=c):S=S.next=M,Ne.lanes|=Y,_n|=Y;O=O.next}while(O!==null&&O!==t);if(S===null?m=c:S.next=g,!Kt(c,e.memoizedState)&&(mt=!0,G&&(a=Nl,a!==null)))throw a;e.memoizedState=c,e.baseState=m,e.baseQueue=S,n.lastRenderedState=c}return r===null&&(n.lanes=0),[e.memoizedState,n.dispatch]}function $u(e){var t=ct(),a=t.queue;if(a===null)throw Error(u(311));a.lastRenderedReducer=e;var n=a.dispatch,r=a.pending,c=t.memoizedState;if(r!==null){a.pending=null;var m=r=r.next;do c=e(c,m.action),m=m.next;while(m!==r);Kt(c,t.memoizedState)||(mt=!0),t.memoizedState=c,t.baseQueue===null&&(t.baseState=c),a.lastRenderedState=c}return[c,n]}function Rf(e,t,a){var n=Ne,r=ct(),c=Ue;if(c){if(a===void 0)throw Error(u(407));a=a()}else a=t();var m=!Kt((Qe||r).memoizedState,a);if(m&&(r.memoizedState=a,mt=!0),r=r.queue,Pu(wf.bind(null,n,r,e),[e]),r.getSnapshot!==t||m||_t!==null&&_t.memoizedState.tag&1){if(n.flags|=2048,Il(9,{destroy:void 0},Cf.bind(null,n,r,a,t),null),We===null)throw Error(u(349));c||(Ia&127)!==0||Nf(n,t,a)}return a}function Nf(e,t,a){e.flags|=16384,e={getSnapshot:t,value:a},t=Ne.updateQueue,t===null?(t=Hs(),Ne.updateQueue=t,t.stores=[e]):(a=t.stores,a===null?t.stores=[e]:a.push(e))}function Cf(e,t,a,n){t.value=a,t.getSnapshot=n,Lf(t)&&jf(e)}function wf(e,t,a){return a(function(){Lf(t)&&jf(e)})}function Lf(e){var t=e.getSnapshot;e=e.value;try{var a=t();return!Kt(e,a)}catch{return!0}}function jf(e){var t=kn(e,2);t!==null&&Gt(t,e,2)}function Ju(e){var t=It();if(typeof e=="function"){var a=e;if(e=a(),Yn){Wa(!0);try{a()}finally{Wa(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Ma,lastRenderedState:e},t}function Of(e,t,a,n){return e.baseState=a,Qu(e,Qe,typeof n=="function"?n:Ma)}function Dv(e,t,a,n,r){if(Ks(e))throw Error(u(485));if(e=t.action,e!==null){var c={payload:r,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(m){c.listeners.push(m)}};H.T!==null?a(!0):c.isTransition=!1,n(c),a=t.pending,a===null?(c.next=t.pending=c,If(t,c)):(c.next=a.next,t.pending=a.next=c)}}function If(e,t){var a=t.action,n=t.payload,r=e.state;if(t.isTransition){var c=H.T,m={};H.T=m;try{var g=a(r,n),S=H.S;S!==null&&S(m,g),Mf(e,t,g)}catch(O){Wu(e,t,O)}finally{c!==null&&m.types!==null&&(c.types=m.types),H.T=c}}else try{c=a(r,n),Mf(e,t,c)}catch(O){Wu(e,t,O)}}function Mf(e,t,a){a!==null&&typeof a=="object"&&typeof a.then=="function"?a.then(function(n){Df(e,t,n)},function(n){return Wu(e,t,n)}):Df(e,t,a)}function Df(e,t,a){t.status="fulfilled",t.value=a,kf(t),e.state=a,t=e.pending,t!==null&&(a=t.next,a===t?e.pending=null:(a=a.next,t.next=a,If(e,a)))}function Wu(e,t,a){var n=e.pending;if(e.pending=null,n!==null){n=n.next;do t.status="rejected",t.reason=a,kf(t),t=t.next;while(t!==n)}e.action=null}function kf(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function zf(e,t){return t}function Uf(e,t){if(Ue){var a=We.formState;if(a!==null){e:{var n=Ne;if(Ue){if(Pe){t:{for(var r=Pe,c=ra;r.nodeType!==8;){if(!c){r=null;break t}if(r=ca(r.nextSibling),r===null){r=null;break t}}c=r.data,r=c==="F!"||c==="F"?r:null}if(r){Pe=ca(r.nextSibling),n=r.data==="F!";break e}}nn(n)}n=!1}n&&(t=a[0])}}return a=It(),a.memoizedState=a.baseState=t,n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:zf,lastRenderedState:t},a.queue=n,a=n_.bind(null,Ne,n),n.dispatch=a,n=Ju(!1),c=lc.bind(null,Ne,!1,n.queue),n=It(),r={state:t,dispatch:null,action:e,pending:null},n.queue=r,a=Dv.bind(null,Ne,r,c,a),r.dispatch=a,n.memoizedState=e,[t,a,!1]}function Hf(e){var t=ct();return Gf(t,Qe,e)}function Gf(e,t,a){if(t=Qu(e,t,zf)[0],e=Bs(Ma)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var n=Li(t)}catch(m){throw m===Cl?js:m}else n=t;t=ct();var r=t.queue,c=r.dispatch;return a!==t.memoizedState&&(Ne.flags|=2048,Il(9,{destroy:void 0},kv.bind(null,r,a),null)),[n,c,e]}function kv(e,t){e.action=t}function Bf(e){var t=ct(),a=Qe;if(a!==null)return Gf(t,a,e);ct(),t=t.memoizedState,a=ct();var n=a.queue.dispatch;return a.memoizedState=e,[t,n,!1]}function Il(e,t,a,n){return e={tag:e,create:a,deps:n,inst:t,next:null},t=Ne.updateQueue,t===null&&(t=Hs(),Ne.updateQueue=t),a=t.lastEffect,a===null?t.lastEffect=e.next=e:(n=a.next,a.next=e,e.next=n,t.lastEffect=e),e}function Vf(){return ct().memoizedState}function Vs(e,t,a,n){var r=It();Ne.flags|=e,r.memoizedState=Il(1|t,{destroy:void 0},a,n===void 0?null:n)}function Zs(e,t,a,n){var r=ct();n=n===void 0?null:n;var c=r.memoizedState.inst;Qe!==null&&n!==null&&Zu(n,Qe.memoizedState.deps)?r.memoizedState=Il(t,c,a,n):(Ne.flags|=e,r.memoizedState=Il(1|t,c,a,n))}function Zf(e,t){Vs(8390656,8,e,t)}function Pu(e,t){Zs(2048,8,e,t)}function zv(e){Ne.flags|=4;var t=Ne.updateQueue;if(t===null)t=Hs(),Ne.updateQueue=t,t.events=[e];else{var a=t.events;a===null?t.events=[e]:a.push(e)}}function Kf(e){var t=ct().memoizedState;return zv({ref:t,nextImpl:e}),function(){if((Ye&2)!==0)throw Error(u(440));return t.impl.apply(void 0,arguments)}}function Yf(e,t){return Zs(4,2,e,t)}function qf(e,t){return Zs(4,4,e,t)}function Ff(e,t){if(typeof t=="function"){e=e();var a=t(e);return function(){typeof a=="function"?a():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function Xf(e,t,a){a=a!=null?a.concat([e]):null,Zs(4,4,Ff.bind(null,t,e),a)}function ec(){}function Qf(e,t){var a=ct();t=t===void 0?null:t;var n=a.memoizedState;return t!==null&&Zu(t,n[1])?n[0]:(a.memoizedState=[e,t],e)}function $f(e,t){var a=ct();t=t===void 0?null:t;var n=a.memoizedState;if(t!==null&&Zu(t,n[1]))return n[0];if(n=e(),Yn){Wa(!0);try{e()}finally{Wa(!1)}}return a.memoizedState=[n,t],n}function tc(e,t,a){return a===void 0||(Ia&1073741824)!==0&&(ke&261930)===0?e.memoizedState=t:(e.memoizedState=a,e=J_(),Ne.lanes|=e,_n|=e,a)}function Jf(e,t,a,n){return Kt(a,t)?a:Ll.current!==null?(e=tc(e,a,n),Kt(e,t)||(mt=!0),e):(Ia&42)===0||(Ia&1073741824)!==0&&(ke&261930)===0?(mt=!0,e.memoizedState=a):(e=J_(),Ne.lanes|=e,_n|=e,t)}function Wf(e,t,a,n,r){var c=B.p;B.p=c!==0&&8>c?c:8;var m=H.T,g={};H.T=g,lc(e,!1,t,a);try{var S=r(),O=H.S;if(O!==null&&O(g,S),S!==null&&typeof S=="object"&&typeof S.then=="function"){var G=Ov(S,n);ji(e,t,G,$t(e))}else ji(e,t,n,$t(e))}catch(Y){ji(e,t,{then:function(){},status:"rejected",reason:Y},$t())}finally{B.p=c,m!==null&&g.types!==null&&(m.types=g.types),H.T=m}}function Uv(){}function ac(e,t,a,n){if(e.tag!==5)throw Error(u(476));var r=Pf(e).queue;Wf(e,r,t,Q,a===null?Uv:function(){return e_(e),a(n)})}function Pf(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:Q,baseState:Q,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Ma,lastRenderedState:Q},next:null};var a={};return t.next={memoizedState:a,baseState:a,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Ma,lastRenderedState:a},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function e_(e){var t=Pf(e);t.next===null&&(t=e.alternate.memoizedState),ji(e,t.next.queue,{},$t())}function nc(){return At(Xi)}function t_(){return ct().memoizedState}function a_(){return ct().memoizedState}function Hv(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var a=$t();e=rn(a);var n=un(t,e,a);n!==null&&(Gt(n,t,a),Ri(n,t,a)),t={cache:Ou()},e.payload=t;return}t=t.return}}function Gv(e,t,a){var n=$t();a={lane:n,revertLane:0,gesture:null,action:a,hasEagerState:!1,eagerState:null,next:null},Ks(e)?l_(t,a):(a=xu(e,t,a,n),a!==null&&(Gt(a,e,n),i_(a,t,n)))}function n_(e,t,a){var n=$t();ji(e,t,a,n)}function ji(e,t,a,n){var r={lane:n,revertLane:0,gesture:null,action:a,hasEagerState:!1,eagerState:null,next:null};if(Ks(e))l_(t,r);else{var c=e.alternate;if(e.lanes===0&&(c===null||c.lanes===0)&&(c=t.lastRenderedReducer,c!==null))try{var m=t.lastRenderedState,g=c(m,a);if(r.hasEagerState=!0,r.eagerState=g,Kt(g,m))return Es(e,t,r,0),We===null&&Ts(),!1}catch{}if(a=xu(e,t,r,n),a!==null)return Gt(a,e,n),i_(a,t,n),!0}return!1}function lc(e,t,a,n){if(n={lane:2,revertLane:kc(),gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},Ks(e)){if(t)throw Error(u(479))}else t=xu(e,a,n,2),t!==null&&Gt(t,e,2)}function Ks(e){var t=e.alternate;return e===Ne||t!==null&&t===Ne}function l_(e,t){jl=zs=!0;var a=e.pending;a===null?t.next=t:(t.next=a.next,a.next=t),e.pending=t}function i_(e,t,a){if((a&4194048)!==0){var n=t.lanes;n&=e.pendingLanes,a|=n,t.lanes=a,cd(e,a)}}var Oi={readContext:At,use:Gs,useCallback:it,useContext:it,useEffect:it,useImperativeHandle:it,useLayoutEffect:it,useInsertionEffect:it,useMemo:it,useReducer:it,useRef:it,useState:it,useDebugValue:it,useDeferredValue:it,useTransition:it,useSyncExternalStore:it,useId:it,useHostTransitionStatus:it,useFormState:it,useActionState:it,useOptimistic:it,useMemoCache:it,useCacheRefresh:it};Oi.useEffectEvent=it;var s_={readContext:At,use:Gs,useCallback:function(e,t){return It().memoizedState=[e,t===void 0?null:t],e},useContext:At,useEffect:Zf,useImperativeHandle:function(e,t,a){a=a!=null?a.concat([e]):null,Vs(4194308,4,Ff.bind(null,t,e),a)},useLayoutEffect:function(e,t){return Vs(4194308,4,e,t)},useInsertionEffect:function(e,t){Vs(4,2,e,t)},useMemo:function(e,t){var a=It();t=t===void 0?null:t;var n=e();if(Yn){Wa(!0);try{e()}finally{Wa(!1)}}return a.memoizedState=[n,t],n},useReducer:function(e,t,a){var n=It();if(a!==void 0){var r=a(t);if(Yn){Wa(!0);try{a(t)}finally{Wa(!1)}}}else r=t;return n.memoizedState=n.baseState=r,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:r},n.queue=e,e=e.dispatch=Gv.bind(null,Ne,e),[n.memoizedState,e]},useRef:function(e){var t=It();return e={current:e},t.memoizedState=e},useState:function(e){e=Ju(e);var t=e.queue,a=n_.bind(null,Ne,t);return t.dispatch=a,[e.memoizedState,a]},useDebugValue:ec,useDeferredValue:function(e,t){var a=It();return tc(a,e,t)},useTransition:function(){var e=Ju(!1);return e=Wf.bind(null,Ne,e.queue,!0,!1),It().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,a){var n=Ne,r=It();if(Ue){if(a===void 0)throw Error(u(407));a=a()}else{if(a=t(),We===null)throw Error(u(349));(ke&127)!==0||Nf(n,t,a)}r.memoizedState=a;var c={value:a,getSnapshot:t};return r.queue=c,Zf(wf.bind(null,n,c,e),[e]),n.flags|=2048,Il(9,{destroy:void 0},Cf.bind(null,n,c,a,t),null),a},useId:function(){var e=It(),t=We.identifierPrefix;if(Ue){var a=ya,n=va;a=(n&~(1<<32-Zt(n)-1)).toString(32)+a,t="_"+t+"R_"+a,a=Us++,0<a&&(t+="H"+a.toString(32)),t+="_"}else a=Iv++,t="_"+t+"r_"+a.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:nc,useFormState:Uf,useActionState:Uf,useOptimistic:function(e){var t=It();t.memoizedState=t.baseState=e;var a={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=a,t=lc.bind(null,Ne,!0,a),a.dispatch=t,[e,t]},useMemoCache:Xu,useCacheRefresh:function(){return It().memoizedState=Hv.bind(null,Ne)},useEffectEvent:function(e){var t=It(),a={impl:e};return t.memoizedState=a,function(){if((Ye&2)!==0)throw Error(u(440));return a.impl.apply(void 0,arguments)}}},ic={readContext:At,use:Gs,useCallback:Qf,useContext:At,useEffect:Pu,useImperativeHandle:Xf,useInsertionEffect:Yf,useLayoutEffect:qf,useMemo:$f,useReducer:Bs,useRef:Vf,useState:function(){return Bs(Ma)},useDebugValue:ec,useDeferredValue:function(e,t){var a=ct();return Jf(a,Qe.memoizedState,e,t)},useTransition:function(){var e=Bs(Ma)[0],t=ct().memoizedState;return[typeof e=="boolean"?e:Li(e),t]},useSyncExternalStore:Rf,useId:t_,useHostTransitionStatus:nc,useFormState:Hf,useActionState:Hf,useOptimistic:function(e,t){var a=ct();return Of(a,Qe,e,t)},useMemoCache:Xu,useCacheRefresh:a_};ic.useEffectEvent=Kf;var r_={readContext:At,use:Gs,useCallback:Qf,useContext:At,useEffect:Pu,useImperativeHandle:Xf,useInsertionEffect:Yf,useLayoutEffect:qf,useMemo:$f,useReducer:$u,useRef:Vf,useState:function(){return $u(Ma)},useDebugValue:ec,useDeferredValue:function(e,t){var a=ct();return Qe===null?tc(a,e,t):Jf(a,Qe.memoizedState,e,t)},useTransition:function(){var e=$u(Ma)[0],t=ct().memoizedState;return[typeof e=="boolean"?e:Li(e),t]},useSyncExternalStore:Rf,useId:t_,useHostTransitionStatus:nc,useFormState:Bf,useActionState:Bf,useOptimistic:function(e,t){var a=ct();return Qe!==null?Of(a,Qe,e,t):(a.baseState=e,[e,a.queue.dispatch])},useMemoCache:Xu,useCacheRefresh:a_};r_.useEffectEvent=Kf;function sc(e,t,a,n){t=e.memoizedState,a=a(n,t),a=a==null?t:T({},t,a),e.memoizedState=a,e.lanes===0&&(e.updateQueue.baseState=a)}var rc={enqueueSetState:function(e,t,a){e=e._reactInternals;var n=$t(),r=rn(n);r.payload=t,a!=null&&(r.callback=a),t=un(e,r,n),t!==null&&(Gt(t,e,n),Ri(t,e,n))},enqueueReplaceState:function(e,t,a){e=e._reactInternals;var n=$t(),r=rn(n);r.tag=1,r.payload=t,a!=null&&(r.callback=a),t=un(e,r,n),t!==null&&(Gt(t,e,n),Ri(t,e,n))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var a=$t(),n=rn(a);n.tag=2,t!=null&&(n.callback=t),t=un(e,n,a),t!==null&&(Gt(t,e,a),Ri(t,e,a))}};function u_(e,t,a,n,r,c,m){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(n,c,m):t.prototype&&t.prototype.isPureReactComponent?!vi(a,n)||!vi(r,c):!0}function c_(e,t,a,n){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(a,n),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(a,n),t.state!==e&&rc.enqueueReplaceState(t,t.state,null)}function qn(e,t){var a=t;if("ref"in t){a={};for(var n in t)n!=="ref"&&(a[n]=t[n])}if(e=e.defaultProps){a===t&&(a=T({},a));for(var r in e)a[r]===void 0&&(a[r]=e[r])}return a}function o_(e){Ss(e)}function d_(e){console.error(e)}function f_(e){Ss(e)}function Ys(e,t){try{var a=e.onUncaughtError;a(t.value,{componentStack:t.stack})}catch(n){setTimeout(function(){throw n})}}function __(e,t,a){try{var n=e.onCaughtError;n(a.value,{componentStack:a.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(r){setTimeout(function(){throw r})}}function uc(e,t,a){return a=rn(a),a.tag=3,a.payload={element:null},a.callback=function(){Ys(e,t)},a}function m_(e){return e=rn(e),e.tag=3,e}function h_(e,t,a,n){var r=a.type.getDerivedStateFromError;if(typeof r=="function"){var c=n.value;e.payload=function(){return r(c)},e.callback=function(){__(t,a,n)}}var m=a.stateNode;m!==null&&typeof m.componentDidCatch=="function"&&(e.callback=function(){__(t,a,n),typeof r!="function"&&(mn===null?mn=new Set([this]):mn.add(this));var g=n.stack;this.componentDidCatch(n.value,{componentStack:g!==null?g:""})})}function Bv(e,t,a,n,r){if(a.flags|=32768,n!==null&&typeof n=="object"&&typeof n.then=="function"){if(t=a.alternate,t!==null&&Al(t,a,r,!0),a=qt.current,a!==null){switch(a.tag){case 31:case 13:return ua===null?nr():a.alternate===null&&st===0&&(st=3),a.flags&=-257,a.flags|=65536,a.lanes=r,n===Os?a.flags|=16384:(t=a.updateQueue,t===null?a.updateQueue=new Set([n]):t.add(n),Ic(e,n,r)),!1;case 22:return a.flags|=65536,n===Os?a.flags|=16384:(t=a.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([n])},a.updateQueue=t):(a=t.retryQueue,a===null?t.retryQueue=new Set([n]):a.add(n)),Ic(e,n,r)),!1}throw Error(u(435,a.tag))}return Ic(e,n,r),nr(),!1}if(Ue)return t=qt.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=r,n!==Nu&&(e=Error(u(422),{cause:n}),xi(la(e,a)))):(n!==Nu&&(t=Error(u(423),{cause:n}),xi(la(t,a))),e=e.current.alternate,e.flags|=65536,r&=-r,e.lanes|=r,n=la(n,a),r=uc(e.stateNode,n,r),Uu(e,r),st!==4&&(st=2)),!1;var c=Error(u(520),{cause:n});if(c=la(c,a),Gi===null?Gi=[c]:Gi.push(c),st!==4&&(st=2),t===null)return!0;n=la(n,a),a=t;do{switch(a.tag){case 3:return a.flags|=65536,e=r&-r,a.lanes|=e,e=uc(a.stateNode,n,e),Uu(a,e),!1;case 1:if(t=a.type,c=a.stateNode,(a.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||c!==null&&typeof c.componentDidCatch=="function"&&(mn===null||!mn.has(c))))return a.flags|=65536,r&=-r,a.lanes|=r,r=m_(r),h_(r,e,a,n),Uu(a,r),!1}a=a.return}while(a!==null);return!1}var cc=Error(u(461)),mt=!1;function Rt(e,t,a,n){t.child=e===null?yf(t,null,a,n):Kn(t,e.child,a,n)}function g_(e,t,a,n,r){a=a.render;var c=t.ref;if("ref"in n){var m={};for(var g in n)g!=="ref"&&(m[g]=n[g])}else m=n;return Gn(t),n=Ku(e,t,a,m,c,r),g=Yu(),e!==null&&!mt?(qu(e,t,r),Da(e,t,r)):(Ue&&g&&Au(t),t.flags|=1,Rt(e,t,n,r),t.child)}function p_(e,t,a,n,r){if(e===null){var c=a.type;return typeof c=="function"&&!Su(c)&&c.defaultProps===void 0&&a.compare===null?(t.tag=15,t.type=c,v_(e,t,c,n,r)):(e=Rs(a.type,null,n,t,t.mode,r),e.ref=t.ref,e.return=t,t.child=e)}if(c=e.child,!pc(e,r)){var m=c.memoizedProps;if(a=a.compare,a=a!==null?a:vi,a(m,n)&&e.ref===t.ref)return Da(e,t,r)}return t.flags|=1,e=wa(c,n),e.ref=t.ref,e.return=t,t.child=e}function v_(e,t,a,n,r){if(e!==null){var c=e.memoizedProps;if(vi(c,n)&&e.ref===t.ref)if(mt=!1,t.pendingProps=n=c,pc(e,r))(e.flags&131072)!==0&&(mt=!0);else return t.lanes=e.lanes,Da(e,t,r)}return oc(e,t,a,n,r)}function y_(e,t,a,n){var r=n.children,c=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),n.mode==="hidden"){if((t.flags&128)!==0){if(c=c!==null?c.baseLanes|a:a,e!==null){for(n=t.child=e.child,r=0;n!==null;)r=r|n.lanes|n.childLanes,n=n.sibling;n=r&~c}else n=0,t.child=null;return b_(e,t,c,a,n)}if((a&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&Ls(t,c!==null?c.cachePool:null),c!==null?Sf(t,c):Gu(),Tf(t);else return n=t.lanes=536870912,b_(e,t,c!==null?c.baseLanes|a:a,a,n)}else c!==null?(Ls(t,c.cachePool),Sf(t,c),on(),t.memoizedState=null):(e!==null&&Ls(t,null),Gu(),on());return Rt(e,t,r,a),t.child}function Ii(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function b_(e,t,a,n,r){var c=Mu();return c=c===null?null:{parent:ft._currentValue,pool:c},t.memoizedState={baseLanes:a,cachePool:c},e!==null&&Ls(t,null),Gu(),Tf(t),e!==null&&Al(e,t,n,!0),t.childLanes=r,null}function qs(e,t){return t=Xs({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function x_(e,t,a){return Kn(t,e.child,null,a),e=qs(t,t.pendingProps),e.flags|=2,Ft(t),t.memoizedState=null,e}function Vv(e,t,a){var n=t.pendingProps,r=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(Ue){if(n.mode==="hidden")return e=qs(t,n),t.lanes=536870912,Ii(null,e);if(Vu(t),(e=Pe)?(e=Im(e,ra),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:tn!==null?{id:va,overflow:ya}:null,retryLane:536870912,hydrationErrors:null},a=nf(e),a.return=t,t.child=a,Et=t,Pe=null)):e=null,e===null)throw nn(t);return t.lanes=536870912,null}return qs(t,n)}var c=e.memoizedState;if(c!==null){var m=c.dehydrated;if(Vu(t),r)if(t.flags&256)t.flags&=-257,t=x_(e,t,a);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(u(558));else if(mt||Al(e,t,a,!1),r=(a&e.childLanes)!==0,mt||r){if(n=We,n!==null&&(m=od(n,a),m!==0&&m!==c.retryLane))throw c.retryLane=m,kn(e,m),Gt(n,e,m),cc;nr(),t=x_(e,t,a)}else e=c.treeContext,Pe=ca(m.nextSibling),Et=t,Ue=!0,an=null,ra=!1,e!==null&&rf(t,e),t=qs(t,n),t.flags|=4096;return t}return e=wa(e.child,{mode:n.mode,children:n.children}),e.ref=t.ref,t.child=e,e.return=t,e}function Fs(e,t){var a=t.ref;if(a===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof a!="function"&&typeof a!="object")throw Error(u(284));(e===null||e.ref!==a)&&(t.flags|=4194816)}}function oc(e,t,a,n,r){return Gn(t),a=Ku(e,t,a,n,void 0,r),n=Yu(),e!==null&&!mt?(qu(e,t,r),Da(e,t,r)):(Ue&&n&&Au(t),t.flags|=1,Rt(e,t,a,r),t.child)}function S_(e,t,a,n,r,c){return Gn(t),t.updateQueue=null,a=Af(t,n,a,r),Ef(e),n=Yu(),e!==null&&!mt?(qu(e,t,c),Da(e,t,c)):(Ue&&n&&Au(t),t.flags|=1,Rt(e,t,a,c),t.child)}function T_(e,t,a,n,r){if(Gn(t),t.stateNode===null){var c=xl,m=a.contextType;typeof m=="object"&&m!==null&&(c=At(m)),c=new a(n,c),t.memoizedState=c.state!==null&&c.state!==void 0?c.state:null,c.updater=rc,t.stateNode=c,c._reactInternals=t,c=t.stateNode,c.props=n,c.state=t.memoizedState,c.refs={},ku(t),m=a.contextType,c.context=typeof m=="object"&&m!==null?At(m):xl,c.state=t.memoizedState,m=a.getDerivedStateFromProps,typeof m=="function"&&(sc(t,a,m,n),c.state=t.memoizedState),typeof a.getDerivedStateFromProps=="function"||typeof c.getSnapshotBeforeUpdate=="function"||typeof c.UNSAFE_componentWillMount!="function"&&typeof c.componentWillMount!="function"||(m=c.state,typeof c.componentWillMount=="function"&&c.componentWillMount(),typeof c.UNSAFE_componentWillMount=="function"&&c.UNSAFE_componentWillMount(),m!==c.state&&rc.enqueueReplaceState(c,c.state,null),Ci(t,n,c,r),Ni(),c.state=t.memoizedState),typeof c.componentDidMount=="function"&&(t.flags|=4194308),n=!0}else if(e===null){c=t.stateNode;var g=t.memoizedProps,S=qn(a,g);c.props=S;var O=c.context,G=a.contextType;m=xl,typeof G=="object"&&G!==null&&(m=At(G));var Y=a.getDerivedStateFromProps;G=typeof Y=="function"||typeof c.getSnapshotBeforeUpdate=="function",g=t.pendingProps!==g,G||typeof c.UNSAFE_componentWillReceiveProps!="function"&&typeof c.componentWillReceiveProps!="function"||(g||O!==m)&&c_(t,c,n,m),sn=!1;var M=t.memoizedState;c.state=M,Ci(t,n,c,r),Ni(),O=t.memoizedState,g||M!==O||sn?(typeof Y=="function"&&(sc(t,a,Y,n),O=t.memoizedState),(S=sn||u_(t,a,S,n,M,O,m))?(G||typeof c.UNSAFE_componentWillMount!="function"&&typeof c.componentWillMount!="function"||(typeof c.componentWillMount=="function"&&c.componentWillMount(),typeof c.UNSAFE_componentWillMount=="function"&&c.UNSAFE_componentWillMount()),typeof c.componentDidMount=="function"&&(t.flags|=4194308)):(typeof c.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=n,t.memoizedState=O),c.props=n,c.state=O,c.context=m,n=S):(typeof c.componentDidMount=="function"&&(t.flags|=4194308),n=!1)}else{c=t.stateNode,zu(e,t),m=t.memoizedProps,G=qn(a,m),c.props=G,Y=t.pendingProps,M=c.context,O=a.contextType,S=xl,typeof O=="object"&&O!==null&&(S=At(O)),g=a.getDerivedStateFromProps,(O=typeof g=="function"||typeof c.getSnapshotBeforeUpdate=="function")||typeof c.UNSAFE_componentWillReceiveProps!="function"&&typeof c.componentWillReceiveProps!="function"||(m!==Y||M!==S)&&c_(t,c,n,S),sn=!1,M=t.memoizedState,c.state=M,Ci(t,n,c,r),Ni();var k=t.memoizedState;m!==Y||M!==k||sn||e!==null&&e.dependencies!==null&&Cs(e.dependencies)?(typeof g=="function"&&(sc(t,a,g,n),k=t.memoizedState),(G=sn||u_(t,a,G,n,M,k,S)||e!==null&&e.dependencies!==null&&Cs(e.dependencies))?(O||typeof c.UNSAFE_componentWillUpdate!="function"&&typeof c.componentWillUpdate!="function"||(typeof c.componentWillUpdate=="function"&&c.componentWillUpdate(n,k,S),typeof c.UNSAFE_componentWillUpdate=="function"&&c.UNSAFE_componentWillUpdate(n,k,S)),typeof c.componentDidUpdate=="function"&&(t.flags|=4),typeof c.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof c.componentDidUpdate!="function"||m===e.memoizedProps&&M===e.memoizedState||(t.flags|=4),typeof c.getSnapshotBeforeUpdate!="function"||m===e.memoizedProps&&M===e.memoizedState||(t.flags|=1024),t.memoizedProps=n,t.memoizedState=k),c.props=n,c.state=k,c.context=S,n=G):(typeof c.componentDidUpdate!="function"||m===e.memoizedProps&&M===e.memoizedState||(t.flags|=4),typeof c.getSnapshotBeforeUpdate!="function"||m===e.memoizedProps&&M===e.memoizedState||(t.flags|=1024),n=!1)}return c=n,Fs(e,t),n=(t.flags&128)!==0,c||n?(c=t.stateNode,a=n&&typeof a.getDerivedStateFromError!="function"?null:c.render(),t.flags|=1,e!==null&&n?(t.child=Kn(t,e.child,null,r),t.child=Kn(t,null,a,r)):Rt(e,t,a,r),t.memoizedState=c.state,e=t.child):e=Da(e,t,r),e}function E_(e,t,a,n){return Un(),t.flags|=256,Rt(e,t,a,n),t.child}var dc={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function fc(e){return{baseLanes:e,cachePool:_f()}}function _c(e,t,a){return e=e!==null?e.childLanes&~a:0,t&&(e|=Qt),e}function A_(e,t,a){var n=t.pendingProps,r=!1,c=(t.flags&128)!==0,m;if((m=c)||(m=e!==null&&e.memoizedState===null?!1:(ut.current&2)!==0),m&&(r=!0,t.flags&=-129),m=(t.flags&32)!==0,t.flags&=-33,e===null){if(Ue){if(r?cn(t):on(),(e=Pe)?(e=Im(e,ra),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:tn!==null?{id:va,overflow:ya}:null,retryLane:536870912,hydrationErrors:null},a=nf(e),a.return=t,t.child=a,Et=t,Pe=null)):e=null,e===null)throw nn(t);return Qc(e)?t.lanes=32:t.lanes=536870912,null}var g=n.children;return n=n.fallback,r?(on(),r=t.mode,g=Xs({mode:"hidden",children:g},r),n=zn(n,r,a,null),g.return=t,n.return=t,g.sibling=n,t.child=g,n=t.child,n.memoizedState=fc(a),n.childLanes=_c(e,m,a),t.memoizedState=dc,Ii(null,n)):(cn(t),mc(t,g))}var S=e.memoizedState;if(S!==null&&(g=S.dehydrated,g!==null)){if(c)t.flags&256?(cn(t),t.flags&=-257,t=hc(e,t,a)):t.memoizedState!==null?(on(),t.child=e.child,t.flags|=128,t=null):(on(),g=n.fallback,r=t.mode,n=Xs({mode:"visible",children:n.children},r),g=zn(g,r,a,null),g.flags|=2,n.return=t,g.return=t,n.sibling=g,t.child=n,Kn(t,e.child,null,a),n=t.child,n.memoizedState=fc(a),n.childLanes=_c(e,m,a),t.memoizedState=dc,t=Ii(null,n));else if(cn(t),Qc(g)){if(m=g.nextSibling&&g.nextSibling.dataset,m)var O=m.dgst;m=O,n=Error(u(419)),n.stack="",n.digest=m,xi({value:n,source:null,stack:null}),t=hc(e,t,a)}else if(mt||Al(e,t,a,!1),m=(a&e.childLanes)!==0,mt||m){if(m=We,m!==null&&(n=od(m,a),n!==0&&n!==S.retryLane))throw S.retryLane=n,kn(e,n),Gt(m,e,n),cc;Xc(g)||nr(),t=hc(e,t,a)}else Xc(g)?(t.flags|=192,t.child=e.child,t=null):(e=S.treeContext,Pe=ca(g.nextSibling),Et=t,Ue=!0,an=null,ra=!1,e!==null&&rf(t,e),t=mc(t,n.children),t.flags|=4096);return t}return r?(on(),g=n.fallback,r=t.mode,S=e.child,O=S.sibling,n=wa(S,{mode:"hidden",children:n.children}),n.subtreeFlags=S.subtreeFlags&65011712,O!==null?g=wa(O,g):(g=zn(g,r,a,null),g.flags|=2),g.return=t,n.return=t,n.sibling=g,t.child=n,Ii(null,n),n=t.child,g=e.child.memoizedState,g===null?g=fc(a):(r=g.cachePool,r!==null?(S=ft._currentValue,r=r.parent!==S?{parent:S,pool:S}:r):r=_f(),g={baseLanes:g.baseLanes|a,cachePool:r}),n.memoizedState=g,n.childLanes=_c(e,m,a),t.memoizedState=dc,Ii(e.child,n)):(cn(t),a=e.child,e=a.sibling,a=wa(a,{mode:"visible",children:n.children}),a.return=t,a.sibling=null,e!==null&&(m=t.deletions,m===null?(t.deletions=[e],t.flags|=16):m.push(e)),t.child=a,t.memoizedState=null,a)}function mc(e,t){return t=Xs({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function Xs(e,t){return e=Yt(22,e,null,t),e.lanes=0,e}function hc(e,t,a){return Kn(t,e.child,null,a),e=mc(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function R_(e,t,a){e.lanes|=t;var n=e.alternate;n!==null&&(n.lanes|=t),Lu(e.return,t,a)}function gc(e,t,a,n,r,c){var m=e.memoizedState;m===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:n,tail:a,tailMode:r,treeForkCount:c}:(m.isBackwards=t,m.rendering=null,m.renderingStartTime=0,m.last=n,m.tail=a,m.tailMode=r,m.treeForkCount=c)}function N_(e,t,a){var n=t.pendingProps,r=n.revealOrder,c=n.tail;n=n.children;var m=ut.current,g=(m&2)!==0;if(g?(m=m&1|2,t.flags|=128):m&=1,N(ut,m),Rt(e,t,n,a),n=Ue?bi:0,!g&&e!==null&&(e.flags&128)!==0)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&R_(e,a,t);else if(e.tag===19)R_(e,a,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(r){case"forwards":for(a=t.child,r=null;a!==null;)e=a.alternate,e!==null&&ks(e)===null&&(r=a),a=a.sibling;a=r,a===null?(r=t.child,t.child=null):(r=a.sibling,a.sibling=null),gc(t,!1,r,a,c,n);break;case"backwards":case"unstable_legacy-backwards":for(a=null,r=t.child,t.child=null;r!==null;){if(e=r.alternate,e!==null&&ks(e)===null){t.child=r;break}e=r.sibling,r.sibling=a,a=r,r=e}gc(t,!0,a,null,c,n);break;case"together":gc(t,!1,null,null,void 0,n);break;default:t.memoizedState=null}return t.child}function Da(e,t,a){if(e!==null&&(t.dependencies=e.dependencies),_n|=t.lanes,(a&t.childLanes)===0)if(e!==null){if(Al(e,t,a,!1),(a&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(u(153));if(t.child!==null){for(e=t.child,a=wa(e,e.pendingProps),t.child=a,a.return=t;e.sibling!==null;)e=e.sibling,a=a.sibling=wa(e,e.pendingProps),a.return=t;a.sibling=null}return t.child}function pc(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&Cs(e)))}function Zv(e,t,a){switch(t.tag){case 3:ee(t,t.stateNode.containerInfo),ln(t,ft,e.memoizedState.cache),Un();break;case 27:case 5:$(t);break;case 4:ee(t,t.stateNode.containerInfo);break;case 10:ln(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,Vu(t),null;break;case 13:var n=t.memoizedState;if(n!==null)return n.dehydrated!==null?(cn(t),t.flags|=128,null):(a&t.child.childLanes)!==0?A_(e,t,a):(cn(t),e=Da(e,t,a),e!==null?e.sibling:null);cn(t);break;case 19:var r=(e.flags&128)!==0;if(n=(a&t.childLanes)!==0,n||(Al(e,t,a,!1),n=(a&t.childLanes)!==0),r){if(n)return N_(e,t,a);t.flags|=128}if(r=t.memoizedState,r!==null&&(r.rendering=null,r.tail=null,r.lastEffect=null),N(ut,ut.current),n)break;return null;case 22:return t.lanes=0,y_(e,t,a,t.pendingProps);case 24:ln(t,ft,e.memoizedState.cache)}return Da(e,t,a)}function C_(e,t,a){if(e!==null)if(e.memoizedProps!==t.pendingProps)mt=!0;else{if(!pc(e,a)&&(t.flags&128)===0)return mt=!1,Zv(e,t,a);mt=(e.flags&131072)!==0}else mt=!1,Ue&&(t.flags&1048576)!==0&&sf(t,bi,t.index);switch(t.lanes=0,t.tag){case 16:e:{var n=t.pendingProps;if(e=Vn(t.elementType),t.type=e,typeof e=="function")Su(e)?(n=qn(e,n),t.tag=1,t=T_(null,t,e,n,a)):(t.tag=0,t=oc(null,t,e,n,a));else{if(e!=null){var r=e.$$typeof;if(r===q){t.tag=11,t=g_(null,t,e,n,a);break e}else if(r===ge){t.tag=14,t=p_(null,t,e,n,a);break e}}throw t=nt(e)||e,Error(u(306,t,""))}}return t;case 0:return oc(e,t,t.type,t.pendingProps,a);case 1:return n=t.type,r=qn(n,t.pendingProps),T_(e,t,n,r,a);case 3:e:{if(ee(t,t.stateNode.containerInfo),e===null)throw Error(u(387));n=t.pendingProps;var c=t.memoizedState;r=c.element,zu(e,t),Ci(t,n,null,a);var m=t.memoizedState;if(n=m.cache,ln(t,ft,n),n!==c.cache&&ju(t,[ft],a,!0),Ni(),n=m.element,c.isDehydrated)if(c={element:n,isDehydrated:!1,cache:m.cache},t.updateQueue.baseState=c,t.memoizedState=c,t.flags&256){t=E_(e,t,n,a);break e}else if(n!==r){r=la(Error(u(424)),t),xi(r),t=E_(e,t,n,a);break e}else for(e=t.stateNode.containerInfo,e.nodeType===9?e=e.body:e=e.nodeName==="HTML"?e.ownerDocument.body:e,Pe=ca(e.firstChild),Et=t,Ue=!0,an=null,ra=!0,a=yf(t,null,n,a),t.child=a;a;)a.flags=a.flags&-3|4096,a=a.sibling;else{if(Un(),n===r){t=Da(e,t,a);break e}Rt(e,t,n,a)}t=t.child}return t;case 26:return Fs(e,t),e===null?(a=Hm(t.type,null,t.pendingProps,null))?t.memoizedState=a:Ue||(a=t.type,e=t.pendingProps,n=or(X.current).createElement(a),n[Tt]=t,n[Mt]=e,Nt(n,a,e),bt(n),t.stateNode=n):t.memoizedState=Hm(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return $(t),e===null&&Ue&&(n=t.stateNode=km(t.type,t.pendingProps,X.current),Et=t,ra=!0,r=Pe,vn(t.type)?($c=r,Pe=ca(n.firstChild)):Pe=r),Rt(e,t,t.pendingProps.children,a),Fs(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&Ue&&((r=n=Pe)&&(n=yy(n,t.type,t.pendingProps,ra),n!==null?(t.stateNode=n,Et=t,Pe=ca(n.firstChild),ra=!1,r=!0):r=!1),r||nn(t)),$(t),r=t.type,c=t.pendingProps,m=e!==null?e.memoizedProps:null,n=c.children,Yc(r,c)?n=null:m!==null&&Yc(r,m)&&(t.flags|=32),t.memoizedState!==null&&(r=Ku(e,t,Mv,null,null,a),Xi._currentValue=r),Fs(e,t),Rt(e,t,n,a),t.child;case 6:return e===null&&Ue&&((e=a=Pe)&&(a=by(a,t.pendingProps,ra),a!==null?(t.stateNode=a,Et=t,Pe=null,e=!0):e=!1),e||nn(t)),null;case 13:return A_(e,t,a);case 4:return ee(t,t.stateNode.containerInfo),n=t.pendingProps,e===null?t.child=Kn(t,null,n,a):Rt(e,t,n,a),t.child;case 11:return g_(e,t,t.type,t.pendingProps,a);case 7:return Rt(e,t,t.pendingProps,a),t.child;case 8:return Rt(e,t,t.pendingProps.children,a),t.child;case 12:return Rt(e,t,t.pendingProps.children,a),t.child;case 10:return n=t.pendingProps,ln(t,t.type,n.value),Rt(e,t,n.children,a),t.child;case 9:return r=t.type._context,n=t.pendingProps.children,Gn(t),r=At(r),n=n(r),t.flags|=1,Rt(e,t,n,a),t.child;case 14:return p_(e,t,t.type,t.pendingProps,a);case 15:return v_(e,t,t.type,t.pendingProps,a);case 19:return N_(e,t,a);case 31:return Vv(e,t,a);case 22:return y_(e,t,a,t.pendingProps);case 24:return Gn(t),n=At(ft),e===null?(r=Mu(),r===null&&(r=We,c=Ou(),r.pooledCache=c,c.refCount++,c!==null&&(r.pooledCacheLanes|=a),r=c),t.memoizedState={parent:n,cache:r},ku(t),ln(t,ft,r)):((e.lanes&a)!==0&&(zu(e,t),Ci(t,null,null,a),Ni()),r=e.memoizedState,c=t.memoizedState,r.parent!==n?(r={parent:n,cache:n},t.memoizedState=r,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=r),ln(t,ft,n)):(n=c.cache,ln(t,ft,n),n!==r.cache&&ju(t,[ft],a,!0))),Rt(e,t,t.pendingProps.children,a),t.child;case 29:throw t.pendingProps}throw Error(u(156,t.tag))}function ka(e){e.flags|=4}function vc(e,t,a,n,r){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(r&335544128)===r)if(e.stateNode.complete)e.flags|=8192;else if(tm())e.flags|=8192;else throw Zn=Os,Du}else e.flags&=-16777217}function w_(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!Km(t))if(tm())e.flags|=8192;else throw Zn=Os,Du}function Qs(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?rd():536870912,e.lanes|=t,zl|=t)}function Mi(e,t){if(!Ue)switch(e.tailMode){case"hidden":t=e.tail;for(var a=null;t!==null;)t.alternate!==null&&(a=t),t=t.sibling;a===null?e.tail=null:a.sibling=null;break;case"collapsed":a=e.tail;for(var n=null;a!==null;)a.alternate!==null&&(n=a),a=a.sibling;n===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:n.sibling=null}}function et(e){var t=e.alternate!==null&&e.alternate.child===e.child,a=0,n=0;if(t)for(var r=e.child;r!==null;)a|=r.lanes|r.childLanes,n|=r.subtreeFlags&65011712,n|=r.flags&65011712,r.return=e,r=r.sibling;else for(r=e.child;r!==null;)a|=r.lanes|r.childLanes,n|=r.subtreeFlags,n|=r.flags,r.return=e,r=r.sibling;return e.subtreeFlags|=n,e.childLanes=a,t}function Kv(e,t,a){var n=t.pendingProps;switch(Ru(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return et(t),null;case 1:return et(t),null;case 3:return a=t.stateNode,n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),Oa(ft),z(),a.pendingContext&&(a.context=a.pendingContext,a.pendingContext=null),(e===null||e.child===null)&&(El(t)?ka(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,Cu())),et(t),null;case 26:var r=t.type,c=t.memoizedState;return e===null?(ka(t),c!==null?(et(t),w_(t,c)):(et(t),vc(t,r,null,n,a))):c?c!==e.memoizedState?(ka(t),et(t),w_(t,c)):(et(t),t.flags&=-16777217):(e=e.memoizedProps,e!==n&&ka(t),et(t),vc(t,r,e,n,a)),null;case 27:if(re(t),a=X.current,r=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==n&&ka(t);else{if(!n){if(t.stateNode===null)throw Error(u(166));return et(t),null}e=x.current,El(t)?uf(t):(e=km(r,n,a),t.stateNode=e,ka(t))}return et(t),null;case 5:if(re(t),r=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==n&&ka(t);else{if(!n){if(t.stateNode===null)throw Error(u(166));return et(t),null}if(c=x.current,El(t))uf(t);else{var m=or(X.current);switch(c){case 1:c=m.createElementNS("http://www.w3.org/2000/svg",r);break;case 2:c=m.createElementNS("http://www.w3.org/1998/Math/MathML",r);break;default:switch(r){case"svg":c=m.createElementNS("http://www.w3.org/2000/svg",r);break;case"math":c=m.createElementNS("http://www.w3.org/1998/Math/MathML",r);break;case"script":c=m.createElement("div"),c.innerHTML="<script><\/script>",c=c.removeChild(c.firstChild);break;case"select":c=typeof n.is=="string"?m.createElement("select",{is:n.is}):m.createElement("select"),n.multiple?c.multiple=!0:n.size&&(c.size=n.size);break;default:c=typeof n.is=="string"?m.createElement(r,{is:n.is}):m.createElement(r)}}c[Tt]=t,c[Mt]=n;e:for(m=t.child;m!==null;){if(m.tag===5||m.tag===6)c.appendChild(m.stateNode);else if(m.tag!==4&&m.tag!==27&&m.child!==null){m.child.return=m,m=m.child;continue}if(m===t)break e;for(;m.sibling===null;){if(m.return===null||m.return===t)break e;m=m.return}m.sibling.return=m.return,m=m.sibling}t.stateNode=c;e:switch(Nt(c,r,n),r){case"button":case"input":case"select":case"textarea":n=!!n.autoFocus;break e;case"img":n=!0;break e;default:n=!1}n&&ka(t)}}return et(t),vc(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,a),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==n&&ka(t);else{if(typeof n!="string"&&t.stateNode===null)throw Error(u(166));if(e=X.current,El(t)){if(e=t.stateNode,a=t.memoizedProps,n=null,r=Et,r!==null)switch(r.tag){case 27:case 5:n=r.memoizedProps}e[Tt]=t,e=!!(e.nodeValue===a||n!==null&&n.suppressHydrationWarning===!0||Am(e.nodeValue,a)),e||nn(t,!0)}else e=or(e).createTextNode(n),e[Tt]=t,t.stateNode=e}return et(t),null;case 31:if(a=t.memoizedState,e===null||e.memoizedState!==null){if(n=El(t),a!==null){if(e===null){if(!n)throw Error(u(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(557));e[Tt]=t}else Un(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;et(t),e=!1}else a=Cu(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=a),e=!0;if(!e)return t.flags&256?(Ft(t),t):(Ft(t),null);if((t.flags&128)!==0)throw Error(u(558))}return et(t),null;case 13:if(n=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(r=El(t),n!==null&&n.dehydrated!==null){if(e===null){if(!r)throw Error(u(318));if(r=t.memoizedState,r=r!==null?r.dehydrated:null,!r)throw Error(u(317));r[Tt]=t}else Un(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;et(t),r=!1}else r=Cu(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=r),r=!0;if(!r)return t.flags&256?(Ft(t),t):(Ft(t),null)}return Ft(t),(t.flags&128)!==0?(t.lanes=a,t):(a=n!==null,e=e!==null&&e.memoizedState!==null,a&&(n=t.child,r=null,n.alternate!==null&&n.alternate.memoizedState!==null&&n.alternate.memoizedState.cachePool!==null&&(r=n.alternate.memoizedState.cachePool.pool),c=null,n.memoizedState!==null&&n.memoizedState.cachePool!==null&&(c=n.memoizedState.cachePool.pool),c!==r&&(n.flags|=2048)),a!==e&&a&&(t.child.flags|=8192),Qs(t,t.updateQueue),et(t),null);case 4:return z(),e===null&&Gc(t.stateNode.containerInfo),et(t),null;case 10:return Oa(t.type),et(t),null;case 19:if(L(ut),n=t.memoizedState,n===null)return et(t),null;if(r=(t.flags&128)!==0,c=n.rendering,c===null)if(r)Mi(n,!1);else{if(st!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(c=ks(e),c!==null){for(t.flags|=128,Mi(n,!1),e=c.updateQueue,t.updateQueue=e,Qs(t,e),t.subtreeFlags=0,e=a,a=t.child;a!==null;)af(a,e),a=a.sibling;return N(ut,ut.current&1|2),Ue&&La(t,n.treeForkCount),t.child}e=e.sibling}n.tail!==null&&Bt()>er&&(t.flags|=128,r=!0,Mi(n,!1),t.lanes=4194304)}else{if(!r)if(e=ks(c),e!==null){if(t.flags|=128,r=!0,e=e.updateQueue,t.updateQueue=e,Qs(t,e),Mi(n,!0),n.tail===null&&n.tailMode==="hidden"&&!c.alternate&&!Ue)return et(t),null}else 2*Bt()-n.renderingStartTime>er&&a!==536870912&&(t.flags|=128,r=!0,Mi(n,!1),t.lanes=4194304);n.isBackwards?(c.sibling=t.child,t.child=c):(e=n.last,e!==null?e.sibling=c:t.child=c,n.last=c)}return n.tail!==null?(e=n.tail,n.rendering=e,n.tail=e.sibling,n.renderingStartTime=Bt(),e.sibling=null,a=ut.current,N(ut,r?a&1|2:a&1),Ue&&La(t,n.treeForkCount),e):(et(t),null);case 22:case 23:return Ft(t),Bu(),n=t.memoizedState!==null,e!==null?e.memoizedState!==null!==n&&(t.flags|=8192):n&&(t.flags|=8192),n?(a&536870912)!==0&&(t.flags&128)===0&&(et(t),t.subtreeFlags&6&&(t.flags|=8192)):et(t),a=t.updateQueue,a!==null&&Qs(t,a.retryQueue),a=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(a=e.memoizedState.cachePool.pool),n=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(n=t.memoizedState.cachePool.pool),n!==a&&(t.flags|=2048),e!==null&&L(Bn),null;case 24:return a=null,e!==null&&(a=e.memoizedState.cache),t.memoizedState.cache!==a&&(t.flags|=2048),Oa(ft),et(t),null;case 25:return null;case 30:return null}throw Error(u(156,t.tag))}function Yv(e,t){switch(Ru(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return Oa(ft),z(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return re(t),null;case 31:if(t.memoizedState!==null){if(Ft(t),t.alternate===null)throw Error(u(340));Un()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(Ft(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(u(340));Un()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return L(ut),null;case 4:return z(),null;case 10:return Oa(t.type),null;case 22:case 23:return Ft(t),Bu(),e!==null&&L(Bn),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return Oa(ft),null;case 25:return null;default:return null}}function L_(e,t){switch(Ru(t),t.tag){case 3:Oa(ft),z();break;case 26:case 27:case 5:re(t);break;case 4:z();break;case 31:t.memoizedState!==null&&Ft(t);break;case 13:Ft(t);break;case 19:L(ut);break;case 10:Oa(t.type);break;case 22:case 23:Ft(t),Bu(),e!==null&&L(Bn);break;case 24:Oa(ft)}}function Di(e,t){try{var a=t.updateQueue,n=a!==null?a.lastEffect:null;if(n!==null){var r=n.next;a=r;do{if((a.tag&e)===e){n=void 0;var c=a.create,m=a.inst;n=c(),m.destroy=n}a=a.next}while(a!==r)}}catch(g){Fe(t,t.return,g)}}function dn(e,t,a){try{var n=t.updateQueue,r=n!==null?n.lastEffect:null;if(r!==null){var c=r.next;n=c;do{if((n.tag&e)===e){var m=n.inst,g=m.destroy;if(g!==void 0){m.destroy=void 0,r=t;var S=a,O=g;try{O()}catch(G){Fe(r,S,G)}}}n=n.next}while(n!==c)}}catch(G){Fe(t,t.return,G)}}function j_(e){var t=e.updateQueue;if(t!==null){var a=e.stateNode;try{xf(t,a)}catch(n){Fe(e,e.return,n)}}}function O_(e,t,a){a.props=qn(e.type,e.memoizedProps),a.state=e.memoizedState;try{a.componentWillUnmount()}catch(n){Fe(e,t,n)}}function ki(e,t){try{var a=e.ref;if(a!==null){switch(e.tag){case 26:case 27:case 5:var n=e.stateNode;break;case 30:n=e.stateNode;break;default:n=e.stateNode}typeof a=="function"?e.refCleanup=a(n):a.current=n}}catch(r){Fe(e,t,r)}}function ba(e,t){var a=e.ref,n=e.refCleanup;if(a!==null)if(typeof n=="function")try{n()}catch(r){Fe(e,t,r)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof a=="function")try{a(null)}catch(r){Fe(e,t,r)}else a.current=null}function I_(e){var t=e.type,a=e.memoizedProps,n=e.stateNode;try{e:switch(t){case"button":case"input":case"select":case"textarea":a.autoFocus&&n.focus();break e;case"img":a.src?n.src=a.src:a.srcSet&&(n.srcset=a.srcSet)}}catch(r){Fe(e,e.return,r)}}function yc(e,t,a){try{var n=e.stateNode;_y(n,e.type,a,t),n[Mt]=t}catch(r){Fe(e,e.return,r)}}function M_(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&vn(e.type)||e.tag===4}function bc(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||M_(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&vn(e.type)||e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function xc(e,t,a){var n=e.tag;if(n===5||n===6)e=e.stateNode,t?(a.nodeType===9?a.body:a.nodeName==="HTML"?a.ownerDocument.body:a).insertBefore(e,t):(t=a.nodeType===9?a.body:a.nodeName==="HTML"?a.ownerDocument.body:a,t.appendChild(e),a=a._reactRootContainer,a!=null||t.onclick!==null||(t.onclick=Na));else if(n!==4&&(n===27&&vn(e.type)&&(a=e.stateNode,t=null),e=e.child,e!==null))for(xc(e,t,a),e=e.sibling;e!==null;)xc(e,t,a),e=e.sibling}function $s(e,t,a){var n=e.tag;if(n===5||n===6)e=e.stateNode,t?a.insertBefore(e,t):a.appendChild(e);else if(n!==4&&(n===27&&vn(e.type)&&(a=e.stateNode),e=e.child,e!==null))for($s(e,t,a),e=e.sibling;e!==null;)$s(e,t,a),e=e.sibling}function D_(e){var t=e.stateNode,a=e.memoizedProps;try{for(var n=e.type,r=t.attributes;r.length;)t.removeAttributeNode(r[0]);Nt(t,n,a),t[Tt]=e,t[Mt]=a}catch(c){Fe(e,e.return,c)}}var za=!1,ht=!1,Sc=!1,k_=typeof WeakSet=="function"?WeakSet:Set,xt=null;function qv(e,t){if(e=e.containerInfo,Zc=pr,e=Fd(e),hu(e)){if("selectionStart"in e)var a={start:e.selectionStart,end:e.selectionEnd};else e:{a=(a=e.ownerDocument)&&a.defaultView||window;var n=a.getSelection&&a.getSelection();if(n&&n.rangeCount!==0){a=n.anchorNode;var r=n.anchorOffset,c=n.focusNode;n=n.focusOffset;try{a.nodeType,c.nodeType}catch{a=null;break e}var m=0,g=-1,S=-1,O=0,G=0,Y=e,M=null;t:for(;;){for(var k;Y!==a||r!==0&&Y.nodeType!==3||(g=m+r),Y!==c||n!==0&&Y.nodeType!==3||(S=m+n),Y.nodeType===3&&(m+=Y.nodeValue.length),(k=Y.firstChild)!==null;)M=Y,Y=k;for(;;){if(Y===e)break t;if(M===a&&++O===r&&(g=m),M===c&&++G===n&&(S=m),(k=Y.nextSibling)!==null)break;Y=M,M=Y.parentNode}Y=k}a=g===-1||S===-1?null:{start:g,end:S}}else a=null}a=a||{start:0,end:0}}else a=null;for(Kc={focusedElem:e,selectionRange:a},pr=!1,xt=t;xt!==null;)if(t=xt,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,xt=e;else for(;xt!==null;){switch(t=xt,c=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(a=0;a<e.length;a++)r=e[a],r.ref.impl=r.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&c!==null){e=void 0,a=t,r=c.memoizedProps,c=c.memoizedState,n=a.stateNode;try{var ue=qn(a.type,r);e=n.getSnapshotBeforeUpdate(ue,c),n.__reactInternalSnapshotBeforeUpdate=e}catch(be){Fe(a,a.return,be)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,a=e.nodeType,a===9)Fc(e);else if(a===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":Fc(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(u(163))}if(e=t.sibling,e!==null){e.return=t.return,xt=e;break}xt=t.return}}function z_(e,t,a){var n=a.flags;switch(a.tag){case 0:case 11:case 15:Ha(e,a),n&4&&Di(5,a);break;case 1:if(Ha(e,a),n&4)if(e=a.stateNode,t===null)try{e.componentDidMount()}catch(m){Fe(a,a.return,m)}else{var r=qn(a.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(r,t,e.__reactInternalSnapshotBeforeUpdate)}catch(m){Fe(a,a.return,m)}}n&64&&j_(a),n&512&&ki(a,a.return);break;case 3:if(Ha(e,a),n&64&&(e=a.updateQueue,e!==null)){if(t=null,a.child!==null)switch(a.child.tag){case 27:case 5:t=a.child.stateNode;break;case 1:t=a.child.stateNode}try{xf(e,t)}catch(m){Fe(a,a.return,m)}}break;case 27:t===null&&n&4&&D_(a);case 26:case 5:Ha(e,a),t===null&&n&4&&I_(a),n&512&&ki(a,a.return);break;case 12:Ha(e,a);break;case 31:Ha(e,a),n&4&&G_(e,a);break;case 13:Ha(e,a),n&4&&B_(e,a),n&64&&(e=a.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(a=ty.bind(null,a),xy(e,a))));break;case 22:if(n=a.memoizedState!==null||za,!n){t=t!==null&&t.memoizedState!==null||ht,r=za;var c=ht;za=n,(ht=t)&&!c?Ga(e,a,(a.subtreeFlags&8772)!==0):Ha(e,a),za=r,ht=c}break;case 30:break;default:Ha(e,a)}}function U_(e){var t=e.alternate;t!==null&&(e.alternate=null,U_(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&Wr(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var tt=null,kt=!1;function Ua(e,t,a){for(a=a.child;a!==null;)H_(e,t,a),a=a.sibling}function H_(e,t,a){if(Vt&&typeof Vt.onCommitFiberUnmount=="function")try{Vt.onCommitFiberUnmount(si,a)}catch{}switch(a.tag){case 26:ht||ba(a,t),Ua(e,t,a),a.memoizedState?a.memoizedState.count--:a.stateNode&&(a=a.stateNode,a.parentNode.removeChild(a));break;case 27:ht||ba(a,t);var n=tt,r=kt;vn(a.type)&&(tt=a.stateNode,kt=!1),Ua(e,t,a),Yi(a.stateNode),tt=n,kt=r;break;case 5:ht||ba(a,t);case 6:if(n=tt,r=kt,tt=null,Ua(e,t,a),tt=n,kt=r,tt!==null)if(kt)try{(tt.nodeType===9?tt.body:tt.nodeName==="HTML"?tt.ownerDocument.body:tt).removeChild(a.stateNode)}catch(c){Fe(a,t,c)}else try{tt.removeChild(a.stateNode)}catch(c){Fe(a,t,c)}break;case 18:tt!==null&&(kt?(e=tt,jm(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,a.stateNode),Yl(e)):jm(tt,a.stateNode));break;case 4:n=tt,r=kt,tt=a.stateNode.containerInfo,kt=!0,Ua(e,t,a),tt=n,kt=r;break;case 0:case 11:case 14:case 15:dn(2,a,t),ht||dn(4,a,t),Ua(e,t,a);break;case 1:ht||(ba(a,t),n=a.stateNode,typeof n.componentWillUnmount=="function"&&O_(a,t,n)),Ua(e,t,a);break;case 21:Ua(e,t,a);break;case 22:ht=(n=ht)||a.memoizedState!==null,Ua(e,t,a),ht=n;break;default:Ua(e,t,a)}}function G_(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Yl(e)}catch(a){Fe(t,t.return,a)}}}function B_(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Yl(e)}catch(a){Fe(t,t.return,a)}}function Fv(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new k_),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new k_),t;default:throw Error(u(435,e.tag))}}function Js(e,t){var a=Fv(e);t.forEach(function(n){if(!a.has(n)){a.add(n);var r=ay.bind(null,e,n);n.then(r,r)}})}function zt(e,t){var a=t.deletions;if(a!==null)for(var n=0;n<a.length;n++){var r=a[n],c=e,m=t,g=m;e:for(;g!==null;){switch(g.tag){case 27:if(vn(g.type)){tt=g.stateNode,kt=!1;break e}break;case 5:tt=g.stateNode,kt=!1;break e;case 3:case 4:tt=g.stateNode.containerInfo,kt=!0;break e}g=g.return}if(tt===null)throw Error(u(160));H_(c,m,r),tt=null,kt=!1,c=r.alternate,c!==null&&(c.return=null),r.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)V_(t,e),t=t.sibling}var ha=null;function V_(e,t){var a=e.alternate,n=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:zt(t,e),Ut(e),n&4&&(dn(3,e,e.return),Di(3,e),dn(5,e,e.return));break;case 1:zt(t,e),Ut(e),n&512&&(ht||a===null||ba(a,a.return)),n&64&&za&&(e=e.updateQueue,e!==null&&(n=e.callbacks,n!==null&&(a=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=a===null?n:a.concat(n))));break;case 26:var r=ha;if(zt(t,e),Ut(e),n&512&&(ht||a===null||ba(a,a.return)),n&4){var c=a!==null?a.memoizedState:null;if(n=e.memoizedState,a===null)if(n===null)if(e.stateNode===null){e:{n=e.type,a=e.memoizedProps,r=r.ownerDocument||r;t:switch(n){case"title":c=r.getElementsByTagName("title")[0],(!c||c[ci]||c[Tt]||c.namespaceURI==="http://www.w3.org/2000/svg"||c.hasAttribute("itemprop"))&&(c=r.createElement(n),r.head.insertBefore(c,r.querySelector("head > title"))),Nt(c,n,a),c[Tt]=e,bt(c),n=c;break e;case"link":var m=Vm("link","href",r).get(n+(a.href||""));if(m){for(var g=0;g<m.length;g++)if(c=m[g],c.getAttribute("href")===(a.href==null||a.href===""?null:a.href)&&c.getAttribute("rel")===(a.rel==null?null:a.rel)&&c.getAttribute("title")===(a.title==null?null:a.title)&&c.getAttribute("crossorigin")===(a.crossOrigin==null?null:a.crossOrigin)){m.splice(g,1);break t}}c=r.createElement(n),Nt(c,n,a),r.head.appendChild(c);break;case"meta":if(m=Vm("meta","content",r).get(n+(a.content||""))){for(g=0;g<m.length;g++)if(c=m[g],c.getAttribute("content")===(a.content==null?null:""+a.content)&&c.getAttribute("name")===(a.name==null?null:a.name)&&c.getAttribute("property")===(a.property==null?null:a.property)&&c.getAttribute("http-equiv")===(a.httpEquiv==null?null:a.httpEquiv)&&c.getAttribute("charset")===(a.charSet==null?null:a.charSet)){m.splice(g,1);break t}}c=r.createElement(n),Nt(c,n,a),r.head.appendChild(c);break;default:throw Error(u(468,n))}c[Tt]=e,bt(c),n=c}e.stateNode=n}else Zm(r,e.type,e.stateNode);else e.stateNode=Bm(r,n,e.memoizedProps);else c!==n?(c===null?a.stateNode!==null&&(a=a.stateNode,a.parentNode.removeChild(a)):c.count--,n===null?Zm(r,e.type,e.stateNode):Bm(r,n,e.memoizedProps)):n===null&&e.stateNode!==null&&yc(e,e.memoizedProps,a.memoizedProps)}break;case 27:zt(t,e),Ut(e),n&512&&(ht||a===null||ba(a,a.return)),a!==null&&n&4&&yc(e,e.memoizedProps,a.memoizedProps);break;case 5:if(zt(t,e),Ut(e),n&512&&(ht||a===null||ba(a,a.return)),e.flags&32){r=e.stateNode;try{ml(r,"")}catch(ue){Fe(e,e.return,ue)}}n&4&&e.stateNode!=null&&(r=e.memoizedProps,yc(e,r,a!==null?a.memoizedProps:r)),n&1024&&(Sc=!0);break;case 6:if(zt(t,e),Ut(e),n&4){if(e.stateNode===null)throw Error(u(162));n=e.memoizedProps,a=e.stateNode;try{a.nodeValue=n}catch(ue){Fe(e,e.return,ue)}}break;case 3:if(_r=null,r=ha,ha=dr(t.containerInfo),zt(t,e),ha=r,Ut(e),n&4&&a!==null&&a.memoizedState.isDehydrated)try{Yl(t.containerInfo)}catch(ue){Fe(e,e.return,ue)}Sc&&(Sc=!1,Z_(e));break;case 4:n=ha,ha=dr(e.stateNode.containerInfo),zt(t,e),Ut(e),ha=n;break;case 12:zt(t,e),Ut(e);break;case 31:zt(t,e),Ut(e),n&4&&(n=e.updateQueue,n!==null&&(e.updateQueue=null,Js(e,n)));break;case 13:zt(t,e),Ut(e),e.child.flags&8192&&e.memoizedState!==null!=(a!==null&&a.memoizedState!==null)&&(Ps=Bt()),n&4&&(n=e.updateQueue,n!==null&&(e.updateQueue=null,Js(e,n)));break;case 22:r=e.memoizedState!==null;var S=a!==null&&a.memoizedState!==null,O=za,G=ht;if(za=O||r,ht=G||S,zt(t,e),ht=G,za=O,Ut(e),n&8192)e:for(t=e.stateNode,t._visibility=r?t._visibility&-2:t._visibility|1,r&&(a===null||S||za||ht||Fn(e)),a=null,t=e;;){if(t.tag===5||t.tag===26){if(a===null){S=a=t;try{if(c=S.stateNode,r)m=c.style,typeof m.setProperty=="function"?m.setProperty("display","none","important"):m.display="none";else{g=S.stateNode;var Y=S.memoizedProps.style,M=Y!=null&&Y.hasOwnProperty("display")?Y.display:null;g.style.display=M==null||typeof M=="boolean"?"":(""+M).trim()}}catch(ue){Fe(S,S.return,ue)}}}else if(t.tag===6){if(a===null){S=t;try{S.stateNode.nodeValue=r?"":S.memoizedProps}catch(ue){Fe(S,S.return,ue)}}}else if(t.tag===18){if(a===null){S=t;try{var k=S.stateNode;r?Om(k,!0):Om(S.stateNode,!1)}catch(ue){Fe(S,S.return,ue)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;a===t&&(a=null),t=t.return}a===t&&(a=null),t.sibling.return=t.return,t=t.sibling}n&4&&(n=e.updateQueue,n!==null&&(a=n.retryQueue,a!==null&&(n.retryQueue=null,Js(e,a))));break;case 19:zt(t,e),Ut(e),n&4&&(n=e.updateQueue,n!==null&&(e.updateQueue=null,Js(e,n)));break;case 30:break;case 21:break;default:zt(t,e),Ut(e)}}function Ut(e){var t=e.flags;if(t&2){try{for(var a,n=e.return;n!==null;){if(M_(n)){a=n;break}n=n.return}if(a==null)throw Error(u(160));switch(a.tag){case 27:var r=a.stateNode,c=bc(e);$s(e,c,r);break;case 5:var m=a.stateNode;a.flags&32&&(ml(m,""),a.flags&=-33);var g=bc(e);$s(e,g,m);break;case 3:case 4:var S=a.stateNode.containerInfo,O=bc(e);xc(e,O,S);break;default:throw Error(u(161))}}catch(G){Fe(e,e.return,G)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function Z_(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;Z_(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function Ha(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)z_(e,t.alternate,t),t=t.sibling}function Fn(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:dn(4,t,t.return),Fn(t);break;case 1:ba(t,t.return);var a=t.stateNode;typeof a.componentWillUnmount=="function"&&O_(t,t.return,a),Fn(t);break;case 27:Yi(t.stateNode);case 26:case 5:ba(t,t.return),Fn(t);break;case 22:t.memoizedState===null&&Fn(t);break;case 30:Fn(t);break;default:Fn(t)}e=e.sibling}}function Ga(e,t,a){for(a=a&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var n=t.alternate,r=e,c=t,m=c.flags;switch(c.tag){case 0:case 11:case 15:Ga(r,c,a),Di(4,c);break;case 1:if(Ga(r,c,a),n=c,r=n.stateNode,typeof r.componentDidMount=="function")try{r.componentDidMount()}catch(O){Fe(n,n.return,O)}if(n=c,r=n.updateQueue,r!==null){var g=n.stateNode;try{var S=r.shared.hiddenCallbacks;if(S!==null)for(r.shared.hiddenCallbacks=null,r=0;r<S.length;r++)bf(S[r],g)}catch(O){Fe(n,n.return,O)}}a&&m&64&&j_(c),ki(c,c.return);break;case 27:D_(c);case 26:case 5:Ga(r,c,a),a&&n===null&&m&4&&I_(c),ki(c,c.return);break;case 12:Ga(r,c,a);break;case 31:Ga(r,c,a),a&&m&4&&G_(r,c);break;case 13:Ga(r,c,a),a&&m&4&&B_(r,c);break;case 22:c.memoizedState===null&&Ga(r,c,a),ki(c,c.return);break;case 30:break;default:Ga(r,c,a)}t=t.sibling}}function Tc(e,t){var a=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(a=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==a&&(e!=null&&e.refCount++,a!=null&&Si(a))}function Ec(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Si(e))}function ga(e,t,a,n){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)K_(e,t,a,n),t=t.sibling}function K_(e,t,a,n){var r=t.flags;switch(t.tag){case 0:case 11:case 15:ga(e,t,a,n),r&2048&&Di(9,t);break;case 1:ga(e,t,a,n);break;case 3:ga(e,t,a,n),r&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Si(e)));break;case 12:if(r&2048){ga(e,t,a,n),e=t.stateNode;try{var c=t.memoizedProps,m=c.id,g=c.onPostCommit;typeof g=="function"&&g(m,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(S){Fe(t,t.return,S)}}else ga(e,t,a,n);break;case 31:ga(e,t,a,n);break;case 13:ga(e,t,a,n);break;case 23:break;case 22:c=t.stateNode,m=t.alternate,t.memoizedState!==null?c._visibility&2?ga(e,t,a,n):zi(e,t):c._visibility&2?ga(e,t,a,n):(c._visibility|=2,Ml(e,t,a,n,(t.subtreeFlags&10256)!==0||!1)),r&2048&&Tc(m,t);break;case 24:ga(e,t,a,n),r&2048&&Ec(t.alternate,t);break;default:ga(e,t,a,n)}}function Ml(e,t,a,n,r){for(r=r&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var c=e,m=t,g=a,S=n,O=m.flags;switch(m.tag){case 0:case 11:case 15:Ml(c,m,g,S,r),Di(8,m);break;case 23:break;case 22:var G=m.stateNode;m.memoizedState!==null?G._visibility&2?Ml(c,m,g,S,r):zi(c,m):(G._visibility|=2,Ml(c,m,g,S,r)),r&&O&2048&&Tc(m.alternate,m);break;case 24:Ml(c,m,g,S,r),r&&O&2048&&Ec(m.alternate,m);break;default:Ml(c,m,g,S,r)}t=t.sibling}}function zi(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var a=e,n=t,r=n.flags;switch(n.tag){case 22:zi(a,n),r&2048&&Tc(n.alternate,n);break;case 24:zi(a,n),r&2048&&Ec(n.alternate,n);break;default:zi(a,n)}t=t.sibling}}var Ui=8192;function Dl(e,t,a){if(e.subtreeFlags&Ui)for(e=e.child;e!==null;)Y_(e,t,a),e=e.sibling}function Y_(e,t,a){switch(e.tag){case 26:Dl(e,t,a),e.flags&Ui&&e.memoizedState!==null&&Iy(a,ha,e.memoizedState,e.memoizedProps);break;case 5:Dl(e,t,a);break;case 3:case 4:var n=ha;ha=dr(e.stateNode.containerInfo),Dl(e,t,a),ha=n;break;case 22:e.memoizedState===null&&(n=e.alternate,n!==null&&n.memoizedState!==null?(n=Ui,Ui=16777216,Dl(e,t,a),Ui=n):Dl(e,t,a));break;default:Dl(e,t,a)}}function q_(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function Hi(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var a=0;a<t.length;a++){var n=t[a];xt=n,X_(n,e)}q_(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)F_(e),e=e.sibling}function F_(e){switch(e.tag){case 0:case 11:case 15:Hi(e),e.flags&2048&&dn(9,e,e.return);break;case 3:Hi(e);break;case 12:Hi(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,Ws(e)):Hi(e);break;default:Hi(e)}}function Ws(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var a=0;a<t.length;a++){var n=t[a];xt=n,X_(n,e)}q_(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:dn(8,t,t.return),Ws(t);break;case 22:a=t.stateNode,a._visibility&2&&(a._visibility&=-3,Ws(t));break;default:Ws(t)}e=e.sibling}}function X_(e,t){for(;xt!==null;){var a=xt;switch(a.tag){case 0:case 11:case 15:dn(8,a,t);break;case 23:case 22:if(a.memoizedState!==null&&a.memoizedState.cachePool!==null){var n=a.memoizedState.cachePool.pool;n!=null&&n.refCount++}break;case 24:Si(a.memoizedState.cache)}if(n=a.child,n!==null)n.return=a,xt=n;else e:for(a=e;xt!==null;){n=xt;var r=n.sibling,c=n.return;if(U_(n),n===a){xt=null;break e}if(r!==null){r.return=c,xt=r;break e}xt=c}}}var Xv={getCacheForType:function(e){var t=At(ft),a=t.data.get(e);return a===void 0&&(a=e(),t.data.set(e,a)),a},cacheSignal:function(){return At(ft).controller.signal}},Qv=typeof WeakMap=="function"?WeakMap:Map,Ye=0,We=null,Me=null,ke=0,qe=0,Xt=null,fn=!1,kl=!1,Ac=!1,Ba=0,st=0,_n=0,Xn=0,Rc=0,Qt=0,zl=0,Gi=null,Ht=null,Nc=!1,Ps=0,Q_=0,er=1/0,tr=null,mn=null,pt=0,hn=null,Ul=null,Va=0,Cc=0,wc=null,$_=null,Bi=0,Lc=null;function $t(){return(Ye&2)!==0&&ke!==0?ke&-ke:H.T!==null?kc():dd()}function J_(){if(Qt===0)if((ke&536870912)===0||Ue){var e=cs;cs<<=1,(cs&3932160)===0&&(cs=262144),Qt=e}else Qt=536870912;return e=qt.current,e!==null&&(e.flags|=32),Qt}function Gt(e,t,a){(e===We&&(qe===2||qe===9)||e.cancelPendingCommit!==null)&&(Hl(e,0),gn(e,ke,Qt,!1)),ui(e,a),((Ye&2)===0||e!==We)&&(e===We&&((Ye&2)===0&&(Xn|=a),st===4&&gn(e,ke,Qt,!1)),xa(e))}function W_(e,t,a){if((Ye&6)!==0)throw Error(u(327));var n=!a&&(t&127)===0&&(t&e.expiredLanes)===0||ri(e,t),r=n?Wv(e,t):Oc(e,t,!0),c=n;do{if(r===0){kl&&!n&&gn(e,t,0,!1);break}else{if(a=e.current.alternate,c&&!$v(a)){r=Oc(e,t,!1),c=!1;continue}if(r===2){if(c=t,e.errorRecoveryDisabledLanes&c)var m=0;else m=e.pendingLanes&-536870913,m=m!==0?m:m&536870912?536870912:0;if(m!==0){t=m;e:{var g=e;r=Gi;var S=g.current.memoizedState.isDehydrated;if(S&&(Hl(g,m).flags|=256),m=Oc(g,m,!1),m!==2){if(Ac&&!S){g.errorRecoveryDisabledLanes|=c,Xn|=c,r=4;break e}c=Ht,Ht=r,c!==null&&(Ht===null?Ht=c:Ht.push.apply(Ht,c))}r=m}if(c=!1,r!==2)continue}}if(r===1){Hl(e,0),gn(e,t,0,!0);break}e:{switch(n=e,c=r,c){case 0:case 1:throw Error(u(345));case 4:if((t&4194048)!==t)break;case 6:gn(n,t,Qt,!fn);break e;case 2:Ht=null;break;case 3:case 5:break;default:throw Error(u(329))}if((t&62914560)===t&&(r=Ps+300-Bt(),10<r)){if(gn(n,t,Qt,!fn),ds(n,0,!0)!==0)break e;Va=t,n.timeoutHandle=wm(P_.bind(null,n,a,Ht,tr,Nc,t,Qt,Xn,zl,fn,c,"Throttled",-0,0),r);break e}P_(n,a,Ht,tr,Nc,t,Qt,Xn,zl,fn,c,null,-0,0)}}break}while(!0);xa(e)}function P_(e,t,a,n,r,c,m,g,S,O,G,Y,M,k){if(e.timeoutHandle=-1,Y=t.subtreeFlags,Y&8192||(Y&16785408)===16785408){Y={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:Na},Y_(t,c,Y);var ue=(c&62914560)===c?Ps-Bt():(c&4194048)===c?Q_-Bt():0;if(ue=My(Y,ue),ue!==null){Va=c,e.cancelPendingCommit=ue(rm.bind(null,e,t,c,a,n,r,m,g,S,G,Y,null,M,k)),gn(e,c,m,!O);return}}rm(e,t,c,a,n,r,m,g,S)}function $v(e){for(var t=e;;){var a=t.tag;if((a===0||a===11||a===15)&&t.flags&16384&&(a=t.updateQueue,a!==null&&(a=a.stores,a!==null)))for(var n=0;n<a.length;n++){var r=a[n],c=r.getSnapshot;r=r.value;try{if(!Kt(c(),r))return!1}catch{return!1}}if(a=t.child,t.subtreeFlags&16384&&a!==null)a.return=t,t=a;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function gn(e,t,a,n){t&=~Rc,t&=~Xn,e.suspendedLanes|=t,e.pingedLanes&=~t,n&&(e.warmLanes|=t),n=e.expirationTimes;for(var r=t;0<r;){var c=31-Zt(r),m=1<<c;n[c]=-1,r&=~m}a!==0&&ud(e,a,t)}function ar(){return(Ye&6)===0?(Vi(0),!1):!0}function jc(){if(Me!==null){if(qe===0)var e=Me.return;else e=Me,ja=Hn=null,Fu(e),wl=null,Ei=0,e=Me;for(;e!==null;)L_(e.alternate,e),e=e.return;Me=null}}function Hl(e,t){var a=e.timeoutHandle;a!==-1&&(e.timeoutHandle=-1,gy(a)),a=e.cancelPendingCommit,a!==null&&(e.cancelPendingCommit=null,a()),Va=0,jc(),We=e,Me=a=wa(e.current,null),ke=t,qe=0,Xt=null,fn=!1,kl=ri(e,t),Ac=!1,zl=Qt=Rc=Xn=_n=st=0,Ht=Gi=null,Nc=!1,(t&8)!==0&&(t|=t&32);var n=e.entangledLanes;if(n!==0)for(e=e.entanglements,n&=t;0<n;){var r=31-Zt(n),c=1<<r;t|=e[r],n&=~c}return Ba=t,Ts(),a}function em(e,t){Ne=null,H.H=Oi,t===Cl||t===js?(t=gf(),qe=3):t===Du?(t=gf(),qe=4):qe=t===cc?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,Xt=t,Me===null&&(st=1,Ys(e,la(t,e.current)))}function tm(){var e=qt.current;return e===null?!0:(ke&4194048)===ke?ua===null:(ke&62914560)===ke||(ke&536870912)!==0?e===ua:!1}function am(){var e=H.H;return H.H=Oi,e===null?Oi:e}function nm(){var e=H.A;return H.A=Xv,e}function nr(){st=4,fn||(ke&4194048)!==ke&&qt.current!==null||(kl=!0),(_n&134217727)===0&&(Xn&134217727)===0||We===null||gn(We,ke,Qt,!1)}function Oc(e,t,a){var n=Ye;Ye|=2;var r=am(),c=nm();(We!==e||ke!==t)&&(tr=null,Hl(e,t)),t=!1;var m=st;e:do try{if(qe!==0&&Me!==null){var g=Me,S=Xt;switch(qe){case 8:jc(),m=6;break e;case 3:case 2:case 9:case 6:qt.current===null&&(t=!0);var O=qe;if(qe=0,Xt=null,Gl(e,g,S,O),a&&kl){m=0;break e}break;default:O=qe,qe=0,Xt=null,Gl(e,g,S,O)}}Jv(),m=st;break}catch(G){em(e,G)}while(!0);return t&&e.shellSuspendCounter++,ja=Hn=null,Ye=n,H.H=r,H.A=c,Me===null&&(We=null,ke=0,Ts()),m}function Jv(){for(;Me!==null;)lm(Me)}function Wv(e,t){var a=Ye;Ye|=2;var n=am(),r=nm();We!==e||ke!==t?(tr=null,er=Bt()+500,Hl(e,t)):kl=ri(e,t);e:do try{if(qe!==0&&Me!==null){t=Me;var c=Xt;t:switch(qe){case 1:qe=0,Xt=null,Gl(e,t,c,1);break;case 2:case 9:if(mf(c)){qe=0,Xt=null,im(t);break}t=function(){qe!==2&&qe!==9||We!==e||(qe=7),xa(e)},c.then(t,t);break e;case 3:qe=7;break e;case 4:qe=5;break e;case 7:mf(c)?(qe=0,Xt=null,im(t)):(qe=0,Xt=null,Gl(e,t,c,7));break;case 5:var m=null;switch(Me.tag){case 26:m=Me.memoizedState;case 5:case 27:var g=Me;if(m?Km(m):g.stateNode.complete){qe=0,Xt=null;var S=g.sibling;if(S!==null)Me=S;else{var O=g.return;O!==null?(Me=O,lr(O)):Me=null}break t}}qe=0,Xt=null,Gl(e,t,c,5);break;case 6:qe=0,Xt=null,Gl(e,t,c,6);break;case 8:jc(),st=6;break e;default:throw Error(u(462))}}Pv();break}catch(G){em(e,G)}while(!0);return ja=Hn=null,H.H=n,H.A=r,Ye=a,Me!==null?0:(We=null,ke=0,Ts(),st)}function Pv(){for(;Me!==null&&!Lt();)lm(Me)}function lm(e){var t=C_(e.alternate,e,Ba);e.memoizedProps=e.pendingProps,t===null?lr(e):Me=t}function im(e){var t=e,a=t.alternate;switch(t.tag){case 15:case 0:t=S_(a,t,t.pendingProps,t.type,void 0,ke);break;case 11:t=S_(a,t,t.pendingProps,t.type.render,t.ref,ke);break;case 5:Fu(t);default:L_(a,t),t=Me=af(t,Ba),t=C_(a,t,Ba)}e.memoizedProps=e.pendingProps,t===null?lr(e):Me=t}function Gl(e,t,a,n){ja=Hn=null,Fu(t),wl=null,Ei=0;var r=t.return;try{if(Bv(e,r,t,a,ke)){st=1,Ys(e,la(a,e.current)),Me=null;return}}catch(c){if(r!==null)throw Me=r,c;st=1,Ys(e,la(a,e.current)),Me=null;return}t.flags&32768?(Ue||n===1?e=!0:kl||(ke&536870912)!==0?e=!1:(fn=e=!0,(n===2||n===9||n===3||n===6)&&(n=qt.current,n!==null&&n.tag===13&&(n.flags|=16384))),sm(t,e)):lr(t)}function lr(e){var t=e;do{if((t.flags&32768)!==0){sm(t,fn);return}e=t.return;var a=Kv(t.alternate,t,Ba);if(a!==null){Me=a;return}if(t=t.sibling,t!==null){Me=t;return}Me=t=e}while(t!==null);st===0&&(st=5)}function sm(e,t){do{var a=Yv(e.alternate,e);if(a!==null){a.flags&=32767,Me=a;return}if(a=e.return,a!==null&&(a.flags|=32768,a.subtreeFlags=0,a.deletions=null),!t&&(e=e.sibling,e!==null)){Me=e;return}Me=e=a}while(e!==null);st=6,Me=null}function rm(e,t,a,n,r,c,m,g,S){e.cancelPendingCommit=null;do ir();while(pt!==0);if((Ye&6)!==0)throw Error(u(327));if(t!==null){if(t===e.current)throw Error(u(177));if(c=t.lanes|t.childLanes,c|=bu,Op(e,a,c,m,g,S),e===We&&(Me=We=null,ke=0),Ul=t,hn=e,Va=a,Cc=c,wc=r,$_=n,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,ny(rs,function(){return fm(),null})):(e.callbackNode=null,e.callbackPriority=0),n=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||n){n=H.T,H.T=null,r=B.p,B.p=2,m=Ye,Ye|=4;try{qv(e,t,a)}finally{Ye=m,B.p=r,H.T=n}}pt=1,um(),cm(),om()}}function um(){if(pt===1){pt=0;var e=hn,t=Ul,a=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||a){a=H.T,H.T=null;var n=B.p;B.p=2;var r=Ye;Ye|=4;try{V_(t,e);var c=Kc,m=Fd(e.containerInfo),g=c.focusedElem,S=c.selectionRange;if(m!==g&&g&&g.ownerDocument&&qd(g.ownerDocument.documentElement,g)){if(S!==null&&hu(g)){var O=S.start,G=S.end;if(G===void 0&&(G=O),"selectionStart"in g)g.selectionStart=O,g.selectionEnd=Math.min(G,g.value.length);else{var Y=g.ownerDocument||document,M=Y&&Y.defaultView||window;if(M.getSelection){var k=M.getSelection(),ue=g.textContent.length,be=Math.min(S.start,ue),Je=S.end===void 0?be:Math.min(S.end,ue);!k.extend&&be>Je&&(m=Je,Je=be,be=m);var C=Yd(g,be),A=Yd(g,Je);if(C&&A&&(k.rangeCount!==1||k.anchorNode!==C.node||k.anchorOffset!==C.offset||k.focusNode!==A.node||k.focusOffset!==A.offset)){var j=Y.createRange();j.setStart(C.node,C.offset),k.removeAllRanges(),be>Je?(k.addRange(j),k.extend(A.node,A.offset)):(j.setEnd(A.node,A.offset),k.addRange(j))}}}}for(Y=[],k=g;k=k.parentNode;)k.nodeType===1&&Y.push({element:k,left:k.scrollLeft,top:k.scrollTop});for(typeof g.focus=="function"&&g.focus(),g=0;g<Y.length;g++){var V=Y[g];V.element.scrollLeft=V.left,V.element.scrollTop=V.top}}pr=!!Zc,Kc=Zc=null}finally{Ye=r,B.p=n,H.T=a}}e.current=t,pt=2}}function cm(){if(pt===2){pt=0;var e=hn,t=Ul,a=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||a){a=H.T,H.T=null;var n=B.p;B.p=2;var r=Ye;Ye|=4;try{z_(e,t.alternate,t)}finally{Ye=r,B.p=n,H.T=a}}pt=3}}function om(){if(pt===4||pt===3){pt=0,Fr();var e=hn,t=Ul,a=Va,n=$_;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?pt=5:(pt=0,Ul=hn=null,dm(e,e.pendingLanes));var r=e.pendingLanes;if(r===0&&(mn=null),$r(a),t=t.stateNode,Vt&&typeof Vt.onCommitFiberRoot=="function")try{Vt.onCommitFiberRoot(si,t,void 0,(t.current.flags&128)===128)}catch{}if(n!==null){t=H.T,r=B.p,B.p=2,H.T=null;try{for(var c=e.onRecoverableError,m=0;m<n.length;m++){var g=n[m];c(g.value,{componentStack:g.stack})}}finally{H.T=t,B.p=r}}(Va&3)!==0&&ir(),xa(e),r=e.pendingLanes,(a&261930)!==0&&(r&42)!==0?e===Lc?Bi++:(Bi=0,Lc=e):Bi=0,Vi(0)}}function dm(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,Si(t)))}function ir(){return um(),cm(),om(),fm()}function fm(){if(pt!==5)return!1;var e=hn,t=Cc;Cc=0;var a=$r(Va),n=H.T,r=B.p;try{B.p=32>a?32:a,H.T=null,a=wc,wc=null;var c=hn,m=Va;if(pt=0,Ul=hn=null,Va=0,(Ye&6)!==0)throw Error(u(331));var g=Ye;if(Ye|=4,F_(c.current),K_(c,c.current,m,a),Ye=g,Vi(0,!1),Vt&&typeof Vt.onPostCommitFiberRoot=="function")try{Vt.onPostCommitFiberRoot(si,c)}catch{}return!0}finally{B.p=r,H.T=n,dm(e,t)}}function _m(e,t,a){t=la(a,t),t=uc(e.stateNode,t,2),e=un(e,t,2),e!==null&&(ui(e,2),xa(e))}function Fe(e,t,a){if(e.tag===3)_m(e,e,a);else for(;t!==null;){if(t.tag===3){_m(t,e,a);break}else if(t.tag===1){var n=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof n.componentDidCatch=="function"&&(mn===null||!mn.has(n))){e=la(a,e),a=m_(2),n=un(t,a,2),n!==null&&(h_(a,n,t,e),ui(n,2),xa(n));break}}t=t.return}}function Ic(e,t,a){var n=e.pingCache;if(n===null){n=e.pingCache=new Qv;var r=new Set;n.set(t,r)}else r=n.get(t),r===void 0&&(r=new Set,n.set(t,r));r.has(a)||(Ac=!0,r.add(a),e=ey.bind(null,e,t,a),t.then(e,e))}function ey(e,t,a){var n=e.pingCache;n!==null&&n.delete(t),e.pingedLanes|=e.suspendedLanes&a,e.warmLanes&=~a,We===e&&(ke&a)===a&&(st===4||st===3&&(ke&62914560)===ke&&300>Bt()-Ps?(Ye&2)===0&&Hl(e,0):Rc|=a,zl===ke&&(zl=0)),xa(e)}function mm(e,t){t===0&&(t=rd()),e=kn(e,t),e!==null&&(ui(e,t),xa(e))}function ty(e){var t=e.memoizedState,a=0;t!==null&&(a=t.retryLane),mm(e,a)}function ay(e,t){var a=0;switch(e.tag){case 31:case 13:var n=e.stateNode,r=e.memoizedState;r!==null&&(a=r.retryLane);break;case 19:n=e.stateNode;break;case 22:n=e.stateNode._retryCache;break;default:throw Error(u(314))}n!==null&&n.delete(t),mm(e,a)}function ny(e,t){return _a(e,t)}var sr=null,Bl=null,Mc=!1,rr=!1,Dc=!1,pn=0;function xa(e){e!==Bl&&e.next===null&&(Bl===null?sr=Bl=e:Bl=Bl.next=e),rr=!0,Mc||(Mc=!0,iy())}function Vi(e,t){if(!Dc&&rr){Dc=!0;do for(var a=!1,n=sr;n!==null;){if(e!==0){var r=n.pendingLanes;if(r===0)var c=0;else{var m=n.suspendedLanes,g=n.pingedLanes;c=(1<<31-Zt(42|e)+1)-1,c&=r&~(m&~g),c=c&201326741?c&201326741|1:c?c|2:0}c!==0&&(a=!0,vm(n,c))}else c=ke,c=ds(n,n===We?c:0,n.cancelPendingCommit!==null||n.timeoutHandle!==-1),(c&3)===0||ri(n,c)||(a=!0,vm(n,c));n=n.next}while(a);Dc=!1}}function ly(){hm()}function hm(){rr=Mc=!1;var e=0;pn!==0&&hy()&&(e=pn);for(var t=Bt(),a=null,n=sr;n!==null;){var r=n.next,c=gm(n,t);c===0?(n.next=null,a===null?sr=r:a.next=r,r===null&&(Bl=a)):(a=n,(e!==0||(c&3)!==0)&&(rr=!0)),n=r}pt!==0&&pt!==5||Vi(e),pn!==0&&(pn=0)}function gm(e,t){for(var a=e.suspendedLanes,n=e.pingedLanes,r=e.expirationTimes,c=e.pendingLanes&-62914561;0<c;){var m=31-Zt(c),g=1<<m,S=r[m];S===-1?((g&a)===0||(g&n)!==0)&&(r[m]=jp(g,t)):S<=t&&(e.expiredLanes|=g),c&=~g}if(t=We,a=ke,a=ds(e,e===t?a:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),n=e.callbackNode,a===0||e===t&&(qe===2||qe===9)||e.cancelPendingCommit!==null)return n!==null&&n!==null&&wt(n),e.callbackNode=null,e.callbackPriority=0;if((a&3)===0||ri(e,a)){if(t=a&-a,t===e.callbackPriority)return t;switch(n!==null&&wt(n),$r(a)){case 2:case 8:a=id;break;case 32:a=rs;break;case 268435456:a=sd;break;default:a=rs}return n=pm.bind(null,e),a=_a(a,n),e.callbackPriority=t,e.callbackNode=a,t}return n!==null&&n!==null&&wt(n),e.callbackPriority=2,e.callbackNode=null,2}function pm(e,t){if(pt!==0&&pt!==5)return e.callbackNode=null,e.callbackPriority=0,null;var a=e.callbackNode;if(ir()&&e.callbackNode!==a)return null;var n=ke;return n=ds(e,e===We?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),n===0?null:(W_(e,n,t),gm(e,Bt()),e.callbackNode!=null&&e.callbackNode===a?pm.bind(null,e):null)}function vm(e,t){if(ir())return null;W_(e,t,!0)}function iy(){py(function(){(Ye&6)!==0?_a(ld,ly):hm()})}function kc(){if(pn===0){var e=Rl;e===0&&(e=us,us<<=1,(us&261888)===0&&(us=256)),pn=e}return pn}function ym(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:hs(""+e)}function bm(e,t){var a=t.ownerDocument.createElement("input");return a.name=t.name,a.value=t.value,e.id&&a.setAttribute("form",e.id),t.parentNode.insertBefore(a,t),e=new FormData(e),a.parentNode.removeChild(a),e}function sy(e,t,a,n,r){if(t==="submit"&&a&&a.stateNode===r){var c=ym((r[Mt]||null).action),m=n.submitter;m&&(t=(t=m[Mt]||null)?ym(t.formAction):m.getAttribute("formAction"),t!==null&&(c=t,m=null));var g=new ys("action","action",null,n,r);e.push({event:g,listeners:[{instance:null,listener:function(){if(n.defaultPrevented){if(pn!==0){var S=m?bm(r,m):new FormData(r);ac(a,{pending:!0,data:S,method:r.method,action:c},null,S)}}else typeof c=="function"&&(g.preventDefault(),S=m?bm(r,m):new FormData(r),ac(a,{pending:!0,data:S,method:r.method,action:c},c,S))},currentTarget:r}]})}}for(var zc=0;zc<yu.length;zc++){var Uc=yu[zc],ry=Uc.toLowerCase(),uy=Uc[0].toUpperCase()+Uc.slice(1);ma(ry,"on"+uy)}ma($d,"onAnimationEnd"),ma(Jd,"onAnimationIteration"),ma(Wd,"onAnimationStart"),ma("dblclick","onDoubleClick"),ma("focusin","onFocus"),ma("focusout","onBlur"),ma(Ev,"onTransitionRun"),ma(Av,"onTransitionStart"),ma(Rv,"onTransitionCancel"),ma(Pd,"onTransitionEnd"),fl("onMouseEnter",["mouseout","mouseover"]),fl("onMouseLeave",["mouseout","mouseover"]),fl("onPointerEnter",["pointerout","pointerover"]),fl("onPointerLeave",["pointerout","pointerover"]),On("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),On("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),On("onBeforeInput",["compositionend","keypress","textInput","paste"]),On("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),On("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),On("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Zi="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),cy=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Zi));function xm(e,t){t=(t&4)!==0;for(var a=0;a<e.length;a++){var n=e[a],r=n.event;n=n.listeners;e:{var c=void 0;if(t)for(var m=n.length-1;0<=m;m--){var g=n[m],S=g.instance,O=g.currentTarget;if(g=g.listener,S!==c&&r.isPropagationStopped())break e;c=g,r.currentTarget=O;try{c(r)}catch(G){Ss(G)}r.currentTarget=null,c=S}else for(m=0;m<n.length;m++){if(g=n[m],S=g.instance,O=g.currentTarget,g=g.listener,S!==c&&r.isPropagationStopped())break e;c=g,r.currentTarget=O;try{c(r)}catch(G){Ss(G)}r.currentTarget=null,c=S}}}}function De(e,t){var a=t[Jr];a===void 0&&(a=t[Jr]=new Set);var n=e+"__bubble";a.has(n)||(Sm(t,e,2,!1),a.add(n))}function Hc(e,t,a){var n=0;t&&(n|=4),Sm(a,e,n,t)}var ur="_reactListening"+Math.random().toString(36).slice(2);function Gc(e){if(!e[ur]){e[ur]=!0,md.forEach(function(a){a!=="selectionchange"&&(cy.has(a)||Hc(a,!1,e),Hc(a,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[ur]||(t[ur]=!0,Hc("selectionchange",!1,t))}}function Sm(e,t,a,n){switch(Jm(t)){case 2:var r=zy;break;case 8:r=Uy;break;default:r=to}a=r.bind(null,t,a,e),r=void 0,!su||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(r=!0),n?r!==void 0?e.addEventListener(t,a,{capture:!0,passive:r}):e.addEventListener(t,a,!0):r!==void 0?e.addEventListener(t,a,{passive:r}):e.addEventListener(t,a,!1)}function Bc(e,t,a,n,r){var c=n;if((t&1)===0&&(t&2)===0&&n!==null)e:for(;;){if(n===null)return;var m=n.tag;if(m===3||m===4){var g=n.stateNode.containerInfo;if(g===r)break;if(m===4)for(m=n.return;m!==null;){var S=m.tag;if((S===3||S===4)&&m.stateNode.containerInfo===r)return;m=m.return}for(;g!==null;){if(m=cl(g),m===null)return;if(S=m.tag,S===5||S===6||S===26||S===27){n=c=m;continue e}g=g.parentNode}}n=n.return}Rd(function(){var O=c,G=lu(a),Y=[];e:{var M=ef.get(e);if(M!==void 0){var k=ys,ue=e;switch(e){case"keypress":if(ps(a)===0)break e;case"keydown":case"keyup":k=av;break;case"focusin":ue="focus",k=ou;break;case"focusout":ue="blur",k=ou;break;case"beforeblur":case"afterblur":k=ou;break;case"click":if(a.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":k=wd;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":k=Kp;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":k=iv;break;case $d:case Jd:case Wd:k=Fp;break;case Pd:k=rv;break;case"scroll":case"scrollend":k=Vp;break;case"wheel":k=cv;break;case"copy":case"cut":case"paste":k=Qp;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":k=jd;break;case"toggle":case"beforetoggle":k=dv}var be=(t&4)!==0,Je=!be&&(e==="scroll"||e==="scrollend"),C=be?M!==null?M+"Capture":null:M;be=[];for(var A=O,j;A!==null;){var V=A;if(j=V.stateNode,V=V.tag,V!==5&&V!==26&&V!==27||j===null||C===null||(V=di(A,C),V!=null&&be.push(Ki(A,V,j))),Je)break;A=A.return}0<be.length&&(M=new k(M,ue,null,a,G),Y.push({event:M,listeners:be}))}}if((t&7)===0){e:{if(M=e==="mouseover"||e==="pointerover",k=e==="mouseout"||e==="pointerout",M&&a!==nu&&(ue=a.relatedTarget||a.fromElement)&&(cl(ue)||ue[ul]))break e;if((k||M)&&(M=G.window===G?G:(M=G.ownerDocument)?M.defaultView||M.parentWindow:window,k?(ue=a.relatedTarget||a.toElement,k=O,ue=ue?cl(ue):null,ue!==null&&(Je=f(ue),be=ue.tag,ue!==Je||be!==5&&be!==27&&be!==6)&&(ue=null)):(k=null,ue=O),k!==ue)){if(be=wd,V="onMouseLeave",C="onMouseEnter",A="mouse",(e==="pointerout"||e==="pointerover")&&(be=jd,V="onPointerLeave",C="onPointerEnter",A="pointer"),Je=k==null?M:oi(k),j=ue==null?M:oi(ue),M=new be(V,A+"leave",k,a,G),M.target=Je,M.relatedTarget=j,V=null,cl(G)===O&&(be=new be(C,A+"enter",ue,a,G),be.target=j,be.relatedTarget=Je,V=be),Je=V,k&&ue)t:{for(be=oy,C=k,A=ue,j=0,V=C;V;V=be(V))j++;V=0;for(var pe=A;pe;pe=be(pe))V++;for(;0<j-V;)C=be(C),j--;for(;0<V-j;)A=be(A),V--;for(;j--;){if(C===A||A!==null&&C===A.alternate){be=C;break t}C=be(C),A=be(A)}be=null}else be=null;k!==null&&Tm(Y,M,k,be,!1),ue!==null&&Je!==null&&Tm(Y,Je,ue,be,!0)}}e:{if(M=O?oi(O):window,k=M.nodeName&&M.nodeName.toLowerCase(),k==="select"||k==="input"&&M.type==="file")var Ze=Hd;else if(zd(M))if(Gd)Ze=xv;else{Ze=yv;var _e=vv}else k=M.nodeName,!k||k.toLowerCase()!=="input"||M.type!=="checkbox"&&M.type!=="radio"?O&&au(O.elementType)&&(Ze=Hd):Ze=bv;if(Ze&&(Ze=Ze(e,O))){Ud(Y,Ze,a,G);break e}_e&&_e(e,M,O),e==="focusout"&&O&&M.type==="number"&&O.memoizedProps.value!=null&&tu(M,"number",M.value)}switch(_e=O?oi(O):window,e){case"focusin":(zd(_e)||_e.contentEditable==="true")&&(vl=_e,gu=O,yi=null);break;case"focusout":yi=gu=vl=null;break;case"mousedown":pu=!0;break;case"contextmenu":case"mouseup":case"dragend":pu=!1,Xd(Y,a,G);break;case"selectionchange":if(Tv)break;case"keydown":case"keyup":Xd(Y,a,G)}var Ce;if(fu)e:{switch(e){case"compositionstart":var ze="onCompositionStart";break e;case"compositionend":ze="onCompositionEnd";break e;case"compositionupdate":ze="onCompositionUpdate";break e}ze=void 0}else pl?Dd(e,a)&&(ze="onCompositionEnd"):e==="keydown"&&a.keyCode===229&&(ze="onCompositionStart");ze&&(Od&&a.locale!=="ko"&&(pl||ze!=="onCompositionStart"?ze==="onCompositionEnd"&&pl&&(Ce=Nd()):(en=G,ru="value"in en?en.value:en.textContent,pl=!0)),_e=cr(O,ze),0<_e.length&&(ze=new Ld(ze,e,null,a,G),Y.push({event:ze,listeners:_e}),Ce?ze.data=Ce:(Ce=kd(a),Ce!==null&&(ze.data=Ce)))),(Ce=_v?mv(e,a):hv(e,a))&&(ze=cr(O,"onBeforeInput"),0<ze.length&&(_e=new Ld("onBeforeInput","beforeinput",null,a,G),Y.push({event:_e,listeners:ze}),_e.data=Ce)),sy(Y,e,O,a,G)}xm(Y,t)})}function Ki(e,t,a){return{instance:e,listener:t,currentTarget:a}}function cr(e,t){for(var a=t+"Capture",n=[];e!==null;){var r=e,c=r.stateNode;if(r=r.tag,r!==5&&r!==26&&r!==27||c===null||(r=di(e,a),r!=null&&n.unshift(Ki(e,r,c)),r=di(e,t),r!=null&&n.push(Ki(e,r,c))),e.tag===3)return n;e=e.return}return[]}function oy(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function Tm(e,t,a,n,r){for(var c=t._reactName,m=[];a!==null&&a!==n;){var g=a,S=g.alternate,O=g.stateNode;if(g=g.tag,S!==null&&S===n)break;g!==5&&g!==26&&g!==27||O===null||(S=O,r?(O=di(a,c),O!=null&&m.unshift(Ki(a,O,S))):r||(O=di(a,c),O!=null&&m.push(Ki(a,O,S)))),a=a.return}m.length!==0&&e.push({event:t,listeners:m})}var dy=/\r\n?/g,fy=/\u0000|\uFFFD/g;function Em(e){return(typeof e=="string"?e:""+e).replace(dy,`
`).replace(fy,"")}function Am(e,t){return t=Em(t),Em(e)===t}function $e(e,t,a,n,r,c){switch(a){case"children":typeof n=="string"?t==="body"||t==="textarea"&&n===""||ml(e,n):(typeof n=="number"||typeof n=="bigint")&&t!=="body"&&ml(e,""+n);break;case"className":_s(e,"class",n);break;case"tabIndex":_s(e,"tabindex",n);break;case"dir":case"role":case"viewBox":case"width":case"height":_s(e,a,n);break;case"style":Ed(e,n,c);break;case"data":if(t!=="object"){_s(e,"data",n);break}case"src":case"href":if(n===""&&(t!=="a"||a!=="href")){e.removeAttribute(a);break}if(n==null||typeof n=="function"||typeof n=="symbol"||typeof n=="boolean"){e.removeAttribute(a);break}n=hs(""+n),e.setAttribute(a,n);break;case"action":case"formAction":if(typeof n=="function"){e.setAttribute(a,"javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");break}else typeof c=="function"&&(a==="formAction"?(t!=="input"&&$e(e,t,"name",r.name,r,null),$e(e,t,"formEncType",r.formEncType,r,null),$e(e,t,"formMethod",r.formMethod,r,null),$e(e,t,"formTarget",r.formTarget,r,null)):($e(e,t,"encType",r.encType,r,null),$e(e,t,"method",r.method,r,null),$e(e,t,"target",r.target,r,null)));if(n==null||typeof n=="symbol"||typeof n=="boolean"){e.removeAttribute(a);break}n=hs(""+n),e.setAttribute(a,n);break;case"onClick":n!=null&&(e.onclick=Na);break;case"onScroll":n!=null&&De("scroll",e);break;case"onScrollEnd":n!=null&&De("scrollend",e);break;case"dangerouslySetInnerHTML":if(n!=null){if(typeof n!="object"||!("__html"in n))throw Error(u(61));if(a=n.__html,a!=null){if(r.children!=null)throw Error(u(60));e.innerHTML=a}}break;case"multiple":e.multiple=n&&typeof n!="function"&&typeof n!="symbol";break;case"muted":e.muted=n&&typeof n!="function"&&typeof n!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(n==null||typeof n=="function"||typeof n=="boolean"||typeof n=="symbol"){e.removeAttribute("xlink:href");break}a=hs(""+n),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",a);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":n!=null&&typeof n!="function"&&typeof n!="symbol"?e.setAttribute(a,""+n):e.removeAttribute(a);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":n&&typeof n!="function"&&typeof n!="symbol"?e.setAttribute(a,""):e.removeAttribute(a);break;case"capture":case"download":n===!0?e.setAttribute(a,""):n!==!1&&n!=null&&typeof n!="function"&&typeof n!="symbol"?e.setAttribute(a,n):e.removeAttribute(a);break;case"cols":case"rows":case"size":case"span":n!=null&&typeof n!="function"&&typeof n!="symbol"&&!isNaN(n)&&1<=n?e.setAttribute(a,n):e.removeAttribute(a);break;case"rowSpan":case"start":n==null||typeof n=="function"||typeof n=="symbol"||isNaN(n)?e.removeAttribute(a):e.setAttribute(a,n);break;case"popover":De("beforetoggle",e),De("toggle",e),fs(e,"popover",n);break;case"xlinkActuate":Ra(e,"http://www.w3.org/1999/xlink","xlink:actuate",n);break;case"xlinkArcrole":Ra(e,"http://www.w3.org/1999/xlink","xlink:arcrole",n);break;case"xlinkRole":Ra(e,"http://www.w3.org/1999/xlink","xlink:role",n);break;case"xlinkShow":Ra(e,"http://www.w3.org/1999/xlink","xlink:show",n);break;case"xlinkTitle":Ra(e,"http://www.w3.org/1999/xlink","xlink:title",n);break;case"xlinkType":Ra(e,"http://www.w3.org/1999/xlink","xlink:type",n);break;case"xmlBase":Ra(e,"http://www.w3.org/XML/1998/namespace","xml:base",n);break;case"xmlLang":Ra(e,"http://www.w3.org/XML/1998/namespace","xml:lang",n);break;case"xmlSpace":Ra(e,"http://www.w3.org/XML/1998/namespace","xml:space",n);break;case"is":fs(e,"is",n);break;case"innerText":case"textContent":break;default:(!(2<a.length)||a[0]!=="o"&&a[0]!=="O"||a[1]!=="n"&&a[1]!=="N")&&(a=Gp.get(a)||a,fs(e,a,n))}}function Vc(e,t,a,n,r,c){switch(a){case"style":Ed(e,n,c);break;case"dangerouslySetInnerHTML":if(n!=null){if(typeof n!="object"||!("__html"in n))throw Error(u(61));if(a=n.__html,a!=null){if(r.children!=null)throw Error(u(60));e.innerHTML=a}}break;case"children":typeof n=="string"?ml(e,n):(typeof n=="number"||typeof n=="bigint")&&ml(e,""+n);break;case"onScroll":n!=null&&De("scroll",e);break;case"onScrollEnd":n!=null&&De("scrollend",e);break;case"onClick":n!=null&&(e.onclick=Na);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!hd.hasOwnProperty(a))e:{if(a[0]==="o"&&a[1]==="n"&&(r=a.endsWith("Capture"),t=a.slice(2,r?a.length-7:void 0),c=e[Mt]||null,c=c!=null?c[a]:null,typeof c=="function"&&e.removeEventListener(t,c,r),typeof n=="function")){typeof c!="function"&&c!==null&&(a in e?e[a]=null:e.hasAttribute(a)&&e.removeAttribute(a)),e.addEventListener(t,n,r);break e}a in e?e[a]=n:n===!0?e.setAttribute(a,""):fs(e,a,n)}}}function Nt(e,t,a){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":De("error",e),De("load",e);var n=!1,r=!1,c;for(c in a)if(a.hasOwnProperty(c)){var m=a[c];if(m!=null)switch(c){case"src":n=!0;break;case"srcSet":r=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:$e(e,t,c,m,a,null)}}r&&$e(e,t,"srcSet",a.srcSet,a,null),n&&$e(e,t,"src",a.src,a,null);return;case"input":De("invalid",e);var g=c=m=r=null,S=null,O=null;for(n in a)if(a.hasOwnProperty(n)){var G=a[n];if(G!=null)switch(n){case"name":r=G;break;case"type":m=G;break;case"checked":S=G;break;case"defaultChecked":O=G;break;case"value":c=G;break;case"defaultValue":g=G;break;case"children":case"dangerouslySetInnerHTML":if(G!=null)throw Error(u(137,t));break;default:$e(e,t,n,G,a,null)}}bd(e,c,g,S,O,m,r,!1);return;case"select":De("invalid",e),n=m=c=null;for(r in a)if(a.hasOwnProperty(r)&&(g=a[r],g!=null))switch(r){case"value":c=g;break;case"defaultValue":m=g;break;case"multiple":n=g;default:$e(e,t,r,g,a,null)}t=c,a=m,e.multiple=!!n,t!=null?_l(e,!!n,t,!1):a!=null&&_l(e,!!n,a,!0);return;case"textarea":De("invalid",e),c=r=n=null;for(m in a)if(a.hasOwnProperty(m)&&(g=a[m],g!=null))switch(m){case"value":n=g;break;case"defaultValue":r=g;break;case"children":c=g;break;case"dangerouslySetInnerHTML":if(g!=null)throw Error(u(91));break;default:$e(e,t,m,g,a,null)}Sd(e,n,r,c);return;case"option":for(S in a)a.hasOwnProperty(S)&&(n=a[S],n!=null)&&(S==="selected"?e.selected=n&&typeof n!="function"&&typeof n!="symbol":$e(e,t,S,n,a,null));return;case"dialog":De("beforetoggle",e),De("toggle",e),De("cancel",e),De("close",e);break;case"iframe":case"object":De("load",e);break;case"video":case"audio":for(n=0;n<Zi.length;n++)De(Zi[n],e);break;case"image":De("error",e),De("load",e);break;case"details":De("toggle",e);break;case"embed":case"source":case"link":De("error",e),De("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(O in a)if(a.hasOwnProperty(O)&&(n=a[O],n!=null))switch(O){case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:$e(e,t,O,n,a,null)}return;default:if(au(t)){for(G in a)a.hasOwnProperty(G)&&(n=a[G],n!==void 0&&Vc(e,t,G,n,a,void 0));return}}for(g in a)a.hasOwnProperty(g)&&(n=a[g],n!=null&&$e(e,t,g,n,a,null))}function _y(e,t,a,n){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var r=null,c=null,m=null,g=null,S=null,O=null,G=null;for(k in a){var Y=a[k];if(a.hasOwnProperty(k)&&Y!=null)switch(k){case"checked":break;case"value":break;case"defaultValue":S=Y;default:n.hasOwnProperty(k)||$e(e,t,k,null,n,Y)}}for(var M in n){var k=n[M];if(Y=a[M],n.hasOwnProperty(M)&&(k!=null||Y!=null))switch(M){case"type":c=k;break;case"name":r=k;break;case"checked":O=k;break;case"defaultChecked":G=k;break;case"value":m=k;break;case"defaultValue":g=k;break;case"children":case"dangerouslySetInnerHTML":if(k!=null)throw Error(u(137,t));break;default:k!==Y&&$e(e,t,M,k,n,Y)}}eu(e,m,g,S,O,G,c,r);return;case"select":k=m=g=M=null;for(c in a)if(S=a[c],a.hasOwnProperty(c)&&S!=null)switch(c){case"value":break;case"multiple":k=S;default:n.hasOwnProperty(c)||$e(e,t,c,null,n,S)}for(r in n)if(c=n[r],S=a[r],n.hasOwnProperty(r)&&(c!=null||S!=null))switch(r){case"value":M=c;break;case"defaultValue":g=c;break;case"multiple":m=c;default:c!==S&&$e(e,t,r,c,n,S)}t=g,a=m,n=k,M!=null?_l(e,!!a,M,!1):!!n!=!!a&&(t!=null?_l(e,!!a,t,!0):_l(e,!!a,a?[]:"",!1));return;case"textarea":k=M=null;for(g in a)if(r=a[g],a.hasOwnProperty(g)&&r!=null&&!n.hasOwnProperty(g))switch(g){case"value":break;case"children":break;default:$e(e,t,g,null,n,r)}for(m in n)if(r=n[m],c=a[m],n.hasOwnProperty(m)&&(r!=null||c!=null))switch(m){case"value":M=r;break;case"defaultValue":k=r;break;case"children":break;case"dangerouslySetInnerHTML":if(r!=null)throw Error(u(91));break;default:r!==c&&$e(e,t,m,r,n,c)}xd(e,M,k);return;case"option":for(var ue in a)M=a[ue],a.hasOwnProperty(ue)&&M!=null&&!n.hasOwnProperty(ue)&&(ue==="selected"?e.selected=!1:$e(e,t,ue,null,n,M));for(S in n)M=n[S],k=a[S],n.hasOwnProperty(S)&&M!==k&&(M!=null||k!=null)&&(S==="selected"?e.selected=M&&typeof M!="function"&&typeof M!="symbol":$e(e,t,S,M,n,k));return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var be in a)M=a[be],a.hasOwnProperty(be)&&M!=null&&!n.hasOwnProperty(be)&&$e(e,t,be,null,n,M);for(O in n)if(M=n[O],k=a[O],n.hasOwnProperty(O)&&M!==k&&(M!=null||k!=null))switch(O){case"children":case"dangerouslySetInnerHTML":if(M!=null)throw Error(u(137,t));break;default:$e(e,t,O,M,n,k)}return;default:if(au(t)){for(var Je in a)M=a[Je],a.hasOwnProperty(Je)&&M!==void 0&&!n.hasOwnProperty(Je)&&Vc(e,t,Je,void 0,n,M);for(G in n)M=n[G],k=a[G],!n.hasOwnProperty(G)||M===k||M===void 0&&k===void 0||Vc(e,t,G,M,n,k);return}}for(var C in a)M=a[C],a.hasOwnProperty(C)&&M!=null&&!n.hasOwnProperty(C)&&$e(e,t,C,null,n,M);for(Y in n)M=n[Y],k=a[Y],!n.hasOwnProperty(Y)||M===k||M==null&&k==null||$e(e,t,Y,M,n,k)}function Rm(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function my(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,a=performance.getEntriesByType("resource"),n=0;n<a.length;n++){var r=a[n],c=r.transferSize,m=r.initiatorType,g=r.duration;if(c&&g&&Rm(m)){for(m=0,g=r.responseEnd,n+=1;n<a.length;n++){var S=a[n],O=S.startTime;if(O>g)break;var G=S.transferSize,Y=S.initiatorType;G&&Rm(Y)&&(S=S.responseEnd,m+=G*(S<g?1:(g-O)/(S-O)))}if(--n,t+=8*(c+m)/(r.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var Zc=null,Kc=null;function or(e){return e.nodeType===9?e:e.ownerDocument}function Nm(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function Cm(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function Yc(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var qc=null;function hy(){var e=window.event;return e&&e.type==="popstate"?e===qc?!1:(qc=e,!0):(qc=null,!1)}var wm=typeof setTimeout=="function"?setTimeout:void 0,gy=typeof clearTimeout=="function"?clearTimeout:void 0,Lm=typeof Promise=="function"?Promise:void 0,py=typeof queueMicrotask=="function"?queueMicrotask:typeof Lm<"u"?function(e){return Lm.resolve(null).then(e).catch(vy)}:wm;function vy(e){setTimeout(function(){throw e})}function vn(e){return e==="head"}function jm(e,t){var a=t,n=0;do{var r=a.nextSibling;if(e.removeChild(a),r&&r.nodeType===8)if(a=r.data,a==="/$"||a==="/&"){if(n===0){e.removeChild(r),Yl(t);return}n--}else if(a==="$"||a==="$?"||a==="$~"||a==="$!"||a==="&")n++;else if(a==="html")Yi(e.ownerDocument.documentElement);else if(a==="head"){a=e.ownerDocument.head,Yi(a);for(var c=a.firstChild;c;){var m=c.nextSibling,g=c.nodeName;c[ci]||g==="SCRIPT"||g==="STYLE"||g==="LINK"&&c.rel.toLowerCase()==="stylesheet"||a.removeChild(c),c=m}}else a==="body"&&Yi(e.ownerDocument.body);a=r}while(a);Yl(t)}function Om(e,t){var a=e;e=0;do{var n=a.nextSibling;if(a.nodeType===1?t?(a._stashedDisplay=a.style.display,a.style.display="none"):(a.style.display=a._stashedDisplay||"",a.getAttribute("style")===""&&a.removeAttribute("style")):a.nodeType===3&&(t?(a._stashedText=a.nodeValue,a.nodeValue=""):a.nodeValue=a._stashedText||""),n&&n.nodeType===8)if(a=n.data,a==="/$"){if(e===0)break;e--}else a!=="$"&&a!=="$?"&&a!=="$~"&&a!=="$!"||e++;a=n}while(a)}function Fc(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var a=t;switch(t=t.nextSibling,a.nodeName){case"HTML":case"HEAD":case"BODY":Fc(a),Wr(a);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(a.rel.toLowerCase()==="stylesheet")continue}e.removeChild(a)}}function yy(e,t,a,n){for(;e.nodeType===1;){var r=a;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!n&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(n){if(!e[ci])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(c=e.getAttribute("rel"),c==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(c!==r.rel||e.getAttribute("href")!==(r.href==null||r.href===""?null:r.href)||e.getAttribute("crossorigin")!==(r.crossOrigin==null?null:r.crossOrigin)||e.getAttribute("title")!==(r.title==null?null:r.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(c=e.getAttribute("src"),(c!==(r.src==null?null:r.src)||e.getAttribute("type")!==(r.type==null?null:r.type)||e.getAttribute("crossorigin")!==(r.crossOrigin==null?null:r.crossOrigin))&&c&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var c=r.name==null?null:""+r.name;if(r.type==="hidden"&&e.getAttribute("name")===c)return e}else return e;if(e=ca(e.nextSibling),e===null)break}return null}function by(e,t,a){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!a||(e=ca(e.nextSibling),e===null))return null;return e}function Im(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=ca(e.nextSibling),e===null))return null;return e}function Xc(e){return e.data==="$?"||e.data==="$~"}function Qc(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function xy(e,t){var a=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||a.readyState!=="loading")t();else{var n=function(){t(),a.removeEventListener("DOMContentLoaded",n)};a.addEventListener("DOMContentLoaded",n),e._reactRetry=n}}function ca(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var $c=null;function Mm(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var a=e.data;if(a==="/$"||a==="/&"){if(t===0)return ca(e.nextSibling);t--}else a!=="$"&&a!=="$!"&&a!=="$?"&&a!=="$~"&&a!=="&"||t++}e=e.nextSibling}return null}function Dm(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var a=e.data;if(a==="$"||a==="$!"||a==="$?"||a==="$~"||a==="&"){if(t===0)return e;t--}else a!=="/$"&&a!=="/&"||t++}e=e.previousSibling}return null}function km(e,t,a){switch(t=or(a),e){case"html":if(e=t.documentElement,!e)throw Error(u(452));return e;case"head":if(e=t.head,!e)throw Error(u(453));return e;case"body":if(e=t.body,!e)throw Error(u(454));return e;default:throw Error(u(451))}}function Yi(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);Wr(e)}var oa=new Map,zm=new Set;function dr(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var Za=B.d;B.d={f:Sy,r:Ty,D:Ey,C:Ay,L:Ry,m:Ny,X:wy,S:Cy,M:Ly};function Sy(){var e=Za.f(),t=ar();return e||t}function Ty(e){var t=ol(e);t!==null&&t.tag===5&&t.type==="form"?e_(t):Za.r(e)}var Vl=typeof document>"u"?null:document;function Um(e,t,a){var n=Vl;if(n&&typeof t=="string"&&t){var r=aa(t);r='link[rel="'+e+'"][href="'+r+'"]',typeof a=="string"&&(r+='[crossorigin="'+a+'"]'),zm.has(r)||(zm.add(r),e={rel:e,crossOrigin:a,href:t},n.querySelector(r)===null&&(t=n.createElement("link"),Nt(t,"link",e),bt(t),n.head.appendChild(t)))}}function Ey(e){Za.D(e),Um("dns-prefetch",e,null)}function Ay(e,t){Za.C(e,t),Um("preconnect",e,t)}function Ry(e,t,a){Za.L(e,t,a);var n=Vl;if(n&&e&&t){var r='link[rel="preload"][as="'+aa(t)+'"]';t==="image"&&a&&a.imageSrcSet?(r+='[imagesrcset="'+aa(a.imageSrcSet)+'"]',typeof a.imageSizes=="string"&&(r+='[imagesizes="'+aa(a.imageSizes)+'"]')):r+='[href="'+aa(e)+'"]';var c=r;switch(t){case"style":c=Zl(e);break;case"script":c=Kl(e)}oa.has(c)||(e=T({rel:"preload",href:t==="image"&&a&&a.imageSrcSet?void 0:e,as:t},a),oa.set(c,e),n.querySelector(r)!==null||t==="style"&&n.querySelector(qi(c))||t==="script"&&n.querySelector(Fi(c))||(t=n.createElement("link"),Nt(t,"link",e),bt(t),n.head.appendChild(t)))}}function Ny(e,t){Za.m(e,t);var a=Vl;if(a&&e){var n=t&&typeof t.as=="string"?t.as:"script",r='link[rel="modulepreload"][as="'+aa(n)+'"][href="'+aa(e)+'"]',c=r;switch(n){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":c=Kl(e)}if(!oa.has(c)&&(e=T({rel:"modulepreload",href:e},t),oa.set(c,e),a.querySelector(r)===null)){switch(n){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(a.querySelector(Fi(c)))return}n=a.createElement("link"),Nt(n,"link",e),bt(n),a.head.appendChild(n)}}}function Cy(e,t,a){Za.S(e,t,a);var n=Vl;if(n&&e){var r=dl(n).hoistableStyles,c=Zl(e);t=t||"default";var m=r.get(c);if(!m){var g={loading:0,preload:null};if(m=n.querySelector(qi(c)))g.loading=5;else{e=T({rel:"stylesheet",href:e,"data-precedence":t},a),(a=oa.get(c))&&Jc(e,a);var S=m=n.createElement("link");bt(S),Nt(S,"link",e),S._p=new Promise(function(O,G){S.onload=O,S.onerror=G}),S.addEventListener("load",function(){g.loading|=1}),S.addEventListener("error",function(){g.loading|=2}),g.loading|=4,fr(m,t,n)}m={type:"stylesheet",instance:m,count:1,state:g},r.set(c,m)}}}function wy(e,t){Za.X(e,t);var a=Vl;if(a&&e){var n=dl(a).hoistableScripts,r=Kl(e),c=n.get(r);c||(c=a.querySelector(Fi(r)),c||(e=T({src:e,async:!0},t),(t=oa.get(r))&&Wc(e,t),c=a.createElement("script"),bt(c),Nt(c,"link",e),a.head.appendChild(c)),c={type:"script",instance:c,count:1,state:null},n.set(r,c))}}function Ly(e,t){Za.M(e,t);var a=Vl;if(a&&e){var n=dl(a).hoistableScripts,r=Kl(e),c=n.get(r);c||(c=a.querySelector(Fi(r)),c||(e=T({src:e,async:!0,type:"module"},t),(t=oa.get(r))&&Wc(e,t),c=a.createElement("script"),bt(c),Nt(c,"link",e),a.head.appendChild(c)),c={type:"script",instance:c,count:1,state:null},n.set(r,c))}}function Hm(e,t,a,n){var r=(r=X.current)?dr(r):null;if(!r)throw Error(u(446));switch(e){case"meta":case"title":return null;case"style":return typeof a.precedence=="string"&&typeof a.href=="string"?(t=Zl(a.href),a=dl(r).hoistableStyles,n=a.get(t),n||(n={type:"style",instance:null,count:0,state:null},a.set(t,n)),n):{type:"void",instance:null,count:0,state:null};case"link":if(a.rel==="stylesheet"&&typeof a.href=="string"&&typeof a.precedence=="string"){e=Zl(a.href);var c=dl(r).hoistableStyles,m=c.get(e);if(m||(r=r.ownerDocument||r,m={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},c.set(e,m),(c=r.querySelector(qi(e)))&&!c._p&&(m.instance=c,m.state.loading=5),oa.has(e)||(a={rel:"preload",as:"style",href:a.href,crossOrigin:a.crossOrigin,integrity:a.integrity,media:a.media,hrefLang:a.hrefLang,referrerPolicy:a.referrerPolicy},oa.set(e,a),c||jy(r,e,a,m.state))),t&&n===null)throw Error(u(528,""));return m}if(t&&n!==null)throw Error(u(529,""));return null;case"script":return t=a.async,a=a.src,typeof a=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=Kl(a),a=dl(r).hoistableScripts,n=a.get(t),n||(n={type:"script",instance:null,count:0,state:null},a.set(t,n)),n):{type:"void",instance:null,count:0,state:null};default:throw Error(u(444,e))}}function Zl(e){return'href="'+aa(e)+'"'}function qi(e){return'link[rel="stylesheet"]['+e+"]"}function Gm(e){return T({},e,{"data-precedence":e.precedence,precedence:null})}function jy(e,t,a,n){e.querySelector('link[rel="preload"][as="style"]['+t+"]")?n.loading=1:(t=e.createElement("link"),n.preload=t,t.addEventListener("load",function(){return n.loading|=1}),t.addEventListener("error",function(){return n.loading|=2}),Nt(t,"link",a),bt(t),e.head.appendChild(t))}function Kl(e){return'[src="'+aa(e)+'"]'}function Fi(e){return"script[async]"+e}function Bm(e,t,a){if(t.count++,t.instance===null)switch(t.type){case"style":var n=e.querySelector('style[data-href~="'+aa(a.href)+'"]');if(n)return t.instance=n,bt(n),n;var r=T({},a,{"data-href":a.href,"data-precedence":a.precedence,href:null,precedence:null});return n=(e.ownerDocument||e).createElement("style"),bt(n),Nt(n,"style",r),fr(n,a.precedence,e),t.instance=n;case"stylesheet":r=Zl(a.href);var c=e.querySelector(qi(r));if(c)return t.state.loading|=4,t.instance=c,bt(c),c;n=Gm(a),(r=oa.get(r))&&Jc(n,r),c=(e.ownerDocument||e).createElement("link"),bt(c);var m=c;return m._p=new Promise(function(g,S){m.onload=g,m.onerror=S}),Nt(c,"link",n),t.state.loading|=4,fr(c,a.precedence,e),t.instance=c;case"script":return c=Kl(a.src),(r=e.querySelector(Fi(c)))?(t.instance=r,bt(r),r):(n=a,(r=oa.get(c))&&(n=T({},a),Wc(n,r)),e=e.ownerDocument||e,r=e.createElement("script"),bt(r),Nt(r,"link",n),e.head.appendChild(r),t.instance=r);case"void":return null;default:throw Error(u(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(n=t.instance,t.state.loading|=4,fr(n,a.precedence,e));return t.instance}function fr(e,t,a){for(var n=a.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'),r=n.length?n[n.length-1]:null,c=r,m=0;m<n.length;m++){var g=n[m];if(g.dataset.precedence===t)c=g;else if(c!==r)break}c?c.parentNode.insertBefore(e,c.nextSibling):(t=a.nodeType===9?a.head:a,t.insertBefore(e,t.firstChild))}function Jc(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function Wc(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var _r=null;function Vm(e,t,a){if(_r===null){var n=new Map,r=_r=new Map;r.set(a,n)}else r=_r,n=r.get(a),n||(n=new Map,r.set(a,n));if(n.has(e))return n;for(n.set(e,null),a=a.getElementsByTagName(e),r=0;r<a.length;r++){var c=a[r];if(!(c[ci]||c[Tt]||e==="link"&&c.getAttribute("rel")==="stylesheet")&&c.namespaceURI!=="http://www.w3.org/2000/svg"){var m=c.getAttribute(t)||"";m=e+m;var g=n.get(m);g?g.push(c):n.set(m,[c])}}return n}function Zm(e,t,a){e=e.ownerDocument||e,e.head.insertBefore(a,t==="title"?e.querySelector("head > title"):null)}function Oy(e,t,a){if(a===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;return t.rel==="stylesheet"?(e=t.disabled,typeof t.precedence=="string"&&e==null):!0;case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function Km(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function Iy(e,t,a,n){if(a.type==="stylesheet"&&(typeof n.media!="string"||matchMedia(n.media).matches!==!1)&&(a.state.loading&4)===0){if(a.instance===null){var r=Zl(n.href),c=t.querySelector(qi(r));if(c){t=c._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=mr.bind(e),t.then(e,e)),a.state.loading|=4,a.instance=c,bt(c);return}c=t.ownerDocument||t,n=Gm(n),(r=oa.get(r))&&Jc(n,r),c=c.createElement("link"),bt(c);var m=c;m._p=new Promise(function(g,S){m.onload=g,m.onerror=S}),Nt(c,"link",n),a.instance=c}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(a,t),(t=a.state.preload)&&(a.state.loading&3)===0&&(e.count++,a=mr.bind(e),t.addEventListener("load",a),t.addEventListener("error",a))}}var Pc=0;function My(e,t){return e.stylesheets&&e.count===0&&gr(e,e.stylesheets),0<e.count||0<e.imgCount?function(a){var n=setTimeout(function(){if(e.stylesheets&&gr(e,e.stylesheets),e.unsuspend){var c=e.unsuspend;e.unsuspend=null,c()}},6e4+t);0<e.imgBytes&&Pc===0&&(Pc=62500*my());var r=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&gr(e,e.stylesheets),e.unsuspend)){var c=e.unsuspend;e.unsuspend=null,c()}},(e.imgBytes>Pc?50:800)+t);return e.unsuspend=a,function(){e.unsuspend=null,clearTimeout(n),clearTimeout(r)}}:null}function mr(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)gr(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var hr=null;function gr(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,hr=new Map,t.forEach(Dy,e),hr=null,mr.call(e))}function Dy(e,t){if(!(t.state.loading&4)){var a=hr.get(e);if(a)var n=a.get(null);else{a=new Map,hr.set(e,a);for(var r=e.querySelectorAll("link[data-precedence],style[data-precedence]"),c=0;c<r.length;c++){var m=r[c];(m.nodeName==="LINK"||m.getAttribute("media")!=="not all")&&(a.set(m.dataset.precedence,m),n=m)}n&&a.set(null,n)}r=t.instance,m=r.getAttribute("data-precedence"),c=a.get(m)||n,c===n&&a.set(null,r),a.set(m,r),this.count++,n=mr.bind(this),r.addEventListener("load",n),r.addEventListener("error",n),c?c.parentNode.insertBefore(r,c.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(r,e.firstChild)),t.state.loading|=4}}var Xi={$$typeof:ae,Provider:null,Consumer:null,_currentValue:Q,_currentValue2:Q,_threadCount:0};function ky(e,t,a,n,r,c,m,g,S){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=Xr(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Xr(0),this.hiddenUpdates=Xr(null),this.identifierPrefix=n,this.onUncaughtError=r,this.onCaughtError=c,this.onRecoverableError=m,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=S,this.incompleteTransitions=new Map}function Ym(e,t,a,n,r,c,m,g,S,O,G,Y){return e=new ky(e,t,a,m,S,O,G,Y,g),t=1,c===!0&&(t|=24),c=Yt(3,null,null,t),e.current=c,c.stateNode=e,t=Ou(),t.refCount++,e.pooledCache=t,t.refCount++,c.memoizedState={element:n,isDehydrated:a,cache:t},ku(c),e}function qm(e){return e?(e=xl,e):xl}function Fm(e,t,a,n,r,c){r=qm(r),n.context===null?n.context=r:n.pendingContext=r,n=rn(t),n.payload={element:a},c=c===void 0?null:c,c!==null&&(n.callback=c),a=un(e,n,t),a!==null&&(Gt(a,e,t),Ri(a,e,t))}function Xm(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var a=e.retryLane;e.retryLane=a!==0&&a<t?a:t}}function eo(e,t){Xm(e,t),(e=e.alternate)&&Xm(e,t)}function Qm(e){if(e.tag===13||e.tag===31){var t=kn(e,67108864);t!==null&&Gt(t,e,67108864),eo(e,67108864)}}function $m(e){if(e.tag===13||e.tag===31){var t=$t();t=Qr(t);var a=kn(e,t);a!==null&&Gt(a,e,t),eo(e,t)}}var pr=!0;function zy(e,t,a,n){var r=H.T;H.T=null;var c=B.p;try{B.p=2,to(e,t,a,n)}finally{B.p=c,H.T=r}}function Uy(e,t,a,n){var r=H.T;H.T=null;var c=B.p;try{B.p=8,to(e,t,a,n)}finally{B.p=c,H.T=r}}function to(e,t,a,n){if(pr){var r=ao(n);if(r===null)Bc(e,t,n,vr,a),Wm(e,n);else if(Gy(r,e,t,a,n))n.stopPropagation();else if(Wm(e,n),t&4&&-1<Hy.indexOf(e)){for(;r!==null;){var c=ol(r);if(c!==null)switch(c.tag){case 3:if(c=c.stateNode,c.current.memoizedState.isDehydrated){var m=jn(c.pendingLanes);if(m!==0){var g=c;for(g.pendingLanes|=2,g.entangledLanes|=2;m;){var S=1<<31-Zt(m);g.entanglements[1]|=S,m&=~S}xa(c),(Ye&6)===0&&(er=Bt()+500,Vi(0))}}break;case 31:case 13:g=kn(c,2),g!==null&&Gt(g,c,2),ar(),eo(c,2)}if(c=ao(n),c===null&&Bc(e,t,n,vr,a),c===r)break;r=c}r!==null&&n.stopPropagation()}else Bc(e,t,n,null,a)}}function ao(e){return e=lu(e),no(e)}var vr=null;function no(e){if(vr=null,e=cl(e),e!==null){var t=f(e);if(t===null)e=null;else{var a=t.tag;if(a===13){if(e=_(t),e!==null)return e;e=null}else if(a===31){if(e=h(t),e!==null)return e;e=null}else if(a===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return vr=e,null}function Jm(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(Ep()){case ld:return 2;case id:return 8;case rs:case Ap:return 32;case sd:return 268435456;default:return 32}default:return 32}}var lo=!1,yn=null,bn=null,xn=null,Qi=new Map,$i=new Map,Sn=[],Hy="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function Wm(e,t){switch(e){case"focusin":case"focusout":yn=null;break;case"dragenter":case"dragleave":bn=null;break;case"mouseover":case"mouseout":xn=null;break;case"pointerover":case"pointerout":Qi.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":$i.delete(t.pointerId)}}function Ji(e,t,a,n,r,c){return e===null||e.nativeEvent!==c?(e={blockedOn:t,domEventName:a,eventSystemFlags:n,nativeEvent:c,targetContainers:[r]},t!==null&&(t=ol(t),t!==null&&Qm(t)),e):(e.eventSystemFlags|=n,t=e.targetContainers,r!==null&&t.indexOf(r)===-1&&t.push(r),e)}function Gy(e,t,a,n,r){switch(t){case"focusin":return yn=Ji(yn,e,t,a,n,r),!0;case"dragenter":return bn=Ji(bn,e,t,a,n,r),!0;case"mouseover":return xn=Ji(xn,e,t,a,n,r),!0;case"pointerover":var c=r.pointerId;return Qi.set(c,Ji(Qi.get(c)||null,e,t,a,n,r)),!0;case"gotpointercapture":return c=r.pointerId,$i.set(c,Ji($i.get(c)||null,e,t,a,n,r)),!0}return!1}function Pm(e){var t=cl(e.target);if(t!==null){var a=f(t);if(a!==null){if(t=a.tag,t===13){if(t=_(a),t!==null){e.blockedOn=t,fd(e.priority,function(){$m(a)});return}}else if(t===31){if(t=h(a),t!==null){e.blockedOn=t,fd(e.priority,function(){$m(a)});return}}else if(t===3&&a.stateNode.current.memoizedState.isDehydrated){e.blockedOn=a.tag===3?a.stateNode.containerInfo:null;return}}}e.blockedOn=null}function yr(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var a=ao(e.nativeEvent);if(a===null){a=e.nativeEvent;var n=new a.constructor(a.type,a);nu=n,a.target.dispatchEvent(n),nu=null}else return t=ol(a),t!==null&&Qm(t),e.blockedOn=a,!1;t.shift()}return!0}function eh(e,t,a){yr(e)&&a.delete(t)}function By(){lo=!1,yn!==null&&yr(yn)&&(yn=null),bn!==null&&yr(bn)&&(bn=null),xn!==null&&yr(xn)&&(xn=null),Qi.forEach(eh),$i.forEach(eh)}function br(e,t){e.blockedOn===t&&(e.blockedOn=null,lo||(lo=!0,l.unstable_scheduleCallback(l.unstable_NormalPriority,By)))}var xr=null;function th(e){xr!==e&&(xr=e,l.unstable_scheduleCallback(l.unstable_NormalPriority,function(){xr===e&&(xr=null);for(var t=0;t<e.length;t+=3){var a=e[t],n=e[t+1],r=e[t+2];if(typeof n!="function"){if(no(n||a)===null)continue;break}var c=ol(a);c!==null&&(e.splice(t,3),t-=3,ac(c,{pending:!0,data:r,method:a.method,action:n},n,r))}}))}function Yl(e){function t(S){return br(S,e)}yn!==null&&br(yn,e),bn!==null&&br(bn,e),xn!==null&&br(xn,e),Qi.forEach(t),$i.forEach(t);for(var a=0;a<Sn.length;a++){var n=Sn[a];n.blockedOn===e&&(n.blockedOn=null)}for(;0<Sn.length&&(a=Sn[0],a.blockedOn===null);)Pm(a),a.blockedOn===null&&Sn.shift();if(a=(e.ownerDocument||e).$$reactFormReplay,a!=null)for(n=0;n<a.length;n+=3){var r=a[n],c=a[n+1],m=r[Mt]||null;if(typeof c=="function")m||th(a);else if(m){var g=null;if(c&&c.hasAttribute("formAction")){if(r=c,m=c[Mt]||null)g=m.formAction;else if(no(r)!==null)continue}else g=m.action;typeof g=="function"?a[n+1]=g:(a.splice(n,3),n-=3),th(a)}}}function ah(){function e(c){c.canIntercept&&c.info==="react-transition"&&c.intercept({handler:function(){return new Promise(function(m){return r=m})},focusReset:"manual",scroll:"manual"})}function t(){r!==null&&(r(),r=null),n||setTimeout(a,20)}function a(){if(!n&&!navigation.transition){var c=navigation.currentEntry;c&&c.url!=null&&navigation.navigate(c.url,{state:c.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var n=!1,r=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(a,100),function(){n=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),r!==null&&(r(),r=null)}}}function io(e){this._internalRoot=e}Sr.prototype.render=io.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(u(409));var a=t.current,n=$t();Fm(a,n,e,t,null,null)},Sr.prototype.unmount=io.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;Fm(e.current,2,null,e,null,null),ar(),t[ul]=null}};function Sr(e){this._internalRoot=e}Sr.prototype.unstable_scheduleHydration=function(e){if(e){var t=dd();e={blockedOn:null,target:e,priority:t};for(var a=0;a<Sn.length&&t!==0&&t<Sn[a].priority;a++);Sn.splice(a,0,e),a===0&&Pm(e)}};var nh=i.version;if(nh!=="19.2.3")throw Error(u(527,nh,"19.2.3"));B.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(u(188)):(e=Object.keys(e).join(","),Error(u(268,e)));return e=v(t),e=e!==null?y(e):null,e=e===null?null:e.stateNode,e};var Vy={bundleType:0,version:"19.2.3",rendererPackageName:"react-dom",currentDispatcherRef:H,reconcilerVersion:"19.2.3"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var Tr=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Tr.isDisabled&&Tr.supportsFiber)try{si=Tr.inject(Vy),Vt=Tr}catch{}}return Wi.createRoot=function(e,t){if(!o(e))throw Error(u(299));var a=!1,n="",r=o_,c=d_,m=f_;return t!=null&&(t.unstable_strictMode===!0&&(a=!0),t.identifierPrefix!==void 0&&(n=t.identifierPrefix),t.onUncaughtError!==void 0&&(r=t.onUncaughtError),t.onCaughtError!==void 0&&(c=t.onCaughtError),t.onRecoverableError!==void 0&&(m=t.onRecoverableError)),t=Ym(e,1,!1,null,null,a,n,null,r,c,m,ah),e[ul]=t.current,Gc(e),new io(t)},Wi.hydrateRoot=function(e,t,a){if(!o(e))throw Error(u(299));var n=!1,r="",c=o_,m=d_,g=f_,S=null;return a!=null&&(a.unstable_strictMode===!0&&(n=!0),a.identifierPrefix!==void 0&&(r=a.identifierPrefix),a.onUncaughtError!==void 0&&(c=a.onUncaughtError),a.onCaughtError!==void 0&&(m=a.onCaughtError),a.onRecoverableError!==void 0&&(g=a.onRecoverableError),a.formState!==void 0&&(S=a.formState)),t=Ym(e,1,!0,t,a??null,n,r,S,c,m,g,ah),t.context=qm(null),a=t.current,n=$t(),n=Qr(n),r=rn(n),r.callback=null,un(a,r,n),a=n,t.current.lanes=a,ui(t,a),xa(t),e[ul]=t.current,Gc(e),new Sr(t)},Wi.version="19.2.3",Wi}var rh;function ab(){if(rh)return so.exports;rh=1;function l(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(l)}catch(i){console.error(i)}}return l(),so.exports=tb(),so.exports}var nb=ab();const lb=qy(nb);function uh(l,i,s){const u=new Error(l);return u.status=i,u.code=s,u}function ib(l){const{baseUrl:i}=l;async function s(o){const f=await o.json().catch(()=>null);if(f===null)throw uh("Invalid JSON response",o.status);return f}async function u(o,f,_){let h=`${i}${f}`;if(_?.params){const y=new URLSearchParams(_.params).toString();y&&(h+=`?${y}`)}console.log("[CLIENT:FETCH]",o,h);const p={Accept:"application/json"};_?.body!==void 0&&(p["Content-Type"]="application/json");const v=await fetch(h,{method:o,headers:p,body:_?.body!==void 0?JSON.stringify(_.body):void 0,signal:_?.signal});if(console.log("[CLIENT:RESPONSE]",v.status,v.statusText,"hasBody:",!!v.body),!v.ok){const y=await v.json().catch(()=>null);throw console.error("[CLIENT:ERROR]",v.status,y),uh(y?.error?.message??`HTTP ${v.status}`,v.status,y?.error?.code)}return v}return{get:async(o,f)=>{const _=await u("GET",o,{params:f});return s(_)},post:async(o,f)=>{const _=await u("POST",o,{body:f});return s(_)},put:async(o,f)=>{const _=await u("PUT",o,{body:f});return s(_)},delete:async o=>{const f=await u("DELETE",o);return s(f)},stream:(o,f)=>u("GET",o,f),request:u}}function Fh(l){return{ok:!0,value:l}}function Wn(l){return{ok:!1,error:l}}const sb=300*1e3;function ch(l){return l.length===0?l:l.charAt(0).toUpperCase()+l.slice(1)}function wr(l,i,s="..."){return l.length<=i?l:l.slice(0,i-s.length)+s}var Ve;(function(l){l.assertEqual=o=>{};function i(o){}l.assertIs=i;function s(o){throw new Error}l.assertNever=s,l.arrayToEnum=o=>{const f={};for(const _ of o)f[_]=_;return f},l.getValidEnumValues=o=>{const f=l.objectKeys(o).filter(h=>typeof o[o[h]]!="number"),_={};for(const h of f)_[h]=o[h];return l.objectValues(_)},l.objectValues=o=>l.objectKeys(o).map(function(f){return o[f]}),l.objectKeys=typeof Object.keys=="function"?o=>Object.keys(o):o=>{const f=[];for(const _ in o)Object.prototype.hasOwnProperty.call(o,_)&&f.push(_);return f},l.find=(o,f)=>{for(const _ of o)if(f(_))return _},l.isInteger=typeof Number.isInteger=="function"?o=>Number.isInteger(o):o=>typeof o=="number"&&Number.isFinite(o)&&Math.floor(o)===o;function u(o,f=" | "){return o.map(_=>typeof _=="string"?`'${_}'`:_).join(f)}l.joinValues=u,l.jsonStringifyReplacer=(o,f)=>typeof f=="bigint"?f.toString():f})(Ve||(Ve={}));var oh;(function(l){l.mergeShapes=(i,s)=>({...i,...s})})(oh||(oh={}));const de=Ve.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),An=l=>{switch(typeof l){case"undefined":return de.undefined;case"string":return de.string;case"number":return Number.isNaN(l)?de.nan:de.number;case"boolean":return de.boolean;case"function":return de.function;case"bigint":return de.bigint;case"symbol":return de.symbol;case"object":return Array.isArray(l)?de.array:l===null?de.null:l.then&&typeof l.then=="function"&&l.catch&&typeof l.catch=="function"?de.promise:typeof Map<"u"&&l instanceof Map?de.map:typeof Set<"u"&&l instanceof Set?de.set:typeof Date<"u"&&l instanceof Date?de.date:de.object;default:return de.unknown}},P=Ve.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]);class Xa extends Error{get errors(){return this.issues}constructor(i){super(),this.issues=[],this.addIssue=u=>{this.issues=[...this.issues,u]},this.addIssues=(u=[])=>{this.issues=[...this.issues,...u]};const s=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,s):this.__proto__=s,this.name="ZodError",this.issues=i}format(i){const s=i||function(f){return f.message},u={_errors:[]},o=f=>{for(const _ of f.issues)if(_.code==="invalid_union")_.unionErrors.map(o);else if(_.code==="invalid_return_type")o(_.returnTypeError);else if(_.code==="invalid_arguments")o(_.argumentsError);else if(_.path.length===0)u._errors.push(s(_));else{let h=u,p=0;for(;p<_.path.length;){const v=_.path[p];p===_.path.length-1?(h[v]=h[v]||{_errors:[]},h[v]._errors.push(s(_))):h[v]=h[v]||{_errors:[]},h=h[v],p++}}};return o(this),u}static assert(i){if(!(i instanceof Xa))throw new Error(`Not a ZodError: ${i}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,Ve.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(i=s=>s.message){const s={},u=[];for(const o of this.issues)if(o.path.length>0){const f=o.path[0];s[f]=s[f]||[],s[f].push(i(o))}else u.push(i(o));return{formErrors:u,fieldErrors:s}}get formErrors(){return this.flatten()}}Xa.create=l=>new Xa(l);const Ro=(l,i)=>{let s;switch(l.code){case P.invalid_type:l.received===de.undefined?s="Required":s=`Expected ${l.expected}, received ${l.received}`;break;case P.invalid_literal:s=`Invalid literal value, expected ${JSON.stringify(l.expected,Ve.jsonStringifyReplacer)}`;break;case P.unrecognized_keys:s=`Unrecognized key(s) in object: ${Ve.joinValues(l.keys,", ")}`;break;case P.invalid_union:s="Invalid input";break;case P.invalid_union_discriminator:s=`Invalid discriminator value. Expected ${Ve.joinValues(l.options)}`;break;case P.invalid_enum_value:s=`Invalid enum value. Expected ${Ve.joinValues(l.options)}, received '${l.received}'`;break;case P.invalid_arguments:s="Invalid function arguments";break;case P.invalid_return_type:s="Invalid function return type";break;case P.invalid_date:s="Invalid date";break;case P.invalid_string:typeof l.validation=="object"?"includes"in l.validation?(s=`Invalid input: must include "${l.validation.includes}"`,typeof l.validation.position=="number"&&(s=`${s} at one or more positions greater than or equal to ${l.validation.position}`)):"startsWith"in l.validation?s=`Invalid input: must start with "${l.validation.startsWith}"`:"endsWith"in l.validation?s=`Invalid input: must end with "${l.validation.endsWith}"`:Ve.assertNever(l.validation):l.validation!=="regex"?s=`Invalid ${l.validation}`:s="Invalid";break;case P.too_small:l.type==="array"?s=`Array must contain ${l.exact?"exactly":l.inclusive?"at least":"more than"} ${l.minimum} element(s)`:l.type==="string"?s=`String must contain ${l.exact?"exactly":l.inclusive?"at least":"over"} ${l.minimum} character(s)`:l.type==="number"?s=`Number must be ${l.exact?"exactly equal to ":l.inclusive?"greater than or equal to ":"greater than "}${l.minimum}`:l.type==="bigint"?s=`Number must be ${l.exact?"exactly equal to ":l.inclusive?"greater than or equal to ":"greater than "}${l.minimum}`:l.type==="date"?s=`Date must be ${l.exact?"exactly equal to ":l.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(l.minimum))}`:s="Invalid input";break;case P.too_big:l.type==="array"?s=`Array must contain ${l.exact?"exactly":l.inclusive?"at most":"less than"} ${l.maximum} element(s)`:l.type==="string"?s=`String must contain ${l.exact?"exactly":l.inclusive?"at most":"under"} ${l.maximum} character(s)`:l.type==="number"?s=`Number must be ${l.exact?"exactly":l.inclusive?"less than or equal to":"less than"} ${l.maximum}`:l.type==="bigint"?s=`BigInt must be ${l.exact?"exactly":l.inclusive?"less than or equal to":"less than"} ${l.maximum}`:l.type==="date"?s=`Date must be ${l.exact?"exactly":l.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(l.maximum))}`:s="Invalid input";break;case P.custom:s="Invalid input";break;case P.invalid_intersection_types:s="Intersection results could not be merged";break;case P.not_multiple_of:s=`Number must be a multiple of ${l.multipleOf}`;break;case P.not_finite:s="Number must be finite";break;default:s=i.defaultError,Ve.assertNever(l)}return{message:s}};let rb=Ro;function ub(){return rb}const cb=l=>{const{data:i,path:s,errorMaps:u,issueData:o}=l,f=[...s,...o.path||[]],_={...o,path:f};if(o.message!==void 0)return{...o,path:f,message:o.message};let h="";const p=u.filter(v=>!!v).slice().reverse();for(const v of p)h=v(_,{data:i,defaultError:h}).message;return{...o,path:f,message:h}};function se(l,i){const s=ub(),u=cb({issueData:i,data:l.data,path:l.path,errorMaps:[l.common.contextualErrorMap,l.schemaErrorMap,s,s===Ro?void 0:Ro].filter(o=>!!o)});l.common.issues.push(u)}class Pt{constructor(){this.value="valid"}dirty(){this.value==="valid"&&(this.value="dirty")}abort(){this.value!=="aborted"&&(this.value="aborted")}static mergeArray(i,s){const u=[];for(const o of s){if(o.status==="aborted")return Ae;o.status==="dirty"&&i.dirty(),u.push(o.value)}return{status:i.value,value:u}}static async mergeObjectAsync(i,s){const u=[];for(const o of s){const f=await o.key,_=await o.value;u.push({key:f,value:_})}return Pt.mergeObjectSync(i,u)}static mergeObjectSync(i,s){const u={};for(const o of s){const{key:f,value:_}=o;if(f.status==="aborted"||_.status==="aborted")return Ae;f.status==="dirty"&&i.dirty(),_.status==="dirty"&&i.dirty(),f.value!=="__proto__"&&(typeof _.value<"u"||o.alwaysSet)&&(u[f.value]=_.value)}return{status:i.value,value:u}}}const Ae=Object.freeze({status:"aborted"}),ts=l=>({status:"dirty",value:l}),fa=l=>({status:"valid",value:l}),dh=l=>l.status==="aborted",fh=l=>l.status==="dirty",Wl=l=>l.status==="valid",jr=l=>typeof Promise<"u"&&l instanceof Promise;var me;(function(l){l.errToObj=i=>typeof i=="string"?{message:i}:i||{},l.toString=i=>typeof i=="string"?i:i?.message})(me||(me={}));class Nn{constructor(i,s,u,o){this._cachedPath=[],this.parent=i,this.data=s,this._path=u,this._key=o}get path(){return this._cachedPath.length||(Array.isArray(this._key)?this._cachedPath.push(...this._path,...this._key):this._cachedPath.push(...this._path,this._key)),this._cachedPath}}const _h=(l,i)=>{if(Wl(i))return{success:!0,data:i.value};if(!l.common.issues.length)throw new Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;const s=new Xa(l.common.issues);return this._error=s,this._error}}};function Oe(l){if(!l)return{};const{errorMap:i,invalid_type_error:s,required_error:u,description:o}=l;if(i&&(s||u))throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);return i?{errorMap:i,description:o}:{errorMap:(_,h)=>{const{message:p}=l;return _.code==="invalid_enum_value"?{message:p??h.defaultError}:typeof h.data>"u"?{message:p??u??h.defaultError}:_.code!=="invalid_type"?{message:h.defaultError}:{message:p??s??h.defaultError}},description:o}}class Be{get description(){return this._def.description}_getType(i){return An(i.data)}_getOrReturnCtx(i,s){return s||{common:i.parent.common,data:i.data,parsedType:An(i.data),schemaErrorMap:this._def.errorMap,path:i.path,parent:i.parent}}_processInputParams(i){return{status:new Pt,ctx:{common:i.parent.common,data:i.data,parsedType:An(i.data),schemaErrorMap:this._def.errorMap,path:i.path,parent:i.parent}}}_parseSync(i){const s=this._parse(i);if(jr(s))throw new Error("Synchronous parse encountered promise.");return s}_parseAsync(i){const s=this._parse(i);return Promise.resolve(s)}parse(i,s){const u=this.safeParse(i,s);if(u.success)return u.data;throw u.error}safeParse(i,s){const u={common:{issues:[],async:s?.async??!1,contextualErrorMap:s?.errorMap},path:s?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:i,parsedType:An(i)},o=this._parseSync({data:i,path:u.path,parent:u});return _h(u,o)}"~validate"(i){const s={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:i,parsedType:An(i)};if(!this["~standard"].async)try{const u=this._parseSync({data:i,path:[],parent:s});return Wl(u)?{value:u.value}:{issues:s.common.issues}}catch(u){u?.message?.toLowerCase()?.includes("encountered")&&(this["~standard"].async=!0),s.common={issues:[],async:!0}}return this._parseAsync({data:i,path:[],parent:s}).then(u=>Wl(u)?{value:u.value}:{issues:s.common.issues})}async parseAsync(i,s){const u=await this.safeParseAsync(i,s);if(u.success)return u.data;throw u.error}async safeParseAsync(i,s){const u={common:{issues:[],contextualErrorMap:s?.errorMap,async:!0},path:s?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:i,parsedType:An(i)},o=this._parse({data:i,path:u.path,parent:u}),f=await(jr(o)?o:Promise.resolve(o));return _h(u,f)}refine(i,s){const u=o=>typeof s=="string"||typeof s>"u"?{message:s}:typeof s=="function"?s(o):s;return this._refinement((o,f)=>{const _=i(o),h=()=>f.addIssue({code:P.custom,...u(o)});return typeof Promise<"u"&&_ instanceof Promise?_.then(p=>p?!0:(h(),!1)):_?!0:(h(),!1)})}refinement(i,s){return this._refinement((u,o)=>i(u)?!0:(o.addIssue(typeof s=="function"?s(u,o):s),!1))}_refinement(i){return new nl({schema:this,typeName:Re.ZodEffects,effect:{type:"refinement",refinement:i}})}superRefine(i){return this._refinement(i)}constructor(i){this.spa=this.safeParseAsync,this._def=i,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:s=>this["~validate"](s)}}optional(){return Fa.create(this,this._def)}nullable(){return ll.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return Sa.create(this)}promise(){return zr.create(this,this._def)}or(i){return Ir.create([this,i],this._def)}and(i){return Mr.create(this,i,this._def)}transform(i){return new nl({...Oe(this._def),schema:this,typeName:Re.ZodEffects,effect:{type:"transform",transform:i}})}default(i){const s=typeof i=="function"?i:()=>i;return new Ur({...Oe(this._def),innerType:this,defaultValue:s,typeName:Re.ZodDefault})}brand(){return new Jh({typeName:Re.ZodBranded,type:this,...Oe(this._def)})}catch(i){const s=typeof i=="function"?i:()=>i;return new Hr({...Oe(this._def),innerType:this,catchValue:s,typeName:Re.ZodCatch})}describe(i){const s=this.constructor;return new s({...this._def,description:i})}pipe(i){return Bo.create(this,i)}readonly(){return Gr.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}}const ob=/^c[^\s-]{8,}$/i,db=/^[0-9a-z]+$/,fb=/^[0-9A-HJKMNP-TV-Z]{26}$/i,_b=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,mb=/^[a-z0-9_-]{21}$/i,hb=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,gb=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,pb=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,vb="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";let co;const yb=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,bb=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,xb=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,Sb=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,Tb=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,Eb=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,Xh="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",Ab=new RegExp(`^${Xh}$`);function Qh(l){let i="[0-5]\\d";l.precision?i=`${i}\\.\\d{${l.precision}}`:l.precision==null&&(i=`${i}(\\.\\d+)?`);const s=l.precision?"+":"?";return`([01]\\d|2[0-3]):[0-5]\\d(:${i})${s}`}function Rb(l){return new RegExp(`^${Qh(l)}$`)}function Nb(l){let i=`${Xh}T${Qh(l)}`;const s=[];return s.push(l.local?"Z?":"Z"),l.offset&&s.push("([+-]\\d{2}:?\\d{2})"),i=`${i}(${s.join("|")})`,new RegExp(`^${i}$`)}function Cb(l,i){return!!((i==="v4"||!i)&&yb.test(l)||(i==="v6"||!i)&&xb.test(l))}function wb(l,i){if(!hb.test(l))return!1;try{const[s]=l.split(".");if(!s)return!1;const u=s.replace(/-/g,"+").replace(/_/g,"/").padEnd(s.length+(4-s.length%4)%4,"="),o=JSON.parse(atob(u));return!(typeof o!="object"||o===null||"typ"in o&&o?.typ!=="JWT"||!o.alg||i&&o.alg!==i)}catch{return!1}}function Lb(l,i){return!!((i==="v4"||!i)&&bb.test(l)||(i==="v6"||!i)&&Sb.test(l))}class qa extends Be{_parse(i){if(this._def.coerce&&(i.data=String(i.data)),this._getType(i)!==de.string){const f=this._getOrReturnCtx(i);return se(f,{code:P.invalid_type,expected:de.string,received:f.parsedType}),Ae}const u=new Pt;let o;for(const f of this._def.checks)if(f.kind==="min")i.data.length<f.value&&(o=this._getOrReturnCtx(i,o),se(o,{code:P.too_small,minimum:f.value,type:"string",inclusive:!0,exact:!1,message:f.message}),u.dirty());else if(f.kind==="max")i.data.length>f.value&&(o=this._getOrReturnCtx(i,o),se(o,{code:P.too_big,maximum:f.value,type:"string",inclusive:!0,exact:!1,message:f.message}),u.dirty());else if(f.kind==="length"){const _=i.data.length>f.value,h=i.data.length<f.value;(_||h)&&(o=this._getOrReturnCtx(i,o),_?se(o,{code:P.too_big,maximum:f.value,type:"string",inclusive:!0,exact:!0,message:f.message}):h&&se(o,{code:P.too_small,minimum:f.value,type:"string",inclusive:!0,exact:!0,message:f.message}),u.dirty())}else if(f.kind==="email")pb.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"email",code:P.invalid_string,message:f.message}),u.dirty());else if(f.kind==="emoji")co||(co=new RegExp(vb,"u")),co.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"emoji",code:P.invalid_string,message:f.message}),u.dirty());else if(f.kind==="uuid")_b.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"uuid",code:P.invalid_string,message:f.message}),u.dirty());else if(f.kind==="nanoid")mb.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"nanoid",code:P.invalid_string,message:f.message}),u.dirty());else if(f.kind==="cuid")ob.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"cuid",code:P.invalid_string,message:f.message}),u.dirty());else if(f.kind==="cuid2")db.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"cuid2",code:P.invalid_string,message:f.message}),u.dirty());else if(f.kind==="ulid")fb.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"ulid",code:P.invalid_string,message:f.message}),u.dirty());else if(f.kind==="url")try{new URL(i.data)}catch{o=this._getOrReturnCtx(i,o),se(o,{validation:"url",code:P.invalid_string,message:f.message}),u.dirty()}else f.kind==="regex"?(f.regex.lastIndex=0,f.regex.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"regex",code:P.invalid_string,message:f.message}),u.dirty())):f.kind==="trim"?i.data=i.data.trim():f.kind==="includes"?i.data.includes(f.value,f.position)||(o=this._getOrReturnCtx(i,o),se(o,{code:P.invalid_string,validation:{includes:f.value,position:f.position},message:f.message}),u.dirty()):f.kind==="toLowerCase"?i.data=i.data.toLowerCase():f.kind==="toUpperCase"?i.data=i.data.toUpperCase():f.kind==="startsWith"?i.data.startsWith(f.value)||(o=this._getOrReturnCtx(i,o),se(o,{code:P.invalid_string,validation:{startsWith:f.value},message:f.message}),u.dirty()):f.kind==="endsWith"?i.data.endsWith(f.value)||(o=this._getOrReturnCtx(i,o),se(o,{code:P.invalid_string,validation:{endsWith:f.value},message:f.message}),u.dirty()):f.kind==="datetime"?Nb(f).test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{code:P.invalid_string,validation:"datetime",message:f.message}),u.dirty()):f.kind==="date"?Ab.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{code:P.invalid_string,validation:"date",message:f.message}),u.dirty()):f.kind==="time"?Rb(f).test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{code:P.invalid_string,validation:"time",message:f.message}),u.dirty()):f.kind==="duration"?gb.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"duration",code:P.invalid_string,message:f.message}),u.dirty()):f.kind==="ip"?Cb(i.data,f.version)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"ip",code:P.invalid_string,message:f.message}),u.dirty()):f.kind==="jwt"?wb(i.data,f.alg)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"jwt",code:P.invalid_string,message:f.message}),u.dirty()):f.kind==="cidr"?Lb(i.data,f.version)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"cidr",code:P.invalid_string,message:f.message}),u.dirty()):f.kind==="base64"?Tb.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"base64",code:P.invalid_string,message:f.message}),u.dirty()):f.kind==="base64url"?Eb.test(i.data)||(o=this._getOrReturnCtx(i,o),se(o,{validation:"base64url",code:P.invalid_string,message:f.message}),u.dirty()):Ve.assertNever(f);return{status:u.value,value:i.data}}_regex(i,s,u){return this.refinement(o=>i.test(o),{validation:s,code:P.invalid_string,...me.errToObj(u)})}_addCheck(i){return new qa({...this._def,checks:[...this._def.checks,i]})}email(i){return this._addCheck({kind:"email",...me.errToObj(i)})}url(i){return this._addCheck({kind:"url",...me.errToObj(i)})}emoji(i){return this._addCheck({kind:"emoji",...me.errToObj(i)})}uuid(i){return this._addCheck({kind:"uuid",...me.errToObj(i)})}nanoid(i){return this._addCheck({kind:"nanoid",...me.errToObj(i)})}cuid(i){return this._addCheck({kind:"cuid",...me.errToObj(i)})}cuid2(i){return this._addCheck({kind:"cuid2",...me.errToObj(i)})}ulid(i){return this._addCheck({kind:"ulid",...me.errToObj(i)})}base64(i){return this._addCheck({kind:"base64",...me.errToObj(i)})}base64url(i){return this._addCheck({kind:"base64url",...me.errToObj(i)})}jwt(i){return this._addCheck({kind:"jwt",...me.errToObj(i)})}ip(i){return this._addCheck({kind:"ip",...me.errToObj(i)})}cidr(i){return this._addCheck({kind:"cidr",...me.errToObj(i)})}datetime(i){return typeof i=="string"?this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:i}):this._addCheck({kind:"datetime",precision:typeof i?.precision>"u"?null:i?.precision,offset:i?.offset??!1,local:i?.local??!1,...me.errToObj(i?.message)})}date(i){return this._addCheck({kind:"date",message:i})}time(i){return typeof i=="string"?this._addCheck({kind:"time",precision:null,message:i}):this._addCheck({kind:"time",precision:typeof i?.precision>"u"?null:i?.precision,...me.errToObj(i?.message)})}duration(i){return this._addCheck({kind:"duration",...me.errToObj(i)})}regex(i,s){return this._addCheck({kind:"regex",regex:i,...me.errToObj(s)})}includes(i,s){return this._addCheck({kind:"includes",value:i,position:s?.position,...me.errToObj(s?.message)})}startsWith(i,s){return this._addCheck({kind:"startsWith",value:i,...me.errToObj(s)})}endsWith(i,s){return this._addCheck({kind:"endsWith",value:i,...me.errToObj(s)})}min(i,s){return this._addCheck({kind:"min",value:i,...me.errToObj(s)})}max(i,s){return this._addCheck({kind:"max",value:i,...me.errToObj(s)})}length(i,s){return this._addCheck({kind:"length",value:i,...me.errToObj(s)})}nonempty(i){return this.min(1,me.errToObj(i))}trim(){return new qa({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new qa({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new qa({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find(i=>i.kind==="datetime")}get isDate(){return!!this._def.checks.find(i=>i.kind==="date")}get isTime(){return!!this._def.checks.find(i=>i.kind==="time")}get isDuration(){return!!this._def.checks.find(i=>i.kind==="duration")}get isEmail(){return!!this._def.checks.find(i=>i.kind==="email")}get isURL(){return!!this._def.checks.find(i=>i.kind==="url")}get isEmoji(){return!!this._def.checks.find(i=>i.kind==="emoji")}get isUUID(){return!!this._def.checks.find(i=>i.kind==="uuid")}get isNANOID(){return!!this._def.checks.find(i=>i.kind==="nanoid")}get isCUID(){return!!this._def.checks.find(i=>i.kind==="cuid")}get isCUID2(){return!!this._def.checks.find(i=>i.kind==="cuid2")}get isULID(){return!!this._def.checks.find(i=>i.kind==="ulid")}get isIP(){return!!this._def.checks.find(i=>i.kind==="ip")}get isCIDR(){return!!this._def.checks.find(i=>i.kind==="cidr")}get isBase64(){return!!this._def.checks.find(i=>i.kind==="base64")}get isBase64url(){return!!this._def.checks.find(i=>i.kind==="base64url")}get minLength(){let i=null;for(const s of this._def.checks)s.kind==="min"&&(i===null||s.value>i)&&(i=s.value);return i}get maxLength(){let i=null;for(const s of this._def.checks)s.kind==="max"&&(i===null||s.value<i)&&(i=s.value);return i}}qa.create=l=>new qa({checks:[],typeName:Re.ZodString,coerce:l?.coerce??!1,...Oe(l)});function jb(l,i){const s=(l.toString().split(".")[1]||"").length,u=(i.toString().split(".")[1]||"").length,o=s>u?s:u,f=Number.parseInt(l.toFixed(o).replace(".","")),_=Number.parseInt(i.toFixed(o).replace(".",""));return f%_/10**o}class Pn extends Be{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(i){if(this._def.coerce&&(i.data=Number(i.data)),this._getType(i)!==de.number){const f=this._getOrReturnCtx(i);return se(f,{code:P.invalid_type,expected:de.number,received:f.parsedType}),Ae}let u;const o=new Pt;for(const f of this._def.checks)f.kind==="int"?Ve.isInteger(i.data)||(u=this._getOrReturnCtx(i,u),se(u,{code:P.invalid_type,expected:"integer",received:"float",message:f.message}),o.dirty()):f.kind==="min"?(f.inclusive?i.data<f.value:i.data<=f.value)&&(u=this._getOrReturnCtx(i,u),se(u,{code:P.too_small,minimum:f.value,type:"number",inclusive:f.inclusive,exact:!1,message:f.message}),o.dirty()):f.kind==="max"?(f.inclusive?i.data>f.value:i.data>=f.value)&&(u=this._getOrReturnCtx(i,u),se(u,{code:P.too_big,maximum:f.value,type:"number",inclusive:f.inclusive,exact:!1,message:f.message}),o.dirty()):f.kind==="multipleOf"?jb(i.data,f.value)!==0&&(u=this._getOrReturnCtx(i,u),se(u,{code:P.not_multiple_of,multipleOf:f.value,message:f.message}),o.dirty()):f.kind==="finite"?Number.isFinite(i.data)||(u=this._getOrReturnCtx(i,u),se(u,{code:P.not_finite,message:f.message}),o.dirty()):Ve.assertNever(f);return{status:o.value,value:i.data}}gte(i,s){return this.setLimit("min",i,!0,me.toString(s))}gt(i,s){return this.setLimit("min",i,!1,me.toString(s))}lte(i,s){return this.setLimit("max",i,!0,me.toString(s))}lt(i,s){return this.setLimit("max",i,!1,me.toString(s))}setLimit(i,s,u,o){return new Pn({...this._def,checks:[...this._def.checks,{kind:i,value:s,inclusive:u,message:me.toString(o)}]})}_addCheck(i){return new Pn({...this._def,checks:[...this._def.checks,i]})}int(i){return this._addCheck({kind:"int",message:me.toString(i)})}positive(i){return this._addCheck({kind:"min",value:0,inclusive:!1,message:me.toString(i)})}negative(i){return this._addCheck({kind:"max",value:0,inclusive:!1,message:me.toString(i)})}nonpositive(i){return this._addCheck({kind:"max",value:0,inclusive:!0,message:me.toString(i)})}nonnegative(i){return this._addCheck({kind:"min",value:0,inclusive:!0,message:me.toString(i)})}multipleOf(i,s){return this._addCheck({kind:"multipleOf",value:i,message:me.toString(s)})}finite(i){return this._addCheck({kind:"finite",message:me.toString(i)})}safe(i){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:me.toString(i)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:me.toString(i)})}get minValue(){let i=null;for(const s of this._def.checks)s.kind==="min"&&(i===null||s.value>i)&&(i=s.value);return i}get maxValue(){let i=null;for(const s of this._def.checks)s.kind==="max"&&(i===null||s.value<i)&&(i=s.value);return i}get isInt(){return!!this._def.checks.find(i=>i.kind==="int"||i.kind==="multipleOf"&&Ve.isInteger(i.value))}get isFinite(){let i=null,s=null;for(const u of this._def.checks){if(u.kind==="finite"||u.kind==="int"||u.kind==="multipleOf")return!0;u.kind==="min"?(s===null||u.value>s)&&(s=u.value):u.kind==="max"&&(i===null||u.value<i)&&(i=u.value)}return Number.isFinite(s)&&Number.isFinite(i)}}Pn.create=l=>new Pn({checks:[],typeName:Re.ZodNumber,coerce:l?.coerce||!1,...Oe(l)});class el extends Be{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte}_parse(i){if(this._def.coerce)try{i.data=BigInt(i.data)}catch{return this._getInvalidInput(i)}if(this._getType(i)!==de.bigint)return this._getInvalidInput(i);let u;const o=new Pt;for(const f of this._def.checks)f.kind==="min"?(f.inclusive?i.data<f.value:i.data<=f.value)&&(u=this._getOrReturnCtx(i,u),se(u,{code:P.too_small,type:"bigint",minimum:f.value,inclusive:f.inclusive,message:f.message}),o.dirty()):f.kind==="max"?(f.inclusive?i.data>f.value:i.data>=f.value)&&(u=this._getOrReturnCtx(i,u),se(u,{code:P.too_big,type:"bigint",maximum:f.value,inclusive:f.inclusive,message:f.message}),o.dirty()):f.kind==="multipleOf"?i.data%f.value!==BigInt(0)&&(u=this._getOrReturnCtx(i,u),se(u,{code:P.not_multiple_of,multipleOf:f.value,message:f.message}),o.dirty()):Ve.assertNever(f);return{status:o.value,value:i.data}}_getInvalidInput(i){const s=this._getOrReturnCtx(i);return se(s,{code:P.invalid_type,expected:de.bigint,received:s.parsedType}),Ae}gte(i,s){return this.setLimit("min",i,!0,me.toString(s))}gt(i,s){return this.setLimit("min",i,!1,me.toString(s))}lte(i,s){return this.setLimit("max",i,!0,me.toString(s))}lt(i,s){return this.setLimit("max",i,!1,me.toString(s))}setLimit(i,s,u,o){return new el({...this._def,checks:[...this._def.checks,{kind:i,value:s,inclusive:u,message:me.toString(o)}]})}_addCheck(i){return new el({...this._def,checks:[...this._def.checks,i]})}positive(i){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:me.toString(i)})}negative(i){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:me.toString(i)})}nonpositive(i){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:me.toString(i)})}nonnegative(i){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:me.toString(i)})}multipleOf(i,s){return this._addCheck({kind:"multipleOf",value:i,message:me.toString(s)})}get minValue(){let i=null;for(const s of this._def.checks)s.kind==="min"&&(i===null||s.value>i)&&(i=s.value);return i}get maxValue(){let i=null;for(const s of this._def.checks)s.kind==="max"&&(i===null||s.value<i)&&(i=s.value);return i}}el.create=l=>new el({checks:[],typeName:Re.ZodBigInt,coerce:l?.coerce??!1,...Oe(l)});class Or extends Be{_parse(i){if(this._def.coerce&&(i.data=!!i.data),this._getType(i)!==de.boolean){const u=this._getOrReturnCtx(i);return se(u,{code:P.invalid_type,expected:de.boolean,received:u.parsedType}),Ae}return fa(i.data)}}Or.create=l=>new Or({typeName:Re.ZodBoolean,coerce:l?.coerce||!1,...Oe(l)});class Pl extends Be{_parse(i){if(this._def.coerce&&(i.data=new Date(i.data)),this._getType(i)!==de.date){const f=this._getOrReturnCtx(i);return se(f,{code:P.invalid_type,expected:de.date,received:f.parsedType}),Ae}if(Number.isNaN(i.data.getTime())){const f=this._getOrReturnCtx(i);return se(f,{code:P.invalid_date}),Ae}const u=new Pt;let o;for(const f of this._def.checks)f.kind==="min"?i.data.getTime()<f.value&&(o=this._getOrReturnCtx(i,o),se(o,{code:P.too_small,message:f.message,inclusive:!0,exact:!1,minimum:f.value,type:"date"}),u.dirty()):f.kind==="max"?i.data.getTime()>f.value&&(o=this._getOrReturnCtx(i,o),se(o,{code:P.too_big,message:f.message,inclusive:!0,exact:!1,maximum:f.value,type:"date"}),u.dirty()):Ve.assertNever(f);return{status:u.value,value:new Date(i.data.getTime())}}_addCheck(i){return new Pl({...this._def,checks:[...this._def.checks,i]})}min(i,s){return this._addCheck({kind:"min",value:i.getTime(),message:me.toString(s)})}max(i,s){return this._addCheck({kind:"max",value:i.getTime(),message:me.toString(s)})}get minDate(){let i=null;for(const s of this._def.checks)s.kind==="min"&&(i===null||s.value>i)&&(i=s.value);return i!=null?new Date(i):null}get maxDate(){let i=null;for(const s of this._def.checks)s.kind==="max"&&(i===null||s.value<i)&&(i=s.value);return i!=null?new Date(i):null}}Pl.create=l=>new Pl({checks:[],coerce:l?.coerce||!1,typeName:Re.ZodDate,...Oe(l)});class mh extends Be{_parse(i){if(this._getType(i)!==de.symbol){const u=this._getOrReturnCtx(i);return se(u,{code:P.invalid_type,expected:de.symbol,received:u.parsedType}),Ae}return fa(i.data)}}mh.create=l=>new mh({typeName:Re.ZodSymbol,...Oe(l)});class No extends Be{_parse(i){if(this._getType(i)!==de.undefined){const u=this._getOrReturnCtx(i);return se(u,{code:P.invalid_type,expected:de.undefined,received:u.parsedType}),Ae}return fa(i.data)}}No.create=l=>new No({typeName:Re.ZodUndefined,...Oe(l)});class Co extends Be{_parse(i){if(this._getType(i)!==de.null){const u=this._getOrReturnCtx(i);return se(u,{code:P.invalid_type,expected:de.null,received:u.parsedType}),Ae}return fa(i.data)}}Co.create=l=>new Co({typeName:Re.ZodNull,...Oe(l)});class hh extends Be{constructor(){super(...arguments),this._any=!0}_parse(i){return fa(i.data)}}hh.create=l=>new hh({typeName:Re.ZodAny,...Oe(l)});class wo extends Be{constructor(){super(...arguments),this._unknown=!0}_parse(i){return fa(i.data)}}wo.create=l=>new wo({typeName:Re.ZodUnknown,...Oe(l)});class Cn extends Be{_parse(i){const s=this._getOrReturnCtx(i);return se(s,{code:P.invalid_type,expected:de.never,received:s.parsedType}),Ae}}Cn.create=l=>new Cn({typeName:Re.ZodNever,...Oe(l)});class gh extends Be{_parse(i){if(this._getType(i)!==de.undefined){const u=this._getOrReturnCtx(i);return se(u,{code:P.invalid_type,expected:de.void,received:u.parsedType}),Ae}return fa(i.data)}}gh.create=l=>new gh({typeName:Re.ZodVoid,...Oe(l)});class Sa extends Be{_parse(i){const{ctx:s,status:u}=this._processInputParams(i),o=this._def;if(s.parsedType!==de.array)return se(s,{code:P.invalid_type,expected:de.array,received:s.parsedType}),Ae;if(o.exactLength!==null){const _=s.data.length>o.exactLength.value,h=s.data.length<o.exactLength.value;(_||h)&&(se(s,{code:_?P.too_big:P.too_small,minimum:h?o.exactLength.value:void 0,maximum:_?o.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:o.exactLength.message}),u.dirty())}if(o.minLength!==null&&s.data.length<o.minLength.value&&(se(s,{code:P.too_small,minimum:o.minLength.value,type:"array",inclusive:!0,exact:!1,message:o.minLength.message}),u.dirty()),o.maxLength!==null&&s.data.length>o.maxLength.value&&(se(s,{code:P.too_big,maximum:o.maxLength.value,type:"array",inclusive:!0,exact:!1,message:o.maxLength.message}),u.dirty()),s.common.async)return Promise.all([...s.data].map((_,h)=>o.type._parseAsync(new Nn(s,_,s.path,h)))).then(_=>Pt.mergeArray(u,_));const f=[...s.data].map((_,h)=>o.type._parseSync(new Nn(s,_,s.path,h)));return Pt.mergeArray(u,f)}get element(){return this._def.type}min(i,s){return new Sa({...this._def,minLength:{value:i,message:me.toString(s)}})}max(i,s){return new Sa({...this._def,maxLength:{value:i,message:me.toString(s)}})}length(i,s){return new Sa({...this._def,exactLength:{value:i,message:me.toString(s)}})}nonempty(i){return this.min(1,i)}}Sa.create=(l,i)=>new Sa({type:l,minLength:null,maxLength:null,exactLength:null,typeName:Re.ZodArray,...Oe(i)});function Fl(l){if(l instanceof gt){const i={};for(const s in l.shape){const u=l.shape[s];i[s]=Fa.create(Fl(u))}return new gt({...l._def,shape:()=>i})}else return l instanceof Sa?new Sa({...l._def,type:Fl(l.element)}):l instanceof Fa?Fa.create(Fl(l.unwrap())):l instanceof ll?ll.create(Fl(l.unwrap())):l instanceof tl?tl.create(l.items.map(i=>Fl(i))):l}class gt extends Be{constructor(){super(...arguments),this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;const i=this._def.shape(),s=Ve.objectKeys(i);return this._cached={shape:i,keys:s},this._cached}_parse(i){if(this._getType(i)!==de.object){const v=this._getOrReturnCtx(i);return se(v,{code:P.invalid_type,expected:de.object,received:v.parsedType}),Ae}const{status:u,ctx:o}=this._processInputParams(i),{shape:f,keys:_}=this._getCached(),h=[];if(!(this._def.catchall instanceof Cn&&this._def.unknownKeys==="strip"))for(const v in o.data)_.includes(v)||h.push(v);const p=[];for(const v of _){const y=f[v],T=o.data[v];p.push({key:{status:"valid",value:v},value:y._parse(new Nn(o,T,o.path,v)),alwaysSet:v in o.data})}if(this._def.catchall instanceof Cn){const v=this._def.unknownKeys;if(v==="passthrough")for(const y of h)p.push({key:{status:"valid",value:y},value:{status:"valid",value:o.data[y]}});else if(v==="strict")h.length>0&&(se(o,{code:P.unrecognized_keys,keys:h}),u.dirty());else if(v!=="strip")throw new Error("Internal ZodObject error: invalid unknownKeys value.")}else{const v=this._def.catchall;for(const y of h){const T=o.data[y];p.push({key:{status:"valid",value:y},value:v._parse(new Nn(o,T,o.path,y)),alwaysSet:y in o.data})}}return o.common.async?Promise.resolve().then(async()=>{const v=[];for(const y of p){const T=await y.key,E=await y.value;v.push({key:T,value:E,alwaysSet:y.alwaysSet})}return v}).then(v=>Pt.mergeObjectSync(u,v)):Pt.mergeObjectSync(u,p)}get shape(){return this._def.shape()}strict(i){return me.errToObj,new gt({...this._def,unknownKeys:"strict",...i!==void 0?{errorMap:(s,u)=>{const o=this._def.errorMap?.(s,u).message??u.defaultError;return s.code==="unrecognized_keys"?{message:me.errToObj(i).message??o}:{message:o}}}:{}})}strip(){return new gt({...this._def,unknownKeys:"strip"})}passthrough(){return new gt({...this._def,unknownKeys:"passthrough"})}extend(i){return new gt({...this._def,shape:()=>({...this._def.shape(),...i})})}merge(i){return new gt({unknownKeys:i._def.unknownKeys,catchall:i._def.catchall,shape:()=>({...this._def.shape(),...i._def.shape()}),typeName:Re.ZodObject})}setKey(i,s){return this.augment({[i]:s})}catchall(i){return new gt({...this._def,catchall:i})}pick(i){const s={};for(const u of Ve.objectKeys(i))i[u]&&this.shape[u]&&(s[u]=this.shape[u]);return new gt({...this._def,shape:()=>s})}omit(i){const s={};for(const u of Ve.objectKeys(this.shape))i[u]||(s[u]=this.shape[u]);return new gt({...this._def,shape:()=>s})}deepPartial(){return Fl(this)}partial(i){const s={};for(const u of Ve.objectKeys(this.shape)){const o=this.shape[u];i&&!i[u]?s[u]=o:s[u]=o.optional()}return new gt({...this._def,shape:()=>s})}required(i){const s={};for(const u of Ve.objectKeys(this.shape))if(i&&!i[u])s[u]=this.shape[u];else{let f=this.shape[u];for(;f instanceof Fa;)f=f._def.innerType;s[u]=f}return new gt({...this._def,shape:()=>s})}keyof(){return $h(Ve.objectKeys(this.shape))}}gt.create=(l,i)=>new gt({shape:()=>l,unknownKeys:"strip",catchall:Cn.create(),typeName:Re.ZodObject,...Oe(i)});gt.strictCreate=(l,i)=>new gt({shape:()=>l,unknownKeys:"strict",catchall:Cn.create(),typeName:Re.ZodObject,...Oe(i)});gt.lazycreate=(l,i)=>new gt({shape:l,unknownKeys:"strip",catchall:Cn.create(),typeName:Re.ZodObject,...Oe(i)});class Ir extends Be{_parse(i){const{ctx:s}=this._processInputParams(i),u=this._def.options;function o(f){for(const h of f)if(h.result.status==="valid")return h.result;for(const h of f)if(h.result.status==="dirty")return s.common.issues.push(...h.ctx.common.issues),h.result;const _=f.map(h=>new Xa(h.ctx.common.issues));return se(s,{code:P.invalid_union,unionErrors:_}),Ae}if(s.common.async)return Promise.all(u.map(async f=>{const _={...s,common:{...s.common,issues:[]},parent:null};return{result:await f._parseAsync({data:s.data,path:s.path,parent:_}),ctx:_}})).then(o);{let f;const _=[];for(const p of u){const v={...s,common:{...s.common,issues:[]},parent:null},y=p._parseSync({data:s.data,path:s.path,parent:v});if(y.status==="valid")return y;y.status==="dirty"&&!f&&(f={result:y,ctx:v}),v.common.issues.length&&_.push(v.common.issues)}if(f)return s.common.issues.push(...f.ctx.common.issues),f.result;const h=_.map(p=>new Xa(p));return se(s,{code:P.invalid_union,unionErrors:h}),Ae}}get options(){return this._def.options}}Ir.create=(l,i)=>new Ir({options:l,typeName:Re.ZodUnion,...Oe(i)});const Ya=l=>l instanceof Dr?Ya(l.schema):l instanceof nl?Ya(l.innerType()):l instanceof kr?[l.value]:l instanceof al?l.options:l instanceof jo?Ve.objectValues(l.enum):l instanceof Ur?Ya(l._def.innerType):l instanceof No?[void 0]:l instanceof Co?[null]:l instanceof Fa?[void 0,...Ya(l.unwrap())]:l instanceof ll?[null,...Ya(l.unwrap())]:l instanceof Jh||l instanceof Gr?Ya(l.unwrap()):l instanceof Hr?Ya(l._def.innerType):[];class Go extends Be{_parse(i){const{ctx:s}=this._processInputParams(i);if(s.parsedType!==de.object)return se(s,{code:P.invalid_type,expected:de.object,received:s.parsedType}),Ae;const u=this.discriminator,o=s.data[u],f=this.optionsMap.get(o);return f?s.common.async?f._parseAsync({data:s.data,path:s.path,parent:s}):f._parseSync({data:s.data,path:s.path,parent:s}):(se(s,{code:P.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[u]}),Ae)}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(i,s,u){const o=new Map;for(const f of s){const _=Ya(f.shape[i]);if(!_.length)throw new Error(`A discriminator value for key \`${i}\` could not be extracted from all schema options`);for(const h of _){if(o.has(h))throw new Error(`Discriminator property ${String(i)} has duplicate value ${String(h)}`);o.set(h,f)}}return new Go({typeName:Re.ZodDiscriminatedUnion,discriminator:i,options:s,optionsMap:o,...Oe(u)})}}function Lo(l,i){const s=An(l),u=An(i);if(l===i)return{valid:!0,data:l};if(s===de.object&&u===de.object){const o=Ve.objectKeys(i),f=Ve.objectKeys(l).filter(h=>o.indexOf(h)!==-1),_={...l,...i};for(const h of f){const p=Lo(l[h],i[h]);if(!p.valid)return{valid:!1};_[h]=p.data}return{valid:!0,data:_}}else if(s===de.array&&u===de.array){if(l.length!==i.length)return{valid:!1};const o=[];for(let f=0;f<l.length;f++){const _=l[f],h=i[f],p=Lo(_,h);if(!p.valid)return{valid:!1};o.push(p.data)}return{valid:!0,data:o}}else return s===de.date&&u===de.date&&+l==+i?{valid:!0,data:l}:{valid:!1}}class Mr extends Be{_parse(i){const{status:s,ctx:u}=this._processInputParams(i),o=(f,_)=>{if(dh(f)||dh(_))return Ae;const h=Lo(f.value,_.value);return h.valid?((fh(f)||fh(_))&&s.dirty(),{status:s.value,value:h.data}):(se(u,{code:P.invalid_intersection_types}),Ae)};return u.common.async?Promise.all([this._def.left._parseAsync({data:u.data,path:u.path,parent:u}),this._def.right._parseAsync({data:u.data,path:u.path,parent:u})]).then(([f,_])=>o(f,_)):o(this._def.left._parseSync({data:u.data,path:u.path,parent:u}),this._def.right._parseSync({data:u.data,path:u.path,parent:u}))}}Mr.create=(l,i,s)=>new Mr({left:l,right:i,typeName:Re.ZodIntersection,...Oe(s)});class tl extends Be{_parse(i){const{status:s,ctx:u}=this._processInputParams(i);if(u.parsedType!==de.array)return se(u,{code:P.invalid_type,expected:de.array,received:u.parsedType}),Ae;if(u.data.length<this._def.items.length)return se(u,{code:P.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),Ae;!this._def.rest&&u.data.length>this._def.items.length&&(se(u,{code:P.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),s.dirty());const f=[...u.data].map((_,h)=>{const p=this._def.items[h]||this._def.rest;return p?p._parse(new Nn(u,_,u.path,h)):null}).filter(_=>!!_);return u.common.async?Promise.all(f).then(_=>Pt.mergeArray(s,_)):Pt.mergeArray(s,f)}get items(){return this._def.items}rest(i){return new tl({...this._def,rest:i})}}tl.create=(l,i)=>{if(!Array.isArray(l))throw new Error("You must pass an array of schemas to z.tuple([ ... ])");return new tl({items:l,typeName:Re.ZodTuple,rest:null,...Oe(i)})};class ph extends Be{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(i){const{status:s,ctx:u}=this._processInputParams(i);if(u.parsedType!==de.map)return se(u,{code:P.invalid_type,expected:de.map,received:u.parsedType}),Ae;const o=this._def.keyType,f=this._def.valueType,_=[...u.data.entries()].map(([h,p],v)=>({key:o._parse(new Nn(u,h,u.path,[v,"key"])),value:f._parse(new Nn(u,p,u.path,[v,"value"]))}));if(u.common.async){const h=new Map;return Promise.resolve().then(async()=>{for(const p of _){const v=await p.key,y=await p.value;if(v.status==="aborted"||y.status==="aborted")return Ae;(v.status==="dirty"||y.status==="dirty")&&s.dirty(),h.set(v.value,y.value)}return{status:s.value,value:h}})}else{const h=new Map;for(const p of _){const v=p.key,y=p.value;if(v.status==="aborted"||y.status==="aborted")return Ae;(v.status==="dirty"||y.status==="dirty")&&s.dirty(),h.set(v.value,y.value)}return{status:s.value,value:h}}}}ph.create=(l,i,s)=>new ph({valueType:i,keyType:l,typeName:Re.ZodMap,...Oe(s)});class is extends Be{_parse(i){const{status:s,ctx:u}=this._processInputParams(i);if(u.parsedType!==de.set)return se(u,{code:P.invalid_type,expected:de.set,received:u.parsedType}),Ae;const o=this._def;o.minSize!==null&&u.data.size<o.minSize.value&&(se(u,{code:P.too_small,minimum:o.minSize.value,type:"set",inclusive:!0,exact:!1,message:o.minSize.message}),s.dirty()),o.maxSize!==null&&u.data.size>o.maxSize.value&&(se(u,{code:P.too_big,maximum:o.maxSize.value,type:"set",inclusive:!0,exact:!1,message:o.maxSize.message}),s.dirty());const f=this._def.valueType;function _(p){const v=new Set;for(const y of p){if(y.status==="aborted")return Ae;y.status==="dirty"&&s.dirty(),v.add(y.value)}return{status:s.value,value:v}}const h=[...u.data.values()].map((p,v)=>f._parse(new Nn(u,p,u.path,v)));return u.common.async?Promise.all(h).then(p=>_(p)):_(h)}min(i,s){return new is({...this._def,minSize:{value:i,message:me.toString(s)}})}max(i,s){return new is({...this._def,maxSize:{value:i,message:me.toString(s)}})}size(i,s){return this.min(i,s).max(i,s)}nonempty(i){return this.min(1,i)}}is.create=(l,i)=>new is({valueType:l,minSize:null,maxSize:null,typeName:Re.ZodSet,...Oe(i)});class Dr extends Be{get schema(){return this._def.getter()}_parse(i){const{ctx:s}=this._processInputParams(i);return this._def.getter()._parse({data:s.data,path:s.path,parent:s})}}Dr.create=(l,i)=>new Dr({getter:l,typeName:Re.ZodLazy,...Oe(i)});class kr extends Be{_parse(i){if(i.data!==this._def.value){const s=this._getOrReturnCtx(i);return se(s,{received:s.data,code:P.invalid_literal,expected:this._def.value}),Ae}return{status:"valid",value:i.data}}get value(){return this._def.value}}kr.create=(l,i)=>new kr({value:l,typeName:Re.ZodLiteral,...Oe(i)});function $h(l,i){return new al({values:l,typeName:Re.ZodEnum,...Oe(i)})}class al extends Be{_parse(i){if(typeof i.data!="string"){const s=this._getOrReturnCtx(i),u=this._def.values;return se(s,{expected:Ve.joinValues(u),received:s.parsedType,code:P.invalid_type}),Ae}if(this._cache||(this._cache=new Set(this._def.values)),!this._cache.has(i.data)){const s=this._getOrReturnCtx(i),u=this._def.values;return se(s,{received:s.data,code:P.invalid_enum_value,options:u}),Ae}return fa(i.data)}get options(){return this._def.values}get enum(){const i={};for(const s of this._def.values)i[s]=s;return i}get Values(){const i={};for(const s of this._def.values)i[s]=s;return i}get Enum(){const i={};for(const s of this._def.values)i[s]=s;return i}extract(i,s=this._def){return al.create(i,{...this._def,...s})}exclude(i,s=this._def){return al.create(this.options.filter(u=>!i.includes(u)),{...this._def,...s})}}al.create=$h;class jo extends Be{_parse(i){const s=Ve.getValidEnumValues(this._def.values),u=this._getOrReturnCtx(i);if(u.parsedType!==de.string&&u.parsedType!==de.number){const o=Ve.objectValues(s);return se(u,{expected:Ve.joinValues(o),received:u.parsedType,code:P.invalid_type}),Ae}if(this._cache||(this._cache=new Set(Ve.getValidEnumValues(this._def.values))),!this._cache.has(i.data)){const o=Ve.objectValues(s);return se(u,{received:u.data,code:P.invalid_enum_value,options:o}),Ae}return fa(i.data)}get enum(){return this._def.values}}jo.create=(l,i)=>new jo({values:l,typeName:Re.ZodNativeEnum,...Oe(i)});class zr extends Be{unwrap(){return this._def.type}_parse(i){const{ctx:s}=this._processInputParams(i);if(s.parsedType!==de.promise&&s.common.async===!1)return se(s,{code:P.invalid_type,expected:de.promise,received:s.parsedType}),Ae;const u=s.parsedType===de.promise?s.data:Promise.resolve(s.data);return fa(u.then(o=>this._def.type.parseAsync(o,{path:s.path,errorMap:s.common.contextualErrorMap})))}}zr.create=(l,i)=>new zr({type:l,typeName:Re.ZodPromise,...Oe(i)});class nl extends Be{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===Re.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(i){const{status:s,ctx:u}=this._processInputParams(i),o=this._def.effect||null,f={addIssue:_=>{se(u,_),_.fatal?s.abort():s.dirty()},get path(){return u.path}};if(f.addIssue=f.addIssue.bind(f),o.type==="preprocess"){const _=o.transform(u.data,f);if(u.common.async)return Promise.resolve(_).then(async h=>{if(s.value==="aborted")return Ae;const p=await this._def.schema._parseAsync({data:h,path:u.path,parent:u});return p.status==="aborted"?Ae:p.status==="dirty"||s.value==="dirty"?ts(p.value):p});{if(s.value==="aborted")return Ae;const h=this._def.schema._parseSync({data:_,path:u.path,parent:u});return h.status==="aborted"?Ae:h.status==="dirty"||s.value==="dirty"?ts(h.value):h}}if(o.type==="refinement"){const _=h=>{const p=o.refinement(h,f);if(u.common.async)return Promise.resolve(p);if(p instanceof Promise)throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return h};if(u.common.async===!1){const h=this._def.schema._parseSync({data:u.data,path:u.path,parent:u});return h.status==="aborted"?Ae:(h.status==="dirty"&&s.dirty(),_(h.value),{status:s.value,value:h.value})}else return this._def.schema._parseAsync({data:u.data,path:u.path,parent:u}).then(h=>h.status==="aborted"?Ae:(h.status==="dirty"&&s.dirty(),_(h.value).then(()=>({status:s.value,value:h.value}))))}if(o.type==="transform")if(u.common.async===!1){const _=this._def.schema._parseSync({data:u.data,path:u.path,parent:u});if(!Wl(_))return Ae;const h=o.transform(_.value,f);if(h instanceof Promise)throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:s.value,value:h}}else return this._def.schema._parseAsync({data:u.data,path:u.path,parent:u}).then(_=>Wl(_)?Promise.resolve(o.transform(_.value,f)).then(h=>({status:s.value,value:h})):Ae);Ve.assertNever(o)}}nl.create=(l,i,s)=>new nl({schema:l,typeName:Re.ZodEffects,effect:i,...Oe(s)});nl.createWithPreprocess=(l,i,s)=>new nl({schema:i,effect:{type:"preprocess",transform:l},typeName:Re.ZodEffects,...Oe(s)});class Fa extends Be{_parse(i){return this._getType(i)===de.undefined?fa(void 0):this._def.innerType._parse(i)}unwrap(){return this._def.innerType}}Fa.create=(l,i)=>new Fa({innerType:l,typeName:Re.ZodOptional,...Oe(i)});class ll extends Be{_parse(i){return this._getType(i)===de.null?fa(null):this._def.innerType._parse(i)}unwrap(){return this._def.innerType}}ll.create=(l,i)=>new ll({innerType:l,typeName:Re.ZodNullable,...Oe(i)});class Ur extends Be{_parse(i){const{ctx:s}=this._processInputParams(i);let u=s.data;return s.parsedType===de.undefined&&(u=this._def.defaultValue()),this._def.innerType._parse({data:u,path:s.path,parent:s})}removeDefault(){return this._def.innerType}}Ur.create=(l,i)=>new Ur({innerType:l,typeName:Re.ZodDefault,defaultValue:typeof i.default=="function"?i.default:()=>i.default,...Oe(i)});class Hr extends Be{_parse(i){const{ctx:s}=this._processInputParams(i),u={...s,common:{...s.common,issues:[]}},o=this._def.innerType._parse({data:u.data,path:u.path,parent:{...u}});return jr(o)?o.then(f=>({status:"valid",value:f.status==="valid"?f.value:this._def.catchValue({get error(){return new Xa(u.common.issues)},input:u.data})})):{status:"valid",value:o.status==="valid"?o.value:this._def.catchValue({get error(){return new Xa(u.common.issues)},input:u.data})}}removeCatch(){return this._def.innerType}}Hr.create=(l,i)=>new Hr({innerType:l,typeName:Re.ZodCatch,catchValue:typeof i.catch=="function"?i.catch:()=>i.catch,...Oe(i)});class vh extends Be{_parse(i){if(this._getType(i)!==de.nan){const u=this._getOrReturnCtx(i);return se(u,{code:P.invalid_type,expected:de.nan,received:u.parsedType}),Ae}return{status:"valid",value:i.data}}}vh.create=l=>new vh({typeName:Re.ZodNaN,...Oe(l)});class Jh extends Be{_parse(i){const{ctx:s}=this._processInputParams(i),u=s.data;return this._def.type._parse({data:u,path:s.path,parent:s})}unwrap(){return this._def.type}}class Bo extends Be{_parse(i){const{status:s,ctx:u}=this._processInputParams(i);if(u.common.async)return(async()=>{const f=await this._def.in._parseAsync({data:u.data,path:u.path,parent:u});return f.status==="aborted"?Ae:f.status==="dirty"?(s.dirty(),ts(f.value)):this._def.out._parseAsync({data:f.value,path:u.path,parent:u})})();{const o=this._def.in._parseSync({data:u.data,path:u.path,parent:u});return o.status==="aborted"?Ae:o.status==="dirty"?(s.dirty(),{status:"dirty",value:o.value}):this._def.out._parseSync({data:o.value,path:u.path,parent:u})}}static create(i,s){return new Bo({in:i,out:s,typeName:Re.ZodPipeline})}}class Gr extends Be{_parse(i){const s=this._def.innerType._parse(i),u=o=>(Wl(o)&&(o.value=Object.freeze(o.value)),o);return jr(s)?s.then(o=>u(o)):u(s)}unwrap(){return this._def.innerType}}Gr.create=(l,i)=>new Gr({innerType:l,typeName:Re.ZodReadonly,...Oe(i)});var Re;(function(l){l.ZodString="ZodString",l.ZodNumber="ZodNumber",l.ZodNaN="ZodNaN",l.ZodBigInt="ZodBigInt",l.ZodBoolean="ZodBoolean",l.ZodDate="ZodDate",l.ZodSymbol="ZodSymbol",l.ZodUndefined="ZodUndefined",l.ZodNull="ZodNull",l.ZodAny="ZodAny",l.ZodUnknown="ZodUnknown",l.ZodNever="ZodNever",l.ZodVoid="ZodVoid",l.ZodArray="ZodArray",l.ZodObject="ZodObject",l.ZodUnion="ZodUnion",l.ZodDiscriminatedUnion="ZodDiscriminatedUnion",l.ZodIntersection="ZodIntersection",l.ZodTuple="ZodTuple",l.ZodRecord="ZodRecord",l.ZodMap="ZodMap",l.ZodSet="ZodSet",l.ZodFunction="ZodFunction",l.ZodLazy="ZodLazy",l.ZodLiteral="ZodLiteral",l.ZodEnum="ZodEnum",l.ZodEffects="ZodEffects",l.ZodNativeEnum="ZodNativeEnum",l.ZodOptional="ZodOptional",l.ZodNullable="ZodNullable",l.ZodDefault="ZodDefault",l.ZodCatch="ZodCatch",l.ZodPromise="ZodPromise",l.ZodBranded="ZodBranded",l.ZodPipeline="ZodPipeline",l.ZodReadonly="ZodReadonly"})(Re||(Re={}));const R=qa.create,fe=Pn.create;el.create;const ot=Or.create,Ob=Pl.create,Ib=wo.create;Cn.create;const He=Sa.create,J=gt.create,Wh=Ir.create,sl=Go.create;Mr.create;tl.create;const Mb=Dr.create,at=kr.create,Se=al.create;zr.create;Fa.create;ll.create;const Db={string:(l=>qa.create({...l,coerce:!0})),number:(l=>Pn.create({...l,coerce:!0})),boolean:(l=>Or.create({...l,coerce:!0})),bigint:(l=>el.create({...l,coerce:!0})),date:(l=>Pl.create({...l,coerce:!0}))},kb={INTERNAL_ERROR:"INTERNAL_ERROR",NOT_FOUND:"NOT_FOUND",VALIDATION_ERROR:"VALIDATION_ERROR",AI_ERROR:"AI_ERROR",AI_CLIENT_ERROR:"AI_CLIENT_ERROR",API_KEY_MISSING:"API_KEY_MISSING",RATE_LIMITED:"RATE_LIMITED",STREAM_ERROR:"STREAM_ERROR",SESSION_NOT_FOUND:"SESSION_NOT_FOUND",CONFIG_NOT_FOUND:"CONFIG_NOT_FOUND",MESSAGE_SAVE_ERROR:"MESSAGE_SAVE_ERROR",GIT_NOT_FOUND:"GIT_NOT_FOUND",NOT_GIT_REPO:"NOT_GIT_REPO",COMMAND_FAILED:"COMMAND_FAILED",INVALID_PATH:"INVALID_PATH"};Se(Object.values(kb));const zb=["INTERNAL_ERROR","API_KEY_MISSING","RATE_LIMITED"],Vr=R().uuid(),Ph={createdAt:R().datetime(),updatedAt:R().datetime()},Vo={createdAt:R().datetime()};function ti(l){return[...zb,...l]}function ai(l,i){const s=ti(l),u=Se(s),o=J({message:R(),code:u});return i?.includeDetails?o.extend({details:R().optional()}):o}const Ub=J({type:at("chunk"),content:R()}),Hb=l=>J({type:at("error"),error:l});function eg(l,i){return sl("type",[Ub,J({type:at("complete"),...l}),Hb(i)])}const Gb=["blocker","high","medium","low","nit"],Zr=Se(Gb),Bb=["correctness","security","performance","api","tests","readability","style"],Vb=Se(Bb),Zb=["code","doc","trace","external"],Kb=Se(Zb),Yb=J({type:Kb,title:R(),sourceId:R(),file:R().optional(),range:J({start:fe(),end:fe()}).optional(),excerpt:R(),sha:R().optional()}),tg=J({step:fe(),tool:R(),inputSummary:R(),outputSummary:R(),timestamp:R(),artifacts:He(R()).optional()}),qb=J({step:fe(),action:R(),files:He(R()).optional(),risk:Se(["low","medium","high"]).optional()}),Fb=J({author:R(),authorEmail:R(),commit:R(),commitDate:R(),summary:R()}),Xb=J({beforeLines:He(R()),afterLines:He(R()),totalContext:fe()}),Qb=J({blame:Fb.nullable(),context:Xb.nullable(),enrichedAt:R()}),Zo=J({id:R(),severity:Zr,category:Vb,title:R(),file:R(),line_start:fe().nullable(),line_end:fe().nullable(),rationale:R(),recommendation:R(),suggested_patch:R().nullable(),confidence:fe().min(0).max(1),symptom:R(),whyItMatters:R(),fixPlan:He(qb).optional(),betterOptions:He(R()).optional(),testsToAdd:He(R()).optional(),evidence:He(Yb),trace:He(tg).optional(),enrichment:Qb.optional()}),ag=J({summary:R(),issues:He(Zo)}),ng=["NO_DIFF","AI_ERROR","GENERATION_FAILED"],$b=ti(ng);Se($b);const Jb=ai(ng),Wb=sl("type",[J({type:at("chunk"),content:R()}),J({type:at("lens_start"),lens:R(),index:fe(),total:fe()}),J({type:at("lens_complete"),lens:R()}),J({type:at("complete"),result:ag,reviewId:R(),durationMs:fe().optional()}).passthrough(),J({type:at("error"),error:Jb})]),Oo=J({minSeverity:Zr});J({profile:Mb(()=>J({id:R(),name:R(),description:R(),lenses:He(R()),filter:Oo.optional()})).optional(),lenses:He(R()).optional(),filter:Oo.optional()});const Ql=["blocker","high","medium","low","nit"],Pb=Ql.filter(l=>l!=="nit"),yh=J({key:R(),label:R(),disabled:ot().optional()});J({keys:He(yh),menu:He(yh)});J({id:R(),name:R(),icon:R(),iconColor:R().optional(),count:fe(),change:fe()});const ex=["system","tool","lens","warning","error","agent","thinking"],tx=Se(ex);J({id:R(),timestamp:Wh([Ob(),R()]),tag:R(),tagType:tx.optional(),message:R(),isWarning:ot().optional(),source:R().optional(),isError:ot().optional()});const ax=["completed","active","pending"],nx=Se(ax),lx=J({id:R(),emoji:R(),label:R(),status:Se(["pending","active","completed"])});J({id:R(),label:R(),status:nx,substeps:He(lx).optional()});J({runId:R(),totalIssues:fe(),filesAnalyzed:fe(),criticalCount:fe()});J({blocker:fe(),high:fe(),medium:fe(),low:fe(),nit:fe()});J({id:R(),title:R(),file:R(),line:fe(),category:R(),severity:Zr});J({trustedDir:R().optional(),providerName:R().optional(),providerMode:R().optional(),lastRunId:R().optional(),lastRunIssueCount:fe().optional()});const ix=["success","error","warning","info"],sx=Se(ix);J({id:R(),message:R(),variant:sx.optional(),duration:fe().optional()});const rx=["details","explain","trace","patch"];Se(rx);J({id:R(),label:R(),count:fe()});const ux=["normal","added","removed","highlight"],cx=Se(ux);J({number:fe(),content:R(),type:cx.optional()});J({key:R(),header:R(),width:Wh([fe(),R()]).optional()});J({id:R(),disabled:ot().optional(),index:fe()});const ox=["paste","input","env","cancel","confirm","remove"];Se(ox);const dx=["search","filters","list","footer"];Se(dx);const fx="█",_x="░",bh=20,ei={blocker:{icon:"✖",color:"text-tui-red",label:"BLOCKER",borderColor:"border-tui-red"},high:{icon:"▲",color:"text-tui-yellow",label:"HIGH",borderColor:"border-tui-yellow"},medium:{icon:"●",color:"text-gray-400",label:"MED",borderColor:"border-gray-400"},low:{icon:"○",color:"text-tui-blue",label:"LOW",borderColor:"border-tui-blue"},nit:{icon:"·",color:"text-gray-500",label:"NIT",borderColor:"border-gray-500"}};function lg(l){const i={blocker:0,high:0,medium:0,low:0,nit:0};for(const s of l)i[s.severity]++;return i}function mx(l,i="short"){const s=Math.floor(l/1e3),u=Math.floor(s/3600),o=Math.floor(s%3600/60),f=s%60;return i==="long"?`${u.toString().padStart(2,"0")}:${o.toString().padStart(2,"0")}:${f.toString().padStart(2,"0")}`:`${o.toString().padStart(2,"0")}:${f.toString().padStart(2,"0")}`}function hx(l){if(typeof l=="string")return l;const i=l.getHours().toString().padStart(2,"0"),s=l.getMinutes().toString().padStart(2,"0"),u=l.getSeconds().toString().padStart(2,"0");return`${i}:${s}:${u}`}function gx(l){let i=l.trim();return i.startsWith("```json")?i=i.slice(7):i.startsWith("```")&&(i=i.slice(3)),i.endsWith("```")&&(i=i.slice(0,-3)),i.trim()}function px(l,i){const s=gx(l);try{return Fh(JSON.parse(s))}catch(u){const o=u instanceof Error?u.message:void 0;return Wn(i("Invalid JSON",o))}}const vx=1024*1024;function xh(l){if(!l.startsWith("data: "))return;const i=l.slice(6),s=px(i,(u,o)=>{console.debug(`Failed to parse SSE event: ${wr(i,100)}${o?` (${o})`:""}`)});return s.ok?s.value:void 0}function Sh(l,i,s){if(s){const u=s(l);u!==void 0&&i(u)}else i(l)}async function yx(l,i){const{onEvent:s,parseEvent:u,onBufferOverflow:o}=i,f=new TextDecoder;let _="",h=0,p=0,v=0;for(console.log("[SSE:STREAM_START]");;){const{done:y,value:T}=await l.read();if(y){console.log("[SSE:STREAM_DONE] chunks:",h,"lines:",p,"events:",v);break}h++;const E=f.decode(T,{stream:!0});if(console.log("[SSE:CHUNK]",h,"size:",E.length,"preview:",wr(E.replace(/\n/g,"\\n"),150)),_+=E,_.length>vx)return console.error("[SSE:BUFFER_OVERFLOW] size:",_.length),l.cancel(),o?.(),{completed:!1};const U=_.split(`
`);_=U.pop()??"";for(const I of U){p++,I.trim()&&console.log("[SSE:LINE]",p,"content:",wr(I,150));const D=xh(I);D!==void 0&&(v++,console.log("[SSE:PARSED]",v,"type:",D?.type),Sh(D,s,u))}}if(_.trim()){console.log("[SSE:FINAL_BUFFER]",wr(_,150));const y=xh(_);y!==void 0&&(v++,Sh(y,s,u))}return console.log("[SSE:STREAM_COMPLETE] total chunks:",h,"lines:",p,"events:",v),{completed:!0}}const bx=[{id:"review-unstaged",label:"Review Unstaged",shortcut:"r",group:"review"},{id:"review-staged",label:"Review Staged",shortcut:"R",group:"review"},{id:"review-files",label:"Review Files...",shortcut:"f",group:"review"},{id:"resume-review",label:"Resume Last Review",shortcut:"l",group:"review"},{id:"history",label:"History",shortcut:"h",group:"navigation"},{id:"settings",label:"Settings",shortcut:"s",group:"navigation"},{id:"help",label:"Help",shortcut:"?",group:"system"},{id:"quit",label:"Quit",shortcut:"q",variant:"danger",group:"system"}],xx=[{id:"trust",label:"Trust & Permissions",description:"Manage directory trust and capabilities"},{id:"theme",label:"Theme",description:"Change color theme preferences"},{id:"provider",label:"Provider",description:"Select AI provider for code review"},{id:"diagnostics",label:"Diagnostics",description:"Run system health checks"}],Sx=[{key:"↑/↓",label:"Select"},{key:"Enter",label:"Open"},{key:"q",label:"Quit"}],Tx=[{key:"↑/↓",label:"Select"},{key:"Enter",label:"Edit"},{key:"Esc",label:"Back"}],Ex=["correctness","security","performance","simplicity","tests"],ni=Se(Ex),Ax=J({blocker:R(),high:R(),medium:R(),low:R(),nit:R()});J({id:ni,name:R(),description:R(),systemPrompt:R(),severityRubric:Ax});const Rx=["quick","strict","perf","security"],Ko=Se(Rx);J({id:Ko,name:R(),description:R(),lenses:He(ni),filter:Oo.optional()});const Nx=J({issueId:R(),issue:Zo,detailedAnalysis:R(),rootCause:R(),impact:R(),suggestedFix:R(),patch:R().nullable(),relatedIssues:He(R()),references:He(R()),trace:He(tg).optional()}),ig=["NO_DIFF","AI_ERROR","LENS_NOT_FOUND","PROFILE_NOT_FOUND"],Cx=ti(ig);Se(Cx);ai(ig);const wx=["detective","guardian","optimizer","simplifier","tester"],rl=Se(wx),sg=J({id:rl,lens:ni,name:R(),emoji:R(),description:R()}),Lx={detective:{id:"detective",lens:"correctness",name:"Detective",emoji:"🔍",description:"Finds bugs and logic errors"},guardian:{id:"guardian",lens:"security",name:"Guardian",emoji:"🔒",description:"Identifies security vulnerabilities"},optimizer:{id:"optimizer",lens:"performance",name:"Optimizer",emoji:"⚡",description:"Spots performance bottlenecks"},simplifier:{id:"simplifier",lens:"simplicity",name:"Simplifier",emoji:"✨",description:"Reduces complexity and improves readability"},tester:{id:"tester",lens:"tests",name:"Tester",emoji:"🧪",description:"Evaluates test coverage and quality"}},jx=["queued","running","complete"],Ox=Se(jx);Se(["system","tool","lens","agent"]);const rg=J({type:at("file_start"),file:R(),index:fe(),total:fe(),timestamp:R()}).passthrough(),ug=J({type:at("file_complete"),file:R(),index:fe(),total:fe(),timestamp:R()}).passthrough(),cg=J({type:at("agent_start"),agent:sg,timestamp:R()}).passthrough(),og=J({type:at("agent_thinking"),agent:rl,thought:R(),timestamp:R()}).passthrough(),dg=J({type:at("tool_call"),agent:rl,tool:R(),input:R(),timestamp:R()}).passthrough(),fg=J({type:at("tool_result"),agent:rl,tool:R(),summary:R(),timestamp:R()}).passthrough(),_g=J({type:at("issue_found"),agent:rl,issue:J({id:R(),severity:R(),category:R(),title:R(),file:R()}).passthrough(),timestamp:R()}).passthrough(),mg=J({type:at("agent_complete"),agent:rl,issueCount:fe(),timestamp:R()}).passthrough(),Ix=J({lensId:ni,issueCount:fe(),status:Se(["success","failed"])}),hg=J({type:at("orchestrator_complete"),summary:R(),totalIssues:fe(),lensStats:He(Ix),filesAnalyzed:fe(),timestamp:R()}).passthrough();sl("type",[rg,ug,cg,og,dg,fg,_g,mg,hg]);J({id:rl,meta:sg,status:Ox,progress:fe().min(0).max(100),issueCount:fe(),currentAction:R().optional(),lastToolCall:R().optional()});const gg=["diff","triage","enrich","report"],Kr=Se(gg),Mx=["pending","active","completed","error"],Dx=Se(Mx),Lr={diff:{label:"Collect diff",description:"Gathering code changes"},triage:{label:"Triage issues",description:"Analyzing with lenses"},enrich:{label:"Enrich context",description:"Adding git blame and context"},report:{label:"Generate report",description:"Synthesizing final report"}},pg=J({type:at("step_start"),step:Kr,timestamp:R()}),vg=J({type:at("step_complete"),step:Kr,timestamp:R()}),yg=J({type:at("step_error"),step:Kr,error:R(),timestamp:R()}),bg=J({type:at("review_started"),reviewId:R(),filesTotal:fe(),timestamp:R()});sl("type",[bg,pg,vg,yg]);J({id:Kr,label:R(),status:Dx});function kx(){return gg.map(l=>({id:l,label:Lr[l].label,status:"pending"}))}function zx(l){if(!l||typeof l!="object")return!1;const i=l.type;return i==="review_started"||i==="step_start"||i==="step_complete"||i==="step_error"}function Io(){return{steps:kx(),agents:[],issues:[],events:[],fileProgress:{total:0,current:0,currentFile:null,completed:new Set},isStreaming:!1,error:null,startedAt:null}}function oo(l,i,s){return l.map(u=>u.id===i?{...u,status:s}:u)}function Th(l,i){if(i.type==="agent_start"){const s={id:i.agent.id,meta:i.agent,status:"running",progress:50,issueCount:0,currentAction:"Starting..."},u=l.findIndex(o=>o.id===i.agent.id);if(u>=0){const o=[...l];return o[u]=s,o}return[...l,s]}return i.type==="agent_thinking"?l.map(s=>s.id===i.agent?{...s,currentAction:i.thought}:s):i.type==="tool_call"?l.map(s=>s.id===i.agent?{...s,currentAction:`Using tool: ${i.tool}`}:s):i.type==="agent_complete"?l.map(s=>s.id===i.agent?{...s,status:"complete",issueCount:i.issueCount,currentAction:"Completed",progress:100}:s):l}function Ux(l,i){return i.type==="issue_found"&&i.issue?[...l,i.issue]:l}function Hx(l){const i=l.indexOf(":");return i===-1?l:l.substring(0,i)}function Gx(l){return l.type==="enrich_progress"}function fo(l,i){switch(i.type){case"START":return{...Io(),isStreaming:!0};case"EVENT":{const s=i.event;if(zx(s))return s.type==="review_started"?{...l,fileProgress:{...l.fileProgress,total:s.filesTotal},startedAt:new Date(s.timestamp),events:[...l.events,s]}:s.type==="step_start"?{...l,steps:oo(l.steps,s.step,"active"),events:[...l.events,s]}:s.type==="step_complete"?{...l,steps:oo(l.steps,s.step,"completed"),events:[...l.events,s]}:s.type==="step_error"?{...l,steps:oo(l.steps,s.step,"error"),events:[...l.events,s],error:s.error,isStreaming:!1}:l;if(s.type==="file_start")return{...l,fileProgress:{...l.fileProgress,current:s.index,currentFile:s.file},events:[...l.events,s]};if(s.type==="file_complete"){const u=new Set(l.fileProgress.completed);return u.add(s.file),{...l,fileProgress:{...l.fileProgress,completed:u,currentFile:null},events:[...l.events,s]}}if(Gx(s))return{...l,events:[...l.events,s]};if(s.type==="tool_call"&&s.tool==="readFileContext"){const u=new Set(l.fileProgress.completed);return u.add(Hx(s.input)),{...l,agents:Th(l.agents,s),fileProgress:{...l.fileProgress,completed:u},events:[...l.events,s]}}return s.type==="orchestrator_complete"&&s.filesAnalyzed?{...l,fileProgress:{...l.fileProgress,total:s.filesAnalyzed},events:[...l.events,s]}:{...l,agents:Th(l.agents,s),issues:Ux(l.issues,s),events:[...l.events,s]}}case"COMPLETE":return{...l,isStreaming:!1};case"ERROR":return{...l,isStreaming:!1,error:i.error};case"RESET":return Io();default:return l}}const xg=J({type:at("enrich_progress"),issueId:R(),enrichmentType:Se(["blame","context"]),status:Se(["started","complete","failed"]),timestamp:R()}).passthrough();sl("type",[xg]);const Bx=sl("type",[...Wb.options,cg,og,dg,fg,_g,mg,hg,rg,ug,bg,pg,vg,yg,xg]);function Vx(l){const{staged:i=!0,files:s,lenses:u,profile:o}=l,f={staged:String(i)};return s&&s.length>0&&(f.files=s.join(",")),u&&u.length>0&&(f.lenses=u.join(",")),o&&(f.profile=o),f}async function Sg(l,i){const{onAgentEvent:s,onStepEvent:u,onEnrichEvent:o,onChunk:f,onLensStart:_,onLensComplete:h}=i,p=[];let v=null,y=null,T=null;return await yx(l,{parseEvent(E){const U=Bx.safeParse(E);return U.success?U.data:void 0},onEvent(E){switch(E.type){case"review_started":y=E.reviewId,u?.(E);break;case"step_start":case"step_complete":case"step_error":u?.(E);break;case"agent_start":case"agent_thinking":case"tool_call":case"tool_result":case"issue_found":case"agent_complete":case"orchestrator_complete":case"file_start":case"file_complete":p.push(E),s?.(E);break;case"enrich_progress":o?.(E);break;case"chunk":f?.(E.content);break;case"lens_start":_?.(E.lens,E.index,E.total);break;case"lens_complete":h?.(E.lens);break;case"complete":v=E.result,y=E.reviewId;break;case"error":T=E.error;break}}}),T?Wn(T):!v||!y?Wn({code:"STREAM_ERROR",message:"Stream ended without complete event"}):Fh({result:v,reviewId:y,agentEvents:p})}function Zx(l,i){return i==="all"?l:l.filter(s=>s.severity===i)}function _o(l,i){return l.length<=i?l:l.slice(0,i-3)+"..."}function mo(l){const i=Lx[l];return{emoji:i?.emoji??"🤖",name:i?.name??l}}function Eh(l,i){return`${l} ${i}${l===1?"":"s"}`}function Kx(l,i){const s=`${l.type}-${i}`,{timestamp:u}=l;if(l.type==="step_start"){const o=Lr[l.step];return{id:s,timestamp:u,tag:"STEP",tagType:"system",message:`${o.label}: ${o.description}`}}if(l.type==="step_complete"){const o=Lr[l.step];return{id:s,timestamp:u,tag:"✓",tagType:"system",message:`${o.label} complete`}}if(l.type==="step_error"){const o=Lr[l.step];return{id:s,timestamp:u,tag:"ERROR",tagType:"error",message:`${o.label} failed: ${l.error}`,isWarning:!0}}if(l.type==="review_started")return{id:s,timestamp:u,tag:"START",tagType:"system",message:`Review started: ${l.filesTotal} file${l.filesTotal===1?"":"s"} to analyze`};switch(l.type){case"file_start":return{id:s,timestamp:u,tag:"FILE",tagType:"system",message:`Analyzing ${l.file} (${l.index+1}/${l.total})`};case"file_complete":return{id:s,timestamp:u,tag:"✓",tagType:"system",message:`${l.file} complete`};case"agent_start":return{id:s,timestamp:u,tag:`${l.agent.emoji} ${l.agent.name}`,tagType:"lens",message:"Starting analysis..."};case"agent_thinking":{const{emoji:o}=mo(l.agent);return{id:s,timestamp:u,tag:o,tagType:"system",message:_o(l.thought,100)}}case"tool_call":return{id:s,timestamp:u,tag:"TOOL",tagType:"tool",message:`${l.tool}: ${_o(l.input,60)}`,source:l.tool};case"tool_result":return{id:s,timestamp:u,tag:"TOOL",tagType:"tool",message:_o(l.summary,100),source:l.tool};case"issue_found":{const{emoji:o,name:f}=mo(l.agent);return{id:s,timestamp:u,tag:o,tagType:"warning",message:`Found: ${l.issue.title}`,isWarning:!0,source:f}}case"agent_complete":{const{emoji:o,name:f}=mo(l.agent);return{id:s,timestamp:u,tag:`${o} ${f}`,tagType:"lens",message:`Complete (${Eh(l.issueCount,"issue")})`}}case"orchestrator_complete":return{id:s,timestamp:u,tag:"✅",tagType:"system",message:`Review complete: ${Eh(l.totalIssues,"issue")} found`};default:return null}}function Yx(l){return l.map(Kx).filter(i=>i!==null)}async function qx(l,{staged:i=!0,files:s,lenses:u,profile:o,signal:f}={}){const _=Vx({staged:i,files:s,lenses:u,profile:o});return l.stream("/triage/stream",{params:_,signal:f})}async function Fx(l,i){const{staged:s,files:u,lenses:o,profile:f,signal:_,...h}=i,v=(await qx(l,{staged:s,files:u,lenses:o,profile:f,signal:_})).body?.getReader();return v?Sg(v,h):Wn({code:"STREAM_ERROR",message:"No response body"})}async function Xx(l,i){const{reviewId:s,signal:u,...o}=i,f=await l.stream(`/reviews/${s}/stream`,{signal:u});if(!f.ok)return Wn({code:"NOT_FOUND",message:"Session not found"});const _=f.body?.getReader();if(!_)return Wn({code:"STREAM_ERROR",message:"No response body"});const h=await Sg(_,o);return h.ok?{ok:!0,value:void 0}:Wn(h.error)}async function Ah(l,i){return l.get(`/triage/reviews/${i}`)}async function Qx(l,i){return l.get(`/reviews/${i}`)}async function $x(l,i){return l.get(`/reviews/${i}/status`)}async function Tg(l,i){return l.delete(`/reviews/${i}`)}const Jx="127.0.0.1",Wx=3e3;function Px(){return`http://${Jx}:${Wx}`}const e0=Px(),lt=ib({baseUrl:e0});function t0(){const[l,i]=b.useState(!1),[s,u]=b.useState(!0),[o,f]=b.useState(null),_=b.useCallback(async()=>{u(!0);try{await lt.request("GET","/health"),i(!0),f(null)}catch(h){i(!1),f(h instanceof Error?h.message:"Failed to connect to server")}finally{u(!1)}},[]);return b.useEffect(()=>{_();const h=setInterval(_,3e4);return()=>clearInterval(h)},[_]),{connected:l,isChecking:s,error:o,retry:_}}async function ho(){return(await lt.get("/config/providers")).providers}async function Eg(l){await lt.post("/config",l)}async function a0(){return lt.get("/settings")}async function n0(l){await lt.post("/settings",l)}async function l0(l,i){return lt.post(`/config/provider/${l}/activate`,i?{model:i}:void 0)}async function i0(l){return lt.delete(`/config/provider/${l}`)}async function s0(){return lt.get("/config/init")}function r0(l){const i=window.matchMedia("(prefers-color-scheme: dark)");return i.addEventListener("change",l),()=>i.removeEventListener("change",l)}function u0(){return typeof window>"u"||window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}const go="stargazer-theme",Ag=b.createContext(null);function c0({children:l}){const[i,s]=b.useState(()=>{if(typeof window>"u")return"auto";const _=localStorage.getItem(go);return _==="dark"||_==="light"||_==="auto"?_:"auto"}),u=b.useSyncExternalStore(r0,u0,()=>"dark"),o=i==="auto"?u:i;b.useEffect(()=>{const _=h=>["light","dark","auto"].includes(h);a0().then(h=>{if(h?.theme){const p=h.theme==="terminal"?"dark":_(h.theme)?h.theme:"auto";s(p),localStorage.setItem(go,p)}}).catch(()=>{})},[]),b.useEffect(()=>{document.documentElement.setAttribute("data-theme",o)},[o]);const f=_=>{s(_),localStorage.setItem(go,_),n0({theme:_}).catch(h=>{console.error("Failed to sync theme to server:",h)})};return d.jsx(Ag.Provider,{value:{theme:i,resolved:o,setTheme:f},children:l})}let $l=null;function o0(){return $l?Date.now()-$l.timestamp>sb?($l=null,null):$l.data:null}function Er(l){$l={data:l,timestamp:Date.now()}}function po(){$l=null}const Rg=b.createContext(void 0);function d0({children:l}){const[i,s]=b.useState(),[u,o]=b.useState(),[f,_]=b.useState(!1),[h,p]=b.useState(!0),[v,y]=b.useState(!1),[T,E]=b.useState(null),[U,I]=b.useState([]),D=b.useCallback(async()=>{p(!0),E(null);try{const q=o0();if(q)s(q.provider),o(q.model),I(q.providers),_(q.providers.some(ie=>ie.isActive));else{const ie=await s0();ie.config?(s(ie.config.provider),o(ie.config.model)):(s(void 0),o(void 0)),_(ie.configured),I(ie.providers),Er({provider:ie.config?.provider,model:ie.config?.model,providers:ie.providers})}}catch(q){E(q instanceof Error?q.message:"Failed to load configuration")}finally{p(!1)}},[]),K=b.useCallback(async(q,ie)=>{y(!0),E(null);try{po();const te=await l0(q,ie),ge=await ho();s(te.provider),o(te.model),_(!0),I(ge),Er({provider:te.provider,model:te.model,providers:ge})}catch(te){throw E(te instanceof Error?te.message:"Failed to activate provider"),te}finally{y(!1)}},[]),le=b.useCallback(async(q,ie,te)=>{y(!0),E(null);try{po(),await Eg({provider:q,apiKey:ie,model:te});const ge=await ho();s(q),o(te),_(!0),I(ge),Er({provider:q,model:te,providers:ge})}catch(ge){throw E(ge instanceof Error?ge.message:"Failed to save credentials"),ge}finally{y(!1)}},[]),ve=b.useCallback(async q=>{y(!0),E(null);try{po(),await i0(q);const ie=await ho(),te=i===q;te&&(s(void 0),o(void 0),_(!1)),I(ie),Er({provider:te?void 0:i,model:te?void 0:u,providers:ie})}catch(ie){throw E(ie instanceof Error?ie.message:"Failed to delete provider credentials"),ie}finally{y(!1)}},[i,u]);b.useEffect(()=>{D()},[D]);const ae={provider:i,model:u,isConfigured:f,isLoading:h,isSaving:v,error:T,providerStatus:U,refresh:D,activateProvider:K,saveCredentials:le,deleteProviderCredentials:ve};return d.jsx(Rg.Provider,{value:ae,children:l})}function f0(){const l=b.useContext(Rg);if(l===void 0)throw new Error("useConfigContext must be used within a ConfigProvider");return l}const _0={up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright",esc:"escape",space:" "};function m0(l,i){const s=i.toLowerCase().split("+"),u=s.pop()??"",o=new Set(s),f=_0[u]??u;return l.key.toLowerCase()===f&&l.ctrlKey===o.has("ctrl")&&l.metaKey===o.has("meta")&&l.shiftKey===o.has("shift")&&l.altKey===o.has("alt")}function h0(l){if(!l||!(l instanceof HTMLElement))return!1;const i=l.tagName.toLowerCase();return i==="input"||i==="textarea"||i==="select"||l.isContentEditable}const Ng=b.createContext(null);function g0({children:l}){const[i,s]=b.useState(["global"]),[u]=b.useState(()=>new Map),o=i[i.length-1]??null,f=b.useCallback(p=>(s(v=>[...v,p]),()=>s(v=>{const y=v.lastIndexOf(p);return y>=0?[...v.slice(0,y),...v.slice(y+1)]:v})),[]);b.useEffect(()=>{function p(v){if(!o)return;const y=u.get(o);if(!y)return;const T=h0(v.target);for(const[E,U]of y)if(!(T&&!U.options?.allowInInput)&&m0(v,E)){v.preventDefault(),U.handler();break}}return window.addEventListener("keydown",p),()=>window.removeEventListener("keydown",p)},[o,u]);const _=b.useCallback((p,v,y,T)=>(u.has(p)||u.set(p,new Map),u.get(p).set(v,{handler:y,options:T}),()=>u.get(p)?.delete(v)),[u]),h=b.useMemo(()=>({activeScope:o,pushScope:f,register:_}),[o,f,_]);return d.jsx(Ng.Provider,{value:h,children:l})}const p0={theme:"auto",resolved:"dark",setTheme:()=>{}};function v0(){return b.useContext(Ag)??p0}function y0({children:l}){return d.jsx(c0,{children:d.jsx(d0,{children:d.jsx(g0,{children:l})})})}function Yr(){const l=f0();return{...l,updateConfig:async s=>{await Eg(s),await l.refresh()}}}function Cg(l){var i,s,u="";if(typeof l=="string"||typeof l=="number")u+=l;else if(typeof l=="object")if(Array.isArray(l)){var o=l.length;for(i=0;i<o;i++)l[i]&&(s=Cg(l[i]))&&(u&&(u+=" "),u+=s)}else for(s in l)l[s]&&(u&&(u+=" "),u+=s);return u}function wg(){for(var l,i,s=0,u="",o=arguments.length;s<o;s++)(l=arguments[s])&&(i=Cg(l))&&(u&&(u+=" "),u+=i);return u}const Rh=l=>typeof l=="boolean"?`${l}`:l===0?"0":l,Nh=wg,St=(l,i)=>s=>{var u;if(i?.variants==null)return Nh(l,s?.class,s?.className);const{variants:o,defaultVariants:f}=i,_=Object.keys(o).map(v=>{const y=s?.[v],T=f?.[v];if(y===null)return null;const E=Rh(y)||Rh(T);return o[v][E]}),h=s&&Object.entries(s).reduce((v,y)=>{let[T,E]=y;return E===void 0||(v[T]=E),v},{}),p=i==null||(u=i.compoundVariants)===null||u===void 0?void 0:u.reduce((v,y)=>{let{class:T,className:E,...U}=y;return Object.entries(U).every(I=>{let[D,K]=I;return Array.isArray(K)?K.includes({...f,...h}[D]):{...f,...h}[D]===K})?[...v,T,E]:v},[]);return Nh(l,_,p,s?.class,s?.className)},b0=(l,i)=>{const s=new Array(l.length+i.length);for(let u=0;u<l.length;u++)s[u]=l[u];for(let u=0;u<i.length;u++)s[l.length+u]=i[u];return s},x0=(l,i)=>({classGroupId:l,validator:i}),Lg=(l=new Map,i=null,s)=>({nextPart:l,validators:i,classGroupId:s}),Br="-",Ch=[],S0="arbitrary..",T0=l=>{const i=A0(l),{conflictingClassGroups:s,conflictingClassGroupModifiers:u}=l;return{getClassGroupId:_=>{if(_.startsWith("[")&&_.endsWith("]"))return E0(_);const h=_.split(Br),p=h[0]===""&&h.length>1?1:0;return jg(h,p,i)},getConflictingClassGroupIds:(_,h)=>{if(h){const p=u[_],v=s[_];return p?v?b0(v,p):p:v||Ch}return s[_]||Ch}}},jg=(l,i,s)=>{if(l.length-i===0)return s.classGroupId;const o=l[i],f=s.nextPart.get(o);if(f){const v=jg(l,i+1,f);if(v)return v}const _=s.validators;if(_===null)return;const h=i===0?l.join(Br):l.slice(i).join(Br),p=_.length;for(let v=0;v<p;v++){const y=_[v];if(y.validator(h))return y.classGroupId}},E0=l=>l.slice(1,-1).indexOf(":")===-1?void 0:(()=>{const i=l.slice(1,-1),s=i.indexOf(":"),u=i.slice(0,s);return u?S0+u:void 0})(),A0=l=>{const{theme:i,classGroups:s}=l;return R0(s,i)},R0=(l,i)=>{const s=Lg();for(const u in l){const o=l[u];Yo(o,s,u,i)}return s},Yo=(l,i,s,u)=>{const o=l.length;for(let f=0;f<o;f++){const _=l[f];N0(_,i,s,u)}},N0=(l,i,s,u)=>{if(typeof l=="string"){C0(l,i,s);return}if(typeof l=="function"){w0(l,i,s,u);return}L0(l,i,s,u)},C0=(l,i,s)=>{const u=l===""?i:Og(i,l);u.classGroupId=s},w0=(l,i,s,u)=>{if(j0(l)){Yo(l(u),i,s,u);return}i.validators===null&&(i.validators=[]),i.validators.push(x0(s,l))},L0=(l,i,s,u)=>{const o=Object.entries(l),f=o.length;for(let _=0;_<f;_++){const[h,p]=o[_];Yo(p,Og(i,h),s,u)}},Og=(l,i)=>{let s=l;const u=i.split(Br),o=u.length;for(let f=0;f<o;f++){const _=u[f];let h=s.nextPart.get(_);h||(h=Lg(),s.nextPart.set(_,h)),s=h}return s},j0=l=>"isThemeGetter"in l&&l.isThemeGetter===!0,O0=l=>{if(l<1)return{get:()=>{},set:()=>{}};let i=0,s=Object.create(null),u=Object.create(null);const o=(f,_)=>{s[f]=_,i++,i>l&&(i=0,u=s,s=Object.create(null))};return{get(f){let _=s[f];if(_!==void 0)return _;if((_=u[f])!==void 0)return o(f,_),_},set(f,_){f in s?s[f]=_:o(f,_)}}},Mo="!",wh=":",I0=[],Lh=(l,i,s,u,o)=>({modifiers:l,hasImportantModifier:i,baseClassName:s,maybePostfixModifierPosition:u,isExternal:o}),M0=l=>{const{prefix:i,experimentalParseClassName:s}=l;let u=o=>{const f=[];let _=0,h=0,p=0,v;const y=o.length;for(let D=0;D<y;D++){const K=o[D];if(_===0&&h===0){if(K===wh){f.push(o.slice(p,D)),p=D+1;continue}if(K==="/"){v=D;continue}}K==="["?_++:K==="]"?_--:K==="("?h++:K===")"&&h--}const T=f.length===0?o:o.slice(p);let E=T,U=!1;T.endsWith(Mo)?(E=T.slice(0,-1),U=!0):T.startsWith(Mo)&&(E=T.slice(1),U=!0);const I=v&&v>p?v-p:void 0;return Lh(f,U,E,I)};if(i){const o=i+wh,f=u;u=_=>_.startsWith(o)?f(_.slice(o.length)):Lh(I0,!1,_,void 0,!0)}if(s){const o=u;u=f=>s({className:f,parseClassName:o})}return u},D0=l=>{const i=new Map;return l.orderSensitiveModifiers.forEach((s,u)=>{i.set(s,1e6+u)}),s=>{const u=[];let o=[];for(let f=0;f<s.length;f++){const _=s[f],h=_[0]==="[",p=i.has(_);h||p?(o.length>0&&(o.sort(),u.push(...o),o=[]),u.push(_)):o.push(_)}return o.length>0&&(o.sort(),u.push(...o)),u}},k0=l=>({cache:O0(l.cacheSize),parseClassName:M0(l),sortModifiers:D0(l),...T0(l)}),z0=/\s+/,U0=(l,i)=>{const{parseClassName:s,getClassGroupId:u,getConflictingClassGroupIds:o,sortModifiers:f}=i,_=[],h=l.trim().split(z0);let p="";for(let v=h.length-1;v>=0;v-=1){const y=h[v],{isExternal:T,modifiers:E,hasImportantModifier:U,baseClassName:I,maybePostfixModifierPosition:D}=s(y);if(T){p=y+(p.length>0?" "+p:p);continue}let K=!!D,le=u(K?I.substring(0,D):I);if(!le){if(!K){p=y+(p.length>0?" "+p:p);continue}if(le=u(I),!le){p=y+(p.length>0?" "+p:p);continue}K=!1}const ve=E.length===0?"":E.length===1?E[0]:f(E).join(":"),ae=U?ve+Mo:ve,q=ae+le;if(_.indexOf(q)>-1)continue;_.push(q);const ie=o(le,K);for(let te=0;te<ie.length;++te){const ge=ie[te];_.push(ae+ge)}p=y+(p.length>0?" "+p:p)}return p},H0=(...l)=>{let i=0,s,u,o="";for(;i<l.length;)(s=l[i++])&&(u=Ig(s))&&(o&&(o+=" "),o+=u);return o},Ig=l=>{if(typeof l=="string")return l;let i,s="";for(let u=0;u<l.length;u++)l[u]&&(i=Ig(l[u]))&&(s&&(s+=" "),s+=i);return s},G0=(l,...i)=>{let s,u,o,f;const _=p=>{const v=i.reduce((y,T)=>T(y),l());return s=k0(v),u=s.cache.get,o=s.cache.set,f=h,h(p)},h=p=>{const v=u(p);if(v)return v;const y=U0(p,s);return o(p,y),y};return f=_,(...p)=>f(H0(...p))},B0=[],vt=l=>{const i=s=>s[l]||B0;return i.isThemeGetter=!0,i},Mg=/^\[(?:(\w[\w-]*):)?(.+)\]$/i,Dg=/^\((?:(\w[\w-]*):)?(.+)\)$/i,V0=/^\d+\/\d+$/,Z0=/^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,K0=/\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,Y0=/^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,q0=/^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,F0=/^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,ql=l=>V0.test(l),je=l=>!!l&&!Number.isNaN(Number(l)),En=l=>!!l&&Number.isInteger(Number(l)),vo=l=>l.endsWith("%")&&je(l.slice(0,-1)),Ka=l=>Z0.test(l),X0=()=>!0,Q0=l=>K0.test(l)&&!Y0.test(l),kg=()=>!1,$0=l=>q0.test(l),J0=l=>F0.test(l),W0=l=>!ce(l)&&!oe(l),P0=l=>li(l,Hg,kg),ce=l=>Mg.test(l),Qn=l=>li(l,Gg,Q0),yo=l=>li(l,lS,je),jh=l=>li(l,zg,kg),eS=l=>li(l,Ug,J0),Ar=l=>li(l,Bg,$0),oe=l=>Dg.test(l),Pi=l=>ii(l,Gg),tS=l=>ii(l,iS),Oh=l=>ii(l,zg),aS=l=>ii(l,Hg),nS=l=>ii(l,Ug),Rr=l=>ii(l,Bg,!0),li=(l,i,s)=>{const u=Mg.exec(l);return u?u[1]?i(u[1]):s(u[2]):!1},ii=(l,i,s=!1)=>{const u=Dg.exec(l);return u?u[1]?i(u[1]):s:!1},zg=l=>l==="position"||l==="percentage",Ug=l=>l==="image"||l==="url",Hg=l=>l==="length"||l==="size"||l==="bg-size",Gg=l=>l==="length",lS=l=>l==="number",iS=l=>l==="family-name",Bg=l=>l==="shadow",sS=()=>{const l=vt("color"),i=vt("font"),s=vt("text"),u=vt("font-weight"),o=vt("tracking"),f=vt("leading"),_=vt("breakpoint"),h=vt("container"),p=vt("spacing"),v=vt("radius"),y=vt("shadow"),T=vt("inset-shadow"),E=vt("text-shadow"),U=vt("drop-shadow"),I=vt("blur"),D=vt("perspective"),K=vt("aspect"),le=vt("ease"),ve=vt("animate"),ae=()=>["auto","avoid","all","avoid-page","page","left","right","column"],q=()=>["center","top","bottom","left","right","top-left","left-top","top-right","right-top","bottom-right","right-bottom","bottom-left","left-bottom"],ie=()=>[...q(),oe,ce],te=()=>["auto","hidden","clip","visible","scroll"],ge=()=>["auto","contain","none"],ne=()=>[oe,ce,p],Xe=()=>[ql,"full","auto",...ne()],yt=()=>[En,"none","subgrid",oe,ce],dt=()=>["auto",{span:["full",En,oe,ce]},En,oe,ce],Ie=()=>[En,"auto",oe,ce],rt=()=>["auto","min","max","fr",oe,ce],nt=()=>["start","end","center","between","around","evenly","stretch","baseline","center-safe","end-safe"],ye=()=>["start","end","center","stretch","center-safe","end-safe"],H=()=>["auto",...ne()],B=()=>[ql,"auto","full","dvw","dvh","lvw","lvh","svw","svh","min","max","fit",...ne()],Q=()=>[l,oe,ce],Le=()=>[...q(),Oh,jh,{position:[oe,ce]}],Ge=()=>["no-repeat",{repeat:["","x","y","space","round"]}],Te=()=>["auto","cover","contain",aS,P0,{size:[oe,ce]}],L=()=>[vo,Pi,Qn],N=()=>["","none","full",v,oe,ce],x=()=>["",je,Pi,Qn],w=()=>["solid","dashed","dotted","double"],X=()=>["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity"],F=()=>[je,vo,Oh,jh],ee=()=>["","none",I,oe,ce],z=()=>["none",je,oe,ce],$=()=>["none",je,oe,ce],re=()=>[je,oe,ce],he=()=>[ql,"full",...ne()];return{cacheSize:500,theme:{animate:["spin","ping","pulse","bounce"],aspect:["video"],blur:[Ka],breakpoint:[Ka],color:[X0],container:[Ka],"drop-shadow":[Ka],ease:["in","out","in-out"],font:[W0],"font-weight":["thin","extralight","light","normal","medium","semibold","bold","extrabold","black"],"inset-shadow":[Ka],leading:["none","tight","snug","normal","relaxed","loose"],perspective:["dramatic","near","normal","midrange","distant","none"],radius:[Ka],shadow:[Ka],spacing:["px",je],text:[Ka],"text-shadow":[Ka],tracking:["tighter","tight","normal","wide","wider","widest"]},classGroups:{aspect:[{aspect:["auto","square",ql,ce,oe,K]}],container:["container"],columns:[{columns:[je,ce,oe,h]}],"break-after":[{"break-after":ae()}],"break-before":[{"break-before":ae()}],"break-inside":[{"break-inside":["auto","avoid","avoid-page","avoid-column"]}],"box-decoration":[{"box-decoration":["slice","clone"]}],box:[{box:["border","content"]}],display:["block","inline-block","inline","flex","inline-flex","table","inline-table","table-caption","table-cell","table-column","table-column-group","table-footer-group","table-header-group","table-row-group","table-row","flow-root","grid","inline-grid","contents","list-item","hidden"],sr:["sr-only","not-sr-only"],float:[{float:["right","left","none","start","end"]}],clear:[{clear:["left","right","both","none","start","end"]}],isolation:["isolate","isolation-auto"],"object-fit":[{object:["contain","cover","fill","none","scale-down"]}],"object-position":[{object:ie()}],overflow:[{overflow:te()}],"overflow-x":[{"overflow-x":te()}],"overflow-y":[{"overflow-y":te()}],overscroll:[{overscroll:ge()}],"overscroll-x":[{"overscroll-x":ge()}],"overscroll-y":[{"overscroll-y":ge()}],position:["static","fixed","absolute","relative","sticky"],inset:[{inset:Xe()}],"inset-x":[{"inset-x":Xe()}],"inset-y":[{"inset-y":Xe()}],start:[{start:Xe()}],end:[{end:Xe()}],top:[{top:Xe()}],right:[{right:Xe()}],bottom:[{bottom:Xe()}],left:[{left:Xe()}],visibility:["visible","invisible","collapse"],z:[{z:[En,"auto",oe,ce]}],basis:[{basis:[ql,"full","auto",h,...ne()]}],"flex-direction":[{flex:["row","row-reverse","col","col-reverse"]}],"flex-wrap":[{flex:["nowrap","wrap","wrap-reverse"]}],flex:[{flex:[je,ql,"auto","initial","none",ce]}],grow:[{grow:["",je,oe,ce]}],shrink:[{shrink:["",je,oe,ce]}],order:[{order:[En,"first","last","none",oe,ce]}],"grid-cols":[{"grid-cols":yt()}],"col-start-end":[{col:dt()}],"col-start":[{"col-start":Ie()}],"col-end":[{"col-end":Ie()}],"grid-rows":[{"grid-rows":yt()}],"row-start-end":[{row:dt()}],"row-start":[{"row-start":Ie()}],"row-end":[{"row-end":Ie()}],"grid-flow":[{"grid-flow":["row","col","dense","row-dense","col-dense"]}],"auto-cols":[{"auto-cols":rt()}],"auto-rows":[{"auto-rows":rt()}],gap:[{gap:ne()}],"gap-x":[{"gap-x":ne()}],"gap-y":[{"gap-y":ne()}],"justify-content":[{justify:[...nt(),"normal"]}],"justify-items":[{"justify-items":[...ye(),"normal"]}],"justify-self":[{"justify-self":["auto",...ye()]}],"align-content":[{content:["normal",...nt()]}],"align-items":[{items:[...ye(),{baseline:["","last"]}]}],"align-self":[{self:["auto",...ye(),{baseline:["","last"]}]}],"place-content":[{"place-content":nt()}],"place-items":[{"place-items":[...ye(),"baseline"]}],"place-self":[{"place-self":["auto",...ye()]}],p:[{p:ne()}],px:[{px:ne()}],py:[{py:ne()}],ps:[{ps:ne()}],pe:[{pe:ne()}],pt:[{pt:ne()}],pr:[{pr:ne()}],pb:[{pb:ne()}],pl:[{pl:ne()}],m:[{m:H()}],mx:[{mx:H()}],my:[{my:H()}],ms:[{ms:H()}],me:[{me:H()}],mt:[{mt:H()}],mr:[{mr:H()}],mb:[{mb:H()}],ml:[{ml:H()}],"space-x":[{"space-x":ne()}],"space-x-reverse":["space-x-reverse"],"space-y":[{"space-y":ne()}],"space-y-reverse":["space-y-reverse"],size:[{size:B()}],w:[{w:[h,"screen",...B()]}],"min-w":[{"min-w":[h,"screen","none",...B()]}],"max-w":[{"max-w":[h,"screen","none","prose",{screen:[_]},...B()]}],h:[{h:["screen","lh",...B()]}],"min-h":[{"min-h":["screen","lh","none",...B()]}],"max-h":[{"max-h":["screen","lh",...B()]}],"font-size":[{text:["base",s,Pi,Qn]}],"font-smoothing":["antialiased","subpixel-antialiased"],"font-style":["italic","not-italic"],"font-weight":[{font:[u,oe,yo]}],"font-stretch":[{"font-stretch":["ultra-condensed","extra-condensed","condensed","semi-condensed","normal","semi-expanded","expanded","extra-expanded","ultra-expanded",vo,ce]}],"font-family":[{font:[tS,ce,i]}],"fvn-normal":["normal-nums"],"fvn-ordinal":["ordinal"],"fvn-slashed-zero":["slashed-zero"],"fvn-figure":["lining-nums","oldstyle-nums"],"fvn-spacing":["proportional-nums","tabular-nums"],"fvn-fraction":["diagonal-fractions","stacked-fractions"],tracking:[{tracking:[o,oe,ce]}],"line-clamp":[{"line-clamp":[je,"none",oe,yo]}],leading:[{leading:[f,...ne()]}],"list-image":[{"list-image":["none",oe,ce]}],"list-style-position":[{list:["inside","outside"]}],"list-style-type":[{list:["disc","decimal","none",oe,ce]}],"text-alignment":[{text:["left","center","right","justify","start","end"]}],"placeholder-color":[{placeholder:Q()}],"text-color":[{text:Q()}],"text-decoration":["underline","overline","line-through","no-underline"],"text-decoration-style":[{decoration:[...w(),"wavy"]}],"text-decoration-thickness":[{decoration:[je,"from-font","auto",oe,Qn]}],"text-decoration-color":[{decoration:Q()}],"underline-offset":[{"underline-offset":[je,"auto",oe,ce]}],"text-transform":["uppercase","lowercase","capitalize","normal-case"],"text-overflow":["truncate","text-ellipsis","text-clip"],"text-wrap":[{text:["wrap","nowrap","balance","pretty"]}],indent:[{indent:ne()}],"vertical-align":[{align:["baseline","top","middle","bottom","text-top","text-bottom","sub","super",oe,ce]}],whitespace:[{whitespace:["normal","nowrap","pre","pre-line","pre-wrap","break-spaces"]}],break:[{break:["normal","words","all","keep"]}],wrap:[{wrap:["break-word","anywhere","normal"]}],hyphens:[{hyphens:["none","manual","auto"]}],content:[{content:["none",oe,ce]}],"bg-attachment":[{bg:["fixed","local","scroll"]}],"bg-clip":[{"bg-clip":["border","padding","content","text"]}],"bg-origin":[{"bg-origin":["border","padding","content"]}],"bg-position":[{bg:Le()}],"bg-repeat":[{bg:Ge()}],"bg-size":[{bg:Te()}],"bg-image":[{bg:["none",{linear:[{to:["t","tr","r","br","b","bl","l","tl"]},En,oe,ce],radial:["",oe,ce],conic:[En,oe,ce]},nS,eS]}],"bg-color":[{bg:Q()}],"gradient-from-pos":[{from:L()}],"gradient-via-pos":[{via:L()}],"gradient-to-pos":[{to:L()}],"gradient-from":[{from:Q()}],"gradient-via":[{via:Q()}],"gradient-to":[{to:Q()}],rounded:[{rounded:N()}],"rounded-s":[{"rounded-s":N()}],"rounded-e":[{"rounded-e":N()}],"rounded-t":[{"rounded-t":N()}],"rounded-r":[{"rounded-r":N()}],"rounded-b":[{"rounded-b":N()}],"rounded-l":[{"rounded-l":N()}],"rounded-ss":[{"rounded-ss":N()}],"rounded-se":[{"rounded-se":N()}],"rounded-ee":[{"rounded-ee":N()}],"rounded-es":[{"rounded-es":N()}],"rounded-tl":[{"rounded-tl":N()}],"rounded-tr":[{"rounded-tr":N()}],"rounded-br":[{"rounded-br":N()}],"rounded-bl":[{"rounded-bl":N()}],"border-w":[{border:x()}],"border-w-x":[{"border-x":x()}],"border-w-y":[{"border-y":x()}],"border-w-s":[{"border-s":x()}],"border-w-e":[{"border-e":x()}],"border-w-t":[{"border-t":x()}],"border-w-r":[{"border-r":x()}],"border-w-b":[{"border-b":x()}],"border-w-l":[{"border-l":x()}],"divide-x":[{"divide-x":x()}],"divide-x-reverse":["divide-x-reverse"],"divide-y":[{"divide-y":x()}],"divide-y-reverse":["divide-y-reverse"],"border-style":[{border:[...w(),"hidden","none"]}],"divide-style":[{divide:[...w(),"hidden","none"]}],"border-color":[{border:Q()}],"border-color-x":[{"border-x":Q()}],"border-color-y":[{"border-y":Q()}],"border-color-s":[{"border-s":Q()}],"border-color-e":[{"border-e":Q()}],"border-color-t":[{"border-t":Q()}],"border-color-r":[{"border-r":Q()}],"border-color-b":[{"border-b":Q()}],"border-color-l":[{"border-l":Q()}],"divide-color":[{divide:Q()}],"outline-style":[{outline:[...w(),"none","hidden"]}],"outline-offset":[{"outline-offset":[je,oe,ce]}],"outline-w":[{outline:["",je,Pi,Qn]}],"outline-color":[{outline:Q()}],shadow:[{shadow:["","none",y,Rr,Ar]}],"shadow-color":[{shadow:Q()}],"inset-shadow":[{"inset-shadow":["none",T,Rr,Ar]}],"inset-shadow-color":[{"inset-shadow":Q()}],"ring-w":[{ring:x()}],"ring-w-inset":["ring-inset"],"ring-color":[{ring:Q()}],"ring-offset-w":[{"ring-offset":[je,Qn]}],"ring-offset-color":[{"ring-offset":Q()}],"inset-ring-w":[{"inset-ring":x()}],"inset-ring-color":[{"inset-ring":Q()}],"text-shadow":[{"text-shadow":["none",E,Rr,Ar]}],"text-shadow-color":[{"text-shadow":Q()}],opacity:[{opacity:[je,oe,ce]}],"mix-blend":[{"mix-blend":[...X(),"plus-darker","plus-lighter"]}],"bg-blend":[{"bg-blend":X()}],"mask-clip":[{"mask-clip":["border","padding","content","fill","stroke","view"]},"mask-no-clip"],"mask-composite":[{mask:["add","subtract","intersect","exclude"]}],"mask-image-linear-pos":[{"mask-linear":[je]}],"mask-image-linear-from-pos":[{"mask-linear-from":F()}],"mask-image-linear-to-pos":[{"mask-linear-to":F()}],"mask-image-linear-from-color":[{"mask-linear-from":Q()}],"mask-image-linear-to-color":[{"mask-linear-to":Q()}],"mask-image-t-from-pos":[{"mask-t-from":F()}],"mask-image-t-to-pos":[{"mask-t-to":F()}],"mask-image-t-from-color":[{"mask-t-from":Q()}],"mask-image-t-to-color":[{"mask-t-to":Q()}],"mask-image-r-from-pos":[{"mask-r-from":F()}],"mask-image-r-to-pos":[{"mask-r-to":F()}],"mask-image-r-from-color":[{"mask-r-from":Q()}],"mask-image-r-to-color":[{"mask-r-to":Q()}],"mask-image-b-from-pos":[{"mask-b-from":F()}],"mask-image-b-to-pos":[{"mask-b-to":F()}],"mask-image-b-from-color":[{"mask-b-from":Q()}],"mask-image-b-to-color":[{"mask-b-to":Q()}],"mask-image-l-from-pos":[{"mask-l-from":F()}],"mask-image-l-to-pos":[{"mask-l-to":F()}],"mask-image-l-from-color":[{"mask-l-from":Q()}],"mask-image-l-to-color":[{"mask-l-to":Q()}],"mask-image-x-from-pos":[{"mask-x-from":F()}],"mask-image-x-to-pos":[{"mask-x-to":F()}],"mask-image-x-from-color":[{"mask-x-from":Q()}],"mask-image-x-to-color":[{"mask-x-to":Q()}],"mask-image-y-from-pos":[{"mask-y-from":F()}],"mask-image-y-to-pos":[{"mask-y-to":F()}],"mask-image-y-from-color":[{"mask-y-from":Q()}],"mask-image-y-to-color":[{"mask-y-to":Q()}],"mask-image-radial":[{"mask-radial":[oe,ce]}],"mask-image-radial-from-pos":[{"mask-radial-from":F()}],"mask-image-radial-to-pos":[{"mask-radial-to":F()}],"mask-image-radial-from-color":[{"mask-radial-from":Q()}],"mask-image-radial-to-color":[{"mask-radial-to":Q()}],"mask-image-radial-shape":[{"mask-radial":["circle","ellipse"]}],"mask-image-radial-size":[{"mask-radial":[{closest:["side","corner"],farthest:["side","corner"]}]}],"mask-image-radial-pos":[{"mask-radial-at":q()}],"mask-image-conic-pos":[{"mask-conic":[je]}],"mask-image-conic-from-pos":[{"mask-conic-from":F()}],"mask-image-conic-to-pos":[{"mask-conic-to":F()}],"mask-image-conic-from-color":[{"mask-conic-from":Q()}],"mask-image-conic-to-color":[{"mask-conic-to":Q()}],"mask-mode":[{mask:["alpha","luminance","match"]}],"mask-origin":[{"mask-origin":["border","padding","content","fill","stroke","view"]}],"mask-position":[{mask:Le()}],"mask-repeat":[{mask:Ge()}],"mask-size":[{mask:Te()}],"mask-type":[{"mask-type":["alpha","luminance"]}],"mask-image":[{mask:["none",oe,ce]}],filter:[{filter:["","none",oe,ce]}],blur:[{blur:ee()}],brightness:[{brightness:[je,oe,ce]}],contrast:[{contrast:[je,oe,ce]}],"drop-shadow":[{"drop-shadow":["","none",U,Rr,Ar]}],"drop-shadow-color":[{"drop-shadow":Q()}],grayscale:[{grayscale:["",je,oe,ce]}],"hue-rotate":[{"hue-rotate":[je,oe,ce]}],invert:[{invert:["",je,oe,ce]}],saturate:[{saturate:[je,oe,ce]}],sepia:[{sepia:["",je,oe,ce]}],"backdrop-filter":[{"backdrop-filter":["","none",oe,ce]}],"backdrop-blur":[{"backdrop-blur":ee()}],"backdrop-brightness":[{"backdrop-brightness":[je,oe,ce]}],"backdrop-contrast":[{"backdrop-contrast":[je,oe,ce]}],"backdrop-grayscale":[{"backdrop-grayscale":["",je,oe,ce]}],"backdrop-hue-rotate":[{"backdrop-hue-rotate":[je,oe,ce]}],"backdrop-invert":[{"backdrop-invert":["",je,oe,ce]}],"backdrop-opacity":[{"backdrop-opacity":[je,oe,ce]}],"backdrop-saturate":[{"backdrop-saturate":[je,oe,ce]}],"backdrop-sepia":[{"backdrop-sepia":["",je,oe,ce]}],"border-collapse":[{border:["collapse","separate"]}],"border-spacing":[{"border-spacing":ne()}],"border-spacing-x":[{"border-spacing-x":ne()}],"border-spacing-y":[{"border-spacing-y":ne()}],"table-layout":[{table:["auto","fixed"]}],caption:[{caption:["top","bottom"]}],transition:[{transition:["","all","colors","opacity","shadow","transform","none",oe,ce]}],"transition-behavior":[{transition:["normal","discrete"]}],duration:[{duration:[je,"initial",oe,ce]}],ease:[{ease:["linear","initial",le,oe,ce]}],delay:[{delay:[je,oe,ce]}],animate:[{animate:["none",ve,oe,ce]}],backface:[{backface:["hidden","visible"]}],perspective:[{perspective:[D,oe,ce]}],"perspective-origin":[{"perspective-origin":ie()}],rotate:[{rotate:z()}],"rotate-x":[{"rotate-x":z()}],"rotate-y":[{"rotate-y":z()}],"rotate-z":[{"rotate-z":z()}],scale:[{scale:$()}],"scale-x":[{"scale-x":$()}],"scale-y":[{"scale-y":$()}],"scale-z":[{"scale-z":$()}],"scale-3d":["scale-3d"],skew:[{skew:re()}],"skew-x":[{"skew-x":re()}],"skew-y":[{"skew-y":re()}],transform:[{transform:[oe,ce,"","none","gpu","cpu"]}],"transform-origin":[{origin:ie()}],"transform-style":[{transform:["3d","flat"]}],translate:[{translate:he()}],"translate-x":[{"translate-x":he()}],"translate-y":[{"translate-y":he()}],"translate-z":[{"translate-z":he()}],"translate-none":["translate-none"],accent:[{accent:Q()}],appearance:[{appearance:["none","auto"]}],"caret-color":[{caret:Q()}],"color-scheme":[{scheme:["normal","dark","light","light-dark","only-dark","only-light"]}],cursor:[{cursor:["auto","default","pointer","wait","text","move","help","not-allowed","none","context-menu","progress","cell","crosshair","vertical-text","alias","copy","no-drop","grab","grabbing","all-scroll","col-resize","row-resize","n-resize","e-resize","s-resize","w-resize","ne-resize","nw-resize","se-resize","sw-resize","ew-resize","ns-resize","nesw-resize","nwse-resize","zoom-in","zoom-out",oe,ce]}],"field-sizing":[{"field-sizing":["fixed","content"]}],"pointer-events":[{"pointer-events":["auto","none"]}],resize:[{resize:["none","","y","x"]}],"scroll-behavior":[{scroll:["auto","smooth"]}],"scroll-m":[{"scroll-m":ne()}],"scroll-mx":[{"scroll-mx":ne()}],"scroll-my":[{"scroll-my":ne()}],"scroll-ms":[{"scroll-ms":ne()}],"scroll-me":[{"scroll-me":ne()}],"scroll-mt":[{"scroll-mt":ne()}],"scroll-mr":[{"scroll-mr":ne()}],"scroll-mb":[{"scroll-mb":ne()}],"scroll-ml":[{"scroll-ml":ne()}],"scroll-p":[{"scroll-p":ne()}],"scroll-px":[{"scroll-px":ne()}],"scroll-py":[{"scroll-py":ne()}],"scroll-ps":[{"scroll-ps":ne()}],"scroll-pe":[{"scroll-pe":ne()}],"scroll-pt":[{"scroll-pt":ne()}],"scroll-pr":[{"scroll-pr":ne()}],"scroll-pb":[{"scroll-pb":ne()}],"scroll-pl":[{"scroll-pl":ne()}],"snap-align":[{snap:["start","end","center","align-none"]}],"snap-stop":[{snap:["normal","always"]}],"snap-type":[{snap:["none","x","y","both"]}],"snap-strictness":[{snap:["mandatory","proximity"]}],touch:[{touch:["auto","none","manipulation"]}],"touch-x":[{"touch-pan":["x","left","right"]}],"touch-y":[{"touch-pan":["y","up","down"]}],"touch-pz":["touch-pinch-zoom"],select:[{select:["none","text","all","auto"]}],"will-change":[{"will-change":["auto","scroll","contents","transform",oe,ce]}],fill:[{fill:["none",...Q()]}],"stroke-w":[{stroke:[je,Pi,Qn,yo]}],stroke:[{stroke:["none",...Q()]}],"forced-color-adjust":[{"forced-color-adjust":["auto","none"]}]},conflictingClassGroups:{overflow:["overflow-x","overflow-y"],overscroll:["overscroll-x","overscroll-y"],inset:["inset-x","inset-y","start","end","top","right","bottom","left"],"inset-x":["right","left"],"inset-y":["top","bottom"],flex:["basis","grow","shrink"],gap:["gap-x","gap-y"],p:["px","py","ps","pe","pt","pr","pb","pl"],px:["pr","pl"],py:["pt","pb"],m:["mx","my","ms","me","mt","mr","mb","ml"],mx:["mr","ml"],my:["mt","mb"],size:["w","h"],"font-size":["leading"],"fvn-normal":["fvn-ordinal","fvn-slashed-zero","fvn-figure","fvn-spacing","fvn-fraction"],"fvn-ordinal":["fvn-normal"],"fvn-slashed-zero":["fvn-normal"],"fvn-figure":["fvn-normal"],"fvn-spacing":["fvn-normal"],"fvn-fraction":["fvn-normal"],"line-clamp":["display","overflow"],rounded:["rounded-s","rounded-e","rounded-t","rounded-r","rounded-b","rounded-l","rounded-ss","rounded-se","rounded-ee","rounded-es","rounded-tl","rounded-tr","rounded-br","rounded-bl"],"rounded-s":["rounded-ss","rounded-es"],"rounded-e":["rounded-se","rounded-ee"],"rounded-t":["rounded-tl","rounded-tr"],"rounded-r":["rounded-tr","rounded-br"],"rounded-b":["rounded-br","rounded-bl"],"rounded-l":["rounded-tl","rounded-bl"],"border-spacing":["border-spacing-x","border-spacing-y"],"border-w":["border-w-x","border-w-y","border-w-s","border-w-e","border-w-t","border-w-r","border-w-b","border-w-l"],"border-w-x":["border-w-r","border-w-l"],"border-w-y":["border-w-t","border-w-b"],"border-color":["border-color-x","border-color-y","border-color-s","border-color-e","border-color-t","border-color-r","border-color-b","border-color-l"],"border-color-x":["border-color-r","border-color-l"],"border-color-y":["border-color-t","border-color-b"],translate:["translate-x","translate-y","translate-none"],"translate-none":["translate","translate-x","translate-y","translate-z"],"scroll-m":["scroll-mx","scroll-my","scroll-ms","scroll-me","scroll-mt","scroll-mr","scroll-mb","scroll-ml"],"scroll-mx":["scroll-mr","scroll-ml"],"scroll-my":["scroll-mt","scroll-mb"],"scroll-p":["scroll-px","scroll-py","scroll-ps","scroll-pe","scroll-pt","scroll-pr","scroll-pb","scroll-pl"],"scroll-px":["scroll-pr","scroll-pl"],"scroll-py":["scroll-pt","scroll-pb"],touch:["touch-x","touch-y","touch-pz"],"touch-x":["touch"],"touch-y":["touch"],"touch-pz":["touch"]},conflictingClassGroupModifiers:{"font-size":["leading"]},orderSensitiveModifiers:["*","**","after","backdrop","before","details-content","file","first-letter","first-line","marker","placeholder","selection"]}},rS=G0(sS);function Z(...l){return rS(wg(l))}const uS=St("inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tui-blue focus-visible:ring-offset-2 focus-visible:ring-offset-tui-bg disabled:pointer-events-none disabled:opacity-50 cursor-pointer",{variants:{variant:{primary:"bg-tui-blue text-black font-bold hover:bg-tui-blue/90",secondary:"border border-tui-border bg-transparent hover:bg-tui-selection",destructive:"text-tui-red border border-tui-red bg-transparent hover:bg-tui-red hover:text-black",success:"bg-tui-green text-black font-bold hover:bg-tui-green/90",ghost:"bg-transparent hover:bg-tui-selection",outline:"border border-tui-border bg-transparent text-tui-fg hover:bg-tui-border",tab:"bg-transparent text-tui-fg border-b-2 border-transparent hover:border-b-tui-blue data-[active=true]:border-b-tui-blue data-[active=true]:font-bold",toggle:"border border-tui-border bg-transparent text-tui-fg data-[active=true]:bg-tui-blue data-[active=true]:text-black data-[active=true]:border-tui-blue",link:"bg-transparent text-tui-blue underline-offset-2 hover:underline"},size:{sm:"h-7 px-3 text-xs",md:"h-9 px-4 py-2 text-sm",lg:"h-11 px-6 py-2 text-base"}},defaultVariants:{variant:"primary",size:"md"}}),Jt=({className:l,variant:i,size:s,bracket:u,children:o,ref:f,..._})=>d.jsx("button",{className:Z(uS({variant:i,size:s,className:l})),ref:f,..._,children:u?`[ ${o} ]`:o}),Ih=100,$n=new Map,Do=new Set;function cS(){Do.forEach(l=>l())}function oS(){$n.size>Ih&&Array.from($n.keys()).slice(0,$n.size-Ih).forEach(i=>$n.delete(i))}function dS(l,i){return i?`${i}:${l}`:l}function Mh(l,i){return $n.has(l)?$n.get(l):i}function fS(l,i){$n.set(l,i),oS(),cS()}function _S(l){return Do.add(l),()=>Do.delete(l)}function mS(l,i,s){const u=dS(l,s?.scope),o=b.useSyncExternalStore(_S,()=>Mh(u,i),()=>i),f=b.useCallback(_=>{const h=Mh(u,i),p=typeof _=="function"?_(h):_;fS(u,p)},[u,i]);return[o,f]}const hS={FULL_WIDTH:0,FITTING:1,SMUSHING:2,CONTROLLED_SMUSHING:3};class gS{constructor(){this.comment="",this.numChars=0,this.options={}}}const bo=["1Row","3-D","3D Diagonal","3D-ASCII","3x5","4Max","5 Line Oblique","AMC 3 Line","AMC 3 Liv1","AMC AAA01","AMC Neko","AMC Razor","AMC Razor2","AMC Slash","AMC Slider","AMC Thin","AMC Tubes","AMC Untitled","ANSI Compact","ANSI Regular","ANSI Shadow","ASCII 12","ASCII 9","ASCII New Roman","Acrobatic","Alligator","Alligator2","Alpha","Alphabet","Arrows","Avatar","B1FF","Babyface Lame","Babyface Leet","Banner","Banner3-D","Banner3","Banner4","Barbwire","Basic","Bear","Bell","Benjamin","Big ASCII 12","Big ASCII 9","Big Chief","Big Money-ne","Big Money-nw","Big Money-se","Big Money-sw","Big Mono 12","Big Mono 9","Big","Bigfig","Binary","Block","Blocks","Bloody","BlurVision ASCII","Bolger","Braced","Bright","Broadway KB","Broadway","Bubble","Bulbhead","Caligraphy","Caligraphy2","Calvin S","Cards","Catwalk","Chiseled","Chunky","Circle","Classy","Coder Mini","Coinstak","Cola","Colossal","Computer","Contessa","Contrast","Cosmike","Cosmike2","Crawford","Crawford2","Crazy","Cricket","Cursive","Cyberlarge","Cybermedium","Cybersmall","Cygnet","DANC4","DOS Rebel","DWhistled","Dancing Font","Decimal","Def Leppard","Delta Corps Priest 1","DiamFont","Diamond","Diet Cola","Digital","Doh","Doom","Dot Matrix","Double Shorts","Double","Dr Pepper","Efti Chess","Efti Font","Efti Italic","Efti Piti","Efti Robot","Efti Wall","Efti Water","Electronic","Elite","Emboss 2","Emboss","Epic","Fender","Filter","Fire Font-k","Fire Font-s","Flipped","Flower Power","Font Font","Four Tops","Fraktur","Fun Face","Fun Faces","Future","Fuzzy","Georgi16","Georgia11","Ghost","Ghoulish","Glenyn","Goofy","Gothic","Graceful","Gradient","Graffiti","Greek","Heart Left","Heart Right","Henry 3D","Hex","Hieroglyphs","Hollywood","Horizontal Left","Horizontal Right","ICL-1900","Impossible","Invita","Isometric1","Isometric2","Isometric3","Isometric4","Italic","Ivrit","JS Block Letters","JS Bracket Letters","JS Capital Curves","JS Cursive","JS Stick Letters","Jacky","Jazmine","Jerusalem","Katakana","Kban","Keyboard","Knob","Konto Slant","Konto","LCD","Larry 3D 2","Larry 3D","Lean","Letter","Letters","Lil Devil","Line Blocks","Linux","Lockergnome","Madrid","Marquee","Maxfour","Merlin1","Merlin2","Mike","Mini","Mirror","Mnemonic","Modular","Mono 12","Mono 9","Morse","Morse2","Moscow","Mshebrew210","Muzzle","NScript","NT Greek","NV Script","Nancyj-Fancy","Nancyj-Improved","Nancyj-Underlined","Nancyj","Nipples","O8","OS2","Octal","Ogre","Old Banner","Pagga","Patorjk's Cheese","Patorjk-HeX","Pawp","Peaks Slant","Peaks","Pebbles","Pepper","Poison","Puffy","Puzzle","Pyramid","Rammstein","Rebel","Rectangles","Red Phoenix","Relief","Relief2","Reverse","Roman","Rot13","Rotated","Rounded","Rowan Cap","Rozzo","RubiFont","Runic","Runyc","S Blood","SL Script","Santa Clara","Script","Serifcap","Shaded Blocky","Shadow","Shimrod","Short","Slant Relief","Slant","Slide","Small ASCII 12","Small ASCII 9","Small Block","Small Braille","Small Caps","Small Isometric1","Small Keyboard","Small Mono 12","Small Mono 9","Small Poison","Small Script","Small Shadow","Small Slant","Small Tengwar","Small","Soft","Speed","Spliff","Stacey","Stampate","Stampatello","Standard","Star Strips","Star Wars","Stellar","Stforek","Stick Letters","Stop","Straight","Stronger Than All","Sub-Zero","Swamp Land","Swan","Sweet","THIS","Tanja","Tengwar","Term","Terrace","Test1","The Edge","Thick","Thin","Thorned","Three Point","Ticks Slant","Ticks","Tiles","Tinker-Toy","Tmplr","Tombstone","Train","Trek","Tsalagi","Tubular","Twisted","Two Point","USA Flag","Univers","Upside Down Text","Varsity","Wavescape","Wavy","Weird","Wet Letter","Whimsy","WideTerm","Wow","miniwi"],Dh={"ANSI-Compact":"ANSI Compact"},es=l=>Dh[l]?Dh[l]:l;function pS(l){return/[.*+?^${}()|[\]\\]/.test(l)?"\\"+l:l}const qo=(()=>{const{FULL_WIDTH:l=0,FITTING:i,SMUSHING:s,CONTROLLED_SMUSHING:u}=hS,o={},f={font:"Standard",fontPath:"./fonts",fetchFontIfMissing:!0};function _(L,N,x){const w=pS(L.trim().slice(-1))||"@",X=N===x-1?new RegExp(w+w+"?\\s*$"):new RegExp(w+"\\s*$");return L.replace(X,"")}function h(L=-1,N=null){let x={},w,X=[[16384,"vLayout",s],[8192,"vLayout",i],[4096,"vRule5",!0],[2048,"vRule4",!0],[1024,"vRule3",!0],[512,"vRule2",!0],[256,"vRule1",!0],[128,"hLayout",s],[64,"hLayout",i],[32,"hRule6",!0],[16,"hRule5",!0],[8,"hRule4",!0],[4,"hRule3",!0],[2,"hRule2",!0],[1,"hRule1",!0]];w=N!==null?N:L;for(const[F,ee,z]of X)w>=F?(w-=F,x[ee]===void 0&&(x[ee]=z)):ee!=="vLayout"&&ee!=="hLayout"&&(x[ee]=!1);return typeof x.hLayout>"u"?L===0?x.hLayout=i:L===-1?x.hLayout=l:x.hRule1||x.hRule2||x.hRule3||x.hRule4||x.hRule5||x.hRule6?x.hLayout=u:x.hLayout=s:x.hLayout===s&&(x.hRule1||x.hRule2||x.hRule3||x.hRule4||x.hRule5||x.hRule6)&&(x.hLayout=u),typeof x.vLayout>"u"?x.vRule1||x.vRule2||x.vRule3||x.vRule4||x.vRule5?x.vLayout=u:x.vLayout=l:x.vLayout===s&&(x.vRule1||x.vRule2||x.vRule3||x.vRule4||x.vRule5)&&(x.vLayout=u),x}function p(L,N,x=""){return L===N&&L!==x?L:!1}function v(L,N){let x="|/\\[]{}()<>";if(L==="_"){if(x.indexOf(N)!==-1)return N}else if(N==="_"&&x.indexOf(L)!==-1)return L;return!1}function y(L,N){let x="| /\\ [] {} () <>",w=x.indexOf(L),X=x.indexOf(N);if(w!==-1&&X!==-1&&w!==X&&Math.abs(w-X)!==1){const F=Math.max(w,X),ee=F+1;return x.substring(F,ee)}return!1}function T(L,N){let x="[] {} ()",w=x.indexOf(L),X=x.indexOf(N);return w!==-1&&X!==-1&&Math.abs(w-X)<=1?"|":!1}function E(L,N){return{"/\\":"|","\\/":"Y","><":"X"}[L+N]||!1}function U(L,N,x=""){return L===x&&N===x?x:!1}function I(L,N){return L===N?L:!1}function D(L,N){return v(L,N)}function K(L,N){return y(L,N)}function le(L,N){return L==="-"&&N==="_"||L==="_"&&N==="-"?"=":!1}function ve(L,N){return L==="|"&&N==="|"?"|":!1}function ae(L,N,x){return N===" "||N===""||N===x&&L!==" "?L:N}function q(L,N,x){if(x.fittingRules&&x.fittingRules.vLayout===l)return"invalid";let w,X=Math.min(L.length,N.length),F,ee,z=!1,$;if(X===0)return"invalid";for(w=0;w<X;w++)if(F=L.substring(w,w+1),ee=N.substring(w,w+1),F!==" "&&ee!==" "){if(x.fittingRules&&x.fittingRules.vLayout===i)return"invalid";if(x.fittingRules&&x.fittingRules.vLayout===s)return"end";if(ve(F,ee)){z=z||!1;continue}if($=!1,$=x.fittingRules&&x.fittingRules.vRule1?I(F,ee):$,$=!$&&x.fittingRules&&x.fittingRules.vRule2?D(F,ee):$,$=!$&&x.fittingRules&&x.fittingRules.vRule3?K(F,ee):$,$=!$&&x.fittingRules&&x.fittingRules.vRule4?le(F,ee):$,z=!0,!$)return"invalid"}return z?"end":"valid"}function ie(L,N,x){let w=L.length,X=L.length,F,ee,z,$=1,re,he,Ee;for(;$<=w;){for(F=L.slice(Math.max(0,X-$),X),ee=N.slice(0,Math.min(w,$)),z=ee.length,Ee="",re=0;re<z;re++)if(he=q(F[re],ee[re],x),he==="end")Ee=he;else if(he==="invalid"){Ee=he;break}else Ee===""&&(Ee="valid");if(Ee==="invalid"){$--;break}if(Ee==="end")break;Ee==="valid"&&$++}return Math.min(w,$)}function te(L,N,x){let w,X=Math.min(L.length,N.length),F,ee,z="",$;const re=x.fittingRules||{};for(w=0;w<X;w++)F=L.substring(w,w+1),ee=N.substring(w,w+1),F!==" "&&ee!==" "?re.vLayout===i||re.vLayout===s?z+=ae(F,ee):($=!1,$=re.vRule5?ve(F,ee):$,$=!$&&re.vRule1?I(F,ee):$,$=!$&&re.vRule2?D(F,ee):$,$=!$&&re.vRule3?K(F,ee):$,$=!$&&re.vRule4?le(F,ee):$,z+=$):z+=ae(F,ee);return z}function ge(L,N,x,w){let X=L.length,F=N.length,ee=L.slice(0,Math.max(0,X-x)),z=L.slice(Math.max(0,X-x),X),$=N.slice(0,Math.min(x,F)),re,he,Ee,xe=[],we;for(he=z.length,re=0;re<he;re++)re>=F?Ee=z[re]:Ee=te(z[re],$[re],w),xe.push(Ee);return we=N.slice(Math.min(x,F),F),[...ee,...xe,...we]}function ne(L,N){const x=" ".repeat(N);return L.map(w=>w+x)}function Xe(L,N,x){let w=L[0].length,X=N[0].length,F;return w>X?N=ne(N,w-X):X>w&&(L=ne(L,X-w)),F=ie(L,N,x),ge(L,N,F,x)}function yt(L,N,x){const w=x.fittingRules||{};if(w.hLayout===l)return 0;let X,F=L.length,ee=N.length,z=F,$=1,re=!1,he,Ee,xe,we;if(F===0)return 0;e:for(;$<=z;){const jt=F-$;for(he=L.substring(jt,jt+$),Ee=N.substring(0,Math.min($,ee)),X=0;X<Math.min($,ee);X++)if(xe=he.substring(X,X+1),we=Ee.substring(X,X+1),xe!==" "&&we!==" "){if(w.hLayout===i){$=$-1;break e}else if(w.hLayout===s){(xe===x.hardBlank||we===x.hardBlank)&&($=$-1);break e}else if(re=!0,!(w.hRule1&&p(xe,we,x.hardBlank)||w.hRule2&&v(xe,we)||w.hRule3&&y(xe,we)||w.hRule4&&T(xe,we)||w.hRule5&&E(xe,we)||w.hRule6&&U(xe,we,x.hardBlank))){$=$-1;break e}}if(re)break;$++}return Math.min(z,$)}function dt(L,N,x,w){let X,F,ee=[],z,$,re,he,Ee,xe,we,jt;const Ct=w.fittingRules||{};if(typeof w.height!="number")throw new Error("height is not defined.");for(X=0;X<w.height;X++){we=L[X],jt=N[X],Ee=we.length,xe=jt.length,z=Ee-x,$=we.slice(0,Math.max(0,z)),re="";const Ja=Math.max(0,Ee-x);let Ot=we.substring(Ja,Ja+x),_a=jt.substring(0,Math.min(x,xe));for(F=0;F<x;F++){let wt=F<Ee?Ot.substring(F,F+1):" ",Lt=F<xe?_a.substring(F,F+1):" ";if(wt!==" "&&Lt!==" ")if(Ct.hLayout===i||Ct.hLayout===s)re+=ae(wt,Lt,w.hardBlank);else{const Fr=Ct.hRule1&&p(wt,Lt,w.hardBlank)||Ct.hRule2&&v(wt,Lt)||Ct.hRule3&&y(wt,Lt)||Ct.hRule4&&T(wt,Lt)||Ct.hRule5&&E(wt,Lt)||Ct.hRule6&&U(wt,Lt,w.hardBlank)||ae(wt,Lt,w.hardBlank);re+=Fr}else re+=ae(wt,Lt,w.hardBlank)}x>=xe?he="":he=jt.substring(x,x+Math.max(0,xe-x)),ee[X]=$+re+he}return ee}function Ie(L){return new Array(L).fill("")}const rt=function(L){return Math.max(...L.map(N=>N.length))};function nt(L,N,x){return L.reduce(function(w,X){return dt(w,X.fig,X.overlap||0,x)},Ie(N))}function ye(L,N,x){for(let w=L.length-1;w>0;w--){const X=nt(L.slice(0,w),N,x);if(rt(X)<=x.width)return{outputFigText:X,chars:L.slice(w)}}return{outputFigText:Ie(N),chars:L}}function H(L,N,x){let w,X,F=0,ee,z,$,re=x.height,he=[],Ee,xe={chars:[],overlap:F},we=[],jt,Ct,Ja,Ot,_a;if(typeof re!="number")throw new Error("height is not defined.");z=Ie(re);const wt=x.fittingRules||{};for(x.printDirection===1&&(L=L.split("").reverse().join("")),$=L.length,w=0;w<$;w++)if(jt=L.substring(w,w+1),Ct=jt.match(/\s/),X=N[jt.charCodeAt(0)],Ot=null,X){if(wt.hLayout!==l){for(F=1e4,ee=0;ee<re;ee++)F=Math.min(F,yt(z[ee],X[ee],x));F=F===1e4?0:F}if(x.width>0&&(x.whitespaceBreak?(Ja=nt(xe.chars.concat([{fig:X,overlap:F}]),re,x),Ot=nt(we.concat([{fig:Ja,overlap:xe.overlap}]),re,x),Ee=rt(Ot)):(Ot=dt(z,X,F,x),Ee=rt(Ot)),Ee>=x.width&&w>0&&(x.whitespaceBreak?(z=nt(we.slice(0,-1),re,x),we.length>1&&(he.push(z),z=Ie(re)),we=[]):(he.push(z),z=Ie(re)))),x.width>0&&x.whitespaceBreak&&((!Ct||w===$-1)&&xe.chars.push({fig:X,overlap:F}),Ct||w===$-1)){for(_a=null;Ot=nt(xe.chars,re,x),Ee=rt(Ot),Ee>=x.width;)_a=ye(xe.chars,re,x),xe={chars:_a.chars},he.push(_a.outputFigText);Ee>0&&(_a?we.push({fig:Ot,overlap:1}):we.push({fig:Ot,overlap:xe.overlap})),Ct&&(we.push({fig:X,overlap:F}),z=Ie(re)),w===$-1&&(z=nt(we,re,x)),xe={chars:[],overlap:F};continue}z=dt(z,X,F,x)}return rt(z)>0&&he.push(z),x.showHardBlanks||he.forEach(function(Lt){for($=Lt.length,ee=0;ee<$;ee++)Lt[ee]=Lt[ee].replace(new RegExp("\\"+x.hardBlank,"g")," ")}),L===""&&he.length===0&&he.push(new Array(re).fill("")),he}const B=function(L,N){let x;const w=N.fittingRules||{};if(L==="default")x={hLayout:w.hLayout,hRule1:w.hRule1,hRule2:w.hRule2,hRule3:w.hRule3,hRule4:w.hRule4,hRule5:w.hRule5,hRule6:w.hRule6};else if(L==="full")x={hLayout:l,hRule1:!1,hRule2:!1,hRule3:!1,hRule4:!1,hRule5:!1,hRule6:!1};else if(L==="fitted")x={hLayout:i,hRule1:!1,hRule2:!1,hRule3:!1,hRule4:!1,hRule5:!1,hRule6:!1};else if(L==="controlled smushing")x={hLayout:u,hRule1:!0,hRule2:!0,hRule3:!0,hRule4:!0,hRule5:!0,hRule6:!0};else if(L==="universal smushing")x={hLayout:s,hRule1:!1,hRule2:!1,hRule3:!1,hRule4:!1,hRule5:!1,hRule6:!1};else return;return x},Q=function(L,N){let x={};const w=N.fittingRules||{};if(L==="default")x={vLayout:w.vLayout,vRule1:w.vRule1,vRule2:w.vRule2,vRule3:w.vRule3,vRule4:w.vRule4,vRule5:w.vRule5};else if(L==="full")x={vLayout:l,vRule1:!1,vRule2:!1,vRule3:!1,vRule4:!1,vRule5:!1};else if(L==="fitted")x={vLayout:i,vRule1:!1,vRule2:!1,vRule3:!1,vRule4:!1,vRule5:!1};else if(L==="controlled smushing")x={vLayout:u,vRule1:!0,vRule2:!0,vRule3:!0,vRule4:!0,vRule5:!0};else if(L==="universal smushing")x={vLayout:s,vRule1:!1,vRule2:!1,vRule3:!1,vRule4:!1,vRule5:!1};else return;return x},Le=function(L,N,x){x=x.replace(/\r\n/g,`
`).replace(/\r/g,`
`);const w=es(L);let X=x.split(`
`),F=[],ee,z,$;for(z=X.length,ee=0;ee<z;ee++)F=F.concat(H(X[ee],o[w],N));for(z=F.length,$=F[0],ee=1;ee<z;ee++)$=Xe($,F[ee],N);return $?$.join(`
`):""};function Ge(L,N){let x;if(typeof structuredClone<"u"?x=structuredClone(L):x=JSON.parse(JSON.stringify(L)),x.showHardBlanks=N.showHardBlanks||!1,x.width=N.width||-1,x.whitespaceBreak=N.whitespaceBreak||!1,N.horizontalLayout){const w=B(N.horizontalLayout,L);w&&Object.assign(x.fittingRules,w)}if(N.verticalLayout){const w=Q(N.verticalLayout,L);w&&Object.assign(x.fittingRules,w)}return x.printDirection=N.printDirection!==null&&N.printDirection!==void 0?N.printDirection:L.printDirection,x}const Te=async function(L,N,x){return Te.text(L,N,x)};return Te.text=async function(L,N,x){L=L+"";let w,X;typeof N=="function"?(X=N,w={font:f.font}):typeof N=="string"?(w={font:N},X=x):N?(w=N,X=x):(w={font:f.font},X=x);const F=w.font||f.font;try{const ee=await Te.loadFont(F),z=ee?Le(F,Ge(ee,w),L):"";return X&&X(null,z),z}catch(ee){const z=ee instanceof Error?ee:new Error(String(ee));if(X)return X(z),"";throw z}},Te.textSync=function(L,N){L=L+"",typeof N=="string"?N={font:N}:N=N||{};const x=N.font||f.font;let w=Ge(Te.loadFontSync(x),N);return Le(x,w,L)},Te.metadata=async function(L,N){L=L+"";try{const x=await Te.loadFont(L);if(!x)throw new Error("Error loading font.");const w=es(L),X=o[w]||{},F=[x,X.comment||""];return N&&N(null,x,X.comment),F}catch(x){const w=x instanceof Error?x:new Error(String(x));if(N)return N(w),null;throw w}},Te.defaults=function(L){return L&&typeof L=="object"&&Object.assign(f,L),typeof structuredClone<"u"?structuredClone(f):JSON.parse(JSON.stringify(f))},Te.parseFont=function(L,N,x=!0){if(o[L]&&!x)return o[L].options;N=N.replace(/\r\n/g,`
`).replace(/\r/g,`
`);const w=new gS,X=N.split(`
`),F=X.shift();if(!F)throw new Error("Invalid font file: missing header");const ee=F.split(" "),z={hardBlank:ee[0].substring(5,6),height:parseInt(ee[1],10),baseline:parseInt(ee[2],10),maxLength:parseInt(ee[3],10),oldLayout:parseInt(ee[4],10),numCommentLines:parseInt(ee[5],10),printDirection:ee[6]?parseInt(ee[6],10):0,fullLayout:ee[7]?parseInt(ee[7],10):null,codeTagCount:ee[8]?parseInt(ee[8],10):null};if((z.hardBlank||"").length!==1||[z.height,z.baseline,z.maxLength,z.oldLayout,z.numCommentLines].some(he=>he==null||isNaN(he)))throw new Error("FIGlet header contains invalid values.");if(z.height==null||z.numCommentLines==null)throw new Error("FIGlet header contains invalid values.");z.fittingRules=h(z.oldLayout,z.fullLayout),w.options=z;const re=[];for(let he=32;he<=126;he++)re.push(he);if(re.push(196,214,220,228,246,252,223),X.length<z.numCommentLines+z.height*re.length)throw new Error(`FIGlet file is missing data. Line length: ${X.length}. Comment lines: ${z.numCommentLines}. Height: ${z.height}. Num chars: ${re.length}.`);for(w.comment=X.splice(0,z.numCommentLines).join(`
`),w.numChars=0;X.length>0&&w.numChars<re.length;){const he=re[w.numChars];w[he]=X.splice(0,z.height);for(let Ee=0;Ee<z.height;Ee++)typeof w[he][Ee]>"u"?w[he][Ee]="":w[he][Ee]=_(w[he][Ee],Ee,z.height);w.numChars++}for(;X.length>0;){const he=X.shift();if(!he||he.trim()==="")break;let Ee=he.split(" ")[0],xe;if(/^-?0[xX][0-9a-fA-F]+$/.test(Ee))xe=parseInt(Ee,16);else if(/^-?0[0-7]+$/.test(Ee))xe=parseInt(Ee,8);else if(/^-?[0-9]+$/.test(Ee))xe=parseInt(Ee,10);else throw new Error(`Error parsing data. Invalid data: ${Ee}`);if(xe===-1||xe<-2147483648||xe>2147483647){const we=xe===-1?"The char code -1 is not permitted.":`The char code cannot be ${xe<-2147483648?"less than -2147483648":"greater than 2147483647"}.`;throw new Error(`Error parsing data. ${we}`)}w[xe]=X.splice(0,z.height);for(let we=0;we<z.height;we++)typeof w[xe][we]>"u"?w[xe][we]="":w[xe][we]=_(w[xe][we],we,z.height);w.numChars++}return o[L]=w,z},Te.loadedFonts=()=>Object.keys(o),Te.clearLoadedFonts=()=>{Object.keys(o).forEach(L=>{delete o[L]})},Te.loadFont=async function(L,N){const x=es(L);if(o[x]){const w=o[x].options;return N&&N(null,w),Promise.resolve(w)}try{if(!f.fetchFontIfMissing)throw new Error(`Font is not loaded: ${x}`);const w=await fetch(`${f.fontPath}/${x}.flf`);if(!w.ok)throw new Error(`Network response was not ok: ${w.status}`);const X=await w.text(),F=Te.parseFont(x,X);return N&&N(null,F),F}catch(w){const X=w instanceof Error?w:new Error(String(w));if(N)return N(X),null;throw X}},Te.loadFontSync=function(L){const N=es(L);if(o[N])return o[N].options;throw new Error("Synchronous font loading is not implemented for the browser, it will only work for fonts already loaded.")},Te.preloadFonts=async function(L,N){try{for(const x of L){const w=es(x),X=await fetch(`${f.fontPath}/${w}.flf`);if(!X.ok)throw new Error(`Failed to preload fonts. Error fetching font: ${w}, status code: ${X.statusText}`);const F=await X.text();Te.parseFont(w,F)}N&&N()}catch(x){const w=x instanceof Error?x:new Error(String(x));if(N){N(w);return}throw x}},Te.fonts=function(L){return new Promise(function(N,x){N(bo),L&&L(null,bo)})},Te.fontsSync=function(){return bo},Te.figFonts=o,Te})(),vS=`flf2a$ 8 6 59 15 10 0 24463
Big by Glenn Chappell 4/93 -- based on Standard
Includes ISO Latin-1
Greek characters by Bruce Jakeway <pbjakeway@neumann.uwaterloo.ca>
figlet release 2.2 -- November 1996
Permission is hereby given to modify this font, as long as the
modifier's name is placed on a comment line.

Modified by Paul Burton <solution@earthlink.net> 12/96 to include new parameter
supported by FIGlet and FIGWin.  May also be slightly modified for better use
of new full-width/kern/smush alternatives, but default output is NOT changed.
 $@
 $@
 $@
 $@
 $@
 $@
 $@
 $@@
  _ @
 | |@
 | |@
 | |@
 |_|@
 (_)@
    @
    @@
  _ _ @
 ( | )@
  V V @
   $  @
   $  @
   $  @
      @
      @@
    _  _   @
  _| || |_ @
 |_  __  _|@
  _| || |_ @
 |_  __  _|@
   |_||_|  @
           @
           @@
   _  @
  | | @
 / __)@
 \\__ \\@
 (   /@
  |_| @
      @
      @@
  _   __@
 (_) / /@
    / / @
   / /  @
  / / _ @
 /_/ (_)@
        @
        @@
         @
   ___   @
  ( _ )  @
  / _ \\/\\@
 | (_>  <@
  \\___/\\/@
         @
         @@
  _ @
 ( )@
 |/ @
  $ @
  $ @
  $ @
    @
    @@
   __@
  / /@
 | | @
 | | @
 | | @
 | | @
  \\_\\@
     @@
 __  @
 \\ \\ @
  | |@
  | |@
  | |@
  | |@
 /_/ @
     @@
     _    @
  /\\| |/\\ @
  \\ \` ' / @
 |_     _|@
  / , . \\ @
  \\/|_|\\/ @
          @
          @@
        @
    _   @
  _| |_ @
 |_   _|@
   |_|  @
    $   @
        @
        @@
    @
    @
    @
    @
  _ @
 ( )@
 |/ @
    @@
         @
         @
  ______ @
 |______|@
     $   @
     $   @
         @
         @@
    @
    @
    @
    @
  _ @
 (_)@
    @
    @@
      __@
     / /@
    / / @
   / /  @
  / /   @
 /_/    @
        @
        @@
   ___  @
  / _ \\ @
 | | | |@
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
  __ @
 /_ |@
  | |@
  | |@
  | |@
  |_|@
     @
     @@
  ___  @
 |__ \\ @
   $) |@
   / / @
  / /_ @
 |____|@
       @
       @@
  ____  @
 |___ \\ @
   __) |@
  |__ < @
  ___) |@
 |____/ @
        @
        @@
  _  _   @
 | || |  @
 | || |_ @
 |__   _|@
    | |  @
    |_|  @
         @
         @@
  _____ @
 | ____|@
 | |__  @
 |___ \\ @
  ___) |@
 |____/ @
        @
        @@
    __  @
   / /  @
  / /_  @
 | '_ \\ @
 | (_) |@
  \\___/ @
        @
        @@
  ______ @
 |____  |@
    $/ / @
    / /  @
   / /   @
  /_/    @
         @
         @@
   ___  @
  / _ \\ @
 | (_) |@
  > _ < @
 | (_) |@
  \\___/ @
        @
        @@
   ___  @
  / _ \\ @
 | (_) |@
  \\__, |@
    / / @
   /_/  @
        @
        @@
    @
  _ @
 (_)@
  $ @
  _ @
 (_)@
    @
    @@
    @
  _ @
 (_)@
  $ @
  _ @
 ( )@
 |/ @
    @@
    __@
   / /@
  / / @
 < <  @
  \\ \\ @
   \\_\\@
      @
      @@
         @
  ______ @
 |______|@
  ______ @
 |______|@
         @
         @
         @@
 __   @
 \\ \\  @
  \\ \\ @
   > >@
  / / @
 /_/  @
      @
      @@
  ___  @
 |__ \\ @
    ) |@
   / / @
  |_|  @
  (_)  @
       @
       @@
          @
    ____  @
   / __ \\ @
  / / _\` |@
 | | (_| |@
  \\ \\__,_|@
   \\____/ @
          @@
           @
     /\\    @
    /  \\   @
   / /\\ \\  @
  / ____ \\ @
 /_/    \\_\\@
           @
           @@
  ____  @
 |  _ \\ @
 | |_) |@
 |  _ < @
 | |_) |@
 |____/ @
        @
        @@
   _____ @
  / ____|@
 | | $   @
 | | $   @
 | |____ @
  \\_____|@
         @
         @@
  _____  @
 |  __ \\ @
 | |  | |@
 | |  | |@
 | |__| |@
 |_____/ @
         @
         @@
  ______ @
 |  ____|@
 | |__   @
 |  __|  @
 | |____ @
 |______|@
         @
         @@
  ______ @
 |  ____|@
 | |__   @
 |  __|  @
 | |     @
 |_|     @
         @
         @@
   _____ @
  / ____|@
 | |  __ @
 | | |_ |@
 | |__| |@
  \\_____|@
         @
         @@
  _    _ @
 | |  | |@
 | |__| |@
 |  __  |@
 | |  | |@
 |_|  |_|@
         @
         @@
  _____ @
 |_   _|@
   | |  @
   | |  @
  _| |_ @
 |_____|@
        @
        @@
       _ @
      | |@
      | |@
  _   | |@
 | |__| |@
  \\____/ @
         @
         @@
  _  __@
 | |/ /@
 | ' / @
 |  <  @
 | . \\ @
 |_|\\_\\@
       @
       @@
  _      @
 | |     @
 | |     @
 | |     @
 | |____ @
 |______|@
         @
         @@
  __  __ @
 |  \\/  |@
 | \\  / |@
 | |\\/| |@
 | |  | |@
 |_|  |_|@
         @
         @@
  _   _ @
 | \\ | |@
 |  \\| |@
 | . \` |@
 | |\\  |@
 |_| \\_|@
        @
        @@
   ____  @
  / __ \\ @
 | |  | |@
 | |  | |@
 | |__| |@
  \\____/ @
         @
         @@
  _____  @
 |  __ \\ @
 | |__) |@
 |  ___/ @
 | |     @
 |_|     @
         @
         @@
   ____  @
  / __ \\ @
 | |  | |@
 | |  | |@
 | |__| |@
  \\___\\_\\@
         @
         @@
  _____  @
 |  __ \\ @
 | |__) |@
 |  _  / @
 | | \\ \\ @
 |_|  \\_\\@
         @
         @@
   _____ @
  / ____|@
 | (___  @
  \\___ \\ @
  ____) |@
 |_____/ @
         @
         @@
  _______ @
 |__   __|@
    | |   @
    | |   @
    | |   @
    |_|   @
          @
          @@
  _    _ @
 | |  | |@
 | |  | |@
 | |  | |@
 | |__| |@
  \\____/ @
         @
         @@
 __      __@
 \\ \\    / /@
  \\ \\  / / @
   \\ \\/ /  @
    \\  /   @
     \\/    @
           @
           @@
 __          __@
 \\ \\        / /@
  \\ \\  /\\  / / @
   \\ \\/  \\/ /  @
    \\  /\\  /   @
     \\/  \\/    @
               @
               @@
 __   __@
 \\ \\ / /@
  \\ V / @
   > <  @
  / . \\ @
 /_/ \\_\\@
        @
        @@
 __     __@
 \\ \\   / /@
  \\ \\_/ / @
   \\   /  @
    | |   @
    |_|   @
          @
          @@
  ______@
 |___  /@
   $/ / @
   / /  @
  / /__ @
 /_____|@
        @
        @@
  ___ @
 |  _|@
 | |  @
 | |  @
 | |  @
 | |_ @
 |___|@
      @@
 __     @
 \\ \\    @
  \\ \\   @
   \\ \\  @
    \\ \\ @
     \\_\\@
        @
        @@
  ___ @
 |_  |@
   | |@
   | |@
   | |@
  _| |@
 |___|@
      @@
  /\\ @
 |/\\|@
   $ @
   $ @
   $ @
   $ @
     @
     @@
         @
         @
         @
         @
         @
     $   @
  ______ @
 |______|@@
  _ @
 ( )@
  \\|@
  $ @
  $ @
  $ @
    @
    @@
        @
        @
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
  _     @
 | |    @
 | |__  @
 | '_ \\ @
 | |_) |@
 |_.__/ @
        @
        @@
       @
       @
   ___ @
  / __|@
 | (__ @
  \\___|@
       @
       @@
      _ @
     | |@
   __| |@
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
       @
       @
   ___ @
  / _ \\@
 |  __/@
  \\___|@
       @
       @@
   __ @
  / _|@
 | |_ @
 |  _|@
 | |  @
 |_|  @
      @
      @@
        @
        @
   __ _ @
  / _\` |@
 | (_| |@
  \\__, |@
   __/ |@
  |___/ @@
  _     @
 | |    @
 | |__  @
 | '_ \\ @
 | | | |@
 |_| |_|@
        @
        @@
  _ @
 (_)@
  _ @
 | |@
 | |@
 |_|@
    @
    @@
    _ @
   (_)@
    _ @
   | |@
   | |@
   | |@
  _/ |@
 |__/ @@
  _    @
 | |   @
 | | __@
 | |/ /@
 |   < @
 |_|\\_\\@
       @
       @@
  _ @
 | |@
 | |@
 | |@
 | |@
 |_|@
    @
    @@
            @
            @
  _ __ ___  @
 | '_ \` _ \\ @
 | | | | | |@
 |_| |_| |_|@
            @
            @@
        @
        @
  _ __  @
 | '_ \\ @
 | | | |@
 |_| |_|@
        @
        @@
        @
        @
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
        @
        @@
        @
        @
  _ __  @
 | '_ \\ @
 | |_) |@
 | .__/ @
 | |    @
 |_|    @@
        @
        @
   __ _ @
  / _\` |@
 | (_| |@
  \\__, |@
     | |@
     |_|@@
       @
       @
  _ __ @
 | '__|@
 | |   @
 |_|   @
       @
       @@
      @
      @
  ___ @
 / __|@
 \\__ \\@
 |___/@
      @
      @@
  _   @
 | |  @
 | |_ @
 | __|@
 | |_ @
  \\__|@
      @
      @@
        @
        @
  _   _ @
 | | | |@
 | |_| |@
  \\__,_|@
        @
        @@
        @
        @
 __   __@
 \\ \\ / /@
  \\ V / @
   \\_/  @
        @
        @@
           @
           @
 __      __@
 \\ \\ /\\ / /@
  \\ V  V / @
   \\_/\\_/  @
           @
           @@
       @
       @
 __  __@
 \\ \\/ /@
  >  < @
 /_/\\_\\@
       @
       @@
        @
        @
  _   _ @
 | | | |@
 | |_| |@
  \\__, |@
   __/ |@
  |___/ @@
      @
      @
  ____@
 |_  /@
  / / @
 /___|@
      @
      @@
    __@
   / /@
  | | @
 / /  @
 \\ \\  @
  | | @
   \\_\\@
      @@
  _ @
 | |@
 | |@
 | |@
 | |@
 | |@
 | |@
 |_|@@
 __   @
 \\ \\  @
  | | @
   \\ \\@
   / /@
  | | @
 /_/  @
      @@
  /\\/|@
 |/\\/ @
   $  @
   $  @
   $  @
   $  @
      @
      @@
   _   _  @
  (_)_(_) @
    / \\   @
   / _ \\  @
  / ___ \\ @
 /_/   \\_\\@
          @
          @@
  _   _ @
 (_)_(_)@
  / _ \\ @
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
  _   _ @
 (_) (_)@
 | | | |@
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
  _   _ @
 (_) (_)@
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
  _   _ @
 (_) (_)@
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
        @
        @@
  _   _ @
 (_) (_)@
  _   _ @
 | | | |@
 | |_| |@
  \\__,_|@
        @
        @@
   ___  @
  / _ \\ @
 | | ) |@
 | |< < @
 | | ) |@
 | ||_/ @
 |_|    @
        @@
160  NO-BREAK SPACE
 $@
 $@
 $@
 $@
 $@
 $@
 $@
 $@@
161  INVERTED EXCLAMATION MARK
  _ @
 (_)@
 | |@
 | |@
 | |@
 |_|@
    @
    @@
162  CENT SIGN
       @
    _  @
   | | @
  / __)@
 | (__ @
  \\   )@
   |_| @
       @@
163  POUND SIGN
     ___   @
    / ,_\\  @
  _| |_    @
 |__ __|   @
   | |____ @
  (_,_____|@
           @
           @@
164  CURRENCY SIGN
        @
 /\\___/\\@
 \\  _  /@
 | (_) |@
 / ___ \\@
 \\/   \\/@
        @
        @@
165  YEN SIGN
  __   __ @
  \\ \\ / / @
  _\\ V /_ @
 |___ ___|@
 |___ ___|@
    |_|   @
          @
          @@
166  BROKEN BAR
  _ @
 | |@
 | |@
 |_|@
  _ @
 | |@
 | |@
 |_|@@
167  SECTION SIGN
    __ @
  _/ _)@
 / \\ \\ @
 \\ \\\\ \\@
  \\ \\_/@
 (__/  @
       @
       @@
168  DIAERESIS
  _   _ @
 (_) (_)@
  $   $ @
  $   $ @
  $   $ @
  $   $ @
        @
        @@
169  COPYRIGHT SIGN
    ________   @
   /  ____  \\  @
  /  / ___|  \\ @
 |  | |       |@
 |  | |___    |@
  \\  \\____|  / @
   \\________/  @
               @@
170  FEMININE ORDINAL INDICATOR
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
 |_____|@
    $   @
        @
        @@
171  LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
    ____@
   / / /@
  / / / @
 < < <  @
  \\ \\ \\ @
   \\_\\_\\@
        @
        @@
172  NOT SIGN
         @
         @
  ______ @
 |____  |@
      |_|@
     $   @
         @
         @@
173  SOFT HYPHEN
        @
        @
  _____ @
 |_____|@
    $   @
    $   @
        @
        @@
174  REGISTERED SIGN
    ________   @
   /  ____  \\  @
  /  |  _ \\  \\ @
 |   | |_) |  |@
 |   |  _ <   |@
  \\  |_| \\_\\ / @
   \\________/  @
               @@
175  MACRON
  ______ @
 |______|@
     $   @
     $   @
     $   @
     $   @
         @
         @@
176  DEGREE SIGN
   __  @
  /  \\ @
 | () |@
  \\__/ @
    $  @
    $  @
       @
       @@
177  PLUS-MINUS SIGN
    _   @
  _| |_ @
 |_   _|@
   |_|  @
  _____ @
 |_____|@
        @
        @@
178  SUPERSCRIPT TWO
  ___ @
 |_  )@
  / / @
 /___|@
   $  @
   $  @
      @
      @@
179  SUPERSCRIPT THREE
  ____@
 |__ /@
  |_ \\@
 |___/@
   $  @
   $  @
      @
      @@
180  ACUTE ACCENT
  __@
 /_/@
  $ @
  $ @
  $ @
  $ @
    @
    @@
181  MICRO SIGN
        @
        @
  _   _ @
 | | | |@
 | |_| |@
 | ._,_|@
 | |    @
 |_|    @@
182  PILCROW SIGN
   ______ @
  /      |@
 | (| || |@
  \\__ || |@
    | || |@
    |_||_|@
          @
          @@
183  MIDDLE DOT
    @
    @
  _ @
 (_)@
  $ @
  $ @
    @
    @@
184  CEDILLA
    @
    @
    @
    @
    @
  _ @
 )_)@
    @@
185  SUPERSCRIPT ONE
  _ @
 / |@
 | |@
 |_|@
  $ @
  $ @
    @
    @@
186  MASCULINE ORDINAL INDICATOR
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
 |_____|@
    $   @
        @
        @@
187  RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
 ____   @
 \\ \\ \\  @
  \\ \\ \\ @
   > > >@
  / / / @
 /_/_/  @
        @
        @@
188  VULGAR FRACTION ONE QUARTER
  _   __   @
 / | / /   @
 | |/ / _  @
 |_/ / | | @
  / /|_  _|@
 /_/   |_| @
           @
           @@
189  VULGAR FRACTION ONE HALF
  _   __  @
 / | / /  @
 | |/ /__ @
 |_/ /_  )@
  / / / / @
 /_/ /___|@
          @
          @@
190  VULGAR FRACTION THREE QUARTERS
  ____  __   @
 |__ / / /   @
  |_ \\/ / _  @
 |___/ / | | @
    / /|_  _|@
   /_/   |_| @
             @
             @@
191  INVERTED QUESTION MARK
    _  @
   (_) @
   | | @
  / /  @
 | (__ @
  \\___|@
       @
       @@
192  LATIN CAPITAL LETTER A WITH GRAVE
    __    @
    \\_\\   @
    / \\   @
   / _ \\  @
  / ___ \\ @
 /_/   \\_\\@
          @
          @@
193  LATIN CAPITAL LETTER A WITH ACUTE
     __   @
    /_/   @
    / \\   @
   / _ \\  @
  / ___ \\ @
 /_/   \\_\\@
          @
          @@
194  LATIN CAPITAL LETTER A WITH CIRCUMFLEX
    //\\   @
   |/_\\|  @
    / \\   @
   / _ \\  @
  / ___ \\ @
 /_/   \\_\\@
          @
          @@
195  LATIN CAPITAL LETTER A WITH TILDE
    /\\/|  @
   |/\\/   @
    / \\   @
   / _ \\  @
  / ___ \\ @
 /_/   \\_\\@
          @
          @@
196  LATIN CAPITAL LETTER A WITH DIAERESIS
   _   _  @
  (_)_(_) @
    / \\   @
   / _ \\  @
  / ___ \\ @
 /_/   \\_\\@
          @
          @@
197  LATIN CAPITAL LETTER A WITH RING ABOVE
     _    @
    (o)   @
    / \\   @
   / _ \\  @
  / ___ \\ @
 /_/   \\_\\@
          @
          @@
198  LATIN CAPITAL LETTER AE
      _______ @
     /   ____|@
    /   |__   @
   / /|  __|  @
  / ___ |____ @
 /_/  |______|@
              @
              @@
199  LATIN CAPITAL LETTER C WITH CEDILLA
   _____ @
  / ____|@
 | | $   @
 | | $   @
 | |____ @
  \\_____|@
    )_)  @
         @@
200  LATIN CAPITAL LETTER E WITH GRAVE
   __   @
  _\\_\\_ @
 | ____|@
 |  _|  @
 | |___ @
 |_____|@
        @
        @@
201  LATIN CAPITAL LETTER E WITH ACUTE
    __  @
  _/_/_ @
 | ____|@
 |  _|  @
 | |___ @
 |_____|@
        @
        @@
202  LATIN CAPITAL LETTER E WITH CIRCUMFLEX
   //\\  @
  |/ \\| @
 | ____|@
 |  _|  @
 | |___ @
 |_____|@
        @
        @@
203  LATIN CAPITAL LETTER E WITH DIAERESIS
  _   _ @
 (_) (_)@
 | ____|@
 |  _|  @
 | |___ @
 |_____|@
        @
        @@
204  LATIN CAPITAL LETTER I WITH GRAVE
  __  @
  \\_\\ @
 |_ _|@
  | | @
  | | @
 |___|@
      @
      @@
205  LATIN CAPITAL LETTER I WITH ACUTE
   __ @
  /_/ @
 |_ _|@
  | | @
  | | @
 |___|@
      @
      @@
206  LATIN CAPITAL LETTER I WITH CIRCUMFLEX
  //\\ @
 |/_\\|@
 |_ _|@
  | | @
  | | @
 |___|@
      @
      @@
207  LATIN CAPITAL LETTER I WITH DIAERESIS
  _   _ @
 (_)_(_)@
  |_ _| @
   | |  @
   | |  @
  |___| @
        @
        @@
208  LATIN CAPITAL LETTER ETH
    _____  @
   |  __ \\ @
  _| |_ | |@
 |__ __|| |@
   | |__| |@
   |_____/ @
           @
           @@
209  LATIN CAPITAL LETTER N WITH TILDE
   /\\/| @
  |/\\/_ @
 | \\ | |@
 |  \\| |@
 | |\\  |@
 |_| \\_|@
        @
        @@
210  LATIN CAPITAL LETTER O WITH GRAVE
   __   @
   \\_\\  @
  / _ \\ @
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
211  LATIN CAPITAL LETTER O WITH ACUTE
    __  @
   /_/  @
  / _ \\ @
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
212  LATIN CAPITAL LETTER O WITH CIRCUMFLEX
   //\\  @
  |/_\\| @
  / _ \\ @
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
213  LATIN CAPITAL LETTER O WITH TILDE
   /\\/| @
  |/\\/  @
  / _ \\ @
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
214  LATIN CAPITAL LETTER O WITH DIAERESIS
  _   _ @
 (_)_(_)@
  / _ \\ @
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
215  MULTIPLICATION SIGN
     @
     @
 /\\/\\@
 >  <@
 \\/\\/@
   $ @
     @
     @@
216  LATIN CAPITAL LETTER O WITH STROKE
   _____ @
  / __// @
 | | // |@
 | |//| |@
 | //_| |@
  //___/ @
         @
         @@
217  LATIN CAPITAL LETTER U WITH GRAVE
   __   @
  _\\_\\_ @
 | | | |@
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
218  LATIN CAPITAL LETTER U WITH ACUTE
    __  @
  _/_/_ @
 | | | |@
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
219  LATIN CAPITAL LETTER U WITH CIRCUMFLEX
   //\\  @
  |/ \\| @
 | | | |@
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
220  LATIN CAPITAL LETTER U WITH DIAERESIS
  _   _ @
 (_) (_)@
 | | | |@
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
221  LATIN CAPITAL LETTER Y WITH ACUTE
    __  @
 __/_/__@
 \\ \\ / /@
  \\ V / @
   | |  @
   |_|  @
        @
        @@
222  LATIN CAPITAL LETTER THORN
  _      @
 | |___  @
 |  __ \\ @
 | |__) |@
 |  ___/ @
 |_|     @
         @
         @@
223  LATIN SMALL LETTER SHARP S
   ___  @
  / _ \\ @
 | | ) |@
 | |< < @
 | | ) |@
 | ||_/ @
 |_|    @
        @@
224  LATIN SMALL LETTER A WITH GRAVE
   __   @
   \\_\\  @
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
225  LATIN SMALL LETTER A WITH ACUTE
    __  @
   /_/  @
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
226  LATIN SMALL LETTER A WITH CIRCUMFLEX
   //\\  @
  |/ \\| @
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
227  LATIN SMALL LETTER A WITH TILDE
   /\\/| @
  |/\\/  @
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
228  LATIN SMALL LETTER A WITH DIAERESIS
  _   _ @
 (_) (_)@
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
229  LATIN SMALL LETTER A WITH RING ABOVE
    __  @
   (()) @
   __ _ @
  / _\` |@
 | (_| |@
  \\__,_|@
        @
        @@
230  LATIN SMALL LETTER AE
           @
           @
   __ ____ @
  / _\`  _ \\@
 | (_|  __/@
  \\__,____|@
           @
           @@
231  LATIN SMALL LETTER C WITH CEDILLA
       @
       @
   ___ @
  / __|@
 | (__ @
  \\___|@
   )_) @
       @@
232  LATIN SMALL LETTER E WITH GRAVE
   __  @
   \\_\\ @
   ___ @
  / _ \\@
 |  __/@
  \\___|@
       @
       @@
233  LATIN SMALL LETTER E WITH ACUTE
    __ @
   /_/ @
   ___ @
  / _ \\@
 |  __/@
  \\___|@
       @
       @@
234  LATIN SMALL LETTER E WITH CIRCUMFLEX
   //\\ @
  |/ \\|@
   ___ @
  / _ \\@
 |  __/@
  \\___|@
       @
       @@
235  LATIN SMALL LETTER E WITH DIAERESIS
  _   _ @
 (_) (_)@
   ___  @
  / _ \\ @
 |  __/ @
  \\___| @
        @
        @@
236  LATIN SMALL LETTER I WITH GRAVE
 __ @
 \\_\\@
  _ @
 | |@
 | |@
 |_|@
    @
    @@
237  LATIN SMALL LETTER I WITH ACUTE
  __@
 /_/@
  _ @
 | |@
 | |@
 |_|@
    @
    @@
238  LATIN SMALL LETTER I WITH CIRCUMFLEX
  //\\ @
 |/ \\|@
   _  @
  | | @
  | | @
  |_| @
      @
      @@
239  LATIN SMALL LETTER I WITH DIAERESIS
  _   _ @
 (_) (_)@
    _   @
   | |  @
   | |  @
   |_|  @
        @
        @@
240  LATIN SMALL LETTER ETH
  /\\/\\  @
  >  <  @
  \\/\\ \\ @
  / _\` |@
 | (_) |@
  \\___/ @
        @
        @@
241  LATIN SMALL LETTER N WITH TILDE
   /\\/| @
  |/\\/  @
  _ __  @
 | '_ \\ @
 | | | |@
 |_| |_|@
        @
        @@
242  LATIN SMALL LETTER O WITH GRAVE
   __   @
   \\_\\  @
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
        @
        @@
243  LATIN SMALL LETTER O WITH ACUTE
    __  @
   /_/  @
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
        @
        @@
244  LATIN SMALL LETTER O WITH CIRCUMFLEX
   //\\  @
  |/ \\| @
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
        @
        @@
245  LATIN SMALL LETTER O WITH TILDE
   /\\/| @
  |/\\/  @
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
        @
        @@
246  LATIN SMALL LETTER O WITH DIAERESIS
  _   _ @
 (_) (_)@
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
        @
        @@
247  DIVISION SIGN
     _    @
    (_)   @
  _______ @
 |_______|@
     _    @
    (_)   @
          @
          @@
248  LATIN SMALL LETTER O WITH STROKE
         @
         @
   ____  @
  / _//\\ @
 | (//) |@
  \\//__/ @
         @
         @@
249  LATIN SMALL LETTER U WITH GRAVE
   __   @
   \\_\\  @
  _   _ @
 | | | |@
 | |_| |@
  \\__,_|@
        @
        @@
250  LATIN SMALL LETTER U WITH ACUTE
    __  @
   /_/  @
  _   _ @
 | | | |@
 | |_| |@
  \\__,_|@
        @
        @@
251  LATIN SMALL LETTER U WITH CIRCUMFLEX
   //\\  @
  |/ \\| @
  _   _ @
 | | | |@
 | |_| |@
  \\__,_|@
        @
        @@
252  LATIN SMALL LETTER U WITH DIAERESIS
  _   _ @
 (_) (_)@
  _   _ @
 | | | |@
 | |_| |@
  \\__,_|@
        @
        @@
253  LATIN SMALL LETTER Y WITH ACUTE
    __  @
   /_/  @
  _   _ @
 | | | |@
 | |_| |@
  \\__, |@
   __/ |@
  |___/ @@
254  LATIN SMALL LETTER THORN
  _     @
 | |    @
 | |__  @
 | '_ \\ @
 | |_) |@
 | .__/ @
 | |    @
 |_|    @@
255  LATIN SMALL LETTER Y WITH DIAERESIS
  _   _ @
 (_) (_)@
  _   _ @
 | | | |@
 | |_| |@
  \\__, |@
   __/ |@
  |___/ @@
0x02BC  MODIFIER LETTER APOSTROPHE
   @
   @
 ))@
   @
   @
   @
   @
   @@
0x02BD  MODIFIER LETTER REVERSED COMMA
   @
   @
 ((@
   @
   @
   @
   @
   @@
0x037A  GREEK YPOGEGRAMMENI
   @
   @
   @
   @
   @
   @
   @
 ||@@
0x0387  GREEK ANO TELEIA
    @
  $ @
  _ @
 (_)@
    @
  $ @
    @
    @@
0x0391  GREEK CAPITAL LETTER ALPHA
   ___  @
  / _ \\ @
 | |_| |@
 |  _  |@
 | | | |@
 |_| |_|@
        @
        @@
0x0392  GREEK CAPITAL LETTER BETA
  ____  @
 |  _ \\ @
 | |_) )@
 |  _ ( @
 | |_) )@
 |____/ @
        @
        @@
0x0393  GREEK CAPITAL LETTER GAMMA
  _____ @
 |  ___)@
 | |$   @
 | |$   @
 | |    @
 |_|    @
        @
        @@
0x0394  GREEK CAPITAL LETTER DELTA
           @
     /\\    @
    /  \\   @
   / /\\ \\  @
  / /__\\ \\ @
 /________\\@
           @
           @@
0x0395  GREEK CAPITAL LETTER EPSILON
  _____ @
 |  ___)@
 | |_   @
 |  _)  @
 | |___ @
 |_____)@
        @
        @@
0x0396  GREEK CAPITAL LETTER ZETA
  ______@
 (___  /@
    / / @
   / /  @
  / /__ @
 /_____)@
        @
        @@
0x0397  GREEK CAPITAL LETTER ETA
  _   _ @
 | | | |@
 | |_| |@
 |  _  |@
 | | | |@
 |_| |_|@
        @
        @@
0x0398  GREEK CAPITAL LETTER THETA
   ____  @
  / __ \\ @
 | |__| |@
 |  __  |@
 | |__| |@
  \\____/ @
         @
         @@
0x0399  GREEK CAPITAL LETTER IOTA
  ___ @
 (   )@
  | | @
  | | @
  | | @
 (___)@
      @
      @@
0x039A  GREEK CAPITAL LETTER KAPPA
  _   __@
 | | / /@
 | |/ / @
 |   <  @
 | |\\ \\ @
 |_| \\_\\@
        @
        @@
0x039B  GREEK CAPITAL LETTER LAMDA
           @
     /\\    @
    /  \\   @
   / /\\ \\  @
  / /  \\ \\ @
 /_/    \\_\\@
           @
           @@
0x039C  GREEK CAPITAL LETTER MU
  __   __ @
 |  \\ /  |@
 |   v   |@
 | |\\_/| |@
 | |   | |@
 |_|   |_|@
          @
          @@
0x039D  GREEK CAPITAL LETTER NU
  _   _ @
 | \\ | |@
 |  \\| |@
 |     |@
 | |\\  |@
 |_| \\_|@
        @
        @@
0x039E  GREEK CAPITAL LETTER XI
  _____ @
 (_____)@
   ___  @
  (___) @
  _____ @
 (_____)@
        @
        @@
0x039F  GREEK CAPITAL LETTER OMICRON
   ___  @
  / _ \\ @
 | | | |@
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
0x03A0  GREEK CAPITAL LETTER PI
  _______ @
 (   _   )@
  | | | | @
  | | | | @
  | | | | @
  |_| |_| @
          @
          @@
0x03A1  GREEK CAPITAL LETTER RHO
  ____  @
 |  _ \\ @
 | |_) )@
 |  __/ @
 | |    @
 |_|    @
        @
        @@
0x03A3  GREEK CAPITAL LETTER SIGMA
 ______ @
 \\  ___)@
  \\ \\   @
   > >  @
  / /__ @
 /_____)@
        @
        @@
0x03A4  GREEK CAPITAL LETTER TAU
  _____ @
 (_   _)@
   | |  @
   | |  @
   | |  @
   |_|  @
        @
        @@
0x03A5  GREEK CAPITAL LETTER UPSILON
  __   __ @
 (_ \\ / _)@
   \\ v /  @
    | |   @
    | |   @
    |_|   @
          @
          @@
0x03A6  GREEK CAPITAL LETTER PHI
     _    @
   _| |_  @
  /     \\ @
 ( (| |) )@
  \\_   _/ @
    |_|   @
          @
          @@
0x03A7  GREEK CAPITAL LETTER CHI
 __   __@
 \\ \\ / /@
  \\ v / @
   > <  @
  / ^ \\ @
 /_/ \\_\\@
        @
        @@
0x03A8  GREEK CAPITAL LETTER PSI
  _  _  _ @
 | || || |@
 | \\| |/ |@
  \\_   _/ @
    | |   @
    |_|   @
          @
          @@
0x03A9  GREEK CAPITAL LETTER OMEGA
    ____   @
   / __ \\  @
  | |  | | @
  | |  | | @
  _\\ \\/ /_ @
 (___||___)@
           @
           @@
0x03B1  GREEK SMALL LETTER ALPHA
         @
         @
   __  __@
  /  \\/ /@
 ( ()  < @
  \\__/\\_\\@
         @
         @@
0x03B2  GREEK SMALL LETTER BETA
   ___  @
  / _ \\ @
 | |_) )@
 |  _ < @
 | |_) )@
 |  __/ @
 | |    @
 |_|    @@
0x03B3  GREEK SMALL LETTER GAMMA
        @
        @
  _   _ @
 ( \\ / )@
  \\ v / @
   | |  @
   | |  @
   |_|  @@
0x03B4  GREEK SMALL LETTER DELTA
    __  @
   / _) @
   \\ \\  @
  / _ \\ @
 ( (_) )@
  \\___/ @
        @
        @@
0x03B5  GREEK SMALL LETTER EPSILON
      @
      @
  ___ @
 / __)@
 > _) @
 \\___)@
      @
      @@
0x03B6  GREEK SMALL LETTER ZETA
 _____  @
 \\__  ) @
   / /  @
  / /   @
 | |__  @
  \\__ \\ @
     ) )@
    (_/ @@
0x03B7  GREEK SMALL LETTER ETA
        @
        @
  _ __  @
 | '_ \\ @
 | | | |@
 |_| | |@
     | |@
     |_|@@
0x03B8  GREEK SMALL LETTER THETA
   ___  @
  / _ \\ @
 | |_| |@
 |  _  |@
 | |_| |@
  \\___/ @
        @
        @@
0x03B9  GREEK SMALL LETTER IOTA
     @
     @
  _  @
 | | @
 | | @
  \\_)@
     @
     @@
0x03BA  GREEK SMALL LETTER KAPPA
       @
       @
  _  __@
 | |/ /@
 |   < @
 |_|\\_\\@
       @
       @@
0x03BB  GREEK SMALL LETTER LAMDA
 __     @
 \\ \\    @
  \\ \\   @
   > \\  @
  / ^ \\ @
 /_/ \\_\\@
        @
        @@
0x03BC  GREEK SMALL LETTER MU
        @
        @
  _   _ @
 | | | |@
 | |_| |@
 | ._,_|@
 | |    @
 |_|    @@
0x03BD  GREEK SMALL LETTER NU
       @
       @
  _  __@
 | |/ /@
 | / / @
 |__/  @
       @
       @@
0x03BE  GREEK SMALL LETTER XI
 \\=\\__  @
  > __) @
 ( (_   @
  > _)  @
 ( (__  @
  \\__ \\ @
     ) )@
    (_/ @@
0x03BF  GREEK SMALL LETTER OMICRON
        @
        @
   ___  @
  / _ \\ @
 ( (_) )@
  \\___/ @
        @
        @@
0x03C0  GREEK SMALL LETTER PI
         @
         @
  ______ @
 (  __  )@
  | || | @
  |_||_| @
         @
         @@
0x03C1  GREEK SMALL LETTER RHO
        @
        @
   ___  @
  / _ \\ @
 | |_) )@
 |  __/ @
 | |    @
 |_|    @@
0x03C2  GREEK SMALL LETTER FINAL SIGMA
        @
        @
   ____ @
  / ___)@
 ( (__  @
  \\__ \\ @
    _) )@
   (__/ @@
0x03C3  GREEK SMALL LETTER SIGMA
        @
        @
   ____ @
  /  ._)@
 ( () ) @
  \\__/  @
        @
        @@
0x03C4  GREEK SMALL LETTER TAU
      @
      @
  ___ @
 (   )@
  | | @
   \\_)@
      @
      @@
0x03C5  GREEK SMALL LETTER UPSILON
        @
        @
  _   _ @
 | | | |@
 | |_| |@
  \\___/ @
        @
        @@
0x03C6  GREEK SMALL LETTER PHI
     _    @
    | |   @
   _| |_  @
  /     \\ @
 ( (| |) )@
  \\_   _/ @
    | |   @
    |_|   @@
0x03C7  GREEK SMALL LETTER CHI
        @
        @
 __   __@
 \\ \\ / /@
  \\ v / @
   > <  @
  / ^ \\ @
 /_/ \\_\\@@
0x03C8  GREEK SMALL LETTER PSI
          @
          @
  _  _  _ @
 | || || |@
 | \\| |/ |@
  \\_   _/ @
    | |   @
    |_|   @@
0x03C9  GREEK SMALL LETTER OMEGA
            @
            @
   __   __  @
  / / _ \\ \\ @
 | |_/ \\_| |@
  \\___^___/ @
            @
            @@
0x03D1  GREEK THETA SYMBOL
     ___    @
    / _ \\   @
   ( (_| |_ @
  _ \\ _   _)@
 | |___| |  @
  \\_____/   @
            @
            @@
0x03D5  GREEK PHI SYMBOL
          @
          @
  _   __  @
 | | /  \\ @
 | || || )@
  \\_   _/ @
    | |   @
    |_|   @@
0x03D6  GREEK PI SYMBOL
            @
            @
  _________ @
 (  _____  )@
 | |_/ \\_| |@
  \\___^___/ @
            @
            @@
-0x0005  
alpha = a, beta = b, gamma = g, delta = d, epsilon = e   @
zeta = z, eta = h, theta = q, iota = i, lamda = l, mu = m@
nu = n, xi = x, omicron = o, pi = p, rho = r, sigma = s  @
phi = f, chi = c, psi = y, omega = w, final sigma = V    @
     pi symbol = v, theta symbol = J, phi symbol = j     @
     middle dot = :, ypogegrammeni = _                   @
     rough breathing = (, smooth breathing = )           @
     acute accent = ', grave accent = \`, dialytika = ^   @@
`,yS=`flf2a$ 5 4 13 15 10 0 22415
Small by Glenn Chappell 4/93 -- based on Standard
Includes ISO Latin-1
figlet release 2.1 -- 12 Aug 1994
Permission is hereby given to modify this font, as long as the
modifier's name is placed on a comment line.

Modified by Paul Burton <solution@earthlink.net> 12/96 to include new parameter
supported by FIGlet and FIGWin.  May also be slightly modified for better use
of new full-width/kern/smush alternatives, but default output is NOT changed.

 $@
 $@
 $@
 $@
 $@@
  _ @
 | |@
 |_|@
 (_)@
    @@
  _ _ @
 ( | )@
  V V @
   $  @
      @@
    _ _   @
  _| | |_ @
 |_  .  _|@
 |_     _|@
   |_|_|  @@
     @
  ||_@
 (_-<@
 / _/@
  || @@
  _  __ @
 (_)/ / @
   / /_ @
  /_/(_)@
        @@
  __     @
 / _|___ @
 > _|_ _|@
 \\_____| @
         @@
  _ @
 ( )@
 |/ @
  $ @
    @@
   __@
  / /@
 | | @
 | | @
  \\_\\@@
 __  @
 \\ \\ @
  | |@
  | |@
 /_/ @@
     @
 _/\\_@
 >  <@
  \\/ @
     @@
    _   @
  _| |_ @
 |_   _|@
   |_|  @
        @@
    @
    @
  _ @
 ( )@
 |/ @@
      @
  ___ @
 |___|@
   $  @
      @@
    @
    @
  _ @
 (_)@
    @@
    __@
   / /@
  / / @
 /_/  @
      @@
   __  @
  /  \\ @
 | () |@
  \\__/ @
       @@
  _ @
 / |@
 | |@
 |_|@
    @@
  ___ @
 |_  )@
  / / @
 /___|@
      @@
  ____@
 |__ /@
  |_ \\@
 |___/@
      @@
  _ _  @
 | | | @
 |_  _|@
   |_| @
       @@
  ___ @
 | __|@
 |__ \\@
 |___/@
      @@
   __ @
  / / @
 / _ \\@
 \\___/@
      @@
  ____ @
 |__  |@
   / / @
  /_/  @
       @@
  ___ @
 ( _ )@
 / _ \\@
 \\___/@
      @@
  ___ @
 / _ \\@
 \\_, /@
  /_/ @
      @@
  _ @
 (_)@
  _ @
 (_)@
    @@
  _ @
 (_)@
  _ @
 ( )@
 |/ @@
   __@
  / /@
 < < @
  \\_\\@
     @@
      @
  ___ @
 |___|@
 |___|@
      @@
 __  @
 \\ \\ @
  > >@
 /_/ @
     @@
  ___ @
 |__ \\@
   /_/@
  (_) @
      @@
   ____  @
  / __ \\ @
 / / _\` |@
 \\ \\__,_|@
  \\____/ @@
    _   @
   /_\\  @
  / _ \\ @
 /_/ \\_\\@
        @@
  ___ @
 | _ )@
 | _ \\@
 |___/@
      @@
   ___ @
  / __|@
 | (__ @
  \\___|@
       @@
  ___  @
 |   \\ @
 | |) |@
 |___/ @
       @@
  ___ @
 | __|@
 | _| @
 |___|@
      @@
  ___ @
 | __|@
 | _| @
 |_|  @
      @@
   ___ @
  / __|@
 | (_ |@
  \\___|@
       @@
  _  _ @
 | || |@
 | __ |@
 |_||_|@
       @@
  ___ @
 |_ _|@
  | | @
 |___|@
      @@
     _ @
  _ | |@
 | || |@
  \\__/ @
       @@
  _  __@
 | |/ /@
 | ' < @
 |_|\\_\\@
       @@
  _    @
 | |   @
 | |__ @
 |____|@
       @@
  __  __ @
 |  \\/  |@
 | |\\/| |@
 |_|  |_|@
         @@
  _  _ @
 | \\| |@
 | .\` |@
 |_|\\_|@
       @@
   ___  @
  / _ \\ @
 | (_) |@
  \\___/ @
        @@
  ___ @
 | _ \\@
 |  _/@
 |_|  @
      @@
   ___  @
  / _ \\ @
 | (_) |@
  \\__\\_\\@
        @@
  ___ @
 | _ \\@
 |   /@
 |_|_\\@
      @@
  ___ @
 / __|@
 \\__ \\@
 |___/@
      @@
  _____ @
 |_   _|@
   | |  @
   |_|  @
        @@
  _   _ @
 | | | |@
 | |_| |@
  \\___/ @
        @@
 __   __@
 \\ \\ / /@
  \\ V / @
   \\_/  @
        @@
 __      __@
 \\ \\    / /@
  \\ \\/\\/ / @
   \\_/\\_/  @
           @@
 __  __@
 \\ \\/ /@
  >  < @
 /_/\\_\\@
       @@
 __   __@
 \\ \\ / /@
  \\ V / @
   |_|  @
        @@
  ____@
 |_  /@
  / / @
 /___|@
      @@
  __ @
 | _|@
 | | @
 | | @
 |__|@@
 __   @
 \\ \\  @
  \\ \\ @
   \\_\\@
      @@
  __ @
 |_ |@
  | |@
  | |@
 |__|@@
  /\\ @
 |/\\|@
   $ @
   $ @
     @@
      @
      @
      @
  ___ @
 |___|@@
  _ @
 ( )@
  \\|@
  $ @
    @@
       @
  __ _ @
 / _\` |@
 \\__,_|@
       @@
  _    @
 | |__ @
 | '_ \\@
 |_.__/@
       @@
     @
  __ @
 / _|@
 \\__|@
     @@
     _ @
  __| |@
 / _\` |@
 \\__,_|@
       @@
      @
  ___ @
 / -_)@
 \\___|@
      @@
   __ @
  / _|@
 |  _|@
 |_|  @
      @@
       @
  __ _ @
 / _\` |@
 \\__, |@
 |___/ @@
  _    @
 | |_  @
 | ' \\ @
 |_||_|@
       @@
  _ @
 (_)@
 | |@
 |_|@
    @@
    _ @
   (_)@
   | |@
  _/ |@
 |__/ @@
  _   @
 | |__@
 | / /@
 |_\\_\\@
      @@
  _ @
 | |@
 | |@
 |_|@
    @@
        @
  _ __  @
 | '  \\ @
 |_|_|_|@
        @@
       @
  _ _  @
 | ' \\ @
 |_||_|@
       @@
      @
  ___ @
 / _ \\@
 \\___/@
      @@
       @
  _ __ @
 | '_ \\@
 | .__/@
 |_|   @@
       @
  __ _ @
 / _\` |@
 \\__, |@
    |_|@@
      @
  _ _ @
 | '_|@
 |_|  @
      @@
     @
  ___@
 (_-<@
 /__/@
     @@
  _   @
 | |_ @
 |  _|@
  \\__|@
      @@
       @
  _  _ @
 | || |@
  \\_,_|@
       @@
      @
 __ __@
 \\ V /@
  \\_/ @
      @@
         @
 __ __ __@
 \\ V  V /@
  \\_/\\_/ @
         @@
      @
 __ __@
 \\ \\ /@
 /_\\_\\@
      @@
       @
  _  _ @
 | || |@
  \\_, |@
  |__/ @@
     @
  ___@
 |_ /@
 /__|@
     @@
    __@
   / /@
 _| | @
  | | @
   \\_\\@@
  _ @
 | |@
 | |@
 | |@
 |_|@@
 __   @
 \\ \\  @
  | |_@
  | | @
 /_/  @@
  /\\/|@
 |/\\/ @
   $  @
   $  @
      @@
  _  _ @
 (_)(_)@
  /--\\ @
 /_/\\_\\@
       @@
  _  _ @
 (_)(_)@
 / __ \\@
 \\____/@
       @@
  _   _ @
 (_) (_)@
 | |_| |@
  \\___/ @
        @@
  _  _ @
 (_)(_)@
 / _\` |@
 \\__,_|@
       @@
  _   _ @
 (_)_(_)@
  / _ \\ @
  \\___/ @
        @@
  _  _ @
 (_)(_)@
 | || |@
  \\_,_|@
       @@
   ___ @
  / _ \\@
 | |< <@
 | ||_/@
 |_|   @@
160  NO-BREAK SPACE
 $@
 $@
 $@
 $@
 $@@
161  INVERTED EXCLAMATION MARK
  _ @
 (_)@
 | |@
 |_|@
    @@
162  CENT SIGN
     @
  || @
 / _)@
 \\ _)@
  || @@
163  POUND SIGN
    __  @
  _/ _\\ @
 |_ _|_ @
 (_,___|@
        @@
164  CURRENCY SIGN
 /\\_/\\@
 \\ . /@
 / _ \\@
 \\/ \\/@
      @@
165  YEN SIGN
  __ __ @
  \\ V / @
 |__ __|@
 |__ __|@
   |_|  @@
166  BROKEN BAR
  _ @
 | |@
 |_|@
 | |@
 |_|@@
167  SECTION SIGN
    __ @
   / _)@
  /\\ \\ @
  \\ \\/ @
 (__/  @@
168  DIAERESIS
  _  _ @
 (_)(_)@
  $  $ @
  $  $ @
       @@
169  COPYRIGHT SIGN
   ____  @
  / __ \\ @
 / / _| \\@
 \\ \\__| /@
  \\____/ @@
170  FEMININE ORDINAL INDICATOR
  __ _ @
 / _\` |@
 \\__,_|@
 |____|@
       @@
171  LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
   ____@
  / / /@
 < < < @
  \\_\\_\\@
       @@
172  NOT SIGN
  ____ @
 |__  |@
    |_|@
   $   @
       @@
173  SOFT HYPHEN
     @
  __ @
 |__|@
   $ @
     @@
174  REGISTERED SIGN
   ____  @
  / __ \\ @
 / | -) \\@
 \\ ||\\\\ /@
  \\____/ @@
175  MACRON
  ___ @
 |___|@
   $  @
   $  @
      @@
176  DEGREE SIGN
  _ @
 /.\\@
 \\_/@
  $ @
    @@
177  PLUS-MINUS SIGN
    _   @
  _| |_ @
 |_   _|@
  _|_|_ @
 |_____|@@
178  SUPERSCRIPT TWO
  __ @
 |_ )@
 /__|@
   $ @
     @@
179  SUPERSCRIPT THREE
  ___@
 |_ /@
 |__)@
   $ @
     @@
180  ACUTE ACCENT
  __@
 /_/@
  $ @
  $ @
    @@
181  MICRO SIGN
       @
  _  _ @
 | || |@
 | .,_|@
 |_|   @@
182  PILCROW SIGN
  ____ @
 /    |@
 \\_ | |@
  |_|_|@
       @@
183  MIDDLE DOT
    @
  _ @
 (_)@
  $ @
    @@
184  CEDILLA
    @
    @
    @
  _ @
 )_)@@
185  SUPERSCRIPT ONE
  _ @
 / |@
 |_|@
  $ @
    @@
186  MASCULINE ORDINAL INDICATOR
  ___ @
 / _ \\@
 \\___/@
 |___|@
      @@
187  RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
 ____  @
 \\ \\ \\ @
  > > >@
 /_/_/ @
       @@
188  VULGAR FRACTION ONE QUARTER
  _  __   @
 / |/ /__ @
 |_/ /_' |@
  /_/  |_|@
          @@
189  VULGAR FRACTION ONE HALF
  _  __  @
 / |/ /_ @
 |_/ /_ )@
  /_//__|@
         @@
190  VULGAR FRACTION THREE QUARTERS
  ___ __   @
 |_ // /__ @
 |__) /_' |@
   /_/  |_|@
           @@
191  INVERTED QUESTION MARK
   _  @
  (_) @
 / /_ @
 \\___|@
      @@
192  LATIN CAPITAL LETTER A WITH GRAVE
  __   @
  \\_\\  @
  /--\\ @
 /_/\\_\\@
       @@
193  LATIN CAPITAL LETTER A WITH ACUTE
    __ @
   /_/ @
  /--\\ @
 /_/\\_\\@
       @@
194  LATIN CAPITAL LETTER A WITH CIRCUMFLEX
   /\\  @
  |/\\| @
  /--\\ @
 /_/\\_\\@
       @@
195  LATIN CAPITAL LETTER A WITH TILDE
   /\\/|@
  |/\\/ @
  /--\\ @
 /_/\\_\\@
       @@
196  LATIN CAPITAL LETTER A WITH DIAERESIS
  _  _ @
 (_)(_)@
  /--\\ @
 /_/\\_\\@
       @@
197  LATIN CAPITAL LETTER A WITH RING ABOVE
   __  @
  (()) @
  /--\\ @
 /_/\\_\\@
       @@
198  LATIN CAPITAL LETTER AE
    ____ @
   /, __|@
  / _ _| @
 /_/|___|@
         @@
199  LATIN CAPITAL LETTER C WITH CEDILLA
   ___ @
  / __|@
 | (__ @
  \\___|@
   )_) @@
200  LATIN CAPITAL LETTER E WITH GRAVE
  __ @
  \\_\\@
 | -<@
 |__<@
     @@
201  LATIN CAPITAL LETTER E WITH ACUTE
   __@
  /_/@
 | -<@
 |__<@
     @@
202  LATIN CAPITAL LETTER E WITH CIRCUMFLEX
  /\\ @
 |/\\|@
 | -<@
 |__<@
     @@
203  LATIN CAPITAL LETTER E WITH DIAERESIS
  _  _ @
 (_)(_)@
  | -< @
  |__< @
       @@
204  LATIN CAPITAL LETTER I WITH GRAVE
  __  @
  \\_\\ @
 |_ _|@
 |___|@
      @@
205  LATIN CAPITAL LETTER I WITH ACUTE
   __ @
  /_/ @
 |_ _|@
 |___|@
      @@
206  LATIN CAPITAL LETTER I WITH CIRCUMFLEX
  //\\ @
 |/_\\|@
 |_ _|@
 |___|@
      @@
207  LATIN CAPITAL LETTER I WITH DIAERESIS
  _   _ @
 (_)_(_)@
  |_ _| @
  |___| @
        @@
208  LATIN CAPITAL LETTER ETH
   ____  @
  | __ \\ @
 |_ _|) |@
  |____/ @
         @@
209  LATIN CAPITAL LETTER N WITH TILDE
   /\\/|@
  |/\\/ @
 | \\| |@
 |_|\\_|@
       @@
210  LATIN CAPITAL LETTER O WITH GRAVE
  __   @
  \\_\\_ @
 / __ \\@
 \\____/@
       @@
211  LATIN CAPITAL LETTER O WITH ACUTE
    __ @
  _/_/ @
 / __ \\@
 \\____/@
       @@
212  LATIN CAPITAL LETTER O WITH CIRCUMFLEX
   /\\  @
  |/\\| @
 / __ \\@
 \\____/@
       @@
213  LATIN CAPITAL LETTER O WITH TILDE
   /\\/|@
  |/\\/ @
 / __ \\@
 \\____/@
       @@
214  LATIN CAPITAL LETTER O WITH DIAERESIS
  _  _ @
 (_)(_)@
 / __ \\@
 \\____/@
       @@
215  MULTIPLICATION SIGN
     @
 /\\/\\@
 >  <@
 \\/\\/@
     @@
216  LATIN CAPITAL LETTER O WITH STROKE
   ____  @
  / _//\\ @
 | (//) |@
  \\//__/ @
         @@
217  LATIN CAPITAL LETTER U WITH GRAVE
   __   @
  _\\_\\_ @
 | |_| |@
  \\___/ @
        @@
218  LATIN CAPITAL LETTER U WITH ACUTE
    __  @
  _/_/_ @
 | |_| |@
  \\___/ @
        @@
219  LATIN CAPITAL LETTER U WITH CIRCUMFLEX
   //\\  @
  |/ \\| @
 | |_| |@
  \\___/ @
        @@
220  LATIN CAPITAL LETTER U WITH DIAERESIS
  _   _ @
 (_) (_)@
 | |_| |@
  \\___/ @
        @@
221  LATIN CAPITAL LETTER Y WITH ACUTE
   __ @
 _/_/_@
 \\ V /@
  |_| @
      @@
222  LATIN CAPITAL LETTER THORN
  _   @
 | |_ @
 | -_)@
 |_|  @
      @@
223  LATIN SMALL LETTER SHARP S
   ___ @
  / _ \\@
 | |< <@
 | ||_/@
 |_|   @@
224  LATIN SMALL LETTER A WITH GRAVE
  __   @
  \\_\\_ @
 / _\` |@
 \\__,_|@
       @@
225  LATIN SMALL LETTER A WITH ACUTE
    __ @
  _/_/ @
 / _\` |@
 \\__,_|@
       @@
226  LATIN SMALL LETTER A WITH CIRCUMFLEX
   /\\  @
  |/\\| @
 / _\` |@
 \\__,_|@
       @@
227  LATIN SMALL LETTER A WITH TILDE
   /\\/|@
  |/\\/ @
 / _\` |@
 \\__,_|@
       @@
228  LATIN SMALL LETTER A WITH DIAERESIS
  _  _ @
 (_)(_)@
 / _\` |@
 \\__,_|@
       @@
229  LATIN SMALL LETTER A WITH RING ABOVE
   __  @
  (()) @
 / _\` |@
 \\__,_|@
       @@
230  LATIN SMALL LETTER AE
         @
  __ ___ @
 / _\` -_)@
 \\__,___|@
         @@
231  LATIN SMALL LETTER C WITH CEDILLA
     @
  __ @
 / _|@
 \\__|@
  )_)@@
232  LATIN SMALL LETTER E WITH GRAVE
  __  @
  \\_\\ @
 / -_)@
 \\___|@
      @@
233  LATIN SMALL LETTER E WITH ACUTE
   __ @
  /_/ @
 / -_)@
 \\___|@
      @@
234  LATIN SMALL LETTER E WITH CIRCUMFLEX
  //\\ @
 |/_\\|@
 / -_)@
 \\___|@
      @@
235  LATIN SMALL LETTER E WITH DIAERESIS
  _   _ @
 (_)_(_)@
  / -_) @
  \\___| @
        @@
236  LATIN SMALL LETTER I WITH GRAVE
 __ @
 \\_\\@
 | |@
 |_|@
    @@
237  LATIN SMALL LETTER I WITH ACUTE
  __@
 /_/@
 | |@
 |_|@
    @@
238  LATIN SMALL LETTER I WITH CIRCUMFLEX
  //\\ @
 |/_\\|@
  | | @
  |_| @
      @@
239  LATIN SMALL LETTER I WITH DIAERESIS
  _   _ @
 (_)_(_)@
   | |  @
   |_|  @
        @@
240  LATIN SMALL LETTER ETH
  \\\\/\\ @
  \\/\\\\ @
 / _\` |@
 \\___/ @
       @@
241  LATIN SMALL LETTER N WITH TILDE
  /\\/| @
 |/\\/  @
 | ' \\ @
 |_||_|@
       @@
242  LATIN SMALL LETTER O WITH GRAVE
  __  @
  \\_\\ @
 / _ \\@
 \\___/@
      @@
243  LATIN SMALL LETTER O WITH ACUTE
   __ @
  /_/ @
 / _ \\@
 \\___/@
      @@
244  LATIN SMALL LETTER O WITH CIRCUMFLEX
  //\\ @
 |/_\\|@
 / _ \\@
 \\___/@
      @@
245  LATIN SMALL LETTER O WITH TILDE
  /\\/|@
 |/\\/ @
 / _ \\@
 \\___/@
      @@
246  LATIN SMALL LETTER O WITH DIAERESIS
  _   _ @
 (_)_(_)@
  / _ \\ @
  \\___/ @
        @@
247  DIVISION SIGN
   _  @
  (_) @
 |___|@
  (_) @
      @@
248  LATIN SMALL LETTER O WITH STROKE
      @
  ___ @
 / //\\@
 \\//_/@
      @@
249  LATIN SMALL LETTER U WITH GRAVE
  __   @
  \\_\\_ @
 | || |@
  \\_,_|@
       @@
250  LATIN SMALL LETTER U WITH ACUTE
    __ @
  _/_/ @
 | || |@
  \\_,_|@
       @@
251  LATIN SMALL LETTER U WITH CIRCUMFLEX
   /\\  @
  |/\\| @
 | || |@
  \\_,_|@
       @@
252  LATIN SMALL LETTER U WITH DIAERESIS
  _  _ @
 (_)(_)@
 | || |@
  \\_,_|@
       @@
253  LATIN SMALL LETTER Y WITH ACUTE
    __ @
  _/_/ @
 | || |@
  \\_, |@
  |__/ @@
254  LATIN SMALL LETTER THORN
  _    @
 | |__ @
 | '_ \\@
 | .__/@
 |_|   @@
255  LATIN SMALL LETTER Y WITH DIAERESIS
  _  _ @
 (_)(_)@
 | || |@
  \\_, |@
  |__/ @@
`;qo.parseFont("Big",vS);qo.parseFont("Small",yS);function bS(l,i="Big"){const[s,u]=b.useState(()=>({text:null,isLoading:!0,error:null}));return b.useEffect(()=>{let o=!1;return qo.text(l.toUpperCase(),{font:i},(f,_)=>{o||u({text:f?null:_??null,isLoading:!1,error:f?f instanceof Error?f:new Error(String(f)):null})}),()=>{o=!0}},[l,i]),s}function xS({startTime:l,elapsedMs:i=0,running:s=!1}={}){const[u,o]=b.useState(i);return b.useEffect(()=>{if(!s||!l)return;const f=setInterval(()=>{o(Date.now()-l.getTime()+i)},100);return()=>clearInterval(f)},[s,l,i]),b.useEffect(()=>{s||o(i)},[i,s]),{elapsed:u}}function SS({text:l="STARGAZER",scale:i=1,className:s}){const{text:u,isLoading:o}=bS(l),f=!o&&u;return d.jsx("pre",{className:Z("font-mono whitespace-pre select-none",f?"leading-none":"opacity-50",s),style:i!==1?{zoom:i}:void 0,"aria-label":l.toUpperCase(),children:f?u:l})}function TS({providerName:l="Not configured",providerStatus:i="idle",subtitle:s}){return d.jsxs("header",{className:"relative p-4 pb-2 shrink-0",children:[d.jsxs("div",{className:"absolute top-4 right-4 text-xs",children:[d.jsx("span",{className:"text-gray-500",children:"●"})," ",l," ",d.jsx("span",{className:"text-gray-500",children:"•"})," ",d.jsx("span",{className:"text-gray-500 capitalize",children:i})]}),d.jsxs("div",{className:"flex flex-col items-center pt-4 md:pt-6",children:[d.jsx(SS,{text:"stargazer",className:Z("text-tui-blue font-bold whitespace-pre leading-none select-none","text-[8px] md:text-[10px] lg:text-xs","[zoom:0.8] md:[zoom:1] lg:[zoom:1.2]")}),s&&d.jsx("div",{className:"mt-2 text-center text-gray-500 text-xs",children:s}),d.jsx("div",{className:"text-center text-gray-600 text-sm select-none",children:"─ ✦ ─ ✧ ─"})]})]})}function kh(l){return l.map((i,s)=>d.jsxs("span",{children:[d.jsx("span",{children:i.key})," ",d.jsx("span",{children:i.label}),s<l.length-1&&d.jsx("span",{className:"text-gray-500",children:"•"})]},i.key+i.label))}function ES({shortcuts:l,rightShortcuts:i,className:s=""}){return d.jsxs("footer",{className:`bg-tui-fg text-black p-2 font-bold text-xs shrink-0 flex justify-between items-center ${s}`,children:[d.jsx("div",{className:"flex gap-4",children:kh(l)}),i&&i.length>0&&d.jsx("div",{className:"flex gap-4",children:kh(i)})]})}const Vg=b.createContext(void 0),AS=[{key:"?",label:"Help"},{key:"q",label:"Quit"}];function RS({children:l}){const[i,s]=b.useState(AS),[u,o]=b.useState([]),f=b.useCallback(p=>{s(p)},[]),_=b.useCallback(p=>{o(p)},[]),h=b.useMemo(()=>({shortcuts:i,rightShortcuts:u,setShortcuts:f,setRightShortcuts:_}),[i,u,f,_]);return d.jsx(Vg.Provider,{value:h,children:l})}function Fo(){const l=b.useContext(Vg);if(l===void 0)throw new Error("useFooter must be used within a FooterProvider");return l}const NS=St("w-full border border-tui-border bg-tui-bg shadow-2xl",{variants:{variant:{success:"border-tui-green",error:"border-tui-red",warning:"border-tui-yellow",info:"border-tui-blue"}},defaultVariants:{variant:"info"}}),CS=St("font-bold",{variants:{variant:{success:"text-tui-green",error:"text-tui-red",warning:"text-tui-yellow",info:"text-tui-blue"}},defaultVariants:{variant:"info"}}),wS={success:"✓",error:"✕",warning:"!",info:"i"},zh={success:"Saved",error:"Error",warning:"Warning",info:"Info"};function LS({id:l,variant:i="info",title:s,message:u,onDismiss:o,onRemove:f,dismissing:_}){const h=s||zh[i];return d.jsxs("div",{role:i==="error"?"alert":"status","aria-live":i==="error"?"assertive":"polite","aria-atomic":"true",className:Z(NS({variant:i}),_?"motion-safe:animate-slide-out-right":"motion-safe:animate-slide-in-right"),onAnimationEnd:()=>{_&&f(l)},children:[d.jsxs("div",{className:"flex items-center justify-between px-3 py-1.5 border-b border-tui-border bg-tui-selection/40",children:[d.jsxs("div",{className:"flex items-center gap-2",children:[d.jsx("span",{className:Z(CS({variant:i})),"aria-hidden":"true",children:wS[i]}),d.jsxs("span",{className:"sr-only",children:[zh[i],":"]}),d.jsx("span",{className:"text-xs font-bold uppercase tracking-tight text-tui-fg",children:h})]}),d.jsx("button",{onClick:()=>o(l),className:"text-[10px] text-gray-500 hover:text-tui-fg","aria-label":"Dismiss notification",children:"✕"})]}),u&&d.jsx("div",{className:"p-3 text-sm",children:d.jsx("span",{className:"text-tui-fg/90",children:u})})]})}const Zg=b.createContext(void 0),jS=5e3;function OS({children:l}){const[i,s]=b.useState([]),[u,o]=b.useState(new Set),f=b.useRef(new Map),_=b.useCallback(y=>{o(T=>new Set(T).add(y))},[]),h=b.useCallback(y=>{const T=crypto.randomUUID(),E={...y,id:T};if(s(U=>[...U,E].slice(-5)),y.variant!=="error"){const U=y.duration??jS,I=setTimeout(()=>_(T),U);f.current.set(T,I)}},[_]),p=b.useCallback(y=>{const T=f.current.get(y);T&&(clearTimeout(T),f.current.delete(y)),s(E=>E.filter(U=>U.id!==y)),o(E=>{const U=new Set(E);return U.delete(y),U})},[]),v=b.useMemo(()=>({toasts:i,dismissingIds:u,showToast:h,dismissToast:_,removeToast:p}),[i,u,h,_,p]);return d.jsx(Zg.Provider,{value:v,children:l})}function ss(){const l=b.useContext(Zg);if(l===void 0)throw new Error("useToast must be used within a ToastProvider");return l}function IS(){const{toasts:l,dismissingIds:i,dismissToast:s,removeToast:u}=ss();return l.length===0?null:d.jsx("div",{role:"region","aria-label":"Notifications",className:Z("fixed z-50 flex flex-col gap-2 pointer-events-auto","bottom-4 left-4 right-4","sm:left-auto sm:right-8 sm:w-80"),children:l.map(o=>d.jsx(LS,{...o,onDismiss:s,onRemove:u,dismissing:i.has(o.id)},o.id))})}function MS(l,i){return l?"idle":i?"active":"idle"}function DS(l,i){return l?i?`${l} / ${i}`:l:"Not configured"}function kS({children:l}){const{provider:i,model:s,isConfigured:u,isLoading:o}=Yr(),{shortcuts:f,rightShortcuts:_}=Fo(),h=MS(o,u),p=DS(i,s);return d.jsxs("div",{className:"tui-base h-screen flex flex-col overflow-hidden selection:bg-tui-blue selection:text-black",children:[d.jsx(TS,{providerName:p,providerStatus:h}),d.jsx("main",{className:"flex-1 flex flex-col overflow-hidden",children:l}),d.jsx(ES,{shortcuts:f,rightShortcuts:_}),d.jsx(IS,{})]})}function zS(){const{connected:l,isChecking:i,error:s,retry:u}=t0();return Yr(),!i&&!l?d.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center bg-[--tui-bg] text-[--tui-fg] space-y-4",children:[d.jsx("h1",{className:"text-2xl font-bold text-[--tui-red]",children:"Server Disconnected"}),d.jsx("p",{className:"text-[--tui-fg] opacity-60",children:s||"Could not connect to Stargazer server."}),d.jsx(Jt,{onClick:u,children:"Retry Connection"})]}):d.jsx(RS,{children:d.jsx(OS,{children:d.jsx(kS,{children:d.jsx(Fy,{})})})})}function Xo(){const l=b.useContext(Ng);if(!l)throw new Error("useKeyboardContext must be used within KeyboardProvider");return l}function W(l,i,s){const{register:u,activeScope:o}=Xo(),f=b.useEffectEvent(i);b.useEffect(()=>{if(s?.enabled!==!1&&o)return u(o,l,f,s)},[u,o,l,s?.enabled,s?.allowInInput])}function ko(l,i,s){const{register:u,activeScope:o}=Xo(),f=b.useEffectEvent(i),_=l.join(",");b.useEffect(()=>{if(s?.enabled===!1||!o)return;const h=l.map((p,v)=>u(o,p,()=>f(p,v)));return()=>h.forEach(p=>p())},[u,o,_,s?.enabled])}function Ln(l,i={}){const{enabled:s=!0}=i,{pushScope:u}=Xo();b.useEffect(()=>{if(s)return u(l)},[l,u,s])}const US=["ArrowUp","k"],HS=["ArrowDown","j"];function GS({itemCount:l,getDisabled:i=()=>!1,wrap:s=!0,onBoundaryReached:u,onFocus:o,enabled:f=!0,initialIndex:_=0,upKeys:h=US,downKeys:p=HS}){const[v,y]=b.useState(_),T=(I,D)=>{let K=I+D;for(;K>=0&&K<l;){if(!i(K))return K;K+=D}return I},E=()=>{if(l===0)return;if(v===0){if(s){let D=l-1;for(;D>0&&i(D);)D--;y(D),o?.(D)}else u?.("up");return}const I=T(v,-1);y(I),o?.(I)},U=()=>{if(l===0)return;if(v===l-1){if(s){let D=0;for(;D<l-1&&i(D);)D++;y(D),o?.(D)}else u?.("down");return}const I=T(v,1);y(I),o?.(I)};return ko(h,E,{enabled:f&&l>0}),ko(p,U,{enabled:f&&l>0}),{focusedIndex:v,setFocusedIndex:y}}function qr({containerRef:l,role:i,value:s,onValueChange:u,onSelect:o,onEnter:f,onFocusChange:_,wrap:h=!0,enabled:p=!0,onBoundaryReached:v,initialValue:y=null}){const[T,E]=b.useState(y),U=s!==void 0,I=U?s:T,D=b.useCallback(()=>l.current?Array.from(l.current.querySelectorAll(`[role="${i}"]:not([aria-disabled="true"])`)):[],[l,i]),K=b.useCallback(()=>{const te=D();if(!I)return 0;const ge=te.findIndex(ne=>ne.dataset.value===I);return ge>=0?ge:0},[D,I]),le=b.useCallback(te=>{const ne=D()[te];ne?.dataset.value&&(U?u?.(ne.dataset.value):(E(ne.dataset.value),_?.(ne.dataset.value)))},[D,U,u,_]),ve=b.useCallback(te=>{const ge=D();if(ge.length===0)return;let Xe=K()+te;if(Xe<0)if(h)Xe=ge.length-1;else{v?.("up");return}else if(Xe>=ge.length)if(h)Xe=0;else{v?.("down");return}le(Xe)},[D,K,le,h,v]),ae=b.useCallback(()=>{I&&o?.(I)},[I,o]);W("ArrowUp",()=>ve(-1),{enabled:p}),W("ArrowDown",()=>ve(1),{enabled:p}),W("Enter",()=>{I&&(f?f(I):o?.(I))},{enabled:p}),W(" ",ae,{enabled:p});const q=b.useCallback(te=>I===te,[I]),ie=b.useCallback(te=>{U?u?.(te):(E(te),_?.(te))},[U,u,_]);return{focusedValue:I,isFocused:q,focus:ie}}function BS({focusZone:l,buttonIndex:i,buttonsCount:s,onButtonIndexChange:u,onFocusZoneChange:o,onSave:f,onRevoke:_}){const h=l==="buttons";W("ArrowLeft",()=>u(Math.max(0,i-1)),{enabled:h}),W("ArrowRight",()=>u(Math.min(s-1,i+1)),{enabled:h}),W("ArrowUp",()=>{o("list"),u(0)},{enabled:h}),W("Enter",()=>{i===0&&f?f():i===1&&_&&_()},{enabled:h}),W(" ",()=>{i===0&&f?f():i===1&&_&&_()},{enabled:h})}function VS({enabled:l,buttonCount:i,onAction:s}){const[u,o]=b.useState(!1),[f,_]=b.useState(0),h=b.useCallback((y=0)=>{o(!1),_(y)},[]),p=b.useCallback((y=0)=>{o(!0),_(y)},[]),v=b.useCallback(()=>{o(!1)},[]);return W("ArrowUp",v,{enabled:u}),W("ArrowLeft",()=>{_(y=>y>0?y-1:i-1)},{enabled:u}),W("ArrowRight",()=>{_(y=>y<i-1?y+1:0)},{enabled:u}),W("Enter",()=>s(f),{enabled:u}),W(" ",()=>s(f),{enabled:u}),{inFooter:u,focusedIndex:f,setFocusedIndex:_,enterFooter:p,exitFooter:v,reset:h}}function il(l,i){const{pathname:s}=Xy();return mS(l,i,{scope:s})}const ZS=[];function Uh(l,i){return l.length!==i.length?!1:l.every((s,u)=>s.key===i[u].key&&s.label===i[u].label)}function Ea({shortcuts:l,rightShortcuts:i}){const{setShortcuts:s,setRightShortcuts:u}=Fo(),o=i??ZS,f=b.useRef([]),_=b.useRef([]);b.useEffect(()=>{Uh(f.current,l)||(s(l),f.current=l),Uh(_.current,o)||(u(o),_.current=o)},[l,o,s,u])}const KS=St("font-bold",{variants:{tagType:{system:"text-tui-violet",tool:"text-tui-blue",lens:"text-tui-violet",warning:"text-tui-yellow",error:"text-tui-red",agent:"text-tui-violet",thinking:"text-gray-500"}},defaultVariants:{tagType:"system"}});function YS({timestamp:l,tag:i,tagType:s,source:u,message:o,isWarning:f,isError:_,isMuted:h,className:p}){return d.jsxs("div",{className:Z("font-mono text-sm leading-relaxed",h&&"opacity-50",p),children:[d.jsxs("span",{className:"text-gray-600",children:["[",hx(l),"]"]})," ",d.jsxs("span",{className:KS({tagType:s}),children:["[",i,"]"]})," ",u&&d.jsxs(d.Fragment,{children:[d.jsx("span",{className:"font-bold text-tui-fg",children:u}),d.jsx("span",{className:"text-gray-600",children:" → "})]}),d.jsx("span",{className:Z("text-gray-400",f&&"text-tui-yellow",_&&"text-tui-red"),children:o})]})}const Kg=b.forwardRef(({children:l,className:i,orientation:s="vertical",...u},o)=>d.jsx("div",{ref:o,className:Z("scrollbar-thin",s==="vertical"&&"overflow-y-auto",s==="horizontal"&&"overflow-x-auto",s==="both"&&"overflow-auto",i),...u,children:l}));Kg.displayName="ScrollArea";function qS({entries:l,showCursor:i,autoScroll:s=!0,className:u,...o}){const f=b.useRef(null),[_,h]=b.useState(!0),p=b.useCallback(()=>{const v=f.current;if(!v)return;const y=v.scrollHeight-v.scrollTop-v.clientHeight;h(y<=50)},[]);return b.useEffect(()=>{s&&_&&f.current&&(f.current.scrollTop=f.current.scrollHeight)},[l,s,_]),d.jsx(Kg,{ref:f,onScroll:p,className:Z("flex-1 font-mono text-sm leading-relaxed",u),...o,children:d.jsxs("div",{className:"space-y-1 p-2",children:[l.map(v=>d.jsx(YS,{timestamp:v.timestamp,tag:v.tag,tagType:v.tagType,source:v.source,message:v.message,isWarning:v.isWarning,isError:v.isError},v.id)),i&&d.jsx("span",{className:"inline-block h-4 w-2 bg-tui-fg cursor-blink"})]})})}const FS=St("inline-flex items-center font-bold tracking-wider rounded-sm border shrink-0 whitespace-nowrap",{variants:{variant:{success:"bg-tui-green/10 text-tui-green border-tui-green",warning:"bg-tui-yellow/10 text-tui-yellow border-tui-yellow",error:"bg-tui-red/10 text-tui-red border-tui-red",info:"bg-tui-blue/10 text-tui-blue border-tui-blue",neutral:"bg-tui-muted/10 text-tui-muted border-tui-border",stored:"bg-transparent text-tui-green border-transparent"},size:{sm:"px-2 py-0.5 text-xs",md:"px-3 py-1 text-sm"}},defaultVariants:{variant:"neutral",size:"sm"}});function pa({className:l,variant:i,size:s,children:u,...o}){return d.jsx("span",{className:Z(FS({variant:i,size:s}),l),...o,children:u})}function Hh({type:l,code:i,className:s}){return d.jsxs("span",{className:Z("border border-tui-red text-tui-red text-[10px] px-1",s),children:[l,"-",i]})}const XS={none:"",sm:"space-y-2",md:"space-y-4"},QS={default:"bg-tui-selection text-gray-400 text-xs px-3 py-1 border-b border-tui-border font-bold uppercase tracking-wider",subtle:"bg-tui-selection/30 text-gray-500 text-xs p-2 border-b border-tui-border uppercase tracking-widest text-center",floating:"absolute -top-3 left-4 bg-tui-bg px-2 text-xs text-tui-blue font-bold",badge:"absolute -top-3 left-4 bg-tui-bg px-2 py-0.5 text-xs font-bold",section:"text-gray-500 font-bold uppercase text-xs tracking-wider mb-4","section-bordered":"text-gray-500 font-bold uppercase text-xs tracking-wider border-b border-tui-border pb-2 mb-2"};function $S(l="default"){return l==="success-badge"?"bg-tui-green/10 text-tui-green border border-tui-green px-2 py-0.5 text-xs font-bold tracking-wider rounded-sm":l==="success"?"text-tui-green":l==="muted"?"text-gray-500":"text-gray-400"}function Wt({children:l,className:i,variant:s="default",value:u,valueVariant:o="default"}){const f=QS[s];return u!==void 0?d.jsxs("div",{className:Z(f,"flex items-center justify-between",i),children:[d.jsx("span",{children:l}),d.jsx("span",{className:$S(o),children:u})]}):d.jsx("div",{className:Z(f,i),children:l})}function wn({children:l,className:i,spacing:s="md"}){return d.jsx("div",{className:Z("p-4 text-sm",XS[s],i),children:l})}function JS({children:l,className:i,borderless:s}){return d.jsx("div",{className:Z("relative",!s&&"border border-tui-border",i),children:l})}const Ta=JS,Yg=b.createContext(void 0);function Qo(){const l=b.useContext(Yg);if(!l)throw new Error("Dialog compound components must be used within a Dialog");return l}function Gh(l,i){return s=>{l(),i?.(s)}}function qg({open:l,onOpenChange:i,children:s}){const[u,o]=b.useState(!1),f=l!==void 0?l:u,_=i||o,h=b.useId();Ln("dialog",{enabled:f}),W("Escape",()=>_(!1),{enabled:f});const p=b.useMemo(()=>({open:f,onOpenChange:_,titleId:`${h}-title`,descriptionId:`${h}-description`}),[f,_,h]);return d.jsx(Yg.Provider,{value:p,children:s})}function Fg({children:l,className:i,...s}){const{open:u,onOpenChange:o,titleId:f,descriptionId:_}=Qo();return u?d.jsxs("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-12",children:[d.jsx("div",{className:"absolute inset-0 bg-black/60 backdrop-blur-sm",onClick:()=>o(!1),"aria-hidden":"true"}),d.jsx("div",{className:Z("relative w-full max-w-2xl max-h-[90vh] flex flex-col","bg-tui-bg text-tui-fg","border-[6px] border-double border-tui-fg","shadow-[0_0_0_1px_rgb(48_54_61),0_30px_60px_-12px_rgba(0,0,0,0.9)]",i),role:"dialog","aria-modal":"true","aria-labelledby":f,"aria-describedby":_,...s,children:l})]}):null}function Xg({children:l,className:i,...s}){return d.jsx("div",{className:Z("flex justify-between items-center py-2 px-4 border-b-2 border-tui-border bg-tui-bg shrink-0",i),...s,children:l})}function Qg({children:l,className:i,...s}){const{titleId:u}=Qo();return d.jsx("h2",{id:u,className:Z("font-bold text-sm",i),...s,children:l})}function $g({children:l,className:i,...s}){return d.jsx("div",{className:Z("flex-1 overflow-y-auto px-4 py-3",i),...s,children:l})}function Jg({children:l,className:i,...s}){return d.jsx("div",{className:Z("flex gap-2 justify-end items-center py-2 px-4 border-t-2 border-tui-border bg-tui-bg shrink-0",i),...s,children:l})}function WS({children:l,asChild:i,...s}){const{onOpenChange:u}=Qo(),o=Gh(()=>u(!1),s.onClick);if(i&&b.isValidElement(l)){const f=l;return b.cloneElement(f,{...s,onClick:Gh(()=>u(!1),f.props.onClick)})}return d.jsx("button",{...s,onClick:o,children:l||"[x]"})}const Wg=St("flex cursor-pointer select-none font-mono relative",{variants:{size:{sm:"",md:"",lg:""},focused:{true:"bg-tui-selection text-white font-bold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-tui-blue",false:"text-tui-fg hover:bg-tui-selection/50"},disabled:{true:"opacity-50 cursor-not-allowed",false:""}},defaultVariants:{size:"md",focused:!1,disabled:!1}}),Pg=St("flex items-center gap-3 px-3 py-2"),ep=St("font-bold",{variants:{size:{sm:"text-sm min-w-4",md:"min-w-5",lg:"text-lg min-w-6"},checked:{true:"",false:""},focused:{true:"",false:""}},compoundVariants:[{checked:!0,focused:!1,className:"text-tui-green"}],defaultVariants:{size:"md",checked:!1,focused:!1}}),zo=St("",{variants:{size:{sm:"text-sm",md:"text-base",lg:"text-lg"}},defaultVariants:{size:"md"}}),tp=St("text-sm mt-0.5",{variants:{focused:{true:"text-white/70",false:"text-tui-muted"}},defaultVariants:{focused:!1}});function PS({checked:l,defaultChecked:i=!1,onCheckedChange:s,label:u,description:o,disabled:f=!1,focused:_=!1,size:h="md",variant:p="x",className:v,"data-value":y}){const[T,E]=b.useState(i),U=l!==void 0,I=U?l:T,D=ve=>{f||(s?.(ve),U||E(ve))},K=()=>{D(!I)},le=ve=>{f||(ve.key===" "||ve.key==="Enter")&&(ve.preventDefault(),D(!I))};return d.jsxs("div",{role:"checkbox","data-value":y,"aria-checked":I,"aria-disabled":f,tabIndex:f?-1:0,onClick:K,onKeyDown:le,className:Z(Wg({focused:_,disabled:f}),Pg(),o&&"items-start",v),children:[d.jsx("span",{className:ep({size:h,checked:I,focused:_}),children:p==="x"?I?"[x]":"[ ]":I?"[ ● ]":"[   ]"}),u&&d.jsxs("div",{className:Z("flex flex-col min-w-0",!o&&"justify-center"),children:[d.jsx("span",{className:zo({size:h}),children:u}),o&&d.jsx("span",{className:tp({focused:_}),children:o})]})]})}const ap=b.createContext(void 0);function eT(){const l=b.useContext(ap);if(!l)throw new Error("CheckboxItem must be used within CheckboxGroup");return l}function tT({value:l,defaultValue:i=[],onValueChange:s,onEnter:u,disabled:o=!1,size:f="md",variant:_="x",className:h,children:p,wrap:v=!0,onBoundaryReached:y}){const T=b.useRef(null),[E,U]=b.useState(i),I=l!==void 0,D=I?l:E,K=ie=>{s?.(ie),I||U(ie)},le=ie=>{if(o)return;const te=D.includes(ie)?D.filter(ge=>ge!==ie):[...D,ie];K(te)},ve=ie=>{if(o)return;const te=D.includes(ie)?D.filter(ge=>ge!==ie):[...D,ie];K(te),u&&u(ie,te)},{isFocused:ae}=qr({containerRef:T,role:"checkbox",onSelect:le,onEnter:u?ve:void 0,wrap:v,onBoundaryReached:y,enabled:!o,initialValue:D[0]??null}),q=b.useMemo(()=>({value:D,toggle:le,disabled:o,size:f,variant:_,isFocused:ae}),[D,le,o,f,_,ae]);return d.jsx(ap.Provider,{value:q,children:d.jsx("div",{ref:T,role:"group",className:Z("flex flex-col gap-2",h),children:p})})}function aT({value:l,label:i,description:s,disabled:u=!1,className:o}){const f=eT(),_=f.value.includes(l),h=u||f.disabled,p=f.isFocused(l);return d.jsx(PS,{"data-value":l,checked:_,onCheckedChange:()=>f.toggle(l),label:i,description:s,disabled:h,focused:p,size:f.size,variant:f.variant,className:o})}const nT=St("flex w-full bg-[--tui-bg] border border-[--tui-border] text-[--tui-fg] font-mono placeholder:text-[--tui-fg]/50 transition-colors focus:border-[--tui-blue] focus:ring-1 focus:ring-[--tui-blue] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",{variants:{size:{sm:"h-7 px-2 py-1 text-xs",md:"h-9 px-3 py-2 text-sm",lg:"h-11 px-4 py-2 text-base"}},defaultVariants:{size:"md"}});function np({className:l,size:i,ref:s,...u}){return d.jsx("input",{className:Z(nT({size:i,className:l})),ref:s,...u})}function Uo({checked:l=!1,onCheckedChange:i,label:s,description:u,disabled:o=!1,focused:f=!1,size:_="md",className:h,"data-value":p}){const v=()=>{o||i?.(!l)};return d.jsxs("div",{role:"radio","data-value":p,"aria-checked":l,"aria-disabled":o,onClick:v,className:Z(Wg({focused:f,disabled:o}),Pg(),u&&"items-start",h),children:[d.jsx("span",{className:ep({size:_,checked:l,focused:f}),children:l?"[ ● ]":"[   ]"}),s&&!u&&d.jsx("span",{className:zo({size:_}),children:s}),s&&u&&d.jsxs("div",{className:"flex flex-col min-w-0",children:[d.jsx("span",{className:zo({size:_}),children:s}),d.jsx("span",{className:tp({focused:f}),children:u})]})]})}const lp=b.createContext(void 0);function lT(){const l=b.useContext(lp);if(!l)throw new Error("RadioGroup.Item must be used within RadioGroup");return l}function iT({value:l,defaultValue:i,onValueChange:s,onFocus:u,onFocusZoneEnter:o,orientation:f="vertical",disabled:_=!1,size:h="md",className:p,children:v,wrap:y=!0,onBoundaryReached:T}){const E=b.useRef(null),[U,I]=b.useState(i),D=l!==void 0,K=D?l:U,le=q=>{_||(s?.(q),D||I(q))},{isFocused:ve}=qr({containerRef:E,role:"radio",onSelect:le,onFocusChange:u,wrap:y,onBoundaryReached:T,enabled:!_,initialValue:K??null}),ae=b.useMemo(()=>({value:K,onValueChange:le,disabled:_,size:h,isFocused:ve,onFocusZoneEnter:o}),[K,le,_,h,ve,o]);return d.jsx(lp.Provider,{value:ae,children:d.jsx("div",{ref:E,role:"radiogroup","aria-orientation":f,className:Z("flex font-mono",f==="vertical"?"flex-col gap-1":"flex-row gap-4",p),children:v})})}function sT({value:l,label:i,description:s,disabled:u,className:o}){const f=lT(),_=f.value===l,h=f.disabled||u,p=f.isFocused(l),v=()=>{f.onFocusZoneEnter?.(),f.onValueChange(l)};return d.jsx(Uo,{"data-value":l,checked:_,onCheckedChange:v,label:i,description:s,disabled:h,focused:p,size:f.size,className:o})}const rT=iT;function uT({title:l,severity:i,file:s,line:u,className:o}){const f=ei[i]?.color??"text-gray-300";return d.jsxs("div",{className:Z("mb-6",o),children:[d.jsx("h1",{className:Z("text-xl font-bold mb-1",f),children:l}),d.jsxs("div",{className:"text-xs text-gray-500",children:["Location: ",d.jsxs("span",{className:"text-tui-fg",children:["src/",s,":",u]})]})]})}function ip({issue:l,isSelected:i,onClick:s,className:u}){const o=l.severity,f=ei[o]??ei.medium;return d.jsxs("button",{type:"button",onClick:s,className:Z("w-full text-left px-2 py-1 flex items-center cursor-pointer",i&&"bg-tui-blue text-black font-bold",!i&&"hover:bg-tui-selection group",u),children:[d.jsx("span",{className:Z("mr-2",i&&"text-black",!i&&"opacity-0 group-hover:opacity-100"),"aria-hidden":"true",children:"|"}),d.jsx("span",{className:Z("mr-2",i?"text-black":f.color),"aria-hidden":"true",children:f.icon}),d.jsxs("div",{className:"flex flex-col min-w-0",children:[d.jsx("span",{className:"truncate",children:l.title}),d.jsxs("span",{className:Z("text-[10px]",i?"opacity-80":"text-gray-500"),children:[l.file,":",l.line_start]})]})]})}function cT({title:l,file:i,line:s,category:u,severity:o,onClick:f,className:_}){const{icon:h,color:p,label:v,borderColor:y}=ei[o];return d.jsxs("button",{type:"button",onClick:f,className:Z("flex items-center justify-between p-3 w-full text-left","bg-tui-bg border-b border-gray-800 last:border-b-0","hover:bg-tui-selection group cursor-pointer transition-colors",_),children:[d.jsxs("div",{className:"flex items-center gap-4",children:[d.jsx("span",{className:Z("font-bold text-lg",p),"aria-hidden":"true",children:h}),d.jsxs("div",{children:[d.jsx("div",{className:"text-sm font-bold group-hover:text-tui-blue transition-colors",children:l}),d.jsxs("div",{className:"text-xs text-gray-500 font-mono",children:[i,":",s]})]})]}),d.jsxs("div",{className:"flex items-center gap-4",children:[d.jsx("span",{className:"hidden sm:inline text-xs text-gray-500",children:u}),d.jsx("span",{className:Z("text-[10px] border px-1.5 py-0.5 uppercase tracking-wide",y,p),children:v})]})]})}const sp=b.createContext(null);function oT(){const l=b.useContext(sp);if(!l)throw new Error("Menu.Item must be used within Menu");return l}function Rn({id:l,disabled:i=!1,variant:s="default",hotkey:u,value:o,valueVariant:f="default",children:_,className:h}){const{selectedIndex:p,onSelect:v,onActivate:y,items:T,variant:E}=oT(),U=T.find(ge=>ge.id===l);if(!U)return null;const I=U.index===p,D=s==="danger",K=E==="hub",le=()=>{i||(v(U.index),y?.(U))},ve=D?"bg-tui-red":"bg-tui-blue",ae=K?"px-4 py-4 flex justify-between items-center cursor-pointer text-sm w-full border-b border-tui-border last:border-b-0":"px-4 py-3 flex items-center cursor-pointer font-mono w-full",q=I?Z(ve,"text-black font-bold",K&&"shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]"):Z(K?"text-tui-fg":D?"text-tui-red":"text-tui-fg","hover:bg-tui-selection group transition-colors",!K&&"duration-75"),ie=()=>I?"font-mono text-xs uppercase tracking-wide":f==="success-badge"?"text-tui-green font-mono text-xs border border-tui-green/30 bg-tui-green/10 px-2 py-0.5 rounded":f==="success"?"text-tui-violet font-mono text-xs":"text-gray-500 font-mono text-xs",te=D?"text-tui-red":"text-tui-blue";return d.jsx("div",{role:"option","aria-selected":I,"aria-disabled":i,onClick:le,className:Z(ae,q,i&&"opacity-50 cursor-not-allowed",h),children:K?d.jsxs(d.Fragment,{children:[d.jsxs("div",{className:"flex items-center",children:[d.jsx("span",{className:Z("w-6",I?"text-black":"text-tui-blue opacity-0 group-hover:opacity-100 transition-opacity"),children:I?"▌":"❯"}),d.jsx("span",{className:Z(I?"":"font-medium group-hover:text-white"),children:_})]}),o&&d.jsx("div",{className:ie(),children:o})]}):d.jsxs(d.Fragment,{children:[d.jsx("span",{className:Z("mr-3 shrink-0",!I&&Z("opacity-0 group-hover:opacity-100",te)),children:"▌"}),u!==void 0&&d.jsxs("span",{className:Z("mr-4 shrink-0",!I&&Z("group-hover:text-tui-fg",te)),children:["[",u,"]"]}),d.jsx("span",{className:Z(!K&&"tracking-wide",!I&&!D&&"group-hover:text-white"),children:_})]})})}function $o({selectedIndex:l,onSelect:i,onActivate:s,keyboardEnabled:u=!0,enableNumberJump:o=!1,variant:f="default",className:_,children:h}){const p=[];let v=0;function y(I){b.Children.forEach(I,D=>{if(b.isValidElement(D)){if(D.type===b.Fragment)y(D.props.children);else if(D.type===Rn){const K=D.props;p.push({id:K.id,disabled:K.disabled??!1,index:v++})}}})}y(h);const T=(I,D)=>{let K=I+D;for(;K>=0&&K<p.length;){if(!p[K]?.disabled)return K;K+=D}return I};W("ArrowUp",()=>{const I=T(l,-1);I!==l&&i(I)},{enabled:u}),W("ArrowDown",()=>{const I=T(l,1);I!==l&&i(I)},{enabled:u}),W("Enter",()=>{const I=p[l];I&&!I.disabled&&s?.(I)},{enabled:u}),ko(["1","2","3","4","5","6","7","8","9"],I=>{const D=parseInt(I,10)-1,K=p[D];K&&!K.disabled&&(i(D),s?.(K))},{enabled:u&&o});const U={selectedIndex:l,onSelect:i,onActivate:s,items:p,variant:f};return d.jsx(sp.Provider,{value:U,children:d.jsx("div",{role:"listbox",className:Z("w-full relative",_),children:h})})}function Bh({className:l}){return d.jsx("div",{className:Z("my-1 border-t border-tui-border mx-4 opacity-50",l)})}const rp=b.createContext(null);function dT(){const l=b.useContext(rp);if(!l)throw new Error("NavigationList.Item must be used within NavigationList");return l}function fT({selectedId:l,onSelect:i,onActivate:s,keyboardEnabled:u=!0,isFocused:o=!0,className:f,children:_,onBoundaryReached:h}){const p=b.useRef(null),{focusedValue:v}=qr({containerRef:p,role:"option",value:l,onValueChange:i,onEnter:s,enabled:u,wrap:!1,onBoundaryReached:h}),y={selectedId:l,onSelect:i,onActivate:s,isFocused:o};return d.jsx(rp.Provider,{value:y,children:d.jsx("div",{ref:p,role:"listbox","aria-activedescendant":v??void 0,className:Z("w-full",f),children:_})})}function _T({id:l,disabled:i=!1,badge:s,statusIndicator:u,subtitle:o,children:f,className:_}){const{selectedId:h,onSelect:p,onActivate:v,isFocused:y}=dT(),T=h===l,E=T&&y,U=()=>{i||(p(l),v?.(l))};return d.jsxs("div",{id:l,role:"option","data-value":l,"aria-selected":T,"aria-disabled":i,onClick:U,className:Z("flex cursor-pointer group",E&&"bg-tui-fg text-black",!E&&"hover:bg-tui-selection border-b border-tui-border/50",i&&"opacity-50 cursor-not-allowed",_),children:[d.jsx("div",{className:Z("w-1 shrink-0",E?"bg-tui-blue":"bg-transparent group-hover:bg-gray-700")}),d.jsxs("div",{className:"flex-1 p-3",children:[d.jsxs("div",{className:"flex justify-between items-start mb-1",children:[d.jsxs("span",{className:Z("font-bold flex items-center",E&&"text-black"),children:[d.jsx("span",{className:Z("mr-2",!E&&"opacity-0"),children:"▌"}),f]}),u&&d.jsx("span",{className:Z("text-[10px] font-bold",E?"text-black":"text-tui-yellow"),children:u})]}),(s||o)&&d.jsxs("div",{className:"flex gap-2 items-center",children:[s,o&&d.jsx("span",{className:Z("text-[9px]",E?"text-black/70":"text-gray-500"),children:o})]})]})]})}const mT=St("flex items-center gap-2 py-1 text-sm",{variants:{status:{pending:"text-gray-600",active:"text-tui-blue font-medium animate-pulse",completed:"text-tui-fg"}},defaultVariants:{status:"pending"}});function hT({emoji:l,label:i,status:s,className:u}){return d.jsxs("div",{className:Z(mT({status:s}),u),children:[d.jsx("span",{className:"w-5 text-center",children:l}),d.jsx("span",{children:i}),s==="active"&&d.jsx("span",{className:"ml-auto text-xs text-gray-500",children:"analyzing..."}),s==="completed"&&d.jsx("span",{className:"ml-auto text-xs text-tui-green",children:"✓"})]})}const gT=St("flex items-start gap-3",{variants:{status:{completed:"",active:"bg-tui-selection py-2 -mx-3 px-3 rounded border-l-2 border-tui-blue",pending:""}},defaultVariants:{status:"pending"}}),pT=St("font-mono text-sm shrink-0 w-4 text-center",{variants:{status:{completed:"text-tui-green",active:"text-tui-blue",pending:"text-gray-600"}},defaultVariants:{status:"pending"}}),vT=St("text-sm",{variants:{status:{completed:"text-tui-fg",active:"font-bold text-tui-blue",pending:"text-gray-600"}},defaultVariants:{status:"pending"}}),yT={completed:"✓",active:"▶",pending:"○"};function bT({label:l,status:i,substeps:s,children:u,isExpanded:o=!1,onToggle:f,className:_}){const h=b.useRef(null),[p,v]=b.useState(0),y=!!(u||s&&s.length>0);b.useEffect(()=>{h.current&&v(h.current.scrollHeight)},[u,s,o]);const T=()=>{y&&f&&f()},E=U=>{(U.key==="Enter"||U.key===" ")&&(U.preventDefault(),T())};return d.jsxs("div",{className:_,children:[d.jsxs("div",{className:Z(gT({status:i}),y&&"cursor-pointer"),onClick:T,onKeyDown:E,tabIndex:y?0:void 0,role:y?"button":void 0,children:[d.jsx("span",{className:pT({status:i}),children:yT[i]}),d.jsx("span",{className:vT({status:i}),children:l})]}),y&&d.jsx("div",{style:{height:o?p:0},className:"overflow-hidden transition-[height] duration-200 ease-in-out",children:d.jsxs("div",{ref:h,className:"pt-2 pl-7",children:[s&&s.length>0&&d.jsx("div",{className:"space-y-1 mb-2",children:s.map(U=>d.jsx(hT,{...U},U.id))}),u]})})]})}function xT({steps:l,expandedIds:i=[],onToggle:s,className:u}){return d.jsx("div",{className:Z("space-y-4",u),children:l.map(o=>d.jsx(bT,{label:o.label,status:o.status,substeps:o.substeps,isExpanded:i.includes(o.id),onToggle:s?()=>s(o.id):void 0,children:o.content},o.id))})}function Xl({label:l,count:i,max:s,severity:u,className:o}){const{color:f}=ei[u],_=s>0?Math.round(i/s*bh):0,h=bh-_;return d.jsxs("div",{className:Z("flex items-center font-mono text-sm",o),children:[d.jsx("span",{className:"w-20 text-xs text-gray-500",children:l}),d.jsxs("div",{className:"flex-1 flex items-center tracking-widest",children:[d.jsx("span",{className:f,children:fx.repeat(_)}),d.jsx("span",{className:"text-gray-700",children:_x.repeat(h)})]}),d.jsx("span",{className:Z("w-6 text-right font-bold",f),children:i})]})}function ST({severity:l,count:i,isActive:s,isFocused:u,onClick:o,className:f}){const _=ei[l];return d.jsx("button",{type:"button",onClick:o,className:Z("px-1.5 text-xs transition-colors",_.color,u&&"ring-1 ring-tui-blue",f),style:s?{backgroundColor:"currentColor"}:void 0,children:d.jsxs("span",{className:s?"text-black":void 0,children:["[",_.label," ",i,"]"]})})}function TT({counts:l,activeFilter:i,onFilterChange:s,isFocused:u,focusedIndex:o,className:f}){return d.jsx("div",{className:Z("flex gap-2 text-xs flex-wrap",f),children:Ql.map((_,h)=>d.jsx(ST,{severity:_,count:l[_],isActive:i===_,isFocused:u&&o===h,onClick:()=>s(i===_?"all":_)},_))})}function ET({change:l}){return l>0?d.jsxs("span",{className:"text-tui-red text-xs",children:["▲ ",l]}):l<0?d.jsxs("span",{className:"text-tui-green text-xs",children:["▼ ",Math.abs(l)]}):d.jsx("span",{className:"text-gray-500 text-xs",children:"─"})}function AT({lenses:l,className:i}){return d.jsxs("table",{className:Z("w-full text-sm text-left border-collapse",i),children:[d.jsx("thead",{children:d.jsxs("tr",{className:"text-gray-500 border-b border-gray-800 text-xs uppercase",children:[d.jsx("th",{className:"pb-2 font-normal pl-2",children:"Lens"}),d.jsx("th",{className:"pb-2 font-normal text-right",children:"Count"}),d.jsx("th",{className:"pb-2 font-normal text-right pr-2",children:"Change"})]})}),d.jsx("tbody",{className:"text-gray-300",children:l.map((s,u)=>d.jsxs("tr",{className:Z("hover:bg-tui-selection",u<l.length-1&&"border-b border-gray-800/50"),children:[d.jsxs("td",{className:"py-3 pl-2 flex items-center gap-2",children:[d.jsx("span",{className:Z("text-[16px]",s.iconColor),"aria-hidden":"true",children:s.icon}),s.name]}),d.jsx("td",{className:"py-3 text-right font-bold",children:s.count}),d.jsx("td",{className:"py-3 text-right pr-2",children:d.jsx(ET,{change:s.change})})]},s.id))})]})}function RT({stats:l,severityCounts:i,lensStats:s,topIssues:u,onEnterReview:o,onExport:f,onBack:_,onIssueClick:h,className:p}){const v=Math.max(i.blocker,i.high,i.medium,i.low,i.nit,1);return d.jsxs("div",{className:Z("flex flex-col gap-6",p),children:[d.jsxs("div",{className:"border-l-4 border-tui-green pl-6 py-2 bg-tui-selection/20",children:[d.jsxs("h1",{className:"text-2xl font-bold text-tui-green mb-2",children:["Analysis Complete #",l.runId]}),d.jsxs("p",{className:"text-sm text-gray-400",children:["Found ",d.jsxs("span",{className:"text-tui-fg font-bold",children:[l.totalIssues," issues"]})," across"," ",d.jsxs("span",{className:"text-tui-fg font-bold",children:[l.filesAnalyzed," files"]}),".",l.criticalCount>0&&d.jsxs(d.Fragment,{children:[" ","Security lens flagged"," ",d.jsxs("span",{className:"text-tui-red font-bold",children:[l.criticalCount," critical blockers"]}),"."]})]})]}),d.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[d.jsxs(Ta,{className:"bg-tui-selection/10",children:[d.jsx(Wt,{variant:"section",className:"mb-4",children:"Severity Breakdown"}),d.jsxs(wn,{spacing:"sm",className:"pt-0",children:[d.jsx(Xl,{label:"Blocker",count:i.blocker,max:v,severity:"blocker"}),d.jsx(Xl,{label:"High",count:i.high,max:v,severity:"high"}),d.jsx(Xl,{label:"Medium",count:i.medium,max:v,severity:"medium"}),d.jsx(Xl,{label:"Low",count:i.low,max:v,severity:"low"}),d.jsx(Xl,{label:"Nit",count:i.nit,max:v,severity:"nit"})]})]}),d.jsxs(Ta,{className:"bg-tui-selection/10",children:[d.jsx(Wt,{variant:"section",className:"mb-4",children:"Issues by Lens"}),d.jsx(wn,{spacing:"none",className:"pt-0",children:d.jsx(AT,{lenses:s})})]})]}),u.length>0&&d.jsxs("div",{children:[d.jsxs("h3",{className:"text-tui-violet font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider",children:[d.jsx("span",{"aria-hidden":"true",children:"!"})," Top Issues Preview"]}),d.jsx("div",{className:"border border-tui-border rounded-sm overflow-hidden",children:u.map(y=>d.jsx(cT,{title:y.title,file:y.file,line:y.line,category:y.category,severity:y.severity,onClick:()=>h?.(y.id)},y.id))})]}),d.jsxs("div",{className:"flex flex-col sm:flex-row justify-center items-center gap-4 mt-4 mb-4",children:[d.jsx(Jt,{variant:"success",size:"lg",onClick:o,className:"w-full sm:w-auto",children:"[ Enter Review Queue ]"}),d.jsx(Jt,{variant:"outline",size:"lg",onClick:f,className:"w-full sm:w-auto",children:"[ Export Summary ]"}),d.jsx(Jt,{variant:"ghost",size:"md",onClick:_,className:"text-gray-500",children:"[ Back ]"})]})]})}function NT({lines:l,className:i}){return d.jsx("pre",{className:Z("bg-black border border-tui-border p-2 font-mono text-xs text-gray-400 overflow-x-auto",i),children:l.map(s=>d.jsxs("div",{className:"flex",children:[d.jsx("span",{className:"w-6 text-gray-600 border-r border-gray-700 mr-2 text-right pr-1 select-none",children:s.number}),d.jsx("code",{className:Z(s.type==="highlight"&&"text-tui-red",s.type==="added"&&"text-tui-green",s.type==="removed"&&"text-tui-red"),children:s.content})]},s.number))})}function CT({patch:l,className:i}){return d.jsx("pre",{className:Z("bg-black border border-tui-border p-2 font-mono text-xs overflow-x-auto",i),children:l.split(`
`).map((s,u)=>d.jsx("div",{className:Z(s.startsWith("-")&&"text-tui-red",s.startsWith("+")&&"text-tui-green"),children:s},u))})}function wT({steps:l,completedSteps:i,onToggle:s,className:u}){return d.jsx("div",{className:Z("space-y-1 text-sm",u),children:l.map(o=>{const f=i.has(o.step);return d.jsxs("button",{type:"button",className:"flex gap-2 cursor-pointer w-full text-left",onClick:()=>s(o.step),"aria-pressed":f,children:[d.jsxs("span",{className:f?"text-tui-green":"text-tui-fg","aria-hidden":"true",children:["[",f?"x":" ","]"]}),d.jsx("span",{className:f?"text-gray-400 line-through":"",children:o.action})]},o.step)})})}const up=b.createContext(void 0);function Jo(){const l=b.useContext(up);if(!l)throw new Error("Tabs compound components must be used within Tabs");return l}function Wo({children:l,className:i}){const{value:s,onValueChange:u,getTriggers:o}=Jo(),f=_=>{if(_.key!=="ArrowLeft"&&_.key!=="ArrowRight")return;_.preventDefault();const h=o(),p=Array.from(h.entries()),v=p.findIndex(([E])=>E===s);let y;_.key==="ArrowLeft"?y=v<=0?p.length-1:v-1:y=v>=p.length-1?0:v+1;const T=p[y];T&&(u(T[0]),T[1]?.focus())};return d.jsx("div",{className:Z("flex gap-1 font-mono",i),role:"tablist",onKeyDown:f,children:l})}function Jn({value:l,children:i,className:s,disabled:u}){const{value:o,onValueChange:f,registerTrigger:_}=Jo(),h=b.useRef(null),p=o===l;b.useEffect(()=>(_(l,h.current),()=>_(l,null)),[l,_]);const v=b.useCallback(()=>{u||f(l)},[u,f,l]);return d.jsx("button",{ref:h,role:"tab","aria-selected":p,"aria-controls":`tabpanel-${l}`,tabIndex:p?0:-1,disabled:u,onClick:v,className:Z("px-3 py-1 text-sm font-mono transition-colors cursor-pointer","border border-[--tui-border]","focus:outline-none focus:ring-1 focus:ring-[--tui-primary]",p&&"bg-blue-600 text-white border-blue-600",!p&&!u&&"bg-[--tui-bg] text-[--tui-fg] hover:bg-[--tui-selection]",u&&"opacity-50 cursor-not-allowed",s),children:i})}function as({value:l,children:i,className:s}){const{value:u}=Jo();return u!==l?null:d.jsx("div",{role:"tabpanel",id:`tabpanel-${l}`,"aria-labelledby":`tab-${l}`,className:Z("mt-2",s),children:i})}function LT({value:l,onValueChange:i,defaultValue:s="",children:u,className:o}){const[f,_]=b.useState(s),h=b.useRef(new Map),p=l!==void 0?l:f,v=i||_,y=b.useCallback((U,I)=>{I?h.current.set(U,I):h.current.delete(U)},[]),T=b.useCallback(()=>h.current,[]),E=b.useMemo(()=>({value:p,onValueChange:v,registerTrigger:y,getTriggers:T}),[p,v,y,T]);return d.jsx(up.Provider,{value:E,children:d.jsx("div",{className:Z("flex flex-col",o),children:u})})}const cp=Object.assign(LT,{List:Wo,Trigger:Jn,Content:as}),jT=St("relative border font-mono p-4 flex gap-4 items-start",{variants:{variant:{info:"border-tui-blue/40 bg-tui-blue/5",warning:"border-tui-yellow/40 bg-tui-yellow/5",error:"border-tui-red/40 bg-tui-red/5",success:"border-tui-green/40 bg-tui-green/5"}},defaultVariants:{variant:"info"}}),OT=St("w-5 h-5 flex items-center justify-center text-xs font-bold rounded-sm shrink-0 mt-0.5 shadow-lg",{variants:{variant:{info:"bg-tui-blue text-black shadow-tui-blue/20",warning:"bg-tui-yellow text-black shadow-tui-yellow/20",error:"bg-tui-red text-black shadow-tui-red/20",success:"bg-tui-green text-black shadow-tui-green/20"}},defaultVariants:{variant:"info"}}),IT=St("text-sm",{variants:{variant:{info:"text-tui-blue",warning:"text-tui-yellow",error:"text-tui-red",success:"text-tui-green"}},defaultVariants:{variant:"info"}}),MT={info:"i",warning:"!",error:"✕",success:"✓"};function op({className:l,variant:i="info",title:s,children:u,...o}){return d.jsxs("div",{className:Z(jT({variant:i}),l),...o,children:[d.jsx("div",{className:OT({variant:i}),children:MT[i]}),d.jsxs("div",{className:IT({variant:i}),children:[s&&d.jsx("span",{className:"font-bold block mb-1",children:s}),d.jsx("span",{className:"opacity-90 leading-relaxed",children:u})]})]})}function Nr({label:l,value:i,className:s}){return d.jsxs("div",{className:Z("p-3 border border-tui-border bg-tui-selection/20",s),children:[d.jsx("div",{className:"text-[10px] text-gray-500 mb-1 italic",children:l}),d.jsx("div",{className:"text-xs text-tui-fg",children:i})]})}function dp({message:l,variant:i="centered",className:s}){return d.jsx("div",{className:Z("text-gray-500",i==="centered"&&"text-center py-8",i==="inline"&&"text-sm italic",s),children:l})}function ns({isFocused:l,children:i,className:s}){return d.jsx("div",{className:Z(l&&"ring-1 ring-tui-blue ring-inset",s),children:i})}const DT={blue:"text-tui-blue",violet:"text-tui-violet",green:"text-tui-green",yellow:"text-tui-yellow",red:"text-tui-red",muted:"text-gray-400"};function xo({label:l,color:i="muted",children:s,className:u,onClick:o,ariaLabel:f}){const _=h=>{o&&(h.key==="Enter"||h.key===" ")&&(h.preventDefault(),o())};return d.jsxs("div",{className:Z(u,o&&"cursor-pointer hover:opacity-80 transition-opacity"),onClick:o,role:o?"button":void 0,tabIndex:o?0:void 0,"aria-label":o?f??`${l} settings`:void 0,onKeyDown:o?_:void 0,children:[d.jsx("div",{className:Z("text-xs uppercase mb-1 font-bold",DT[i]),children:l}),d.jsx("div",{className:"text-tui-fg opacity-90",children:s})]})}const kT={default:"font-bold text-tui-fg",warning:"font-bold text-tui-yellow",info:"font-mono text-tui-blue"};function So({label:l,value:i,variant:s="default",className:u}){return d.jsxs("div",{className:Z("flex justify-between items-center",u),children:[d.jsx("span",{className:"text-sm text-gray-400",children:l}),d.jsx("span",{className:kT[s],children:i})]})}function Jl({children:l,className:i}){return d.jsx("h3",{className:Z("text-tui-blue font-bold mb-2 uppercase text-xs tracking-wider",i),children:l})}function Vh({label:l,value:i,className:s}){return d.jsxs("div",{className:Z("flex justify-between items-center text-xs py-2 border-b border-tui-border/30",s),children:[d.jsx("span",{className:"text-gray-500",children:l}),d.jsx("span",{children:i})]})}function zT({startTime:l,elapsedMs:i=0,running:s=!1,format:u="short",className:o}){const{elapsed:f}=xS({startTime:l,elapsedMs:i,running:s});return d.jsx("span",{className:Z("text-tui-blue font-mono",o),children:mx(f,u)})}function UT({context:l}){const i=ea();return d.jsxs(Ta,{className:"w-full max-w-md lg:w-80 h-fit shrink-0",children:[d.jsx(Wt,{children:"Context"}),d.jsxs(wn,{children:[l.trustedDir&&d.jsx(xo,{label:"Trusted",color:"blue",children:d.jsx("span",{className:"break-all font-mono opacity-90",children:l.trustedDir})}),l.providerName&&d.jsx(xo,{label:"Provider",color:"violet",onClick:()=>i({to:"/settings/providers"}),ariaLabel:"Configure provider settings",children:d.jsxs("span",{className:"opacity-90",children:[l.providerName,l.providerMode&&` (${l.providerMode})`]})}),l.lastRunId&&d.jsx(xo,{label:"Last Run",color:"green",children:d.jsxs("div",{className:"flex justify-between items-center",children:[d.jsxs("span",{className:"opacity-90",children:["#",l.lastRunId]}),l.lastRunIssueCount!==void 0&&d.jsxs("span",{className:"text-tui-yellow text-xs",children:["(",l.lastRunIssueCount," issues)"]})]})})]})]})}function HT(l){const i={review:[],navigation:[],system:[]};for(const s of l)s.group&&i[s.group].push(s);return i}function GT({selectedIndex:l,onSelect:i,onActivate:s}){const{review:u,navigation:o,system:f}=HT(bx);return d.jsxs(Ta,{className:"w-full max-w-md lg:w-1/2 lg:max-w-lg h-fit flex flex-col",children:[d.jsx(Wt,{variant:"subtle",children:"Main Menu"}),d.jsx("div",{className:"flex flex-col py-2",children:d.jsxs($o,{selectedIndex:l,onSelect:i,onActivate:_=>s(_.id),enableNumberJump:!0,children:[u.map(_=>d.jsx(Rn,{id:_.id,children:_.label},_.id)),d.jsx(Bh,{}),o.map(_=>d.jsx(Rn,{id:_.id,children:_.label},_.id)),d.jsx(Bh,{}),f.map(_=>d.jsx(Rn,{id:_.id,variant:_.variant,children:_.label},_.id))]})})]})}function BT({mode:l,steps:i,entries:s,metrics:u,isRunning:o,error:f,startTime:_,onViewResults:h,onCancel:p}){const v=ea(),[y,T]=b.useState("progress"),[E,U]=b.useState(null),I=b.useRef(!1);b.useEffect(()=>{if(I.current)return;const q=i.find(ie=>ie.id==="triage");q?.status==="active"&&q.substeps&&q.substeps.length>0&&(U("triage"),I.current=!0)},[i]);const D=f&&/api.?key/i.test(f),K=E?[E]:[],le=q=>{U(ie=>ie===q?null:q)};Ln("review-progress"),W("ArrowLeft",()=>T("progress"),{enabled:y==="log"}),W("ArrowRight",()=>T("log"),{enabled:y==="progress"}),W("Enter",()=>h?.(),{enabled:!!h}),W("Escape",()=>p?.(),{enabled:!!p});const ve=b.useMemo(()=>[{key:"←/→",label:"Pane"},{key:"↑/↓",label:"Navigate"},{key:"Enter",label:"View Results"}],[]),ae=b.useMemo(()=>[{key:"Esc",label:"Cancel"}],[]);return Ea({shortcuts:ve,rightShortcuts:ae}),d.jsxs("div",{className:"flex flex-1 overflow-hidden px-4",children:[d.jsxs("div",{className:Z("w-1/3 flex flex-col border-r border-tui-border pr-6",y==="progress"&&"ring-1 ring-tui-blue ring-inset"),children:[d.jsxs("div",{className:"mb-8 pt-2",children:[d.jsx(Wt,{variant:"section",children:"Progress Overview"}),d.jsx(xT,{steps:i,expandedIds:K,onToggle:le})]}),d.jsxs("div",{className:"mt-auto mb-6",children:[d.jsx(Wt,{variant:"section-bordered",children:"Metrics"}),d.jsxs("div",{className:"space-y-3 pt-2",children:[d.jsx(So,{label:"Files Processed",value:u.filesTotal>0?`${u.filesProcessed}/${u.filesTotal}`:`${u.filesProcessed}/...`}),d.jsx(So,{label:"Issues Found",value:u.issuesFound,variant:u.issuesFound>0?"warning":"default"}),d.jsx(So,{label:"Elapsed",value:d.jsx(zT,{startTime:_,running:o}),variant:"info"})]})]})]}),d.jsxs("div",{className:Z("w-2/3 flex flex-col pl-6 overflow-hidden",y==="log"&&"ring-1 ring-tui-blue ring-inset"),children:[d.jsxs("div",{className:"flex justify-between items-end mb-2 pt-2 border-b border-tui-border pb-2",children:[d.jsx(Wt,{variant:"section",className:"mb-0",children:"Live Activity Log"}),d.jsx("span",{className:"text-[10px] text-gray-600 font-mono",children:"tail -f agent.log"})]}),f?d.jsx("div",{className:"flex-1 flex items-center justify-center",children:d.jsxs("div",{className:"text-center p-6 max-w-md",children:[d.jsx("div",{className:"text-tui-red text-lg font-bold mb-2",children:D?"API Key Error":"Error"}),d.jsx("div",{className:"text-gray-400 font-mono text-sm mb-2",children:f}),D&&d.jsx("div",{className:"text-gray-500 text-sm mb-4",children:"Your API key may be invalid or expired."}),d.jsxs("div",{className:Z("flex gap-3 justify-center",!D&&"mt-4"),children:[d.jsx("button",{type:"button",onClick:p,className:"px-4 py-2 border border-tui-border text-sm font-mono hover:bg-tui-border/20",children:"[ Back to Home ]"}),D&&d.jsx("button",{type:"button",onClick:()=>v({to:"/settings/providers"}),className:"px-4 py-2 border border-tui-yellow text-tui-yellow text-sm font-mono hover:bg-tui-yellow/10",children:"[ Configure Provider ]"})]})]})}):d.jsx(qS,{entries:s,showCursor:o,autoScroll:!0,className:"flex-1"})]})]})}const VT=[{key:"Enter",label:"Setup Provider"}],ZT=[{key:"Esc",label:"Back"}];function KT({activeProvider:l,onNavigateSettings:i,onBack:s}){return Ln("api-key-missing"),W("Enter",i),W("Escape",s),Ea({shortcuts:VT,rightShortcuts:ZT}),d.jsx("div",{className:"flex flex-1 items-center justify-center",children:d.jsxs("div",{className:"text-center max-w-md p-6",children:[d.jsx("div",{className:"text-tui-yellow text-lg font-bold mb-4",children:"API Key Required"}),d.jsx("div",{className:"text-gray-400 font-mono text-sm mb-6",children:l?`No API key configured for ${l}. Please configure your provider settings to continue.`:"No API key configured. Please configure your provider settings to continue."}),d.jsxs("div",{className:"flex gap-4 justify-center",children:[d.jsx("button",{type:"button",onClick:i,className:"px-4 py-2 border border-tui-blue text-sm font-mono hover:bg-tui-blue/20",children:"[ Configure Provider ]"}),d.jsx("button",{type:"button",onClick:s,className:"px-4 py-2 border border-tui-border text-sm font-mono hover:bg-tui-border/20",children:"[ Back to Home ]"})]})]})})}async function YT(l){return Fx(lt,l)}async function qT(l){return Xx(lt,l)}function FT(){return{...Io(),selectedIssueId:null,reviewId:null}}function XT(l,i){return i.type==="SELECT_ISSUE"?{...l,selectedIssueId:i.issueId}:i.type==="SET_REVIEW_ID"?{...l,reviewId:i.reviewId}:i.type==="EVENT"&&i.event.type==="review_started"?{...fo(l,i),selectedIssueId:l.selectedIssueId,reviewId:i.event.reviewId}:i.type==="START"||i.type==="RESET"?{...fo(l,i),selectedIssueId:null,reviewId:null}:{...fo(l,i),selectedIssueId:l.selectedIssueId,reviewId:l.reviewId}}function QT(){const[l,i]=b.useReducer(XT,FT()),s=b.useRef(null),u=b.useRef([]),o=b.useRef(!1),f=b.useCallback(y=>{if(y.type==="review_started"){i({type:"EVENT",event:y});return}u.current.push({type:"EVENT",event:y}),o.current||(o.current=!0,requestAnimationFrame(()=>{o.current=!1;const T=u.current;u.current=[];for(const E of T)i(E)}))},[]),_=b.useCallback(()=>{s.current&&(s.current.abort(),s.current=null),i({type:"COMPLETE"})},[]),h=b.useCallback(async y=>{s.current&&s.current.abort();const T=new AbortController;s.current=T,u.current=[],i({type:"START"});try{const E=await YT({...y,signal:T.signal,onAgentEvent:U=>{f(U)},onStepEvent:U=>{f(U)}});E.ok?(i({type:"SET_REVIEW_ID",reviewId:E.value.reviewId}),i({type:"COMPLETE"})):i({type:"ERROR",error:E.error.message})}catch(E){E instanceof Error&&E.name==="AbortError"?i({type:"COMPLETE"}):i({type:"ERROR",error:E instanceof Error?E.message:"Failed to start stream"})}finally{s.current=null}},[f]),p=b.useCallback(y=>{i({type:"SELECT_ISSUE",issueId:y})},[]),v=b.useCallback(async y=>{console.log(`[SESSION_RESTORE] Client: Attempting resume for reviewId=${y}`),s.current&&s.current.abort();const T=new AbortController;s.current=T,u.current=[],i({type:"START"}),i({type:"SET_REVIEW_ID",reviewId:y});try{const E=await qT({reviewId:y,signal:T.signal,onAgentEvent:U=>{f(U)},onStepEvent:U=>{f(U)}});E.ok?(console.log("[SESSION_RESTORE] Client: Resume completed successfully"),i({type:"COMPLETE"})):(console.log(`[SESSION_RESTORE] Client: Resume failed - ${E.error.message}`),i({type:"ERROR",error:E.error.message}))}catch(E){E instanceof Error&&E.name==="AbortError"?i({type:"COMPLETE"}):i({type:"ERROR",error:E instanceof Error?E.message:"Failed to resume stream"})}finally{s.current=null}},[f]);return{state:l,start:h,stop:_,resume:v,selectIssue:p}}function $T(l){return l==="error"?"pending":l}function JT(l){switch(l){case"queued":return"pending";case"running":return"active";case"complete":return"completed"}}function WT(l){return l.map(i=>({id:i.id,emoji:i.meta.emoji,label:i.meta.name,status:JT(i.status)}))}function PT(l,i){return l.map(s=>{const u=s.id==="triage"&&i.length>0?WT(i):void 0;return{id:s.id,label:s.label,status:$T(s.status),substeps:u}})}function eE({mode:l,onComplete:i}){const s=ea(),u=Yh({strict:!1}),{isConfigured:o,isLoading:f,provider:_}=Yr(),{state:h,start:p,stop:v,resume:y}=QT(),T=b.useRef(!1),E=b.useRef(!1),U=b.useRef(null);b.useEffect(()=>{h.isStreaming&&(E.current=!0)},[h.isStreaming]),b.useEffect(()=>{h.reviewId&&!u.reviewId&&s({to:"/review/$reviewId",params:{reviewId:h.reviewId},replace:!0})},[h.reviewId,u.reviewId,s]),b.useEffect(()=>{if(T.current||f||!o)return;T.current=!0;const q={staged:l==="staged"};u.reviewId?y(u.reviewId).catch(()=>{i?.({issues:[],reviewId:u.reviewId??null,resumeFailed:!0})}):p(q)},[l,p,y,f,o,u.reviewId]),b.useEffect(()=>{if(!h.isStreaming&&E.current){U.current&&clearTimeout(U.current);const te=h.steps.find(ge=>ge.id==="report")?.status==="completed"?2300:400;U.current=setTimeout(()=>{i?.({issues:h.issues,reviewId:h.reviewId})},te)}return()=>{U.current&&clearTimeout(U.current)}},[h.isStreaming,h.steps,h.issues,h.reviewId,h.error,i]);const I=()=>{v(),s({to:"/"})},D=()=>{U.current&&clearTimeout(U.current),v(),i?.({issues:h.issues,reviewId:h.reviewId})},K=()=>{v(),s({to:"/settings/providers"})},le=b.useMemo(()=>PT(h.steps,h.agents),[h.steps,h.agents]),ve=b.useMemo(()=>Yx(h.events.filter(q=>q.type!=="enrich_progress")),[h.events]),ae=b.useMemo(()=>({filesProcessed:h.fileProgress.completed.size,filesTotal:h.fileProgress.total||h.fileProgress.completed.size,issuesFound:h.issues.length,elapsed:0}),[h.fileProgress.completed.size,h.fileProgress.total,h.issues.length]);return f?d.jsx("div",{className:"flex flex-1 items-center justify-center",children:d.jsx("div",{className:"text-gray-500 font-mono text-sm",role:"status","aria-live":"polite",children:"Loading..."})}):o?d.jsx(BT,{mode:l,steps:le,entries:ve,metrics:ae,isRunning:h.isStreaming,error:h.error,startTime:h.startedAt??void 0,onViewResults:D,onCancel:I}):d.jsx(KT,{activeProvider:_,onNavigateSettings:K,onBack:I})}function tE({issues:l,allIssues:i,selectedIndex:s,onSelectIndex:u,severityFilter:o,onSeverityFilterChange:f,isFocused:_,isFilterFocused:h,focusedFilterIndex:p,title:v="Analysis",className:y}){const T=lg(i);return d.jsxs(ns,{isFocused:_,className:Z("w-2/5 flex flex-col border-r border-tui-border pr-4",y),children:[d.jsxs("div",{className:"pb-4 pt-2",children:[d.jsx("div",{className:"text-tui-violet font-bold mb-2",children:v}),d.jsx(TT,{counts:T,activeFilter:o,onFilterChange:f,isFocused:h,focusedIndex:p})]}),d.jsxs("div",{className:"flex-1 overflow-y-auto scrollbar-hide space-y-1",children:[l.map((E,U)=>d.jsx(ip,{issue:E,isSelected:U===s,onClick:()=>u(U)},E.id)),l.length===0&&d.jsx("div",{className:"text-gray-500 text-sm p-2",children:"No issues match filter"})]})]})}function aE({issue:l,activeTab:i,onTabChange:s,completedSteps:u,onToggleStep:o,isFocused:f,className:_}){const h=!!l?.suggested_patch;return d.jsx(ns,{isFocused:f,className:Z("w-3/5 flex flex-col pl-4",_),children:d.jsxs(cp,{value:i,onValueChange:p=>s(p),className:"flex flex-col flex-1",children:[d.jsxs(Wo,{className:"border-b border-tui-border pb-2 pt-2 mb-4",children:[d.jsx(Jn,{value:"details",children:"Details"}),d.jsx(Jn,{value:"explain",children:"Explain"}),d.jsx(Jn,{value:"trace",children:"Trace"}),h&&d.jsx(Jn,{value:"patch",children:"Patch"})]}),d.jsx("div",{className:"flex-1 overflow-y-auto scrollbar-hide pr-2",children:l?d.jsxs(d.Fragment,{children:[d.jsx(uT,{title:l.title,severity:l.severity,file:l.file,line:l.line_start??0}),d.jsx(as,{value:"details",className:"mt-0",children:d.jsx(nE,{issue:l,completedSteps:u,onToggleStep:o})}),d.jsx(as,{value:"explain",className:"mt-0",children:d.jsxs("div",{className:"text-sm text-gray-300",children:[d.jsx("p",{className:"mb-4",children:l.rationale}),d.jsx("p",{children:l.recommendation})]})}),d.jsx(as,{value:"trace",className:"mt-0",children:d.jsx(lE,{issue:l})}),h&&d.jsx(as,{value:"patch",className:"mt-0",children:d.jsx(CT,{patch:l.suggested_patch})})]}):d.jsx(dp,{message:"Select an issue to view details"})})]})})}function nE({issue:l,completedSteps:i,onToggleStep:s}){const u=l.evidence.filter(o=>o.type==="code"&&o.excerpt).map((o,f)=>({number:o.range?.start??l.line_start??f+1,content:o.excerpt,type:"highlight"}));return d.jsxs(d.Fragment,{children:[d.jsxs("div",{className:"mb-6",children:[d.jsx(Jl,{children:"SYMPTOM"}),d.jsx("p",{className:"text-sm leading-relaxed text-gray-300",children:l.symptom}),u.length>0&&d.jsx("div",{className:"mt-2",children:d.jsx(NT,{lines:u})})]}),d.jsxs("div",{className:"mb-6",children:[d.jsx(Jl,{children:"WHY IT MATTERS"}),d.jsx("p",{className:"text-sm leading-relaxed text-gray-300",children:l.whyItMatters}),l.category==="security"&&d.jsxs("div",{className:"mt-2 flex gap-2",children:[d.jsx(Hh,{type:"CWE",code:"89"}),d.jsx(Hh,{type:"OWASP",code:"A03"})]})]}),l.fixPlan&&l.fixPlan.length>0&&d.jsxs("div",{className:"mb-6",children:[d.jsx(Jl,{children:"FIX PLAN"}),d.jsx(wT,{steps:l.fixPlan,completedSteps:i,onToggle:s})]})]})}function lE({issue:l}){return!l.trace||l.trace.length===0?d.jsx(dp,{message:"No trace data available for this issue.",variant:"inline"}):d.jsx("div",{className:"space-y-2",children:l.trace.map(i=>d.jsxs("div",{className:"border-l-2 border-tui-border pl-2",children:[d.jsxs("div",{className:"text-tui-fg text-sm",children:["Step ",i.step,": ",i.tool]}),d.jsx("div",{className:"text-gray-500 text-xs",children:i.outputSummary})]},i.step))})}async function iE(){return lt.get("/reviews")}async function sE(l){return Qx(lt,l)}async function rE(l){return Tg(lt,l)}function uE(){const[l,i]=b.useState([]),[s,u]=b.useState(null),[o,f]=b.useState(!1),[_,h]=b.useState(null),p=b.useCallback(async()=>{f(!0),h(null);try{const T=await iE();i(T)}catch(T){h(T instanceof Error?T.message:"Failed to fetch review history")}finally{f(!1)}},[]),v=b.useCallback(async T=>{f(!0),h(null);try{const{review:E}=await sE(T);u(E)}catch(E){h(E instanceof Error?E.message:"Failed to load review")}finally{f(!1)}},[]),y=b.useCallback(async T=>{try{await rE(T),i(E=>E.filter(U=>U.id!==T)),s?.metadata?.id===T&&u(null)}catch(E){h(E instanceof Error?E.message:"Failed to delete review"),p()}},[s,p]);return b.useEffect(()=>{p()},[p]),{reviews:l,currentReview:s,isLoading:o,error:_,refresh:p,loadReview:v,removeReview:y,clearCurrentReview:()=>u(null)}}const cE={"review-unstaged":"/review","review-staged":"/review?staged=true","review-files":"/review?files=true","resume-review":"/review",history:"/history",settings:"/settings"};function oE(){const{provider:l,model:i}=Yr(),{reviews:s}=uE(),{showToast:u}=ss(),o=ea(),f=qh({strict:!1});b.useEffect(()=>{f.error==="invalid-review-id"&&(u({variant:"error",title:"Invalid Review ID",message:"The review ID format is invalid."}),o({to:"/",replace:!0}))},[f.error,u,o]);const _=b.useMemo(()=>{const T=s[0];return{providerName:l,providerMode:i,lastRunId:T?.id,lastRunIssueCount:T?.issueCount}},[l,i,s]),[h,p]=il("menuIndex",0);Ea({shortcuts:Sx});const v=T=>{if(T==="quit"){y();return}const E=cE[T];E&&o({to:E})},y=async()=>{try{await lt.post("/shutdown",{})}catch{}window.close()};return Ln("home"),W("q",y),W("s",()=>o({to:"/settings"})),W("h",()=>v("help")),d.jsxs("div",{className:"flex flex-1 flex-col lg:flex-row items-center lg:items-start justify-start lg:justify-center p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8 overflow-auto",children:[d.jsx(UT,{context:_}),d.jsx(GT,{selectedIndex:h,onSelect:p,onActivate:v})]})}function dE(){const{showToast:l}=ss(),i=ea(),s=(_,h)=>{l({variant:"error",title:_,message:h}),i({to:"/"})},u=()=>{s("Invalid Review ID","The review ID format is invalid.")},o=()=>{s("Review Not Found","The review session was not found or has expired.")};return{handleApiError:_=>{const h=_;h.status===400?u():h.status===404?o():s("Error Loading Review",h.message||"An error occurred while loading the review.")}}}function fE({issues:l,reviewId:i,onEnterReview:s,onBack:u}){const o=lg(l),f=l.reduce((T,E)=>(T[E.category]=(T[E.category]||0)+1,T),{}),_=Object.entries(f).map(([T,E])=>({id:T,name:T.charAt(0).toUpperCase()+T.slice(1),icon:T==="security"?"shield":T==="performance"?"zap":"code",iconColor:T==="security"?"text-tui-red":T==="performance"?"text-tui-yellow":"text-tui-blue",count:E,change:0})),h=l.slice(0,3).map(T=>({id:T.id,title:T.title,file:T.file,line:T.line_start??0,category:T.category,severity:T.severity})),p=new Set(l.map(T=>T.file)).size;Ln("review-summary"),W("Enter",s),W("Escape",u);const v=b.useMemo(()=>[{key:"Enter",label:"Start Review"}],[]),y=b.useMemo(()=>[{key:"Esc",label:"Back"}],[]);return Ea({shortcuts:v,rightShortcuts:y}),d.jsx("div",{className:"flex-1 overflow-y-auto px-4 py-4",children:d.jsx("div",{className:"w-full max-w-4xl mx-auto",children:d.jsx(RT,{stats:{runId:i??"unknown",totalIssues:l.length,filesAnalyzed:p,criticalCount:o.blocker},severityCounts:o,lensStats:_,topIssues:h,onEnterReview:s,onBack:u})})})}function _E({issues:l,reviewId:i}){const s=ea(),[u,o]=il("issueIndex",0),[f,_]=b.useState("details"),[h,p]=b.useState("all"),[v,y]=b.useState("list"),[T,E]=b.useState(0),[U,I]=b.useState(new Set([1])),D=Zx(l,h),{focusedIndex:K,setFocusedIndex:le}=GS({itemCount:D.length,wrap:!1,enabled:v==="list",initialIndex:u});b.useEffect(()=>{K!==u&&o(K)},[K,u,o]);const ve=D[K]??null;Ln("review"),W("Escape",()=>s({to:"/"}),{enabled:v==="list"}),W("Tab",()=>{y(v==="filters"?"list":v==="list"?"details":"filters")}),W("ArrowLeft",()=>{v==="details"?y("list"):v==="filters"&&T>0&&E(te=>te-1)}),W("ArrowRight",()=>{v==="list"?y("details"):v==="filters"&&T<Ql.length-1?E(te=>te+1):v==="filters"&&T===Ql.length-1&&y("details")}),W("ArrowUp",()=>{v==="list"&&K===0&&y("filters")},{enabled:v==="list"}),W("ArrowDown",()=>y("list"),{enabled:v==="filters"}),W("j",()=>y("list"),{enabled:v==="filters"}),W("Enter",()=>{const te=Ql[T];p(ge=>ge===te?"all":te)},{enabled:v==="filters"}),W(" ",()=>{const te=Ql[T];p(ge=>ge===te?"all":te)},{enabled:v==="filters"}),W("1",()=>_("details"),{enabled:v==="details"}),W("2",()=>_("explain"),{enabled:v==="details"}),W("3",()=>_("trace"),{enabled:v==="details"}),W("4",()=>_("patch"),{enabled:v==="details"&&!!ve?.suggested_patch});const ae=te=>{I(ge=>{const ne=new Set(ge);return ne.has(te)?ne.delete(te):ne.add(te),ne})},q=b.useMemo(()=>[{key:"j/k",label:"Select"},{key:"←/→",label:"Navigate"},{key:"1-4",label:"Tab"}],[]),ie=b.useMemo(()=>[{key:"Space",label:"Toggle"},{key:"Esc",label:"Back"}],[]);return Ea({shortcuts:q,rightShortcuts:ie}),d.jsxs("div",{className:"flex flex-1 overflow-hidden px-4 font-mono",children:[d.jsx(tE,{issues:D,allIssues:l,selectedIndex:K,onSelectIndex:le,severityFilter:h,onSeverityFilterChange:p,isFocused:v==="list",isFilterFocused:v==="filters",focusedFilterIndex:T,title:`Analysis #${i??"unknown"}`}),d.jsx(aE,{issue:ve,activeTab:f,onTabChange:_,completedSteps:U,onToggleStep:ae,isFocused:v==="details"})]})}function fp(){const l=ea(),i=Yh({strict:!1}),s=qh({strict:!1}),u=s.files?"files":s.staged?"staged":"unstaged",[o,f]=il("view","progress"),[_,h]=b.useState({issues:[],reviewId:null}),[p,v]=b.useState(!1),[y,T]=b.useState(!!i.reviewId),[E,U]=b.useState(!1),{handleApiError:I}=dE(),D=b.useCallback(async le=>{v(!0);try{const{review:ve}=await Ah(lt,le);h({issues:ve.result.issues,reviewId:ve.metadata.id}),f("results")}catch(ve){I(ve)}finally{v(!1)}},[I,f]),K=b.useCallback(le=>{if(le.resumeFailed&&le.reviewId){D(le.reviewId);return}h(le),f("summary")},[D,f]);return b.useEffect(()=>{if(!i.reviewId||E)return;const le=new AbortController;return(async()=>{T(!0);try{const ae=await $x(lt,i.reviewId);if(le.signal.aborted)return;if(ae.sessionActive){U(!0),T(!1);return}if(ae.reviewSaved){const{review:q}=await Ah(lt,i.reviewId);if(le.signal.aborted)return;h({issues:q.result.issues,reviewId:q.metadata.id}),f("results"),U(!0),T(!1);return}I({status:404,message:"Review not found"})}catch(ae){if(le.signal.aborted)return;I(ae)}finally{le.signal.aborted||T(!1)}})(),()=>le.abort()},[i.reviewId,E,I,f]),o==="progress"?p||y?d.jsx("div",{className:"flex flex-1 items-center justify-center",children:d.jsx("div",{className:"text-gray-500 font-mono text-sm",role:"status","aria-live":"polite",children:y?"Checking review...":"Loading review..."})}):d.jsx(eE,{mode:u,onComplete:K}):o==="summary"?d.jsx(fE,{issues:_.issues,reviewId:_.reviewId,onEnterReview:()=>f("results"),onBack:()=>l({to:"/"})}):d.jsx(_E,{issues:_.issues,reviewId:_.reviewId})}function mE({id:l,displayId:i,branch:s,provider:u,timestamp:o,summary:f,issues:_,isSelected:h,isExpanded:p,onSelect:v,onToggleExpand:y,onIssueClick:T,className:E}){const U=()=>{v()},I=D=>{(D.key==="Enter"||D.key===" ")&&(D.preventDefault(),y())};return d.jsxs("div",{id:l,role:"option","data-value":l,"aria-selected":h,"aria-expanded":p,className:Z("border-b border-tui-border relative group",h&&"bg-tui-selection",!h&&"hover:bg-white/5",E),children:[h&&d.jsx("div",{className:"absolute left-0 top-0 bottom-0 w-1 bg-tui-violet"}),d.jsxs("div",{onClick:U,onKeyDown:I,tabIndex:0,className:"p-3 pl-4 cursor-pointer overflow-hidden",children:[d.jsxs("div",{className:"flex justify-between items-start mb-1 min-w-0",children:[d.jsxs("div",{className:"flex items-baseline gap-3 min-w-0 overflow-hidden",children:[d.jsx("span",{className:Z("font-bold text-sm shrink-0",h?"text-tui-blue":"text-gray-400"),children:i}),d.jsx(pa,{variant:"neutral",size:"sm",className:"shrink-0",children:s}),d.jsx("span",{className:"text-xs text-gray-500 truncate",children:u})]}),d.jsx("span",{className:"text-xs text-gray-500 shrink-0 ml-2",children:o})]}),d.jsx("div",{className:Z("text-sm mb-2 line-clamp-2 overflow-hidden",h?"text-tui-fg":"text-gray-400"),children:f}),d.jsxs("div",{className:Z("flex gap-4 text-xs font-mono text-gray-500",!h&&"opacity-0 group-hover:opacity-100 transition-opacity"),children:[d.jsxs("span",{className:"hover:text-tui-violet cursor-pointer",children:[d.jsx("span",{className:"text-tui-violet",children:"[r]"})," Resume"]}),d.jsxs("span",{className:"hover:text-tui-blue cursor-pointer",children:[d.jsx("span",{className:"text-tui-blue",children:"[e]"})," Export"]})]})]}),p&&_.length>0&&d.jsx("div",{className:"border-t border-tui-border bg-black/30 pb-2 overflow-hidden",children:_.map(D=>d.jsx(ip,{issue:D,isSelected:!1,onClick:()=>T?.(D.id)},D.id))})]})}function hE({items:l,selectedId:i,onSelect:s,keyboardEnabled:u=!0,onBoundaryReached:o,className:f}){const _=b.useRef(null);return qr({containerRef:_,role:"option",value:i,onValueChange:s,enabled:u,wrap:!1,onBoundaryReached:o}),d.jsx("div",{ref:_,role:"listbox",className:Z("space-y-1",f),children:l.map(h=>{const p=h.id===i;return d.jsxs("div",{id:h.id,role:"option","data-value":h.id,"aria-selected":p,onClick:()=>s(h.id),className:Z("flex items-center justify-between text-sm px-2 py-1 rounded cursor-pointer",p&&"bg-tui-selection text-tui-blue font-bold",!p&&"text-gray-400 hover:text-tui-fg hover:bg-white/5"),children:[d.jsxs("span",{className:"flex items-center gap-2",children:[d.jsx("span",{className:Z("text-[10px]",p?"text-tui-blue":"text-gray-600"),children:p?"●":"○"}),h.label]}),d.jsx("span",{className:Z("text-xs",p?"opacity-70":"opacity-50"),children:h.count})]},h.id)})})}function gE({runId:l,severityCounts:i,topLenses:s,topIssues:u,duration:o,onIssueClick:f,className:_}){const h=Math.max(...Object.values(i),1);return l?d.jsxs("div",{className:Z("flex flex-col h-full",_),children:[d.jsxs("div",{className:"p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border",children:["Insights: Run ",l]}),d.jsxs("div",{className:"flex-1 overflow-y-auto p-4 space-y-6",children:[d.jsxs("div",{children:[d.jsx(Jl,{className:"border-b border-gray-800 pb-1",children:"Severity Histogram"}),d.jsx("div",{className:"space-y-2 mt-3",children:Pb.map(p=>d.jsx(Xl,{label:ch(p),count:i[p]??0,max:h,severity:p},p))})]}),s.length>0&&d.jsxs("div",{children:[d.jsx(Jl,{className:"border-b border-gray-800 pb-1",children:"Top Lenses"}),d.jsx("div",{className:"flex flex-wrap gap-2 mt-3",children:s.map(p=>d.jsx(pa,{variant:"neutral",size:"sm",children:p},p))})]}),u.length>0&&d.jsxs("div",{children:[d.jsxs(Jl,{className:"border-b border-gray-800 pb-1",children:["Top ",u.length," Issues"]}),d.jsx("div",{className:"space-y-3 mt-3",children:u.map(p=>d.jsxs("div",{className:"text-xs",children:[d.jsxs("div",{className:"flex justify-between mb-1",children:[d.jsxs("span",{className:Z("font-bold",p.severity==="blocker"&&"text-tui-red",p.severity==="high"&&"text-tui-yellow",p.severity==="medium"&&"text-gray-400",p.severity==="low"&&"text-tui-blue"),children:["[",ch(p.severity),"]"]}),d.jsxs("span",{className:"text-gray-600 font-mono",children:["L:",p.line_start]})]}),d.jsx("p",{className:"text-gray-400 truncate cursor-pointer hover:text-tui-fg",onClick:()=>f?.(p.id),children:p.title})]},p.id))})]})]}),o&&d.jsxs("div",{className:"border-t border-tui-border p-3 bg-white/5",children:[d.jsx("div",{className:"text-[10px] text-gray-500 uppercase tracking-wider mb-1",children:"Duration"}),d.jsx("div",{className:"text-sm font-mono text-tui-fg",children:o})]})]}):d.jsx("div",{className:Z("flex items-center justify-center text-gray-500 text-sm",_),children:"Select a run to view insights"})}async function pE(l){return(await lt.get("/triage/reviews",void 0)).reviews}async function vE(l){return Tg(lt,l)}function yE(l){const[i,s]=b.useState([]),[u,o]=b.useState(!0),[f,_]=b.useState(null),h=b.useCallback(async()=>{o(!0),_(null);try{const v=await pE(l);s(v)}catch(v){_(v instanceof Error?v.message:"Failed to fetch reviews")}finally{o(!1)}},[l]),p=b.useCallback(async v=>{try{await vE(v),s(y=>y.filter(T=>T.id!==v))}catch(y){_(y instanceof Error?y.message:"Failed to delete review"),h()}},[h]);return b.useEffect(()=>{h()},[h]),{reviews:i,isLoading:u,error:f,refresh:h,deleteReview:p}}const bE=[{key:"Tab",label:"Switch Focus"},{key:"Enter",label:"Expand"},{key:"o",label:"Open"}],xE=[{key:"r",label:"Resume"},{key:"e",label:"Export"},{key:"Esc",label:"Back"}];function Po(l){return l.slice(0,10)}function SE(l){const i=new Date(l),s=new Date,u=s.toISOString().slice(0,10),o=new Date(s.setDate(s.getDate()-1)).toISOString().slice(0,10),f=Po(l);return f===u?"Today":f===o?"Yesterday":i.toLocaleDateString("en-US",{month:"short",day:"numeric"})}function TE(l){return new Date(l).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})}function EE(l){const{blockerCount:i,highCount:s,issueCount:u}=l;return i>0?d.jsxs(d.Fragment,{children:["Found ",d.jsxs("span",{className:"text-tui-red font-bold",children:[i," blocker"]}),i!==1?"s":"","."]}):s>0?d.jsxs(d.Fragment,{children:["Found ",d.jsxs("span",{className:"text-tui-yellow font-bold",children:[s," high"]})," issue",s!==1?"s":"","."]}):u>0?`Found ${u} issue${u!==1?"s":""}.`:"Passed with no issues."}function AE(l){const i=new Map;for(const s of l){const u=Po(s.createdAt),o=i.get(u);o?o.count++:i.set(u,{label:SE(s.createdAt),count:1})}return Array.from(i.entries()).sort(([s],[u])=>u.localeCompare(s)).map(([s,{label:u,count:o}])=>({id:s,label:u,count:o}))}function RE(){const l=ea(),{reviews:i,isLoading:s,error:u}=yE(),[o,f]=b.useState("runs"),[_,h]=b.useState("runs"),[p,v]=b.useState(null),y=b.useMemo(()=>AE(i),[i]),T=y[0]?.id??"",[E,U]=il("date",T),[I,D]=il("run",i[0]?.id??null),K=b.useMemo(()=>i.filter(q=>Po(q.createdAt)===E),[i,E]),le=i.find(q=>q.id===I)??null,ve={blocker:le?.blockerCount??0,high:le?.highCount??0,medium:le?.mediumCount??0,low:le?.lowCount??0,nit:le?.nitCount??0};Ln("history"),W("Tab",()=>{h(q=>q==="timeline"?"runs":q==="runs"?"insights":"timeline")}),W("ArrowLeft",()=>{_==="runs"?h("timeline"):_==="insights"&&h("runs")}),W("ArrowRight",()=>{_==="timeline"?h("runs"):_==="runs"&&h("insights")}),W("Enter",()=>{_==="runs"&&I&&v(q=>q===I?null:I)},{enabled:_==="runs"}),W("o",()=>{I&&l({to:"/review/$reviewId",params:{reviewId:I}})},{enabled:_==="runs"}),W("Escape",()=>{p?v(null):l({to:"/"})}),Ea({shortcuts:bE,rightShortcuts:xE});const ae=q=>{q==="down"&&h("runs")};return s?d.jsx("div",{className:"flex flex-col flex-1 items-center justify-center text-gray-500",children:d.jsx("span",{children:"Loading reviews..."})}):u?d.jsx("div",{className:"flex flex-col flex-1 items-center justify-center text-tui-red",children:d.jsxs("span",{children:["Error: ",u]})}):d.jsxs("div",{className:"flex flex-col flex-1 overflow-hidden px-4 pb-0",children:[d.jsx("div",{className:"flex items-center gap-6 border-b border-tui-border mb-0 text-sm select-none shrink-0",children:d.jsx(cp,{value:o,onValueChange:q=>f(q),children:d.jsxs(Wo,{className:"border-b-0",children:[d.jsx(Jn,{value:"runs",children:"[Runs]"}),d.jsx(Jn,{value:"sessions",children:"Sessions"})]})})}),d.jsxs("div",{className:"flex flex-1 overflow-hidden border-x border-b border-tui-border",children:[d.jsxs(ns,{isFocused:_==="timeline",className:"w-48 border-r border-tui-border flex flex-col shrink-0",children:[d.jsx("div",{className:"p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border",children:"Timeline"}),d.jsx("div",{className:"flex-1 overflow-y-auto p-2",children:y.length>0?d.jsx(hE,{items:y,selectedId:E,onSelect:U,keyboardEnabled:_==="timeline",onBoundaryReached:ae}):d.jsx("div",{className:"text-gray-500 text-sm p-2",children:"No reviews yet"})})]}),d.jsxs(ns,{isFocused:_==="runs",className:"flex-1 min-w-0 border-r border-tui-border flex flex-col overflow-hidden",children:[d.jsxs("div",{className:"p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border flex justify-between overflow-hidden",children:[d.jsx("span",{className:"truncate",children:"Runs"}),d.jsx("span",{className:"shrink-0 ml-2",children:"Sort: Recent"})]}),d.jsx("div",{className:"flex-1 overflow-y-auto",children:o==="runs"?K.length>0?K.map(q=>d.jsx(mE,{id:q.id,displayId:`#${q.id.slice(0,4)}`,branch:q.staged?"Staged":q.branch??"Main",provider:"AI",timestamp:TE(q.createdAt),summary:EE(q),issues:[],isSelected:q.id===I,isExpanded:q.id===p,onSelect:()=>D(q.id),onToggleExpand:()=>v(ie=>ie===q.id?null:q.id),onIssueClick:()=>l({to:"/review/$reviewId",params:{reviewId:q.id}})},q.id)):d.jsx("div",{className:"flex items-center justify-center h-full text-gray-500",children:"No runs for this date"}):d.jsx("div",{className:"flex items-center justify-center h-full text-gray-500",children:"No sessions available"})})]}),d.jsx(ns,{isFocused:_==="insights",className:"w-80 flex flex-col shrink-0 overflow-hidden",children:d.jsx(gE,{runId:le?`#${le.id.slice(0,4)}`:null,severityCounts:ve,topLenses:[],topIssues:[],duration:"--",onIssueClick:()=>{I&&l({to:"/review/$reviewId",params:{reviewId:I}})}})})]}),d.jsxs("div",{className:"flex items-center gap-2 p-3 bg-tui-bg border-x border-b border-tui-border text-sm font-mono shrink-0",children:[d.jsx("span",{className:"text-tui-blue font-bold",children:">"}),d.jsx("span",{className:"text-gray-500",children:"Search runs by ID, provider or tag..."}),d.jsx("span",{className:"w-2 h-4 bg-tui-blue opacity-50 animate-pulse"})]})]})}const NE={trust:{value:"Trusted",valueVariant:"success-badge"},theme:{value:"DARK"},provider:{value:"Gemini",valueVariant:"success"},diagnostics:{value:"v2.1.0",valueVariant:"muted"}},CE=[{key:"",label:"HUB-MODE"}];function wE(){const l=ea(),[i,s]=il("menuIndex",0);Ea({shortcuts:Tx,rightShortcuts:CE}),Ln("settings-hub"),W("Escape",()=>l({to:"/"}));const u=o=>{switch(o.id){case"trust":l({to:"/settings/trust"});break;case"theme":l({to:"/settings/theme"});break;case"provider":l({to:"/settings/providers"});break;case"diagnostics":l({to:"/settings/about"});break}};return d.jsx("div",{className:"flex-1 flex flex-col items-center justify-center px-4 pb-12",children:d.jsxs("div",{className:"w-full max-w-3xl",children:[d.jsxs(Ta,{className:"bg-tui-bg shadow-2xl",children:[d.jsx(Wt,{variant:"floating",children:"SETTINGS HUB"}),d.jsx($o,{selectedIndex:i,onSelect:s,onActivate:u,keyboardEnabled:!0,variant:"hub",className:"flex flex-col text-sm pt-2",children:xx.map(o=>{const{value:f,valueVariant:_}=NE[o.id];return d.jsx(Rn,{id:o.id,value:f,valueVariant:_,children:o.label},o.id)})})]}),d.jsxs("div",{className:"mt-6 flex gap-4 text-xs text-gray-600 font-mono select-none",children:[d.jsx("span",{children:"config path: ~/.config/stargazer/settings.json"}),d.jsx("span",{className:"text-gray-700",children:"|"}),d.jsx("span",{children:"last sync: 2m ago"})]})]})})}const LE=[{id:"readFiles",label:"Read repository files",description:"Access source code and configuration files"},{id:"readGit",label:"Read git metadata",description:"Access commit history, branches, and tags"},{id:"runCommands",label:"Run commands (tests/lint)",description:"Execute shell scripts and commands"}];function jE({directory:l,value:i,onChange:s,showActions:u=!1,onSave:o,onRevoke:f,isTrusted:_=!1}){const[h,p]=b.useState("list"),[v,y]=b.useState(0);BS({focusZone:h,buttonIndex:v,buttonsCount:2,onButtonIndexChange:y,onFocusZoneChange:p,onSave:o,onRevoke:f});const E=b.useMemo(()=>Object.entries(i).filter(([D,K])=>K).map(([D])=>D),[i]),U=b.useCallback(D=>{D==="down"&&u&&p("buttons")},[u]),I=D=>{s({readFiles:D.includes("readFiles"),readGit:D.includes("readGit"),runCommands:D.includes("runCommands")})};return d.jsxs("div",{className:"flex flex-col gap-6",children:[d.jsxs("div",{className:"border-b border-tui-border pb-3",children:[d.jsx("div",{className:"text-gray-500 text-xs mb-2 uppercase tracking-wide",children:"Target Directory"}),d.jsxs("div",{className:"flex items-center justify-between",children:[d.jsx("span",{className:"text-lg text-tui-blue font-bold truncate pr-4",children:l}),_&&d.jsx(pa,{variant:"success",children:"TRUSTED"})]})]}),d.jsx(tT,{value:E,onValueChange:I,wrap:!1,onBoundaryReached:U,disabled:h!=="list",children:LE.map(({id:D,label:K,description:le})=>d.jsx(aT,{value:D,label:d.jsx("span",{className:D==="runCommands"&&i.runCommands?"text-tui-yellow":void 0,children:K}),description:le},D))}),d.jsx(op,{variant:"warning",title:"SECURITY WARNING",children:"Enabling 'Run commands' allows the AI to execute shell scripts. This grants significant access to your system."}),u&&d.jsxs("div",{className:"flex gap-4 pt-2",children:[d.jsx(Jt,{variant:"success",onClick:o,className:Z(h==="buttons"&&v===0&&"ring-2 ring-tui-blue"),children:"[ Save Changes ]"}),d.jsx(Jt,{variant:"destructive",onClick:f,className:Z(h==="buttons"&&v===1&&"ring-2 ring-tui-blue"),children:"[ Revoke Trust ]"})]})]})}const OE=[{key:"Space",label:"Toggle"},{key:"Enter",label:"Save"},{key:"Esc",label:"Back"}];function IE(){const l=ea(),{showToast:i}=ss(),[s,u]=b.useState({readFiles:!0,readGit:!0,runCommands:!1});Ea({shortcuts:OE}),W("Escape",()=>l({to:"/settings"}));const o=s.readFiles||s.readGit,f=()=>{console.log("Saving trust settings:",s),i({variant:"success",title:"Saved",message:"Trust permissions updated"}),l({to:"/settings"})},_=()=>{u({readFiles:!1,readGit:!1,runCommands:!1})};return d.jsx("div",{className:"flex-1 flex items-center justify-center p-4",children:d.jsxs(Ta,{className:"w-full max-w-2xl",children:[d.jsx(Wt,{children:"TRUST & PERMISSIONS"}),d.jsx(wn,{children:d.jsx(jE,{directory:"~/dev/projects/stargazer",value:s,onChange:u,isTrusted:o,showActions:!0,onSave:f,onRevoke:_})})]})})}const Zh=[{value:"auto",label:"Auto",description:"Follow system preference"},{value:"dark",label:"Dark",description:"Dark background with light text"},{value:"light",label:"Light",description:"Light background with dark text"},{value:"terminal",label:"Terminal Default",description:"Use terminal default colors"}];function ME({value:l,onChange:i,onFocus:s,showTerminalOption:u=!1}){const o=u?Zh:Zh.filter(f=>f.value!=="terminal");return d.jsxs("div",{className:"space-y-3",children:[d.jsx("div",{className:"text-sm font-mono text-[--tui-fg]/60",children:"Select Interface Theme:"}),d.jsx(rT,{value:l,onValueChange:f=>i(f),onFocus:s?f=>s(f):void 0,children:o.map(f=>d.jsx(sT,{value:f.value,label:f.label,description:f.description},f.value))})]})}function DE({previewTheme:l}){return d.jsx("div",{"data-theme":l,className:"w-full h-full flex items-center justify-center bg-tui-bg p-6",style:{colorScheme:l},children:d.jsx("div",{className:"w-full max-w-sm font-mono text-xs isolate",children:d.jsxs(Ta,{className:"bg-tui-bg border-tui-border",children:[d.jsx(Wt,{variant:"default",value:"RO",children:"PREVIEW.tsx"}),d.jsxs(wn,{spacing:"none",children:[d.jsxs($o,{selectedIndex:1,onSelect:()=>{},keyboardEnabled:!1,children:[d.jsx(Rn,{id:"normal",children:"Normal Item"}),d.jsx(Rn,{id:"selected",children:"Selected Item"}),d.jsx(Rn,{id:"disabled",disabled:!0,children:"Disabled Item"})]}),d.jsx("div",{className:"border-t border-tui-border my-2"}),d.jsxs("div",{className:"px-4 py-2 space-y-1",children:[d.jsx("div",{className:"text-tui-fg",children:"Primary text color"}),d.jsx("div",{className:"text-tui-muted",children:"Muted text color"}),d.jsx("div",{className:"text-tui-blue",children:"Accent blue color"}),d.jsx("div",{className:"text-tui-violet",children:"Accent violet color"})]}),d.jsx("div",{className:"border-t border-tui-border my-2"}),d.jsxs("div",{className:"px-4 py-2 flex flex-wrap gap-2",children:[d.jsx(pa,{variant:"error",children:"Error"}),d.jsx(pa,{variant:"warning",children:"Warning"}),d.jsx(pa,{variant:"success",children:"Success"}),d.jsx(pa,{variant:"info",children:"Info"})]})]}),d.jsx("div",{className:"px-3 py-1 text-center text-[10px] text-tui-muted border-t border-tui-border",children:"Stargazer v2.0"})]})})})}const kE=[{key:"↑/↓",label:"Select"},{key:"Space",label:"Apply"},{key:"Enter",label:"Apply & Exit"},{key:"Esc",label:"Back"}];function zE(){const l=ea(),{theme:i,resolved:s,setTheme:u}=v0(),[o,f]=b.useState(i);b.useEffect(()=>{f(i)},[i]);const _=o==="auto"?s:o;return Ea({shortcuts:kE}),W("Escape",()=>l({to:"/settings"})),W("Enter",()=>{u(o),l({to:"/settings"})}),d.jsx("div",{className:"flex-1 flex flex-col p-6 min-h-0",children:d.jsxs("div",{className:"grid grid-cols-[2fr_3fr] gap-6 w-full h-full min-h-0",children:[d.jsxs(Ta,{className:"relative pt-4 flex flex-col h-full",children:[d.jsx(Wt,{variant:"floating",className:"text-tui-violet",children:"Theme Settings"}),d.jsxs(wn,{className:"flex-1 flex flex-col",children:[d.jsx(ME,{value:i,onChange:h=>{u(h)},onFocus:h=>f(h)}),d.jsx("div",{className:"mt-auto pt-6",children:d.jsx(op,{variant:"info",children:"Hover to preview. Press Space to apply theme instantly."})})]})]}),d.jsxs(Ta,{className:"relative pt-4 flex flex-col h-full overflow-hidden",children:[d.jsx(Wt,{variant:"floating",className:"text-tui-blue",children:"Live Preview"}),d.jsx(wn,{className:"flex-1 flex items-center justify-center p-0",children:d.jsx(DE,{previewTheme:_})})]})]})})}const UE=["SESSION_NOT_FOUND","AI_ERROR","STREAM_ERROR"],HE=ai(UE);eg({content:R(),truncated:ot().optional()},HE);const GE=J({readFiles:ot(),readGit:ot(),runCommands:ot()}),BE=["persistent","session"],VE=Se(BE);J({projectId:R(),repoRoot:R(),trustedAt:R().datetime(),capabilities:GE,trustMode:VE});const ZE=["auto","dark","light","terminal"],KE=Se(ZE),YE=J({theme:KE,defaultLenses:He(ni),defaultProfile:Ko.nullable(),severityThreshold:Zr}),qE=["gemini","openai","anthropic","glm","openrouter"],$a=Se(qE),ed=["gemini-3-flash-preview","gemini-3-pro-preview","gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.5-pro"];Se(ed);J({id:R(),name:R(),description:R(),tier:Se(["free","paid"]),recommended:ot().optional()});const FE={"gemini-3-flash-preview":{id:"gemini-3-flash-preview",name:"Gemini 3 Flash",description:"Latest preview, balanced speed and intelligence",tier:"paid"},"gemini-3-pro-preview":{id:"gemini-3-pro-preview",name:"Gemini 3 Pro",description:"Most intelligent, reasoning-first model",tier:"paid"},"gemini-2.5-flash":{id:"gemini-2.5-flash",name:"Gemini 2.5 Flash",description:"Best balance of speed and quality",tier:"free",recommended:!0},"gemini-2.5-flash-lite":{id:"gemini-2.5-flash-lite",name:"Gemini 2.5 Flash Lite",description:"Fastest and cheapest, highest free limits",tier:"free"},"gemini-2.5-pro":{id:"gemini-2.5-pro",name:"Gemini 2.5 Pro",description:"Best quality for complex analysis",tier:"free"}},td=["gpt-4o","gpt-4o-mini","gpt-4-turbo","o1-preview","o1-mini"];Se(td);const XE={"gpt-4o":{id:"gpt-4o",name:"GPT-4o",description:"Most capable multimodal model",tier:"paid",recommended:!0},"gpt-4o-mini":{id:"gpt-4o-mini",name:"GPT-4o Mini",description:"Fast and affordable for lighter tasks",tier:"paid"},"gpt-4-turbo":{id:"gpt-4-turbo",name:"GPT-4 Turbo",description:"High intelligence with vision capabilities",tier:"paid"},"o1-preview":{id:"o1-preview",name:"o1 Preview",description:"Advanced reasoning model",tier:"paid"},"o1-mini":{id:"o1-mini",name:"o1 Mini",description:"Fast reasoning model",tier:"paid"}},ad=["claude-sonnet-4-20250514","claude-3-5-sonnet-20241022","claude-3-5-haiku-20241022","claude-3-opus-20240229"];Se(ad);const QE={"claude-sonnet-4-20250514":{id:"claude-sonnet-4-20250514",name:"Claude Sonnet 4",description:"Latest Sonnet with improved reasoning",tier:"paid",recommended:!0},"claude-3-5-sonnet-20241022":{id:"claude-3-5-sonnet-20241022",name:"Claude 3.5 Sonnet",description:"Excellent balance of intelligence and speed",tier:"paid"},"claude-3-5-haiku-20241022":{id:"claude-3-5-haiku-20241022",name:"Claude 3.5 Haiku",description:"Fast and efficient for simple tasks",tier:"paid"},"claude-3-opus-20240229":{id:"claude-3-opus-20240229",name:"Claude 3 Opus",description:"Most powerful for complex analysis",tier:"paid"}},_p=["glm-4.7","glm-4.6"],$E={"glm-4.7":{id:"glm-4.7",name:"GLM-4.7",description:"Latest GLM with 200K context, excellent for coding",tier:"paid",recommended:!0},"glm-4.6":{id:"glm-4.6",name:"GLM-4.6",description:"Previous generation GLM model",tier:"paid",recommended:!1}},mp=["coding","standard"],JE=J({id:R(),name:R(),description:R().optional(),contextLength:fe(),pricing:J({prompt:R(),completion:R()}),isFree:ot()});J({models:He(JE),fetchedAt:R().datetime()});J({id:$a,name:R(),defaultModel:R(),models:He(R()).readonly()});const WE=[{id:"gemini",name:"Google Gemini",defaultModel:"gemini-2.5-flash",models:[...ed]},{id:"openai",name:"OpenAI",defaultModel:"gpt-4o",models:[...td]},{id:"anthropic",name:"Anthropic",defaultModel:"claude-sonnet-4-20250514",models:[...ad]},{id:"glm",name:"GLM (Z.ai)",defaultModel:"glm-4.7",models:[..._p]},{id:"openrouter",name:"OpenRouter",defaultModel:"",models:[]}];function PE(l,i){switch(l){case"gemini":return ed.includes(i);case"openai":return td.includes(i);case"anthropic":return ad.includes(i);case"glm":return _p.includes(i);case"openrouter":return!0;default:return!0}}J({provider:$a,model:R().optional(),glmEndpoint:Se(mp).optional(),...Ph}).refine(l=>!l.model||PE(l.provider,l.model),{message:"Model is not valid for the selected provider",path:["model"]});const hp=["NOT_CONFIGURED","INVALID_PROVIDER","INVALID_API_KEY","CONFIG_NOT_FOUND","CONFIG_WRITE_FAILED","CONFIG_READ_FAILED","UNKNOWN"],eA=ti(hp);Se(eA);ai(hp);J({provider:$a,apiKey:R().min(1),model:R().optional(),glmEndpoint:Se(mp).optional()});sl("configured",[J({configured:at(!0),config:J({provider:$a,model:R().optional()})}),J({configured:at(!1)})]);J({provider:$a,model:R().optional()});J({deleted:ot(),warning:R().optional()});J({deleted:ot(),provider:$a});const gp=J({provider:$a,hasApiKey:ot(),model:R().optional(),isActive:ot()});J({providers:He(gp),activeProvider:$a.optional()});const tA={gemini:"GOOGLE_API_KEY",openai:"OPENAI_API_KEY",anthropic:"ANTHROPIC_API_KEY",glm:"GLM_API_KEY",openrouter:"OPENROUTER_API_KEY"};J({config:J({provider:$a,model:R().optional()}).nullable(),settings:YE,providers:He(gp),configured:ot()});const ls={gemini:{toolCalling:"Supported (Native)",jsonMode:"Supported (Schema constraints)",streaming:"Native Server-Sent Events",contextWindow:"1M - 2M Tokens",tier:"mixed",tierBadge:"FREE",capabilities:["TOOLS","JSON","FAST"],costDescription:"Free tier available for Gemini 1.5 Flash and Pro within rate limits. Paid tier offers higher throughput and per-token billing for commercial use."},openai:{toolCalling:"Supported (Native)",jsonMode:"Supported (JSON mode)",streaming:"Server-Sent Events",contextWindow:"128K Tokens",tier:"paid",tierBadge:"PAID",capabilities:["TOOLS","JSON","VISION"],costDescription:"Pay-per-token pricing. GPT-4o offers best value for code review tasks."},anthropic:{toolCalling:"Supported (Native)",jsonMode:"Supported (JSON mode)",streaming:"Server-Sent Events",contextWindow:"200K Tokens",tier:"paid",tierBadge:"PAID",capabilities:["TOOLS","VISION","LONG-CTX"],costDescription:"Pay-per-token pricing. Claude excels at nuanced code analysis."},glm:{toolCalling:"Supported (Native)",jsonMode:"Supported",streaming:"Server-Sent Events",contextWindow:"200K Tokens",tier:"paid",tierBadge:"PAID",capabilities:["FAST","TOOLS"],costDescription:"Competitive pricing for GLM-4.7 with excellent code understanding."},openrouter:{toolCalling:"Varies by model",jsonMode:"Varies by model",streaming:"Supported",contextWindow:"Varies by model",tier:"mixed",tierBadge:"PAID",capabilities:["MULTI-PROVIDER"],costDescription:"Access multiple providers through single API. Pricing varies by model."}},aA=["paste","env"];Se(aA);const pp=["all","free","paid"];Se(pp);const nA=["all","configured","needs-key","free","paid"];Se(nA);const lA=["M","T","A","D","R","C","U","?","!"," "],Kh=Se(lA),To=J({path:R(),indexStatus:Kh,workTreeStatus:Kh}),iA=J({staged:He(To),unstaged:He(To),untracked:He(To)});J({isGitRepo:ot(),branch:R().nullable(),remoteBranch:R().nullable(),ahead:fe(),behind:fe(),files:iA,hasChanges:ot(),conflicted:He(R())});const vp=["NOT_GIT_REPO","GIT_NOT_FOUND","COMMAND_FAILED","INVALID_PATH","NOT_FOUND","UNKNOWN"],sA=ti(vp);Se(sA);ai(vp,{includeDetails:!0});J({diff:R(),staged:ot()});const rA=["runs","sessions"],uA=Se(rA),cA=["timeline","runs","insights"],oA=Se(cA);J({id:R(),displayId:R(),date:R(),branch:R(),provider:R(),timestamp:R(),summary:R(),issues:He(Zo),issueCount:fe(),criticalCount:fe(),warningCount:fe()});J({activeTab:uA,focusZone:oA,selectedDateId:R(),selectedRunId:R().nullable(),expandedRunId:R().nullable()});const dA=1,fA=65535;Db.number().int().min(dA).max(fA);const nd=fe().min(0).max(10).nullable(),_A=["critical","warning","suggestion","nitpick"],mA=Se(_A),hA=["security","performance","style","logic","documentation","best-practice"],gA=Se(hA),yp=J({severity:mA,category:gA,file:R().nullable(),line:fe().nullable(),title:R(),description:R(),suggestion:R().nullable()}).refine(l=>!(l.line!==null&&l.file===null),{message:"Line number requires a file to be specified",path:["line"]}),bp=J({summary:R(),issues:He(yp),overallScore:nd});J({filePath:R(),summary:R(),issues:He(yp),score:nd,parseError:ot().optional(),parseErrorMessage:R().optional()});const xp=["NO_DIFF","AI_ERROR"],pA=ti(xp);Se(pA);const vA=ai(xp);eg({result:bp},vA);const yA=J({id:Vr,projectPath:R(),...Vo,staged:ot(),branch:R().nullable(),overallScore:nd,issueCount:fe().int().nonnegative(),criticalCount:fe().int().nonnegative(),warningCount:fe().int().nonnegative()}),bA=J({branch:R().nullable(),fileCount:fe().int().nonnegative()});J({metadata:yA,result:bp,gitContext:bA}).refine(l=>{const i=l.result.issues,s=i.filter(o=>o.severity==="critical").length,u=i.filter(o=>o.severity==="warning").length;return l.metadata.issueCount===i.length&&l.metadata.criticalCount===s&&l.metadata.warningCount===u},{message:"Metadata counts must match actual issue data"});const xA=["user","assistant","system"],Sp=Se(xA),SA=J({id:Vr,role:Sp,content:R(),...Vo}),TA=J({id:Vr,projectPath:R(),title:R().optional(),...Ph,messageCount:fe().int().nonnegative()});J({metadata:TA,messages:He(SA)}).refine(l=>l.metadata.messageCount===l.messages.length,{message:"messageCount must match messages.length"});J({projectPath:R(),title:R().optional()});J({role:Sp,content:R()});const EA=["NAVIGATE","OPEN_ISSUE","TOGGLE_VIEW","APPLY_PATCH","IGNORE_ISSUE","FILTER_CHANGED","RUN_CREATED","RUN_RESUMED","SETTINGS_CHANGED"],AA=Se(EA);J({ts:fe(),type:AA,payload:Ib()});const RA=J({id:Vr,projectPath:R(),...Vo,staged:ot(),branch:R().nullable(),profile:Ko.nullable(),lenses:He(ni),issueCount:fe().int().nonnegative(),blockerCount:fe().int().nonnegative(),highCount:fe().int().nonnegative(),mediumCount:fe().int().nonnegative(),lowCount:fe().int().nonnegative(),nitCount:fe().int().nonnegative(),fileCount:fe().int().nonnegative()}),NA=J({branch:R().nullable(),commit:R().nullable(),fileCount:fe().int().nonnegative(),additions:fe().int().nonnegative(),deletions:fe().int().nonnegative()});J({metadata:RA,result:ag,gitContext:NA,drilldowns:He(Nx)});const Tp=[{value:"all",label:"All"},{value:"configured",label:"Configured"},{value:"needs-key",label:"Needs Key"},{value:"free",label:"Free"},{value:"paid",label:"Paid"}],Cr=Tp.map(l=>l.value);function CA(l){switch(l){case"active":return"[ACTIVE]";case"configured":return"[READY]";case"needs-key":return"[NEEDS KEY]"}}function wA({providers:l,selectedId:i,onSelect:s,onActivate:u,filter:o,onFilterChange:f,searchQuery:_,onSearchChange:h,keyboardEnabled:p=!0,onBoundaryReached:v,inputRef:y,focusedFilterIndex:T}){return d.jsxs("div",{className:"flex flex-col h-full",children:[d.jsx("div",{className:"p-3 border-b border-tui-border bg-tui-selection/30",children:d.jsx("h2",{className:"text-sm font-bold text-tui-fg uppercase tracking-wide",children:"Providers"})}),d.jsx("div",{className:"p-3 border-b border-tui-border",children:d.jsxs("div",{className:"relative",children:[d.jsx("span",{className:"absolute left-2 top-1/2 -translate-y-1/2 text-tui-muted text-xs",children:"/"}),d.jsx(np,{ref:y,size:"sm",value:_,onChange:E=>h(E.target.value),placeholder:"Search providers...",className:"pl-5"})]})}),d.jsx("div",{className:"px-3 py-2 border-b border-tui-border flex gap-1.5 flex-wrap",children:Tp.map((E,U)=>d.jsx("button",{type:"button",onClick:()=>f(E.value),className:Z("px-2 py-0.5 text-[10px] cursor-pointer transition-colors",o===E.value?"bg-tui-blue text-black font-bold":"border border-tui-border hover:border-tui-fg",T===U&&"ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg"),children:E.label},E.value))}),d.jsx("div",{className:"flex-1 overflow-y-auto scrollbar-hide",children:d.jsx(fT,{selectedId:i,onSelect:s,onActivate:u,keyboardEnabled:p,isFocused:p,onBoundaryReached:v,children:l.map(E=>{const I=ls[E.id]?.tierBadge??"PAID";return d.jsx(_T,{id:E.id,statusIndicator:CA(E.displayStatus),badge:d.jsx(pa,{variant:I==="FREE"?"success":"neutral",size:"sm",className:"text-[9px]",children:I}),subtitle:E.defaultModel,children:E.name},E.id)})})})]})}function Eo({children:l}){return d.jsxs("h3",{className:"text-xs font-bold text-tui-violet uppercase mb-4 tracking-widest flex items-center",children:[l," ",d.jsx("span",{className:"ml-2 flex-1 h-px bg-tui-border"})]})}function LA({provider:l,onSetApiKey:i,onSelectModel:s,onRemoveKey:u,onSelectProvider:o,focusedButtonIndex:f,isFocused:_=!1}){if(!l)return d.jsx("div",{className:"flex-1 flex items-center justify-center text-gray-500 text-sm",children:"Select a provider to view details"});const h=ls[l.id];return h?d.jsxs("div",{className:"flex-1 flex flex-col overflow-y-auto",children:[d.jsxs("div",{className:"p-3 border-b border-tui-border bg-tui-selection/30 flex justify-between items-center",children:[d.jsxs("h2",{className:"text-sm font-bold text-tui-fg uppercase tracking-wide",children:["Provider Details: ",l.name]}),l.displayStatus==="active"&&d.jsxs("span",{className:"text-[10px] text-tui-green font-mono flex items-center gap-1",children:[d.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-tui-green"})," Active"]})]}),d.jsxs("div",{className:"p-6",children:[d.jsxs("section",{className:"mb-6",children:[d.jsx(Eo,{children:"Capabilities"}),d.jsxs("div",{className:"grid grid-cols-2 gap-4",children:[d.jsx(Nr,{label:"Tool Calling",value:h.toolCalling}),d.jsx(Nr,{label:"JSON Mode",value:h.jsonMode}),d.jsx(Nr,{label:"Streaming",value:h.streaming}),d.jsx(Nr,{label:"Context Window",value:h.contextWindow})]})]}),d.jsxs("section",{className:"mb-6",children:[d.jsx(Eo,{children:"Cost Tier"}),d.jsx("div",{className:"border-l-2 border-tui-green pl-4",children:d.jsx("p",{className:"text-xs text-gray-400 leading-relaxed",children:h.costDescription})})]}),d.jsxs("section",{className:"mb-6",children:[d.jsx(Eo,{children:"Status"}),d.jsx(Vh,{label:"API Key Status",value:l.hasApiKey?d.jsx(pa,{variant:"stored",children:"[ STORED ]"}):d.jsx("span",{className:"text-gray-500",children:"Not configured"})}),d.jsx(Vh,{label:"Selected Model",value:l.model?d.jsx("span",{className:"text-tui-fg",children:l.model}):d.jsxs("span",{className:"text-gray-500",children:[l.defaultModel," (default)"]})})]}),d.jsx("section",{className:"mt-auto",children:d.jsx("div",{className:"flex flex-wrap gap-3 pt-4",children:[{action:o,label:"Select Provider",variant:"primary"},{action:i,label:"Set API Key",variant:"secondary"},{action:u,label:"Remove Key",variant:"destructive",disabled:!l.hasApiKey},{action:s,label:"Select Model...",variant:"link"}].map((p,v)=>d.jsx(Jt,{variant:p.variant,bracket:!0,onClick:p.action,disabled:p.disabled,className:_&&f===v?"ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg":"",children:p.label},p.label))})})]})]}):d.jsxs("div",{className:"flex-1 flex items-center justify-center text-gray-500 text-sm",children:["Unknown provider: ",l.id]})}function jA({open:l,envVarName:i,onSubmit:s,onRemoveKey:u,onOpenChange:o}){const[f,_]=b.useState("paste"),[h,p]=b.useState(""),[v,y]=b.useState(!1);b.useEffect(()=>{l&&(p(""),_("paste"))},[l]);const T=async()=>{if(v)return;const I=f==="paste"?h:i;if(!(!I&&f==="paste")){y(!0);try{await s(f,I),p(""),o(!1)}finally{y(!1)}}},E=async()=>{if(!(v||!u)){y(!0);try{await u(),o(!1)}finally{y(!1)}}},U=f==="env"||h.length>0;return{method:f,setMethod:_,keyValue:h,setKeyValue:p,isSubmitting:v,canSubmit:U,handleSubmit:T,handleRemove:E}}function OA({method:l,onMethodChange:i,keyValue:s,onKeyValueChange:u,envVarName:o,providerName:f,inputRef:_,focused:h,onFocus:p,onKeySubmit:v}){return d.jsxs("div",{"aria-label":"API key input method",children:[d.jsxs("div",{className:"space-y-2 mb-4",children:[d.jsx(Uo,{checked:l==="paste",onCheckedChange:()=>i("paste"),label:"Paste Key Now",focused:h==="paste"}),d.jsx("div",{className:"pl-9",children:d.jsxs("div",{onClick:()=>{p("input"),_.current?.focus()},className:Z("flex items-center border px-3 py-2 w-full cursor-text",l==="paste"?"bg-tui-input-bg border-tui-blue":"bg-tui-bg border-tui-border opacity-40",h==="input"&&"ring-2 ring-tui-blue"),children:[d.jsx("span",{className:"text-gray-500 mr-1 select-none",children:"KEY:"}),d.jsx(np,{ref:_,type:"password",value:s,onChange:y=>u(y.target.value),onFocus:()=>p("input"),onKeyDown:y=>{y.key==="Enter"&&(y.preventDefault(),v())},disabled:l!=="paste","aria-label":`${f} API Key`,className:"flex-1 bg-transparent text-white tracking-widest border-0 focus:ring-0 h-auto p-0 disabled:opacity-50 disabled:cursor-not-allowed"})]})})]}),d.jsxs("div",{className:Z("space-y-2 transition-opacity",l==="env"?"opacity-100":"opacity-60 hover:opacity-100"),children:[d.jsx(Uo,{checked:l==="env",onCheckedChange:()=>i("env"),label:"Import from Env",focused:h==="env"}),d.jsx("div",{className:"pl-9",children:d.jsxs("div",{className:"flex items-center bg-tui-bg border border-tui-border px-3 py-2 w-full text-gray-500",children:[d.jsx("span",{className:"mr-2 select-none text-gray-600",children:"$"}),d.jsx("span",{children:o})]})})]})]})}function IA({onCancel:l,onConfirm:i,onRemove:s,canSubmit:u,isSubmitting:o,hasExistingKey:f,focused:_,onFocus:h}){return d.jsxs(Jg,{className:"justify-between",children:[d.jsxs("div",{className:"flex gap-3 text-[10px] text-gray-500",children:[d.jsx("span",{children:"↑↓ navigate"}),d.jsx("span",{children:"Enter select"})]}),d.jsxs("div",{className:"flex gap-3 items-center",children:[d.jsx(Jt,{variant:"ghost",size:"sm",onClick:l,onMouseDown:()=>h("cancel"),className:Z("text-gray-500 hover:text-tui-fg h-auto px-2 py-1",_==="cancel"&&"ring-2 ring-tui-blue"),children:"[Esc] Cancel"}),d.jsx(Jt,{variant:"primary",size:"sm",onClick:i,onMouseDown:()=>h("confirm"),disabled:!u||o,className:Z("h-auto px-4 py-1.5",_==="confirm"&&"ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"),children:"[Enter] Confirm"}),f&&s&&d.jsx(Jt,{variant:"destructive",size:"sm",onClick:s,onMouseDown:()=>h("remove"),disabled:o,className:Z("h-auto px-3 py-1.5",_==="remove"&&"ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"),children:"Remove Key"})]})]})}function MA({open:l,onOpenChange:i,providerName:s,envVarName:u,hasExistingKey:o,onSubmit:f,onRemoveKey:_}){const h=b.useRef(null),[p,v]=b.useState("paste"),y=jA({open:l,envVarName:u,onSubmit:f,onRemoveKey:_,onOpenChange:i});b.useEffect(()=>{l&&v("paste")},[l]);const T=_?["cancel","confirm","remove"]:["cancel","confirm"],E=["paste","input","env",...T];W("ArrowDown",()=>{const I=E.indexOf(p);v(E[(I+1)%E.length])},{enabled:l}),W("ArrowUp",()=>{const I=E.indexOf(p);v(E[(I-1+E.length)%E.length])},{enabled:l}),W("ArrowRight",()=>{if(!T.includes(p))return;const I=T.indexOf(p);v(T[(I+1)%T.length])},{enabled:l}),W("ArrowLeft",()=>{if(!T.includes(p))return;const I=T.indexOf(p);v(T[(I-1+T.length)%T.length])},{enabled:l});const U=()=>{p==="paste"?y.setMethod("paste"):p==="input"?(y.setMethod("paste"),h.current?.focus()):p==="env"?y.setMethod("env"):p==="cancel"?i(!1):p==="confirm"&&y.canSubmit?y.handleSubmit():p==="remove"&&_&&y.handleRemove()};return W("Enter",U,{enabled:l&&p!=="input"}),W(" ",U,{enabled:l&&p!=="input"}),d.jsx(qg,{open:l,onOpenChange:i,children:d.jsxs(Fg,{className:"max-w-lg border border-tui-border shadow-2xl",children:[d.jsxs(Xg,{className:"bg-tui-selection/50",children:[d.jsxs(Qg,{className:"text-tui-blue tracking-wide",children:[s," API Key"]}),d.jsx(pa,{variant:"success",size:"sm",className:"uppercase tracking-wider border border-tui-green/30 px-1.5 py-0.5","aria-label":"Keys are stored securely",children:"Secure"})]}),d.jsxs($g,{className:"p-6 space-y-6",children:[d.jsx(OA,{method:y.method,onMethodChange:y.setMethod,keyValue:y.keyValue,onKeyValueChange:y.setKeyValue,envVarName:u,providerName:s,inputRef:h,focused:p,onFocus:v,onKeySubmit:y.handleSubmit}),d.jsxs("div",{className:"text-[11px] text-gray-600 border-t border-tui-border/40 pt-3 leading-relaxed",children:["Note: Keys are encrypted in your OS keychain. Context is only sent to"," ",s,"."]})]}),d.jsx(IA,{onCancel:()=>i(!1),onConfirm:y.handleSubmit,onRemove:_?y.handleRemove:void 0,canSubmit:y.canSubmit,isSubmitting:y.isSubmitting,hasExistingKey:o,focused:p,onFocus:v})]})})}function DA(l){return{isItemVisible:(u,o={})=>{const f=l.current;if(!f)return!0;const{itemSelector:_='[role="option"]'}=o,p=f.querySelectorAll(_)[u];if(!p)return!0;const v=f.getBoundingClientRect(),y=p.getBoundingClientRect();return y.top>=v.top&&y.bottom<=v.bottom},scrollItemIntoView:(u,o={})=>{const f=l.current;if(!f)return;const{padding:_=8,itemSelector:h='[role="option"]'}=o,v=f.querySelectorAll(h)[u];if(!v)return;const y=f.getBoundingClientRect(),T=v.getBoundingClientRect();T.top<y.top+_?f.scrollTop-=y.top+_-T.top:T.bottom>y.bottom-_&&(f.scrollTop+=T.bottom-y.bottom+_)}}}const Ao=[...pp];function kA(l){const[i,s]=b.useState(""),[u,o]=b.useState("all"),f=zA(l,u,i);return{searchQuery:i,setSearchQuery:s,tierFilter:u,setTierFilter:o,filteredModels:f,cycleTierFilter:()=>{o(p=>{const v=Ao.indexOf(p);return Ao[(v+1)%Ao.length]})},resetFilters:()=>{s(""),o("all")}}}function zA(l,i,s){let u=l;if(i==="free"?u=u.filter(o=>o.tier==="free"):i==="paid"&&(u=u.filter(o=>o.tier==="paid")),s.trim()){const o=s.toLowerCase();u=u.filter(f=>f.name.toLowerCase().includes(o)||f.description.toLowerCase().includes(o))}return u}const UA=b.forwardRef(function({value:i,onChange:s,onFocus:u,onEscape:o,onArrowDown:f},_){return d.jsx("div",{className:"px-4 pt-3 pb-2",children:d.jsxs("div",{className:"relative",children:[d.jsx("span",{className:"absolute left-2 top-1/2 -translate-y-1/2 text-tui-muted text-xs",children:"/"}),d.jsx("input",{ref:_,type:"text",value:i,onChange:h=>s(h.target.value),onFocus:u,onKeyDown:h=>{h.key==="Escape"&&(o(),h.stopPropagation()),h.key==="ArrowDown"&&(f(),h.preventDefault())},placeholder:"Search models...",className:"w-full bg-tui-input-bg border border-tui-border px-3 py-1.5 pl-6 text-xs focus:border-tui-blue focus:outline-none placeholder:text-gray-600"})]})})}),Ho=["all","free","paid"];function HA({value:l,onValueChange:i,focusedIndex:s,isFocused:u,onTabClick:o}){return d.jsx("div",{className:"px-4 pb-2 flex gap-1.5",children:Ho.map((f,_)=>d.jsx(Jt,{variant:"toggle",size:"sm","data-active":l===f,onClick:()=>{o(_),i(f)},className:Z("uppercase text-[10px] h-auto px-2 py-0.5",u&&s===_&&"ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg"),children:f},f))})}function GA({model:l,isSelected:i,isChecked:s,isFocused:u,onClick:o,onDoubleClick:f}){return d.jsxs("button",{role:"option","aria-selected":i,type:"button",onClick:o,onDoubleClick:f,className:Z("flex items-start gap-3 w-full text-left px-3 py-2 rounded transition-colors",i&&u?"bg-tui-selection/60 text-tui-fg ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg":"text-gray-400 hover:bg-tui-selection/30 hover:text-tui-fg"),children:[d.jsx("span",{className:Z("font-bold shrink-0 mt-0.5",s?"text-tui-blue":"text-gray-600"),children:s?"[ ● ]":"[   ]"}),d.jsxs("div",{className:"flex-1 min-w-0",children:[d.jsxs("div",{className:"flex items-center gap-2",children:[d.jsx("span",{className:"font-bold",children:l.name}),d.jsx(pa,{variant:l.tier==="free"?"success":"neutral",size:"sm",className:"uppercase border border-tui-border px-1.5 py-0.5",children:l.tier})]}),d.jsx("div",{className:"text-xs text-gray-500 mt-0.5 truncate",children:l.description})]})]})}const BA=b.forwardRef(function({models:i,selectedIndex:s,currentModelId:u,isFocused:o,onSelect:f,onConfirm:_},h){return i.length===0?d.jsx("div",{ref:h,role:"listbox","aria-label":"Available models",className:"px-4 py-2 max-h-60 overflow-y-auto scrollbar-thin",children:d.jsx("div",{className:"text-center text-gray-500 py-8 text-sm",children:"No models match your search"})}):d.jsx("div",{ref:h,role:"listbox","aria-label":"Available models",className:"px-4 py-2 space-y-1 max-h-60 overflow-y-auto scrollbar-thin",children:i.map((p,v)=>d.jsx(GA,{model:p,isSelected:v===s,isChecked:p.id===u,isFocused:o,onClick:()=>f(v),onDoubleClick:_},p.id))})});function VA({onCancel:l,onConfirm:i,canConfirm:s,cancelFocused:u,confirmFocused:o,hints:f}){return d.jsxs(d.Fragment,{children:[d.jsx("div",{className:"flex gap-3 text-[10px] text-gray-500",children:f.map(_=>d.jsxs("span",{children:[_.key," ",_.label]},_.key))}),d.jsxs("div",{className:"flex gap-3 items-center",children:[d.jsx(Jt,{variant:"ghost",size:"sm",onClick:l,className:Z("text-gray-500 hover:text-tui-fg h-auto px-2 py-1",u&&"ring-2 ring-tui-blue"),children:"[Esc] Cancel"}),d.jsx(Jt,{variant:"primary",size:"sm",onClick:i,disabled:!s,className:Z("h-auto px-4 py-1.5",o&&"ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"),children:"[Enter] Confirm"})]})]})}function ZA(l){switch(l){case"gemini":return Object.values(FE);case"openai":return Object.values(XE);case"anthropic":return Object.values(QE);case"glm":return Object.values($E);default:return[]}}const KA=[{key:"↑↓/jk",label:"navigate"},{key:"/",label:"search"},{key:"f",label:"filter"}];function YA({open:l,onOpenChange:i,provider:s,currentModel:u,onSelect:o}){const f=ZA(s),[_,h]=b.useState(0),[p,v]=b.useState(u),y=b.useRef(null),T=b.useRef(null),{searchQuery:E,setSearchQuery:U,tierFilter:I,setTierFilter:D,filteredModels:K,cycleTierFilter:le,resetFilters:ve}=kA(f),[ae,q]=b.useState("list"),[ie,te]=b.useState(0),[ge,ne]=b.useState(1),{scrollItemIntoView:Xe}=DA(T);b.useEffect(()=>{if(l){ve(),q("list"),te(0),ne(1),v(u);const B=f.findIndex(Q=>Q.id===u);h(B>=0?B:0)}},[l,u,s]),b.useEffect(()=>{_>=K.length&&K.length>0&&h(0)},[K.length,_]),b.useEffect(()=>{ae==="list"&&K.length>0&&Xe(_)},[_,ae,K.length]);const yt=()=>{const B=K[_];B&&(o(B.id),i(!1))},dt=()=>{const B=K[_];B&&v(B.id)},Ie=()=>i(!1),rt=()=>{_>0?h(B=>B-1):(q("filters"),te(0))},nt=()=>{_<K.length-1?h(B=>B+1):(q("footer"),ne(1))};W("ArrowUp",rt,{enabled:l&&ae==="list"}),W("ArrowDown",nt,{enabled:l&&ae==="list"}),W("k",rt,{enabled:l&&ae==="list"}),W("j",nt,{enabled:l&&ae==="list"}),W(" ",dt,{enabled:l&&ae==="list"&&K.length>0}),W("Enter",yt,{enabled:l&&ae==="list"&&K.length>0}),W("ArrowDown",()=>{y.current?.blur(),q("filters")},{enabled:l&&ae==="search"}),W("ArrowLeft",()=>te(B=>B>0?B-1:2),{enabled:l&&ae==="filters"}),W("ArrowRight",()=>te(B=>B<2?B+1:0),{enabled:l&&ae==="filters"}),W("ArrowDown",()=>{q("list"),h(0)},{enabled:l&&ae==="filters"}),W("ArrowUp",()=>{q("search"),y.current?.focus()},{enabled:l&&ae==="filters"}),W("Enter",()=>D(Ho[ie]),{enabled:l&&ae==="filters"}),W(" ",()=>D(Ho[ie]),{enabled:l&&ae==="filters"}),W("ArrowLeft",()=>ne(0),{enabled:l&&ae==="footer"}),W("ArrowRight",()=>ne(1),{enabled:l&&ae==="footer"}),W("ArrowUp",()=>{q("list"),h(K.length-1)},{enabled:l&&ae==="footer"}),W("Enter",()=>ge===0?Ie():yt(),{enabled:l&&ae==="footer"}),W(" ",()=>ge===0?Ie():yt(),{enabled:l&&ae==="footer"}),W("/",()=>{ae!=="search"&&(q("search"),y.current?.focus())},{enabled:l}),W("f",le,{enabled:l&&ae!=="search"}),W("Escape",Ie,{enabled:l&&ae!=="search"});const ye=()=>{E?U(""):(y.current?.blur(),q("list"),h(0))},H=()=>{y.current?.blur(),q("filters")};return d.jsx(qg,{open:l,onOpenChange:i,children:d.jsxs(Fg,{className:"max-w-lg border border-tui-border shadow-2xl",children:[d.jsxs(Xg,{className:"bg-tui-selection/50",children:[d.jsx(Qg,{className:"text-tui-blue tracking-wide",children:"Select Model"}),d.jsx(WS,{className:"text-gray-500 hover:text-tui-fg font-bold"})]}),d.jsxs($g,{className:"p-0 flex flex-col",children:[d.jsx(UA,{ref:y,value:E,onChange:U,onFocus:()=>q("search"),onEscape:ye,onArrowDown:H}),d.jsx(HA,{value:I,onValueChange:D,focusedIndex:ie,isFocused:ae==="filters",onTabClick:B=>{q("filters"),te(B)}}),d.jsx(BA,{ref:T,models:K,selectedIndex:_,currentModelId:p,isFocused:ae==="list",onSelect:B=>{q("list"),h(B);const Q=K[B];Q&&v(Q.id)},onConfirm:yt})]}),d.jsx(Jg,{className:"justify-between",children:d.jsx(VA,{onCancel:()=>{q("footer"),ne(0),Ie()},onConfirm:()=>{q("footer"),ne(1),yt()},canConfirm:K.length>0,cancelFocused:ae==="footer"&&ge===0,confirmFocused:ae==="footer"&&ge===1,hints:KA})})]})})}async function qA(){return(await lt.get("/config/providers")).providers}async function FA(l,i,s){await lt.post("/config",{provider:l,apiKey:i})}async function XA(l){await lt.delete(`/config/provider/${l}`)}async function QA(l,i){await lt.post(`/config/provider/${l}/activate`,{model:i})}function $A(){const[l,i]=b.useState([]),[s,u]=b.useState(!0),[o,f]=b.useState(null),_=b.useCallback(async()=>{u(!0);try{const E=await qA();i(E),f(null)}catch(E){f(E instanceof Error?E:new Error(String(E)))}finally{u(!1)}},[]);b.useEffect(()=>{_()},[_]);const h=b.useMemo(()=>WE.map(E=>{const U=l.find(K=>K.provider===E.id),I=U?.hasApiKey??!1,D=U?.isActive??!1;return{...E,hasApiKey:I,isActive:D,model:U?.model,displayStatus:D?"active":I?"configured":"needs-key"}}),[l]),p=b.useMemo(()=>h.find(E=>E.isActive)??null,[h]),v=b.useCallback(async(E,U,I="paste")=>{await FA(E,U),await _()},[_]),y=b.useCallback(async E=>{await XA(E),await _()},[_]),T=b.useCallback(async(E,U)=>{await QA(E,U),await _()},[_]);return{providers:h,activeProvider:p,isLoading:s,error:o,refetch:_,saveApiKey:v,removeApiKey:y,selectProvider:T}}const JA=[{key:"↑/↓",label:"Navigate"},{key:"←/→",label:"Switch Panel"},{key:"/",label:"Search"},{key:"Enter",label:"Activate"},{key:"Esc",label:"Back"}];function WA(){const l=ea(),{setShortcuts:i,setRightShortcuts:s}=Fo(),u=b.useRef(null),[o,f]=il("providerId",null),[_,h]=b.useState("all"),[p,v]=b.useState(""),[y,T]=b.useState(!1),[E,U]=b.useState(!1),[I,D]=b.useState(!1),[K,le]=b.useState("list"),[ve,ae]=b.useState(0),[q,ie]=b.useState(0),{providers:te,isLoading:ge,saveApiKey:ne,removeApiKey:Xe,selectProvider:yt,refetch:dt}=$A(),{showToast:Ie}=ss(),rt=b.useMemo(()=>{let z=te;if(_==="configured"?z=z.filter($=>$.hasApiKey):_==="needs-key"?z=z.filter($=>!$.hasApiKey):_==="free"?z=z.filter($=>ls[$.id]?.tier==="free"||ls[$.id]?.tier==="mixed"):_==="paid"&&(z=z.filter($=>ls[$.id]?.tier==="paid")),p){const $=p.toLowerCase();z=z.filter(re=>re.name.toLowerCase().includes($)||re.id.toLowerCase().includes($))}return z},[te,_,p]),nt=b.useMemo(()=>rt.map(z=>({...z,displayStatus:z.isActive?"active":z.hasApiKey?"configured":"needs-key",selectedModel:z.model})),[rt]),ye=o?nt.find(z=>z.id===o)??null:nt[0]??null;b.useEffect(()=>{o===null&&ye&&f(ye.id)},[o,ye,f]),b.useEffect(()=>{K==="input"?u.current?.focus():u.current?.blur()},[K]);const H=z=>{z==="up"&&(le("filters"),ae(Cr.indexOf(_)))},B=y||E,Q=K==="input",Le=K==="filters",Ge=K==="list",Te=K==="buttons",L=ye?.hasApiKey??!1,N=(z,$)=>{const re=[!0,!0,L,!0];let he=z+$;for(;he>=0&&he<4;){if(re[he])return he;he+=$}return z};W("ArrowDown",()=>le("filters"),{enabled:!B&&Q,allowInInput:!0}),W("Escape",()=>le("filters"),{enabled:!B&&Q,allowInInput:!0}),W("ArrowUp",()=>le("input"),{enabled:!B&&Le}),W("ArrowDown",()=>{le("list"),rt.length>0&&f(rt[0].id)},{enabled:!B&&Le}),W("ArrowLeft",()=>ae(z=>Math.max(0,z-1)),{enabled:!B&&Le}),W("ArrowRight",()=>ae(z=>Math.min(Cr.length-1,z+1)),{enabled:!B&&Le}),W("Enter",()=>h(Cr[ve]),{enabled:!B&&Le}),W(" ",()=>h(Cr[ve]),{enabled:!B&&Le}),W("ArrowRight",()=>{le("buttons"),ie(0)},{enabled:!B&&Ge&&!!ye}),W("ArrowLeft",()=>{q===0?le("list"):ie(z=>N(z,-1))},{enabled:!B&&Te}),W("ArrowRight",()=>ie(z=>N(z,1)),{enabled:!B&&Te}),W("ArrowUp",()=>ie(z=>N(z,-1)),{enabled:!B&&Te}),W("ArrowDown",()=>ie(z=>N(z,1)),{enabled:!B&&Te}),W("Enter",()=>x(q),{enabled:!B&&Te}),W(" ",()=>x(q),{enabled:!B&&Te}),W("Escape",()=>l({to:"/settings"}),{enabled:!B&&!Q}),W("/",()=>{le("input")},{enabled:!B&&!Q}),b.useEffect(()=>{!ye&&K==="buttons"&&le("list")},[ye,K]),b.useEffect(()=>{i(JA);const z=ye?.isActive?"ACTIVE":ye?.hasApiKey?"READY":"NEEDS KEY";s([{key:"PROV:",label:`${ye?.name??"None"} • STATUS: ${z}`}])},[ye,i,s]);const x=z=>{if(ye)switch(z){case 0:F();break;case 1:T(!0);break;case 2:ye.hasApiKey&&X();break;case 3:U(!0);break}},w=async(z,$)=>{if(!(!ye||I)){D(!0);try{await ne(ye.id,$,z),await dt(),T(!1),Ie({variant:"success",title:"API Key Saved",message:"Provider configured"})}catch(re){Ie({variant:"error",title:"Failed to Save",message:re instanceof Error?re.message:"Unknown error"})}finally{D(!1)}}},X=async()=>{if(!(!ye||I)){D(!0);try{await Xe(ye.id),await dt(),T(!1),Ie({variant:"success",title:"API Key Removed",message:"Provider key deleted"})}catch(z){Ie({variant:"error",title:"Failed to Remove",message:z instanceof Error?z.message:"Unknown error"})}finally{D(!1)}}},F=async()=>{if(!(!ye||I)){D(!0);try{await yt(ye.id,ye.model),await dt(),Ie({variant:"success",title:"Provider Activated",message:`${ye.name} is now active`})}catch(z){Ie({variant:"error",title:"Failed to Activate",message:z instanceof Error?z.message:"Unknown error"})}finally{D(!1)}}},ee=async z=>{if(!(!ye||I)){D(!0);try{await yt(ye.id,z),await dt(),U(!1),Ie({variant:"success",title:"Model Selected",message:`Selected ${z}`})}catch($){Ie({variant:"error",title:"Failed to Select Model",message:$ instanceof Error?$.message:"Unknown error"})}finally{D(!1)}}};return ge?d.jsx("div",{className:"flex-1 flex items-center justify-center",children:d.jsx("span",{className:"text-gray-500",role:"status","aria-live":"polite",children:"Loading providers..."})}):d.jsxs("div",{className:"flex-1 flex overflow-hidden",children:[d.jsx("div",{className:"w-2/5 flex flex-col border-r border-tui-border",children:d.jsx(wA,{providers:nt,selectedId:o,onSelect:f,filter:_,onFilterChange:h,searchQuery:p,onSearchChange:v,keyboardEnabled:Ge&&!B,onBoundaryReached:H,inputRef:u,focusedFilterIndex:Le?ve:void 0})}),d.jsx("div",{className:"w-3/5 flex flex-col bg-[#0b0e14]",children:d.jsx(LA,{provider:ye,onSetApiKey:()=>T(!0),onSelectModel:()=>U(!0),onRemoveKey:X,onSelectProvider:F,focusedButtonIndex:K==="buttons"&&ye?q:void 0,isFocused:K==="buttons"&&!!ye})}),ye&&d.jsxs(d.Fragment,{children:[d.jsx(MA,{open:y,onOpenChange:T,providerName:ye.name,envVarName:tA[ye.id],hasExistingKey:ye.hasApiKey,onSubmit:w,onRemoveKey:X}),d.jsx(YA,{open:E,onOpenChange:U,provider:ye.id,currentModel:ye.model,onSelect:ee})]})]})}const da={version:"v1.4.2",nodeVersion:"v20.5.1",terminalSize:"120x40",colorSupport:"24-bit",unicodeSupport:"Full Support",memoryRss:"42MB",memoryHeap:"28MB",paths:{config:"~/.config/stargazer",data:"~/.local/share/stargazer/runs",cache:"~/.cache/stargazer/v1"}},PA=[{key:"←/→",label:"Navigate"},{key:"Enter",label:"Activate"},{key:"Esc",label:"Back"}],e1=3;function t1(){const l=ea(),i=b.useMemo(()=>PA,[]);Ea({shortcuts:i});const s=b.useCallback(f=>{switch(f){case 0:console.log("Paths:",da.paths);break;case 1:console.log("Debug report exported");break;case 2:console.log("UI settings reset");break}},[]),{focusedIndex:u,enterFooter:o}=VS({enabled:!0,buttonCount:e1,onAction:s});return b.useEffect(()=>{o(0)},[o]),W("Escape",()=>l({to:"/settings"})),d.jsx("div",{className:"flex-1 flex overflow-hidden px-4 justify-center items-center",children:d.jsxs(Ta,{className:"w-full max-w-2xl bg-[#161b22] shadow-lg",children:[d.jsx(Wt,{value:da.version,valueVariant:"muted",children:"System Diagnostics"}),d.jsxs(wn,{spacing:"none",className:"p-6 space-y-8",children:[d.jsxs("div",{className:"grid grid-cols-2 gap-y-4 gap-x-8 text-sm",children:[d.jsxs("div",{className:"flex flex-col",children:[d.jsx("span",{className:"text-tui-muted text-xs uppercase tracking-wider mb-1",children:"Version Info"}),d.jsxs("div",{className:"flex items-center gap-2",children:[d.jsxs("span",{className:"text-tui-blue",children:["Stargazer ",da.version]}),d.jsx("span",{className:"text-tui-border",children:"|"}),d.jsxs("span",{className:"text-tui-green",children:["Node ",da.nodeVersion]})]})]}),d.jsxs("div",{className:"flex flex-col",children:[d.jsx("span",{className:"text-tui-muted text-xs uppercase tracking-wider mb-1",children:"Terminal Environment"}),d.jsxs("div",{className:"flex items-center gap-2",children:[d.jsxs("span",{children:["TTY ",d.jsxs("span",{className:"text-tui-green",children:["[","Yes","]"]})]}),d.jsx("span",{className:"text-tui-border",children:"|"}),d.jsx("span",{children:da.terminalSize}),d.jsx("span",{className:"text-tui-border",children:"|"}),d.jsxs("span",{children:["Color ",d.jsxs("span",{className:"text-tui-violet",children:["[",da.colorSupport,"]"]})]})]})]}),d.jsxs("div",{className:"flex flex-col",children:[d.jsx("span",{className:"text-tui-muted text-xs uppercase tracking-wider mb-1",children:"Unicode Support"}),d.jsxs("div",{className:"text-white flex items-center gap-2",children:[d.jsxs("span",{children:["[",da.unicodeSupport,"]"]}),d.jsx("span",{className:"text-xs text-tui-yellow",children:"✔ ✖ ▲ ●"})]})]}),d.jsxs("div",{className:"flex flex-col",children:[d.jsx("span",{className:"text-tui-muted text-xs uppercase tracking-wider mb-1",children:"Memory Usage"}),d.jsxs("div",{className:"text-white",children:["RSS: ",da.memoryRss," / Heap: ",da.memoryHeap]})]})]}),d.jsx("div",{className:"border-t border-tui-border border-dashed"}),d.jsxs("div",{className:"space-y-3",children:[d.jsx("h3",{className:"text-tui-violet font-bold text-xs uppercase tracking-wider",children:"Storage Paths"}),d.jsxs("div",{className:"grid grid-cols-[80px_1fr] gap-2 text-sm font-mono",children:[d.jsx("span",{className:"text-tui-muted text-right",children:"Config:"}),d.jsx("span",{className:"text-tui-fg",children:da.paths.config}),d.jsx("span",{className:"text-tui-muted text-right",children:"Data:"}),d.jsx("span",{className:"text-tui-fg",children:da.paths.data}),d.jsx("span",{className:"text-tui-muted text-right",children:"Cache:"}),d.jsx("span",{className:"text-tui-fg",children:da.paths.cache})]})]}),d.jsx("div",{className:"border-t border-tui-border border-dashed"}),d.jsxs("div",{className:"flex gap-4 pt-2",children:[d.jsx("button",{className:Z("bg-tui-bg border border-tui-border text-tui-fg px-3 py-1.5 text-sm transition-colors","hover:bg-tui-selection hover:text-white hover:border-tui-blue","focus:outline-none focus:ring-1 focus:ring-tui-blue",u===0&&"ring-2 ring-tui-blue border-tui-blue"),children:"[ Print Paths ]"}),d.jsx("button",{className:Z("bg-tui-bg border border-tui-border text-tui-fg px-3 py-1.5 text-sm transition-colors","hover:bg-tui-selection hover:text-white hover:border-tui-green","focus:outline-none focus:ring-1 focus:ring-tui-green",u===1&&"ring-2 ring-tui-green border-tui-green"),children:"[ Export Debug Report ]"}),d.jsx("button",{className:Z("bg-tui-bg border border-tui-border text-tui-fg px-3 py-1.5 text-sm transition-colors ml-auto","hover:bg-tui-selection hover:text-tui-red hover:border-tui-red","focus:outline-none focus:ring-1 focus:ring-tui-red",u===2&&"ring-2 ring-tui-red border-tui-red text-tui-red"),children:"[ Reset UI Settings ]"})]})]})]})})}const Aa=Qy({component:zS}),a1=Qa({getParentRoute:()=>Aa,path:"/",component:oE}),n1=Qa({getParentRoute:()=>Aa,path:"/review",component:fp}),l1=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,i1=Qa({getParentRoute:()=>Aa,path:"/review/$reviewId",component:fp,beforeLoad:({params:l})=>{if(!l1.test(l.reviewId))throw Jy({to:"/",search:{error:"invalid-review-id"}})}}),s1=Qa({getParentRoute:()=>Aa,path:"/settings",component:wE}),r1=Qa({getParentRoute:()=>Aa,path:"/history",component:RE}),u1=Qa({getParentRoute:()=>Aa,path:"/settings/trust",component:IE}),c1=Qa({getParentRoute:()=>Aa,path:"/settings/theme",component:zE}),o1=Qa({getParentRoute:()=>Aa,path:"/settings/providers",component:WA}),d1=Qa({getParentRoute:()=>Aa,path:"/settings/about",component:t1}),f1=Aa.addChildren([a1,n1,i1,s1,r1,u1,c1,o1,d1]),_1=$y({routeTree:f1});lb.createRoot(document.getElementById("root")).render(d.jsx(y0,{children:d.jsx(Wy,{router:_1})}));
