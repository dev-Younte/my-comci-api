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
    const name = (body?.name || '').trim();
    const phone = (body?.phone || '').trim();

    if (!studentId || !name || !phone) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '학번, 이름, 전화번호를 모두 입력해 주세요.' }),
        { status: 400 }
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
          { status: 200 }
        );
      }
      return new NextResponse(
        JSON.stringify({ success: false, message: '학생 등록 데이터베이스 저장 실패' }),
        { status: 500 }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '신규 학생이 등록되었습니다.' }),
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
