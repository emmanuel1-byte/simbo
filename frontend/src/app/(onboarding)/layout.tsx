import { ProtectedRoute } from '@/components/app/protected-route';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
