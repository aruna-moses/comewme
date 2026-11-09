import type { Category } from '../types'

/**
 * Automatically detect the activity category from title and description.
 * Scans for keywords. Falls back to 'other' if nothing matches.
 */
export function detectCategory(title: string, description: string): Category {
  const text = `${title} ${description}`.toLowerCase()

  const categoryKeywords: Record<Category, string[]> = {
    market_run: [
      'market', 'provisions', 'stock', 'grocery', 'buy', 'sell', 'traders',
      'balogun', 'oyingbo', 'idumota', 'ushing', 'alaba', 'trade fair',
      'bulk', 'wholesale', 'retail', 'provision'
    ],
    ride: [
      'ride', 'trip', 'drive', 'car', 'bus', 'fuel', 'fare', 'terminal',
      'lagos island', 'yaba', 'ajah', 'mainland', 'vi', 'ikeja', 'lekki',
      'gbagada', 'computer village', 'transportation', 'pickup', 'drop off',
      'commute', 'uber', 'bolt', 'in driver', 'shared ride', 'convey'
    ],
    food: [
      'food', 'eat', 'restaurant', 'buffet', 'suya', 'brunch', 'dinner',
      'lunch', 'meal', 'chinese', 'chicken', 'dine', 'hungry', 'foodie',
      'taste', 'cuisine', 'buka', 'amala', 'jollof', 'fufu', 'pounded',
      'snack', 'bakery', 'cafe', 'coffee', 'tea time'
    ],
    study: [
      'study', 'exam', 'tutorial', 'lesson', 'class', 'school', 'university',
      'jamb', 'waec', 'o level', 'lecture', 'read', 'book', 'learn',
      'assignment', 'project', 'thesis', 'semester', 'cgpa', 'course',
      'mathematics', 'english', 'physics', 'chemistry', 'biology'
    ],
    dev: [
      'dev', 'developer', 'code', 'app', 'website', 'frontend', 'backend',
      'hackathon', 'jam', 'build', 'programming', 'javascript', 'python',
      'react', 'node', 'php', 'laravel', 'flutter', 'ui/ux', 'design',
      'tech meetup', 'software', 'coding', 'github', 'api', 'database'
    ],
    event: [
      'event', 'meetup', 'party', 'concert', 'music', 'night', 'club',
      'shrine', 'game', 'board game', 'cinema', 'football', 'basketball',
      'watch', 'show', 'stand up', 'comedy', 'wedding', 'birthday',
      'networking', 'launch', 'expo', 'fair', 'festival', 'hangout'
    ],
    errands: [
      'errand', 'delivery', 'courier', 'pharmacy', 'pick up', 'drop off',
      'package', 'buy for me', 'run errand', 'fetch', 'deliver', 'send',
      'collection', 'drop', 'parcel', 'mail', 'post office', 'bank run',
      'atm', 'queue', 'line', 'standing', 'help me buy'
    ],
    other: []
  }

  // Score each category by keyword matches
  let bestCategory: Category = 'other'
  let bestScore = 0

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let score = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category as Category
    }
  }

  return bestCategory
}
