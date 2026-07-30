# Primeiro Aqui MVP

Marketplace React + Vite com foco em uma experiência local rápida e conversão de vendas.

## O que tem aqui

- SPA leve em React 19 com navegação interna baseada em estado
- UI responsiva com Tailwind CSS
- Tela inicial de vitrine aberta para o usuário explorar antes de logar
- Mock de produtos e fluxo de carrinho / finalização de compra
- Asset de logo local (`public/logo.png`)

## Comandos úteis

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

## Como rodar localmente

1. Instale dependências:

```bash
npm install
```

2. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

3. Abra `http://localhost:5173`

## Deploy

### GitHub + Vercel

1. Garanta que o código está no GitHub.
2. Conecte o repositório no Vercel.
3. Use `npm run build` como comando de build.
4. A pasta de saída padrão do Vite é `dist`.

### GitHub Actions

O projeto já tem workflow de build que roda o `npm install` e `npm run build` em cada push para `main`.

## Estrutura básica

- `src/App.jsx` - aplicação principal e navegação entre telas
- `src/index.css` - estilos globais e Tailwind
- `public/` - arquivos estáticos, incluindo `logo.png`
- `tailwind.config.js` - configuração do Tailwind
- `vite.config.js` - configuração do Vite

## Observações

- A vitrine deve ser a página inicial para reduzir atrito de conversão.
- O build foi validado com sucesso após as últimas alterações.
