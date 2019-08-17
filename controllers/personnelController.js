const Airtable = require('airtable')
const Bottleneck = require('bottleneck')
const data = require('./dataController')
const dotenv = require('dotenv')
const Cacheman = require('cacheman')
const departmentController = require('./departmentController')

const cacheOptions = {
  ttl: 3600
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

const TABLE = base('Personnel')
const OPTIONS = {
  view: 'Default',
  filterByFormula: "NOT({Name} = '')",
  pageSize: 100
}

const getPersonnels = async (page) => {
  const departments = {}
  const departmentsData = await departmentController.generateDepartments()
  departmentsData.forEach(function (department) {
    departments[department.id] = department.name
  })

  const wrappedRecords = limiter.wrap(data.getAirtableRecords)
  const personnels = await wrappedRecords(TABLE, OPTIONS)

  const count  = personnels.length,
    pages = Math.ceil(count / OPTIONS.pageSize),
    offset = (page * OPTIONS.pageSize) - OPTIONS.pageSize

  return personnels.map(personnel => {
    let photoURL
    if (personnel.get('Photo')) {
      photoURL = personnel.get('Photo')[0].thumbnails.large.url
    }

    let personnelDepartments = []
    if (personnel.get('Department')) {
      const depts = personnel.get('Department')
      let personnelDepartment = {}

      depts.forEach(function (dept) {
        personnelDepartment[dept] = departments[dept]
      })

      personnelDepartments.push(personnelDepartment)
    }

    return {
      id: personnel.getId(),
      name: personnel.get('Name'),
      title: personnel.get('Title'),
      department: personnelDepartments,
      photo: photoURL,
      pages
    }
  })
  .slice(offset, OPTIONS.pageSize * page)
}

const getPersonnelById = async (id) => {
  const wrappedRecord = limiter.wrap(data.getAirtableRecord)
  const personnel = await wrappedRecord(TABLE, id)

  return personnel
}

exports.displayPersonnels = async (req, res) => {
  let page = req.params.page || req.query.page || 1

  cache.wrap('personnels-' + page, () => getPersonnels(page))
  .then(personnels => {
    res.json(personnels)
  })
}

exports.displayPersonnel = async (req, res) => {
  const id = req.params.id

  cache.wrap('personnel-' + id, () => getPersonnelById(id))
  .then(personnel => {
    res.json(personnel)
  })
}