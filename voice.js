// voice.js
(() => {
  console.log("voice.js開始");
  console.log("document.readyState:", document.readyState);
  
  const API_BASE = "https://nippo-mvp-mlye-hup4g5bl0-nagisa-horiis-projects.vercel.app";
  const API_PATH = "/api/format";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  console.log("SR:", SR);
  
  // DOM要素を取得する関数
  const getElements = () => {
    console.log("要素取得開始");
    console.log("document.body:", document.body);
    console.log("document.querySelector('#btn-rec'):", document.querySelector('#btn-rec'));
    console.log("document.querySelectorAll('button'):", document.querySelectorAll('button'));
    console.log("document.querySelectorAll('[id]'):", document.querySelectorAll('[id]'));
    
    // すべてのボタンを詳細に調査
    const allButtons = document.querySelectorAll('button');
    console.log("すべてのボタン:", allButtons);
    console.log("ボタンの数:", allButtons.length);
    allButtons.forEach((btn, index) => {
      console.log(`ボタン${index}:`, btn);
      console.log(`  - id: ${btn.id}`);
      console.log(`  - class: ${btn.className}`);
      console.log(`  - text: ${btn.textContent}`);
      console.log(`  - visible: ${btn.offsetParent !== null}`);
    });
    
    // 特定のテキストを含む要素を検索
    const elementsWithText = document.querySelectorAll('*');
    const recordingElements = Array.from(elementsWithText).filter(el => 
      el.textContent && el.textContent.includes('録音開始')
    );
    console.log("'録音開始'を含む要素:", recordingElements);
    recordingElements.forEach((el, index) => {
      console.log(`録音要素${index}:`, el);
      console.log(`  - tagName: ${el.tagName}`);
      console.log(`  - id: ${el.id}`);
      console.log(`  - class: ${el.className}`);
      console.log(`  - text: ${el.textContent}`);
    });
    
    // HTMLの内容を確認
    console.log("document.documentElement.outerHTML:", document.documentElement.outerHTML.substring(0, 1000) + "...");
    console.log("document.body.innerHTML:", document.body.innerHTML.substring(0, 1000) + "...");
    
    // kintone内のiframeの可能性を確認
    console.log("window.parent:", window.parent);
    console.log("window.parent === window:", window.parent === window);
    
    // 親フレームの要素も確認
    if (window.parent !== window) {
      try {
        const parentButtons = window.parent.document.querySelectorAll('button');
        console.log("親フレームのボタン:", parentButtons);
        parentButtons.forEach((btn, index) => {
          console.log(`親ボタン${index}:`, btn);
          console.log(`  - id: ${btn.id}`);
          console.log(`  - class: ${btn.className}`);
          console.log(`  - text: ${btn.textContent}`);
        });
      } catch (e) {
        console.log("親フレームへのアクセスエラー:", e);
      }
    }
    
    // より詳細な要素検索
    console.log("document.querySelectorAll('[id*=\"btn\"]'):", document.querySelectorAll('[id*="btn"]'));
    console.log("document.querySelectorAll('[class*=\"btn\"]'):", document.querySelectorAll('[class*="btn"]'));
    console.log("document.querySelectorAll('button[class*=\"btn-lg\"]'):", document.querySelectorAll('button[class*="btn-lg"]'));
    
    // より広範囲で要素を検索
    let recBtn = document.getElementById("btn-rec") || 
                 document.querySelector("#btn-rec") || 
                 document.querySelector("button[class*='btn-lg']") ||
                 Array.from(document.querySelectorAll("button")).find(btn => btn.textContent.includes("録音開始"));
    
    // まだ見つからない場合は、より詳細に検索
    if (!recBtn) {
      console.log("録音ボタンが見つからないため、より詳細に検索中...");
      
      // すべての要素から検索
      const allElements = document.querySelectorAll('*');
      recBtn = Array.from(allElements).find(el => 
        el.textContent && el.textContent.trim() === '録音開始' && 
        (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'A')
      );
      
      if (recBtn) {
        console.log("録音ボタンを発見:", recBtn);
      } else {
        console.log("録音ボタンが見つかりませんでした");
        
        // kintone内での表示を確認
        console.log("kintone内での表示を確認中...");
        console.log("現在のURL:", window.location.href);
        console.log("現在のドメイン:", window.location.hostname);
        
        // より直接的な検索
        const buttons = document.querySelectorAll('button');
        console.log("見つかったボタン数:", buttons.length);
        buttons.forEach((btn, i) => {
          console.log(`ボタン${i}: "${btn.textContent}" (id: ${btn.id})`);
        });
      }
    }
    
    const clrBtn = document.getElementById("btn-clear") || 
                   document.querySelector("#btn-clear") || 
                   Array.from(document.querySelectorAll("button")).find(btn => btn.textContent.includes("クリア"));
    
    const prv = document.getElementById("preview") || 
                document.querySelector("#preview") || 
                document.querySelector("ol[id='preview']");
    
    const out = document.getElementById("output") || 
                document.querySelector("#output") || 
                document.querySelector("textarea[id='output']");
    
    const shareBtn = document.getElementById("btn-share") || 
                     document.querySelector("#btn-share") || 
                     Array.from(document.querySelectorAll("button")).find(btn => btn.textContent.includes("共有"));
    
    const copyBtn = document.getElementById("btn-copy") || 
                    document.querySelector("#btn-copy") || 
                    Array.from(document.querySelectorAll("button")).find(btn => btn.textContent.includes("コピー"));
    
    const statusEl = document.getElementById("status") || 
                     document.querySelector("#status") || 
                     document.querySelector(".status");
    
    const statusText = document.getElementById("status-text") || 
                       document.querySelector("#status-text");
    
    const spin = document.getElementById("spin") || 
                 document.querySelector("#spin") || 
                 document.querySelector(".spinner");
    
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
    console.log("変換開始:", text);
    try {
      const res = await fetch(`${API_BASE}${API_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("APIレスポンス:", data);
      if (out) out.value = data.text || "変換に失敗しました";
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
    // 少し遅延させて実行
    setTimeout(() => {
      console.log("遅延実行開始");
      init();
    }, 100);
  });
})();