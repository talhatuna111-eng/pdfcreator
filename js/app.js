/* =====================================================================
   PDF Creator — İstemci taraflı PDF araç seti
   Tüm işlemler tarayıcıda; pdf-lib + pdf.js + JSZip
   ===================================================================== */
const { PDFDocument, degrees, StandardFonts, rgb } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ---------- Reklam / kullanım sayacı ---------- */
const FREE_USES = 2;
function getUses(){ return parseInt(localStorage.getItem('pdfcreator_uses')||'0',10); }
function setUses(n){ localStorage.setItem('pdfcreator_uses', n); refreshUseLabel(); }
function refreshUseLabel(){
  const left = Math.max(0, FREE_USES - getUses());
  const el = document.getElementById('useCount');
  el.textContent = left>0 ? `${left} reklamsız işlem hakkı` : 'reklamlı mod';
}

/* Reklam modalını gösterir, kapanınca devam eder */
function showAdGate(){
  return new Promise(resolve=>{
    const modal=document.getElementById('adModal');
    const skip=document.getElementById('skipAd');
    const t=document.getElementById('skipTimer');
    let s=5; skip.disabled=true; t.textContent=`(${s})`; modal.classList.add('show');
    // AdSense gösterimi (kod varsa): try{ (adsbygoogle=window.adsbygoogle||[]).push({}); }catch(e){}
    const iv=setInterval(()=>{ s--; if(s<=0){clearInterval(iv); skip.disabled=false; t.textContent='';} else t.textContent=`(${s})`; },1000);
    skip.onclick=()=>{ if(skip.disabled) return; modal.classList.remove('show'); resolve(); };
  });
}

/* İşlemden önce kapı: ücretsiz hak bitince reklam göster */
async function adGate(){
  if(getUses() >= FREE_USES){ await showAdGate(); }
}
function countUse(){ setUses(getUses()+1); }

/* ---------- Araç tanımları ---------- */
const ICONS = {
  merge:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M11 7h4a2 2 0 0 1 2 2v4"/></svg>',
  split:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18"/><path d="M7 8 3 12l4 4"/><path d="m17 8 4 4-4 4"/></svg>',
  delete:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  rotate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/></svg>',
  reorder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h13M3 12h9M3 18h13"/><path d="m18 9 3 3-3 3"/></svg>',
  img2pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  pdf2img:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><circle cx="10" cy="13" r="1.5"/><path d="m8 19 3-3 3 3"/></svg>',
  compress:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/><path d="M9 12h6"/></svg>',
  pagenum:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 17h6"/></svg>',
  extracttext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5h14M5 10h14M5 15h9M5 20h6"/></svg>',
};

const TOOLS = [
  {id:"merge",       title:"PDF Birleştir",  desc:"Birden çok PDF'i tek dosyada birleştirin.",        accept:".pdf",   multiple:true,  tint:"indigo"},
  {id:"split",       title:"PDF Böl",        desc:"PDF'inizdeki sayfaları kolayca ayırın.",            accept:".pdf",   multiple:false, tint:"rose"},
  {id:"compress",    title:"PDF Sıkıştır",   desc:"Boyutu küçültün, kaliteden ödün vermeyin.",         accept:".pdf",   multiple:false, tint:"violet"},
  {id:"rotate",      title:"PDF Döndür",     desc:"Sayfaları 90° / 180° çevirin.",                     accept:".pdf",   multiple:false, tint:"amber"},
  {id:"delete",      title:"Sayfa Sil",      desc:"İstemediğiniz sayfaları çıkarın.",                  accept:".pdf",   multiple:false, tint:"red"},
  {id:"reorder",     title:"Sayfa Sırala",   desc:"Sayfaları sürükleyerek yeniden dizin.",             accept:".pdf",   multiple:false, tint:"teal"},
  {id:"img2pdf",     title:"Resimden PDF",   desc:"JPG / PNG görselleri PDF'e dönüştürün.",            accept:"image/*",multiple:true,  tint:"sky"},
  {id:"pdf2img",     title:"PDF'den JPG",    desc:"Sayfaları yüksek kaliteli görsele dönüştürün.",     accept:".pdf",   multiple:false, tint:"green"},
  {id:"pagenum",     title:"Sayfa Numarası", desc:"PDF sayfalarına numara ekleyin.",                   accept:".pdf",   multiple:false, tint:"fuchsia"},
  {id:"extracttext", title:"PDF'den Metin",  desc:"Metni .txt dosyası olarak dışa aktarın.",           accept:".pdf",   multiple:false, tint:"slate"},
];

