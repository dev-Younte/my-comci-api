/**
 * 컴시간 알리미 (comci.net) 시간표 크롤러 및 디코더 모듈
 * 
 * Vercel Serverless Function (Next.js API Route) 및 Supabase Edge Function (Deno) 환경에서
 * 별도의 외부 라이브러리 의존성 없이 즉시 실행할 수 있도록 표준 Web API(fetch, btoa)만을 사용해 설계되었습니다.
 */

export interface FetchTimetableOptions {
  /** 학교 코드 (예: '27121') */
  schoolCode: string;
  /** 학년 (1, 2, 3) */
  grade: number;
  /** 반 (1, 2, 3, ...) */
  classNum: number;
  /** 
   * 조회하고자 하는 특정 날짜 (예: '2026-05-26' 또는 Date 객체)
   * 생략 시 오늘(현재 서버/클라이언트 로컬 날짜) 기준의 시간표를 반환합니다.
   */
  targetDate?: string | Date;
}

export interface PeriodInfo {
  교시: number;
  과목: string;
  교사: string;
}

export interface TimetableResult {
  schoolCode: string;
  grade: number;
  classNum: number;
  date: string;       // 조회한 날짜 (YYYY-MM-DD)
  weekday: string;    // 요일명 (월~금)
  updateTime: string; // 컴시간 서버 최종 수정 시간 (자료244)
  weekStart: string;  // 시간표 주간 시작일 (시작일)
  timetable: PeriodInfo[];
}

/**
 * 컴시간 시간표 원본 JSON 데이터 구조 인터페이스
 */
interface ComciRawData {
  자료147: (number | string)[][][][]; // 일일/변경 시간표 [grade][class][day][period]
  자료481?: (number | string)[][][][]; // 원래/기본 시간표
  자료492: string[];                  // 과목 리스트
  자료446: string[];                  // 교사 성명 리스트
  분리?: number;                       // 과목-교사 디코딩 경계값 (기본값 100)
  시작일: string;                     // 해당 시간표 주간 시작 날짜 (YYYY-MM-DD)
  오늘r: number;                      // 서버 추천 주간 인덱스
  학급수: number[];                   // 학년별 학급수
  가상학급수: number[];               // 학년별 가상학급수
  자료244: string;                    // 최종 수정일시 (예: '2026-05-26 11:15:50')
}

/**
 * 교차 환경 호환 Base64 인코더
 */
function base64Encode(str: string): string {
  if (typeof btoa === 'function') {
    return btoa(str);
  }
  // Node.js 환경 백업
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64');
  }
  throw new Error('Base64 encoding is not supported in this environment.');
}

/**
 * 교사 성명 내부에 포함된 불필요한 별표(*) 문자 제거 및 정제
 */
function cleanTeacherName(name: string | undefined): string {
  if (!name) return '';
  // 컴시간의 성명 정제 로직 Q성명 복제
  if ((name.includes('*') && !name.startsWith('*') && !name.endsWith('*')) || (name.length === 2 && name[1] === '*')) {
    return name;
  }
  return name.replace(/\*/g, '');
}

/**
 * 지정된 날짜의 요일(weekday) 인덱스 계산 (1: 월, 2: 화, 3: 수, 4: 목, 5: 금, 6: 토, 0: 일)
 * 컴시간 주간 시작일(Monday)과의 날짜 차이를 정밀 계산하여 타임존 오차를 원천 차단합니다.
 */
function calculateWeekday(targetDate: Date, weekStartDateStr: string): number {
  const weekStart = new Date(weekStartDateStr);
  
  // 연/월/일만 추출하여 자정 기준으로 차이 계산 (시차/타임존 왜곡 방지)
  const utcTarget = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const utcStart = Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  
  const diffDays = Math.round((utcTarget - utcStart) / (1000 * 60 * 60 * 24));
  
  // 시작일(월요일)로부터 며칠이 지났는지를 기반으로 1-indexed 요일 환산
  // 월요일(diff 0) -> 1, 화요일(diff 1) -> 2, ..., 금요일(diff 4) -> 5
  return diffDays + 1;
}

/**
 * 컴시간 알리미 서버로부터 시간표를 수집하고 파싱합니다.
 */
