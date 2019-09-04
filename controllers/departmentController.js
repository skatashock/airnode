const Airtable = require('airtable')
const Bottleneck = require('bottleneck')
const data = require('./dataController.js')
const personnelController = require('./personnelController')
const dotenv = require('dotenv')

const cacheService = require('../services/cacheService')
const ttl = 60 * 60 * 1 // cache for 1 Hour
const cache = new cacheService(ttl)

// get dotenv configs
dotenv.config()

// Bottleneck rate limiter
const limiter = new Bottleneck({
  minTime: 1050 / 5 // ~5 requests per second
})

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID)

const TABLE = base('Department')
const OPTIONS = {
  view: 'Default',
  pageSize: 100
}

const getDepartments = async (page) => {
  const wrapped = limiter.wrap(data.getAirtableRecords)
  const departments = await wrapped(TABLE, OPTIONS)

  const count  = departments.length,
    pages = Math.ceil(count / OPTIONS.pageSize),
    offset = (page * OPTIONS.pageSize) - OPTIONS.pageSize

  return departments.map(department => ({
    id: department.getId(),
    name: department.get('Name'),
    headcount: department.get('Headcount'),
    pages
  }))
  .slice(offset, OPTIONS.pageSize * page)
}

const getDepartmentById = async (id) => {
  const wrappedRecord = limiter.wrap(data.getAirtableRecord)
  const department = await wrappedRecord(TABLE, id)

  const ids = department.get('Members')
  const members = await personnelController.displayPersonnelsByIds(ids)

  return {
    id: department.getId(),
    name: department.get('Name'),
    headcount: department.get('Headcount'),
    members: members,
  }
}

exports.displayDepartments = async (req, res) => {
  let page = req.params.page || req.query.page || 1

  cache.get('departments-' + page, () => getDepartments(page))
  .then(departments => {
    res.json(departments)
  })
}

exports.generateDepartments = async () => {
  let page =  1
  return cache.get('departments-' + page, () => getDepartments(page))
  .then(departments => {
    return departments
  })
}

exports.displayDepartment = async (req, res) => {
  const id = req.params.id

  cache.get('department-' + id, () => getDepartmentById(id))
  .then(department => {
    res.json(department)
  })
}