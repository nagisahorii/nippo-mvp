// voice.js
(() => {
  const API_BASE = "https://nippo-mvp-mlye.vercel.app";
  const API_PATH = "/api/format";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // UI要素
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

  // 入力制御（変換中は無効化）
  function toggleInputs(disabled) {
    ["btn-rec","btn-clear","btn-share","btn-copy"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !!disabled;
    });
  }
  const setBusy = (busy) => {
    if (spin) spin.classList.toggle("on", !!busy);
    toggleInputs(!!busy);
  };

  // ステータス表示（やさしい日本語）
  const setStatus = (msg, type = "hint") => {
    statusEl?.classList.remove("ok", "err");
    if (type === "ok") statusEl?.classList.add("ok");
    else if (type === "err") statusEl?.classList.add("err");
    if (statusText) statusText.textContent = msg;
  };

  async function convertNow() {
    const text = buffer.join("。").trim();
    if (!text) { setBusy(false); setStatus("音声が認識できませんでした。もう一度お試しください。", "err"); return; }
    try {
      const r = await fetch(API_BASE + API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: text })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "サーバーでの処理に失敗しました");
      out.value = data.text || "";
      setStatus("✅ 日報ができました。Slackで共有してください。", "ok");

      // （将来用）成約時に不要な項目を薄くする例：
      // if (data.outcome === "成約") {
      //   document.querySelectorAll("[data-type='hiseiyaku']").forEach(el => el.classList.add("disabled"));
      // } else {
      //   document.querySelectorAll("[data-type='hiseiyaku']").forEach(el => el.classList.remove("disabled"));
      // }

    } catch (e) {
      console.error(e);
      setStatus("⚠️ 変換に失敗しました。通信状態や設定を確認して、もう一度お試しください。", "err");
      alert("変換に失敗しました。ネットワークやマイク設定を確認してください。");
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
      parts.forEach(t => {
        if (!t) return;
        buffer.push(t);
        const li = document.createElement("li");
        li.textContent = t;
        prv.appendChild(li);
      });
      prv.scrollTop = prv.scrollHeight;

      // （将来用）話したキーワードで項目を軽くマークするサンプル：
      // document.querySelectorAll(".pill").forEach(p => {
      //   const label = p.textContent.replace(/\s+/g, "");
      //   if (label && parts.join("").includes(label.replace(/[＋/（）()]/g,""))) {
      //     p.classList.add("disabled"); // ここでは一旦「完了っぽい」見た目に
      //   }
      // });
    };

    sr.onnomatch = () => setStatus("音声が認識できませんでした。はっきり話してください。", "err");
    sr.onerror = (e) => {
      const map = {
        "no-speech": "音声が検出できませんでした。マイクの距離を確認してください。",
        "audio-capture": "マイクが見つかりません。デバイスの設定を確認してください。",
        "not-allowed": "マイクが許可されていません。ブラウザのURLバーから許可してください。",
        "service-not-allowed": "このブラウザ/OSでは音声認識が利用できません。",
        "aborted": "音声認識が中断されました。もう一度お試しください。",
        "network": "ネットワークエラーです。接続を確認してください。"
      };
      setStatus(map[e.error] || `音声認識エラー: ${e.error || "不明なエラー"}`, "err");
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
        setStatus("マイクが許可されていません。ブラウザのURLバーから許可してください。", "err");
        return;
      }
      buffer = []; prv.innerHTML = "";
      try {
        sr.start(); on = true; recBtn.textContent = "■ 停止"; setStatus("🎤 録音中…");
      } catch {
        setStatus("録音開始に失敗しました。タブをアクティブにしてもう一度お試しください。", "err");
      }
    } else {
      try { sr.stop(); } catch {}
      on = false; recBtn.textContent = "🎤 録音開始";
      // onendが来ないブラウザ向けの保険
      setStatus("🛑 録音を停止しました。変換を始めます…");
      setBusy(true);
      endTimer = setTimeout(() => convertNow(), 800);
    }
  });

  clrBtn?.addEventListener("click", () => {
    buffer = []; prv.innerHTML = ""; out.value = "";
    setStatus("入力をクリアしました");
    // （将来用）薄くした項目を元に戻す
    // document.querySelectorAll(".pill").forEach(p => p.classList.remove("disabled"));
  });

  shareBtn?.addEventListener("click", async () => {
    const text = out.value.trim();
    if (!text) return alert("共有するテキストがありません");
    if (navigator.share) {
      try { await navigator.share({ text }); setStatus("Slackで共有してください。共有を開始しました。", "ok"); }
      catch {}
    } else {
      alert("この端末は共有に対応していません。コピーをご利用ください。");
    }
  });

  copyBtn?.addEventListener("click", async () => {
    const text = out.value.trim();
    if (!text) return alert("コピーするテキストがありません");
    await navigator.clipboard.writeText(text);
    setStatus("コピーしました。Slackで共有してください。", "ok");
  });
})();
