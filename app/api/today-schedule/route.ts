import { NextResponse } from 'next/server';
import { fetchComciTimetable, TimetableResult } from '../../../utils/comci-crawler';
import { supabase } from '@/utils/supabase';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// In-memory caches
const timetableCache = new Map<string, CacheEntry<TimetableResult>>();

async function fetchLocationRules(classNum: number, queryScriptUrl?: string | null, forceRefresh: boolean = false): Promise<{ locations: Record<string, string>; bssids: Record<string, string> }> {
  const gradeClass = `1-${String(classNum).padStart(2, '0')}`;
  
  try {
    const { data, error } = await supabase
      .from('subject_locations')
      .select('subject, location')
      .eq('grade_class', gradeClass);

    if (error) {
      throw error;
    }

    const locations: Record<string, string> = {};
    // 기본 과목들 초기값으로 교실 지정
    const defaultSubjects = ["공국", "공영", "공수", "통사", "통과 A", "통과 B", "과탐실", "한국사", "한문", "로봇", "체육", "진로"];
    defaultSubjects.forEach(sub => {
      locations[sub] = "교실";
    });

    if (data) {
      data.forEach((row: { subject: string; location: string }) => {
        locations[row.subject] = row.location;
      });
    }

    // bssids 맵 구성 (기존의 1학년 1반~10반의 BSSID 규칙과 매핑)
    const bssids: Record<string, string> = {
      "제1과학실": "1c:ec:72:11:5a:f8",
      "제2과학실": "1c:ec:72:11:0b:9d",
      "제3과학실": "1c:ec:72:11:0b:a2",
      "창의공학실": "1c:ec:72:11:0b:a7",
      "진로실": "1c:ec:72:11:0b:ca",
      "체육관": "1c:ec:72:11:0b:cf",
      "운동장": "1c:ec:72:11:0b:d4",
      "기타": ""
    };

    const result = { locations, bssids };
    return result;
  } catch (err) {
    console.error("Error fetching location rules from Supabase:", err);
    // Fallback to default locations
    const locations: Record<string, string> = {};
    const defaultSubjects = ["공국", "공영", "공수", "통사", "통과 A", "통과 B", "과탐실", "한국사", "한문", "로봇", "체육", "진로"];
    defaultSubjects.forEach(sub => {
      locations[sub] = "교실";
    });
    return { 
      locations, 
      bssids: {
        "제1과학실": "1c:ec:72:11:5a:f8",
        "제2과학실": "1c:ec:72:11:0b:9d",
        "제3과학실": "1c:ec:72:11:0b:a2",
        "창의공학실": "1c:ec:72:11:0b:a7",
        "진로실": "1c:ec:72:11:0b:ca",
        "체육관": "1c:ec:72:11:0b:cf",
        "운동장": "1c:ec:72:11:0b:d4",
        "기타": ""
      } 
    };
  }
}

async function fetchTimetableData(schoolCode: string, grade: number, classNum: number, dateStr?: string, forceRefresh: boolean = false): Promise<TimetableResult> {
  const kstDateStr = dateStr || new Date().toISOString().split('T')[0]; // Simple fallback
  const cacheKey = `timetable_${schoolCode}_${grade}_${classNum}_${kstDateStr}`;
  const now = Date.now();
  
  if (!forceRefresh) {
    const cached = timetableCache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return cached.data;
    }
  }

  const result = await fetchComciTimetable({
    schoolCode,
    grade,
    classNum,
    targetDate: dateStr
  });

  // Cache the timetable for 10 minutes
  timetableCache.set(cacheKey, {
    data: result,
    expiry: now + 10 * 60 * 1000
  });

  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolCode = searchParams.get('schoolCode') || '27121'; // Default to 별가람고
  const grade = Number(searchParams.get('grade'));
  const classNum = Number(searchParams.get('classNum'));
  const date = searchParams.get('date') || undefined; // YYYY-MM-DD (선택)
  const queryScriptUrl = searchParams.get('scriptUrl');
  const forceRefresh = searchParams.get('forceRefresh') === 'true';

  if (isNaN(grade) || isNaN(classNum)) {
    return NextResponse.json(
      { error: 'grade, classNum 쿼리 파라미터는 필수입니다.' },
      { status: 400 }
    );
  }

  try {
    // 1. 컴시간 시간표 데이터와 구글 시트 위치 정보를 병렬로 비동기 호출
    const [timetableResult, locationResult] = await Promise.all([
      fetchTimetableData(schoolCode, grade, classNum, date, forceRefresh),
      fetchLocationRules(classNum, queryScriptUrl, forceRefresh)
    ]);

    const { locations, bssids } = locationResult;

    // 2. 시간표 각 교시에 위치 매핑
    const mergedTimetable = timetableResult.timetable.map((period) => {
      const subject = period.과목;
      let location = locations[subject] || '교실';

      // 과목 매핑 보완 (한글/영문 대체 명칭 대응)
      if (subject === '통과A' && locations['통과 A']) location = locations['통과 A'];
      if (subject === '통과B' && locations['통과 B']) location = locations['통과 B'];
      if ((subject === '체육' || subject === '체육1' || subject === '체육2') && locations['체육']) location = locations['체육'];
      if ((subject === '진로' || subject === '진로진학' || subject === '진로직업' || subject === '진로활동') && locations['진로']) location = locations['진로'];
      if (subject === '국어' && locations['공국']) location = locations['공국'];
      if (subject === '공국' && locations['국어']) location = locations['국어'];
      if (subject === '영어' && locations['공영']) location = locations['공영'];
      if (subject === '공영' && locations['영어']) location = locations['영어'];
      if (subject === '수학' && locations['공수']) location = locations['공수'];
      if (subject === '공수' && locations['수학']) location = locations['수학'];

      // 동아리 시간 오버라이드
      if (subject === '동아리') {
        location = '창의공학실';
      }

      // 특수교실 BSSID 가져오기
      const specialRooms = ['제1과학실', '제2과학실', '제3과학실', '창의공학실', '진로실'];
      let bssid = '';
      if (specialRooms.includes(location)) {
        bssid = bssids[location] || '';
      }

      return {
        ...period,
        장소: location,
        bssid: bssid
      };
    });

    const responseData = {
      ...timetableResult,
      timetable: mergedTimetable,
      locations,
      bssids
    };

    // CORS 헤더를 명시적으로 세팅하여 외부 앱과의 연동성 보장
    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error: any) {
    console.error('Error combining timetable and locations:', error);
    return NextResponse.json(
      { error: error.message || '데이터 병합 과정에서 오류 발생' },
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
