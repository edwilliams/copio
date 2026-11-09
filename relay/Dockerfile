FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

EXPOSE 9000

ENV NODE_ENV=production
ENV PORT=9000

CMD ["node", "server.js"]
