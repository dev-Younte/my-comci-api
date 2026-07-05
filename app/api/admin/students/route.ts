import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const secret = process.env.ADMIN_SECRET_KEY || '';
    
    if (!secret || !authHeader || authHeader !== `Bearer ${secret}`) {
      return new NextResponse(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }

    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .order('student_id', { ascending: true });

    if (error) {
      console.error('Error fetching students:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '데이터베이스 조회 실패' }),
        { status: 500 }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, students }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
