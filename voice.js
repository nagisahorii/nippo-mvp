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
    statusEl.classList.remove("ok","err");
    if (type === "ok") statusEl.classList.add("ok");
    else if (type === "err") statusEl.classList.add("err");
    statusText.textContent = msg;
  };
  const setBusy = (busy) => busy ? spin.classList.add("on") : spin.classList.remove("on");

  async function convertNow(){
    const text = buffer.join("。").trim();
    if (!text){ setBusy(false); setStatus("テキストがありません", "err"); return; }
    try{
      const r = await fetch(API_BASE + API_PATH, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ raw: text })
      });
      const data = await r.json().catch(()=> ({}));
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} : ${data?.error || "API error"}`);
      out.value = data.text || "";
      setStatus("変換完了", "ok");
    }catch(e){
      console.error(e);
      setStatus("変換エラー： " + e.message, "err");
      alert("変換に失敗しました。通信状態やAPI設定を確認してください。");
    }finally{
      setBusy(false);
    }
  }

  if (SR){
    sr = new SR();
    sr.lang = "ja-JP";
    sr.interimResults = true;
    sr.continuous = true;

    sr.onstart = () => setStatus("録音中… 話し終えたら停止を押してください");
    sr.onresult = (e) => {
      const parts = [];
      for (let i=0;i<e.results.length;i++){
        parts.push(e.results[i][0].transcript.trim());
      }
      prv.innerHTML = ""; buffer = [];
      parts.forEach(t=>{
        if(!t) return;
        buffer.push(t);
        const li = document.createElement("li"); li.textContent = t; prv.appendChild(li);
      });
      prv.scrollTop = prv.scrollHeight;
    };
    sr.onend = async () => {
      clearTimeout(endTimer);
      setStatus("変換中…"); setBusy(true);
      await convertNow();
    };
    sr.onerror = (e)=>{
      const map = {
        "no-speech":"音声が検出できません。マイクの入力レベル・距離を調整してください。",
        "audio-capture":"マイクが見つかりません。デバイス設定を確認してください。",
        "not-allowed":"マイクの使用が拒否されています。URLバーのマイクから許可してください。",
        "service-not-allowed":"ブラウザ/OSで音声認識が許可されていません。",
        "aborted":"認識が中断されました。再試行してください。",
        "network":"ネットワークエラー。通信を確認してください。"
      };
      setStatus(map[e.error] || `音声認識エラー: ${e.error||"unknown"}`, "err");
    };
  }else{
    setStatus("このブラウザは音声入力に対応していません（PCのChrome/Edge推奨）", "err");
  }

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
      buffer=[]; prv.innerHTML="";
      try{ sr.start(); on=true; recBtn.textContent="■ 停止"; setStatus("録音中…"); }
      catch{ setStatus("録音開始に失敗しました。タブをアクティブにして再試行してください。","err"); }
    }else{
      try{ sr.stop(); }catch{}
      on=false; recBtn.textContent="🎙️ 録音開始";
      setStatus("変換中…"); setBusy(true);
      endTimer = setTimeout(()=> convertNow(), 800); // 保険
    }
  };

  clrBtn.onclick = ()=>{ buffer=[]; prv.innerHTML=""; out.value=""; setStatus("クリアしました"); };

  shareBtn.onclick = async ()=>{
    const text = out.value.trim();
    if (!text) return alert("共有するテキストがありません");
    
    // Web Share API が利用可能な場合（より確実にチェック）
    if (navigator.share) {
      try {
        // 共有データを準備
        const shareData = {
          text: text,
          title: '日報',
          url: window.location.href
        };
        
        // canShareでチェック（利用可能な場合のみ）
        if (navigator.canShare && !navigator.canShare(shareData)) {
          throw new Error('このコンテンツは共有できません');
        }
        
        await navigator.share(shareData);
        setStatus("共有しました","ok");
        return;
      } catch (e) {
        console.log("Web Share API failed:", e);
        // ユーザーがキャンセルした場合は何もしない
        if (e.name === 'AbortError') {
          setStatus("共有をキャンセルしました");
          return;
        }
        // その他のエラーの場合はフォールバックに進む
      }
    }
    
    // フォールバック: コピー機能
    try {
      await navigator.clipboard.writeText(text);
      setStatus("テキストをコピーしました。他のアプリで貼り付けてください。","ok");
    } catch (e) {
      // 最終フォールバック: テキストエリアを選択状態にする
      out.select();
      out.setSelectionRange(0, 99999);
      setStatus("テキストを選択しました。手動でコピーしてください。","ok");
    }
  };

  copyBtn.onclick = async ()=>{
    const text = out.value.trim();
    if (!text) return alert("コピーするテキストがありません");
    await navigator.clipboard.writeText(text);
    setStatus("コピーしました。Slackで共有してください。","ok");
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
          buffer=[]; prv.innerHTML="";
          try{ sr.start(); on=true; recBtn.textContent="■ 停止"; setStatus("録音中…"); }
          catch{ setStatus("録音開始に失敗しました。タブをアクティブにして再試行してください。","err"); }
        }else{
          try{ sr.stop(); }catch{}
          on=false; recBtn.textContent="🎙️ 録音開始";
          setStatus("変換中…"); setBusy(true);
          endTimer = setTimeout(()=> convertNow(), 800); // 保険
        }
      };

      clrBtn.onclick = ()=>{
        if (on) return alert("録音中です。先に停止してください。");
        prv.innerHTML = ""; out.value = ""; setStatus("クリアしました。");
      };

      shareBtn.onclick = async ()=>{
        const text = out.value.trim();
        if (!text) return alert("共有するテキストがありません");
        await shareText(text);
      };

      copyBtn.onclick = async ()=>{
        const text = out.value.trim();
        if (!text) return alert("コピーするテキストがありません");
        await navigator.clipboard.writeText(text);
        setStatus("コピーしました。Slackで共有してください。","ok");
      };
    
      console.log("イベントハンドラー設定完了");
    } catch (error) {
      console.error("イベントハンドラー設定エラー:", error);
    }
  };

  // DOMContentLoadedイベントで初期化
  console.log("初期化処理開始");
  console.log("document.readyState:", document.readyState);
  
  if (document.readyState === 'loading') {
    console.log("DOMContentLoadedイベントを待機");
    document.addEventListener('DOMContentLoaded', init);
  } else {
    console.log("即座に初期化実行");
    // 少し遅延させて実行
    setTimeout(() => {
      console.log("遅延実行開始");
      init();
    }, 100);
  }
})();
