// GitHub Pages用のAPI（静的ファイルとして動作）
// 注意: これは実際のAPIではなく、デモ用の静的ファイルです

const API_BASE = "https://nippo-mvp-mlye-p3x9d8a4d-nagisa-horiis-projects.vercel.app";

// フォーム送信でAPIを呼び出す関数
async function callFormatAPI(text) {
  try {
    const response = await fetch(`${API_BASE}/api/format`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    throw error;
  }
}

// デモ用の変換結果（実際のAPIが使えない場合のフォールバック）
function getDemoResult(text) {
  // 簡単なデモ変換
  const lines = text.split('\n').filter(line => line.trim());
  let result = '';
  
  if (text.includes('非成約') || text.includes('断られた') || text.includes('遠い')) {
    result = `【体験番号 ⇨ 非成約】
【年齢】—
【仕事】—
【運動歴】—
【顕在ニーズ】—
【潜在ニーズ/インサイト】—
【自分が決めた方向性やテーマ】—
【感動ポイントと反応】—
【どんな教育（知識共有）を入れたか】—
【何と言われて断られたか】駅から遠いため
【断られた返し】—
【👍 good】—
【↕️ more】—
【自由記載欄】—`;
  } else {
    result = `【体験番号 ⇨ 成約】
【年齢】—
【仕事】—
【運動歴】—
【顕在ニーズ】—
【潜在ニーズ/インサイト】—
【自分が決めた方向性やテーマ】—
【感動ポイントと反応】—
【どんな教育（知識共有）を入れたか】—
【👍 good】—
【↕️ more】—
【自由記載欄】—`;
  }
  
  return { text: result, outcome: text.includes('非成約') ? '非成約' : '成約' };
}

// エクスポート（GitHub Pagesでは動作しないが、エラーを防ぐため）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { callFormatAPI, getDemoResult };
}