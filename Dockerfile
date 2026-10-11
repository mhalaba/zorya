FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Build, then drop the build toolchain (TypeScript, Vite…): the server needs only runtime dependencies.
RUN npm run build && npm prune --omit=dev && npm cache clean --force
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV VAPID_SUBJECT=mailto:admin@sietch.lan
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Run as the image's unprivileged "node" user (uid/gid 1000); the bind-mounted ./data must be owned by 1000:1000
# (on the host: chown -R 1000:1000 data).
USER node
CMD ["node", "server/index.mjs"]
