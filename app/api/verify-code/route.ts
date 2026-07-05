import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase } from '@/utils/supabase';

interface StudentRow {
  id: string;
  student_id: string;
  name: string;
  phone: string;
  created_at: string;
}

interface SmsCodeRow {
  id: string;
  student_id: string;
  phone: string;
  code_hash: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

interface RegisteredDeviceRow {
  id: string;
  student_id: string;
  device_id: string;
  created_at: string;
  last_seen_at: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string | undefined>;
    const name = (body?.name || '').trim();
    const studentId = (body?.studentId || '').trim();
    const phone = (body?.phone || '').trim();
    const code = (body?.code || '').trim();
    const deviceId = (body?.deviceId || '').trim();

    if (!name || !studentId || !phone || !code || !deviceId) {
      return NextResponse.json(
        { success: false, message: '모든 인증 정보를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 1. 학생 정보 조회
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('name', name)
      .eq('student_id', studentId)
      .eq('phone', phone)
      .maybeSingle();

    if (studentError) {
      console.error('Error fetching student:', studentError);
      return NextResponse.json(
        { success: false, message: '데이터베이스 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const studentData = student as StudentRow | null;

    if (!studentData) {
      return NextResponse.json(
        { success: false, message: '일치하는 학생 정보가 존재하지 않습니다.' },
        { status: 200 }
      );
    }

    // 2. 가장 최근 발송된 인증번호 조회
    const { data: smsCode, error: smsError } = await supabase
      .from('sms_codes')
      .select('*')
      .eq('student_id', studentData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (smsError) {
      console.error('Error fetching SMS code:', smsError);
      return NextResponse.json(
        { success: false, message: '인증번호 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const smsCodeData = smsCode as SmsCodeRow | null;

    if (!smsCodeData) {
      return NextResponse.json(
        { success: false, message: '발송된 인증번호 내역이 없습니다.' },
        { status: 200 }
      );
    }

    // 3. 인증번호 상태 및 만료 기간 검증
    if (smsCodeData.used) {
      return NextResponse.json(
        { success: false, message: '이미 사용된 인증번호입니다. 다시 발송해주세요.' },
        { status: 200 }
      );
    }

    if (new Date(smsCodeData.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, message: '인증번호 유효시간(3분)이 만료되었습니다. 다시 발송해주세요.' },
        { status: 200 }
      );
    }

    // 4. 해시값 비교 검증 (student_id + phone + code + SMS_CODE_SECRET)
    const secret = process.env.SMS_CODE_SECRET || '';
    const hashInput = studentId + phone + code + secret;
    const computedHash = createHash('sha256').update(hashInput).digest('hex');

    if (computedHash !== smsCodeData.code_hash) {
      return NextResponse.json(
        { success: false, message: '인증번호가 일치하지 않습니다.' },
        { status: 200 }
      );
    }

    // 5. 인증번호 사용 완료 처리
    const { error: updateCodeError } = await supabase
      .from('sms_codes')
      .update({ used: true })
      .eq('id', smsCodeData.id);

    if (updateCodeError) {
      console.error('Error updating SMS code status:', updateCodeError);
      return NextResponse.json(
        { success: false, message: '인증 완료 상태 갱신에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 6. 단일 기기 등록 제한 검증 (student_id UNIQUE 제약조건 활용)
    const { data: registeredDevice, error: deviceFetchError } = await supabase
      .from('registered_devices')
      .select('*')
      .eq('student_id', studentData.id)
      .maybeSingle();

    if (deviceFetchError) {
      console.error('Error fetching registered device:', deviceFetchError);
      return NextResponse.json(
        { success: false, message: '등록 기기 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const registeredDeviceData = registeredDevice as RegisteredDeviceRow | null;

    if (registeredDeviceData) {
      // 기존 기기가 있는 경우
      if (registeredDeviceData.device_id !== deviceId) {
        // 이미 다른 기기에서 등록이 완료된 학생인 경우
        return new NextResponse(
          JSON.stringify({
            success: false,
            code: 'DEVICE_ALREADY_REGISTERED',
            message: '이미 다른 기기가 등록되어 있습니다. 본인 기기가 아니라면 관리자에게 문의해 주세요.'
          }),
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
      } else {
        // 동일 기기에서 재가입/로그인하는 경우, 최종 사용 정보만 업데이트
        const { error: updateDeviceError } = await supabase
          .from('registered_devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', registeredDeviceData.id);

        if (updateDeviceError) {
          console.error('Error updating device last seen:', updateDeviceError);
        }
      }
    } else {
      // 신규 기기 등록인 경우
      const { error: insertDeviceError } = await supabase
        .from('registered_devices')
        .insert({
          student_id: studentData.id,
          device_id: deviceId,
          last_seen_at: new Date().toISOString()
        });

      if (insertDeviceError) {
        console.error('Error registering device:', insertDeviceError);
        return NextResponse.json(
          { success: false, message: '기기 정보 등록에 실패했습니다.' },
          { status: 500 }
        );
      }
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '인증되었습니다.' }),
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
    console.error('Error in verify-code API:', error);
    return NextResponse.json(
      { success: false, message: error.message || '서버 처리 중 오류 발생' },
      { status: 500 }
    );
  }
}

// OPTIONS preflight 요청 처리 (CORS 대응)
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
