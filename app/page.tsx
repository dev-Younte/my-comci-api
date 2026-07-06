'use client';

import React, { useState, useEffect } from 'react';

interface Student {
  id: string;
  student_id: string;
  name: string;
  phone: string;
  device_id: string | null;
  is_locked: boolean;
  registered_at: string | null;
  created_at: string;
}

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
  // Authentication States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [globalLoading, setGlobalLoading] = useState(false);

  // Unified Dashboard Navigation Tab
  // 'timetable' = 컴시간 시간표 확인
  // 'students' = 학생 명단 관리
  // 'attendance' = 학생 등하교 기록 관리
  const [dashboardTab, setDashboardTab] = useState<'timetable' | 'students' | 'attendance'>('timetable');

  // Tab 1: Timetable States
  const [schoolCode, setSchoolCode] = useState('27121');
  const [grade, setGrade] = useState('1');
  const [classNum, setClassNum] = useState('1');
  const [scriptUrl, setScriptUrl] = useState('');
  const [date, setDate] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableData, setTimetableData] = useState<ApiResponse | null>(null);
  const [timetableError, setTimetableError] = useState<string | null>(null);
  const [timetableSubTab, setTimetableSubTab] = useState<'timeline' | 'rules' | 'json'>('timeline');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  // Tab 2: Students CRUD States
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [formStudentId, setFormStudentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [smsDisabled, setSmsDisabled] = useState(false);

  // Tab 3: Attendance States & Edit Modal
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [formAttDate, setFormAttDate] = useState('');
  const [formAttType, setFormAttType] = useState('');
  const [formAttTime, setFormAttTime] = useState('');
  const [formAttResult, setFormAttResult] = useState('');
  const [formAttWifiSsid, setFormAttWifiSsid] = useState('');
  const [formAttGpsStatus, setFormAttGpsStatus] = useState('');

  // 1. Initial configuration load & Session restoration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      setSmsDisabled(localStorage.getItem('sms_disabled') === 'true');
    }

    // Set default target date to today (KST)
    const now = new Date();
    const kstOffset = 9 * 60;
    const localOffset = now.getTimezoneOffset();
    const kstTime = new Date(now.getTime() + (kstOffset + localOffset) * 60 * 1000);
    const todayStr = kstTime.toISOString().split('T')[0];
    setDate(todayStr);

    // Retrieve comci timetable settings cache
    const cachedSchoolCode = localStorage.getItem('cfg_schoolCode');
    const cachedGrade = localStorage.getItem('cfg_grade');
    const cachedClassNum = localStorage.getItem('cfg_classNum');
    const cachedScriptUrl = localStorage.getItem('cfg_scriptUrl');

    if (cachedSchoolCode) setSchoolCode(cachedSchoolCode);
    if (cachedGrade) setGrade(cachedGrade);
    if (cachedClassNum) setClassNum(cachedClassNum);
    if (cachedScriptUrl) setScriptUrl(cachedScriptUrl);

    // Auto log in from localStorage token
    const savedToken = localStorage.getItem('admin_basic_token');
    if (savedToken) {
      try {
        const decoded = atob(savedToken);
        const [savedUser, savedPass] = decoded.split(':');
        if (savedUser && savedPass) {
          setUsername(savedUser);
          setPassword(savedPass);
          verifyAndLoad(savedUser, savedPass);
        }
      } catch (e) {
        localStorage.removeItem('admin_basic_token');
      }
    }
  }, []);

  // Fetch data automatically when tab changes
  useEffect(() => {
    if (isAuthenticated) {
      if (dashboardTab === 'attendance') {
        fetchAttendanceRecords();
      } else if (dashboardTab === 'students') {
        verifyAndLoad(username, password);
      }
    }
  }, [isAuthenticated, dashboardTab]);

  // Fetch Attendance Records
  const fetchAttendanceRecords = async (userVal = username, passVal = password) => {
    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${userVal}:${passVal}`);
      const res = await fetch('/api/admin/attendance', {
        headers: { 'Authorization': `Basic ${token}` }
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setAttendanceRecords(result.records || []);
      } else {
        setAuthError(result.message || '출결 데이터를 불러오는데 실패했습니다.');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  // Fetch Students & Auth verification
  const verifyAndLoad = async (userVal: string, passVal: string) => {
    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${userVal}:${passVal}`);
      const res = await fetch('/api/admin/students', {
        headers: { 'Authorization': `Basic ${token}` }
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setIsAuthenticated(true);
        setStudents(result.students || []);
        localStorage.setItem('admin_basic_token', token);
        
        // Load initial attendance as well
        const attendanceRes = await fetch('/api/admin/attendance', {
          headers: { 'Authorization': `Basic ${token}` }
        });
        const attendanceResult = await attendanceRes.json();
        if (attendanceRes.ok && attendanceResult.success) {
          setAttendanceRecords(attendanceResult.records || []);
        }
      } else {
        setAuthError(result.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
        setIsAuthenticated(false);
        localStorage.removeItem('admin_basic_token');
      }
    } catch (e: any) {
      setAuthError('서버 연결 중 오류가 발생했습니다.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setAuthError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    verifyAndLoad(username.trim(), password.trim());
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_basic_token');
    setUsername('');
    setPassword('');
    setIsAuthenticated(false);
    setStudents([]);
    setAttendanceRecords([]);
    setAuthError('');
    setSuccessMsg('');
  };

  // ----------------------------------------------------
  // Timetable Handlers
  // ----------------------------------------------------
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleFetchTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTimetableLoading(true);
    setTimetableError(null);
    setTimetableData(null);

    // Save inputs to localStorage
    localStorage.setItem('cfg_schoolCode', schoolCode);
    localStorage.setItem('cfg_grade', grade);
    localStorage.setItem('cfg_classNum', classNum);
    localStorage.setItem('cfg_scriptUrl', scriptUrl);

    try {
      const params = new URLSearchParams({
        schoolCode,
        grade,
        classNum,
        date,
      });

      if (scriptUrl.trim()) params.append('scriptUrl', scriptUrl.trim());
      if (forceRefresh) params.append('forceRefresh', 'true');

      const res = await fetch(`/api/today-schedule?${params.toString()}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || `HTTP error ${res.status}`);
      }
      setTimetableData(result);
    } catch (err: any) {
      console.error(err);
      setTimetableError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setTimetableLoading(false);
    }
  };

  const apiPath = `/api/today-schedule?schoolCode=${schoolCode}&grade=${grade}&classNum=${classNum}${date ? `&date=${date}` : ''}${scriptUrl ? `&scriptUrl=${encodeURIComponent(scriptUrl)}` : ''}`;
  const fullApiUrl = `${origin}${apiPath}`;

  // ----------------------------------------------------
  // Students CRUD Handlers
  // ----------------------------------------------------
  const openModal = (mode: 'add' | 'edit', student?: Student) => {
    setModalMode(mode);
    setAuthError('');
    setSuccessMsg('');
    if (mode === 'edit' && student) {
      setSelectedStudentId(student.id);
      setFormStudentId(student.student_id);
      setFormName(student.name);
      setFormPhone(student.phone);
    } else {
      setSelectedStudentId(null);
      setFormStudentId('');
      setFormName('');
      setFormPhone('');
    }
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId.trim() || !formName.trim() || !formPhone.trim()) {
      setAuthError('모든 항목을 입력해주세요.');
      return;
    }

    setGlobalLoading(true);
    setAuthError('');
    setSuccessMsg('');

    const url = modalMode === 'add' ? '/api/admin/add' : '/api/admin/update';
    const payload = modalMode === 'add' 
      ? { studentId: formStudentId, name: formName, phone: formPhone }
      : { id: selectedStudentId, studentId: formStudentId, name: formName, phone: formPhone };

    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(result.message || '요청이 성공적으로 처리되었습니다.');
        setIsModalOpen(false);
        verifyAndLoad(username, password);
      } else {
        setAuthError(result.message || '저장에 실패했습니다.');
      }
    } catch (e) {
      setAuthError('네트워크 오류가 발생했습니다.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleDeleteStudent = async (id: string, studentId: string, studentName: string) => {
    if (!confirm(`${studentName} 학생(${studentId}) 정보를 삭제하시겠습니까? 학적 정보와 연동된 출결 내역이 모두 삭제될 수 있습니다.`)) {
      return;
    }

    setGlobalLoading(true);
    setAuthError('');
    setSuccessMsg('');

    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${token}`
        },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(`${studentName} 학생 정보가 삭제되었습니다.`);
        verifyAndLoad(username, password);
      } else {
        setAuthError(result.message || '학생 삭제에 실패했습니다.');
      }
    } catch (e) {
      setAuthError('삭제 요청 중 네트워크 오류가 발생했습니다.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleResetDevice = async (studentId: string, studentName: string) => {
    if (!confirm(`${studentName} 학생(${studentId})의 등록된 기기 정보를 초기화하시겠습니까? 초기화 후에는 학생이 새로운 기기에서 재가입 인증을 다시 할 수 있게 됩니다.`)) {
      return;
    }

    setGlobalLoading(true);
    setAuthError('');
    setSuccessMsg('');
    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${token}`
        },
        body: JSON.stringify({ studentId })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(`${studentName} 학생의 기기 바인딩이 해제되었습니다.`);
        verifyAndLoad(username, password);
      } else {
        setAuthError(result.message || '기기 초기화에 실패했습니다.');
      }
    } catch (e) {
      setAuthError('초기화 요청 중 네트워크 오류가 발생했습니다.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleSmsToggle = (checked: boolean) => {
    localStorage.setItem('sms_disabled', checked ? 'true' : 'false');
    setSmsDisabled(checked);
    setSuccessMsg(checked ? 'SMS 발송 기능이 비활성화되었습니다.' : 'SMS 발송 기능이 활성화되었습니다.');
  };

  const handleOpenAttendanceEditModal = (rec: any) => {
    setSelectedAttendanceId(rec.id);
    setFormAttDate(rec.date);
    setFormAttType(rec.type);
    setFormAttTime(rec.time);
    setFormAttResult(rec.result);
    setFormAttWifiSsid(rec.wifi_ssid || '');
    setFormAttGpsStatus(rec.gps_status || '');
    setIsAttendanceModalOpen(true);
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttendanceId) return;

    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch('/api/admin/attendance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${token}`
        },
        body: JSON.stringify({
          id: selectedAttendanceId,
          date: formAttDate,
          type: formAttType,
          time: formAttTime,
          result: formAttResult,
          wifi_ssid: formAttWifiSsid,
          gps_status: formAttGpsStatus
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setIsAttendanceModalOpen(false);
        setSuccessMsg('출결 기록이 성공적으로 수정되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '출결 기록 수정 실패');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleAttendanceDelete = async (id: string) => {
    if (!confirm('정말로 이 출결 기록을 삭제하시겠습니까?')) return;

    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch(`/api/admin/attendance?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${token}` }
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg('출결 기록이 성공적으로 삭제되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '출결 기록 삭제 실패');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  // ----------------------------------------------------
  // Filters
  // ----------------------------------------------------
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.includes(searchTerm) ||
    student.phone.includes(searchTerm)
  );

  const filteredAttendance = attendanceRecords.filter(rec => 
    rec.student_name.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
    rec.student_id.includes(attendanceSearchTerm) ||
    rec.type.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
    rec.result.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
    rec.date.includes(attendanceSearchTerm)
  );

  const renderLoadingOverlay = () => (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 5, 8, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        <div style={{
          width: '45px',
          height: '45px',
          border: '3px solid rgba(0, 198, 255, 0.1)',
          borderTop: '3px solid #00c6ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span style={{ fontSize: '0.9rem', color: '#00c6ff', fontWeight: 600 }}>데이터 처리 중...</span>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );

  return (
    <div className="admin-page-wrapper">
      <div className="admin-glow-orb-1"></div>
      <div className="admin-glow-orb-2"></div>

      {globalLoading && renderLoadingOverlay()}

      {/* 헤더 */}
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="admin-logo-box">🏫</div>
          <div>
            <div className="admin-header-title">별가람고 스마트 통합 관리 콘솔</div>
            <div className="admin-header-subtitle">MAIN INTEGRATION DASHBOARD</div>
          </div>
        </div>
        {isAuthenticated && (
          <button onClick={handleLogout} className="btn-action">
            🔑 로그아웃
          </button>
        )}
      </header>

      {/* 메인 뷰 */}
      <main className="admin-main">
        {!isAuthenticated ? (
          /* 1. 로그인 잠금 화면 */
          <div className="admin-login-card animate-fade-in">
            <div className="admin-card-header">
              <h2 className="admin-card-title">관리 시스템 로그인</h2>
              <p className="admin-card-desc">
                별가람고 출결 이력 조회 및 시간표 연동 관리를 위해 계정 정보를 입력하세요.
              </p>
            </div>
            
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="admin-input-group" style={{ marginBottom: '10px' }}>
                <label className="admin-input-label">아이디</label>
                <input 
                  type="text"
                  placeholder="관리자 ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="admin-input-text"
                  style={{ textAlign: 'center' }}
                  required
                />
              </div>

              <div className="admin-input-group" style={{ marginBottom: '20px' }}>
                <label className="admin-input-label">비밀번호</label>
                <input 
                  type="password"
                  placeholder="관리자 비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="admin-input-text"
                  style={{ textAlign: 'center' }}
                  required
                />
              </div>

              {authError && (
                <div className="admin-banner admin-banner-error" style={{ justifyContent: 'center' }}>
                  ⚠️ {authError}
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ marginTop: '5px' }}>
                보안 인증 및 접속
              </button>
            </form>
          </div>
        ) : (
          /* 2. 로그인 성공 시 통합 대시보드 화면 */
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 3단 메인 메뉴 탭 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '12px',
              marginBottom: '4px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setDashboardTab('timetable')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: dashboardTab === 'timetable' ? 'rgba(0, 198, 255, 0.12)' : 'transparent',
                  border: '1px solid ' + (dashboardTab === 'timetable' ? 'rgba(0, 198, 255, 0.3)' : 'transparent'),
                  color: dashboardTab === 'timetable' ? '#00c6ff' : 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                📅 컴시간 시간표 확인
              </button>
              <button
                onClick={() => setDashboardTab('students')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: dashboardTab === 'students' ? 'rgba(0, 198, 255, 0.12)' : 'transparent',
                  border: '1px solid ' + (dashboardTab === 'students' ? 'rgba(0, 198, 255, 0.3)' : 'transparent'),
                  color: dashboardTab === 'students' ? '#00c6ff' : 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                👥 학생 명단 관리
              </button>
              <button
                onClick={() => setDashboardTab('attendance')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: dashboardTab === 'attendance' ? 'rgba(0, 198, 255, 0.12)' : 'transparent',
                  border: '1px solid ' + (dashboardTab === 'attendance' ? 'rgba(0, 198, 255, 0.3)' : 'transparent'),
                  color: dashboardTab === 'attendance' ? '#00c6ff' : 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                📝 학생 등하교 기록 관리
              </button>
            </div>

            {/* 피드백 상태 메시지 알림 배너 */}
            {authError && (
              <div className="admin-banner admin-banner-error">
                ⚠️ {authError}
              </div>
            )}
            {successMsg && (
              <div className="admin-banner admin-banner-success">
                ✓ {successMsg}
              </div>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* 탭 1: 컴시간 시간표 연동 확인 */}
            {/* ----------------------------------------------------------------- */}
            {dashboardTab === 'timetable' && (
              <div style={{
                display: 'grid',
                gap: '30px',
                gridTemplateColumns: '1fr'
              }} className="responsive-grid">
                
                {/* 시간표 검색 및 연동 설정 */}
                <section className="glass-panel" style={{ padding: '30px', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>⚙️ 연동 및 학급 설정</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>컴시간 시간표 파싱 정보와 Apps Script URL을 테스트합니다.</p>
                  </div>

                  <form onSubmit={handleFetchTimetable} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>🔗 Google Apps Script 웹앱 링크</label>
                      <input
                        type="url"
                        value={scriptUrl}
                        onChange={(e) => setScriptUrl(e.target.value)}
                        placeholder="기본 서버 환경변수 우선 적용됨"
                        className="admin-input-text"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>🏫 학교 코드</label>
                      <input
                        type="text"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value)}
                        className="admin-input-text"
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>학년</label>
                        <select value={grade} onChange={(e) => setGrade(e.target.value)} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(5, 5, 8, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'white', outline: 'none' }}>
                          <option value="1">1학년</option>
                          <option value="2">2학년</option>
                          <option value="3">3학년</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>학급 (반)</label>
                        <select value={classNum} onChange={(e) => setClassNum(e.target.value)} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(5, 5, 8, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'white', outline: 'none' }}>
                          {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n}반</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📅 조회 기준일</label>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="admin-input-text" required />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" id="forceRefresh" checked={forceRefresh} onChange={(e) => setForceRefresh(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#00c6ff', cursor: 'pointer' }} />
                      <label htmlFor="forceRefresh" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>실시간 새로고침 (Force Cache Bypass)</label>
                    </div>

                    <button type="submit" disabled={timetableLoading} className="btn-primary" style={{ marginTop: '10px' }}>
                      {timetableLoading ? '시간표 로딩 중...' : '⚡ 데이터 연동 테스트'}
                    </button>
                  </form>

                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🔗 앱 참조용 GET API 주소:</h4>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', background: '#090a0f', padding: '10px', borderRadius: '8px', color: 'var(--text-muted)' }}>
                      {apiPath}
                    </div>
                    <button onClick={() => handleCopy(fullApiUrl, 'api-url')} style={{ fontSize: '0.7rem', color: '#00c6ff', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                      {copiedText === 'api-url' ? '✅ 복사 완료!' : '📋 호출 주소 클립보드 복사'}
                    </button>
                  </div>
                </section>

                {/* 시간표 데이터 표시 결과 판넬 */}
                <section className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '400px' }}>
                  {!timetableData && !timetableError && !timetableLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '15px', color: 'var(--text-muted)', textAlign: 'center', padding: '60px 20px' }}>
                      <span style={{ fontSize: '3rem' }}>📡</span>
                      <div>
                        <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '6px' }}>연동 대기 상태</h3>
                        <p style={{ fontSize: '0.8rem', maxWidth: '380px', margin: '0 auto', lineHeight: '1.5' }}>왼쪽 양식 작성 후 [데이터 연동 테스트]를 실행하면 시간표 규칙 분석 내역이 여기에 출력됩니다.</p>
                      </div>
                    </div>
                  )}

                  {timetableLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, padding: '20px 0' }} className="shimmer-bg">
                      <div style={{ height: '40px', width: '40%', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div key={n} style={{ height: '110px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {timetableError && (
                    <div style={{ background: 'rgba(255, 82, 82, 0.08)', border: '1px solid rgba(255, 82, 82, 0.2)', borderRadius: '12px', padding: '20px', display: 'flex', gap: '15px' }}>
                      <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                      <div>
                        <h4 style={{ color: '#ff5252', fontWeight: 600, fontSize: '0.9rem' }}>연동 에러</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{timetableError}</p>
                      </div>
                    </div>
                  )}

                  {timetableData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{timetableData.schoolName}</h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>📅 {timetableData.targetDate} | {timetableData.grade}학년 {timetableData.classNum}반</p>
                        </div>
                        <div style={{ background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.2)', borderRadius: '30px', padding: '6px 14px', fontSize: '#08rem', color: '#00e676', fontWeight: 600 }}>매핑 규칙 활성화됨</div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(['timeline', 'rules', 'json'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setTimetableSubTab(t)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              background: timetableSubTab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                              border: 'none',
                              color: timetableSubTab === t ? 'white' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            {t === 'timeline' ? '📅 교시별 시간표' : t === 'rules' ? '⚙️ 매핑 규칙' : '📄 Raw JSON'}
                          </button>
                        ))}
                      </div>

                      {timetableSubTab === 'timeline' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                          {timetableData.timetable.map((p, i) => (
                            <div key={i} style={{ background: p.장소 && p.장소 !== '교실' ? 'rgba(0, 198, 255, 0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (p.장소 && p.장소 !== '교실' ? 'rgba(0, 198, 255, 0.15)' : 'rgba(255,255,255,0.05)'), borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                <span>{p.교시}교시</span>
                                <span>{p.장소 && p.장소 !== '교실' ? '특별실 수업' : '교실 수업'}</span>
                              </div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{p.과목 || '공란/자율'}</div>
                              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '8px 10px', borderRadius: '8px', fontSize: '0.75rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>📍 수업위치: </span>
                                <span style={{ fontWeight: 600, color: 'white' }}>{p.장소 || '교실'}</span>
                              </div>
                              {p.bssid && (
                                <div style={{ fontSize: '0.7rem', color: '#00e676', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                                  📶 {p.bssid}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {timetableSubTab === 'rules' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px' }}>📍 과목 위치 규칙</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                              {Object.entries(timetableData.locations).map(([sub, loc]) => (
                                <div key={sub} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>{sub}</span>
                                  <span style={{ color: '#00c6ff', fontWeight: 600 }}>{loc}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px' }}>📶 교실 BSSID 정보</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {Object.entries(timetableData.bssids).map(([room, bssid]) => (
                                <div key={room} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                  <span>{room}</span>
                                  <span style={{ fontFamily: 'var(--font-mono)', color: '#00e676' }}>{bssid}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {timetableSubTab === 'json' && (
                        <pre style={{ background: '#090a0f', padding: '16px', borderRadius: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflow: 'auto', maxHeight: '400px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {JSON.stringify(timetableData, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* 탭 2: 학생 명단 관리 (CRUD) */}
            {/* ----------------------------------------------------------------- */}
            {dashboardTab === 'students' && (
              <>
                <div className="admin-control-bar">
                  <div className="admin-search-wrapper">
                    <span>🔍</span>
                    <input 
                      type="text" 
                      placeholder="이름, 학번, 번호로 검색..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="admin-search-input"
                    />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="admin-search-clear">지우기</button>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>SMS 임시 중단</span>
                    <input 
                      type="checkbox" 
                      checked={smsDisabled} 
                      onChange={(e) => handleSmsToggle(e.target.checked)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                  </div>

                  <button onClick={() => openModal('add')} className="btn-add-student">
                    + 신규 학생 사전등록
                  </button>

                  <div className="admin-stat-card">
                    <div>
                      <div className="admin-stat-label">등록 인원</div>
                      <div className="admin-stat-val">{filteredStudents.length} / {students.length} 명</div>
                    </div>
                    <div className="admin-stat-icon">✓</div>
                  </div>
                </div>

                <div className="admin-table-panel">
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '15%' }}>학번</th>
                          <th style={{ width: '15%' }}>이름</th>
                          <th style={{ width: '25%' }}>전화번호</th>
                          <th style={{ width: '25%' }}>바인딩된 기기 ID</th>
                          <th style={{ width: '20%', textAlign: 'center' }}>관리 작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>등록된 학생 정보가 없습니다.</td>
                          </tr>
                        ) : (
                          filteredStudents.map((s) => (
                            <tr key={s.id}>
                              <td className="admin-table-student-id">{s.student_id}</td>
                              <td className="admin-table-name">{s.name}</td>
                              <td className="admin-table-phone">{s.phone}</td>
                              <td>
                                {s.device_id ? (
                                  <span className="badge-device" title={s.device_id}>{s.device_id}</span>
                                ) : (
                                  <span className="badge-unbound">미등록 (인증전)</span>
                                )}
                              </td>
                              <td>
                                <div className="admin-actions-flex">
                                  <button onClick={() => openModal('edit', s)} className="btn-action">수정</button>
                                  {s.device_id ? (
                                    <button onClick={() => handleResetDevice(s.student_id, s.name)} className="btn-action btn-action-warning">기기 해제</button>
                                  ) : (
                                    <button className="btn-action btn-action-disabled" disabled>해제불가</button>
                                  )}
                                  <button onClick={() => handleDeleteStudent(s.id, s.student_id, s.name)} className="btn-action btn-action-danger">삭제</button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* 탭 3: 학생 등하교 기록 관리 */}
            {/* ----------------------------------------------------------------- */}
            {dashboardTab === 'attendance' && (
              <>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
                  <div className="admin-search-wrapper" style={{ flex: 1 }}>
                    <span>🔍</span>
                    <input 
                      type="text" 
                      placeholder="날짜, 학번, 이름, 구분 또는 결과로 검색..." 
                      value={attendanceSearchTerm}
                      onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                      className="admin-search-input"
                    />
                    {attendanceSearchTerm && <button onClick={() => setAttendanceSearchTerm('')} className="admin-search-clear">지우기</button>}
                  </div>
                  <button onClick={() => fetchAttendanceRecords()} className="btn-action" style={{ height: '42px', padding: '0 20px' }}>
                    🔄 새로고침
                  </button>
                </div>

                <div className="admin-table-panel">
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '12%' }}>날짜</th>
                          <th style={{ width: '10%' }}>학번</th>
                          <th style={{ width: '10%' }}>이름</th>
                          <th style={{ width: '10%' }}>구분</th>
                          <th style={{ width: '10%' }}>전송시간</th>
                          <th style={{ width: '12%' }}>WIFI (SSID)</th>
                          <th style={{ width: '11%' }}>GPS 상태</th>
                          <th style={{ width: '8%' }}>결과</th>
                          <th style={{ width: '8%' }}>서버로그</th>
                          <th style={{ width: '9%' }}>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.length === 0 ? (
                          <tr>
                            <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>출결 기록이 존재하지 않습니다.</td>
                          </tr>
                        ) : (
                          filteredAttendance.map((rec) => (
                            <tr key={rec.id}>
                              <td>{rec.date}</td>
                              <td className="admin-table-student-id">{rec.student_id}</td>
                              <td className="admin-table-name">{rec.student_name}</td>
                              <td>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: rec.type.includes('하교') ? 'rgba(255, 82, 82, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                                  color: rec.type.includes('하교') ? '#ff5252' : '#00e676'
                                }}>{rec.type}</span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{rec.time}</td>
                              <td style={{ fontSize: '0.8rem' }} title={`BSSID: ${rec.wifi_bssid}`}>{rec.wifi_ssid}</td>
                              <td style={{ fontSize: '0.8rem', color: rec.gps_status === '교실 위치 일치' ? '#00e676' : 'inherit' }}>{rec.gps_status}</td>
                              <td>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: rec.result === '성공' ? '#00e676' : '#ff5252'
                                }}>{rec.result}</span>
                              </td>
                              <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(rec.created_at).toLocaleTimeString()}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                  <button onClick={() => handleOpenAttendanceEditModal(rec)} className="btn-edit" style={{ padding: '3px 8px', fontSize: '0.75rem', background: '#00c6ff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>수정</button>
                                  <button onClick={() => handleAttendanceDelete(rec.id)} style={{ padding: '3px 8px', fontSize: '0.75rem', background: '#ff5252', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>삭제</button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* CRUD 등록/수정 모달 */}
      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <h3 className="admin-modal-title">{modalMode === 'add' ? '신규 학생 사전등록' : '학생 정보 수정'}</h3>
            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="admin-input-group">
                <label className="admin-input-label">학번 (5자리 고정)</label>
                <input 
                  type="text" 
                  placeholder="예: 10101" 
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="admin-input-text"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">학생 이름</label>
                <input 
                  type="text" 
                  placeholder="예: 홍길동" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="admin-input-text"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">전화번호 (하이픈 제외)</label>
                <input 
                  type="tel" 
                  placeholder="예: 01012345678" 
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="admin-input-text"
                  required
                />
              </div>

              <div className="admin-modal-buttons">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-cancel">취소</button>
                <button type="submit" className="btn-save">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 출결 기록 수정 모달 */}
      {isAttendanceModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <h3 className="admin-modal-title">출결 기록 수정</h3>
            <form onSubmit={handleAttendanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="admin-input-group">
                <label className="admin-input-label">날짜 (yyyy-MM-dd)</label>
                <input 
                  type="text" 
                  placeholder="예: 2026-07-06" 
                  value={formAttDate}
                  onChange={(e) => setFormAttDate(e.target.value)}
                  className="admin-input-text"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">구분 (등교 / 하교 / 지각)</label>
                <select 
                  value={formAttType}
                  onChange={(e) => setFormAttType(e.target.value)}
                  className="admin-input-text"
                  style={{ background: 'var(--bg-card)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '8px' }}
                  required
                >
                  <option value="등교">등교</option>
                  <option value="지각">지각</option>
                  <option value="하교">하교</option>
                </select>
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">전송시간 (HH:mm)</label>
                <input 
                  type="text" 
                  placeholder="예: 08:30" 
                  value={formAttTime}
                  onChange={(e) => setFormAttTime(e.target.value)}
                  className="admin-input-text"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">결과 (성공 / 실패)</label>
                <select 
                  value={formAttResult}
                  onChange={(e) => setFormAttResult(e.target.value)}
                  className="admin-input-text"
                  style={{ background: 'var(--bg-card)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '8px' }}
                  required
                >
                  <option value="성공">성공</option>
                  <option value="실패">실패</option>
                </select>
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">WIFI (SSID)</label>
                <input 
                  type="text" 
                  value={formAttWifiSsid}
                  onChange={(e) => setFormAttWifiSsid(e.target.value)}
                  className="admin-input-text"
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">GPS 상태</label>
                <input 
                  type="text" 
                  value={formAttGpsStatus}
                  onChange={(e) => setFormAttGpsStatus(e.target.value)}
                  className="admin-input-text"
                />
              </div>

              <div className="admin-modal-buttons">
                <button type="button" onClick={() => setIsAttendanceModalOpen(false)} className="btn-cancel">취소</button>
                <button type="submit" className="btn-save">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 푸터 */}
      <footer className="admin-footer">
        © 2026 BYEOLGARAM HIGH SCHOOL SMART SYSTEM
      </footer>
    </div>
  );
}
