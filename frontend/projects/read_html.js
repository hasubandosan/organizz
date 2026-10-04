const fs = require('fs');
const lines = fs.readFileSync('C:/Users/y2katbat/Desktop/my projs/life os modules/projects/index.html', 'utf8').split('\n');
console.log('Total lines:', lines.length);
console.log(lines.slice(1090, 1135).join('\n'));
