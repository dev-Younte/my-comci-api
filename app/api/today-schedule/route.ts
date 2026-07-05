import { NextResponse } from 'next/server';
import { fetchComciTimetable, TimetableResult } from '../../../utils/comci-crawler';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// In-memory caches
const timetableCache = new Map<string, CacheEntry<TimetableResult>>();
const locationCache = new Map<string, CacheEntry<{ locations: Record<string, string>; bssids: Record<string, string> }>>();

async function fetchLocationRules(classNum: number, queryScriptUrl?: string | null, forceRefresh: boolean = false): Promise<{ locations: Record<string, string>; bssids: Record<string, string> }> {
  const scriptUrl = queryScriptUrl || process.env.APPS_SCRIPT_URL;
  if (!scriptUrl) {
    console.warn("Apps Script URL is not provided.");
    return { locations: {}, bssids: {} };
  }

  const cacheKey = `loc_${classNum}_${scriptUrl}`;
  const now = Date.now();
  
  if (!forceRefresh) {
    const cached = locationCache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return cached.data;
    }
  }

  // Construct URL
  const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=getLocations&classNum=${classNum}`;
  
  try {
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch from Apps Script (HTTP ${res.status})`);
    }
    const data = await res.json();
    const result = {
      locations: data.locations || {},
      bssids: data.bssids || {}
    };
    
    // Cache the result for 30 minutes
    locationCache.set(cacheKey, {
      data: result,
      expiry: now + 30 * 60 * 1000
    });
    
    return result;
  } catch (error) {
    console.error("Error fetching location rules:", error);
    return { locations: {}, bssids: {} };
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
      if (subject === '체육' && locations['체육1']) location = locations['체육1'];
      if (subject === '체육1' && locations['체육']) location = locations['체육'];
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
