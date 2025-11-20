import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio_url, user_id } = await req.json();

    if (!audio_url || !user_id) {
      throw new Error('Missing audio_url or user_id');
    }

    // 1. Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Download Audio File
    const { data: audioData, error: downloadError } = await supabase
      .storage
      .from('audio-memos')
      .download(audio_url);

    if (downloadError) throw downloadError;

    // 3. STT (OpenAI Whisper)
    const formData = new FormData();
    formData.append('file', new File([audioData], 'audio.m4a', { type: 'audio/m4a' }));
    formData.append('model', 'whisper-1');
    formData.append('language', 'ko');

    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: formData,
    });

    const sttResult = await sttResponse.json();
    if (sttResult.error) throw new Error(sttResult.error.message);
    const transcript = sttResult.text;

    // 4. LLM Analysis (Gemini 1.5 Pro)
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const currentKST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' });

    const systemPrompt = `You are a personal secretary. Current Time (KST): ${currentKST}
Task: Analyze the transcript.
If it's a specific appointment, type is 'SCHEDULE'. Extract date strictly based on KST.
If it's a task/idea, type is 'TODO' or 'IDEA'. Reformat the content into clean Markdown (headers, bullets).
Output JSON only matching the defined Schema:
{
  "summary": "string",
  "primary_type": "SCHEDULE" | "TODO" | "IDEA" | "NOTE",
  "content_body": "string (markdown)",
  "entities": {
    "target_date": "string (ISO 8601) or null",
    "location": "string or null",
    "tags": ["string"]
  }
}`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + "\n\nTranscript:\n" + transcript }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const geminiResult = await geminiResponse.json();
    const analysis = JSON.parse(geminiResult.candidates[0].content.parts[0].text);

    // 5. Save to Database
    const { data: memo, error: dbError } = await supabase
      .from('memos')
      .insert({
        user_id,
        raw_text: transcript,
        summary: analysis.summary,
        primary_type: analysis.primary_type,
        content_body: analysis.content_body,
        entities: analysis.entities,
        status: 'COMPLETED',
        audio_url: audio_url
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify(memo), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
