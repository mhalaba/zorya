FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV VAPID_SUBJECT=mailto:admin@sietch.lan
EXPOSE 8787
CMD ["node", "server/index.mjs"]
