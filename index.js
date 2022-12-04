const { filtersData, getUrlWithCityAndGuests, specificDatelUrlWithFilters, moment, fs, lodash } = require("./constants.js")
const { makeDirStructure, getDateRangeBetweenDates, parseText } = require("./utils.js")
const {
  getVisibilities,
  sleep,
  someVisible,
  clickAndWaitForNavigation,
  everyVisible,
  secureGoto,
  getAttr,
  isHidden,
  secure$x,
  isBlankPage,
  waitForSelectors,
  clickSelector,
  isVisible,
  typeInInput,
  getText,
  clickXpath,
  getXPathText,
  fillField,
  secureWaitForNavigation,
  waitForSpinner,
  typeInput,
  throwErr,
  secure$$,
  isPresent,
  getMainPage,
  startBrowser,
  windUp,
} = require("./pagesFunctions.js")

const { uniq } = lodash
const getCommentReviews = async page => {
  if (await isHidden(page, 'button[aria-label*="reviews."]')) return []
  await clickAndWaitForNavigation(page, 'button[aria-label*="reviews."]')
  const reviews = []
  const selectors = await secure$$(page, 'div[data-testid*="reviews-modal"] > div > div:nth-child(2)')
  for (const selector of selectors) {
    const text = await getText(selector, "div")
    reviews.push(text)
  }
  await clickAndWaitForNavigation(page, 'button[aria-label="Close"]')
  return reviews
}
const getRatesAccordingToDate = async (id, page, dates, filters) => {
  const obj = {}
  for (const date of dates) {
    const url = specificDatelUrlWithFilters(
      id,
      filters.adults,
      filters.children,
      date,
      moment(date).add(1, "days").format("YYYY-MM-DD"),
    )
    await secureGoto(page, url)
    await sleep(2)
    let rate = (await getText(page, 'div[style*="display-price"] > div > span > span'))
    rate = parseText(rate, /(\d+)[^\d]+per/, 1)
    const issue = await getText(page, 'div[id="bookItTripDetailsError"]')
    obj[date] = {
      rate: rate,
    }
    obj[date].availability = true
    if (issue) {
      obj[date].issue = issue
      obj[date].availability = false
    }
    if (!rate) {
      obj[date].rate = "NA"
      obj[date].issue = "Rates are not available"
      obj[date].availability = false
    }
  }
  return obj
}
const getThingsToKnow = async page => {
  const obj = {}
  let text = ""
  let selectors = await secure$$(
    page,
    'div[data-section-id="POLICIES_DEFAULT"] > div:nth-child(1)> div:nth-child(2) > div:nth-child(1) > div > div > div > div',
  )
  for (const selector of selectors) {
    text = text + (await getText(selector, "div")) + ". "
  }
  obj.house_rules = text.replace(". ", "").replace(" . ", "")
  text = ""
  selectors = await secure$$(
    page,
    'div[data-section-id="POLICIES_DEFAULT"] > div:nth-child(1)> div:nth-child(2) > div:nth-child(2) > div > div > div > div',
  )
  for (const selector of selectors) {
    text = text + (await getText(selector, "div")) + ". "
  }
  obj.safety_and_property = text.replace(". ", "").replace(" . ", "")
  text = ""
  selectors = await secure$$(
    page,
    'div[data-section-id="POLICIES_DEFAULT"] > div:nth-child(1)> div:nth-child(2) > div:nth-child(3) > div > div',
  )
  for (const selector of selectors) {
    text = text + (await getText(selector, "span")) + ". "
  }
  obj.cancellation_policy = text.replace(". ", "").replace(" . ", "")
  return obj
}
const getAmenities = async page => {
  let text = ""
  let selectors = await secure$$(page, 'div[data-section-id="AMENITIES_DEFAULT"] > section > div:nth-child(3) > div')
  for (const selector of selectors) {
    text = text + (await getText(selector, "div")) + ", "
  }
  return text
}

