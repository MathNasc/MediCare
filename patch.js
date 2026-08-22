const fs = require('fs');
const content = fs.readFileSync('supabase/functions/send-medication-reminders/index.ts', 'utf8');

let newContent = content.replace(
  "nowLocal = new Date(`${map.year}-${map.month}-${map.day}T${map.hour === '24' ? '00' : map.hour}:${map.minute}:${map.second}`);",
  `nowLocal = new Date(\`\${map.year}-\${map.month}-\${map.day}T\${map.hour === '24' ? '00' : map.hour}:\${map.minute}:\${map.second}Z\`);`
);

// We need to insert the boundary calculations after `const dayOfWeek = ...`
const injectionPoint = "const dayOfWeek = nowLocal.getUTCDay() === 0 ? 7 : nowLocal.getUTCDay();";

// Wait, the original code is: `const dayOfWeek = nowLocal.getDay() === 0 ? 7 : nowLocal.getDay();`
// We should change getDay to getUTCDay since nowLocal is parsed with Z.
newContent = newContent.replace(
  "const dayOfWeek = nowLocal.getDay() === 0 ? 7 : nowLocal.getDay();",
  `const dayOfWeek = nowLocal.getUTCDay() === 0 ? 7 : nowLocal.getUTCDay();
        const offsetMs = now.getTime() - nowLocal.getTime();
        const startOfDayFakeUTC = new Date(nowLocal);
        startOfDayFakeUTC.setUTCHours(0,0,0,0);
        const startOfDayUTC = new Date(startOfDayFakeUTC.getTime() + offsetMs).toISOString();
        const endOfDayFakeUTC = new Date(nowLocal);
        endOfDayFakeUTC.setUTCHours(23,59,59,999);
        const endOfDayUTC = new Date(endOfDayFakeUTC.getTime() + offsetMs).toISOString();`
);

// We also need to change `doseTime.setHours` to `doseTime.setUTCHours` to avoid any local timezone issues
newContent = newContent.replace(
  "doseTime.setHours(h, m, 0, 0);",
  "doseTime.setUTCHours(h, m, 0, 0);"
);

// Update the query for historico_doses
newContent = newContent.replace(
  ".gte('created_at', `${todayISO}T00:00:00Z`)",
  ".gte('created_at', startOfDayUTC)"
);
newContent = newContent.replace(
  ".lte('created_at', `${todayISO}T23:59:59Z`)",
  ".lte('created_at', endOfDayUTC)"
);

// Same for events
newContent = newContent.replace(
  "nowLocal = new Date(`${map.year}-${map.month}-${map.day}T${map.hour === '24' ? '00' : map.hour}:${map.minute}:${map.second}`);",
  `nowLocal = new Date(\`\${map.year}-\${map.month}-\${map.day}T\${map.hour === '24' ? '00' : map.hour}:\${map.minute}:\${map.second}Z\`);`
);

fs.writeFileSync('supabase/functions/send-medication-reminders/index.ts', newContent);
