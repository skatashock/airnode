const express = require('express')
const router = express.Router()
const departmentController = require('../controllers/departmentController')

/* Get Department list */
router.get('/list/:page', departmentController.displayDepartments)

module.exports = router