/* ---------- Durum ---------- */
let current=null;          // aktif araç
let items=[];              // {id,file,name,size}
let thumbState=null;       // reorder için sayfa sırası
let uid=0;

/* ---------- Araç ızgarasını oluştur ---------- */
const grid=document.getElementById('toolGrid');
TOOLS.forEach((t,i)=>{
  const el=document.createElement('button');
  el.className='tool';
  el.innerHTML=`<div class="ic tint-${t.tint}">${ICONS[t.id]}</div>
    <h3>${t.title}</h3><p>${t.desc}</p>`;
  el.onclick=()=>openTool(t.id);
  grid.appendChild(el);
});
var _tc=document.getElementById('toolCount'); if(_tc)_tc.textContent=`${TOOLS.length} araç`;

/* ---------- DOM kısayolları ---------- */
const ws=document.getElementById('workspace');
const fileInput=document.getElementById('fileInput');
const drop=document.getElementById('drop');
const fileList=document.getElementById('fileList');
const optsBox=document.getElementById('opts');
const runBtn=document.getElementById('runBtn');
const statusEl=document.getElementById('status');

/* ---------- Aracı aç ---------- */
function openTool(id){
  current=TOOLS.find(t=>t.id===id);
  items=[]; thumbState=null;
  document.getElementById('wsIcon').innerHTML=ICONS[id];
  document.getElementById('wsTitle').textContent=current.title;
  document.getElementById('wsDesc').textContent=current.desc;
  document.getElementById('runLabel').textContent={
    merge:'Birleştir', split:'Ayır ve İndir', delete:'Sil ve İndir',
    rotate:'Döndür ve İndir', reorder:'Yeni Sırayla İndir',
    img2pdf:'PDF Oluştur', pdf2img:'Resimleri İndir', compress:'Sıkıştır ve İndir',
    pagenum:'Numaralandır ve İndir', extracttext:'Metni Çıkar (.txt)'
  }[id];
  fileInput.accept=current.accept; fileInput.multiple=current.multiple;
  document.getElementById('dropTitle').textContent = current.id==='img2pdf'
    ? 'Görselleri buraya sürükleyin' : 'PDF dosyalarını buraya sürükleyin';
  buildOpts();
  renderFiles();
  setStatus('');
  refreshUseLabel();
  ws.classList.add('active');
  ws.scrollIntoView({behavior:'smooth',block:'start'});
}
document.getElementById('wsClose').onclick=()=>ws.classList.remove('active');

