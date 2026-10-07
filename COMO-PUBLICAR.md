# Loja Studio Keite Monik: como colocar no ar

## O que tem nesta pasta
- `index.html`: a loja (vitrine, sacola, frete e entrega)
- `obrigado.html`: página que a cliente vê depois de pagar
- `produtos.json`: **lista de produtos, preços e fotos** (é aqui que você muda preço ou adiciona produto)
- `img/`: fotos dos produtos
- `netlify/`: as "funções" que calculam o frete no SuperFrete e criam o pagamento no Mercado Pago

---

## 1. Subir no GitHub
1. Crie uma conta grátis em github.com.
2. Clique em **New repository**, dê o nome `loja-keite-monik` e crie.
3. Clique em **uploading an existing file** e arraste **todo o conteúdo** desta pasta (não a pasta em si).
4. Clique em **Commit changes**.

## 2. Ligar ao Netlify
1. Crie uma conta grátis em netlify.com (pode entrar com o GitHub).
2. **Add new site → Import an existing project → GitHub** e escolha `loja-keite-monik`.
3. Não precisa mudar nada, só clique em **Deploy**.

## 3. Pegar as chaves
**Mercado Pago**
1. Acesse mercadopago.com.br/developers e entre na sua conta.
2. **Suas integrações → Criar aplicação** (tipo: pagamentos on-line / Checkout Pro).
3. Em **Credenciais de produção**, copie o **Access Token** (começa com `APP_USR-`).

**SuperFrete**
1. Entre em superfrete.com.
2. Vá em **Integrações → Desenvolvedores / API** e gere um **token**.

## 4. Colar as chaves no Netlify
No seu site no Netlify: **Site configuration → Environment variables → Add a variable**

| Nome (exatamente assim) | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | o Access Token do Mercado Pago |
| `SUPERFRETE_TOKEN` | o token do SuperFrete |

Depois vá em **Deploys → Trigger deploy → Deploy site** para a loja passar a usar as chaves.

## 5. Testar
1. Abra o endereço do site (algo como `nome-aleatorio.netlify.app`).
2. Coloque um produto na sacola, calcule o frete com um CEP qualquer e siga até o pagamento.
3. Para testar sem cobrar de verdade, use primeiro as **credenciais de teste** do Mercado Pago e troque pelas de produção depois.

---

## Mudar produtos e preços
Abra `produtos.json` no GitHub, clique no lápis (editar), altere e salve. O Netlify atualiza a loja sozinho em ~1 minuto.

- `preco`: preço de venda
- `precoDe`: preço riscado (use `null` para não mostrar)
- `gramas`: peso do cabelo (a loja soma 50 g de embalagem para o frete)
- `fotos`: caminho das fotos na pasta `img/`

Para pôr foto nas Micromechas: suba as fotos na pasta `img/` (ex.: `micromecha-50g.jpg`) e preencha `"fotos": ["img/micromecha-50g.jpg"]`.

## Onde ver os pedidos
Cada venda aparece no **Mercado Pago → Atividade**, com o número do pedido (começa com `KM`), os produtos, o frete escolhido e o endereço de entrega. A cliente também recebe um botão para te avisar pelo WhatsApp com o resumo do pedido.

A etiqueta de envio você gera no SuperFrete com os dados da cliente.

---

## Painel da loja (/admin)
Endereço: `seu-site/admin` (ex.: https://lojakeitemonik.netlify.app/admin). Entre com o e-mail e a senha do CRM.

- **Pedidos:** todos os pedidos da loja, com status (aguardando pagamento → pago → separando → enviado → entregue), endereço para copiar, WhatsApp da cliente e campo de rastreio. Quando o Mercado Pago aprova, o pedido muda sozinho para "Pago" e a venda entra no CRM.
- **Produtos** (só administradora): cadastrar, editar preço, fotos, estoque e esconder produtos. As mudanças aparecem na loja na hora, sem mexer no GitHub.

Variável obrigatória no Netlify para o painel receber os pedidos: `LOJA_SEGREDO` (valor enviado na conversa).

## Aparência e Campanhas (painel)
- **Aparência:** logo, cores, faixa do topo, oferta relâmpago (ligar/desligar e duração) e banners do dia a dia.
- **Campanhas:** ofertas com data de início e fim que ligam e desligam sozinhas: desconto geral (loja toda ou por categoria), preços específicos por opção, cores, logo, faixa, contador e banners próprios. Durante uma campanha a oferta relâmpago pausa.
