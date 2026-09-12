const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();
app.use(express.json());

// ⚙️ AYARLAR
const WEBHOOK_URL = "https://discord.com/api/webhooks/1542587255204348074/xAF_lRbBb9JO_3pbiUDZHA5wNWkAa0_vs-Xv6qchyknDuckFUGLh6a3X5bIj0kQp9b7Q";
const API_SECRET = "xK9mP2vL8qR4nT6wY1zA3bC5dE7fG0hJ";
const ADMIN_PASSWORD = "admin123"; // 🔐 BUNU DEĞİŞTİR!

// Veritabanı (bellekte)
const keys = {};
const sessions = {}; // admin oturumları

function generateKey() {
  return "KEY-" + crypto.randomBytes(16).toString("hex").toUpperCase();
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function sendWebhook(content) {
  try {
    await axios.post(WEBHOOK_URL, { content });
  } catch (e) {
    console.log("Webhook hatası:", e.message);
  }
}

// ============================================================
// 🏠 ANA SAYFA (Key Al)
// ============================================================
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Key Al</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:linear-gradient(135deg,#0f0f18,#1a1a2e);color:#fff;font-family:sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
.box{background:#16161f;padding:40px;border-radius:16px;border:1px solid #2daaaf;text-align:center;max-width:500px;width:100%}
h1{color:#2daaaf;margin-bottom:8px;font-size:26px}
p.sub{color:#888;margin-bottom:25px;font-size:14px}
button{width:100%;background:linear-gradient(135deg,#2daaaf,#1e7a7e);color:#fff;border:none;padding:14px;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer}
button:disabled{opacity:.5}
.key-box{display:none;margin-top:22px;padding:18px;background:#0a0a0f;border-radius:10px;border:1px solid #2daaaf;font-family:monospace;font-size:14px;color:#5ae682;word-break:break-all}
.warn{color:#ffb84d;font-size:12px;margin-top:14px}
.copy{margin-top:12px;padding:10px;font-size:13px}
.copied{color:#5ae682;margin-top:8px;font-size:13px;display:none}
a.admin{color:#666;font-size:11px;text-decoration:none;display:block;margin-top:20px}
a.admin:hover{color:#2daaaf}
</style>
</head>
<body>
<div class="box">
<h1>🔑 Key Al</h1>
<p class="sub">Butona bas, sana özel anahtarını al</p>
<button id="btn" onclick="gen()">Key Al</button>
<div class="key-box" id="kb"></div>
<button class="copy" id="cb" style="display:none" onclick="cp()">📋 Kopyala</button>
<div class="copied" id="cm">✅ Kopyalandı!</div>
<p class="warn">⚠️ Bu anahtarın kaç kişilik olduğu admin tarafından belirlenir.</p>
<a href="/admin" class="admin">Admin Girişi</a>
</div>
<script>
let k=null;
async function gen(){
  const b=document.getElementById("btn");
  b.disabled=true;b.textContent="Üretiliyor...";
  try{
    const r=await fetch("/generate",{method:"POST"});
    const d=await r.json();
    if(d.key){
      k=d.key;
      document.getElementById("kb").textContent=d.key;
      document.getElementById("kb").style.display="block";
      document.getElementById("cb").style.display="block";
      b.textContent="✅ Alındı";
    }else{b.textContent="Hata";b.disabled=false}
  }catch(e){b.textContent="Sunucu hatası";b.disabled=false}
}
function cp(){
  if(!k)return;
  navigator.clipboard.writeText(k);
  const m=document.getElementById("cm");
  m.style.display="block";
  setTimeout(()=>m.style.display="none",2000);
}
</script>
</body></html>`);
});

// ============================================================
// 🔑 KEY ÜRET (varsayılan 1 kullanım)
// ============================================================
app.post("/generate", async (req, res) => {
  let newKey = generateKey();
  while (keys[newKey]) newKey = generateKey();

  keys[newKey] = {
    max_uses: 1,
    current_uses: 0,
    used_by: [],
    created_at: new Date().toISOString(),
    disabled: false,
  };

  await sendWebhook(`🔑 **Yeni Key Üretildi**\n🔐 \`${newKey}\`\n👥 Kullanım: 1 kişi`);

  res.json({ key: newKey });
});

// ============================================================
// ✅ DOĞRULA
// ============================================================
app.post("/verify", (req, res) => {
  const { key, secret, user } = req.body || {};

  if (secret !== API_SECRET) {
    return res.json({ valid: false, reason: "unauthorized" });
  }
  if (!key || key.trim() === "") {
    return res.json({ valid: false, reason: "empty" });
  }

  const k = key.trim();
  if (!keys[k]) {
    return res.json({ valid: false, reason: "not_found" });
  }

  const info = keys[k];

  if (info.disabled) {
    return res.json({ valid: false, reason: "disabled" });
  }

  if (info.current_uses >= info.max_uses) {
    return res.json({ valid: false, reason: "limit_reached" });
  }

  // Aynı Roblox kullanıcısı tekrar kullanmasın
  if (user && info.used_by.includes(user)) {
    return res.json({ valid: false, reason: "already_used" });
  }

  info.current_uses++;
  info.used_by.push(user || "unknown");

  sendWebhook(
    `✅ **Key Kullanıldı**\n` +
    `🔑 \`${k}\`\n` +
    `🎮 Roblox ID: \`${user}\`\n` +
    `📊 Kullanım: ${info.current_uses}/${info.max_uses}`
  );

  res.json({
    valid: true,
    remaining: info.max_uses - info.current_uses,
  });
});

// ============================================================
// 🔐 ADMIN — GİRİŞ SAYFASI
// ============================================================
app.get("/admin", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Admin Girişi</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:linear-gradient(135deg,#0f0f18,#1a1a2e);color:#fff;font-family:sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
.box{background:#16161f;padding:40px;border-radius:16px;border:1px solid #2daaaf;text-align:center;max-width:400px;width:100%}
h1{color:#2daaaf;margin-bottom:25px;font-size:22px}
input{width:100%;padding:14px;background:#0a0a0f;border:1px solid #2a2a3a;border-radius:10px;color:#fff;font-size:15px;margin-bottom:14px;outline:none}
input:focus{border-color:#2daaaf}
button{width:100%;background:linear-gradient(135deg,#2daaaf,#1e7a7e);color:#fff;border:none;padding:14px;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer}
.error{color:#ff6b6b;font-size:13px;margin-top:10px;display:none}
</style>
</head>
<body>
<div class="box">
<h1>🔐 Admin Girişi</h1>
<input type="password" id="pw" placeholder="Şifre" />
<button onclick="login()">Giriş Yap</button>
<div class="error" id="err">Yanlış şifre</div>
</div>
<script>
async function login(){
  const pw=document.getElementById("pw").value;
  const r=await fetch("/admin/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password:pw})
  });
  const d=await r.json();
  if(d.token){
    localStorage.setItem("adminToken",d.token);
    window.location.href="/admin/panel";
  }else{
    document.getElementById("err").style.display="block";
  }
}
document.getElementById("pw").addEventListener("keypress",e=>{
  if(e.key==="Enter")login();
});
</script>
</body></html>`);
});

// ============================================================
// 🔐 ADMIN — LOGIN API
// ============================================================
app.post("/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.json({ success: false });
  }
  const token = generateToken();
  sessions[token] = { created: Date.now() };
  res.json({ token });
});

// ============================================================
// 🔐 ADMIN — PANEL
// ============================================================
app.get("/admin/panel", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Admin Panel</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f0f18;color:#fff;font-family:sans-serif;padding:20px;min-height:100vh}
h1{color:#2daaaf;margin-bottom:20px;font-size:22px}
.section{background:#16161f;padding:20px;border-radius:12px;margin-bottom:20px;border:1px solid #2a2a3a}
h2{font-size:16px;margin-bottom:15px;color:#2daaaf}
input,select{padding:10px 14px;background:#0a0a0f;border:1px solid #2a2a3a;border-radius:8px;color:#fff;font-size:14px;margin-right:8px;margin-bottom:8px;outline:none}
input:focus,select:focus{border-color:#2daaaf}
button{background:linear-gradient(135deg,#2daaaf,#1e7a7e);color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:8px}
button:hover{transform:scale(1.02)}
button.danger{background:linear-gradient(135deg,#e74c3c,#c0392b)}
button.warn{background:linear-gradient(135deg,#f39c12,#e67e22)}
.key-card{background:#0a0a0f;padding:14px;border-radius:8px;margin-bottom:10px;border:1px solid #1a1a2a}
.key-text{font-family:monospace;font-size:13px;color:#5ae682;word-break:break-all;margin-bottom:8px}
.key-info{font-size:12px;color:#888;margin-bottom:10px}
.key-info span{margin-right:15px}
.progress{height:6px;background:#1a1a2a;border-radius:3px;overflow:hidden;margin-bottom:8px}
.progress-fill{height:100%;background:linear-gradient(90deg,#2daaaf,#5ae682);transition:width .3s}
.key-actions button{padding:6px 12px;font-size:12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px}
.stat{background:#0a0a0f;padding:14px;border-radius:8px;text-align:center}
.stat-num{font-size:24px;color:#2daaaf;font-weight:bold}
.stat-label{font-size:11px;color:#888;margin-top:4px}
.logout{float:right;background:#e74c3c;padding:6px 12px;font-size:12px}
.empty{color:#666;text-align:center;padding:30px;font-size:13px}
</style>
</head>
<body>
<h1>🎛️ Admin Panel <button class="logout" onclick="logout()">Çıkış</button></h1>

<div class="section">
  <h2>➕ Yeni Key Oluştur</h2>
  <input type="number" id="maxUses" placeholder="Kaç kişi kullanabilir?" value="1" min="1" style="width:200px">
  <button onclick="createKey()">Oluştur</button>
</div>

<div class="section">
  <div class="stats" id="stats"></div>
  <h2>🔑 Keyler (<span id="keyCount">0</span>)</h2>
  <div id="keysList"><div class="empty">Yükleniyor...</div></div>
</div>

<script>
const token = localStorage.getItem("adminToken");
if(!token) window.location.href = "/admin";

async function api(path, options={}){
  options.headers = Object.assign({
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
  }, options.headers || {});
  const r = await fetch(path, options);
  return r.json();
}

async function loadKeys(){
  const d = await api("/admin/keys");
  if(d.error){ logout(); return; }
  
  const list = document.getElementById("keysList");
  const keys = d.keys || [];
  
  document.getElementById("keyCount").textContent = keys.length;
  
  let totalUses = 0;
  let totalUsed = 0;
  keys.forEach(k=>{ totalUses += k.max_uses; totalUsed += k.current_uses; });
  
  document.getElementById("stats").innerHTML = 
    '<div class="stat"><div class="stat-num">'+keys.length+'</div><div class="stat-label">Toplam Key</div></div>' +
    '<div class="stat"><div class="stat-num">'+totalUsed+'</div><div class="stat-label">Kullanılan</div></div>' +
    '<div class="stat"><div class="stat-num">'+(totalUses-totalUsed)+'</div><div class="stat-label">Kalan</div></div>';
  
  if(keys.length === 0){
    list.innerHTML = '<div class="empty">Henüz key yok</div>';
    return;
  }
  
  list.innerHTML = keys.map(k=>{
    const percent = k.max_uses > 0 ? (k.current_uses / k.max_uses * 100) : 0;
    const disabled = k.disabled ? ' 🚫' : '';
    return '<div class="key-card">' +
      '<div class="key-text">'+k.key+disabled+'</div>' +
      '<div class="progress"><div class="progress-fill" style="width:'+percent+'%"></div></div>' +
      '<div class="key-info">' +
        '<span>👥 '+k.current_uses+'/'+k.max_uses+'</span>' +
        '<span>📅 '+new Date(k.created_at).toLocaleDateString("tr-TR")+'</span>' +
      '</div>' +
      '<div class="key-actions">' +
        '<button onclick="editKey(\\''+k.key+'\\')">✏️ Düzenle</button>' +
        '<button class="warn" onclick="resetKey(\\''+k.key+'\\')">🔄 Sıfırla</button>' +
        '<button class="danger" onclick="deleteKey(\\''+k.key+'\\')">🗑️ Sil</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

async function createKey(){
  const maxUses = parseInt(document.getElementById("maxUses").value) || 1;
  const d = await api("/admin/create", {
    method: "POST",
    body: JSON.stringify({ max_uses: maxUses })
  });
  if(d.success){
    alert("✅ Key oluşturuldu:\\n\\n" + d.key);
    loadKeys();
  }
}

async function editKey(key){
  const current = prompt("Yeni kullanım limiti (kişi sayısı):");
  if(!current) return;
  const d = await api("/admin/edit", {
    method: "POST",
    body: JSON.stringify({ key: key, max_uses: parseInt(current) })
  });
  if(d.success) loadKeys();
}

async function resetKey(key){
  if(!confirm("Bu key'in kullanımlarını sıfırlamak istediğine emin misin?")) return;
  const d = await api("/admin/reset", {
    method: "POST",
    body: JSON.stringify({ key: key })
  });
  if(d.success) loadKeys();
}

async function deleteKey(key){
  if(!confirm("Bu key'i silmek istediğine emin misin?")) return;
  const d = await api("/admin/delete", {
    method: "POST",
    body: JSON.stringify({ key: key })
  });
  if(d.success) loadKeys();
}

function logout(){
  localStorage.removeItem("adminToken");
  window.location.href = "/admin";
}

// Auth middleware
function authCheck(req){
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  return sessions[token];
}

loadKeys();
setInterval(loadKeys, 5000);
</script>
</body></html>`);
});

// ============================================================
// 🔐 ADMIN — API ENDPOINTLERİ
// ============================================================
function checkAuth(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  if (!sessions[token]) {
    res.json({ error: "unauthorized" });
    return false;
  }
  return true;
}

// Tüm keyleri listele
app.get("/admin/keys", (req, res) => {
  if (!checkAuth(req, res)) return;
  const list = Object.keys(keys).map(k => ({
    key: k,
    max_uses: keys[k].max_uses,
    current_uses: keys[k].current_uses,
    created_at: keys[k].created_at,
    disabled: keys[k].disabled,
  }));
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ keys: list });
});

// Yeni key oluştur
app.post("/admin/create", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const { max_uses } = req.body || {};

  let newKey = generateKey();
  while (keys[newKey]) newKey = generateKey();

  keys[newKey] = {
    max_uses: Math.max(1, parseInt(max_uses) || 1),
    current_uses: 0,
    used_by: [],
    created_at: new Date().toISOString(),
    disabled: false,
  };

  await sendWebhook(`🔑 **Admin Key Oluşturdu**\n🔐 \`${newKey}\`\n👥 ${keys[newKey].max_uses} kişi`);

  res.json({ success: true, key: newKey });
});

// Key düzenle
app.post("/admin/edit", (req, res) => {
  if (!checkAuth(req, res)) return;
  const { key, max_uses } = req.body || {};
  if (!keys[key]) return res.json({ success: false });
  keys[key].max_uses = Math.max(1, parseInt(max_uses) || 1);
  res.json({ success: true });
});

// Key sıfırla
app.post("/admin/reset", (req, res) => {
  if (!checkAuth(req, res)) return;
  const { key } = req.body || {};
  if (!keys[key]) return res.json({ success: false });
  keys[key].current_uses = 0;
  keys[key].used_by = [];
  res.json({ success: true });
});

// Key sil
app.post("/admin/delete", (req, res) => {
  if (!checkAuth(req, res)) return;
  const { key } = req.body || {};
  delete keys[key];
  res.json({ success: true });
});

// ============================================================
// 🚀 BAŞLAT
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
