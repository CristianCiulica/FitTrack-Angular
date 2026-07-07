const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

  console.log('Navigating to http://localhost:4200/running ...');
  try {
    await page.goto('http://localhost:4200/running', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log('Current URL:', page.url());
    const content = await page.content();
    if (content.includes('Live map')) {
      console.log('Running page loaded successfully!');
    } else {
      console.log('Running page did not load correctly.');
    }
  } catch (e) {
    console.log('Navigation failed:', e.message);
  }

  await browser.close();
})();
