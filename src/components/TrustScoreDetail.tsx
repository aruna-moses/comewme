import Sheet from './Sheet';
import { calculateTrustScore, trustLabel, TrustScoreItem } from '../lib/trustScore';

interface Props {
  score: number;
  tasks_completed: number;
  verification_status: 'unverified' | 'pending' | 'verified';
  avatar_url: string | null;
  bio: string | null;
  has_good_reviews?: boolean;
  has_reports?: boolean;
  open: boolean;
  onClose: () => void;
  /** Owner's display name — pass only when someone else is viewing this profile. */
  name?: string;
}

export default function TrustScoreDetail({
  score,
  tasks_completed,
  verification_status,
  avatar_url,
  bio,
  has_good_reviews = true,
  has_reports = false,
  open,
  onClose,
  name,
}: Props) {
  const result = calculateTrustScore({
    tasks_completed,
    verification_status,
    avatar_url,
    bio,
    has_good_reviews,
    has_reports,
  });

  return (
    <Sheet open={open} onClose={onClose} title="Trust score details">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-bold">{name ? `${name}'s trust score` : 'Your trust score'}</h2>
          <span className="font-display text-[24px] font-bold">{result.score}%</span>
        </div>

        <div className="w-full bg-line rounded-full h-2">
          <div
            className="h-2 rounded-full"
            style={{
              width: `${result.score}%`,
              backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)',
            }}
          />
        </div>

        <p className="text-[13px] font-semibold text-ink">{result.level}</p>
        <p className="text-[12px] text-muted mb-4">
          {name
            ? 'Based on their activity, verification, and history on Come w\u2019 me.'
            : 'Based on your activity, verification, and history on Come w\u2019 me.'}
        </p>

        <div className="space-y-2">
          {result.breakdown.map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-ink">{item.label}</p>
                <p className="text-[11px] text-muted">{item.description}</p>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-[13px] font-bold">
                  {item.points} / {item.max}
                </span>
                {item.earned ? (
                  <span className="w-4 h-4 shrink-0 rounded-full bg-verified flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : (
                  <span className="w-4 h-4 shrink-0 rounded-full bg-line" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-line text-[12px] text-muted">
          {name
            ? 'A high score means they show up, follow the rules and keep a clean record — the same three things we check every time.'
            : 'Your score can go up by completing more activities and keeping a clean record. It can go down if you are reported or break the community guidelines.'}
        </div>
      </div>
    </Sheet>
  );
}
