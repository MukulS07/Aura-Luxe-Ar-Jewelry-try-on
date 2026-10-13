// Design prototype only: no camera, no tracking. Strings keyed per design.md §9.
const T={"start.title":"See jewelry on you","start.sub":"Try earrings and necklaces in seconds","start.cta":"Touch to start",
"notice.title":"Camera in use","notice.accept":"Accept","notice.decline":"No thanks","pick.title":"Choose your jewellery",
"pick.hint":"Tap a piece to try it on","live.guide":"Look at the camera","live.details":"Details",
"photo.question":"Save this photo and get a link on your phone?","photo.save":"Save","photo.retake":"Retake","photo.discard":"Don't save",
"qr.title":"Scan to get your photo","idle.title":"Still there?","result.disclaimer":"Results are approximate. Real pieces may differ."};
const CATALOG=[
 {id:"ear-001",n:"Jhumka Gold",t:"earrings",c:""},{id:"ear-002",n:"Stud Silver",t:"earrings",c:"n2"},
 {id:"ear-003",n:"Drop Rose",t:"earrings",c:"n3"},{id:"ear-004",n:"Hoop Gold",t:"earrings",c:""},
 {id:"neck-001",n:"Choker Gold",t:"necklace",c:""},{id:"neck-002",n:"Pendant Silver",t:"necklace",c:"n2"},
 {id:"neck-003",n:"Rani Haar",t:"necklace",c:"n3"}];
const IDLE_WARN_MS=45000, IDLE_RESET_S=10; // proposed
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const stage=$("#stage");
function fit(){stage.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1080,innerHeight/1920)})`}
addEventListener("resize",fit);fit();
$$("[data-t]").forEach(e=>e.textContent=T[e.dataset.t]);

let cat="earrings",cur=CATALOG[0],idleT,idleI;
function go(id){
  $$(".screen").forEach(s=>s.classList.toggle("on",s.id===id));
  $$(".sheet-bg").forEach(s=>s.classList.remove("on"));
  if(id==="live")startLive(); if(id==="start")clearTimeout(idleT); else bump();
}
function bump(){clearTimeout(idleT);idleT=setTimeout(idle,IDLE_WARN_MS)}
function idle(){let n=IDLE_RESET_S;$("#idleN").textContent=n;$("#idle").classList.add("on");
  clearInterval(idleI);idleI=setInterval(()=>{$("#idleN").textContent=--n;if(n<=0){clearInterval(idleI);go("start")}},1000)}
function pieces(t){return CATALOG.filter(p=>p.t===t)}
function renderGrid(){
  $("#secName").textContent=cat==="earrings"?"Earrings":"Necklaces";
  $$(".cat").forEach(c=>c.classList.toggle("sel",c.dataset.cat===cat));
  $("#grid").innerHTML=pieces(cat).map(p=>`<button class="card" data-pick="${p.id}"><div class="th ${p.c}"></div><span>${p.n}</span></button>`).join("");
}
function renderStrip(){
  $$(".tab").forEach(t=>t.classList.toggle("sel",t.dataset.cat2===cat));
  $("#strip").innerHTML=pieces(cat).map(p=>`<button class="thumb ${p.id===cur.id?"sel":""}" data-sw="${p.id}" aria-label="${p.n}"><i class="${p.c}"></i></button>`).join("");
  $("#liveName").textContent=cur.n;
}
function startLive(){
  renderStrip();const f=$("#face"),ft=$("#faceT"),ch=$("#chip");
  f.classList.remove("off");ft.style.opacity=1;ch.textContent="Starting camera…";
  setTimeout(()=>{ch.textContent="Look at the camera and step a little closer"},1200);
  setTimeout(()=>{f.classList.add("off");ft.style.opacity=0;ch.style.display="none"},3200);ch.style.display="flex";
}
document.addEventListener("click",e=>{
  bump();const el=e.target.closest("button,.cat,[data-close]");if(!el)return;
  if(el.dataset.go)go(el.dataset.go);
  else if(el.dataset.cat){cat=el.dataset.cat;renderGrid()}
  else if(el.dataset.cat2){cat=el.dataset.cat2;cur=pieces(cat)[0];renderStrip()}
  else if(el.dataset.pick){cur=CATALOG.find(p=>p.id===el.dataset.pick);go("live")}
  else if(el.dataset.sw){cur=CATALOG.find(p=>p.id===el.dataset.sw);renderStrip()}
  else if(el.dataset.sheet)$("#"+el.dataset.sheet).classList.add("on");
  else if(el.hasAttribute("data-close")){el.closest(".sheet-bg").classList.remove("on");clearInterval(idleI)}
  else if(el.id==="shutter"){let n=3;const c=$("#count");c.textContent=n;c.classList.add("on");
    const i=setInterval(()=>{if(--n>0)c.textContent=n;else{clearInterval(i);c.classList.remove("on");go("photoS")}},1000)}
});
renderGrid();
// dev nav: jump to any screen
$("#dev").innerHTML=["start","notice","pick","live","photoS","qrS"].map(s=>`<button data-go="${s}">${s}</button>`).join("");
