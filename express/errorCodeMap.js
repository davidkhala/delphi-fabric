const map = {
	'invalid': 400,
	'BAD_REQUEST': 400,
	'FORBIDDEN': 403,
	'Failed to deserialize creator identity': 401,
	'NOT_FOUND': 404,
	'could not find': 404,
	'no such file or directory': 404,
	'not found': 404,
	'Connect Failed': 503,
	'Service Unavailable': 503,
	'JSON.parse': 400
};
exports.get = (err) => {
	let status = 500;
	for (const [errorMessage, code] of Object.entries(map)) {
		if (err.toString().includes(errorMessage)) {
			status = code;
			break;
		}
	}
	return status;
};