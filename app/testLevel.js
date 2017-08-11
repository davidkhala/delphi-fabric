const levelup = require('levelup')

const dbs = ['chains/index', 'historyLeveldb', 'ledgerProvider', 'stateLeveldb']
//FIXME make instantiate failed :ready held by process
const deleteChaincode = (ccname, containers = [
	'BUContainerName.delphi.com',
	'ENGContainerName.delphi.com',
	'PMContainerName.delphi.com']) => {

	console.log('enter promise')
	const promises = []
	containers.forEach(container => dbs.forEach(dbPath => {
		const db = levelup(`/home/david/Documents/delphi-fabric/ledgersData/${container}/${dbPath}`)

		const promise = new Promise((resolve, reject) => {
			const keys = []
			const onEnd = keys => {

				const promises = []

				keys.forEach(key => {
					promises.push(new Promise((resolve, reject) => {
						console.log('to delete', { container, dbPath, key })
						db.del(key, err => {
							if (err) {
								reject(err)
							} else {
								resolve({ container, dbPath, key })
							}
						})
					}))

				})

				return Promise.all(promises)
			}
			const stream = db.createKeyStream().on('data', key => {
				keys.push(key)
			}).on('error', err => {
				reject(err)
			}).on('end', () => {
				console.log({ container, dbPath, keys })
				resolve(onEnd(keys.filter(key => key.includes(ccname))))

			})

		})

		promises.push(promise.then((data) => {
			return new Promise((resolve, reject) => {
				db.close(err => {
					err ? reject(err) : resolve(data)
				})
			})
		}))
	}))
	return Promise.all(promises)

}

exports.deleteChaincode = deleteChaincode

const listKeys = (containers = [
	'BUContainerName.delphi.com',
	'ENGContainerName.delphi.com',
	'PMContainerName.delphi.com']) => {

	containers.forEach(container => dbs.forEach(dbPath => {
		const db = levelup(`/home/david/Documents/delphi-fabric/ledgersData/${container}/${dbPath}`)
		const stream = db.createKeyStream()
		const keys = []
		stream.on('data', key => {
			keys.push(key)
		})
		stream.on('end', () => {
			console.log({ container, dbPath, keys })
			db.close()
		})
	}))
}

//fixme test did

// listKeys()