SHELL := /usr/bin/env bash

# make ipfs daemon restart if crash?
# avoid using sudo in any recipe that affects the codebase directory
multinode-env:
	$(call VAGRANT_UP_SERVER,1)
	$(call VAGRANT_UP_SERVER,2)
	$(call VAGRANT_UP_SERVER,3)
	vagrant up composer-machine
	vagrant ssh composer-machine -- -t '$(INIT_NVM) && cd /mnt/vagrant && make business-network'
	vagrant up ipfs1
	vagrant ssh ipfs1 -- -t 'cd /mnt/vagrant && make ipfs-machine'
	vagrant up ipfs2
	vagrant ssh ipfs2 -- -t 'cd /mnt/vagrant && make ipfs-machine && make discover-ipfs-peers'
multinode-env-test:
	$(call VAGRANT_UP_SERVER,1)
	$(call VAGRANT_UP_SERVER,2)
	$(call VAGRANT_UP_SERVER,3)
define VAGRANT_UP_SERVER
vagrant destroy -f server-machine$1
# installing dependencies, esp. yarn requires high RAM
RAM=2046 vagrant up server-machine$1
vagrant ssh server-machine$1 -- -t 'cd /mnt/vagrant && make api-preqreq'
vagrant ssh server-machine$1 -- -t 'sudo npm install -g forever'
vagrant halt server-machine$1
RAM=256 vagrant up server-machine$1
vagrant ssh server-machine$1 -- -t 'cd /mnt/vagrant/server && npm run production'
endef
singlenode-env:
	vagrant destroy -f dev-machine
	vagrant up dev-machine
	vagrant ssh dev-machine -- -t '$(INIT_NVM) && cd /mnt/vagrant && make singlenode'
singlenode: jq-command start-composer sleep-3 init-business-network ipfs-command config-ipfs ipfs-daemon yarn-command arp-scan-command
	cd server && npm run yarn-install
# ===================
# Composer VM
# ===================
# nvm init in ~/.bashrc is not run in non-interactive provision
define INIT_NVM
export NVM_DIR="$${HOME}/.nvm"; \
[ -s "$${NVM_DIR}/nvm.sh" ] && . "$${NVM_DIR}/nvm.sh"; \
[ -s "$${NVM_DIR}/bash_completion" ] && . "$${NVM_DIR}/bash_completion"
endef
# <If need to packge the vm using the base mode:>
# PACKAGING=true vagrant up composer-empty
# vagrant ssh composer-empty
#	wget "https://raw.githubusercontent.com/mitchellh/vagrant/master/keys/vagrant.pub"
#	mv vagrant.pub .ssh/authorized_keys
#	chmod 0600 .ssh/authorized_keys
# VBoxManage list runningvms
# vagrant package --base <vm name> --output fsbc-composer.box --debug 2>&1 | tee packaging.log
# vagrant box add fsbc/composer fsbc-composer.box
composer-box:
	vagrant destroy -f composer-empty
	vagrant up composer-empty
	vagrant ssh composer-empty -- -t 'cd /mnt/vagrant && make install-composer-prereq'
	# Prerequesites require logout and login before running core setup
	vagrant ssh composer-empty -- -t '$(INIT_NVM) && cd /mnt/vagrant && make install-composer-core'
	vagrant ssh composer-empty -- -t '$(INIT_NVM) && cd /mnt/vagrant && make test-business-network'
	rm fsbc-composer.box || echo Box does not exist
	vagrant package composer-empty --output fsbc-composer.box
	vagrant box remove fsbc/composer || echo Box not previously added
	vagrant box add fsbc/composer fsbc-composer.box
	vagrant destroy -f composer-empty
install-composer-prereq:
	wget https://hyperledger.github.io/composer/latest/prereqs-ubuntu.sh -O /tmp/prereqs-ubuntu.sh
	chmod u+x /tmp/prereqs-ubuntu.sh
	bash /tmp/prereqs-ubuntu.sh
FABRIC_DIR:=~/fabric-dev-servers
install-composer-core:
	sleep 2
	npm install -g --unsafe-perm composer-cli@0.20 composer-playground@0.20
	mkdir $(FABRIC_DIR)
	wget -P $(FABRIC_DIR) https://raw.githubusercontent.com/hyperledger/composer-tools/master/packages/fabric-dev-servers/fabric-dev-servers.tar.gz
	tar -xf $(FABRIC_DIR)/fabric-dev-servers.tar.gz -C $(FABRIC_DIR)
	FABRIC_VERSION=hlfv12 bash $(FABRIC_DIR)/downloadFabric.sh
# ===================
# Composer business network
# ===================
business-network: jq-command start-composer sleep-3 init-business-network
	echo Ready
test-business-network: jq-command start-composer sleep-3 init-business-network clean-composer
	echo Ready
start-composer:
	FABRIC_VERSION=hlfv12 cd ~/fabric-dev-servers && ./startFabric.sh
	FABRIC_VERSION=hlfv12 cd ~/fabric-dev-servers && ./createPeerAdminCard.sh
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
update-business-network:
	$(eval VERSION=$(shell cd bc && npm version patch > /dev/null && cat package.json | jq --raw-output '.version'))
	echo $(VERSION)
	composer archive create --sourceType dir --sourceName ./bc -a dfs@$(VERSION).bna
	composer network install --card PeerAdmin@hlfv1 --archiveFile dfs@$(VERSION).bna
	composer network upgrade -c PeerAdmin@hlfv1 -n dfs -V $(VERSION)
	composer network ping -c admin@dfs
	rm dfs@*
