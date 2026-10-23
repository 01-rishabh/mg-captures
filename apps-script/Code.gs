/**
 * Studio booking: stores consultation requests in this Google Sheet and alerts the owner
 * on WhatsApp (CallMeBot) and as a phone push notification (ntfy).
 *
 * Setup (once): Extensions > Apps Script, replace everything with this file, fill in the
 * settings below, Save, run `setup` once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Full steps are in README.md.
 */

// ---- Settings -----------------------------------------------------------------------

var STUDIO_NAME = 'MG Captures';

// Owner's WhatsApp number with country code, e.g. '+919876543210'.
var OWNER_WHATSAPP = '';
// Key that CallMeBot sends back after the one-time activation message (README step 2).
var CALLMEBOT_APIKEY = '';

// ntfy topic the owner subscribed to in the ntfy app. Use a long random name: anyone who
// knows it can read the notifications.
var NTFY_TOPIC = '';
var NTFY_SERVER = 'https://ntfy.sh';
// Optional ntfy access token (free account) for higher rate limits. Leave '' if unused.
var NTFY_TOKEN = '';

// Optional: backup copy of every lead by email. Leave '' to turn off.
var OWNER_EMAIL = '';
// Send the lead a "request received" email when they gave an address.
var EMAIL_LEAD = true;

// Remind the owner about leads still "New" after this many hours, outside quiet hours.
var NUDGE_AFTER_HOURS = 2;
var QUIET_FROM_HOUR = 22;
var QUIET_UNTIL_HOUR = 8;

// Optional: if set, Cal.com webhooks must call the web app URL with ?key=<this value>.
var CAL_WEBHOOK_KEY = '';

// ---- Sheet layout -------------------------------------------------------------------

var SHEET_NAME = 'Leads';
var COLUMNS = ['Lead ID', 'Received', 'Status', 'Name', 'WhatsApp', 'Email', 'Shoot Type', 'Event Date',
  'Location', 'Budget', 'Consult Via', 'Consult Date', 'Consult Time', 'Message', 'Source', 'Campaign',
  'WA Sent', 'Push Sent', 'Last Nudge', 'Notes'];
var STATUSES = ['New', 'Contacted', 'Consultation', 'Quote sent', 'Booked', 'Delivered', 'Lost'];
var STATUS_COLORS = { New: '#fde68a', Contacted: '#bfdbfe', Consultation: '#c7d2fe', 'Quote sent': '#e9d5ff',
  Booked: '#bbf7d0', Delivered: '#d1d5db', Lost: '#fecaca' };
var MAX_VALUE_LENGTH = 1000;

// ---- Web app ------------------------------------------------------------------------

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var lead;

    if (body.triggerEvent) {
      if (CAL_WEBHOOK_KEY && (e.parameter || {}).key !== CAL_WEBHOOK_KEY) return json_({ ok: false, error: 'Bad key' });
      if (body.triggerEvent === 'BOOKING_CANCELLED') {
        var p = body.payload || {};
        var who = ((p.attendees || [])[0] || {}).name || 'A client';
        notifyAll_('Booking cancelled', who + ' cancelled "' + (p.title || 'consultation') + '" on ' + formatWhen_(p.startTime), 3, null);
        return json_({ ok: true });
      }
      if (body.triggerEvent !== 'BOOKING_CREATED' && body.triggerEvent !== 'BOOKING_RESCHEDULED') return json_({ ok: true, ignored: true });
      lead = fromCalcom_(body.payload || {}, body.triggerEvent);
    } else {
      lead = body.data;
      if (!lead || typeof lead !== 'object') return json_({ ok: false, error: 'No data received' });
      if (lead.company) return json_({ ok: true, leadId: '' }); // honeypot filled: a bot
      if (!String(lead.name || '').trim() || !String(lead.whatsapp || '').replace(/\D/g, '')) {
        return json_({ ok: false, error: 'Name and WhatsApp number are required' });
      }
      lead.status = 'New';
    }

    var saved = appendLead_(lead);
    notifyNewLead_(saved.row);
    emailLead_(saved.id, lead);
    return json_({ ok: true, leadId: saved.id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  }
}

// Opening the web app URL in a browser shows this, which confirms the deployment works.
function doGet() {
  return json_({ ok: true, message: STUDIO_NAME + ' booking endpoint is running.' });
}

// ---- Run these from the Apps Script editor -------------------------------------------

