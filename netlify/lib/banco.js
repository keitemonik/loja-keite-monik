// Acesso ao banco do CRM (Supabase) usado pela loja
const URL_SB = process.env.SUPABASE_URL || "https://bdinijwgoajpiizxizhs.supabase.co";
const CHAVE = process.env.SUPABASE_KEY || "sb_publishable_RU98YL-ArsSMYaasML9TLQ_zGmNkSzU"; // chave pública

async function rest(caminho, opcoes = {}) {
  const r = await fetch(URL_SB + "/rest/v1/" + caminho, {
    ...opcoes,
    headers: { apikey: CHAVE, "Content-Type": "application/json", ...(opcoes.headers || {}) },
  });
  const texto = await r.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!r.ok) throw new Error((dados && (dados.message || dados.hint)) || "Erro no banco (" + r.status + ")");
  return dados;
}

// Variações vendáveis (com o produto e a categoria), indexadas pelo id da variação
async function variacoesAtivas(ids) {
  const lista = ids.map((i) => `"${String(i).replace(/[^0-9a-f-]/gi, "")}"`).join(",");
  const linhas = await rest(`loja_variantes?select=*,produto:loja_produtos(*,categoria:loja_categorias(*))&id=in.(${lista})&ativo=eq.true`);
  const mapa = {};
  for (const v of linhas) {
    if (!v.produto || !v.produto.ativo) continue;
    const cat = v.produto.categoria || {};
    mapa[v.id] = {
      variante_id: v.id, produto_id: v.produto.id, produtoNome: v.produto.nome,
      peso_g: v.peso_g, tamanho: v.tamanho, preco: Number(v.preco),
      precoDe: v.preco_de == null ? null : Number(v.preco_de), estoque: v.estoque,
      gramas: v.peso_g || v.produto.gramas || 100, fotos: v.produto.fotos || [],
      tipo_crm: cat.tipo_crm || "outro",
      textura: cat.textura || null,
    };
  }
  return mapa;
}

function rpc(nome, args) {
  return rest("rpc/" + nome, { method: "POST", body: JSON.stringify(args) });
}

module.exports = { variacoesAtivas, rpc };
