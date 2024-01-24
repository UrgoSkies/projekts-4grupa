
FROM ubuntu:18.04


RUN apt-get update && apt-get install -y curl


RUN curl -sL https://deb.nodesource.com/setup_17.x | bash -
RUN apt-get install -y nodejs


RUN apt-get install -y nodejs



WORKDIR /app2


COPY package*.json ./


RUN npm install


COPY . .


EXPOSE 3002

CMD [ "node", "app2.js" ]
