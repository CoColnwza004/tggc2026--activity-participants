Print versions of the register-site posters (repo CoColnwza004/register-site-tggc2026, posters/source/).
Changes vs that repo: 3-column "วิธีลงทะเบียน" layout, teachers-only wording (matches the live site),
print: DSF=6.25 renders a 4963×7019 PNG, flattened with scripts/flat-pdf.py (A2, 300 dpi).
Run from a checkout of the register repo: copy these two files into posters/source/, then
  DSF=6.25 OUT=<dir> node posters/source/guide.js
  DSF=6.25 OUT=<dir> node posters/source/promo-long.js