export async function fetchComciTimetable(options: FetchTimetableOptions): Promise<TimetableResult> {
  const { schoolCode, grade, classNum } = options;
  const targetDateObj = options.targetDate 
    ? (options.targetDate instanceof Date ? options.targetDate : new Date(options.targetDate))
    : new Date();

  // 1. 컴시간 서버 통신용 쿼리 인코딩 및 URL 준비
  const prefix = '73629_'; // 학생용 기본 고정 접두사
  const da1 = '0';         // 항상 최신 원본 데이터를 실시간으로 강제 수신하기 위해 '0'으로 설정 (캐시 회피)
  const r = '1';           // 이번 주 시간표 강제 지정
  
  const queryStr = `${prefix}${schoolCode}_${da1}_${r}`;
  const encodedQuery = base64Encode(queryStr);
  const url = `http://comci.net:4082/36179?${encodedQuery}`;

  // 2. 컴시간 보안 검증 통과용 헤더 세팅
  const headers = {
    'Accept': '*/*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Referer': 'http://comci.net:4082/st',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest'
  };

  // 3. HTTP fetch 요청 전송
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`컴시간 서버 통신에 실패했습니다. (HTTP Status: ${response.status})`);
  }

  const rawText = await response.text();
  
  // 4. JSON 응답 분리 및 파싱
  const lastBraceIndex = rawText.lastIndexOf('}');
  if (lastBraceIndex === -1) {
    throw new Error('컴시간 서버로부터 올바르지 않은 응답 형식을 수신했습니다.');
  }
  
  const cleanJsonText = rawText.substring(0, lastBraceIndex + 1);
  const data: ComciRawData = JSON.parse(cleanJsonText);

  if (!data.자료147 || !data.자료492 || !data.자료446) {
    throw new Error('시간표 핵심 데이터 배열(자료147/492/446) 누락으로 파싱을 중단합니다.');
  }

  // 5. 조회 대상일의 요일 인덱스 분석
  const weekdayIndex = calculateWeekday(targetDateObj, data.시작일);
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const formattedDate = targetDateObj.toISOString().split('T')[0];
  const targetDayOfWeek = targetDateObj.getDay(); // JS의 실제 요일 (0: 일, 1: 월, ..., 6: 토)
  const weekdayName = dayNames[targetDayOfWeek];

  const result: TimetableResult = {
    schoolCode,
    grade,
    classNum,
    date: formattedDate,
    weekday: weekdayName,
    updateTime: data.자료244,
    weekStart: data.시작일,
    timetable: []
  };

  // 주말(토, 일)이거나 요일 매핑 범위(1~5)를 벗어난 공휴일의 경우 빈 수업 결과 즉시 반환
  if (weekdayIndex < 1 || weekdayIndex > 5) {
    return result;
  }

  // 6. 학급 시간표 디코딩 처리
  const gradeData = data.자료147[grade];
  if (!gradeData) {
    throw new Error(`존재하지 않는 학년입니다: ${grade}학년`);
  }

  const classData = gradeData[classNum];
  if (!classData) {
    throw new Error(`존재하지 않는 학급(반)입니다: ${classNum}반`);
  }

  const dayData = classData[weekdayIndex];
  // 해당 요일에 아예 수업이 등록되어 있지 않은 경우 (예: 대체공휴일 등)
  if (!dayData || dayData.length <= 1) {
    return result;
  }

  const separator = data.분리 !== undefined ? data.분리 : 100;
  const maxPeriods = dayData[0] as number; // 0번 인덱스는 해당 요일의 총 수업 교시 수

  for (let period = 1; period <= maxPeriods; period++) {
    const rawCellValue = dayData[period];
    if (rawCellValue === undefined || rawCellValue === null) {
      continue;
    }

    let valStr = String(rawCellValue);
    // 수업 변경 기호(>) 접두어 제거
    if (valStr.startsWith('>')) {
      valStr = valStr.substring(1);
    }

    const val = Number(valStr);
    // 빈 교시인 경우 패스
    if (val === 0 || isNaN(val)) {
      continue;
    }

    // 7. 셀 인덱스 추출 수학적 디코딩
    // 예: 91058 -> th (교사) = 58, sb (과목) = Math.floor(91058/1000) = 91 -> 91 % 100 = 91
    const thIndex = val % 1000;
    const rawSb = Math.floor(val / 1000);
    const sbIndex = rawSb % separator;

    const rawSubjectName = data.자료492[sbIndex] || '';
    const rawTeacherName = data.자료446[thIndex] || '';

    result.timetable.push({
      교시: period,
      과목: rawSubjectName,
      교사: cleanTeacherName(rawTeacherName)
    });
  }

  return result;
}
