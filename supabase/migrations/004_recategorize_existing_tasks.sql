-- ============================================================
-- Come w' me — recategorize existing tasks (v4)
-- Run in Supabase SQL Editor -> New query -> Run
-- ============================================================

-- This backfills the category column for all existing tasks based on
-- their title and description, using keyword matching.
--
-- It only updates tasks where the current category is NULL, 'other',
-- or an empty string, so manually-set categories are preserved.
--
-- After running, new tasks posted through the app will use the
-- auto-detected category from categoryDetector.ts.

UPDATE public.tasks
SET category = CASE
  -- market_run
  WHEN lower(title || ' ' || coalesce(description, '')) LIKE '%market%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%provisions%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%stock%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%grocery%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%balogun%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%oyingbo%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%idumota%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%alaba%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%trade fair%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%wholesale%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%retail%'
  THEN 'market_run'

  -- ride
  WHEN lower(title || ' ' || coalesce(description, '')) LIKE '%ride%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%trip%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%drive%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%car%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%bus%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%fuel%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%fare%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%terminal%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%ajah%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%yaba%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%mainland%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%ikeja%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%lekki%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%gbagada%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%computer village%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%uber%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%bolt%'
  THEN 'ride'

  -- food
  WHEN lower(title || ' ' || coalesce(description, '')) LIKE '%food%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%eat%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%restaurant%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%buffet%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%suya%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%brunch%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%dinner%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%lunch%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%meal%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%chinese%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%hungry%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%foodie%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%jollof%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%amala%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%fufu%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%buka%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%cafe%'
  THEN 'food'

  -- study
  WHEN lower(title || ' ' || coalesce(description, '')) LIKE '%study%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%exam%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%tutorial%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%lesson%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%class%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%school%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%university%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%jamb%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%waec%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%lecture%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%assignment%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%course%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%mathematics%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%physics%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%chemistry%'
  THEN 'study'

  -- dev
  WHEN lower(title || ' ' || coalesce(description, '')) LIKE '%dev%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%developer%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%code%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%app%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%website%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%frontend%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%backend%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%hackathon%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%javascript%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%python%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%react%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%programming%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%tech meetup%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%software%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%coding%'
  THEN 'dev'

  -- event
  WHEN lower(title || ' ' || coalesce(description, '')) LIKE '%event%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%meetup%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%party%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%concert%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%music%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%night%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%club%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%shrine%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%game%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%basketball%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%football%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%birthday%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%wedding%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%hangout%'
  THEN 'event'

  -- errands
  WHEN lower(title || ' ' || coalesce(description, '')) LIKE '%errand%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%delivery%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%courier%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%pharmacy%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%pick up%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%drop off%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%package%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%buy for me%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%fetch%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%parcel%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%bank run%'
       OR lower(title || ' ' || coalesce(description, '')) LIKE '%atm%'
  THEN 'errands'

  -- keep existing category if no keyword matches
  ELSE category
END
WHERE category IS NULL
   OR category = ''
   OR category = 'other';

-- Show how many were updated
SELECT category, count(*) as updated_count
FROM public.tasks
GROUP BY category
ORDER BY category;
