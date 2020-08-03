const helper = require('../../app/helper');
const ChannelHelper = require('../../nodePkg/channelHelper');

const {homeResolve} = require('khala-nodeutils/helper');
const globalConfig = require('../../config/orgs.json');
const channelHelper = new ChannelHelper(globalConfig);
const channelName = 'rovecwvknqkqsrdoeycarfapbtxxgbyjoaoeotygqguathbkyjlpeatitobdnqrjitmerwgnozdcwmhdufsdxafztqgjkhbbontuyhmpkhzubcbmkoenyrzpeqqadedpmtuonbbxcqdthsgvnjxwihrtvjanpntioztleegqoholrakxmxssfyfgzrcmedvhnfokagdssrnntjykgjmowhutiitpyexubvrhnevvueuficagtavmpxlkaoumkcjqujrtuclxfspntknepomnxhbjeyykeydokmxqizbjrewzkxyuhqgvhlfpwzwiqkbinpnstoddunpplrmvuxbsbsrpdwksslixvpyetzskzmywdiqreyjztbpnvxxffkljwxnmsoyyfrfrdtqq';
const channelConfig = globalConfig.channels[channelName];
const channelConfigFile = homeResolve(globalConfig.docker.volumes.CONFIGTX, channelConfig.file);

describe('hack: channel', () => {
	it('channel  name overflow', async () => {
		const peerOrg = 'astri.org';
		const client = helper.getOrgAdmin(peerOrg);
		const channel = helper.prepareChannel(channelName, client);
		const orderers = helper.newOrderers();
		const orderer = orderers[0];
		await channelHelper.create(channel, channelConfigFile, orderer);
	});
});






