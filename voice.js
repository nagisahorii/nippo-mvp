// voice.js
(() => {
  const API_BASE = "https://nippo-mvp-mlye.vercel.app"; // ←自分のVercel URLに
  const API_PATH = "/api/format";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recBtn = document.getElementById("btn-rec");
  const clrBtn = document.getElementById("btn-clear");
  const prv = document.getElementById("preview");
  const fmtBtn = document.getElementById("btn-format");
  const out = document.getElementById("output");
  const shareBtn = document.getElementById("btn-share");
  const copyBtn = document.getElementById("btn-copy");
  const statusEl = document.getElementById("status");

  let sr = null, on = false, buffer = [];

  // 音声入力
  if (SR) {
    sr = new SR();
    sr.lang = "ja-JP";
    sr.interimResults = false;
    sr.continuous = true;

    sr.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript.trim();
      if (!text) return;
      buffer.push(text);
      const li = document.createElement("li");
      li.textContent = text;
      prv.appendChild(li);
      prv.scrollTop = prv.scrollHeight;
    };
    sr.onstart = () => { statusEl.textContent = "録音中… 話し終えたら停止を押してください"; };
    sr.onend = () => { statusEl.textContent = "停止しました"; };
  } else {
    statusEl.textContent = "このブラウザは音声入力に対応していません（Chrome/Edge推奨）";
  }

  recBtn.onclick = () => {
    if (!sr) { alert("対応ブラウザでお試しください（Chrome/Edge推奨）"); return; }
    if (!on) { sr.start(); on = true; recBtn.textContent = "🛑 停止"; }
    else { sr.stop(); on = false; recBtn.textContent = "🎤 録音開始"; }
  };

  clrBtn.onclick = () => {
    buffer = [];
    prv.innerHTML = "";
    out.value = "";
    statusEl.textContent = "クリアしました";
  };

  // 整形API
  fmtBtn.onclick = async () => {
    const raw = buffer.join("\n");
    if (!raw.trim()) { alert("音声テキストが空です"); return; }
    statusEl.textContent = "整形中…";
    try {
      const r = await fetch(API_BASE + API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "format failed");
      out.value = data.text || "";
      statusEl.textContent = "整形完了";
    } catch (e) {
      console.error(e);
      statusEl.textContent = "整形エラー";
      alert("整形に失敗しました。APIのURLと環境変数を確認してください。");
    }
  };

  // 共有 / コピー
  shareBtn.onclick = async () => {
    const text = out.value.trim();
    if (!text) return alert("共有するテキストがありません");
    if (navigator.share) {
      try { await navigator.share({ text }); statusEl.textContent = "共有しました"; }
      catch { /* cancel */ }
    } else {
      alert("この端末は共有に対応していません。コピーをご利用ください。");
    }
  };

  copyBtn.onclick = async () => {
    const text = out.value.trim();
    if (!text) return alert("コピーするテキストがありません");
    await navigator.clipboard.writeText(text);
    statusEl.textContent = "コピーしました。Slackに貼り付けてください。";
  };
})();
