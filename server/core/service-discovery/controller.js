const randomItem = require('random-item');
const shellexec = require('../shell/controller').shellexec;

const SDController = {};

var services = [];

//TODO: implement port, implement parallel

const localhost = '0.0.0.0';
const ipAddressesFromEncapsulatedEthernetInterfaces = "for i in $(ifconfig -a | awk '{print $1}' | grep enp); do sudo arp-scan --numeric --quiet --ignoredups --localnet --interface=$i | awk '/([a-f0-9]{2}:){5}[a-f0-9]{2}/ {print $1}'; done";
const connectToAddressAtPort = (address,port) => `timeout --kill-after=1s 0.5s nc -z ${address} ${port}`;

// const EncapsulatedEthernetInterfaces = "ifconfig -a | awk '{print $1}' | grep enp";
// const scanIPsOnInterface = interface => `sudo arp-scan --numeric --quiet --ignoredups --localnet --interface=${interface} | awk '/([a-f0-9]{2}:){5}[a-f0-9]{2}/ {print $1}'`;
// async function discover(validator) {
//   for (const nwInterface of (await shellexec(encapsulatedEthernetInterfaces))) {
//     for(const ip of (await shellexec(scanIPsOnInterface(nwInterface)))) {
//       if (await validator(ip) && !services.includes(ip)) {
//         services.push(ip);
//       }
//     }
//   }
//   if (services.length === 0) {
//     throw new Error("No service available");
//   }
//   return randomItem(services);
// }

async function discover(validator) {
  if (!services.includes(localhost) && await validator(localhost)) {
    services.push(localhost);
  }
  const discoveredIps = await shellexec(ipAddressesFromEncapsulatedEthernetInterfaces);
  for (const ip of discoveredIps) {
    if (!services.includes(ip) && await validator(ip)) {
      services.push(ip);
    }
  }
  if (services.length === 0) {
    throw new Error("No service available");
  }
  return randomItem(services);
}

SDController.connectToAddressAtPort = connectToAddressAtPort;

SDController.getService = async function(validator) {
  if (services.length === 0) {
    return await discover(validator);
  }

  var s = randomItem(services);
  while (!(await validator(s))) {
    services = services.filter(i => i !== s);
    if (services.length === 0) {
      return await discover(validator);
    }
    s = randomItem(services);
  }
  return s;
};

SDController.resetServices = function() {
  services = [];
};

module.exports = SDController;