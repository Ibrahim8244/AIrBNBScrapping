const chrome  = require('puppeteer-extra')
const lodash = require('lodash')
const fs = require('fs')
const AdmZip = require('adm-zip')
const moment = require('moment')
const TIMEOUT_LIMIT_COUNT = 40
const browserOpts = {
  headless: false,
  ignoreHTTPSErrors: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
}

// filter data fields should not be empty
const filtersData = {
  city: 'Lahore',
  check_in: "2022-12-13",  // dates should be in YYYY-MM-DD format
  check_out: "2022-12-14",
  adults: 2,
  children: 0
}
const root = process.cwd()
const glob = {}
const getUrlWithCityAndGuests = (city, adults, children) =>
  `https://www.airbnb.com/s/${city}/homes?tab_id=home_tab&price_filter_input_type=0query=${city}&adults=${adults}&children=${children}`
const specificDatelUrlWithFilters = (listingId, adults, children, check_in, check_out) =>
  `https://www.airbnb.com/rooms/${listingId}?adults=${adults}&children=${children}&check_in=${check_in}&check_out=${check_out}`
module.exports =  { filtersData, getUrlWithCityAndGuests, glob, browserOpts, root, chrome, lodash, fs, AdmZip, moment, TIMEOUT_LIMIT_COUNT, specificDatelUrlWithFilters }
