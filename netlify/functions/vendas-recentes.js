// Vendas reais do CRM (só primeiro nome, cidade, produto e data) para o aviso da loja
const URL_SB = process.env.SUPABASE_URL || "https://bdinijwgoajpiizxizhs.supabase.co";
const CHAVE = process.env.SUPABASE_KEY || "sb_publishable_RU98YL-ArsSMYaasML9TLQ_zGmNkSzU"; // chave pública

exports.handler = async () => {
  try {
    const r = await fetch(URL_SB + "/rest/v1/rpc/vendas_recentes_publicas", {
      method: "POST",
      headers: { apikey: CHAVE, "Content-Type": "application/json" },
      body: "{}",
    });
    const vendas = r.ok ? await r.json() : [];
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      body: JSON.stringify({ vendas: Array.isArray(vendas) ? vendas : [] }),
    };
  } catch {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: '{"vendas":[]}' };
  }
};
