const helper = require('../../app/helper');
const {transactionProposal, invokeCommit} = require('../../common/nodejs/chaincode');
const {txTimerPromise} = require('../../common/nodejs/chaincodeHelper');
const EventHub = require('../../common/nodejs/builder/eventHub');
const taskInvoke = async (txId) => {

	const org = 'icdd';
	const peer = helper.newPeer(0, org);

	const client = helper.getOrgAdmin(org);
	const channelName = 'allchannel';
	const channel = helper.prepareChannel(channelName, client);
	const eventHub = new EventHub(channel, peer);
	const chaincodeId = 'diagnose';
	const orderer = helper.newOrderers()[0];


	const fcn = 'getRaw';
	const args = ['key'];
	await eventHub.connect();


	const invoke = async (client, channelName, peers, eventHubs, {
		chaincodeId, fcn, args, transientMap
	}, orderer) => {


		const nextRequest = await transactionProposal(client, peers, channelName, {
			chaincodeId,
			fcn,
			args,
			transientMap
		});
		console.debug('proposal response back');
		const {proposalResponses} = nextRequest;
		if (!txId) {
			txId = nextRequest.txId;
		}
		const promises = [];

		for (const eventHub of eventHubs) {
			promises.push(txTimerPromise(eventHub, {txId}, 30000));
		}
		await invokeCommit(client, nextRequest, orderer);

		const txEventResponses = await Promise.all(promises);
		return {txEventResponses, proposalResponses};
	};


	await invoke(client, channelName, [peer], [eventHub], {chaincodeId, fcn, args}, orderer);
	return txId;
};
const task = async () => {


	switch (parseInt(process.env.taskID)) {
		case 0: {
			// duplicate txId
			const txId = await taskInvoke();
			await taskInvoke(txId);
		}
			break;
		default: {
			await taskInvoke();
		}
	}
};
task();