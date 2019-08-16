exports.getAirtableRecords = (table, options) => {
  let records = [],
    params = {
      view: 'Default',
      pageSize: 100,
    }
  Object.assign(params, options)

  return new Promise((resolve, reject) => {
    if (records.length > 0) {
      resolve(records)
    }

    const processPage = (partialRecords, fetchNextPage) => {
      records = [...records, ...partialRecords]
      fetchNextPage()
    }

    const processRecords = (err) => {
      if (err) {
        reject(err)
        return
      }

      resolve(records)
    }

    table.select(params).eachPage(processPage, processRecords)
  })
}