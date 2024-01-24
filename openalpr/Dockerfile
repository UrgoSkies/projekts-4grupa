# ubuntu 
FROM ubuntu:18.04

# download all for openalpr
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    build-essential \
    cmake \
    curl \
    git \
    libcurl3-dev \
    libleptonica-dev \
    liblog4cplus-dev \
    libopencv-dev \
    libtesseract-dev \
    wget

# copy alpr code
COPY . /srv/openalpr

# alpr build
RUN mkdir /srv/openalpr/src/build && \
    cd /srv/openalpr/src/build && \
    cmake -DCMAKE_INSTALL_PREFIX:PATH=/usr -DCMAKE_INSTALL_SYSCONFDIR:PATH=/etc .. && \
    make -j2 && \
    make install

#  Node.js download
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs


WORKDIR /data

COPY package*.json ./

# npm install all from package.json

RUN npm install 


# copy all files 
COPY . .

# port
EXPOSE 3003

# start this nodejs
CMD ["node", "app3.js"]
