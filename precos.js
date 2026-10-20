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
  // Oferta relâmpago em ciclo.
  // Só a oferta 1: X horas em promoção, Y minutos no preço normal, e repete.
  // Com a oferta 2 ligada, as duas se alternam nos mesmos produtos:
  //   oferta 1 (oferta_horas) → pausa (oferta_minutos) → oferta 2 (oferta2_horas, preço "Oferta 2") → pausa (oferta2_minutos) → repete
  function relampago(ap, agora, folgaMin) {
    if (!ap || !ap.oferta_ativa) return null;
    const A = ap.oferta_horas * 3600e3, pA = ap.oferta_minutos * 60e3;
    const dois = !!ap.oferta2_ativa;
    const B = dois ? ap.oferta2_horas * 3600e3 : 0, pB = dois ? ap.oferta2_minutos * 60e3 : 0;
    const T = A + pA + B + pB;
    if (!(T > 0)) return null;
    const c = (((agora - Date.parse(ap.oferta_inicio)) % T) + T) % T;
    const folga = (folgaMin || 0) * 60e3;
    if (c < A) return { promo: true, fase: 1, resta: A - c, dois };
    if (c < A + folga) return { promo: true, fase: 1, resta: 0, dois };
    if (c < A + pA) return { promo: false, fase: 1, resta: A + pA - c, proxima: dois ? 2 : 1, dois };
    if (c < A + pA + B) return { promo: true, fase: 2, resta: A + pA + B - c, dois };
    if (c < A + pA + B + folga) return { promo: true, fase: 2, resta: 0, dois };
    return { promo: false, fase: 2, resta: T - c, proxima: 1, dois };
  }

  // Desconto progressivo da campanha (leve mais, pague menos)
  // c.progressivo = { categoria_id, faixas: [{ min: 2, precos: { "100": 109.9, "150": 164.9 } }, ...] }
  function noProgressivo(c, v) {
    const pr = c && c.progressivo;
    if (!pr || !Array.isArray(pr.faixas) || !pr.faixas.length) return false;
    return !pr.categoria_id || pr.categoria_id === v.categoria_id || pr.categoria_id === v.pai_id;
  }
  // itens = [{ v: {categoria_id, pai_id}, qtd }]  →  quantas unidades entram na contagem do progressivo
  function qtdProgressivo(ctx, itens) {
    const c = ctx && ctx.campanha; if (!c) return 0;
    return (itens || []).reduce((s, i) => s + (i && i.v && noProgressivo(c, i.v) ? (i.qtd || 0) : 0), 0);
  }
  function precoProgressivo(c, v, qtd) {
    if (!noProgressivo(c, v) || !v.peso_g) return null;
    let melhor = null;
    for (const f of c.progressivo.faixas) {
      const p = f && f.precos && f.precos[String(v.peso_g)];
      if (qtd >= (f.min || 0) && p != null && p !== "" && (melhor == null || Number(p) < melhor)) melhor = Number(p);
    }
    return melhor;
  }

  function contexto(ap, campanhas, agora, folgaMin) {
    const campanha = campanhaAtiva(campanhas, agora, folgaMin);
    return { campanha, relampago: campanha ? null : relampago(ap, agora, folgaMin) };
  }

  // v = { id, preco, precoDe, precoOferta2, categoria_id, pai_id, peso_g, fixo }  →  { preco, de }  (de = preço riscado ou null)
  // fixo = desconto fixo do produto: o preço riscado vale sempre, sem depender da oferta relâmpago
  function precoInfo(v, ctx) {
    const normal = v.precoDe != null ? v.precoDe : v.preco;
    const fixo = v.fixo && v.precoDe != null ? { preco: v.preco, de: v.precoDe } : null;
    const c = ctx && ctx.campanha;
    if (c) {
      // riscado_atual: o "de" da campanha é o preço que a loja pratica no dia a dia (ex.: 149,90), não o preço cheio
      const normal = c.riscado_atual && !v.fixo ? v.preco : (v.precoDe != null ? v.precoDe : v.preco);
      const especifico = c.precos && c.precos[v.id];
      let p = null;
      if (especifico) p = Number(especifico);
      else if (c.desconto_pct > 0 && (!c.desconto_categoria_id ||
        c.desconto_categoria_id === v.categoria_id || c.desconto_categoria_id === v.pai_id)) {
        p = arred(normal * (1 - c.desconto_pct / 100));
      }
      const pp = precoProgressivo(c, v, Math.max(1, (ctx && ctx.qtdProg) || 1));
      if (pp != null && (!p || pp < p)) p = pp;
      if (fixo && (!p || p >= fixo.preco)) return fixo; // campanha só vale se deixar ainda mais barato
      return p && p < normal ? { preco: p, de: normal } : { preco: normal, de: null };
    }
    if (fixo) return fixo;
    const r = ctx && ctx.relampago;
    if (r && v.precoDe != null) {
      if (!r.promo) return { preco: v.precoDe, de: null };
      const p2 = r.fase === 2 && v.precoOferta2 != null && v.precoOferta2 < v.precoDe ? Number(v.precoOferta2) : null;
      return { preco: p2 != null ? p2 : v.preco, de: v.precoDe };
    }
    return { preco: normal, de: null };
  }

  const api = { campanhaAtiva, relampago, contexto, precoInfo, qtdProgressivo, noProgressivo, precoProgressivo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Precos = api;
})(typeof window !== "undefined" ? window : globalThis);