/* ---------- Seçenek panelleri ---------- */
function buildOpts(){
  optsBox.innerHTML='';
  const id=current.id;
  if(id==='split'){
    optsBox.innerHTML=`
      <div class="opt-row"><span class="opt-label">Bölme şekli</span>
        <div class="seg" id="segSplit">
          <button class="on" data-v="each">Her sayfa ayrı</button>
          <button data-v="range">Aralıklara göre</button>
        </div></div>
      <div class="opt-row" id="rangeRow" style="display:none">
        <span class="opt-label">Aralıklar</span>
        <input type="text" id="splitRange" placeholder="örn: 1-3, 5, 8-10" />
        <span class="hint">Virgülle ayır; her parça ayrı PDF olur.</span>
      </div>`;
    seg('segSplit',v=>{ document.getElementById('rangeRow').style.display = v==='range'?'flex':'none'; });
  }
  else if(id==='delete'){
    optsBox.innerHTML=`<div class="opt-row"><span class="opt-label">Silinecek sayfalar</span>
      <input type="text" id="delPages" placeholder="örn: 2, 5-7, 11" />
      <span class="hint">Bu sayfalar çıkarılır, kalanlar indirilir.</span></div>`;
  }
  else if(id==='rotate'){
    optsBox.innerHTML=`
      <div class="opt-row"><span class="opt-label">Açı</span>
        <div class="seg" id="segAngle">
          <button class="on" data-v="90">90° sağa</button>
          <button data-v="180">180°</button>
          <button data-v="270">90° sola</button>
        </div></div>
      <div class="opt-row"><span class="opt-label">Kapsam</span>
        <div class="seg" id="segScope">
          <button class="on" data-v="all">Tüm sayfalar</button>
          <button data-v="some">Belirli sayfalar</button>
        </div></div>
      <div class="opt-row" id="rotPagesRow" style="display:none">
        <span class="opt-label">Sayfalar</span>
        <input type="text" id="rotPages" placeholder="örn: 1, 3-4" />
      </div>`;
    seg('segAngle'); 
    seg('segScope',v=>{ document.getElementById('rotPagesRow').style.display=v==='some'?'flex':'none'; });
  }
  else if(id==='pdf2img'){
    optsBox.innerHTML=`
      <div class="opt-row"><span class="opt-label">Biçim</span>
        <div class="seg" id="segFmt"><button class="on" data-v="jpg">JPG</button><button data-v="png">PNG</button></div></div>
      <div class="opt-row"><span class="opt-label">Çözünürlük</span>
        <div class="seg" id="segDpi"><button data-v="2">Yüksek</button><button class="on" data-v="3">Çok Yüksek</button><button data-v="4">Maksimum</button></div></div>
      <div class="opt-row"><span class="hint">Daha yüksek çözünürlük daha keskin görsel verir; dosya boyutu da artar.</span></div>`;
    seg('segFmt'); seg('segDpi');
  }
  else if(id==='compress'){
    optsBox.innerHTML=`
      <div class="opt-row"><span class="opt-label">Mod</span>
        <div class="seg" id="segMode">
          <button class="on" data-v="akilli">Akıllı (önerilen)</button>
          <button data-v="koru">Metni koru</button>
          <button data-v="max">Maksimum küçült</button>
        </div></div>
      <div class="opt-row" id="lvlRow"><span class="opt-label">Görsel kalitesi</span>
        <div class="seg" id="segLvl">
          <button data-v="high">Güçlü</button>
          <button class="on" data-v="mid">Dengeli</button>
          <button data-v="low">Hafif</button>
        </div></div>
      <div class="opt-row"><span class="hint" id="cmpHint">Akıllı mod PDF'i inceler: metin içeriyorsa metni koruyarak sıkıştırır, taranmış/görsel ağırlıklıysa güçlü sıkıştırma uygular.</span></div>`;
    seg('segMode', v=>{
      document.getElementById('lvlRow').style.display = (v==='koru')?'none':'flex';
      document.getElementById('cmpHint').textContent = {
        akilli:"Akıllı mod PDF'i inceler: metin içeriyorsa metni koruyarak sıkıştırır, taranmış/görsel ağırlıklıysa güçlü sıkıştırma uygular.",
        koru:"Metin ve yazı tipleri korunur; kullanılmayan/yinelenen veriler temizlenerek dosya yeniden paketlenir. (Boyut artmaz.)",
        max:"En küçük boyut. Sayfalar görsele dönüştürülür; metin seçilemez hale gelir (taranmış PDF'ler için idealdir)."
      }[v];
    });
    seg('segLvl');
  }
  else if(id==='pagenum'){
    optsBox.innerHTML=`
      <div class="opt-row"><span class="opt-label">Konum</span>
        <div class="seg" id="segPos"><button class="on" data-v="bc">Alt orta</button><button data-v="br">Alt sağ</button><button data-v="bl">Alt sol</button></div></div>
      <div class="opt-row"><span class="opt-label">Biçim</span>
        <div class="seg" id="segFmt2"><button class="on" data-v="n">1</button><button data-v="nslash">1 / N</button><button data-v="sayfa">Sayfa 1</button></div></div>
      <div class="opt-row"><span class="opt-label">Başlangıç no</span>
        <input type="text" id="numStart" placeholder="1" style="min-width:90px" />
        <span class="hint">İlk sayfanın numarası.</span></div>`;
    seg('segPos'); seg('segFmt2');
  }
  else if(id==='extracttext'){
    optsBox.innerHTML=`<div class="opt-row"><span class="hint">Seçilebilir metin içeren PDF'lerden çalışır. Taranmış (görüntü) PDF'lerde metin bulunamayabilir.</span></div>`;
  }
  else if(id==='reorder'){
    optsBox.innerHTML=`<div class="opt-row"><span class="hint">Dosya yükledikten sonra sayfa küçük resimlerini sürükleyerek sırala.</span></div><div class="thumbs" id="thumbs"></div>`;
  }
  else if(id==='merge'){
    optsBox.innerHTML=`<div class="opt-row"><span class="hint">Dosyaları soldaki tutamaçtan sürükleyerek sırayı değiştirebilirsin.</span></div>`;
  }
}
function seg(elId,cb){
  const box=document.getElementById(elId); if(!box) return;
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    box.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); if(cb) cb(b.dataset.v);
  });
}
function segVal(elId){ const b=document.querySelector('#'+elId+' button.on'); return b?b.dataset.v:null; }

/* ---------- Dosya girişi ---------- */
drop.onclick=()=>fileInput.click();
fileInput.onchange=e=>addFiles(e.target.files);
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',e=>{ if(e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