const getAllDataOfProperty = async (page, id, dates, filters) => {
  let text = await getText(page, 'div[data-section-id="OVERVIEW_DEFAULT"]')
  const propertyData = {}
  propertyData.listing_id = id
  propertyData.listing_name = parseText(text, /^(\D*)(\d+)(\D*)/, 1) || "NA"
  propertyData.no_of_guests = parseText(text, /(\d+)[^\d]+guest/, 1) || "NA"
  propertyData.no_of_bedrooms = parseText(text, /(\d+)[^\d]+bedroom/, 1) || "NA"
  propertyData.no_of_beds = parseText(text, /(\d+)[^\d]+bed/, 1) || "NA"
  propertyData.no_of_bathrooms = parseText(text, /(\d+)[^\d]+bath/, 1) || "NA"
  text = await getAttr(page, 'button[aria-label*=" reviews."]', "aria-label")
  propertyData.no_of_reviews = parseText(text, /(\d+)[^\d]+reviews/, 1) || "NA"
  propertyData.avg_rating_stars = parseText(text, /[+-]?([0-9]*[.])?[0-9]+/, 0) || "NA"
  const commentReviews = await getCommentReviews(page)
  propertyData.comment_reviews = commentReviews?.length ? commentReviews : "NA"
  propertyData.things_to_know = await getThingsToKnow(page)
  propertyData.amenities = await getAmenities(page)
  if (await isVisible(page, 'div[data-plugin-in-point-id="DESCRIPTION_DEFAULT"] > div:nth-child(2) > button')) {
    await clickAndWaitForNavigation(
      page,
      'div[data-plugin-in-point-id="DESCRIPTION_DEFAULT"] > div:nth-child(2) > button',
    )
    await sleep(1)
    propertyData.property_description = await getText(
      page,
      'div[data-section-id="DESCRIPTION_MODAL"] > section >div:nth-child(3) > div > span',
    )
    propertyData.property_description = propertyData.property_description || "NA"
    await clickAndWaitForNavigation(page, 'button[aria-label="Close"]')
  } else propertyData.property_description = "NA"
  propertyData.rates_avalability = await getRatesAccordingToDate(id, page, dates, filters)
  return propertyData
}

const getPropertiesIds = async page => {
  const ids = []
  let i = 1
  do {
    const arr = await secure$$(page, 'div[aria-labelledby*="title"]')
    for (const node of arr) {
      const idAttr = await getAttr(node, 'a[target*="listing"]', "target")
      if (idAttr) {
        ids.push(idAttr.replace("listing_", ""))
      }
    }
    console.log(`taking listings ids from page -> ${i}`)
    i++
    await clickAndWaitForNavigation(page, 'a[aria-label="Next"]')
    await sleep(1)
  } while (
    (await isVisible(page, 'button[aria-label="Previous"]')) &&
    (await isHidden(page, '[aria-disabled="true"] + [aria-label="Next"]'))
  )
  return ids
}

(async () => {
  try {
    makeDirStructure()
    let page
    await startBrowser()
    page = await getMainPage()
    await secureGoto(page, getUrlWithCityAndGuests(filtersData.city, filtersData.adults, filtersData.children))
    if (!(await secure$$(page, 'div[aria-labelledby*="title"]')).length) {
      throwErr({ message: "no data found for required city or guest" })
    }
    const allPropertyData = []
    console.log('getting the property ids....')
    const propertyIDs = await getPropertiesIds(page)
    if (!propertyIDs.length) {
      throwErr({ message: "no listing ids found for properties" })
    }
    let length = propertyIDs.length
    console.log(`total properties ->`, propertyIDs.length)
    const dateRange = getDateRangeBetweenDates(filtersData.check_in, filtersData.check_out)
    for (const id of uniq(propertyIDs).slice(0, 3)) {
      console.log(`parsing data for listing id ->`, id)
      const url = specificDatelUrlWithFilters(
        id,
        filtersData.adults,
        filtersData.children,
        dateRange[0],
        moment(dateRange[0]).add(1, "days").format("YYYY-MM-DD"),
      )
      await secureGoto(page, url)
      await sleep(5)
      const data = await getAllDataOfProperty(page, id, dateRange, filtersData)
      console.log(`data parsed for listing id ->`, id)
      length = length - 1
      console.log('remaining items needs to be parsed -> ', length)
      allPropertyData.push(data)
    }
    console.log('---------script is completed--------')
    fs.writeFile("myjsonfile.json", JSON.stringify(allPropertyData), function (err) {
      if (err) throw err
      console.log("complete")
    })
    await windUp()
  } catch (err) {
    await windUp()
    console.log(err)
  }
})()
