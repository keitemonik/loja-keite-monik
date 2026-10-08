// Cálculo de frete no SuperFrete (usado pelas funções frete e pagamento)
const catalogo = require("../../produtos.json");
const { variacoesAtivas, regrasDePreco } = require("./banco");
const Precos = require("../../precos.js");

const API = process.env.SUPERFRETE_SANDBOX === "true"
  ? "https://sandbox.superfrete.com/api/v0/calculator"
  : "https://api.superfrete.com/api/v0/calculator";


function soDigitos(v) { return String(v || "").replace(/\D/g, ""); }

function rotulo(v) {
  return [v.produtoNome, v.peso_g ? v.peso_g + "g" : null, v.tamanho].filter(Boolean).join(" · ");
}

// Confere os itens da sacola com o painel (o preço nunca vem do navegador)
async function validarItens(itens) {
  if (!Array.isArray(itens) || !itens.length) throw new Error("Sacola vazia.");
  const [mapa, regras] = await Promise.all([variacoesAtivas(itens.map((i) => i.id)), regrasDePreco()]);
  // 5 min de tolerância para quem estava pagando quando a oferta/campanha virou
  const ctx = Precos.contexto(regras.aparencia, regras.campanhas, Date.now(), 5);
  return itens.map((i) => {
    const v = mapa[i.id];
    const qtd = Math.max(1, Math.min(20, parseInt(i.qtd, 10) || 1));
    if (!v) throw new Error("Um item da sacola não está mais disponível. Remova e tente de novo.");
    const nome = rotulo(v);
    if (v.estoque != null && v.estoque < qtd) {
      throw new Error(v.estoque === 0 ? `${nome} esgotou.` : `Só temos ${v.estoque} unidade(s) de ${nome}.`);
    }
    const preco = Precos.precoInfo({ id: v.variante_id, preco: v.preco, precoDe: v.precoDe, categoria_id: v.categoria_id, pai_id: v.pai_id, fixo: v.fixo }, ctx).preco;
    return { ...v, nome, preco, qtd };
  });
}

function montarPacote(itens) {
  const emb = catalogo.loja.embalagem;
  const unidades = itens.reduce((s, i) => s + i.qtd, 0);
  const gramas = itens.reduce((s, i) => s + (i.gramas + emb.pesoGramas) * i.qtd, 0);
  return {
    height: Math.min(100, emb.altura * unidades),
    width: emb.largura,
    length: emb.comprimento,
    weight: Math.max(0.1, gramas / 1000), // kg
  };
}

async function cotar(cepDestino, itens) {
  const token = process.env.SUPERFRETE_TOKEN;
  if (!token) throw new Error("Chave do SuperFrete não configurada no Netlify.");
  const cep = soDigitos(cepDestino);
  if (cep.length !== 8) throw new Error("CEP inválido.");
  const subtotal = itens.reduce((s, i) => s + i.preco * i.qtd, 0);

  const resp = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "User-Agent": "Loja Studio Keite Monik (keitemonikos@gmail.com)",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: { postal_code: catalogo.loja.cepOrigem },
      to: { postal_code: cep },
      services: "1,2,17", // PAC, SEDEX, Mini Envios
      options: { own_hand: false, receipt: false, insurance_value: subtotal, use_insurance_value: false },
      package: montarPacote(itens),
    }),
  });
  const dados = await resp.json().catch(() => null);
  if (!resp.ok || !Array.isArray(dados)) {
    throw new Error((dados && (dados.message || dados.error)) || "Não foi possível calcular o frete agora.");
  }
  return dados
    .filter((o) => !o.has_error && !o.error && Number(o.price) > 0)
    .map((o) => ({
      id: String(o.id),
      nome: o.name,
      preco: Number(o.price),
      prazo: Number(o.delivery_time || (o.delivery_range && o.delivery_range.max) || 0),
    }))
    .sort((a, b) => a.preco - b.preco);
}

module.exports = { cotar, validarItens, soDigitos, catalogo };
