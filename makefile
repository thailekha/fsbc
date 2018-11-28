install-ipfs:
	wget -q -P /tmp/ https://dist.ipfs.io/go-ipfs/v0.4.17/go-ipfs_v0.4.17_linux-amd64.tar.gz
	tar xvfz /tmp/go-ipfs_v0.4.17_linux-amd64.tar.gz -C /tmp
	rm /tmp/go-ipfs_v0.4.17_linux-amd64.tar.gz
	cd /tmp/go-ipfs && sudo ./install.sh
	rm -rf /tmp/go-ipfs
config-ipfs:
	ipfs init
	ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
	ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/4040
start-composer:
	export FABRIC_VERSION=hlfv12
	cd ~/fabric-dev-servers && ./startFabric.sh
	cd ~/fabric-dev-servers && ./createPeerAdminCard.sh
init-business-network:
	$(eval VERSION=$(shell cat ./bc/package.json | jq --raw-output '.version'))
	echo $(VERSION)
	composer archive create --sourceType dir --sourceName ./bc -a dfs@$(VERSION).bna
	composer network install --card PeerAdmin@hlfv1 --archiveFile dfs@$(VERSION).bna
	composer network start --networkName dfs --networkVersion $(VERSION) --networkAdmin admin --networkAdminEnrollSecret adminpw --card PeerAdmin@hlfv1 --file networkadmin.card
	composer card import --file networkadmin.card
	# must ping to activate admin
	composer network ping --card admin@dfs
	# copy admin card to server
	rm -rf ./server/config
	mkdir -p ./server/config/cards
	mkdir -p ./server/config/client-data
	cp -rf ~/.composer/cards/admin@dfs ./server/config/cards/.
	cp -rf ~/.composer/client-data/admin@dfs ./server/config/client-data/.
	# clean up
	rm dfs@*
	rm *.card
sleep-3:
	sleep 3
fresh-vm: start-composer sleep-3 init-business-network install-ipfs config-ipfs
	ipfs daemon &
	cd server && npm run dev
update-business-network:
	$(eval VERSION=$(shell cd bc && npm version patch > /dev/null && cat package.json | jq --raw-output '.version'))
	echo $(VERSION)
	composer archive create --sourceType dir --sourceName ./bc -a dfs@$(VERSION).bna
	composer network install --card PeerAdmin@hlfv1 --archiveFile dfs@$(VERSION).bna
	composer network upgrade -c PeerAdmin@hlfv1 -n dfs -V $(VERSION)
	composer network ping -c admin@dfs
	rm dfs@*
install-yarn:
	curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
	echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
	sudo apt-get update && sudo apt-get install --no-install-recommends yarn
# ============
# TESTS
# ============
test-register:
	curl -v --request POST \
		--url http://$(server):9000/data/register \
		--header 'Content-Type: application/json' \
		--header 'cache-control: no-cache' \
		--data '{"username": "tom","password": "123","role":"EXPORTER"}'
login:
	$(eval TOKEN=$(shell \
		curl --silent --request POST \
			--url http://$(server):9000/data/login \
			--header 'Content-Type: application/json' \
			--header 'cache-control: no-cache' \
			--data '{"username": "tom","password": "123","role":"EXPORTER"}' | jq  --raw-output '.token'))
post:
	$(eval GUID=$(shell \
		curl --silent --request POST \
			--url http://$(server):9000/data \
			--header 'Authorization: Bearer $(TOKEN)' \
			--header 'Content-Type: application/json' \
			--header 'cache-control: no-cache' \
			--data '{"coffee":"latte","timestamp": "$(shell date +%s)"}' | jq  --raw-output '.globalUniqueID'))
get:
	$(eval RESPONSE=$(shell \
		curl --silent --request GET \
			--url http://$(server):9000/data/$(GUID) \
			--header 'Authorization: Bearer $(TOKEN)' \
			--header 'cache-control: no-cache'))
put:
	$(eval NEW_GUID=$(shell \
		curl --silent --request PUT \
			--url http://$(server):9000/data/$(GUID) \
			--header 'Authorization: Bearer $(TOKEN)' \
			--header 'Content-Type: application/json' \
			--header 'cache-control: no-cache' \
			--data '{"coffee":"mocha","timestamp": "$(shell date +%s)"}' | jq  --raw-output '.globalUniqueID'))
trace:
	$(eval TRACE=$(shell \
		curl --silent --request GET \
			--url http://$(server):9000/data/$(GUID)/trace \
			--header 'Authorization: Bearer $(TOKEN)' \
			--header 'cache-control: no-cache'))
test-login: login
	echo Login token: $(TOKEN)
# can write multiline dependencies using backslash
test-trace: login post put trace
	echo TRACE: $(TRACE)