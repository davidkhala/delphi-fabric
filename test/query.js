/**
 * { height: 6,
       currentBlockHash: 'd3b9daa05f453ce96f94666a04422b2b4ef5906590a331a11caed27215f47a87',
       previousBlockHash: 'abcda64b4bf90cfe6ac172193959a96d05c69f071e367ecbb667a1e69e4770e9' }
 */
/**
 { height: 7,
      currentBlockHash: '68c2c71b45379b8b5d592958fe5994f9d3047f1918b4a5aacc22bd7b14db3a22',
	  previousBlockHash: 'd3b9daa05f453ce96f94666a04422b2b4ef5906590a331a11caed27215f47a87' }
 */

const {chain} = require('../common/nodejs/query');
const {touch} = require('../cc/golang/stress/stressInvoke');
const helper = require('../app/helper');
const task = async () => {
	const peers = helper.newPeers([0], 'icdd');
	const clientOrg = 'icdd';
	await touch(peers, clientOrg);
	const client = await helper.getOrgAdmin(clientOrg);
	const channel = helper.prepareChannel('allchannel', client);
	const {pretty} = await chain(peers[0], channel);
	console.log(pretty);


};
task();
