const express = require('express')
const router = express.Router()
const personnelController = require('../controllers/personnelController')

/* Get Personnel list */
router.get('/list/:page', personnelController.displayPersonnels)

module.exports = router