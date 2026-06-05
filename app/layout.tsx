import './globals.css';

export const metadata = {
  title: 'Comci Timetable API & Playgrounds',
  description: 'Fast, edge-powered school timetable and Apps Script location checker.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

