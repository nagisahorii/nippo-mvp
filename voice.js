// voice.js (diagnostic版)
(() => {
  const API_BASE = "https://nippo-mvp-mlye.vercel.app"; // ←あなたのVercel URL
  const API_PATH = "/api/format";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recBtn   = document.getElementById("btn-rec");
  const clrBtn   = document.getElementById("btn-clear");
  const prv      = document.getElementById("preview");
  const fmtBtn   = document.getElementById("btn-format");
  const out      = document.getElementById("output");
  const shareBtn = document.getElementById("btn-share");
  const copyBtn  = document.getElementById("btn-copy");
  const statusEl = document.getElementById("status");

  let sr = null, on = false, buffer = [], stream = null;

  const show = (m) => { statusEl.textContent = m; console.log("[voice]", m); };

  // --- 権限プレフライト（押した瞬間にダイアログを出す） ---
  async function ensureMicPermission() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return true; // ない環境もある
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // すぐ停止（権限だけもらう）
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      console.error(e);
      show("マイク権限がありません。URLバーのマイクアイコンを押して［許可］してください。");
      return false;
    }
  }

  // --- SpeechRecognition 準備 ---
  if (SR) {
    sr = new SR();
    sr.lang = "ja-JP";
    sr.interimResults = false;
    sr.continuous = true;

    sr.onstart = () => show("録音中… 話し終えたら停止を押してください");
    sr.onend   = () => show("停止しました");
    sr.onspeechstart = () => show("音声検出中…");
    sr.onspeechend   = () => show("発話を検出しました。必要なら続けて話すか停止してください。");
    sr.onaudiostart  = () => console.log("[voice] audio start");
    sr.onaudioend    = () => console.log("[voice] audio end");

    sr.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = (last && last[0] && last[0].transcript || "").trim();
      if (!text) return;
      buffer.push(text);
      const li = document.createElement("li");
      li.textContent = text;
      prv.appendChild(li);
      prv.scrollTop = prv.scrollHeight;
    };

    sr.onnomatch = () => show("音声を認識できませんでした。もう一度、はっきり話してください。");
    sr.onerror = (e) => {
      console.error("sr.onerror", e);
      const map = {
        "no-speech": "音声が検出できません。マイクの入力レベル・距離を調整してください。",
        "audio-capture": "マイクが見つかりません。デバイス設定を確認してください。",
        "not-allowed": "マイクの使用が拒否されています。URLバーのマイク/カメラアイコンから許可してください。",
        "service-not-allowed": "ブラウザまたはOS設定で音声認識が許可されていません。",
        "aborted": "認識が中断されました。再度お試しください。",
        "network": "ネットワークエラー。通信環境を確認してください。"
      };
      show(map[e.error] || `音声認識エラー: ${e.error || "unknown"}`);
    };
  } else {
    show("このブラウザは音声入力に対応していません（PCのChrome/Edge推奨）");
  }

  // --- UI 動作 ---
  recBtn.onclick = async () => {
    if (!sr) { alert("対応ブラウザでお試しください（PCのChrome/Edge推奨）"); return; }

    if (!on) {
      const ok = await ensureMicPermission();
      if (!ok) return;
      try {
        sr.start(); on = true; recBtn.textContent = "🛑 停止";
      } catch (e) {
        console.error(e);
        show("録音を開始できませんでした。タブをアクティブにしてもう一度押してください。");
      }
    } else {
      try { sr.stop(); } catch {}
      on = false; recBtn.textContent = "🎤 録音開始";
    }
  };

  clrBtn.onclick = () => {
    buffer = []; prv.innerHTML = ""; out.value = "";
    show("クリアしました");
  };

  fmtBtn.onclick = async () => {
    const raw = buffer.join("\n");
    if (!raw.trim()) { alert("音声テキストが空です"); return; }
    show("整形中…");
    try {
      const r = await fetch(API_BASE + API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "format failed");
      out.value = data.text || "";
      show("整形完了");
    } catch (e) {
      console.error(e);
      show("整形エラー。APIのURLと環境変数を確認してください。");
      alert("整形に失敗しました。");
    }
  };

  shareBtn.onclick = async () => {
    const text = out.value.trim();
    if (!text) return alert("共有するテキストがありません");
    if (navigator.share) {
      try { await navigator.share({ text }); show("共有しました"); }
      catch {}
    } else {
      alert("この端末は共有に対応していません。コピーをご利用ください。");
    }
  };

  copyBtn.onclick = async () => {
    const text = out.value.trim();
    if (!text) return alert("コピーするテキストがありません");
    await navigator.clipboard.writeText(text);
    show("コピーしました。Slackに貼り付けてください。");
  };
})();
