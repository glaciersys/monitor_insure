    const firebaseConfig = {
      apiKey: "AIzaSyD2Y6Z2LccVU-u6CCl7iGAQ698ejFZv-GI",
      authDomain: "insuresys-839eb.firebaseapp.com",
      projectId: "insuresys-839eb",
      storageBucket: "insuresys-839eb.firebasestorage.app",
      messagingSenderId: "552221076933",
      appId: "1:552221076933:web:5f11a527490ec5cc73efac"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const storage = firebase.storage();

    // เปิดใช้งาน Firestore offline persistence — ให้แอปอ่านข้อมูลลูกค้าที่เคยโหลดแล้วได้แม้ไม่มีเน็ต
    // synchronizeTabs:true กันปัญหากรณีเปิดแอปหลายแท็บพร้อมกัน
    db.enablePersistence({ synchronizeTabs: true }).catch(function(err){
      if(err.code === 'failed-precondition'){
        console.warn('Firestore persistence: เปิดได้แค่ตัวเดียวต่อ origin ในบาง browser เก่า');
      } else if(err.code === 'unimplemented'){
        console.warn('Firestore persistence: browser นี้ไม่รองรับ');
      } else {
        console.warn('Firestore persistence error:', err);
      }
    });

    // ====== FIRESTORE API (compat) ======

    window.fsLoadAll = function(){
      return Promise.all([
        db.collection('customers').orderBy('createdAt','desc').get(),
        db.collection('settings').doc('main').get()
      ]).then(function(results){
        var snap=results[0], setSnap=results[1];
        var custs=snap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var s=setSnap.exists?setSnap.data():{};
        return {customers:custs,insTypes:s.insTypes||[],insCos:s.insCos||[],brands:s.brands||[],models:s.models||{},prefixes:s.prefixes||[]};
      });
    };

    window.fsAddCustomer = function(data){
      var d=Object.assign({},data,{createdAt:Date.now()}); delete d.id;
      return db.collection('customers').add(d).then(function(ref){return {success:true,id:ref.id};});
    };

    window.fsUpdateCustomer = function(data){
      var id=data.id; var d=Object.assign({},data); delete d.id;
      return db.collection('customers').doc(id).update(d).then(function(){return {success:true};});
    };

    window.fsDeleteCustomer = function(id){
      return db.collection('customers').doc(id).delete().then(function(){return {success:true};});
    };

    window.fsGetHistory = function(custId){
      return db.collection('history').where('custId','==',custId).orderBy('createdAt','desc').get()
        .then(function(snap){return snap.docs.map(function(d){return Object.assign({_docId:d.id},d.data());});});
    };

    window.fsAddHistory = function(data){
      return db.collection('history').add(Object.assign({},data,{createdAt:Date.now()})).then(function(){return {success:true};});
    };

    window.fsUpdateHistory = function(data){
      var docId=data._docId; var d=Object.assign({},data); delete d._docId; delete d.idx;
      return db.collection('history').doc(docId).update(d).then(function(){return {success:true};});
    };

    window.fsDeleteHistory = function(custId,idx){
      var h=window._histData&&window._histData[idx];
      if(h&&h._docId)return db.collection('history').doc(h._docId).delete().then(function(){return {success:true};});
      return Promise.resolve({success:true});
    };

    window.fsUpdateSettings = function(settingsData){
      return db.collection('settings').doc('main').set(settingsData,{merge:true}).then(function(){return {success:true};});
    };

    // boot — รอให้ DOM และ JS หลักพร้อมก่อน
    function fsBoot(){
      var ovLoad=document.getElementById('ov-loading');
      if(ovLoad)ovLoad.classList.add('open');
      window.fsLoadAll().then(function(d){
        window._setCustomers(d.customers);
        window._setInsTypes(d.insTypes);
        window._setInsCos(d.insCos);
        window._setBrands(d.brands);
        window._setModels(d.models);
        window._setPrefixes(d.prefixes);
        customers=window._getCustomers();insTypes=window._getInsTypes();insCos=window._getInsCos();
        brands=window._getBrands();models=window._getModels();prefixes=window._getPrefixes();
        window.fillSelects&&window.fillSelects();
        window.updateStats&&window.updateStats();
        window.doFilter&&window.doFilter();
        if(ovLoad)ovLoad.classList.remove('open');
        document.body.focus();
      }).catch(function(e){
        if(ovLoad)ovLoad.classList.remove('open');
        window.toast&&window.toast('โหลดข้อมูลล้มเหลว: '+e.message,'error');
        console.error('Boot error:',e);
      });
    }
    // รอ DOM ready
    // fsBoot จะถูกเรียกจาก unlockApp() หลัง login สำเร็จ หรือถ้ามี session แล้ว
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',function(){
        if(sessionStorage.getItem('ins_auth_'+(new Date().toDateString()))==='ok'){fsBoot();}
      });
    } else {
      if(sessionStorage.getItem('ins_auth_'+(new Date().toDateString()))==='ok'){setTimeout(fsBoot,0);}
    }
function ovShow(id){
  document.getElementById(id).classList.add('open');
  // push state เพื่อให้ Back button ปิด modal แทนออกจากหน้า
  history.pushState({modal:id},'','');
}
function ovHide(id){
  document.getElementById(id).classList.remove('open');
}
function ovIsOpen(id){return document.getElementById(id).classList.contains('open');}
// รายชื่อ overlay ทั้งหมดในแอป — ใช้เป็น allowlist กลางจุดเดียว กัน keyboard/scroll ของรายการหลัก
// ไม่ให้ทะลุออกไปเวลามี overlay ไหนก็ตามเปิดอยู่ (เพิ่ม id ใหม่ที่นี่ทีเดียวพอ ไม่ต้องไล่แก้หลายจุด)
var ALL_OVERLAY_IDS=['ov-confirm','ov-form','ov-detail','ov-renew','ov-dash','ov-payment','ov-pay-form','ov-report','ov-settings'];
function anyModalOpen(){
  return ALL_OVERLAY_IDS.some(function(id){return ovIsOpen(id);});
}
// หา element ที่ scroll ได้จริงภายใน overlay ที่เปิดอยู่ตอนนี้ — ใช้ร่วมกันทั้ง wheel และ keyboard Up/Down
function getOpenOverlayScrollEl(){
  var openId=ALL_OVERLAY_IDS.find(function(id){return ovIsOpen(id);});
  if(!openId)return null;
  var ov=document.getElementById(openId);
  if(!ov)return null;
  // เช็คตัว .modal เองก่อน (ส่วนใหญ่ scroll ตรงนี้)
  var modal=ov.querySelector('.modal');
  if(modal && modal.scrollHeight>modal.clientHeight+2)return modal;
  // ถ้า .modal เองไม่ scroll (เช่น ov-payment/ov-pay-form ที่เป็น flex layout)
  // หา descendant ตัวแรกที่ scroll ได้จริงและกำลังแสดงอยู่ (ไม่ใช่ display:none)
  var all=ov.querySelectorAll('*');
  for(var i=0;i<all.length;i++){
    var el=all[i];
    if(el.offsetParent===null)continue; // ไม่ได้แสดงอยู่
    if(el.scrollHeight>el.clientHeight+2){
      var st=getComputedStyle(el);
      if(st.overflowY==='auto'||st.overflowY==='scroll')return el;
    }
  }
  return modal||ov;
}

window.toast=function toast(msg,type){
  var t=document.getElementById('toast');
  t.textContent=msg;t.className=type||'success';t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},3000);
}

