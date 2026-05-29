import { NextResponse } from 'next/server';
import { fetchComciTimetable } from '@/utils/comci-crawler'; // 경로에 맞게 수정

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolCode = searchParams.get('schoolCode');
  const grade = Number(searchParams.get('grade'));
  const classNum = Number(searchParams.get('classNum'));
  const date = searchParams.get('date') || undefined; // YYYY-MM-DD (선택)

  if (!schoolCode || isNaN(grade) || isNaN(classNum)) {
    return NextResponse.json(
      { error: 'schoolCode, grade, classNum 쿼리 파라미터는 필수입니다.' },
      { status: 400 }
    );
  }

  try {
    const timetable = await fetchComciTimetable({
      schoolCode,
      grade,
      classNum,
      targetDate: date
    });
    return NextResponse.json(timetable);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '시간표 조회 중 오류 발생' },
      { status: 500 }
    );
  }
}