function addFiles(list){
  const arr=[...list].filter(f=>{
    if(current.id==='img2pdf') return f.type.startsWith('image/');
    return f.type==='application/pdf' || f.name.toLowerCase().endsWith('.pdf');
  });
  if(!arr.length){ setStatus('Uygun dosya bulunamadı.','err'); return; }
  if(!current.multiple) items=[];
  arr.forEach(f=>items.push({id:++uid,file:f,name:f.name,size:f.size}));
  renderFiles();
  if(current.id==='reorder') loadThumbs();
  setStatus('');
}

function renderFiles(){
  fileList.innerHTML='';
  items.forEach((it,idx)=>{
    const el=document.createElement('div');
    el.className='file'+(current.id==='merge'?' draggable':'');
    el.draggable = current.id==='merge';
    el.dataset.idx=idx;
    el.innerHTML=`
      ${current.id==='merge'?'<span class="grip"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg></span>':''}
      <span class="fic">${current.id==='img2pdf'?ICONS.img2pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>'}</span>
      <span class="meta"><b>${it.name}</b><small>${fmtBytes(it.size)}</small></span>
      <button class="del" data-id="${it.id}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
    fileList.appendChild(el);
  });
  fileList.querySelectorAll('.del').forEach(b=>b.onclick=()=>{
    items=items.filter(x=>x.id!=b.dataset.id); renderFiles();
    if(current.id==='reorder') loadThumbs();
  });
  if(current.id==='merge') enableFileDrag();
  runBtn.disabled = items.length===0;
}

/* ---------- Dosya sürükle-sırala (merge) ---------- */
function enableFileDrag(){
  let dragIdx=null;
  fileList.querySelectorAll('.file').forEach(el=>{
    el.addEventListener('dragstart',()=>{dragIdx=+el.dataset.idx; el.classList.add('dragging');});
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('dragover',e=>e.preventDefault());
    el.addEventListener('drop',e=>{
      e.preventDefault(); const to=+el.dataset.idx;
      if(dragIdx===null||dragIdx===to) return;
      const [m]=items.splice(dragIdx,1); items.splice(to,0,m); renderFiles();
    });
  });
}

/* ---------- Yardımcılar ---------- */
function fmtBytes(b){ if(b<1024)return b+' B'; if(b<1048576)return (b/1024).toFixed(0)+' KB'; return (b/1048576).toFixed(2)+' MB'; }
function setStatus(msg,type){
  if(!msg){ statusEl.className='status'; statusEl.innerHTML=''; return; }
  statusEl.className='status show '+(type||'work');
  const ic = type==='work'?'<span class="spinner"></span>'
    : type==='ok'?'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>';
  statusEl.innerHTML=ic+'<span>'+msg+'</span>';
}
function download(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
function baseName(n){ return n.replace(/\.[^.]+$/,''); }
/* "1-3,5,8-10" -> her parça için sayfa index dizisi (0-tabanlı) */
function parseGroups(str,max){
  const groups=[];
  str.split(',').map(s=>s.trim()).filter(Boolean).forEach(tok=>{
    const m=tok.match(/^(\d+)\s*-\s*(\d+)$/);
    if(m){ let a=+m[1],b=+m[2]; if(a>b)[a,b]=[b,a]; const g=[]; for(let i=a;i<=b;i++) if(i>=1&&i<=max)g.push(i-1); if(g.length)groups.push(g); }
    else if(/^\d+$/.test(tok)){ const p=+tok; if(p>=1&&p<=max) groups.push([p-1]); }
  });
  return groups;
}
function parseList(str,max){ // tekil sayfa indeksleri (0-tabanlı, benzersiz)
  const set=new Set(); parseGroups(str,max).forEach(g=>g.forEach(i=>set.add(i))); return [...set];
}
/* İlk N sayfadaki ortalama metin uzunluğu (akıllı sıkıştırma kararı için) */
async function avgTextPerPage(pdf,sampleMax){
  const n=Math.min(pdf.numPages,sampleMax||5); let chars=0;
  for(let i=1;i<=n;i++){
    const page=await pdf.getPage(i);
    const tc=await page.getTextContent();
    chars += tc.items.reduce((s,it)=>s+((it.str||'').trim().length),0);
  }
  return chars/n;
}

/* ---------- Reorder küçük resimleri ---------- */
async function loadThumbs(){
  const box=document.getElementById('thumbs'); if(!box) return; box.innerHTML='';
  if(!items.length){ thumbState=null; return; }
  setStatus('Sayfalar yükleniyor…','work');
  try{
    const buf=await items[0].file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;
    thumbState=[...Array(pdf.numPages).keys()]; // 0..n-1 sıralı
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const vp=page.getViewport({scale:0.4});
      const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
      await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      const t=document.createElement('div'); t.className='thumb'; t.draggable=true; t.dataset.page=i-1;
      t.appendChild(c);
      const lbl=document.createElement('div'); lbl.className='pno'; lbl.textContent='Sayfa '+i; t.appendChild(lbl);
      box.appendChild(t);
    }
    enableThumbDrag(box);
    setStatus('');
  }catch(e){ setStatus('Sayfalar yüklenemedi: '+e.message,'err'); }
}
function enableThumbDrag(box){
  let from=null;
  box.querySelectorAll('.thumb').forEach(el=>{
    el.addEventListener('dragstart',()=>{from=el;el.classList.add('dragging');});
    el.addEventListener('dragend',()=>{el.classList.remove('dragging'); recomputeOrder(box);});
    el.addEventListener('dragover',e=>{
      e.preventDefault();
      const after=[...box.querySelectorAll('.thumb:not(.dragging)')].find(c=>{
        const r=c.getBoundingClientRect(); return e.clientY<r.top+r.height/2 && e.clientX<r.right;
      });
      if(after) box.insertBefore(from,after); else box.appendChild(from);
    });
  });
}
function recomputeOrder(box){
  thumbState=[...box.querySelectorAll('.thumb')].map(t=>+t.dataset.page);
  box.querySelectorAll('.thumb .pno').forEach((p,i)=>p.textContent='Yeni '+(i+1));
}

/* ---------- ÇALIŞTIR ---------- */
runBtn.onclick=async()=>{
  if(!items.length) return;
  runBtn.disabled=true;
  try{
    await adGate();                 // ücretsiz hak bittiyse reklam
    setStatus('İşleniyor… büyük dosyalarda biraz sürebilir.','work');
    await new Promise(r=>setTimeout(r,30)); // UI nefes alsın
    await OPS[current.id]();
    countUse();
  }catch(e){
    console.error(e);
    setStatus('Bir hata oluştu: '+(e.message||e),'err');
  }finally{
    runBtn.disabled=items.length===0;
  }
};
document.getElementById('clearBtn').onclick=()=>{ items=[]; thumbState=null; renderFiles(); buildOpts(); setStatus(''); };

/* ---------- İŞLEMLER ---------- */
const OPS={
  async merge(){
    const out=await PDFDocument.create();
    for(const it of items){
      const src=await PDFDocument.load(await it.file.arrayBuffer(),{ignoreEncryption:true});
      const pages=await out.copyPages(src,src.getPageIndices());
      pages.forEach(p=>out.addPage(p));
    }
    download(new Blob([await out.save()],{type:'application/pdf'}),'pdf-creator-birlestirilmis.pdf');
    setStatus('Tamamlandı — '+items.length+' dosya birleştirildi.','ok');
  },

  async split(){
    const src=await PDFDocument.load(await items[0].file.arrayBuffer(),{ignoreEncryption:true});
    const total=src.getPageCount();
    const mode=segVal('segSplit');
    let groups;
    if(mode==='range'){
      const v=(document.getElementById('splitRange').value||'').trim();
      if(!v) throw new Error('Lütfen sayfa aralığı girin (örn: 1-3, 5).');
      groups=parseGroups(v,total);
      if(!groups.length) throw new Error('Geçerli aralık bulunamadı.');
    }else{
      groups=[...Array(total).keys()].map(i=>[i]);
    }
    const base=baseName(items[0].name);
    if(groups.length===1){
      const doc=await PDFDocument.create();
      (await doc.copyPages(src,groups[0])).forEach(p=>doc.addPage(p));
      download(new Blob([await doc.save()],{type:'application/pdf'}),`${base}-bolum.pdf`);
    }else{
      const zip=new JSZip();
      for(let g=0;g<groups.length;g++){
        const doc=await PDFDocument.create();
        (await doc.copyPages(src,groups[g])).forEach(p=>doc.addPage(p));
        zip.file(`${base}-${g+1}.pdf`,await doc.save());
      }
      download(await zip.generateAsync({type:'blob'}),`${base}-bolunmus.zip`);
    }
    setStatus(`Tamamlandı — ${groups.length} parça oluşturuldu.`,'ok');
  },

  async delete(){
    const v=(document.getElementById('delPages').value||'').trim();
    if(!v) throw new Error('Silinecek sayfaları girin (örn: 2, 5-7).');
    const src=await PDFDocument.load(await items[0].file.arrayBuffer(),{ignoreEncryption:true});
    const total=src.getPageCount();
    const remove=new Set(parseList(v,total));
    if(remove.size>=total) throw new Error('Tüm sayfaları silemezsiniz.');
    const keep=[...Array(total).keys()].filter(i=>!remove.has(i));
    const out=await PDFDocument.create();
    (await out.copyPages(src,keep)).forEach(p=>out.addPage(p));
    download(new Blob([await out.save()],{type:'application/pdf'}),`${baseName(items[0].name)}-duzenlenmis.pdf`);
    setStatus(`Tamamlandı — ${remove.size} sayfa silindi, ${keep.length} sayfa kaldı.`,'ok');
  },

  async rotate(){
    const angle=+segVal('segAngle');
    const scope=segVal('segScope');
    const src=await PDFDocument.load(await items[0].file.arrayBuffer(),{ignoreEncryption:true});
    const total=src.getPageCount();
    let targets=[...Array(total).keys()];
    if(scope==='some'){
      const v=(document.getElementById('rotPages').value||'').trim();
      if(!v) throw new Error('Döndürülecek sayfaları girin.');
      targets=parseList(v,total);
      if(!targets.length) throw new Error('Geçerli sayfa bulunamadı.');
    }
    targets.forEach(i=>{
      const pg=src.getPage(i);
      const cur=pg.getRotation().angle||0;
      pg.setRotation(degrees((cur+angle)%360));
    });
    download(new Blob([await src.save()],{type:'application/pdf'}),`${baseName(items[0].name)}-dondurulmus.pdf`);
    setStatus(`Tamamlandı — ${targets.length} sayfa ${angle}° döndürüldü.`,'ok');
  },

  async reorder(){
    if(!thumbState||!thumbState.length) throw new Error('Önce sayfaları yükleyin.');
    const src=await PDFDocument.load(await items[0].file.arrayBuffer(),{ignoreEncryption:true});
    const out=await PDFDocument.create();
    (await out.copyPages(src,thumbState)).forEach(p=>out.addPage(p));
    download(new Blob([await out.save()],{type:'application/pdf'}),`${baseName(items[0].name)}-siralanmis.pdf`);
    setStatus('Tamamlandı — yeni sıra uygulandı.','ok');
  },

  async img2pdf(){
    const out=await PDFDocument.create();
    for(const it of items){
      const bytes=await it.file.arrayBuffer();
      let img;
      if(it.file.type.includes('png')) img=await out.embedPng(bytes);
      else img=await out.embedJpg(bytes);
      const page=out.addPage([img.width,img.height]);
      page.drawImage(img,{x:0,y:0,width:img.width,height:img.height});
    }
    download(new Blob([await out.save()],{type:'application/pdf'}),'pdf-creator-resimden.pdf');
    setStatus(`Tamamlandı — ${items.length} görsel PDF\'e dönüştürüldü.`,'ok');
  },

  async pdf2img(){
    const fmt=segVal('segFmt'); const scale=+segVal('segDpi');
    const buf=await items[0].file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;
    const base=baseName(items[0].name);
    const mime=fmt==='png'?'image/png':'image/jpeg';
    const ext=fmt==='png'?'png':'jpg';
    const zip=new JSZip();
    for(let i=1;i<=pdf.numPages;i++){
      setStatus(`Sayfa ${i}/${pdf.numPages} işleniyor…`,'work');
      const page=await pdf.getPage(i);
      const vp=page.getViewport({scale:scale*1.5});
      const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
      const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
      if(fmt==='jpg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);}
      await page.render({canvasContext:ctx,viewport:vp,intent:'print'}).promise;
      const blob=await new Promise(r=>c.toBlob(r,mime, fmt==='png'?undefined:0.96));
      zip.file(`${base}-${String(i).padStart(3,'0')}.${ext}`,blob);
    }
    if(pdf.numPages===1){
      const only=Object.values(zip.files)[0];
      download(await only.async('blob'),`${base}.${ext}`);
    }else{
      download(await zip.generateAsync({type:'blob'}),`${base}-resimler.zip`);
    }
    setStatus(`Tamamlandı — ${pdf.numPages} sayfa ${ext.toUpperCase()} olarak indirildi.`,'ok');
  },

  async compress(){
    const mode=segVal('segMode')||'akilli';
    const lvl=segVal('segLvl')||'mid';
    const conf={high:{s:1.0,q:0.5},mid:{s:1.4,q:0.65},low:{s:2.0,q:0.8}}[lvl];
    const origBuf=await items[0].file.arrayBuffer();
    const origSize=items[0].size;
    const base=baseName(items[0].name);

    // Akıllı mod: PDF metin içeriyor mu diye bak, kararı ver
    let decide=mode;
    if(mode==='akilli'){
      setStatus('PDF içeriği inceleniyor…','work');
      const probe=await pdfjsLib.getDocument({data:origBuf.slice(0)}).promise;
      const avg=await avgTextPerPage(probe,5);
      decide = avg>=80 ? 'koru' : 'max';   // sayfa başına anlamlı metin varsa metni koru
    }

    let outBytes;
    if(decide==='koru'){
      // Metni koruyan sıkıştırma: sayfaları temiz bir belgeye kopyalar,
      // kullanılmayan nesneleri/eski revizyonları atar, nesne akışıyla paketler.
      setStatus('Metin korunarak yeniden paketleniyor…','work');
      const src=await PDFDocument.load(origBuf,{ignoreEncryption:true,updateMetadata:false});
      const out=await PDFDocument.create();
      const pages=await out.copyPages(src,src.getPageIndices());
      pages.forEach(p=>out.addPage(p));
      outBytes=await out.save({useObjectStreams:true});
    }else{
      // Maksimum küçültme: sayfaları görsele çevirir (taranmış PDF'ler için)
      const pdf=await pdfjsLib.getDocument({data:origBuf.slice(0)}).promise;
      const out=await PDFDocument.create();
      for(let i=1;i<=pdf.numPages;i++){
        setStatus(`Sayfa ${i}/${pdf.numPages} sıkıştırılıyor…`,'work');
        const page=await pdf.getPage(i);
        const vpPt=page.getViewport({scale:1});
        const vp=page.getViewport({scale:conf.s});
        const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
        const ctx=c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
        await page.render({canvasContext:ctx,viewport:vp}).promise;
        const jpgBlob=await new Promise(r=>c.toBlob(r,'image/jpeg',conf.q));
        const img=await out.embedJpg(await jpgBlob.arrayBuffer());
        const p=out.addPage([vpPt.width,vpPt.height]);
        p.drawImage(img,{x:0,y:0,width:vpPt.width,height:vpPt.height});
      }
      outBytes=await out.save();
    }

    // Sonuç orijinalden büyükse (metni koru modunda olabilir) orijinali ver — kullanıcı asla daha büyük dosya almasın
    let finalBytes=outBytes, finalSize=outBytes.byteLength, fellBack=false;
    if(finalSize>=origSize && decide==='koru'){
      finalBytes=new Uint8Array(origBuf); finalSize=origSize; fellBack=true;
    }

    download(new Blob([finalBytes],{type:'application/pdf'}),`${base}-sikistirilmis.pdf`);
    const pct=Math.round((1-finalSize/origSize)*100);
    if(decide==='koru'){
      if(fellBack)
        setStatus(`Tamamlandı — dosya zaten optimize (${fmtBytes(origSize)}). Metin korundu. Daha fazla küçültmek için "Maksimum küçült" modunu deneyebilirsiniz (metin görsele dönüşür).`,'ok');
      else
        setStatus(`Tamamlandı — ${fmtBytes(origSize)} → ${fmtBytes(finalSize)} (%${pct} küçüldü). Metin ve yazı tipleri korundu.`,'ok');
    }else{
      if(finalSize<origSize)
        setStatus(`Tamamlandı — ${fmtBytes(origSize)} → ${fmtBytes(finalSize)} (%${pct} küçüldü).`,'ok');
      else
        setStatus(`Tamamlandı — boyut: ${fmtBytes(finalSize)}. Bu dosya zaten iyi sıkıştırılmış; daha güçlü kaliteyi deneyin.`,'ok');
    }
  },
  async pagenum(){
    const pos=segVal("segPos")||"bc";
    const fmt=segVal("segFmt2")||"n";
    const startEl=document.getElementById("numStart");
    const start=Math.max(1, parseInt((startEl&&startEl.value)||"1",10)||1);
    const src=await PDFDocument.load(await items[0].file.arrayBuffer(),{ignoreEncryption:true});
    const font=await src.embedFont(StandardFonts.Helvetica);
    const pages=src.getPages(); const total=pages.length;
    pages.forEach((pg,idx)=>{
      const n=start+idx;
      const txt = fmt==="nslash" ? (n+" / "+(start+total-1)) : fmt==="sayfa" ? ("Sayfa "+n) : (""+n);
      const size=11; const tw=font.widthOfTextAtSize(txt,size);
      const sz=pg.getSize(); const m=26;
      const x = pos==="br" ? sz.width-m-tw : pos==="bl" ? m : (sz.width-tw)/2;
      pg.drawText(txt,{x:x,y:m,size:size,font:font,color:rgb(0.12,0.16,0.24)});
    });
    download(new Blob([await src.save()],{type:"application/pdf"}),baseName(items[0].name)+"-numarali.pdf");
    setStatus("Tamamlandı — "+total+" sayfaya numara eklendi.","ok");
  },
  async extracttext(){
    const buf=await items[0].file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;
    let out=""; let hasText=false;
    for(let i=1;i<=pdf.numPages;i++){
      setStatus("Sayfa "+i+"/"+pdf.numPages+" okunuyor…","work");
      const page=await pdf.getPage(i);
      const tc=await page.getTextContent();
      const txt=tc.items.map(function(it){return it.str;}).join(" ").replace(/\s+/g," ").trim();
      if(txt) hasText=true;
      out += "--- Sayfa "+i+" ---\n"+txt+"\n\n";
    }
    if(!hasText){ setStatus("Bu PDF taranmış görüntü olabilir; seçilebilir metin bulunamadı.","err"); return; }
    download(new Blob([out],{type:"text/plain;charset=utf-8"}),baseName(items[0].name)+".txt");
    setStatus("Tamamlandı — "+pdf.numPages+" sayfadan metin çıkarıldı.","ok");
  }
};

refreshUseLabel();


/* ---------- Çerez onayı + AdSense yükleyici ---------- */
(function(){
  var ADS_CLIENT='ca-pub-XXXXXXXXXXXXXXXX'; /* <-- kendi AdSense yayıncı kimliğiniz */
  var KEY='pdfcreator_consent';
  function loadAds(personalized){
    if(window.__adsLoaded) return; window.__adsLoaded=true;
    window.adsbygoogle=window.adsbygoogle||[];
    if(!personalized){ window.adsbygoogle.requestNonPersonalizedAds=1; }
    var s=document.createElement('script'); s.async=true; s.setAttribute('crossorigin','anonymous');
    s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+ADS_CLIENT;
    document.head.appendChild(s);
  }
  window.__loadAds=loadAds;
  var saved=null; try{ saved=localStorage.getItem(KEY); }catch(e){}
  if(saved==='all'){ loadAds(true); return; }
  if(saved==='none'){ return; }
  var bar=document.getElementById('cookie'); if(!bar) return;
  bar.classList.add('show');
  function choose(v){ try{ localStorage.setItem(KEY,v); }catch(e){} bar.classList.remove('show'); if(v==='all') loadAds(true); }
  var a=document.getElementById('ckAll'), n=document.getElementById('ckNo');
  if(a) a.onclick=function(){ choose('all'); };
  if(n) n.onclick=function(){ choose('none'); };
})();

/* ---------- Hero demo (otomatik akan önizleme) ---------- */
(function(){
  var stage=document.getElementById('demoStage');
  if(!stage) return;
  var scenes=[].slice.call(stage.querySelectorAll('.scene'));
  var menu=document.getElementById('demoMenu');
  var items=[].slice.call(menu.querySelectorAll('.di'));
  var cursor=document.getElementById('demoCursor');
  var fill=document.getElementById('demoFill');
  var i=-1, DUR=3600;
  function go(n){
    i=n;
    scenes.forEach(function(s,j){ s.classList.toggle('active', j===n); });
    items.forEach(function(it,j){ it.classList.toggle('on', j===n); });
    var it=items[n];
    var y=it.offsetTop + it.offsetHeight/2 - 9;
    cursor.style.transform='translateY('+y+'px)';
    fill.style.transition='none'; fill.style.width='0%';
    void fill.offsetWidth;
    fill.style.transition='width '+(DUR-200)+'ms linear'; fill.style.width='100%';
  }
  go(0);
  setInterval(function(){ go((i+1)%scenes.length); }, DUR);
})();

/* ---------- Bülten (örnek; gerçek e-posta servisine bağlanmalı) ---------- */
(function(){
  var b=document.getElementById('newsBtn'), e=document.getElementById('newsEmail');
  if(!b||!e) return;
  b.addEventListener('click',function(){
    var v=(e.value||'').trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){ e.style.borderColor='#EC1C2E'; return; }
    e.value=''; e.placeholder='Teşekkürler! Kaydedildi ✓'; e.style.borderColor='#16A34A';
  });
})();
