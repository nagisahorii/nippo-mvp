// api/format.js  （テスト用：どこからでも呼べる緩めCORS版）
// 本番に戻すときは Access-Control-Allow-Origin を限定してください。

import OpenAI from "openai";

// --- CORS（テスト中は完全開放） ---
const setCors = (req, res) => {
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", "*"); // ← TEST ONLY
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

// --- 生成用プロンプト ---
const SYSTEM = `あなたはピラティスインストラクター。新規顧客の体験レッスン後に作成する日報を整えます。
出力は日本語。各見出しは【】で始め、内容は簡潔な箇条書き(1〜3行)。
未記載は「—」。個人名は頭文字化（例：田中太郎→Tさん）。数値は半角。
成約時に顧客が「月3プラン／月4プラン／月6プラン／月8プラン」を選択した場合は、
「【体験番号 ⇨ 成約（月3）】」のように括弧つきでプラン名を表記してください。
プランについて言及がなければ括弧は書かず「【体験番号 ⇨ 成約】」だけにしてください。`;

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

// --- 先にルールベースで判定（高速・明示語優先）---
function heuristicOutcome(s) {
  const x = (s || "").replace(/\s+/g, "");
  const ng = /(非成約|未成約|見送り|保留|検討したい|家族に相談|他社も検討|また連絡|今日は決められない|今日は決めない|持ち帰り)/;
  if (ng.test(x)) return "非成約";
  const ok = /(成約|入会|申込|契約|継続|購入|登録|次回予約|月\d+|コース決定)/;
  if (ok.test(x)) return "成約";
  return null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/format" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const raw = (body?.raw || "").trim();
    if (!raw) return res.status(400).json({ error: "raw is required" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) まずヒューリスティック（明示語）で判定
    let outcome = heuristicOutcome(raw); // "成約" | "非成約" | null

    // 2) 明示語が無い/曖昧なら LLM で文脈判定
    if (!outcome) {
      const judge = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
`あなたは音声起こしから結果を判定するアシスタントです。
出力は「成約」か「非成約」のどちらか1語のみ。説明や句読点を付けないでください。
判断基準:
- 成約: 入会/契約/申込/継続/購入/月プラン決定/次回予約確定 などの意思が明確
- 非成約: 見送り/保留/他社比較/家族に相談/検討/今日は決めない などの意思
- どちらとも取れる場合は「非成約」`
          },
          { role: "user", content: raw }
        ]
      });
      const j = (judge.choices?.[0]?.message?.content || "").trim();
      outcome = j.includes("成約") ? "成約" : "非成約";
    }

    // 3) テンプレ選択
    const TEMPLATE = outcome === "成約" ? TPL_SEIYAKU : TPL_HISEIYAKU;

    // 4) 生成
    const user = `以下の音声起こしを、選択されたテンプレート（${outcome}）に沿って整えてください。
不足しているが文脈から補える補助語は最小限で補って可。冗長表現は避けて簡潔に。
--- 音声起こし ---
${raw}
--- 出力テンプレ ---
${TEMPLATE}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user }
      ]
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text, outcome });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "internal error" });
  }
}
