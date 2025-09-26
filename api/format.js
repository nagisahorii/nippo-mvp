// api/format.js
import OpenAI from "openai";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // 必要に応じてドメイン制限
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

// Health check 用：GETは常に200を返す
export default async function handler(req, res) {
  try {
    setCors(res);

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, route: "/api/format" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // --- ここからPOST処理 ---
    // VercelのServerlessではreq.bodyが文字列のことがある → 安全にパース
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const raw = (body && body.raw) ? String(body.raw) : "";
    if (!raw.trim()) {
      return res.status(400).json({ error: "raw is required" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    const client = new OpenAI({ apiKey });

    const SYSTEM = `あなたは店舗インストラクター向け日報整形アシスタント。
出力は日本語。各見出しは【】で始め、内容は箇条書き1〜3行で簡潔に。
未記載は「—」。個人名は頭文字化（例：田中太郎→Tさん）。数値は半角。`;

    const TEMPLATE = `
【本日の振り返り】
【体験（番号＋成約/非成約）】
【年齢】
【仕事】
【運動歴】
【顕在ニーズ】
【潜在ニーズ】
【自分が決めた方向性やテーマ】
【感動ポイントと反応】
【どんな教育を入れたか】
【何と言われて断られたか】
【断られた返し】
【👍 good】
【↕️ more】
【自由記載欄】`;

    const user = `以下の音声起こしをテンプレに沿って整形してください。
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
  } catch (err) {
    // 何が落ちたかをレスポンスに出す（開発中のみ）
    return res.status(500).json({ error: (err && err.message) || "internal error" });
  }
}
