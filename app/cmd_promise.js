const c_process = require('child_process')

//promisify is new in nodejs 8
exports.execSync = c_process.execSync

exports.execFile = (shFile, args=[], options={}) => new Promise((resolve, reject) => {
	c_process.execFile(shFile, args, options, (err, stdout, stderr) => {
		if (err) reject({ err })
		else resolve({ stdout, stderr })
	})
})
//
exports.exec = (command, options={}) => new Promise((resolve, reject) => {
	c_process.exec(command, options, (err, stdout, stderr) => {
		if (err) reject({ err })
		else resolve({ stdout, stderr })
	})
})
// stderr is sent to stdout of parent process
// you can set options.stdio if you want it to go elsewhere


exports.spawnSync= require('child_process').spawnSync
