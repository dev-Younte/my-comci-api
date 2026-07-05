import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(request: Request) {
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
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }

    const body = (await request.json()) as Record<string, string | undefined>;
    const studentId = (body?.studentId || '').trim();

    if (!studentId) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '학번(studentId)을 입력해 주세요.' }),
        { status: 400 }
      );
    }

    // students 테이블에서 해당 학번의 device_id와 is_locked 해제 (행은 삭제하지 않음)
    const { error } = await supabase
      .from('students')
      .update({
        device_id: null,
        is_locked: false,
        registered_at: null
      })
      .eq('student_id', studentId);

    if (error) {
      console.error('Error resetting student device binding:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '기기 초기화 데이터베이스 업데이트 실패' }),
        { status: 500 }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '기기 바인딩이 성공적으로 초기화되었습니다.' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
