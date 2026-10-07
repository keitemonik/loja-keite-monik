// Regra de preço da loja — o MESMO arquivo é usado pela vitrine (navegador) e pelo servidor (pagamento),
// para que o preço mostrado seja sempre o preço cobrado.
// Ordem: campanha no ar (pausa a oferta relâmpago) > oferta relâmpago > preço normal.
(function (raiz) {
  const arred = (x) => Math.round(x * 100) / 100;

  // Campanha que vale agora (maior prioridade; em empate, a que começou por último)
  function campanhaAtiva(campanhas, agora, folgaMin) {
    const folga = (folgaMin || 0) * 60e3;
    const lista = (campanhas || []).filter((c) =>
      c.ativo !== false && Date.parse(c.inicio) <= agora && agora < Date.parse(c.fim) + folga);
    lista.sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0) || Date.parse(b.inicio) - Date.parse(a.inicio));
    return lista[0] || null;
  }

  // Oferta relâmpago: X horas em promoção, Y minutos no preço normal, e repete
  function relampago(ap, agora, folgaMin) {
    if (!ap || !ap.oferta_ativa) return null;
    const P = ap.oferta_horas * 3600e3, N = ap.oferta_minutos * 60e3, T = P + N;
    const c = (((agora - Date.parse(ap.oferta_inicio)) % T) + T) % T;
    const promo = c < P + (folgaMin || 0) * 60e3;
    return { promo, resta: c < P ? P - c : T - c };
  }

  function contexto(ap, campanhas, agora, folgaMin) {
    const campanha = campanhaAtiva(campanhas, agora, folgaMin);
    return { campanha, relampago: campanha ? null : relampago(ap, agora, folgaMin) };
  }

  // v = { id, preco, precoDe, categoria_id, pai_id }  →  { preco, de }  (de = preço riscado ou null)
  function precoInfo(v, ctx) {
    const normal = v.precoDe != null ? v.precoDe : v.preco;
    const c = ctx && ctx.campanha;
    if (c) {
      const especifico = c.precos && c.precos[v.id];
      let p = null;
      if (especifico) p = Number(especifico);
      else if (c.desconto_pct > 0 && (!c.desconto_categoria_id ||
        c.desconto_categoria_id === v.categoria_id || c.desconto_categoria_id === v.pai_id)) {
        p = arred(normal * (1 - c.desconto_pct / 100));
      }
      return p && p < normal ? { preco: p, de: normal } : { preco: normal, de: null };
    }
    const r = ctx && ctx.relampago;
    if (r && v.precoDe != null) return r.promo ? { preco: v.preco, de: v.precoDe } : { preco: v.precoDe, de: null };
    return { preco: normal, de: null };
  }

  const api = { campanhaAtiva, relampago, contexto, precoInfo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Precos = api;
})(typeof window !== "undefined" ? window : globalThis);
