// Lightweight backend for Umeed (dev/demo). Uses db.json for storage.
// Run: npm install then npm start
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// serve static student and teacher apps
app.use('/student-app', express.static(path.join(__dirname, '..', 'student-app')));
app.use('/teacher-app', express.static(path.join(__dirname, '..', 'teacher-app')));

// path to db
const DB_PATH = path.join(__dirname, 'db.json');

function readDB(){
  try{ const raw = fs.readFileSync(DB_PATH); return JSON.parse(raw); }catch(e){ return {students:[],teachers:[],uploads:[],queue_items:[]} }
}
function writeDB(obj){
  fs.writeFileSync(DB_PATH, JSON.stringify(obj, null, 2));
}

// GET students
app.get('/api/students', (req,res)=>{
  const db = readDB();
  return res.json({ students: db.students || [] });
});

// POST sync: accept queued items from apps
// Example items: {type:'note', payload:{user, text, at}} or type:'ai_query' or type:'upload'
app.post('/api/sync', (req,res)=>{
  const items = req.body.items || [];
  const db = readDB();
  db.queue_items = db.queue_items || [];
  items.forEach(it => {
    db.queue_items.push(it);
    // simple handling: if note from student -> attach to student notes in db
    if(it.type === 'note' && it.payload && it.payload.user){
      const uid = it.payload.user.id || it.payload.user.name;
      let student = db.students.find(s => s.id === it.payload.user.id);
      if(!student){
        // create student stub
        student = { id: it.payload.user.id || ('s-'+Date.now()), name: it.payload.user.name || 'Student', progress:0, notes:[], quizzes:[] };
        db.students.push(student);
      }
      student.notes = student.notes || [];
      student.notes.unshift({text: it.payload.text, at: it.payload.at});
    }
    if(it.type === 'upload' && it.payload){
      db.uploads = db.uploads || [];
      db.uploads.unshift(it.payload);
    }
    // other types can be added similarly
  });
  writeDB(db);
  return res.json({ ok:true, received: items.length });
});

// GET uploads
app.get('/api/uploads', (req,res)=>{
  const db = readDB();
  return res.json({ uploads: db.uploads || [] });
});

// POST remarks (teacher can post remark for student)
app.post('/api/remarks', (req,res)=>{
  const { studentId, remark, by } = req.body;
  if(!studentId || !remark) return res.status(400).json({error:'studentId and remark required'});
  const db = readDB();
  const student = db.students.find(s => s.id === studentId) || null;
  if(!student) return res.status(404).json({error:'Student not found'});
  student.remarks = student.remarks || [];
  student.remarks.unshift({ by, remark, at: new Date().toISOString() });
  writeDB(db);
  return res.json({ ok:true });
});

// OpenAI proxy endpoint (optional)
// Requires OPENAI_API_KEY in env. This forwards prompt to OpenAI and returns text.
// WARNING: do NOT expose your API key in client. Use this proxy on your server only.
app.post('/api/openai', async (req,res)=>{
  const prompt = req.body.prompt || '';
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if(!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured on server' });
  try{
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400
      })
    });
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || JSON.stringify(j);
    return res.json({ text });
  }catch(e){
    return res.status(500).json({ error: e.message });
  }
});

// root links
app.get('/', (req,res)=> res.sendFile(path.join(__dirname, '..', 'student-app', 'index.html')));
app.get('/teacher', (req,res)=> res.sendFile(path.join(__dirname, '..', 'teacher-app', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Umeed backend running on http://localhost:${PORT}`));
