export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  venueName: string;
  address: string;
  url: string;
}

const escapeText = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n')
  .replaceAll(',', '\\,').replaceAll(';', '\\;');
const utc = (value: string | Date) => new Date(value).toISOString()
  .replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

function fold(line: string): string {
  const encoder = new TextEncoder();
  let result = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character;
    bytes += size;
  }
  return result;
}

export function createEventIcs(event: CalendarEvent, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NOCTURNO//Events//ES',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${event.id}@nocturno.local`, `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(event.startsAt)}`, `DTEND:${utc(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description || '')}`,
    `LOCATION:${escapeText([event.venueName, event.address].filter(Boolean).join(', '))}`,
    `URL:${event.url}`, 'END:VEVENT', 'END:VCALENDAR'
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
