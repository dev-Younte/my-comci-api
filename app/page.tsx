export default function Home() {
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: '40px 20px',
      maxWidth: '600px',
      margin: '0 auto',
      lineHeight: '1.6',
      color: '#333'
    }}>
      <h1 style={{ color: '#0070f3', fontSize: '2.5rem', marginBottom: '10px', fontWeight: 'bold' }}>
        🏫 Comci Timetable API
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#666', marginTop: '10px' }}>
        컴시간 알리미 시간표 데이터를 실시간으로 파싱하여 정제된 JSON으로 반환하는 초고속 Edge API 프록시 서비스입니다.
      </p>
      
      <div style={{
        background: '#f9f9f9',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '30px',
        border: '1px solid #eaeaea'
      }}>
        <h2 style={{ fontSize: '1.3rem', marginTop: 0, fontWeight: 'bold' }}>📡 API Endpoint</h2>
        <code style={{
          display: 'block',
          background: '#fff',
          padding: '10px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          fontSize: '0.95rem',
          wordBreak: 'break-all',
          fontFamily: 'monospace'
        }}>
          /api/timetable?schoolCode=27121&grade=1&classNum=1
        </code>
        
        <h3 style={{ fontSize: '1.1rem', marginTop: '20px', marginBottom: '8px', fontWeight: 'bold' }}>Parameters:</h3>
        <ul style={{ paddingLeft: '20px', margin: 0 }}>
          <li><strong>schoolCode</strong> (필수): 5자리 학교 코드 (예: 27121)</li>
          <li><strong>grade</strong> (필수): 학년 (1~3)</li>
          <li><strong>classNum</strong> (필수): 반 (1~15)</li>
          <li><strong>date</strong> (선택): 조회 대상 날짜 (YYYY-MM-DD)</li>
        </ul>
      </div>

      <footer style={{ marginTop: '50px', fontSize: '0.85rem', color: '#999', textAlign: 'center' }}>
        Powered by Vercel Edge Serverless Functions
      </footer>
    </div>
  );
}
