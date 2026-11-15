import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { imageUrl } = await request.json();
  if (!imageUrl) {
    return Response.json({ error: 'imageUrl required' }, { status: 400 });
  }

  let response;
  try {
    response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    // 4096 was too small: adaptive thinking used the whole budget and no JSON was produced
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
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
  } catch (err) {
    console.error('parse-timetable API error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ entries: [], error: `เรียก AI ไม่สำเร็จ: ${msg}` }, { status: 502 });
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.error('parse-timetable: no text output, stop_reason =', response.stop_reason);
    return Response.json({ entries: [], error: `AI ไม่ได้ส่งผลลัพธ์ (stop_reason: ${response.stop_reason})` });
  }

  try {
    const raw = textBlock.text.trim();
    const jsonStr = raw.startsWith('[') ? raw : raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]';
    const entries = JSON.parse(jsonStr);
    return Response.json({ entries });
  } catch {
    console.error('parse-timetable: invalid JSON, stop_reason =', response.stop_reason);
    return Response.json({ entries: [], error: 'อ่านผลลัพธ์จาก AI ไม่ได้ (JSON ไม่ถูกต้อง)' });
  }
}
