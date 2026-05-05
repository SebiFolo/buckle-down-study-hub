import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Best-effort text extraction for PDF, DOCX, PPTX, plain text, or Google Docs share URL.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();

    // Mode A: Google Docs link
    if (body.gdocUrl) {
      const url = String(body.gdocUrl);
      const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
      if (!m) return json({ error: "Invalid Google Docs URL" }, 400);
      const docId = m[1];
      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      const r = await fetch(exportUrl);
      if (!r.ok) return json({ error: "Could not fetch Google Doc. Make sure sharing is set to 'Anyone with the link'." }, 400);
      const text = await r.text();
      return json({ text, fileType: "gdocs" });
    }

    // Mode B: file (base64)
    const { fileBase64, fileType, fileName } = body;
    if (!fileBase64) return json({ error: "Missing file" }, 400);
    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));

    let text = "";
    const ft = String(fileType || "").toLowerCase();

    if (ft === "pdf") {
      // Deno-compatible PDF text extraction via unpdf
      const { extractText } = await import("https://esm.sh/unpdf@0.12.1");
      const { text: extracted } = await extractText(bytes, { mergePages: true });
      text = Array.isArray(extracted) ? extracted.join("\n\n") : extracted;
    } else if (ft === "docx") {
      const mammoth = await import("https://esm.sh/mammoth@1.7.0?bundle");
      const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
      text = result.value;
    } else if (ft === "pptx") {
      // PPTX = zip of XML; extract text from slide XMLs
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
    } else if (ft === "txt" || ft === "md") {
      text = new TextDecoder().decode(bytes);
    } else {
      return json({ error: `Unsupported file type: ${fileType}` }, 400);
    }

    text = text.replace(/\s+/g, " ").trim();
    if (!text) return json({ error: "No text could be extracted" }, 400);
    return json({ text, fileType: ft, fileName });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
