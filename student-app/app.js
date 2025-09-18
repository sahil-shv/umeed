// Simple Student PWA app logic (offline-first)
const view = document.getElementById('view');
const STATE_KEY = 'umeed_student_state_v1';
const QUEUE_KEY = 'umeed_sync_queue_v1';
let state = { user: null };

// queue helpers
function getQueue(){ try{ return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') }catch(e){ return [] } }
function pushToQueue(item){ const q=getQueue(); q.push(item); localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
function clearQueue(){ localStorage.removeItem(QUEUE_KEY) }

// small helper
function el(html){ const d=document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild }
function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify(state)) }
function loadState(){ try{ state = JSON.parse(localStorage.getItem(STATE_KEY)) || state }catch(e){} }

// register service worker
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/student-app/sw.js').then(()=>console.log('SW registered student-app')).catch(()=>{})
}

// try to flush queue when online
async function flushQueue(){
  if(!navigator.onLine) return;
  const q = getQueue();
  if(!q.length) return;
  try{
    const res = await fetch('/api/sync', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({items:q}) });
    if(res.ok){ clearQueue(); console.log('Student queue synced') }
  }catch(e){ console.log('Sync failed', e) }
}
window.addEventListener('online', ()=>flushQueue());
loadState();
flushQueue();

// views
function renderLogin(){
  view.innerHTML = '';
  const node = el(`<div class="view-card">
    <h2>Welcome to Umeed (Student)</h2>
    <input id="user" class="input" placeholder="Enter name (eg. Sahil)" />
    <button id="btn-login" class="btn">Login</button>
    <p class="small">Works offline. Data will sync when you connect.</p>
  </div>`);
  view.appendChild(node);
  document.getElementById('btn-login').onclick = ()=>{
    const name = document.getElementById('user').value.trim() || 'Guest';
    state.user = {name, id: 's-'+Date.now()};
    saveState();
    renderStudentDashboard();
  }
}

function renderStudentDashboard(){
  view.innerHTML = '';
  const node = el(`<div class="view-card">
    <h2>Hi, ${state.user?.name||'Student'}</h2>
    <div class="grid">
      <div class="card">Profile</div>
      <div class="card">Quizzes</div>
      <div class="card">Progress</div>
    </div>

    <div class="section">
      <h3>Notes</h3>
      <div id="notes" class="list"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input id="note-input" class="input" placeholder="Write a note" />
        <button id="save-note" class="btn">Save</button>
      </div>
    </div>

    <div class="section">
      <h3>Videos</h3>
      <div id="videos" class="list"></div>
    </div>

    <div class="section">
      <h3>AI Tutor (requires internet)</h3>
      <textarea id="tutor-q" class="input" placeholder="Ask something..." style="height:80px"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button id="ask-ai" class="btn">Ask AI</button>
      </div>
      <pre id="ai-response" class="small" style="margin-top:8px;white-space:pre-wrap;"></pre>
    </div>

    <div style="margin-top:12px">
      <button id="logout" class="btn" style="background:transparent;border:1px solid #eee">Logout</button>
    </div>
  </div>`);
  view.appendChild(node);

  // load notes
  const notes = JSON.parse(localStorage.getItem('umeed_notes_v1') || '[]');
  const notesEl = document.getElementById('notes');
  notes.forEach(n => notesEl.appendChild(el(`<div class="list-item">${escapeHtml(n)}</div>`)));

  document.getElementById('save-note').onclick = ()=>{
    const text = document.getElementById('note-input').value.trim();
    if(!text) return;
    const ns = JSON.parse(localStorage.getItem('umeed_notes_v1') || '[]');
    ns.unshift(text);
    localStorage.setItem('umeed_notes_v1', JSON.stringify(ns));
    pushToQueue({type:'note', payload:{user: state.user, text, at: new Date().toISOString()}});
    notesEl.prepend(el(`<div class="list-item">${escapeHtml(text)}</div>`));
    document.getElementById('note-input').value = '';
  }

  // videos (static demo)
  const videosEl = document.getElementById('videos');
  ['Intro to algebra','Triangle basics','Electric Circuits — short'].forEach(v => videosEl.appendChild(el(`<div class="list-item">${v}</div>`)));

  // AI tutor
  document.getElementById('ask-ai').onclick = async ()=>{
    const q = document.getElementById('tutor-q').value.trim(); if(!q) return;
    const out = document.getElementById('ai-response'); out.textContent = 'Thinking...';
    try{
      const r = await fetch('/api/openai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt: q }) });
      if(r.ok){ const j = await r.json(); out.textContent = j.text || JSON.stringify(j); }
      else { out.textContent = 'AI request failed (server). Saved locally.'; pushToQueue({type:'ai_query', payload:{user:state.user, q, at:new Date().toISOString()}}) }
    }catch(e){
      out.textContent = 'Offline — saved for later.';
      pushToQueue({type:'ai_query', payload:{user:state.user, q, at:new Date().toISOString()}});
    }
  }

  document.getElementById('logout').onclick = ()=>{ state.user = null; saveState(); renderLogin(); }
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])) }

// init
if(!state.user) renderLogin(); else renderStudentDashboard();
