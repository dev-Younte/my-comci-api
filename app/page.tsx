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
  // 'locations' = 수업 위치 정보
  // 'students' = 학생 명단 관리
  // 'attendance' = 학생 등하교 기록 관리
  const [dashboardTab, setDashboardTab] = useState<'timetable' | 'locations' | 'students' | 'attendance' | 'deleted_attendance'>('timetable');

  // Tab: Classroom Locations States
  const [locationsList, setLocationsList] = useState<any[]>([]);
  const [selectedLocationClass, setSelectedLocationClass] = useState<string | null>(null); // e.g. "1-01"
  const [formLocations, setFormLocations] = useState<Record<string, string>>({}); // { subject: location }

  // Tab 1: Timetable States
  const [schoolCode, setSchoolCode] = useState('27121');
  const [grade, setGrade] = useState('1');
  const [classNum, setClassNum] = useState('1');
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
  const [successVisible, setSuccessVisible] = useState(false);
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
  const [selectedAttRecord, setSelectedAttRecord] = useState<any | null>(null);
  const [formAttType, setFormAttType] = useState('');
  const [selectedAttIds, setSelectedAttIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedAttIds([]);
  }, [dashboardTab]);

  useEffect(() => {
    if (successMsg) {
      setSuccessVisible(true);
      const fadeTimer = setTimeout(() => {
        setSuccessVisible(false);
      }, 4500);
      const clearTimer = setTimeout(() => {
        setSuccessMsg('');
      }, 5000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [successMsg]);

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

    if (cachedSchoolCode) setSchoolCode(cachedSchoolCode);
    if (cachedGrade) setGrade(cachedGrade);
    if (cachedClassNum) setClassNum(cachedClassNum);

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
      if (dashboardTab === 'attendance' || dashboardTab === 'deleted_attendance') {
        fetchAttendanceRecords();
      } else if (dashboardTab === 'students') {
        verifyAndLoad(username, password);
      } else if (dashboardTab === 'locations') {
        fetchLocations();
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

  // Fetch Subject Locations
  const fetchLocations = async (userVal = username, passVal = password) => {
    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${userVal}:${passVal}`);
      const res = await fetch('/api/admin/locations', {
        headers: { 'Authorization': `Basic ${token}` }
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setLocationsList(result.records || []);
      } else {
        setAuthError(result.message || '수업 위치 데이터를 불러오는데 실패했습니다.');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  // Save Subject Locations
  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationClass) return;

    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch('/api/admin/locations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${token}`
        },
        body: JSON.stringify({
          gradeClass: selectedLocationClass,
          locations: formLocations
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSelectedLocationClass(null);
        setSuccessMsg('수업 위치 정보가 성공적으로 저장되었습니다.');
        fetchLocations();
      } else {
        setAuthError(result.message || '수업 위치 저장 실패');
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

    try {
      const params = new URLSearchParams({
        schoolCode,
        grade,
        classNum,
        date,
      });

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

  const apiPath = `/api/today-schedule?schoolCode=${schoolCode}&grade=${grade}&classNum=${classNum}${date ? `&date=${date}` : ''}`;
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

  const handleOpenAttendanceDetailModal = (rec: any) => {
    setSelectedAttRecord(rec);
    setFormAttType(rec.type === '지각' ? '미인정 지각' : rec.type);
    setIsAttendanceModalOpen(true);
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttRecord) return;

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
          id: selectedAttRecord.id,
          type: formAttType
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setIsAttendanceModalOpen(false);
        setSuccessMsg('출결 구분 정보가 성공적으로 수정되었습니다.');
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
    if (!confirm('정말로 이 출결 기록을 휴지통으로 이동하시겠습니까?')) return;

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
        setSuccessMsg('출결 기록이 휴지통으로 이동되었습니다.');
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

  const handleAttendanceRevert = async (id: string) => {
    if (!confirm('정말로 이 출결 기록을 원상복귀하시겠습니까? 수정 전의 원래 값으로 복구됩니다.')) return;

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
        body: JSON.stringify({ id, action: 'revert' })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg('출결 기록이 수정 전 원래 데이터로 복구되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '원상복귀 실패');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleAttendanceRestore = async (id: string) => {
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
        body: JSON.stringify({ id, action: 'restore' })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg('기록이 정상 복원되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '기록 복원 실패');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleAttendancePermanentDelete = async (id: string) => {
    if (!confirm('정말로 이 출결 기록을 영구 삭제하시겠습니까? 이 작업은 절대 되돌릴 수 없습니다.')) return;

    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch(`/api/admin/attendance?id=${id}&permanent=true`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${token}` }
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg('기록이 최종 영구 삭제되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '기록 영구 삭제 실패');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`선택한 ${selectedAttIds.length}개 기록을 휴지통으로 이동하시겠습니까?`)) return;
    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch(`/api/admin/attendance?id=${selectedAttIds.join(',')}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${token}` }
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSelectedAttIds([]);
        setSuccessMsg('선택한 기록들이 휴지통으로 이동되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '삭제 실패');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleBatchRevert = async () => {
    if (!confirm(`선택한 ${selectedAttIds.length}개 기록을 원래 상태로 원상복귀하시겠습니까?\n수정 전의 원래 값으로 복구됩니다.`)) return;
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
        body: JSON.stringify({ id: selectedAttIds, action: 'revert' })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSelectedAttIds([]);
        setSuccessMsg('선택한 기록들이 원래 값으로 복구되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '원상복귀 실패');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleBatchRestore = async () => {
    if (!confirm(`선택한 ${selectedAttIds.length}개 기록을 활성 상태로 복원하시겠습니까?`)) return;
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
        body: JSON.stringify({ id: selectedAttIds, action: 'restore' })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSelectedAttIds([]);
        setSuccessMsg('선택한 기록들이 정상 복원되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '기록 복원 실패');
      }
    } catch (e) {
      setAuthError('서버 연결 오류');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleBatchPermanentDelete = async () => {
    if (!confirm(`선택한 ${selectedAttIds.length}개 기록을 영구 삭제하시겠습니까?\n이 작업은 절대 되돌릴 수 없습니다.`)) return;
    setGlobalLoading(true);
    setAuthError('');
    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch(`/api/admin/attendance?id=${selectedAttIds.join(',')}&permanent=true`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${token}` }
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSelectedAttIds([]);
        setSuccessMsg('선택한 기록들이 최종 영구 삭제되었습니다.');
        fetchAttendanceRecords();
      } else {
        setAuthError(result.message || '영구 삭제 실패');
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

  const filteredAttendance = attendanceRecords
    .filter(rec => {
      if (dashboardTab === 'deleted_attendance') {
        return !!rec.deleted_at;
      }
      return !rec.deleted_at;
    })
    .filter(rec => 
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

  const getTypeBadgeStyle = (typeStr: string) => {
    if (typeStr.includes('정시등교') || typeStr.includes('정시 등교') || typeStr.includes('하교')) {
      return {
        background: 'rgba(0, 230, 118, 0.1)',
        color: '#00e676',
        border: '1px solid rgba(0, 230, 118, 0.2)'
      };
    } else if (typeStr === '등교') {
      return {
        background: 'rgba(0, 198, 255, 0.1)',
        color: '#00c6ff',
        border: '1px solid rgba(0, 198, 255, 0.2)'
      };
    } else if (typeStr.includes('미인정 지각') || typeStr.includes('미인정 조퇴') || typeStr === '지각') {
      return {
        background: 'rgba(255, 82, 82, 0.1)',
        color: '#ff5252',
        border: '1px solid rgba(255, 82, 82, 0.2)'
      };
    } else if (typeStr.includes('인정 지각') || typeStr.includes('인정 조퇴')) {
      return {
        background: 'rgba(255, 196, 0, 0.1)',
        color: '#ffc400',
        border: '1px solid rgba(255, 196, 0, 0.2)'
      };
    } else {
      return {
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'rgba(255, 255, 255, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      };
    }
  };

  const renderResultCell = (resultStr: string, typeStr: string) => {
    const isSuccess = resultStr.includes('성공');
    const isFailure = resultStr.includes('실패');
    const color = isSuccess ? '#00e676' : (isFailure ? '#ff5252' : '#ffffff');
    const displayType = typeStr === '지각' ? '미인정 지각' : typeStr;
    
    if (isSuccess) {
      let subtext = '';
      if (resultStr.includes('자동')) {
        subtext = `(자동 ${displayType})`;
      } else if (resultStr.includes('수동') || resultStr.includes('원클릭')) {
        subtext = `(수동 ${displayType})`;
      } else {
        subtext = `(수동 ${displayType})`;
      }
      return (
        <div style={{ color, fontWeight: 700, lineHeight: '1.2', textAlign: 'center' }}>
          <div>성공</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.8, marginTop: '2.5px', whiteSpace: 'pre-line' }}>{subtext}</div>
        </div>
      );
    } else if (isFailure) {
      let reason = '';
      const match = resultStr.match(/\(([^)]+)\)/);
      if (match) {
        reason = `(${match[1]})`;
      } else {
        reason = '(오류)';
      }
      return (
        <div style={{ color, fontWeight: 700, lineHeight: '1.2', textAlign: 'center' }}>
          <div>실패</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.8, marginTop: '2.5px', whiteSpace: 'pre-line' }}>{reason}</div>
        </div>
      );
    } else {
      return <span style={{ color }}>{resultStr}</span>;
    }
  };

  const getBssidClassName = (bssid: string) => {
    if (!bssid) return '알 수 없음 (연결 정보 없음)';
    const normalized = bssid.toLowerCase().trim();
    const mapping: { [key: string]: string } = {
      "1c:ec:72:11:5a:f8": "1학년 1반",
      "1c:ec:72:11:0b:9d": "1학년 2반",
      "1c:ec:72:11:0b:a2": "1학년 3반",
      "1c:ec:72:11:0b:a7": "1학년 4반",
      "1c:ec:72:11:0b:ca": "1학년 5반",
      "1c:ec:72:11:0b:cf": "1학년 6반",
      "1c:ec:72:11:0b:d4": "1학년 7반",
      "1c:ec:72:11:0b:d9": "1학년 8반",
      "1c:ec:72:11:0b:de": "1학년 9반",
      "0a:29:d5:4b:9c:20": "1학년 10반"
    };
    return mapping[normalized] || `알 수 없는 위치 (BSSID: ${bssid})`;
  };

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
                onClick={() => setDashboardTab('locations')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: dashboardTab === 'locations' ? 'rgba(0, 198, 255, 0.12)' : 'transparent',
                  border: '1px solid ' + (dashboardTab === 'locations' ? 'rgba(0, 198, 255, 0.3)' : 'transparent'),
                  color: dashboardTab === 'locations' ? '#00c6ff' : 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                📍 수업 위치 정보
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
              <button
                onClick={() => setDashboardTab('deleted_attendance')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: dashboardTab === 'deleted_attendance' ? 'rgba(255, 82, 82, 0.12)' : 'transparent',
                  border: '1px solid ' + (dashboardTab === 'deleted_attendance' ? 'rgba(255, 82, 82, 0.3)' : 'transparent'),
                  color: dashboardTab === 'deleted_attendance' ? '#ff5252' : 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                🗑️ 삭제된 기록 관리
              </button>
            </div>

            {/* 피드백 상태 메시지 알림 배너 */}
            {authError && (
              <div className="admin-banner admin-banner-error">
                ⚠️ {authError}
              </div>
            )}
            {successMsg && (
              <div 
                className="admin-banner admin-banner-success"
                style={{
                  position: 'fixed',
                  top: '101px',
                  right: 'max(24px, calc(50% - 550px + 24px))',
                  zIndex: 99,
                  margin: 0,
                  maxWidth: '380px',
                  background: 'rgba(13, 27, 24, 0.95)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(0, 230, 118, 0.3)',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
                  opacity: successVisible ? 1 : 0,
                  transform: successVisible ? 'translateY(0) scale(1)' : 'translateY(-45px) scale(0.95)',
                  transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              >
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
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>컴시간 시간표와 Supabase 수업 위치 병합 정보를 테스트합니다.</p>
                  </div>

                  <form onSubmit={handleFetchTimetable} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
            {/* 📍 수업 위치 정보 탭 */}
            {/* ----------------------------------------------------------------- */}
            {dashboardTab === 'locations' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>📍 학급별 수업 위치 설정</h3>
                  <button onClick={() => fetchLocations()} className="btn-action">
                    🔄 새로고침
                  </button>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '20px', 
                  marginBottom: '30px'
                }}>
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const classNumInt = idx + 1;
                    const classId = `1-${String(classNumInt).padStart(2, '0')}`;
                    const className = `1학년 ${classNumInt}반`;
                    
                    // 해당 반의 기존 커스텀 위치 정보 필터링
                    const classLocs = locationsList.filter(l => l.grade_class === classId && l.location !== '교실');

                    return (
                      <div 
                        key={classId} 
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: '20px',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minHeight: '180px',
                          transition: 'transform 0.2s',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          const currentLocs = locationsList.filter(l => l.grade_class === classId);
                          const initialForm: Record<string, string> = {};
                          const defaultSubjects = ["공국", "공영", "공수", "통사", "통과 A", "통과 B", "과탐실", "한국사", "한문", "로봇", "체육", "진로"];
                          defaultSubjects.forEach(sub => {
                            const match = currentLocs.find(l => l.subject === sub);
                            initialForm[sub] = match ? match.location : "교실";
                          });
                          setFormLocations(initialForm);
                          setSelectedLocationClass(classId);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#00c6ff', fontWeight: 'bold' }}>{className}</h4>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>{classId}</span>
                          </div>
                          
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                            {classLocs.length === 0 ? (
                              <p style={{ margin: 0, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>모든 과목 위치가 "교실"로 지정되어 있습니다.</p>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                {classLocs.map(loc => (
                                  <span 
                                    key={loc.id} 
                                    style={{
                                      background: 'rgba(0, 198, 255, 0.1)',
                                      color: '#00c6ff',
                                      border: '1px solid rgba(0, 198, 255, 0.2)',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    {loc.subject}: {loc.location}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <button 
                          style={{
                            marginTop: '20px',
                            background: 'rgba(0, 198, 255, 0.15)',
                            border: '1px solid rgba(0, 198, 255, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            color: '#00c6ff',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                            transition: 'all 0.2s'
                          }}
                        >
                          📍 수업 위치 설정 / 수정
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* 탭 2: 학생 명단 관리 (CRUD) */}
            {/* ----------------------------------------------------------------- */}
            {dashboardTab === 'students' && (
              <>
                {/* 최상단 컨트롤 (1줄 병합): 학생 정보 검색, SMS 전송, 등록 학생 수, 신규 등록 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  gap: '12px', 
                  marginBottom: '20px',
                  flexWrap: 'wrap'
                }}>
                  {/* 검색창 */}
                  <div className="admin-search-wrapper" style={{ flex: '2 1 240px', margin: 0, height: '46px' }}>
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

                  {/* SMS 전송 상태 토글 버튼 */}
                  <button 
                    type="button"
                    onClick={() => handleSmsToggle(!smsDisabled)}
                    style={{
                      background: smsDisabled ? 'rgba(255, 76, 76, 0.12)' : 'rgba(0, 230, 118, 0.12)',
                      border: `1px solid ${smsDisabled ? 'rgba(255, 76, 76, 0.3)' : 'rgba(0, 230, 118, 0.25)'}`,
                      borderRadius: '12px',
                      padding: '10px 16px',
                      color: smsDisabled ? '#ff4c4c' : '#00e676',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      height: '46px',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = smsDisabled ? 'rgba(255, 76, 76, 0.18)' : 'rgba(0, 230, 118, 0.18)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = smsDisabled ? 'rgba(255, 76, 76, 0.12)' : 'rgba(0, 230, 118, 0.12)';
                    }}
                  >
                    <span>💬 SMS 전송:</span>
                    <span style={{ 
                      background: smsDisabled ? '#ff4c4c' : '#00e676', 
                      color: '#000', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 800
                    }}>
                      {smsDisabled ? '임시 중단됨' : '정상 작동중'}
                    </span>
                  </button>

                  {/* 등록 인원 현황 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    fontSize: '0.8rem',
                    height: '46px',
                    whiteSpace: 'nowrap'
                  }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>👥 등록된 학생:</span>
                    <span style={{ color: '#00c6ff', fontWeight: 'bold' }}>{filteredStudents.length} / {students.length} 명</span>
                  </div>

                  {/* 신규 등록 버튼 */}
                  <button onClick={() => openModal('add')} className="btn-add-student" style={{ margin: 0, height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', padding: '0 16px' }}>
                    + 신규 학생 사전등록
                  </button>
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
            {/* 탭 3 & 4: 학생 등하교 기록 관리 및 삭제된 기록 관리 */}
            {/* ----------------------------------------------------------------- */}
            {(dashboardTab === 'attendance' || dashboardTab === 'deleted_attendance') && (
              <>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
                  <div className="admin-search-wrapper" style={{ flex: 1 }}>
                    <span>🔍</span>
                    <input 
                      type="text" 
                      placeholder={dashboardTab === 'deleted_attendance' ? "삭제된 날짜, 학번, 이름, 구분 또는 결과로 검색..." : "날짜, 학번, 이름, 구분 또는 결과로 검색..."}
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

                {selectedAttIds.length > 0 && (
                  <div style={{
                    background: 'rgba(0, 198, 255, 0.05)',
                    border: '1px solid rgba(0, 198, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animation: 'fadeIn 0.2s ease-out'
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                      선택된 기록: <strong style={{ color: '#00c6ff', fontSize: '1rem' }}>{selectedAttIds.length}</strong>개
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {dashboardTab === 'attendance' ? (
                        <>
                          {filteredAttendance.filter(r => selectedAttIds.includes(r.id)).every(r => r.original_record) && (
                            <button 
                              onClick={handleBatchRevert} 
                              style={{ 
                                padding: '8px 16px', 
                                fontSize: '0.8rem', 
                                background: '#ff9100', 
                                color: '#fff', 
                                border: 'none', 
                                borderRadius: '6px', 
                                cursor: 'pointer', 
                                fontWeight: 'bold' 
                              }}
                            >
                              🔄 선택 원상복귀
                            </button>
                          )}
                          <button 
                            onClick={handleBatchDelete} 
                            style={{ 
                              padding: '8px 16px', 
                              fontSize: '0.8rem', 
                              background: '#ff5252', 
                              color: '#fff', 
                              border: 'none', 
                              borderRadius: '6px', 
                              cursor: 'pointer', 
                              fontWeight: 'bold' 
                            }}
                          >
                            🗑️ 선택 삭제 (휴지통 이동)
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={handleBatchRestore} 
                            style={{ 
                              padding: '8px 16px', 
                              fontSize: '0.8rem', 
                              background: '#00e676', 
                              color: '#fff', 
                              border: 'none', 
                              borderRadius: '6px', 
                              cursor: 'pointer', 
                              fontWeight: 'bold' 
                            }}
                          >
                            🟢 선택 복원
                          </button>
                          <button 
                            onClick={handleBatchPermanentDelete} 
                            style={{ 
                              padding: '8px 16px', 
                              fontSize: '0.8rem', 
                              background: '#ff5252', 
                              color: '#fff', 
                              border: 'none', 
                              borderRadius: '6px', 
                              cursor: 'pointer', 
                              fontWeight: 'bold' 
                            }}
                          >
                            🗑️ 선택 영구 삭제
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="admin-table-panel">
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '5%', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={filteredAttendance.length > 0 && selectedAttIds.length === filteredAttendance.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttIds(filteredAttendance.map(r => r.id));
                                } else {
                                  setSelectedAttIds([]);
                                }
                              }}
                              style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                            />
                          </th>
                          <th style={{ width: '15%' }}>날짜</th>
                          <th style={{ width: '12%' }}>학번</th>
                          <th style={{ width: '15%' }}>이름</th>
                          <th style={{ width: '13%' }}>구분</th>
                          <th style={{ width: '13%' }}>전송 시간</th>
                          <th style={{ width: '17%' }}>결과</th>
                          <th style={{ width: '10%' }}>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>출결 기록이 존재하지 않습니다.</td>
                          </tr>
                        ) : (
                          filteredAttendance.map((rec) => (
                            <tr key={rec.id}>
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedAttIds.includes(rec.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedAttIds(prev => [...prev, rec.id]);
                                    } else {
                                      setSelectedAttIds(prev => prev.filter(id => id !== rec.id));
                                    }
                                  }}
                                  style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                />
                              </td>
                              <td>{rec.date}</td>
                              <td className="admin-table-student-id">{rec.student_id}</td>
                              <td className="admin-table-name">
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span>{rec.student_name}</span>
                                  {rec.original_record && (
                                    <span style={{ fontSize: '0.7rem', color: '#ff9100', marginTop: '2px', fontWeight: 'bold' }}>(수정됨)</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  ...getTypeBadgeStyle(rec.type)
                                }}>{rec.type === '지각' ? '미인정 지각' : rec.type}</span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{rec.time}</td>
                              <td>{renderResultCell(rec.result, rec.type === '지각' ? '미인정 지각' : rec.type)}</td>
                              <td>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <button onClick={() => handleOpenAttendanceDetailModal(rec)} className="btn-edit" style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(0, 198, 255, 0.15)', color: '#00c6ff', border: '1px solid rgba(0, 198, 255, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>상세정보</button>
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

      {/* 수업 위치 편집 모달 */}
      {selectedLocationClass && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card" style={{ maxWidth: '650px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 className="admin-modal-title" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
              📍 {selectedLocationClass === '1-10' ? '1학년 10반' : `1학년 ${selectedLocationClass.split('-')[1].replace(/^0/, '')}반`} 과목별 수업 위치 설정
            </h3>
            
            <form onSubmit={handleLocationSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ overflowY: 'auto', paddingRight: '6px', flex: 1, marginBottom: '20px' }}>
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%', textAlign: 'left', paddingLeft: '12px' }}>과목 이름</th>
                      <th style={{ width: '60%', textAlign: 'left', paddingLeft: '12px' }}>수업 진행 위치 지정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["공국", "공영", "공수", "통사", "통과 A", "통과 B", "과탐실", "한국사", "한문", "로봇", "체육", "진로"].map(sub => (
                      <tr key={sub}>
                        <td style={{ textAlign: 'left', paddingLeft: '12px', fontWeight: 'bold' }}>{sub}</td>
                        <td style={{ textAlign: 'left', paddingLeft: '12px' }}>
                          <select 
                            value={formLocations[sub] || '교실'}
                            onChange={(e) => setFormLocations({
                              ...formLocations,
                              [sub]: e.target.value
                            })}
                            className="admin-input-text"
                            style={{ 
                              background: 'var(--bg-card)', 
                              color: '#fff', 
                              border: '1px solid rgba(255,255,255,0.1)', 
                              padding: '6px 12px', 
                              borderRadius: '6px',
                              width: '100%',
                              maxWidth: '220px'
                            }}
                          >
                            <option value="교실">교실</option>
                            <option value="제1과학실">제1과학실</option>
                            <option value="제2과학실">제2과학실</option>
                            <option value="제3과학실">제3과학실</option>
                            <option value="창의공학실">창의공학실</option>
                            <option value="진로실">진로실</option>
                            <option value="체육관">체육관</option>
                            <option value="운동장">운동장</option>
                            <option value="기타">기타</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-modal-buttons" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setSelectedLocationClass(null)} className="btn-cancel">취소</button>
                <button type="submit" className="btn-save">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
      {isAttendanceModalOpen && selectedAttRecord && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card" style={{ maxWidth: '580px', width: '90%' }}>
            <h3 className="admin-modal-title">출결 상세정보</h3>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '150px 1fr', 
              gap: '12px', 
              background: 'rgba(255, 255, 255, 0.02)', 
              padding: '20px', 
              borderRadius: '10px', 
              border: '1px solid rgba(255, 255, 255, 0.05)', 
              marginBottom: '20px',
              fontSize: '0.85rem',
              lineHeight: '1.5'
            }}>
              <div style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.5)' }}>날짜</div>
              <div style={{ color: '#fff' }}>{selectedAttRecord.date}</div>

              <div style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.5)' }}>학번</div>
              <div style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{selectedAttRecord.student_id}</div>

              <div style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.5)' }}>이름</div>
              <div style={{ color: '#fff', fontWeight: 600 }}>
                {selectedAttRecord.student_name}
                {selectedAttRecord.original_record && (
                  <span style={{ fontSize: '0.7rem', color: '#ff9100', marginLeft: '8px', fontWeight: 'bold' }}>(수정됨)</span>
                )}
              </div>

              <div style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.5)' }}>전송 시간 (서버로그)</div>
              <div style={{ color: '#fff' }}>{new Date(selectedAttRecord.created_at).toLocaleString('ko-KR')}</div>

              <div style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.5)' }}>와이파이 SSID</div>
              <div style={{ color: '#fff' }}>{selectedAttRecord.wifi_ssid || '없음'}</div>

              <div style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.5)' }}>전체 BSSID</div>
              <div style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{selectedAttRecord.wifi_bssid || '없음'}</div>

              <div style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.5)' }}>대응하는 학년/반</div>
              <div style={{ color: '#00c6ff', fontWeight: 'bold' }}>{getBssidClassName(selectedAttRecord.wifi_bssid)}</div>

              <div style={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.5)' }}>결과</div>
              <div>{renderResultCell(selectedAttRecord.result, selectedAttRecord.type)}</div>
            </div>

            {dashboardTab === 'deleted_attendance' ? (
              <div>
                <div style={{ 
                  background: 'rgba(255, 82, 82, 0.05)', 
                  border: '1px solid rgba(255, 82, 82, 0.2)', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  color: '#ff5252', 
                  fontSize: '0.8rem',
                  marginBottom: '20px',
                  textAlign: 'center'
                }}>
                  이 기록은 휴지통에 들어 있습니다. 아래 복원 또는 영구 삭제 버튼을 사용해 관리하세요.
                </div>
                <div className="admin-modal-buttons" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => {
                    handleAttendanceRestore(selectedAttRecord.id);
                    setIsAttendanceModalOpen(false);
                  }} className="btn-save" style={{ background: '#00e676', color: '#000' }}>복원</button>
                  <button type="button" onClick={() => {
                    handleAttendancePermanentDelete(selectedAttRecord.id);
                    setIsAttendanceModalOpen(false);
                  }} className="btn-cancel" style={{ background: '#ff5252', color: '#fff' }}>영구 삭제</button>
                  <button type="button" onClick={() => setIsAttendanceModalOpen(false)} className="btn-cancel">닫기</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAttendanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="admin-input-group">
                  <label className="admin-input-label" style={{ fontWeight: 'bold', color: '#fff' }}>출결 구분 수정</label>
                  <select 
                    value={formAttType}
                    onChange={(e) => setFormAttType(e.target.value)}
                    className="admin-input-text"
                    style={{ background: 'var(--bg-card)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '8px' }}
                    required
                  >
                    <option value="정시 등교">정시 등교</option>
                    <option value="등교">등교</option>
                    <option value="인정 지각">인정 지각</option>
                    <option value="미인정 지각">미인정 지각</option>
                    <option value="인정 조퇴">인정 조퇴</option>
                    <option value="미인정 조퇴">미인정 조퇴</option>
                    <option value="하교">하교</option>
                  </select>
                </div>

                <div className="admin-modal-buttons" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="button" onClick={() => setIsAttendanceModalOpen(false)} className="btn-cancel">취소</button>
                  {selectedAttRecord.original_record && (
                    <button type="button" onClick={() => {
                      handleAttendanceRevert(selectedAttRecord.id);
                      setIsAttendanceModalOpen(false);
                    }} style={{ padding: '10px 16px', fontSize: '0.85rem', background: '#ff9100', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>원상복귀</button>
                  )}
                  <button type="button" onClick={() => {
                    handleAttendanceDelete(selectedAttRecord.id);
                    setIsAttendanceModalOpen(false);
                  }} style={{ padding: '10px 16px', fontSize: '0.85rem', background: '#ff5252', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>삭제</button>
                  <button type="submit" className="btn-save">저장</button>
                </div>
              </form>
            )}
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
