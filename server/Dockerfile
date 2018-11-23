FROM node:8
WORKDIR /app
RUN npm i -g yarn forever
COPY . /app
RUN yarn install
CMD npm start
EXPOSE 8000
