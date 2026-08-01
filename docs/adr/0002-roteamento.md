# ADR 0002 — Roteamento com URL real

- **Data:** 2026-08-01
- **Status:** Aceito
- **Escopo:** navegação do app (WU-44)

## Contexto

A navegação era `useState<'home' | 'login' | 'tracking' | 'profile' | 'admin'>`.
Consequências concretas, não teóricas:

- **Nenhuma tela é compartilhável por link.** Para marketplace de bairro, mandar
  uma oferta por WhatsApp é o canal de aquisição — sem URL de produto, ele não
  existe.
- O botão voltar do navegador sai do app em vez de voltar uma tela.
- Nenhum teste E2E consegue entrar direto numa tela; todo cenário precisa
  navegar por cliques desde o início.
- Estado de navegação não sobrevive a reload.

## Candidatos avaliados

Medições de 2026-08-01. Bundle atual do app: **82 kB gzip**.

| Candidato | Versão | Licença | Tamanho (gzip) | Repo | Último commit |
|---|---|---|---|---|---|
| [react-router](https://www.npmjs.com/package/react-router) | 8.3.0 | MIT | **57,9 kB** | saudável | 2026-07-28 |
| [wouter](https://github.com/molefrog/wouter) | 3.10.0 | Unlicense | **2,5 kB** | 7,8k ★, 30 issues abertas, não arquivado | 2026-07-27 |
| [@tanstack/react-router](https://www.npmjs.com/package/@tanstack/react-router) | 1.170.18 | MIT | ~1,1 MB desempacotado | saudável | 2026-07-24 |
| Do zero (History API) | — | — | ~0 | — | — |

## Decisão

**Adotar `wouter` como dependência.**

### Por que depender e não reimplementar

A regra-mãe do contrato é *reimplementar lógica, depender de primitiva*.
Roteamento fica do lado da primitiva: `popstate`, restauração de scroll,
navegação por gesto no iOS, `pushState` com base path, casamento de padrão com
parâmetros — cada um tem casos de borda que só aparecem em produção. Escrever
isso do zero é assumir manutenção de um problema já resolvido, sem ganhar
diferencial nenhum para o produto.

### Por que wouter e não react-router

**Tamanho.** 57,9 kB gzip do react-router representa **70% do bundle atual
inteiro**. O wouter custa 2,5 kB — 3%. Para um app cujo público abre a vitrine
em rede móvel de bairro, isso é diferença de conversão, não de vaidade técnica.

O react-router entrega muito além do necessário aqui: loaders, actions, data
router, renderização no servidor. Nada disso está no escopo do MVP, e nada disso
some do bundle por não ser usado.

### Por que não TanStack Router

Roteamento por arquivo com geração de código e árvore de rotas tipada. Excelente
em app grande; aqui adiciona etapa de build e um acoplamento com a ferramenta
que contraria a regra de portabilidade, para 13 rotas.

### Sobre a licença Unlicense

Unlicense é dedicação a domínio público, aprovada pela OSI e permissiva — uso
comercial livre, sem atribuição.

**Ressalva registrada:** alguns países não reconhecem dedicação a domínio público
por pessoa física, e a Unlicense não traz licença permissiva de fallback (ao
contrário da CC0). Na prática o risco é baixo — a biblioteca é amplamente usada e
a cláusula de renúncia cobre o caso — mas se um cliente tiver política jurídica
que exija MIT/Apache explicitamente, a saída é trocar por react-router. **O custo
dessa troca é baixo por decisão de projeto:** o acoplamento fica isolado em
`src/router/`, e nenhuma tela importa `wouter` diretamente.

### Sem lock-in

Por baixo é a History API do navegador. O app roda igual em qualquer host
estático, VPS ou Coolify. Nenhum recurso de plataforma envolvido.

## Rotas

```
/                        vitrine
/busca?q=                busca (o termo vive na URL)
/categoria/:slug         categoria
/produto/:id             detalhe do produto
/loja/:slug              loja
/pedido/:id              rastreio
/perfil                  conta
/entrar                  login
/admin/:aba?             painel operacional (guarda por papel)
```

## Validação

A referência informa; o teste prova. Cobertura exigida:

- entrar direto em `/produto/3` renderiza o produto certo
- id inexistente → estado "não encontrado" com saída, não crash
- voltar do navegador retorna à tela anterior
- `/admin` sem papel de operação não renderiza o painel
- a busca reflete na URL e a URL restaura a busca
- E2E entra por `page.goto()` direto em cada rota, sem cliques até a tela
