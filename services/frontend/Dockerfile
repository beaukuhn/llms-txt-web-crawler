FROM node:20

WORKDIR /app

COPY package.json ./

RUN npm install --legacy-peer-deps

COPY . .

ENV NEXT_PUBLIC_API_URL=http://api:3000
ENV NODE_ENV=production

RUN node node_modules/next/dist/bin/next build

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]