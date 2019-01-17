const exec = require('shelljs').exec;

const ShellController = {};

// function hasAll(string, strings) {
//   return strings.filter(s => string.indexOf(s) > -1).length === strings.length;
// }

// function hasEither(string, strings) {
//   return strings.filter(s => string.indexOf(s) > -1).length > 0;
// }

function splitTrimFilter(str) {
  return str.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

async function shellexec(command, checkStderrForError = true, parseOutput = true) {
  const {code, stdout, stderr} = await exec(command, {silent:true});
  if (code !== 0 || (checkStderrForError && stderr)) {
    throw new Error(`Command ${command} resulted in code: ${code}, stderr: ${stderr}`);
  }
  // console.log(stdout);
  return parseOutput ? splitTrimFilter(stdout) : stdout;
}

ShellController.shellexec = shellexec;

// ShellController.killProcessListeningOnPort = async function(port) {
//   const uniqueNetstatItems = (accumulator, currentValue) => {
//     if (accumulator.findIndex(c => c.pid === currentValue.pid) < 0) {
//       accumulator.push(currentValue);
//     }
//     return accumulator;
//   };

//   const filteredProcesses = (await this.shellexec(`sudo netstat --tcp --listening --numeric --program | awk '{print $4,$7}'`))
//     .filter(i => hasAll(i,[':','/']) && hasEither(i,['0.0.0.0','127.0.0.1','::']) && i.split(' ').length === 2)
//     .map(i => (i.indexOf('::') > -1 ? i.replace('::', '0.0.0.0') : i) )
//     .map(i => {
//       var socketAndProcess = i.split(' ');
//       return {
//         port: socketAndProcess[0].split(':')[1],
//         pid: socketAndProcess[1].split('/')[0],
//       };
//     })
//     .filter(i => i.port === port)
//     .reduce(uniqueNetstatItems, []);

//   if (filteredProcesses.length !== 1) {
//     throw new Error(`Could not find process listening on port ${port}`);
//   }

//   const pidToKill = filteredProcesses[0].pid;
//   await this.shellexec(`sudo kill ${pidToKill}`);
// };

ShellController.killProcessListeningOnPort = async port => {
  await shellexec(`sudo kill $(lsof -n -i :${port} | grep LISTEN | awk '{print $2}' | uniq)`);
};

module.exports = ShellController;