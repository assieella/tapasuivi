// Adresse publique du site, utilisée dans les liens des e-mails (confirmation, nouvelle étude, etc.).
// Si la variable APP_URL de Railway est absente ou mal écrite (ex. « http:/ »), on retombe sur l'adresse
// officielle : un lien d'e-mail ne doit jamais partir sans adresse de site.
const DEFAUT = 'https://www.tapa-invest.com';
function appUrl() {
  const v = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\/\s]+\.[^\/\s]+/.test(v)) return DEFAUT;
  // L'adresse sans « www » n'est pas servie en https (limite de la redirection OVH) : on impose toujours www.
  if (/^https?:\/\/tapa-invest\.com$/i.test(v)) return DEFAUT;
  return v;
}
module.exports = { appUrl };
