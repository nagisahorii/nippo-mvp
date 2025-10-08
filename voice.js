// voice.js
(() => {
  console.log("voice.js開始");
  console.log("document.readyState:", document.readyState);
  
  const API_BASE = "https://nippo-mvp-mlye.vercel.app";
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
    
    // まずVercelのAPIを試行
    try {
      const requestBody = { raw: text };
      console.log("送信するリクエストボディ:", requestBody);
      console.log("送信先URL:", `${API_BASE}${API_PATH}`);
      
      const res = await fetch(`${API_BASE}${API_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      
      console.log("レスポンスステータス:", res.status);
      console.log("レスポンスOK:", res.ok);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.log("エラーレスポンス:", errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      console.log("APIレスポンス:", data);
      if (out) out.value = data.text || "変換に失敗しました";
      setStatus("変換完了！", "ok");
    } catch (e) {
      console.error("API変換エラー:", e);
      
      // 403エラーの場合はkintoneアプリからのアクセスを促す
      if (e.message.includes("403")) {
        setStatus("kintoneアプリからご利用ください", "err");
        return;
      }
      
      console.log("フォールバック変換を実行中...");
      
      // フォールバック: クライアントサイド変換
      try {
        const result = convertTextToReport(text);
        if (out) out.value = result;
        setStatus("変換完了（フォールバック）！", "ok");
      } catch (fallbackError) {
        console.error("フォールバック変換エラー:", fallbackError);
        setStatus(`変換エラー: ${e.message}`, "err");
      }
    }
    setBusy(false);
  };

  // クライアントサイド変換関数
  const convertTextToReport = (text) => {
    // 成約/非成約の判定
    const isNonContract = /(非成約|未成約|見送り|保留|検討したい|家族に相談|他社(も)?検討|また連絡|今日は決め|決められない|決めません|成約しない|成約しません|入会しない|入会しません|契約しない|契約しません|申込しない|申込しません|申し込まない|申し込みません|断られた|遠い)/.test(text);
    
    // 体験番号の抽出
    const expMatch = text.match(/体験番号(\d+)/);
    const expNum = expMatch ? expMatch[1] : "—";
    
    // 年齢の抽出
    const ageMatch = text.match(/(\d+)歳/);
    const age = ageMatch ? ageMatch[1] : "—";
    
    // 仕事の抽出
    const jobMatch = text.match(/(デスクワーク|営業|事務|販売|接客|製造|工場|建設|運転|清掃|警備|介護|看護|教師|公務員|自営業|フリーランス|学生|無職|その他)/);
    const job = jobMatch ? jobMatch[1] : "—";
    
    // 運動歴の抽出
    const exerciseMatch = text.match(/運動歴[はは]?([^。]+)/);
    const exercise = exerciseMatch ? exerciseMatch[1].trim() : "—";
    
    // プランの抽出
    const planMatch = text.match(/月(\d+)/);
    const plan = planMatch ? `月${planMatch[1]}` : "";
    
    if (isNonContract) {
      return `【体験番号 ⇨ 非成約】
【年齢】${age}
【仕事】${job}
【運動歴】${exercise}
【顕在ニーズ】—
【潜在ニーズ/インサイト】—
【自分が決めた方向性やテーマ】—
【感動ポイントと反応】—
【どんな教育（知識共有）を入れたか】—
【何と言われて断られたか】—
【断られた返し】—
【👍 good】—
【↕️ more】—
【自由記載欄】—`;
    } else {
      return `【体験番号 ⇨ 成約${plan ? `（${plan}）` : ''}】
【年齢】${age}
【仕事】${job}
【運動歴】${exercise}
【顕在ニーズ】—
【潜在ニーズ/インサイト】—
【自分が決めた方向性やテーマ】—
【感動ポイントと反応】—
【どんな教育（知識共有）を入れたか】—
【👍 good】—
【↕️ more】—
【自由記載欄】—`;
    }
  };


  const shareText = async (text) => {
    // Web Share API が利用可能な場合
    if (navigator.share) {
      try {
        const shareData = {
          text: text,
          title: '日報'
          // URLは含めない（テキストのみ共有）
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

  // kintoneアクセス権限チェック
  const checkKintoneAccess = async () => {
    try {
      const res = await fetch(`${API_BASE}${API_PATH}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.status === 403) {
        const data = await res.json();
        console.log("kintone外からのアクセス検出:", data);
        return false;
      }
      
      return true;
    } catch (e) {
      console.log("アクセス権限チェックエラー:", e);
      return false;
    }
  };

  // DOMContentLoadedイベントで初期化
  const init = async () => {
    console.log("init開始");
    console.log("document.readyState:", document.readyState);
    
    // 要素取得を複数回試行（タイミング問題を解決）
    let elements = null;
    let retryCount = 0;
    const maxRetries = 5;
    
    while (!elements && retryCount < maxRetries) {
      elements = getElements();
      if (!elements || !elements.recBtn) {
        console.log(`要素取得リトライ ${retryCount + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
      } else {
        break;
      }
    }
    
    if (!elements || !elements.recBtn) {
      console.error("要素の取得に失敗しました");
      return;
    }
    
    recBtn = elements.recBtn;
    clrBtn = elements.clrBtn;
    prv = elements.prv;
    out = elements.out;
    shareBtn = elements.shareBtn;
    copyBtn = elements.copyBtn;
    statusEl = elements.statusEl;
    statusText = elements.statusText;
    spin = elements.spin;

    // kintoneアクセス権限をチェック
    const hasAccess = await checkKintoneAccess();
    if (!hasAccess) {
      if (statusEl) {
        statusEl.innerHTML = '<span style="color: #dc2626; font-weight: bold;">⚠️ kintoneアプリからご利用ください</span>';
        statusEl.style.display = "block";
      }
      if (recBtn) {
        recBtn.disabled = true;
        recBtn.textContent = "⚠️ kintone外からは利用できません";
        recBtn.style.background = "#ef4444";
        recBtn.style.color = "white";
      }
      return;
    }

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
        console.log("音声認識結果:", e);
        const results = Array.from(e.results);
        const latest = results[results.length - 1];
        console.log("最新の結果:", latest);
        console.log("isFinal:", latest.isFinal);
        console.log("transcript:", latest[0].transcript);
        
        if (latest.isFinal) {
          buffer.push(latest[0].transcript);
          console.log("bufferに追加:", latest[0].transcript);
          console.log("現在のbuffer:", buffer);
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
          console.log("録音停止時のbuffer:", buffer);
          console.log("bufferの長さ:", buffer.length);
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