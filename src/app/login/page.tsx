import { redirect } from 'next/navigation';

// Redirect /login to /auth
export default function LoginPage() {
  redirect('/auth');
}
