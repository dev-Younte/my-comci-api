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
    const { id, action, date, type, time, result, wifi_ssid, gps_status } = body;

    if (!id) {
      return new NextResponse(
        JSON.stringify({ success: false, message: 'ID가 누락되었습니다.' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // 1. 복원 처리 (휴지통에서 복구)
    if (action === 'restore') {
      const { error } = await supabase
        .from('attendance_records')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) {
        console.error('Error restoring attendance record:', error);
        return new NextResponse(
          JSON.stringify({ success: false, message: '데이터베이스 복원 실패', error: error.message }),
          { status: 500, headers: getCorsHeaders() }
        );
      }
      return new NextResponse(
        JSON.stringify({ success: true, message: '기록이 복원되었습니다.' }),
        { status: 200, headers: getCorsHeaders() }
      );
    }

    // 2. 원상복귀 처리 (수정된 기록을 원래대로)
    if (action === 'revert') {
      // 현재 기록 조회
      const { data: current, error: fetchErr } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !current) {
        return new NextResponse(
          JSON.stringify({ success: false, message: '기록을 찾을 수 없습니다.' }),
          { status: 404, headers: getCorsHeaders() }
        );
      }

      if (!current.original_record) {
        return new NextResponse(
          JSON.stringify({ success: false, message: '원래 기록 정보가 없습니다.' }),
          { status: 400, headers: getCorsHeaders() }
        );
      }

      try {
        const orig = JSON.parse(current.original_record);
        const { error } = await supabase
          .from('attendance_records')
          .update({
            date: orig.date,
            type: orig.type,
            time: orig.time,
            result: orig.result,
            wifi_ssid: orig.wifi_ssid || '',
            gps_status: orig.gps_status || '',
            original_record: null
          })
          .eq('id', id);

        if (error) {
          throw error;
        }

        return new NextResponse(
          JSON.stringify({ success: true, message: '원상복귀 완료되었습니다.' }),
          { status: 200, headers: getCorsHeaders() }
        );
      } catch (err: any) {
        console.error('Error reverting attendance record:', err);
        return new NextResponse(
          JSON.stringify({ success: false, message: '원상복귀 처리 실패', error: err.message }),
          { status: 500, headers: getCorsHeaders() }
        );
      }
    }

    // 3. 일반 수정 처리
    // 현재 기록 조회하여 최초 수정인지 확인
    const { data: current, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '기록을 찾을 수 없습니다.' }),
        { status: 404, headers: getCorsHeaders() }
      );
    }

    let originalRecordVal = current.original_record;
    if (!originalRecordVal) {
      // 최초 수정이므로 현재 값을 original_record에 저장
      const origData = {
        date: current.date,
        type: current.type,
        time: current.time,
        result: current.result,
        wifi_ssid: current.wifi_ssid || '',
        gps_status: current.gps_status || ''
      };
      originalRecordVal = JSON.stringify(origData);
    }

    const { error } = await supabase
      .from('attendance_records')
      .update({
        date,
        type,
        time,
        result,
        wifi_ssid: wifi_ssid || '',
        gps_status: gps_status || '',
        original_record: originalRecordVal
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
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return new NextResponse(
        JSON.stringify({ success: false, message: 'ID가 누락되었습니다.' }),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (permanent) {
      // 영구 삭제
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error permanently deleting attendance record:', error);
        return new NextResponse(
          JSON.stringify({ success: false, message: '데이터베이스 영구 삭제 실패', error: error.message }),
          { status: 500, headers: getCorsHeaders() }
        );
      }
      return new NextResponse(
        JSON.stringify({ success: true, message: '기록이 영구 삭제되었습니다.' }),
        { status: 200, headers: getCorsHeaders() }
      );
    } else {
      // 임시 삭제 (휴지통 이동)
      const { error } = await supabase
        .from('attendance_records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Error soft deleting attendance record:', error);
        return new NextResponse(
          JSON.stringify({ success: false, message: '데이터베이스 삭제 실패', error: error.message }),
          { status: 500, headers: getCorsHeaders() }
        );
      }
      return new NextResponse(
        JSON.stringify({ success: true, message: '기록이 휴지통으로 이동되었습니다.' }),
        { status: 200, headers: getCorsHeaders() }
      );
    }
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
