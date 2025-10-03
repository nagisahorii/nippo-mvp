// voice.js
(() => {
  const API_BASE = "https://nippo-mvp-mlye.vercel.app";
  const API_PATH = "/api/format";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recBtn = document.getElementById("btn-rec");
  const clrBtn = document.getElementById("btn-clear");
  const prv = document.getElementById("preview");
  const out = document.getElementById("output");
  const shareBtn = document.getElementById("btn-share");
  const copyBtn = document.getElementById("btn-copy");
  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const spin = document.getElementById("spin");

  let sr = null, on = false, buffer = [];
  let endTimer = null;

  const setStatus = (msg, type = "hint") => {
    statusEl.classList.remove("ok", "err");
    if (type === "ok") statusEl.classList.add("ok");
    else if (type === "err") statusEl.classList.add("err");
    statusText.textContent = msg;
  };
  const setBusy = (busy) => { busy ? spin.classList.add("on") : spin.classList.remove("on"); };

  async function convertNow() {
    const text = buffer.join("。").trim();
    if (!text) { setBusy(false); setStatus("音声が認識できませんでした。", "err"); return; }
    try {
      const r = await fetch(API_BASE + API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: text })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "サーバーで処理に失敗しました");
      out.value = data.text || "";
      setStatus(`✅ 日報の下書きができました（判定：${data.outcome || "不明"}）`, "ok");
    } catch (e) {
      console.error(e);
      setStatus("⚠️ 変換に失敗しました。通信状態やAPI設定を確認してください。", "err");
      alert("日報の変換に失敗しました。ネットワークやマイク設定を確認してください。");
    } finally {
      setBusy(false);
    }
  }

  if (SR) {
    sr = new SR();
    sr.lang = "ja-JP";
    sr.interimResults = true;
    sr.continuous = true;

    sr.onstart = () => { setStatus("🎤 録音を開始しました。話し終えたら停止を押してください"); };
    sr.onend = async () => {
      clearTimeout(endTimer);
      setStatus("🛑 録音を停止しました。変換を始めます…");
      setBusy(true);
      await convertNow();
    };

    sr.onresult = (e) => {
      const parts = [];
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript.trim());
      prv.innerHTML = ""; buffer = [];
      parts.forEach(t => { if (!t) return; buffer.push(t); const li = document.createElement("li"); li.textContent = t; prv.appendChild(li); });
      prv.scrollTop = prv.scrollHeight;
    };

    sr.onnomatch = () => setStatus("音声が認識できませんでした。はっきりと話してください。", "err");
    sr.onerror = (e) => {
      const map = {
        "no-speech": "音声が検出できませんでした。マイクの距離を確認してください。",
        "audio-capture": "マイクが見つかりません。デバイスの設定を確認してください。",
        "not-allowed": "マイクの使用が拒否されています。ブラウザのマイク設定を許可してください。",
        "service-not-allowed": "このブラウザ/OSでは音声認識が利用できません。",
        "aborted": "音声認識が中断されました。再試行してください。",
        "network": "ネットワークエラーです。接続を確認してください。"
      };
      setStatus(map[e.error] || `音声認識エラー: ${e.error}`, "err");
    };
  } else {
    setStatus("このブラウザは音声入力に対応していません（PCのChrome/Edge推奨）", "err");
  }

  recBtn?.addEventListener("click", async () => {
    if (!sr) { alert("PCのChrome/Edgeでお試しください"); return; }
    if (!on) {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
        }
      } catch {
        setStatus("マイク権限がありません。ブラウザのURLバーから許可してください。", "err");
        return;
      }
      buffer = []; prv.innerHTML = "";
      try {
        sr.start(); on = true; recBtn.textContent = "■ 停止"; setStatus("🎤 録音中…");
      } catch {
        setStatus("録音開始に失敗しました。タブをアクティブにして再試行してください。", "err");
      }
    } else {
      try { sr.stop(); } catch {}
      on = false; recBtn.textContent = "🎤 録音開始";
      endTimer = setTimeout(() => convertNow(), 800); // 保険
    }
  });

  clrBtn?.addEventListener("click", () => { buffer = []; prv.innerHTML = ""; out.value = ""; setStatus("入力をクリアしました"); });

  shareBtn?.addEventListener("click", async () => {
    const text = out.value.trim();
    if (!text) return alert("共有するテキストがありません");
    if (navigator.share) { try { await navigator.share({ text }); setStatus("端末の共有機能を使いました", "ok"); } catch {} }
    else { alert("この端末は共有に対応していません。コピーをご利用ください。"); }
  });

  copyBtn?.addEventListener("click", async () => {
    const text = out.value.trim();
    if (!text) return alert("コピーするテキストがありません");
    await navigator.clipboard.writeText(text);
    setStatus("コピーしました。Slackに貼り付けてください。", "ok");
  });
})();
