import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_TYPES = new Set(["pdf", "docx", "pptx", "txt", "md"]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return jsonResponse(req, { error: "Unauthorized" }, 401);
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));

    // Mode A: Google Docs link
    if (body.gdocUrl) {
      const url = String(body.gdocUrl);
      const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
      if (!m) return jsonResponse(req, { error: "Invalid Google Docs URL" }, 400);
      const docId = m[1];
      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      const r = await fetch(exportUrl);
      if (!r.ok) return jsonResponse(req, { error: "Could not fetch Google Doc. Make sure sharing is set to 'Anyone with the link'." }, 400);
      const text = await r.text();
      return jsonResponse(req, { text, fileType: "gdocs" });
    }

    // Mode B: file (base64)
    const fileBase64 = typeof body.fileBase64 === "string" ? body.fileBase64 : "";
    const ft = String(body.fileType || "").toLowerCase();
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 255) : "";

    if (!fileBase64) return jsonResponse(req, { error: "Missing file" }, 400);
    if (!ALLOWED_TYPES.has(ft)) return jsonResponse(req, { error: "Unsupported file type" }, 400);

    // base64 length to byte size estimate
    const approxBytes = Math.floor(fileBase64.length * 0.75);
    if (approxBytes > MAX_BYTES) return jsonResponse(req, { error: "File too large (max 20 MB)" }, 413);

    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_BYTES) return jsonResponse(req, { error: "File too large (max 20 MB)" }, 413);

    let text = "";

    if (ft === "pdf") {
      // Magic-byte sniff: %PDF
      if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
        return jsonResponse(req, { error: "File does not look like a PDF" }, 400);
      }
      const { extractText } = await import("https://esm.sh/unpdf@0.12.1");
      const { text: extracted } = await extractText(bytes, { mergePages: true });
      text = Array.isArray(extracted) ? extracted.join("\n\n") : extracted;
    } else if (ft === "docx" || ft === "pptx") {
      // DOCX/PPTX are zip files: PK\x03\x04
      if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
        return jsonResponse(req, { error: `File does not look like a ${ft.toUpperCase()}` }, 400);
      }
      if (ft === "docx") {
        const mammoth = await import("https://esm.sh/mammoth@1.7.0?bundle");
        const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
        text = result.value;
      } else {
        const { unzipSync, strFromU8 } = await import("https://esm.sh/fflate@0.8.2");
        const files = unzipSync(bytes);
        const slideKeys = Object.keys(files).filter((k) => k.startsWith("ppt/slides/slide") && k.endsWith(".xml"));
        const parts: string[] = [];
        for (const k of slideKeys.sort()) {
          const xml = strFromU8(files[k]);
          const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
          parts.push(matches.map((m) => m.replace(/<[^>]+>/g, "")).join(" "));
        }
        text = parts.join("\n\n");
      }
    } else {
      text = new TextDecoder().decode(bytes);
    }

    text = text.replace(/\s+/g, " ").trim();
    if (!text) return jsonResponse(req, { error: "No text could be extracted" }, 400);
    return jsonResponse(req, { text, fileType: ft, fileName });
  } catch (e) {
    console.error("[extract-text] unexpected error", e);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});
