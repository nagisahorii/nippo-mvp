// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ← あなたのkintoneドメインに置き換え
const KINTONE_ORIGIN = "https://9n4qfk7h8xgy.cybozu.com";

export const config = {
  // 守るパス（トップ/JS/API すべて）
  matcher: ["/", "/voice.js", "/api/:path*"]
};

export function middleware(req: NextRequest) {
  const ref = req.headers.get("referer") || "";
  const origin = req.headers.get("origin") || "";

  // preflightは通す（CORS）
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 200 });
    res.headers.set("Access-Control-Allow-Origin", KINTONE_ORIGIN);
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return res;
  }

  // 許可条件：kintone からの遷移 or kintone をOriginに持つ
  const ok = origin.startsWith(KINTONE_ORIGIN) || ref.startsWith(KINTONE_ORIGIN);

  if (!ok) {
    return new NextResponse(
      JSON.stringify({ error: "Forbidden: please open this tool from kintone." }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  // kintone からのアクセスにはCORSを許可
  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", KINTONE_ORIGIN);
  res.headers.set("Vary", "Origin");
  return res;
}
