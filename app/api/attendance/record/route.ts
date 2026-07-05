import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      date,
      type,
      time,
      studentName,
      studentId,
      wifiSsid,
      wifiBssid,
      wifiRssi,
      beaconUuid,
      beaconMajor,
      beaconMinor,
      beaconRssi,
      gpsStatus,
      result
    } = body;

    if (!date || !type || !time || !studentName || !studentId || !result) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '필수 출결 정보가 누락되었습니다.' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const { error } = await supabase.from('attendance_records').insert([
      {
        date,
        type,
        time,
        student_name: studentName,
        student_id: studentId,
        wifi_ssid: wifiSsid || '',
        wifi_bssid: wifiBssid || '',
        wifi_rssi: wifiRssi || '',
        beacon_uuid: beaconUuid || '',
        beacon_major: beaconMajor || '',
        beacon_minor: beaconMinor || '',
        beacon_rssi: beaconRssi || '',
        gps_status: gpsStatus || '',
        result
      }
    ]);

    if (error) {
      console.error('Error inserting attendance record:', error);
      return new NextResponse(
        JSON.stringify({ success: false, message: '데이터베이스 저장 실패', error: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    return new NextResponse(
      JSON.stringify({ success: true, message: '출결 기록이 저장되었습니다.' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (err: any) {
    console.error('Error in record api:', err);
    return new NextResponse(
      JSON.stringify({ success: false, message: err.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
