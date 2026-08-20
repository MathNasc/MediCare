import re

with open('src/screens/ProfileScreen.jsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "() => import('@/screens/StockHistoryScreen')" in line:
        continue
    new_lines.append(line)

with open('src/screens/ProfileScreen.jsx', 'w') as f:
    f.writelines(new_lines)
