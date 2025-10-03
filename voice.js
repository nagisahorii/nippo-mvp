// voice.js（安定化版）
(() => {
  const API_BASE = "https://nippo-mvp-mlye.vercel.app";
  const API_PATH = "/api/format";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // ---------- 小ユーティリティ ----------
  const $$ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 指定IDの要素が出るまで待つ（iframe/kintoneの描画遅延に耐える）
  async function waitEls(ids, timeout = 2500) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const els = ids.map($$);
      if (els.every(Boolean)) return els;
      await sleep(50);
    }
    return ids.map(() => null);
  }

  function setBusy(b) {
    const spin = $$("#spin");
    if (spin) spin.classList.toggle("on", !!b);
  }
  function setStatus(msg, type = "") {
    const st = $$("#status");
    const tx = $$("#status-text");
    if (!st || !tx) return;
    st.classList.remove("ok", "err");
    if (type === "ok") st.classList.add("ok");
    if (type === "err") st.classList.add("err");
    tx.textContent = msg || "";
  }

  // ---------- 変換リクエスト ----------
  async function convertNow(buffer) {
    const text = buffer.join("。").trim();
    console.log("[voice] convertNow raw:", text);
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
      const data = await r.json().catch(() => ({}));
      console.log("[voice] format status:", r.status, data);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} : ${data?.error || "API error"}`);
      const out = $$("#output");
      if (out) out.value = data.text || "";
      setStatus(`変換完了（検出：${data.outcome || "判定不可"}）`, "ok");
    } catch (e) {
      console.error(e);
      setStatus("変換エラー： " + e.message, "err");
      alert("変換に失敗しました。通信状態やAPI設定を確認してください。");
    } finally {
      setBusy(false);
    }
  }

  // ---------- 初期化本体 ----------
  let inited = false;
  async function init() {
    if (inited) return;
    // 主要要素を待つ
    const [recBtn, clrBtn, shareBtn, copyBtn, preview, output] =
      await waitEls(["btn-rec", "btn-clear", "btn-share", "btn-copy", "preview", "output"]);

    if (!recBtn || !preview || !output) {
      console.warn("[voice] UI elements not ready");
      return;
    }

    // 音声認識セットアップ
    let sr = null;
    let recording = false;
    let buffer = [];
    let endTimer = null;

    if (SR) {
      sr = new SR();
      sr.lang = "ja-JP";
      sr.interimResults = true;
      sr.continuous = true;

      sr.onstart = () => {
        setStatus("録音中… 話し終えたら停止を押してください");
        console.log("[voice] onstart");
      };
      sr.onaudiostart = () => console.log("[voice] audio start");
      sr.onaudioend = () => console.log("[voice] audio end");

      sr.onresult = (e) => {
        const parts = [];
        for (let i = 0; i < e.results.length; i++) {
          parts.push(e.results[i][0].transcript.trim());
        }
        preview.innerHTML = "";
        buffer = [];
        parts.forEach((t) => {
          if (!t) return;
          buffer.push(t);
          const li = document.createElement("li");
          li.textContent = t;
          preview.appendChild(li);
        });
        preview.scrollTop = preview.scrollHeight;
      };

      sr.onend = async () => {
        console.log("[voice] onend");
        clearTimeout(endTimer);
        setStatus("変換中…");
        setBusy(true);
        await convertNow(buffer);
      };

      sr.onnomatch = () =>
        setStatus("音声を認識できませんでした。もう一度、はっきり話してください。", "err");

      sr.onerror = (e) => {
        console.warn("[voice] onerror:", e);
        const map = {
          "no-speech":
            "音声が検出できません。マイクの入力レベル・距離を調整してください。",
          "audio-capture": "マイクが見つかりません。デバイス設定を確認してください。",
          "not-allowed":
            "マイクの使用が拒否されています。URLバーのマイクから許可してください。",
          "service-not-allowed":
            "ブラウザ/OSで音声認識が許可されていません。",
          aborted: "認識が中断されました。再試行してください。",
          network: "ネットワークエラー。通信を確認してください。"
        };
        setStatus(map[e.error] || `音声認識エラー: ${e.error || "unknown"}`, "err");
      };
    } else {
      setStatus("このブラウザは音声入力に対応していません（PCのChrome/Edge推奨）", "err");
    }

    // クリックは addEventListener で（多重バインド防止）
    recBtn.addEventListener("click", async () => {
      if (!sr) {
        alert("対応ブラウザでお試しください（PCのChrome/Edge推奨）");
        return;
      }
      if (!recording) {
        // マイク権限の事前要求（ダイアログ出し）
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
          }
        } catch {
          setStatus("マイク権限がありません。URLバーのマイクから許可してください。", "err");
          return;
        }
        buffer = [];
        preview.innerHTML = "";
        try {
          sr.start();
          recording = true;
          recBtn.textContent = "■ 停止";
          setStatus("録音中…");
        } catch (e) {
          console.warn("[voice] sr.start error:", e);
          setStatus(
            "録音開始に失敗しました。タブをアクティブにして再試行してください。",
            "err"
          );
        }
      } else {
        try {
          sr.stop();
        } catch {}
        recording = false;
        recBtn.textContent = "🎤 録音開始";
        // 保険：onendが来ない場合でも変換する
        setStatus("変換中…");
        setBusy(true);
        endTimer = setTimeout(() => {
          console.log("[voice] fallback convert (onend not fired)");
          convertNow(buffer);
        }, 800);
      }
    });

    clrBtn?.addEventListener("click", () => {
      buffer = [];
      preview.innerHTML = "";
      output.value = "";
      setStatus("クリアしました");
    });

    shareBtn?.addEventListener("click", async () => {
      const text = output.value.trim();
      if (!text) return alert("共有するテキストがありません");
      if (navigator.share) {
        try {
          await navigator.share({ text });
          setStatus("共有しました", "ok");
        } catch {}
      } else {
        alert("この端末は共有に対応していません。コピーをご利用ください。");
      }
    });

    copyBtn?.addEventListener("click", async () => {
      const text = output.value.trim();
      if (!text) return alert("コピーするテキストがありません");
      await navigator.clipboard.writeText(text);
      setStatus("コピーしました。Slackに貼り付けてください。", "ok");
    });

    inited = true;
    setStatus("準備OK");
  }

  // DOM 完了後に初期化（kintone/iframeでも確実に）
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => requestAnimationFrame(init),
      { once: true }
    );
  } else {
    requestAnimationFrame(init);
  }
})();
