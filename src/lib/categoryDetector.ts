import type { Category } from '../types'

/**
 * Automatically detect the activity category from title and description.
 * Scans for keywords. Falls back to 'other' if nothing matches.
 */
export function detectCategory(title: string, description: string): Category {
  const text = `${title} ${description}`.toLowerCase()

  const categoryKeywords: Record<Category, string[]> = {
    market_run: [
      'market', 'provisions', 'stock', 'grocery', 'traders',
      'balogun', 'oyingbo', 'idumota', 'ushing', 'alaba', 'trade fair',
      'bulk', 'wholesale', 'retail', 'provision', 'ajah market',
    ],
    ride: [
      'ride', 'car', 'bus', 'fuel', 'fare', 'terminal',
      'commute', 'uber', 'bolt', 'in driver', 'shared ride', 'convey',
      'pick up', 'drop off', 'ride to',
    ],
    food: [
      'food', 'eat', 'restaurant', 'buffet', 'suya', 'brunch', 'dinner',
      'lunch', 'meal', 'chinese', 'chicken', 'dine', 'hungry', 'foodie',
      'taste', 'cuisine', 'buka', 'amala', 'jollof', 'fufu', 'pounded',
      'snack', 'bakery', 'cafe', 'coffee', 'tea time', 'supper',
    ],
    study: [
      'study', 'exam', 'tutorial', 'lesson', 'class', 'school', 'university',
      'jamb', 'waec', 'o level', 'lecture', 'read', 'book', 'learn',
      'assignment', 'project', 'thesis', 'semester', 'cgpa', 'course',
      'mathematics', 'english', 'physics', 'chemistry', 'biology',
    ],
    dev: [
      'dev', 'developer', 'code', 'app', 'website', 'frontend', 'backend',
      'hackathon', 'jam', 'build', 'programming', 'javascript', 'python',
      'react', 'node', 'php', 'laravel', 'flutter', 'ui/ux', 'design',
      'tech meetup', 'software', 'coding', 'github', 'api', 'database',
    ],
    event: [
      'event', 'meetup', 'party', 'wedding', 'birthday', 'networking',
      'launch', 'expo', 'fair', 'festival', 'stand up', 'comedy',
      'premiere', 'sho', 'opening', 'celebration',
    ],
    errands: [
      'errand', 'delivery', 'courier', 'pharmacy', 'package', 'fetch',
      'deliver', 'collection', 'parcel', 'mail', 'post office', 'bank run',
      'atm', 'queue', 'standing', 'help me buy', 'help me pick',
    ],
    movies: [
      'movie', 'film', 'cinema', 'premiere', 'flick', 'watch party',
      'movie night', 'blockbuster', 'watch', 'imax', 'silver screen',
    ],
    sports: [
      'football', 'soccer', 'basketball', 'tennis', 'cricket', 'golf',
      'boxing', 'squash', 'stadium', 'match', '5-a-side', 'fitness',
      'football watch', 'eeze', '11 a-side', 'friendly match', 'club',
    ],
    gym: [
      'gym', 'workout', 'lifting', 'body building', 'crossfit', 'zumba',
      'strength training', 'gym session', 'weight training',
    ],
    outdoors: [
      'hike', 'hiking', 'beach', 'camping', 'picnic', 'park', 'nature',
      'trail', 'waterfall', 'swim', 'barbecue', 'bbq',
    ],
    music: [
      'concert', 'gig', 'jam session', 'open mic', 'karaoke',
      'live music', 'listening party', 'album listening', 'band',
    ],
    arts: [
      'museum', 'gallery', 'exhibition', 'art', 'culture', 'theatre',
      'theater', 'poetry', 'spoken word', 'craft', 'painting',
    ],
    fashion: [
      'fashion', 'styling', 'outfit', 'dress code', 'tailoring', 'thrift',
      'clothes', 'fitting', 'runway',
    ],
    faith: [
      'church', 'mosque', 'worship', 'prayer', 'bible', 'choir', 'vigil',
      'fellowship', 'vigil', 'sanga', 'worship session', 'foundation',
    ],
    volunteer: [
      'volunteer', 'charity', 'donate', 'outreach', 'clean up', 'cleanup',
      'community service', 'blood drive', 'food bank', 'soup kitchen',
    ],
    pets: [
      'pet', 'vet', 'dog', 'cat', 'animal shelter',
    ],
    wellness: [
      'yoga', 'meditation', 'wellness', 'spa', 'massage', 'breathwork',
      'therapy', 'detox', 'sauna', 'facial',
    ],
    gaming: [
      'gaming', 'game night', 'esports', 'playstation', 'xbox', 'fifa',
      'ps5', 'steam',
    ],
    travel: [
      'trip', 'travel', 'excursion', 'tour', 'road trip', 'getaway',
      'travelogue', 'daycation', 'short escape',
    ],
    nightlife: [
      'club', 'bar', 'night out', 'happy hour', 'lounge', 'drinks',
      'rooftop', 'paint and sip', 'owambe night',
    ],
    shopping: [
      'shopping', 'mall', 'retail therapy', 'boutique', 'shop with',
      'souvenirs', 'souvenir',
    ],
    social: [
      'hang out', 'hangout', 'chill', 'catch up', 'gist', 'link up',
      'bonding', 'friendship', 'singles', 'bestie', 'squad', 'soul bonding',
    ],
    health: [
      'doctor', 'dentist', 'clinic', 'hospital', 'appointment', 'checkup',
      'check-up', 'physiotherapy', 'physiotherapist',
    ],
    repair: [
      'repair', 'fix', 'plumber', 'electrician', 'handyman',
      'furniture assembly', 'mend', 'furniture',
    ],
    other: [],
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
