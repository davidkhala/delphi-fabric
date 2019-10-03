```
const signatureCollector = async (proto) => {
	const tempFile = projectResolve(cache, 'proto');
	fs.writeFileSync(tempFile, proto);
	const formData = {
		proto: fs.createReadStream(tempFile)
	};
	const url = `http://localhost:${swarmServerPort}/channel/getSwarmSignatures`;
	const resp = await RequestPromise({url, formData});

	const {signatures} = resp;
	logger.debug('signatureCollector got', signatures.length);
	return {
		signatures: signUtil.fromBase64(signatures),
	};

};

router.post('/createOrUpdateOrg', multerCache.fields([{name: 'admins'}, {name: 'root_certs'}, {name: 'tls_root_certs'}])
	, async (req, res) => {
		logger.debug('[start]createOrUpdateOrg');
		try {
			const admins = req.files.admins ? req.files.admins.map(({path}) => path) : [];
			const root_certs = req.files.root_certs ? req.files.root_certs.map(({path}) => path) : [];
			const tls_root_certs = req.files.tls_root_certs ? req.files.tls_root_certs.map(({path}) => path) : [];
			const {MSPID, MSPName, nodeType, skip} = req.body;

			let channel;
			let peer;
			let ordererOrg;
			if (nodeType === 'orderer') {
				ordererOrg = helper.randomOrg('orderer');
				const client = await helper.getOrgAdmin(ordererOrg, 'orderer');
				channel = helper.prepareChannel(channelUtil.genesis, client, true);

			} else {
				const channelName = req.body.channelName;
				const ramdomOrg = helper.randomChannelOrg(channelName);
				const client = await helper.getOrgAdmin(ramdomOrg, 'peer');
				channel = helper.prepareChannel(channelName, client, true);
				peer = channel.getPeers()[0];
			}
			const orderer = channel.getOrderers().filter(orderer => !ordererOrg || orderer.org === ordererOrg)[0]; // use same orderer


			// const peerEventHub = EventHubUtil.newEventHub(channel, peer);
			logger.debug('/createOrUpdateOrg', {channelName: channel.getName(), MSPID, MSPName, nodeType}, {
				admins,
				root_certs,
				tls_root_certs
			});


			const onUpdate = (original_config) => {
				// No update checking should be implemented in channel update
				const config = new ConfigFactory(original_config);
				return config.createOrUpdateOrg(MSPName, MSPID, nodeType, {
					admins,
					root_certs,
					tls_root_certs
				}, skip).build();
			};


			await channelUpdate(channel, orderer, peer, onUpdate, signatureCollector);
			if (peer) {
				const eventHub = EventHubUtil.newEventHub(channel, peer, true);
				const block = await EventHubUtil.BlockWaiter(eventHub);
				logger.info('new Block', block);
			} else {
				logger.info('orderer update will not trigger block event');
			}
			const {original_config} = await getChannelConfigReadable(channel, peer);
			res.send(original_config);
		} catch (err) {
			logger.error(err);
			res.status(400).send(err.toString());
		}

	});
```