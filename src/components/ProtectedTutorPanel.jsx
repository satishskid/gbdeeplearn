import AuthRoleGate from '../shared/AuthRoleGate';
import ChatInterface from './ChatInterface';

export default function ProtectedTutorPanel() {
  return (
    <AuthRoleGate
      allowedRoles={['learner', 'teacher', 'coordinator', 'counselor', 'cto']}
      title="AI Tutor Access"
      subtitle="Sign in with your learner account to access the syllabus-grounded tutor."
      unauthorizedMessage="Tutor access is available only to enrolled learners and program staff."
    >
      <ChatInterface />
    </AuthRoleGate>
  );
}

