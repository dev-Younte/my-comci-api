import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { validateAdminAuth, getCorsHeaders } from '@/utils/auth';

export async function POST(request: Request) {
  try {
    const authResult = validateAdminAuth(request);
    if (!authResult.isValid) {
      return authResult.errorResponse!;
    }

    const body = (await request.json()) as Record<string, string | undefined>;
    const studentId = (body?.studentId || '').trim();

    if (!studentId) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '학번(studentId)을 입력해 주세요.' }),
        { status: 400, headers: getCorsHeaders() }
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
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '기기 바인딩이 성공적으로 초기화되었습니다.' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );
  } catch (error: any) {
    return new NextResponse(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(),
      'Access-Control-Max-Age': '86400'
    }
  });
}
