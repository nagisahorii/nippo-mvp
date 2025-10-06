// voice.js
(() => {
  console.log("voice.js開始");
  console.log("document.readyState:", document.readyState);
  
  const API_BASE = "https://nippo-mvp-mlye-ealwetn42-nagisa-horiis-projects.vercel.app";
  const API_PATH = "/api/format";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  console.log("SR:", SR);
  
  // DOM要素を取得する関数
  const getElements = () => {
    const recBtn = document.getElementById("btn-rec");
    const clrBtn = document.getElementById("btn-clear");
    const prv = document.getElementById("preview");
    const out = document.getElementById("output");
    const shareBtn = document.getElementById("btn-share");
    const copyBtn = document.getElementById("btn-copy");
    const statusEl = document.getElementById("status");
    const statusText = document.getElementById("status-text");
    const spin = document.getElementById("spin");
    
    console.log("要素の取得状況:");
    console.log("recBtn:", recBtn);
    console.log("clrBtn:", clrBtn);
    console.log("prv:", prv);
    console.log("out:", out);
    
    return { recBtn, clrBtn, prv, out, shareBtn, copyBtn, statusEl, statusText, spin };
  };
  
  let sr = null, on = false, buffer = [];
  let endTimer = null;
  let recBtn, clrBtn, prv, out, shareBtn, copyBtn, statusEl, statusText, spin;

  const setStatus = (msg, type = "hint") => {
    if (statusEl) {
      statusEl.classList.remove("ok","err");
      if (type === "ok") statusEl.classList.add("ok");
      else if (type === "err") statusEl.classList.add("err");
      if (statusText) statusText.textContent = msg;
    }
  };

  const setBusy = (busy) => {
    if (spin) spin.style.display = busy ? "inline-block" : "none";
  };

  const convertNow = async () => {
    if (buffer.length === 0) { setStatus("変換するテキストがありません"); setBusy(false); return; }
    const text = buffer.join(" ");
    try {
      const res = await fetch(`${API_BASE}${API_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (out) out.value = data.result || "変換に失敗しました";
      setStatus("変換完了！", "ok");
    } catch (e) {
      console.error("変換エラー:", e);
      setStatus(`変換エラー: ${e.message}`, "err");
    }
    setBusy(false);
  };

  const shareText = async (text) => {
    // Web Share API が利用可能な場合
    if (navigator.share) {
      try {
        const shareData = {
          text: text,
          title: '日報',
          url: window.location.href
        };
        
        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setStatus("共有しました！", "ok");
          return;
        }
      } catch (e) {
        console.log("Web Share API エラー:", e);
      }
    }
    
    // フォールバック: コピー機能
    try {
      await navigator.clipboard.writeText(text);
      setStatus("テキストをコピーしました。他のアプリで貼り付けてください。","ok");
    } catch (e) {
      // 最終フォールバック: テキストエリアを選択状態にする
      if (out) {
        out.select();
        out.setSelectionRange(0, 99999);
        setStatus("テキストを選択しました。手動でコピーしてください。","ok");
      }
    }
  };

  // DOMContentLoadedイベントで初期化
  const init = () => {
    console.log("init開始");
    console.log("document.readyState:", document.readyState);
    
    const elements = getElements();
    recBtn = elements.recBtn;
    clrBtn = elements.clrBtn;
    prv = elements.prv;
    out = elements.out;
    shareBtn = elements.shareBtn;
    copyBtn = elements.copyBtn;
    statusEl = elements.statusEl;
    statusText = elements.statusText;
    spin = elements.spin;

    console.log("要素取得後の状態:");
    console.log("recBtn:", recBtn);
    console.log("clrBtn:", clrBtn);

    if (!recBtn) {
      console.error("録音ボタンが見つかりません");
      console.log("document.getElementById('btn-rec'):", document.getElementById("btn-rec"));
      return;
    }

    // 音声認識の初期化
    if (SR) {
      sr = new SR();
      sr.continuous = true;
      sr.interimResults = true;
      sr.lang = "ja-JP";
      
      sr.onresult = (e) => {
        const results = Array.from(e.results);
        const latest = results[results.length - 1];
        if (latest.isFinal) {
          buffer.push(latest[0].transcript);
          if (prv) prv.innerHTML += `<li>${latest[0].transcript}</li>`;
        }
      };
      
      sr.onend = () => {
        if (on) {
          on = false;
          if (recBtn) recBtn.textContent = "🎙️ 録音開始";
          setStatus("変換中…");
          setBusy(true);
          convertNow();
        }
      };
      
      sr.onerror = (e) => {
        const map = {
          "no-speech": "音声が検出されませんでした。もう一度お試しください。",
          "audio-capture": "マイクにアクセスできません。",
          "not-allowed": "マイクの使用が許可されていません。",
          "aborted": "認識が中断されました。再試行してください。",
          "network": "ネットワークエラー。通信を確認してください。"
        };
        setStatus(map[e.error] || `音声認識エラー: ${e.error||"unknown"}`, "err");
      };
    } else {
      setStatus("このブラウザは音声入力に対応していません（PCのChrome/Edge推奨）", "err");
    }

    // イベントハンドラーを設定
    setupEventHandlers();
  };

  const setupEventHandlers = () => {
    console.log("setupEventHandlers開始");
    console.log("recBtn:", recBtn);
    console.log("clrBtn:", clrBtn);
    
    if (!recBtn) {
      console.error("recBtnがnullです！");
      return;
    }
    
    try {
      console.log("recBtn.onclickを設定中...");
      recBtn.onclick = async ()=>{
        console.log("録音ボタンがクリックされました");
        console.log("sr:", sr);
        console.log("on:", on);
        if (!sr){ alert("対応ブラウザでお試しください（PCのChrome/Edge推奨）"); return; }
        if (!on){
          try{
            if (navigator.mediaDevices?.getUserMedia){
              const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
              stream.getTracks().forEach(t=>t.stop());
            }
          }catch{
            setStatus("マイク権限がありません。URLバーのマイクから許可してください。","err");
            return;
          }
          buffer=[]; 
          if (prv) prv.innerHTML="";
          try{ 
            sr.start(); 
            on=true; 
            if (recBtn) recBtn.textContent="■ 停止"; 
            setStatus("録音中…"); 
          }
          catch{ 
            setStatus("録音開始に失敗しました。タブをアクティブにして再試行してください。","err"); 
          }
        }else{
          try{ sr.stop(); }catch{}
          on=false; 
          if (recBtn) recBtn.textContent="🎙️ 録音開始";
          setStatus("変換中…"); 
          setBusy(true);
          endTimer = setTimeout(()=> convertNow(), 800); // 保険
        }
      };

      if (clrBtn) {
        clrBtn.onclick = ()=>{
          if (on) return alert("録音中です。先に停止してください。");
          if (prv) prv.innerHTML = ""; 
          if (out) out.value = ""; 
          setStatus("クリアしました。");
        };
      }

      if (shareBtn) {
        shareBtn.onclick = async ()=>{
          const text = out ? out.value.trim() : "";
          if (!text) return alert("共有するテキストがありません");
          await shareText(text);
        };
      }

      if (copyBtn) {
        copyBtn.onclick = async ()=>{
          const text = out ? out.value.trim() : "";
          if (!text) return alert("コピーするテキストがありません");
          await navigator.clipboard.writeText(text);
          setStatus("コピーしました。Slackで共有してください。","ok");
        };
      }
    
      console.log("イベントハンドラー設定完了");
    } catch (error) {
      console.error("イベントハンドラー設定エラー:", error);
    }
  };

  // DOMContentLoadedイベントで初期化
  console.log("初期化処理開始");
  console.log("document.readyState:", document.readyState);
  
  // 常にDOMContentLoadedイベントを待機
  document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoadedイベント発生");
    init();
  });
})();