// Cria o pagamento no Mercado Pago (Checkout Pro: Pix, cartão e boleto)
const { cotar, validarItens, soDigitos } = require("../lib/frete");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("Chave do Mercado Pago não configurada no Netlify.");

    const { itens, cliente, freteId } = JSON.parse(event.body || "{}");
    const lista = validarItens(itens);
    const c = cliente || {};
    for (const campo of ["nome", "email", "telefone", "cep", "rua", "numero", "bairro", "cidade", "uf"]) {
      if (!String(c[campo] || "").trim()) throw new Error("Preencha todos os dados de entrega.");
    }

    // Recalcula o frete no servidor para garantir o valor correto
    const opcoes = await cotar(c.cep, lista);
    const frete = opcoes.find((o) => o.id === String(freteId));
    if (!frete) throw new Error("Escolha uma opção de frete válida.");

    const site = process.env.URL || "https://" + event.headers.host;
    const pedido = "KM" + Date.now().toString(36).toUpperCase();
    const fone = soDigitos(c.telefone);

    const itensMP = lista.map((i) => ({
      id: i.id,
      title: i.nome,
      quantity: i.qtd,
      unit_price: i.preco,
      currency_id: "BRL",
      picture_url: i.fotos[0] ? site + "/" + i.fotos[0] : undefined,
    }));
    itensMP.push({ id: "frete", title: "Frete – " + frete.nome, quantity: 1, unit_price: frete.preco, currency_id: "BRL" });

    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "X-Idempotency-Key": pedido },
      body: JSON.stringify({
        items: itensMP,
        payer: {
          name: c.nome,
          email: c.email,
          phone: { area_code: fone.slice(0, 2), number: fone.slice(2) },
          address: { zip_code: soDigitos(c.cep), street_name: c.rua, street_number: String(c.numero) },
        },
        external_reference: pedido,
        statement_descriptor: "KEITEMONIK",
        back_urls: {
          success: site + "/obrigado.html?status=aprovado&pedido=" + pedido,
          pending: site + "/obrigado.html?status=pendente&pedido=" + pedido,
          failure: site + "/obrigado.html?status=recusado&pedido=" + pedido,
        },
        auto_return: "approved",
        metadata: {
          pedido,
          frete: frete.nome + " (" + frete.prazo + " dias úteis)",
          endereco: `${c.rua}, ${c.numero}${c.complemento ? " – " + c.complemento : ""} – ${c.bairro}, ${c.cidade}/${c.uf} – CEP ${c.cep}`,
          telefone: c.telefone,
        },
      }),
    });
    const dados = await resp.json();
    if (!resp.ok || !dados.init_point) throw new Error("Mercado Pago recusou o pedido: " + (dados.message || resp.status));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: dados.init_point, pedido, frete }),
    };
  } catch (e) {
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ erro: e.message }) };
  }
};
