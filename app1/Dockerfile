FROM node:latest


COPY package*.json ./

WORKDIR app1

RUN npm install -g npm@latest

COPY . .

EXPOSE 3001

CMD [ "node", "app1.js" ]