// FORMAT
function fmtDate(d){
  if(!d||d===''||d==='-')return '-';
  try{var p=d.split('-');if(p.length!==3)return d;var y=parseInt(p[0],10);if(isNaN(y))return d;var be=(y>2400)?y:y+543;return p[2]+'/'+p[1]+'/'+String(be).slice(-2);}catch(e){return d;}
}
function fmtNumRpt(n){
  var v=parseFloat(String(n===null||n===undefined?'0':n).replace(/,/g,''));
  if(isNaN(v))v=0;
  // ถ้าเป็นจำนวนเต็ม ไม่แสดง .00
  if(v===Math.floor(v))return v.toLocaleString('th-TH',{minimumFractionDigits:0,maximumFractionDigits:0});
  return v.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtNum(n){
  var v=parseFloat(String(n===null||n===undefined?'0':n).replace(/,/g,''));
  if(isNaN(v))v=0;
  return v.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function getNum(id){var v=parseFloat((document.getElementById(id).value||'0').replace(/,/g,''));return isNaN(v)?0:v;}
function numFmt(el){
  var raw=el.value.replace(/[^0-9.]/g,'');if(!raw){el.value='';return;}
  var pts=raw.split('.');pts[0]=pts[0].replace(/(\d)(?=(\d{3})+$)/g,'$1,');
  el.value=pts.length>1?pts[0]+'.'+pts[1]:pts[0];
}
function setNum(id,n){var v=parseFloat(String(n===null||n===undefined?'0':n).replace(/,/g,''));document.getElementById(id).value=(isNaN(v)||v===0)?'':fmtNum(v);}
// แปลง auto-format DD/MM/YYYY ขณะพิมพ์
function fmtDateInput(el){
  var v=el.value.replace(/[^0-9]/g,'');
  if(v.length>2) v=v.slice(0,2)+'/'+v.slice(2);
  if(v.length>5) v=v.slice(0,5)+'/'+v.slice(5);
  if(v.length>10) v=v.slice(0,10);
  el.value=v;
  // trigger onchange เมื่อพิมพ์ครบ
  if(v.length===10) el.dispatchEvent(new Event('change',{bubbles:true}));
}
// แปลง DD/MM/YYYY(BE) → YYYY-MM-DD(CE) สำหรับเก็บข้อมูล
function beToISO(val){
  if(!val)return '';
  if(val.indexOf('-')!==-1)return val; // ISO already
  var p=val.split('/');
  if(p.length!==3||p[2].length!==4)return '';
  var yr=parseInt(p[2],10);
  var ce=yr>2400?yr-543:yr;
  return ce+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0');
}
// แปลง YYYY-MM-DD(CE) → DD/MM/YYYY(BE) สำหรับแสดงผล
function isoToBE(val){
  if(!val)return '';
  if(val.indexOf('/')!==-1)return val; // already BE format
  var p=val.split('-');
  if(p.length!==3)return '';
  var yr=parseInt(p[0],10);
  var be=yr>2400?yr:yr+543; // ป้องกัน double-add ถ้าเป็น พ.ศ. อยู่แล้ว
  return p[2]+'/'+p[1]+'/'+be;
}
function showYD(inputId,dispId){
  var val=document.getElementById(inputId).value;var el=document.getElementById(dispId);if(!el)return;
  if(!val){el.textContent='';return;}
  var iso=beToISO(val);
  if(!iso){el.textContent='';return;}
  var p=iso.split('-');var be=parseInt(p[0],10)+543;
  el.textContent=p[2]+'/'+p[1]+'/'+String(be).slice(-2)+' (พ.ศ.'+be+')';
}
function autoCalcStatus(){
  var ed=beToISO(document.getElementById('fed').value);
  if(!ed)return;
  var dl=daysLeft(ed);
  var st='active';
  if(dl===null||dl<0)st='cancel';
  else if(dl<=90)st='expire';
  document.getElementById('fst').value=st;
  updateStatusDisplay(st);
}
function onStartDate(){
  showYD('fsd','fsd-d');
  var s=document.getElementById('fsd').value;if(!s)return;
  var iso=beToISO(s);if(!iso)return;
  var p=iso.split('-');
  var endISO=(+p[0]+1)+'-'+p[1]+'-'+p[2];
  document.getElementById('fed').value=isoToBE(endISO);
  showYD('fed','fed-d');autoCalcStatus();
}
function onHStartDate(){
  showYD('hsd','hsd-d');var s=document.getElementById('hsd').value;if(!s)return;
  var p=s.split('-');document.getElementById('hed').value=(+p[0]+1)+'-'+p[1]+'-'+p[2];showYD('hed','hed-d');
}
function daysLeft(d){
  if(!d||d==='-'||d==='')return null;
  try{var p=d.split('-');if(p.length!==3)return null;var y=parseInt(p[0],10);var adY=(y>2400)?y-543:y;var t=new Date();t.setHours(0,0,0,0);var e=new Date(adY+'-'+p[1]+'-'+p[2]);e.setHours(0,0,0,0);if(isNaN(e.getTime()))return null;return Math.ceil((e-t)/86400000);}catch(ex){return null;}
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function hl(txt,q){if(!q||!txt)return esc(txt);var re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');return esc(txt).replace(re,'<mark>$1</mark>');}
function typeBadge(t){
  if(!t)return '<span class="badge badge-t0">-</span>';
  var s=t.toLowerCase();
  var style='';
  // กำหนดสีตาม keyword
  if(s.indexOf('1')>=0&&s.indexOf('2')<0&&s.indexOf('3')<0){
    style='background:#dbeafe;color:#1e3a8a;border:1px solid #93c5fd'; // ชั้น 1 - น้ำเงิน
  } else if(s.indexOf('2+')>=0||s.indexOf('2p')>=0){
    style='background:#ede9fe;color:#4c1d95;border:1px solid #c4b5fd'; // ชั้น 2+ - ม่วงเข้ม
  } else if(s.indexOf('2')>=0){
    style='background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe'; // ชั้น 2 - ม่วง
  } else if(s.indexOf('3+')>=0||s.indexOf('3p')>=0){
    style='background:#fef9c3;color:#854d0e;border:1px solid #fde047'; // ชั้น 3+ - เหลืองเข้ม
  } else if(s.indexOf('3')>=0){
    style='background:#d1fae5;color:#065f46;border:1px solid #6ee7b7'; // ชั้น 3 - เขียว
  } else if(s.indexOf('พรบ')>=0||s.indexOf('prb')>=0){
    style='background:#fee2e2;color:#991b1b;border:1px solid #fca5a5'; // พรบ - แดง
  } else if(s.indexOf('pa')>=0||s.indexOf('อุบัติ')>=0){
    style='background:#ffedd5;color:#9a3412;border:1px solid #fdba74'; // PA - ส้ม
  } else {
    // ไม่ตรง keyword ใด — ใช้สีวนตาม index
    var cls=['background:#dbeafe;color:#1e40af','background:#ede9fe;color:#5b21b6','background:#d1fae5;color:#065f46','background:#ffedd5;color:#9a3412','background:#fce7f3;color:#9d174d','background:#e0f2fe;color:#075985'];
    var i=insTypes.indexOf(t);
    style=cls[i%cls.length]||cls[0];
  }
  return '<span class="badge" style="'+style+';font-weight:600">'+esc(t)+'</span>';
}
function statusBadge(c){var s=c.status;var dl=daysLeft(c.end);if(s==='cancel')return '<span class="badge badge-cancel">✕ ยกเลิกแล้ว</span>';if(dl!==null&&dl<0)return '<span class="badge badge-ended">⏹ สิ้นสุดแล้ว</span>';if(dl!==null&&dl>=0&&dl<=90)return '<span class="badge badge-expire">⚠ ใกล้หมดอายุ</span>';return '<span class="badge badge-active">✓ คุ้มครองอยู่</span>';}
function sortArr(arr){return arr.slice().sort(function(a,b){return a.localeCompare(b,'th');});}
function fullName(c){return (c.prefix?c.prefix+' ':'')+[c.firstname,c.lastname].filter(Boolean).join(' ')||c.name||'';}
function stripPrefix(name){
  name=(name||'').trim();
  for(var i=0;i<prefixes.length;i++){
    var p=prefixes[i];
    if(p&&name.indexOf(p+' ')===0)return name.slice(p.length+1).trim();
  }
  return name;
}

// STATS
var expireFilterOn=false;
window.updateStats=function updateStats(){
  var tot=customers.length;
  var act=customers.filter(function(c){var dl=daysLeft(c.end);return c.status==='active'&&!(dl!==null&&dl>=0&&dl<=90);}).length;
  var exp=customers.filter(function(c){if(c.status==='cancel')return false;var d=daysLeft(c.end);return d!==null&&d<=90&&d>=0;}).length;
  var pr=customers.filter(function(c){return c.status!=='cancel';}).reduce(function(a,c){return a+Number(c.premium||0);},0);
  var cv=customers.filter(function(c){return c.status!=='cancel';}).reduce(function(a,c){return a+Number(c.coverage||0);},0);
  document.getElementById('stats-row').innerHTML='';
  var expBtn=document.getElementById('expire-btn');
  if(expBtn){
    expBtn.innerHTML='⚠️ <b>'+exp+'</b> ราย';
    expBtn.style.background=expireFilterOn?'#fbbf24':'#fef3c7';
    expBtn.style.color=expireFilterOn?'#78350f':'#92400e';
    expBtn.style.border=expireFilterOn?'2px solid #f59e0b':'1px solid #fcd34d';
  }
}
function toggleExpFilter(){
  expireFilterOn=!expireFilterOn;
  updateStats();doFilter(); // doFilter จะ sort ใกล้หมดก่อนให้เอง
}

// FILTER
function openHistory(id){
  // เปิด detail modal แล้วสลับไปแท็บประวัติทันที
  openDetail(id);
  setTimeout(function(){switchTab('hist');},100);
}

function copyCustomerToForm(id){
  var c=customers.find(function(x){return x.id===id;});
  if(!c){toast('ไม่พบข้อมูลลูกค้า','error');return;}
  // เปิดฟอร์มเพิ่มใหม่ (ไม่ใช่ editId)
  editId=null;
  document.getElementById('form-title').textContent='➕ คัดลอกข้อมูลจาก '+fullName(c);
  fillSelects();
  ['px','type','co','br','mo'].forEach(function(k){inHide(k);});
  // set ค่าทุกช่อง (ไม่รวม id)
  document.getElementById('fpx').value=c.prefix||'';
  document.getElementById('ffn').value=c.firstname||'';
  document.getElementById('fln').value=c.lastname||'';
  document.getElementById('fph').value=c.phone||'';
  document.getElementById('fad').value=c.address||'';
  document.getElementById('fpl').value=c.plate||'';
  document.getElementById('fco').value=c.insco||'';
  document.getElementById('fbr').value=c.brand||'';onBrand();
  document.getElementById('fmo').value=c.model||'';
  document.getElementById('fyr').value=c.caryear||'';
  document.getElementById('fty').value=insTypes.length?sortArr(insTypes)[0]:'';
  document.getElementById('fpr').value='';
  document.getElementById('fcv').value='';
  document.getElementById('fsd').value=isoToBE(c.start||'');
  document.getElementById('fed').value=isoToBE(c.end||'');
  document.getElementById('fst').value=c.status||'active';
  document.getElementById('fno').value=c.note||'';
  showYD('fsd','fsd-d');showYD('fed','fed-d');
  document.getElementById('fsd-d').textContent='';
  document.getElementById('fed-d').textContent='';
  // ล้างวันที่ให้กรอกใหม่
  document.getElementById('fsd').value='';
  document.getElementById('fed').value='';
  resetDirty();
  ovShow('ov-form');
  setTimeout(function(){document.getElementById('ffn').focus();},50);
  toast('📋 คัดลอกข้อมูล '+fullName(c)+' แล้ว — กรุณากรอกวันที่ใหม่');
}

// ตรวจว่าฟอร์มมีการแก้ไขหรือไม่
var formDirty=false;
function setDirty(){formDirty=true;}
function resetDirty(){formDirty=false;}

function confirmClose(callback){
  if(!formDirty){callback();return;}
  showConfirm('⚠️','ยังไม่ได้บันทึก','ต้องการออกโดยไม่บันทึกหรือไม่?','ข้อมูลที่กรอกจะหายไปทั้งหมด','','YES ออกเลย',function(){
    resetDirty();callback();
  });
  // เปลี่ยน NO button เป็น "NO อยู่ต่อ"
  setTimeout(function(){
    var nb=document.getElementById('cf-no');
    if(nb)nb.textContent='NO อยู่ต่อ';
  },10);
}

function updateStatusDisplay(val){
  var map={active:'✓ คุ้มครองอยู่',expire:'⚠ ใกล้หมดอายุ',cancel:'✕ ยกเลิกแล้ว'};
  var colors={active:'#166534',expire:'#92400e',cancel:'#991b1b'};
  var bg={active:'#dcfce7',expire:'#fef3c7',cancel:'#fee2e2'};
  var el=document.getElementById('fst-display');
  if(!el)return;
  el.textContent=map[val]||val;
  el.style.color=colors[val]||'#475569';
  el.style.background=bg[val]||'#f8fafc';
  el.style.fontWeight='500';
}

function clearSearch(){
  var qi=document.getElementById('q');
  qi.value='';
  document.getElementById('q-clear').style.display='none';
  doFilter();
  qi.blur();
  document.body.focus();
}
function toggleClearBtn(){
  var v=document.getElementById('q').value;
  document.getElementById('q-clear').style.display=v?'block':'none';
}
window.doFilter=function doFilter(){
  var q=document.getElementById('q').value.trim().toLowerCase();
  var fs='';var ftp=document.getElementById('ft').value;
  filtered=customers.filter(function(c){
    var nm=fullName(c);
    var mq=!q||[nm,c.phone,c.plate,c.id,c.brand,c.model,c.insco,c.address,c.firstname,c.lastname].some(function(v){return v&&String(v).toLowerCase().indexOf(q)>=0;});
    var dl=daysLeft(c.end);var effS=c.status;if(c.status==='active'&&dl!==null&&dl>=0&&dl<=90)effS='expire';
    var ms=!fs||effS===fs;var mt=!ftp||c.type===ftp;
    var me=!expireFilterOn||(function(){if(c.status==='cancel')return false;return dl!==null&&dl<=90&&dl>=0;})();
    return mq&&ms&&mt&&me;
  });
  dispCount=batchSize;selIdx=-1;
  // เรียงตามชื่อ ก-ฮ เสมอ ถ้าไม่ได้กด expire filter
  if(expireFilterOn){
    // เรียงตามวันที่เหลือ จากน้อยไปมาก (ใกล้หมดก่อน)
    filtered.sort(function(a,b){
      var da=daysLeft(a.end);var db=daysLeft(b.end);
      if(da===null&&db===null)return 0;
      if(da===null)return 1;if(db===null)return -1;
      return da-db;
    });
  } else {
    filtered.sort(function(a,b){
      var na=(a.firstname||a.name||'').trim();
      var nb=(b.firstname||b.name||'').trim();
      return na.localeCompare(nb,'th');
    });
  }
  renderTable();
}

// TABLE
function renderTable(){
  var q=document.getElementById('q').value.trim().toLowerCase();
  var pg=filtered.slice(0,dispCount);
  var tb=document.getElementById('tbody');
  if(!pg.length){tb.innerHTML='<tr><td colspan="11"><div class="empty-state"><div style="font-size:32px;margin-bottom:6px">🔍</div>ไม่พบข้อมูล</div></td></tr>';}
  else{
    tb.innerHTML=pg.map(function(c,i){
      var nm=fullName(c);
      var car=[c.brand,c.model,c.caryear?'ปี ค.ศ.'+c.caryear:''].filter(Boolean).join(' ');
      var dl=daysLeft(c.end);
      var dlTag=(dl!==null&&dl>=0&&dl<=90)?'<span style="font-size:10px;color:#92400e;background:#fef3c7;padding:1px 4px;border-radius:3px;margin-left:3px">เหลือ '+dl+' วัน</span>':'';
      return '<tr data-id="'+c.id+'" data-i="'+i+'" onclick="rowClick('+i+',\''+c.id+'\')">'+
        /* รหัสซ่อน */
        '<td><div class="td-name">'+hl(nm,q)+'</div>'+(car?'<div class="td-sub">'+hl(car,q)+'</div>':'')+
        '<div class="mobile-sub">'+'<span>'+hl(c.insco||'-',q)+'</span>'+'<span>· <span class="ms-val">'+fmtDate(c.end)+'</span></span>'+(dl!==null&&dl>=0&&dl<=90?'<span style="color:#92400e">เหลือ '+dl+' วัน</span>':'')+
        '<span>เบี้ย <span class="ms-val">'+fmtNum(c.premium)+'</span></span>'+'<span>ทุน <span class="ms-val">'+fmtNum(c.coverage)+'</span></span>'+'</div>'+'</td>'+
        '<td class="hide-mobile">'+hl(c.phone,q)+'</td>'+
        '<td style="font-weight:500">'+hl(c.plate,q)+'</td>'+
        '<td>'+typeBadge(c.type)+'</td>'+
        '<td class="hide-mobile" style="font-size:11px">'+hl(c.insco,q)+'</td>'+
        '<td>'+statusBadge(c)+'</td>'+
        '<td class="hide-mobile" style="font-size:11px">'+fmtDate(c.end)+dlTag+'</td>'+
        '<td class="hide-mobile" style="font-size:11px;text-align:right;padding-right:10px">'+fmtNum(c.premium)+'</td>'+
        '<td class="hide-mobile" style="font-size:11px;text-align:right;padding-right:10px">'+fmtNum(c.coverage)+'</td>'+
        '<td><div class="actions"><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();openForm(\''+c.id+'\')">✏️</button><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();openHistory(\''+c.id+'\')">📜</button><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();askDel(\''+c.id+'\')">🗑️</button></div></td>'+
      '</tr>';
    }).join('');
  }
  var shown=Math.min(dispCount,filtered.length);
  var hasMore=shown<filtered.length;
  document.getElementById('pg-info').textContent=filtered.length?'แสดง '+shown+' จาก '+filtered.length+' รายการ':'ไม่พบข้อมูล';
  document.getElementById('pg-info2').textContent=hasMore?'⬇ เลื่อนลงเพื่อดูเพิ่ม':'';
  // แสดง/ซ่อนปุ่มโหลดเพิ่ม
  var lmw=document.getElementById('load-more-wrap');
  if(lmw)lmw.style.display=hasMore?'block':'none';
  hilite();
}
function loadMore(){
  dispCount=Math.min(dispCount+batchSize,filtered.length);
  renderTable();
  // scroll ลงหาปุ่มใหม่
  var lmw=document.getElementById('load-more-wrap');
  if(lmw)lmw.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function rowClick(i,id){selIdx=i;hilite('select');openDetail(id);}
function hilite(mode){
  document.querySelectorAll('#tbody tr[data-id]').forEach(function(tr){
    var isThis=+tr.dataset.i===selIdx;
    tr.classList.toggle('row-selected', isThis&&mode!=='delete');
    tr.classList.toggle('row-delete', isThis&&mode==='delete');
  });
}
function getSel(){return filtered[selIdx]||null;}

// SCROLL WHEEL บนตาราง
document.addEventListener('DOMContentLoaded',function(){
  // Infinite scroll — IntersectionObserver (desktop+mobile)
  var sentinel=document.getElementById('scroll-sentinel');
  if(sentinel&&'IntersectionObserver' in window){
    var observer=new IntersectionObserver(function(entries){
      if(entries[0].isIntersecting&&dispCount<filtered.length){
        dispCount=Math.min(dispCount+batchSize,filtered.length);
        renderTable();
      }
    },{rootMargin:'100px',threshold:0});
    observer.observe(sentinel);
  }
  // Touch scroll — window scroll event สำหรับมือถือ
  window.addEventListener('scroll',function(){
    if(anyModalOpen())return;
    var s=document.getElementById('scroll-sentinel');
    if(!s)return;
    var rect=s.getBoundingClientRect();
    if(rect.top<window.innerHeight+200&&dispCount<filtered.length){
      dispCount=Math.min(dispCount+batchSize,filtered.length);
      renderTable();
    }
  },{passive:true});

  document.getElementById('table-wrap').addEventListener('wheel',function(e){
    if(anyModalOpen())return;
    e.preventDefault();
    if(!filtered.length)return;
    if(e.deltaY>0){
      selIdx=Math.min(selIdx+1,filtered.length-1);
      if(selIdx>=dispCount-2){dispCount=Math.min(dispCount+batchSize,filtered.length);renderTable();}
    } else {
      selIdx=Math.max(0,selIdx<=0?0:selIdx-1);
    }
    hilite();
    // ล้าง row-hover ทุกแถว แล้วใส่ที่แถวที่เลือก
    scrollSelected=true;
    document.querySelectorAll('#tbody tr.row-hover').forEach(function(r){r.classList.remove('row-hover');});
    var sel=document.querySelector('#tbody tr.row-selected');
    if(sel){
      sel.classList.add('row-hover');
      var tb=document.getElementById('sticky-toolbar');
      var tbH=tb?tb.offsetHeight+4:54;
      var r=sel.getBoundingClientRect();
      if(r.top<tbH){
        window.scrollBy({top:r.top-tbH-4,behavior:'instant'});
      } else if(r.bottom>window.innerHeight){
        window.scrollBy({top:r.bottom-window.innerHeight+4,behavior:'instant'});
      }
    }
  },{passive:false});
  // เมื่อ mouse เคลื่อนไหวจริง ให้ล้าง row-hover ออก (คืนการทำงานปกติ)
  // เมื่อ mouse เคลื่อนไหวจริง ให้ล้าง scroll-selected และคืนการทำงานปกติ
  document.getElementById('table-wrap').addEventListener('mousemove',function(){
    if(!scrollSelected)return;
    document.querySelectorAll('#tbody tr.row-hover').forEach(function(r){r.classList.remove('row-hover');});
    scrollSelected=false;
  },{passive:true});

  // intercept click — ถ้า scroll เลือกไว้ ให้ open รายการนั้นแทน
  document.getElementById('tbody').addEventListener('click',function(e){
    if(!scrollSelected)return;
    e.stopImmediatePropagation();
    e.preventDefault();
    var c=filtered[selIdx];
    if(c){scrollSelected=false;document.querySelectorAll('#tbody tr.row-hover').forEach(function(r){r.classList.remove('row-hover');});openDetail(c.id);}
  },true);
});

// TAB TRAP — วน focus เฉพาะใน modal ที่เปิดอยู่
document.addEventListener('keydown',function(e){
  if(e.key!=='Tab')return;
  var activeModal=null;
  // ลำดับความสำคัญ: modal ที่เปิดอยู่บนสุด
  if(ovIsOpen('ov-confirm'))activeModal=document.getElementById('ov-confirm');
  else if(ovIsOpen('ov-pay-form'))activeModal=document.getElementById('ov-pay-form');
  else if(ovIsOpen('ov-payment'))activeModal=document.getElementById('ov-payment');
  else if(ovIsOpen('ov-renew'))activeModal=document.getElementById('ov-renew');
  else if(ovIsOpen('ov-form'))activeModal=document.getElementById('ov-form');
  else if(ovIsOpen('ov-detail'))activeModal=document.getElementById('ov-detail');
  else if(ovIsOpen('ov-settings'))activeModal=document.getElementById('ov-settings');
  else if(ovIsOpen('ov-report'))activeModal=document.getElementById('ov-report');
  if(!activeModal)return;
  e.preventDefault();
  var sel='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var els=Array.from(activeModal.querySelectorAll(sel)).filter(function(el){
    return el.offsetParent!==null&&!el.closest('[style*="display:none"]');
  });
  if(!els.length)return;
  var first=els[0],last=els[els.length-1];
  var cur=document.activeElement;
  var idx=els.indexOf(cur);
  if(e.shiftKey){
    var prev=idx>0?els[idx-1]:last;
    prev.focus();
  } else {
    var next=(idx>=0&&idx<els.length-1)?els[idx+1]:first;
    next.focus();
  }
},true);

// KEYBOARD
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&window._payEscHandled){window._payEscHandled=false;e.stopImmediatePropagation();return;}
  var cfOpen=ovIsOpen('ov-confirm');var fmOpen=ovIsOpen('ov-form');var dtOpen=ovIsOpen('ov-detail');var stOpen=ovIsOpen('ov-settings');var rnOpen=ovIsOpen('ov-renew');
  var histTabOn=dtOpen&&document.getElementById('tab-hist').classList.contains('active');
  var hfOpen=dtOpen&&document.getElementById('hist-form-wrap').style.display!=='none';
  if(e.key==='Escape'){
    e.preventDefault();
    if(ovIsOpen("ov-pay-form")){closePayForm();return;}
    if(cfOpen){cfNo();return;}
    if(ovIsOpen("ov-payment")){closePayment();return;}
    if(ovIsOpen('ov-report')){closeReport();return;}
    // pay-form/payment ESC handled by capture listener above
    if(ovIsOpen('ov-dash')){closeDash();showMainMenu();return;}
    if(rnOpen){closeRenew();return;}
    if(hfOpen){cancelHistForm();return;}
    if(fmOpen){closeForm();return;}
    if(dtOpen){
      var onHist=document.getElementById('tab-hist').classList.contains('active');
      if(onHist){switchTab('info');return;}
      closeDetail();return;
    }if(stOpen){closeSettings();return;}
    var qi=document.getElementById('q');
    if(document.activeElement===qi){qi.blur();qi.value='';toggleClearBtn();doFilter();return;}
    if(qi.value){clearSearch();document.activeElement&&document.activeElement.blur();document.body.focus();return;}
    // ไม่มี modal เปิดอยู่ กด ESC กลับ main menu
    var mmEl=document.getElementById('main-menu');
    if(mmEl&&mmEl.classList.contains('hidden')){showMainMenu();return;}
    return;
  }
  if(cfOpen)return;
  if(ovIsOpen('ov-pay-form'))return;
  if(ovIsOpen('ov-payment'))return; // payment list จัดการ key เอง
  if(e.key==='F10'){
    e.preventDefault();
    if(rnOpen){saveRenew();return;}
    if(fmOpen){saveForm();return;}
    if(ovIsOpen('ov-pay-form')){savePayment();return;}
  }
  if(e.key==='F2'&&dtOpen&&histTabOn){e.preventDefault();copyFromCustomer();return;}
  if(e.key==='Insert'){
    e.preventDefault();
    if(ovIsOpen('ov-payment')&&!ovIsOpen('ov-pay-form')){payNewForm();return;}
    if(histTabOn&&!hfOpen){openHistForm(null);return;}
    if(!fmOpen&&!dtOpen&&!stOpen){openForm();}return;
  }
  if(anyModalOpen()){
    // กัน Space/Home/End/PageUp/PageDown/Arrow ของรายการหลัก ไม่ให้ทะลุเวลามี overlay ใดๆเปิดอยู่
    // ต้อง preventDefault ด้วย ไม่งั้น browser จะ scroll หน้าเพจเองตาม native behavior
    var navKeys=['Home','End','PageUp','PageDown','ArrowUp','ArrowDown',' '];
    if(navKeys.indexOf(e.key)!==-1)e.preventDefault();
    // Up/Down ให้เลื่อน scroll ในหน้าต่างที่เปิดอยู่ เหมือนหมุนล้อเมาส์
    // ยกเว้นถ้า focus อยู่ใน select/input/textarea ให้ปล่อย native behavior ของ field นั้นทำงานตามปกติ
    var ae=document.activeElement;
    var fieldTags=['SELECT','TEXTAREA'];
    if((e.key==='ArrowUp'||e.key==='ArrowDown') && !(ae&&fieldTags.indexOf(ae.tagName)!==-1)){
      var scrollEl=getOpenOverlayScrollEl();
      if(scrollEl){
        var dir=(e.key==='ArrowDown')?1:-1;
        scrollEl.scrollBy({top:dir*60,behavior:'smooth'});
      }
    }
    return;
  }
  if(e.key===' '){
    var si=document.getElementById('q');
    if(document.activeElement!==si){
      e.preventDefault();
      // toolbar เป็น sticky ช่องค้นหาอยู่ด้านบนเสมอ แค่ focus ได้เลย
      si.focus();
      si.select();
    }
    return;
  }
  if(e.key==='F2'&&!e.ctrlKey){
    e.preventDefault();
    var c=getSel();
    if(!c){toast('กรุณาเลือกรายชื่อลูกค้าก่อน','error');return;}
    openHistory(c.id);
    return;
  }
  if(e.key==='F2'&&e.ctrlKey){
    e.preventDefault();
    var c=getSel();
    if(!c){toast('กรุณาเลือกรายชื่อลูกค้าก่อน','error');return;}
    copyCustomerToForm(c.id);
    return;
  }
  if(e.key==='F5'){
    e.preventDefault();
    toggleExpFilter();
    return;
  }
  if(e.key==='Delete'){if(ovIsOpen('ov-payment')||ovIsOpen('ov-pay-form'))return;e.preventDefault();var c=getSel();if(c){hilite('delete');askDel(c.id);}return;}
  if(e.key==='Home'){
    e.preventDefault();
    if(!filtered.length)return;
    selIdx=0;
    dispCount=Math.max(dispCount,batchSize);renderTable();
    hilite('select');
    window.scrollTo({top:0,behavior:'instant'});
    return;
  }
  if(e.key==='End'){
    e.preventDefault();
    if(!filtered.length)return;
    selIdx=filtered.length-1;
    dispCount=filtered.length;renderTable();
    hilite('select');var _se=document.querySelector('#tbody tr.row-selected');if(_se)_se.scrollIntoView({block:'nearest'});return;
  }
  if(e.key==='PageDown'){
    e.preventDefault();
    if(!filtered.length)return;
    var pgSize=Math.max(1,Math.floor((window.innerHeight-100)/28));
    selIdx=Math.min(selIdx+pgSize,filtered.length-1);
    if(selIdx>=dispCount-2){dispCount=Math.min(dispCount+batchSize,filtered.length);renderTable();}
    hilite('select');var _spd=document.querySelector('#tbody tr.row-selected');if(_spd)_spd.scrollIntoView({block:'nearest'});return;
  }
  if(e.key==='PageUp'){
    e.preventDefault();
    if(!filtered.length)return;
    var pgSize2=Math.max(1,Math.floor((window.innerHeight-100)/28));
    selIdx=Math.max(0,selIdx-pgSize2);
    hilite('select');var _spu=document.querySelector('#tbody tr.row-selected');
    if(_spu){var _r3=_spu.getBoundingClientRect();var _tb2=document.getElementById('sticky-toolbar');var _tbH2=_tb2?_tb2.offsetHeight+8:50;if(_r3.top<_tbH2)window.scrollBy({top:_r3.top-_tbH2-4,behavior:'instant'});else _spu.scrollIntoView({block:'nearest'});}
    return;
  }
  if(e.key==='ArrowDown'){
    e.preventDefault();
    if(!filtered.length)return;
    selIdx=Math.min(selIdx+1,filtered.length-1);
    if(selIdx>=dispCount-2){dispCount=Math.min(dispCount+batchSize,filtered.length);renderTable();}
    hilite('select');var sel=document.querySelector('#tbody tr.row-selected');if(sel)sel.scrollIntoView({block:'nearest'});return;
  }
  if(e.key==='ArrowUp'){
    e.preventDefault();
    selIdx=Math.max(0,selIdx<=0?0:selIdx-1);
    hilite();
    var _s2=document.querySelector('#tbody tr.row-selected');
    if(_s2){
      var _r2=_s2.getBoundingClientRect();
      var _tb=document.getElementById('sticky-toolbar');
      var _tbH=_tb?_tb.offsetHeight+8:50;
      if(_r2.top<_tbH){window.scrollBy({top:_r2.top-_tbH-4,behavior:'instant'});}
      else{_s2.scrollIntoView({block:'nearest'});}
    }
    return;}
  if(e.key==='Enter'){
    e.preventDefault();
    var c=getSel();
    if(c)openDetail(c.id);
    return;
  }
});
document.addEventListener('keydown',function(e){
  if(!ovIsOpen('ov-detail'))return;
  if(!document.getElementById('tab-hist').classList.contains('active'))return;
  if(ovIsOpen('ov-confirm'))return;
  var hfO=document.getElementById('hist-form-wrap').style.display!=='none';if(hfO)return;
  if(e.key==='ArrowDown'){e.preventDefault();selHistIdx=Math.min(selHistIdx+1,histData.length-1);renderHist();}
  if(e.key==='ArrowUp'){e.preventDefault();selHistIdx=Math.max(0,selHistIdx<=0?0:selHistIdx-1);renderHist();}
  if(e.key==='Enter'&&selHistIdx>=0){e.preventDefault();openHistForm(selHistIdx);}
  if(e.key==='Delete'&&selHistIdx>=0){e.preventDefault();askDelHist(selHistIdx);}
});


