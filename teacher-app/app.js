// Simple Teacher PWA app logic (offline-first)
const view = document.getElementById('view');
const STATE_KEY = 'umeed_teacher_state_v1';
const QUEUE_KEY = 'umeed_sync_queue_v1';
let state = { user: null };

function getQueue(){ try{ return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') }catch(e){ return [] } }
function pushToQueue(item){ const q=getQueue(); q.push(item); localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
function clearQueue(){ localStorage.removeItem(QUEUE_KEY) }
function el(html){ const d=document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild }

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/teacher-app/sw.js').then(()=>console.log('SW registered teacher-app')).catch(()=>{})
}

async function flushQueue(){
  if(!navigator.onLine) return;
  const q = getQueue();
  if(!q.length) return;
  try{
    const res = await fetch('/api/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({items:q}) });
    if(res.ok){ clearQueue(); console.log('Teacher queue synced') }
  }catch(e){ console.log('Sync failed', e) }
}
window.addEventListener('online', ()=>flushQueue());

// views
function renderLogin(){
  view.innerHTML = '';
  const node = el(`<div class="view-card">
    <h2>Umeed — Teacher</h2>
    <input id="user" class="input" placeholder="Your name (eg. Radha)" />
    <button id="btn-login" class="btn">Login</button>
    <p class="small">Works offline. Use sync when online.</p>
  </div>`);
  view.appendChild(node);
  document.getElementById('btn-login').onclick = ()=>{
    const name = document.getElementById('user').value.trim() || 'Teacher';
    state.user = {name, id: 't-'+Date.now()};
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    renderTeacherDashboard();
  }
}

async function renderTeacherDashboard(){
  view.innerHTML = '';
  const node = el(`<div class="view-card">
    <h2>Hi, ${state.user?.name||'Teacher'}</h2>
    <div class="section">
      <h3>Student Records</h3>
      <div id="student-records" class="list"></div>
      <button id="refresh" class="btn" style="margin-top:8px">Refresh from server</button>
    </div>

    <div class="section">
      <h3>Uploads / Remarks</h3>
      <input id="upload-title" class="input" placeholder="Title" />
      <textarea id="upload-body" class="input" style="height:80px" placeholder="Remarks or resource link"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px"><button id="upload-btn" class="btn">Upload</button></div>
    </div>

    <div style="margin-top:12px">
      <button id="logout" class="btn" style="background:transparent;border:1px solid #eee">Logout</button>
    </div>
  </div>`);
  view.appendChild(node);

  // load cached records if any
  loadStudentRecords();

  document.getElementById('refresh').onclick = ()=>fetchRecords();
  document.getElementById('upload-btn').onclick = ()=>{
    const title = document.getElementById('upload-title').value.trim();
    const body = document.getElementById('upload-body').value.trim();
    if(!title) return alert('Title required');
    const upload = {title, body, by: state.user, at:new Date().toISOString()};
    pushToQueue({type:'upload', payload: upload});
    alert('Saved locally and queued for sync');
    document.getElementById('upload-title').value = ''; document.getElementById('upload-body').value = '';
  }

  document.getElementById('logout').onclick = ()=>{ state.user = null; localStorage.removeItem(STATE_KEY); renderLogin(); }
}

function loadStudentRecords(){
  const cached = JSON.parse(localStorage.getItem('umeed_student_records_v1') || '[]');
  const list = document.getElementById('student-records');
  list.innerHTML = '';
  if(!cached.length) list.appendChild(el('<div class="small">No local records. Please refresh when online.</div>'));
  cached.forEach(r => list.appendChild(el(`<div class="list-item"><strong>${escapeHtml(r.name)}</strong><div class="small">Progress: ${r.progress || 0}%</div></div>`)));
}

async function fetchRecords(){
  if(!navigator.onLine) return alert('You are offline. Connect to internet to fetch latest records.');
  try{
    const res = await fetch('/api/students');
    if(res.ok){
      const j = await res.json();
      localStorage.setItem('umeed_student_records_v1', JSON.stringify(j.students || []));
      loadStudentRecords();
      alert('Records refreshed');
    }else alert('Server error');
  }catch(e){ alert('Fetch failed') }
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])) }

// start
const saved = localStorage.getItem(STATE_KEY);
if(saved){ state = JSON.parse(saved); renderTeacherDashboard(); } else renderLogin();
