// api/format.js
import OpenAI from "openai";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://9n4qfk7h8xgy.cybozu.com"); // kintoneドメイン固定
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const SYSTEM = `あなたはピラティスインストラクター。新規顧客の体験レッスン後に作成する日報を整形します。
出力は日本語。各見出しは【】で始め、内容は簡潔な箇条書き(1〜3行)でまとめる。
未記載は「—」。個人名は頭文字化（例：田中太郎→Tさん）。数値は半角。
専門用語は過剰に使わず、顧客とスタッフ双方が読んで理解できる表現に。
`;

const TEMPLATE = `
【体験（番号＋成約/非成約）】
【年齢】
【仕事】
【運動歴】
【顕在ニーズ】
【潜在ニーズ/インサイト】
【自分が決めた方向性やテーマ】
【感動ポイントと反応】
【どんな教育（感動時の知識共有）を入れたか】
【何と言われて断られたか】
【断られた返し】
【👍 good】
【↕️ more】
【自由記載欄】`;

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
    const user = `次の音声起こしをテンプレに沿って要点を整理し、過不足を補ってください。サンプルの密度感を意識し、話者の意図を壊さない範囲で短い補助語を加えて読みやすくしてください。
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
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "internal error" });
  }
}
