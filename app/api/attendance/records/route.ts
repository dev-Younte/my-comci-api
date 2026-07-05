import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = (searchParams.get('studentId') || '').trim();
    const name = (searchParams.get('name') || '').trim();

    if (!studentId || !name) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '학번과 이름이 필요합니다.' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const { data: records, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('student_id', studentId)
      .eq('student_name', name)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      console.error('Error fetching attendance records:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '데이터베이스 조회 실패', error: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, records }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (err: any) {
    console.error('Error in records API:', err);
    return new NextResponse(
      JSON.stringify({ success: false, message: err.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
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
