import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { validateAdminAuth, getCorsHeaders } from '@/utils/auth';

export async function GET(request: Request) {
  try {
    const authResult = validateAdminAuth(request);
    if (!authResult.isValid) {
      return authResult.errorResponse!;
    }

    const { data: records, error } = await supabase
      .from('subject_locations')
      .select('*')
      .order('grade_class', { ascending: true });

    if (error) {
      console.error('Error fetching subject locations:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '수업 위치 데이터베이스 조회 실패' }),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, records }),
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

export async function PUT(request: Request) {
  try {
    const authResult = validateAdminAuth(request);
    if (!authResult.isValid) {
      return authResult.errorResponse!;
    }

    const body = await request.json();
    const { gradeClass, locations } = body;

    if (!gradeClass || !locations) {
      return new NextResponse(
        JSON.stringify({ success: false, message: 'gradeClass 또는 locations 정보가 누락되었습니다.' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const rows = Object.entries(locations).map(([subject, location]) => ({
      grade_class: gradeClass,
      subject: subject.trim(),
      location: (location as string).trim(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('subject_locations')
      .upsert(rows, { onConflict: 'grade_class,subject' });

    if (error) {
      console.error('Error saving subject locations:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '수업 위치 저장 실패' }),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '수업 위치 정보가 성공적으로 업데이트되었습니다.' }),
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
    headers: getCorsHeaders()
  });
}
