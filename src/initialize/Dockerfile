FROM node:current-alpine
ENV GIT_TERMINAL_PROMPT 0
RUN apk update && apk upgrade && \
    apk add --no-cache git
COPY ./package.json /app/package.json
COPY ./package-lock.json /app/package-lock.json
WORKDIR /app
RUN npm ci
COPY ./ /app
RUN npm run build && \
    rm -rf src
CMD node out/main.js
