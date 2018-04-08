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


	getToken: ({username = 'key', password = 'password'}) => {
		const oauth2 = Oauth2Client.create(credentials);
		return oauth2.ownerPassword.getToken({username, password})
			.then((result) => {
				const accessToken = oauth2.accessToken.create(result);
				logger.info(accessToken);
				return Promise.resolve(accessToken);
			}).catch(err => {
				logger.error(err);
				return Promise.reject(err);
			});
	},
	refreshToken: (accessToken) => {
		const oauth2 = Oauth2Client.create(credentials);
		const {token: {accessToken: {accessToken:access_token, refreshToken:refresh_token}}} = accessToken;
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

