export const metadata = {
  title: 'Comci Timetable API',
  description: 'Fast, edge-powered school timetable API proxy for Comcigan.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
