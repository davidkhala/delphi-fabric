exports.run = (port) => {
	const bodyParser = require('body-parser');
	const http = require('http');
	const express = require('express');
	const app = express();
	const cors = require('cors');

	app.options('*', cors());
	app.use(cors());
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({
		extended: false
	}));
	const server = http.createServer(app).listen(port, () => {
	});

	server.timeout = 240000;
	return app;
};