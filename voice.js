// voice.js
(() => {
  const API_BASE = "https://nippo-mvp-mlye.vercel.app"; // ← あなたのVercel URL
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

  const setStatus = (msg, type = "hint") => {
    statusEl.classList.remove("ok","err");
    statusEl.classList.add(type === "ok" ? "ok" : type === "err" ? "err" : "");
    statusText.textContent = msg;
  };
  const setBusy = (busy) => {
    if (busy) { spin.classList.add("on"); }
    else { spin.classList.remove("on"); }
  };

  // 音声認識セットアップ（PC Chrome/Edge）
  if (SR) {
    sr = new SR();
    sr.lang = "ja-JP";
    sr.interimResults = true;
    sr.continuous = true;

    sr.onstart = () => setStatus("録音中… 話し終えたら停止を押してください");
    sr.onaudiostart = () => console.log("audio start");
    sr.onaudioend = () => console.log("audio end");
    sr.onend = async () => {
      setStatus("変換中…");
      setBusy(true);
      const text = buffer.join("。").trim();
      if (!text) {
        setBusy(false);
        setStatus("テキストがありません", "err");
        return;
      }
      try {
        const r = await fetch(API_BASE + API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: text })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "変換に失敗しました");
        out.value = data.text || "";
        setStatus("変換完了", "ok");
      } catch (e) {
        console.error(e);
        setStatus("変換エラー： " + e.message, "err");
        alert("変換に失敗しました。通信状態やAPI設定を確認してください。");
      } finally {
        setBusy(false);
      }
    };

    sr.onresult = (e) => {
      // リアルタイムプレビュー（常に全量を描画）
      const parts = [];
      for (let i = 0; i < e.results.length; i++) {
        parts.push(e.results[i][0].transcript.trim());
      }
      prv.innerHTML = "";
      buffer = [];
      parts.forEach(t => {
        if (!t) return;
        buffer.push(t);
        const li = document.createElement("li");
        li.textContent = t;
        prv.appendChild(li);
      });
      prv.scrollTop = prv.scrollHeight;
    };

    sr.onnomatch = () => setStatus("音声を認識できませんでした。もう一度、はっきり話してください。", "err");
    sr.onerror = (e) => {
      const map = {
        "no-speech": "音声が検出できません。マイクの入力レベル・距離を調整してください。",
        "audio-capture": "マイクが見つかりません。デバイス設定を確認してください。",
        "not-allowed": "マイクの使用が拒否されています。URLバーのマイクから許可してください。",
        "service-not-allowed": "ブラウザ/OSで音声認識が許可されていません。",
        "aborted": "認識が中断されました。再試行してください。",
        "network": "ネットワークエラー。通信を確認してください。"
      };
      setStatus(map[e.error] || `音声認識エラー: ${e.error || "unknown"}`, "err");
    };
  } else {
    setStatus("このブラウザは音声入力に対応していません（PCのChrome/Edge推奨）", "err");
  }

  // ボタン動作
  recBtn.onclick = async () => {
    if (!sr) { alert("対応ブラウザでお試しください（PCのChrome/Edge推奨）"); return; }
    if (!on) {
      // 事前に権限を要求（ダイアログを確実に出す）
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
        }
      } catch {
        setStatus("マイク権限がありません。URLバーのマイクから許可してください。", "err");
        return;
      }
      buffer = []; prv.innerHTML = "";
      try { sr.start(); on = true; recBtn.textContent = "■ 停止"; setStatus("録音中…"); }
      catch (e) { setStatus("録音開始に失敗しました。タブをアクティブにして再試行してください。", "err"); }
    } else {
      try { sr.stop(); } catch {}
      on = false; recBtn.textContent = "🎤 録音開始";
      // onendで自動変換に進む
    }
  };

  clrBtn.onclick = () => {
    buffer = []; prv.innerHTML = ""; out.value = "";
    setStatus("クリアしました");
  };

  shareBtn.onclick = async () => {
    const text = out.value.trim();
    if (!text) return alert("共有するテキストがありません");
    if (navigator.share) {
      try { await navigator.share({ text }); setStatus("共有しました", "ok"); }
      catch {}
    } else {
      alert("この端末は共有に対応していません。コピーをご利用ください。");
    }
  };

  copyBtn.onclick = async () => {
    const text = out.value.trim();
    if (!text) return alert("コピーするテキストがありません");
    await navigator.clipboard.writeText(text);
    setStatus("コピーしました。Slackに貼り付けてください。", "ok");
  };
})();
