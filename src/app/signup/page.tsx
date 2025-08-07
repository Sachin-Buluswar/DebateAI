import { redirect } from 'next/navigation';

// Redirect /signup to /auth
export default function SignupPage() {
  redirect('/auth');
}