clean-composer:
	cd ~/fabric-dev-servers && ./stopFabric.sh
	docker rm $(shell docker ps -aq)
	docker rmi $(shell docker images dev-* -q)
	rm -rf ~/.composer
# ===================
# IPFS
# ===================
define IPFS_DAEMON
echo $(shell ipfs daemon > /dev/null 2>&1 &) && sleep 2
endef
ipfs-machine: ipfs-command config-ipfs config-ipfs-private
	$(IPFS_DAEMON)
# https://github.com/ipfs/apps/issues/34
# https://askubuntu.com/questions/309668/how-to-discover-the-ip-addresses-within-a-network-with-a-bash-script
discover-ipfs-peers: arp-scan-command
	$(eval INTERFACES=$(shell ifconfig -a | awk '{print $$1}' | grep enp))
	for INTERFACE in $(INTERFACES); do \
		IPS=$$(sudo arp-scan --numeric --quiet --ignoredups --localnet --interface=$$INTERFACE | awk '/([a-f0-9]{2}:){5}[a-f0-9]{2}/ {print $$1}') ; \
		for IP in $$IPS; do \
			ipfs swarm connect /ip4/$$IP/tcp/4001/ipfs/$$(curl --silent $$IP:5001/api/v0/id -m 2 | jq --raw-output '.ID') || continue; \
		done \
	done
ipfs-command:
	$(call install-command,ipfs)
install-ipfs:
	rm -rf /tmp/go-ipfs*
	wget -P /tmp/ https://dist.ipfs.io/go-ipfs/v0.4.17/go-ipfs_v0.4.17_linux-amd64.tar.gz
	tar xvfz /tmp/go-ipfs_v0.4.17_linux-amd64.tar.gz -C /tmp
	rm /tmp/go-ipfs_v0.4.17_linux-amd64.tar.gz
	cd /tmp/go-ipfs && sudo ./install.sh
	rm -rf /tmp/go-ipfs
config-ipfs:
	ipfs init
	ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
	ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/4040
config-ipfs-private:
	cp /mnt/vagrant/swarm.key ~/.ipfs/.
	ipfs bootstrap rm --all
ipfs-daemon:
	$(IPFS_DAEMON)
kill-ipfs:
	sudo kill $(shell lsof -n -i :4001 | grep LISTEN | awk '{print $$2}' | uniq)
# ===================
# API server
# ===================
api-preqreq: install-nodejs yarn-command
	cd /mnt/vagrant/server && npm run yarn-install
# ===================
# CI
# ===================
travis-build: start-composer sleep-3 init-business-network ipfs-command config-ipfs
	$(IPFS_DAEMON)
	cd server && yarn install && npm run lint && npm run coverage
sonarcloud: install-sonar-scanner
	cd server && ../sonar-scanner-3.2.0.1227-linux/bin/sonar-scanner -Dsonar.login=$(SONARTOKEN)
# ===================
# Dependency packages/programs installations
# ===================
install-virtualbox-vagrant:
	wget https://download.virtualbox.org/virtualbox/6.0.0/virtualbox-6.0_6.0.0-127566~Ubuntu~xenial_amd64.deb -O /tmp/vbox6.deb
	sudo dpkg -i /tmp/vbox6.deb
	sudo apt-get install -f -y
	wget https://releases.hashicorp.com/vagrant/2.2.2/vagrant_2.2.2_x86_64.deb -O /tmp/vagrant2.deb
	sudo dpkg -i /tmp/vagrant2.deb
	sudo apt-get install -f -y
install-arp-scan:
	sudo apt-get update && sudo apt-get install -y arp-scan
arp-scan-command:
	$(call install-command,arp-scan)
install-jq:
	sudo apt-get update && sudo apt-get install -y jq
jq-command:
	$(call install-command,jq)
install-go:
	# wget -P $(HOME) https://storage.googleapis.com/golang/go1.10.1.linux-amd64.tar.gz
	# tar -xvf $(HOME)/go1.10.1.linux-amd64.tar.gz
	sudo apt-get install -y golang
	mkdir $(HOME)/gopath
	echo "export GOPATH=\$HOME/gopath" >> ~/.bashrc
	source ~/.bashrc
go-command:
	$(call install-command,go)
install-nodejs:
	curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
	sudo apt-get install -y nodejs
install-yarn:
	curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
	echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
	sudo apt-get update && sudo apt-get install --no-install-recommends yarn
yarn-command:
	$(call install-command,yarn)
install-ngrok:
	wget -q https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.zip
	unzip -q ngrok-stable-linux-amd64.zip
	rm ngrok-stable-linux-amd64.zip
install-sonar-scanner:
	wget -q https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-3.2.0.1227-linux.zip
	unzip -q sonar-scanner-cli-3.2.0.1227-linux.zip
# ===================
# Helpers
# ===================
install-command = which $1 || $(MAKE) install-$1
clean-dpkg:
	sudo rm /var/lib/apt/lists/lock
	sudo rm /var/cache/apt/archives/lock
	sudo rm /var/lib/dpkg/lock
	sudo dpkg --configure -a
	sudo apt-get -f install -y
sleep-3:
	sleep 3
gen-ipfs-swarm-key: go-command
	GOPATH=$(HOME)/gopath go get -u github.com/Kubuxu/go-ipfs-swarm-key-gen/ipfs-swarm-key-gen
	$(HOME)/gopath/bin/ipfs-swarm-key-gen > ~/.ipfs/swarm.key
run-ngrok:
	./ngrok http 9000
ssh-to-physical-server-from-mac:
	ssh -o PubkeyAuthentication=no dev@hostname.com