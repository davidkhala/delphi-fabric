const express = require('express')
const router = express.Router()

// middleware that is specific to this router
// define the home page route
router.get('/orgs', (req, res) => {
	const orgsJson = require('../config/orgs.json')
	res.json(orgsJson)
})
// define the about route
router.get('/chaincode', (req, res) => {
	const chaincodeJson = require('../config/chaincode.json')
	res.json(chaincodeJson)
})


module.exports = router