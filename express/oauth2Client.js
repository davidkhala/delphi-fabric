const Oauth2Client = require('simple-oauth2');
const logger = require('../app/util/logger').new('oauth2Client');
const credentials = {
	client: {
		id: 'application',
		secret: 'secret'
	},
	auth: {
		tokenHost: 'http://localhost:5000'
	}
};
module.exports.passwordGrant = {

	verify:(token)=>{
	//	TODO
		return Promise.resolve(token)
	},
	getToken: ({username = 'key', password = 'password'}) => {
		const oauth2 = Oauth2Client.create(credentials);
		return oauth2.ownerPassword.getToken({username, password})
			.then((result) => {
				logger.info(result);
				return Promise.resolve(result);
			});
	},
	refreshToken: (accessToken) => {
		const oauth2 = Oauth2Client.create(credentials);
		const {accessToken: {accessToken:access_token, refreshToken:refresh_token}} = accessToken;
		const tokenObject = {
			access_token,
			refresh_token,
		};
		return oauth2.accessToken.create(tokenObject).refresh();
	}
};


module.exports.passwordGrant.getToken({}).then(accessToken => {
	module.exports.passwordGrant.refreshToken(accessToken);
});

