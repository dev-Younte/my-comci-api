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
    const name = (body?.name || '').trim();
    const phone = (body?.phone || '').trim();

    if (!studentId || !name || !phone) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '학번, 이름, 전화번호를 모두 입력해 주세요.' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { error } = await supabase
      .from('students')
      .insert({
        student_id: studentId,
        name: name,
        phone: phone,
        is_locked: false
      });

    if (error) {
      console.error('Error inserting student:', error);
      // UNIQUE 제약조건 에러 메시지 가독성 개선
      if (error.code === '23505') {
        const field = error.message.includes('student_id') ? '학번' : '전화번호';
        return new NextResponse(
          JSON.stringify({ success: false, message: `이미 등록된 ${field}입니다.` }),
          { status: 200, headers: getCorsHeaders() }
        );
      }
      return new NextResponse(
        JSON.stringify({ success: false, message: '학생 등록 데이터베이스 저장 실패' }),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '신규 학생이 등록되었습니다.' }),
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
