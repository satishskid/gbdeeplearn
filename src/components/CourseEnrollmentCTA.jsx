import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { apiUrl } from '../lib/api';

export default function CourseEnrollmentCTA({ courseId, courseSlug, initialLabel = 'Enroll' }) {
  const [user, setUser] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setUser(nextUser);

      if (!nextUser) {
        setLoading(false);
        setIsEnrolled(false);
        return;
      }

      // Check if user is already enrolled
      try {
        const idToken = await nextUser.getIdToken();
        const response = await fetch(apiUrl(`/api/learn/access?user_id=${nextUser.uid}`), {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'x-firebase-id-token': idToken,
            'x-user-id': nextUser.uid
          }
        });

        if (response.ok) {
          const data = await response.json();
          const enrolledCourses = data.courses || [];
          const enrolled = enrolledCourses.some(c => c.id === courseId || c.slug === courseSlug);
          if (active) setIsEnrolled(enrolled);
        }
      } catch (err) {
        console.error('Failed to check enrollment status', err);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [courseId, courseSlug]);

  const handleEnroll = async () => {
    if (!user) {
      // Redirect to login or show an alert (most sites redirect to a login/register page)
      window.location.href = `/app/learn?redirect=/courses/${courseSlug}`;
      return;
    }

    if (isEnrolled) {
      window.location.href = '/app/learn';
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(apiUrl('/api/enroll'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'x-firebase-id-token': idToken,
          'x-user-id': user.uid
        },
        body: JSON.stringify({ course_id: courseId })
      });

      const data = await response.json();
      if (response.ok) {
        // Success! Redirect to workspace
        window.location.href = data.workspaceUrl || '/app/learn';
      } else {
        setError(data.error || 'Enrollment failed.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200"></div>
      </div>
    );
  }

  if (isEnrolled) {
    return (
      <a href="/app/learn" className="public-inline-action">
        Go to Workspace
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleEnroll}
        disabled={submitting}
        className="public-inline-action disabled:opacity-70"
      >
        {submitting ? 'Enrolling...' : (user ? initialLabel : 'Login to Enroll')}
      </button>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
