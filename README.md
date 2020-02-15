# FSBC
![](https://travis-ci.org/thailekha/fsbc.svg?branch=master)

# Bugs
- Newly registered users get populated with all published data at once -> solution is to use the lastChangedAt of published data in populatePublishedDataToNewUser

# Notes
- Do not disconnect connections to hyperledger/mongodb. Leave them on.

# Setup
```
export ATLAS_CREDS=mongodb://127.0.0.1:27017/test
export DATAENCRYPT_SECRET=notproduction
```

# Mongodb container
```
sudo docker run --rm -p 127.0.0.1:27017:27017 mongo

show collections
db.dataassets.find
```

# Windows guide
## Build composer box:
```
vagrant destroy -f composer-empty
vagrant up composer-empty
vagrant ssh composer-empty
    cd /mnt/vagrant && make install-composer-prereq
    <ctrl+d for logout>
vagrant ssh composer-empty
    cd /mnt/vagrant && make install-composer-core && make test-business-network
    <ctrl+d for logout>
rm fsbc-composer.box || echo Box does not exist
vagrant package composer-empty --output fsbc-composer.box
vagrant box remove fsbc/composer || echo Box not previously added
vagrant box add fsbc/composer fsbc-composer.box
vagrant destroy -f composer-empty
```
## Create Dev VM
```
vagrant destroy -f dev-machine
vagrant up dev-machine
vagrant ssh dev-machine
    cd /mnt/vagrant && make singlenode
```

# Remote load test - both backend and DB
- Make sure to use the load DB
- Manually delete all collections
```
# cd to /mnt/vagrant/server

# terminal 1
heroku labs:enable log-runtime-metrics
heroku logs --app cd-load-usask --tail
heroku ps:restart

# terminal 2
htop

# terminal 3
export NODE_PATH=~/fsbc/node_modules
export ATLAS_CREDS=... && \
    export LOAD_URL=https://cd-load-usask.herokuapp.com && \
    node ./tests/load/stackServer.js

# terminal 4
# replace URL first
export LOAD_URL=https://cd-load-usask.herokuapp.com && k6 run ./tests/load/load.test.js
```

# Remote load test - just DB
- Make sure to use the load DB
- Manually delete all collections
```
# cd to /mnt/vagrant/server

# terminal 1
export NODE_PATH=~/fsbc/node_modules
export ATLAS_CREDS=... && npm run dev

# terminal 2
export NODE_PATH=~/fsbc/node_modules
export ATLAS_CREDS=... && \
    export LOAD_URL=http://localhost:9000 && \
    node ./tests/load/stackServer.js

# terminal 3
# replace URL first
export LOAD_URL=http://localhost:9000 && k6 run ./tests/load/load.test.js
```

# Local load test
```
# cd to /mnt/vagrant/server

# terminal 1
export NODE_PATH=~/fsbc/node_modules
export ATLAS_CREDS=mongodb://127.0.0.1:27017/test && npm run dev

# terminal 2
export NODE_PATH=~/fsbc/node_modules
export ATLAS_CREDS=mongodb://127.0.0.1:27017/test && \
    export LOAD_URL=http://localhost:9000 && \
    node ./tests/load/stackServer.js

# terminal 3
export LOAD_URL=http://localhost:9000 && k6 run ./tests/load/load.test.js
```

# Deploy
- Clone this repo
- Create a .env file and add the following values:
```
ATLAS_CREDS=
DATAENCRYPT_SECRET=
```
- Run the following commands:
```
make deploy
vagrant ssh dev-machine
    ipfs daemon
vagrant ssh dev-machine
    cd /mnt/vagrant/server && npm run production && npm run backup-worker
    cd ~/fsbc/log && tail -f *
vagrant ssh dev-machine
    ~/fsbc/ngrok authtoken <insert ngrok token here>
    cd /mnt/vagrant/ && make run-ngrok
```