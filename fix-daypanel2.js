const fs = require('fs');
let code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

const regex = /<\/div>\s*<div>\s*\{\/\* Resumo mensal \*\/\}/g;
if (regex.test(code)) {
  console.log("Matched the broken part!");
} else {
  console.log("Not matched");
}
