function formatYYYYMMDD(date) { return date.toISOString().slice(0, 10).replace(/-/g, ''); }
function prochainJour15(depuis = new Date()) {
  let d = new Date(depuis.getFullYear(), depuis.getMonth(), 15);
  if (d < depuis) d.setMonth(d.getMonth() + 1);
  return d;
}
function lendemain(date) { const d = new Date(date); d.setDate(d.getDate() + 1); return d; }

function construireLienGoogleCalendar({ date_fin, titre, description }) {
  const debut = prochainJour15();
  const fin = lendemain(debut);
  const until = new Date(date_fin).toISOString().slice(0, 10).replace(/-/g, '') + 'T235959Z';
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: titre,
    dates: `${formatYYYYMMDD(debut)}/${formatYYYYMMDD(fin)}`,
    recur: `RRULE:FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=${until}`,
    details: description
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function construireFichierICS({ date_fin, titre, description, uid }) {
  const debut = prochainJour15();
  const fin = lendemain(debut);
  const until = new Date(date_fin).toISOString().slice(0, 10).replace(/-/g, '') + 'T235959Z';
  const maintenant = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TAPA CONSEIL//Suivi BRVM//FR', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${uid}@tapaconseil.com`, `DTSTAMP:${maintenant}`,
    `DTSTART;VALUE=DATE:${formatYYYYMMDD(debut)}`, `DTEND;VALUE=DATE:${formatYYYYMMDD(fin)}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=${until}`, `SUMMARY:${titre}`, `DESCRIPTION:${description}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
}
module.exports = { construireLienGoogleCalendar, construireFichierICS, prochainJour15 };
