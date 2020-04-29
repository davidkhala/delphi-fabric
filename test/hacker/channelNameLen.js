const helper = require('../../app/helper');
const {create} = require('../../app/channelHelper');
const {homeResolve} = require('../../common/nodejs/admin/helper').nodeUtil.helper();
const ChannelUtil = require('../../common/nodejs/channel');
const globalConfig = require('../../config/orgs.json');

const channelName = 'rovecwvknqkqsrdoeycarfapbtxxgbyjoaoeotygqguathbkyjlpeatitobdnqrjitmerwgnozdcwmhdufsdxafztqgjkhbbontuyhmpkhzubcbmkoenyrzpeqqadedpmtuonbbxcqdthsgvnjxwihrtvjanpntioztleegqoholrakxmxssfyfgzrcmedvhnfokagdssrnntjykgjmowhutiitpyexubvrhnevvueuficagtavmpxlkaoumkcjqujrtuclxfspntknepomnxhbjeyykeydokmxqizbjrewzkxyuhqgvhlfpwzwiqkbinpnstoddunpplrmvuxbsbsrpdwksslixvpyetzskzmywdiqreyjztbpnvxxffkljwxnmsoyyfrfrdtqq';
const channelConfig = globalConfig.channels[channelName];
const channelConfigFile = homeResolve(globalConfig.docker.volumes.CONFIGTX, channelConfig.file);

const createTask = async (channel, orderer) => {
	await create(channel, channelConfigFile, orderer);
};

const task = async () => {
	const peerOrg = 'astri.org';
	const client = await helper.getOrgAdmin(peerOrg);
	const channel = helper.prepareChannel(channelName, client);
	const orderers = await ChannelUtil.getOrderers(channel, true);
	const orderer = orderers[0];
	await createTask(channel, orderer);

};











task();





