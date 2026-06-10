FROM node:20-alpine

WORKDIR /app

# Dépendances (ws) — install reproductible.
COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./

ENV PORT=8787
EXPOSE 8787

CMD ["node", "server.mjs"]
