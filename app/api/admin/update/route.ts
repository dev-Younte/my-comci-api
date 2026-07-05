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
    const id = (body?.id || '').trim();
    const studentId = (body?.studentId || '').trim();
    const name = (body?.name || '').trim();
    const phone = (body?.phone || '').trim();

    if (!id || !studentId || !name || !phone) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '모든 필수 항목(ID, 학번, 이름, 전화번호)을 입력해 주세요.' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { error } = await supabase
      .from('students')
      .update({
        student_id: studentId,
        name: name,
        phone: phone
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating student:', error);
      if (error.code === '23505') {
        const field = error.message.includes('student_id') ? '학번' : '전화번호';
        return new NextResponse(
          JSON.stringify({ success: false, message: `이미 등록된 ${field}입니다.` }),
          { status: 200, headers: getCorsHeaders() }
        );
      }
      return new NextResponse(
        JSON.stringify({ success: false, message: '학생 수정 데이터베이스 업데이트 실패' }),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '학생 정보가 수정되었습니다.' }),
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
