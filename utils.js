const { root, fs, AdmZip, moment  } = require('./constants.js')
const removeFileIfExists = path => fs.existsSync(path) && fs.unlinkSync(path)

const handleDir = (dir, status = 'both') => {
  if (['both', 'remove'].includes(status) && fs.existsSync(dir)) fs.rmdirSync(dir, { recursive: true })
  if (['both', 'create'].includes(status) && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const makeDirStructure = () =>
  ['/public/sessions/'].forEach(
    dir => handleDir(root + dir, 'create')
  )

const createZipArchive = (file, path) => {
  const zip = new AdmZip()
  zip.addLocalFolder(path)
  zip.writeZip(file)
}

const extractArchive = (filepath, dir) => {
  const zip = new AdmZip(filepath)
  const outputDir = root + dir
  zip.extractAllTo(outputDir)
}

const getDaysArray = function (s, e) {
  for (var a = [], d = new Date(s); d <= new Date(e); d.setDate(d.getDate() + 1)) {
    a.push(new Date(d))
  }
  return a
}


const getDateRangeBetweenDates = (fistDate, lastDate) =>
  getDaysArray(new Date(fistDate), new Date(lastDate)).map(x => moment(x).format('YYYY-MM-DD'))

  const parseText = (str, regex, step) => {
    try {
      return str.match(regex)[step]
    } catch (err) {
      return ''
    }
  }

module.exports =  { getDateRangeBetweenDates, makeDirStructure, handleDir, createZipArchive, extractArchive, removeFileIfExists, parseText }