// Creates the sheet layout and the triggers, then sends a test alert to every channel.
function setup() {
  var sheet = getSheet_();
  var header = sheet.getRange(1, 1, 1, COLUMNS.length);
  header.setValues([COLUMNS]).setFontWeight('bold').setBackground('#f4f4f5');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  var statusCol = COLUMNS.indexOf('Status') + 1;
  var statusRange = sheet.getRange(2, statusCol, sheet.getMaxRows() - 1, 1);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
  sheet.setConditionalFormatRules(STATUSES.map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(STATUS_COLORS[s])
      .setRanges([statusRange]).build();
  }));

  ['onStatusEdit', 'nudgeStaleLeads'].forEach(deleteTriggers_);
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger('nudgeStaleLeads').timeBased().everyMinutes(30).create();

  testNotifications();
}

function testNotifications() {
  var url = SpreadsheetApp.getActive().getUrl();
  var wa = sendWhatsApp_('✅ ' + STUDIO_NAME + ': WhatsApp alerts are working.\nSheet: ' + url);
  var push = sendPush_({ title: STUDIO_NAME + ' alerts are working', message: 'Tap to open the leads sheet.', priority: 3, click: url });
  console.log('WhatsApp: ' + (wa === null ? 'not set up (fill OWNER_WHATSAPP and CALLMEBOT_APIKEY)' : channelStatus_(wa)));
  console.log('Push: ' + (push === null ? 'not set up (fill NTFY_TOPIC)' : channelStatus_(push)));
}

// ---- Triggers -----------------------------------------------------------------------

// Installable onEdit (created by setup): a status change made in the Sheets app
// or by a team member is pushed to the owner's phone.
function onStatusEdit(e) {
  var range = e && e.range;
  if (!range || range.getSheet().getName() !== SHEET_NAME || range.getRow() < 2) return;
  if (range.getNumRows() !== 1 || range.getColumn() !== COLUMNS.indexOf('Status') + 1) return;
  if (!e.value || e.value === e.oldValue) return;

  var lead = readRow_(range.getSheet(), range.getRow());
  sendPush_({
    title: lead['Lead ID'] + ' → ' + e.value,
    message: lead['Name'] + ' · ' + lead['Shoot Type'] + (e.oldValue ? ' (was ' + e.oldValue + ')' : ''),
    priority: 3,
    tags: ['memo'],
    click: rowUrl_(range.getSheet(), range.getRow()),
  });
}

// Time trigger (every 30 min, created by setup): one reminder per lead left in "New".
function nudgeStaleLeads() {
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  var hour = Number(Utilities.formatDate(new Date(), tz, 'H'));
  if (hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR) return;

  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return;
  var values = sheet.getRange(2, 1, last - 1, COLUMNS.length).getValues();
  var c = colIndex_();
  var cutoff = Date.now() - NUDGE_AFTER_HOURS * 3600 * 1000;

  values.forEach(function (v, i) {
    var received = v[c['Received']];
    if (v[c['Status']] !== 'New' || v[c['Last Nudge']] || !(received instanceof Date) || received.getTime() > cutoff) return;
    var row = i + 2;
    var lead = readRow_(sheet, row);
    var text = '⏰ Not contacted yet: ' + lead['Lead ID'] + ' ' + lead['Name'] + ' (' + lead['Shoot Type'] + '), received ' +
      Utilities.formatDate(received, tz, 'd MMM, h:mm a') + '.\nCall: +' + lead['WhatsApp'] + '\nChat: https://wa.me/' + lead['WhatsApp'];
    sendWhatsApp_(text);
    sendPush_({ title: 'Follow up: ' + lead['Lead ID'] + ' ' + lead['Name'], message: 'Still marked New after ' + NUDGE_AFTER_HOURS + 'h.',
      priority: 4, tags: ['alarm_clock'], click: rowUrl_(sheet, row), actions: leadActions_(lead, sheet, row) });
    sheet.getRange(row, c['Last Nudge'] + 1).setValue(new Date());
  });
}

// One-off trigger scheduled when a WhatsApp or push alert fails: tries those once more.
function retryFailedNotifications() {
  deleteTriggers_('retryFailedNotifications');
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return;
  var c = colIndex_();
  var values = sheet.getRange(2, 1, last - 1, COLUMNS.length).getValues();
  values.forEach(function (v, i) {
    var row = i + 2;
    if (v[c['WA Sent']] !== 'FAILED' && v[c['Push Sent']] !== 'FAILED') return;
    var lead = readRow_(sheet, row);
    if (v[c['WA Sent']] === 'FAILED') {
      var wa = sendWhatsApp_(leadWhatsAppText_(lead, sheet, row));
      sheet.getRange(row, c['WA Sent'] + 1).setValue(wa ? 'OK (retry)' : 'FAILED (retry)');
    }
    if (v[c['Push Sent']] === 'FAILED') {
      var push = sendPush_(leadPush_(lead, sheet, row));
      sheet.getRange(row, c['Push Sent'] + 1).setValue(push ? 'OK (retry)' : 'FAILED (retry)');
    }
  });
}

