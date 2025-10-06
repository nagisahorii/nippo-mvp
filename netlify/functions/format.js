// netlify/functions/format.js
const OpenAI = require("openai");

/** --- CORS（全ドメイン許可） --- */
const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Access-Control-Allow-Credentials", "false");
  res.setHeader("Vary", "Origin");
};

/** --- 出力テンプレ（※プラン注記はテンプレに書かない） --- */
const TPL_SEIYAKU = `
【体験番号 ⇨ 成約】
【年齢】
【仕事】
【運動歴】
【顕在ニーズ】
【潜在ニーズ/インサイト】
【自分が決めた方向性やテーマ】
【感動ポイントと反応】
【どんな教育（知識共有）を入れたか】
【👍 good】
【↕️ more】
【自由記載欄】`;

const TPL_HISEIYAKU = `
【体験番号 ⇨ 非成約】
【年齢】
【仕事】
【運動歴】
【顕在ニーズ】
【潜在ニーズ/インサイト】
【自分が決めた方向性やテーマ】
【感動ポイントと反応】
【どんな教育（知識共有）を入れたか】
【何と言われて断られたか】
【断られた返し】
【👍 good】
【↕️ more】
【自由記載欄】`;

/** 明示語での先行判定（否定を最優先） */
function heuristicOutcome(s) {
  const x = (s || "").replace(/\s+/g, "");

  // まず否定表現（「成約しない」「入会しません」など）
  const neg = /(非成約|未成約|見送り|保留|検討したい|家族に相談|他社(も)?検討|また連絡|今日は決め|決められない|決めません|成約しない|成約しません|入会しない|入会しません|契約しない|契約しません|申込しない|申込しません|申し込まない|申し込みません)/;
  if (neg.test(x)) return "非成約";

  // 肯定表現（※否定を先に見たのでここは純粋肯定）
  const ok = /(成約|入会|契約|申込|申し込(み)?|登録|購入|継続|月\d+)/;
  if (ok.test(x)) return "成約";

  return null;
}

/** 抽出専用のシステム方針（新規事実の生成は禁止） */
const SYSTEM_EXTRACTIVE = `
あなたは抽出専用の書記です。入力に明示されている情報だけを取り出して整形します。
厳守:
- 入力に無い内容は「—」と記載（推測/一般論で補完しない）
- 言い換えは可だが意味の追加は禁止
- 人名は頭文字化、数字は半角
- 出力は日本語、各見出しは【】で始め、本文は1〜3行の簡潔な箇条書き
`;

/** 生成プロンプト（抽出のみ、プランは明示された時だけ括弧で短く） */
function buildUserPrompt(raw, outcome) {
  const tmpl = outcome === "成約" ? TPL_SEIYAKU : TPL_HISEIYAKU;
  const planNote = `
成約の場合、入力に「月3/4/6/8回プラン」等が**明示**されている時だけ、
体験番号の行を「【体験番号 ⇨ 成約（例：月3）】」のように括弧で短く追記。
明示が無ければ何も足さない。`;

  return `
次の入力から**明示的に書かれている情報だけ**をテンプレに記入。
不足は必ず「—」。新規事実の追加や推測は禁止。

${planNote}

--- 入力 ---
${raw}

--- 出力テンプレ ---
${tmpl}
`;
}

exports.handler = async (event, context) => {
  // CORS設定を最初に適用
  setCors(context);

  // OPTIONSリクエストの処理（プリフライトリクエスト）
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Credentials": "false"
      },
      body: ""
    };
  }

  // 認証を完全に無効化
  console.log("API呼び出し:", event.httpMethod, event.path);
  
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: true, route: "/api/format" })
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    let body = event.body;
    if (typeof body === "string") { 
      try { 
        body = JSON.parse(body); 
      } catch { 
        body = {}; 
      } 
    }
    const raw = (body?.text || "").trim();
    if (!raw) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "text is required" })
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "OpenAI API key not configured" })
      };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) 成約/非成約の判定（否定優先ヒューリスティック → LLM）
    let outcome = heuristicOutcome(raw);
    if (!outcome) {
      const judge = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
`入力の文脈から「成約」か「非成約」を一語で出力。
「成約しない／成約しません／入会しない／入会しません」等の**否定**は必ず「非成約」。
出力は「成約」か「非成約」のみ。判断不明は「非成約」。`
          },
          { role: "user", content: raw }
        ]
      });
      const ans = (judge?.choices?.[0]?.message?.content || "").trim();
      outcome = ans.includes("成約") && !ans.includes("非成約") ? "成約" : "非成約";
    }

    // 2) 抽出整形（追加禁止）
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_EXTRACTIVE },
        { role: "user", content: buildUserPrompt(raw, outcome) }
      ]
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, outcome })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: e?.message || "internal error" })
    };
  }
};
