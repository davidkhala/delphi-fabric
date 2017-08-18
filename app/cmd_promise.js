const c_process = require('child_process')

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