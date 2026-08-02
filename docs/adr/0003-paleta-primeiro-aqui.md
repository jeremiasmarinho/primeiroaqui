# ADR 0003 — Paleta oficial "Primeiro Aqui"

Status: aceito
Data: 2026-08-02

## Contexto

A identidade visual foi fechada com uma paleta ancorada nas cores do Mercado
Livre. Antes disso o app usava um amarelo próprio (`#FFD91F`) como cor de marca
e cinza-quase-preto (`#101418`) como cor de ação — botões primários, abas ativas
e ícones selecionados eram todos escuros, sem cor de ação distinta.

## Decisão

1. `src/design-tokens.json` é a fonte da verdade. `tailwind.config.js` lê o
   arquivo via `createRequire` — os hexadecimais existem em um lugar só.
2. Azul `#3483FA` (`primary`) passa a ser a cor de ação: fundo de botão
   primário, ícone/rótulo de item selecionado, borda de card, chip, aba e radio
   selecionados, borda de campo em foco, barra de progresso e gráfico.
3. Amarelo `#FFE600` (`brand`) fica restrito a cabeçalho, marca e destaques de
   oferta. Nunca é fundo de botão primário.
4. Texto sobre amarelo é `navy` `#0B1F5C`.
5. Foco visível: contorno sólido de 2px na primária **mais** anel de 3px
   `rgba(52,131,250,.35)` (`shadow-focus`). Só o anel translúcido teria contraste
   ~1.5:1 contra branco e falharia o WCAG 1.4.11.

## Valores derivados

Não constam nos tokens oficiais, mas são necessários para estados. Estão
isolados em `derived` no `tailwind.config.js`:

| Nome | Valor | Uso |
| --- | --- | --- |
| `brand.deep` | `#E6CF00` | hover do amarelo (cabeçalho) |
| `brand.soft` | `#FFF27A` | gradiente do banner |
| `ink.faint` | `#64748B` | texto terciário (4,76:1 — o antigo `#8A939C` dava 3,1:1) |
| `surface.sunken` | `#F1F5F9` | fundo afundado |
| `promo` | `#E63946` | ênfase promocional; **não** é `error` |

## Consequências

- Contraste de branco sobre `#3483FA` é **3,64:1**. Passa o mínimo de 3:1 para
  componentes de interface (1.4.11), mas fica abaixo de 4,5:1 exigido para texto
  normal (1.4.3). O requisito de negócio fixa `#3483FA` com rótulo branco, então
  a exceção é consciente e documentada aqui. `primaryHover` (`#2968C8`, 5,37:1)
  resolveria se a decisão mudar.
- Texto em azul sobre fundo claro usa `primary-active` (`#1F58A8`, 6,95:1), não
  a primária pura. Fundo e borda continuam `#3483FA`.
- Branco sobre `success` (`#00A650`) dá 3,2:1 — aceitável para o ícone de etapa
  concluída, insuficiente para rótulo pequeno.