// Arrow keys for confirm modal
document.addEventListener('keydown', function(e){
  if(!ovIsOpen('ov-confirm'))return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
    e.preventDefault();
    var yb=document.getElementById('cf-yes');
    var nb=document.getElementById('cf-no');
    if(!yb||!nb)return;
    var active=document.activeElement;
    if(active===yb){nb.focus();}
    else{yb.focus();}
  }
},true);

// CONFIRM
function showConfirm(icon,title,name,detail,msg,yesLabel,cb){
  document.getElementById('cf-icon').textContent=icon;document.getElementById('cf-title').textContent=title;
  document.getElementById('cf-name').textContent=name;document.getElementById('cf-detail').textContent=detail;
  document.getElementById('cf-msg').textContent=msg;
  var yb=document.getElementById('cf-yes');yb.textContent=yesLabel;
  cfCallback=cb;yb.onclick=function(){var fn=cfCallback;cfNoCallback=null;cfNo();if(fn)fn();};
  ovShow('ov-confirm');
  // focus ปุ่ม NO ก่อน (ป้องกันลบโดยไม่ตั้งใจ)
  setTimeout(function(){
    var nb=document.getElementById('cf-no');
    if(nb)nb.focus();
  },50);
  // focus ปุ่ม NO ก่อน
  setTimeout(function(){document.getElementById('cf-no').focus();},50);
}
var cfNoCallback=null;
function cfNo(){ovHide('ov-confirm');cfCallback=null;if(cfNoCallback){var fn=cfNoCallback;cfNoCallback=null;fn();}}

// DELETE
function askDel(id){
  var c=customers.find(function(x){return x.id===id;});if(!c)return;
  hilite('delete');
  cfNoCallback=function(){if(selIdx>=0)hilite('select');else hilite();};
  showConfirm('🗑️','ยืนยันการลบลูกค้า',fullName(c),'รหัส: '+c.id+' | ทะเบียน: '+(c.plate||'-'),'ข้อมูลจะถูกลบถาวร','YES ลบเลย',function(){
    fsDeleteCustomer(id).then(function(r){
      customers=customers.filter(function(x){return x.id!==id;});
      if(detailId===id)closeDetail();selIdx=-1;updateStats();doFilter();toast('🗑️ ลบลูกค้าเรียบร้อย');
    }).catch(function(e){toast(e.message,'error');});
  });
}

// FILL SELECTS
// ============ Searchable Select System ============
var ssData={fty:[],fco:[],fbr:[],fmo:[]};
var ssIdx={fty:-1,fco:-1,fbr:-1,fmo:-1};

function ssSetOptions(key,opts){
  ssData[key]=opts;
  var list=document.getElementById(key+'-list');
  if(!list)return;
  list.innerHTML=opts.map(function(o,i){
    return '<div class="ss-item" data-val="'+esc(o)+'" data-i="'+i+'">'+esc(o)+'</div>';
  }).join('');
  // ใช้ event delegation แทน inline events
  list.onclick=function(e){
    var el=e.target.closest('.ss-item');
    if(el)ssPick(key,el.dataset.val);
  };
  list.onmouseover=function(e){
    var el=e.target.closest('.ss-item');
    if(el)ssHover(key,+el.dataset.i);
  };
}
function ssOpen(key){
  // ปิด dropdown อื่นก่อน
  ['fty','fco','fbr','fmo'].forEach(function(k){if(k!==key)ssClose(k);});
  var dd=document.getElementById(key+'-dd');
  if(!dd)return;
  dd.classList.add('open');
  var s=document.getElementById(key+'-s');
  if(s){s.value='';ssFilter(key);}
  ssIdx[key]=-1;
  // focus search input
  setTimeout(function(){if(s)s.focus();},50);
}
function ssClose(key){
  var dd=document.getElementById(key+'-dd');
  if(dd)dd.classList.remove('open');
}
function ssFilter(key){
  var q=(document.getElementById(key+'-s').value||'').toLowerCase();
  var list=document.getElementById(key+'-list');
  if(!list)return;
  var cur=document.getElementById(key).value;
  var items=list.querySelectorAll('.ss-item');
  var first=true;
  items.forEach(function(el){
    var txt=el.dataset.val.toLowerCase();
    var show=!q||txt.indexOf(q)>=0||txt.charAt(0)===q.charAt(0);
    el.style.display=show?'':'none';
    if(show&&first){ssIdx[key]=+el.dataset.i;first=false;}
    el.classList.toggle('selected',el.dataset.val===cur);
  });
}
function ssHover(key,i){ssIdx[key]=i;}
function ssPick(key,val){
  document.getElementById(key).value=val;
  document.getElementById(key+'-input').value=val;
  ssClose(key);
  setDirty();
  if(key==='fbr'){onBrand();}
  // scroll selected into view
  var list=document.getElementById(key+'-list');
  if(list){var sel=list.querySelector('.ss-item.selected');if(sel)sel.scrollIntoView({block:'nearest'});}
}
function ssKey(event,key){
  var dd=document.getElementById(key+'-dd');
  var isOpen=dd&&dd.classList.contains('open');
  if(!isOpen){if(event.key==='Enter'||event.key===' '||event.key==='ArrowDown'){event.preventDefault();ssOpen(key);}return;}
  var list=document.getElementById(key+'-list');
  var items=Array.from(list.querySelectorAll('.ss-item:not([style*="display: none"]):not([style*="display:none"])'));
  if(!items.length)return;
  if(event.key==='ArrowDown'){
    event.preventDefault();
    ssIdx[key]=Math.min(ssIdx[key]+1,items.length-1);
    ssHighlight(key,items);
  } else if(event.key==='ArrowUp'){
    event.preventDefault();
    ssIdx[key]=Math.max(0,ssIdx[key]-1);
    ssHighlight(key,items);
  } else if(event.key==='Enter'){
    event.preventDefault();
    var cur=items[ssIdx[key]<0?0:ssIdx[key]];
    if(cur)ssPick(key,cur.dataset.val);
  } else if(event.key==='Escape'){
    event.preventDefault();ssClose(key);
    document.getElementById(key+'-input').focus();
  }
}
function ssHighlight(key,items){
  items.forEach(function(el,i){el.classList.toggle('active',i===ssIdx[key]);});
  if(items[ssIdx[key]])items[ssIdx[key]].scrollIntoView({block:'nearest'});
}
// ปิด dropdown เมื่อคลิกนอก
document.addEventListener('click',function(e){
  ['fty','fco','fbr','fmo'].forEach(function(key){
    var wrap=document.getElementById(key+'-input');
    var dd=document.getElementById(key+'-dd');
    if(wrap&&dd&&!wrap.contains(e.target)&&!dd.contains(e.target))ssClose(key);
  });
});

window.fillSelects=function fillSelects(){
  try{
    var spx=sortArr(prefixes),sti=sortArr(insTypes),stc=sortArr(insCos),stb=sortArr(brands);
    // prefix
    var fpx=document.getElementById('fpx');
    if(fpx){var pv=fpx.value;fpx.innerHTML='<option value="">-- --</option>'+spx.map(function(p){return '<option value="'+esc(p)+'">'+esc(p)+'</option>';}).join('');if(prefixes.indexOf(pv)>=0)fpx.value=pv;}
    // filter type
    var ft=document.getElementById('ft');
    if(ft){var fv=ft.value;ft.innerHTML='<option value="">ประเภทประกันทั้งหมด</option>'+sti.map(function(t){return '<option value="'+esc(t)+'">'+esc(t)+'</option>';}).join('');if(fv)ft.value=fv;}
    // searchable selects — ตรวจว่า element มีอยู่จริง
    if(document.getElementById('fty-list'))ssSetOptions('fty',sti);
    if(document.getElementById('fco-list'))ssSetOptions('fco',stc);
    if(document.getElementById('fbr-list'))ssSetOptions('fbr',stb);
    if(document.getElementById('fmo-list'))ssSetOptions('fmo',sortArr(models[document.getElementById('fbr')?document.getElementById('fbr').value:'']||[]));
    // settings brand
    var sb=document.getElementById('sl-br-sel');
    if(sb){var sv=sb.value;sb.innerHTML='<option value="">-- เลือกยี่ห้อ --</option>'+stb.map(function(b){return '<option value="'+esc(b)+'">'+esc(b)+'</option>';}).join('');if(brands.indexOf(sv)>=0)sb.value=sv;}
  }catch(e){console.error('fillSelects error:',e);}
}
function onBrand(){
  var br=document.getElementById('fbr').value;
  var cur=document.getElementById('fmo').value;
  var list=sortArr(models[br]||[]);
  ssSetOptions('fmo',list,'-- เลือกรุ่น --');
  if(list.indexOf(cur)>=0){
    document.getElementById('fmo').value=cur;
    document.getElementById('fmo-input').value=cur;
  } else {
    document.getElementById('fmo').value='';
    document.getElementById('fmo-input').value='';
  }
  document.getElementById('imo-btn').style.display=br?'inline-flex':'none';
  document.getElementById('imo').style.display='none';
}

// INLINE ADD
function inShow(k){
  var ids={px:'ipx',type:'itype',co:'ico',br:'ibr',mo:'imo'};
  var btns={px:'ipx-btn',type:'itype-btn',co:'ico-btn',br:'ibr-btn',mo:'imo-btn'};
  var inps={px:'ipx-v',type:'itype-v',co:'ico-v',br:'ibr-v',mo:'imo-v'};
  document.getElementById(ids[k]).style.display='flex';
  document.getElementById(btns[k]).style.display='none';
  setTimeout(function(){document.getElementById(inps[k]).focus();},50);
}
function inHide(k){
  var ids={px:'ipx',type:'itype',co:'ico',br:'ibr',mo:'imo'};
  var btns={px:'ipx-btn',type:'itype-btn',co:'ico-btn',br:'ibr-btn',mo:'imo-btn'};
  document.getElementById(ids[k]).style.display='none';
  document.getElementById(btns[k]).style.display='inline-flex';
}
function inAdd(k){
  var inps={px:'ipx-v',type:'itype-v',co:'ico-v',br:'ibr-v',mo:'imo-v'};
  var val=document.getElementById(inps[k]).value.trim();
  if(!val){toast('กรุณากรอกข้อมูล','error');return;}
  var br=document.getElementById('fbr').value;
  if(k==='mo'&&!br){toast('กรุณาเลือกยี่ห้อก่อน','error');return;}
  // อัปเดต local แล้ว sync Firestore
  document.getElementById(inps[k]).value='';
  if(k==='px')prefixes.push(val);
  else if(k==='type')insTypes.push(val);
  else if(k==='co')insCos.push(val);
  else if(k==='br'){brands.push(val);models[val]=[];}
  else if(k==='mo'){if(!models[br])models[br]=[];models[br].push(val);}
  fillSelects();
  if(k==='px')document.getElementById('fpx').value=val;
  else if(k==='type'){document.getElementById('fty').value=val;document.getElementById('fty-input').value=val;}
  else if(k==='co'){document.getElementById('fco').value=val;document.getElementById('fco-input').value=val;}
  else if(k==='br'){document.getElementById('fbr').value=val;document.getElementById('fbr-input').value=val;onBrand();}
  else if(k==='mo'){document.getElementById('fmo').value=val;document.getElementById('fmo-input').value=val;}
  inHide(k);toast('✅ เพิ่ม "'+val+'" แล้ว');
  fsUpdateSettings({insTypes:insTypes,insCos:insCos,brands:brands,models:models,prefixes:prefixes}).catch(function(e){console.error('sync:',e);});
}

// CUSTOMER FORM
function openForm(id){
  editId=id||null;
  document.getElementById('form-title').textContent=id?'✏️ แก้ไขข้อมูลลูกค้า':'➕ เพิ่มลูกค้าใหม่';
  fillSelects();['px','type','co','br','mo'].forEach(function(k){inHide(k);});
  if(id){
    var c=customers.find(function(x){return x.id===id;});if(!c)return;
    document.getElementById('fpx').value=c.prefix||'';
    document.getElementById('ffn').value=c.firstname||'';
    document.getElementById('fln').value=c.lastname||'';
    document.getElementById('fph').value=c.phone||'';
    document.getElementById('fad').value=c.address||'';
    document.getElementById('fpl').value=c.plate||'';
    document.getElementById('fco').value=c.insco||'';
    document.getElementById('fco-input').value=c.insco||'';
    document.getElementById('fbr').value=c.brand||'';
    document.getElementById('fbr-input').value=c.brand||'';
    onBrand();
    document.getElementById('fmo').value=c.model||'';
    document.getElementById('fmo-input').value=c.model||'';
    document.getElementById('fyr').value=c.caryear||'';
    document.getElementById('fty').value=c.type||'';
    document.getElementById('fty-input').value=c.type||'';
    setNum('fpr',c.premium);setNum('fcv',c.coverage);
    document.getElementById('fsd').value=isoToBE(c.start||'');
    document.getElementById('fed').value=isoToBE(c.end||'');
    document.getElementById('fst').value=c.status||'active';updateStatusDisplay(c.status||'active');
    document.getElementById('fno').value=c.note||'';
    showYD('fsd','fsd-d');showYD('fed','fed-d');
  } else {
    ['ffn','fln','fph','fad','fpl','fyr','fsd','fed','fno','fpr','fcv'].forEach(function(i){
      var el=document.getElementById(i);
      el.value='';
      el.setAttribute('value',''); // force clear ป้องกัน autofill
    });
    document.getElementById('fsd-d').textContent='';document.getElementById('fed-d').textContent='';
    document.getElementById('fpx').value='';
    document.getElementById('fco').value='';document.getElementById('fco-input').value='';
    document.getElementById('fty').value='';document.getElementById('fty-input').value='';
    document.getElementById('fbr').value='';document.getElementById('fbr-input').value='';onBrand();
    document.getElementById('fmo').value='';document.getElementById('fmo-input').value='';
    // clear หลัง fillSelects เสร็จ (fillSelects อาจ restore ค่าเดิม)
    setTimeout(function(){
      document.getElementById('fco').value='';document.getElementById('fco-input').value='';
      document.getElementById('fty').value='';document.getElementById('fty-input').value='';
    },50);
    document.getElementById('fst').value='active';updateStatusDisplay('active');
  }
  resetDirty();
  ovShow('ov-form');
  setTimeout(function(){document.getElementById('ffn').focus();},50);
  // กำจัด autofill โดย clone+replace element ใหม่ทุก field
  if(!id){
    var clearFields=['ffn','fln','fph','fad','fpl','fyr','fsd','fed','fno','fpr','fcv'];
    function nukeAutofill(){
      clearFields.forEach(function(i){
        var el=document.getElementById(i);
        if(!el)return;
        var fresh=el.cloneNode(false); // clone โดยไม่มี value
        fresh.value='';
        el.parentNode.replaceChild(fresh,el);
        // rebind events
        if(i==='fpr'||i==='fcv'){
          fresh.addEventListener('input',function(){numFmt(this);setDirty();});
        } else {
          fresh.addEventListener('input',function(){setDirty();});
        }
      });
    }
    nukeAutofill();
    setTimeout(nukeAutofill,300);
    setTimeout(nukeAutofill,700);
  }
}
function closeForm(){
  confirmClose(function(){
    ovHide('ov-form');
    resetDirty();
  });
}
function saveForm(){
  var fn=document.getElementById('ffn').value.trim();
  var ln=document.getElementById('fln').value.trim();
  var ph=document.getElementById('fph').value.trim();
  var pl=document.getElementById('fpl').value.trim();
  var pr=getNum('fpr');var sd=beToISO(document.getElementById('fsd').value);var ed=beToISO(document.getElementById('fed').value);
  var co=document.getElementById('fco').value;
  if(!fn){toast('กรุณากรอกชื่อ','error');return;}
  if(!ph){toast('กรุณากรอกเบอร์โทร','error');return;}
  if(!pl){toast('กรุณากรอกทะเบียนรถ','error');return;}
  if(!co){toast('⚠️ กรุณาเลือกบริษัทประกันภัย','error');document.getElementById('fco-input').focus();return;}
  if(!pr){toast('กรุณากรอกเบี้ยประกัน','error');return;}
  if(!sd||!ed){toast('กรุณาระบุวันเริ่มต้น-สิ้นสุด','error');return;}
  var px=document.getElementById('fpx').value;
  var dl=daysLeft(ed);var st=document.getElementById('fst').value;
  if(st==='active'&&dl!==null&&dl>=0&&dl<=90)st='expire';
  var data={
    prefix:px,firstname:fn,lastname:ln,
    name:(px?px+' ':'')+fn+(ln?' '+ln:''),
    phone:ph,address:document.getElementById('fad').value.trim(),plate:pl,
    insco:document.getElementById('fco').value,
    brand:document.getElementById('fbr').value,model:document.getElementById('fmo').value,
    caryear:document.getElementById('fyr').value,type:document.getElementById('fty').value,
    premium:pr,coverage:getNum('fcv'),start:sd,end:ed,status:st,
    note:document.getElementById('fno').value.trim()
  };
  var btn=document.getElementById('save-btn');btn.disabled=true;btn.textContent='กำลังบันทึก...';
  var isEdit=!!editId;if(isEdit)data.id=editId;
  var fsOp = isEdit ? fsUpdateCustomer(data) : fsAddCustomer(data);
  fsOp.then(function(r){
    btn.disabled=false;btn.textContent='💾 บันทึก';
    if(isEdit){
      var i=customers.findIndex(function(c){return c.id===editId;});
      if(i>=0)customers[i]=Object.assign({},customers[i],data);
      resetDirty();closeForm();updateStats();filtered=customers.slice();doFilter();
      toast('✅ แก้ไขเรียบร้อย');
    } else {
      var newId=r.id;
      customers.unshift(Object.assign({id:newId},data));
      updateStats();filtered=customers.slice();doFilter();
      resetDirty();editId=null;
      // ปิด form และเปิด detail พร้อมอัปโหลด
      ovHide('ov-form');
      window._openedFromNew=true; // flag บอกว่าเปิดจากเพิ่มใหม่
      openDetail(newId);
      toast('✅ บันทึกแล้ว — อัปโหลดเอกสารได้เลย');
    }
  }).catch(function(e){btn.disabled=false;btn.textContent='💾 บันทึก';toast(e.message,'error');});
}

