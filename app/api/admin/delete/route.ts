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

    if (!id) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '학생 고유 ID를 입력해 주세요.' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting student:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '학생 삭제 데이터베이스 작업 실패' }),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '학생이 성공적으로 삭제되었습니다.' }),
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
