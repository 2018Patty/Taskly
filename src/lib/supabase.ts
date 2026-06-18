import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Fallback to placeholders during build-time if the environment variables are missing or set to placeholder text
if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = 'https://placeholder.supabase.co';
  supabaseAnonKey = 'placeholder-anon-key';
  
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      'Supabase URL or Anon Key is missing or invalid. Please check your .env.local file.'
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

