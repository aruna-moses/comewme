export interface TrustScoreItem {
  label: string;
  points: number;
  max: number;
  earned: boolean;
  description: string;
}

export interface TrustScoreResult {
  score: number;
  level: string;
  breakdown: TrustScoreItem[];
}

/**
 * Calculate a user's trust score from 0 to 100.
 *
 * Rules:
 *  0-10   Signed up + accepted community guidelines
 *  10-20  Profile photos (2-6)
 *  20-30  Phone verified
 *  30-40  First activity completed
 *  40-60  3-5 activities completed
 *  60-80  5+ activities with good reviews / no reports
 *  80-100 Selfie verified (live selfie matches profile photos)
 */
export function calculateTrustScore(input: {
  tasks_completed: number;
  verification_status: 'unverified' | 'pending' | 'verified';
  avatar_url: string | null;
  phone: string | null;
  has_good_reviews?: boolean;
  has_reports?: boolean;
}): TrustScoreResult {
  let score = 0;

  const breakdown: TrustScoreItem[] = [
    {
      label: 'Signed up & accepted guidelines',
      points: 10,
      max: 10,
      earned: true,
      description: 'Account created and community guidelines accepted.',
    },
    {
      label: 'Profile photos (2–6)',
      points: 0,
      max: 10,
      earned: false,
      description: 'Upload 2 to 6 photos so others can see who you are.',
    },
    {
      label: 'Phone verified',
      points: 0,
      max: 10,
      earned: false,
      description: 'Confirm your phone number with a code.',
    },
    {
      label: 'First activity completed',
      points: 0,
      max: 10,
      earned: false,
      description: 'Host or join your first activity and show up.',
    },
    {
      label: '3–5 activities completed',
      points: 0,
      max: 20,
      earned: false,
      description: 'Build a track record with 3 to 5 completed activities.',
    },
    {
      label: '5+ activities with good reviews',
      points: 0,
      max: 20,
      earned: false,
      description: '5+ completed activities, good ratings, no reports.',
    },
    {
      label: 'Selfie verified',
      points: 0,
      max: 20,
      earned: false,
      description: 'Live selfie matches your profile photos.',
    },
  ];

  // 1. Signup + guidelines (always earned)
  score += 10;
  breakdown[0].earned = true;

  // 2. Profile photos
  if (input.avatar_url) {
    breakdown[1].points = 10;
    breakdown[1].earned = true;
    score += 10;
  }

  // 3. Phone verified
  if (input.phone) {
    breakdown[2].points = 10;
    breakdown[2].earned = true;
    score += 10;
  }

  // 4. First activity
  if (input.tasks_completed >= 1) {
    breakdown[3].points = 10;
    breakdown[3].earned = true;
    score += 10;
  }

  // 5. 3–5 activities
  if (input.tasks_completed >= 3) {
    const points = Math.min(20, input.tasks_completed * 5);
    breakdown[4].points = points;
    breakdown[4].earned = true;
    score += points;
  }

  // 6. 5+ activities with good reviews
  if (input.tasks_completed >= 5 && input.has_good_reviews !== false && input.has_reports === false) {
    breakdown[5].points = 20;
    breakdown[5].earned = true;
    score += 20;
  }

  // 7. Selfie verified
  if (input.verification_status === 'verified') {
    breakdown[6].points = 20;
    breakdown[6].earned = true;
    score += 20;
  }

  // Cap at 100
  score = Math.min(100, score);

  let level = 'Newcomer';
  if (score >= 80) level = 'Trusted';
  else if (score >= 60) level = 'Regular';
  else if (score >= 30) level = 'Explorer';

  return { score, level, breakdown };
}

export function trustLabel(score: number): string {
  if (score >= 80) return 'Trusted';
  if (score >= 60) return 'Regular';
  if (score >= 30) return 'Explorer';
  if (score >= 10) return 'Getting started';
  return 'Newcomer';
}
