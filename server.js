const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();
app.use(express.json());

const WEBHOOK_URL = "https://discord.com/api/webhooks/1542587255204348074/xAF_lRbBb9JO_3pbiUDZHA5wNWkAa0_vs-Xv6qchyknDuckFUGLh6a3X5bIj0kQp9b7Q";
const API_SECRET = "xK9mP2vL8qR4nT6wY1zA3bC5dE7fG0hJ";

const keys = {};

function generateKey() {
  return "KEY-" + crypto.randomBytes(16).toString("hex").toUpperCase();
}

async function sendWebhook(content) {
  try {
    await axios.post(WEBHOOK_URL, { content });
  } catch (e) {
    console.log("Webhook hatası:", e.message);
  }
}

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
<p class="warn">⚠️ Bu anahtar sadece 1 kez kullanılabilir.</p>
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

app.post("/generate", async (req, res) => {
  let newKey = generateKey();
  while (keys[newKey]) newKey = generateKey();

  keys[newKey] = {
    used: false,
    created_at: new Date().toISOString(),
  };

  await sendWebhook(`🔑 **Yeni Key**\n🔐 \`${newKey}\``);

  res.json({ key: newKey });
});

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
  if (keys[k].used) {
    return res.json({ valid: false, reason: "already_used" });
  }

  keys[k].used = true;
  keys[k].used_at = new Date().toISOString();
  keys[k].roblox_id = user || "?";

  sendWebhook(`✅ **Key Kullanıldı**\n🔑 \`${k}\`\n🎮 \`${user}\``);

  res.json({ valid: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
