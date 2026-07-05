import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase } from '../../../utils/supabase';

export async function POST(request: Request) {
  try {
    const { name, studentId, phone } = await request.json();

    if (!name || !studentId || !phone) {
      return NextResponse.json(
        { success: false, message: '이름, 학번, 전화번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 1. Supabase students 테이블에서 학생 정보 조회
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('name', name.trim())
      .eq('student_id', studentId.trim())
      .eq('phone', phone.trim())
      .maybeSingle();

    if (studentError) {
      console.error('Error fetching student:', studentError);
      return NextResponse.json(
        { success: false, message: '데이터베이스 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { success: false, message: '일치하는 학생 정보가 존재하지 않습니다.' },
        { status: 200 }
      );
    }

    // 2. 6자리 인증번호 생성
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. 인증번호 해시 생성 (student_id + phone + code + SMS_CODE_SECRET)
    const secret = process.env.SMS_CODE_SECRET || '';
    const hashInput = studentId.trim() + phone.trim() + code + secret;
    const codeHash = createHash('sha256').update(hashInput).digest('hex');

    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3분 후 만료

    // 4. sms_codes 테이블에 저장 (student_id는 students.id 참조)
    const { error: insertError } = await supabase
      .from('sms_codes')
      .insert({
        student_id: student.id,
        phone: phone.trim(),
        code_hash: codeHash,
        expires_at: expiresAt,
        used: false
      });

    if (insertError) {
      console.error('Error inserting SMS code:', insertError);
      return NextResponse.json(
        { success: false, message: '인증번호 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 5. 개발/디버그 빌드 환경 콘솔 로그
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SMS_DEBUG_LOG === 'true') {
      console.log(`[SMS DEBUG LOG] Student: ${name} (${studentId}), Phone: ${phone}, Code: ${code}`);
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '인증번호가 발송되었습니다.' }),
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
