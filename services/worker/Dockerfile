FROM node:20-slim

WORKDIR /app

RUN npm install -g typescript

COPY package*.json ./
RUN npm install --include=dev
RUN echo "Listing node_modules/.bin:" && ls -la node_modules/.bin/
RUN echo "Checking typescript installation:" && find /app/node_modules -name tsc
RUN echo "NPM list:" && npm list typescript

COPY . .
RUN npm run build

CMD ["npm", "start"] 