// ---- Leads --------------------------------------------------------------------------

function appendLead_(lead) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var props = PropertiesService.getScriptProperties();
    var next = Number(props.getProperty('lastLeadNo') || 0) + 1;
    props.setProperty('lastLeadNo', String(next));
    var id = 'MG-' + ('000' + next).slice(-4);

    var byHeader = {
      'Lead ID': id, 'Received': new Date(), 'Status': lead.status || 'New', 'Name': clean_(lead.name),
      'WhatsApp': clean_(String(lead.whatsapp || '').replace(/\D/g, '')), 'Email': clean_(lead.email),
      'Shoot Type': clean_(lead.shootType), 'Event Date': clean_(lead.eventDate), 'Location': clean_(lead.location),
      'Budget': clean_(lead.budget), 'Consult Via': clean_(lead.consultMode), 'Consult Date': clean_(lead.consultDate),
      'Consult Time': clean_(lead.consultTime), 'Message': clean_(lead.message), 'Source': clean_(lead.source || 'website'),
      'Campaign': clean_(lead.campaign),
    };
    var sheet = getSheet_();
    sheet.appendRow(COLUMNS.map(function (h) { return byHeader[h] === undefined ? '' : byHeader[h]; }));
    var row = sheet.getLastRow();
    sheet.getRange(row, COLUMNS.indexOf('Received') + 1).setNumberFormat('dd mmm yyyy, h:mm AM/PM');
    return { id: id, row: row };
  } finally {
    lock.releaseLock();
  }
}

function notifyNewLead_(row) {
  var sheet = getSheet_();
  var lead = readRow_(sheet, row);
  var c = colIndex_();
  var wa = sendWhatsApp_(leadWhatsAppText_(lead, sheet, row));
  var push = sendPush_(leadPush_(lead, sheet, row));
  sheet.getRange(row, c['WA Sent'] + 1, 1, 2).setValues([[channelStatus_(wa), channelStatus_(push)]]);
  // Only real failures are retried; a channel that is not set up yet is recorded as OFF.
  if (wa === false || push === false) scheduleRetry_();
}

function channelStatus_(result) {
  if (result === null) return 'OFF';
  return result ? 'OK' : 'FAILED';
}

function leadWhatsAppText_(lead, sheet, row) {
  return [
    '📸 New lead ' + lead['Lead ID'],
    'Name: ' + lead['Name'],
    'Shoot: ' + lead['Shoot Type'] + (lead['Event Date'] ? ' · ' + lead['Event Date'] : '') + (lead['Location'] ? ' · ' + lead['Location'] : ''),
    'Budget: ' + (lead['Budget'] || 'Not sure'),
    'Consultation: ' + [lead['Consult Via'], lead['Consult Date'], lead['Consult Time']].filter(String).join(', '),
    lead['Message'] ? 'Note: ' + lead['Message'] : null,
    'Source: ' + lead['Source'],
    '',
    lead['WhatsApp'] ? 'Call: +' + lead['WhatsApp'] : 'Email: ' + lead['Email'],
    lead['WhatsApp'] ? 'Chat: https://wa.me/' + lead['WhatsApp'] : null,
    'Sheet: ' + rowUrl_(sheet, row),
  ].filter(function (line) { return line !== null; }).join('\n');
}

function leadPush_(lead, sheet, row) {
  return {
    title: 'New lead ' + lead['Lead ID'] + ' · ' + lead['Shoot Type'],
    message: lead['Name'] + '\nConsultation: ' + [lead['Consult Date'], lead['Consult Time']].filter(String).join(', ') +
      '\nBudget: ' + (lead['Budget'] || 'Not sure') + ' · Source: ' + lead['Source'],
    priority: 5,
    tags: ['camera'],
    click: rowUrl_(sheet, row),
    actions: leadActions_(lead, sheet, row),
  };
}

// ntfy allows three buttons per notification.
function leadActions_(lead, sheet, row) {
  if (!lead['WhatsApp']) return [{ action: 'view', label: 'Open sheet', url: rowUrl_(sheet, row) }];
  return [
    { action: 'view', label: 'Call', url: 'tel:+' + lead['WhatsApp'] },
    { action: 'view', label: 'WhatsApp', url: 'https://wa.me/' + lead['WhatsApp'] },
    { action: 'view', label: 'Open sheet', url: rowUrl_(sheet, row) },
  ];
}