// DETAIL
function openDetail(id){
  detailId=id;var c=customers.find(function(x){return x.id===id;});if(!c)return;
  var nm=fullName(c);
  document.getElementById('det-title').textContent='📋 '+nm;
  var car=[c.brand,c.model,c.caryear?'ปี ค.ศ.'+c.caryear:''].filter(Boolean).join(' ')||'-';
  document.getElementById('det-body').innerHTML=
    row('คำนำหน้า',c.prefix||'-')+row('ชื่อ',c.firstname||'-')+row('นามสกุล',c.lastname||'-')+
    row('เบอร์โทร',c.phone||'-')+row('ที่อยู่',c.address||'-')+row('ทะเบียนรถ',c.plate||'-')+row('ยี่ห้อ/รุ่น/ปี',car)+
    row('ประเภทประกัน',typeBadge(c.type))+row('บริษัทประกันภัย',c.insco||'-')+
    row('เบี้ยประกัน',fmtNum(c.premium)+' บาท')+row('ทุนประกันภัย',fmtNum(c.coverage)+' บาท')+
    row('เริ่มต้นวันที่',fmtDate(c.start))+row('สิ้นสุดวันที่',fmtDate(c.end))+
    row('สถานะ',statusBadge(c))+(c.note?row('หมายเหตุ',esc(c.note)):'');
  document.getElementById('det-edit-btn').onclick=function(){closeDetail();openForm(id);};
  document.getElementById('det-del-btn').onclick=function(){askDel(id);};
  switchTab('info');loadHist(id);loadFiles(id);
  ovShow('ov-detail');
  hilite('select');
  var _sel=document.querySelector('#tbody tr.row-selected');if(_sel)_sel.scrollIntoView({block:'nearest'});
  detNavUpdate();
}
function detNavUpdate(){
  var wrap=document.getElementById('det-nav-wrap');
  var pos=document.getElementById('det-nav-pos');
  if(!wrap||!pos)return;
  var total=filtered.length;
  if(selIdx<0||total===0){wrap.style.display='none';return;}
  wrap.style.display='flex';
  pos.textContent=(selIdx+1)+'/'+total;
  wrap.querySelector('button:first-child').disabled=selIdx<=0;
  wrap.querySelector('button:last-child').disabled=selIdx>=total-1;
}
function _detFill(id){
  var c=customers.find(function(x){return x.id===id;});if(!c)return;
  detailId=id;
  var nm=fullName(c);
  document.getElementById('det-title').textContent='📋 '+nm;
  var car=[c.brand,c.model,c.caryear?'ปี ค.ศ.'+c.caryear:''].filter(Boolean).join(' ')||'-';
  document.getElementById('det-body').innerHTML=
    row('คำนำหน้า',c.prefix||'-')+row('ชื่อ',c.firstname||'-')+row('นามสกุล',c.lastname||'-')+
    row('เบอร์โทร',c.phone||'-')+row('ที่อยู่',c.address||'-')+row('ทะเบียนรถ',c.plate||'-')+row('ยี่ห้อ/รุ่น/ปี',car)+
    row('ประเภทประกัน',typeBadge(c.type))+row('บริษัทประกันภัย',c.insco||'-')+
    row('เบี้ยประกัน',fmtNum(c.premium)+' บาท')+row('ทุนประกันภัย',fmtNum(c.coverage)+' บาท')+
    row('เริ่มต้นวันที่',fmtDate(c.start))+row('สิ้นสุดวันที่',fmtDate(c.end))+
    row('สถานะ',statusBadge(c))+(c.note?row('หมายเหตุ',esc(c.note)):'');
  document.getElementById('det-edit-btn').onclick=function(){closeDetail();openForm(id);};
  document.getElementById('det-del-btn').onclick=function(){askDel(id);};
  loadHist(id);loadFiles(id);
  hilite('select');
  var _sel2=document.querySelector('#tbody tr.row-selected');if(_sel2)_sel2.scrollIntoView({block:'nearest'});
  detNavUpdate();
}
function detNavPrev(){
  if(selIdx<=0)return;
  selIdx--;
  if(selIdx>=dispCount){dispCount=Math.min(selIdx+batchSize,filtered.length);renderTable();}
  var c=filtered[selIdx];if(c)_detFill(c.id);
}
function detNavNext(){
  if(selIdx>=filtered.length-1)return;
  selIdx++;
  if(selIdx>=dispCount){dispCount=Math.min(selIdx+batchSize,filtered.length);renderTable();}
  var c=filtered[selIdx];if(c)_detFill(c.id);
}

// ← → keyboard nav ใน card 1 detail
document.addEventListener('keydown',function(e){
  if(!ovIsOpen('ov-detail'))return;
  if(ovIsOpen('ov-confirm')||ovIsOpen('ov-form'))return;
  if(e.key==='ArrowLeft'){e.preventDefault();detNavPrev();}
  else if(e.key==='ArrowRight'){e.preventDefault();detNavNext();}
},true);
function row(label,val){return '<div class="detail-row"><div class="detail-label">'+label+'</div><div class="detail-val">'+val+'</div></div>';}
function closeDetail(){
  ovHide('ov-detail');
  detailId=null;editHistIdx=null;selHistIdx=-1;
  if(window._openedFromNew){
    window._openedFromNew=false;
    openForm(); // เปิดฟอร์มใหม่รอรายต่อไป
  }
}
function switchTab(tab){
  ['info','hist','pay'].forEach(function(t){
    document.getElementById('tab-'+t).classList.toggle('active',t===tab);
    document.getElementById('tab-'+t+'-btn').classList.toggle('active',t===tab);
  });
  document.getElementById('det-footer-info').style.display=tab==='info'?'flex':'none';
  document.getElementById('det-footer-hist').style.display=tab==='hist'?'flex':'none';
  document.getElementById('det-footer-pay').style.display=tab==='pay'?'flex':'none';
  if(tab==='hist')cancelHistForm();
  if(tab==='pay')loadPayHist(detailId);
}

// HISTORY
function loadHist(cid){
  document.getElementById('hist-list').innerHTML='<div style="text-align:center;padding:1rem;color:#94a3b8;font-size:11px">กำลังโหลด...</div>';
  cancelHistForm();selHistIdx=-1;
  fsGetHistory(cid).then(function(list){
    window._histData=list;histData=list;renderHist();
  }).catch(function(){document.getElementById('hist-list').innerHTML='<div class="hist-empty">โหลดไม่สำเร็จ</div>';});
}
function renderHist(){
  var el=document.getElementById('hist-list');
  if(!histData.length){el.innerHTML='<div class="hist-empty">📭 ยังไม่มีประวัติ</div>';return;}
  el.innerHTML=histData.map(function(h,i){
    return '<div class="hist-item'+(i===selHistIdx?' sel':'')+'" onclick="histClick('+i+')" ondblclick="openHistForm('+i+')">'+
      '<div class="hist-head"><div class="hist-co">🏢 '+esc(h.insco||'-')+'</div><div class="hist-dates">'+fmtDate(h.start)+' – '+fmtDate(h.end)+'</div><button class="hist-del-btn" onclick="event.stopPropagation();askDelHist('+i+')">🗑️</button></div>'+
      '<div class="hist-row"><div><div class="hist-field-label">ประเภท</div><div class="hist-field-val">'+typeBadge(h.type)+'</div></div><div><div class="hist-field-label">ทุนประกัน</div><div class="hist-field-val">'+fmtNum(h.coverage)+' บาท</div></div><div><div class="hist-field-label">เบี้ยประกัน</div><div class="hist-field-val">'+fmtNum(h.premium)+' บาท</div></div>'+(h.note?'<div><div class="hist-field-label">หมายเหตุ</div><div class="hist-field-val">'+esc(h.note)+'</div></div>':'')+'</div>'+
      '<div style="margin-top:3px;font-size:10px;color:#94a3b8">คลิกเลือก · ดับเบิ้ลคลิก/Enter แก้ไข</div></div>';
  }).join('');
}
function histClick(i){selHistIdx=i;renderHist();}
function openHistForm(idx){
  editHistIdx=idx;
  var stc=sortArr(insCos),sti=sortArr(insTypes);
  document.getElementById('hco').innerHTML='<option value="">-- เลือกบริษัท --</option>'+stc.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
  document.getElementById('hty').innerHTML=sti.map(function(t){return '<option value="'+esc(t)+'">'+esc(t)+'</option>';}).join('');
  if(idx!==null&&histData[idx]){
    var h=histData[idx];
    document.getElementById('hf-title').textContent='✏️ แก้ไขประวัติ';
    document.getElementById('hco').value=h.insco||'';document.getElementById('hty').value=h.type||'';
    setNum('hcv',h.coverage);setNum('hpr',h.premium);
    document.getElementById('hsd').value=h.start||'';document.getElementById('hed').value=h.end||'';
    document.getElementById('hno').value=h.note||'';
    showYD('hsd','hsd-d');showYD('hed','hed-d');
  } else {
    document.getElementById('hf-title').textContent='➕ เพิ่มประวัติ';
    document.getElementById('hco').value='';document.getElementById('hty').value=sti[0]||'';
    document.getElementById('hcv').value='';document.getElementById('hpr').value='';
    document.getElementById('hsd').value='';document.getElementById('hed').value='';
    document.getElementById('hno').value='';
    document.getElementById('hsd-d').textContent='';document.getElementById('hed-d').textContent='';
  }
  document.getElementById('hist-form-wrap').style.display='block';
  document.getElementById('hist-add-btn').style.display='none';
}
function cancelHistForm(){document.getElementById('hist-form-wrap').style.display='none';document.getElementById('hist-add-btn').style.display='inline-flex';editHistIdx=null;}
function saveHist(){
  var insco=document.getElementById('hco').value;var pr=getNum('hpr');
  if(!insco){toast('กรุณาเลือกบริษัทประกัน','error');return;}
  if(!pr){toast('กรุณากรอกเบี้ยประกัน','error');return;}
  var c=customers.find(function(x){return x.id===detailId;});if(!c)return;
  var data={custId:c.id,custName:fullName(c),insco:insco,type:document.getElementById('hty').value,coverage:getNum('hcv'),premium:pr,start:document.getElementById('hsd').value,end:document.getElementById('hed').value,note:document.getElementById('hno').value};
  var hOp = editHistIdx!==null ? fsUpdateHistory(Object.assign({},data,{_docId:histData[editHistIdx]&&histData[editHistIdx]._docId})) : fsAddHistory(data);
  hOp.then(function(){cancelHistForm();loadHist(detailId);toast(editHistIdx!==null?'✅ แก้ไขประวัติแล้ว':'✅ เพิ่มประวัติแล้ว');
  }).catch(function(e){toast(e.message,'error');});
}
function askDelHist(idx){
  var h=histData[idx];if(!h)return;
  showConfirm('🗑️','ยืนยันการลบประวัติ',h.insco||'-',fmtDate(h.start)+' – '+fmtDate(h.end),'ประวัติจะถูกลบถาวร','YES ลบเลย',function(){
    fsDeleteHistory(detailId,idx).then(function(){selHistIdx=-1;loadHist(detailId);toast('🗑️ ลบประวัติแล้ว');}).catch(function(e){toast(e.message,'error');});
  });
}
function copyFromCustomer(){
  var c=customers.find(function(x){return x.id===detailId;});if(!c){toast('ไม่พบข้อมูลลูกค้า','error');return;}
  openHistForm(null);
  setTimeout(function(){
    var hco=document.getElementById('hco');var opt=Array.from(hco.options).find(function(o){return o.value===c.insco;});if(opt)hco.value=c.insco;
    var hty=document.getElementById('hty');var topt=Array.from(hty.options).find(function(o){return o.value===c.type;});if(topt)hty.value=c.type;
    setNum('hpr',c.premium);setNum('hcv',c.coverage);
    document.getElementById('hsd').value=c.start||'';document.getElementById('hed').value=c.end||'';
    showYD('hsd','hsd-d');showYD('hed','hed-d');
    toast('📋 คัดลอกข้อมูลจากลูกค้าแล้ว');
  },100);
}

// RENEW
var renewDirty=false;
function setRenewDirty(){renewDirty=true;}
function addOneYear(dateStr){
  if(!dateStr)return '';
  // บวกเฉพาะปี พ.ศ. +1 วัน-เดือนเหมือนเดิม
  var parts=dateStr.split('-');
  var y=parseInt(parts[0],10)+1;
  var mm=parts[1];var dd=parts[2];
  // กรณี 29 ก.พ. ปีที่ไม่ใช่ปีอธิกสุรทิน ให้เป็น 28 ก.พ.
  if(mm==='02'&&dd==='29'){
    var isLeap=(y%4===0&&(y%100!==0||y%400===0));
    if(!isLeap)dd='28';
  }
  return y+'-'+mm+'-'+dd;
}
function oldFieldHtml(label,val){
  return '<div><div style="color:#94a3b8;font-size:10px">'+label+'</div><div style="font-weight:500;color:#1a202c">'+val+'</div></div>';
}
function openRenew(){
  var c=customers.find(function(x){return x.id===detailId;});
  if(!c){toast('ไม่พบข้อมูลลูกค้า','error');return;}
  // แสดงข้อมูลเดิม
  document.getElementById('renew-old-detail').innerHTML=
    oldFieldHtml('บริษัทประกัน',c.insco||'-')+
    oldFieldHtml('ประเภทประกัน',c.type||'-')+
    oldFieldHtml('เบี้ยประกัน',fmtNum(c.premium)+' บาท')+
    oldFieldHtml('ทุนประกัน',fmtNum(c.coverage)+' บาท')+
    oldFieldHtml('เริ่มต้น',fmtDate(c.start))+
    oldFieldHtml('สิ้นสุด',fmtDate(c.end));
  // fill dropdowns
  var stco=sortArr(insCos),stty=sortArr(insTypes);
  document.getElementById('rco').innerHTML='<option value="">-- เลือกบริษัท --</option>'+stco.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join('');
  document.getElementById('rty').innerHTML=stty.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join('');
  // คัดลอกข้อมูลเดิม
  document.getElementById('rco').value=c.insco||'';
  document.getElementById('rty').value=c.type||'';
  setNum('rpr',c.premium);
  setNum('rcv',c.coverage);
  document.getElementById('rno').value='';
  // วันที่: start = วันสิ้นสุดเดิม+1 วัน, end = +1 ปีจาก end เดิม
  var newStart='';var newEnd='';
  if(c.end){
    // วันเริ่มต้นใหม่ = วันสิ้นสุดเดิม, วันสิ้นสุดใหม่ = +1 ปี
    newStart=c.end;
    newEnd=addOneYear(c.end);
  }
  document.getElementById('rsd').value=newStart;
  document.getElementById('red').value=newEnd;
  showYD('rsd','rsd-d');showYD('red','red-d');
  // สถานะ
  var dl=daysLeft(newEnd);var st='active';
  if(dl!==null&&dl>=0&&dl<=90)st='expire';
  document.getElementById('rst').value=st;
  updateRenewStatusDisplay(st);
  renewDirty=false;
  ovShow('ov-renew');
  setTimeout(function(){document.getElementById('rco').focus();},80);
}
function onRenewStartDate(){
  showYD('rsd','rsd-d');
  // ถ้ายังไม่มีวันสิ้นสุด ให้ auto +1 ปี
  var sd=document.getElementById('rsd').value;
  if(sd&&!document.getElementById('red').value){
    document.getElementById('red').value=addOneYear(sd);
    showYD('red','red-d');onRenewEndDate();
  }
}
function onRenewEndDate(){
  var ed=document.getElementById('red').value;
  var dl=daysLeft(ed);var st='active';
  if(dl!==null&&dl>=0&&dl<=90)st='expire';
  document.getElementById('rst').value=st;
  updateRenewStatusDisplay(st);
}
function updateRenewStatusDisplay(st){
  var labels={active:'<span class="badge badge-active">คุ้มครองอยู่</span>',expire:'<span class="badge badge-expire">ใกล้หมดอายุ</span>',cancel:'<span class="badge badge-cancel">ยกเลิกแล้ว</span>'};
  document.getElementById('rst-display').innerHTML=labels[st]||st;
}
function closeRenew(){
  if(renewDirty&&!confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกหรือไม่?'))return;
  ovHide('ov-renew');renewDirty=false;
}
function saveRenew(){
  var c=customers.find(function(x){return x.id===detailId;});if(!c)return;
  var co=document.getElementById('rco').value;
  var ty=document.getElementById('rty').value;
  var pr=getNum('rpr');var cv=getNum('rcv');
  var sd=document.getElementById('rsd').value;var ed=document.getElementById('red').value;
  if(!co){toast('กรุณาเลือกบริษัทประกัน','error');return;}
  if(!ty){toast('กรุณาเลือกประเภทประกัน','error');return;}
  if(!pr){toast('กรุณากรอกเบี้ยประกัน','error');return;}
  if(!sd||!ed){toast('กรุณาระบุวันเริ่มต้น-สิ้นสุด','error');return;}
  var btn=document.getElementById('renew-save-btn');btn.disabled=true;btn.textContent='กำลังบันทึก...';
  // ข้อมูลประวัติ (กรมธรรม์เดิม)
  var histData_new={custId:c.id,custName:fullName(c),insco:c.insco||'',type:c.type||'',coverage:c.coverage||0,premium:c.premium||0,start:c.start||'',end:c.end||'',note:'[ต่ออายุ] '+new Date().toLocaleDateString('th-TH')};
  // ข้อมูลลูกค้าใหม่
  var st=document.getElementById('rst').value;
  var newData={id:c.id,insco:co,type:ty,premium:pr,coverage:cv,start:sd,end:ed,status:st,note:document.getElementById('rno').value.trim()};
  // บันทึกประวัติก่อน แล้วค่อย update ลูกค้า
  fsAddHistory(histData_new).then(function(){
    return fsUpdateCustomer(Object.assign({},customers.find(function(x){return x.id===c.id;}),newData));
  }).then(function(){
    btn.disabled=false;btn.textContent='🔄 ยืนยันต่ออายุ';
    var i=customers.findIndex(function(x){return x.id===c.id;});
    if(i>=0){customers[i]=Object.assign({},customers[i],{insco:co,type:ty,premium:pr,coverage:cv,start:sd,end:ed,status:st,note:newData.note||customers[i].note});}
    updateStats();doFilter();
    ovHide('ov-renew');renewDirty=false;
    loadHist(c.id);openDetail(c.id);
    toast('✅ ต่ออายุประกันสำเร็จ! บันทึกประวัติเรียบร้อย');
  }).catch(function(e){btn.disabled=false;btn.textContent='🔄 ยืนยันต่ออายุ';toast(e.message,'error');});
}
document.getElementById('ov-renew').addEventListener('click',function(e){if(e.target===this)closeRenew();});




// BACK BUTTON — ปิด modal แทนออกจากหน้า
window.addEventListener('popstate', function(e){
  // ปิด modal ที่เปิดอยู่ตามลำดับความสำคัญ
  if(ovIsOpen('ov-confirm')){cfNo();return;}
  if(ovIsOpen('ov-renew')){closeRenew();showMainMenu();return;}
  if(ovIsOpen('ov-form')){closeForm();showMainMenu();return;}
  if(ovIsOpen('ov-detail')){closeDetail();return;}
  if(ovIsOpen('ov-settings')){closeSettings();showMainMenu();return;}
  if(ovIsOpen('ov-report')){closeReport();return;}
  if(ovIsOpen('ov-pay-form')){closePayForm();return;}
  if(ovIsOpen('ov-payment')){closePayment();return;}
  if(ovIsOpen('ov-dash')){closeDash();showMainMenu();return;}
  // ถ้าไม่มี modal — กลับ main menu เสมอ
  var mm=document.getElementById('main-menu');
  if(mm&&mm.classList.contains('hidden')){
    showMainMenu();
  } else {
    history.pushState(null,'','');
  }
});

// push state ตั้งต้น 1 ครั้งเพื่อให้มี history entry
window.addEventListener('load', function(){
  history.pushState(null,'','');
});

// LOGIN
var SESSION_KEY = 'ins_auth_' + (new Date().toDateString());
function checkSession(){
  // ถ้าเคย login วันนี้แล้ว ข้ามหน้า login ได้เลย
  return sessionStorage.getItem(SESSION_KEY) === 'ok';
}
function doLogin(){
  var pw = document.getElementById('login-pw').value.trim();
  if(!pw){shakeLogin('กรุณาใส่รหัสผ่าน');return;}
  // ดึง password จาก Firestore settings
  db.collection('settings').doc('auth').get().then(function(snap){
    var stored = snap.exists ? (snap.data().password || '') : '';
    if(!stored){
      // ยังไม่เคยตั้ง password — ตั้งครั้งแรกได้เลย
      if(pw.length < 4){shakeLogin('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');return;}
      db.collection('settings').doc('auth').set({password:pw}).then(function(){
        unlockApp();
        window.toast && window.toast('✅ ตั้งรหัสผ่านสำเร็จ');
      });
    } else if(pw === stored){
      unlockApp();
    } else {
      shakeLogin('รหัสผ่านไม่ถูกต้อง');
      document.getElementById('login-pw').value='';
      document.getElementById('login-pw').focus();
    }
  }).catch(function(e){
    shakeLogin('เกิดข้อผิดพลาด: '+e.message);
  });
}
function shakeLogin(msg){
  var box=document.getElementById('login-box');
  box.classList.remove('shake');
  void box.offsetWidth;
  box.classList.add('shake');
  document.getElementById('login-err').textContent=msg;
}
function unlockApp(){
  sessionStorage.setItem(SESSION_KEY,'ok');
  var ls=document.getElementById('login-screen');
  var lp=document.getElementById('login-pw');
  var le=document.getElementById('login-err');
  if(ls) ls.classList.add('hidden');
  if(lp) lp.value='';
  if(le) le.textContent='';
  // แสดง main menu
  showMainMenu();
  // โหลดข้อมูลในพื้นหลัง
  fsBoot();
}


// MAIN MENU KEYBOARD NAV
var mmFocusIdx = 0;
var mmItems = ['list','payment','report','dashboard','settings'];

function mmSetFocus(idx){
  mmFocusIdx = (idx + mmItems.length) % mmItems.length;
  document.querySelectorAll('.mm-card').forEach(function(el,i){
    el.classList.toggle('mm-focused', i === mmFocusIdx);
  });
}

document.addEventListener('keydown', function(e){
  var mm = document.getElementById('main-menu');
  if(!mm || mm.classList.contains('hidden')) return;
  // main menu แสดงอยู่ — จับ key ทั้งหมดไม่ให้ไปถึง handler อื่น
  if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();mmSetFocus(mmFocusIdx+1);}
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();mmSetFocus(mmFocusIdx-1);}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();mmGo(mmItems[mmFocusIdx]);}
  else if(e.key==='Tab'){e.preventDefault();e.stopPropagation();mmSetFocus(e.shiftKey?mmFocusIdx-1:mmFocusIdx+1);}
  else if(e.key==='Escape'){e.stopPropagation();}
  else{e.stopPropagation();} // block ทุก key ขณะ main menu เปิดอยู่
}, true);

