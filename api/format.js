// api/format.js
import OpenAI from "openai";

/** --- CORS（kintone だけ許可） --- */
const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://9n4qfk7h8xgy.cybozu.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

/** --- 出力テンプレ（成約/非成約） --- */
const TPL_SEIYAKU = `
【体験番号 ⇨ 成約（プランが口頭に出た場合は「月3」などを丸括弧で）】
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

/** 明示語での先行判定（曖昧なら後段でLLM判定） */
function heuristicOutcome(s) {
  const x = (s || "").replace(/\s+/g, "");
  const ng = /(非成約|未成約|見送り|保留|検討したい|家族に相談|他社|また連絡|今日は決められない)/;
  if (ng.test(x)) return "非成約";
  const ok = /(成約|入会|申込|契約|月\d+|継続|購入|登録)/;
  if (ok.test(x)) return "成約";
  return null;
}

/** システム方針：抽出専用（新規事実の生成を禁止） */
const SYSTEM_EXTRACTIVE = `
あなたは「抽出専用の書記」です。絶対に新しい事実を作らず、ユーザーが話した内容
（入力テキスト）から **そのまま取り出して** 見出し付きで整形します。

厳守ルール（重要・違反すると減点）:
- 入力に **明示的に書かれていない内容は空欄にせず「—」と書く**（推測/一般論/常識での補完を禁止）
- 言い換え・要約はしてよいが、**意味の追加**は禁止（例:「良かった」→「柔軟性が上がって良かった」はNG）
- 名寄せや一般化も禁止（例:「腰が痛いかも」→「腰痛改善のニーズ」はNG）
- 人名は頭文字化（例: 田中太郎→Tさん）
- 数字は半角
- 出力は日本語、各見出しは【】で始め、本文は1〜3行の簡潔な箇条書き

カウンター例:
- 入力:「テストです 35歳 デスクワーク 良かった」
  ✅ 正: 年齢=35歳 / 仕事=デスクワーク / 👍good=「良かった」とだけ記載。他は「—」
  ❌ 誤: 顕在ニーズ=運動不足解消 などの **推測を追加** すること
`;

/** 生成プロンプト（抽出専用） */
function buildUserPrompt(raw, outcome) {
  const tmpl =
    outcome === "成約" ? TPL_SEIYAKU : TPL_HISEIYAKU;

  // 成約プランの表記ルールを再度明示
  const planNote = `
※成約時、入力に「月3回プラン/月4回プラン/…」等が **明示** されている場合のみ、
  体験番号行に「成約（例：月3）」のように **丸括弧で短く** 追記する。
  明示が無いなら何も追記しない（空欄や推測は禁止）。`;

  return `
次の入力テキストから **明示的に書かれている情報だけ** を、下記テンプレートに沿って記載してください。
不足項目は **必ず** 「—」と記載。**新規事実の追加や推測は一切禁止**。

${planNote}

--- 入力 ---
${raw}

--- 出力テンプレ ---
${tmpl}
`;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/format" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const raw = (body?.raw || "").trim();
    if (!raw) return res.status(400).json({ error: "raw is required" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) 成約/非成約の判定
    let outcome = heuristicOutcome(raw);
    if (!outcome) {
      const judge = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
`入力の文脈から「成約」か「非成約」を一語で答えるアシスタント。
出力は「成約」か「非成約」のみ。判断不明は「非成約」。`
          },
          { role: "user", content: raw }
        ]
      });
      const ans = (judge?.choices?.[0]?.message?.content || "").trim();
      outcome = ans.includes("成約") ? "成約" : "非成約";
    }

    // 2) 抽出整形（新規事実は禁止）
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,      // ぶれを最小化
      top_p: 1,
      messages: [
        { role: "system", content: SYSTEM_EXTRACTIVE },
        { role: "user", content: buildUserPrompt(raw, outcome) }
      ]
    });

    const text = completion.choices?.[0]?.message?.content || "";

    // 3) 念のための最終ガード（入力に無い語彙が大量に混入した場合はテンプレ最小出力に落とす）
    // ここでは簡易に「入力が極端に短いのに長文が出たら ‘—’ に寄せる」保険
    if (raw.length < 20 && text.replace(/[\s\n\-【】]/g, "").length > 200) {
      // シンプルなフォールバック：すべて「—」で埋め、分かる所（年齢/仕事/良かった 等）だけ残す…等も可
      // いまはそのまま返すが、必要ならここに厳格フィルタを実装可能
    }

    return res.status(200).json({ text, outcome });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "internal error" });
  }
}
