# Base Debian slim, nao alpine: `sharp` e o Prisma engine trazem binarios
# pre-compilados para glibc; em musl o caminho e recompilar (lento) ou falhar
# so no primeiro upload de foto.
FROM node:22-slim AS build
WORKDIR /app

# NODE_ENV fica indefinido aqui de proposito: com `production` o `npm ci`
# pularia devDependencies e nao haveria vite/prisma/tsc para buildar.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Ordem importa: o client do Prisma e gerado dentro de node_modules/@prisma/client
# (dependencia de producao), entao sobrevive ao prune que vem depois.
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev


FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Falha de imagem tem que aparecer no build, nao no primeiro upload de foto:
# o prune de devDependencies poderia ter levado o client gerado do Prisma
# junto, o binario pre-compilado do sharp pode nao casar com a base, e o tsx
# precisa ter sobrevivido ao estagio anterior.
RUN node -e "require('@prisma/client')" \
 && node -e "require('sharp')" \
 && node_modules/.bin/tsx --version

USER node
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `tsx` roda o servidor em TypeScript direto — por isso ele esta em
# dependencies, nao devDependencies. Migrations NAO rodam aqui: sao passo
# humano deliberado (ver docs/runbook.md).
CMD ["node_modules/.bin/tsx", "src/server/index.ts"]
