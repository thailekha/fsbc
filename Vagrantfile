def common_config(config, memory = "512")
  # Use PACKAGING env var when packing in base mode
  if !ENV["PACKAGING"].nil?
    memory = "1024"
  end

  config.vm.hostname="vagrant"
  config.vm.synced_folder ".", "/mnt/vagrant", disabled: !ENV["PACKAGING"].nil?
  config.vm.box_check_update = false
  config.vm.provider "virtualbox" do |v|
    v.customize ["modifyvm", :id, "--cpuexecutioncap", "100"]
    v.customize ["modifyvm", :id, "--memory", memory]

    # fix VBoxManage error create logfile on the path from the machine that created this base box
    # https://github.com/hashicorp/vagrant/issues/9425
    if !ENV["PACKAGING"].nil?
      v.customize [ "modifyvm", :id, "--uartmode1", "disconnected"]
    end
  end
  config.vm.provision "fix-no-tty", type: "shell" do |s|
    s.privileged = false
    s.inline = "sudo sed -i '/tty/!s/mesg n/tty -s \\&\\& mesg n/' /root/.profile"
  end

  # make sure `make` is available
  config.vm.provision "shell", inline: <<-SHELL
    apt-get update && apt-get install -y build-essential
  SHELL
end

def forward_port(config, guest, host = guest)
  config.vm.network :forwarded_port, guest: guest, host: host, auto_correct: true
end

# def ipfs_machine(config, discover)
#   common_config(config)
#   config.vm.box = "ubuntu/xenial64"
#   config.vm.network "public_network"

#   if discover
#     config.vm.provision "shell", privileged: false, inline: <<-SHELL
#       cd /mnt/vagrant && make ipfs-machine && make discover-ipfs-peers
#     SHELL
#   else
#     config.vm.provision "shell", privileged: false, inline: <<-SHELL
#       cd /mnt/vagrant && make ipfs-machine
#     SHELL
#   end
# end

Vagrant.configure("2") do |vagrant_conf|
  vagrant_conf.vm.define "composer-empty" do |config|
    common_config(config, "2046")
    config.vm.box = "ubuntu/xenial64"
  end

  vagrant_conf.vm.define "composer-machine" do |config|
    common_config(config, "2046")
    config.vm.box = "fsbc/composer"
    config.vm.network "public_network"
  end

  (1..2).each do |i|
    vagrant_conf.vm.define "ipfs#{i}" do |config|
      # ipfs_machine(config, i > 1)
      common_config(config)
      config.vm.box = "ubuntu/xenial64"
      config.vm.network "public_network"
    end
  end

  vagrant_conf.vm.define "server-machine" do |config|
    common_config(config)
    config.vm.box = "ubuntu/xenial64"
    config.vm.network "public_network"
  end

  vagrant_conf.vm.define "dev-machine" do |config|
    common_config(config, "4096")
    config.vm.box = "fsbc/composer"
    config.vm.network "public_network"
  end
end