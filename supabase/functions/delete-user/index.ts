/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req) => {
  // Handle CORS preflight
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
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ message: 'Only POST method allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const body = await req.json();
    const { email, user_id } = body;

    if (!email || !user_id) {
      return new Response(JSON.stringify({ message: 'Missing email or user_id' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from Auth by email
    const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error("List Users Error:", listError);
        return new Response(JSON.stringify({ message: 'Failed to list users', error: listError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

    // Manually find the user by email
    const userToDelete = userList?.users?.find((u) => u.email === email);
    if (userToDelete) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userToDelete.id);
      if (deleteError) {
        console.error("Auth Delete Error:", deleteError);
        return new Response(JSON.stringify({ message: 'Failed to delete user from auth', error: deleteError.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Delete from tbl_users
    const { error: dbError } = await supabase
      .from("tbl_users")
      .delete()
      .eq("user_id", user_id);

    if (dbError) {
      console.error("Database Delete Error:", dbError);
      return new Response(JSON.stringify({ message: 'Failed to delete from tbl_users', error: dbError.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({
      message: 'Unexpected server error',
      error: typeof err === 'object' && err !== null && 'message' in err ? err.message : String(err),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
