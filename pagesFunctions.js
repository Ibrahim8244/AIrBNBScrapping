
const { glob, browserOpts, root, chrome, TIMEOUT_LIMIT_COUNT } = require('./constants.js')

const stealthPlugin = require('puppeteer-extra-plugin-stealth')
chrome.use(stealthPlugin())
chrome.use(stealthPlugin())
const isTimeoutLimitReached = () =>
  [glob.contextErrorCount, glob.navigationErrorCount].some(count => count > TIMEOUT_LIMIT_COUNT)

browserOpts.userDataDir = `${root}/public/sessions`
const startBrowser = async () => (glob.browser = await chrome.launch(browserOpts))
const closeBrowser = () => glob.browser?.close()

const getMainPage = async () => {
  const pages = await glob.browser.pages()
  for (const page of pages.slice(1)) await page.close()
  const [page] = pages
  return page
}

const   getVisibilities = (page, selectors) => Promise.all(selectors.map(x => isVisible(page, x)))
const sleep = (secs = 1) => new Promise(resolve => setTimeout(resolve, secs * 1000))
const someVisible = async (page, selectorsArr) => {
  const visibilities = await getVisibilities(page, selectorsArr)
  return visibilities.some(x => x)
}

const byLine = (func, msgs) => console.log(msgs)
const print = (...msg) => byLine(console.log(msg))

const clickXpath = async (page, xpath) => {
  try {
    const [node] = await secure$x(page, xpath)
    await node.click()
  } catch (err) {
    print({ clickXpath: { selector: xpath, msg: err.message } })
    return false
  }
}

const windUp = () => closeBrowser()

const clickAndWaitForNavigation = async (page, selector, opts = {}) => {
  if (opts.shouldWait === undefined) opts.shouldWait = true
  if (opts.shouldWait) await page.waitForSelector(selector, { visible: true, timeout: opts.timeout || 30000 })
  await sleep()
  await handleContextErr(async () => {
    await page.click(selector)
    await sleep(3)
  }, 'clickAndWaitForNavigation')
}

const everyVisible = async (page, selectorsArr) => {
  const visibilities = await getVisibilities(page, selectorsArr)
  return visibilities.every(x => x)
}
const secureGoto = async (page, url) => {
  const waitOpts = ['networkidle2', 'networkidle0', 'domcontentloaded', 'load']

  while (waitOpts.length > 0) {
    try {
      const returnedPage = await page.goto(url, { waitUntil: waitOpts.shift(), timeout: 10000 })
      return returnedPage
    } catch (err) {
      console.log('secureGoto:', err, 'url:', url)
    }
  
  }
}
const getAttr = async (node, selector, attr, hideLogs) => {
  try {
    return await secure$eval(node, selector, (el, attribute) => el.getAttribute(attribute), attr)
  } catch (err) {
    if (!hideLogs) print({ getAttr: { selector, msg: err.message } })
    return ''
  }
}

const isHidden = async (page, selector) => !(await isVisible(page, selector))
const isNavigationError = err => {
  const errStatus = err.message.includes('Navigation timeout of')
  if (errStatus) glob.navigationErrorCount++
  return errStatus
}
const secure$x = async (node, selector) => handleContextErr(() => node.$x(selector), 'secure$x')
const isBlankPage = async page => {
  try {
    const html = await page.content()
    return html.replace(/\s+/g, '').includes('<body></body>')
  } catch (err) {
    console.log('failed to save html page,', err)
  }
}
const waitForSelectors = async (page, selectors, opts = {}) => {
  try {
    return await page.waitForSelector(selectors, { visible: true, timeout: 10000 })
  } catch (err) {
    if ((!opts.tryNo || opts.tryNo < 3) && (await isBlankPage(page))) {
      console.log('BLANK PAGE has come, reloading page')
      await page.reload()
      return await waitForSelectors(page, selectors, { ...opts, tryNo: (opts.tryNo || 0) + 1 })
    }
    print('could not find selectors in waitForSelectors', selectors)
    throw new Error(err.message)
  }
}
const clickSelector = async (node, selector) => {
  try {
    await secure$eval(node, selector, el => el.click())
    return true
  } catch (err) {
    print({ clickSelector: { selector, msg: err.message } })
    return false
  }
}
const isContextError = err => {
  const errStatus = err.message.includes('Execution context was destroyed')
  if (errStatus) return errStatus
}
const isVisible = async (page, selector) =>
  await handleContextErr(async () => {
    const elements = selector[0] === '/' ? await page.$x(selector) : await page.$$(selector)
    if (!elements.length) return false
    const visibilities = await Promise.all(elements.map(el => el.boundingBox()))
    return visibilities.some(x => x)
  }, 'isVisible')
