const fs = require('fs');
let code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

// The end of the file looks like:
//       </div>
//       </div>
//       {selected && (
//         <DayPanel ... />
//       )}
//       ...
//     </div>
//   );
// }

// The problem is that CalendarScreen's main container was prematurely closed, and some random divs appeared.
// Let's replace the broken parts manually.

// 1. Remove the weird "</div> </div> <div>" before Resumo mensal
code = code.replace(/<\/div>\s*<\/div>\s*<div>\s*\{\/\* Resumo mensal \*\/\}/g, '{/* Resumo mensal */}');

// 2. Remove the weird "</div> </div>" before Painel do dia selecionado
code = code.replace(/\{\/\* Painel do dia selecionado \*\/\}\s*<\/div>\s*<\/div>\s*\{selected && \(/g, '{/* Painel do dia selecionado */}\n      {selected && (');

fs.writeFileSync('src/screens/CalendarScreen.jsx', code);
console.log("Fixed CalendarScreen ending tags");
