FROM debian:buster

RUN apt update; apt install -y automake libtool build-essential openssl libssl-dev

RUN mkdir /app
COPY . /app
WORKDIR /app

RUN autoconf
RUN libtoolize --force
RUN autoreconf -i
RUN automake
RUN ./configure
RUN make
RUN make install
