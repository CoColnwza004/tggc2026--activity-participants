Print versions of the register-site posters (repo CoColnwza004/register-site-tggc2026, posters/source/).
Changes vs that repo: 3-column "วิธีลงทะเบียน" layout, teachers-only wording (matches the live site),
print PDFs at 2× A4 (A2) with 4× background and high-res QR.
Run from a checkout of the register repo: copy these two files into posters/source/, then
  OUT=<dir> node posters/source/guide.js
  OUT=<dir> node posters/source/promo-long.js
