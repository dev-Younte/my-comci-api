import { NextResponse } from 'next/server';

export function validateAdminAuth(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PASSWORD || '';

  if (!expectedPassword) {
    return {
      isValid: false,
      errorResponse: new NextResponse(
        JSON.stringify({ success: false, message: '서버에 관리자 비밀번호가 설정되지 않았습니다.' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      )
    };
  }

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return {
      isValid: false,
      errorResponse: new NextResponse(
        JSON.stringify({ success: false, message: '로그인 정보가 누락되었습니다.' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      )
    };
  }

  try {
    const base64Credentials = authHeader.substring(6);
    let decoded = '';
    
    // Serverless(Node.js) & Edge Runtime 호환 디코딩
    if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');
    } else {
      decoded = atob(base64Credentials);
    }

    const [username, password] = decoded.split(':');

    if (username === expectedUsername && password === expectedPassword) {
      return { isValid: true };
    }
  } catch (e) {
    console.error('Auth decoding error:', e);
  }

  return {
    isValid: false,
    errorResponse: new NextResponse(
      JSON.stringify({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    )
  };
}

export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
