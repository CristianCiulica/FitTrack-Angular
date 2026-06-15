const fs = require('fs');
const json = JSON.parse(fs.readFileSync('angular.json', 'utf8'));
const build = json.projects['fit-track-angular'].architect.build;
if (!build.options.polyfills) {
  build.options.polyfills = ['zone.js'];
} else if (!build.options.polyfills.includes('zone.js')) {
  build.options.polyfills.push('zone.js');
}
fs.writeFileSync('angular.json', JSON.stringify(json, null, 2));
console.log('Done!');
