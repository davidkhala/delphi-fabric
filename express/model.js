const logger = require('../app/util/logger').new('Oauth model');

const config = {
	clients: [{
		clientId: 'application',
		clientSecret: 'secret'
	}],
	confidentialClients: [{
		clientId: 'confidentialApplication',
		clientSecret: 'topSecret'
	}],
	tokens: [],
	users: [{
		id: '123',
		username: 'key',
		password: 'password'
	}]
};

/*
 * Methods used by all grant types.
 */

const getAccessToken = function (bearerToken, callback) {
	logger.debug('getAccessToken');
	const tokens = config.tokens.filter((token) => {

		return token.accessToken === bearerToken;
	});

	return callback(false, tokens[0]);
};

const getClient = function (clientId, clientSecret, callback) {
	logger.debug('getClient');
	const clients = config.clients.filter((client) => {

		return client.clientId === clientId && client.clientSecret === clientSecret;
	});

	const confidentialClients = config.confidentialClients.filter((client) => {

		return client.clientId === clientId && client.clientSecret === clientSecret;
	});

	callback(false, clients[0] || confidentialClients[0]);
};

const grantTypeAllowed = function (clientId, grantType, callback) {
	logger.debug('grantTypeAllowed');
	let clientsSource,
		clients = [];

	if (grantType === 'password') {
		clientsSource = config.clients;
	} else if (grantType === 'client_credentials') {
		clientsSource = config.confidentialClients;
	}

	if (clientsSource) {
		clients = clientsSource.filter((client) => {

			return client.clientId === clientId;
		});
	}

	callback(false, clients.length);
};

const saveAccessToken = function (accessToken, clientId, expires, user, callback) {
	logger.debug('saveAccessToken');
	config.tokens.push({
		accessToken: accessToken,
		expires: expires,
		clientId: clientId,
		user: user
	});

	callback(false);
};

/*
 * Method used only by password grant type.
 */

const getUser = function (username, password, callback) {
	logger.debug('getUser');
	const users = config.users.filter((user) => {

		return user.username === username && user.password === password;
	});

	callback(false, users[0]);
};

/*
 * Method used only by client_credentials grant type.
 */

const getUserFromClient = function (clientId, clientSecret, callback) {
	logger.debug('getUserFromClient');
	const clients = config.confidentialClients.filter((client) => {

		return client.clientId === clientId && client.clientSecret === clientSecret;
	});

	let user;

	if (clients.length) {
		user = {
			username: clientId
		};
	}

	callback(false, user);
};

const saveToken = (token, client, user) => {
	return {
		accessToken: token,
		client,
		user,
	};
};
const getRefreshToken= (refreshToken) =>{
	return {
		refreshToken,
		client:{id:config.clients[0].clientId},
		user:config.users[0]
	};
};
const revokeToken= (token)=>{
	return true;
};
/**
 * Export model definition object.
 */

module.exports = {
	getAccessToken,
	getClient,
	grantTypeAllowed,
	saveAccessToken,
	saveToken,
	getUser,
	getUserFromClient,
	getRefreshToken,
	revokeToken
};