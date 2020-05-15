const {chain} = require('../common/nodejs/query');
// const {touch} = require('../cc/golang/stress/stressInvoke');
const helper = require('../app/helper');
const {getIdentityContext} = require('../common/nodejs/admin/user');
const task = async () => {
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	const org = 'icdd';
	switch (parseInt(process.env.taskID)) {
		case 0: {
			await touch(peers, org);
		}
			break;
		case 1: {
			const user = helper.getOrgAdmin(org);
			const channelName = 'allchannel';
			for (const peer of peers) {
				await peer.connect();
			}
			const endorsers = peers.map(({endorser}) => endorser);

			await chain(endorsers, getIdentityContext(user), channelName);
		}
			break;

	}
};
task();
