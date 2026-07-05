"use client";

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

export default function AdminPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // CRUD 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null); // DB의 id (UUID)
  const [formStudentId, setFormStudentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // LocalStorage에서 Basic Auth 토큰 자동 복구 및 로그인 시도
  useEffect(() => {
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

  const verifyAndLoad = async (userVal: string, passVal: string) => {
    setLoading(true);
    setError('');
    try {
      const token = btoa(`${userVal}:${passVal}`);
      const res = await fetch('/api/admin/students', {
        headers: {
          'Authorization': `Basic ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setStudents(data.students || []);
        localStorage.setItem('admin_basic_token', token);
      } else {
        setError(data.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
        setIsAuthenticated(false);
        localStorage.removeItem('admin_basic_token');
      }
    } catch (e: any) {
      setError('서버 연결 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    verifyAndLoad(username.trim(), password.trim());
  };

  // 학생 등록/수정 모달 열기
  const openModal = (mode: 'add' | 'edit', student?: Student) => {
    setModalMode(mode);
    setError('');
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

  // 학생 등록/수정 전송
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId.trim() || !formName.trim() || !formPhone.trim()) {
      setError('모든 항목을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
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
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || '요청이 성공적으로 처리되었습니다.');
        setIsModalOpen(false);
        verifyAndLoad(username, password);
      } else {
        setError(data.message || '저장에 실패했습니다.');
      }
    } catch (e) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 학생 삭제
  const handleDeleteStudent = async (id: string, studentId: string, studentName: string) => {
    if (!confirm(`${studentName} 학생(${studentId}) 정보를 삭제하시겠습니까? 학적 정보와 연동된 출결 내역이 모두 삭제될 수 있습니다.`)) {
      return;
    }

    setLoading(true);
    setError('');
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
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`${studentName} 학생 정보가 삭제되었습니다.`);
        verifyAndLoad(username, password);
      } else {
        setError(data.message || '학생 삭제에 실패했습니다.');
      }
    } catch (e) {
      setError('삭제 요청 중 네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 기기 초기화
  const handleResetDevice = async (studentId: string, studentName: string) => {
    if (!confirm(`${studentName} 학생(${studentId})의 등록된 기기 정보를 초기화하시겠습니까? 초기화 후에는 학생이 새로운 기기에서 재가입 인증을 다시 할 수 있게 됩니다.`)) {
      return;
    }

    setLoading(true);
    setError('');
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
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`${studentName} 학생의 기기 바인딩이 해제되었습니다.`);
        verifyAndLoad(username, password);
      } else {
        setError(data.message || '기기 초기화에 실패했습니다.');
      }
    } catch (e) {
      setError('초기화 요청 중 네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_basic_token');
    setUsername('');
    setPassword('');
    setIsAuthenticated(false);
    setStudents([]);
    setError('');
    setSuccessMsg('');
  };

  // 검색 필터링
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.includes(searchTerm) ||
    student.phone.includes(searchTerm)
  );

  // 로딩 인디케이터
  const renderLoading = () => (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(5, 5, 8, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '24px',
      zIndex: 2000
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(0, 198, 255, 0.1)',
          borderTop: '3px solid #00c6ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
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
      {/* 백그라운드 오르브 조명 */}
      <div className="admin-glow-orb-1"></div>
      <div className="admin-glow-orb-2"></div>

      {/* 헤더 */}
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img 
            src="/school_logo.png" 
            alt="Logo" 
            style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain' }} 
          />
          <div>
            <div className="admin-header-title">별가람고 스마트 출결 관리</div>
            <div className="admin-header-subtitle">ADMIN SYSTEM</div>
          </div>
        </div>
        {isAuthenticated && (
          <button onClick={handleLogout} className="btn-action">
            로그아웃
          </button>
        )}
      </header>

      {/* 메인 콘텐츠 */}
      <main className="admin-main">
        {loading && renderLoading()}

        {!isAuthenticated ? (
          /* 로그인 인터페이스 */
          <div className="admin-login-card animate-fade-in">
            <div className="admin-card-header">
              <h2 className="admin-card-title">관리자 인증 로그인</h2>
              <p className="admin-card-desc">
                출결 연동 시스템 조작을 위해 아이디와 비밀번호를 입력해주세요.
              </p>
            </div>
            
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="admin-input-group" style={{ marginBottom: '10px' }}>
                <label className="admin-input-label">아이디</label>
                <input 
                  type="text"
                  placeholder="관리자 ID 입력"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="admin-input-text"
                  style={{ textAlign: 'center' }}
                />
              </div>

              <div className="admin-input-group" style={{ marginBottom: '20px' }}>
                <label className="admin-input-label">비밀번호</label>
                <input 
                  type="password"
                  placeholder="관리자 Password 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="admin-input-text"
                  style={{ textAlign: 'center' }}
                />
              </div>

              {error && (
                <div className="admin-banner admin-banner-error" style={{ justifyContent: 'center' }}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '5px' }}>
                시스템 인증하기
              </button>
            </form>
          </div>
        ) : (
          /* 어드민 대시보드 화면 */
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 제어 바 */}
            <div className="admin-control-bar">
              <div className="admin-search-wrapper">
                <span style={{ opacity: 0.5 }}>🔍</span>
                <input 
                  type="text"
                  placeholder="학생 이름, 학번, 전화번호로 간편 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="admin-search-input"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="admin-search-clear">
                    지우기
                  </button>
                )}
              </div>

              <button onClick={() => openModal('add')} className="btn-add-student">
                + 신규 학생 사전등록
              </button>

              <div className="admin-stat-card">
                <div>
                  <div className="admin-stat-label">사전등록 현황</div>
                  <div className="admin-stat-val">
                    {filteredStudents.length} / {students.length} 명
                  </div>
                </div>
                <div className="admin-stat-icon">✓</div>
              </div>
            </div>

            {/* 피드백 알림 배너 */}
            {successMsg && (
              <div className="admin-banner admin-banner-success">
                ✓ {successMsg}
              </div>
            )}
            {error && (
              <div className="admin-banner admin-banner-error">
                ⚠️ {error}
              </div>
            )}

            {/* 학생 명단 테이블 (컬럼 넓이 절대 고정 적용) */}
            <div className="admin-table-panel">
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>학번</th>
                      <th>이름</th>
                      <th>전화번호</th>
                      <th>바인딩 기기 식별값</th>
                      <th>인증 완료 시각</th>
                      <th style={{ textAlign: 'center' }}>출결 조치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.5 }}>
                          현재 조건에 부합하는 학생 정보가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="admin-table-student-id">{student.student_id}</td>
                          <td className="admin-table-name">{student.name}</td>
                          <td className="admin-table-phone">{student.phone}</td>
                          <td>
                            {student.device_id ? (
                              <span className="badge-device" title={student.device_id}>
                                {student.device_id}
                              </span>
                            ) : (
                              <span className="badge-unbound">미등록 (Unbound)</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                            {student.registered_at ? new Date(student.registered_at).toLocaleString() : '-'}
                          </td>
                          <td>
                            <div className="admin-actions-flex">
                              <button 
                                onClick={() => openModal('edit', student)}
                                className="btn-action"
                              >
                                수정
                              </button>
                              {student.device_id ? (
                                <button 
                                  onClick={() => handleResetDevice(student.student_id, student.name)}
                                  className="btn-action btn-action-warning"
                                >
                                  기기 해제
                                </button>
                              ) : (
                                <button 
                                  disabled
                                  className="btn-action btn-action-disabled"
                                >
                                  해제불가
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteStudent(student.id, student.student_id, student.name)}
                                className="btn-action btn-action-danger"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* 모달 팝업 */}
      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <h3 className="admin-modal-title">
              {modalMode === 'add' ? '✨ 신규 학생 사전등록' : '✏️ 학생 정보 수정'}
            </h3>
            
            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="admin-input-group">
                <label className="admin-input-label">학번</label>
                <input 
                  type="text" 
                  placeholder="예: 10101"
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="admin-input-text"
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">이름</label>
                <input 
                  type="text" 
                  placeholder="예: 홍길동"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="admin-input-text"
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">전화번호</label>
                <input 
                  type="text" 
                  placeholder="예: 01012345678 (하이픈 없이)"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="admin-input-text"
                />
              </div>

              {error && (
                <div className="admin-banner admin-banner-error" style={{ margin: 0 }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="admin-modal-buttons">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn-cancel"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="btn-save"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 푸터 (기업 및 시스템 엔지니어링 크레딧 고도화) */}
      <footer className="admin-footer" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.6, fontSize: '0.7rem' }}>
        <div>© 2026 BYEOLGARAM HIGH SCHOOL. SMART ATTENDANCE MANAGEMENT SYSTEM. ALL RIGHTS RESERVED.</div>
        <div style={{ color: '#00c6ff', fontWeight: 600, letterSpacing: '0.05em' }}>
          Powered by Vercel Edge Serverless Functions & Google Sheets API
        </div>
        <div style={{ opacity: 0.8 }}>
          별가람고등학교 컴시간 시간표 및 특별교실 BSSID 통합 위치 매핑 대시보드
        </div>
        <div style={{ marginTop: '6px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          System Engineered by <strong style={{ color: '#ffffff' }}>10509 김태윤 제작</strong>
        </div>
      </footer>
    </div>
  );
}