function emailLead_(id, lead) {
  var when = [lead.consultDate, lead.consultTime].filter(String).join(', ');
  if (EMAIL_LEAD && lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) {
    MailApp.sendEmail({
      to: lead.email,
      name: STUDIO_NAME,
      subject: 'Consultation request received · ' + STUDIO_NAME,
      body: 'Hi ' + lead.name + ',\n\nThanks for reaching out. We have your ' + (lead.shootType || '') +
        ' consultation request' + (when ? ' for ' + when : '') + '.\nYour reference is ' + id +
        '. We will confirm the time on WhatsApp shortly.\n\n' + STUDIO_NAME,
    });
  }
  if (OWNER_EMAIL) {
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: 'New lead ' + id + ': ' + lead.name + ' (' + (lead.shootType || '') + ')',
      body: Object.keys(lead).map(function (k) { return k + ': ' + lead[k]; }).join('\n') +
        '\n\nSheet: ' + SpreadsheetApp.getActive().getUrl(),
    });
  }
}

function fromCalcom_(p, event) {
  var attendee = (p.attendees || [])[0] || {};
  var r = p.responses || {};
  function answer(key) { return r[key] && typeof r[key] === 'object' ? r[key].value : r[key]; }
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  var start = p.startTime ? new Date(p.startTime) : null;
  return {
    status: 'Consultation',
    name: attendee.name || answer('name') || 'Cal.com booking',
    whatsapp: answer('attendeePhoneNumber') || answer('phone') || attendee.phoneNumber || '',
    email: attendee.email || answer('email') || '',
    shootType: answer('shootType') || p.title || '',
    consultMode: 'Cal.com' + (p.location ? ': ' + p.location : ''),
    consultDate: start ? Utilities.formatDate(start, tz, 'yyyy-MM-dd') : '',
    consultTime: start ? Utilities.formatDate(start, tz, 'h:mm a') : '',
    message: (event === 'BOOKING_RESCHEDULED' ? '[Rescheduled] ' : '') + (answer('notes') || p.description || ''),
    source: 'cal.com',
  };
}

// ---- Channels -----------------------------------------------------------------------

function sendWhatsApp_(text) {
  if (!OWNER_WHATSAPP || !CALLMEBOT_APIKEY) return null; // not set up yet
  try {
    var res = UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(OWNER_WHATSAPP) +
      '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(CALLMEBOT_APIKEY), { muteHttpExceptions: true });
    var ok = res.getResponseCode() === 200 && !/invalid|error/i.test(res.getContentText());
    if (!ok) console.warn('CallMeBot: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
    return ok;
  } catch (err) {
    console.warn('CallMeBot: ' + err);
    return false;
  }
}

function sendPush_(msg) {
  if (!NTFY_TOPIC) return null; // not set up yet
  var payload = { topic: NTFY_TOPIC };
  Object.keys(msg).forEach(function (k) { payload[k] = msg[k]; });
  var headers = NTFY_TOKEN ? { Authorization: 'Bearer ' + NTFY_TOKEN } : {};
  try {
    var res = UrlFetchApp.fetch(NTFY_SERVER, { method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), headers: headers, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) console.warn('ntfy: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
    return res.getResponseCode() === 200;
  } catch (err) {
    console.warn('ntfy: ' + err);
    return false;
  }
}

function notifyAll_(title, text, priority, click) {
  sendWhatsApp_(title + '\n' + text);
  sendPush_({ title: title, message: text, priority: priority, click: click || SpreadsheetApp.getActive().getUrl() });
}

// ---- Helpers ------------------------------------------------------------------------

function getSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) return sheet;
  // A brand-new spreadsheet has one empty "Sheet1": reuse it so the owner sees one tab.
  var sheets = ss.getSheets();
  if (sheets.length === 1 && sheets[0].getLastRow() === 0) return sheets[0].setName(SHEET_NAME);
  return ss.insertSheet(SHEET_NAME);
}

function colIndex_() {
  var map = {};
  COLUMNS.forEach(function (h, i) { map[h] = i; });
  return map;
}

function readRow_(sheet, row) {
  var values = sheet.getRange(row, 1, 1, COLUMNS.length).getDisplayValues()[0];
  var lead = {};
  COLUMNS.forEach(function (h, i) { lead[h] = values[i]; });
  return lead;
}

// Link that opens the Sheets app (or browser) directly on the lead's row.
function rowUrl_(sheet, row) {
  return SpreadsheetApp.getActive().getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + row;
}

function scheduleRetry_() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'retryFailedNotifications'; });
  if (!exists) ScriptApp.newTrigger('retryFailedNotifications').timeBased().after(60 * 1000).create();
}

function deleteTriggers_(handler) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });
}

function formatWhen_(iso) {
  if (!iso) return '';
  return Utilities.formatDate(new Date(iso), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'd MMM, h:mm a');
}

// Stores values as typed. The leading ' (hidden in the sheet) stops "=..." running as a
// formula and keeps phone numbers and dates as plain text.
function clean_(value) {
  if (value === undefined || value === null || value === '') return '';
  return "'" + String(value).slice(0, MAX_VALUE_LENGTH);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
