// Recebe os avisos do Mercado Pago e confirma o pagamento no painel.
// Também é chamado pela página de obrigado (?payment_id=...). Sempre confere direto no Mercado Pago.
const { rpc } = require("../lib/banco");

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  let corpo = {};
  try { corpo = JSON.parse(event.body || "{}"); } catch {}
  const tipo = corpo.type || corpo.topic || q.type || q.topic;
  const id = (corpo.data && corpo.data.id) || q["data.id"] || q.payment_id || (tipo === "payment" ? q.id : null);

  if (!id || (tipo && tipo !== "payment" && !q.payment_id)) return resposta(200, { ok: true, ignorado: true });

  try {
    const r = await fetch("https://api.mercadopago.com/v1/payments/" + encodeURIComponent(id), {
      headers: { Authorization: "Bearer " + process.env.MP_ACCESS_TOKEN },
    });
    if (!r.ok) return resposta(200, { ok: false, motivo: "pagamento não encontrado" });
    const pg = await r.json();
    if (!pg.external_reference) return resposta(200, { ok: true, ignorado: true });

    const forma = { pix: "Pix", bank_transfer: "Pix", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", ticket: "Boleto", account_money: "Saldo Mercado Pago" }[pg.payment_type_id] || pg.payment_type_id;
    const resultado = await rpc("loja_confirmar_pagamento", {
      p_segredo: process.env.LOJA_SEGREDO, p_codigo: pg.external_reference, p_payment_id: String(pg.id),
      p_mp_status: pg.status, p_forma: forma, p_valor: pg.transaction_amount,
    });
    return resposta(200, { ok: true, status: pg.status, resultado });
  } catch (e) {
    return resposta(500, { ok: false, erro: e.message }); // 500 faz o Mercado Pago tentar de novo
  }
};

function resposta(status, corpo) {
  return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) };
}
