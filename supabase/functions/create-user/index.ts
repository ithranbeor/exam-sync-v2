/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const body = await req.json();
    const {
      user_id,
      first_name,
      last_name,
      middle_name,
      email_address,
      contact_number,
      status,
      password,
    } = body;

    if (
      !user_id || isNaN(Number(user_id)) ||
      !first_name || !last_name || !email_address ||
      !contact_number || !status || !password
    ) {
      return new Response(
        JSON.stringify({ message: 'Missing or invalid required fields' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email_address,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth Error:', authError);
      return new Response(
        JSON.stringify({ message: 'Auth error', error: authError.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const auth_user_id = authUser?.user?.id;

    // Insert metadata into tbl_users
    const { error: insertError } = await supabase.from('tbl_users').insert([
      {
        user_id: Number(user_id),
        first_name,
        last_name,
        middle_name,
        email_address,
        contact_number,
        status,
      },
    ]);

    // If metadata insert fails, remove the Auth user to prevent orphaned auth records
    if (insertError) {
      console.error('Insert Error:', insertError);

      if (auth_user_id) {
        await supabase.auth.admin.deleteUser(auth_user_id);
        console.log(`Auth user ${auth_user_id} deleted due to insert failure.`);
      }

      return new Response(
        JSON.stringify({ message: 'Insert failed', error: insertError.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ message: 'Account created successfully!' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('Unexpected Error:', err);
    return new Response(
      JSON.stringify({
        message: 'Unexpected error',
        error:
          typeof err === 'object' && err !== null && 'message' in err
            ? (err as { message: string }).message
            : String(err),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
