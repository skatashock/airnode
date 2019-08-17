const express = require('express')
const router = express.Router()
const personnelController = require('../controllers/personnelController')

/* List Personnels */
router.get('/list/:page', personnelController.displayPersonnels)

/* View Personnel */
router.get('/view/:id', personnelController.displayPersonnel)

module.exports = router