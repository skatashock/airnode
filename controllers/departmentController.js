const Airtable = require('airtable')
const Bottleneck = require('bottleneck')
const data = require('./dataController.js')
const dotenv = require('dotenv')
const Cacheman = require('cacheman')

const cacheOptions = {
  ttl: 86400
}

const cache = new Cacheman('airdir', cacheOptions)

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

exports.displayDepartments = async (req, res) => {
  let page = req.params.page || req.query.page || 1

  cache.wrap('departments-' + page, () => getDepartments(page))
  .then(departments => {
    res.json(departments)
  })
}

exports.generateDepartments = async () => {
  let page =  1
  return cache.wrap('departments-' + page, () => getDepartments(page))
  .then(departments => {
    return departments
  })
}