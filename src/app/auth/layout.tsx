import { Newsreader } from 'next/font/google';

const signInDisplay = Newsreader({
  subsets: ['latin'],
  variable: '--font-signin-display',
  style: ['normal', 'italic'],
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${signInDisplay.variable} min-h-screen`}>{children}</div>;
}
