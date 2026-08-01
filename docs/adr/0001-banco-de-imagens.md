# ADR 0001 — Banco de imagens para dados de demonstração

- **Data:** 2026-08-01
- **Status:** Aceito — **revisado em 2026-08-01, ver "Revisão" ao final**
- **Escopo:** imagens de produto, loja e cliente no ambiente de demonstração

## Contexto

O catálogo usava SVG inline gerado localmente (iniciais sobre fundo colorido).
Funciona offline e não depende de rede, mas não parece um marketplace real — o
que atrapalha a validação comercial da vitrine.

Requisitos para a substituição:

1. Sem chave de API — a demo precisa subir em qualquer lugar sem segredo.
2. URL determinística — a mesma entidade deve receber sempre a mesma imagem,
   senão cada render embaralha o catálogo.
3. Licença compatível com uso comercial, preferencialmente sem atribuição
   obrigatória.
4. Degradação graciosa: serviço fora do ar não pode quebrar a interface.
5. Sem lock-in — trocar a fonte deve ser mudar uma função.

## Candidatos avaliados

| Candidato | Chave | Determinístico | Licença | Temático |
|---|---|---|---|---|
| [Lorem Picsum](https://picsum.photos/) | não | sim (`/seed/{slug}`) | acervo Unsplash — uso comercial livre, sem atribuição | não |
| [LoremFlickr](https://loremflickr.com/) | não | sim (`?lock=`) | **Creative Commons variável por imagem** | sim (por palavra-chave) |
| [DiceBear](https://www.dicebear.com/) | não | sim (`?seed=`) | MIT (lib); estilo `avataaars` livre para uso comercial sem atribuição | avatares |
| Unsplash API oficial | **sim** | sim | Unsplash License | sim |

## Decisão

**Produtos e lojas → Lorem Picsum**, via `productImage(seed)` e `storeImage(seed)`.
**Clientes → DiceBear, estilo `avataaars`**, via `avatarImage(seed)`.

Modo de reuso: **adotar como serviço externo apenas em dado de demonstração**.
Nenhuma dependência npm nova foi instalada — são URLs. O acoplamento fica
isolado em `src/lib/images.js`; trocar de provedor é reescrever três funções.

### Por que não LoremFlickr, apesar de ser o único temático

É o candidato com melhor aderência visual: `loremflickr.com/400/400/fan` devolve
de fato um ventilador. Foi **rejeitado por licença**. As imagens vêm do Flickr
sob licenças Creative Commons que variam por foto — parte é CC BY ou CC BY-SA,
que exigem atribuição ao autor e, no caso do SA, propagam a licença. Não há como
garantir conformidade sem auditar imagem a imagem, e a licença de uma URL pode
mudar quando o serviço rotaciona a foto. Risco jurídico maior que o ganho de
relevância visual.

### Por que não a API oficial do Unsplash

Exige chave de API. Isso significa segredo em build, cadastro de conta e um
ponto de falha na entrega ao cliente — contra o requisito 1 e contra a regra de
portabilidade do projeto.

### Consequência aceita conscientemente

Picsum devolve fotografia genérica: o card "Ventilador de Mesa" pode exibir uma
paisagem. Isso é assumido. A alternativa temática custa conformidade de licença,
e um catálogo de demonstração com foto bonita porém genérica comunica melhor que
um placeholder de iniciais. **Quando entrar catálogo real (WU-23), estas funções
saem e as URLs passam a vir do storage S3-compatível.**

### Por que avatar ilustrado e não foto para clientes

Associar a foto de uma pessoa real a um nome fictício, histórico de pedidos e
endereço é problema de privacidade e de percepção, mesmo em demo. DiceBear gera
personagem ilustrado — o dado falso fica visivelmente falso.

## Mitigação do risco de dependência externa

Isto reintroduz o defeito **B6** (dependência de serviço externo em runtime), que
havia sido corrigido ao migrar para SVG local. Mitigações:

- `localImage()` continua no código como fallback em data URI.
- Todo `<img>` usa `onError={fallbackTo(...)}`, com guard contra laço infinito.
- Offline ou serviço fora do ar → a UI cai para o placeholder local, não quebra.
- jsdom não carrega imagens, então a suíte de testes não depende de rede.

**O que a mitigação não cobre:** rede lenta degrada a percepção de performance,
e Picsum/DiceBear não oferecem SLA. Aceitável para demonstração, **não** para
produção.

## Validação

A referência informa; o teste prova. Cobertura exigida em `src/lib/images.test.js`:

- `toSeed` normaliza acento e caixa, e é estável para a mesma entrada
- `productImage`/`storeImage`/`avatarImage` produzem URL determinística
- `localImage` devolve data URI válido
- `fallbackTo` troca `src` uma única vez e não entra em laço

---

## Revisão — 2026-08-01

**A decisão original foi revertida por escolha explícita do responsável pelo
projeto.** A fonte de produtos e lojas passou de Lorem Picsum para **LoremFlickr**.

### O que motivou

Picsum entregou o que prometia — foto real, rápida, licença limpa — mas o
resultado visual reprovou: o card "Ventilador de Mesa Premium" exibia uma
paisagem com pôr do sol. Numa vitrine de marketplace isso não lê como
"placeholder", lê como erro. Foto genérica ao lado de um nome de produto
específico prejudica a credibilidade da demonstração mais do que ajuda.

### Comparação apresentada na decisão

| Opção | Temático | Licença | Latência medida |
|---|---|---|---|
| Curar fotos do Unsplash | sim | comercial livre, sem atribuição | 0,42s |
| Manter Picsum | **não** | comercial livre, sem atribuição | 0,86s |
| Voltar ao SVG local | n/a | n/a | 0ms |
| **LoremFlickr (escolhida)** | **sim** | **CC variável — risco** | **3,30s** |

### Risco aceito conscientemente

O risco de licença descrito acima **não foi eliminado, foi aceito**. Registro
explícito do que isso significa:

- As fotos vêm do Flickr sob Creative Commons que varia por imagem. Parte é
  CC BY (exige atribuição ao autor) e parte é CC BY-SA (propaga a licença a
  trabalhos derivados).
- Não há como auditar imagem a imagem: o serviço pode rotacionar a foto por
  trás da mesma URL, então uma conferência hoje não garante conformidade amanhã.
- Mitigação parcial do próprio serviço: LoremFlickr grava a licença no canto
  superior esquerdo e o autor no canto inferior esquerdo da própria imagem, o
  que satisfaz atribuição enquanto a imagem for exibida como veio.
- A latência de 3,3s é ~4x a do Picsum. Mitigado com `loading="eager"` +
  `fetchPriority="high"` nas imagens acima da dobra e `lazy` nas demais.

### Condição de saída — obrigatória

**Esta fonte é válida apenas para demonstração.** Antes de qualquer uso em
produção, ou de entregar a build a um cliente final como produto, a fonte
precisa ser trocada. O acoplamento está isolado em `src/lib/images.js`: trocar
significa reescrever `productImage` e `storeImage`. Nenhum componente conhece o
provedor — há teste garantindo isso (`isolamento do provedor`).

Na WU-23 as URLs passam a vir do storage S3-compatível com imagens do próprio
lojista, e este risco deixa de existir.

### Não alterado

Avatares de cliente seguem no DiceBear. Associar foto de pessoa real a nome
fictício, endereço e histórico de pedidos é problema de privacidade e de
percepção independentemente da fonte.

---

## Revisão — 2026-08-01 (segunda revisão)

**A decisão foi revertida novamente: voltar de LoremFlickr para Picsum Photos.**

### O que motivou

A latência de 3,3s do LoremFlickr e o risco jurídico de licenças variáveis por
imagem (CC BY, CC BY-SA sem auditoria possível) foram considerados elevados
demais, mesmo para demonstração. A experiência comercial sofreu — a imagem
temática não compensava a instabilidade e o risco.

### A decisão

**Produtos e lojas → Picsum Photos**, via `productImage(seed)` e `storeImage(seed)`.

### Motivo

- Licença limpa: Unsplash — uso comercial livre, sem atribuição obrigatória.
- Determinístico: `/seed/<slug>/<w>/<h>` garante a mesma entidade recebe sempre
  a mesma imagem.
- Foto genérica é aceitável em demonstração — comunica "placeholder" melhor que
  foto temática ao lado de nome específico.
- Risco jurídico eliminado: não há variação de licença por imagem.
- Latência: ~0,86s (melhor que LoremFlickr, ligeiramente pior que SVG local).
- Mitigação de risco de dependência externa continua idêntica: fallback local
  em data URI, guard contra laço infinito, jsdom não carrega imagens.

### O que mudou no código

- Removida função `lockFor` (específica de LoremFlickr).
- Simplificada função `photo`: agora usa `/seed/<slug>/<w>/<h>` ao invés de
  busca temática.
- Keywords na interface pública (`productImage`, `storeImage`) mantidas por
  compatibilidade, mas não afetam a URL — Picsum não faz busca temática.

### Condição de saída — obrigatória

Idem à revisão anterior: **válida apenas para demonstração.** Na WU-23, as URLs
passam a vir do storage S3-compatível com imagens do próprio lojista.

### Não alterado

Avatares de cliente seguem no DiceBear.
