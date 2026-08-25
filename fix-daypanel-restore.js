const fs = require('fs');
let code = fs.readFileSync('src/screens/CalendarScreen.jsx', 'utf8');

// I will fix the end of DayPanel manually, and fix the end of CalendarScreen manually.

// Find DayPanel end:
// It should be right before "export function CalendarScreen"
let parts = code.split('export function CalendarScreen');
if (parts.length === 2) {
  let dayPanelPart = parts[0];
  let calendarPart = parts[1];
  
  // Fix DayPanel part
  dayPanelPart = dayPanelPart.replace(/<\/div>\s*<\/div>\s*<\/div>\s*\);\s*$/, '</div>\n    </div>\n  );\n}\n\n');
  
  // Fix CalendarScreen part
  // calendarPart should end with:
  //      )}
  //    </div>
  //  );
  //}
  calendarPart = calendarPart.replace(/<\/div>\s*<\/div>\s*\{selected && \(/, '      {selected && (');
  calendarPart = calendarPart.replace(/<\/div>\s*<div>\s*\{\/\* Resumo mensal \*\/\}/, '      {/* Resumo mensal */}');
  
  // Actually, wait, let's see how much got mangled in CalendarScreen
}
