FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
ENV HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/storage/buildboard.sqlite
EXPOSE 3000
CMD ["node","vps-server.mjs"]
