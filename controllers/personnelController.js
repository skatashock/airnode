const Airtable = require('airtable')
const Bottleneck = require('bottleneck')
const data = require('./dataController')
const dotenv = require('dotenv')
const departmentController = require('./departmentController')

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

const TABLE = base('Personnel')
const OPTIONS = {
  view: 'Default',
  filterByFormula: "NOT({Name} = '')",
  pageSize: 100,
  fields: [
    'Name',
    'Title',
    'Department',
    'Photo',
  ]
}

const getDepartments = async () => {
  const departments = {}
  const departmentsData = await departmentController.generateDepartments()
  departmentsData.forEach(function (department) {
    departments[department.id] = department.name
  })

  return departments
}

const getPersonnels = async (page) => {
  const departments = await getDepartments()
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
        personnelDepartment['id'] = dept
        personnelDepartment['name'] = departments[dept]
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
  const departments = await getDepartments()
  const wrappedRecord = limiter.wrap(data.getAirtableRecord)
  const personnel = await wrappedRecord(TABLE, id)

  let photoURL
  if (personnel.get('Photo')) {
    photoURL = personnel.get('Photo')[0].thumbnails.large.url
  }

  let personnelDepartments = []
  if (personnel.get('Department')) {
    const depts = personnel.get('Department')
    let personnelDepartment = {}

    depts.forEach(function (dept) {
      personnelDepartment['id'] = dept
      personnelDepartment['name'] = departments[dept]
    })

    personnelDepartments.push(personnelDepartment)
  }

  let reportingTos = []
  if (personnel.get('Reporting To')) {
    const personnels = await getPersonnelsByIds(personnel.get('Reporting To'))
    reportingTos = personnels
    // let reportingTo = {}

    // personnels.forEach(function (personnel) {
    //   reportingTo['id'] = personnel.id
    //   reportingTo['name'] = personnel.name
    // })

    // reportingTos.push(reportingTo)
    // console.log(reportingTos)
  }

  return {
    id: personnel.getId(),
    name: personnel.get('Name'),
    title: personnel.get('Title'),
    department: personnelDepartments,
    photo: photoURL,
    ssn: personnel.get('Social Security #'),
    address: personnel.get('Home Address'),
    email: personnel.get('Main Email'),
    birthdate: personnel.get('Birthdate'),
    hiredDate: personnel.get('Date of Hire'),
    mobile: personnel.get('Mobile #'),
    reportingTo: reportingTos,
    status: personnel.get('Status'),
    birthday: personnel.get('Birthday')
  }
}

const getPersonnelsByIds = async (ids) => {
  if (ids.length > 0) {
    let filterString = 'OR( '
    ids.forEach((id, index) => {
      filterString += (`RECORD_ID() = '${id}'`)
      if (index < (ids.length - 1)) {          
        filterString += (', ')
      } else {          
        filterString += (')')
      }      
    })
    OPTIONS['filterByFormula'] = filterString
  }
  
  OPTIONS['fields'] = ['Name']
  
  const page = 1
  const wrappedRecords = limiter.wrap(data.getAirtableRecords)
  const personnels = await wrappedRecords(TABLE, OPTIONS)

  const offset = (page * OPTIONS.pageSize) - OPTIONS.pageSize

  return personnels.map(personnel => {
    return {
      id: personnel.getId(),
      name: personnel.get('Name')
    }
  })
  .slice(offset, OPTIONS.pageSize * page)
}

exports.displayPersonnels = async (req, res) => {
  let page = req.params.page || req.query.page || 1

  cache.get('personnels-' + page, () => getPersonnels(page))
  .then(personnels => {
    res.json(personnels)
  })
}

exports.displayPersonnelsByIds = async (ids) => {
  const personnels = await getPersonnelsByIds(ids)
  return personnels

}

exports.displayPersonnel = async (req, res) => {
  const id = req.params.id

  cache.get('personnel-' + id, () => getPersonnelById(id))
  .then(personnel => {
    res.json(personnel)
  })
}