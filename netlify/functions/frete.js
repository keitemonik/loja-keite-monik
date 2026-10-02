const { cotar, validarItens } = require("../lib/frete");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  try {
    const { cep, itens } = JSON.parse(event.body || "{}");
    const opcoes = await cotar(cep, validarItens(itens));
    if (!opcoes.length) throw new Error("Nenhuma opção de entrega para esse CEP.");
    return json(200, { opcoes });
  } catch (e) {
    return json(400, { erro: e.message });
  }
};

function json(status, corpo) {
  return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) };
}
