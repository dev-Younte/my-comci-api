import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { validateAdminAuth, getCorsHeaders } from '@/utils/auth';

// 1. OPTIONS (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(),
      'Access-Control-Max-Age': '86400'
    }
  });
}

// 2. GET (학생 목록 조회)
export async function GET(request: Request) {
  try {
    const authResult = validateAdminAuth(request);
    if (!authResult.isValid) {
      return authResult.errorResponse!;
    }

    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .order('student_id', { ascending: true });

    if (error) {
      console.error('Error fetching students:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '데이터베이스 조회 실패' }),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, students }),
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

// 3. POST (신규 학생 추가 - 기존 /api/admin/add 이관)
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

// 4. PUT (학생 정보 수정 또는 기기 바인딩 리셋 - 기존 /api/admin/update 및 /api/admin/reset 이관)
export async function PUT(request: Request) {
  try {
    const authResult = validateAdminAuth(request);
    if (!authResult.isValid) {
      return authResult.errorResponse!;
    }

    const body = (await request.json()) as Record<string, string | undefined>;
    const action = body?.action;

    if (action === 'reset') {
      const studentId = (body?.studentId || '').trim();
      if (!studentId) {
        return new NextResponse(
          JSON.stringify({ success: false, message: '학번(studentId)을 입력해 주세요.' }),
          { status: 400, headers: getCorsHeaders() }
        );
      }

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
    } else {
      // 일반 수정
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
    }
  } catch (error: any) {
    return new NextResponse(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// 5. DELETE (학생 삭제 - 기존 /api/admin/delete 이관)
export async function DELETE(request: Request) {
  try {
    const authResult = validateAdminAuth(request);
    if (!authResult.isValid) {
      return authResult.errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id')?.trim() || '';

    if (!id) {
      try {
        const body = (await request.json()) as Record<string, string | undefined>;
        id = (body?.id || '').trim();
      } catch (e) {
        // ignore
      }
    }

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
