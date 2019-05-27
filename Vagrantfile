def common_config(config, memory = "512")
  config.vm.hostname="vagrant"
  config.vm.synced_folder ".", "/mnt/vagrant", disabled: !ENV["PACKAGING"].nil?
  config.vm.box_check_update = false
  config.vm.provider "virtualbox" do |v|
    v.customize ["modifyvm", :id, "--cpuexecutioncap", "100"]
    v.customize ["modifyvm", :id, "--memory", memory]
    # fix VBoxManage error create logfile on the path from the machine that created this base box
    # https://github.com/hashicorp/vagrant/issues/9425
    # v.customize [ "modifyvm", :id, "--uartmode1", "disconnected"]
  end

  fix_ubuntu(config)
end

def fix_ubuntu(config)
  config.vm.provision "shell", inline: <<-SHELL
    sed -i '/tty/!s/mesg n/tty -s \\&\\& mesg n/' /root/.profile
    echo 'APT::Periodic::Enable \"0\";' > /etc/apt/apt.conf.d/02periodic
    apt-get --purge unattended-upgrades
    apt-get update
    while pgrep unattended; do sleep 10; done;
    apt-get install -y build-essential zip unzip apt-rdepends tree
  SHELL

  #remove dpkg lock
  # config.vm.provision "shell", inline: <<-SHELL
  #   rm /var/lib/apt/lists/lock
  #   rm /var/cache/apt/archives/lock
  #   rm /var/lib/dpkg/lock
  #   rm /var/lib/dpkg/lock-frontend
  #   dpkg --configure -a
  #   apt-get -f install -y
  # SHELL
end

def install_node(config)
  config.vm.provision "shell", inline: <<-SHELL
    curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
    apt-get install -y nodejs
  SHELL
end

def install_docker(config)
  config.vm.provision "shell", inline: <<-SHELL
    apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    apt-key fingerprint 0EBFCD88 | grep docker@docker.com || exit 1
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    apt-get update
    apt-get install -y docker-ce
    docker --version

    docker pull mongo
  SHELL
end

def forward_port(config, guest, host = guest)
  config.vm.network :forwarded_port, guest: guest, host: host, auto_correct: true
end

Vagrant.configure("2") do |vagrant_conf|
  vagrant_conf.vm.define "composer-empty" do |config|
    common_config(config, "2046")
    config.vm.box = "ubuntu/xenial64"
  end

  # (1..3).each do |i|
  #   vagrant_conf.vm.define "ipfs#{i}" do |config|
  #     # ipfs_machine(config, i > 1)
  #     common_config(config)
  #     config.vm.box = "ubuntu/xenial64"
  #     config.vm.network "public_network"
  #   end
  # end

  vagrant_conf.vm.define "dev-machine" do |config|
    common_config(config, "4096")
    config.vm.box = "fsbc/composer"
    forward_port(config,9000)
  end

  vagrant_conf.vm.define "backend" do |config|
    common_config(config, "2048")
    config.vm.box = "ubuntu/xenial64"
    install_node(config)
    install_docker(config)
    forward_port(config,9000)
  end
end