const handleContextErr = async (func, funcName, noOfTries = 5) => {
  let retries = 0
  while (retries < noOfTries) {
    retries++
    try {
      return await func()
    } catch (err) {
      if (isContextError(err)) {
        print(`${funcName}:`, err.message)
        print(`retry-${retries} in 10 secs`)
        await sleep(10)
        continue
      } else throw new Error(`${err.message}, function:${funcName}`)
    }
  }
  throw new Error(`${funcName}: contextError after ${noOfTries} retries`)
}
const typeInInput = async (page, selector, value) => {
  if (value === undefined) {
    const error = { status: 400, errors: [`value is undefined for selector ${selector}`] }
    throw error
  }

  await sleep()
  await secureEvaluate(page, selector => (document.querySelector(selector).value = ''), selector)

  await sleep()
  return secureEvaluate(page, (selector, value) => (document.querySelector(selector).value = value), selector, value)
}
const secureEvaluate = async (page, func, ...args) =>
  await handleContextErr(() => page.evaluate(func, ...args), 'secureEvaluate')
const secure$$ = async (node, selector) => handleContextErr(() => node.$$(selector), 'secure$$')
const secure$ = async (node, selector) => handleContextErr(() => node.$(selector), 'secure$')
const isPresent = async (page, selector) => (await secure$(page, selector)) !== null
const secure$eval = async (node, selector, func, ...args) =>
  await handleContextErr(() => node.$eval(selector, func, ...args), 'secure$eval')
const getText = async (node, selector, hideLogs) => {
  try {
    return (await secure$eval(node, selector, el => el.textContent))?.toString().trim()
  } catch (err) {
    return ''
  }
}

const getXPathText = async (page, xpath) => {
  const [node] = await secure$x(page, xpath)
  if (node) {
    await sleep()
    const text = await secureEvaluate(page, td => td.textContent, node)
    return text.trim()
  } else {
    return ''
  }
}


const fillField = async (page, selector, val) => {
  await typeInInput(page, selector, val)
  try {
    await sleep()
    const value = await secure$eval(page, selector, el => el.value)
    if (value !== val) await typeInInput(page, selector, val)
  } catch (e) {
    return ''
  }
}
const secureWaitForNavigation = async page => {
  try {
    await page.waitForNavigation({ waitUntil: 'load', timeout: 10000 })
    return
  } catch (err) {
    print('secureWaitForNavigation:', err.message)
    if (!(isContextError(err) || isNavigationError(err))) throw err
  }
  if (isTimeoutLimitReached()) throw new Error('Timeout Error While Navigating')
}

const waitForSpinner = async (page, showNote = false) => {
  if (showNote) print('waiting for spinner to hide')
  await page.waitForSelector('#first-pipeline-load-page-spinner', { hidden: true, timeout: 6000 })
  await page.waitForSelector('#spinner-anchor', { hidden: true, timeout: 120000 })
}
const typeInput = async (page, selector, text) => {
  await secureEvaluate(page, selector => (document.querySelector(selector).value = ''), selector)
  await sleep()
  await page.type(selector, toString(text), { delay: 100 })
}


const throwErr = obj => {
  glob.error = obj
  throw obj
}

module.exports = {
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
  getXPathText,
  fillField,
  secureWaitForNavigation,
  waitForSpinner,
  typeInput,
  throwErr,
  getMainPage,
  startBrowser,
  isPresent,
  secure$$,
  clickXpath,
  windUp
};