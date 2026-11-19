import { AuthGate } from "@/components/auth/auth-gate";
import { StudioApp } from "@/components/studio/studio-app";

export default function Page() {
  return (
    <AuthGate>
      <StudioApp />
    </AuthGate>
  );
}