// ESC ปิด modal กลับ main menu
function showMainMenu(){
  ovHide('ov-payment');
  ovHide('ov-pay-form');
  window._payEscHandled=false;
  selIdx=-1;
  var mm=document.getElementById('main-menu');
  if(mm) mm.classList.remove('hidden');
  // อัปเดต welcome text
  var el=document.getElementById('mm-welcome');
  if(el) el.textContent='เลือกรายการที่ต้องการแล้วกด Enter หรือ click mouse';
  // ไม่ reset mmFocusIdx เพื่อจำ card ที่เลือกล่าสุด
  setTimeout(function(){mmSetFocus(mmFocusIdx);},50);
  history.pushState({page:'menu'},'','');
}

function hideMainMenu(){
  var mm=document.getElementById('main-menu');
  if(mm) mm.classList.add('hidden');
}

function mmGo(page){
  // จำ page ที่เลือกล่าสุด
  var pages=['list','payment','report','dashboard','settings'];
  var idx=pages.indexOf(page);
  if(idx>=0)mmFocusIdx=idx;
  hideMainMenu();
  if(page==='list'){
    window.scrollTo({top:0,behavior:'instant'});
    history.pushState({page:'list'},'','');
  } else if(page==='dashboard'){
    history.pushState({page:'dashboard'},'','');
    openDash();
  } else if(page==='settings'){
    history.pushState({page:'settings'},'','');
    openSettings();
  } else if(page==='report'){
    history.pushState({page:'report'},'','');
    openReport();
  } else if(page==='payment'){
    history.pushState({page:'payment'},'','');
    openPayment();
  }
}
// ตรวจสอบ session ตอน load
document.addEventListener('DOMContentLoaded', function(){
  var loginScreen = document.getElementById('login-screen');
  var loginPw = document.getElementById('login-pw');
  if(checkSession()){
    if(loginScreen) loginScreen.classList.add('hidden');
    showMainMenu();
    fsBoot();
  } else {
    if(loginPw) setTimeout(function(){ loginPw.focus(); }, 100);
  }
});


function changePassword(){
  var p1=document.getElementById('new-pw1').value.trim();
  var p2=document.getElementById('new-pw2').value.trim();
  if(!p1){toast('กรุณาใส่รหัสผ่านใหม่','error');return;}
  if(p1.length<4){toast('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร','error');return;}
  if(p1!==p2){toast('รหัสผ่านไม่ตรงกัน','error');return;}
  db.collection('settings').doc('auth').set({password:p1},{merge:true}).then(function(){
    document.getElementById('new-pw1').value='';
    document.getElementById('new-pw2').value='';
    toast('✅ เปลี่ยนรหัสผ่านสำเร็จ');
  }).catch(function(e){toast(e.message,'error');});
}




