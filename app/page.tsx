'use client';

import { useState, useEffect } from 'react';

interface TimetablePeriod {
  교시: number;
  과목: string;
  요일: string;
  장소?: string;
  bssid?: string;
}

interface ApiResponse {
  schoolName: string;
  targetDate: string;
  grade: number;
  classNum: number;
  timetable: TimetablePeriod[];
  locations: Record<string, string>;
  bssids: Record<string, string>;
  error?: string;
}

export default function Home() {
  // Form States
  const [schoolCode, setSchoolCode] = useState('27121');
  const [grade, setGrade] = useState('1');
  const [classNum, setClassNum] = useState('1');
  const [scriptUrl, setScriptUrl] = useState('');
  const [date, setDate] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);

  // UI/Result States
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'rules' | 'json'>('timeline');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  // Initialize values from localStorage on mount (hydration safe)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }

    // Set default target date to today (KST)
    const now = new Date();
    // Convert to KST timezone offset
    const kstOffset = 9 * 60;
    const localOffset = now.getTimezoneOffset();
    const kstTime = new Date(now.getTime() + (kstOffset + localOffset) * 60 * 1000);
    const todayStr = kstTime.toISOString().split('T')[0];
    setDate(todayStr);

    // Retrieve cached values
    const cachedSchoolCode = localStorage.getItem('cfg_schoolCode');
    const cachedGrade = localStorage.getItem('cfg_grade');
    const cachedClassNum = localStorage.getItem('cfg_classNum');
    const cachedScriptUrl = localStorage.getItem('cfg_scriptUrl');

    if (cachedSchoolCode) setSchoolCode(cachedSchoolCode);
    if (cachedGrade) setGrade(cachedGrade);
    if (cachedClassNum) setClassNum(cachedClassNum);
    if (cachedScriptUrl) setScriptUrl(cachedScriptUrl);
  }, []);

  // Sync back to localStorage when values change
  const saveToLocal = (key: string, val: string) => {
    localStorage.setItem(key, val);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);

    // Save inputs to localStorage
    saveToLocal('cfg_schoolCode', schoolCode);
    saveToLocal('cfg_grade', grade);
    saveToLocal('cfg_classNum', classNum);
    saveToLocal('cfg_scriptUrl', scriptUrl);

    try {
      // Build API query parameters
      const params = new URLSearchParams({
        schoolCode,
        grade,
        classNum,
        date,
      });

      if (scriptUrl.trim()) {
        params.append('scriptUrl', scriptUrl.trim());
      }
      if (forceRefresh) {
        params.append('forceRefresh', 'true');
      }

      const res = await fetch(`/api/today-schedule?${params.toString()}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || `HTTP error ${res.status}`);
      }

      setData(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const apiPath = `/api/today-schedule?schoolCode=${schoolCode}&grade=${grade}&classNum=${classNum}${date ? `&date=${date}` : ''}${scriptUrl ? `&scriptUrl=${encodeURIComponent(scriptUrl)}` : ''}`;
  const fullApiUrl = `${origin}${apiPath}`;

  return (
    <main style={{
      maxWidth: '1200px',
      width: '100%',
      margin: '0 auto',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '30px',
      flex: 1
    }}>
      {/* Header Section */}
      <header style={{
        textAlign: 'center',
        padding: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #a0c4ff 0%, #0072ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px',
          marginBottom: '5px'
        }}>
          🏫 Comci Today Hub
        </h1>
        <p style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          maxWidth: '650px',
          lineHeight: '1.6'
        }}>
          컴시간 시간표와 Google Apps Script 위치 BSSID 매핑 규칙을 하나로 합쳐서 제공합니다. 
          아래에 Apps Script 배포 URL과 학급 정보를 입력하여 연동 결과를 확인해보세요.
        </p>
      </header>

      {/* Grid Layout: Config panel vs Results panel */}
      <div style={{
        display: 'grid',
        gap: '30px',
      }} className="responsive-grid">

        {/* Configuration Panel */}
        <section className="glass-panel" style={{
          padding: '30px',
          height: 'fit-content',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.4rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px'
            }}>⚙️ 연동 및 학급 설정</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              조회할 학교, 학급 정보와 Apps Script 주소를 입력합니다.
            </p>
          </div>

          <form onSubmit={handleFetch} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Apps Script URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                🔗 Google Apps Script 웹앱 링크
              </label>
              <input
                type="url"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                빈칸일 경우 서버 기본 환경변수(APPS_SCRIPT_URL)의 주소를 사용합니다.
              </span>
            </div>

            {/* School Code */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                🏫 학교 코드 (5자리)
              </label>
              <input
                type="text"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                placeholder="예: 27121 (별가람고)"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Grade & Class (Row) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Grade (학년)
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#161825',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="1">1학년</option>
                  <option value="2">2학년</option>
                  <option value="3">3학년</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Class (반)
                </label>
                <select
                  value={classNum}
                  onChange={(e) => setClassNum(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#161825',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}반</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                📅 조회 대상 날짜
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Force Refresh Cache Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
              <input
                type="checkbox"
                id="forceRefresh"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--accent-color)',
                  cursor: 'pointer'
                }}
              />
              <label htmlFor="forceRefresh" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                캐시 건너뛰고 실시간 새로고침 (Force Refresh)
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                background: loading ? 'var(--text-muted)' : 'var(--accent-gradient)',
                border: 'none',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '10px'
              }}
              className={loading ? '' : 'animate-pulse-glow'}
            >
              {loading ? (
                <>
                  <svg style={{ animation: 'spin 1s linear infinite', width: '20px', height: '20px' }} viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>데이터 불러오는 중...</span>
                </>
              ) : (
                <>
                  <span>⚡ 데이터 연동 테스트</span>
                </>
              )}
            </button>
          </form>

          {/* Quick API URL Helper */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>🔗 실제 호출용 API 주소:</h4>
            <div style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all',
              background: '#090a0f',
              padding: '10px',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {apiPath}
            </div>
            <button
              onClick={() => handleCopy(fullApiUrl, 'api-url')}
              style={{
                fontSize: '0.75rem',
                color: 'var(--accent-color)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                alignSelf: 'flex-start',
                padding: 0
              }}
            >
              {copiedText === 'api-url' ? '✅ 복사 완료!' : '📋 주소 복사하기'}
            </button>
          </div>
        </section>

        {/* Results Panel */}
        <section className="glass-panel" style={{
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          minHeight: '400px'
        }}>
          {/* Default state when no query run */}
          {!data && !error && !loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: '15px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '60px 20px'
            }}>
              <span style={{ fontSize: '3.5rem' }}>📡</span>
              <div>
                <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '6px', fontWeight: 600 }}>
                  연동 준비 완료
                </h3>
                <p style={{ fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
                  왼쪽 양식에 정보를 입력하고 <strong>[데이터 연동 테스트]</strong> 버튼을 누르시면, 시간표와 장소 매핑 검증 결과를 이곳에서 바로 확인할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* Loading Shimmer State */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, padding: '20px 0' }}>
              <div style={{ height: '40px', width: '50%', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }} className="shimmer-bg" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginTop: '10px' }}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <div key={n} style={{ height: '110px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }} className="shimmer-bg" />
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              background: 'rgba(255, 82, 82, 0.1)',
              border: '1px solid rgba(255, 82, 82, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              color: 'var(--text-primary)',
              marginTop: '10px'
            }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <div>
                <h4 style={{ color: 'var(--error-color)', fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>연동 에러 발생</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{error}</p>
              </div>
            </div>
          )}

          {/* Response Display Data */}
          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
              {/* Header Info Info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '15px',
                paddingBottom: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(0, 114, 255, 0.15)',
                      color: 'var(--accent-color)',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>별가람고</span>
                    <h3 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                      {data.schoolName || '불러온 학교'}
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    📅 {data.targetDate} ({data.timetable[0]?.요일 || '오늘'}) | 👥 {data.grade}학년 {data.classNum}반
                  </p>
                </div>
                
                {/* Result Indicator Badge */}
                <div style={{
                  background: 'rgba(0, 230, 118, 0.12)',
                  border: '1px solid rgba(0, 230, 118, 0.25)',
                  borderRadius: '30px',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--success-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)', display: 'inline-block' }} />
                  성공적으로 매핑됨
                </div>
              </div>

              {/* Navigation Tabs */}
              <div style={{
                display: 'flex',
                gap: '5px',
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '4px',
                borderRadius: '10px',
                width: 'fit-content'
              }}>
                <button
                  onClick={() => setActiveTab('timeline')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: activeTab === 'timeline' ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'timeline' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📅 교시별 시간표
                </button>
                <button
                  onClick={() => setActiveTab('rules')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: activeTab === 'rules' ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'rules' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  ⚙️ 연동된 장소/BSSID 규칙
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: activeTab === 'json' ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'json' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📄 Raw JSON
                </button>
              </div>

              {/* Tab 1: Timeline Periods */}
              {activeTab === 'timeline' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px', marginTop: '10px' }}>
                  {data.timetable.map((period, i) => {
                    const isSpecial = period.장소 && period.장소 !== '교실';
                    const hasBssid = period.bssid && period.bssid !== '';
                    
                    return (
                      <div
                        key={i}
                        style={{
                          background: isSpecial ? 'rgba(0, 114, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSpecial ? '1px solid rgba(0, 114, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '14px',
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Period Accent Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: isSpecial ? 'var(--accent-color)' : 'var(--text-muted)'
                          }}>
                            {period.교시}교시
                          </span>
                          
                          {/* Special room badge */}
                          {isSpecial ? (
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(0, 114, 255, 0.12)',
                              color: '#60a5fa',
                              fontWeight: 600
                            }}>
                              특수교실
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              color: 'var(--text-muted)',
                              fontWeight: 500
                            }}>
                              일반학급
                            </span>
                          )}
                        </div>

                        {/* Subject */}
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
                          {period.과목 || '자율/공란'}
                        </div>

                        {/* Room Location Mapping */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0, 0, 0, 0.15)', padding: '10px 12px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 위치</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {period.장소 || '교실'}
                          </span>
                        </div>

                        {/* BSSID values */}
                        {hasBssid && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0, 230, 118, 0.03)', border: '1px solid rgba(0, 230, 118, 0.1)', padding: '10px 12px', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                              📶 검증 BSSID
                              <button
                                onClick={() => handleCopy(period.bssid || '', `bssid_${period.교시}`)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--success-color)',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                {copiedText === `bssid_${period.교시}` ? '복사됨!' : '복사'}
                              </button>
                            </span>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--success-color)', wordBreak: 'break-all' }}>
                              {period.bssid}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 2: Apps Script Mappings (locations & bssids tables) */}
              {activeTab === 'rules' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '10px' }}>
                  {/* Locations Mapping Section */}
                  <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: '12px', padding: '20px' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📍 과목별 위치 매핑 규칙 (Locations)
                    </h4>
                    {Object.keys(data.locations).length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>가져온 과목 위치 규칙이 없습니다.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                        {Object.entries(data.locations).map(([subject, loc]) => (
                          <div key={subject} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{subject}</span>
                            <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{loc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BSSIDs Rule Section */}
                  <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: '12px', padding: '20px' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📶 교실별 BSSID 값 (BSSIDs)
                    </h4>
                    {Object.keys(data.bssids).length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>가져온 BSSID 값 정보가 없습니다.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(data.bssids).map(([room, bssid]) => (
                          <div key={room} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            border: '1px solid rgba(255,255,255,0.04)'
                          }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{room}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success-color)', fontSize: '0.8rem' }}>{bssid}</span>
                              <button
                                onClick={() => handleCopy(bssid, `bssid_list_${room}`)}
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  cursor: 'pointer'
                                }}
                              >
                                {copiedText === `bssid_list_${room}` ? '복사됨!' : '복사'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: RAW JSON */}
              {activeTab === 'json' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Response Size: {JSON.stringify(data).length} bytes</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(data, null, 2), 'raw-json')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {copiedText === 'raw-json' ? '✅ 복사 완료!' : '📋 JSON 전체 복사'}
                    </button>
                  </div>
                  <pre style={{
                    background: '#090a0f',
                    padding: '20px',
                    borderRadius: '12px',
                    overflowX: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    lineHeight: '1.5',
                    color: '#a9b2c3',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    maxHeight: '500px'
                  }}>{JSON.stringify(data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer style={{
        marginTop: '60px',
        padding: '30px 0',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Powered by Vercel Edge Serverless Functions & Google Sheets API
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          별가람고등학교 컴시간 시간표 및 특별교실 BSSID 통합 위치 매핑 대시보드
        </div>
      </footer>
    </main>
  );
}
