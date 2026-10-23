-- Basketball courts near the UW Seattle campus.
-- WKT points are POINT(longitude latitude) -- longitude first!
-- OSM rows use the real OSM id, so the importer matches them exactly later.
insert into public.courts
  (name, location, lit, indoor, hoop_count, surface, status, source, source_ref, manually_edited)
values
  ('Denny Courts',           'SRID=4326;POINT(-122.306971 47.660225)', true,  false, 2, 'concrete', 'active', 'osm', 'way/682188477', false),
  ('Laurelhurst Half Court', 'SRID=4326;POINT(-122.280612 47.653557)', null,  false, 1, 'concrete', 'active', 'osm', 'way/358276748', false),
  ('Ravenna Park',           'SRID=4326;POINT(-122.310858 47.672905)', false, false, 2, 'asphalt',  'active', 'osm', 'way/590302001', false),
  ('Green Lake Half Court',  'SRID=4326;POINT(-122.328433 47.680037)', false, false, 1, 'asphalt',  'active', 'osm', 'way/441999987', false),
  ('Green Lake Full Court',  'SRID=4326;POINT(-122.328146 47.680018)', true,  false, 2, 'asphalt',  'active', 'osm', 'way/34607285',  false),
  -- Not in OSM (indoor courts aren't mapped); coordinates taken by hand.
  ('UW IMA',                 'SRID=4326;POINT(-122.301431 47.653522)', true,  true,  null, 'wood', 'active', 'manual', 'uw-ima',      true)
on conflict (source, source_ref) do nothing;