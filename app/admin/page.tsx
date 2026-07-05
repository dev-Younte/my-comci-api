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

  // LocalStorage에서 관리자 키 자동 복구
  useEffect(() => {
    const savedKey = localStorage.getItem('admin_secret_key');
    if (savedKey) {
      setPassword(savedKey);
      verifyAndLoad(savedKey);
    }
  }, []);

  const verifyAndLoad = async (keyToVerify: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/students', {
        headers: {
          'Authorization': `Bearer ${keyToVerify}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setStudents(data.students || []);
        localStorage.setItem('admin_secret_key', keyToVerify);
      } else {
        setError(data.message || '인증번호가 올바르지 않습니다.');
        setIsAuthenticated(false);
        localStorage.removeItem('admin_secret_key');
      }
    } catch (e: any) {
      setError('서버 연결 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    verifyAndLoad(password.trim());
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
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || '요청이 성공적으로 처리되었습니다.');
        setIsModalOpen(false);
        verifyAndLoad(password);
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
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`${studentName} 학생 정보가 삭제되었습니다.`);
        verifyAndLoad(password);
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
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({ studentId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`${studentName} 학생의 기기 바인딩이 해제되었습니다.`);
        verifyAndLoad(password);
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
    localStorage.removeItem('admin_secret_key');
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

  // 로딩 오버레이
  const renderLoading = () => (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-xl z-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden relative">
      {/* 백그라운드 구체 조명 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none"></div>

      {/* 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 to-violet-500 rounded-lg flex items-center justify-center font-bold text-lg text-slate-950">
            별
          </div>
          <div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-300">
              별가람고 스마트 출결 관리 시스템
            </h1>
            <p className="text-xs text-cyan-400 font-semibold tracking-wider">ADMIN CONSOLE v1.1</p>
          </div>
        </div>
        {isAuthenticated && (
          <button 
            onClick={handleLogout}
            className="px-4 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-red-950/30 hover:border-red-800 text-xs font-semibold text-slate-300 hover:text-red-400 transition duration-200"
          >
            로그아웃
          </button>
        )}
      </header>

      {/* 본문 콘텐츠 */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 flex flex-col justify-center relative">
        {loading && renderLoading()}

        {!isAuthenticated ? (
          /* 로그인 인터페이스 */
          <div className="max-w-md w-full mx-auto bg-slate-900/60 border border-slate-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-100 mb-2">관리자 보안 인증</h2>
              <p className="text-sm text-slate-400">학적 등록 및 기기 해제를 위해 어드민 패스워드를 입력해주세요.</p>
            </div>
            
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <input 
                  type="password"
                  placeholder="관리자 패스워드를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-800 bg-slate-950/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-950/30 border border-red-800 text-red-400 rounded-lg text-xs font-medium">
                  ⚠️ {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-900/20 active:scale-[0.98] transition duration-150"
              >
                인증 확인
              </button>
            </form>
          </div>
        ) : (
          /* 어드민 대시보드 화면 */
          <div className="flex-1 flex flex-col space-y-6">
            
            {/* 상단 검색바, 등록 버튼 및 상태 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 bg-slate-900/40 border border-slate-900 backdrop-blur-md p-4 rounded-xl flex items-center">
                <input 
                  type="text"
                  placeholder="이름, 학번, 전화번호 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-sm"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-slate-300 text-xs px-2 font-bold">
                    지우기
                  </button>
                )}
              </div>

              {/* 신규 학생 등록 버튼 */}
              <button
                onClick={() => openModal('add')}
                className="px-4 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-cyan-950/20 transition duration-150 active:scale-[0.98]"
              >
                + 신규 학생 등록
              </button>

              <div className="bg-slate-900/40 border border-slate-900 backdrop-blur-md p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">조회 학생 수</p>
                  <p className="text-xl font-extrabold text-cyan-400">{filteredStudents.length} / {students.length} 명</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
                  ★
                </div>
              </div>
            </div>

            {/* 알림 메시지 배너 */}
            {successMsg && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-800 text-emerald-400 rounded-lg text-xs font-semibold animate-pulse">
                ✓ {successMsg}
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-950/20 border border-red-800 text-red-400 rounded-lg text-xs font-semibold">
                ⚠️ {error}
              </div>
            )}

            {/* 학생 리스트 테이블 */}
            <div className="bg-slate-900/20 border border-slate-800/80 backdrop-blur-lg rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">학번</th>
                      <th className="px-6 py-4">이름</th>
                      <th className="px-6 py-4">전화번호</th>
                      <th className="px-6 py-4">등록 기기 ID</th>
                      <th className="px-6 py-4">인증 시간</th>
                      <th className="px-6 py-4 text-center">관리 액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 bg-slate-950/20">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                          등록된 학생 정보가 존재하지 않습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-900/20 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-cyan-400">{student.student_id}</td>
                          <td className="px-6 py-4 font-semibold text-slate-200">{student.name}</td>
                          <td className="px-6 py-4 text-slate-300 font-mono">{student.phone}</td>
                          <td className="px-6 py-4">
                            {student.device_id ? (
                              <span className="font-mono text-xs px-2 py-1 rounded bg-indigo-950/30 border border-indigo-900/50 text-indigo-300 max-w-[140px] inline-block truncate" title={student.device_id}>
                                {student.device_id}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-500/80 font-medium">미등록 (Unbound)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {student.registered_at ? new Date(student.registered_at).toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 flex items-center justify-center space-x-2">
                            <button 
                              onClick={() => openModal('edit', student)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-800 hover:text-white text-xs font-semibold text-slate-300 transition duration-150"
                            >
                              수정
                            </button>
                            {student.device_id ? (
                              <button 
                                onClick={() => handleResetDevice(student.student_id, student.name)}
                                className="px-2.5 py-1.5 rounded-lg bg-orange-950/40 hover:bg-orange-900/60 border border-orange-850 text-xs font-semibold text-orange-300 transition duration-150"
                              >
                                기기 해제
                              </button>
                            ) : (
                              <button 
                                disabled
                                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-850 text-xs font-semibold text-slate-600 cursor-not-allowed"
                              >
                                미인증
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteStudent(student.id, student.student_id, student.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-900 text-xs font-semibold text-red-300 transition duration-150"
                            >
                              삭제
                            </button>
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

      {/* 등록/수정 다이얼로그 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">
              {modalMode === 'add' ? '신규 학생 등록' : '학생 정보 수정'}
            </h3>
            
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold">학번</label>
                <input 
                  type="text" 
                  placeholder="예: 10101"
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold">이름</label>
                <input 
                  type="text" 
                  placeholder="예: 홍길동"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold">전화번호</label>
                <input 
                  type="text" 
                  placeholder="예: 01012345678 (하이픈 없이)"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-950/30 border border-red-800 text-red-400 rounded-lg text-xs">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm font-semibold text-slate-300"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 푸터 */}
      <footer className="border-t border-slate-900 bg-slate-950/50 py-4 px-6 text-center text-xs text-slate-500 font-medium">
        © 2026 별가람고등학교 스마트 출결 관리 시스템. All Rights Reserved.
      </footer>
    </div>
  );
}
