const express = require('express')
const router = express.Router()
const departmentController = require('../controllers/departmentController')

/* List Department */
router.get('/list/:page', departmentController.displayDepartments)

/* View Department */
router.get('/view/:id', departmentController.displayDepartment)

module.exports = router