import './globals.css';

export const metadata = {
  title: 'Team Activity Dashboard',
  description: 'Real-time view of team commits and PRs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
