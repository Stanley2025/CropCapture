'use strict';
/** Years offered by the date picker, newest first. */

/** Date of birth: every year from 1920 to the current year, so any farmer's birth year can be chosen. */
const DOB_FIRST_YEAR = 1920;

function yearsForPicker(isDob, now = new Date()) {
  const current = now.getFullYear();
  const start = isDob ? DOB_FIRST_YEAR : current - 20;
  const end = isDob ? current : current + 5;
  const years = [];
  for (let y = end; y >= start; y--) years.push(y);
  return years;
}

module.exports = { yearsForPicker, DOB_FIRST_YEAR };
