Vagrant.configure("2") do |config|
  common_config = ->(config) do
    config.vm.hostname="vagrant"
    config.vm.box = "thailekha/hyperledger-composer-xenial"
    config.vm.box_check_update = false
    # config.vbguest.auto_update = false

    config.vm.synced_folder ".", "/mnt/vagrant"

    config.vm.provider "virtualbox" do |v|
      v.customize ["modifyvm", :id, "--cpuexecutioncap", "100"]
      v.customize ["modifyvm", :id, "--memory", "4096"]
    end
  end

  forward_port = ->(guest, host = guest) do
    config.vm.network :forwarded_port,
      guest: guest,
      host: host,
      auto_correct: true
  end

  fix_tty = ->(config) do
    config.vm.provision "fix-no-tty", type: "shell" do |s|
      s.privileged = false
      s.inline = "sudo sed -i '/tty/!s/mesg n/tty -s \\&\\& mesg n/' /root/.profile"
    end
  end

  config.vm.define "composerbox" do |composerbox|
    fix_tty[composerbox]
    common_config[composerbox]
    forward_port[8000]
    forward_port[8080]
    forward_port[4001]
    forward_port[5001]
    forward_port[9000]
    forward_port[4040]
  end
end