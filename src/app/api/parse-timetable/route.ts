import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { imageUrl } = await request.json();
  if (!imageUrl) {
    return Response.json({ error: 'imageUrl required' }, { status: 400 });
  }

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: imageUrl },
          },
          {
            type: 'text',
            text: `Parse this timetable/schedule image and extract all course/class entries.

For each entry return a JSON array of objects with these exact fields:
- course_code: string (e.g. "261101" or "SC211")
- course_name: string (full name, in original language)
- section: string or null
- credits: string or null (e.g. "3(3-0-6)")
- day_of_week: number 1-5 (1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday) or null if not shown
- start_time: string "HH:MM" 24-hour format or null
- end_time: string "HH:MM" 24-hour format or null
- room: string or null

Reply with ONLY a JSON array, no other text. Example:
[{"course_code":"261101","course_name":"Introduction to Computing","section":"1","credits":"3(3-0-6)","day_of_week":1,"start_time":"09:00","end_time":"12:00","room":"CB4201"}]

If you cannot parse the image or it's not a timetable, reply with an empty array: []`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return Response.json({ entries: [] });
  }

  try {
    const raw = textBlock.text.trim();
    const jsonStr = raw.startsWith('[') ? raw : raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]';
    const entries = JSON.parse(jsonStr);
    return Response.json({ entries });
  } catch {
    return Response.json({ entries: [] });
  }
}
