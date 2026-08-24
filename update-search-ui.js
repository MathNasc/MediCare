const fs = require('fs');
const code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

const regexUi = /<div key=\{r\.id\} onClick=\{.*? \/>\n.*?</p>\n.*?</p>\n.*?<\/div>/s;
// Let's use string replace instead of regex for the render to be safe.
