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
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center rounded-2xl z-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
        <p className="text-sm font-semibold text-cyan-400 tracking-wider">데이터를 처리 중입니다...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden relative">
      {/* 초현대적 네온 백그라운드 글로우 */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[50%] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[150px] pointer-events-none"></div>

      {/* 헤더 (글래스모피즘 스티키) */}
      <header className="border-b border-white/5 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center font-black text-xl text-slate-950 shadow-lg shadow-cyan-500/20">
            별
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-50 to-slate-200">
              별가람고 스마트 출결 관리
            </h1>
            <p className="text-[10px] text-cyan-400 font-extrabold tracking-widest uppercase">ADMIN SYSTEM</p>
          </div>
        </div>
        {isAuthenticated && (
          <button 
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl border border-white/5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-xs font-bold text-slate-300 hover:text-red-400 transition duration-300"
          >
            로그아웃
          </button>
        )}
      </header>

      {/* 본문 레이아웃 */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 flex flex-col justify-center relative">
        {loading && renderLoading()}

        {!isAuthenticated ? (
          /* 로그인 인터페이스 (글래스모피즘 카드) */
          <div className="max-w-md w-full mx-auto bg-slate-900/40 border border-white/5 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl shadow-black/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-400 to-indigo-500"></div>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">관리자 로그인</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                출결 연동 시스템 조작을 위해 어드민 보안 인증 암호를 입력해주세요.
              </p>
            </div>
            
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1">
                <input 
                  type="password"
                  placeholder="보안 비밀키 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-slate-950/80 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 text-sm font-semibold tracking-wider transition duration-300 text-center"
                />
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 rounded-2xl text-xs font-semibold tracking-wide text-center">
                  ⚠️ {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-cyan-500/10 active:scale-[0.98] transition duration-300"
              >
                시스템 인증하기
              </button>
            </form>
          </div>
        ) : (
          /* 어드민 대시보드 메인 화면 */
          <div className="flex-1 flex flex-col space-y-6">
            
            {/* 대시보드 상단 제어바 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 bg-slate-900/30 border border-white/5 backdrop-blur-xl p-2 rounded-2xl flex items-center shadow-lg">
                <span className="pl-3 text-slate-500">🔍</span>
                <input 
                  type="text"
                  placeholder="학생 이름, 학번, 전화번호로 간편 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none text-sm px-2 font-semibold"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="text-xs font-extrabold text-slate-500 hover:text-cyan-400 px-3 transition duration-200"
                  >
                    지우기
                  </button>
                )}
              </div>

              {/* 신규 학생 등록 버튼 (네온 테두리) */}
              <button
                onClick={() => openModal('add')}
                className="py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/10 transition duration-300 active:scale-[0.98]"
              >
                + 신규 학생 사전등록
              </button>

              {/* 실시간 카운팅 보드 */}
              <div className="bg-slate-900/30 border border-white/5 backdrop-blur-xl px-5 py-4 rounded-2xl flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-[10px] text-slate-500 font-extrabold tracking-wider uppercase">REGISTRATION RATE</p>
                  <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                    {filteredStudents.length} / {students.length} 명
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-black text-sm">
                  ✓
                </div>
              </div>
            </div>

            {/* 성공/실패 배너 피드백 */}
            {successMsg && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-bold tracking-wide animate-fadeIn">
                ✓ {successMsg}
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-500/5 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold tracking-wide animate-fadeIn">
                ⚠️ {error}
              </div>
            )}

            {/* 메인 명단 글래스모피즘 보드 */}
            <div className="bg-slate-900/10 border border-white/5 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-2xl flex-1 flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-slate-900/30 text-slate-400 text-[11px] font-black tracking-wider uppercase">
                      <th className="px-6 py-4.5">학번</th>
                      <th className="px-6 py-4.5">이름</th>
                      <th className="px-6 py-4.5">전화번호</th>
                      <th className="px-6 py-4.5">바인딩 기기 식별값</th>
                      <th className="px-6 py-4.5">인증 완료 시각</th>
                      <th className="px-6 py-4.5 text-center">출결 조치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-slate-950/5">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-slate-600 font-semibold text-sm">
                          현재 조건에 부합하는 학생 정보가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-white/[0.02] transition-colors duration-300">
                          <td className="px-6 py-4 font-mono font-bold text-cyan-400 text-sm">{student.student_id}</td>
                          <td className="px-6 py-4 font-bold text-slate-200 text-sm">{student.name}</td>
                          <td className="px-6 py-4 text-slate-400 font-mono text-xs">{student.phone}</td>
                          <td className="px-6 py-4">
                            {student.device_id ? (
                              <span className="font-mono text-[10px] px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 max-w-[150px] inline-block truncate" title={student.device_id}>
                                {student.device_id}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">미등록 (Unbound)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-semibold">
                            {student.registered_at ? new Date(student.registered_at).toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex space-x-1.5">
                              <button 
                                onClick={() => openModal('edit', student)}
                                className="px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition duration-200"
                              >
                                수정
                              </button>
                              {student.device_id ? (
                                <button 
                                  onClick={() => handleResetDevice(student.student_id, student.name)}
                                  className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-xs font-bold text-orange-400 transition duration-200"
                                >
                                  기기 해제
                                </button>
                              ) : (
                                <button 
                                  disabled
                                  className="px-3 py-1.5 rounded-xl bg-slate-900/50 border border-white/5 text-xs font-bold text-slate-700 cursor-not-allowed"
                                >
                                  해제불가
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteStudent(student.id, student.student_id, student.name)}
                                className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-bold text-red-400 transition duration-200"
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

      {/* 학생 편집 다이얼로그 모달 (유리모피즘 오버레이) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="max-w-md w-full bg-slate-900/80 border border-white/10 backdrop-blur-2xl p-6 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-400 to-indigo-500"></div>
            
            <h3 className="text-lg font-black text-white mb-4 tracking-tight">
              {modalMode === 'add' ? '✨ 신규 학생 사전등록' : '✏️ 학생 정보 수정'}
            </h3>
            
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-extrabold tracking-wider uppercase">학번</label>
                <input 
                  type="text" 
                  placeholder="예: 10101"
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/5 bg-slate-950 text-slate-100 placeholder-slate-700 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/10 text-sm font-semibold transition duration-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-extrabold tracking-wider uppercase">이름</label>
                <input 
                  type="text" 
                  placeholder="예: 홍길동"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/5 bg-slate-950 text-slate-100 placeholder-slate-700 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/10 text-sm font-semibold transition duration-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-extrabold tracking-wider uppercase">전화번호</label>
                <input 
                  type="text" 
                  placeholder="예: 01012345678 (하이픈 없이)"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/5 bg-slate-950 text-slate-100 placeholder-slate-700 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/10 text-sm font-semibold transition duration-300"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/5 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold text-center">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition duration-200"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/10 transition duration-200"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 푸터 */}
      <footer className="border-t border-white/5 bg-slate-950/50 py-4 px-6 text-center text-[10px] text-slate-600 font-extrabold tracking-wider uppercase">
        © 2026 별가람고등학교 스마트 출결 관리 시스템.
      </footer>
    </div>
  );
}
