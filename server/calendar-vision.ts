import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ScannedCalendarEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  endTime?: string | null; // HH:MM
  isAllDay: boolean;
  location?: string | null;
  description?: string | null;
}

export async function scanCalendarVision(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  options: {
    todayDate?: string;
    timezone?: string;
    apiKey?: string;
  } = {}
): Promise<ScannedCalendarEvent[]> {
  const activeKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const genAI = new GoogleGenerativeAI(activeKey);
  const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash'];

  // Clean data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

  const todayStr = options.todayDate || new Date().toISOString().split('T')[0];
  const tzStr = options.timezone || 'local';

  const prompt = `You are a family executive assistant specializing in extracting calendar events from images.
Examine this image (which may be a school flyer, sports schedule, birthday party invitation, appointment reminder card, camp flyer, community newsletter, or handwritten note).

Extract ALL calendar events, dates, games, practices, appointments, or deadlines visible in the document.

Reference Context:
- Current reference date: ${todayStr}
- Local timezone: ${tzStr}

For each event provide:
1. "title": Concise, descriptive event title (e.g. "Varsity Soccer vs. Oak Grove", "Emma's 8th Birthday Party", "School Picture Day", "Dentist Appointment", "Fall Break - No School").
2. "date": The date of the event in strict "YYYY-MM-DD" format. If the year is not printed on the document, infer the year using the current reference date (${todayStr}) and any day-of-week indicated.
3. "startTime": 24-hour time "HH:MM" (e.g. "09:00", "14:30", "18:00"). If no time is mentioned or if it is an all-day event/holiday, set to null.
4. "endTime": 24-hour time "HH:MM" (e.g. "10:30", "16:00"). If start time is known but end time is not, set to an appropriate end time (e.g. 1 hour or 90 mins after start) or null.
5. "isAllDay": Boolean. True if the event has no specific time, is an all-day event, school holiday, or deadline.
6. "location": Venue name, room, field, or address if stated. If none, set to null.
7. "description": Any relevant details, what to bring, uniform, RSVP info, or instructions. If none, set to null.

CRITICAL: Return ONLY a valid JSON array of event objects matching this schema:
[
  {
    "title": "Soccer vs Tigers",
    "date": "${todayStr}",
    "startTime": "09:00",
    "endTime": "10:30",
    "isAllDay": false,
    "location": "West Field 3",
    "description": "Wear navy jersey. Arrive 15 min early."
  }
]
If no calendar events are found in the image, return an empty array [].`;

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
      ]);

      const text = result.response.text().trim();
      const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

      let parsed: any[] = [];
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((item) => {
        let eventDate = String(item.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
          const d = new Date(eventDate);
          if (!isNaN(d.getTime())) {
            eventDate = d.toISOString().split('T')[0];
          } else {
            eventDate = todayStr;
          }
        }

        let isAllDay = Boolean(item.isAllDay);
        let startTime = item.startTime ? String(item.startTime).trim() : null;
        let endTime = item.endTime ? String(item.endTime).trim() : null;

        if (!startTime) {
          isAllDay = true;
          startTime = null;
          endTime = null;
        }

        return {
          title: String(item.title || 'Scanned Event').trim(),
          date: eventDate,
          startTime,
          endTime,
          isAllDay,
          location: item.location ? String(item.location).trim() : null,
          description: item.description ? String(item.description).trim() : null,
        };
      });
    } catch (err: any) {
      console.warn(`Model ${modelName} calendar scan attempt failed:`, err?.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to parse calendar events from image.');
}
