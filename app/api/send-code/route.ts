import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
import { supabase } from '@/utils/supabase';

interface StudentRow {
  id: string;
  student_id: string;
  name: string;
  phone: string;
  device_id: string | null;
  is_locked: boolean;
  created_at: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string | undefined>;
    const name = (body?.name || '').trim();
    const studentId = (body?.studentId || '').trim();
    const phone = (body?.phone || '').trim();
    const deviceId = (body?.deviceId || '').trim();

    if (!name || !studentId || !phone || !deviceId) {
      return NextResponse.json(
        { success: false, message: '이름, 학번, 전화번호, 기기 정보를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 1. Supabase students 테이블에서 학생 정보가 정확하게 일치하는지 조회 (사전 등록 체크)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .eq('name', name)
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

    // 일치하는 학생 정보가 데이터베이스에 존재하지 않는 경우 즉시 가입 거부
    if (!studentData) {
      return NextResponse.json(
        { success: false, message: '일치하는 학생 정보가 존재하지 않습니다.' },
        { status: 200 }
      );
    }

    // 2. 이미 등록 완료되었고(is_locked = true) 등록된 기기 정보와 현재 기기가 다를 경우 차단
    if (studentData.is_locked) {
      if (studentData.device_id && studentData.device_id !== deviceId) {
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
      }
    }

    // 3. 6자리 인증번호 생성
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. 인증번호 해시 생성 (student_id + phone + code + SMS_CODE_SECRET)
    const secret = process.env.SMS_CODE_SECRET || '';
    const hashInput = studentId + phone + code + secret;
    const codeHash = createHash('sha256').update(hashInput).digest('hex');

    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3분 후 만료

    // 5. sms_codes 테이블에 기록
    const { error: insertError } = await supabase
      .from('sms_codes')
      .insert({
        name: name,
        student_id: studentId,
        phone: phone,
        device_id: deviceId,
        code_hash: codeHash,
        expires_at: expiresAt,
        used: false
      });

    if (insertError) {
      console.error('Error inserting SMS code:', insertError);
      return NextResponse.json(
        { success: false, message: '인증번호 생성 및 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 6. SOLAPI를 통한 실제 SMS 인증 문자 발송
    const solapiApiKey = process.env.SOLAPI_API_KEY || '';
    const solapiApiSecret = process.env.SOLAPI_API_SECRET || '';
    const solapiSenderNumber = process.env.SOLAPI_SENDER_NUMBER || '';

    let solapiStatusMessage = '';

    if (solapiApiKey && solapiApiSecret && solapiSenderNumber) {
      try {
        const date = new Date().toISOString();
        // 32글자 무작위 Salt값 생성
        const salt = createHash('sha256').update(Math.random().toString()).digest('hex').substring(0, 32);
        const signature = createHmac('sha256', solapiApiSecret)
          .update(date + salt)
          .digest('hex');

        const authHeader = `HMAC-SHA256 apiKey=${solapiApiKey}, date=${date}, salt=${salt}, signature=${signature}`;
        const smsText = `[별가람고등학교] 인증번호는 [${code}] 입니다. 3분 내에 입력해 주세요.`;

        const solapiRes = await fetch('https://api.solapi.com/messages/v4/send', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: {
              to: phone,
              from: solapiSenderNumber,
              text: smsText
            }
          })
        });

        const solapiData = await solapiRes.json();
        if (!solapiRes.ok) {
          console.error('SOLAPI API Error:', solapiData);
          solapiStatusMessage = `(SMS 문자 발송 오류: ${solapiData.message || '솔라피 서버 거부'})`;
        } else {
          console.log('SOLAPI SMS Sent successfully:', solapiData);
        }
      } catch (solapiErr: any) {
        console.error('SOLAPI Exception during SMS dispatch:', solapiErr);
        solapiStatusMessage = `(SMS 전송 중 예외 발생: ${solapiErr.message || '네트워크 오류'})`;
      }
    } else {
      console.log('[SMS WARNING] Solapi environment variables not set. Skipping actual SMS sending.');
      solapiStatusMessage = ' (개발 환경: 모의 발송 모드)';
    }

    // 7. 개발/디버그 빌드 환경 콘솔 로그
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SMS_DEBUG_LOG === 'true') {
      console.log(`[SMS DEBUG LOG] Student: ${name} (${studentId}), Phone: ${phone}, Code: ${code}`);
    }

    return new NextResponse(
      JSON.stringify({ 
        success: true, 
        message: `인증번호가 발송되었습니다.${solapiStatusMessage}` 
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

  } catch (error: any) {
    console.error('Error in send-code API:', error);
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
