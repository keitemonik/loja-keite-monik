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
      categoria_id: cat.id || null, pai_id: cat.pai_id || null,
      tipo_crm: cat.tipo_crm || "outro",
      textura: cat.textura || null,
    };
  }
  return mapa;
}

// Aparência (oferta relâmpago) + campanhas no ar e seus preços especiais
async function regrasDePreco() {
  const [ap, campanhas] = await Promise.all([
    rest("loja_aparencia?select=oferta_ativa,oferta_inicio,oferta_horas,oferta_minutos&limit=1"),
    rest("loja_campanhas?select=id,nome,inicio,fim,prioridade,ativo,desconto_pct,desconto_categoria_id"),
  ]);
  const lista = campanhas || [];
  if (lista.length) {
    const precos = await rest(`loja_campanha_precos?select=campanha_id,variante_id,preco&campanha_id=in.(${lista.map((c) => `"${c.id}"`).join(",")})`);
    for (const c of lista) {
      c.desconto_pct = c.desconto_pct == null ? null : Number(c.desconto_pct);
      c.precos = {};
      for (const x of precos) if (x.campanha_id === c.id) c.precos[x.variante_id] = Number(x.preco);
    }
  }
  return { aparencia: (ap && ap[0]) || null, campanhas: lista };
}

function rpc(nome, args) {
  return rest("rpc/" + nome, { method: "POST", body: JSON.stringify(args) });
}

module.exports = { variacoesAtivas, regrasDePreco, rpc };
