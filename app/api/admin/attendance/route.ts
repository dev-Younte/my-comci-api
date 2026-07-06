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
      .from('attendance_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin attendance:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '데이터베이스 조회 실패' }),
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
    const { id, date, type, time, result, wifi_ssid, gps_status } = body;

    if (!id) {
      return new NextResponse(
        JSON.stringify({ success: false, message: 'ID가 누락되었습니다.' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { error } = await supabase
      .from('attendance_records')
      .update({
        date,
        type,
        time,
        result,
        wifi_ssid: wifi_ssid || '',
        gps_status: gps_status || ''
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating attendance record:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '데이터베이스 수정 실패', error: error.message }),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '기록이 수정되었습니다.' }),
      { status: 200, headers: getCorsHeaders() }
    );
  } catch (err: any) {
    return new NextResponse(
      JSON.stringify({ success: false, message: err.message }),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = validateAdminAuth(request);
    if (!authResult.isValid) {
      return authResult.errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new NextResponse(
        JSON.stringify({ success: false, message: 'ID가 누락되었습니다.' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { error } = await supabase
      .from('attendance_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting attendance record:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '데이터베이스 삭제 실패', error: error.message }),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '기록이 삭제되었습니다.' }),
      { status: 200, headers: getCorsHeaders() }
    );
  } catch (err: any) {
    return new NextResponse(
      JSON.stringify({ success: false, message: err.message }),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Max-Age': '86400'
    }
  });
}