// format payment fields
function parsePayVal(v){
  return parseFloat(String(v).replace(/,/g,''))||0;
}
function fmtPayField(el){
  // ระหว่างพิมพ์ ไม่ format เพื่อไม่รบกวน cursor
  var v=el.value.replace(/[^0-9.]/g,'');
  el.value=v;
}
function fmtPayBlur(el){
  var v=parsePayVal(el.value);
  if(v===0){el.value='0.00';return;}
  el.value=v.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtPayFocus(el){
  // เมื่อ focus ลบ comma ออกเพื่อให้แก้ไขได้
  el.value=String(parsePayVal(el.value)||'');
}
// ===== PAYMENT =====
var paySelectedCust=null;
var allPayments=[];
var allPaymentsFiltered=[];
var paySelIdx=-1;
var paySearchSelIdx=-1;
var paySelMode='';
var payDirty=false;

function openPayment(){
  hideMainMenu();
  history.replaceState({page:'payment'},'','');
  ovShow('ov-payment');
  loadAllPayments();
  // ไม่ auto-focus ช่องค้นหา — ถ้าจะค้นหาให้ click หรือกด Space เอง
}

function closePayment(){
  window._payEscHandled=false;
  ovHide('ov-payment');
  ovHide('ov-pay-form');
  selIdx=-1;
  showMainMenu();
}

function payNewForm(){
  window._editPayId=null;
  payResetForm();
  document.getElementById('pay-form-title').textContent='➕ เพิ่มรายการรับชำระ';
  var nw=document.getElementById('pay-nav-wrap');if(nw)nw.style.display='none';
  ovShow('ov-pay-form');
  setTimeout(function(){document.getElementById('pay-search').focus();},80);
}

function closePayForm(){
  if(payDirty){
    showConfirm('⚠️','ยังไม่ได้บันทึก','ต้องการออกโดยไม่บันทึกหรือไม่?','ข้อมูลที่กรอกจะหายไปทั้งหมด','','YES ออกเลย',function(){
      payDirty=false;
      ovHide('ov-pay-form');
    });
    setTimeout(function(){
      var nb=document.getElementById('cf-no');
      if(nb)nb.textContent='NO อยู่ต่อ';
    },30);
    return;
  }
  ovHide('ov-pay-form');
}

function payResetForm(){payDirty=false;
  paySelectedCust=null;
  ['pay-search','pay-ins','pay-inspect','pay-gas','pay-tax','pay-other',
   'pay-other-label','pay-amount','pay-note'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  ['pay-customer-info','pay-detail-section','pay-note-section'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='none';
  });
  var ps=document.getElementById('pay-payment-section');
  if(ps){ps.style.display='none';}
  var pff=document.getElementById('pay-form-footer');if(pff)pff.style.display='flex';
  var pp=document.getElementById('pay-payment-placeholder');
  if(pp)pp.style.display='flex';
  var pr=document.getElementById('pay-rows');
  if(pr)pr.innerHTML='';
  var sr=document.getElementById('pay-search-results');
  if(sr){sr.innerHTML='';sr.style.display='none';}
  var w=document.getElementById('pay-policy-sel-wrap');
  if(w)w.innerHTML='';
  document.getElementById('pay-total').textContent='0.00';
  document.getElementById('pay-balance').textContent='0.00';
  var sb=document.getElementById('pay-save-btn');
  if(sb)sb.style.display='none';
  var today=new Date();
  var d=String(today.getDate()).padStart(2,'0');
  var m=String(today.getMonth()+1).padStart(2,'0');
  var y=today.getFullYear();
  var pd=document.getElementById('pay-date');
  if(pd)pd.value=y+'-'+m+'-'+d;
}


function paySearchKeyNav(e){
  var res=document.getElementById('pay-search-results');
  if(!res||res.style.display==='none')return;
  var items=res.querySelectorAll('div[data-cid]');
  if(!items.length)return;

  if(e.key==='ArrowDown'){
    e.preventDefault();
    paySearchSelIdx=Math.min(paySearchSelIdx+1, items.length-1);
    updatePaySearchHighlight(items);
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    paySearchSelIdx=Math.max(paySearchSelIdx-1, 0);
    updatePaySearchHighlight(items);
  } else if(e.key==='Enter'){
    e.preventDefault();
    if(paySearchSelIdx>=0&&items[paySearchSelIdx]){
      var cid=items[paySearchSelIdx].getAttribute('data-cid');
      if(cid)paySelectCust(cid);
    }
  } else if(e.key==='Escape'){
    res.style.display='none';
    res.innerHTML='';
    paySearchSelIdx=-1;
  }
}

function updatePaySearchHighlight(items){
  items.forEach(function(el,i){
    el.style.background=i===paySearchSelIdx?'#bfdbfe':'';
    el.style.fontWeight=i===paySearchSelIdx?'600':'';
  });
  if(paySearchSelIdx>=0&&items[paySearchSelIdx]){
    items[paySearchSelIdx].scrollIntoView({block:'nearest'});
  }
}

function paySearch(){
  var q=(document.getElementById('pay-search').value||'').trim().toLowerCase();
  var res=document.getElementById('pay-search-results');
  if(!q){res.style.display='none';res.innerHTML='';return;}
  var found=customers.filter(function(c){
    return fullName(c).toLowerCase().includes(q)||(c.plate||'').toLowerCase().includes(q);
  }).slice(0,8);
  res.style.display='block';
  if(!found.length){res.innerHTML='<div style="font-size:12px;color:#94a3b8;padding:6px">ไม่พบลูกค้า</div>';return;}
  res.innerHTML='';
  found.forEach(function(c){
    var div=document.createElement('div');
    div.style.cssText='padding:6px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px';
    div.onmouseover=function(){this.style.background='#eff6ff';};
    div.onmouseout=function(){this.style.background='';};
    div.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<b>'+esc(fullName(c))+'</b>'
      +'<span style="font-size:11px;color:#1a4f8a;font-weight:600">'+esc(c.plate||'-')+'</span></div>'
      +'<div style="font-size:11px;color:#475569;margin-top:1px">'+esc((c.brand||'')+' '+(c.model||''))+' · '+esc(c.insco||'-')+' · '+esc(c.type||'-')+'</div>';
    div.setAttribute('data-cid',c.id);
    (function(cid){div.onclick=function(){paySelectCust(cid);};})(c.id);
    res.appendChild(div);
  });
}

function paySelectCust(id){
  var c=customers.find(function(x){return x.id===id;});
  if(!c)return;
  paySelectedCust=c;
  document.getElementById('pay-search').value=fullName(c);
  var res=document.getElementById('pay-search-results');
  res.innerHTML='';res.style.display='none';
  var samePlate=customers.filter(function(x){return x.plate&&x.plate===c.plate;});
  var totalPremium=samePlate.reduce(function(s,p){return s+Number(p.premium||0);},0);
  document.getElementById('pay-name').textContent=fullName(c);
  document.getElementById('pay-plate').textContent=c.plate||'-';
  document.getElementById('pay-car').textContent=(c.brand||'')+' '+(c.model||'');
  document.getElementById('pay-premium').textContent=fmtNum(totalPremium)+' บาท';
  var w=document.getElementById('pay-policy-sel-wrap');
  if(samePlate.length>=1){
    var label=samePlate.length>1?'กรมธรรม์ที่รวม ('+samePlate.length+' รายการ)':'กรมธรรม์';
    var html='<div style="margin-top:6px;font-size:11px;color:#475569"><b>'+label+':</b>';
    samePlate.forEach(function(p){
      html+='<div>'+esc(p.insco||'-')+' · '+esc(p.type||'-')+' · '+fmtDate(p.end)
        +' <b style="color:#1a4f8a">'+fmtNum(p.premium)+'</b></div>';
    });
    html+='</div>';
    w.innerHTML=html;
  } else {w.innerHTML='';}
  var fmtPremium=totalPremium?totalPremium.toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
  document.getElementById('pay-ins').value=fmtPremium;
  ['pay-customer-info','pay-detail-section','pay-note-section'].forEach(function(id){
    document.getElementById(id).style.display='block';
  });
  // แสดง panel ขวา
  var pps=document.getElementById('pay-payment-section');if(pps){pps.style.display='flex';pps.style.flexDirection='column';}
  var pff=document.getElementById('pay-form-footer');if(pff)pff.style.display='none';
  document.getElementById('pay-payment-placeholder').style.display='none';

  document.getElementById('pay-save-btn').style.display='inline-flex';
  buildPayRows(10, false);
  calcPayTotal();
}

function buildPayRows(n, setToday){
  var container=document.getElementById('pay-rows');
  container.innerHTML='';
  var today=new Date();
  var dd=String(today.getDate()).padStart(2,'0');
  var mm2=String(today.getMonth()+1).padStart(2,'0');
  var yyyy=today.getFullYear();
  var todayStr=yyyy+'-'+mm2+'-'+dd;
  for(var i=0;i<n;i++){
    var row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:28px 1fr 1fr;gap:4px;align-items:center;margin-bottom:2px';
    // ลำดับ
    var numEl=document.createElement('div');
    numEl.className='pay-row-num';
    numEl.style.cssText='font-size:11px;color:#94a3b8;text-align:center;font-weight:500';
    numEl.textContent=i+1;
    row.appendChild(numEl);
    // date input - แสดง พ.ศ. โดยตรง format DD/MM/YYYY(BE)
    var dateWrap=document.createElement('div');
    dateWrap.style.cssText='position:relative';
    var dateInput=document.createElement('input');
    dateInput.type='text';
    dateInput.className='pay-row-date';
    dateInput.placeholder='วว/ดด/ปปปป';
    dateInput.inputMode='numeric';
    dateInput.maxLength=10;
    dateInput.style.cssText='padding:3px 5px;border:1px solid #d1fae5;border-radius:5px;font-size:12px;width:100%;box-sizing:border-box;background:#fff';
    // ไม่ set วันที่ - ให้ว่างเปล่า
    // auto format DD/MM/YYYY
    dateInput.oninput=function(){payDirty=true;
      var v=this.value.replace(/[^0-9]/g,'');
      if(v.length>2) v=v.slice(0,2)+'/'+v.slice(2);
      if(v.length>5) v=v.slice(0,5)+'/'+v.slice(5);
      if(v.length>10) v=v.slice(0,10);
      this.value=v;
    };
    dateWrap.appendChild(dateInput);
    // amount input
    var amtInput=document.createElement('input');
    amtInput.type='text';
    amtInput.className='pay-row-amt';
    amtInput.placeholder='0.00';
    amtInput.inputMode='decimal';
    amtInput.style.cssText='padding:3px 5px;border:1px solid #d1fae5;border-radius:5px;font-size:12px;text-align:right;width:100%;box-sizing:border-box;background:#fff';
    amtInput.oninput=function(){payDirty=true;fmtPayField(this);calcPayBalance();};
    amtInput.onblur=function(){fmtPayBlur(this);calcPayBalance();};
    row.appendChild(dateWrap);
    row.appendChild(amtInput);
    container.appendChild(row);
  }
}

function calcPayTotal(){
  var ins=parsePayVal(document.getElementById('pay-ins').value);
  var insp=parsePayVal(document.getElementById('pay-inspect').value);
  var gas=parsePayVal(document.getElementById('pay-gas').value);
  var tax=parsePayVal(document.getElementById('pay-tax').value);
  var discEl=document.getElementById('pay-discount');
  var disc=discEl&&discEl.value&&discEl.value!=='0.00'?parsePayVal(discEl.value):0;
  var oth=parsePayVal(document.getElementById('pay-other').value);
  var total=ins+insp+gas+tax+oth-disc;
  document.getElementById('pay-total').textContent=fmtNum(total);
  calcPayBalance();
}

function calcPayBalance(){
  // ดึงยอดรวมจาก pay-total
  var totalEl=document.getElementById('pay-total');
  var total=parsePayVal(totalEl?totalEl.textContent:'0');
  // รวมยอดชำระจากทุก rows
  var paidSum=0;
  document.querySelectorAll('.pay-row-amt').forEach(function(el){
    paidSum+=parsePayVal(el.value);
  });
  var balance=total-paidSum;
  var balEl=document.getElementById('pay-balance');
  var psEl=document.getElementById('pay-paid-sum');
  var trEl=document.getElementById('pay-total-right');
  if(balEl){balEl.textContent=fmtNum(balance);balEl.style.color=balance>0?'#dc2626':'#16a34a';}
  if(psEl)psEl.textContent=fmtNum(paidSum);
  if(trEl)trEl.textContent=fmtNum(total);
}

function savePayment(){
  if(!paySelectedCust){toast('กรุณาเลือกลูกค้าก่อน','error');return;}
  var ins=parsePayVal(document.getElementById('pay-ins').value);
  var insp=parsePayVal(document.getElementById('pay-inspect').value);
  var gas=parsePayVal(document.getElementById('pay-gas').value);
  var tax=parsePayVal(document.getElementById('pay-tax').value);
  var discEl=document.getElementById('pay-discount');
  var disc=discEl&&discEl.value&&discEl.value!=='0.00'?parsePayVal(discEl.value):0;
  var oth=parsePayVal(document.getElementById('pay-other').value);
  var othLabel=document.getElementById('pay-other-label').value.trim();
  var total=ins+insp+gas+tax+oth-disc;
  var note=document.getElementById('pay-note').value.trim();
  if(total===0){toast('กรุณาใส่ยอดค่าใช้จ่าย','error');return;}
  // เก็บ rows ที่มีข้อมูล
  var payRows=[];
  var paidSum=0;
  document.querySelectorAll('#pay-rows > div').forEach(function(row){
    var dRaw=(row.querySelector('.pay-row-date').value||'').trim();
    var a=parsePayVal(row.querySelector('.pay-row-amt').value);
    if(dRaw&&a>0){
      // แปลง DD/MM/YYYY(BE) → YYYY-MM-DD(CE)
      var parts=dRaw.split('/');
      var dateStr=dRaw;
      if(parts.length===3&&parts[2].length===4){
        var yr=parseInt(parts[2]);
        var ceYr=yr>2400?yr-543:yr; // ถ้าเป็น พ.ศ. แปลงเป็น ค.ศ.
        dateStr=ceYr+'-'+parts[1].padStart(2,'0')+'-'+parts[0].padStart(2,'0');
      }
      payRows.push({date:dateStr,displayDate:dRaw,amount:a});
      paidSum+=a;
    }
  });
  // อนุญาตบันทึกโดยไม่มีวันที่/ยอด (เพิ่มรายการไว้ก่อนได้)
  // เช็คซ้ำ - ทะเบียนรถ (1 ทะเบียน = 1 record) เฉพาะตอนเพิ่มใหม่เท่านั้น
  if(!window._editPayId){
    var plate=paySelectedCust.plate||'';
    var dupCheck=allPayments.find(function(p){return p.plate===plate;});
    if(dupCheck){
      toast('⚠️ ทะเบียน '+plate+' มีรายการอยู่แล้ว กรุณาเปิดรายการเดิมเพื่อเพิ่มงวดชำระ','error');
      return;
    }
  }
  var samePlate=customers.filter(function(x){return x.plate&&x.plate===paySelectedCust.plate;});
  var data={
    custId:paySelectedCust.id,custName:fullName(paySelectedCust),
    plate:paySelectedCust.plate||'',car:(paySelectedCust.brand||'')+' '+(paySelectedCust.model||''),
    payRows:payRows,payDate:payRows.length?payRows[0].date:'',
    insAmount:ins,inspectAmount:insp,gasAmount:gas,taxAmount:tax,
    discountAmount:disc,otherAmount:oth,otherLabel:othLabel,totalAmount:total,paidAmount:paidSum,
    balance:total-paidSum,note:note,policyCount:samePlate.length,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn=document.getElementById('pay-save-btn');
  if(btn)btn.disabled=true;
  var saveOp;
  if(window._editPayId){
    // update record เดิม
    saveOp=db.collection('payments').doc(window._editPayId).update({
      payRows:data.payRows,
      payDate:data.payDate,
      insAmount:data.insAmount,
      inspectAmount:data.inspectAmount,
      gasAmount:data.gasAmount,
      taxAmount:data.taxAmount,
      discountAmount:data.discountAmount,
      otherAmount:data.otherAmount,
      otherLabel:data.otherLabel,
      totalAmount:data.totalAmount,
      paidAmount:data.paidAmount,
      balance:data.balance,
      note:data.note,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    saveOp=db.collection('payments').add(data);
  }
  var isNew=!window._editPayId;
  saveOp.then(function(){
    toast('✅ บันทึกเรียบร้อย');
    payDirty=false;
    window._editPayId=null;
    if(isNew){
      payResetForm();
      document.getElementById('pay-form-title').textContent='➕ เพิ่มรายการรับชำระ';
      setTimeout(function(){var s=document.getElementById('pay-search');if(s)s.focus();},80);
    } else {
      closePayForm();
    }
    loadAllPayments();
    if(btn)btn.disabled=false;
  }).catch(function(e){
    toast('บันทึกไม่สำเร็จ: '+e.message,'error');
    if(btn)btn.disabled=false;
  });
}

function loadAllPayments(){
  var tbody=document.getElementById('pay-list-tbody');
  if(!tbody)return;
  tbody.innerHTML='<tr><td colspan="8" style="padding:20px;text-align:center;font-size:12px;color:#94a3b8">กำลังโหลด...</td></tr>';
  db.collection('payments').orderBy('createdAt','desc').limit(200).get().then(function(snap){
    allPayments=[];
    snap.forEach(function(doc){allPayments.push(Object.assign({id:doc.id},doc.data()));});
    // เรียงตามชื่อลูกค้า (ตัด prefix ออกก่อนเรียง เพื่อให้เรียง ก-ฮ ตามชื่อจริง)
    allPayments.sort(function(a,b){
      return stripPrefix(a.custName).localeCompare(stripPrefix(b.custName),'th');
    });
    allPaymentsFiltered=allPayments.slice();
    renderPayList();
  }).catch(function(e){
    tbody.innerHTML='<tr><td colspan="8" style="padding:12px;text-align:center;font-size:12px;color:#ef4444">โหลดไม่สำเร็จ</td></tr>';
  });
}

function filterPayList(){
  var q=(document.getElementById('pay-list-search').value||'').trim().toLowerCase();
  allPaymentsFiltered=!q?allPayments.slice():allPayments.filter(function(p){
    return (p.custName||'').toLowerCase().includes(q)||(p.plate||'').toLowerCase().includes(q);
  });
  paySelIdx=-1;
  renderPayList();
}

function renderPayList(){
  var tbody=document.getElementById('pay-list-tbody');
  if(!tbody)return;

  // คำนวณยอดค้างรวมทั้งหมดจาก allPaymentsFiltered
  var totalBalance=allPaymentsFiltered.reduce(function(sum,p){return sum+(p.balance>0?p.balance:0);},0);
  var el=document.getElementById('pay-list-total-balance');
  if(el)el.textContent=fmtNum(totalBalance);

  if(!allPaymentsFiltered.length){
    tbody.innerHTML='<tr><td colspan="8" style="padding:20px;text-align:center;font-size:12px;color:#94a3b8">ยังไม่มีรายการ</td></tr>';
    return;
  }
  tbody.innerHTML='';
  allPaymentsFiltered.forEach(function(p,i){
    var tr=document.createElement('tr');
    tr.style.cssText='cursor:pointer;border-bottom:1px solid #f1f5f9';
    tr.dataset.i=i;
    tr.dataset.pid=p.id;
    tr.onmouseover=function(){if(paySelIdx!==i)this.style.background='#bfdbfe';};
    tr.onmouseout=function(){if(paySelIdx!==i)this.style.background='';};
    if(paySelIdx===i&&paySelMode!=='delete'){tr.style.background='#bbf7d0';tr.style.fontWeight='600';tr.setAttribute('data-selected','1');}
    if(paySelIdx===i&&paySelMode==='delete'){tr.style.background='#fecaca';tr.style.fontWeight='600';tr.setAttribute('data-selected','1');}
    var balColor=p.balance>0?'#dc2626':'#16a34a';
    var balBadge=p.balance>0
      ?'<span style="background:#fee2e2;color:#dc2626;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600">ค้าง '+fmtNum(p.balance)+'</span>'
      :'<span style="background:#dcfce7;color:#16a34a;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600">✓ ชำระครบ</span>';
    tr.innerHTML=
      '<td style="padding:5px 12px;font-size:13px;font-weight:500">'+esc(p.custName||'-')+'</td>'
      +'<td style="padding:5px 12px;font-size:12px;color:#334155">'+esc(p.plate||'-')+'</td>'
      +'<td style="padding:5px 12px;font-size:12px;color:#64748b">'+esc(p.car||'-')+'</td>'
      +'<td style="padding:5px 12px;font-size:12px">'
      +(p.payRows&&p.payRows.length>1?'<span style="background:#e0f2fe;color:#0369a1;border-radius:4px;padding:1px 5px;font-size:11px;margin-right:4px">'+p.payRows.length+' งวด</span>':'')
      +(function(){
        // หาวันที่งวดล่าสุด (payRows ตัวสุดท้ายที่มีข้อมูล)
        if(p.payRows&&p.payRows.length){
          var lastRow=null;
          for(var ri=p.payRows.length-1;ri>=0;ri--){
            if(p.payRows[ri].date&&p.payRows[ri].amount>0){lastRow=p.payRows[ri];break;}
          }
          if(lastRow)return fmtDate(lastRow.date);
        }
        return fmtDate(p.payDate);
      })()+'</td>'
      +'<td style="padding:5px 12px;font-size:12px;text-align:right">'+fmtNum(p.totalAmount)+'</td>'
      +'<td style="padding:5px 12px;font-size:12px;text-align:right;color:#16a34a;font-weight:500">'+fmtNum(p.paidAmount)+'</td>'
      +'<td style="padding:5px 12px">'+balBadge+'</td>'
      +'<td style="padding:5px 8px;text-align:center" id="del-td-'+p.id+'"></td>';
    var delBtn=document.createElement('button');
    delBtn.textContent='🗑️';
    delBtn.title='ลบ';
    delBtn.style.cssText='background:none;border:none;cursor:pointer;font-size:15px;color:#ef4444;padding:2px 4px;border-radius:4px';
    (function(pid){delBtn.onclick=function(e){e.stopPropagation();payDeleteRecord(pid);};})(p.id);
    var td=tr.querySelector('#del-td-'+p.id);
    if(td)td.appendChild(delBtn);
    tbody.appendChild(tr);
  });
}

function payNavUpdate(){
  var wrap=document.getElementById('pay-nav-wrap');
  var pos=document.getElementById('pay-nav-pos');
  if(!wrap||!pos)return;
  var total=allPaymentsFiltered.length;
  if(paySelIdx<0||total===0){wrap.style.display='none';return;}
  wrap.style.display='flex';
  pos.textContent=(paySelIdx+1)+'/'+total;
  wrap.querySelector('button:first-child').disabled=paySelIdx<=0;
  wrap.querySelector('button:last-child').disabled=paySelIdx>=total-1;
}
function payNavPrev(){
  if(paySelIdx<=0)return;
  paySelIdx--;
  renderPayList();
  var p=allPaymentsFiltered[paySelIdx];
  if(p)payOpenDetail(p.id);
}
function payNavNext(){
  if(paySelIdx>=allPaymentsFiltered.length-1)return;
  paySelIdx++;
  renderPayList();
  var p=allPaymentsFiltered[paySelIdx];
  if(p)payOpenDetail(p.id);
}
function payOpenDetail(id){
  var p=allPaymentsFiltered.find(function(x){return x.id===id;})||allPayments.find(function(x){return x.id===id;});
  if(!p)return;
  // เปิด form ในโหมดดู/แก้ไข
  payResetForm();
  document.getElementById('pay-form-title').textContent='📋 รายละเอียดการชำระ';
  ovShow('ov-pay-form');
  payNavUpdate();
  // ค้นหาลูกค้าและ fill ข้อมูล
  var c=customers.find(function(x){return x.id===p.custId;});
  if(c){
    document.getElementById('pay-search').value=fullName(c);
    paySelectCust(c.id);
  }
  // เก็บ id ของ record เดิมไว้สำหรับ update
  window._editPayId = p.id;
  document.getElementById('pay-save-btn').textContent='💾 บันทึก [F10]';
  // clear ทุก field ก่อน แล้วค่อย fill ใหม่
  ['pay-ins','pay-inspect','pay-gas','pay-tax','pay-discount','pay-other','pay-other-label'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  // fill expense fields จาก record เดิม
  var _fields={
    'pay-ins':'insAmount','pay-inspect':'inspectAmount',
    'pay-gas':'gasAmount','pay-tax':'taxAmount',
    'pay-discount':'discountAmount','pay-other':'otherAmount'
  };
  Object.keys(_fields).forEach(function(elId){
    var el=document.getElementById(elId);
    if(el&&p[_fields[elId]]){el.value=p[_fields[elId]];}
  });
  var otherLbl=document.getElementById('pay-other-label');
  if(otherLbl)otherLbl.value=p.otherLabel||'';
  // format ทันที
  ['pay-ins','pay-inspect','pay-gas','pay-tax','pay-discount','pay-other'].forEach(function(id){
    var el=document.getElementById(id);
    if(el&&el.value)fmtPayBlur(el);
  });

  // สร้าง rows ให้พอรองรับของเดิม + ใหม่
  var existRows=(p.payRows||[]).length;
  var totalRows=Math.max(10, existRows+3);

  setTimeout(function(){
    buildPayRows(totalRows, true);
    var rows=document.querySelectorAll('#pay-rows > div');
    if(p.payRows&&p.payRows.length){
      p.payRows.forEach(function(r,i){
        if(i<rows.length){
          var di=rows[i].querySelector('.pay-row-date');
          var ai=rows[i].querySelector('.pay-row-amt');
          if(di){
            var parts=(r.date||'').split('-');
            if(parts.length===3){
              var beYear=parseInt(parts[0])+543;
              di.value=parts[2]+'/'+parts[1]+'/'+beYear;
              // trigger label
              var lbl=di.parentNode&&di.parentNode.querySelector('.pay-date-label');
              if(lbl){lbl.textContent=parts[2]+'/'+parts[1]+'/'+beYear;lbl.style.display='block';}
            } else { di.value=r.displayDate||r.date||''; }
          }
          if(ai){ai.value=r.amount||'';if(ai.value)fmtPayBlur(ai);}
        }
      });
    }
    calcPayTotal();
  },150);
}


function payDeleteRecord(id){
  var p=allPayments.find(function(x){return x.id===id;});
  var name=p?p.custName||'-':'รายการนี้';
  var detail=p?'ทะเบียน: '+(p.plate||'-'):'';
  cfNoCallback=function(){
    window._payNoJustFired=true;
    paySelMode='select';
    renderPayList();
    setTimeout(function(){window._payNoJustFired=false;},200);
  };
  showConfirm('🗑️','ลบรายการชำระ',name,detail,'รายการนี้จะถูกลบถาวร','ลบ',function(){
    db.collection('payments').doc(id).delete().then(function(){
      toast('ลบเรียบร้อย');
      allPayments=allPayments.filter(function(x){return x.id!==id;});
      allPaymentsFiltered=allPaymentsFiltered.filter(function(x){return x.id!==id;});
      paySelIdx=-1;
      renderPayList();
      var s=document.getElementById('pay-list-search');
      if(s)setTimeout(function(){s.focus();},100);
    }).catch(function(e){toast('ลบไม่สำเร็จ: '+e.message,'error');});
  });
}

// keyboard nav for payment list
document.addEventListener('keydown', function(e){
  if(!ovIsOpen('ov-payment')||ovIsOpen('ov-pay-form'))return;
  if(e.key===' '){
    e.preventDefault();
    var s=document.getElementById('pay-list-search');
    if(s)s.focus();
    return;
  }
  if(e.key==='ArrowDown'){
    e.preventDefault();
    paySelIdx=Math.min(paySelIdx+1, allPaymentsFiltered.length-1);paySelMode='select';
    renderPayList();
    scrollPaySel();
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    paySelIdx=Math.max(paySelIdx-1, 0);paySelMode='select';
    renderPayList();
    scrollPaySel();
  } else if(e.key==='Home'){
    e.preventDefault();
    if(!allPaymentsFiltered.length)return;
    paySelIdx=0;paySelMode='select';
    renderPayList();scrollPaySel();
  } else if(e.key==='End'){
    e.preventDefault();
    if(!allPaymentsFiltered.length)return;
    paySelIdx=allPaymentsFiltered.length-1;paySelMode='select';
    renderPayList();scrollPaySel();
  } else if(e.key==='PageDown'){
    e.preventDefault();
    if(!allPaymentsFiltered.length)return;
    var payPgSize=Math.max(1,Math.floor((document.getElementById('pay-list-body').clientHeight||400)/36));
    paySelIdx=Math.min(paySelIdx+payPgSize, allPaymentsFiltered.length-1);paySelMode='select';
    renderPayList();scrollPaySel();
  } else if(e.key==='PageUp'){
    e.preventDefault();
    if(!allPaymentsFiltered.length)return;
    var payPgSize2=Math.max(1,Math.floor((document.getElementById('pay-list-body').clientHeight||400)/36));
    paySelIdx=Math.max(0, paySelIdx-payPgSize2);paySelMode='select';
    renderPayList();scrollPaySel();
  } else if(e.key==='Enter'){
    e.preventDefault();
    if(ovIsOpen('ov-confirm')){
      // กด Enter = กดปุ่มที่ focus อยู่ใน confirm (ป้องกันลบโดยไม่ตั้งใจ)
      var nb=document.getElementById('cf-no');
      var yb=document.getElementById('cf-yes');
      if(document.activeElement===nb){if(nb)nb.click();}
      else{if(yb)yb.click();}
      return;
    }
    if(paySelIdx>=0&&allPaymentsFiltered[paySelIdx]){
      payOpenDetail(allPaymentsFiltered[paySelIdx].id);
    }
  } else if(e.key==='Delete'){
    e.preventDefault();
    e.stopPropagation();
    if(!ovIsOpen('ov-confirm')&&paySelIdx>=0&&allPaymentsFiltered[paySelIdx]){
      paySelMode='delete';renderPayList();
      payDeleteRecord(allPaymentsFiltered[paySelIdx].id);
    }
  }
});

// Space ใน pay-form → focus search
document.addEventListener('keydown', function(e){
  if(!ovIsOpen('ov-pay-form'))return;
  var active=document.activeElement;
  var isPayInput=active&&(active.classList.contains('pay-row-date')||active.classList.contains('pay-row-amt'));
  if(e.key===' '&&!isPayInput&&active&&active.tagName!=='INPUT'&&active.tagName!=='TEXTAREA'){
    e.preventDefault();
    var s=document.getElementById('pay-search');
    if(s)s.focus();
  }
  // ← → เลื่อนรายการ (เฉพาะตอนไม่ได้ focus input)
  var inInput=active&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA'||active.tagName==='SELECT');
  if(!inInput&&window._editPayId){
    if(e.key==='ArrowLeft'){e.preventDefault();payNavPrev();}
    else if(e.key==='ArrowRight'){e.preventDefault();payNavNext();}
  }
});

// keyboard nav in pay-form panel right (pay-rows)
document.addEventListener('keydown', function(e){
  if(!ovIsOpen('ov-pay-form'))return;
  var active=document.activeElement;
  if(!active)return;
  var isDate=active.classList.contains('pay-row-date');
  var isAmt=active.classList.contains('pay-row-amt');
  if(!isDate&&!isAmt)return;

  var rows=Array.from(document.querySelectorAll('#pay-rows > div'));
  var curRow=active.closest('div[style]');
  var curIdx=rows.indexOf(curRow);
  if(curIdx===-1)return;

  if(e.key==='ArrowDown'||e.key==='Enter'){
    e.preventDefault();
    var nextRow=rows[curIdx+1];
    if(nextRow){
      var nextInput=isDate?nextRow.querySelector('.pay-row-date'):nextRow.querySelector('.pay-row-amt');
      if(nextInput)nextInput.focus();
    }
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    var prevRow=rows[curIdx-1];
    if(prevRow){
      var prevInput=isDate?prevRow.querySelector('.pay-row-date'):prevRow.querySelector('.pay-row-amt');
      if(prevInput)prevInput.focus();
    }
  } else if(e.key==='ArrowRight'&&isDate){
    e.preventDefault();
    var amtInput=curRow.querySelector('.pay-row-amt');
    if(amtInput)amtInput.focus();
  } else if(e.key==='ArrowLeft'&&isAmt){
    e.preventDefault();
    var dateInput=curRow.querySelector('.pay-row-date');
    if(dateInput)dateInput.focus();
  }
});

function scrollPaySel(){
  var sel=document.querySelector('#pay-list-tbody tr[data-selected="1"]');
  if(!sel)return;
  var body=document.getElementById('pay-list-body');
  var thead=body?body.querySelector('thead'):null;
  if(body&&thead){
    var selRect=sel.getBoundingClientRect();
    var bodyRect=body.getBoundingClientRect();
    var headH=thead.offsetHeight;
    if(selRect.top<bodyRect.top+headH){
      body.scrollTop+= (selRect.top-(bodyRect.top+headH));
      return;
    }
    if(selRect.bottom>bodyRect.bottom){
      body.scrollTop+=(selRect.bottom-bodyRect.bottom);
      return;
    }
    return;
  }
  sel.scrollIntoView({block:'nearest'});
}


// Pay modal keyboard handler - capture phase
document.addEventListener('keydown', function(e){
  // ถ้า pay modal ไม่เปิด ปล่อยผ่าน
  if(!ovIsOpen('ov-pay-form')&&!ovIsOpen('ov-payment'))return;
  if(ovIsOpen('ov-confirm'))return;

  if(e.key==='Escape'){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    window._payEscHandled=true;
    if(ovIsOpen('ov-pay-form')){closePayForm();return;}
    if(ovIsOpen('ov-payment')){closePayment();return;}
  } else if(e.key==='F10'){
    if(ovIsOpen('ov-pay-form')){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      savePayment();return;
    }
  } else if(e.key==='Insert'){
    if(ovIsOpen('ov-payment')&&!ovIsOpen('ov-pay-form')){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      payNewForm();return;
    }
  } else if(!ovIsOpen('ov-pay-form')&&!ovIsOpen('ov-payment')){
    return; // ปล่อยผ่านถ้าไม่ใช่ key ที่สนใจ
  }
}, true);


// Scroll wheel + click สำหรับ payment list (เหมือนรายชื่อลูกค้า)
var payScrollSelected=false;
(function(){
  function addPayWheel(){
    var tw=document.getElementById('pay-list-body');
    if(!tw){setTimeout(addPayWheel,500);return;}
    // wheel - เลื่อน selIdx
    tw.addEventListener('wheel',function(e){
      if(!ovIsOpen('ov-payment')||ovIsOpen('ov-pay-form'))return;
      e.preventDefault();
      if(!allPaymentsFiltered.length)return;
      if(e.deltaY>0){
        paySelIdx=Math.min(paySelIdx+1, allPaymentsFiltered.length-1);
      } else {
        paySelIdx=Math.max(0, paySelIdx<=0?0:paySelIdx-1);
      }
      paySelMode='select';
      payScrollSelected=true;
      renderPayList();
      scrollPaySel();
    },{passive:false});
    // mousemove - ล้าง scrollSelected
    tw.addEventListener('mousemove',function(){
      payScrollSelected=false;
    },{passive:true});
    // click - ถ้า scroll เลือกไว้แล้ว click=เปิด detail
    // click delegation — เหมือน card 1 ใช้ data-i/data-pid แทน inline onclick
    var tbody=document.getElementById('pay-list-tbody');
    if(tbody){
      tbody.addEventListener('click',function(e){
        if(ovIsOpen('ov-confirm'))return;
        // ghost-click guard: ถ้ากด NO เพิ่งเสร็จ ห้าม open detail
        if(window._payNoJustFired){window._payNoJustFired=false;return;}
        var delBtn=e.target.closest('button');if(delBtn)return; // ปล่อยให้ delBtn จัดการเอง
        var tr=e.target.closest('tr[data-i]');if(!tr)return;
        if(payScrollSelected){
          e.stopImmediatePropagation();
          e.preventDefault();
          payScrollSelected=false;
          var p2=allPaymentsFiltered[paySelIdx];
          if(p2)payOpenDetail(p2.id);
          return;
        }
        var idx=+tr.dataset.i;var pid=tr.dataset.pid;
        paySelIdx=idx;paySelMode='select';
        renderPayList();
        payOpenDetail(pid);
      },true);
    }
  }
  addPayWheel();
})();


// Del key ล้าง field ที่ cursor อยู่
document.addEventListener('keydown', function(e){
  if(e.key!=='Delete')return;
  var el=document.activeElement;
  if(!el)return;
  var tag=el.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'){
    if(el.value!==''){
      e.preventDefault();
      el.value='';
      // trigger events
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  } else if(tag==='SELECT'){
    e.preventDefault();
    el.selectedIndex=0;
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
}, false);

// ===== PAYMENT HISTORY =====
function loadPayHist(custId){
  var list=document.getElementById('pay-hist-list');
  if(!list)return;
  list.innerHTML='<div style="font-size:12px;color:#94a3b8;padding:8px">กำลังโหลด...</div>';
  db.collection('payments')
    .where('custId','==',custId)
    .orderBy('createdAt','desc')
    .get()
    .then(function(snap){
      if(snap.empty){
        list.innerHTML='<div style="font-size:12px;color:#94a3b8;padding:12px;text-align:center">ยังไม่มีประวัติการชำระ</div>';
        return;
      }
      var html='';
      snap.forEach(function(doc){
        var d=doc.data();
        var items=[];
        if(d.insAmount)items.push('เบี้ยประกัน: '+fmtNum(d.insAmount));
        if(d.inspectAmount)items.push('ตรวจสภาพ: '+fmtNum(d.inspectAmount));
        if(d.gasAmount)items.push('ถังแก๊ส: '+fmtNum(d.gasAmount));
        if(d.taxAmount)items.push('ต่อภาษี: '+fmtNum(d.taxAmount));
        if(d.otherAmount)items.push((d.otherLabel||'อื่นๆ')+': '+fmtNum(d.otherAmount));
        var balColor=d.balance>0?'#dc2626':'#16a34a';
        html+='<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#fff">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
            +'<span style="font-weight:600;font-size:13px;color:#1a4f8a">📅 '+fmtDate(d.payDate)+'</span>'
            +'<span style="font-size:11px;color:#64748b">'+esc(d.plate||'-')+'</span>'
          +'</div>'
          +'<div style="font-size:12px;color:#475569;margin-bottom:6px">'+items.join(' · ')+'</div>'
          +'<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;padding-top:6px">'
            +'<div style="font-size:12px">'
              +'<span style="color:#64748b">ยอดรวม: </span><span style="font-weight:600">'+fmtNum(d.totalAmount)+'</span>'
              +' <span style="color:#64748b">ชำระ: </span><span style="font-weight:600;color:#16a34a">'+fmtNum(d.paidAmount)+'</span>'
            +'</div>'
            +'<div style="font-size:12px;font-weight:700;color:'+balColor+'">คงค้าง: '+fmtNum(d.balance)+'</div>'
          +'</div>'
          +(d.note?'<div style="font-size:11px;color:#94a3b8;margin-top:4px">หมายเหตุ: '+esc(d.note)+'</div>':'')
          +'</div>';
      });
      list.innerHTML=html;
    })
    .catch(function(e){
      list.innerHTML='<div style="font-size:12px;color:#ef4444;padding:8px">โหลดไม่สำเร็จ: '+e.message+'</div>';
    });
}

// ===== FILE UPLOAD (Firebase Storage) =====
function fileIcon(name){
  var ext=(name.split('.').pop()||'').toLowerCase();
  if(['jpg','jpeg','png','gif','webp'].includes(ext))return '🖼️';
  if(ext==='pdf')return '📄';
  if(['doc','docx'].includes(ext))return '📝';
  return '📎';
}
function fmtSize(bytes){
  if(bytes<1024)return bytes+'B';
  if(bytes<1024*1024)return (bytes/1024).toFixed(1)+'KB';
  return (bytes/(1024*1024)).toFixed(1)+'MB';
}

function loadFiles(custId){
  var list=document.getElementById('file-list');
  if(!list)return;
  list.innerHTML='<div style="font-size:11px;color:#94a3b8;padding:4px">กำลังโหลด...</div>';
  storage.ref('customers/'+custId).listAll().then(function(res){
    if(res.items.length===0){list.innerHTML='<div style="font-size:11px;color:#94a3b8;padding:4px">ยังไม่มีไฟล์แนบ</div>';return;}
    list.innerHTML='';
    res.items.forEach(function(itemRef){
      itemRef.getMetadata().then(function(meta){
        itemRef.getDownloadURL().then(function(url){
          var div=document.createElement('div');
          div.className='file-item';
          // สร้าง DOM nodes แทน innerHTML เพื่อหลีกเลี่ยง quote ปัญหา
          var icon=document.createElement('span');
          icon.className='file-item-icon';icon.textContent=fileIcon(meta.name);
          var nm=document.createElement('span');
          nm.className='file-item-name';nm.title=meta.name;nm.textContent=meta.name;
          var sz=document.createElement('span');
          sz.className='file-item-size';sz.textContent=fmtSize(meta.size);
          var acts=document.createElement('div');
          acts.className='file-item-actions';
          var viewBtn=document.createElement('button');
          viewBtn.className='file-item-btn';viewBtn.title='เปิดดู';viewBtn.textContent='👁️';
          viewBtn.onclick=function(){window.open(url,'_blank');};
          var delBtn=document.createElement('button');
          delBtn.className='file-item-btn';delBtn.title='ลบ';delBtn.textContent='🗑️';
          (function(cid,fname,el){
            delBtn.onclick=function(){deleteFile(cid,fname,el);};
          })(custId,meta.name,div);
          acts.appendChild(viewBtn);acts.appendChild(delBtn);
          div.appendChild(icon);div.appendChild(nm);div.appendChild(sz);div.appendChild(acts);
          list.appendChild(div);
        });
      });
    });
  }).catch(function(e){
    list.innerHTML='<div style="font-size:11px;color:#ef4444">โหลดไฟล์ไม่ได้: '+e.message+'</div>';
  });
}

function uploadFiles(input){
  var files=input.files;
  if(!files||!files.length)return;
  if(!detailId){toast('กรุณาเปิดข้อมูลลูกค้าก่อน','error');return;}
  var wrap=document.getElementById('upload-progress-wrap');
  var bar=document.getElementById('upload-bar');
  var status=document.getElementById('upload-status');
  var total=files.length, done=0;
  wrap.style.display='block';

  Array.from(files).forEach(function(file){
    if(file.size>10*1024*1024){toast('ไฟล์ '+file.name+' ใหญ่เกิน 10MB','error');done++;return;}
    var ref=storage.ref('customers/'+detailId+'/'+Date.now()+'_'+file.name);
    var task=ref.put(file);
    task.on('state_changed',
      function(snap){
        var pct=Math.round(snap.bytesTransferred/snap.totalBytes*100);
        bar.style.width=pct+'%';
        status.textContent='อัปโหลด '+file.name+' ('+pct+'%)';
      },
      function(err){toast('อัปโหลดล้มเหลว: '+err.message,'error');done++;if(done===total)wrap.style.display='none';},
      function(){
        done++;
        if(done===total){
          wrap.style.display='none';
          bar.style.width='0%';
          toast('อัปโหลดสำเร็จ '+total+' ไฟล์ ✅');
          loadFiles(detailId);
          document.getElementById('file-input').value='';
        }
      }
    );
  });
}

function deleteFile(custId,name,el){
  if(!confirm('ลบไฟล์ "'+name+'" ?'))return;
  // หา full path จาก file list
  storage.ref('customers/'+custId).listAll().then(function(res){
    var match=res.items.find(function(i){return i.name===name||i.fullPath.includes(name);});
    if(!match){toast('ไม่พบไฟล์','error');return;}
    match.delete().then(function(){
      toast('ลบไฟล์เรียบร้อย');
      if(el)el.remove();
    }).catch(function(e){toast('ลบไม่ได้: '+e.message,'error');});
  });
}

// REPORT
function openReport(){
  hideMainMenu();
  // set เดือนปัจจุบันทุกครั้งที่เปิด
  var now=new Date();
  var mm=('0'+(now.getMonth()+1)).slice(-2);
  var sel=document.getElementById('rpt-month');
  if(sel){sel.value='';sel.selectedIndex=0;} // clear ก่อน
  if(sel){sel.value=mm;}                     // แล้วค่อย set เดือนปัจจุบัน
  var countEl=document.getElementById('rpt-count');
  if(countEl)countEl.textContent='';         // clear จำนวน
  updateRptCount();
  ovShow('ov-report');
}
function closeReport(){
  ovHide('ov-report');
  showMainMenu();
}
function updateRptCount(){
  var mm=document.getElementById('rpt-month').value;
  var yr=new Date().getFullYear().toString();
  // ปีปัจจุบัน พ.ศ. = ค.ศ.+543 แต่ข้อมูลเก็บเป็น ค.ศ. (YYYY-MM-DD)
  var yrBE2=(Number(yr)+543).toString();
  var list=customers.filter(function(c){
    if(!c.end)return false;
    var parts=String(c.end).split('-');
    if(parts.length!==3)return false;
    return (parts[0]===yr||parts[0]===yrBE2)&&parts[1]===mm;
  });
  var el=document.getElementById('rpt-count');
  if(el)el.textContent='พบ '+list.length+' รายการ ในเดือนนี้';
}
// rpt-month change handled via onchange attribute

function printExpireReport(){
  var mm=document.getElementById('rpt-month').value;
  var yr=new Date().getFullYear().toString();
  var monthNames={
    '01':'มกราคม','02':'กุมภาพันธ์','03':'มีนาคม','04':'เมษายน',
    '05':'พฤษภาคม','06':'มิถุนายน','07':'กรกฎาคม','08':'สิงหาคม',
    '09':'กันยายน','10':'ตุลาคม','11':'พฤศจิกายน','12':'ธันวาคม'
  };
  var yrBE=(Number(yr)+543).toString(); // พ.ศ.
  var list=customers.filter(function(c){
    if(!c.end||c.status==='cancel')return false;
    var parts=String(c.end).split('-');
    if(parts.length!==3)return false;
    // รองรับทั้ง ค.ศ. (2025) และ พ.ศ. (2568)
    return (parts[0]===yr||parts[0]===yrBE)&&parts[1]===mm;
  }).sort(function(a,b){
    // เรียงตามบริษัทประกัน ก่อน แล้ววันสิ้นสุดใกล้ก่อน
    var ca=(a.insco||'').localeCompare(b.insco||'','th');
    if(ca!==0)return ca;
    return(a.end||'')>(b.end||'')?1:(a.end||'')<(b.end||'')?-1:0;
  });

  if(!list.length){toast('ไม่พบข้อมูลในเดือน'+monthNames[mm],'error');return;}

  // สร้างหน้าพิมพ์ เรียงตามบริษัท แสดงชื่อบริษัทเป็น group header
  var rows='';
  var lastInsco='';
  list.forEach(function(c,i){
    if(c.insco!==lastInsco){
      lastInsco=c.insco||'-';
      rows+='<tr class="insco-header"><td colspan="8">'+esc(lastInsco)+'</td></tr>';
    }
    rows+='<tr>'
      +'<td style="text-align:center;color:#94a3b8;font-size:12px">'+(i+1)+'</td>'
      +'<td style="text-align:left;font-size:14px">'+fmtDate(c.end)+'</td>'
      +'<td>'+esc(fullName(c))+'</td>'
      +'<td style="font-size:14px">'+esc(c.plate||'-')+'</td>'
      +'<td style="font-size:14px">'+esc((c.brand||'')+(c.model?' '+c.model:''))+'</td>'
      +'<td style="text-align:left;font-size:14px">'+esc(c.type||'-')+'</td>'
      +'<td style="text-align:left;font-size:14px">'+fmtNum(c.premium)+'</td>'
      +'<td style="text-align:left;font-size:14px">'+fmtNumRpt(c.coverage)+'</td>'
      +'</tr>';
  });

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<title>รายงานสิ้นสุดความคุ้มครอง '+monthNames[mm]+' '+yr+'</title>'
    +'<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">'
    +'<style>'
    +'@page{size:A4 landscape;margin:10mm}'
    +'body{font-family:"Sarabun",sans-serif;font-size:12px;margin:10px}'
    +'h2{text-align:center;color:#1a4f8a;margin-bottom:4px;font-size:18px}'
    +'.sub{text-align:center;color:#64748b;margin-bottom:12px;font-size:12px}'
    +'table{width:100%;border-collapse:collapse;table-layout:fixed}'
    +'th{background:#fff;color:#000;font-weight:700;padding:6px 6px;text-align:left;font-size:13px;white-space:nowrap;border-bottom:2px solid #000;border-top:2px solid #000;overflow:hidden}'
    +'td{padding:5px 6px;border-bottom:1px solid #ccc;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    +'.insco-header td{background:#fff!important;color:#000!important;font-weight:700!important;font-size:14px!important;padding:6px 0;border-top:2px solid #000;border-bottom:1px solid #000;border-left:none;border-right:none;white-space:nowrap}'
    +'tr:nth-child(even) td{background:#f8fafc}'
    +'.footer{margin-top:12px;font-size:10px;color:#94a3b8;text-align:right}'
    +'@media print{'
    +'  body{margin:0}'
    +'  tr:nth-child(even) td{background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +'  thead{display:table-header-group}'
    +'  .insco-header td{background:#fff!important;color:#000!important;font-weight:700!important}'
    +'}'
    +'</style></head><body>'
    +'<h2>รายงานกรมธรรม์สิ้นสุดความคุ้มครอง</h2>'
    +'<div class="sub">เดือน'+monthNames[mm]+' พ.ศ.'+(Number(yr)+543)+' | ทั้งหมด '+list.length+' ราย</div>'
    +'<table><thead><tr>'
    +'<th style="width:3%">#</th>'
    +'<th style="width:10%;text-align:left">วันสิ้นสุด</th>'
    +'<th style="width:23%">ชื่อ-นามสกุล</th>'
    +'<th style="width:10%">ทะเบียน</th>'
    +'<th style="width:13%">ยี่ห้อ/รุ่น</th>'
    +'<th style="width:7%;text-align:left">ประเภท</th>'
    +'<th style="width:10%;text-align:left">เบี้ย(บาท)</th>'
    +'<th style="width:12%;text-align:left">ทุนประกัน(บาท)</th>'
    +'</tr></thead><tbody>'+rows+'</tbody>'
    +'<tfoot><tr><td colspan="7" style="text-align:right;font-weight:600;padding:6px 8px;border-top:2px solid #1a4f8a">รวมเบี้ยทั้งหมด</td>'
    +'<td style="text-align:right;font-weight:700;color:#1a4f8a;padding:6px 8px;border-top:2px solid #1a4f8a">'+fmtNum(list.reduce(function(s,c){return s+Number(c.premium||0);},0))+'</td>'
    +'</tr></tfoot>'
    +'</table>'
    +'<div class="footer">พิมพ์เมื่อ: '+new Date().toLocaleString('th-TH')+'</div>'
    +'</body></html>';

  var w=window.open('','_blank','width=900,height=700');
  w.document.write(html);
  w.document.close();
  setTimeout(function(){w.print();},500);
}

// DASHBOARD
function openDash(){
  renderDash();
  ovShow('ov-dash');
}
function closeDash(){ovHide('ov-dash');}
document.getElementById('ov-dash').addEventListener('click',function(e){if(e.target===this)closeDash();});

function fmtM(n){if(!n)return '0';if(n>=1000000)return (n/1000000).toFixed(2).replace(/\.?0+$/,'')+' ล้าน';if(n>=1000)return (n/1000).toFixed(1).replace(/\.?0+$/,'')+' พัน';return fmtNum(n);}

function renderDash(){
  var active=customers.filter(function(c){var d=daysLeft(c.end);return c.status==='active'&&!(d!==null&&d>=0&&d<=90);});
  var expire=customers.filter(function(c){if(c.status==='cancel')return false;var d=daysLeft(c.end);return d!==null&&d<=90&&d>=0;});
  var cancel=customers.filter(function(c){return c.status==='cancel';});
  var all=customers;
  var totalPr=all.filter(function(c){return c.status!=='cancel';}).reduce(function(a,c){return a+Number(c.premium||0);},0);
  var totalCv=all.filter(function(c){return c.status!=='cancel';}).reduce(function(a,c){return a+Number(c.coverage||0);},0);

  // group by insco
  var coMap={};
  all.forEach(function(c){
    var k=c.insco||'(ไม่ระบุ)';
    if(!coMap[k])coMap[k]={name:k,count:0,pr:0,cv:0,active:0,expire:0,cancel:0};
    coMap[k].count++;coMap[k].pr+=Number(c.premium||0);coMap[k].cv+=Number(c.coverage||0);
    var d=daysLeft(c.end);
    if(c.status==='cancel')coMap[k].cancel++;
    else if(d!==null&&d>=0&&d<=90)coMap[k].expire++;
    else coMap[k].active++;
  });
  var coArr=Object.values(coMap).sort(function(a,b){return b.count-a.count;});
  var maxCo=coArr.length?coArr[0].count:1;

  // group by type
  var tyMap={};
  all.forEach(function(c){
    var k=c.type||'(ไม่ระบุ)';
    if(!tyMap[k])tyMap[k]={name:k,count:0,pr:0,cv:0};
    tyMap[k].count++;tyMap[k].pr+=Number(c.premium||0);tyMap[k].cv+=Number(c.coverage||0);
  });
  var tyArr=Object.values(tyMap).sort(function(a,b){return b.count-a.count;});
  var maxTy=tyArr.length?tyArr[0].count:1;

  // premium ranges
  var prRanges=[
    {label:'< 5,000',min:0,max:4999},
    {label:'5,000–9,999',min:5000,max:9999},
    {label:'10,000–19,999',min:10000,max:19999},
    {label:'20,000–49,999',min:20000,max:49999},
    {label:'50,000+',min:50000,max:Infinity}
  ];
  var prBuckets=prRanges.map(function(r){
    var cnt=all.filter(function(c){var p=Number(c.premium||0);return c.status!=='cancel'&&p>=r.min&&p<=r.max;}).length;
    return {label:r.label,count:cnt};
  });
  var maxPr=Math.max.apply(null,prBuckets.map(function(b){return b.count;}));if(!maxPr)maxPr=1;

  // coverage ranges
  var cvRanges=[
    {label:'< 100,000',min:0,max:99999},
    {label:'100,000–299,999',min:100000,max:299999},
    {label:'300,000–499,999',min:300000,max:499999},
    {label:'500,000–999,999',min:500000,max:999999},
    {label:'1,000,000+',min:1000000,max:Infinity}
  ];
  var cvBuckets=cvRanges.map(function(r){
    var cnt=all.filter(function(c){var v=Number(c.coverage||0);return c.status!=='cancel'&&v>=r.min&&v<=r.max;}).length;
    return {label:r.label,count:cnt};
  });
  var maxCv=Math.max.apply(null,cvBuckets.map(function(b){return b.count;}));if(!maxCv)maxCv=1;

  var colors=['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'];

  function barRow(label,count,max,color,sub){
    var pct=Math.round(count/max*100);
    return '<div style="margin-bottom:7px">'+
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">'+
        '<span style="color:#334155;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%">'+esc(label)+'</span>'+
        '<span style="color:#64748b;font-size:10px">'+(sub||count+' ราย')+'</span>'+
      '</div>'+
      '<div style="background:#f1f5f9;border-radius:99px;height:10px;overflow:hidden">'+
        '<div style="background:'+color+';width:'+pct+'%;height:100%;border-radius:99px;transition:width .4s ease"></div>'+
      '</div>'+
    '</div>';
  }

  function card(title,icon,content){
    return '<div style="background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:14px;margin-bottom:12px">'+
      '<div style="font-weight:600;color:#1a4f8a;font-size:12px;margin-bottom:10px">'+icon+' '+title+'</div>'+
      content+'</div>';
  }

  // KPI row
  var kpi='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px">'+
    kpiBox('👥','ลูกค้าทั้งหมด',all.length+' ราย','#3b82f6')+
    kpiBox('✅','คุ้มครองอยู่',active.length+' ราย','#10b981')+
    kpiBox('⚠️','ใกล้หมดอายุ',expire.length+' ราย','#f59e0b')+
    kpiBox('❌','ยกเลิกแล้ว',cancel.length+' ราย','#ef4444')+
    kpiBox('💰','เบี้ยรวม',fmtM(totalPr)+' บาท','#8b5cf6')+
    kpiBox('🛡️','ทุนรวม',fmtM(totalCv)+' บาท','#06b6d4')+
  '</div>';

  // company bars
  var coHtml=coArr.map(function(c,i){
    return barRow(c.name,c.count,maxCo,colors[i%colors.length],
      c.count+' ราย | เบี้ย '+fmtM(c.pr)+' | ทุน '+fmtM(c.cv));
  }).join('');

  // type bars + donut-like
  var tyTotal=all.length||1;
  var tyHtml=tyArr.map(function(t,i){
    return barRow(t.name,t.count,maxTy,colors[(i+2)%colors.length],
      t.count+' ราย ('+Math.round(t.count/tyTotal*100)+'%) | เบี้ย '+fmtM(t.pr));
  }).join('');

  // premium bars
  var prHtml=prBuckets.map(function(b,i){return barRow(b.label+'  บาท',b.count,maxPr,colors[(i+1)%colors.length]);}).join('');

  // coverage bars
  var cvHtml=cvBuckets.map(function(b,i){return barRow(b.label+'  บาท',b.count,maxCv,colors[(i+3)%colors.length]);}).join('');

  // co x type matrix
  // get all types sorted by frequency
  var allTypes=tyArr.map(function(t){return t.name;});
  // build co x type map
  var coTypeMap={};
  all.forEach(function(c){
    var co=c.insco||'(ไม่ระบุ)';
    var ty=c.type||'(ไม่ระบุ)';
    if(!coTypeMap[co])coTypeMap[co]={};
    coTypeMap[co][ty]=(coTypeMap[co][ty]||0)+1;
  });

  // co table with type breakdown
  var typeColors=['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'];
  var coTypeTableHdr='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">'+
    '<thead><tr style="background:#f1f5f9">'+
    '<th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap;min-width:120px">บริษัทประกัน</th>'+
    '<th style="padding:6px 8px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">รวม</th>'+
    allTypes.map(function(t,i){
      return '<th style="padding:6px 8px;text-align:right;color:'+typeColors[i%typeColors.length]+';font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap">'+esc(t)+'</th>';
    }).join('')+
    '<th style="padding:6px 8px;text-align:right;color:#5b21b6;font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap">เบี้ยรวม</th>'+
    '<th style="padding:6px 8px;text-align:right;color:#0e7490;font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap">ทุนรวม</th>'+
    '</tr></thead><tbody>';

  var coTypeTableRows=coArr.map(function(c,i){
    var ctMap=coTypeMap[c.name]||{};
    return '<tr style="border-bottom:1px solid #f1f5f9;'+(i%2?'background:#fafafa':'background:#fff')+'">'+
      '<td style="padding:6px 8px;font-weight:600;color:#1a202c">'+esc(c.name)+'</td>'+
      '<td style="padding:6px 8px;text-align:right;font-weight:700;color:#1a4f8a">'+c.count+'</td>'+
      allTypes.map(function(t,j){
        var n=ctMap[t]||0;
        return '<td style="padding:6px 8px;text-align:right;color:'+(n?typeColors[j%typeColors.length]:'#cbd5e1')+';font-weight:'+(n?'600':'400')+'">'+
          (n?n:'-')+'</td>';
      }).join('')+
      '<td style="padding:6px 8px;text-align:right;color:#5b21b6;font-size:10px">'+fmtNum(c.pr)+'</td>'+
      '<td style="padding:6px 8px;text-align:right;color:#0e7490;font-size:10px">'+fmtNum(c.cv)+'</td>'+
    '</tr>';
  }).join('');

  // footer row (totals per type)
  var coTypeTableFoot='<tr style="background:#f1f5f9;font-weight:700;border-top:2px solid #e2e8f0">'+
    '<td style="padding:6px 8px;color:#64748b">รวมทั้งหมด</td>'+
    '<td style="padding:6px 8px;text-align:right;color:#1a4f8a">'+all.length+'</td>'+
    allTypes.map(function(t){
      var sum=all.filter(function(c){return (c.type||'(ไม่ระบุ)')===t;}).length;
      return '<td style="padding:6px 8px;text-align:right;color:#374151">'+sum+'</td>';
    }).join('')+
    '<td style="padding:6px 8px;text-align:right;color:#5b21b6">'+fmtNum(totalPr)+'</td>'+
    '<td style="padding:6px 8px;text-align:right;color:#0e7490">'+fmtNum(totalCv)+'</td>'+
  '</tr>';

  var coTypeTable=coTypeTableHdr+coTypeTableRows+coTypeTableFoot+'</tbody></table></div>';

  document.getElementById('dash-body').innerHTML=
    kpi+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      card('แยกตามบริษัทประกัน','🏢',coHtml||'<div style="color:#94a3b8;font-size:11px">ยังไม่มีข้อมูล</div>')+
      card('แยกตามประเภทประกัน','📋',tyHtml||'<div style="color:#94a3b8;font-size:11px">ยังไม่มีข้อมูล</div>')+
      card('การกระจายเบี้ยประกัน','💰',prHtml||'<div style="color:#94a3b8;font-size:11px">ยังไม่มีข้อมูล</div>')+
      card('การกระจายทุนประกัน','🛡️',cvHtml||'<div style="color:#94a3b8;font-size:11px">ยังไม่มีข้อมูล</div>')+
    '</div>'+
    card('จำนวนประเภทประกัน แยกตามบริษัทประกัน','📊',coTypeTable||'<div style="color:#94a3b8;font-size:11px">ยังไม่มีข้อมูล</div>');

  document.getElementById('dash-updated').textContent='อัปเดต: '+new Date().toLocaleTimeString('th-TH');
}

function kpiBox(icon,label,val,color){
  return '<div style="background:#fff;border-radius:8px;padding:10px 12px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid '+color+'">'+
    '<div style="font-size:10px;color:#64748b">'+icon+' '+label+'</div>'+
    '<div style="font-size:15px;font-weight:700;color:'+color+';margin-top:3px">'+val+'</div>'+
  '</div>';
}

// SETTINGS
function openSettings(){hideMainMenu();fillSelects();renderSlPx();renderSlType();renderSlCo();renderSlBr();renderSlModel();ovShow('ov-settings');}
function closeSettings(){ovHide('ov-settings');showMainMenu();}
function renderSlPx(){document.getElementById('sl-px').innerHTML=sortArr(prefixes).map(function(p){return '<div class="settings-item"><span>'+esc(p)+'</span><button class="btn btn-sm btn-danger" onclick="slDel(\'px\',\''+esc(p)+'\')">✕</button></div>';}).join('')||'<div style="font-size:10px;color:#94a3b8">ยังไม่มี</div>';}
function renderSlType(){document.getElementById('sl-type').innerHTML=sortArr(insTypes).map(function(t){return '<div class="settings-item"><span>'+esc(t)+'</span><button class="btn btn-sm btn-danger" onclick="slDel(\'type\',\''+esc(t)+'\')">✕</button></div>';}).join('')||'<div style="font-size:10px;color:#94a3b8">ยังไม่มี</div>';}
function renderSlCo(){document.getElementById('sl-co').innerHTML=sortArr(insCos).map(function(c){return '<div class="settings-item"><span>'+esc(c)+'</span><button class="btn btn-sm btn-danger" onclick="slDel(\'co\',\''+esc(c)+'\')">✕</button></div>';}).join('')||'<div style="font-size:10px;color:#94a3b8">ยังไม่มี</div>';}
function renderSlBr(){document.getElementById('sl-br').innerHTML=sortArr(brands).map(function(b){return '<div class="settings-item"><span>'+esc(b)+'</span><button class="btn btn-sm btn-danger" onclick="slDel(\'br\',\''+esc(b)+'\')">✕</button></div>';}).join('')||'<div style="font-size:10px;color:#94a3b8">ยังไม่มี</div>';}
function renderSlModel(){
  var br=document.getElementById('sl-br-sel').value;var el=document.getElementById('sl-mo');
  if(!br){el.innerHTML='<div style="font-size:10px;color:#94a3b8">เลือกยี่ห้อก่อน</div>';return;}
  var list=sortArr(models[br]||[]);
  el.innerHTML=list.map(function(m){return '<div class="settings-item"><span>'+esc(m)+'</span><button class="btn btn-sm btn-danger" onclick="slDel(\'mo\',\''+esc(m)+'\',\''+esc(br)+'\')">✕</button></div>';}).join('')||'<div style="font-size:10px;color:#94a3b8">ยังไม่มีรุ่น</div>';
}
function slAdd(k){
  var ids={px:'sl-px-v',type:'sl-type-v',co:'sl-co-v',br:'sl-br-v',mo:'sl-mo-v'};
  var val=document.getElementById(ids[k]).value.trim();if(!val){toast('กรุณากรอกข้อมูล','error');return;}
  var br=document.getElementById('sl-br-sel').value;if(k==='mo'&&!br){toast('กรุณาเลือกยี่ห้อก่อน','error');return;}
  var fns={px:'addPrefix',type:'addInsType',co:'addInsCo',br:'addBrand',mo:'addModel'};
  // อัปเดต local arrays ก่อน แล้ว sync Firestore
  document.getElementById(ids[k]).value='';
  if(k==='px')prefixes.push(val);else if(k==='type')insTypes.push(val);else if(k==='co')insCos.push(val);
  else if(k==='br'){brands.push(val);models[val]=[];}else if(k==='mo'){if(!models[br])models[br]=[];models[br].push(val);}
  fillSelects();
  if(k==='px')renderSlPx();else if(k==='type')renderSlType();else if(k==='co')renderSlCo();
  else if(k==='br'){renderSlBr();renderSlModel();}else renderSlModel();
  toast('✅ เพิ่ม "'+val+'"');
  fsUpdateSettings({insTypes:insTypes,insCos:insCos,brands:brands,models:models,prefixes:prefixes}).catch(function(e){toast('sync error:'+e.message,'error');});
}
function slDel(k,val,br){
  var fns={px:'deletePrefix',type:'deleteInsType',co:'deleteInsCo',br:'deleteBrand',mo:'deleteModel'};
  if(!confirm('ลบ "'+val+'" ?'))return;
  if(k==='px')prefixes=prefixes.filter(function(x){return x!==val;});
  else if(k==='type')insTypes=insTypes.filter(function(x){return x!==val;});
  else if(k==='co')insCos=insCos.filter(function(x){return x!==val;});
  else if(k==='br'){brands=brands.filter(function(x){return x!==val;});delete models[val];}
  else if(k==='mo')models[br]=(models[br]||[]).filter(function(x){return x!==val;});
  fillSelects();
  if(k==='px')renderSlPx();else if(k==='type')renderSlType();else if(k==='co')renderSlCo();
  else if(k==='br'){renderSlBr();renderSlModel();}else renderSlModel();
  toast('🗑️ ลบแล้ว');
  fsUpdateSettings({insTypes:insTypes,insCos:insCos,brands:brands,models:models,prefixes:prefixes}).catch(function(e){toast('sync error:'+e.message,'error');});
}

// EXPORT CSV
function doExportCSV(){
  if(!customers.length){toast('ไม่มีข้อมูล','error');return;}
  var h=['รหัส','คำนำหน้า','ชื่อ','นามสกุล','เบอร์โทร','ที่อยู่','ทะเบียนรถ','ยี่ห้อ','รุ่น','ปีรถ','ประเภทประกัน','บริษัทประกันภัย','เบี้ย(บาท)','ทุนประกัน(บาท)','เริ่มต้นวันที่','สิ้นสุดวันที่','สถานะ','หมายเหตุ'];
  var st={active:'คุ้มครองอยู่',expire:'ใกล้หมดอายุ',cancel:'ยกเลิกแล้ว'};
  var rows=customers.map(function(c){return[c.id,c.prefix||'',c.firstname||'',c.lastname||'',c.phone,c.address||'',c.plate,c.brand||'',c.model||'',c.caryear||'',c.type,c.insco||'',c.premium,c.coverage||0,c.start,c.end,st[c.status]||c.status,c.note||''].map(function(v){return'"'+String(v).replace(/"/g,'""')+'"';}).join(',');});
  var csv='\uFEFF'+[h.join(',')].concat(rows).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='ลูกค้าประกันภัย_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  toast('📥 ส่งออก CSV ('+customers.length+' รายการ)');
}

['ov-form','ov-detail','ov-settings'].forEach(function(id){document.getElementById(id).addEventListener('click',function(e){if(e.target===this)ovHide(id);});});
document.getElementById('ov-confirm').addEventListener('click',function(e){if(e.target===this)cfNo();});

// PWA: register service worker + ตรวจจับเวอร์ชันใหม่
var newWorker; // เก็บ reference ของ service worker ตัวใหม่ที่กำลังรอ activate

function showUpdateBanner(){
  var banner=document.getElementById('update-banner');
  if(banner) banner.classList.add('show');
}

window.applyAppUpdate = function(){
  if(newWorker){
    newWorker.postMessage({type:'SKIP_WAITING'});
  }
};

if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js').then(function(reg){
      console.log('SW registered:',reg.scope);

      // กรณีมี service worker ตัวใหม่ "รออยู่" อยู่แล้วตั้งแต่ตอนโหลดหน้านี้
      if(reg.waiting){
        newWorker = reg.waiting;
        showUpdateBanner();
      }

      // เช็คว่ามีเวอร์ชันใหม่กว่าบน server ไหมทันทีที่เปิดหน้า
      reg.update().catch(function(){});

      // เช็คซ้ำเป็นระยะทุก 1 ชั่วโมง — เผื่อกรณีเปิดแอปค้างไว้นานแล้วมี deploy ใหม่ระหว่างนั้น
      // (ตั้งไว้ห่างเพราะหลัง test ระบบนิ่งแล้วจะไม่ deploy บ่อย — ถ้าอยากให้ถี่ขึ้นช่วง dev ปรับเลขนี้ได้)
      setInterval(function(){
        reg.update().catch(function(){});
      }, 60*60*1000);

      // เช็คซ้ำทุกครั้งที่กลับมาที่แท็บ/หน้าต่างนี้ (สลับแท็บไปแล้วกลับมา)
      document.addEventListener('visibilitychange',function(){
        if(document.visibilityState === 'visible'){
          reg.update().catch(function(){});
        }
      });

      // ฟังเหตุการณ์เมื่อพบ service worker ตัวใหม่กำลังติดตั้ง
      reg.addEventListener('updatefound',function(){
        var installing = reg.installing;
        if(!installing) return;
        installing.addEventListener('statechange',function(){
          if(installing.state === 'installed' && navigator.serviceWorker.controller){
            // ติดตั้งเสร็จแล้วและมีตัวเก่าควบคุมอยู่ก่อน = เวอร์ชันใหม่จริง ไม่ใช่ครั้งแรกที่ติดตั้ง
            newWorker = installing;
            showUpdateBanner();
          }
        });
      });
    }).catch(function(err){
      console.warn('SW registration failed:',err);
    });

    // เมื่อ service worker ตัวใหม่ activate และเข้าควบคุมหน้าเว็บแล้ว ให้ reload อัตโนมัติ
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

// แสดงป้าย "ออฟไลน์" เมื่อเน็ตหลุด — ข้อมูลที่เห็นอาจไม่ใช่ข้อมูลล่าสุด และบันทึก/แก้ไขไม่ได้
function updateOfflineBadge(){
  var badge=document.getElementById('offline-badge');
  if(!badge) return;
  badge.style.display = navigator.onLine ? 'none' : 'inline-block';
}
window.addEventListener('online', updateOfflineBadge);
window.addEventListener('offline', updateOfflineBadge);
updateOfflineBadge();
// สำรอง: บาง browser/บางสถานการณ์ (เช่น PWA แบบ standalone) ไม่ fire online/offline event ตรงเวลา
// จึงเช็คซ้ำทุก 2 วินาทีเผื่อไว้ด้วย
setInterval(updateOfflineBadge, 2000);


