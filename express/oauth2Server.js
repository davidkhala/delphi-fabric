const bodyParser = require('body-parser');
const express = require('express');
const logger = require('../app/util/logger').new('OAuth2Server');
const app = express();
const OAuth2Server = require('oauth2-server');
const {Request, Response} = OAuth2Server;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use((req, res, next) => {
	const {headers, url, body, method} = req;
	logger.debug({headers, url, method, body});

	next();
});
app.post('/oauth/token', (req, res) => {
	const oauthReq = new Request(req);

	let GrantClass;
	switch (req.body.grant_type) {
		case 'password':
			GrantClass = require('oauth2-server/lib/grant-types/password-grant-type');
			break;
		case 'refresh_token':
			GrantClass = require('oauth2-server/lib/grant-types/refresh-token-grant-type');
			break;
	}

	const oauth = new GrantClass({
		model: require('./model'),
		allowBearerTokensInQueryString: true,
		accessTokenLifetime: 4 * 60 * 60
	});
	const client = {
		id: oauthReq.body.client_id
	};
	logger.debug({client});
	oauth.handle(oauthReq, client).then((token) => {
		logger.info(token);
		res.send(token);
	}).catch((err) => {
		logger.error(err);
		res.status(400).send(err);
	});


});

app.listen(5000);